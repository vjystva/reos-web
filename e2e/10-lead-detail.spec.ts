/**
 * Lead detail page — CTA regression suite.
 *
 * Locks in the fixes for the "Leads page ka koi bhi CTA kaam nhi kar rha"
 * report. Every one of these assertions FAILS against the pre-fix code:
 *
 *  1. Stage stepper / "Advance to X" / "Change stage" select used
 *     `useUpdateLeadMutation({ stage })` -> `PATCH /api/leads/:id`, which the
 *     backend rejects with 400 "property stage should not exist" (`stage` is
 *     deliberately absent from `UpdateLeadDto`). The page only ever showed
 *     "Could not update the stage. Try again." The working path is
 *     `PATCH /api/leads/:id/status` -> backend `POST /leads/:id/stage`.
 *  2. "Convert to Booking" POSTed to `/api/leads/:id/convert`, which does not
 *     exist on the backend (404). Bookings are created by `POST /bookings`
 *     from the inventory unit-selection flow.
 *  3. "Score breakdown" is now a `<details>` disclosure.
 *  4. Notes are `lead_activities` rows, not a `leads.notes` column.
 *
 * The stage assertions deliberately check the RENDERED stage (badge chip,
 * "Stage" field, and the `#lead-stage-select` value — all fed from the
 * refetched lead) rather than merely asserting no error banner appeared.
 */
import { test, expect, type Page } from "@playwright/test";
import { loginAs, ADMIN_EMAIL, ADMIN_PASSWORD, BASE } from "./helpers";

/** Long-form labels — `stageLabel()` in `@/lib/utils`. */
const LONG = {
  new: "New",
  contacted: "Contacted",
  site_visit_scheduled: "Site Visit Scheduled",
} as const;

/** Short-form chip labels — `LeadStageBadge`. */
const CHIP = {
  new: "New",
  contacted: "Contacted",
  site_visit_scheduled: "Site Visit",
} as const;

/**
 * Creates a throwaway lead through the BFF so each test owns a lead sitting at
 * a known stage (`new`) and never fights another spec for fixture data.
 */
async function createLead(page: Page, tag: string): Promise<string> {
  const suffix = String(Date.now()).slice(-8);
  const res = await page.request.post(`${BASE}/api/leads`, {
    data: {
      firstName: "E2E",
      lastName: tag,
      phone: `+9198${suffix}`,
      source: "phone",
      budgetMin: 5_000_000,
      budgetMax: 15_000_000,
    },
  });
  expect(
    [200, 201],
    `lead fixture creation failed: ${res.status()} ${await res.text()}`,
  ).toContain(res.status());
  const body = (await res.json()) as { id: string };
  expect(body.id).toBeTruthy();
  return body.id;
}

/**
 * Asserts the page is genuinely showing `stage` — chip, "Stage" field and the
 * stage <select> all read from the refetched lead, so agreement across the
 * three means the write really landed server-side.
 */
async function expectStage(
  page: Page,
  stage: keyof typeof LONG,
): Promise<void> {
  await expect(page.locator("#lead-stage-select")).toHaveValue(stage, {
    timeout: 15_000,
  });
  // The stepper marks the live stage with aria-current="step".
  await expect(
    page.locator('li[aria-current="step"]'),
  ).toContainText(LONG[stage], { timeout: 15_000 });
  // Header chip.
  await expect(
    page.locator("h1").locator("xpath=../..").getByText(CHIP[stage], {
      exact: true,
    }),
  ).toBeVisible({ timeout: 15_000 });
}

/** The generic failure message the broken page showed on every CTA. */
async function expectNoStageError(page: Page): Promise<void> {
  await expect(
    page.getByText(/Could not update the stage/i),
  ).toHaveCount(0);
  await expect(
    page.getByText(/property stage should not exist/i),
  ).toHaveCount(0);
}

