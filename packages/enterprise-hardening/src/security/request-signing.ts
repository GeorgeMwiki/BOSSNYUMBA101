/**
 * HMAC request signing and replay protection.
 *
 * Producers sign a canonical request string
 * (`${timestamp}.${nonce}.${method}.${path}.${bodyHash}`) with a shared secret
 * using HMAC-SHA256. Verifiers check the signature, timestamp skew, and
 * replay nonces via a pluggable store.
 */

import { createHmac, createHash, timingSafeEqual, randomBytes } from 'node:crypto';

export interface SignRequestInput {
  readonly method: string;
  readonly path: string;
  readonly body: string | Uint8Array;
  readonly timestamp?: number;
  readonly nonce?: string;
}

export interface SignedRequest {
  readonly signature: string;
  readonly timestamp: number;
  readonly nonce: string;
  readonly algorithm: 'HMAC-SHA256';
}

/**
 * Signature header names used by the request-signing protocol.
 */
export const SIGNATURE_HEADERS = {
  SIGNATURE: 'x-bossnyumba-signature',
  TIMESTAMP: 'x-bossnyumba-timestamp',
  NONCE: 'x-bossnyumba-nonce',
  KEY_ID: 'x-bossnyumba-key-id',
} as const;

export function signRequest(
  input: SignRequestInput,
  secret: string
): SignedRequest {
  const timestamp = input.timestamp ?? Date.now();
  const nonce = input.nonce ?? randomBytes(16).toString('hex');
  const signature = computeSignature(
    secret,
    timestamp,
    nonce,
    input.method,
    input.path,
    input.body
  );
  return { signature, timestamp, nonce, algorithm: 'HMAC-SHA256' };
}

export interface VerifyRequestInput {
  readonly method: string;
  readonly path: string;
  readonly body: string | Uint8Array;
  readonly signature: string;
  readonly timestamp: number;
  readonly nonce: string;
}

export interface ReplayStore {
  /** Returns true if this nonce has never been seen. Atomically records it. */
  seen(nonce: string, ttlMs: number): Promise<boolean>;
}

export class InMemoryReplayStore implements ReplayStore {
  private readonly seenMap = new Map<string, number>();

  async seen(nonce: string, ttlMs: number): Promise<boolean> {
    const now = Date.now();
    for (const [k, exp] of this.seenMap) {
      if (exp <= now) this.seenMap.delete(k);
    }
    if (this.seenMap.has(nonce)) return false;
    this.seenMap.set(nonce, now + ttlMs);
    return true;
  }
}

export interface VerifyOptions {
  readonly secret: string;
  readonly maxSkewMs?: number;
  readonly replayStore?: ReplayStore;
  readonly now?: () => number;
}

export type VerifyResult =
  | { valid: true }
  | { valid: false; reason: 'BAD_SIGNATURE' | 'STALE_TIMESTAMP' | 'REPLAY' | 'MALFORMED' };

export async function verifyRequest(
  input: VerifyRequestInput,
  options: VerifyOptions
): Promise<VerifyResult> {
  if (
    !input.signature ||
    !input.nonce ||
    !Number.isFinite(input.timestamp)
  ) {
    return { valid: false, reason: 'MALFORMED' };
  }
  const now = options.now?.() ?? Date.now();
  const maxSkew = options.maxSkewMs ?? 5 * 60_000;
  if (Math.abs(now - input.timestamp) > maxSkew) {
    return { valid: false, reason: 'STALE_TIMESTAMP' };
  }
  const expected = computeSignature(
    options.secret,
    input.timestamp,
    input.nonce,
    input.method,
    input.path,
    input.body
  );
  const expectedBuf = Buffer.from(expected, 'hex');
  let providedBuf: Buffer;
  try {
    providedBuf = Buffer.from(input.signature, 'hex');
  } catch {
    return { valid: false, reason: 'MALFORMED' };
  }
  if (providedBuf.length !== expectedBuf.length) {
    return { valid: false, reason: 'BAD_SIGNATURE' };
  }
  if (!timingSafeEqual(providedBuf, expectedBuf)) {
    return { valid: false, reason: 'BAD_SIGNATURE' };
  }
  if (options.replayStore) {
    const ok = await options.replayStore.seen(input.nonce, maxSkew * 2);
    if (!ok) {
      return { valid: false, reason: 'REPLAY' };
    }
  }
  return { valid: true };
}

function computeSignature(
  secret: string,
  timestamp: number,
  nonce: string,
  method: string,
  path: string,
  body: string | Uint8Array
): string {
  const bodyHash = createHash('sha256').update(body).digest('hex');
  const canonical = `${timestamp}.${nonce}.${method.toUpperCase()}.${path}.${bodyHash}`;
  return createHmac('sha256', secret).update(canonical).digest('hex');
}
