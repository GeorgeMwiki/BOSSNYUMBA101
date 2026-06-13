#!/usr/bin/env node
/**
 * Universal mock-data coverage scanner (Phase J7).
 *
 * Vision: "no MOCK DATA, no hardcoded fallbacks anywhere across the platform."
 *
 * The scanner walks every production TypeScript/TSX file under
 *   - `packages/* /src/**`
 *   - `services/* /src/**`
 *   - `apps/* /src/**`
 *
 * and flags any reference to:
 *   - identifier `mockData` (lower-camel)
 *   - any identifier starting with `MOCK_` (screaming-snake)
 *   - a relative path containing `__mocks__/`
 *   - NEW (Wave-parity J7.1): a *fabricated-record array* — a module-level
 *     `const NAME = [ {…}, {…} ]` of business object literals that carry
 *     FABRICATED identifiers/figures (meter numbers, account numbers,
 *     currency amounts, named properties, calendar dates) AND is consumed
 *     by render/state (`useState(NAME)` or `NAME.map(`) inside a
 *     production app surface (`apps/* /src/app/**`). This closes the
 *     "sentinel-of-sentinels" blind spot where a neutrally-named array
 *     such as `const UTILITY_SETUPS = [{ meterNumber: '04-123-4567-890' }]`
 *     shipped fabricated data straight to a fresh user while the scanner
 *     reported 0 (it only knew the literal `mockData` / `MOCK_*` tokens).
 *
 * Auto-allowlisted (NOT a violation):
 *   - Files under `__tests__/`, `__fixtures__/`, `__mocks__/` directories.
 *   - Files ending in `.test.ts`, `.spec.ts`, `.test.tsx`, `.spec.tsx`,
 *     `.bench.ts`, `.fixture.ts`, `.fixtures.ts`.
 *
 * Explicit allow-list:
 *   `scripts/__allowlists__/mock-data-coverage-allowlist.mjs` — every entry
 *   carries an ≥ 8-character justification (env-flag plumbing, sandbox HTTP
 *   header constants, empty-array sentinels). It also exports
 *   `FABRICATED_RECORD_ALLOWLIST` (genuinely-static config arrays that the
 *   structural pass would otherwise inspect) and `FABRICATED_RECORD_TRACKED`
 *   (in-flight fabricated arrays already owned by another fix — detected and
 *   reported as TRACKED so the class is enforced without a false red while
 *   the fix lands).
 *
 * Usage
 *   node scripts/audit-mock-data-coverage.mjs --report .audit/mock-data-coverage.json --summary .audit/mock-data-coverage.md
 */

import {
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
  existsSync,
  mkdirSync,
} from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MOCK_DATA_ALLOWLIST,
  FABRICATED_RECORD_ALLOWLIST,
  FABRICATED_RECORD_TRACKED,
} from './__allowlists__/mock-data-coverage-allowlist.mjs';

const ROOT = resolve(fileURLToPath(import.meta.url), '..', '..');

