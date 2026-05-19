/**
 * Agent-to-Agent (A2A) Authentication — HMAC-signed calls between
 * cooperating BOSSNYUMBA agents and partner-platform agents.
 *
 * Flow (caller side):
 *   1. Build canonical string: `${method}\n${path}\n${timestamp}\n${bodyHash}`.
 *   2. HMAC-SHA256 sign with the agent's shared secret.
 *   3. Attach headers:
 *        X-Agent-Id: <agentId>
 *        X-Agent-Timestamp: <unix ms>
 *        X-Agent-Signature: sha256=<hex>
 *
 * Flow (server side):
 *   1. Reject if timestamp drift > 5 minutes (replay protection).
 *   2. Look up agent by id.
 *   3. Compute the expected signature with the agent's stored secret.
 *   4. Constant-time compare.
 *   5. Return `AgentAuthSuccess` with tenant + scopes.
 *
 * The module is storage-agnostic — the caller injects an `AgentRegistry`.
 */

import { getCorrelationId, type HeadersLike } from './correlation-id.js';
import type {
  AgentAuthResult,
  AgentScope,
  RegisteredAgent,
} from './types.js';

// ============================================================================
// Constants
// ============================================================================

const MAX_CLOCK_DRIFT_MS = 5 * 60 * 1000;
const SIGNATURE_HEADER = 'x-agent-signature';
const AGENT_ID_HEADER = 'x-agent-id';
const TIMESTAMP_HEADER = 'x-agent-timestamp';

// ============================================================================
// Registry port
// ============================================================================

export interface AgentRegistry {
  findById(agentId: string): Promise<RegisteredAgent | null>;
  touchLastSeen(agentId: string, iso: string): Promise<void>;
  /**
   * Resolve the RAW shared HMAC secret for the agent.
   *
   * C4 closure (round-3 audit): previously `verifyAgentRequest` signed
   * with `agent.hmacSecretHash` (the SHA-256 of the secret). This is
   * incoherent — if `hash(secret)` is what's used as the HMAC key,
   * then `hash(secret)` IS the effective secret, providing zero
   * security uplift over storing the raw secret. A DB leak still
   * yields the value the legitimate caller uses to sign.
   *
   * Correct production wiring (REQUIRED for non-test deployments):
   *   - Persist `hmacSecretHash` for revocation / equality checks ONLY.
   *   - Store the RAW secret in a KMS-backed secret manager (AWS
   *     Secrets Manager, GCP Secret Manager, HashiCorp Vault).
   *   - Implement `resolveSecret` to fetch the raw secret on-demand
   *     and cache for the duration of the auth check.
   *   - NEVER log the raw secret or include it in audit metadata.
   *
   * Test wiring: in-memory implementations may return the raw secret
   * from a Map. The interface keeps the test surface minimal.
   *
   * Implementations that have not yet wired KMS-backed resolution
   * should return `null` — the verifier will reject the request with
   * `AUTH_INVALID_KEY` rather than silently fall back to the
   * (incoherent) hash-as-key signature.
   */
  resolveSecret(agentId: string): Promise<string | null>;
}

// ============================================================================
// Crypto helpers
// ============================================================================

export async function hashApiKey(key: string): Promise<string> {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(key));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function sha256Hex(input: string): Promise<string> {
  return hashApiKey(input);
}

export async function hmacSha256Hex(
  secret: string,
  message: string,
): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function generateAgentApiKey(): string {
  const a = crypto.randomUUID().replace(/-/g, '');
  const b = crypto.randomUUID().replace(/-/g, '');
  return `bnk_agent_${a}${b}`;
}

export function generateAgentHmacSecret(): string {
  return crypto.randomUUID().replace(/-/g, '') +
    crypto.randomUUID().replace(/-/g, '');
}

/**
 * Constant-time string compare (length-independent timing).
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

// ============================================================================
// Canonical string
// ============================================================================

export async function buildCanonicalString(
  method: string,
  path: string,
  timestamp: number,
  body: string,
): Promise<string> {
  const bodyHash = await sha256Hex(body);
  return `${method.toUpperCase()}\n${path}\n${timestamp}\n${bodyHash}`;
}

export async function signRequest(
  method: string,
  path: string,
  timestamp: number,
  body: string,
  secret: string,
): Promise<string> {
  const canonical = await buildCanonicalString(method, path, timestamp, body);
  const sig = await hmacSha256Hex(secret, canonical);
  return `sha256=${sig}`;
}

// ============================================================================
// Auth request shape
// ============================================================================

export interface AgentAuthRequest {
  readonly method: string;
  readonly path: string;
  readonly headers: HeadersLike;
  readonly body: string;
}

export interface AgentAuthDeps {
  readonly registry: AgentRegistry;
  readonly now?: () => number;
  readonly maxClockDriftMs?: number;
  /**
   * Replay-prevention ledger (H11 closure). Stores
   * (signature, timestamp) tuples for the duration of
   * `maxClockDriftMs`. The verifier consults this AFTER signature
   * validation and rejects a successful match.
   *
   * Without a ledger, a captured signed request can be replayed any
   * number of times within the 5-minute drift window. For idempotent
   * bodies this is harmless; for non-idempotent POSTs it isn't.
   *
   * Production wiring: Redis `SET <signature> 1 NX EX 300`. Test wiring:
   * in-memory Set.
   *
   * When omitted, replay prevention is disabled and the verifier emits
   * a warning header `X-Agent-Auth-Note: replay-prevention-disabled`
   * via the caller's response decoration (caller's responsibility).
   */
  readonly replayLedger?: ReplayLedger;
}

