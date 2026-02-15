/**
 * Structured logger for notifications service
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

const logLevelOrder: LogLevel[] = ['debug', 'info', 'warn', 'error'];
const minLevel = (process.env['LOG_LEVEL'] as LogLevel) ?? 'info';

function shouldLog(level: LogLevel): boolean {
  const minIdx = logLevelOrder.indexOf(minLevel);
  const levelIdx = logLevelOrder.indexOf(level);
  return levelIdx >= minIdx;
}

function formatMessage(level: string, message: string, meta?: Record<string, unknown>): string {
  const timestamp = new Date().toISOString();
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
}

export function createLogger(name: string): Logger {
  const prefix = `[${name}]`;
  return {
    debug(message: string, meta?: Record<string, unknown>) {
      if (shouldLog('debug')) {
        console.debug(prefix, formatMessage('debug', message, meta));
      }
    },
    info(message: string, meta?: Record<string, unknown>) {
      if (shouldLog('info')) {
        console.info(prefix, formatMessage('info', message, meta));
      }
    },
    warn(message: string, meta?: Record<string, unknown>) {
      if (shouldLog('warn')) {
        console.warn(prefix, formatMessage('warn', message, meta));
      }
    },
    error(message: string, meta?: Record<string, unknown>) {
      if (shouldLog('error')) {
        console.error(prefix, formatMessage('error', message, meta));
      }
    },
  };
}
