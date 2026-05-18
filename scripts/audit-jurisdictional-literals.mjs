#!/usr/bin/env node
/**
 * Audit-jurisdictional-literals — Phase E.0
 *
 * Enumerates every place in the codebase where a jurisdictional value
 * (country-coupled identifier, phone prefix, timezone, AWS region,
 * hard-coded VAT rate, 3-currency enum) is hard-coded outside the
 * single approved registry at
 * `packages/domain-models/src/common/jurisdictional-rules.ts`.
 *
 * Output: `.audit/jurisdictional-rebind-targets.md` — the worklist for
 * the Phase E.0.4 rebind pass. The companion ESLint rule
 * `bossnyumba/no-jurisdictional-literal` surfaces the same violations
 * at lint time but starts as `warn` to avoid breaking CI on day one.
 *
 * Usage:
 *   node scripts/audit-jurisdictional-literals.mjs
 *   pnpm audit:jurisdictional
 *
 * Exit codes:
 *   0  audit ran, report written (regardless of violation count)
 *   1  fatal failure (filesystem / glob error)
 */

import { readFileSync, writeFileSync, mkdirSync, statSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = process.cwd();
const REPORT_DIR = join(ROOT, '.audit');
const REPORT_PATH = join(REPORT_DIR, 'jurisdictional-rebind-targets.md');

// ---------------------------------------------------------------------------
// Vocabulary — kept aligned with `eslint-rules/no-jurisdictional-literal.js`
// ---------------------------------------------------------------------------

const JURISDICTIONAL_IDS = [
  'NIDA',
  'KRA',
  'TRA',
  'KRA PIN',
  'eRITS',
  'eArdhi',
  'Ardhisasa',
  'M-Pesa',
  'GePG',
  'NRC',
  'Huduma',
];

const PHONE_PREFIXES = ['+254', '+255'];
const TIMEZONES = ['Africa/Dar_es_Salaam', 'Africa/Nairobi'];
const AWS_REGIONS = ['eu-west-1', 'us-east-1'];

// File-extensions we scan.
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

// Skip these directories entirely (vendored / generated / not-our-source).
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

// Allowlist by relative path — same shape as the ESLint rule's allowlist.
const ALLOWLIST_PATTERNS = [
  /packages\/domain-models\/src\/common\/jurisdictional-rules\.ts$/,
  /packages\/domain-models\/src\/common\/region-config\.ts$/,
  /packages\/connectors\/src\/adapters\/[a-z]{2,3}-[a-z0-9-]+\.ts$/,
  /packages\/database\/src\/seeds\//,
  /\/__tests__\//,
  /\/__fixtures__\//,
  /\/fixtures\//,
  /\.test\.[cm]?[jt]sx?$/,
  /\.spec\.[cm]?[jt]sx?$/,
  /\.md$/,
  /eslint-rules\//,
  /scripts\/audit-jurisdictional-literals\.mjs$/,
];

function isAllowlisted(relPath) {
  const normalised = relPath.split(sep).join('/');
  return ALLOWLIST_PATTERNS.some((rx) => rx.test(normalised));
}

// ---------------------------------------------------------------------------
// File walk
// ---------------------------------------------------------------------------

/**
 * Recursive directory walk. Pure (no shared mutable state) — returns a
 * fresh array each call. Skips SKIP_DIRS unconditionally.
 */
function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.') && entry.name !== '.audit') {
      // dot-files / dot-dirs (.git, .turbo, etc.) — skip
      continue;
    }
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
 * Detect violations in a single file's text. Returns an array of
 * `{ class, value, line, snippet }` records. Pure — does not touch disk.
 */
