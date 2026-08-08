/**
 * Generic bulk CSV import (/dashboard/import).
 *
 * `16-import.spec.ts` covers the leads path and explicitly scoped OUT the
 * "make the import page generic" request. That request has now landed: the
 * page is a shell with an entity picker (Leads / Units / Dealers / Bookings /
 * Tasks) driven by one config per entity. This spec covers the new surface.
 *
 * Same standard as 16: a green result card proves nothing. Every test that
 * submits re-queries the API afterwards and asserts the records genuinely
 * exist, with the values the CSV asked for.
 *
 * Units and Dealers are the two full UI journeys (entity switch -> map ->
 * preview -> submit -> verify via API), per the brief. Bookings and Tasks get
 * BFF-level round-trips because both need fixtures (an available unit, a
 * resolvable assignee) that are cheaper and less brittle to arrange over the
 * API than by driving five selects.
 *
 * Idempotency: every fixture embeds a per-run stamp, so repeat runs never
 * collide on `uq_units_tower_unit_number` or `uq_dealers_tenant_email`.
 */
import { test, expect, type Page, type APIRequestContext } from "@playwright/test";
import {
  loginAs,
  backendToken,
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  BASE,
  API,
} from "./helpers";

/** The dev server compiles routes on first hit; these pages are query-heavy. */
const SLOW = 120_000;

/** Flat under test-results/, matching 16-import.spec.ts. */
const SHOTS = "test-results/generic-import";

