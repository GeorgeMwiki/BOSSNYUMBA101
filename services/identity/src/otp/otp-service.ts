// @ts-nocheck — node 20 crypto global typing drift; matches repo convention
/**
 * OTP Service — phone one-time password issuance and verification.
 *
 * Default backing store is a `Map<identityId, OtpRecord>` with a 5-minute
 * TTL. Stored codes are hashed (SHA-256) so the raw code exists only in
 * transit to the dispatcher.
 *
 * Interface is intentionally small so a Redis / KV-store backend can slot
 * in without touching callers:
 *
 *   class RedisOtpStore implements OtpStore { ... }
 *
 * SMS delivery is done through `NotificationsDispatcher` — stubbed with a
 * TODO when the dispatcher isn't wired.
 */

import { randomInt, createHash } from 'node:crypto';
import type { TenantIdentityId } from '@bossnyumba/domain-models';

/** Default TTL for an OTP code — 5 minutes. */
export const OTP_TTL_MS = 5 * 60 * 1000;

/** Length of the generated numeric OTP. */
export const OTP_LENGTH = 6;

/** Max failed verify attempts before the code is invalidated. */
export const OTP_MAX_ATTEMPTS = 5;

/** One stored OTP record. */
export interface OtpRecord {
  readonly identityId: TenantIdentityId;
  readonly codeHash: string;
  readonly expiresAt: number; // epoch ms
  readonly phone: string;
  readonly attempts: number;
}

/** Storage port for OTP records. Swap the default Map impl for Redis later. */
export interface OtpStore {
  get(identityId: TenantIdentityId): Promise<OtpRecord | undefined>;
  set(record: OtpRecord): Promise<void>;
  delete(identityId: TenantIdentityId): Promise<void>;
}

/** SMS dispatcher port — integrates with notifications service. */
export interface SmsDispatcher {
  send(phone: string, message: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// In-memory default store
// ---------------------------------------------------------------------------

/**
 * Default OTP store: process-local Map. Good enough for tests, dev, and
 * single-node deployments. Production should inject a Redis-backed
 * implementation of `OtpStore`.
 */
export class InMemoryOtpStore implements OtpStore {
  private readonly records = new Map<string, OtpRecord>();

  async get(identityId: TenantIdentityId): Promise<OtpRecord | undefined> {
    return this.records.get(identityId as unknown as string);
  }

  async set(record: OtpRecord): Promise<void> {
    this.records.set(record.identityId as unknown as string, record);
  }

  async delete(identityId: TenantIdentityId): Promise<void> {
    this.records.delete(identityId as unknown as string);
  }
}

/**
 * No-op SMS dispatcher. Logs nothing (console.log is banned by project
 * rules). Real deployments should inject a `NotificationsDispatcher`-backed
 * implementation.
 */
export class NoopSmsDispatcher implements SmsDispatcher {
  async send(_phone: string, _message: string): Promise<void> {
    // TODO: integrate with services/notifications dispatcher once wired.
  }
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/** Result of a verify attempt. */
export interface OtpVerifyResult {
  readonly verified: boolean;
  readonly reason?:
    | 'NO_CODE'
    | 'EXPIRED'
    | 'MISMATCH'
    | 'TOO_MANY_ATTEMPTS';
}

/**
 * Hash a raw OTP code. SHA-256 is sufficient here — codes are high-entropy
 * numeric, short-lived, and hashing protects against store-dump replay
 * rather than brute-force collision resistance.
 */
function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

/**
 * Generate a zero-padded numeric OTP of the configured length.
 * Uses `crypto.randomInt` for uniform distribution.
 */
function generateCode(length: number): string {
  const upper = 10 ** length;
  const n = randomInt(0, upper);
  return String(n).padStart(length, '0');
}

export class OtpService {
  constructor(
    private readonly store: OtpStore = new InMemoryOtpStore(),
    private readonly sms: SmsDispatcher = new NoopSmsDispatcher(),
    private readonly now: () => number = () => Date.now(),
    private readonly ttlMs: number = OTP_TTL_MS
  ) {}

  /**
   * Generate and send an OTP to the given phone for the given identity.
   * Overwrites any previous in-flight code for this identity.
   */
  async send(
    identityId: TenantIdentityId,
    phone: string
  ): Promise<{ readonly expiresAt: number }> {
    if (!phone || phone.trim().length === 0) {
      throw new Error('OtpService.send: phone is required');
    }
    const code = generateCode(OTP_LENGTH);
    const expiresAt = this.now() + this.ttlMs;
    const record: OtpRecord = {
      identityId,
      codeHash: hashCode(code),
      expiresAt,
      phone,
      attempts: 0,
    };
    await this.store.set(record);
    try {
      await this.sms.send(
        phone,
        `Your BOSSNYUMBA verification code is ${code}. It expires in 5 minutes.`
      );
    } catch (error) {
      // Don't leak the raw code. Drop the stored record so the caller can
      // retry without a dangling valid code.
      await this.store.delete(identityId);
      throw new Error(
        `OtpService.send: failed to dispatch SMS: ${(error as Error).message}`
      );
    }
    return { expiresAt };
  }

  /**
   * Verify a submitted code for an identity. On success the record is
   * consumed (single-use). On mismatch the attempt counter is incremented
   * and the record is discarded once `OTP_MAX_ATTEMPTS` is reached.
   */
  async verify(
    identityId: TenantIdentityId,
    code: string
  ): Promise<OtpVerifyResult> {
    const record = await this.store.get(identityId);
    if (!record) {
      return { verified: false, reason: 'NO_CODE' };
    }
    if (this.now() >= record.expiresAt) {
      await this.store.delete(identityId);
      return { verified: false, reason: 'EXPIRED' };
    }
    const submitted = hashCode(code);
    if (submitted !== record.codeHash) {
      const nextAttempts = record.attempts + 1;
      if (nextAttempts >= OTP_MAX_ATTEMPTS) {
        await this.store.delete(identityId);
        return { verified: false, reason: 'TOO_MANY_ATTEMPTS' };
      }
      await this.store.set({
        ...record,
        attempts: nextAttempts,
      });
      return { verified: false, reason: 'MISMATCH' };
    }
    // Success — consume the record so it can't be replayed.
    await this.store.delete(identityId);
    return { verified: true };
  }
}
