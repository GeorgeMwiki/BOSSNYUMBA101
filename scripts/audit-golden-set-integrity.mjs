#!/usr/bin/env node
/**
 * Universal Golden-Set Integrity scanner (Phase N-F).
 *
 * The 14th coverage-audit gate. Fails CI if any of the immutable
 * golden-eval files have drifted from the offline-signed manifest.
 *
 * Defense thesis (Sleeper Agents, Hubinger 2024): the eval set MUST
 * be immutable from the brain's perspective AND from any inadvertent
 * developer edit. The manifest is hash-anchored — even a single byte
 * change in a fixture or its manifest fails this scanner.
 *
 * Usage:
 *   node scripts/audit-golden-set-integrity.mjs \
 *     --report .audit/golden-set-integrity.json \
 *     --summary .audit/golden-set-integrity.md
 *
 * Exit codes:
 *   0 — golden set intact
 *   1 — manifest missing, malformed, or any file tampered
 */

import { createHash } from 'node:crypto';
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

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const GOLDEN_ROOT = resolve(ROOT, 'packages/anti-scheming/golden-set');
const MANIFEST_FILENAME = 'MANIFEST.json';

const args = process.argv.slice(2);
function arg(flag, def = '') {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : def;
}
const reportPath = arg('--report', '.audit/golden-set-integrity.json');
const summaryPath = arg('--summary', '.audit/golden-set-integrity.md');

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir)) {
    const abs = join(dir, e);
    const st = statSync(abs);
    if (st.isDirectory()) walk(abs, out);
    else if (st.isFile() && e !== MANIFEST_FILENAME) out.push(abs);
  }
  return out;
}

function loadManifest() {
  const p = join(GOLDEN_ROOT, MANIFEST_FILENAME);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function computeManifestHash(entries) {
  const sorted = [...entries].sort((a, b) => a.id.localeCompare(b.id));
  return sha256(Buffer.from(JSON.stringify(sorted, null, 2) + '\n', 'utf8'));
}

function ensureDir(p) {
  mkdirSync(dirname(p), { recursive: true });
}

const violations = [];
let entriesCount = 0;
let manifestPresent = false;
let manifestHashOk = false;

const manifest = loadManifest();
if (!manifest) {
  violations.push({ kind: 'manifest-missing', path: MANIFEST_FILENAME });
} else if (!Array.isArray(manifest.entries) || typeof manifest.manifest_hash !== 'string') {
  violations.push({ kind: 'manifest-malformed', path: MANIFEST_FILENAME });
} else {
  manifestPresent = true;
  entriesCount = manifest.entries.length;
  const recomputed = computeManifestHash(manifest.entries);
  if (recomputed !== manifest.manifest_hash) {
    violations.push({ kind: 'manifest-hash-mismatch', path: MANIFEST_FILENAME, expected: manifest.manifest_hash, actual: recomputed });
  } else {
    manifestHashOk = true;
  }
  const expected = new Set();
  for (const e of manifest.entries) {
    expected.add(e.path);
    const abs = join(GOLDEN_ROOT, e.path);
    if (!existsSync(abs)) {
      violations.push({ kind: 'file-missing', path: e.path });
      continue;
    }
    const buf = readFileSync(abs);
    if (buf.length !== e.bytes) {
      violations.push({ kind: 'file-bytes-mismatch', path: e.path, expected: e.bytes, actual: buf.length });
      continue;
    }
    const actual = sha256(buf);
    if (actual !== e.sha256) {
      violations.push({ kind: 'file-hash-mismatch', path: e.path, expected: e.sha256, actual });
    }
  }
  for (const abs of walk(GOLDEN_ROOT)) {
    const rel = relative(GOLDEN_ROOT, abs).split('\\').join('/');
    if (!expected.has(rel)) {
      violations.push({ kind: 'unknown-file-in-golden-set', path: rel });
    }
  }
}

const ok = violations.length === 0 && manifestPresent;
const report = {
  generated_at: new Date().toISOString(),
  golden_root: relative(ROOT, GOLDEN_ROOT),
  manifest_present: manifestPresent,
  manifest_hash_ok: manifestHashOk,
  entries_count: entriesCount,
  violations,
  ok,
};
ensureDir(reportPath);
writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');

const md = [];
md.push('# Golden-Set Integrity Audit');
md.push('');
md.push(`- golden_root: \`${report.golden_root}\``);
md.push(`- manifest present: ${manifestPresent ? 'yes' : '**NO**'}`);
md.push(`- manifest hash ok: ${manifestHashOk ? 'yes' : '**NO**'}`);
md.push(`- entries: ${entriesCount}`);
md.push(`- violations: ${violations.length}`);
md.push('');
if (violations.length > 0) {
  md.push('## Violations');
  for (const v of violations) md.push(`- \`${v.kind}\` ${v.path}${v.expected ? ` (expected=${String(v.expected).slice(0, 12)}… actual=${String(v.actual).slice(0, 12)}…)` : ''}`);
}
md.push('');
md.push(ok ? '**Golden set intact.**' : '**TAMPER DETECTED — fix before merging.**');
ensureDir(summaryPath);
writeFileSync(summaryPath, md.join('\n') + '\n', 'utf8');

if (!ok) {
  console.error(`golden-set integrity FAILED: ${violations.length} violations`);
  process.exit(1);
} else {
  console.log(`golden-set integrity OK: ${entriesCount} entries verified`);
}
