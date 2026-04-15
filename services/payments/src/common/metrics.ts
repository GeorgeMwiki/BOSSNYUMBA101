/**
 * Minimal, zero-dependency Prometheus-style metrics registry.
 * Implements Counter, Gauge, and Histogram primitives that are exposed
 * by the service's /metrics endpoint in a text format compatible with
 * Prometheus scrapers.
 */

type LabelValues = Record<string, string | number>;

function labelKey(labels?: LabelValues): string {
  if (!labels) return '';
  const entries = Object.entries(labels)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => [k, String(v)] as const)
    .sort(([a], [b]) => a.localeCompare(b));
  return entries.map(([k, v]) => `${k}="${escape(v)}"`).join(',');
}

function escape(v: string): string {
  return v.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

abstract class Metric {
  protected samples = new Map<string, number>();

  constructor(
    readonly name: string,
    readonly help: string,
    readonly type: 'counter' | 'gauge' | 'histogram'
  ) {}

  protected set(labels: LabelValues | undefined, value: number): void {
    this.samples.set(labelKey(labels), value);
  }

  protected addTo(labels: LabelValues | undefined, delta: number): void {
    const key = labelKey(labels);
    this.samples.set(key, (this.samples.get(key) ?? 0) + delta);
  }

  toTextLines(): string[] {
    const lines: string[] = [];
    lines.push(`# HELP ${this.name} ${this.help}`);
    lines.push(`# TYPE ${this.name} ${this.type}`);
    for (const [labels, value] of this.samples) {
      lines.push(labels ? `${this.name}{${labels}} ${value}` : `${this.name} ${value}`);
    }
    return lines;
  }
}

export class Counter extends Metric {
  constructor(name: string, help: string) {
    super(name, help, 'counter');
  }
  inc(labels?: LabelValues, delta: number = 1): void {
    if (delta < 0) throw new Error('Counter cannot decrease');
    this.addTo(labels, delta);
  }
}

export class Gauge extends Metric {
  constructor(name: string, help: string) {
    super(name, help, 'gauge');
  }
  setValue(value: number, labels?: LabelValues): void {
    this.set(labels, value);
  }
  inc(labels?: LabelValues, delta: number = 1): void {
    this.addTo(labels, delta);
  }
  dec(labels?: LabelValues, delta: number = 1): void {
    this.addTo(labels, -delta);
  }
}

export class Histogram extends Metric {
  private readonly buckets: number[];
  private readonly observations = new Map<string, { sum: number; count: number; bucketCounts: number[] }>();

  constructor(
    name: string,
    help: string,
    buckets: number[] = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
  ) {
    super(name, help, 'histogram');
    this.buckets = [...buckets].sort((a, b) => a - b);
  }

  observe(value: number, labels?: LabelValues): void {
    const key = labelKey(labels);
    const entry = this.observations.get(key) ?? {
      sum: 0,
      count: 0,
      bucketCounts: new Array(this.buckets.length).fill(0),
    };
    entry.sum += value;
    entry.count += 1;
    for (let i = 0; i < this.buckets.length; i++) {
      if (value <= (this.buckets[i] as number)) entry.bucketCounts[i]! += 1;
    }
    this.observations.set(key, entry);
  }

  override toTextLines(): string[] {
    const lines: string[] = [];
    lines.push(`# HELP ${this.name} ${this.help}`);
    lines.push(`# TYPE ${this.name} histogram`);
    for (const [labelsKey, entry] of this.observations) {
      const base = labelsKey ? `{${labelsKey}` : '{';
      for (let i = 0; i < this.buckets.length; i++) {
        const b = this.buckets[i] as number;
        const suffix = labelsKey ? `,le="${b}"}` : `le="${b}"}`;
        lines.push(`${this.name}_bucket${base}${suffix} ${entry.bucketCounts[i]}`);
      }
      const infSuffix = labelsKey ? `,le="+Inf"}` : `le="+Inf"}`;
      lines.push(`${this.name}_bucket${base}${infSuffix} ${entry.count}`);
      const closing = labelsKey ? '}' : '';
      const labelBlock = labelsKey ? `{${labelsKey}}` : '';
      lines.push(`${this.name}_sum${labelBlock} ${entry.sum}`);
      lines.push(`${this.name}_count${labelBlock} ${entry.count}`);
      void closing;
    }
    return lines;
  }
}

class Registry {
  private readonly metrics = new Map<string, Metric>();

  register<T extends Metric>(metric: T): T {
    if (this.metrics.has(metric.name)) {
      return this.metrics.get(metric.name) as T;
    }
    this.metrics.set(metric.name, metric);
    return metric;
  }

  counter(name: string, help: string): Counter {
    return this.register(new Counter(name, help));
  }

  gauge(name: string, help: string): Gauge {
    return this.register(new Gauge(name, help));
  }

  histogram(name: string, help: string, buckets?: number[]): Histogram {
    return this.register(new Histogram(name, help, buckets));
  }

  render(): string {
    const lines: string[] = [];
    for (const metric of this.metrics.values()) {
      lines.push(...metric.toTextLines());
    }
    return lines.join('\n') + '\n';
  }

  clear(): void {
    this.metrics.clear();
  }
}

export const registry = new Registry();

export const paymentAttempts = registry.counter(
  'payments_attempts_total',
  'Total number of payment attempts by provider and status'
);
export const paymentFailures = registry.counter(
  'payments_failures_total',
  'Total number of payment failures by provider and reason'
);
export const paymentLatency = registry.histogram(
  'payments_provider_request_seconds',
  'Latency of provider HTTP calls, in seconds'
);
export const webhookEventsReceived = registry.counter(
  'webhook_events_received_total',
  'Total number of inbound webhook events by provider and type'
);
export const webhookEventsDuplicate = registry.counter(
  'webhook_events_duplicate_total',
  'Number of webhook events dropped as duplicates'
);
export const webhookEventsFailed = registry.counter(
  'webhook_events_failed_total',
  'Number of webhook handler failures by provider'
);
