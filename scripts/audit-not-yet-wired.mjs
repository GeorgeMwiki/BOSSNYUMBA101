#!/usr/bin/env node
/**
 * Audit-not-yet-wired — Phase F.7
 *
 * Enumerates every place in production code where a `NOT_YET_WIRED`
 * placeholder, `notYetWired*()` factory, or `NotYetWiredError` survives —
 * surfaces them so the F4 connector wave (and follow-up phases) can
 * progressively retire them.
 *
 * Output: `.audit/not-yet-wired-targets.md`
 *
 * Exit code:
 *   0  audit ran AND count ≤ threshold (CI passes)
 *   1  fatal failure (filesystem error) OR count > threshold (CI fails)
 *
 * Threshold tuning:
 *   - Set via env var `NOT_YET_WIRED_THRESHOLD` (default: 10)
 *   - Start at 10 during F4 connector wave (some grace expected)
 *   - Tighten to 0 once the wave lands
 *
 * Modeled after `scripts/audit-jurisdictional-literals.mjs` (Phase E.0).
 */

import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  statSync,
  readdirSync,
} from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = process.cwd();
const REPORT_DIR = join(ROOT, '.audit');
const REPORT_PATH = join(REPORT_DIR, 'not-yet-wired-targets.md');

const DEFAULT_THRESHOLD = 10;
const THRESHOLD = Number.isFinite(Number(process.env.NOT_YET_WIRED_THRESHOLD))
  ? Number(process.env.NOT_YET_WIRED_THRESHOLD)
  : DEFAULT_THRESHOLD;

// ---------------------------------------------------------------------------
// Vocabulary — kept narrow so we don't flag unrelated strings.
// ---------------------------------------------------------------------------

/**
 * Patterns we flag in production code. Each `class` is a violation bucket
 * surfaced in the summary; `rx` is the matching regex (per line).
 */
const PATTERNS = Object.freeze([
  {
    class: 'NOT_YET_WIRED literal',
    rx: /\bNOT_YET_WIRED\b/,
  },
  {
    class: 'notYetWired*() factory call',
    rx: /\bnotYetWired[A-Z][A-Za-z0-9_]*\s*\(/,
  },
  {
    class: 'NotYetWiredError throw / construction',
    rx: /(?:throw\s+new\s+|new\s+|\bextends\s+)NotYetWiredError\b/,
  },
]);

/**
 * Production-path file extensions. We scan TS/JS source under packages/,
 * services/, apps/. Test files / fixtures are excluded via allowlist.
 */
const SCAN_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.mts',
  '.cts',
]);

/** Directory names we never descend into. */
const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.next',
  '.turbo',
  '.git',
  '.blob',
  'e2e-report',
  'playwright-report',
  'test-results',
  'generated',
  '.audit',
  '.claude',
]);

/**
 * Allowlist — paths where NOT_YET_WIRED is permitted by design.
 *
 * Notably:
 *   - tests / fixtures
 *   - the error class definition itself
 *   - documentation
 *   - the audit script (this file)
 *   - composition-root fallbacks behind an explicit env-var-unset guard
 *     (detected by `isCompositionFallback()` line-window check, not by
 *     path allowlist)
 */
const ALLOWLIST_PATTERNS = [
  // Tests / fixtures
  /\/__tests__\//,
  /\/__fixtures__\//,
  /\/fixtures\//,
  /\.test\.[cm]?[jt]sx?$/,
  /\.spec\.[cm]?[jt]sx?$/,
  /^e2e\//,
  /\/test\/integration\//,
  // Documentation
  /\.md$/,
  // The audit script itself
  /scripts\/audit-not-yet-wired\.mjs$/,
  // The error class definitions (intended to declare the type)
  /not-yet-wired-error\.ts$/,
  /NotYetWiredError\.ts$/,
];

function isAllowlisted(relPath) {
  const normalised = relPath.split(sep).join('/');
  return ALLOWLIST_PATTERNS.some((rx) => rx.test(normalised));
}

// ---------------------------------------------------------------------------
// File walk
// ---------------------------------------------------------------------------

function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.') && entry.name !== '.audit') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      out.push(...walk(full));
    } else if (entry.isFile()) {
      const dotIdx = entry.name.lastIndexOf('.');
      if (dotIdx === -1) continue;
      const ext = entry.name.slice(dotIdx);
      if (!SCAN_EXTENSIONS.has(ext)) continue;
      out.push(full);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

/**
 * Detect violations in a single file. Returns `{ class, line, snippet }`
 * records. Composition-root fallback lines are skipped when the line above
 * has the env-guarded ternary shape:
 *
 *   env.X ? realAdapter() : notYetWiredX()
 *
 * That shape is a legitimate "wire when configured, no-op otherwise" pattern
 * the F4 connector wave uses. Our heuristic accepts it.
 */
function detectViolations(text) {
  const findings = [];
  const lines = text.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.length === 0) continue;

    for (const { class: cls, rx } of PATTERNS) {
      if (rx.test(line)) {
        if (isCompositionFallback(lines, i, line)) {
          // Whitelisted composition-root pattern.
          continue;
        }
        findings.push({
          class: cls,
          line: i + 1,
          snippet: line.trim().slice(0, 240),
        });
        // Don't double-flag the same line with multiple patterns; first match wins.
        break;
      }
    }
  }
  return findings;
}

