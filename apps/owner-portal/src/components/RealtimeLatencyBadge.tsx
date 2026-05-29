/**
 * M-1 — owner cockpit "Live sync" badge (ported from Borjie RT-3).
 *
 * Polls /api/v1/observability/realtime every POLL_INTERVAL_MS and
 * renders the P95 cockpit-event round-trip latency. Tiny, unobtrusive,
 * sits in the owner-portal Layout header next to the locale switcher.
 *
 * Colour bands (mirrors the 200ms SLO from
 * Docs/OPS/SLO_ATTESTATION_BOSSNYUMBA.md):
 *   - <200ms : green (inside SLO)
 *   - <500ms : amber (degraded)
 *   - >=500ms: red (breach)
 *
 * Hides itself entirely when count = 0 (no samples yet, no signal to
 * render). Bilingual sw/en label.
 *
 * Vite SPA (no 'use client' directive needed — the entire bundle is
 * client-side).
 *
 * Mount in apps/owner-portal/src/components/Layout.tsx header next to
 * <LocaleSwitcher /> to surface in every authenticated owner screen.
 */

import { useEffect, useState } from 'react';

import { api } from '../lib/api';

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

function colorClassForP95(p95: number): string {
  if (p95 < 200) return 'bg-green-100 text-green-800';
  if (p95 < 500) return 'bg-amber-100 text-amber-800';
  return 'bg-red-100 text-red-800';
}

interface RealtimeLatencyBadgeProps {
  readonly language?: 'en' | 'sw';
}

export function RealtimeLatencyBadge({
  language = 'en',
}: RealtimeLatencyBadgeProps): JSX.Element | null {
  const [stats, setStats] = useState<LatencyStats | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    let cancelled = false;

    const fetchOnce = async (): Promise<void> => {
      try {
        const payload = await api.get<LatencyStats>('/observability/realtime');
        if (!cancelled && payload.success && payload.data) {
          setStats(payload.data);
        }
      } catch {
        // Best-effort polling. Surface no error to the user — the badge
        // simply hides itself if the endpoint is unreachable.
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
  const tooltip = `P50 ${stats.p50} ms · P95 ${stats.p95} ms · P99 ${stats.p99} ms (n=${stats.count})`;

  return (
    <span
      data-testid="realtime-latency-badge"
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${colorClassForP95(
        stats.p95,
      )}`}
      title={tooltip}
    >
      <span>{label}:</span>
      <span>P95 = {stats.p95} ms</span>
    </span>
  );
}
