#!/usr/bin/env node
/**
 * Universal `@ts-nocheck` coverage scanner — CI ratchet (AM3).
 *
 * Why this exists
 * ─────────────────────────────────────────────────────────────────
 * A `@ts-nocheck` directive at the top of a file (or anywhere in it)
 * disables ALL TypeScript checking for the entire file. That's not
 * a "loose escape hatch" — it's a hard regression in the type-safety
 * envelope: every property access, every cast, every return value,
 * every imported symbol is silently `any`-equivalent for that file.
 *
 * The AM3 sweep purged the codebase of every legacy `@ts-nocheck`
 * across all packages except `services/domain-services/` (owned by
 * CL-B4 in parallel). This scanner is the CI ratchet that prevents
 * regression: any new `@ts-nocheck` introduced on a PR must either
 *
 *   (a) appear in `scripts/__allowlists__/ts-nocheck-coverage-allowlist.mjs`
 *       with a justifying architectural reason, OR
 *   (b) be accompanied by an inline `// FIXME(am3): <reason>` marker
 *       AND a tracked follow-up issue.
 *
 * Either of those signals downgrades the violation to a tracked debt
 * row in the report. Anything else = scanner fails, PR is red.
 *
 * What we scan
 *   - Every `*.ts` and `*.tsx` file in the repo.
 *   - Excludes `node_modules/`, `dist/`, `.next/`, `.turbo/`,
 *     `build/`, `coverage/`, and `.claude/worktrees/`.
 *   - Excludes `services/domain-services/` ONLY when the
 *     parallel-tracked branch (`CL-B4`) is still landing — once
 *     CL-B4 merges, remove the exclusion (it's a single line below).
 *
 * What counts as a violation
 *   - The file contains one or more lines matching `/^\s*\/\/\s*@ts-nocheck/`
 *     (covers indented and trailing-comment forms) OR
 *     `/^\s*\/\*\s*@ts-nocheck/` (covers JSDoc-style),
 *   - AND the file is NOT in the allowlist,
 *   - AND the line does NOT carry an inline `FIXME(am3):` marker.
 *
 * Output
 *   - JSON report at `--report` (default stdout).
 *   - Markdown summary at `--summary` (for the GH-actions step
 *     summary).
 *   - Exits 1 if any unallowed violation is present.
 *
 * Usage
 *   node scripts/audit-ts-nocheck-coverage.mjs
 *   node scripts/audit-ts-nocheck-coverage.mjs --report .audit/ts-nocheck-coverage.json
 *   node scripts/audit-ts-nocheck-coverage.mjs --summary .audit/ts-nocheck-coverage.md
 */

import {
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
  existsSync,
  mkdirSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TS_NOCHECK_ALLOWLIST } from './__allowlists__/ts-nocheck-coverage-allowlist.mjs';

const ROOT = resolve(fileURLToPath(import.meta.url), '..', '..');

// ───────────────────────────────────────────────────────────────────
// Directory exclusion rules.
// ───────────────────────────────────────────────────────────────────

const EXCLUDE_DIR_NAMES = new Set([
  'node_modules',
  'dist',
  '.next',
  '.turbo',
  'build',
  'coverage',
  '.git',
]);

// Path-prefix exclusions (relative to repo root). These are removed
// when their owning sweep lands.
const EXCLUDE_PREFIXES = [
  '.claude/worktrees/',
  // services/domain-services/ is owned by the parallel CL-B4 branch.
  // Remove this exclusion the moment CL-B4 merges to main.
  'services/domain-services/',
];

// ───────────────────────────────────────────────────────────────────
// Directive detection.
// ───────────────────────────────────────────────────────────────────

// Match `@ts-nocheck` whether it appears as a line-comment, a
// block-comment, or a JSDoc-style comment. We deliberately do NOT
// match inside string literals — the cost of a false positive is
// only a misleading line number, but the regex below restricts to
// comment markers which avoids the vast majority of those.
const NOCHECK_PATTERNS = [
  /^\s*\/\/\s*@ts-nocheck\b/,
  /^\s*\/\*+\s*@ts-nocheck\b/,
  /^\s*\*\s*@ts-nocheck\b/, // continuation-line of a JSDoc block
];

// Inline FIXME marker that downgrades a violation to tracked debt.
// Format: `// FIXME(am3): <specific reason>` — reviewers check the
// reason is concrete (not "TODO" or "later").
const FIXME_PATTERN = /\bFIXME\(am3\)\s*:/;

function findNoCheckLines(src) {
  const hits = [];
  const lines = src.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const pat of NOCHECK_PATTERNS) {
      if (pat.test(line)) {
        hits.push({
          line: i + 1,
          text: line.trim(),
          fixme: FIXME_PATTERN.test(line),
        });
        break;
      }
    }
  }
  return hits;
}

// ───────────────────────────────────────────────────────────────────
// File walker.
// ───────────────────────────────────────────────────────────────────

function walkDir(dir, out) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    if (EXCLUDE_DIR_NAMES.has(name)) continue;
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    const rel = relative(ROOT, full);
    if (EXCLUDE_PREFIXES.some((p) => rel.startsWith(p))) continue;
    if (st.isDirectory()) {
      walkDir(full, out);
    } else if (name.endsWith('.ts') || name.endsWith('.tsx')) {
      out.push(full);
    }
  }
}

