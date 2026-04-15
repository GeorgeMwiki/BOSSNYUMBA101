/**
 * Minimal structured logger for the retention worker.
 *
 * Intentionally dependency-free so this package does not pull in any of
 * the heavier observability libs during cold start. Swap for pino or the
 * shared observability logger if/when the service is promoted to run
 * alongside the rest of the platform.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

function emit(level: LogLevel, scope: string, message: string, ctx?: Record<string, unknown>): void {
  const entry = {
    ts: new Date().toISOString(),
    level,
    scope,
    message,
    ...(ctx ?? {}),
  };
  // eslint-disable-next-line no-console
  const line = JSON.stringify(entry);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export interface Logger {
  debug(message: string, ctx?: Record<string, unknown>): void;
  info(message: string, ctx?: Record<string, unknown>): void;
  warn(message: string, ctx?: Record<string, unknown>): void;
  error(message: string, ctx?: Record<string, unknown>): void;
}

export function createLogger(scope: string): Logger {
  return {
    debug: (m, c) => emit('debug', scope, m, c),
    info: (m, c) => emit('info', scope, m, c),
    warn: (m, c) => emit('warn', scope, m, c),
    error: (m, c) => emit('error', scope, m, c),
  };
}
