/**
 * M-Pesa webhook hardening middleware.
 *
 * CRITICAL-3 (audit .audit/post-pr90-api-mcp-bug-sweep.md): Safaricom Daraja
 * STK callbacks are not signed today, but C2B and B2C results CAN be
 * HMAC-signed via the Org-managed `Initiator` shared secret. We layer
 * three defences:
 *
 *   1. IP allowlist (existing) — receive only from Safaricom's published
 *      source IPs.
 *   2. HMAC signature verification (NEW) — when `MPESA_WEBHOOK_SECRET`
 *      is set, require an `X-Mpesa-Signature` header that contains a
 *      lowercase hex HMAC-SHA256 of `${timestamp}.${rawBody}`. Reject
 *      requests with a missing/invalid signature OR a timestamp outside
 *      the 5-minute replay window. Production MUST set this secret
 *      (`MPESA_WEBHOOK_SECRET_REQUIRED=true`). Sandbox/dev may leave it
 *      unset for local testing.
 *   3. Deduplicate by `(tenantId, BusinessShortCode, TransID)` (existing)
 *      so retries cannot double-credit the ledger.
 *
 * Comparison is done with `crypto.timingSafeEqual` per the project's
 * mandatory security checks (~/.claude/rules/security.md).
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

// Safaricom Daraja production source IPs (as of 2024). Override via
// MPESA_ALLOWED_IPS (comma-separated) when Safaricom publishes changes
// or when running against the sandbox.
const DEFAULT_ALLOWED_IPS = [
  '196.201.214.200',
  '196.201.214.206',
  '196.201.213.114',
  '196.201.214.207',
  '196.201.214.208',
  '196.201.213.44',
  '196.201.212.127',
  '196.201.212.128',
  '196.201.212.129',
  '196.201.212.132',
  '196.201.212.136',
  '196.201.212.138',
  '196.201.212.69',
  '196.201.212.74',
];

function getClientIp(req: Request): string | null {
  // Prefer X-Forwarded-For (set by load balancer); fall back to socket.
  const xff = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim();
  if (xff) return xff;
  const remote = req.socket?.remoteAddress ?? null;
  if (!remote) return null;
  // Strip IPv6-mapped prefix (::ffff:a.b.c.d).
  return remote.replace(/^::ffff:/, '');
}

export function mpesaIpAllowlistMiddleware(logger: {
  warn: (ctx: unknown, msg: string) => void;
}) {
  const raw = process.env.MPESA_ALLOWED_IPS?.trim();
  const allowed = new Set(
    raw ? raw.split(',').map((ip) => ip.trim()).filter(Boolean) : DEFAULT_ALLOWED_IPS
  );
  // Dev escape hatch — set MPESA_DISABLE_IP_ALLOWLIST=true only for local
  // webhook testing with ngrok/webhook.site.
  const disabled = process.env.MPESA_DISABLE_IP_ALLOWLIST === 'true';

  return (req: Request, res: Response, next: NextFunction) => {
    if (disabled) return next();

    const ip = getClientIp(req);
    if (!ip || !allowed.has(ip)) {
      logger.warn({ ip, path: req.path }, 'M-Pesa callback from non-allowlisted IP');
      // Respond 200 with a non-success body so Safaricom does not retry
      // (they interpret 4xx/5xx as retryable). This matches the pattern
      // used for invalid payloads in the same file.
      res.status(403).json({ ResultCode: 1, ResultDesc: 'Forbidden' });
      return;
    }
    next();
  };
}

// NOTE: The process-local `CallbackDeduplicator` / `mpesaDeduplicator` that
// previously lived here was removed once the durable, tenant-scoped
// idempotency store (`lib/idempotency-store.ts`, wired in `server.ts`)
// replaced it. A `Map` on a single replica cannot dedup across replicas or
// survive a restart, so it was dead code with zero importers. The IP
// allowlist and HMAC signature middleware below are still live.

// ---------------------------------------------------------------------------
// CRITICAL-3: HMAC signature verification for Daraja webhooks
// ---------------------------------------------------------------------------

const SIGNATURE_HEADER = 'x-mpesa-signature';
const TIMESTAMP_HEADER = 'x-mpesa-timestamp';
const REPLAY_WINDOW_MS = 5 * 60 * 1000;

interface MpesaSignatureLogger {
  warn: (ctx: unknown, msg: string) => void;
}

/**
 * Express middleware that verifies an M-Pesa webhook HMAC signature.
 *
 * Behaviour:
 *   - If `MPESA_WEBHOOK_SECRET` is unset and `MPESA_WEBHOOK_SECRET_REQUIRED`
 *     is not `'true'`, signature verification is SKIPPED (sandbox/dev).
 *   - If the secret is set, the request MUST include
 *     `X-Mpesa-Signature: <hex>` and `X-Mpesa-Timestamp: <unix-ms>`.
 *     The signature is computed as
 *     `hex(hmac-sha256(secret, `${timestamp}.${rawBody}`))`.
 *   - The timestamp must be within `REPLAY_WINDOW_MS` of `Date.now()`
 *     (mirrors Inngest's 5-minute window).
 *   - Comparison uses `crypto.timingSafeEqual` (project rule).
 *
 * On failure, responds 401 immediately — NEVER reaches the handler. The
 * response body intentionally returns `{ResultCode: 1, ResultDesc: ...}`
 * so Safaricom's retry behaviour treats the rejection as authoritative
 * rather than retryable.
 */