// Production violation patterns. Each must have word-boundary anchoring so
// we never spuriously match `unmockable` or `aMockDataset`.
const MOCK_PATTERNS = [
  // Lower-camel identifier `mockData` as a standalone word.
  { name: 'mockData-identifier', rx: /\bmockData\b/ },
  // Screaming-snake `MOCK_<rest>` (e.g. MOCK_USERS, MOCK_PAYMENTS).
  { name: 'MOCK_-constant', rx: /\bMOCK_[A-Z][A-Z0-9_]*/ },
  // Import / require of a `__mocks__/` directory.
  { name: '__mocks__-import', rx: /['"][^'"]*__mocks__\/[^'"]*['"]/ },
];

// ───────────────────────────────────────────────────────────────────────
// Fabricated-record structural pass (J7.1).
//
// The token pass above only knows three literal spellings. A const array of
// business object literals with a NEUTRAL name (DOCUMENTS, UTILITY_SETUPS,
// INITIAL_METER_READINGS …) sails past it even when every record is a fake
// lease or a fabricated meter number. This pass detects that shape.
//
// To stay high-precision and avoid false-positives on legitimate static
// config (enums, option lists, i18n, taxonomies), a flag requires ALL of:
//   (a) module-level `const NAME[ : Type ] = [ … ]` whose body holds ≥ 2
//       sibling object literals ({ … }, { … });
//   (b) ≥ 1 FABRICATED-business-value signal inside the body — a specific
//       meter/account number, a currency-amount literal, a named property,
//       a concrete calendar date. Generic config text (titles, descriptions,
//       option labels, enum ids) carries none of these and is left alone;
//   (c) the array is consumed by render/state: `useState(NAME)` /
//       `useState<…>(NAME)` or `NAME.map(` somewhere in the same file;
//   (d) the file lives under an `apps/* /src/app/**` production surface
//       (the path a fresh real user actually hits).
// Restricting to app-route surfaces keeps the pass off shared design-system
// demo data and package-level seed catalogues, which have their own gates.
// ───────────────────────────────────────────────────────────────────────

// Only files matching this fragment are eligible for the structural pass.
const APP_SURFACE_FRAGMENT = `${sep}src${sep}app${sep}`;

// Fabricated-business-value signals. Each is intentionally narrow: it should
// fire on a value that belongs to ONE specific (fake) real-world record, not
// on generic UI copy. Tuned against the known onboarding fabrications
// (`04-123-4567-890`, `WTR-204-A`, `Unit A-204`, `KES 40,000`,
// `Sunset Apartments`, `June 1, 2024`).
const FABRICATED_VALUE_SIGNALS = [
  // Meter / account / serial numbers. Two high-precision shapes, both
  // CAREFULLY anchored so an ISO date `'2024-02-10'` (the classic false
  // positive: 4-2-2 all-numeric) can NEVER match:
  //   • letter-prefixed code   — 'WTR-204-A', 'ACC-90211'
  //   • ≥4 hyphen-joined numeric groups — '04-123-4567-890' (a date has 3)
  // Whole-string anchored inside the quotes so a trailing date fragment in
  // a longer sentence can't sneak through.
  {
    name: 'meter-or-account-number',
    rx: /['"](?:[A-Z]{2,5}-\d{2,}(?:-[A-Z0-9]{1,5})*|\d{2,}-\d{1,}-\d{1,}-\d{1,}(?:-\d{1,})*)['"]/,
  },
  // Currency-amount literal: ISO/known code or symbol followed by a
  // thousands-grouped or ≥4-digit figure (e.g. 'KES 40,000', 'TZS 1,200,000').
  {
    name: 'currency-amount-literal',
    rx: /\b(?:KES|TZS|UGX|NGN|USD|EUR|GBP)\s?\d{1,3}(?:,\d{3})+\b/,
  },
  // Named unit / property reference: "Unit X-NNN" or "… Apartments/Towers/
  // Estate/Residency/Court/Villas" inside a quote — a fabricated address.
  {
    name: 'named-property-or-unit',
    rx: /\b(?:Unit|Apartment|Apt|Flat)\s+[A-Z]?-?\d{1,4}[A-Z]?\b|\b[A-Z][a-z]+\s(?:Apartments|Towers|Estate|Residency|Residences|Court|Villas|Gardens)\b/,
  },
  // Concrete calendar date naming a month + day-or-year (e.g.
  // 'June 1, 2024', 'May 31, 2025') — a fabricated lease term, not config.
  {
    name: 'concrete-calendar-date',
    rx: /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s*\d{4}\b/,
  },
];

// Directory names that auto-allowlist a file (test / fixture territory).
const TEST_DIR_NAMES = new Set([
  '__tests__',
  '__fixtures__',
  '__mocks__',
  'test',
  'tests',
  '__bench__',
]);

// File-name suffixes that auto-allowlist a file.
const TEST_FILE_SUFFIXES = [
  '.test.ts',
  '.test.tsx',
  '.spec.ts',
  '.spec.tsx',
  '.bench.ts',
  '.fixture.ts',
  '.fixtures.ts',
  '.mock.ts',
];

// Directory names skipped entirely during the walk.
const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  '.next',
  '.turbo',
  'build',
  'coverage',
  '.audit',
]);

function isTestFile(rel) {
  const parts = rel.split(sep);
  for (const p of parts) {
    if (TEST_DIR_NAMES.has(p)) return true;
  }
  for (const s of TEST_FILE_SUFFIXES) {
    if (rel.endsWith(s)) return true;
  }
  return false;
}

function walkDir(dir, predicate, out) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) walkDir(full, predicate, out);
    else if (predicate(full, name)) out.push(full);
  }
}

function isProductionTsLike(_full, name) {
  return (
    (name.endsWith('.ts') || name.endsWith('.tsx')) &&
    !name.endsWith('.d.ts')
  );
}

function discoverFiles() {
  const files = [];
  for (const top of ['packages', 'services', 'apps']) {
    walkDir(join(ROOT, top), isProductionTsLike, files);
  }
  return files;
}

