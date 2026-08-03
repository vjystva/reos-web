import {
  bucketTasks,
  dateInputToIso,
  dueLabel,
  ownerLabel,
  snoozedDueDate,
  taskBucket,
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
  test("prefers name, falls back to email", () => {
    expect(ownerLabel({ id: "u1", email: "a@b.com", name: "Asha" })).toBe("Asha");
    expect(ownerLabel({ id: "u1", email: "a@b.com", name: "  " })).toBe("a@b.com");
    expect(ownerLabel({ id: "u1", email: "a@b.com" })).toBe("a@b.com");
  });
});
