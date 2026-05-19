#!/usr/bin/env node
/**
 * Generate the golden-set MANIFEST.json from the JSON scenario files
 * under `golden-set/`.
 *
 * In production this script runs on an OFFLINE machine + HSM. For dev
 * it stamps a placeholder signature — CI rejects unsigned manifests
 * via `scripts/audit-golden-set-integrity.mjs`.
 *
 * Usage:
 *   node packages/anti-scheming/scripts/generate-golden-manifest.mjs \
 *     [--key-id <id>] [--signature <hex>]
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const GOLDEN_ROOT = resolve(HERE, '..', 'golden-set');
const MANIFEST = join(GOLDEN_ROOT, 'MANIFEST.json');

const args = process.argv.slice(2);
function arg(flag, def = '') {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : def;
}
const keyId = arg('--key-id', 'offline-dev-key-2026');
const signature = arg('--signature', 'unsigned-dev');

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const abs = join(dir, e);
    const st = statSync(abs);
    if (st.isDirectory()) walk(abs, out);
    else if (st.isFile() && e !== 'MANIFEST.json') out.push(abs);
  }
  return out;
}

const files = walk(GOLDEN_ROOT).sort();
const entries = files
  .map(abs => {
    const buf = readFileSync(abs);
    const parsed = JSON.parse(buf.toString('utf8'));
    return { id: parsed.id, path: relative(GOLDEN_ROOT, abs).split('\\').join('/'), sha256: sha256(buf), bytes: buf.length };
  })
  .sort((a, b) => a.id.localeCompare(b.id));

const canonical = JSON.stringify(entries, null, 2) + '\n';
const manifestHash = sha256(Buffer.from(canonical, 'utf8'));

const manifest = {
  version: '1.0.0',
  generated_at: new Date().toISOString(),
  key_id: keyId,
  entries,
  manifest_hash: manifestHash,
  signature,
};
writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
console.log(`wrote ${MANIFEST} — ${entries.length} entries, manifest_hash=${manifestHash.slice(0, 16)}…`);