test.describe("Lead detail — CTAs", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  });

  test("lead detail page renders the core surfaces", async ({ page }) => {
    const leadId = await createLead(page, "Renders");
    await page.goto(`/dashboard/leads/${leadId}`);

    await expect(
      page.getByRole("heading", { name: /E2E Renders/i }),
    ).toBeVisible();
    // Card titles, addressed by role — "Engagement" also appears as a
    // score-breakdown row label inside the (collapsed) disclosure.
    await expect(
      page.getByRole("heading", { name: "Pipeline stage" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Lead record" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Engagement" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Notes" })).toBeVisible();
    await expect(page.getByRole("button", { name: /convert to booking/i })).toBeVisible();
    await expectStage(page, "new");
  });

  test("stage stepper click advances the stage and the UI reflects it", async ({
    page,
  }) => {
    const leadId = await createLead(page, "Stepper");
    await page.goto(`/dashboard/leads/${leadId}`);
    await expectStage(page, "new");

    // The stepper button — aria-label from `LeadStageStepper`.
    await page
      .getByRole("button", { name: `Move lead to ${LONG.contacted}` })
      .click();

    // Business expectation: the lead is now Contacted, everywhere.
    await expectStage(page, "contacted");
    await expectNoStageError(page);

    // Visual confirmation of the healthy post-transition state.
    await page.screenshot({
      path: "test-results/lead-detail-after-stepper.png",
      fullPage: true,
    });

    // Server-side truth, independent of the rendered DOM.
    const check = await page.request.get(`${BASE}/api/leads/${leadId}`);
    expect(check.status()).toBe(200);
    expect(((await check.json()) as { stage?: string }).stage).toBe("contacted");
  });

  test("'Advance to X' button advances the stage and the UI reflects it", async ({
    page,
  }) => {
    const leadId = await createLead(page, "Advance");
    await page.goto(`/dashboard/leads/${leadId}`);
    await expectStage(page, "new");

    // new -> contacted
    await page
      .getByRole("button", { name: `Advance to ${LONG.contacted}` })
      .click();
    await expectStage(page, "contacted");

    // contacted -> site_visit_scheduled (the callout retargets itself)
    await page
      .getByRole("button", { name: `Advance to ${LONG.site_visit_scheduled}` })
      .click();
    await expectStage(page, "site_visit_scheduled");
    await expectNoStageError(page);

    const check = await page.request.get(`${BASE}/api/leads/${leadId}`);
    expect(((await check.json()) as { stage?: string }).stage).toBe(
      "site_visit_scheduled",
    );
  });

  test("'Change stage' select advances the stage and the UI reflects it", async ({
    page,
  }) => {
    const leadId = await createLead(page, "Select");
    await page.goto(`/dashboard/leads/${leadId}`);
    await expectStage(page, "new");

    await page.locator("#lead-stage-select").selectOption("contacted");

    await expectStage(page, "contacted");
    await expectNoStageError(page);
  });

  test("an illegal stage jump surfaces the backend's real reason", async ({
    page,
  }) => {
    const leadId = await createLead(page, "Illegal");
    await page.goto(`/dashboard/leads/${leadId}`);
    await expectStage(page, "new");

    // new -> booking is not an allowed transition (ALLOWED_FORWARD_TRANSITIONS).
    await page.getByRole("button", { name: "Move lead to Booking" }).click();

    // The actionable upstream message, not "try again".
    await expect(
      page.getByText(/Invalid stage transition: new -> booking/i),
    ).toBeVisible({ timeout: 15_000 });
    // And the lead did not move.
    await expectStage(page, "new");
  });

  test("marking a lead lost prompts for the reason the backend requires", async ({
    page,
  }) => {
    const leadId = await createLead(page, "Lost");
    await page.goto(`/dashboard/leads/${leadId}`);
    await expectStage(page, "new");

    await page.getByRole("button", { name: "Move lead to Lost" }).click();

    // No blind request — the reason prompt appears first.
    const reason = page.locator("#lead-lost-reason");
    await expect(reason).toBeVisible();
    await expect(
      page.getByText(/lostReason is required/i),
    ).toHaveCount(0);

    await reason.fill("Budget mismatch — went with a competitor");
    await page.getByRole("button", { name: /^mark as lost$/i }).click();

    await expect(page.locator("#lead-stage-select")).toHaveValue("lost", {
      timeout: 15_000,
    });
    await expect(page.getByText(/Lead is closed as lost/i)).toBeVisible();
  });

  test("'Score breakdown' is a collapsible disclosure", async ({ page }) => {
    const leadId = await createLead(page, "Score");
    await page.goto(`/dashboard/leads/${leadId}`);

    const summary = page.getByText("Score breakdown");
    await expect(summary).toBeVisible();

    const details = page.locator("details", { has: summary });
    // Collapsed by default.
    await expect(details).not.toHaveAttribute("open", /.*/);
    await expect(page.getByText("Source weight")).toBeHidden();

    await summary.click();
    await expect(details).toHaveAttribute("open", /.*/);
    await expect(page.getByText("Source weight")).toBeVisible();
    await expect(page.getByText("Budget match")).toBeVisible();

    await summary.click();
    await expect(details).not.toHaveAttribute("open", /.*/);
  });

  test("saving a note lands on the engagement timeline", async ({ page }) => {
    const leadId = await createLead(page, "Notes");
    await page.goto(`/dashboard/leads/${leadId}`);

    const body = `E2E note ${Date.now()}`;
    await page.getByLabel("Lead notes").fill(body);
    await page.getByRole("button", { name: /save notes/i }).click();

    // The old implementation PATCHed {notes} and 400'd upstream.
    await expect(page.getByText(/property notes should not exist/i)).toHaveCount(0);
    await expect(page.getByText(body)).toBeVisible({ timeout: 15_000 });

    // Persisted as a `note` activity row.
    const res = await page.request.get(`${BASE}/api/leads/${leadId}/activities`);
    expect(res.status()).toBe(200);
    const json = (await res.json()) as {
      data: { activityType: string; body: string | null }[];
    };
    expect(
      json.data.some((a) => a.activityType === "note" && a.body === body),
    ).toBe(true);
  });

  test("'Convert to Booking' lands on the real booking flow, not a 404", async ({
    page,
  }) => {
    const leadId = await createLead(page, "Convert");

    // Nothing may hit the phantom endpoint.
    const convertCalls: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/convert")) convertCalls.push(req.url());
    });

    await page.goto(`/dashboard/leads/${leadId}`);
    await page.getByRole("button", { name: /convert to booking/i }).click();

    // Step 1 of the real flow: pick a project.
    await page.waitForURL(/\/dashboard\/inventory/, { timeout: 15_000 });
    expect(page.url()).toContain(`leadId=${leadId}`);
    expect(page.url()).toContain("intent=book");
    expect(convertCalls).toEqual([]);

    // A real page, with the conversion context on screen.
    await expect(page.getByRole("heading", { name: /^inventory$/i })).toBeVisible();
    await expect(page.getByText(/converting to booking/i)).toBeVisible();
    await expect(page.getByText(/E2E Convert/)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/404|not found/i)).toHaveCount(0);

    await page.screenshot({
      path: "test-results/lead-convert-landing.png",
      fullPage: true,
    });
  });

  test("the conversion context survives the drill-down into a project", async ({
    page,
  }) => {
    const leadId = await createLead(page, "Carry");
    await page.goto(
      `/dashboard/inventory?leadId=${leadId}&intent=book`,
    );

    // Wait out the skeleton before deciding whether the env has projects.
    const projectLinks = page.getByRole("link", {
      name: /view inventory for/i,
    });
    await expect(page.getByRole("heading", { name: /^inventory$/i })).toBeVisible();
    await projectLinks
      .first()
      .waitFor({ state: "visible", timeout: 15_000 })
      .catch(() => {});
    if ((await projectLinks.count()) === 0) {
      test.skip(true, "no projects seeded in this environment");
    }

    await projectLinks.first().click();
    await page.waitForURL(/\/dashboard\/inventory\/[^/?]+/, { timeout: 15_000 });

    // `leadId` must ride along so `BookingForm` can pre-select the lead.
    expect(page.url()).toContain(`leadId=${leadId}`);
    await expect(page.getByText(/booking in progress/i)).toBeVisible();
  });

  test("BFF: stage moves go through /status, never PATCH /api/leads/:id", async ({
    page,
  }) => {
    const leadId = await createLead(page, "Contract");

    // The path the broken page used.
    const bad = await page.request.patch(`${BASE}/api/leads/${leadId}`, {
      data: { stage: "contacted" },
    });
    expect(bad.status()).toBe(400);
    expect(await bad.text()).toContain("property stage should not exist");

    // The path the fixed page uses.
    const good = await page.request.patch(
      `${BASE}/api/leads/${leadId}/status`,
      { data: { status: "contacted" } },
    );
    expect([200, 201]).toContain(good.status());

    const after = await page.request.get(`${BASE}/api/leads/${leadId}`);
    expect(((await after.json()) as { stage?: string }).stage).toBe("contacted");
  });

  test("BFF: POST /api/leads/:id/convert is not part of any flow", async ({
    page,
  }) => {
    const leadId = await createLead(page, "Phantom");
    const res = await page.request.post(`${BASE}/api/leads/${leadId}/convert`);
    // Documents WHY ConvertLeadButton no longer calls this.
    expect(res.status()).toBe(404);
  });
});

