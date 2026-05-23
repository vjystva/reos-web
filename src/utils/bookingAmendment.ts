export type AmendmentType =
  | 'unit_change'
  | 'amount_adjustment'
  | 'buyer_details'
  | 'payment_plan';

export interface AmendmentFormData {
  type: string;
  reason: string;
  notes?: string;
}

export interface AmendmentValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

const AMENDMENT_TYPE_LABELS: Record<string, string> = {
  unit_change: 'Unit Change',
  amount_adjustment: 'Amount Adjustment',
  buyer_details: 'Buyer Details Update',
  payment_plan: 'Payment Plan Change',
};

const AMENDABLE_STATUSES = new Set([
  'application_received',
  'under_review',
  'approved',
  'payment_received',
  'agreement_signed',
]);

const DOC_UPLOAD_TYPES: AmendmentType[] = ['unit_change', 'buyer_details'];

export function amendmentTypeLabel(type: string): string {
  return AMENDMENT_TYPE_LABELS[type] ?? type;
}

export function isAmendableStatus(status: string): boolean {
  return AMENDABLE_STATUSES.has(status);
}

export function amendmentRequiresDocUpload(type: string): boolean {
  return DOC_UPLOAD_TYPES.includes(type as AmendmentType);
}

export function validateAmendmentForm(
  form: AmendmentFormData,
): AmendmentValidationResult {
  const errors: Record<string, string> = {};
  if (!form.type) {
    errors.type = 'Amendment type is required';
  }
  if (!form.reason || form.reason.trim().length === 0) {
    errors.reason = 'Reason is required';
  } else if (form.reason.trim().length < 10) {
    errors.reason = 'Reason must be at least 10 characters';
  }
  if (form.notes && form.notes.length > 1000) {
    errors.notes = 'Notes must not exceed 1000 characters';
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

export function formatAmendmentSummary(
  type: string,
  oldValue: string,
  newValue: string,
): string {
  return `${amendmentTypeLabel(type)}: "${oldValue}" → "${newValue}"`;
}
