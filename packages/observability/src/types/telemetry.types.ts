/**
 * Telemetry Types for BOSSNYUMBA Platform
 * 
 * Configuration and type definitions for OpenTelemetry-based observability.
 */

/**
 * Log levels aligned with Pino
 */
export const LogLevel = {
  TRACE: 'trace',
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
  FATAL: 'fatal',
} as const;

export type LogLevel = typeof LogLevel[keyof typeof LogLevel];

/**
 * Service identity for telemetry attribution
 */
export interface ServiceIdentity {
  /** Service name (e.g., 'api-gateway', 'payments-service') */
  name: string;
  /** Service version (semver) */
  version: string;
  /** Deployment environment */
  environment: 'development' | 'staging' | 'production';
  /** Instance identifier (pod name, container ID, etc.) */
  instanceId?: string;
  /** Kubernetes namespace if applicable */
  namespace?: string;
  /** Cloud region */
  region?: string;
}

/**
 * OpenTelemetry exporter configuration
 */
export interface OTelExporterConfig {
  /** OTLP endpoint URL */
  endpoint: string;
  /** Headers for authentication */
  headers?: Record<string, string>;
  /** Timeout in milliseconds */
  timeoutMs?: number;
  /** Compression type */
  compression?: 'none' | 'gzip';
}

/**
 * Telemetry configuration
 */
export interface TelemetryConfig {
  /** Service identity */
  service: ServiceIdentity;
  /** Enable/disable telemetry */
  enabled: boolean;
  /** Log level */
  logLevel: LogLevel;
  /** Trace sampling ratio (0.0 to 1.0) */
  traceSampleRatio: number;
  /** Metrics export interval in milliseconds */
  metricsIntervalMs: number;
  /** Trace exporter config */
  traceExporter?: OTelExporterConfig;
  /** Metrics exporter config */
  metricsExporter?: OTelExporterConfig;
  /** Enable console output for development */
  consoleExport?: boolean;
  /** Sensitive fields to redact from logs */
  redactFields?: string[];
}

/**
 * Default telemetry configuration
 */
export const DEFAULT_TELEMETRY_CONFIG: Partial<TelemetryConfig> = {
  enabled: true,
  logLevel: LogLevel.INFO,
  traceSampleRatio: 0.1,
  metricsIntervalMs: 60000,
  consoleExport: false,
  redactFields: [
    'password',
    'token',
    'secret',
    'apiKey',
    'authorization',
    'creditCard',
    'ssn',
    'bankAccount',
  ],
};

/**
 * Structured log entry
 */
export interface LogEntry {
  /** Log level */
  level: LogLevel;
  /** Log message */
  message: string;
  /** Timestamp */
  timestamp: string;
  /** Service identity */
  service: string;
  /** Trace context */
  traceId?: string;
  spanId?: string;
  /** Tenant context */
  tenantId?: string;
  /** User context */
  userId?: string;
  /** Request context */
  requestId?: string;
  /** Error details */
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  /** Additional attributes */
  attributes?: Record<string, unknown>;
}

/**
 * Metric types
 */
export const MetricType = {
  COUNTER: 'counter',
  GAUGE: 'gauge',
  HISTOGRAM: 'histogram',
} as const;

export type MetricType = typeof MetricType[keyof typeof MetricType];

/**
 * Metric definition
 */
export interface MetricDefinition {
  /** Metric name (e.g., 'http_requests_total') */
  name: string;
  /** Description */
  description: string;
  /** Metric type */
  type: MetricType;
  /** Unit of measurement */
  unit?: string;
  /** Label keys for dimensions */
  labelKeys?: string[];
}

/**
 * Standard platform metrics
 */
export const PLATFORM_METRICS: Record<string, MetricDefinition> = {
  // HTTP metrics
  HTTP_REQUESTS_TOTAL: {
    name: 'bossnyumba_http_requests_total',
    description: 'Total number of HTTP requests',
    type: MetricType.COUNTER,
    labelKeys: ['method', 'path', 'status', 'tenant'],
  },
  HTTP_REQUEST_DURATION: {
    name: 'bossnyumba_http_request_duration_ms',
    description: 'HTTP request duration in milliseconds',
    type: MetricType.HISTOGRAM,
    unit: 'ms',
    labelKeys: ['method', 'path', 'status', 'tenant'],
  },
  
  // Business metrics
  PAYMENTS_TOTAL: {
    name: 'bossnyumba_payments_total',
    description: 'Total number of payment transactions',
    type: MetricType.COUNTER,
    labelKeys: ['type', 'status', 'tenant'],
  },
  PAYMENT_AMOUNT: {
    name: 'bossnyumba_payment_amount',
    description: 'Payment amounts processed',
    type: MetricType.HISTOGRAM,
    unit: 'currency_minor',
    labelKeys: ['type', 'currency', 'tenant'],
  },
  MAINTENANCE_REQUESTS: {
    name: 'bossnyumba_maintenance_requests_total',
    description: 'Total number of maintenance requests',
    type: MetricType.COUNTER,
    labelKeys: ['priority', 'status', 'tenant'],
  },
  MAINTENANCE_RESOLUTION_TIME: {
    name: 'bossnyumba_maintenance_resolution_time_ms',
    description: 'Time to resolve maintenance requests',
    type: MetricType.HISTOGRAM,
    unit: 'ms',
    labelKeys: ['priority', 'tenant'],
  },
  
  // Auth metrics
  AUTH_ATTEMPTS: {
    name: 'bossnyumba_auth_attempts_total',
    description: 'Total authentication attempts',
    type: MetricType.COUNTER,
    labelKeys: ['method', 'outcome', 'tenant'],
  },
  ACTIVE_SESSIONS: {
    name: 'bossnyumba_active_sessions',
    description: 'Number of active user sessions',
    type: MetricType.GAUGE,
    labelKeys: ['tenant'],
  },
  
  // System metrics
  AUDIT_EVENTS: {
    name: 'bossnyumba_audit_events_total',
    description: 'Total audit events recorded',
    type: MetricType.COUNTER,
    labelKeys: ['category', 'outcome', 'tenant'],
  },
  ERROR_COUNT: {
    name: 'bossnyumba_errors_total',
    description: 'Total application errors',
    type: MetricType.COUNTER,
    labelKeys: ['type', 'service', 'tenant'],
  },
};

/**
 * Span attributes for distributed tracing
 */
export const SpanAttributes = {
  // Tenant context
  TENANT_ID: 'bossnyumba.tenant.id',
  TENANT_NAME: 'bossnyumba.tenant.name',
  
  // User context
  USER_ID: 'bossnyumba.user.id',
  USER_EMAIL: 'bossnyumba.user.email',
  USER_ROLES: 'bossnyumba.user.roles',
  
  // Request context
  REQUEST_ID: 'bossnyumba.request.id',
  SESSION_ID: 'bossnyumba.session.id',
  
  // Domain context
  PROPERTY_ID: 'bossnyumba.property.id',
  UNIT_ID: 'bossnyumba.unit.id',
  LEASE_ID: 'bossnyumba.lease.id',
  PAYMENT_ID: 'bossnyumba.payment.id',
  WORK_ORDER_ID: 'bossnyumba.work_order.id',
  
  // Operation context
  OPERATION_NAME: 'bossnyumba.operation.name',
  OPERATION_TYPE: 'bossnyumba.operation.type',
} as const;
