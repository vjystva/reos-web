/**
 * Scenario 20 – Bulk unit status change (block / release a floor).
 *
 * Closes the gap where `POST /bulk/units/status` existed only as an API: a
 * builder admin holding ~50 units out of sale had to do 50 individual status
 * transitions. This drives the real UI — table view → row checkboxes → "Block
 * selected" — and then re-reads the units through the BFF to prove the statuses
 * actually persisted, plus the unit status history to prove the bulk note landed
 * in `unit_status_history.note` (the same column the per-unit transition writes).
 *
 * Fixtures are created through the BFF rather than the UI (tower + unit creation
 * already have coverage in 11-inventory.spec.ts) so a failure here points at the
 * bulk flow, not at setup. Fresh project per run keeps it deterministic and
 * avoids the `(tenant_id, project_id, name)` unique index on towers.
 */
import { test, expect, type Page } from "@playwright/test";
import { loginAs, ADMIN_EMAIL, ADMIN_PASSWORD, BASE, API, backendToken } from "./helpers";

interface UnitRow {
  id: string;
  unitNumber?: string;
  status?: string;
}

interface StatusHistoryRow {
  from_status: string | null;
  to_status: string;
  note: string | null;
}

async function createProject(page: Page): Promise<string> {
  const res = await page.request.post(`${BASE}/api/projects`, {
    data: {
      name: `E2E Bulk Status ${Date.now()}`,
      projectType: "apartment",
      city: "Pune",
      location: "Baner, Pune",
    },
  });
  expect(res.status(), `project creation failed: ${await res.text()}`).toBe(201);
  return ((await res.json()) as { id: string }).id;
}

async function createTower(page: Page, projectId: string): Promise<string> {
  const res = await page.request.post(
    `${BASE}/api/projects/${projectId}/towers`,
    {
      data: { name: `BT-${Date.now().toString().slice(-6)}`, totalFloors: 5 },
    },
  );
  expect(res.status(), `tower creation failed: ${await res.text()}`).toBe(201);
  return ((await res.json()) as { id: string }).id;
}

async function createUnit(
  page: Page,
  projectId: string,
  towerId: string,
  unitNumber: string,
): Promise<UnitRow> {
  const res = await page.request.post(
    `${BASE}/api/projects/${projectId}/units`,
    {
      data: {
        towerId,
        unitNumber,
        floor: 3,
        bedrooms: 2,
        area: 1100,
      },
    },
  );
  expect(res.status(), `unit creation failed: ${await res.text()}`).toBe(201);
  return (await res.json()) as UnitRow;
}

