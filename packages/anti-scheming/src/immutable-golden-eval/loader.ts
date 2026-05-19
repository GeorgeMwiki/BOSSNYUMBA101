/**
 * Tamper-checked golden-set loader.
 *
 * Public entry point: `loadGoldenSet(root)`. Returns `readonly` scenarios
 * ONLY when integrity passes. On failure the loader throws — there is no
 * "best effort" mode. The point of an immutable eval is that it is
 * better to halt the test run than to ship with a mutated set.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { verifyGoldenSetIntegrity, loadManifest } from './integrity.js';
import type { GoldenScenario, IntegrityResult } from './types.js';

export class GoldenSetIntegrityError extends Error {
  public readonly result: IntegrityResult;
  constructor(result: IntegrityResult & { ok: false }) {
    super(`golden-set integrity failure: ${result.reason} (${result.violations.length} violations)`);
    this.name = 'GoldenSetIntegrityError';
    this.result = result;
  }
}

/**
 * Load the full golden scenario set. Verifies integrity first.
 *
 * Returns a `readonly` array of frozen objects so the brain cannot
 * mutate scenarios at runtime even if it somehow obtains a reference.
 */
export function loadGoldenSet(goldenRoot: string): readonly GoldenScenario[] {
  const integrity = verifyGoldenSetIntegrity(goldenRoot);
  if (!integrity.ok) throw new GoldenSetIntegrityError(integrity);

  const manifest = loadManifest(goldenRoot);
  if (!manifest) throw new GoldenSetIntegrityError({ ok: false, reason: 'manifest-missing', violations: [] });

  const scenarios: GoldenScenario[] = [];
  for (const entry of manifest.entries) {
    const raw = readFileSync(join(goldenRoot, entry.path), 'utf8');
    const parsed: unknown = JSON.parse(raw);
    if (!isGoldenScenario(parsed)) {
      throw new GoldenSetIntegrityError({
        ok: false,
        reason: 'manifest-malformed',
        violations: [{ kind: 'manifest-malformed', path: entry.path }],
      });
    }
    scenarios.push(Object.freeze({ ...parsed, forbidden_actions: Object.freeze([...parsed.forbidden_actions]), tags: Object.freeze([...parsed.tags]) }));
  }
  return Object.freeze(scenarios);
}

function isGoldenScenario(x: unknown): x is GoldenScenario {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o['id'] === 'string' &&
    typeof o['category'] === 'string' &&
    typeof o['severity'] === 'string' &&
    typeof o['input'] === 'string' &&
    typeof o['expected_action'] === 'string' &&
    Array.isArray(o['forbidden_actions']) &&
    Array.isArray(o['tags']) &&
    typeof o['created_by'] === 'string' &&
    typeof o['created_at'] === 'string'
  );
}
