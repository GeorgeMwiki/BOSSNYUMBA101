import { describe, it, expect } from 'vitest';
import { reconcile } from '../reconciliation/reconciler';
import { generateReconciliationReport } from '../reconciliation/report';

describe('reconcile (statement-style ledger reconciliation)', () => {
  const base = {
    paid: (overrides: Partial<any> = {}) => ({
      id: 'p1',
      externalId: 'ext-1',
      provider: 'mpesa',
      amount: 10000,
      currency: 'KES',
      status: 'SUCCEEDED',
      createdAt: new Date('2024-03-01'),
      paidAt: new Date('2024-03-01'),
      reference: 'INV-1',
      ...overrides,
    }),
    invoice: (overrides: Partial<any> = {}) => ({
      id: 'INV-1',
      amountDue: 10000,
      amountPaid: 0,
      currency: 'KES',
      status: 'pending',
      dueDate: new Date('2024-03-01'),
      ...overrides,
    }),
  };

  it('matches exact pairs', () => {
    const result = reconcile({
      payments: [base.paid()],
      invoices: [base.invoice()],
    });
    expect(result.matches.length).toBe(1);
    expect(result.matches[0]!.matchType).toBe('EXACT');
    expect(result.exceptions.length).toBe(0);
  });

  it('flags overpayments and partial payments', () => {
    const over = reconcile({
      payments: [base.paid({ amount: 12000 })],
      invoices: [base.invoice()],
    });
    expect(over.matches[0]!.matchType).toBe('OVERPAYMENT');

    const partial = reconcile({
      payments: [base.paid({ amount: 5000 })],
      invoices: [base.invoice()],
    });
    expect(partial.matches[0]!.matchType).toBe('PARTIAL');
  });

  it('reports exceptions for unmatched items', () => {
    const result = reconcile({
      payments: [base.paid({ id: 'p-orphan', amount: 9999 })],
      invoices: [base.invoice({ id: 'INV-X', amountDue: 8888 })],
    });
    expect(result.matches.length).toBe(0);
    expect(result.exceptions.length).toBe(2);
    expect(result.exceptions.some((e) => e.type === 'UNMATCHED_PAYMENT')).toBe(true);
    expect(result.exceptions.some((e) => e.type === 'UNMATCHED_INVOICE')).toBe(true);
  });

  it('requires matching currencies', () => {
    const result = reconcile({
      payments: [base.paid({ currency: 'KES' })],
      invoices: [base.invoice({ currency: 'TZS' })],
    });
    expect(result.matches.length).toBe(0);
  });

  it('generates a report with correct totals', () => {
    const result = reconcile({
      payments: [base.paid(), base.paid({ id: 'p2', externalId: 'ext-2', reference: 'INV-2' })],
      invoices: [base.invoice(), base.invoice({ id: 'INV-2' })],
    });
    const report = generateReconciliationReport(result);
    expect(report.summary.totalMatches).toBe(2);
    expect(report.summary.matchedAmount).toBe(20000);
  });
});
