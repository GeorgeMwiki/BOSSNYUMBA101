/**
 * Inbound webhook processing for external payment providers.
 *
 * Responsibilities:
 *  - Verify provider signatures (HMAC-SHA256 / Stripe-style t=..,v1=..).
 *  - Deduplicate by provider event ID.
 *  - Audit every inbound event (raw body hash + metadata).
 *  - Dispatch to idempotent handler functions.
 *  - Route failed deliveries to a Dead Letter Queue (DLQ) after N attempts.
 */
import CryptoJS from 'crypto-js';
import { v4 as uuidv4 } from 'uuid';

export type InboundProvider =
  | 'stripe'
  | 'mpesa'
  | 'airtel'
  | 'tigopesa'
  | 'bank';

export interface InboundEvent {
  /** Globally unique, provider-scoped event id for deduplication. */
  providerEventId: string;
  provider: InboundProvider;
  eventType: string;
  receivedAt: string;
  rawBody: string;
  headers: Record<string, string>;
  parsed?: Record<string, unknown> | undefined;
}

export interface AuditRecord {
  id: string;
  provider: InboundProvider;
  providerEventId: string;
  eventType: string;
  receivedAt: string;
  rawBodySha256: string;
  signatureVerified: boolean;
  outcome: 'processed' | 'duplicate' | 'failed' | 'rejected';
  attempts: number;
  error?: string | undefined;
}

export interface AuditStore {
  record(entry: AuditRecord): Promise<void>;
  list(filter?: { provider?: InboundProvider; outcome?: AuditRecord['outcome'] }): Promise<AuditRecord[]>;
  get(id: string): Promise<AuditRecord | undefined>;
}

export class InMemoryAuditStore implements AuditStore {
  private readonly entries: AuditRecord[] = [];

  async record(entry: AuditRecord): Promise<void> {
    this.entries.push(entry);
  }

  async list(filter?: { provider?: InboundProvider; outcome?: AuditRecord['outcome'] }): Promise<AuditRecord[]> {
    return this.entries.filter(
      (e) =>
        (!filter?.provider || e.provider === filter.provider) &&
        (!filter?.outcome || e.outcome === filter.outcome)
    );
  }

  async get(id: string): Promise<AuditRecord | undefined> {
    return this.entries.find((e) => e.id === id);
  }
}

export interface DeduplicationStore {
  seen(provider: InboundProvider, providerEventId: string): Promise<boolean>;
  mark(provider: InboundProvider, providerEventId: string, ttlMs?: number): Promise<void>;
}

export class InMemoryDedupStore implements DeduplicationStore {
  private readonly seenKeys = new Map<string, number>();
  private readonly defaultTtlMs: number;

  constructor(defaultTtlMs: number = 7 * 24 * 60 * 60 * 1000) {
    this.defaultTtlMs = defaultTtlMs;
  }

  async seen(provider: InboundProvider, providerEventId: string): Promise<boolean> {
    const key = `${provider}:${providerEventId}`;
    const exp = this.seenKeys.get(key);
    if (exp === undefined) return false;
    if (Date.now() > exp) {
      this.seenKeys.delete(key);
      return false;
    }
    return true;
  }

  async mark(provider: InboundProvider, providerEventId: string, ttlMs?: number): Promise<void> {
    const key = `${provider}:${providerEventId}`;
    this.seenKeys.set(key, Date.now() + (ttlMs ?? this.defaultTtlMs));
  }
}

export interface DLQEntry {
  id: string;
  event: InboundEvent;
  lastError: string;
  attempts: number;
  deadAt: string;
}

export interface DLQ {
  send(entry: DLQEntry): Promise<void>;
  list(): Promise<DLQEntry[]>;
  drain(): Promise<DLQEntry[]>;
}

export class InMemoryDLQ implements DLQ {
  private readonly entries: DLQEntry[] = [];

  async send(entry: DLQEntry): Promise<void> {
    this.entries.push(entry);
  }

  async list(): Promise<DLQEntry[]> {
    return [...this.entries];
  }

  async drain(): Promise<DLQEntry[]> {
    return this.entries.splice(0, this.entries.length);
  }
}

// ---------------------------------------------------------------------------
// Signature verification
// ---------------------------------------------------------------------------

export interface SignatureConfig {
  provider: InboundProvider;
  /** Shared secret or signing key. */
  secret: string;
  /** Header field that carries the signature. */
  header: string;
  /** Optional header field carrying timestamp (Stripe style). */
  timestampHeader?: string;
  /**
   * Maximum allowed skew between current time and the timestamp header,
   * in seconds. Anti-replay. Ignored if timestampHeader is absent.
   */
  maxSkewSeconds?: number;
}

