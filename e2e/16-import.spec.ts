/**
 * Bulk CSV lead import (/dashboard/import).
 *
 * Regression cover for the "no happy case works" QA pass: the point of these
 * tests is that the import flow ends with REAL LEADS IN THE DATABASE, not with
 * a green success card. Every UI test that submits an import re-queries
 * `GET /api/leads` afterwards and asserts the row is actually there.
 *
 * Idempotency note: the built-in "Load sample CSV" fixture uses fixed phone
 * numbers, so once it has been imported on a given database every subsequent
 * run sees those rows as `duplicate_existing` and stages 0 ready rows. The
 * sample fixture is therefore used only to assert PARSING / MAPPING /
 * DUPLICATE-DETECTION behaviour, which is stable. Tests that assert real
 * insertion paste a freshly generated CSV with unique phone numbers.
 *
 * Explicitly OUT OF SCOPE here: the PM's separate "make the import page
 * generic / reusable for entities other than leads" request. That is an
 * architectural change needing its own scoping, and nothing in this file
 * assumes or prepares for it.
 */
import { test, expect, type Page } from "@playwright/test";
import { loginAs, ADMIN_EMAIL, ADMIN_PASSWORD, BASE } from "./helpers";

/** The dev server compiles routes on first hit; these pages are query-heavy. */
const SLOW = 120_000;

/** Flat under test-results/, matching 10-lead-detail.spec.ts. */
const SHOTS = "test-results/import";

/** Unique-per-run CSV so repeat runs never trip duplicate detection. */
function uniqueCsv(stamp: string) {
  const phone = (n: number) => `+9199${stamp}${n}`;
  return [
    "first_name,last_name,phone,email,budget_min,budget_max,preferred_location,project_interest,external_ref",
    `E2EAlpha,Importer,${phone(1)},e2e.alpha.${stamp}@example.com,5000000,7000000,Whitefield,Prestige Lakeside,E2E-${stamp}-1`,
    `E2EBeta,Importer,${phone(2)},e2e.beta.${stamp}@example.com,8000000,9000000,Indiranagar,Brigade Cornerstone,E2E-${stamp}-2`,
    // Deliberately invalid — no last name. Must be staged as NOT ready and must
    // never reach the backend.
    `E2EGamma,,${phone(3)},e2e.gamma.${stamp}@example.com,,,,,E2E-${stamp}-3`,
  ].join("\n");
}

async function gotoImport(page: Page) {
  await page.goto("/dashboard/import");
  await expect(
    page.getByRole("heading", { name: /bulk csv import/i }),
  ).toBeVisible({ timeout: SLOW });
}

