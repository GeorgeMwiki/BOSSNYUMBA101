/**
 * POST /api/platform/intelligence/thread/:threadId/message
 *
 * Central-Command AG-UI wire proxy. Forwards the request to the
 * api-gateway's `POST /api/v1/admin/jarvis/stream` route and pipes the
 * upstream `text/event-stream` body back to the browser unchanged.
 *
 * Auth: cookies (platform-session httpOnly) are forwarded via `cookie`
 * header; an optional bearer token in the inbound `Authorization`
 * header is forwarded as-is. The gateway enforces the SUPER_ADMIN /
 * ADMIN role gate — this proxy is permissive on purpose.
 *
 * Body: `{ message, presence?, extendedThinking?, slice? }`. The
 * threadId comes from the URL. The `extendedThinking` toggle and the
 * `slice` selector (jurisdiction / property-class / time-window) are
 * threaded through to the upstream so the operator's controls take
 * effect rather than being silently dropped at the proxy boundary.
 * Anything else the caller supplies is ignored — we re-serialise into
 * the AG-UI request shape the gateway expects.
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
// SSE proxies must stay long-lived; the Next 15 default is 10s.
export const maxDuration = 300;

interface RouteContext {
  readonly params: Promise<{ readonly threadId: string }>;
}

interface IncomingBody {
  readonly message?: unknown;
  readonly presence?: unknown;
  readonly extendedThinking?: unknown;
  readonly slice?: unknown;
}

/**
 * The `slice` selector the composer sends — jurisdiction, property
 * class, and time window. Each is a short string code (e.g. `KE-30`,
 * `Class-B`, `90d`). We forward only string-valued fields and cap the
 * length so a misbehaving client can't balloon the upstream body.
 */
interface SlicePayload {
  readonly jurisdiction?: string;
  readonly propertyClass?: string;
  readonly timeWindow?: string;
}

const MAX_SLICE_FIELD = 64;

function asBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function sanitiseSlice(value: unknown): SlicePayload | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const out: { jurisdiction?: string; propertyClass?: string; timeWindow?: string } = {};
  for (const key of ['jurisdiction', 'propertyClass', 'timeWindow'] as const) {
    const v = raw[key];
    if (typeof v === 'string' && v.length > 0 && v.length <= MAX_SLICE_FIELD) {
      out[key] = v;
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

function getGatewayBase(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (configured) {
    const trimmed = configured.replace(/\/$/, '');
    return trimmed.endsWith('/api/v1') ? trimmed : `${trimmed}/api/v1`;
  }
  return process.env.NODE_ENV === 'production'
    ? '/api/v1'
    : 'http://localhost:4000/api/v1';
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * Forward the relevant inbound headers without leaking host-only ones.
 * We keep `authorization`, `cookie`, and any AG-UI client trace
 * identifiers; we drop `host`, `content-length` (will be rebuilt),
 * `connection`, and the standard hop-by-hop set.
 */
function forwardHeaders(req: NextRequest): Headers {
  const out = new Headers();
  const forwardable = ['authorization', 'cookie', 'x-request-id', 'x-trace-id'];
  for (const key of forwardable) {
    const value = req.headers.get(key);
    if (value) out.set(key, value);
  }
  out.set('Content-Type', 'application/json');
  out.set('Accept', 'text/event-stream');
  return out;
}

export async function POST(
  req: NextRequest,
  context: RouteContext,
): Promise<Response> {
  const params = await context.params;
  const threadId = asString(params.threadId);
  if (!threadId) {
    return NextResponse.json(
      { error: 'threadId required' },
      { status: 400 },
    );
  }

  let body: IncomingBody;
  try {
    body = (await req.json()) as IncomingBody;
  } catch {
    return NextResponse.json(
      { error: 'JSON body required' },
      { status: 400 },
    );
  }

  const message = asString(body.message);
  if (!message) {
    return NextResponse.json(
      { error: 'message is required' },
      { status: 400 },
    );
  }

  const extendedThinking = asBoolean(body.extendedThinking);
  const slice = sanitiseSlice(body.slice);

  // Carry the operator's slice into the presence packet's forward-
  // compatible `extra` bag too: the gateway's presence schema accepts
  // it today (so the audit trail records the population the operator
  // was reasoning over) while the top-level `slice`/`extendedThinking`
  // fields below let the upstream act on the controls once it grows
  // first-class support for them.
  const inboundPresence =
    body.presence && typeof body.presence === 'object'
      ? (body.presence as Record<string, unknown>)
      : undefined;
  const presence =
    inboundPresence || slice
      ? {
          ...(inboundPresence ?? {}),
          ...(slice
            ? {
                extra: {
                  ...((inboundPresence?.extra &&
                  typeof inboundPresence.extra === 'object'
                    ? (inboundPresence.extra as Record<string, unknown>)
                    : {}) as Record<string, unknown>),
                  slice,
                },
              }
            : {}),
        }
      : undefined;

  const upstreamBody = JSON.stringify({
    threadId,
    message,
    ...(presence ? { presence } : {}),
    ...(extendedThinking !== null ? { extendedThinking } : {}),
    ...(slice ? { slice } : {}),
  });

  const upstreamUrl = `${getGatewayBase()}/admin/jarvis/stream`;
  const headers = forwardHeaders(req);

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      method: 'POST',
      headers,
      body: upstreamBody,
      // Forward the inbound abort signal so the kernel iterator stops
      // when the operator closes the tab.
      signal: req.signal,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'gateway unreachable';
    return NextResponse.json(
      { error: 'gateway-unreachable', detail },
      { status: 502 },
    );
  }

  // Non-2xx — forward the gateway envelope verbatim. The browser SSE
  // client tolerates an error body since we never opened the stream.
  if (!upstream.ok) {
    const text = await upstream.text().catch(() => '');
    return new Response(text || JSON.stringify({ error: 'upstream-error' }), {
      status: upstream.status,
      headers: {
        'Content-Type':
          upstream.headers.get('content-type') ?? 'application/json',
      },
    });
  }

  // Happy path — pipe the SSE body through. Re-emit the headers the
  // browser SSE client expects (Cache-Control, X-Accel-Buffering).
  return new Response(upstream.body, {
    status: 200,
    headers: {
      'Content-Type':
        upstream.headers.get('content-type') ?? 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
