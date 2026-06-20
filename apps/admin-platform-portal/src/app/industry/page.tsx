import { cookies, headers } from 'next/headers';
import { StaffNav } from '@/components/StaffNav';
import { StaffIdentityStrip } from '@/components/StaffIdentityStrip';
import { DegradedCard } from '@/components/DegradedCard';
import { requirePublicBaseUrl } from '@/lib/env-guard';

const SLOTS = [
  { key: 'arrears-by-jurisdiction', title: 'Arrears by jurisdiction' },
  { key: 'occupancy-by-class', title: 'Occupancy by asset class' },
  { key: 'vendor-reopen-rate', title: 'Vendor reopen rate' },
  { key: 'sentiment-index', title: 'Tenant sentiment index' },
  { key: 'renewal-rate', title: 'Renewal rate' },
  { key: 'maintenance-ttc', title: 'Maintenance TTC' },
] as const;

type SlotKey = (typeof SLOTS)[number]['key'];

interface SlotPayload {
  readonly metric: string;
  readonly value: number | string;
  readonly unit?: string;
}

interface SlotEnvelope {
  readonly success?: boolean;
  readonly data?: SlotPayload;
  readonly error?: { readonly code?: string; readonly message?: string };
}

type SlotResult =
  | { readonly status: 'ok'; readonly data: SlotPayload }
  | { readonly status: 'loading' }
  | { readonly status: 'degraded'; readonly reason: string };

/**
 * Resolve the api-gateway base for server-side (RSC) fetches. The page
 * is a server component, so it talks to the gateway directly instead of
 * round-tripping through the portal's own /api proxy. `API_GATEWAY_URL`
 * is the server-only var; we never expose it to the browser. The
 * localhost fallback is dev-only and the public-URL guard keeps prod
 * loud if the deployer forgets to set it.
 */
function resolveGatewayBase(): string {
  const serverUrl = process.env.API_GATEWAY_URL?.trim();
  if (serverUrl && serverUrl.length > 0) {
    return serverUrl.replace(/\/$/, '');
  }
  return requirePublicBaseUrl(
    'NEXT_PUBLIC_API_URL',
    'http://localhost:4000',
  ).replace(/\/$/, '');
}

async function fetchSlot(
  slot: SlotKey,
  base: string,
  forwardHeaders: HeadersInit,
): Promise<SlotResult> {
  try {
    const res = await fetch(`${base}/api/v1/admin/industry/${slot}`, {
      headers: forwardHeaders,
      cache: 'no-store',
    });
    if (res.status === 401 || res.status === 403) {
      return {
        status: 'degraded',
        reason: 'Not authorised for the platform-HQ industry rollup.',
      };
    }
    if (res.status === 503) {
      return {
        status: 'degraded',
        reason: 'Industry aggregator offline (503). No mock values rendered.',
      };
    }
    if (!res.ok) {
      return {
        status: 'degraded',
        reason: `Upstream returned ${res.status}. Retry when the aggregator is healthy.`,
      };
    }
    const body = (await res.json()) as SlotEnvelope;
    if (!body.success || !body.data) {
      return {
        status: 'degraded',
        reason: body.error?.message ?? 'Metric could not be computed.',
      };
    }
    return { status: 'ok', data: body.data };
  } catch (error) {
    console.error(`Industry slot ${slot} fetch failed:`, error);
    return {
      status: 'degraded',
      reason: 'Aggregator unreachable. No mock values rendered.',
    };
  }
}

export default async function IndustryPage() {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');

  // Forward the platform session cookie + any bearer so the gateway can
  // enforce the platform-HQ role gate upstream. Nothing host-only is
  // copied.
  const incomingHeaders = await headers();
  const forwardHeaders: Record<string, string> = {
    Accept: 'application/json',
  };
  if (cookieHeader) forwardHeaders.cookie = cookieHeader;
  const authorization = incomingHeaders.get('authorization');
  if (authorization) forwardHeaders.Authorization = authorization;

  const base = resolveGatewayBase();

  const slotResults = await Promise.all(
    SLOTS.map(async (slot) => ({
      slot,
      result: await fetchSlot(slot.key, base, forwardHeaders),
    })),
  );

  return (
    <div className="flex min-h-screen">
      <StaffNav />
      <main className="flex-1 p-10">
        <header className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl font-display text-foreground mb-1">
              Industry dashboard
            </h1>
            <p className="text-sm text-neutral-400">
              Six DP-aggregated platform KPIs. Each slot renders live or declares degraded.
            </p>
          </div>
          <StaffIdentityStrip />
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {slotResults.map(({ slot, result }) => {
            if (result.status === 'degraded') {
              return (
                <DegradedCard
                  key={slot.key}
                  title={slot.title}
                  reason={result.reason}
                />
              );
            }
            if (result.status === 'loading') {
              return (
                <div key={slot.key} className="platform-card">
                  <div className="platform-card-title">{slot.title}</div>
                  <div className="text-sm text-neutral-500">Loading…</div>
                </div>
              );
            }
            return (
              <div key={slot.key} className="platform-card">
                <div className="platform-card-title">{slot.title}</div>
                <div className="platform-card-value">
                  {result.data.value}
                  {result.data.unit ? (
                    <span className="text-base text-neutral-500 ml-1">
                      {result.data.unit}
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
