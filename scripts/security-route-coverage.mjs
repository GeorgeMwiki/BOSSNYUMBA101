#!/usr/bin/env node
/**
 * Security-route-coverage scanner.
 *
 * Phase D agent D9 — closes A3/A5 Tier-1 gap: every mutating HTTP route
 * (POST | PUT | DELETE | PATCH) MUST wrap its handler with the
 * `withSecurityEvents` HOF so a SecurityEvent row is emitted per call.
 *
 * The scanner walks:
 *   services/* / src/routes/ * .ts
 *   services/api-gateway/src/routes/ * .ts
 *
 * For each mutating handler it determines whether the handler body / its
 * registration call wraps in `withSecurityEvents(...)`. Read-only and
 * deliberately-public routes can be exempted via the allowlist file at
 * `.github/security-route-allowlist.yml`.
 *
 * Coverage = wrapped / (wrapped + unwrapped - allowlisted). Failing the
 * 90% floor exits 1. The JSON report is written to stdout (and a
 * `coverage-report.json` artefact when --report is passed).
 *
 * Usage:
 *   node scripts/security-route-coverage.mjs
 *   node scripts/security-route-coverage.mjs --report coverage-report.json
 *   node scripts/security-route-coverage.mjs --threshold 0.9
 *
 * Exit codes:
 *   0  coverage >= threshold (default 0.9)
 *   1  coverage < threshold or scan failure
 *   2  CLI argument error
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(import.meta.url), '..', '..');
const MUTATING_VERBS = ['post', 'put', 'delete', 'patch'];
const DEFAULT_THRESHOLD = 0.9;
const ALLOWLIST_PATH = join(ROOT, '.github', 'security-route-allowlist.yml');

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { report: null, threshold: DEFAULT_THRESHOLD };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--report') {
      args.report = argv[++i];
    } else if (a === '--threshold') {
      args.threshold = Number(argv[++i]);
      if (!Number.isFinite(args.threshold) || args.threshold <= 0 || args.threshold > 1) {
        console.error('--threshold must be in (0, 1]');
        process.exit(2);
      }
    } else if (a === '--help' || a === '-h') {
      console.log('Usage: security-route-coverage.mjs [--report file] [--threshold 0.9]');
      process.exit(0);
    }
  }
  return args;
}

// ---------------------------------------------------------------------------
// Allowlist parser (tiny YAML subset — just `routes: [ "file:line", ... ]`)
// ---------------------------------------------------------------------------

function loadAllowlist() {
  if (!existsSync(ALLOWLIST_PATH)) {
    return { entries: [], rationale: {} };
  }
  const text = readFileSync(ALLOWLIST_PATH, 'utf8');
  const entries = [];
  const rationale = {};
  // Format:
  //   routes:
  //     - path: services/api-gateway/src/routes/public-marketing.router.ts
  //       reason: public read-only landing pages, no PII surface
  //       verbs: [post]
  const lines = text.split(/\r?\n/);
  let current = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    if (line === 'routes:') continue;
    if (line.startsWith('- path:')) {
      if (current) entries.push(current);
      current = { path: line.replace(/^- path:\s*/, '').trim(), verbs: null, reason: '' };
    } else if (line.startsWith('reason:') && current) {
      current.reason = line.replace(/^reason:\s*/, '').trim();
      rationale[current.path] = current.reason;
    } else if (line.startsWith('verbs:') && current) {
      const inner = line.replace(/^verbs:\s*/, '').trim();
      current.verbs = inner
        .replace(/^\[|\]$/g, '')
        .split(',')
        .map((v) => v.trim().toLowerCase())
        .filter(Boolean);
    }
  }
  if (current) entries.push(current);
  return { entries, rationale };
}

function isAllowlisted(allowlist, fileRel, verb) {
  for (const entry of allowlist.entries) {
    if (entry.path === fileRel) {
      if (!entry.verbs || entry.verbs.length === 0) return true;
      if (entry.verbs.includes(verb)) return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Route walker
// ---------------------------------------------------------------------------

function walkDir(dir, out) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === '__tests__' || name === 'node_modules' || name === 'dist') continue;
      walkDir(full, out);
    } else if (name.endsWith('.ts') && !name.endsWith('.test.ts') && !name.endsWith('.d.ts')) {
      out.push(full);
    }
  }
}

