/**
 * Minimal structured logger for the retention worker.
 *
 * Kept intentionally dependency-free so the worker can run in any
 * container (cron, k8s job, bare node) without extra plumbing.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  debug(msg: string, context?: Record<string, unknown>): void;
  info(msg: string, context?: Record<string, unknown>): void;
  warn(msg: string, context?: Record<string, unknown>): void;
  error(msg: string, context?: Record<string, unknown>): void;
}

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function resolveLevel(): LogLevel {
  const raw = (process.env['LOG_LEVEL'] ?? 'info').toLowerCase();
  if (raw === 'debug' || raw === 'info' || raw === 'warn' || raw === 'error') {
    return raw;
  }
  return 'info';
}

export function createLogger(name = 'retention-worker'): Logger {
  const minLevel = LEVEL_ORDER[resolveLevel()];

  const emit = (level: LogLevel, msg: string, context?: Record<string, unknown>): void => {
    if (LEVEL_ORDER[level] < minLevel) return;

    const payload = {
      ts: new Date().toISOString(),
      level,
      name,
      msg,
      ...(context ?? {}),
    };

    const line = JSON.stringify(payload);

    if (level === 'error') {
      // eslint-disable-next-line no-console
      console.error(line);
    } else if (level === 'warn') {
      // eslint-disable-next-line no-console
      console.warn(line);
    } else {
      // eslint-disable-next-line no-console
      console.log(line);
    }
  };

  return {
    debug: (msg, context) => emit('debug', msg, context),
    info: (msg, context) => emit('info', msg, context),
    warn: (msg, context) => emit('warn', msg, context),
    error: (msg, context) => emit('error', msg, context),
  };
}
