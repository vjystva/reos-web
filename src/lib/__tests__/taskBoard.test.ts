import {
  bucketTasks,
  dateInputToIso,
  dueLabel,
  filterOwners,
  isTaskOwnerRole,
  ownerLabel,
  ownerMatches,
  snoozedDueDate,
  taskBucket,
  taskOwnerOptions,
  taskResourceHref,
  taskResourceLabel,
} from "@/lib/taskBoard";
import type { Task } from "@/types/api";

/** 2026-08-02 15:00 local. */
const NOW = new Date(2026, 7, 2, 15, 0, 0).getTime();
const DAY = 86_400_000;

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: "t1",
    title: "Call customer",
    status: "open",
    priority: "medium",
    createdAt: new Date(NOW).toISOString(),
    ...overrides,
  } as Task;
}

function atLocal(y: number, m: number, d: number, h = 9): string {
  return new Date(y, m - 1, d, h, 0, 0).toISOString();
}

describe("taskBucket", () => {
  test("yesterday -> overdue", () => {
    expect(taskBucket(task({ dueDate: atLocal(2026, 8, 1) }), NOW)).toBe("overdue");
  });

  test("earlier today still counts as today, not overdue", () => {
    expect(taskBucket(task({ dueDate: atLocal(2026, 8, 2, 6) }), NOW)).toBe("today");
  });

  test("tomorrow -> upcoming", () => {
    expect(taskBucket(task({ dueDate: atLocal(2026, 8, 3) }), NOW)).toBe("upcoming");
  });

  test("no due date -> upcoming rather than dropped", () => {
    expect(taskBucket(task({ dueDate: null }), NOW)).toBe("upcoming");
  });

  test("completed and cancelled -> closed regardless of due date", () => {
    expect(
      taskBucket(task({ status: "completed", dueDate: atLocal(2026, 7, 1) }), NOW),
    ).toBe("closed");
    expect(taskBucket(task({ status: "cancelled" }), NOW)).toBe("closed");
  });
});

describe("bucketTasks", () => {
  test("splits and sorts open columns by due date, undated last", () => {
    const late = task({ id: "late", dueDate: atLocal(2026, 7, 28) });
    const lateEarlier = task({ id: "late2", dueDate: atLocal(2026, 7, 20) });
    const today = task({ id: "today", dueDate: atLocal(2026, 8, 2) });
    const soon = task({ id: "soon", dueDate: atLocal(2026, 8, 4) });
    const undated = task({ id: "undated" });
    const done = task({
      id: "done",
      status: "completed",
      completedAt: atLocal(2026, 8, 1),
    });

    const out = bucketTasks([late, undated, done, soon, today, lateEarlier], NOW);

    expect(out.overdue.map((t) => t.id)).toEqual(["late2", "late"]);
    expect(out.today.map((t) => t.id)).toEqual(["today"]);
    expect(out.upcoming.map((t) => t.id)).toEqual(["soon", "undated"]);
    expect(out.closed.map((t) => t.id)).toEqual(["done"]);
  });

  test("closed bucket is most-recently-completed first", () => {
    const older = task({
      id: "older",
      status: "completed",
      completedAt: atLocal(2026, 7, 1),
    });
    const newer = task({
      id: "newer",
      status: "completed",
      completedAt: atLocal(2026, 8, 1),
    });
    expect(bucketTasks([older, newer], NOW).closed.map((t) => t.id)).toEqual([
      "newer",
      "older",
    ]);
  });
});

describe("dueLabel", () => {
  test.each([
    [null, "No date"],
    [atLocal(2026, 8, 2), "Today"],
    [atLocal(2026, 8, 3), "Tomorrow"],
    [atLocal(2026, 8, 5), "In 3d"],
    [atLocal(2026, 8, 1), "1d late"],
    [atLocal(2026, 7, 30), "3d late"],
  ])("%s -> %s", (iso, expected) => {
    expect(dueLabel(iso, NOW)).toBe(expected);
  });

  test("far future falls back to a date", () => {
    expect(dueLabel(atLocal(2026, 12, 25), NOW)).toMatch(/25/);
  });
});

describe("snoozedDueDate", () => {
  test("future due date shifts from the due date", () => {
    const due = atLocal(2026, 8, 5);
    const next = snoozedDueDate(task({ dueDate: due }), 1, NOW);
    expect(new Date(next).getTime() - new Date(due).getTime()).toBe(DAY);
  });

  test("overdue task shifts from now, so +1d means tomorrow", () => {
    const next = snoozedDueDate(task({ dueDate: atLocal(2026, 7, 1) }), 1, NOW);
    expect(new Date(next).getTime()).toBe(NOW + DAY);
  });

  test("undated task shifts from now", () => {
    expect(new Date(snoozedDueDate(task(), 7, NOW)).getTime()).toBe(NOW + 7 * DAY);
  });
});

describe("taskResourceHref / taskResourceLabel", () => {
  test("lead deep link", () => {
    const t = task({ resourceType: "lead", resourceId: "lead-1" });
    expect(taskResourceHref(t)).toBe("/dashboard/leads/lead-1");
    expect(taskResourceLabel(t)).toBe("Lead");
  });

  test("booking deep link targets the booking detail route", () => {
    const t = task({ resourceType: "booking", resourceId: "bk 1" });
    expect(taskResourceHref(t)).toBe("/dashboard/bookings/bk%201/payments");
  });

  test("site visit has no per-visit route", () => {
    const t = task({ resourceType: "site_visit", resourceId: "sv-1" });
    expect(taskResourceHref(t)).toBeNull();
    expect(taskResourceLabel(t)).toBe("Site visit");
  });

  test("no link when either half is missing", () => {
    expect(taskResourceHref(task({ resourceType: "lead" }))).toBeNull();
    expect(taskResourceLabel(task())).toBeNull();
  });
});