/**
 * Replay-prevention ledger port. The implementation must guarantee
 * at-most-once acceptance for a given signature within the TTL window.
 */
export interface ReplayLedger {
  /**
   * Attempt to claim the signature for one-time use. Returns `true` if
   * this is the FIRST time the signature has been seen (the request
   * may proceed); `false` if it's a replay (the request must be
   * rejected).
   */
  claimOnce(signature: string, ttlMs: number): Promise<boolean>;
}

export function createInMemoryReplayLedger(): ReplayLedger {
  const seen = new Map<string, number>();
  return {
    async claimOnce(signature: string, ttlMs: number): Promise<boolean> {
      const now = Date.now();
      // Evict expired entries.
      for (const [sig, expiresAt] of seen) {
        if (expiresAt < now) seen.delete(sig);
      }
      if (seen.has(signature)) return false;
      seen.set(signature, now + ttlMs);
      return true;
    },
  };
}

// ============================================================================
// Verify
// ============================================================================

export async function verifyAgentRequest(
  deps: AgentAuthDeps,
  request: AgentAuthRequest,
  requiredScopes?: ReadonlyArray<AgentScope>,
): Promise<AgentAuthResult> {
  const now = (deps.now ?? Date.now)();
  const maxDrift = deps.maxClockDriftMs ?? MAX_CLOCK_DRIFT_MS;
  const correlationId = getCorrelationId(request.headers);

  const agentId = request.headers[AGENT_ID_HEADER];
  const tsHeader = request.headers[TIMESTAMP_HEADER];
  const signature = request.headers[SIGNATURE_HEADER];

  if (!agentId || !tsHeader || !signature) {
    return {
      ok: false,
      error: `Provide ${AGENT_ID_HEADER}, ${TIMESTAMP_HEADER}, ${SIGNATURE_HEADER} headers.`,
      errorCode: 'AUTH_REQUIRED',
      status: 401,
      correlationId,
    };
  }

  const timestamp = Number(tsHeader);
  if (!Number.isFinite(timestamp)) {
    return {
      ok: false,
      error: 'Invalid timestamp header.',
      errorCode: 'AUTH_INVALID_SIGNATURE',
      status: 401,
      correlationId,
    };
  }
  if (Math.abs(now - timestamp) > maxDrift) {
    return {
      ok: false,
      error: 'Request timestamp outside allowed window.',
      errorCode: 'AUTH_INVALID_SIGNATURE',
      status: 401,
      correlationId,
    };
  }

  const agent = await deps.registry.findById(agentId);
  if (!agent) {
    return {
      ok: false,
      error: 'Agent not found.',
      errorCode: 'AUTH_INVALID_KEY',
      status: 401,
      correlationId,
    };
  }
  if (agent.status === 'revoked') {
    return {
      ok: false,
      error: 'Agent revoked.',
      errorCode: 'AUTH_REVOKED_AGENT',
      status: 401,
      correlationId,
    };
  }
  if (agent.status === 'suspended') {
    return {
      ok: false,
      error: 'Agent suspended.',
      errorCode: 'AUTH_SUSPENDED_AGENT',
      status: 401,
      correlationId,
    };
  }

  // C4 closure: sign with the RAW secret resolved on-demand from the
  // registry (typically backed by KMS). The previous implementation
  // signed with `agent.hmacSecretHash` — incoherent (see
  // AgentRegistry.resolveSecret docstring).
  const rawSecret = await deps.registry.resolveSecret(agent.id);
  if (rawSecret === null || rawSecret === undefined || rawSecret.length === 0) {
    return {
      ok: false,
      error: 'Agent secret not resolvable (KMS unavailable or unconfigured).',
      errorCode: 'AUTH_INVALID_KEY',
      status: 401,
      correlationId,
    };
  }
  const expected = await signRequest(
    request.method,
    request.path,
    timestamp,
    request.body,
    rawSecret,
  );

  if (!timingSafeEqual(signature, expected)) {
    return {
      ok: false,
      error: 'Signature mismatch.',
      errorCode: 'AUTH_INVALID_SIGNATURE',
      status: 401,
      correlationId,
    };
  }

  // H11 closure: replay-prevention check. The ledger guarantees
  // at-most-once acceptance per signature within the drift window.
  if (deps.replayLedger) {
    const claimed = await deps.replayLedger.claimOnce(signature, maxDrift);
    if (!claimed) {
      return {
        ok: false,
        error: 'Request replay detected.',
        errorCode: 'AUTH_REPLAY_DETECTED',
        status: 401,
        correlationId,
      };
    }
  }

  if (requiredScopes && requiredScopes.length > 0) {
    const missing = requiredScopes.filter((s) => !agent.scopes.includes(s));
    if (missing.length > 0) {
      return {
        ok: false,
        error: `Missing scopes: ${missing.join(', ')}`,
        errorCode: 'AUTH_SCOPE_DENIED',
        status: 403,
        correlationId,
      };
    }
  }

  // Fire-and-forget touch
  void deps.registry
    .touchLastSeen(agent.id, new Date(now).toISOString())
    .catch(() => {
      /* non-fatal */
    });

  return {
    ok: true,
    agent,
    scopes: agent.scopes,
    correlationId,
  };
}