/**
 * Budget inputs echo the Indian short form as you type, so "15000000" cannot
 * be silently mistaken for "1500000". Uses `inr()` from `@/lib/utils`.
 */
test.describe("Create lead — budget readability", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto("/dashboard/pipeline");
    await page.getByRole("button", { name: /add lead/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("budget min/max render the Cr/L word form live", async ({ page }) => {
    const min = page.locator("#lead-budget-min");
    const max = page.locator("#lead-budget-max");
    const minHint = page.locator("#lead-budget-min-hint");
    const maxHint = page.locator("#lead-budget-max-hint");

    // Nothing typed -> no noise.
    await expect(minHint).toHaveText("");
    await expect(maxHint).toHaveText("");

    await min.fill("5000000");
    await expect(minHint).toHaveText("₹50 L");

    await max.fill("15000000");
    await expect(maxHint).toHaveText("₹1.5 Cr");

    // Live: one more zero must visibly change the word form.
    await max.fill("150000000");
    await expect(maxHint).toHaveText("₹15 Cr");

    await page.screenshot({
      path: "test-results/create-lead-budget-hints.png",
      fullPage: true,
    });
  });

  test("budget hint clears for empty and non-positive input", async ({
    page,
  }) => {
    const min = page.locator("#lead-budget-min");
    const minHint = page.locator("#lead-budget-min-hint");

    await min.fill("2500000");
    await expect(minHint).toHaveText("₹25 L");

    await min.fill("");
    await expect(minHint).toHaveText("");

    await min.fill("0");
    await expect(minHint).toHaveText("");
  });
});
