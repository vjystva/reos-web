/** @jest-environment jsdom */

import {
  frequencyLabel,
  reportTypeLabel,
  nextRunLabel,
  validateScheduleForm,
} from "../useReportSchedule";

describe("frequencyLabel", () => {
  it("daily", () => expect(frequencyLabel("daily")).toBe("Daily"));
  it("weekly", () => expect(frequencyLabel("weekly")).toBe("Weekly"));
  it("monthly", () => expect(frequencyLabel("monthly")).toBe("Monthly"));
  it("unknown passthrough", () => expect(frequencyLabel("hourly")).toBe("hourly"));
});

describe("reportTypeLabel", () => {
  it("bookings", () => expect(reportTypeLabel("bookings")).toBe("Bookings Report"));
  it("payments", () => expect(reportTypeLabel("payments")).toBe("Payments Report"));
  it("leads", () => expect(reportTypeLabel("leads")).toBe("Leads Report"));
  it("analytics", () => expect(reportTypeLabel("analytics")).toBe("Analytics Report"));
  it("unknown passthrough", () => expect(reportTypeLabel("custom")).toBe("custom"));
});

describe("nextRunLabel", () => {
  it("daily contains 'Tomorrow'", () => expect(nextRunLabel("daily")).toContain("Tomorrow"));
  it("weekly contains 'Monday'", () => expect(nextRunLabel("weekly")).toContain("Monday"));
  it("monthly contains '1st'", () => expect(nextRunLabel("monthly")).toContain("1st"));
  it("unknown returns 'Unknown'", () => expect(nextRunLabel("yearly")).toBe("Unknown"));
});

describe("validateScheduleForm", () => {
  const valid = {
    reportType: "bookings",
    frequency: "weekly",
    email: "user@example.com",
    label: "Weekly Sales",
  };

  it("accepts valid form", () => {
    const result = validateScheduleForm(valid);
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = validateScheduleForm({ ...valid, email: "not-an-email" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("Invalid email");
  });

  it("rejects empty label", () => {
    const result = validateScheduleForm({ ...valid, label: "" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid report type", () => {
    const result = validateScheduleForm({ ...valid, reportType: "not_a_type" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid frequency", () => {
    const result = validateScheduleForm({ ...valid, frequency: "hourly" });
    expect(result.success).toBe(false);
  });

  it("rejects missing email field", () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { email: _, ...rest } = valid;
    const result = validateScheduleForm(rest);
    expect(result.success).toBe(false);
  });
});
