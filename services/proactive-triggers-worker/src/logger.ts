/**
 * Structured logger for the proactive-triggers-worker bootstrap.
 *
 * Thin pino wrapper exposing the `WorkerLogger` shape the worker
 * machinery already consumes (`{info,warn,error}(obj, msg?)`). Mirrors
 * the convention used by `services/consolidation-worker/src/logger.ts`.
 *
 * CLAUDE.md hard rule: "No `console.log` in services — Pino logger only —
 * it handles redaction." The bootstrap therefore logs exclusively
 * through this module.
 */
import { pino } from 'pino';
import type { WorkerLogger } from './types.js';

const pinoLogger = pino({
  level: process.env['LOG_LEVEL'] ?? 'info',
  base: { service: 'proactive-triggers-worker' },
  redact: {
    paths: [
      'password',
      'token',
      'secret',
      'apiKey',
      'authorization',
      '*.password',
      '*.token',
      '*.secret',
    ],
    censor: '[REDACTED]',
  },
});

/**
 * The bootstrap logger. Matches {@link WorkerLogger} so it can be passed
 * straight into `launchProactiveTriggersWorker({ deps: { logger } })`.
 */
export const logger: WorkerLogger = {
  info: (obj, msg) => pinoLogger.info(obj, msg),
  warn: (obj, msg) => pinoLogger.warn(obj, msg),
  error: (obj, msg) => pinoLogger.error(obj, msg),
};
