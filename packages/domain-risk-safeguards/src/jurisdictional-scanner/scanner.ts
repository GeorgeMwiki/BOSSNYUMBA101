/**
 * Jurisdictional-creep class scanner.
 *
 * Codifies the silent-TZ-fallback bug we already fixed as a *class*.
 * Three patterns trigger a FAIL:
 *
 *   1. `jurisdiction === 'TZ'` (or 'KE', 'NG', etc.) literal comparison
 *      outside the approved `JurisdictionalRules` registry. Business
 *      logic must not branch on country directly; it must dispatch via
 *      `getJurisdictionalRules(tenant.country)`.
 *
 *   2. `switch (jurisdiction)` (or country/currency/locale) with no
 *      `default:` case. Missing default = silent fall-through to
 *      whatever the brain saw last = silent-fallback bug.
 *
 *   3. `country || 'TZ'` (or any '|| 'TZ'' / '|| "KE"' / numeric-currency
 *      fallback) — the literal silent-fallback pattern we fixed.
 *
 * The scanner is wire-agnostic — it accepts source text + path and
 * returns findings. The bin script wires it to the filesystem walker
 * shared with the existing `scripts/audit-jurisdictional-literals.mjs`
 * (J7 audit-coverage suite) — this is the *class* counterpart that
 * complements J7's *literal* counterpart.
 *
 * Runs in CI on every PR — see `.github/workflows/*` (wired downstream).
 */

import type {
  JurisdictionalCreepFinding,
  JurisdictionalCreepScanResult,
} from '../types.js';

/**
 * Files at these paths are *allowed* to branch on jurisdiction — they
 * are the dispatch layer itself.
 *
 * NOTE: We use regex strings (not full path matching) — the scanner is
 * filesystem-agnostic; the caller decides what gets fed in.
 */
const ALLOWLIST_PATTERNS: ReadonlyArray<RegExp> = Object.freeze([
  /packages\/domain-models\/src\/common\/jurisdictional-rules\.ts$/,
  /packages\/domain-models\/src\/common\/region-config\.ts$/,
  /packages\/compliance-plugins\/src\/(?:countries|plugins)\/[a-z]+/,
  /packages\/domain-risk-safeguards\/src\/jurisdictional-scanner\//,
  /\/__tests__\//,
  /\/__fixtures__\//,
  /\.test\.[cm]?[jt]sx?$/,
  /\.spec\.[cm]?[jt]sx?$/,
]);

/**
 * Country/jurisdiction literal pattern. We match any ISO 3166-1 alpha-2
 * uppercase code in a comparison or fallback position.
 *
 * Examples that match:
 *   jurisdiction === 'TZ'
 *   jurisdiction === "KE"
 *   country == 'NG'
 *
 * Examples that don't match (these are allowlist-style):
 *   const TZ_FILE = "tanzania.ts" // not in a comparison position
 */