test.describe("Scenario 20 – bulk unit status change", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  });

  test("block two units from the table, then release one", async ({ page, request }) => {
    const projectId = await createProject(page);
    const towerId = await createTower(page, projectId);
    const stamp = Date.now().toString().slice(-6);
    const unitA = await createUnit(page, projectId, towerId, `BA-${stamp}`);
    const unitB = await createUnit(page, projectId, towerId, `BB-${stamp}`);
    const unitC = await createUnit(page, projectId, towerId, `BC-${stamp}`);

    // -----------------------------------------------------------------------
    // 1. Table view for that tower. The bulk bar is hidden with no selection.
    // -----------------------------------------------------------------------
    await page.goto(
      `/dashboard/inventory/${projectId}?tower=${towerId}&view=table`,
    );
    const bulkBar = page.getByRole("region", { name: "Bulk unit actions" });
    await expect(page.getByLabel(`Select unit ${unitA.unitNumber}`)).toBeVisible({
      timeout: 15_000,
    });
    await expect(bulkBar).toBeHidden();

    // -----------------------------------------------------------------------
    // 2. Check two rows → the bar appears with the count.
    // -----------------------------------------------------------------------
    await page.getByLabel(`Select unit ${unitA.unitNumber}`).check();
    await page.getByLabel(`Select unit ${unitB.unitNumber}`).check();
    await expect(bulkBar).toBeVisible();
    await expect(page.getByTestId("bulk-selection-count")).toHaveText(
      "2 selected",
    );

    // -----------------------------------------------------------------------
    // 3. Block them, with a note, in ONE request.
    // -----------------------------------------------------------------------
    const NOTE = `Held for channel partner ${stamp}`;
    await page.getByLabel("Bulk status change note").fill(NOTE);

    const [bulkRes] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes("/api/bulk/units/status") &&
          r.request().method() === "POST",
        { timeout: 15_000 },
      ),
      page.getByRole("button", { name: /Block selected/ }).click(),
    ]);
    expect(
      bulkRes.status(),
      `bulk status call failed: ${await bulkRes.text()}`,
    ).toBe(200);
    const bulkBody = (await bulkRes.json()) as {
      processed: number;
      succeeded: number;
      failed: number;
    };
    expect(bulkBody).toMatchObject({ processed: 2, succeeded: 2, failed: 0 });

    // One call for two units — the whole point of the feature.
    expect(
      JSON.parse(bulkRes.request().postData() ?? "{}").items,
    ).toHaveLength(2);

    // -----------------------------------------------------------------------
    // 4. Business outcome: re-read the units, and the third is untouched.
    // -----------------------------------------------------------------------
    const after = await page.request.get(
      `${BASE}/api/projects/${projectId}/units?towerId=${towerId}`,
    );
    const rows = ((await after.json()) as { data: UnitRow[] }).data;
    const byId = new Map(rows.map((u) => [u.id, u]));
    expect(byId.get(unitA.id)?.status).toBe("blocked");
    expect(byId.get(unitB.id)?.status).toBe("blocked");
    expect(byId.get(unitC.id)?.status).toBe("available");

    // The note went to unit_status_history — no new column was invented for it.
    const token = await backendToken(request);
    const historyRes = await request.get(
      `${API}/projects/${projectId}/units/${unitA.id}/history`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(historyRes.status()).toBe(200);
    const history = (await historyRes.json()) as StatusHistoryRow[];
    const blockEntry = history.find((h) => h.to_status === "blocked");
    expect(blockEntry?.from_status).toBe("available");
    expect(blockEntry?.note).toBe(NOTE);

    // -----------------------------------------------------------------------
    // 5. Release one back. Selection was cleared by the successful block, so
    //    this also proves the grid refetched with the new statuses.
    // -----------------------------------------------------------------------
    await expect(bulkBar).toBeHidden();
    await page.getByLabel(`Select unit ${unitA.unitNumber}`).check();
    const [releaseRes] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes("/api/bulk/units/status") &&
          r.request().method() === "POST",
        { timeout: 15_000 },
      ),
      page.getByRole("button", { name: /Release selected/ }).click(),
    ]);
    expect(releaseRes.status()).toBe(200);

    const after2 = await page.request.get(
      `${BASE}/api/projects/${projectId}/units?towerId=${towerId}`,
    );
    const rows2 = ((await after2.json()) as { data: UnitRow[] }).data;
    const byId2 = new Map(rows2.map((u) => [u.id, u]));
    expect(byId2.get(unitA.id)?.status).toBe("available");
    expect(byId2.get(unitB.id)?.status).toBe("blocked");
  });

  test("select-all only covers the rows on screen, and ineligible units disable the action", async ({
    page,
  }) => {
    const projectId = await createProject(page);
    const towerId = await createTower(page, projectId);
    const stamp = Date.now().toString().slice(-6);
    const unitA = await createUnit(page, projectId, towerId, `SA-${stamp}`);
    await createUnit(page, projectId, towerId, `SB-${stamp}`);

    await page.goto(
      `/dashboard/inventory/${projectId}?tower=${towerId}&view=table`,
    );
    await expect(page.getByLabel(`Select unit ${unitA.unitNumber}`)).toBeVisible({
      timeout: 15_000,
    });

    await page.getByLabel("Select all units").check();
    await expect(page.getByTestId("bulk-selection-count")).toHaveText(
      "2 selected",
    );
    // Both are available → blockable, and neither can be "released" again.
    await expect(
      page.getByRole("button", { name: /Block selected \(2\)/ }),
    ).toBeEnabled();
    await expect(
      page.getByRole("button", { name: /Release selected/ }),
    ).toBeDisabled();

    // Clear drops the selection and hides the bar.
    await page.getByRole("button", { name: "Clear" }).click();
    await expect(
      page.getByRole("region", { name: "Bulk unit actions" }),
    ).toBeHidden();
  });
});
