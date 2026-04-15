/**
 * M-Pesa transaction metric emitter.
 */
import { emitMetric } from './log-sink.js';

export type MpesaTxType = 'stk_push' | 'b2c' | 'query' | 'callback' | string;
export type MpesaTxStatus = 'initiated' | 'success' | 'failed' | 'pending' | string;

export interface MpesaTransactionMetric {
  type: MpesaTxType;
  status: MpesaTxStatus;
  latencyMs: number;
  tenantId?: string;
  /** Transaction amount in minor units, if applicable. */
  amountMinorUnits?: number;
  currency?: string;
}

export function emitMpesaTransaction(metric: MpesaTransactionMetric): void {
  emitMetric('mpesa.transaction', metric.latencyMs, {
    type: metric.type,
    status: metric.status,
    tenantId: metric.tenantId,
    amountMinorUnits: metric.amountMinorUnits,
    currency: metric.currency,
  });
}
