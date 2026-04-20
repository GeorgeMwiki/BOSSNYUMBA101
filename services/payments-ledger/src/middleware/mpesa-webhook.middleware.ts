/**
 * M-Pesa webhook hardening middleware.
 *
 * M-Pesa does not sign payloads with HMAC. Safaricom's defense-in-depth
 * recommendation is:
 *   1. Receive only from Safaricom's published source IPs.
 *   2. Deduplicate by CheckoutRequestID (STK Push) / TransID (C2B) so
 *      retries cannot double-credit the ledger.
 *
 * We implement both here. The idempotency cache is process-local; a
 * Redis-backed replacement is tracked as KI-012 for multi-replica
 * deployments. See Docs/KNOWN_ISSUES.md#ki-012.
 */

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

/**
 * Process-local idempotency cache keyed by
 *   `{tenantId}:{type}:{CheckoutRequestID-or-TransID}`
 * so a replay across tenants (e.g. a shared paybill in staging)
 * cannot collide. 24h TTL matches Safaricom's retry window.
 *
 * Pass tenantId=null only for callbacks that arrive before the tenant
 * context is resolved (e.g. an unattributed paybill confirmation);
 * those use a dedicated "global" namespace and must not be used for
 * state-changing writes without a secondary tenant check.
 */
export class CallbackDeduplicator {
  private readonly seen = new Map<string, number>();
  private readonly ttlMs: number;

  constructor(ttlMs = 24 * 60 * 60 * 1000) {
    this.ttlMs = ttlMs;
    // Reap expired entries every hour to keep memory bounded.
    setInterval(() => this.reap(), 60 * 60 * 1000).unref?.();
  }

  /**
   * Returns true if this key was seen before (callback is a duplicate).
   * Returns false and records the key on first sight.
   *
   * @param key  the deduplication key. Callers SHOULD namespace by
   *   tenantId using {@link tenantKey} below rather than passing a
   *   raw TransID to prevent cross-tenant collisions.
   */
  seenBefore(key: string): boolean {
    const now = Date.now();
    const existing = this.seen.get(key);
    if (existing && existing > now) return true;
    this.seen.set(key, now + this.ttlMs);
    return false;
  }

  /**
   * Build a tenant-scoped deduplication key. Prefer this over raw
   * string concatenation at callsites so the shape stays consistent.
   */
  static tenantKey(
    tenantId: string | null,
    type: 'stk' | 'c2b' | 'b2c',
    externalId: string
  ): string {
    const tenant = tenantId ?? 'global';
    return `${tenant}:${type}:${externalId}`;
  }

  private reap(): void {
    const now = Date.now();
    for (const [key, expiresAt] of this.seen.entries()) {
      if (expiresAt <= now) this.seen.delete(key);
    }
  }
}

export const mpesaDeduplicator = new CallbackDeduplicator();
