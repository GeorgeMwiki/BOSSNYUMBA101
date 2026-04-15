/**
 * Prometheus exposition-format exporter.
 *
 * Lightweight, dependency-free renderer that converts OpenTelemetry-style
 * counter / gauge / histogram samples into Prometheus text format.
 * Designed for use behind a `/metrics` HTTP endpoint; a host application
 * collects samples from {@link PlatformMetrics} or custom meters and feeds
 * them through {@link renderPrometheus}.
 */

export type PrometheusMetricType = 'counter' | 'gauge' | 'histogram';

export interface PrometheusSample {
  /** Metric name (must already be Prometheus-safe, e.g. `http_requests_total`). */
  readonly name: string;
  readonly type: PrometheusMetricType;
  readonly help?: string;
  readonly labels?: Record<string, string>;
  /** For counter/gauge. */
  readonly value?: number;
  /**
   * For histograms: upper-bound buckets, sum, and count.
   * Each bucket has cumulative count at that `le` (less-or-equal) upper bound.
   */
  readonly buckets?: ReadonlyArray<{ le: number | '+Inf'; count: number }>;
  readonly sum?: number;
  readonly count?: number;
}

/**
 * Content-Type used by Prometheus text format 0.0.4.
 */
export const PROMETHEUS_CONTENT_TYPE =
  'text/plain; version=0.0.4; charset=utf-8';

/**
 * Render a set of samples to Prometheus exposition format text.
 * Metric `# HELP` and `# TYPE` lines are emitted once per metric name.
 */
export function renderPrometheus(samples: readonly PrometheusSample[]): string {
  const byName = new Map<string, PrometheusSample[]>();
  for (const s of samples) {
    let bucket = byName.get(s.name);
    if (!bucket) {
      bucket = [];
      byName.set(s.name, bucket);
    }
    bucket.push(s);
  }

  const lines: string[] = [];
  for (const [name, group] of byName) {
    const first = group[0];
    if (first.help) {
      lines.push(`# HELP ${name} ${escapeHelp(first.help)}`);
    }
    lines.push(`# TYPE ${name} ${first.type}`);
    for (const s of group) {
      if (s.type === 'histogram') {
        lines.push(...renderHistogram(s));
      } else {
        lines.push(`${name}${formatLabels(s.labels)} ${formatNumber(s.value ?? 0)}`);
      }
    }
  }
  return lines.join('\n') + '\n';
}

function renderHistogram(s: PrometheusSample): string[] {
  const out: string[] = [];
  const baseLabels = s.labels ?? {};
  for (const b of s.buckets ?? []) {
    const labels = { ...baseLabels, le: b.le === '+Inf' ? '+Inf' : String(b.le) };
    out.push(`${s.name}_bucket${formatLabels(labels)} ${formatNumber(b.count)}`);
  }
  out.push(
    `${s.name}_sum${formatLabels(baseLabels)} ${formatNumber(s.sum ?? 0)}`
  );
  out.push(
    `${s.name}_count${formatLabels(baseLabels)} ${formatNumber(s.count ?? 0)}`
  );
  return out;
}

function formatLabels(labels?: Record<string, string>): string {
  if (!labels) return '';
  const entries = Object.entries(labels).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return '';
  const parts = entries.map(
    ([k, v]) => `${k}="${escapeLabelValue(String(v))}"`
  );
  return `{${parts.join(',')}}`;
}

function escapeLabelValue(v: string): string {
  return v.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/"/g, '\\"');
}

function escapeHelp(v: string): string {
  return v.replace(/\\/g, '\\\\').replace(/\n/g, '\\n');
}

function formatNumber(n: number): string {
  if (!Number.isFinite(n)) {
    if (Number.isNaN(n)) return 'NaN';
    return n > 0 ? '+Inf' : '-Inf';
  }
  return String(n);
}

/**
 * In-memory Prometheus registry. Supports increment/observe for use when
 * an OTel exporter is not wired or when a pure Prometheus surface is desired.
 */
export class PrometheusRegistry {
  private readonly counters = new Map<string, CounterEntry>();
  private readonly gauges = new Map<string, GaugeEntry>();
  private readonly histograms = new Map<string, HistogramEntry>();

  counter(name: string, help?: string): CounterHandle {
    let entry = this.counters.get(name);
    if (!entry) {
      entry = { help, values: new Map() };
      this.counters.set(name, entry);
    }
    return {
      inc: (labels: Record<string, string> = {}, delta = 1) => {
        const k = serializeLabels(labels);
        entry!.values.set(k, (entry!.values.get(k) ?? 0) + delta);
      },
    };
  }

