/** @jest-environment jsdom */
import {
  amendmentTypeLabel,
  isAmendableStatus,
  amendmentRequiresDocUpload,
  validateAmendmentForm,
  formatAmendmentSummary,
} from '../../utils/bookingAmendment';

describe('amendmentTypeLabel', () => {
  it('returns human-readable labels', () => {
    expect(amendmentTypeLabel('unit_change')).toBe('Unit Change');
    expect(amendmentTypeLabel('amount_adjustment')).toBe('Amount Adjustment');
    expect(amendmentTypeLabel('buyer_details')).toBe('Buyer Details Update');
    expect(amendmentTypeLabel('payment_plan')).toBe('Payment Plan Change');
  });

  it('returns raw string for unknown type', () => {
    expect(amendmentTypeLabel('other')).toBe('other');
    expect(amendmentTypeLabel('')).toBe('');
  });
});

describe('isAmendableStatus', () => {
  it('returns true for amendable statuses', () => {
    expect(isAmendableStatus('application_received')).toBe(true);
    expect(isAmendableStatus('under_review')).toBe(true);
    expect(isAmendableStatus('approved')).toBe(true);
    expect(isAmendableStatus('payment_received')).toBe(true);
    expect(isAmendableStatus('agreement_signed')).toBe(true);
  });

  it('returns false for registered and unknown statuses', () => {
    expect(isAmendableStatus('registered')).toBe(false);
    expect(isAmendableStatus('unknown')).toBe(false);
    expect(isAmendableStatus('')).toBe(false);
  });
});

describe('amendmentRequiresDocUpload', () => {
  it('returns true for unit_change and buyer_details', () => {
    expect(amendmentRequiresDocUpload('unit_change')).toBe(true);
    expect(amendmentRequiresDocUpload('buyer_details')).toBe(true);
  });

  it('returns false for other types', () => {
    expect(amendmentRequiresDocUpload('amount_adjustment')).toBe(false);
    expect(amendmentRequiresDocUpload('payment_plan')).toBe(false);
    expect(amendmentRequiresDocUpload('unknown')).toBe(false);
  });
});

describe('validateAmendmentForm', () => {
  const validForm = {
    type: 'unit_change',
    reason: 'Customer requested larger unit after site visit',
    notes: '',
  };

  it('passes a valid form', () => {
    const result = validateAmendmentForm(validForm);
    expect(result.valid).toBe(true);
    expect(Object.keys(result.errors)).toHaveLength(0);
  });

  it('fails when type is missing', () => {
    const result = validateAmendmentForm({ ...validForm, type: '' });
    expect(result.valid).toBe(false);
    expect(result.errors.type).toBeDefined();
  });

  it('fails when reason is missing', () => {
    const result = validateAmendmentForm({ ...validForm, reason: '' });
    expect(result.valid).toBe(false);
    expect(result.errors.reason).toBeDefined();
  });

  it('fails when reason is too short', () => {
    const result = validateAmendmentForm({ ...validForm, reason: 'short' });
    expect(result.valid).toBe(false);
    expect(result.errors.reason).toMatch(/10/);
  });

  it('fails when notes exceed 1000 chars', () => {
    const result = validateAmendmentForm({ ...validForm, notes: 'x'.repeat(1001) });
    expect(result.valid).toBe(false);
    expect(result.errors.notes).toBeDefined();
  });

  it('passes when notes are exactly 1000 chars', () => {
    const result = validateAmendmentForm({ ...validForm, notes: 'x'.repeat(1000) });
    expect(result.valid).toBe(true);
  });

  it('passes when notes are undefined', () => {
    const result = validateAmendmentForm({ type: 'amount_adjustment', reason: 'Price correction needed' });
    expect(result.valid).toBe(true);
  });
});

describe('formatAmendmentSummary', () => {
  it('formats with type label and values', () => {
    const result = formatAmendmentSummary('unit_change', 'A-101', 'B-201');
    expect(result).toContain('Unit Change');
    expect(result).toContain('A-101');
    expect(result).toContain('B-201');
    expect(result).toContain('→');
  });

  it('uses raw type for unknown', () => {
    const result = formatAmendmentSummary('custom_type', 'old', 'new');
    expect(result).toContain('custom_type');
  });
});
