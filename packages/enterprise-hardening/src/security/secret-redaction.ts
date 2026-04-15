/**
 * Secret redaction helpers.
 *
 * Used by loggers and error reporters to strip credentials, tokens, and other
 * sensitive values from arbitrary payloads before they leave the process.
 */

const DEFAULT_SENSITIVE_KEYS: ReadonlySet<string> = new Set([
  'password',
  'passcode',
  'pin',
  'secret',
  'token',
  'access_token',
  'refresh_token',
  'id_token',
  'api_key',
  'apikey',
  'x-api-key',
  'authorization',
  'cookie',
  'set-cookie',
  'credit_card',
  'creditcard',
  'card_number',
  'cvv',
  'ssn',
  'bank_account',
  'bankaccount',
  'private_key',
  'client_secret',
]);

const DEFAULT_PATTERNS: RegExp[] = [
  // Bearer tokens
  /\bBearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
  // Long random hex/base64 secrets
  /\b[A-Fa-f0-9]{32,}\b/g,
  // AWS secret-like keys
  /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g,
  // JWTs
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
  // PAN-like numbers
  /\b(?:\d[ -]?){13,19}\b/g,
];

export interface RedactionConfig {
  readonly keys?: Iterable<string>;
  readonly patterns?: readonly RegExp[];
  readonly replacement?: string;
  readonly maxDepth?: number;
}

const REDACTED = '[REDACTED]';

/**
 * Produce a deep-copied, redacted version of `value`.
 * Cycles are safely handled; circular references become `[CIRCULAR]`.
 */
export function redact(
  value: unknown,
  config: RedactionConfig = {}
): unknown {
  const keys = new Set(
    [...DEFAULT_SENSITIVE_KEYS, ...(config.keys ?? [])].map((k) =>
      k.toLowerCase()
    )
  );
  const patterns = config.patterns ?? DEFAULT_PATTERNS;
  const replacement = config.replacement ?? REDACTED;
  const maxDepth = config.maxDepth ?? 32;
  const seen = new WeakSet<object>();

  const walk = (val: unknown, depth: number): unknown => {
    if (depth > maxDepth) return '[TRUNCATED]';
    if (val == null) return val;
    if (typeof val === 'string') {
      return redactString(val, patterns, replacement);
    }
    if (typeof val !== 'object') {
      return val;
    }
    if (seen.has(val as object)) return '[CIRCULAR]';
    seen.add(val as object);

    if (Array.isArray(val)) {
      return val.map((v) => walk(v, depth + 1));
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      if (keys.has(k.toLowerCase())) {
        out[k] = replacement;
      } else {
        out[k] = walk(v, depth + 1);
      }
    }
    return out;
  };

  return walk(value, 0);
}

/**
 * Replace any substrings in a string that match known secret patterns.
 */
export function redactString(
  value: string,
  patterns: readonly RegExp[] = DEFAULT_PATTERNS,
  replacement: string = REDACTED
): string {
  let out = value;
  for (const p of patterns) {
    // Clone regex to reset lastIndex on global flag.
    const flags = p.flags.includes('g') ? p.flags : p.flags + 'g';
    out = out.replace(new RegExp(p.source, flags), replacement);
  }
  return out;
}