export function mpesaSignatureMiddleware(logger: MpesaSignatureLogger) {
  const secret = process.env.MPESA_WEBHOOK_SECRET?.trim();
  const required =
    process.env.MPESA_WEBHOOK_SECRET_REQUIRED === 'true' ||
    process.env.NODE_ENV === 'production';

  if (!secret && required) {
    // Fail closed: in production we refuse to mount the route at all.
    throw new Error(
      'MPESA_WEBHOOK_SECRET must be set when running with NODE_ENV=production or MPESA_WEBHOOK_SECRET_REQUIRED=true'
    );
  }

  return (req: Request, res: Response, next: NextFunction): void => {
    if (!secret) {
      // Sandbox / dev — allow through but log so it's visible in logs.
      logger.warn(
        { path: req.path },
        'MPESA_WEBHOOK_SECRET not set; webhook signature verification SKIPPED'
      );
      next();
      return;
    }
    const signature = (req.headers[SIGNATURE_HEADER] as string | undefined)?.trim();
    const timestampRaw = (req.headers[TIMESTAMP_HEADER] as string | undefined)?.trim();
    if (!signature || !timestampRaw) {
      logger.warn(
        { path: req.path, hasSig: !!signature, hasTs: !!timestampRaw },
        'M-Pesa webhook missing signature/timestamp headers'
      );
      res.status(401).json({ ResultCode: 1, ResultDesc: 'Unauthorized' });
      return;
    }
    const timestamp = Number(timestampRaw);
    if (!Number.isFinite(timestamp)) {
      res.status(401).json({ ResultCode: 1, ResultDesc: 'Unauthorized' });
      return;
    }
    const drift = Math.abs(Date.now() - timestamp);
    if (drift > REPLAY_WINDOW_MS) {
      logger.warn(
        { path: req.path, driftMs: drift },
        'M-Pesa webhook timestamp outside replay window'
      );
      res.status(401).json({ ResultCode: 1, ResultDesc: 'Unauthorized' });
      return;
    }
    const raw = req.rawBody;
    if (!raw) {
      logger.warn(
        { path: req.path },
        'M-Pesa webhook raw body not captured; refusing'
      );
      res.status(401).json({ ResultCode: 1, ResultDesc: 'Unauthorized' });
      return;
    }
    const expected = createHmac('sha256', secret)
      .update(`${timestamp}.${raw.toString('utf8')}`)
      .digest('hex');
    let valid = false;
    try {
      const a = Buffer.from(expected, 'hex');
      const b = Buffer.from(signature, 'hex');
      valid = a.length === b.length && timingSafeEqual(a, b);
    } catch {
      valid = false;
    }
    if (!valid) {
      logger.warn({ path: req.path }, 'M-Pesa webhook signature verification failed');
      res.status(401).json({ ResultCode: 1, ResultDesc: 'Unauthorized' });
      return;
    }
    next();
  };
}
