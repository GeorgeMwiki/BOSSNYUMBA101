/**
 * OpenTelemetry Tracer Setup
 * 
 * Configures distributed tracing for BOSSNYUMBA services.
 * Provides span creation utilities with platform-specific context.
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import {
  SEMRESATTRS_SERVICE_NAME,
  SEMRESATTRS_SERVICE_VERSION,
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
  SEMRESATTRS_SERVICE_INSTANCE_ID,
} from '@opentelemetry/semantic-conventions';
import {
  trace,
  context,
  SpanKind,
  SpanStatusCode,
  propagation,
  Span,
  Tracer,
  Context,
} from '@opentelemetry/api';
import type { TelemetryConfig } from '../types/telemetry.types.js';
import { SpanAttributes } from '../types/telemetry.types.js';

let sdkInstance: NodeSDK | null = null;

/**
 * Initialize OpenTelemetry SDK
 */
export function initTracing(config: TelemetryConfig): NodeSDK {
  if (sdkInstance) {
    return sdkInstance;
  }

  if (!config.enabled) {
    // Return a no-op SDK
    sdkInstance = new NodeSDK({});
    return sdkInstance;
  }

  const resource = new Resource({
    [SEMRESATTRS_SERVICE_NAME]: config.service.name,
    [SEMRESATTRS_SERVICE_VERSION]: config.service.version,
    [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: config.service.environment,
    ...(config.service.instanceId && {
      [SEMRESATTRS_SERVICE_INSTANCE_ID]: config.service.instanceId,
    }),
  });

  const traceExporter = config.traceExporter
    ? new OTLPTraceExporter({
        url: config.traceExporter.endpoint,
        headers: config.traceExporter.headers,
        timeoutMillis: config.traceExporter.timeoutMs,
      })
    : undefined;

  sdkInstance = new NodeSDK({
    resource,
    traceExporter,
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-http': {
          enabled: true,
        },
        '@opentelemetry/instrumentation-express': {
          enabled: true,
        },
        '@opentelemetry/instrumentation-pg': {
          enabled: true,
        },
      }),
    ],
  });

  sdkInstance.start();

  // Graceful shutdown
  process.on('SIGTERM', () => {
    sdkInstance?.shutdown()
      .then(() => console.log('Tracing terminated'))
      .catch((error) => console.error('Error terminating tracing', error))
      .finally(() => process.exit(0));
  });

  return sdkInstance;
}

/**
 * Shutdown tracing SDK
 */
export async function shutdownTracing(): Promise<void> {
  if (sdkInstance) {
    await sdkInstance.shutdown();
    sdkInstance = null;
  }
}

/**
 * Get the tracer for a service
 */
export function getTracer(name: string, version?: string): Tracer {
  return trace.getTracer(name, version);
}

/**
 * Get the current active span
 */
export function getCurrentSpan(): Span | undefined {
  return trace.getSpan(context.active());
}

/**
 * Context for creating spans
 */
export interface SpanContext {
  /** Tenant ID */
  tenantId?: string;
  /** User ID */
  userId?: string;
  /** Request ID */
  requestId?: string;
  /** Additional attributes */
  attributes?: Record<string, string | number | boolean>;
}

/**
 * Options for creating spans
 */
export interface CreateSpanOptions {
  /** Span kind */
  kind?: SpanKind;
  /** Parent context */
  parentContext?: Context;
  /** Initial attributes */
  attributes?: Record<string, string | number | boolean>;
  /** Platform context */
  context?: SpanContext;
}

/**
 * Wrapper for executing code within a span
 */
export async function withSpan<T>(
  tracer: Tracer,
  name: string,
  options: CreateSpanOptions,
  fn: (span: Span) => Promise<T>
): Promise<T> {
  const parentCtx = options.parentContext ?? context.active();
  
  return tracer.startActiveSpan(
    name,
    {
      kind: options.kind ?? SpanKind.INTERNAL,
      attributes: {
        ...options.attributes,
        ...(options.context?.tenantId && {
          [SpanAttributes.TENANT_ID]: options.context.tenantId,
        }),
        ...(options.context?.userId && {
          [SpanAttributes.USER_ID]: options.context.userId,
        }),
        ...(options.context?.requestId && {
          [SpanAttributes.REQUEST_ID]: options.context.requestId,
        }),
        ...options.context?.attributes,
      },
    },
    parentCtx,
    async (span) => {
      try {
        const result = await fn(span);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        if (error instanceof Error) {
          span.recordException(error);
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error.message,
          });
        }
        throw error;
      } finally {
        span.end();
      }
    }
  );
}

/**
 * Synchronous version of withSpan
 */
export function withSpanSync<T>(
  tracer: Tracer,
  name: string,
  options: CreateSpanOptions,
  fn: (span: Span) => T
): T {
  const parentCtx = options.parentContext ?? context.active();
  
  const span = tracer.startSpan(
    name,
    {
      kind: options.kind ?? SpanKind.INTERNAL,
      attributes: {
        ...options.attributes,
        ...(options.context?.tenantId && {
          [SpanAttributes.TENANT_ID]: options.context.tenantId,
        }),
        ...(options.context?.userId && {
          [SpanAttributes.USER_ID]: options.context.userId,
        }),
        ...(options.context?.requestId && {
          [SpanAttributes.REQUEST_ID]: options.context.requestId,
        }),
        ...options.context?.attributes,
      },
    },
    parentCtx
  );
  
  const ctx = trace.setSpan(parentCtx, span);
  
  return context.with(ctx, () => {
    try {
      const result = fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      if (error instanceof Error) {
        span.recordException(error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error.message,
        });
      }
      throw error;
    } finally {
      span.end();
    }
  });
}

/**
 * Add tenant context to the current span
 */
export function setTenantContext(tenantId: string, tenantName?: string): void {
  const span = getCurrentSpan();
  if (span) {
    span.setAttribute(SpanAttributes.TENANT_ID, tenantId);
    if (tenantName) {
      span.setAttribute(SpanAttributes.TENANT_NAME, tenantName);
    }
  }
}

/**
 * Add user context to the current span
 */
export function setUserContext(
  userId: string,
  email?: string,
  roles?: string[]
): void {
  const span = getCurrentSpan();
  if (span) {
    span.setAttribute(SpanAttributes.USER_ID, userId);
    if (email) {
      span.setAttribute(SpanAttributes.USER_EMAIL, email);
    }
    if (roles) {
      span.setAttribute(SpanAttributes.USER_ROLES, roles.join(','));
    }
  }
}

/**
 * Extract trace context from headers (for incoming requests)
 */
export function extractTraceContext(
  headers: Record<string, string | string[] | undefined>
): Context {
  const normalizedHeaders: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (value) {
      normalizedHeaders[key.toLowerCase()] = Array.isArray(value)
        ? value[0] ?? ''
        : value;
    }
  }
  return propagation.extract(context.active(), normalizedHeaders);
}

/**
 * Inject trace context into headers (for outgoing requests)
 */
export function injectTraceContext(
  headers: Record<string, string>
): Record<string, string> {
  propagation.inject(context.active(), headers);
  return headers;
}
