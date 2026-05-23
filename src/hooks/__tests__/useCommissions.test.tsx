/** @jest-environment jsdom */

import { formatCommissionStatus, commissionStatusClass, totalByStatus } from "../useCommissions";
import type { Commission } from "@/types/api";

function makeCommission(overrides: Partial<Commission> = {}): Commission {
  return {
    id: "c-1",
    dealerId: "d-1",
    bookingId: "b-1",
    rate: "3.00",
    amount: "100000",
    status: "pending",
    ...overrides,
  } as Commission;
}

describe("formatCommissionStatus", () => {
  it("pending", () => expect(formatCommissionStatus("pending")).toBe("Pending"));
  it("approved", () => expect(formatCommissionStatus("approved")).toBe("Approved"));
  it("paid", () => expect(formatCommissionStatus("paid")).toBe("Paid"));
  it("cancelled", () => expect(formatCommissionStatus("cancelled")).toBe("Cancelled"));
  it("unknown passthrough", () => expect(formatCommissionStatus("other")).toBe("other"));
});

describe("commissionStatusClass", () => {
  it("paid → green", () => expect(commissionStatusClass("paid")).toContain("green"));
  it("approved → yellow", () => expect(commissionStatusClass("approved")).toContain("yellow"));
  it("cancelled → red", () => expect(commissionStatusClass("cancelled")).toContain("red"));
  it("pending → gray", () => expect(commissionStatusClass("pending")).toContain("gray"));
});

describe("totalByStatus", () => {
  const commissions = [
    makeCommission({ amount: "100000", status: "paid" }),
    makeCommission({ id: "c-2", amount: "50000", status: "paid" }),
    makeCommission({ id: "c-3", amount: "75000", status: "pending" }),
  ];

  it("sums paid correctly", () => expect(totalByStatus(commissions, "paid")).toBe(150000));
  it("sums pending correctly", () => expect(totalByStatus(commissions, "pending")).toBe(75000));
  it("unknown status returns 0", () => expect(totalByStatus(commissions, "approved")).toBe(0));
  it("empty array returns 0", () => expect(totalByStatus([], "paid")).toBe(0));
});