// ───────────────────────────────────────────────────────────────────
// CLI.
// ───────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const out = { report: null, summary: null, json: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--report') out.report = argv[++i];
    else if (a === '--summary') out.summary = argv[++i];
    else if (a === '--json') out.json = true;
    else if (a === '--help' || a === '-h') {
      console.log(
        'Usage: audit-ts-nocheck-coverage.mjs [--report file] [--summary file] [--json]',
      );
      process.exit(0);
    }
  }
  return out;
}

function ensureDir(p) {
  const d = dirname(p);
  if (!existsSync(d)) mkdirSync(d, { recursive: true });
}

function main() {
  const args = parseArgs(process.argv);

  const files = [];
  walkDir(ROOT, files);

  const violations = [];
  const allowlisted = [];
  const fixmeTracked = [];

  for (const file of files) {
    const rel = relative(ROOT, file);
    let src;
    try {
      src = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    const hits = findNoCheckLines(src);
    if (hits.length === 0) continue;

    const allowReason = TS_NOCHECK_ALLOWLIST.get(rel) ?? null;

    if (allowReason) {
      allowlisted.push({ file: rel, reason: allowReason, hits });
      continue;
    }

    // If every hit on the file is FIXME-marked, this is tracked debt
    // (not a violation). If even one hit is unmarked, the file is a
    // violation (because that hit was added without justification).
    const allFixmeMarked = hits.every((h) => h.fixme);
    if (allFixmeMarked) {
      fixmeTracked.push({ file: rel, hits });
      continue;
    }

    violations.push({
      file: rel,
      hits: hits.filter((h) => !h.fixme).map((h) => ({ line: h.line, text: h.text })),
    });
  }

  // Verify every allowlist entry refers to a real file.
  const missingAllowlistFiles = [];
  for (const p of TS_NOCHECK_ALLOWLIST.keys()) {
    if (!existsSync(join(ROOT, p))) missingAllowlistFiles.push(p);
  }

  const report = {
    scanner: 'ts-nocheck-coverage',
    scannedAt: new Date().toISOString(),
    totals: {
      filesScanned: files.length,
      filesAllowlisted: allowlisted.length,
      filesFixmeTracked: fixmeTracked.length,
      violations: violations.length,
    },
    violations,
    allowlisted,
    fixmeTracked,
    missingAllowlistFiles,
  };

  if (args.report) {
    ensureDir(args.report);
    writeFileSync(args.report, JSON.stringify(report, null, 2));
  }

  if (args.summary) {
    ensureDir(args.summary);
    writeFileSync(args.summary, renderMarkdown(report));
  }

  const passed = violations.length === 0 && missingAllowlistFiles.length === 0;

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.error(
      `audit-ts-nocheck-coverage: ${files.length} files scanned, ${violations.length} violation(s), ${allowlisted.length} allowlisted, ${fixmeTracked.length} FIXME-tracked — ${passed ? 'PASS' : 'FAIL'}`,
    );
    if (!passed) {
      for (const v of violations.slice(0, 30)) {
        console.error(`  [VIOLATION] ${v.file}`);
        for (const h of v.hits.slice(0, 3)) {
          console.error(`     L${h.line}: ${h.text}`);
        }
      }
      if (violations.length > 30) {
        console.error(`  ... and ${violations.length - 30} more`);
      }
      for (const m of missingAllowlistFiles) {
        console.error(`  [STALE ALLOWLIST] ${m}`);
      }
    }
  }

  process.exit(passed ? 0 : 1);
}

function renderMarkdown(report) {
  const lines = [];
  lines.push('# `@ts-nocheck` coverage audit');
  lines.push('');
  lines.push(`Scanned: ${report.scannedAt}`);
  lines.push('');
  lines.push('| metric | value |');
  lines.push('|---|---|');
  lines.push(`| files scanned | ${report.totals.filesScanned} |`);
  lines.push(`| allowlisted | ${report.totals.filesAllowlisted} |`);
  lines.push(`| FIXME-tracked | ${report.totals.filesFixmeTracked} |`);
  lines.push(`| violations | ${report.totals.violations} |`);
  lines.push('');
  if (report.violations.length > 0) {
    lines.push('## Violations');
    lines.push('');
    lines.push('| file | lines |');
    lines.push('|---|---|');
    for (const v of report.violations) {
      const lns = v.hits.map((h) => `L${h.line}`).join(' ');
      lines.push(`| \`${v.file}\` | ${lns} |`);
    }
    lines.push('');
  }
  if (report.fixmeTracked.length > 0) {
    lines.push('## FIXME-tracked debt');
    lines.push('');
    lines.push('| file | lines |');
    lines.push('|---|---|');
    for (const t of report.fixmeTracked) {
      const lns = t.hits.map((h) => `L${h.line}`).join(' ');
      lines.push(`| \`${t.file}\` | ${lns} |`);
    }
    lines.push('');
  }
  if (report.allowlisted.length > 0) {
    lines.push('## Allowlisted');
    lines.push('');
    lines.push('| file | reason |');
    lines.push('|---|---|');
    for (const a of report.allowlisted) {
      lines.push(`| \`${a.file}\` | ${a.reason} |`);
    }
    lines.push('');
  }
  if (report.missingAllowlistFiles.length > 0) {
    lines.push('## Stale allowlist entries');
    lines.push('');
    for (const p of report.missingAllowlistFiles) lines.push(`- \`${p}\``);
    lines.push('');
  }
  return lines.join('\n');
}

main();
