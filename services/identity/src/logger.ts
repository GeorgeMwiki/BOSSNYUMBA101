/**
 * Structured logger for identity service.
 *
 * Thin pino wrapper exposing a `logger.{info,warn,error,debug}(message, meta?)`
 * API matching the convention used by `services/api-gateway/src/utils/logger.ts`.
 *
 * Replaces direct `console.*` calls per `.semgrep/bossnyumba-rules.yml`
 * rule `console-statement-in-production-path` and CLAUDE.md "No `console.log`
 * in services — Pino logger only — it handles redaction."
 */
import { pino } from 'pino';

type LogMeta = Record<string, unknown>;

interface Logger {
  debug(message: string, meta?: LogMeta): void;
  info(message: string, meta?: LogMeta): void;
  warn(message: string, meta?: LogMeta): void;
  error(message: string, meta?: LogMeta): void;
}

/**
 * Pino redaction config — secrets + PII. `phone`/`recipient` cover OTP-dispatch
 * logs (an SMS recipient is personally-identifying data) and `code` covers the
 * OTP value. The `*.`- and `*.*.`-prefixed variants catch nested meta: the
 * identity loggers wrap call-site meta under a `value` key (e.g.
 * `{ value: { recipient } }`), and pino's redact paths are not implicitly
 * recursive. Exported so the redaction contract is unit-testable against the
 * exact same paths the live logger uses.
 */
export const LOG_REDACT = {
  paths: [
    'password',
    'token',
    'secret',
    'apiKey',
    'authorization',
    'phone',
    'recipient',
    'code',
    '*.password',
    '*.token',
    '*.secret',
    '*.phone',
    '*.recipient',
    '*.code',
    '*.*.phone',
    '*.*.recipient',
    '*.*.code',
  ],
  censor: '[REDACTED]',
} as const;

const pinoLogger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  base: { service: 'identity' },
  redact: { paths: [...LOG_REDACT.paths], censor: LOG_REDACT.censor },
});

export const logger: Logger = {
  debug: (message, meta) => pinoLogger.debug(meta ?? {}, message),
  info: (message, meta) => pinoLogger.info(meta ?? {}, message),
  warn: (message, meta) => pinoLogger.warn(meta ?? {}, message),
  error: (message, meta) => pinoLogger.error(meta ?? {}, message),
};
