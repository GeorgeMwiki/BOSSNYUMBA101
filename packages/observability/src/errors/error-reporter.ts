/**
 * Sentry-compatible error reporting facade.
 *
 * Defines a thin, provider-agnostic interface for capturing exceptions and
 * messages with tenant/user/request context attached. The default shipped
 * implementation logs via the platform {@link Logger}; production deployments
 * inject a real Sentry client (@sentry/node) via {@link setErrorReporter}.
 */

import { Logger } from '../logging/logger.js';
import type { ServiceIdentity } from '../types/telemetry.types.js';

export type ErrorSeverity = 'fatal' | 'error' | 'warning' | 'info' | 'debug';

export interface ErrorContext {
  readonly tenantId?: string;
  readonly userId?: string;
  readonly requestId?: string;
  readonly tags?: Record<string, string>;
  readonly extra?: Record<string, unknown>;
  readonly fingerprint?: readonly string[];
  readonly severity?: ErrorSeverity;
}

/**
 * Provider interface that concrete integrations (e.g. Sentry, Rollbar)
 * must implement.
 */
export interface ErrorReporter {
  captureException(error: Error, context?: ErrorContext): void;
  captureMessage(message: string, context?: ErrorContext): void;
  flush(timeoutMs?: number): Promise<boolean>;
}

/**
 * Fallback error reporter that routes to the platform logger. This is used
 * when no external provider has been configured.
 */
export class LoggingErrorReporter implements ErrorReporter {
  constructor(private readonly logger: Logger) {}

  captureException(error: Error, context?: ErrorContext): void {
    const severity = context?.severity ?? 'error';
    const payload = this.buildPayload(context);
    if (severity === 'fatal') {
      this.logger.fatal(error.message, error, payload);
    } else {
      this.logger.error(error.message, error, payload);
    }
  }

  captureMessage(message: string, context?: ErrorContext): void {
    const severity = context?.severity ?? 'info';
    const payload = this.buildPayload(context);
    switch (severity) {
      case 'fatal':
        this.logger.fatal(message, undefined, payload);
        break;
      case 'error':
        this.logger.error(message, undefined, payload);
        break;
      case 'warning':
        this.logger.warn(message, payload);
        break;
      case 'debug':
        this.logger.debug(message, payload);
        break;
      case 'info':
      default:
        this.logger.info(message, payload);
        break;
    }
  }

  async flush(): Promise<boolean> {
    return true;
  }

  private buildPayload(context?: ErrorContext): Record<string, unknown> {
    if (!context) return {};
    return {
      ...(context.tenantId && { tenantId: context.tenantId }),
      ...(context.userId && { userId: context.userId }),
      ...(context.requestId && { requestId: context.requestId }),
      ...(context.tags && { tags: context.tags }),
      ...(context.fingerprint && { fingerprint: context.fingerprint }),
      ...(context.extra ?? {}),
    };
  }
}

let activeReporter: ErrorReporter | null = null;

/**
 * Install an error reporter for the process. Call once at bootstrap.
 */
export function setErrorReporter(reporter: ErrorReporter): void {
  activeReporter = reporter;
}

/**
 * Install a default logging-based reporter if none has been set.
 */
export function ensureErrorReporter(
  service: ServiceIdentity,
  level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal' = 'info'
): ErrorReporter {
  if (activeReporter) return activeReporter;
  activeReporter = new LoggingErrorReporter(new Logger({ service, level }));
  return activeReporter;
}

/**
 * Retrieve the active error reporter. Throws if none configured.
 */
export function getErrorReporter(): ErrorReporter {
  if (!activeReporter) {
    throw new Error(
      'No ErrorReporter configured. Call setErrorReporter() or ensureErrorReporter() at startup.'
    );
  }
  return activeReporter;
}

/**
 * Convenience helper that captures an exception via the active reporter.
 */
export function captureException(
  error: Error,
  context?: ErrorContext
): void {
  activeReporter?.captureException(error, context);
}

/**
 * Convenience helper that captures a message via the active reporter.
 */
export function captureMessage(
  message: string,
  context?: ErrorContext
): void {
  activeReporter?.captureMessage(message, context);
}

/**
 * Adapter to build an ErrorReporter that forwards to a pre-initialized
 * Sentry (`@sentry/node`) client. Applications install with:
 *
 *     import * as Sentry from '@sentry/node';
 *     Sentry.init({ dsn: ... });
 *     setErrorReporter(createSentryReporter(Sentry));
 */
export interface SentryLikeClient {
  captureException(e: unknown, hint?: unknown): unknown;
  captureMessage(msg: string, hint?: unknown): unknown;
  flush?: (timeout?: number) => Promise<boolean>;
  withScope?: (cb: (scope: SentryLikeScope) => void) => void;
}

export interface SentryLikeScope {
  setTag(key: string, value: string): void;
  setUser(user: { id?: string } | null): void;
  setExtra(key: string, value: unknown): void;
  setFingerprint(f: string[]): void;
  setLevel(level: string): void;
}

export function createSentryReporter(client: SentryLikeClient): ErrorReporter {
  const apply = (ctx: ErrorContext | undefined, fn: () => void): void => {
    if (!ctx || !client.withScope) {
      fn();
      return;
    }
    client.withScope((scope) => {
      if (ctx.tenantId) scope.setTag('tenantId', ctx.tenantId);
      if (ctx.userId) scope.setUser({ id: ctx.userId });
      if (ctx.requestId) scope.setTag('requestId', ctx.requestId);
      if (ctx.tags) {
        for (const [k, v] of Object.entries(ctx.tags)) scope.setTag(k, v);
      }
      if (ctx.extra) {
        for (const [k, v] of Object.entries(ctx.extra)) scope.setExtra(k, v);
      }
      if (ctx.fingerprint) scope.setFingerprint([...ctx.fingerprint]);
      if (ctx.severity) scope.setLevel(ctx.severity);
      fn();
    });
  };

  return {
    captureException(error, context) {
      apply(context, () => client.captureException(error));
    },
    captureMessage(message, context) {
      apply(context, () => client.captureMessage(message));
    },
    async flush(timeoutMs) {
      if (!client.flush) return true;
      return client.flush(timeoutMs);
    },
  };
}
