/**
 * Golden-set integrity verification.
 *
 * At test time we MUST verify every byte of every scenario against the
 * offline-signed manifest. Any drift — even a single byte — fails the
 * regression test and blocks the release.
 *
 * The hash function is canonical SHA-256 on the raw file bytes (no
 * normalisation) so even whitespace changes are caught.
 */

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import type {
  GoldenManifest,
  IntegrityResult,
  IntegrityViolation,
} from './types.js';

const MANIFEST_FILENAME = 'MANIFEST.json';

/**
 * Compute SHA-256 of arbitrary bytes, hex-encoded.
 */
export function sha256Hex(bytes: Uint8Array | Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/**
 * Compute the canonical manifest hash from the entries array.
 *
 * Canonical form: JSON with sorted keys + 2-space indent + trailing
 * newline. We hash the entries array directly (not the wrapper) so the
 * signature can re-sign a refreshed `generated_at` without invalidating.
 */
export function computeManifestHash(
  entries: readonly { readonly id: string; readonly path: string; readonly sha256: string; readonly bytes: number }[],
): string {
  const sorted = [...entries].sort((a, b) => a.id.localeCompare(b.id));
  const canonical = JSON.stringify(sorted, null, 2) + '\n';
  return sha256Hex(Buffer.from(canonical, 'utf8'));
}

/**
 * Walk a directory recursively, returning every regular file's path
 * relative to `root` (POSIX separators) — excluding the manifest itself.
 */
export function listGoldenFiles(root: string): string[] {
  const out: string[] = [];
  function walk(dir: string): void {
    for (const entry of readdirSync(dir)) {
      const abs = join(dir, entry);
      const st = statSync(abs);
      if (st.isDirectory()) {
        walk(abs);
      } else if (st.isFile() && entry !== MANIFEST_FILENAME) {
        out.push(relative(root, abs).split('\\').join('/'));
      }
    }
  }
  walk(root);
  return out.sort();
}

/**
 * Load + parse the manifest file.
 *
 * Returns `null` if the file is missing or unparseable — the caller
 * MUST treat this as a hard failure (`manifest-missing` /
 * `manifest-malformed`).
 */
export function loadManifest(goldenRoot: string): GoldenManifest | null {
  const path = join(goldenRoot, MANIFEST_FILENAME);
  if (!existsSync(path)) return null;
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as GoldenManifest;
  } catch {
    return null;
  }
}

/**
 * Full integrity check. Returns a discriminated union — never throws.
 *
 * Algorithm:
 *   1. Manifest must exist + parse
 *   2. Manifest hash must match its own entries
 *   3. Every entry's file must exist + bytes + sha256 match
 *   4. Every file on disk must be referenced by the manifest
 *      (catches *added* files — a sneaky way to ship a backdoor)
 */
export function verifyGoldenSetIntegrity(goldenRoot: string): IntegrityResult {
  const manifest = loadManifest(goldenRoot);
  if (!manifest) {
    return { ok: false, reason: 'manifest-missing', violations: [{ kind: 'manifest-missing', path: MANIFEST_FILENAME }] };
  }
  if (!Array.isArray(manifest.entries) || typeof manifest.manifest_hash !== 'string') {
    return { ok: false, reason: 'manifest-malformed', violations: [{ kind: 'manifest-malformed', path: MANIFEST_FILENAME }] };
  }

  const recomputed = computeManifestHash(manifest.entries);
  if (recomputed !== manifest.manifest_hash) {
    return {
      ok: false,
      reason: 'manifest-hash-mismatch',
      violations: [{ kind: 'manifest-hash-mismatch', path: MANIFEST_FILENAME, expected: manifest.manifest_hash, actual: recomputed }],
    };
  }

  const violations: IntegrityViolation[] = [];
  const expectedPaths = new Set<string>();

  for (const e of manifest.entries) {
    expectedPaths.add(e.path);
    const abs = join(goldenRoot, e.path);
    if (!existsSync(abs)) {
      violations.push({ kind: 'file-missing', path: e.path });
      continue;
    }
    const bytes = readFileSync(abs);
    if (bytes.length !== e.bytes) {
      violations.push({ kind: 'file-hash-mismatch', path: e.path, expected: String(e.bytes), actual: String(bytes.length) });
      continue;
    }
    const actual = sha256Hex(bytes);
    if (actual !== e.sha256) {
      violations.push({ kind: 'file-hash-mismatch', path: e.path, expected: e.sha256, actual });
    }
  }

  for (const onDisk of listGoldenFiles(goldenRoot)) {
    if (!expectedPaths.has(onDisk)) {
      violations.push({ kind: 'unknown-file-in-golden-set', path: onDisk });
    }
  }

  if (violations.length > 0) {
    const firstKind = violations[0]?.kind ?? 'file-hash-mismatch';
    return { ok: false, reason: firstKind, violations };
  }

  return { ok: true, verified_at: new Date().toISOString(), entries_count: manifest.entries.length };
}
