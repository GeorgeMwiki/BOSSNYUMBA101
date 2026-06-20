/**
 * Structured Logger
 * 
 * Pino-based structured logger with OpenTelemetry trace context integration.
 * Provides consistent logging across all BOSSNYUMBA services.
 */

import pino, { Logger as PinoLogger } from 'pino';
import { trace, context, SpanStatusCode } from '@opentelemetry/api';
import type { LogLevel, ServiceIdentity, TelemetryConfig } from '../types/telemetry.types.js';
import { redactPII } from '../pii-redactor.js';

/**
 * Logger context for multi-tenant and request scoping
 */
export interface LoggerContext {
  /** Tenant ID for multi-tenant isolation */
  tenantId?: string;
  /** User ID for user-scoped operations */
  userId?: string;
  /** Request ID from API gateway */
  requestId?: string;
  /** Session ID */
  sessionId?: string;
  /** Additional context attributes */
  attributes?: Record<string, unknown>;
}

/**
 * Logger configuration
 */
export interface LoggerConfig {
  /** Service identity */
  service: ServiceIdentity;
  /** Log level */
  level: LogLevel;
  /** Pretty print for development */
  pretty?: boolean;
  /** Fields to redact */
  redactFields?: string[];
  /** Base context */
  baseContext?: LoggerContext;
}

// Scale-hardening: expanded to cover the full set of sensitive headers /
// fields the BOSSNYUMBA platform handles. Names are de-duplicated by Pino,
// so adding the snake_case and camelCase variants is safe and
// belt-and-suspenders against the rapid mix of conventions across the
// brain / payments / auth services.
//
// - `authorization` (header), `cookie` (header) — request headers.
// - `password`, `passwordHash` — auth flows.
// - `token`, `tokenHash`, `refreshToken`, `jwt`, `bearer` — auth tokens.
// - `secret`, `mfaSecret`, `apiKey`, `api_key`, `webhookSecret` — secrets.
// - `creditCard`, `ssn`, `bankAccount`, `iban`, `nationalId` — PII.
const DEFAULT_REDACT_FIELDS = [
  'password',
  'passwordHash',
  'token',
  'tokenHash',
  'refreshToken',
  'jwt',
  'bearer',
  'secret',
  'mfaSecret',
  'apiKey',
  'api_key',
  'webhookSecret',
  'authorization',
  'cookie',
  'creditCard',
  'ssn',
  'bankAccount',
  'iban',
  'nationalId',
  // PII log-shape fields (hardening 2026-06-11): the identifiers the
  // gateway routes actually carry in log meta. Phone is the PRIMARY identity
  // key in this product (phone-OTP auth, invites, identity resolution) and
  // must never land in log sinks; activation/invite codes are credentials.
  'phone',
  'phoneE164',
  'phone_e164',
  'phoneNormalized',
  'phone_normalized',
  'email',
  'nidaId',
  'nida_id',
  'biometricTemplateHash',
  'biometric_template_hash',
  'activationCode',
  'activation_code',
  'inviteCode',
  'invite_code',
  'accessToken',
  'access_token',
  'refresh_token',
];

/**
 * Create the base Pino logger instance
 */
function createPinoLogger(config: LoggerConfig): PinoLogger {
  // Pino's native `redact.paths` only matches LITERAL paths with a fixed
  // number of wildcard segments — it cannot express "this key at any
  // depth". We keep depths 0-2 here as a cheap fast-path / defence in
  // depth, but the AUTHORITATIVE, depth-UNBOUNDED redaction is applied by
  // the recursive `redactPII` walk in `buildLogObj` before the object ever
  // reaches Pino (see Logger.buildLogObj). That walk censors any matching
  // key at ANY nesting depth, closing the "depth >= 3 leaks" hole.
  const redactPaths = [
    ...(config.redactFields ?? DEFAULT_REDACT_FIELDS).map(f => f),
    ...(config.redactFields ?? DEFAULT_REDACT_FIELDS).map(f => `*.${f}`),
    ...(config.redactFields ?? DEFAULT_REDACT_FIELDS).map(f => `*.*.${f}`),
  ];

  const options: pino.LoggerOptions = {
    level: config.level,
    base: {
      service: config.service.name,
      version: config.service.version,
      environment: config.service.environment,
      ...(config.service.instanceId && { instance: config.service.instanceId }),
    },
    redact: {
      paths: redactPaths,
      censor: '[REDACTED]',
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label }),
    },
  };

  if (config.pretty) {
    return pino({
      ...options,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      },
    });
  }

  return pino(options);
}

/**
 * Get current trace context from OpenTelemetry
 */
function getTraceContext(): { traceId?: string; spanId?: string } {
  const span = trace.getSpan(context.active());
  if (!span) {
    return {};
  }

  const spanContext = span.spanContext();
  return {
    traceId: spanContext.traceId,
    spanId: spanContext.spanId,
  };
}

/**
 * Structured Logger for BOSSNYUMBA platform
 */