test.describe("CSV lead import – happy path actually creates leads", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  });

  test("page loads with no error banner", async ({ page }) => {
    test.setTimeout(SLOW);
    await gotoImport(page);
    await expect(page.getByText(/Failed to load/i)).not.toBeVisible();
    await page.screenshot({ path: `${SHOTS}-01-empty.png`, fullPage: true });
  });

  test("'Load sample CSV' parses, auto-maps columns and flags bad rows", async ({
    page,
  }) => {
    test.setTimeout(SLOW);
    await gotoImport(page);

    await page.getByRole("button", { name: /load sample csv/i }).click();

    // 6 data rows in SAMPLE_CSV.
    await expect(page.getByText("Rows parsed")).toBeVisible();
    await expect(
      page.getByText("Rows parsed").locator("xpath=..").getByText("6"),
    ).toBeVisible({ timeout: 15_000 });

    // guessMapping must resolve every header the backend requires, from
    // human-written spellings ("Mobile Number" -> phone).
    await expect(page.locator("#map-first_name")).toHaveValue("First Name");
    await expect(page.locator("#map-last_name")).toHaveValue("Last Name");
    await expect(page.locator("#map-phone")).toHaveValue("Mobile Number");
    await expect(page.locator("#map-email")).toHaveValue("Email Address");
    await expect(page.locator("#map-external_ref")).toHaveValue("CRM Ref");

    // Row 7 ("Deepa") has no last name -> blocking issue.
    await expect(page.getByText("Missing Last name").first()).toBeVisible();
    // Row 6 ("Imran", 9845077219) repeats row 5's number in a different format
    // -> in-file duplicate, matched on the last 10 digits.
    await expect(page.getByText(/Duplicate of row \d+ in this file/)).toBeVisible();

    await page.screenshot({ path: `${SHOTS}-02-sample-staged.png`, fullPage: true });
  });

  test("changing a column mapping select re-stages the rows", async ({ page }) => {
    test.setTimeout(SLOW);
    await gotoImport(page);
    await page.getByRole("button", { name: /load sample csv/i }).click();
    await expect(page.locator("#map-last_name")).toHaveValue("Last Name");

    // Unmapping a REQUIRED column must block the import outright.
    await page.locator("#map-last_name").selectOption("");
    await expect(
      page.getByText(/Map every required column before importing/i),
    ).toBeVisible({ timeout: 15_000 });

    // Re-mapping it must clear the block.
    await page.locator("#map-last_name").selectOption("Last Name");
    await expect(
      page.getByText(/Map every required column before importing/i),
    ).not.toBeVisible({ timeout: 15_000 });
  });

  test("importing a pasted CSV creates real leads visible in GET /api/leads", async ({
    page,
  }) => {
    test.setTimeout(SLOW);
    const stamp = String(Date.now()).slice(-8);
    await gotoImport(page);

    await page.getByLabel("CSV text").fill(uniqueCsv(stamp));

    // 3 rows parsed, 2 ready (the no-last-name row is held back client-side).
    await expect(
      page.getByText("Rows parsed").locator("xpath=..").getByText("3"),
    ).toBeVisible({ timeout: 20_000 });

    const submit = page.getByRole("button", { name: /^Import 2 leads$/ });
    await expect(submit).toBeEnabled({ timeout: 20_000 });
    await page.screenshot({ path: `${SHOTS}-03-ready-to-import.png`, fullPage: true });

    await submit.click();

    // Server-side result card.
    await expect(page.getByText(/Import result/i)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/^2 imported$/)).toBeVisible();
    await expect(page.getByText(/rejected by the server/i)).not.toBeVisible();
    await page.screenshot({ path: `${SHOTS}-04-import-result.png`, fullPage: true });

    // THE assertion that matters: the leads exist in the database afterwards.
    const res = await page.request.get(
      `${BASE}/api/leads?q=${encodeURIComponent(`E2EAlpha`)}&pageSize=25`,
    );
    expect(res.status()).toBe(200);
    const body = (await res.json()) as {
      data: Array<{
        firstName?: string;
        lastName?: string;
        source?: string;
        phone?: string;
      }>;
    };
    const created = body.data.filter(
      (l) => l.firstName === "E2EAlpha" && l.phone?.includes(stamp),
    );
    expect(created.length).toBe(1);
    expect(created[0].lastName).toBe("Importer");
    // The importer always stamps source = csv_import.
    expect(created[0].source).toBe("csv_import");

    // And the invalid row must NOT have been created.
    const gamma = await page.request.get(
      `${BASE}/api/leads?q=E2EGamma&pageSize=25`,
    );
    const gammaBody = (await gamma.json()) as {
      data: Array<{ phone?: string }>;
    };
    expect(gammaBody.data.filter((l) => l.phone?.includes(stamp)).length).toBe(0);
  });

  test("BFF POST /api/leads/import round-trips to the real backend importer", async ({
    page,
  }) => {
    test.setTimeout(SLOW);
    const stamp = String(Date.now()).slice(-8);
    const csv = [
      "first_name,last_name,phone,email",
      `E2EDirect,Importer,+9198${stamp}7,e2e.direct.${stamp}@example.com`,
      // Invalid phone -> the backend must reject this ROW without failing the
      // whole request (per-row savepoint).
      `E2EBad,Importer,nope,e2e.bad.${stamp}@example.com`,
    ].join("\r\n");

    const res = await page.request.post(`${BASE}/api/leads/import`, {
      multipart: {
        file: {
          name: "leads.csv",
          mimeType: "text/csv",
          buffer: Buffer.from(csv, "utf8"),
        },
      },
    });
    expect(res.status()).toBe(200);
    const body = (await res.json()) as {
      imported: number;
      rejected: Array<{ row: number; reason: string }>;
    };
    expect(body.imported).toBe(1);
    expect(body.rejected).toHaveLength(1);
    expect(body.rejected[0].row).toBe(3); // header = line 1
    expect(body.rejected[0].reason).toMatch(/phone/i);

    // Confirm the good row is genuinely persisted.
    const check = await page.request.get(
      `${BASE}/api/leads?q=E2EDirect&pageSize=25`,
    );
    const checkBody = (await check.json()) as {
      data: Array<{ phone?: string; source?: string }>;
    };
    const hit = checkBody.data.filter((l) => l.phone?.includes(stamp));
    expect(hit.length).toBe(1);
    expect(hit[0].source).toBe("csv_import");
  });

  test("an empty upload is rejected rather than silently succeeding", async ({
    page,
  }) => {
    test.setTimeout(SLOW);
    const res = await page.request.post(`${BASE}/api/leads/import`, {
      multipart: {
        file: { name: "empty.csv", mimeType: "text/csv", buffer: Buffer.from("") },
      },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toBe("empty_file");
  });
});
