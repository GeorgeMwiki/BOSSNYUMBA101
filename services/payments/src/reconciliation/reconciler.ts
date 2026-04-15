/**
 * Payment-invoice reconciliation
 * Matches payments with invoices within a date range
 */
import { logger } from '../common/logger';
import type {
  PaymentRecord,
  InvoiceRecord,
  ReconciliationMatch,
  ReconciliationException,
} from './types';

export interface ReconciliationInput {
  payments: PaymentRecord[];
  invoices: InvoiceRecord[];
}

export interface ReconciliationResult {
  matches: ReconciliationMatch[];
  exceptions: ReconciliationException[];
  unmatchedPayments: PaymentRecord[];
  unmatchedInvoices: InvoiceRecord[];
}

const AMOUNT_TOLERANCE = 1; // 1 minor unit

function amountMatchesExact(
  paymentAmount: number,
  invoiceAmount: number,
  tolerance: number = AMOUNT_TOLERANCE
): boolean {
  return Math.abs(paymentAmount - invoiceAmount) <= tolerance;
}

export function reconcile(
  input: ReconciliationInput
): ReconciliationResult {
  const { payments, invoices } = input;
  const completedPayments = payments.filter(
    (p) => p.status === 'SUCCEEDED' || p.status === 'completed'
  );
  const openInvoices = invoices.filter(
    (i) => i.status !== 'paid' && i.status !== 'cancelled' && i.amountDue > 0
  );

  const matches: ReconciliationMatch[] = [];
  const exceptions: ReconciliationException[] = [];
  const usedPayments = new Set<string>();
  const usedInvoices = new Set<string>();

  // Strategy: match by reference first, then by exact amount, then partial/over.
  // Reference match has priority because explicit mapping is authoritative.
  for (const payment of completedPayments) {
    // 1. Prefer reference-based match
    let matchingInvoice: InvoiceRecord | undefined;
    let matchType: ReconciliationMatch['matchType'] | null = null;

    if (payment.reference) {
      matchingInvoice = openInvoices.find(
        (inv) =>
          !usedInvoices.has(inv.id) &&
          inv.currency === payment.currency &&
          inv.id === payment.reference
      );
      if (matchingInvoice) {
        matchType = amountMatchesExact(payment.amount, matchingInvoice.amountDue)
          ? 'EXACT'
          : payment.amount > matchingInvoice.amountDue
            ? 'OVERPAYMENT'
            : 'PARTIAL';
      }
    }

    // 2. Fall back to exact amount match
    if (!matchingInvoice) {
      matchingInvoice = openInvoices.find(
        (inv) =>
          !usedInvoices.has(inv.id) &&
          inv.currency === payment.currency &&
          amountMatchesExact(payment.amount, inv.amountDue)
      );
      if (matchingInvoice) matchType = 'EXACT';
    }

    if (matchingInvoice && matchType) {
      usedPayments.add(payment.id);
      usedInvoices.add(matchingInvoice.id);
      matches.push({
        paymentId: payment.id,
        invoiceId: matchingInvoice.id,
        amount: Math.min(payment.amount, matchingInvoice.amountDue),
        matchType,
      });
    }
  }

  const unmatchedPayments = completedPayments.filter((p) => !usedPayments.has(p.id));
  const unmatchedInvoices = openInvoices.filter((i) => !usedInvoices.has(i.id));

  for (const p of unmatchedPayments) {
    exceptions.push({
      type: 'UNMATCHED_PAYMENT',
      paymentId: p.id,
      amount: p.amount,
      description: `Payment ${p.id} (${p.amount} ${p.currency}) has no matching invoice`,
    });
  }

  for (const inv of unmatchedInvoices) {
    if (inv.amountDue > 0) {
      exceptions.push({
        type: 'UNMATCHED_INVOICE',
        invoiceId: inv.id,
        amount: inv.amountDue,
        description: `Invoice ${inv.id} (${inv.amountDue} ${inv.currency}) has no matching payment`,
      });
    }
  }

  logger.info(
    {
      matches: matches.length,
      exceptions: exceptions.length,
      unmatchedPayments: unmatchedPayments.length,
      unmatchedInvoices: unmatchedInvoices.length,
    },
    'Reconciliation completed'
  );

  return {
    matches,
    exceptions,
    unmatchedPayments,
    unmatchedInvoices,
  };
}
