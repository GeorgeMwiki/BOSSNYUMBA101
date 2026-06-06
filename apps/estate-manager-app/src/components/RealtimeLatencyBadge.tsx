/**
 * RT-3 — owner-portal "Live sync" badge.
 *
 * Polls /api/v1/observability/realtime every POLL_INTERVAL_MS and
 * renders the P95 cockpit-event round-trip latency. Tiny, unobtrusive,
 * sits next to the CockpitLivePulse green dot.
 *
 * Colour bands (mirrors the 200ms SLO from the realtime SOTA doc):
 *   - <200ms  : green (inside SLO)
 *   - <500ms  : amber (degraded)
 *   - >=500ms : red (breach)
 *
 * Hides itself entirely when count = 0 (no samples yet, no signal to
 * render). Bilingual sw/en label.
 */

import { useEffect, useState } from 'react';

interface LatencyStats {
  readonly count: number;
  readonly p50: number;
  readonly p95: number;
  readonly p99: number;
  readonly min: number;
  readonly max: number;
  readonly avg: number;
}

const POLL_INTERVAL_MS = 10_000;

function colorForP95(p95: number): string {
  if (p95 < 200) return 'bg-emerald-500/15 text-emerald-700';
  if (p95 < 500) return 'bg-amber-500/15 text-amber-700';
  return 'bg-red-500/15 text-red-700';
}

function getApiBase(): string {
  // Best-effort detection — keeps the badge self-contained without
  // coupling to the project's API client export shape. Uses the
  // app-standard NEXT_PUBLIC_API_URL (Next inlines NEXT_PUBLIC_* at
  // build time); `import.meta` is unavailable under this app's
  // NodeNext/CommonJS compile target.
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (configured) {
    const trimmed = configured.replace(/\/$/, '');
    return trimmed.endsWith('/api/v1') ? trimmed : `${trimmed}/api/v1`;
  }
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:4000/api/v1';
  }
  return '/api/v1';
}

export function RealtimeLatencyBadge({
  language = 'en',
}: {
  readonly language?: 'en' | 'sw';
}): JSX.Element | null {
  const [stats, setStats] = useState<LatencyStats | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    let cancelled = false;

    const fetchOnce = async (): Promise<void> => {
      try {
        const res = await fetch(`${getApiBase()}/observability/realtime`, {
          credentials: 'include',
        });
        if (!res.ok) return;
        const payload = (await res.json()) as {
          success: boolean;
          data: LatencyStats;
        };
        if (!cancelled && payload.success) {
          setStats(payload.data);
        }
      } catch {
        // Best-effort polling; no user-visible error.
      }
    };

    void fetchOnce();
    const interval = setInterval(fetchOnce, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (!stats || stats.count === 0) return null;

  const label = language === 'sw' ? 'Mawasiliano' : 'Live sync';

  return (
    <span
      data-testid="realtime-latency-badge"
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${colorForP95(
        stats.p95,
      )}`}
      title={`P50 ${stats.p50} ms · P95 ${stats.p95} ms · P99 ${stats.p99} ms (n=${stats.count})`}
    >
      <span>{label}:</span>
      <span>P95 = {stats.p95} ms</span>
    </span>
  );
}