  gauge(name: string, help?: string): GaugeHandle {
    let entry = this.gauges.get(name);
    if (!entry) {
      entry = { help, values: new Map() };
      this.gauges.set(name, entry);
    }
    return {
      set: (labels: Record<string, string> = {}, value: number) => {
        entry!.values.set(serializeLabels(labels), value);
      },
      inc: (labels: Record<string, string> = {}, delta = 1) => {
        const k = serializeLabels(labels);
        entry!.values.set(k, (entry!.values.get(k) ?? 0) + delta);
      },
      dec: (labels: Record<string, string> = {}, delta = 1) => {
        const k = serializeLabels(labels);
        entry!.values.set(k, (entry!.values.get(k) ?? 0) - delta);
      },
    };
  }

  histogram(
    name: string,
    help: string | undefined,
    buckets: readonly number[]
  ): HistogramHandle {
    let entry = this.histograms.get(name);
    if (!entry) {
      entry = {
        help,
        buckets: [...buckets].sort((a, b) => a - b),
        values: new Map(),
      };
      this.histograms.set(name, entry);
    }
    return {
      observe: (labels: Record<string, string> = {}, value: number) => {
        const k = serializeLabels(labels);
        let state = entry!.values.get(k);
        if (!state) {
          state = {
            sum: 0,
            count: 0,
            labels,
            bucketCounts: new Array(entry!.buckets.length + 1).fill(0),
          };
          entry!.values.set(k, state);
        }
        state.sum += value;
        state.count += 1;
        let placed = false;
        for (let i = 0; i < entry!.buckets.length; i++) {
          if (value <= entry!.buckets[i]) {
            state.bucketCounts[i] += 1;
            placed = true;
          }
        }
        // +Inf bucket always incremented
        state.bucketCounts[entry!.buckets.length] += 1;
        if (!placed) {
          // value is above all finite buckets — only +Inf accumulates.
        }
      },
    };
  }

  /** Produce the Prometheus-formatted metrics text. */
  render(): string {
    const samples: PrometheusSample[] = [];

    for (const [name, entry] of this.counters) {
      for (const [labelsKey, value] of entry.values) {
        samples.push({
          name,
          type: 'counter',
          help: entry.help,
          labels: deserializeLabels(labelsKey),
          value,
        });
      }
    }
    for (const [name, entry] of this.gauges) {
      for (const [labelsKey, value] of entry.values) {
        samples.push({
          name,
          type: 'gauge',
          help: entry.help,
          labels: deserializeLabels(labelsKey),
          value,
        });
      }
    }
    for (const [name, entry] of this.histograms) {
      for (const state of entry.values.values()) {
        const buckets: Array<{ le: number | '+Inf'; count: number }> = [];
        for (let i = 0; i < entry.buckets.length; i++) {
          buckets.push({ le: entry.buckets[i], count: state.bucketCounts[i] });
        }
        buckets.push({
          le: '+Inf',
          count: state.bucketCounts[entry.buckets.length],
        });
        samples.push({
          name,
          type: 'histogram',
          help: entry.help,
          labels: state.labels,
          buckets,
          sum: state.sum,
          count: state.count,
        });
      }
    }

    return renderPrometheus(samples);
  }
}

interface CounterEntry {
  help?: string;
  values: Map<string, number>;
}
interface GaugeEntry {
  help?: string;
  values: Map<string, number>;
}
interface HistogramEntry {
  help?: string;
  buckets: number[];
  values: Map<
    string,
    {
      sum: number;
      count: number;
      labels: Record<string, string>;
      bucketCounts: number[];
    }
  >;
}

export interface CounterHandle {
  inc(labels?: Record<string, string>, delta?: number): void;
}
export interface GaugeHandle {
  set(labels: Record<string, string>, value: number): void;
  inc(labels?: Record<string, string>, delta?: number): void;
  dec(labels?: Record<string, string>, delta?: number): void;
}
export interface HistogramHandle {
  observe(labels: Record<string, string>, value: number): void;
}

function serializeLabels(labels: Record<string, string>): string {
  const keys = Object.keys(labels).sort();
  return keys.map((k) => `${k}=${labels[k]}`).join('|');
}

function deserializeLabels(key: string): Record<string, string> {
  if (!key) return {};
  const out: Record<string, string> = {};
  for (const part of key.split('|')) {
    const idx = part.indexOf('=');
    if (idx > 0) {
      out[part.slice(0, idx)] = part.slice(idx + 1);
    }
  }
  return out;
}

/**
 * Default histogram buckets appropriate for HTTP request latency in ms.
 */
export const DEFAULT_LATENCY_BUCKETS_MS: readonly number[] = [
  5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000,
];
