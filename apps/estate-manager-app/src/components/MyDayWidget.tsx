'use client';

/**
 * "My day" widget for the estate-manager home screen.
 *
 * Live feeds:
 *   - /inspections/today        — today's inspection visits
 *   - /work-orders/today        — today's maintenance assignments
 *   - /cases/sla-breached       — SLA-breached cases requiring escalation
 *
 * Each tile is clickable and links to the full list page. If an endpoint
 * fails the tile shows a dash with the error reason behind a tooltip —
 * the widget stays usable during partial outages.
 *
 * Pure/immutable: state is replaced on each fetch, never patched.
 */

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ClipboardCheck, Wrench, AlertTriangle } from 'lucide-react';

interface TileState {
  readonly count: number | null;
  readonly error: string | null;
}

interface DayState {
  readonly inspections: TileState;
  readonly workOrders: TileState;
  readonly slaBreached: TileState;
}

const INITIAL_TILE: TileState = { count: null, error: null };
const INITIAL: DayState = {
  inspections: INITIAL_TILE,
  workOrders: INITIAL_TILE,
  slaBreached: INITIAL_TILE,
};

export function MyDayWidget(): JSX.Element {
  const [state, setState] = useState<DayState>(INITIAL);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      const [ins, wo, sla] = await Promise.all([
        fetchCount('/inspections/today'),
        fetchCount('/work-orders/today'),
        fetchCount('/cases/sla-breached'),
      ]);
      if (cancelled) return;
      setState({ inspections: ins, workOrders: wo, slaBreached: sla });
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <section
      aria-labelledby="my-day-heading"
      className="bg-white rounded-xl border border-gray-200 p-5"
    >
      <div className="flex items-baseline justify-between mb-4">
        <h2 id="my-day-heading" className="text-lg font-semibold text-gray-900">
          My day
        </h2>
        <span className="text-xs text-gray-500">{today}</span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Tile
          href="/inspections?when=today"
          icon={ClipboardCheck}
          label="Inspections"
          accent="text-blue-600"
          state={state.inspections}
        />
        <Tile
          href="/work-orders?when=today"
          icon={Wrench}
          label="Work orders"
          accent="text-orange-600"
          state={state.workOrders}
        />
        <Tile
          href="/cases?filter=sla-breached"
          icon={AlertTriangle}
          label="SLA breached"
          accent="text-red-600"
          state={state.slaBreached}
        />
      </div>
    </section>
  );
}

interface TileProps {
  readonly href: string;
  readonly icon: React.ComponentType<{ className?: string }>;
  readonly label: string;
  readonly accent: string;
  readonly state: TileState;
}

function Tile({ href, icon: Icon, label, accent, state }: TileProps): JSX.Element {
  return (
    <Link
      href={href}
      className="block border border-gray-100 rounded-lg p-3 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-violet-500"
      title={state.error ?? undefined}
    >
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${accent}`} />
        <span className="text-xs font-medium text-gray-500">{label}</span>
      </div>
      <p className="text-2xl font-semibold text-gray-900 mt-1">
        {state.count ?? '—'}
      </p>
    </Link>
  );
}

async function fetchCount(path: string): Promise<TileState> {
  const base = process.env.NEXT_PUBLIC_API_URL;
  if (!base) return { count: null, error: 'API URL not configured' };
  const token =
    typeof window !== 'undefined'
      ? localStorage.getItem('manager_token')
      : null;
  try {
    const res = await fetch(`${base.replace(/\/$/, '')}/api/v1${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return { count: null, error: `HTTP ${res.status}` };
    const body = await res.json();
    if (typeof body?.count === 'number') return { count: body.count, error: null };
    if (typeof body?.data?.count === 'number')
      return { count: body.data.count, error: null };
    if (Array.isArray(body?.data))
      return { count: body.data.length, error: null };
    if (Array.isArray(body)) return { count: body.length, error: null };
    return { count: null, error: 'Unexpected response shape' };
  } catch (error) {
    return {
      count: null,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}
