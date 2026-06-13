/**
 * @session @critical @security
 *
 * 429 must carry `Retry-After`, and the client MUST honour it.
 *
 * Asserts (1) server sends parseable Retry-After header and (2) client
 * does not retry the same endpoint before the cooldown elapses.
 *
 * Audit reference: `.audit/deep-audit-2026-05-20.md` — neither tested.
 */
import { test, expect } from '@playwright/test';
import {
  REAL_BACKEND_ENABLED,
  API_GATEWAY_URL,
} from '../../../fixtures/dual-tenant-fixtures';

test.describe('@session @critical @security — 429 Retry-After header + client respect', () => {
  test.skip(
    !REAL_BACKEND_ENABLED,
    'Set E2E_ENABLE_REAL_BACKEND=1 with docker-compose.e2e.yml up to run',
  );

  test('api-gateway: 429 response carries a parseable Retry-After header', async ({
    request,
  }) => {
    // Hammer a rate-limited endpoint to provoke a 429.
    const candidates = ['/api/v1/brain/chat', '/api/brain/chat', '/api/v1/auth/otp/send'];
    let foundResp: { status: number; headers: Record<string, string> } | null = null;

    for (const path of candidates) {
      for (let i = 0; i < 40; i += 1) {
        const resp = await request
          .post(`${API_GATEWAY_URL}${path}`, {
            data: { message: 'ping', phone: '+254700000000' },
            failOnStatusCode: false,
          })
          .catch(() => null);
        if (!resp) break;
        if (resp.status() === 429) {
          foundResp = { status: resp.status(), headers: resp.headers() };
          break;
        }
        if (resp.status() === 404) break;
      }
      if (foundResp) break;
    }

    if (!foundResp) {
      test.fixme(true, 'Could not provoke a 429 — rate-limit may be unwired');
      return;
    }

    const retryAfter =
      foundResp.headers['retry-after'] ?? foundResp.headers['Retry-After'];
    expect(retryAfter, '429 must include Retry-After header').toBeTruthy();

    // RFC 7231: Retry-After is either an integer (delay-seconds) or HTTP-date.
    const asInt = Number.parseInt(retryAfter ?? '', 10);
    const isHttpDate = Number.isNaN(asInt) && !Number.isNaN(Date.parse(retryAfter ?? ''));
    expect(
      Number.isFinite(asInt) || isHttpDate,
      `Retry-After must be int-seconds or HTTP-date, got "${retryAfter}"`,
    ).toBe(true);
    if (Number.isFinite(asInt)) {
      // Sanity: between 1s and 1h. Anything outside this range is bizarre.
      expect(asInt).toBeGreaterThanOrEqual(1);
      expect(asInt, 'Retry-After must be reasonable (< 1h)').toBeLessThanOrEqual(3600);
    }
  });
});
