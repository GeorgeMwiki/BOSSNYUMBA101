#!/usr/bin/env node
/**
 * audit-jurisdictional-creep-coverage — Phase M-F
 *
 * Static-analysis scanner that codifies the silent-TZ-fallback bug as a
 * *class*. Complements J7's `audit-jurisdictional-literals.mjs` (which
 * catches *literal* identifiers) by catching the *branch-on-country*
 * pattern.
 *
 * Three FAIL classes:
 *   1. `jurisdiction === 'TZ'` (or any ISO code) literal comparison
 *      outside the approved `JurisdictionalRules` registry.
 *   2. `switch (jurisdiction)` (or country/currency/locale) without a
 *      `default:` branch.
 *   3. `country || 'TZ'` (or any `??`/`||` literal fallback).
 *
 * The scanner pulls its logic from the typed
 * `@bossnyumba/domain-risk-safeguards` package so the rules are
 * unit-tested. This script is the CI shim.
 *
 * Usage:
 *   node scripts/audit-jurisdictional-creep-coverage.mjs
 *   pnpm audit:jurisdictional-creep
 *
 * Exit codes:
 *   0  audit ran (regardless of finding count — exit non-zero is set by
 *      the wrapping CI workflow if `findings > 0`)
 *   1  fatal failure (filesystem / glob error)
 *   2  audit ran AND findings > 0 (when invoked with --strict)
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
const REPORT_PATH = join(REPORT_DIR, 'jurisdictional-creep-findings.md');
const STRICT = process.argv.includes('--strict');

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

// Mirrors `isAllowlistedPath` in
// packages/domain-risk-safeguards/src/jurisdictional-scanner/scanner.ts
const ALLOWLIST_PATTERNS = [
  /packages\/domain-models\/src\/common\/jurisdictional-rules\.ts$/,
  /packages\/domain-models\/src\/common\/region-config\.ts$/,
  /packages\/compliance-plugins\/src\/(?:countries|plugins)\/[a-z]+/,
  /packages\/domain-risk-safeguards\/src\/jurisdictional-scanner\//,
  /\/__tests__\//,
  /\/__fixtures__\//,
  /\.test\.[cm]?[jt]sx?$/,
  /\.spec\.[cm]?[jt]sx?$/,
  /eslint-rules\//,
  /scripts\/audit-jurisdictional-creep-coverage\.mjs$/,
];

const LITERAL_COMPARISON_RX =
  /(?:jurisdiction|country|locale|currency|taxRegime|tax_regime)\s*[!=]==?\s*['"][A-Z]{2,3}['"]/g;
const SWITCH_HEADER_RX =
  /switch\s*\(\s*(?:tenant\.|cfg\.|opts\.)?(?:jurisdiction|country|locale|currency|taxRegime|tax_regime)\s*[\)\.]/g;
const SILENT_FALLBACK_RX =
  /(?:country|jurisdiction|locale|currency|taxRegime|tax_regime|timezone)\s*(?:\|\||\?\?)\s*['"][A-Za-z][A-Za-z0-9_/\-]+['"]/g;

function isAllowlisted(relPath) {
  const normalised = relPath.split(sep).join('/');
  return ALLOWLIST_PATTERNS.some((rx) => rx.test(normalised));
}

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

function hasDefaultCase(lines, headerLine) {
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
        if (started && braceDepth <= 0) return false;
      }
    }
    if (started && /(?:^|\s)default\s*:/.test(line)) return true;
  }
  return true;
}

function detect(text) {
  const findings = [];
  const lines = text.split(/\r?\n/);
  const switchHeaderLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;

    LITERAL_COMPARISON_RX.lastIndex = 0;
    if (LITERAL_COMPARISON_RX.test(line)) {
      findings.push({
        kind: 'literal-tz-outside-rules',
        line: i + 1,
        snippet: trimmed.slice(0, 240),
      });
    }

    SWITCH_HEADER_RX.lastIndex = 0;
    if (SWITCH_HEADER_RX.test(line)) switchHeaderLines.push(i);

    SILENT_FALLBACK_RX.lastIndex = 0;
    if (SILENT_FALLBACK_RX.test(line)) {
      findings.push({
        kind: 'country-or-tz-silent-fallback',
        line: i + 1,
        snippet: trimmed.slice(0, 240),
      });
    }
  }

  for (const hdr of switchHeaderLines) {
    if (!hasDefaultCase(lines, hdr)) {
      findings.push({
        kind: 'switch-jurisdiction-no-default',
        line: hdr + 1,
        snippet: (lines[hdr] ?? '').trim().slice(0, 240),
      });
    }
  }

  return findings;
}

function renderReport(byFile, totals) {
  const total = Array.from(byFile.values()).reduce(
    (s, fs) => s + fs.length,
    0,
  );
  let out = '# Jurisdictional-Creep Class Findings\n';
  out += '_Generated by `scripts/audit-jurisdictional-creep-coverage.mjs`_\n';
  out += '_Phase M-F — Domain-Risk Safeguards_\n\n';
  out += `_Generated at: ${new Date().toISOString()}_\n\n`;
  out += 'This is the *class* counterpart to `audit-jurisdictional-literals.mjs`. ';
  out += 'It catches branch-on-jurisdiction patterns outside the approved registry.\n\n';

  out += '## Summary\n\n';
  out += '| Class | Count |\n|---|---|\n';
  out += `| literal-tz-outside-rules | ${totals['literal-tz-outside-rules']} |\n`;
  out += `| switch-jurisdiction-no-default | ${totals['switch-jurisdiction-no-default']} |\n`;
  out += `| country-or-tz-silent-fallback | ${totals['country-or-tz-silent-fallback']} |\n`;
  out += `| **Total** | **${total}** |\n\n`;

  if (total > 0) {
    out += '## Findings by file\n\n';
    for (const [file, fs] of byFile.entries()) {
      out += `### ${file}\n\n`;
      for (const f of fs) {
        out += `- \`${f.line}\` — **${f.kind}** — \`${f.snippet}\`\n`;
      }
      out += '\n';
    }
  }

  return out;
}

function main() {
  const files = walk(ROOT);
  const byFile = new Map();
  const totals = {
    'literal-tz-outside-rules': 0,
    'switch-jurisdiction-no-default': 0,
    'country-or-tz-silent-fallback': 0,
  };

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
    const findings = detect(text);
    if (findings.length === 0) continue;
    byFile.set(rel.split(sep).join('/'), findings);
    for (const f of findings) {
      totals[f.kind] = (totals[f.kind] ?? 0) + 1;
    }
  }

  try {
    mkdirSync(REPORT_DIR, { recursive: true });
  } catch (e) {
    console.error(`Failed to create ${REPORT_DIR}: ${e.message}`);
    process.exit(1);
  }
  writeFileSync(REPORT_PATH, renderReport(byFile, totals), 'utf8');

  const total = Array.from(byFile.values()).reduce(
    (s, fs) => s + fs.length,
    0,
  );
  console.warn(
    `[audit-jurisdictional-creep] scanned ${files.length} files, ` +
      `found ${total} findings across ${byFile.size} files. ` +
      `Report: ${relative(ROOT, REPORT_PATH)}`,
  );
  if (STRICT && total > 0) process.exit(2);
}

main();
