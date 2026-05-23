/** @jest-environment jsdom */

import { formatBookingStatus, bookingStatusClass } from "../useBookingDetail";

describe("formatBookingStatus", () => {
  it("formats draft", () => expect(formatBookingStatus("draft")).toBe("Draft"));
  it("formats confirmed", () => expect(formatBookingStatus("confirmed")).toBe("Confirmed"));
  it("formats cancelled", () => expect(formatBookingStatus("cancelled")).toBe("Cancelled"));
  it("formats completed", () => expect(formatBookingStatus("completed")).toBe("Completed"));
  it("passes through unknown status", () =>
    expect(formatBookingStatus("pending_review")).toBe("pending_review"));
});

describe("bookingStatusClass", () => {
  it("confirmed → green classes", () => {
    expect(bookingStatusClass("confirmed")).toContain("green");
  });
  it("cancelled → red classes", () => {
    expect(bookingStatusClass("cancelled")).toContain("red");
  });
  it("completed → blue classes", () => {
    expect(bookingStatusClass("completed")).toContain("blue");
  });
  it("unknown → gray classes", () => {
    expect(bookingStatusClass("draft")).toContain("gray");
  });
  it("unknown string → gray classes", () => {
    expect(bookingStatusClass("anything_else")).toContain("gray");
  });
});
