/**
 * Airtel Money callback handling
 */
import { createHmac, timingSafeEqual } from 'crypto';
import { CallbackError } from '../../common/errors';
import { logger } from '../../common/logger';
import type { PaymentStatus } from '../../common/types';
import type { AirtelCallbackPayload } from './types';

export interface AirtelCallbackResult {
  transactionId: string;
  reference?: string;
  status: PaymentStatus;
  amount?: number;
}

export function parseAirtelCallback(payload: unknown): AirtelCallbackResult {
  const data = payload as AirtelCallbackPayload;

  const transactionId =
    data.transaction?.id ?? data.transaction_id ?? 'unknown';

  if (!transactionId || transactionId === 'unknown') {
    throw new CallbackError('Invalid Airtel callback: no transaction ID', 'airtel');
  }

  const rawStatus = data.transaction?.status ?? data.status ?? '';

  let status: PaymentStatus = 'PENDING';
  if (rawStatus === 'TS' || rawStatus === 'success' || rawStatus === 'completed') {
    status = 'SUCCEEDED';
  } else if (rawStatus === 'TP' || rawStatus === 'pending') {
    status = 'PENDING';
  } else if (rawStatus === 'TF' || rawStatus === 'failed') {
    status = 'FAILED';
  }

  logger.info(
    {
      transactionId,
      status,
      rawStatus,
      provider: 'airtel',
    },
    'Airtel Money callback processed'
  );

  return {
    transactionId,
    reference: data.transaction?.reference,
    status,
  };
}

export function verifyAirtelCallbackSignature(
  rawBody: string,
  signature: string | undefined,
  secret: string
): boolean {
  // Fail CLOSED: a missing secret or signature must REJECT. Previously an
  // unconfigured secret returned `true`, accepting every (forgeable) callback —
  // a money-webhook auth bypass.
  if (!secret || !signature) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  // Accept bare hex or the `sha256=` prefixed form; compare in constant time.
  const provided = signature.startsWith('sha256=')
    ? signature.slice('sha256='.length)
    : signature;
  const a = Buffer.from(provided, 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
