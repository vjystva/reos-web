import { formatCurrency } from "@/lib/formatCurrency";

describe("formatCurrency", () => {
  test("Indian numbering: 1,000,000 -> 10,00,000 (lakh grouping)", () => {
    expect(formatCurrency(1000000)).toMatch(/^₹\s?10,00,000\.00$/);
  });

  test("Zero", () => {
    expect(formatCurrency(0)).toMatch(/^₹\s?0\.00$/);
  });

  test("Negative (discount)", () => {
    expect(formatCurrency(-50000)).toMatch(/^-₹\s?50,000\.00$/);
  });

  test("NaN returns em-dash", () => {
    expect(formatCurrency(NaN)).toBe("—");
  });

  test("Infinity returns em-dash", () => {
    expect(formatCurrency(Infinity)).toBe("—");
  });

  test("Crore-scale number: 12,500,000 -> 1,25,00,000", () => {
    expect(formatCurrency(12500000)).toMatch(/^₹\s?1,25,00,000\.00$/);
  });
});
