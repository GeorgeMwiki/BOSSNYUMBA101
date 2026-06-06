/**
 * Structured logger for notifications service.
 *
 * Pino-backed per CLAUDE.md ("No `console.log` in services — Pino logger
 * only — it handles redaction.") and the convention in
 * `services/reports/src/logger.ts` / `services/api-gateway/src/utils/logger.ts`.
 *
 * PII-safe: every log call is piped through a scrubber that masks phone
 * numbers, email addresses, and obvious credential-looking fields before
 * the payload reaches Pino. The scrubber is intentionally conservative
 * (it will over-mask rather than under-mask) because WhatsApp/SMS flows
 * handle raw user identifiers at every hop. It is applied on top of Pino's
 * own `redact` paths because it masks-in-place (keeping shape for
 * debugging) rather than dropping fields outright.
 */

import { pino } from 'pino';

/** The concrete Pino logger type, derived from the factory return so we
 * don't depend on the `pino.Logger` namespace export shape under NodeNext. */
type PinoLogger = ReturnType<typeof pino>;

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

const minLevel = (process.env['LOG_LEVEL'] as LogLevel) ?? 'info';

// Keys whose value should always be masked. Lower-cased match.
const PII_KEYS = new Set([
  'phone',
  'phonenumber',
  'phone_number',
  'msisdn',
  'email',
  'to',
  'from',
  'password',
  'secret',
  'token',
  'apikey',
  'api_key',
  'authorization',
  'nationalid',
  'national_id',
  'passport',
  'ssn',
]);

// Mask a phone-number-ish string: keep country prefix + last two digits.
// e.g. "+255712345678" -> "+255*****78"
function maskPhone(value: string): string {
  const digits = value.replace(/[^\d+]/g, '');
  if (digits.length < 5) return '***';
  const last2 = digits.slice(-2);
  const prefix = digits.startsWith('+') ? digits.slice(0, 4) : digits.slice(0, 3);
  return `${prefix}*****${last2}`;
}

// Mask an email: first 2 chars of local part, domain preserved.
// e.g. "alice@example.com" -> "al***@example.com"
function maskEmail(value: string): string {
  const at = value.indexOf('@');
  if (at < 0) return '***';
  const local = value.slice(0, at);
  const domain = value.slice(at);
  const head = local.slice(0, Math.min(2, local.length));
  return `${head}***${domain}`;
}

function scrubValue(key: string, value: unknown): unknown {
  const lowerKey = key.toLowerCase();
  if (typeof value === 'string') {
    if (PII_KEYS.has(lowerKey)) {
      if (lowerKey.includes('email') || value.includes('@')) return maskEmail(value);
      if (lowerKey.includes('phone') || lowerKey === 'to' || lowerKey === 'from' || lowerKey === 'msisdn') {
        return maskPhone(value);
      }
      return '[REDACTED]';
    }
    // Heuristic fallback: any string that looks like a phone number should
    // be masked even if the key is generic (e.g. `user: "+255712345678"`).
    if (/^\+?\d{7,15}$/.test(value)) return maskPhone(value);
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length < 200) return maskEmail(value);
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return scrubMeta(value as Record<string, unknown>);
  }
  if (Array.isArray(value)) {
    return value.map((item, idx) => scrubValue(String(idx), item));
  }
  return value;
}

/**
 * Deep-clone a metadata object while masking PII.
 * Never mutates the input — safe to call on upstream-shared data.
 */
export function scrubMeta(
  meta: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (!meta) return meta;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    out[k] = scrubValue(k, v);
  }
  return out;
}

function createPinoRoot(): PinoLogger {
  return pino({
    level: minLevel,
    base: { service: 'notifications' },
    // Defence-in-depth alongside scrubMeta: drop obvious credential paths
    // outright in case they arrive un-scrubbed (e.g. nested errors).
    redact: {
      paths: [
        'password',
        'token',
        'secret',
        'apiKey',
        'api_key',
        'authorization',
        '*.password',
        '*.token',
        '*.secret',
      ],
      censor: '[REDACTED]',
    },
  });
}

// Single Pino root for the whole service. Construction is guarded: if Pino
// fails to initialise for any reason (bad transport, env misconfig), we emit
// ONE diagnostic and fall back to a silent Pino instance so the service does
// not crash on import. A bare `pino()` with no options is the safest config
// and cannot itself throw.
const pinoRoot: PinoLogger = (() => {
  try {
    return createPinoRoot();
  } catch (err) {
    // JUSTIFIED FALLBACK (CLAUDE.md exception): the configured Pino logger
    // failed to construct, so it cannot report its own failure. This is the
    // ONLY permitted console.* in the service. Once Pino is up, every log
    // goes through it (and the PII scrubber above).
    // eslint-disable-next-line no-console
    console.error('[notifications] Pino logger construction failed; falling back to silent logger', err);
    return pino({ level: 'silent' });
  }
})();

function emit(
  child: PinoLogger,
  level: LogLevel,
  message: string,
  meta?: Record<string, unknown>
): void {
  const scrubbed = scrubMeta(meta);
  child[level](scrubbed ?? {}, message);
}

export function createLogger(name: string): Logger {
  // Each named logger is a Pino child so the module name rides along on
  // every record without re-allocating the root transport.
  const child = pinoRoot.child({ name });
  return {
    debug(message: string, meta?: Record<string, unknown>) {
      emit(child, 'debug', message, meta);
    },
    info(message: string, meta?: Record<string, unknown>) {
      emit(child, 'info', message, meta);
    },
    warn(message: string, meta?: Record<string, unknown>) {
      emit(child, 'warn', message, meta);
    },
    error(message: string, meta?: Record<string, unknown>) {
      emit(child, 'error', message, meta);
    },
  };
}

/**
 * Default logger for quick use (e.g. the dispatcher) when a per-module
 * named child isn't warranted.
 */
export const logger: Logger = createLogger('notifications');