/**
 * Composition-root fallback heuristic.
 *
 * Accepts shape: env.X ? realAdapter(...) : notYetWiredX(...)
 *
 * We accept either single-line ternaries or 2-line ternaries (`?` on prior
 * line, `:` on current). Conservative: must explicitly reference `env.` or
 * `process.env.` token in the same window.
 */
function isCompositionFallback(lines, idx, line) {
  // Look across a 5-line window: prev2..idx..next2
  const start = Math.max(0, idx - 2);
  const end = Math.min(lines.length, idx + 3);
  const window = lines.slice(start, end).join('\n');

  const envRx = /(?:\benv\.|\bprocess\.env\.|\bENV\.)\w+/;
  const ternaryRx = /\?[^?]+?:\s*(?:notYetWired|NOT_YET_WIRED)/;
  const ifFallbackRx =
    /(?:if|else)\s*\(.*?(?:env\.|process\.env\.).*?\)/;

  // Pattern A: full ternary referencing env in window.
  if (ternaryRx.test(window) && envRx.test(window)) {
    return true;
  }
  // Pattern B: an explicit `if (env.X)` immediately above the offending line.
  for (let i = start; i < idx; i++) {
    if (ifFallbackRx.test(lines[i])) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Report writer
// ---------------------------------------------------------------------------

function renderReport(allFindings, files, threshold) {
  const summaryBuckets = new Map();
  for (const f of allFindings) {
    summaryBuckets.set(f.class, (summaryBuckets.get(f.class) || 0) + 1);
  }
  const total = allFindings.length;

  let out = '';
  out += '# Not-Yet-Wired Targets\n';
  out += '_Generated by `scripts/audit-not-yet-wired.mjs`_\n\n';
  out += `_Generated at: ${new Date().toISOString()}_\n\n`;
  out += 'This is the worklist for retiring `NOT_YET_WIRED` placeholders ';
  out += 'from production code paths. Each entry should be replaced with a ';
  out += 'real connector / adapter wired in the composition root.\n\n';

  out += '## Summary\n\n';
  out += '| Class | Count |\n|---|---|\n';
  for (const { class: cls } of PATTERNS) {
    out += `| ${cls} | ${summaryBuckets.get(cls) || 0} |\n`;
  }
  out += `| **Total** | **${total}** |\n\n`;
  out += `**Threshold**: ${threshold}\n\n`;
  out += `**Files scanned**: ${files.length}\n\n`;
  out += `**Files with violations**: ${new Set(allFindings.map((f) => f.file)).size}\n\n`;
  out += `**Status**: ${total > threshold ? '❌ OVER THRESHOLD' : '✅ within threshold'}\n\n`;

  const byClass = new Map();
  for (const f of allFindings) {
    if (!byClass.has(f.class)) byClass.set(f.class, []);
    byClass.get(f.class).push(f);
  }

  for (const { class: cls } of PATTERNS) {
    const items = byClass.get(cls) || [];
    if (items.length === 0) continue;
    out += `## ${cls}\n\n`;
    for (const item of items) {
      out += `- \`${item.file}:${item.line}\` — \`${item.snippet}\`\n`;
    }
    out += '\n';
  }

  return out;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const files = walk(ROOT);
  const allFindings = [];

  for (const absPath of files) {
    const rel = relative(ROOT, absPath);
    if (isAllowlisted(rel)) continue;

    let text;
    try {
      const st = statSync(absPath);
      if (st.size > 2_000_000) continue;
      text = readFileSync(absPath, 'utf8');
    } catch {
      continue;
    }

    const findings = detectViolations(text);
    for (const f of findings) {
      allFindings.push({ ...f, file: rel.split(sep).join('/') });
    }
  }

  try {
    mkdirSync(REPORT_DIR, { recursive: true });
  } catch (e) {
    process.stderr.write(`Failed to create ${REPORT_DIR}: ${e.message}\n`);
    process.exit(1);
  }

  const report = renderReport(allFindings, files, THRESHOLD);
  writeFileSync(REPORT_PATH, report, 'utf8');

  const total = allFindings.length;
  const filesWithViolations = new Set(allFindings.map((f) => f.file)).size;

  process.stderr.write(
    `[audit-not-yet-wired] scanned ${files.length} files, ` +
      `found ${total} violations across ${filesWithViolations} files. ` +
      `Threshold: ${THRESHOLD}. ` +
      `Report: ${relative(ROOT, REPORT_PATH)}\n`,
  );

  if (total > THRESHOLD) {
    process.stderr.write(
      `[audit-not-yet-wired] FAIL — count ${total} exceeds threshold ${THRESHOLD}.\n`,
    );
    process.exit(1);
  }

  process.exit(0);
}

main();