const LITERAL_COMPARISON_RX = /(?:jurisdiction|country|locale|currency|taxRegime|tax_regime)\s*[!=]==?\s*['"][A-Z]{2,3}['"]/g;

/**
 * Switch statement on jurisdiction. We do a coarse match on the header
 * line, then a follow-up scan for `default:` inside the body.
 */
const SWITCH_HEADER_RX = /switch\s*\(\s*(?:tenant\.|cfg\.|opts\.)?(?:jurisdiction|country|locale|currency|taxRegime|tax_regime)\s*[\)\.]/g;

/**
 * Silent-fallback pattern — the literal class we already fixed.
 *
 * Examples that match:
 *   const country = tenant.country || 'TZ'
 *   const currency = ledger.currency || "KES"
 *   const locale = config.locale ?? 'en-TZ'
 *   const tz = tenant.timezone || 'Africa/Dar_es_Salaam'
 */
const SILENT_FALLBACK_RX = /(?:country|jurisdiction|locale|currency|taxRegime|tax_regime|timezone)\s*(?:\|\||\?\?)\s*['"][A-Za-z][A-Za-z0-9_/\-]+['"]/g;

/**
 * Is the relative path allowlisted (and thus permitted to branch)?
 */
export function isAllowlistedPath(relPath: string): boolean {
  const normalised = relPath.replace(/\\/g, '/');
  return ALLOWLIST_PATTERNS.some((rx) => rx.test(normalised));
}

/**
 * Scan a single file's source text.
 *
 * Returns a scan result. `passes` is true iff no findings.
 */
export function scanSource(args: {
  readonly file: string;
  readonly source: string;
}): JurisdictionalCreepScanResult {
  const { file, source } = args;
  if (isAllowlistedPath(file)) {
    return Object.freeze({
      file,
      passes: true,
      findings: Object.freeze([]),
    });
  }

  const findings: JurisdictionalCreepFinding[] = [];
  const lines = source.split(/\r?\n/);

  // Pre-compute a flat index of switch headers so we can re-scan for
  // a matching `default:` within the same brace-balanced block.
  const switchHeaderLines: number[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';

    // Skip comment-only lines.
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;

    // (1) Literal comparison.
    LITERAL_COMPARISON_RX.lastIndex = 0;
    const litMatch = line.match(LITERAL_COMPARISON_RX);
    if (litMatch !== null && litMatch.length > 0) {
      findings.push(
        Object.freeze({
          file,
          line: i + 1,
          snippet: trimmed.slice(0, 240),
          kind: 'literal-tz-outside-rules',
          severity: 'fail',
        }),
      );
    }

    // (2) Switch header — record for body scan below.
    SWITCH_HEADER_RX.lastIndex = 0;
    if (SWITCH_HEADER_RX.test(line)) {
      switchHeaderLines.push(i);
    }

    // (3) Silent fallback (`||` or `??` with a literal).
    SILENT_FALLBACK_RX.lastIndex = 0;
    const fbMatch = line.match(SILENT_FALLBACK_RX);
    if (fbMatch !== null && fbMatch.length > 0) {
      findings.push(
        Object.freeze({
          file,
          line: i + 1,
          snippet: trimmed.slice(0, 240),
          kind: 'country-or-tz-silent-fallback',
          severity: 'fail',
        }),
      );
    }
  }

  // (2-continued) For every switch header, look forward in the file
  // for a matching `default:` before brace-balance returns to zero.
  for (const hdr of switchHeaderLines) {
    if (!hasDefaultCase(lines, hdr)) {
      const headerLine = lines[hdr] ?? '';
      findings.push(
        Object.freeze({
          file,
          line: hdr + 1,
          snippet: headerLine.trim().slice(0, 240),
          kind: 'switch-jurisdiction-no-default',
          severity: 'fail',
        }),
      );
    }
  }

  return Object.freeze({
    file,
    passes: findings.length === 0,
    findings: Object.freeze(findings),
  });
}

/**
 * Walk forward from a switch-header line until brace-balance returns to
 * zero. If we see `default:` (or `default :`) inside that span, return
 * true. We don't try to be JS-precise — this is a heuristic. False
 * negatives are tolerable (we'd miss a violation); false positives are
 * not (we'd block valid code), so we err toward `hasDefault = true`
 * when uncertain.
 */
function hasDefaultCase(lines: ReadonlyArray<string>, headerLine: number): boolean {
  // Find the opening brace.
  let braceDepth = 0;
  let started = false;
  for (let i = headerLine; i < Math.min(lines.length, headerLine + 500); i++) {
    const line = lines[i] ?? '';
    for (const ch of line) {
      if (ch === '{') {
        braceDepth++;
        started = true;
      } else if (ch === '}') {
        braceDepth--;
        if (started && braceDepth <= 0) {
          // End of the switch body — if we got here without seeing
          // `default:` we mark missing.
          return false;
        }
      }
    }
    if (started && /(?:^|\s)default\s*:/.test(line)) {
      return true;
    }
  }
  // Heuristic safety net: if we ran out of lines without resolving,
  // assume the developer has a default somewhere we didn't see.
  return true;
}

/**
 * Scan an array of source files. Pure aggregator.
 */
export function scanSources(
  files: ReadonlyArray<{ readonly file: string; readonly source: string }>,
): ReadonlyArray<JurisdictionalCreepScanResult> {
  return Object.freeze(files.map((f) => scanSource(f)));
}
