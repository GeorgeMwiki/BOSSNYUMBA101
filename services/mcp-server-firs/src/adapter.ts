/**
 * Deterministic mock adapter for `@bossnyumba/mcp-server-firs`.
 * Production adapter (TaxProMax + NRS Tax ID Portal) ships in Phase F.
 *
 * Mock policy:
 *   - file_vat_return: outputVat = grossSales * 7.5 %; net = outputVat -
 *     inputVat (floored at 0); ack id derived from tin+period.
 *   - verify_tin: 12 digits => legacy FIRS TIN; 13 digits => NRS Tax ID
 *     (issued from 2026-01-01); other shapes => verified=false.
 *   - get_payment_status: even-ack hash => paid; odd-ack hash => unpaid.
 */

import type {
  FirsAdapter,
  FileVatReturnArgs,
  FileVatReturnResult,
  GetPaymentStatusArgs,
  GetPaymentStatusResult,
  VerifyTinArgs,
  VerifyTinResult,
} from './types.js';

const VAT_RATE = 0.075; // Finance Act 2020 §15
const TIN_LEGACY_FIRS = /^\d{12}$/;
const TIN_NRS_TAX_ID = /^\d{13}$/;

function hashOdd(s: string): boolean {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % 2 === 1;
}

export class MockFirsAdapter implements FirsAdapter {
  async fileVatReturn(args: FileVatReturnArgs): Promise<FileVatReturnResult> {
    const outputVatKobo = Math.round(args.grossSalesKobo * VAT_RATE);
    const netPayableKobo = Math.max(0, outputVatKobo - args.inputVatKobo);
    const acknowledgementId = `firs-mock-${args.tenantId}-${args.tin.slice(-4)}-${args.period}`;
    return Object.freeze({
      acknowledgementId,
      outputVatKobo,
      netPayableKobo,
      filingStatus: 'accepted' as const,
    });
  }

  async verifyTin(args: VerifyTinArgs): Promise<VerifyTinResult> {
    if (TIN_NRS_TAX_ID.test(args.tin)) {
      return Object.freeze({
        verified: true,
        issuer: 'nrs' as const,
        taxpayerName: `Mock NRS Taxpayer #${args.tin.slice(-4)}`,
      });
    }
    if (TIN_LEGACY_FIRS.test(args.tin)) {
      return Object.freeze({
        verified: true,
        issuer: 'firs' as const,
        taxpayerName: `Mock FIRS Taxpayer #${args.tin.slice(-4)}`,
      });
    }
    return Object.freeze({
      verified: false,
      issuer: 'unknown' as const,
      reason: 'invalid_shape',
    });
  }

  async getPaymentStatus(
    args: GetPaymentStatusArgs,
  ): Promise<GetPaymentStatusResult> {
    const isUnpaid = hashOdd(args.acknowledgementId);
    return Object.freeze({
      status: isUnpaid ? ('unpaid' as const) : ('paid' as const),
      balanceKobo: isUnpaid ? 100_000 : 0,
      lastUpdated: '2026-05-18T00:00:00Z',
    });
  }
}

/**
 * Production adapter stub — Phase F wires to TaxProMax
 * (https://taxpromax.firs.gov.ng) and the NRS Tax ID Portal.
 */
export class FirsTaxProMaxAdapter implements FirsAdapter {
  async fileVatReturn(_args: FileVatReturnArgs): Promise<FileVatReturnResult> {
    throw new Error(
      'FirsTaxProMaxAdapter.fileVatReturn not yet wired — Phase F.',
    );
  }
  async verifyTin(_args: VerifyTinArgs): Promise<VerifyTinResult> {
    throw new Error('FirsTaxProMaxAdapter.verifyTin not yet wired — Phase F.');
  }
  async getPaymentStatus(
    _args: GetPaymentStatusArgs,
  ): Promise<GetPaymentStatusResult> {
    throw new Error(
      'FirsTaxProMaxAdapter.getPaymentStatus not yet wired — Phase F.',
    );
  }
}
