/** @jest-environment jsdom */

import {
  approvalStatusLabel,
  approvalStatusTone,
  approvalSummary,
  approvalTypeLabel,
  canResolveApprovals,
  minutesLabel,
} from "../useApprovals";
import {
  CreateApprovalRequestSchema,
  DISCOUNT_APPROVAL_THRESHOLD_PERCENT,
  ResolveApprovalRequestSchema,
  type Approval,
} from "@/types/api";

const BOOKING = "1bce5daa-5853-47d8-8570-11847704e8c3";
// Seeded vanity uuid — valid for Postgres, rejected by strict uuid checks.
const HOLD = "d1000000-0000-0000-0000-000000000001";

function discountApproval(overrides: Partial<Approval> = {}): Approval {
  return {
    id: "apv-1",
    type: "discount_request",
    status: "pending",
    requestedBy: "c2000000-0000-0000-0000-000000000001",
    payload: {
      bookingId: BOOKING,
      requestedDiscountPercent: 7.5,
      reason: "Competitor matched price",
    },
    ...overrides,
  } as Approval;
}

function holdApproval(overrides: Partial<Approval> = {}): Approval {
  return {
    id: "apv-2",
    type: "hold_extension",
    status: "pending",
    requestedBy: "c2000000-0000-0000-0000-000000000001",
    payload: { holdId: HOLD, additionalMinutes: 135, reason: null },
    ...overrides,
  } as Approval;
}

describe("approvalTypeLabel / approvalStatusLabel", () => {
  it("labels both approval types", () => {
    expect(approvalTypeLabel("discount_request")).toBe("Discount");
    expect(approvalTypeLabel("hold_extension")).toBe("Hold extension");
  });
  it("passes an unknown type through readably", () => {
    expect(approvalTypeLabel("refund_request")).toBe("refund request");
  });
  it("labels every status", () => {
    expect(approvalStatusLabel("pending")).toBe("Pending");
    expect(approvalStatusLabel("approved")).toBe("Approved");
    expect(approvalStatusLabel("rejected")).toBe("Rejected");
  });
});

describe("approvalStatusTone", () => {
  it("maps statuses onto StatusPill tones", () => {
    expect(approvalStatusTone("approved")).toBe("good");
    expect(approvalStatusTone("pending")).toBe("warn");
    expect(approvalStatusTone("rejected")).toBe("bad");
    expect(approvalStatusTone("something_else")).toBe("neutral");
  });
});

describe("minutesLabel", () => {
  it("formats sub-hour, whole-hour and mixed durations", () => {
    expect(minutesLabel(45)).toBe("45m");
    expect(minutesLabel(60)).toBe("1h");
    expect(minutesLabel(135)).toBe("2h 15m");
    expect(minutesLabel(1440)).toBe("24h");
  });
});

describe("approvalSummary", () => {
  it("summarises a discount request from its payload", () => {
    const summary = approvalSummary(discountApproval());
    expect(summary.subject).toBe(`Booking ${BOOKING.slice(0, 8)}`);
    expect(summary.detail).toBe("7.5% requested");
    expect(summary.reason).toBe("Competitor matched price");
  });

  it("summarises a hold extension from its payload", () => {
    const summary = approvalSummary(holdApproval());
    expect(summary.subject).toBe(`Hold ${HOLD.slice(0, 8)}`);
    expect(summary.detail).toBe("+2h 15m requested");
    expect(summary.reason).toBeNull();
  });

  it("degrades to dashes when the payload does not match its type", () => {
    const mismatched = discountApproval({ payload: { holdId: HOLD } });
    expect(approvalSummary(mismatched)).toEqual({
      subject: "—",
      detail: "—",
      reason: null,
    });
  });
});

describe("canResolveApprovals", () => {
  it.each(["sales_manager", "builder_admin", "admin", "super_admin"])(
    "%s may action the queue",
    (role) => expect(canResolveApprovals(role)).toBe(true),
  );
  it.each(["sales_agent", "dealer", "customer", null, undefined, ""])(
    "%s may not",
    (role) => expect(canResolveApprovals(role)).toBe(false),
  );
});

describe("CreateApprovalRequestSchema", () => {
  it("accepts a discount above the threshold", () => {
    const parsed = CreateApprovalRequestSchema.safeParse({
      type: "discount_request",
      payload: { bookingId: BOOKING, requestedDiscountPercent: 5 },
    });
    expect(parsed.success).toBe(true);
  });

  it.each([DISCOUNT_APPROVAL_THRESHOLD_PERCENT, 1.5, 0])(
    "rejects %s%% as not needing approval",
    (percent) => {
      const parsed = CreateApprovalRequestSchema.safeParse({
        type: "discount_request",
        payload: { bookingId: BOOKING, requestedDiscountPercent: percent },
      });
      expect(parsed.success).toBe(false);
    },
  );

  it("accepts a seeded vanity uuid as holdId", () => {
    const parsed = CreateApprovalRequestSchema.safeParse({
      type: "hold_extension",
      payload: { holdId: HOLD, additionalMinutes: 60 },
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a malformed id and an out-of-range extension", () => {
    expect(
      CreateApprovalRequestSchema.safeParse({
        type: "hold_extension",
        payload: { holdId: "nope", additionalMinutes: 60 },
      }).success,
    ).toBe(false);
    expect(
      CreateApprovalRequestSchema.safeParse({
        type: "hold_extension",
        payload: { holdId: HOLD, additionalMinutes: 999999 },
      }).success,
    ).toBe(false);
    expect(
      CreateApprovalRequestSchema.safeParse({
        type: "hold_extension",
        payload: { holdId: HOLD, additionalMinutes: 0 },
      }).success,
    ).toBe(false);
  });

  it("rejects an unknown approval type", () => {
    expect(
      CreateApprovalRequestSchema.safeParse({
        type: "refund_request",
        payload: {},
      }).success,
    ).toBe(false);
  });
});

describe("ResolveApprovalRequestSchema", () => {
  it("allows an empty body (no note)", () => {
    expect(ResolveApprovalRequestSchema.safeParse({}).success).toBe(true);
  });
  it("allows a note and rejects an over-long one", () => {
    expect(
      ResolveApprovalRequestSchema.safeParse({ resolutionNote: "ok" }).success,
    ).toBe(true);
    expect(
      ResolveApprovalRequestSchema.safeParse({
        resolutionNote: "x".repeat(2001),
      }).success,
    ).toBe(false);
  });
});
