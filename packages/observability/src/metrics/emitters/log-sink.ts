/**
 * Default metric sink.
 *
 * Until a real backend (Prometheus / Datadog / OTel) is configured, emitters
 * no-op to a structured-JSON log line so metrics are at least captured by the
 * log pipeline and can be replayed.
 */

export interface MetricRecord {
  metric: string;
  value?: number;
  tags?: Record<string, string | number | undefined>;
  timestamp: string;
}

export type MetricSink = (record: MetricRecord) => void;

function defaultSink(record: MetricRecord): void {
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ level: 'info', kind: 'metric', ...record }));
}

let activeSink: MetricSink = defaultSink;

/**
 * Swap the default log-based sink for a real backend adapter.
 * Backends (Prom/Datadog/OTel) can register here without call-site changes.
 */
export function setMetricSink(sink: MetricSink): void {
  activeSink = sink;
}

export function resetMetricSink(): void {
  activeSink = defaultSink;
}

export function emitMetric(
  metric: string,
  value: number,
  tags?: MetricRecord['tags']
): void {
  activeSink({
    metric,
    value,
    tags,
    timestamp: new Date().toISOString(),
  });
}
