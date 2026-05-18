/**
 * Deterministic mock adapter for `@bossnyumba/mcp-server-opay`.
 * Production adapter (OPay Merchant API — OAuth2 + HMAC-signed)
 * ships in Phase F.
 *
 * Mock policy:
 *   - initiate_payment: returns transactionId `opay-mock-<ref>` with
 *     status=pending unless reference contains "FAIL".
 *   - verify_payment: txn id starting with `opay-mock-` returns
 *     succeeded (1:1 of the embedded amount); other ids return failed.
 *   - cashflow_lookup: synthesises 3 daily samples deterministically
 *     from the phone hash.
 */

import type {
  CashflowLookupArgs,
  CashflowLookupResult,
  CashflowSample,
  InitiatePaymentArgs,
  InitiatePaymentResult,
  OpayAdapter,
  VerifyPaymentArgs,
  VerifyPaymentResult,
} from './types.js';

const NG_PHONE = /^(?:\+234|0)[789][01]\d{8}$/;

function hashTo(seed: string, modulus: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h * 31 + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % modulus;
}

export class MockOpayAdapter implements OpayAdapter {
  async initiatePayment(
    args: InitiatePaymentArgs,
  ): Promise<InitiatePaymentResult> {
    if (!NG_PHONE.test(args.payerPhone)) {
      return Object.freeze({
        transactionId: `opay-mock-INVALID-${args.reference}`,
        status: 'failed' as const,
        reason: 'invalid_payer_phone',
      });
    }
    if (args.reference.toUpperCase().includes('FAIL')) {
      return Object.freeze({
        transactionId: `opay-mock-FAIL-${args.reference}`,
        status: 'failed' as const,
        reason: 'rejected_by_payer',
      });
    }
    return Object.freeze({
      transactionId: `opay-mock-${args.reference}-${args.amountKobo}`,
      status: 'pending' as const,
    });
  }

  async verifyPayment(args: VerifyPaymentArgs): Promise<VerifyPaymentResult> {
    if (!args.transactionId.startsWith('opay-mock-')) {
      return Object.freeze({
        status: 'failed' as const,
        amountKobo: 0,
      });
    }
    if (args.transactionId.includes('FAIL') || args.transactionId.includes('INVALID')) {
      return Object.freeze({
        status: 'failed' as const,
        amountKobo: 0,
      });
    }
    const parts = args.transactionId.split('-');
    const amount = Number.parseInt(parts[parts.length - 1] ?? '0', 10) || 0;
    return Object.freeze({
      status: 'succeeded' as const,
      amountKobo: amount,
      settledAt: '2026-05-18T00:00:00Z',
    });
  }

  async cashflowLookup(
    args: CashflowLookupArgs,
  ): Promise<CashflowLookupResult> {
    const seed = `${args.payerPhone}-${args.fromDate}-${args.toDate}`;
    const samples: CashflowSample[] = [];
    let totalIn = 0;
    let totalOut = 0;
    for (let i = 0; i < 3; i += 1) {
      const inflow = hashTo(`${seed}-in-${i}`, 1_000_000_00);
      const outflow = hashTo(`${seed}-out-${i}`, 1_000_000_00);
      samples.push(
        Object.freeze({
          date: `2026-05-${String(15 + i).padStart(2, '0')}`,
          inflowsKobo: inflow,
          outflowsKobo: outflow,
        }),
      );
      totalIn += inflow;
      totalOut += outflow;
    }
    return Object.freeze({
      samples: Object.freeze(samples),
      totalInflowsKobo: totalIn,
      totalOutflowsKobo: totalOut,
    });
  }
}

/** Production adapter stub — Phase F wires OPay Merchant API. */
export class OpayMerchantAdapter implements OpayAdapter {
  async initiatePayment(
    _args: InitiatePaymentArgs,
  ): Promise<InitiatePaymentResult> {
    throw new Error(
      'OpayMerchantAdapter.initiatePayment not yet wired — Phase F.',
    );
  }
  async verifyPayment(_args: VerifyPaymentArgs): Promise<VerifyPaymentResult> {
    throw new Error(
      'OpayMerchantAdapter.verifyPayment not yet wired — Phase F.',
    );
  }
  async cashflowLookup(
    _args: CashflowLookupArgs,
  ): Promise<CashflowLookupResult> {
    throw new Error(
      'OpayMerchantAdapter.cashflowLookup not yet wired — Phase F.',
    );
  }
}
