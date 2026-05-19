/**
 * tokenizePII / deTokenize — L3 §7.2 + §8 #11.
 *
 * Contract (verbatim from L3):
 *   "Never include raw PII in prompts. Use tokenization (T-XXXXX for
 *    tenant ID, U-XXXXX for unit) and de-tokenize only at the action
 *    layer. Already present in some BNY services — codify universally."
 *
 * Token format: `<CLASS_xXXXX>` where:
 *   - CLASS  ∈ { PHONE, EMAIL, KRA_PIN, NIDA, MPESA_ACCT, NIN,
 *                FULL_NAME, ADDRESS }
 *   - xXXXX  is a 4-char hex short-hash of (sessionSalt + original-value),
 *            lower-case-preserved so identical PII tokenises consistently.
 *
 * Determinism: within a session (one `sessionSalt`), the same input
 * value ALWAYS maps to the same token. Across sessions, tokens differ
 * (so a leaked token from session A can't be replayed against session B).
 *
 * The `tokenMap` is the inverse function — `tokenMap.get(token) → original`.
 * Wire-side caller MUST persist this encrypted in the SessionStore (K-A).
 *
 * Pure functions. Inputs immutable.
 */

import type { PiiTokenizationResult, PiiSpan } from '../types.js';
import { detectAll, classPrefix } from './detectors.js';

/**
 * FNV-1a 32-bit hash. Used for short, deterministic 4-char tokens.
 * Cryptographic strength is not required — the threat model is "model
 * leaks the token; attacker tries to derive the original." With a
 * per-session salt, even if the FNV is reversed (it's not 1:1), the
 * attacker would need the salt — and the salt never leaves SessionStore.
 *
 * For extra safety, the wire-side adapter can pass in a 16-byte
 * salt; longer salts give stronger pre-image resistance.
 */
function fnv1aHex(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    // 32-bit FNV prime: 0x01000193
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  // 32-bit hex.
  return ('0000000' + hash.toString(16)).slice(-8);
}

function shortToken(sessionSalt: string, value: string): string {
  // Lower-case the value for consistent tokenisation of e.g. "Jane@x.com"
  // vs "jane@x.com" — they should resolve to the same token.
  const normalized = value.toLowerCase();
  const hex = fnv1aHex(`${sessionSalt}::${normalized}`);
  // 4-char alphanumeric short token from the first 4 hex chars.
  return hex.slice(0, 4);
}

export interface TokenizeOptions {
  /**
   * Per-session salt. The wire-side adapter (K-A SessionStore) generates
   * this when a session opens and persists it encrypted. Defaults to
   * empty string ONLY for tests; production callers MUST supply one.
   */
  readonly sessionSalt?: string;
}

/**
 * Tokenize PII in `text`. Returns the tokenized string, an inverse
 * token map, and the original span info.
 */
export function tokenizePII(
  text: string,
  options: TokenizeOptions = {},
): PiiTokenizationResult {
  const sessionSalt = options.sessionSalt ?? '';
  if (!text) {
    return Object.freeze({
      tokenized: '',
      tokenMap: new Map(),
      spans: Object.freeze([]),
    });
  }

  const detected = detectAll(text);
  if (detected.length === 0) {
    return Object.freeze({
      tokenized: text,
      tokenMap: new Map(),
      spans: Object.freeze([]),
    });
  }

  const tokenMap = new Map<string, string>();
  const valueToToken = new Map<string, string>();
  const spans: PiiSpan[] = [];

  // Build replacement plan first (so we don't mutate during iteration).
  const replacements: { start: number; end: number; token: string }[] = [];
  for (const span of detected) {
    const cacheKey = `${span.piiClass}::${span.original.toLowerCase()}`;
    let token = valueToToken.get(cacheKey);
    if (!token) {
      const short = shortToken(sessionSalt, span.original);
      token = `<${classPrefix(span.piiClass)}_x${short}>`;
      valueToToken.set(cacheKey, token);
      tokenMap.set(token, span.original);
    }
    replacements.push({ start: span.start, end: span.end, token });
    spans.push(
      Object.freeze({
        piiClass: span.piiClass,
        original: span.original,
        token,
        start: span.start,
        end: span.end,
      }),
    );
  }

  // Apply replacements from end → start to keep earlier indices stable.
  replacements.sort((a, b) => b.start - a.start);
  let out = text;
  for (const r of replacements) {
    out = out.slice(0, r.start) + r.token + out.slice(r.end);
  }

  return Object.freeze({
    tokenized: out,
    tokenMap,
    spans: Object.freeze(spans),
  });
}

/**
 * De-tokenize — reverse the substitution at action time.
 *
 * Walks the input string, replacing every `<CLASS_xXXXX>` it finds with
 * the original value from `tokenMap`. Tokens NOT in the map (i.e. ones
 * the model invented — a prompt-injection signal) are left intact AND
 * surfaced via the `leakedTokens` field so the wire-side adapter can
 * refuse the action.
 *
 * The action payload is treated as a string for full generality. Callers
 * that hold structured action payloads should JSON.stringify before
 * passing in and JSON.parse after.
 */
export interface DeTokenizeResult {
  readonly text: string;
  readonly invented: ReadonlyArray<string>;
  readonly resolvedTokens: ReadonlyArray<string>;
}

const TOKEN_PATTERN = /<([A-Z_]+)_x([0-9a-f]{4})>/g;

export function deTokenize(
  actionPayload: string,
  tokenMap: ReadonlyMap<string, string>,
): DeTokenizeResult {
  if (!actionPayload) {
    return Object.freeze({
      text: '',
      invented: Object.freeze([]),
      resolvedTokens: Object.freeze([]),
    });
  }

  const invented: string[] = [];
  const resolved: string[] = [];
  const text = actionPayload.replace(TOKEN_PATTERN, (full) => {
    const original = tokenMap.get(full);
    if (original !== undefined) {
      resolved.push(full);
      return original;
    }
    invented.push(full);
    return full;
  });

  return Object.freeze({
    text,
    invented: Object.freeze(invented),
    resolvedTokens: Object.freeze(resolved),
  });
}
