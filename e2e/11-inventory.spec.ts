/**
 * Scenario 12 – Tower creation + unit area breakdown (PM regression).
 *
 * Covers the two defects the PM hit on the Inventory → project detail page:
 *
 *   Bug 1. An apartment project with zero towers was a hard dead end. "Add
 *          unit" required a Tower, the Tower <select> was empty, and there
 *          was NO UI anywhere to create a tower — so no unit could ever be
 *          created on a fresh apartment project.
 *
 *   Bug 2. The unit form only captured a single generic "Area (sqft)". The
 *          PM needs Super / Carpet / Balcony area captured separately.
 *
 * This is a full round-trip test, not a smoke test. It drives the real UI and
 * then re-reads the data back through the BFF to prove the tower and unit
 * actually persisted with the values that were typed in.
 *
 * The project is created fresh per-run (via the BFF, not the UI — project
 * creation already has its own coverage in 02-inventory.spec.ts) so the run
 * is deterministic and starts from the exact zero-towers state that was
 * broken. Names are timestamped to keep reruns from colliding with the
 * `(tenant_id, project_id, name)` unique index on towers.
 *
 * PREREQUISITE: backend migration 033_unit_area_breakdown must have been run.
 * The super/carpet/balcony assertions fail with a 500 from the units POST
 * until `units.super_area` / `carpet_area` / `balcony_area` exist.
 */
import { test, expect, type Page } from "@playwright/test";
import { loginAs, ADMIN_EMAIL, ADMIN_PASSWORD, BASE } from "./helpers";

interface CreatedProject {
  id: string;
  name: string;
}

interface TowerRow {
  id: string;
  name: string;
  totalFloors?: number;
  facingDirection?: string | null;
}

interface UnitRow {
  id: string;
  unitNumber?: string;
  towerId?: string | null;
  floor?: number;
  bedrooms?: number;
  area?: number;
  superArea?: number | null;
  carpetArea?: number | null;
  balconyArea?: number | null;
  facing?: string | null;
}

/** Fresh apartment project with no towers — the state Bug 1 blocked on. */
async function createApartmentProject(page: Page): Promise<CreatedProject> {
  const name = `E2E Tower Flow ${Date.now()}`;
  const res = await page.request.post(`${BASE}/api/projects`, {
    data: {
      name,
      projectType: "apartment",
      city: "Pune",
      location: "Baner, Pune",
    },
  });
  expect(
    res.status(),
    `project creation failed: ${await res.text()}`,
  ).toBe(201);
  const body = (await res.json()) as CreatedProject;
  expect(body.id).toBeTruthy();
  return { id: body.id, name };
}