describe("dateInputToIso", () => {
  test("anchors the calendar day at local noon", () => {
    const iso = dateInputToIso("2026-08-03");
    const d = new Date(iso as string);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(7);
    expect(d.getDate()).toBe(3);
    expect(d.getHours()).toBe(12);
  });

  test("empty / malformed input yields undefined", () => {
    expect(dateInputToIso("")).toBeUndefined();
    expect(dateInputToIso("03/08/2026")).toBeUndefined();
  });
});

describe("ownerLabel", () => {
  test("prefers an explicit name when one is supplied", () => {
    expect(ownerLabel({ id: "u1", email: "a@b.com", name: "Asha" })).toBe("Asha");
  });

  test("derives a display name from the email local-part", () => {
    // `users` has no `name` column, so the label comes from the address.
    expect(ownerLabel({ id: "u1", email: "asha.rao@demo.com" })).toBe("Asha Rao");
    expect(ownerLabel({ id: "u2", email: "amit.manager@reos.com" })).toBe(
      "Amit Manager",
    );
    expect(ownerLabel({ id: "u3", email: "agent1@reos.com" })).toBe("Agent1");
  });

  test("blank name falls through to the derived label", () => {
    expect(ownerLabel({ id: "u1", email: "asha.rao@demo.com", name: "  " })).toBe(
      "Asha Rao",
    );
  });

  test("falls back to the raw email when the local-part is uuid-shaped", () => {
    const email = "3f2b8c1a-4d5e-6f70-8901-abcdef123456@reos.com";
    expect(ownerLabel({ id: "u1", email })).toBe(email);
  });
});

describe("isTaskOwnerRole", () => {
  test("accepts internal sales roles and admins", () => {
    expect(isTaskOwnerRole("sales_agent")).toBe(true);
    expect(isTaskOwnerRole("sales_manager")).toBe(true);
    expect(isTaskOwnerRole("builder_admin")).toBe(true);
  });

  test("rejects external roles that never own an internal follow-up", () => {
    expect(isTaskOwnerRole("dealer")).toBe(false);
    expect(isTaskOwnerRole("customer")).toBe(false);
  });

  test("keeps rows whose role is unknown", () => {
    expect(isTaskOwnerRole(undefined)).toBe(true);
    expect(isTaskOwnerRole(null)).toBe(true);
  });
});

describe("ownerMatches", () => {
  const asha = { id: "u1", email: "asha.rao@demo.com", role: "sales_agent" };

  test("matches on the derived name, not just the email", () => {
    expect(ownerMatches(asha, "asha")).toBe(true);
    expect(ownerMatches(asha, "Rao")).toBe(true);
    expect(ownerMatches(asha, "asha rao")).toBe(true);
  });

  test("is order-insensitive across tokens", () => {
    expect(ownerMatches(asha, "rao asha")).toBe(true);
  });

  test("still matches the raw address", () => {
    expect(ownerMatches(asha, "demo.com")).toBe(true);
  });

  test("an empty query matches everything", () => {
    expect(ownerMatches(asha, "   ")).toBe(true);
  });

  test("non-matching text is rejected", () => {
    expect(ownerMatches(asha, "kunal")).toBe(false);
  });
});

describe("taskOwnerOptions", () => {
  const users = [
    { id: "d1", email: "dealer.test.1782018963825@reos.com", role: "dealer" },
    { id: "a1", email: "zara.khan@reos.com", role: "sales_agent" },
    { id: "m1", email: "amit.manager@reos.com", role: "sales_manager" },
    { id: "c1", email: "buyer@gmail.com", role: "customer" },
  ];

  test("drops dealer and customer rows", () => {
    // Name-sorted: "Amit Manager" (m1) precedes "Zara Khan" (a1).
    expect(taskOwnerOptions(users).map((u) => u.id)).toEqual(["m1", "a1"]);
  });

  test("sorts by display name, not by email", () => {
    // "Amit Manager" < "Zara Khan" by name; the reverse by raw email.
    expect(taskOwnerOptions(users).map((u) => ownerLabel(u))).toEqual([
      "Amit Manager",
      "Zara Khan",
    ]);
  });

  test("retains an already-selected owner that fails the role filter", () => {
    const ids = taskOwnerOptions(users, "d1").map((u) => u.id);
    expect(ids).toContain("d1");
    expect(ids).toHaveLength(3);
  });

  test("an unknown selected id adds nothing", () => {
    expect(taskOwnerOptions(users, "nope")).toHaveLength(2);
  });

  test("does not mutate the input array", () => {
    const input = [...users];
    taskOwnerOptions(input, "d1");
    expect(input.map((u) => u.id)).toEqual(["d1", "a1", "m1", "c1"]);
  });
});

describe("filterOwners", () => {
  const users = [
    { id: "a1", email: "asha.rao@reos.com", role: "sales_agent" },
    { id: "a2", email: "rbac.test.1782019795008@reos.com", role: "sales_agent" },
    { id: "m1", email: "amit.manager@reos.com", role: "sales_manager" },
  ];

  test("narrows a flooded list to the typed name", () => {
    expect(filterOwners(users, "amit").map((u) => u.id)).toEqual(["m1"]);
  });

  test("returns everything for an empty query", () => {
    expect(filterOwners(users, "")).toHaveLength(3);
  });
});