function hmacHex(body: string, secret: string): string {
  return CryptoJS.HmacSHA256(body, secret).toString(CryptoJS.enc.Hex);
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Verify an inbound webhook signature.
 *
 * Handles:
 *   - Plain HMAC-SHA256 hex (Airtel, Tigo, M-Pesa C2B)
 *   - "sha256=<hex>" prefix (Airtel variant)
 *   - Stripe-style "t=<ts>,v1=<sig>"
 */
export function verifySignature(
  config: SignatureConfig,
  headers: Record<string, string>,
  rawBody: string,
  now: Date = new Date()
): { valid: boolean; reason?: string } {
  const headerValue = pickHeader(headers, config.header);
  if (!headerValue) {
    return { valid: false, reason: 'missing-signature-header' };
  }

  // Stripe-style timestamped signature
  if (headerValue.includes('t=') && headerValue.includes('v1=')) {
    const parts = headerValue.split(',').map((p) => p.trim());
    const t = parts.find((p) => p.startsWith('t='))?.slice(2) ?? '';
    const v1 = parts.find((p) => p.startsWith('v1='))?.slice(3) ?? '';
    if (!t || !v1) return { valid: false, reason: 'malformed-stripe-signature' };
    const ts = parseInt(t, 10);
    if (!Number.isFinite(ts)) return { valid: false, reason: 'invalid-timestamp' };
    const skewSec = Math.abs(Math.floor(now.getTime() / 1000) - ts);
    if (config.maxSkewSeconds && skewSec > config.maxSkewSeconds) {
      return { valid: false, reason: 'timestamp-skew-exceeded' };
    }
    const expected = hmacHex(`${t}.${rawBody}`, config.secret);
    return safeEqual(expected, v1)
      ? { valid: true }
      : { valid: false, reason: 'signature-mismatch' };
  }

  // Plain HMAC hex (with optional "sha256=" prefix)
  const candidate = headerValue.startsWith('sha256=')
    ? headerValue.slice('sha256='.length)
    : headerValue;
  const expected = hmacHex(rawBody, config.secret);

  if (config.timestampHeader && config.maxSkewSeconds) {
    const tsHeader = pickHeader(headers, config.timestampHeader);
    if (!tsHeader) return { valid: false, reason: 'missing-timestamp-header' };
    const tsDate = new Date(tsHeader);
    const tsMs = tsDate.getTime();
    if (!Number.isFinite(tsMs)) return { valid: false, reason: 'invalid-timestamp' };
    const skewSec = Math.abs(Math.floor((now.getTime() - tsMs) / 1000));
    if (skewSec > config.maxSkewSeconds) {
      return { valid: false, reason: 'timestamp-skew-exceeded' };
    }
  }

  return safeEqual(expected, candidate)
    ? { valid: true }
    : { valid: false, reason: 'signature-mismatch' };
}

function pickHeader(
  headers: Record<string, string>,
  name: string
): string | undefined {
  const lower = name.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === lower) return v;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

export type HandlerResult =
  | { ok: true }
  | { ok: false; retryable: boolean; error: string };

export type EventHandler = (event: InboundEvent) => Promise<HandlerResult>;

export interface InboundRouterDeps {
  audit: AuditStore;
  dedup: DeduplicationStore;
  dlq: DLQ;
  signatures: Partial<Record<InboundProvider, SignatureConfig>>;
  handlers: Partial<Record<InboundProvider, EventHandler>>;
  maxAttempts?: number;
  retryDelayMs?: number;
}

/**
 * Extract a provider-scoped event id from the raw event. Each provider has
 * its own canonical field: Stripe uses `id`, M-Pesa uses CheckoutRequestID,
 * etc. Fall back to a body hash so dedup still works for providers that
 * do not send a stable id.
 */
export function extractEventId(
  provider: InboundProvider,
  parsed: Record<string, unknown> | undefined,
  rawBody: string
): string {
  if (!parsed) return sha256Hex(rawBody);
  const get = (path: string[]): unknown => {
    let cur: unknown = parsed;
    for (const p of path) {
      if (cur && typeof cur === 'object' && p in (cur as Record<string, unknown>)) {
        cur = (cur as Record<string, unknown>)[p];
      } else {
        return undefined;
      }
    }
    return cur;
  };

  switch (provider) {
    case 'stripe': {
      const id = get(['id']);
      if (typeof id === 'string' && id) return id;
      break;
    }
    case 'mpesa': {
      const stk = get(['Body', 'stkCallback', 'CheckoutRequestID']);
      if (typeof stk === 'string' && stk) return `stk:${stk}`;
      const b2c = get(['Result', 'ConversationID']);
      if (typeof b2c === 'string' && b2c) return `b2c:${b2c}`;
      const c2b = get(['TransID']);
      if (typeof c2b === 'string' && c2b) return `c2b:${c2b}`;
      break;
    }
    case 'airtel': {
      const tid = get(['transaction', 'id']);
      if (typeof tid === 'string' && tid) return tid;
      const topTid = get(['transaction_id']);
      if (typeof topTid === 'string' && topTid) return topTid;
      break;
    }
    case 'tigopesa': {
      const tid = get(['TXNID']);
      if (typeof tid === 'string' && tid) return tid;
      break;
    }
    case 'bank':
    default:
      break;
  }
  return sha256Hex(rawBody);
}

function sha256Hex(value: string): string {
  return CryptoJS.SHA256(value).toString(CryptoJS.enc.Hex);
}

export class InboundWebhookRouter {
  private readonly audit: AuditStore;
  private readonly dedup: DeduplicationStore;
  private readonly dlq: DLQ;
  private readonly signatures: Partial<Record<InboundProvider, SignatureConfig>>;
  private readonly handlers: Partial<Record<InboundProvider, EventHandler>>;
  private readonly maxAttempts: number;
  private readonly retryDelayMs: number;

  constructor(deps: InboundRouterDeps) {
    this.audit = deps.audit;
    this.dedup = deps.dedup;
    this.dlq = deps.dlq;
    this.signatures = deps.signatures;
    this.handlers = deps.handlers;
    this.maxAttempts = deps.maxAttempts ?? 5;
    this.retryDelayMs = deps.retryDelayMs ?? 500;
  }

  async handle(
    provider: InboundProvider,
    headers: Record<string, string>,
    rawBody: string
  ): Promise<{ status: number; body: Record<string, unknown> }> {
    const receivedAt = new Date().toISOString();
    const id = uuidv4();
    const bodyHash = sha256Hex(rawBody);

    const sigCfg = this.signatures[provider];
    let signatureVerified = false;
    if (sigCfg) {
      const verification = verifySignature(sigCfg, headers, rawBody);
      signatureVerified = verification.valid;
      if (!verification.valid) {
        await this.audit.record({
          id,
          provider,
          providerEventId: 'unknown',
          eventType: 'unknown',
          receivedAt,
          rawBodySha256: bodyHash,
          signatureVerified: false,
          outcome: 'rejected',
          attempts: 0,
          error: verification.reason,
        });
        return { status: 401, body: { error: verification.reason } };
      }
    }

    let parsed: Record<string, unknown> | undefined;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      parsed = undefined;
    }

    const providerEventId = extractEventId(provider, parsed, rawBody);
    const eventType = this.deriveEventType(provider, parsed);

    if (await this.dedup.seen(provider, providerEventId)) {
      await this.audit.record({
        id,
        provider,
        providerEventId,
        eventType,
        receivedAt,
        rawBodySha256: bodyHash,
        signatureVerified,
        outcome: 'duplicate',
        attempts: 0,
      });
      return { status: 200, body: { ok: true, duplicate: true } };
    }

    const handler = this.handlers[provider];
    if (!handler) {
      await this.audit.record({
        id,
        provider,
        providerEventId,
        eventType,
        receivedAt,
        rawBodySha256: bodyHash,
        signatureVerified,
        outcome: 'failed',
        attempts: 0,
        error: 'no-handler-registered',
      });
      return { status: 501, body: { error: 'no-handler-registered' } };
    }

    const event: InboundEvent = {
      providerEventId,
      provider,
      eventType,
      receivedAt,
      rawBody,
      headers,
      parsed,
    };

    let attempts = 0;
    let lastError: string | undefined;
    let backoff = this.retryDelayMs;

    while (attempts < this.maxAttempts) {
      attempts++;
      let result: HandlerResult;
      try {
        result = await handler(event);
      } catch (err) {
        result = {
          ok: false,
          retryable: true,
          error: err instanceof Error ? err.message : String(err),
        };
      }

      if (result.ok) {
        await this.dedup.mark(provider, providerEventId);
        await this.audit.record({
          id,
          provider,
          providerEventId,
          eventType,
          receivedAt,
          rawBodySha256: bodyHash,
          signatureVerified,
          outcome: 'processed',
          attempts,
        });
        return { status: 200, body: { ok: true } };
      }

      lastError = result.error;

      if (!result.retryable) break;
      if (attempts < this.maxAttempts) {
        await sleep(backoff);
        backoff *= 2;
      }
    }

    await this.dlq.send({
      id: uuidv4(),
      event,
      lastError: lastError ?? 'unknown',
      attempts,
      deadAt: new Date().toISOString(),
    });
    await this.audit.record({
      id,
      provider,
      providerEventId,
      eventType,
      receivedAt,
      rawBodySha256: bodyHash,
      signatureVerified,
      outcome: 'failed',
      attempts,
      error: lastError,
    });

    // Still return 200 to avoid the provider retrying forever; the DLQ now
    // owns the retry/replay lifecycle.
    return { status: 200, body: { ok: false, deadLettered: true } };
  }

  private deriveEventType(
    provider: InboundProvider,
    parsed: Record<string, unknown> | undefined
  ): string {
    if (!parsed) return `${provider}.unknown`;
    if (provider === 'stripe' && typeof parsed.type === 'string') {
      return parsed.type;
    }
    if (provider === 'mpesa') {
      if ((parsed as any).Body?.stkCallback) return 'mpesa.stk_callback';
      if ((parsed as any).Result) return 'mpesa.b2c_result';
      if ((parsed as any).TransID) return 'mpesa.c2b_confirmation';
    }
    if (provider === 'airtel') return 'airtel.transaction';
    if (provider === 'tigopesa') return 'tigopesa.transaction';
    return `${provider}.unknown`;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
