/**
 * Idempotency middleware primitives.
 *
 * Implements Stripe-style idempotency keys: the first request with a given
 * key executes the handler and its response is cached; subsequent requests
 * return the cached response. Keys are tenant-scoped so a key from one tenant
 * cannot replay work performed for another.
 */

export interface IdempotencyRecord {
  readonly status: number;
  readonly body: unknown;
  readonly headers?: Record<string, string>;
  readonly storedAt: number;
  readonly fingerprint: string;
}

export interface IdempotencyStore {
  get(key: string): Promise<IdempotencyRecord | null>;
  set(key: string, record: IdempotencyRecord, ttlMs: number): Promise<void>;
  /** Atomically reserve a key. Returns true if this caller now owns the key. */
  reserve(key: string, ttlMs: number): Promise<boolean>;
  release(key: string): Promise<void>;
}

export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly records = new Map<
    string,
    { record: IdempotencyRecord; expiresAt: number }
  >();
  private readonly reservations = new Map<string, number>();

  async get(key: string): Promise<IdempotencyRecord | null> {
    const entry = this.records.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.records.delete(key);
      return null;
    }
    return entry.record;
  }

  async set(
    key: string,
    record: IdempotencyRecord,
    ttlMs: number
  ): Promise<void> {
    this.records.set(key, { record, expiresAt: Date.now() + ttlMs });
  }

  async reserve(key: string, ttlMs: number): Promise<boolean> {
    const now = Date.now();
    const existing = this.reservations.get(key);
    if (existing && existing > now) {
      return false;
    }
    this.reservations.set(key, now + ttlMs);
    return true;
  }

  async release(key: string): Promise<void> {
    this.reservations.delete(key);
  }
}

export interface IdempotencyConfig {
  /** TTL for cached responses. Default: 24h. */
  readonly ttlMs?: number;
  /** TTL for in-flight reservations. Default: 60s. */
  readonly reservationTtlMs?: number;
  /** Store used to persist idempotency records. */
  readonly store: IdempotencyStore;
}

export interface IdempotencyRequest {
  readonly key: string;
  readonly tenantId: string;
  /** Hash of the request body/route; ensures reused keys match the same op. */
  readonly fingerprint: string;
}

export type IdempotencyOutcome =
  | { kind: 'cached'; record: IdempotencyRecord }
  | { kind: 'conflict'; record: IdempotencyRecord }
  | { kind: 'in_flight' }
  | { kind: 'fresh' };

/**
 * Decide how a request should be handled for an idempotency key.
 * Callers then execute the handler (for 'fresh') and store the result via
 * {@link recordIdempotentResponse}.
 */
export async function beginIdempotent(
  req: IdempotencyRequest,
  config: IdempotencyConfig
): Promise<IdempotencyOutcome> {
  const k = scopedKey(req);
  const existing = await config.store.get(k);
  if (existing) {
    return existing.fingerprint === req.fingerprint
      ? { kind: 'cached', record: existing }
      : { kind: 'conflict', record: existing };
  }
  const reserved = await config.store.reserve(
    k,
    config.reservationTtlMs ?? 60_000
  );
  return reserved ? { kind: 'fresh' } : { kind: 'in_flight' };
}

/** Persist the handler's response under the idempotency key. */
export async function recordIdempotentResponse(
  req: IdempotencyRequest,
  response: Omit<IdempotencyRecord, 'storedAt' | 'fingerprint'>,
  config: IdempotencyConfig
): Promise<void> {
  const k = scopedKey(req);
  try {
    await config.store.set(
      k,
      {
        ...response,
        storedAt: Date.now(),
        fingerprint: req.fingerprint,
      },
      config.ttlMs ?? 24 * 60 * 60 * 1000
    );
  } finally {
    await config.store.release(k);
  }
}

function scopedKey(req: IdempotencyRequest): string {
  return `idem:${req.tenantId}:${req.key}`;
}
