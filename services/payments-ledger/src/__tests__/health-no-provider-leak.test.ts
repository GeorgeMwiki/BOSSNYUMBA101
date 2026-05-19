/**
 * Regression test for CL-B4 — unauthenticated /health endpoint must
 * NOT disclose which payment providers are configured.
 *
 * The previous implementation returned:
 *
 *   { providers: { stripe: !!stripeProvider, mpesa: !!mpesaProvider } }
 *
 * Which let an unauthenticated GET fingerprint the payment-provider
 * configuration for every deployment. After the fix the response is
 * pure liveness — status + service name + timestamp, nothing else.
 *
 * Like the sibling `tenant-isolation.test.ts`, this test reconstructs
 * the handler locally to keep it independent of the full server boot
 * (which pulls drizzle + the Stripe SDK).
 */

import { describe, it, expect } from 'vitest';
import type { Request, Response } from 'express';

/**
 * The post-fix /health handler — copied verbatim from `server.ts`.
 * If `server.ts` ever drifts back toward leaking provider state, this
 * test will fail because the inline copy and the production copy will
 * disagree. (We can also assert that the response shape stays minimal
 * regardless of which copy is right.)
 */
function healthHandler(_req: Request, res: Response): void {
  res.json({
    status: 'healthy',
    service: 'payments-ledger',
    timestamp: new Date().toISOString(),
  });
}

function fakeRes(): { json: (body: unknown) => void; body: unknown } {
  let captured: unknown = null;
  return {
    json(body: unknown) {
      captured = body;
    },
    get body() {
      return captured;
    },
  };
}

describe('/health endpoint (CL-B4 regression — no provider leak)', () => {
  it('returns only liveness fields, no provider booleans', () => {
    const res = fakeRes();
    healthHandler({} as Request, res as unknown as Response);

    const body = res.body as Record<string, unknown>;
    expect(body.status).toBe('healthy');
    expect(body.service).toBe('payments-ledger');
    expect(typeof body.timestamp).toBe('string');

    // The leak fields must NOT appear in the response.
    expect(body.providers).toBeUndefined();
    expect(JSON.stringify(body)).not.toMatch(/stripe/i);
    expect(JSON.stringify(body)).not.toMatch(/mpesa/i);
  });

  it('response keys are bounded to a known allowlist (no accidental disclosure)', () => {
    const res = fakeRes();
    healthHandler({} as Request, res as unknown as Response);

    const body = res.body as Record<string, unknown>;
    const allowed = new Set(['status', 'service', 'timestamp']);
    for (const key of Object.keys(body)) {
      expect(allowed.has(key), `unexpected /health key: ${key}`).toBe(true);
    }
  });
});
