/**
 * Format a numeric amount as INR (Indian Rupee) using the Indian numbering
 * system — lakh/crore grouping (e.g. ₹10,00,000 for one million).
 *
 * Returns "₹0.00" for zero, and a leading-minus form ("-₹50,000.00") for
 * negative values so that discount rows in the pricing breakdown read
 * naturally.
 */
export function formatCurrency(amount: number): string {
  if (!Number.isFinite(amount)) return "—";
  const formatter = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (amount < 0) {
    return `-${formatter.format(Math.abs(amount))}`;
  }
  return formatter.format(amount);
}
