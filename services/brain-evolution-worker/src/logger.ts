/**
 * Structured logger for the brain-evolution-worker service.
 *
 * Mirrors `services/consolidation-worker/src/logger.ts` — a thin pino
 * wrapper exposing the `BrainWorkerLogger` shape (`info|warn|error(obj,
 * msg?)`) the pipeline stages and cron-handler consume.
 *
 * Pino only — no `console.*` in services (CLAUDE.md hard rule; pino
 * handles redaction). `pino` resolves via the workspace's hoisted
 * dependency, the same way the sibling consolidation-worker's logger does.
 */

import { pino } from 'pino';

import type { BrainWorkerLogger } from './types.js';

const pinoLogger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  base: { service: 'brain-evolution-worker' },
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
 * Worker logger conforming to `BrainWorkerLogger`. Pino's first arg is
 * the merge object and the second the message — the same argument order
 * the cron-handler / pipeline stages call with.
 */
export const logger: BrainWorkerLogger = {
  info: (obj, msg) => pinoLogger.info(obj, msg),
  warn: (obj, msg) => pinoLogger.warn(obj, msg),
  error: (obj, msg) => pinoLogger.error(obj, msg),
};