function detectViolations(text) {
  const findings = [];
  const lines = text.split(/\r?\n/);

  // Word-boundary regexes for jurisdictional identifiers. We require the
  // token to be flanked by non-alphanumerics (or string boundary) to
  // avoid catching benign substrings like 'mpesaReceipts' or 'kraken'.
  const idRegexes = JURISDICTIONAL_IDS.map((id) => ({
    id,
    rx: new RegExp(
      `(^|[^A-Za-z0-9])${id.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}([^A-Za-z0-9]|$)`,
      'g'
    ),
  }));

  // VAT-rate heuristic: a numeric literal 0.18 or 18.0 followed by
  // commentary mentioning VAT in the same line / window.
  const vatNumericRx = /\b(0\.18|0\.16|18\.0|16\.0)\b/;
  const vatContextRx = /vat|tax\s*rate/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.length === 0) continue;

    // Identifiers
    for (const { id, rx } of idRegexes) {
      rx.lastIndex = 0;
      if (rx.test(line)) {
        // Avoid double-flagging on identifier collisions ("Huduma" within URL)
        findings.push({
          class: classifyId(id),
          value: id,
          line: i + 1,
          snippet: line.trim().slice(0, 240),
        });
      }
    }

    // Phone prefixes
    for (const prefix of PHONE_PREFIXES) {
      // \+254 followed by a digit anywhere on the line
      const escaped = prefix.replace(/\+/g, '\\+');
      if (new RegExp(`${escaped}\\d`).test(line)) {
        findings.push({
          class: 'Phone prefix in biz logic',
          value: prefix,
          line: i + 1,
          snippet: line.trim().slice(0, 240),
        });
      }
    }

    // Timezones
    for (const tz of TIMEZONES) {
      if (line.includes(tz)) {
        findings.push({
          class: 'Timezone literal',
          value: tz,
          line: i + 1,
          snippet: line.trim().slice(0, 240),
        });
      }
    }

    // AWS regions
    for (const region of AWS_REGIONS) {
      if (line.includes(region)) {
        findings.push({
          class: 'AWS region default',
          value: region,
          line: i + 1,
          snippet: line.trim().slice(0, 240),
        });
      }
    }

    // VAT rate numeric — require nearby context (within 4 lines, or
    // on the same line)
    if (vatNumericRx.test(line)) {
      const windowStart = Math.max(0, i - 4);
      const windowEnd = Math.min(lines.length, i + 5);
      const window = lines.slice(windowStart, windowEnd).join('\n');
      if (vatContextRx.test(window)) {
        const match = line.match(vatNumericRx);
        findings.push({
          class: 'Hardcoded VAT rate',
          value: match ? match[0] : '0.18',
          line: i + 1,
          snippet: line.trim().slice(0, 240),
        });
      }
    }
  }

  // 3-currency enum heuristic — done on whole-file text so we catch
  // multi-line union declarations.
  // Pattern: a `'KES'|'TZS'|'USD'` (or similar) with 2-4 members of
  // exactly 3-uppercase-letter strings, at least one being KES or TZS.
  const enumRx =
    /(?:type|=)\s+[A-Z][A-Za-z]*\s*=\s*((?:'[A-Z]{3}'\s*\|\s*){1,4}'[A-Z]{3}')/g;
  let match;
  while ((match = enumRx.exec(text)) !== null) {
    const union = match[1];
    const codes = union.match(/'[A-Z]{3}'/g) || [];
    const flat = codes.map((c) => c.slice(1, -1));
    if (flat.some((c) => c === 'KES' || c === 'TZS')) {
      // Find which line the match starts on
      const upTo = text.slice(0, match.index);
      const lineNo = (upTo.match(/\n/g) || []).length + 1;
      findings.push({
        class: '3-currency enum',
        value: flat.join(' | '),
        line: lineNo,
        snippet: union.slice(0, 240),
      });
    }
  }

  return findings;
}

function classifyId(id) {
  switch (id) {
    case 'NIDA':
      return 'NIDA refs outside dedicated module';
    case 'KRA':
    case 'KRA PIN':
      return 'KRA refs outside dedicated module';
    case 'TRA':
      return 'TRA refs outside dedicated module';
    case 'M-Pesa':
    case 'GePG':
      return 'Mobile-money / bank-rail literal';
    case 'eArdhi':
    case 'Ardhisasa':
    case 'eRITS':
      return 'Land-registry / e-gov portal literal';
    case 'Huduma':
    case 'NRC':
      return 'National-ID literal';
    default:
      return 'Other jurisdictional identifier';
  }
}

// ---------------------------------------------------------------------------
// Report writer
// ---------------------------------------------------------------------------

function renderReport(allFindings) {
  const summaryBuckets = new Map();
  for (const f of allFindings) {
    const key = f.class;
    summaryBuckets.set(key, (summaryBuckets.get(key) || 0) + 1);
  }
  const total = allFindings.length;

  let out = '';
  out += '# Jurisdictional Rebind Targets\n';
  out += '_Generated by `scripts/audit-jurisdictional-literals.mjs`_\n\n';
  out += `_Generated at: ${new Date().toISOString()}_\n\n`;
  out += 'This is the worklist for the Phase E.0.4 rebind pass — each ';
  out += 'entry should be replaced with `getJurisdictionalRules(tenant.country).<path>`.\n\n';

  out += '## Summary\n\n';
  out += '| Class | Count |\n|---|---|\n';
  const orderedClasses = [
    'NIDA refs outside dedicated module',
    'KRA refs outside dedicated module',
    'TRA refs outside dedicated module',
    'Mobile-money / bank-rail literal',
    'Land-registry / e-gov portal literal',
    'National-ID literal',
    'Other jurisdictional identifier',
    'Phone prefix in biz logic',
    'Timezone literal',
    'AWS region default',
    'Hardcoded VAT rate',
    '3-currency enum',
  ];
  for (const cls of orderedClasses) {
    out += `| ${cls} | ${summaryBuckets.get(cls) || 0} |\n`;
  }
  out += `| **Total** | **${total}** |\n\n`;

  // Group findings by class then by file
  const byClass = new Map();
  for (const f of allFindings) {
    if (!byClass.has(f.class)) byClass.set(f.class, []);
    byClass.get(f.class).push(f);
  }

  for (const cls of orderedClasses) {
    const items = byClass.get(cls) || [];
    if (items.length === 0) continue;
    out += `## ${cls}\n\n`;
    for (const item of items) {
      out += `- \`${item.file}:${item.line}\` — \`'${item.value}'\` literal\n`;
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
      if (st.size > 2_000_000) continue; // skip giant files
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
    console.error(`Failed to create ${REPORT_DIR}: ${e.message}`);
    process.exit(1);
  }

  const report = renderReport(allFindings);
  writeFileSync(REPORT_PATH, report, 'utf8');

  // Summary to stdout
  console.warn(
    `[audit-jurisdictional] scanned ${files.length} files, ` +
      `found ${allFindings.length} violations across ` +
      `${new Set(allFindings.map((f) => f.file)).size} files. ` +
      `Report: ${relative(ROOT, REPORT_PATH)}`
  );
}

main();