function discoverRouteFiles() {
  const out = [];
  // services/*/src/routes
  const servicesDir = join(ROOT, 'services');
  if (existsSync(servicesDir)) {
    for (const svc of readdirSync(servicesDir)) {
      const routesDir = join(servicesDir, svc, 'src', 'routes');
      walkDir(routesDir, out);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Handler detection
//
// We do not parse the full TS AST — we use a deterministic regex matcher
// over `.<verb>(` registrations and verify the surrounding statement contains
// the substring `withSecurityEvents`. False-positives are bounded by:
//   * verbs limited to post/put/delete/patch
//   * we only match `.<verb>(` after an identifier (e.g. `app.post(`)
//   * we read a 2 000 char window starting at the registration call and check
//     whether `withSecurityEvents` appears before the matching close paren.
// ---------------------------------------------------------------------------

const HANDLER_RX = /\b([a-zA-Z_$][\w$]*)\.(post|put|delete|patch)\s*\(/g;

function extractHandlers(content) {
  const handlers = [];
  let m;
  while ((m = HANDLER_RX.exec(content)) !== null) {
    const startIdx = m.index;
    const verb = m[2].toLowerCase();
    // Filter out non-route `.<verb>(` calls. A Hono/Fastify/Express route
    // registration ALWAYS starts with a route-path argument: a string
    // literal whose first char is '/' (e.g. `app.post('/users', ...)`) or
    // a template literal (`app.post(`${prefix}/users`, …)`). The same
    // `.delete(` pattern is used by Map/Set/repo calls (`bucket.delete(id)`,
    // `repos.users.delete(...)`, `seenEvents.delete(k)`), and treating
    // those as routes inflates the denominator with un-wrappable
    // false-positives. Skip when the first non-whitespace char after the
    // opening paren is not `'`, `"`, or backtick.
    const openIdx = startIdx + m[0].length;
    let scan = openIdx;
    while (scan < content.length && /\s/.test(content[scan])) scan++;
    const firstCh = content[scan];
    if (firstCh !== "'" && firstCh !== '"' && firstCh !== '`') {
      continue;
    }
    // Walk forward to find matching close paren — bounded scan. Detection
    // only needs the FIRST ~800 chars (the `withSecurityEvents(` call would
    // sit right after the route path / middleware chain, never inside the
    // body), but we keep the wider window so multi-line registrations with
    // a few middlewares still see the wrap token. Tracking strings + line
    // comments avoids false depth-of-paren counts inside template literals
    // / regex / strings — without this, large handler bodies poison the
    // close-paren search.
    let depth = 0;
    let end = startIdx + m[0].length - 1; // points at the opening paren
    const upper = Math.min(content.length, startIdx + 8_000);
    let inStr = null;
    let inLineComment = false;
    let inBlockComment = false;
    for (let i = end; i < upper; i++) {
      const ch = content[i];
      const nx = content[i + 1];
      if (inLineComment) {
        if (ch === '\n') inLineComment = false;
        continue;
      }
      if (inBlockComment) {
        if (ch === '*' && nx === '/') { inBlockComment = false; i++; }
        continue;
      }
      if (inStr) {
        if (ch === '\\') { i++; continue; }
        if (ch === inStr) inStr = null;
        continue;
      }
      if (ch === '/' && nx === '/') { inLineComment = true; i++; continue; }
      if (ch === '/' && nx === '*') { inBlockComment = true; i++; continue; }
      if (ch === '"' || ch === "'" || ch === '`') { inStr = ch; continue; }
      if (ch === '(') depth++;
      else if (ch === ')') {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    const slice = content.slice(startIdx, end + 1);
    // Accept all three runtime variants: Hono (`withSecurityEvents`), Fastify
    // (`withSecurityEventsFastify`), and Next.js App Router
    // (`withSecurityEventsNextRoute`). All three call the same sink.
    const wrapped = /\bwithSecurityEvents(?:Fastify|NextRoute)?\s*\(/.test(slice);
    // Find line number.
    const lineNumber = content.slice(0, startIdx).split('\n').length;
    handlers.push({ verb, wrapped, lineNumber });
  }
  return handlers;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const args = parseArgs(process.argv);
  const allowlist = loadAllowlist();
  const files = discoverRouteFiles();
  const fileReports = [];
  let totalConsidered = 0;
  let totalWrapped = 0;
  let totalAllowlisted = 0;
  const violations = [];

  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    const rel = relative(ROOT, file);
    const handlers = extractHandlers(content);
    if (handlers.length === 0) continue;
    const fileReport = { file: rel, handlers: [] };
    for (const h of handlers) {
      const allow = isAllowlisted(allowlist, rel, h.verb);
      if (allow) {
        totalAllowlisted++;
        fileReport.handlers.push({ ...h, status: 'allowlisted' });
        continue;
      }
      totalConsidered++;
      if (h.wrapped) {
        totalWrapped++;
        fileReport.handlers.push({ ...h, status: 'wrapped' });
      } else {
        fileReport.handlers.push({ ...h, status: 'unwrapped' });
        violations.push({ file: rel, verb: h.verb, line: h.lineNumber });
      }
    }
    fileReports.push(fileReport);
  }

  const coverage = totalConsidered === 0 ? 1 : totalWrapped / totalConsidered;
  const passed = coverage >= args.threshold;

  const report = {
    schemaVersion: 1,
    scannedAt: new Date().toISOString(),
    threshold: args.threshold,
    totals: {
      filesScanned: files.length,
      filesWithMutations: fileReports.length,
      handlersConsidered: totalConsidered,
      handlersWrapped: totalWrapped,
      handlersAllowlisted: totalAllowlisted,
      coverage: Number(coverage.toFixed(4)),
    },
    passed,
    violations,
    fileReports,
  };

  if (args.report) {
    writeFileSync(args.report, JSON.stringify(report, null, 2));
  }
  // Always emit a compact human summary on stderr; full JSON on stdout.
  console.error(
    `security-route-coverage: scanned ${files.length} files, ${totalConsidered} mutating handlers, ${totalWrapped} wrapped (${(coverage * 100).toFixed(1)}%) — threshold ${(args.threshold * 100).toFixed(0)}% — ${passed ? 'PASS' : 'FAIL'}`,
  );
  if (!passed) {
    console.error(`security-route-coverage: ${violations.length} unwrapped mutating handlers:`);
    for (const v of violations.slice(0, 25)) {
      console.error(`  - ${v.file}:${v.line} (.${v.verb})`);
    }
    if (violations.length > 25) {
      console.error(`  ... and ${violations.length - 25} more`);
    }
  }
  console.log(JSON.stringify(report, null, 2));
  process.exit(passed ? 0 : 1);
}

main();
