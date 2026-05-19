/**
 * Tamper-checked constitution loader.
 *
 * The constitution is the single readable source of truth that the
 * brain consults before every destructive action. Tampering with the
 * constitution is functionally equivalent to scheming — it lets the
 * brain rewrite its own rules. We hash + sign the same way as the
 * golden eval.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sha256Hex } from '../immutable-golden-eval/integrity.js';
import {
  ConstitutionTamperError,
  type ConstitutionManifest,
  type LoadedConstitution,
} from './types.js';

const MANIFEST_FILENAME = 'CONSTITUTION-MANIFEST.json';

export function loadConstitutionManifest(root: string): ConstitutionManifest | null {
  const path = join(root, MANIFEST_FILENAME);
  if (!existsSync(path)) return null;
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as ConstitutionManifest;
  } catch {
    return null;
  }
}

/**
 * Load + verify the constitution. Throws on any tamper. The combined
 * `content` string is canonical: files concatenated in manifest order
 * with `\n---\n` separators so downstream callers can hash deterministically.
 */
export function loadConstitution(root: string): LoadedConstitution {
  const manifest = loadConstitutionManifest(root);
  if (!manifest) throw new ConstitutionTamperError(MANIFEST_FILENAME, '<expected>', '<missing>');

  const chunks: string[] = [];
  for (const f of manifest.files) {
    const abs = join(root, f.path);
    if (!existsSync(abs)) throw new ConstitutionTamperError(f.path, f.sha256, '<missing>');
    const buf = readFileSync(abs);
    if (buf.length !== f.bytes) throw new ConstitutionTamperError(f.path, String(f.bytes), String(buf.length));
    const actual = sha256Hex(buf);
    if (actual !== f.sha256) throw new ConstitutionTamperError(f.path, f.sha256, actual);
    chunks.push(buf.toString('utf8'));
  }
  const combined = chunks.join('\n---\n');
  return {
    version: manifest.version,
    loaded_at: new Date().toISOString(),
    content: combined,
    sha256: sha256Hex(Buffer.from(combined, 'utf8')),
  };
}
