'use client';

import { useEffect, useState } from 'react';
import { ShieldAlert, Sparkles } from 'lucide-react';

/**
 * PlatformBudgetBadge — chrome-level privacy-budget readout.
 *
 * Renders in the page chrome on every page. Calls GET /api/platform/budget
 * on mount and polls every 60 s. Never shows mock numbers:
 *   - 200 with numeric ε → live badge
 *   - 503 / any non-2xx / network error → muted "Budget service offline" chip
 *
 * The DP-accountant is authoritative. This component only displays what
 * the server returns; it never computes or interpolates ε locally.
 */

interface BudgetState {
  readonly status: 'loading' | 'ok' | 'offline';
  readonly remainingEpsilon?: number;
  readonly totalEpsilon?: number;
  readonly windowLabel?: string;
}

const POLL_INTERVAL_MS = 60_000;

async function fetchBudgetOnce(): Promise<BudgetState> {
  try {
    const res = await fetch('/api/platform/budget', {
      cache: 'no-store',
      credentials: 'same-origin',
    });
    if (!res.ok) {
      return { status: 'offline' };
    }
    const data = (await res.json()) as {
      readonly remainingEpsilon?: number;
      readonly totalEpsilon?: number;
      readonly windowLabel?: string;
    };
    if (typeof data.remainingEpsilon !== 'number') {
      return { status: 'offline' };
    }
    return {
      status: 'ok',
      remainingEpsilon: data.remainingEpsilon,
      totalEpsilon: data.totalEpsilon,
      windowLabel: data.windowLabel,
    };
  } catch (error) {
    console.error('PlatformBudgetBadge fetch failed:', error);
    return { status: 'offline' };
  }
}

export function PlatformBudgetBadge() {
  const [state, setState] = useState<BudgetState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const next = await fetchBudgetOnce();
      if (!cancelled) setState(next);
    };
    load();
    const id = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (state.status === 'loading') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs text-neutral-500">
        <Sparkles className="h-3 w-3" />
        Privacy budget loading
      </span>
    );
  }

  if (state.status === 'offline') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs text-neutral-500">
        <ShieldAlert className="h-3 w-3" />
        Budget service offline
      </span>
    );
  }

  const remaining = state.remainingEpsilon ?? 0;
  const total = state.totalEpsilon;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-signal-500/40 bg-signal-500/10 px-3 py-1 text-xs text-signal-500">
      <Sparkles className="h-3 w-3" />
      {remaining.toFixed(2)} ε
      {typeof total === 'number' ? (
        <span className="text-neutral-500">
          / {total.toFixed(2)}
        </span>
      ) : null}
      {state.windowLabel ? (
        <span className="text-neutral-500">· {state.windowLabel}</span>
      ) : null}
    </span>
  );
}