function stamp(): string {
  return String(Date.now()).slice(-8);
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

async function gotoImport(page: Page) {
  await page.goto("/dashboard/import");
  await expect(
    page.getByRole("heading", { name: /bulk csv import/i }),
  ).toBeVisible({ timeout: SLOW });
}

async function selectEntity(page: Page, value: string) {
  await page.locator("#import-entity").selectOption(value);
}

/** MetricCard renders `aria-label="<label>: <value>"`. */
function tileValue(page: Page, label: string) {
  return page.getByLabel(new RegExp(`^${label}:`, "i"));
}

/**
 * An apartment project that actually has towers — the units importer resolves
 * `tower_name` inside the chosen project, so a project with none can never
 * import an apartment row.
 */
async function findApartmentProjectWithTower(
  request: APIRequestContext,
  token: string,
): Promise<{ projectId: string; projectName: string; towerName: string } | null> {
  const res = await request.get(`${API}/projects?pageSize=50`, {
    headers: auth(token),
  });
  const body = (await res.json()) as {
    data: Array<{ id: string; name: string; projectType?: string; type?: string }>;
  };
  for (const p of body.data) {
    if ((p.projectType ?? p.type) !== "apartment") continue;
    const tRes = await request.get(`${API}/projects/${p.id}/towers`, {
      headers: auth(token),
    });
    if (!tRes.ok()) continue;
    const raw = (await tRes.json()) as unknown;
    const towers = (Array.isArray(raw) ? raw : (raw as { data: unknown[] }).data) as
      Array<{ name: string }>;
    if (towers.length > 0) {
      return { projectId: p.id, projectName: p.name, towerName: towers[0].name };
    }
  }
  return null;
}

test.describe("Generic CSV import – entity picker drives the whole flow", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  });

  test("defaults to Leads so the existing leads-only URL is unchanged", async ({
    page,
  }) => {
    test.setTimeout(SLOW);
    await gotoImport(page);

    await expect(page.locator("#import-entity")).toHaveValue("leads");
    await expect(page.getByText(/Failed to load/i)).not.toBeVisible();

    // The leads-specific affordances are still present.
    await page.getByRole("button", { name: /load sample csv/i }).click();
    await expect(tileValue(page, "Rows parsed")).toContainText("6");
    await expect(tileValue(page, "Assignment mode")).toBeVisible();
    await expect(page.locator("#map-first_name")).toHaveValue("First Name");
    await expect(page.locator("#map-phone")).toHaveValue("Mobile Number");
    await expect(
      page.getByRole("button", { name: /^Import 4 leads$/ }),
    ).toBeEnabled();

    await page.screenshot({ path: `${SHOTS}-01-leads-default.png`, fullPage: true });
  });

  test("switching entity clears the staged file and retargets the mapping", async ({
    page,
  }) => {
    test.setTimeout(SLOW);
    await gotoImport(page);

    await page.getByRole("button", { name: /load sample csv/i }).click();
    await expect(tileValue(page, "Rows parsed")).toContainText("6");

    await selectEntity(page, "dealers");

    // Source, mapping and preview are all reset.
    await expect(tileValue(page, "Rows parsed")).toContainText("0");
    await expect(page.getByLabel("CSV text")).toHaveValue("");
    await expect(page.locator("#map-first_name")).toHaveCount(0);
    // Assignment mode is leads-only and must not linger.
    await expect(page.getByLabel(/^Assignment mode:/i)).toHaveCount(0);

    // Dealer targets are now the mappable columns.
    await page.getByRole("button", { name: /load sample csv/i }).click();
    await expect(page.locator("#map-commission_rate")).toBeVisible();
    await expect(page.locator("#map-kyc_status")).toBeVisible();

    await page.screenshot({ path: `${SHOTS}-02-entity-switch.png`, fullPage: true });
  });

  test("Dealers: map, flag the bad row, submit, and the dealers really exist", async ({
    page,
  }) => {
    test.setTimeout(SLOW);
    const s = stamp();
    const token = await backendToken(page.request);

    await gotoImport(page);
    await selectEntity(page, "dealers");

    // Human-written headers, so auto-mapping has real work to do.
    // Row 3 is deliberately invalid: commission rate above the 0–100 range.
    const csv = [
      "Dealer Name,Email Address,Mobile Number,Firm,Commission %,RERA Number,KYC",
      `E2E Dealer One ${s},e2e.d1.${s}@partners.example.com,+91 98111 0${s.slice(0, 4)},Alpha Realty,2.5,RERA-A-${s},verified`,
      `E2E Dealer Two ${s},e2e.d2.${s}@partners.example.com,+91 98222 0${s.slice(0, 4)},Beta Realty,1.75,RERA-B-${s},`,
      `E2E Dealer Bad ${s},e2e.d3.${s}@partners.example.com,+91 98333 0${s.slice(0, 4)},Gamma Realty,250,RERA-C-${s},pending`,
    ].join("\n");

    await page.getByLabel("CSV text").fill(csv);

    await expect(tileValue(page, "Rows parsed")).toContainText("3");
    await expect(tileValue(page, "Ready")).toContainText("2");

    // guessMapping resolved the human spellings onto the backend's columns.
    await expect(page.locator("#map-name")).toHaveValue("Dealer Name");
    await expect(page.locator("#map-email")).toHaveValue("Email Address");
    await expect(page.locator("#map-commission_rate")).toHaveValue("Commission %");
    await expect(page.locator("#map-kyc_status")).toHaveValue("KYC");

    // The out-of-range row is held back client-side, matching the DTO's @Max(100).
    await expect(
      page.getByText(/commission rate must be at most 100/i),
    ).toBeVisible();

    await page.screenshot({ path: `${SHOTS}-03-dealers-staged.png`, fullPage: true });

    const submit = page.getByRole("button", { name: /^Import 2 dealers$/ });
    await expect(submit).toBeEnabled();
    await submit.click();

    await expect(page.getByText(/Import result/i)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/^2 imported$/)).toBeVisible();
    await expect(page.getByText(/rejected by the server/i)).not.toBeVisible();
    await page.screenshot({ path: `${SHOTS}-04-dealers-result.png`, fullPage: true });

    // THE assertion that matters: the dealers are in the database.
    const found: Array<Record<string, unknown>> = [];
    for (let p = 1; p <= 10; p++) {
      const res = await page.request.get(`${API}/dealers?limit=100&page=${p}`, {
        headers: auth(token),
      });
      expect(res.status()).toBe(200);
      const body = (await res.json()) as { data: Array<Record<string, unknown>> };
      if (body.data.length === 0) break;
      found.push(
        ...body.data.filter((d) => String(d.email ?? "").includes(`.${s}@`)),
      );
    }
    expect(found).toHaveLength(2);

    const one = found.find((d) => String(d.email).startsWith("e2e.d1."))!;
    expect(one.name).toBe(`E2E Dealer One ${s}`);
    expect(Number(one.commissionRate)).toBe(2.5);
    expect(one.kycStatus).toBe("verified");

    // A blank kyc_status must fall through to the DB default, not be invented.
    const two = found.find((d) => String(d.email).startsWith("e2e.d2."))!;
    expect(two.kycStatus).toBe("pending");

    // And the invalid row must NOT have been created.
    expect(
      found.some((d) => String(d.email).startsWith("e2e.d3.")),
    ).toBe(false);
  });

  test("Units: project picker gates the import, then the units really exist", async ({
    page,
  }) => {
    test.setTimeout(SLOW);
    const s = stamp();
    const token = await backendToken(page.request);

    const fixture = await findApartmentProjectWithTower(page.request, token);
    test.skip(!fixture, "no apartment project with a tower in this tenant");
    const { projectId, projectName, towerName } = fixture!;

    await gotoImport(page);
    await selectEntity(page, "units");

    // Row 4 is deliberately invalid: bedrooms is not a number.
    const csv = [
      "Tower,Unit No,Floor,Bedrooms,Area (sqft),Carpet Area,Balcony Area,Facing,Corner",
      `${towerName},E2E${s}-1101,11,3,1450,1120,60,north_east,yes`,
      `${towerName},E2E${s}-1102,11,2,1120,890,0,east,no`,
      `${towerName},E2E${s}-1103,12,three,1120,890,45,east,no`,
    ].join("\n");

    await page.getByLabel("CSV text").fill(csv);

    await expect(tileValue(page, "Rows parsed")).toContainText("3");
    await expect(page.locator("#map-unit_number")).toHaveValue("Unit No");
    await expect(page.locator("#map-area_sqft")).toHaveValue("Area (sqft)");
    await expect(page.locator("#map-balcony_area")).toHaveValue("Balcony Area");
    await expect(page.locator("#map-is_corner_unit")).toHaveValue("Corner");

    // No project chosen yet -> submit is blocked even though rows parse.
    await expect(
      page.getByText(/select a project above before importing units/i),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /^Import /i })).toBeDisabled();
    await page.screenshot({ path: `${SHOTS}-05-units-no-project.png`, fullPage: true });

    await page.locator("#import-project").selectOption(projectId);

    // Apartment project -> tower rows are valid; only the bad-bedrooms row fails.
    await expect(
      page.getByText(/apartment project — every row needs a tower/i),
    ).toBeVisible();
    await expect(tileValue(page, "Ready")).toContainText("2");
    await expect(page.getByText(/bedrooms is not a number/i)).toBeVisible();

    await page.screenshot({ path: `${SHOTS}-06-units-staged.png`, fullPage: true });

    const submit = page.getByRole("button", { name: /^Import 2 units$/ });
    await expect(submit).toBeEnabled();
    await submit.click();

    await expect(page.getByText(/Import result/i)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/^2 imported$/)).toBeVisible();
    await expect(page.getByText(/rejected by the server/i)).not.toBeVisible();
    await page.screenshot({ path: `${SHOTS}-07-units-result.png`, fullPage: true });

    // Verify against the project-scoped units endpoint.
    const found: Array<Record<string, unknown>> = [];
    for (let p = 1; p <= 10; p++) {
      const res = await page.request.get(
        `${API}/projects/${projectId}/units?pageSize=100&page=${p}`,
        { headers: auth(token) },
      );
      expect(res.status()).toBe(200);
      const body = (await res.json()) as { data: Array<Record<string, unknown>> };
      if (body.data.length === 0) break;
      found.push(
        ...body.data.filter((u) => String(u.unitNumber ?? "").includes(`E2E${s}-`)),
      );
    }
    expect(found).toHaveLength(2);

    const a = found.find((u) => u.unitNumber === `E2E${s}-1101`)!;
    expect(a.floor).toBe(11);
    expect(a.bedrooms).toBe(3);
    expect(Number(a.area)).toBe(1450);
    expect(a.facing).toBe("north_east");
    expect(a.isCorner).toBe(true);
    expect(a.status).toBe("available");

    // balcony_area = 0 is a REAL value ("no balcony"), not a blank — it must
    // survive the round trip as 0 rather than being dropped.
    const b = found.find((u) => u.unitNumber === `E2E${s}-1102`)!;
    expect(Number(b.balconyArea)).toBe(0);
    expect(b.isCorner).toBe(false);

    // The invalid row must not exist.
    expect(found.some((u) => u.unitNumber === `E2E${s}-1103`)).toBe(false);

    // Sanity: the project the units landed in is the one that was picked.
    expect(projectName.length).toBeGreaterThan(0);
  });

  test("Units: a villa project rejects tower rows in the preview, before submit", async ({
    page,
  }) => {
    test.setTimeout(SLOW);
    const token = await backendToken(page.request);

    const res = await page.request.get(`${API}/projects?pageSize=50`, {
      headers: auth(token),
    });
    const body = (await res.json()) as {
      data: Array<{ id: string; projectType?: string; type?: string }>;
    };
    const villa = body.data.find(
      (p) => (p.projectType ?? p.type) !== "apartment",
    );
    test.skip(!villa, "no villa/plotted project in this tenant");

    await gotoImport(page);
    await selectEntity(page, "units");
    await page.getByLabel("CSV text").fill(
      [
        "Tower,Unit No,Floor,Bedrooms,Area (sqft)",
        "Tower A,V-1,0,4,2400",
      ].join("\n"),
    );
    await page.locator("#import-project").selectOption(villa!.id);

    // The backend would reject these with "Villa/plotted projects do not use
    // towers"; the preview says so first so nothing is wasted on a round trip.
    await expect(
      page.getByText(/villa\/plotted projects do not use towers/i),
    ).toBeVisible();
    await expect(tileValue(page, "Ready")).toContainText("0");
    await expect(page.getByRole("button", { name: /^Import /i })).toBeDisabled();
  });

  test("Tasks: no Duplicates tile, and BFF round-trips to the real importer", async ({
    page,
  }) => {
    test.setTimeout(SLOW);
    const s = stamp();
    const token = await backendToken(page.request);

    await gotoImport(page);
    await selectEntity(page, "tasks");
    await page.getByRole("button", { name: /load sample csv/i }).click();

    // Tasks have no natural unique key, so the tile is omitted rather than
    // showing a permanently meaningless zero.
    await expect(page.getByLabel(/^Duplicates:/i)).toHaveCount(0);
    await expect(page.getByLabel(/^Assignment mode:/i)).toHaveCount(0);
    await expect(tileValue(page, "Rows parsed")).toContainText("4");
    await expect(tileValue(page, "Ready")).toContainText("3");
    await expect(page.getByText(/due date must be an iso date/i)).toBeVisible();

    // A blank assignee is valid (unassigned task); a non-blank address that
    // resolves to nobody REJECTS the row rather than being ignored.
    const csv = [
      "title,description,priority,due_date,assigned_to_email",
      `E2E Task Keep ${s},Unassigned on purpose,,2026-09-18,`,
      `E2E Task Drop ${s},Typo'd assignee,urgent,2026-09-20,nobody.${s}@nowhere.example.com`,
    ].join("\r\n");

    const res = await page.request.post(`${BASE}/api/tasks/import`, {
      multipart: {
        file: {
          name: "tasks.csv",
          mimeType: "text/csv",
          buffer: Buffer.from(csv, "utf8"),
        },
      },
    });
    expect(res.status()).toBe(200);
    const result = (await res.json()) as {
      imported: number;
      rejected: Array<{ row: number; reason: string }>;
    };
    expect(result.imported).toBe(1);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0].row).toBe(3); // header = line 1
    expect(result.rejected[0].reason).toMatch(/unknown assigned_to_email/i);

    const check = await page.request.get(`${API}/tasks?limit=100`, {
      headers: auth(token),
    });
    const tasks = (await check.json()) as {
      data: Array<Record<string, unknown>>;
    };
    const kept = tasks.data.filter((t) =>
      String(t.title ?? "").includes(`E2E Task Keep ${s}`),
    );
    expect(kept).toHaveLength(1);
    // Blank priority falls through to the DB default.
    expect(kept[0].priority).toBe("medium");
    expect(kept[0].assignedTo).toBeNull();
    expect(
      tasks.data.some((t) => String(t.title ?? "").includes(`E2E Task Drop ${s}`)),
    ).toBe(false);
  });

  test("Bookings: reference columns are staged, and the BFF books a real unit", async ({
    page,
  }) => {
    test.setTimeout(SLOW);
    const s = stamp();
    const token = await backendToken(page.request);

    // --- UI: the preview understands the reference-group rules --------------
    await gotoImport(page);
    await selectEntity(page, "bookings");
    await page.getByRole("button", { name: /load sample csv/i }).click();

    await expect(tileValue(page, "Rows parsed")).toContainText("3");
    await expect(tileValue(page, "Ready")).toContainText("2");
    // unit_number with no project_name cannot be resolved server-side.
    await expect(
      page.getByText(/project name is required when matching by unit number/i),
    ).toBeVisible();
    // The raw-UUID escape hatches are offered, but demoted.
    await expect(page.getByText(/advanced — raw ids/i)).toBeVisible();
    await expect(page.locator("#map-lead_id")).toBeVisible();
    await page.screenshot({ path: `${SHOTS}-08-bookings-staged.png`, fullPage: true });

    // --- Fixture: an available unit + the lead that will buy it -------------
    const projRes = await page.request.get(`${API}/projects?pageSize=50`, {
      headers: auth(token),
    });
    const projects = (await projRes.json()) as {
      data: Array<{ id: string; name: string }>;
    };

    let target: { projectName: string; unitNumber: string } | null = null;
    for (const p of projects.data) {
      const uRes = await page.request.get(
        `${API}/projects/${p.id}/units?status=available&pageSize=1`,
        { headers: auth(token) },
      );
      if (!uRes.ok()) continue;
      const units = (await uRes.json()) as {
        data: Array<{ unitNumber: string }>;
      };
      if (units.data.length > 0) {
        target = { projectName: p.name, unitNumber: units.data[0].unitNumber };
        break;
      }
    }
    test.skip(!target, "no available unit in this tenant");

    const leadRes = await page.request.get(`${API}/leads?pageSize=1`, {
      headers: auth(token),
    });
    const leads = (await leadRes.json()) as {
      data: Array<{ id: string; phone?: string }>;
    };
    test.skip(leads.data.length === 0, "no leads in this tenant");
    const leadId = leads.data[0].id;

    // `lead_id` (the escape hatch) is used here so the fixture can never trip
    // the ambiguous-phone rejection when seed data shares numbers.
    const csv = [
      "lead_id,unit_number,project_name,booking_amount,notes",
      `${leadId},${target!.unitNumber},${target!.projectName},8100000,E2E generic import ${s}`,
      `${leadId},NOPE-${s},${target!.projectName},5000000,unknown unit`,
    ].join("\r\n");

    const res = await page.request.post(`${BASE}/api/bookings/import`, {
      multipart: {
        file: {
          name: "bookings.csv",
          mimeType: "text/csv",
          buffer: Buffer.from(csv, "utf8"),
        },
      },
    });
    expect(res.status()).toBe(200);
    const result = (await res.json()) as {
      imported: number;
      rejected: Array<{ row: number; reason: string }>;
    };
    expect(result.imported).toBe(1);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0].row).toBe(3);
    // Rejection reasons are surfaced verbatim, not prettified.
    expect(result.rejected[0].reason).toMatch(/no unit matches/i);

    const check = await page.request.get(`${API}/bookings?pageSize=50`, {
      headers: auth(token),
    });
    const bookings = (await check.json()) as {
      data: Array<Record<string, unknown>>;
    };
    const created = bookings.data.filter((b) =>
      String(b.notes ?? "").includes(`E2E generic import ${s}`),
    );
    expect(created).toHaveLength(1);
    expect(Number(created[0].bookingAmount)).toBe(8100000);
    expect(created[0].status).toBe("application_received");
  });

  test("an empty upload is rejected on every new import route", async ({ page }) => {
    test.setTimeout(SLOW);
    for (const path of [
      "/api/dealers/import",
      "/api/tasks/import",
      "/api/bookings/import",
    ]) {
      const res = await page.request.post(`${BASE}${path}`, {
        multipart: {
          file: {
            name: "empty.csv",
            mimeType: "text/csv",
            buffer: Buffer.from(""),
          },
        },
      });
      expect(res.status(), path).toBe(400);
      expect((await res.json()).error, path).toBe("empty_file");
    }
  });
});