export class Logger {
  private readonly pino: PinoLogger;
  private readonly baseContext: LoggerContext;
  /**
   * Field names redacted at UNBOUNDED depth by the recursive `redactPII`
   * pass. Mirrors the Pino `redact.paths` field list (custom override or
   * {@link DEFAULT_REDACT_FIELDS}) so the depth-unbounded walk censors
   * exactly the same fields the static paths declare — only without the
   * 3-level depth ceiling.
   */
  private readonly redactFields: ReadonlyArray<string>;

  constructor(
    private readonly config: LoggerConfig,
    parentLogger?: PinoLogger
  ) {
    this.pino = parentLogger ?? createPinoLogger(config);
    this.baseContext = config.baseContext ?? {};
    this.redactFields = config.redactFields ?? DEFAULT_REDACT_FIELDS;
  }

  /**
   * Create a child logger with additional context
   */
  child(context: LoggerContext): Logger {
    const mergedContext = {
      ...this.baseContext,
      ...context,
      attributes: {
        ...this.baseContext.attributes,
        ...context.attributes,
      },
    };
    return new Logger(
      { ...this.config, baseContext: mergedContext },
      this.pino
    );
  }

  /**
   * Create a child logger scoped to a tenant
   */
  forTenant(tenantId: string): Logger {
    return this.child({ tenantId });
  }

  /**
   * Create a child logger scoped to a user
   */
  forUser(userId: string): Logger {
    return this.child({ userId });
  }

  /**
   * Create a child logger scoped to a request
   */
  forRequest(requestId: string, sessionId?: string): Logger {
    return this.child({ requestId, sessionId });
  }

  /**
   * Build log object with context.
   *
   * The merged object is passed through the recursive {@link redactPII}
   * walk so any PII-named key is censored at ANY nesting depth — not just
   * the top 3 levels Pino's static `redact.paths` can reach. `tenantId`,
   * `requestId`, etc. are intentionally NOT in the redact field set, so
   * they survive; only sensitive field names (phone*, email, token,
   * nationalId, …) are replaced.
   */
  private buildLogObj(
    data?: Record<string, unknown>
  ): Record<string, unknown> {
    const traceContext = getTraceContext();

    const merged = {
      ...(this.baseContext.tenantId && { tenantId: this.baseContext.tenantId }),
      ...(this.baseContext.userId && { userId: this.baseContext.userId }),
      ...(this.baseContext.requestId && { requestId: this.baseContext.requestId }),
      ...(this.baseContext.sessionId && { sessionId: this.baseContext.sessionId }),
      ...traceContext,
      ...this.baseContext.attributes,
      ...data,
    };

    return this.redact(merged);
  }

  /**
   * Depth-unbounded PII redaction over a log payload. Uses the shared
   * recursive walker with this logger's configured field set and a
   * `[REDACTED]` censor matching Pino's `censor` so output is uniform
   * regardless of which path (static vs recursive) catches the field.
   */
  private redact(obj: Record<string, unknown>): Record<string, unknown> {
    return redactPII(obj, {
      fields: this.redactFields,
      format: () => '[REDACTED]',
    });
  }

  /** Log at trace level */
  trace(message: string, data?: Record<string, unknown>): void {
    this.pino.trace(this.buildLogObj(data), message);
  }

  /** Log at debug level */
  debug(message: string, data?: Record<string, unknown>): void {
    this.pino.debug(this.buildLogObj(data), message);
  }

  /** Log at info level */
  info(message: string, data?: Record<string, unknown>): void {
    this.pino.info(this.buildLogObj(data), message);
  }

  /** Log at warn level */
  warn(message: string, data?: Record<string, unknown>): void {
    this.pino.warn(this.buildLogObj(data), message);
  }

  /** Log at error level */
  error(message: string, error?: Error | Record<string, unknown>, data?: Record<string, unknown>): void {
    // Build the merged context+data first, then fold the error in, then
    // redact the WHOLE object once. Redacting after the merge guarantees
    // PII riding inside an error record (`{ ...error }`) or a stack/message
    // is censored at any depth — not just the `data` portion.
    let logData = this.buildLogObj(data);

    if (error instanceof Error) {
      logData = {
        ...logData,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
      };

      // Also record error on current span if available
      const span = trace.getSpan(context.active());
      if (span) {
        span.recordException(error);
        span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      }
    } else if (error) {
      logData = { ...logData, ...error };
    }

    this.pino.error(this.redact(logData), message);
  }

  /** Log at fatal level */
  fatal(message: string, error?: Error | Record<string, unknown>, data?: Record<string, unknown>): void {
    let logData = this.buildLogObj(data);

    if (error instanceof Error) {
      logData = {
        ...logData,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
      };
    } else if (error) {
      logData = { ...logData, ...error };
    }

    this.pino.fatal(this.redact(logData), message);
  }

  /**
   * Get the underlying Pino logger (for advanced use)
   */
  getPino(): PinoLogger {
    return this.pino;
  }
}

/**
 * Create a logger from telemetry config
 */
export function createLogger(config: TelemetryConfig): Logger {
  return new Logger({
    service: config.service,
    level: config.logLevel,
    pretty: config.consoleExport,
    redactFields: config.redactFields,
  });
}
