import { cn, stageLabel, formatDate } from "@/lib/utils";

describe("cn", () => {
  it("merges class strings", () => {
    expect(cn("a", "b")).toBe("a b");
  });
  it("dedupes conflicting tailwind classes", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });
});

describe("stageLabel", () => {
  it("maps known stages to human labels", () => {
    expect(stageLabel("new")).toBe("New");
    expect(stageLabel("site_visit_scheduled")).toBe("Site Visit Scheduled");
  });
  it("falls back to the raw value for unknown stages", () => {
    expect(stageLabel("unknown_stage")).toBe("unknown_stage");
  });
});

describe("formatDate", () => {
  it("returns em-dash for null/undefined/invalid", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate(undefined)).toBe("—");
    expect(formatDate("not a date")).toBe("—");
  });
  it("formats an ISO string", () => {
    expect(formatDate("2026-05-14T00:00:00Z")).toMatch(/2026/);
  });
});