function scanFile(src) {
  const hits = [];
  const lines = src.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip pure comment lines — `// MOCK_FOO` as documentation.
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
      continue;
    }
    for (const { name, rx } of MOCK_PATTERNS) {
      const m = line.match(rx);
      if (m) {
        hits.push({ pattern: name, line: i + 1, match: m[0] });
        break;
      }
    }
  }
  return hits;
}

// Strip line- and block-comments from a source slice so fabricated-value
// signals inside documentation/JSDoc never count. Conservative: removes
// `// …` to EOL and `/* … */` spans; leaves string contents intact enough
// for our value regexes (we only need to avoid commented-out examples).
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

// Given the source and the index just AFTER the opening `[` of an array
// literal, return the bracket-balanced body (excluding the outer brackets)
// or null if unbalanced (truncated file). Quote-aware so brackets inside
// strings don't unbalance the scan.
function extractBalancedArrayBody(src, openIdx) {
  let depth = 1;
  let inStr = null;
  let prev = '';
  for (let i = openIdx; i < src.length; i++) {
    const ch = src[i];
    if (inStr) {
      if (ch === inStr && prev !== '\\') inStr = null;
      prev = ch;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inStr = ch;
      prev = ch;
      continue;
    }
    if (ch === '[') depth++;
    else if (ch === ']') {
      depth--;
      if (depth === 0) return src.slice(openIdx, i);
    }
    prev = ch;
  }
  return null;
}

// Count top-level sibling object literals `{ … }` directly inside an array
// body (depth-1 braces), so nested objects don't inflate the record count.
function countTopLevelObjects(body) {
  let depth = 0;
  let count = 0;
  let inStr = null;
  let prev = '';
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (inStr) {
      if (ch === inStr && prev !== '\\') inStr = null;
      prev = ch;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inStr = ch;
      prev = ch;
      continue;
    }
    if (ch === '{') {
      if (depth === 0) count++;
      depth++;
    } else if (ch === '}') {
      depth--;
    }
    prev = ch;
  }
  return count;
}

// Translate a character offset into a 1-based line number.
function offsetToLine(src, offset) {
  let line = 1;
  for (let i = 0; i < offset && i < src.length; i++) {
    if (src[i] === '\n') line++;
  }
  return line;
}

