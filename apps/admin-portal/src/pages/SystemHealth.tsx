/**
 * SystemHealth — Wave-12 internal ops dashboard.
 *
 * Polls GET /api/v1/metrics every 5s and renders the key operational
 * gauges the on-call team needs at a glance:
 *   - events/sec across hot surfaces (ai-chat, brain, mcp, voice)
 *   - average LLM latency (p50, p95)
 *   - today's spend (summed from brain.turn.cost_usd_micro counter)
 *   - active brain personas + heartbeat last-tick-ago
 *   - junior brain sleep count
 *   - circuit-breaker state per named breaker
 *   - background-task success rate
 *
 * No charts library — plain numbers in cards. This is deliberately
 * low-dependency; a richer viz layer can replace the card grid later.
 */

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

interface CounterSnapshot {
  name: string;
  description: string;
  value: number;
  labels: Record<string, string>;
}

interface GaugeSnapshot {
  name: string;
  description: string;
  value: number;
  labels: Record<string, string>;
}

interface HistogramSnapshot {
  name: string;
  description: string;
  count: number;
  sum: number;
  p50: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
  labels: Record<string, string>;
}

interface MetricsSnapshot {
  collectedAt: string;
  uptimeSeconds: number;
  counters: CounterSnapshot[];
  gauges: GaugeSnapshot[];
  histograms: HistogramSnapshot[];
}

interface FetchState {
  readonly status: 'idle' | 'loading' | 'ok' | 'error';
  readonly snapshot: MetricsSnapshot | null;
  readonly error: string | null;
  readonly lastFetchedAt: number | null;
}

const POLL_INTERVAL_MS = 5000;
const METRICS_ENDPOINT = '/api/v1/metrics';

function sumCounter(snap: MetricsSnapshot, name: string): number {
  return snap.counters
    .filter((c) => c.name === name)
    .reduce((acc, c) => acc + c.value, 0);
}

function histogramByName(snap: MetricsSnapshot, name: string): HistogramSnapshot | null {
  const all = snap.histograms.filter((h) => h.name === name);
  if (all.length === 0) return null;
  // Merge across labels — weighted average for percentiles is imprecise
  // but good enough for a glance dashboard.
  const count = all.reduce((a, h) => a + h.count, 0);
  if (count === 0) return null;
  const sum = all.reduce((a, h) => a + h.sum, 0);
  const p50 = all.reduce((a, h) => a + h.p50 * h.count, 0) / count;
  const p95 = all.reduce((a, h) => a + h.p95 * h.count, 0) / count;
  const p99 = all.reduce((a, h) => a + h.p99 * h.count, 0) / count;
  const min = Math.min(...all.map((h) => h.min));
  const max = Math.max(...all.map((h) => h.max));
  return {
    name,
    description: all[0].description,
    count,
    sum,
    p50,
    p95,
    p99,
    min,
    max,
    labels: {},
  };
}

function gaugeByName(snap: MetricsSnapshot, name: string): GaugeSnapshot | null {
  const match = snap.gauges.find((g) => g.name === name);
  return match ?? null;
}

function formatUsd(micro: number): string {
  return `$${(micro / 1_000_000).toFixed(2)}`;
}

function formatMs(v: number | null): string {
  if (v === null) return 'n/a';
  return `${v.toFixed(0)} ms`;
}

function breakerStateLabel(n: number): string {
  if (n === 0) return 'closed';
  if (n === 1) return 'half-open';
  return 'open';
}

interface CardProps {
  readonly title: string;
  readonly value: string;
  readonly sub?: string;
  readonly tone?: 'ok' | 'warn' | 'bad';
}

function Card({ title, value, sub, tone = 'ok' }: CardProps) {
  const bg =
    tone === 'bad'
      ? '#fdecea'
      : tone === 'warn'
        ? '#fff8e1'
        : '#eef6ff';
  const border =
    tone === 'bad'
      ? '#e57373'
      : tone === 'warn'
        ? '#ffb74d'
        : '#90caf9';
  return (
    <div
      data-testid={`health-card-${title.toLowerCase().replace(/\s+/g, '-')}`}
      style={{
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 8,
        padding: 16,
        minWidth: 200,
        flex: '1 1 200px',
      }}
    >
      <div style={{ fontSize: 12, color: '#666', textTransform: 'uppercase' }}>{title}</div>
      <div style={{ fontSize: 28, fontWeight: 600, marginTop: 4 }}>{value}</div>
      {sub ? <div style={{ fontSize: 12, color: '#555', marginTop: 4 }}>{sub}</div> : null}
    </div>
  );
}

