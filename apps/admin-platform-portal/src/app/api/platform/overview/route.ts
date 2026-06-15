import { NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';

import { PLATFORM_SESSION_COOKIE } from '@/lib/session';
import { getApiGatewayBase } from '@/lib/proxy';

/**
 * Platform overview KPI proxy.
 *
 * Forwards GET /api/platform/overview to the api-gateway's
 * /api/v1/platform/overview aggregator, carrying the platform session
 * cookie + Authorization header so HQ-tier auth can be enforced
 * upstream.
 *
 * If the gateway is unreachable (network error, ECONNREFUSED, timeout),
 * we still return 200 with `success: false` + `code = 'GATEWAY_UNREACHABLE'`
 * so the KpiTiles fetcher's em-dash fallback renders cleanly instead of
 * the user seeing a generic "failed to fetch" surface.
 */

export async function GET() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(PLATFORM_SESSION_COOKIE);
  const incomingHeaders = await headers();
  const auth = incomingHeaders.get('authorization');

  const fetchHeaders: Record<string, string> = {
    Accept: 'application/json',
  };
  if (auth) {
    fetchHeaders.Authorization = auth;
  }
  if (sessionCookie?.value) {
    // Forward the platform session cookie verbatim so the gateway (or
    // a future gateway-side identity verifier) can resolve the staff
    // claim from the same cookie the BFF already trusts.
    fetchHeaders.Cookie = `${PLATFORM_SESSION_COOKIE}=${sessionCookie.value}`;
  }

  try {
    // Resolve the gateway base via the shared prod-guarded resolver (throws in
    // production if API_GATEWAY_URL is unset, instead of silently routing to
    // localhost). Resolving at call-time — not module load — keeps this route
    // consistent with every other proxy in lib/proxy.ts. Inside the try so a
    // thrown prod-guard surfaces as GATEWAY_UNREACHABLE (em-dash fallback, the
    // route's degradation contract), never a silent localhost hit or a hard 500.
    const url = `${getApiGatewayBase().replace(/\/$/, '')}/api/v1/platform/overview`;
    const upstream = await fetch(url, {
      method: 'GET',
      headers: fetchHeaders,
      cache: 'no-store',
    });

    // Mirror upstream status codes 200 / 401 / 403. For any other
    // status we still pass through so the client can react.
    const text = await upstream.text();
    let body: unknown = null;
    try {
      body = text.length > 0 ? JSON.parse(text) : null;
    } catch {
      body = null;
    }

    if (body !== null) {
      return NextResponse.json(body, { status: upstream.status });
    }
    return NextResponse.json(
      { success: false, error: { code: 'UPSTREAM_EMPTY', message: 'gateway returned an empty body' } },
      { status: upstream.status === 0 ? 502 : upstream.status },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'gateway fetch failed';
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'GATEWAY_UNREACHABLE',
          message,
        },
      },
      // 200 is intentional — the frontend KPI fetcher distinguishes
      // success/failure via `success: false`, and a 5xx would short-
      // circuit before we get there.
      { status: 200 },
    );
  }
}
