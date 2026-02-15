/**
 * @bossnyumba/observability
 * 
 * Platform observability package providing:
 * - Audit logging with fluent API and simple function interface
 * - Domain event bus with outbox pattern
 * - Structured logging with Pino
 * - Distributed tracing with OpenTelemetry
 * - Metrics collection with OpenTelemetry
 */

// ============================================================================
// Types - Audit
// ============================================================================

export type {
  AuditEvent,
  AuditActor,
  AuditTarget,
  AuditTenantContext,
  AuditRequestContext,
  AuditChangeRecord,
  CreateAuditEventOptions,
  AuditQueryOptions,
  AuditQueryResult,
} from './types/audit.types.js';

export {
  AuditCategory,
  AuditOutcome,
  AuditSeverity,
} from './types/audit.types.js';

// ============================================================================
// Types - Telemetry
// ============================================================================

export type {
  ServiceIdentity,
  OTelExporterConfig,
  TelemetryConfig,
  LogEntry,
  MetricDefinition,
} from './types/telemetry.types.js';

export {
  LogLevel,
  MetricType,
  DEFAULT_TELEMETRY_CONFIG,
  PLATFORM_METRICS,
  SpanAttributes,
} from './types/telemetry.types.js';

// ============================================================================
// Types - Domain Events
// ============================================================================

export type {
  DomainEvent,
  DomainEventMetadata,
  EventEnvelope,
  EventPriority,
  OutboxStatus,
  EventHandler,
  EventHandlerRegistration,
  EventHandlerOptions,
  EventSubscription,
  IEventStore,
  PropertyCreatedPayload,
  PropertyUpdatedPayload,
  LeaseCreatedPayload,
  LeaseTerminatedPayload,
  PaymentReceivedPayload,
  PaymentFailedPayload,
  MaintenanceRequestCreatedPayload,
  MaintenanceCompletedPayload,
  UserCreatedPayload,
  UserRoleChangedPayload,
} from './types.js';

// ============================================================================
// Audit - Core
// ============================================================================

export type {
  IAuditStore,
  AuditStoreConfig,
} from './audit/audit-store.interface.js';

export { DEFAULT_AUDIT_STORE_CONFIG } from './audit/audit-store.interface.js';

export { MemoryAuditStore } from './audit/memory-audit-store.js';

export type { AuditLoggerConfig } from './audit/audit-logger.js';

export { AuditLogger, AuditEventBuilder } from './audit/audit-logger.js';

// ============================================================================
// Audit - Simple API
// ============================================================================

export type {
  AuditUser,
  AuditResource,
  AuditDetails,
  SimpleAuditLoggerConfig,
} from './audit-logger.js';

export {
  initAuditLogger,
  getAuditLogger,
  logAuditEvent,
  logAuditSuccess,
  logAuditFailure,
  logAuditDenied,
  logSystemAuditEvent,
  logServiceAuditEvent,
} from './audit-logger.js';

// ============================================================================
// Event Bus
// ============================================================================

export type {
  EventBusConfig,
  IOutboxStore,
} from './event-bus.js';

export {
  EventBus,
  MemoryOutboxStore,
  getEventBus,
  publish,
  subscribe,
} from './event-bus.js';

// ============================================================================
// Logging
// ============================================================================

export type { LoggerContext, LoggerConfig } from './logging/logger.js';

export { Logger, createLogger } from './logging/logger.js';

// ============================================================================
// Tracing
// ============================================================================

export type {
  SpanContext,
  CreateSpanOptions,
} from './tracing/tracer.js';

export {
  initTracing,
  shutdownTracing,
  getTracer,
  getCurrentSpan,
  withSpan,
  withSpanSync,
  setTenantContext,
  setUserContext,
  extractTraceContext,
  injectTraceContext,
} from './tracing/tracer.js';

// ============================================================================
// Metrics
// ============================================================================

export {
  initMetrics,
  shutdownMetrics,
  getMeter,
  PlatformMetrics,
} from './metrics/metrics.js';

// ============================================================================
// Re-exports
// ============================================================================

export { SpanKind, SpanStatusCode } from '@opentelemetry/api';
export type { Span, Tracer, Counter, Histogram } from '@opentelemetry/api';
