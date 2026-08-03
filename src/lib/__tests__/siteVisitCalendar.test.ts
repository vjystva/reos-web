import {
  GRID_CELLS,
  addDays,
  addMonths,
  buildMonthGrid,
  dayKey,
  gridRange,
  groupByDay,
  isSameDay,
  mondayFirstIndex,
  startOfMonth,
  timeLabel,
} from "@/lib/siteVisitCalendar";

describe("siteVisitCalendar", () => {
  describe("mondayFirstIndex", () => {
    test("Monday is 0 and Sunday is 6", () => {
      // 2026-03-02 is a Monday, 2026-03-08 the following Sunday.
      expect(mondayFirstIndex(new Date(2026, 2, 2))).toBe(0);
      expect(mondayFirstIndex(new Date(2026, 2, 8))).toBe(6);
    });
  });

  describe("buildMonthGrid", () => {
    test("always returns 42 cells", () => {
      for (let m = 0; m < 12; m++) {
        expect(buildMonthGrid(new Date(2026, m, 1))).toHaveLength(GRID_CELLS);
      }
    });

    test("starts on the Monday on or before the 1st", () => {
      // 1 March 2026 is a Sunday → grid starts Monday 23 Feb 2026.
      const cells = buildMonthGrid(new Date(2026, 2, 1));
      expect(mondayFirstIndex(cells[0])).toBe(0);
      expect(dayKey(cells[0])).toBe("2026-02-23");
      expect(dayKey(cells[GRID_CELLS - 1])).toBe("2026-04-05");
    });

    test("starts on the 1st when the month begins on a Monday", () => {
      // 1 June 2026 is a Monday.
      const cells = buildMonthGrid(new Date(2026, 5, 15));
      expect(dayKey(cells[0])).toBe("2026-06-01");
    });

    test("cells are consecutive days", () => {
      const cells = buildMonthGrid(new Date(2026, 1, 1));
      for (let i = 1; i < cells.length; i++) {
        expect(dayKey(cells[i])).toBe(dayKey(addDays(cells[i - 1], 1)));
      }
    });

    test("contains every day of the anchor month", () => {
      const keys = new Set(buildMonthGrid(new Date(2026, 3, 10)).map(dayKey));
      for (let d = 1; d <= 30; d++) {
        expect(keys.has(dayKey(new Date(2026, 3, d)))).toBe(true);
      }
    });
  });

  describe("startOfMonth / addMonths", () => {
    test("startOfMonth zeroes the day", () => {
      expect(dayKey(startOfMonth(new Date(2026, 6, 23)))).toBe("2026-07-01");
    });

    test("addMonths wraps the year in both directions", () => {
      expect(dayKey(addMonths(new Date(2026, 11, 1), 1))).toBe("2027-01-01");
      expect(dayKey(addMonths(new Date(2026, 0, 1), -1))).toBe("2025-12-01");
    });
  });

  describe("gridRange", () => {
    test("spans the first to the last visible cell", () => {
      const { from, to } = gridRange(new Date(2026, 2, 1));
      expect(dayKey(new Date(from))).toBe("2026-02-23");
      expect(dayKey(new Date(to))).toBe("2026-04-05");
      expect(new Date(to).getTime()).toBeGreaterThan(new Date(from).getTime());
    });
  });

  describe("dayKey / isSameDay", () => {
    test("dayKey zero-pads month and day", () => {
      expect(dayKey(new Date(2026, 0, 5))).toBe("2026-01-05");
    });

    test("isSameDay ignores the time component", () => {
      expect(
        isSameDay(new Date(2026, 2, 12, 1, 0), new Date(2026, 2, 12, 23, 59)),
      ).toBe(true);
      expect(isSameDay(new Date(2026, 2, 12), new Date(2026, 2, 13))).toBe(
        false,
      );
    });
  });

  describe("groupByDay", () => {
    const items = [
      { id: "a", at: new Date(2026, 2, 12, 9, 0).toISOString() },
      { id: "b", at: new Date(2026, 2, 12, 17, 30).toISOString() },
      { id: "c", at: new Date(2026, 2, 13, 11, 0).toISOString() },
      { id: "d", at: null },
      { id: "e", at: "not-a-date" },
    ];

    test("buckets by local day and skips unparseable dates", () => {
      const grouped = groupByDay(items, (i) => i.at);
      expect(grouped.get("2026-03-12")?.map((i) => i.id)).toEqual(["a", "b"]);
      expect(grouped.get("2026-03-13")?.map((i) => i.id)).toEqual(["c"]);
      expect(grouped.size).toBe(2);
    });

    test("returns an empty map for an empty list", () => {
      expect(groupByDay([], () => null).size).toBe(0);
    });
  });

  describe("timeLabel", () => {
    test("returns an em dash for missing or invalid input", () => {
      expect(timeLabel(null)).toBe("—");
      expect(timeLabel(undefined)).toBe("—");
      expect(timeLabel("nope")).toBe("—");
    });

    test("renders a time for a valid date", () => {
      expect(timeLabel(new Date(2026, 2, 12, 9, 5))).toMatch(/9[:.]05/);
    });
  });
});
