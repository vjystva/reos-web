/**
 * Format a numeric INR amount using crore/lakh abbreviations for inventory
 * display.
 *
 * Rules:
 *   >= 10,000,000 (1 Cr)  → "₹X.XX Cr"
 *   >= 100,000   (1 L)    → "₹X.XX L"
 *   else                  → "₹X,XXX" (plain with Indian grouping)
 */
export function formatPriceINR(amount: number): string {
  if (!Number.isFinite(amount)) return "—";

  if (amount >= 10_000_000) {
    const cr = amount / 10_000_000;
    return `₹${cr.toFixed(2)} Cr`;
  }

  if (amount >= 100_000) {
    const lakh = amount / 100_000;
    return `₹${lakh.toFixed(2)} L`;
  }

  // Plain Indian-grouping format for smaller amounts
  return (
    "₹" +
    amount.toLocaleString("en-IN", {
      maximumFractionDigits: 0,
    })
  );
}
