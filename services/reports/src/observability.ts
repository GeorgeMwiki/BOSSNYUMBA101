/**
 * Observability helpers for the Reports service.
 *
 * The reports service is a library that's mounted into different
 * hosts (API gateway, standalone workers, background schedulers). To
 * keep /health, /ready, /metrics uniform across every host, we expose
 * a small factory here that produces the response payloads directly;
 * callers wire it to whatever HTTP framework they're using.
 */

import type { IReportStorage } from './storage/storage.js';
import type { IReportDataProvider } from './data-provider.interface.js';
import type { ReportScheduler } from './scheduler/scheduler.js';

export interface ReportServiceHealth {
  status: 'ok' | 'degraded';
  service: 'reports';
  uptimeSeconds: number;
  dependencies: {
    dataProvider: boolean;
    storage: boolean;
    scheduler: boolean;
  };
}

export interface ReportServiceMetrics {
  reportsGenerated: number;
  reportsFailed: number;
  bytesStored: number;
}

export interface ReportServiceObservability {
  /** Liveness: the process is up. */
  health(): ReportServiceHealth;
  /** Readiness: dependencies are wired and usable. */
  ready(): Promise<ReportServiceHealth>;
  /** Prometheus text-format exposition. */
  metrics(): string;
  /** Counter hooks for the report generation pipeline. */
  recordSuccess(bytes?: number): void;
  recordFailure(): void;
}

export interface ReportServiceObservabilityOptions {
  dataProvider: IReportDataProvider;
  storage: IReportStorage;
  scheduler?: ReportScheduler;
  /** Optional hook to probe storage with a non-destructive operation. */
  probeStorage?: () => Promise<void>;
}

/**
 * Create the observability helper for a Reports host.
 */
export function createReportServiceObservability(
  options: ReportServiceObservabilityOptions,
): ReportServiceObservability {
  const startedAt = Date.now();
  const counters: ReportServiceMetrics = {
    reportsGenerated: 0,
    reportsFailed: 0,
    bytesStored: 0,
  };

  const baseHealth = (): ReportServiceHealth => ({
    status: 'ok',
    service: 'reports',
    uptimeSeconds: (Date.now() - startedAt) / 1000,
    dependencies: {
      dataProvider: Boolean(options.dataProvider),
      storage: Boolean(options.storage),
      scheduler: Boolean(options.scheduler),
    },
  });

  return {
    health: () => baseHealth(),
    async ready() {
      const h = baseHealth();
      if (!h.dependencies.dataProvider || !h.dependencies.storage) {
        return { ...h, status: 'degraded' };
      }
      if (options.probeStorage) {
        try {
          await options.probeStorage();
        } catch {
          return { ...h, status: 'degraded', dependencies: { ...h.dependencies, storage: false } };
        }
      }
      return h;
    },
    metrics() {
      const uptime = (Date.now() - startedAt) / 1000;
      return [
        '# HELP reports_uptime_seconds Process uptime in seconds',
        '# TYPE reports_uptime_seconds gauge',
        `reports_uptime_seconds ${uptime.toFixed(3)}`,
        '# HELP reports_generated_total Successfully generated reports',
        '# TYPE reports_generated_total counter',
        `reports_generated_total ${counters.reportsGenerated}`,
        '# HELP reports_failed_total Failed report generation attempts',
        '# TYPE reports_failed_total counter',
        `reports_failed_total ${counters.reportsFailed}`,
        '# HELP reports_bytes_stored_total Bytes of report artefacts persisted',
        '# TYPE reports_bytes_stored_total counter',
        `reports_bytes_stored_total ${counters.bytesStored}`,
        '',
      ].join('\n');
    },
    recordSuccess(bytes?: number) {
      counters.reportsGenerated += 1;
      if (typeof bytes === 'number' && bytes > 0) counters.bytesStored += bytes;
    },
    recordFailure() {
      counters.reportsFailed += 1;
    },
  };
}
