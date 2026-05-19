/**
 * Cross-service OpenTelemetry bootstrap.
 *
 * Wires three subsystems behind a single env-driven bootstrap call:
 *
 *   1. Distributed tracing — OTLP/HTTP exporter when
 *      `OTEL_EXPORTER_OTLP_ENDPOINT` is set; parent-based sampler with
 *      `TraceIdRatioBased(OTEL_SAMPLE_RATE)` (default 0.1).
 *   2. Metrics — periodic OTLP/HTTP metrics exporter pushing every 60s
 *      when the endpoint is configured.
 *   3. Auto-instrumentations — http / express / pg / redis /
 *      ioredis / undici / fetch via
 *      `@opentelemetry/auto-instrumentations-node`.
 *
 * Set `OTEL_ENABLED=false` to short-circuit the whole bootstrap (returns
 * a no-op handle). When no endpoint is configured, a Noop span processor
 * is wired so the SDK is harmless under test/CI.
 *
 * Idempotent: a second call returns the same handle without spinning a
 * second SDK. Tests reset module state via `__resetOtelForTests()`.
 *
 * Mirrors the gateway-local bootstrap that previously lived only at
 * `services/api-gateway/src/observability/otel-bootstrap.ts` — extracted
 * here in May 2026 (round-3 cascade-3 follow-up) so every long-lived
 * service can call `bootstrapOtel('<service-name>')` from its entry
 * point and emit cross-service traces.
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';
// `deployment.environment.name` lives in the incubating bundle in
// semantic-conventions 1.41+.
import { ATTR_DEPLOYMENT_ENVIRONMENT_NAME } from '@opentelemetry/semantic-conventions/incubating';
import {
  ParentBasedSampler,
  TraceIdRatioBasedSampler,
  BatchSpanProcessor,
  NoopSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';

/**
 * Public bootstrap config. All fields override the env-driven defaults.
 */
export interface OTelBootstrapConfig {
  /** Logical service name (e.g. `bossnyumba.payments-ledger`). */
  readonly serviceName?: string;
  readonly serviceVersion?: string;
  readonly otlpEndpoint?: string;
  /** Sample rate in [0, 1]. Defaults to env `OTEL_SAMPLE_RATE` or 0.1. */
  readonly sampleRate?: number;
  /** Explicit on/off override. Defaults to env `OTEL_ENABLED`. */
  readonly enabled?: boolean;
  readonly environment?: string;
  /**
   * Optional list of auto-instrumentation keys to disable. Defaults to
   * `['@opentelemetry/instrumentation-fs']` (always too noisy).
   */
  readonly disabledInstrumentations?: readonly string[];
}

export interface OTelHandle {
  readonly sdk: NodeSDK | null;
  readonly enabled: boolean;
  readonly serviceName: string;
  readonly sampleRate: number;
  readonly endpoint: string | null;
  shutdown(): Promise<void>;
}

let singleton: OTelHandle | null = null;

function parseSampleRate(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 1) return fallback;
  return n;
}

function readEnabled(raw: string | undefined, override?: boolean): boolean {
  if (override !== undefined) return override;
  if (!raw) return true;
  const v = raw.trim().toLowerCase();
  return v !== 'false' && v !== '0' && v !== 'no';
}

const DEFAULT_DISABLED: readonly string[] = ['@opentelemetry/instrumentation-fs'];

/**
 * Bootstrap the OTel SDK. Safe to call once at process start; subsequent
 * calls return the cached handle.
 *
 * Bootstrap failures must not crash the host service. On `sdk.start()`
 * error, the helper logs a single warning to stderr and returns a no-op
 * handle so the rest of the boot sequence proceeds.
 */
export function bootstrapOtel(
  config: OTelBootstrapConfig = {},
): OTelHandle {
  if (singleton) return singleton;

  const enabled = readEnabled(process.env.OTEL_ENABLED, config.enabled);
  const serviceName =
    config.serviceName ??
    process.env.OTEL_SERVICE_NAME ??
    'bossnyumba-service';
  const serviceVersion =
    config.serviceVersion ?? process.env.APP_VERSION ?? 'dev';
  const sampleRate = parseSampleRate(
    process.env.OTEL_SAMPLE_RATE,
    config.sampleRate ?? 0.1,
  );
  const endpoint =
    config.otlpEndpoint ?? process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? null;
  const environment =
    config.environment ?? process.env.NODE_ENV ?? 'development';

  if (!enabled) {
    const noopHandle: OTelHandle = {
      sdk: null,
      enabled: false,
      serviceName,
      sampleRate,
      endpoint,
      async shutdown(): Promise<void> {
        // No-op when disabled.
      },
    };
    singleton = noopHandle;
    return noopHandle;
  }

  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: serviceName,
    [ATTR_SERVICE_VERSION]: serviceVersion,
    [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: environment,
  });

  const sampler = new ParentBasedSampler({
    root: new TraceIdRatioBasedSampler(sampleRate),
  });

  const traceExporter = endpoint
    ? new OTLPTraceExporter({ url: `${endpoint.replace(/\/$/, '')}/v1/traces` })
    : null;

  const spanProcessor = traceExporter
    ? new BatchSpanProcessor(traceExporter)
    : new NoopSpanProcessor();

  const metricReader = endpoint
    ? new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter({
          url: `${endpoint.replace(/\/$/, '')}/v1/metrics`,
        }),
        exportIntervalMillis: 60_000,
      })
    : undefined;

  const disabled = new Set(
    config.disabledInstrumentations ?? DEFAULT_DISABLED,
  );
  const instrumentationOpts: Record<string, { enabled: boolean }> = {};
  for (const key of disabled) {
    instrumentationOpts[key] = { enabled: false };
  }

  const sdkConfig: Record<string, unknown> = {
    resource,
    sampler,
    spanProcessor,
    instrumentations: [getNodeAutoInstrumentations(instrumentationOpts)],
  };
  if (metricReader) sdkConfig.metricReader = metricReader;
  const sdk = new NodeSDK(sdkConfig as ConstructorParameters<typeof NodeSDK>[0]);

  let started = false;
  try {
    sdk.start();
    started = true;
  } catch (err) {
    process.stderr.write(
      `[observability] otel bootstrap failed for ${serviceName}: ${
        err instanceof Error ? err.message : String(err)
      }\n`,
    );
  }

  let shutdownPromise: Promise<void> | null = null;
  const handle: OTelHandle = {
    sdk: started ? sdk : null,
    enabled: started,
    serviceName,
    sampleRate,
    endpoint,
    async shutdown(): Promise<void> {
      if (!started) return;
      if (shutdownPromise) return shutdownPromise;
      shutdownPromise = sdk
        .shutdown()
        .catch((err: unknown) => {
          process.stderr.write(
            `[observability] otel shutdown failed for ${serviceName}: ${
              err instanceof Error ? err.message : String(err)
            }\n`,
          );
        })
        .then(() => undefined);
      return shutdownPromise;
    },
  };
  singleton = handle;
  return handle;
}

/** Test-only — clears the singleton so subsequent bootstrap calls re-init. */
export function __resetOtelForTests(): void {
  singleton = null;
}

/** Public accessor for the active handle (or null when not bootstrapped). */
export function getOtelHandle(): OTelHandle | null {
  return singleton;
}