// Structural pass: detect fabricated-record arrays. Returns an array of
// findings { name, line, signals: string[], recordCount }. Empty when none.
function scanFabricatedRecords(rawSrc) {
  const findings = [];
  const src = stripComments(rawSrc);
  // Module-level `const NAME[ : Type ] = [` (allow leading `export`).
  const declRx = /(?:^|\n)\s*(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*(?::[^=\n]+)?=\s*\[/g;
  let m;
  while ((m = declRx.exec(src)) !== null) {
    const name = m[1];
    const openIdx = declRx.lastIndex; // index just after the `[`
    const body = extractBalancedArrayBody(src, openIdx);
    if (body === null) continue;
    // (a) ≥ 2 sibling object records.
    if (countTopLevelObjects(body) < 2) continue;
    // (b) ≥ 1 fabricated-business-value signal in the body.
    const signals = [];
    for (const { name: sigName, rx } of FABRICATED_VALUE_SIGNALS) {
      if (rx.test(body)) signals.push(sigName);
    }
    if (signals.length === 0) continue;
    // (c) consumed by render/state somewhere in the file.
    const consumed =
      new RegExp(`useState\\s*(?:<[^>]*>)?\\s*\\(\\s*${name}\\b`).test(src) ||
      new RegExp(`\\b${name}\\s*\\.\\s*map\\s*\\(`).test(src);
    if (!consumed) continue;
    findings.push({
      name,
      line: offsetToLine(rawSrc, m.index),
      signals,
      recordCount: countTopLevelObjects(body),
    });
  }
  return findings;
}

function parseArgs(argv) {
  const out = { report: null, summary: null, json: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--report') out.report = argv[++i];
    else if (a === '--summary') out.summary = argv[++i];
    else if (a === '--json') out.json = true;
  }
  return out;
}

function ensureDir(p) {
  const d = dirname(p);
  if (!existsSync(d)) mkdirSync(d, { recursive: true });
}

function main() {
  const args = parseArgs(process.argv);
  const files = discoverFiles();
  const violations = [];
  const fabricatedViolations = [];
  const fabricatedTracked = [];
  let totalScanned = 0;
  let totalTestSkipped = 0;
  let totalAllowlisted = 0;
  let totalClean = 0;
  let totalFabricatedAllowlisted = 0;

  for (const file of files) {
    const rel = relative(ROOT, file);
    totalScanned++;
    if (isTestFile(rel)) {
      totalTestSkipped++;
      continue;
    }
    const src = readFileSync(file, 'utf8');

    // ── Token pass (legacy: mockData / MOCK_* / __mocks__) ────────────
    const hits = scanFile(src);
    let countedClean = true;
    if (hits.length > 0) {
      if (MOCK_DATA_ALLOWLIST.has(rel)) {
        totalAllowlisted++;
      } else {
        violations.push({
          file: rel,
          severity: 'HIGH',
          hits: hits.slice(0, 10),
          hitCount: hits.length,
        });
      }
      countedClean = false;
    }

    // ── Structural pass (fabricated-record arrays) ────────────────────
    // Only production app-route surfaces — the path a fresh user hits.
    if (rel.includes(APP_SURFACE_FRAGMENT)) {
      const fabHits = scanFabricatedRecords(src);
      if (fabHits.length > 0) {
        countedClean = false;
        if (FABRICATED_RECORD_ALLOWLIST.has(rel)) {
          totalFabricatedAllowlisted++;
        } else if (FABRICATED_RECORD_TRACKED.has(rel)) {
          // In-flight fix owned elsewhere — detect the CLASS, report as
          // TRACKED, but do NOT fail the gate on work already in progress.
          fabricatedTracked.push({
            file: rel,
            note: FABRICATED_RECORD_TRACKED.get(rel),
            hits: fabHits.slice(0, 10),
            hitCount: fabHits.length,
          });
        } else {
          fabricatedViolations.push({
            file: rel,
            severity: 'HIGH',
            kind: 'fabricated-record-array',
            hits: fabHits.slice(0, 10),
            hitCount: fabHits.length,
          });
        }
      }
    }

    if (countedClean) totalClean++;
  }

  const staleAllowlist = [];
  for (const p of MOCK_DATA_ALLOWLIST.keys()) {
    if (!existsSync(join(ROOT, p))) staleAllowlist.push(p);
  }
  for (const p of FABRICATED_RECORD_ALLOWLIST.keys()) {
    if (!existsSync(join(ROOT, p))) staleAllowlist.push(p);
  }
  // A tracked entry whose file was deleted, OR whose fabricated array is
  // already gone, is stale — the in-flight fix has landed; drop the tracker.
  const staleTracked = [];
  for (const p of FABRICATED_RECORD_TRACKED.keys()) {
    const full = join(ROOT, p);
    if (!existsSync(full)) {
      staleTracked.push(p);
      continue;
    }
    if (scanFabricatedRecords(readFileSync(full, 'utf8')).length === 0) {
      staleTracked.push(p);
    }
  }

  const report = {
    scanner: 'mock-data-coverage',
    scannedAt: new Date().toISOString(),
    totals: {
      scanned: totalScanned,
      testSkipped: totalTestSkipped,
      clean: totalClean,
      allowlisted: totalAllowlisted,
      violations: violations.length,
      fabricatedAllowlisted: totalFabricatedAllowlisted,
      fabricatedViolations: fabricatedViolations.length,
      fabricatedTracked: fabricatedTracked.length,
    },
    violations,
    fabricatedViolations,
    fabricatedTracked,
    staleAllowlist,
    staleTracked,
  };

  if (args.report) {
    ensureDir(args.report);
    writeFileSync(args.report, JSON.stringify(report, null, 2));
  }
  if (args.summary) {
    ensureDir(args.summary);
    writeFileSync(args.summary, renderMarkdown(report));
  }

  // TRACKED fabricated-record findings are intentionally NON-fatal: the
  // class is detected and surfaced, but an in-flight fix owned elsewhere
  // must not turn the gate red. Stale trackers DO fail (force cleanup once
  // the fix lands).
  const passed =
    violations.length === 0 &&
    fabricatedViolations.length === 0 &&
    staleAllowlist.length === 0 &&
    staleTracked.length === 0;
  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.error(
      `audit-mock-data-coverage: ${totalScanned} scanned (${totalTestSkipped} test, ${totalClean} clean, ${totalAllowlisted} allowlisted), ` +
        `${violations.length} token violation(s), ${fabricatedViolations.length} fabricated-record violation(s), ` +
        `${fabricatedTracked.length} tracked — ${passed ? 'PASS' : 'FAIL'}`,
    );
    for (const v of violations.slice(0, 30)) {
      console.error(`  [${v.severity}] ${v.file} (${v.hitCount} hit${v.hitCount === 1 ? '' : 's'})`);
      for (const h of v.hits.slice(0, 3)) {
        console.error(`      L${h.line} [${h.pattern}] ${h.match}`);
      }
    }
    if (violations.length > 30) console.error(`  ... and ${violations.length - 30} more`);
    for (const v of fabricatedViolations.slice(0, 30)) {
      console.error(`  [${v.severity}] FABRICATED-RECORD ${v.file} (${v.hitCount} array${v.hitCount === 1 ? '' : 's'})`);
      for (const h of v.hits.slice(0, 3)) {
        console.error(`      L${h.line} const ${h.name} [${h.recordCount} records] signals: ${h.signals.join(', ')}`);
      }
    }
    for (const t of fabricatedTracked) {
      console.error(`  [TRACKED] FABRICATED-RECORD ${t.file} — ${t.note}`);
      for (const h of t.hits.slice(0, 3)) {
        console.error(`      L${h.line} const ${h.name} [${h.recordCount} records] signals: ${h.signals.join(', ')}`);
      }
    }
    for (const s of staleAllowlist) console.error(`  [STALE ALLOWLIST] ${s}`);
    for (const s of staleTracked) console.error(`  [STALE TRACKED — fix landed, remove tracker] ${s}`);
  }
  process.exit(passed ? 0 : 1);
}

function renderMarkdown(report) {
  const lines = [];
  lines.push('# Mock-data-coverage audit');
  lines.push('');
  lines.push(`Scanned: ${report.scannedAt}`);
  lines.push('');
  lines.push('| metric | value |');
  lines.push('|---|---|');
  lines.push(`| files scanned | ${report.totals.scanned} |`);
  lines.push(`| test/fixture skipped | ${report.totals.testSkipped} |`);
  lines.push(`| clean | ${report.totals.clean} |`);
  lines.push(`| allowlisted | ${report.totals.allowlisted} |`);
  lines.push(`| token violations | ${report.totals.violations} |`);
  lines.push(`| fabricated-record allowlisted | ${report.totals.fabricatedAllowlisted ?? 0} |`);
  lines.push(`| fabricated-record violations | ${report.totals.fabricatedViolations ?? 0} |`);
  lines.push(`| fabricated-record tracked | ${report.totals.fabricatedTracked ?? 0} |`);
  lines.push('');
  if (report.violations.length > 0) {
    lines.push('## Token violations');
    lines.push('');
    for (const v of report.violations) {
      lines.push(`- [${v.severity}] \`${v.file}\` (${v.hitCount} hit${v.hitCount === 1 ? '' : 's'})`);
      for (const h of v.hits.slice(0, 3)) {
        lines.push(`  - L${h.line} \`${h.pattern}\`: \`${h.match}\``);
      }
    }
    lines.push('');
  }
  if ((report.fabricatedViolations ?? []).length > 0) {
    lines.push('## Fabricated-record violations');
    lines.push('');
    for (const v of report.fabricatedViolations) {
      lines.push(`- [${v.severity}] \`${v.file}\` (${v.hitCount} array${v.hitCount === 1 ? '' : 's'})`);
      for (const h of v.hits.slice(0, 3)) {
        lines.push(`  - L${h.line} \`const ${h.name}\` — ${h.recordCount} records — signals: ${h.signals.join(', ')}`);
      }
    }
    lines.push('');
  }
  if ((report.fabricatedTracked ?? []).length > 0) {
    lines.push('## Fabricated-record tracked (in-flight fix, non-fatal)');
    lines.push('');
    for (const t of report.fabricatedTracked) {
      lines.push(`- \`${t.file}\` — ${t.note}`);
      for (const h of t.hits.slice(0, 3)) {
        lines.push(`  - L${h.line} \`const ${h.name}\` — ${h.recordCount} records — signals: ${h.signals.join(', ')}`);
      }
    }
    lines.push('');
  }
  if (report.staleAllowlist.length > 0) {
    lines.push('## Stale allowlist entries');
    lines.push('');
    for (const p of report.staleAllowlist) lines.push(`- \`${p}\``);
    lines.push('');
  }
  if ((report.staleTracked ?? []).length > 0) {
    lines.push('## Stale tracked entries (fix landed — remove tracker)');
    lines.push('');
    for (const p of report.staleTracked) lines.push(`- \`${p}\``);
  }
  return lines.join('\n');
}

main();