test.describe("Scenario 12 – Tower creation + unit area breakdown", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  });

  test("create a tower then a unit with super/carpet/balcony areas", async ({
    page,
  }, testInfo) => {
    const project = await createApartmentProject(page);

    const towerName = `T-${Date.now().toString().slice(-6)}`;
    const unitNumber = `E2E-${Date.now().toString().slice(-6)}`;
    const TOTAL_FLOORS = 14;
    const AREA = 1100;
    const SUPER_AREA = 1350;
    const CARPET_AREA = 910;
    const BALCONY_AREA = 75;

    // -----------------------------------------------------------------------
    // 0. The broken starting state: apartment project, zero towers.
    // -----------------------------------------------------------------------
    await page.goto(`/dashboard/inventory/${project.id}`);
    await expect(
      page.getByRole("heading", { name: project.name }),
    ).toBeVisible({ timeout: 10_000 });

    const sidebar = page.getByRole("complementary", { name: "Towers" });
    await expect(sidebar).toBeVisible();
    await expect(sidebar).toContainText(/no towers yet/i);

    // Guard: the project really has no towers, so what follows is a genuine
    // create rather than a pre-existing row.
    const towersBefore = await page.request.get(
      `${BASE}/api/projects/${project.id}/towers`,
    );
    expect(towersBefore.status()).toBe(200);
    expect(((await towersBefore.json()) as { data: TowerRow[] }).data).toHaveLength(0);

    // -----------------------------------------------------------------------
    // 1. Bug 1 — create a tower through the UI affordance that did not exist.
    // -----------------------------------------------------------------------
    await sidebar.getByRole("button", { name: "+ Add tower" }).click();

    const towerDialog = page.getByRole("dialog");
    await expect(towerDialog).toBeVisible();
    await expect(
      towerDialog.getByRole("heading", { name: "Add tower" }),
    ).toBeVisible();

    await towerDialog.locator("#sidebar-tower-name").fill(towerName);
    await towerDialog
      .locator("#sidebar-tower-floors")
      .fill(String(TOTAL_FLOORS));
    await towerDialog
      .locator("#sidebar-tower-facing")
      .selectOption("north_east");
    await towerDialog
      .getByRole("button", { name: "Add tower", exact: true })
      .click();

    await expect(towerDialog).not.toBeVisible({ timeout: 10_000 });

    // -----------------------------------------------------------------------
    // 2. The new tower is listed, auto-selected, and reflected in the URL —
    //    i.e. the React Query cache was invalidated, no reload needed.
    // -----------------------------------------------------------------------
    const towerButton = sidebar.getByRole("button", {
      name: new RegExp(towerName),
    });
    await expect(towerButton).toBeVisible({ timeout: 10_000 });
    await expect(towerButton).toContainText(`${TOTAL_FLOORS}`);
    await expect(towerButton).toHaveAttribute("aria-pressed", "true");

    await page.waitForURL(/[?&]tower=/, { timeout: 10_000 });
    const towerId = new URL(page.url()).searchParams.get("tower");
    expect(towerId).toBeTruthy();

    // Business outcome, not just UI state: the tower is queryable.
    const towersAfter = await page.request.get(
      `${BASE}/api/projects/${project.id}/towers`,
    );
    const towerList = ((await towersAfter.json()) as { data: TowerRow[] }).data;
    expect(towerList).toHaveLength(1);
    expect(towerList[0].id).toBe(towerId);
    expect(towerList[0].name).toBe(towerName);
    expect(towerList[0].totalFloors).toBe(TOTAL_FLOORS);
    expect(towerList[0].facingDirection).toBe("north_east");

    // -----------------------------------------------------------------------
    // 3. Bug 2 — add a unit under that tower, filling the new area fields.
    // -----------------------------------------------------------------------
    await page.getByRole("button", { name: "+ Add unit" }).click();

    const unitDialog = page.getByRole("dialog");
    await expect(unitDialog).toBeVisible();

    // The Tower select is populated (this was the empty dropdown in the bug
    // report) and offers exactly the tower just created.
    const towerSelect = unitDialog.locator("#unit-tower");
    await expect(towerSelect.locator("option")).toHaveCount(2); // placeholder + tower
    await towerSelect.selectOption({ label: towerName });

    await unitDialog.locator("#unit-number").fill(unitNumber);
    await unitDialog.locator("#unit-floor").fill("7");
    await unitDialog.locator("#unit-bedrooms").fill("3");
    await unitDialog.locator("#unit-area").fill(String(AREA));
    await unitDialog.locator("#unit-super-area").fill(String(SUPER_AREA));
    await unitDialog.locator("#unit-carpet-area").fill(String(CARPET_AREA));
    await unitDialog.locator("#unit-balcony-area").fill(String(BALCONY_AREA));
    await unitDialog.locator("#unit-facing").selectOption("east");

    // Capture the BFF response so a failure names the cause (a missing
    // migration 033 surfaces as a 500 here) instead of a generic "the dialog
    // never closed" timeout.
    const [createRes] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes(`/api/projects/${project.id}/units`) &&
          r.request().method() === "POST",
        { timeout: 15_000 },
      ),
      unitDialog.getByRole("button", { name: "Add unit", exact: true }).click(),
    ]);
    expect(
      createRes.status(),
      `unit creation failed (has migration 033 been run?): ${await createRes.text()}`,
    ).toBe(201);

    await expect(unitDialog).not.toBeVisible({ timeout: 15_000 });

    // -----------------------------------------------------------------------
    // 4. The unit shows in the grid without a reload.
    // -----------------------------------------------------------------------
    const tile = page.getByRole("button", {
      name: new RegExp(`Unit ${unitNumber}`),
    });
    await expect(tile).toBeVisible({ timeout: 15_000 });
    await expect(tile).toContainText("3 BHK");
    await expect(tile).toContainText(AREA.toLocaleString("en-IN"));

    // -----------------------------------------------------------------------
    // 5. Business outcome: the unit persisted with every area value typed in.
    //    Read back through the BFF, scoped to the new tower.
    // -----------------------------------------------------------------------
    const unitsRes = await page.request.get(
      `${BASE}/api/projects/${project.id}/units?towerId=${towerId}`,
    );
    expect(unitsRes.status()).toBe(200);
    const units = ((await unitsRes.json()) as { data: UnitRow[] }).data;
    const created = units.find((u) => u.unitNumber === unitNumber);
    expect(
      created,
      `unit ${unitNumber} not returned by the units API`,
    ).toBeDefined();

    expect(created!.towerId).toBe(towerId);
    expect(created!.floor).toBe(7);
    expect(created!.bedrooms).toBe(3);
    expect(created!.facing).toBe("east");
    // area_sqft keeps its original meaning — it is NOT one of the three.
    expect(created!.area).toBe(AREA);
    // The three columns added by backend migration 033.
    expect(created!.superArea).toBe(SUPER_AREA);
    expect(created!.carpetArea).toBe(CARPET_AREA);
    expect(created!.balconyArea).toBe(BALCONY_AREA);

    // -----------------------------------------------------------------------
    // 6. The breakdown is visible to a human in the unit slide-over.
    // -----------------------------------------------------------------------
    await tile.click();
    // Radix derives the sheet's accessible name from <SheetTitle> (via
    // aria-labelledby), which is the bare unit number — NOT the aria-label on
    // SheetContent. Match on the title heading instead.
    const slideOver = page
      .getByRole("dialog")
      .filter({ has: page.getByRole("heading", { name: unitNumber }) });
    await expect(slideOver).toBeVisible({ timeout: 10_000 });
    await expect(slideOver).toContainText("Unit details");
    await expect(slideOver).toContainText("Super area");
    await expect(slideOver).toContainText(SUPER_AREA.toLocaleString("en-IN"));
    await expect(slideOver).toContainText("Carpet area");
    await expect(slideOver).toContainText(CARPET_AREA.toLocaleString("en-IN"));
    await expect(slideOver).toContainText("Balcony area");
    await expect(slideOver).toContainText(BALCONY_AREA.toLocaleString("en-IN"));

    // Final-state screenshot: tower in the sidebar, unit in the grid, area
    // breakdown open in the slide-over.
    const shot = testInfo.outputPath("inventory-tower-unit-final-state.png");
    await page.screenshot({ path: shot, fullPage: true });
    await testInfo.attach("final-state", {
      path: shot,
      contentType: "image/png",
    });
  });

  test("balcony area of 0 round-trips as 0, not as 'not captured'", async ({
    page,
  }) => {
    // Regression guard for the `?? null` vs `|| null` trap in
    // UnitsService.create: a zero-sqft balcony is a real answer and must not
    // collapse to NULL.
    const project = await createApartmentProject(page);

    const towerRes = await page.request.post(
      `${BASE}/api/projects/${project.id}/towers`,
      { data: { name: "T-Zero", totalFloors: 5 } },
    );
    expect(towerRes.status()).toBe(201);
    const tower = (await towerRes.json()) as TowerRow;

    const unitNumber = `Z-${Date.now().toString().slice(-6)}`;
    const unitRes = await page.request.post(
      `${BASE}/api/projects/${project.id}/units`,
      {
        data: {
          towerId: tower.id,
          unitNumber,
          floor: 1,
          bedrooms: 2,
          area: 800,
          superArea: 960,
          carpetArea: 700,
          balconyArea: 0,
        },
      },
    );
    expect(
      unitRes.status(),
      `unit creation failed (has migration 033 been run?): ${await unitRes.text()}`,
    ).toBe(201);

    const unit = (await unitRes.json()) as UnitRow;
    expect(unit.balconyArea).toBe(0);
    expect(unit.balconyArea).not.toBeNull();
    expect(unit.superArea).toBe(960);
    expect(unit.carpetArea).toBe(700);
  });

  test("a villa project needs no tower and does not show the tower field", async ({
    page,
  }) => {
    // The counterpart to Bug 1: `units.tower_id` is nullable and the backend
    // REJECTS a towerId on villa/plotted projects, so the Tower field must be
    // absent there rather than a blocker.
    const name = `E2E Villa ${Date.now()}`;
    const res = await page.request.post(`${BASE}/api/projects`, {
      data: {
        name,
        projectType: "villa",
        city: "Pune",
        location: "Wakad, Pune",
      },
    });
    expect(res.status()).toBe(201);
    const project = (await res.json()) as CreatedProject;

    await page.goto(`/dashboard/inventory/${project.id}`);
    await expect(page.getByRole("heading", { name })).toBeVisible({
      timeout: 10_000,
    });

    // No tower sidebar at all for villa projects.
    await expect(
      page.getByRole("complementary", { name: "Towers" }),
    ).toHaveCount(0);

    await page.getByRole("button", { name: "+ Add unit" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("#unit-tower")).toHaveCount(0);
    await expect(dialog).toContainText(/does not use towers/i);

    // The area breakdown is offered on non-apartment projects too.
    await expect(dialog.locator("#unit-super-area")).toBeVisible();
    await expect(dialog.locator("#unit-carpet-area")).toBeVisible();
    await expect(dialog.locator("#unit-balcony-area")).toBeVisible();
  });
});