export function SystemHealth() {
  const t = useTranslations('systemHealth');
  const [state, setState] = useState<FetchState>({
    status: 'idle',
    snapshot: null,
    error: null,
    lastFetchedAt: null,
  });

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;
      setState((prev) => ({ ...prev, status: prev.snapshot ? 'ok' : 'loading' }));
      try {
        const token = localStorage.getItem('token') ?? '';
        const res = await fetch(METRICS_ENDPOINT, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) {
          throw new Error(`Metrics endpoint returned ${res.status}`);
        }
        const body = (await res.json()) as { success: boolean; data?: MetricsSnapshot };
        if (!body.success || !body.data) {
          throw new Error('Metrics endpoint returned an unexpected envelope');
        }
        if (cancelled) return;
        setState({
          status: 'ok',
          snapshot: body.data,
          error: null,
          lastFetchedAt: Date.now(),
        });
      } catch (err) {
        if (cancelled) return;
        setState((prev) => ({
          status: 'error',
          snapshot: prev.snapshot,
          error: err instanceof Error ? err.message : 'unknown',
          lastFetchedAt: prev.lastFetchedAt,
        }));
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    tick();
    const handle = window.setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(handle);
    };
  }, []);

  const derived = useMemo(() => {
    if (!state.snapshot) return null;
    const snap = state.snapshot;
    const turns = sumCounter(snap, 'brain.turn.total');
    const costMicro = sumCounter(snap, 'brain.turn.cost_usd_micro.total');
    const errors = sumCounter(snap, 'brain.turn.error.total');
    const streamEvents = sumCounter(snap, 'stream.event.total');
    const bgSuccess = sumCounter(snap, 'bg.task.success.total');
    const bgFailure = sumCounter(snap, 'bg.task.failure.total');
    const bgTotal = bgSuccess + bgFailure;
    const bgRate = bgTotal === 0 ? null : (bgSuccess / bgTotal) * 100;
    const latencyHist = histogramByName(snap, 'brain.turn.latency_ms');
    const activePersonas = gaugeByName(snap, 'heartbeat.active_personas');
    const lastTickAgo = gaugeByName(snap, 'heartbeat.last_tick_ago_ms');
    const sleepCount = gaugeByName(snap, 'heartbeat.junior_sleep_count');
    const breakerGauges = snap.gauges.filter((g) => g.name === 'circuit.breaker.state');
    const uptimeMinutes = Math.floor(snap.uptimeSeconds / 60);
    const eventsPerSecond =
      snap.uptimeSeconds === 0 ? 0 : streamEvents / snap.uptimeSeconds;
    return {
      turns,
      errors,
      costMicro,
      streamEvents,
      bgSuccess,
      bgFailure,
      bgRate,
      latencyHist,
      activePersonas,
      lastTickAgo,
      sleepCount,
      breakerGauges,
      uptimeMinutes,
      eventsPerSecond,
    };
  }, [state.snapshot]);

  return (
    <div data-testid="system-health-root" style={{ padding: 24, fontFamily: 'system-ui' }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>{t('title')}</h1>
        <p style={{ margin: '4px 0', color: '#555' }}>
          {t('subtitle')}
        </p>
        <p data-testid="system-health-status" style={{ fontSize: 12, color: '#888' }}>
          Status: {state.status}
          {state.lastFetchedAt
            ? ` — last poll ${Math.floor((Date.now() - state.lastFetchedAt) / 1000)}s ago`
            : ''}
          {state.error ? ` — error: ${state.error}` : ''}
        </p>
      </header>

      {!derived ? (
        <div data-testid="system-health-empty">{t('loading')}</div>
      ) : (
        <>
          <section
            data-testid="system-health-primary-cards"
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 12,
              marginBottom: 24,
            }}
          >
            <Card
              title={t('cards.uptime')}
              value={`${derived.uptimeMinutes} min`}
              sub={t('cards.uptimeSub')}
            />
            <Card
              title={t('cards.eventsPerSec')}
              value={derived.eventsPerSecond.toFixed(2)}
              sub={t('cards.eventsSub', { count: derived.streamEvents })}
            />
            <Card
              title={t('cards.latency')}
              value={formatMs(derived.latencyHist?.p50 ?? null)}
              sub={`p95 ${formatMs(derived.latencyHist?.p95 ?? null)} / p99 ${formatMs(derived.latencyHist?.p99 ?? null)}`}
            />
            <Card
              title={t('cards.dailyCost')}
              value={formatUsd(derived.costMicro)}
              sub={t('cards.costSub', { turns: derived.turns, errors: derived.errors })}
              tone={derived.errors > 0 ? 'warn' : 'ok'}
            />
            <Card
              title={t('cards.activePersonas')}
              value={String(derived.activePersonas?.value ?? 'n/a')}
            />
            <Card
              title={t('cards.heartbeat')}
              value={formatMs(derived.lastTickAgo?.value ?? null)}
              tone={
                (derived.lastTickAgo?.value ?? 0) > 30_000
                  ? 'bad'
                  : (derived.lastTickAgo?.value ?? 0) > 10_000
                    ? 'warn'
                    : 'ok'
              }
            />
            <Card
              title={t('cards.juniorAsleep')}
              value={String(derived.sleepCount?.value ?? 'n/a')}
            />
            <Card
              title={t('cards.bgSuccessRate')}
              value={derived.bgRate === null ? 'n/a' : `${derived.bgRate.toFixed(1)}%`}
              sub={t('cards.bgSub', { ok: derived.bgSuccess, failed: derived.bgFailure })}
              tone={
                derived.bgRate !== null && derived.bgRate < 80
                  ? 'bad'
                  : derived.bgRate !== null && derived.bgRate < 95
                    ? 'warn'
                    : 'ok'
              }
            />
          </section>

          <section
            data-testid="system-health-breakers"
            style={{ marginBottom: 24 }}
          >
            <h2 style={{ fontSize: 18, marginBottom: 8 }}>{t('breakers')}</h2>
            {derived.breakerGauges.length === 0 ? (
              <p style={{ color: '#888' }}>{t('noBreakers')}</p>
            ) : (
              <ul>
                {derived.breakerGauges.map((g) => {
                  const breakerName = g.labels.breaker ?? 'unknown';
                  const label = breakerStateLabel(g.value);
                  return (
                    <li
                      key={`${breakerName}`}
                      data-testid={`breaker-${breakerName}`}
                      style={{ marginBottom: 4 }}
                    >
                      <strong>{breakerName}:</strong> {label}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <details style={{ fontSize: 12, color: '#555' }}>
            <summary>{t('rawSnapshot')}</summary>
            <pre data-testid="system-health-raw">
              {JSON.stringify(state.snapshot, null, 2)}
            </pre>
          </details>
        </>
      )}
    </div>
  );
}

export default SystemHealth;
