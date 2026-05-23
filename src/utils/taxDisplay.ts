export function formatTaxAmount(amount: number): string {
  if (!isFinite(amount) || amount < 0) return '₹0';
  if (amount >= 10_000_000) return `₹${(amount / 10_000_000).toFixed(2)}Cr`;
  if (amount >= 100_000) return `₹${(amount / 100_000).toFixed(2)}L`;
  return `₹${amount.toLocaleString('en-IN')}`;
}

export function taxRateLabel(rate: number): string {
  return `${rate}% GST`;
}

export function totalCostLabel(salePrice: number, totalTax: number): string {
  const total = salePrice + totalTax;
  return `${formatTaxAmount(total)} all-in`;
}

const STATE_LABELS: Record<string, string> = {
  maharashtra: 'Maharashtra',
  karnataka: 'Karnataka',
  delhi: 'Delhi',
  gujarat: 'Gujarat',
  telangana: 'Telangana',
  tamil_nadu: 'Tamil Nadu',
  haryana: 'Haryana',
  rajasthan: 'Rajasthan',
};

export function stampDutyStateLabel(state: string): string {
  return STATE_LABELS[state.toLowerCase()] ?? state;
}

const AFFORDABLE_THRESHOLD = 4_500_000;

export function gstCategoryLabel(
  propertyType: string,
  price: number,
): 'Affordable' | 'Standard' | 'Luxury' {
  if (propertyType === 'affordable' || price <= AFFORDABLE_THRESHOLD) return 'Affordable';
  if (price <= 10_000_000) return 'Standard';
  return 'Luxury';
}
