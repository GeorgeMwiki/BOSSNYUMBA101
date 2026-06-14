/**
 * audit-deleted-app-residue — live detector for canonical surface topology.
 *
 * The 2026-06 consolidation deleted five drift web apps:
 *   customer-app, estate-manager-app, tenant-portal, admin-portal,
 *   bossnyumba_app (Flutter).
 *
 * The canonical apps/ surface is exactly five:
 *   owner-portal (Vite), marketing (Next), admin-platform-portal (Next),
 *   tenant-mobile (Expo), staff-mobile (Expo).
 *
 * This test fails if a deleted app name reappears as a LIVE reference in
 * dev-facing docs/config or keeper-app source (provenance comments framed
 * as "migrated from <deleted app>" are explicitly allowed — they record
 * honest history, not a live dependency).
 *
 * It also guards the two structural deletions: owner-portal must stay
 * pure Vite (no next.config.js), and the two deleted codemaps must stay
 * deleted.
 *
 * Scans the REAL repo tree (not a fixture) so reintroduced residue is
 * caught the moment it lands.
 */

import { describe, it, expect } from 'vitest';
import {
  readFileSync,
  existsSync,
  readdirSync,
  statSync,
} from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(__filename, '..', '..', '..');

/** Deleted apps that must not reappear as live references. */
const DELETED_APPS = [
  'customer-app',
  'estate-manager-app',
  'tenant-portal',
  'bossnyumba_app',
] as const;

/** Canonical surviving surfaces — must all exist. */
const CANONICAL_APPS = [
  'owner-portal',
  'marketing',
  'admin-platform-portal',
  'tenant-mobile',
  'staff-mobile',
] as const;

/**
 * Lines that mention a deleted app but in honest past-tense provenance are
 * allowed (they record where consolidated code came from).
 */
const PROVENANCE_ALLOWLIST = /migrated from|migrated stub|ported from|provenance/i;

/** Dev-facing docs/config that must carry zero live deleted-app refs. */
const DEV_FACING_FILES = [
  'README.md',
  'Docs/ENV.md',
  'Docs/ENVIRONMENT.md',
  'eslint.config.mjs',
];

/** Keeper-app source roots to scan for live deleted-app references. */
const KEEPER_SOURCE_ROOTS = [
  'apps/owner-portal/src',
  'apps/admin-platform-portal/src',
  'apps/marketing/src',
  'apps/tenant-mobile/src',
  'apps/staff-mobile/src',
];

const SOURCE_EXT = /\.(ts|tsx|js|jsx|mjs)$/;

function walk(dir: string): string[] {
  const abs = join(REPO_ROOT, dir);
  if (!existsSync(abs)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(abs)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const childRel = join(dir, entry);
    const childAbs = join(REPO_ROOT, childRel);
    if (statSync(childAbs).isDirectory()) {
      out.push(...walk(childRel));
    } else if (SOURCE_EXT.test(entry)) {
      out.push(childRel);
    }
  }
  return out;
}

function findResidueLines(relPath: string): string[] {
  const abs = join(REPO_ROOT, relPath);
  if (!existsSync(abs)) return [];
  const lines = readFileSync(abs, 'utf8').split('\n');
  const hits: string[] = [];
  lines.forEach((line, i) => {
    if (PROVENANCE_ALLOWLIST.test(line)) return;
    for (const app of DELETED_APPS) {
      if (line.includes(app)) {
        hits.push(`${relPath}:${i + 1}: ${line.trim()}`);
        break;
      }
    }
  });
  return hits;
}

describe('canonical surface topology — deleted-app residue', () => {
  it('keeps exactly the five canonical apps present', () => {
    for (const app of CANONICAL_APPS) {
      expect(
        existsSync(join(REPO_ROOT, 'apps', app)),
        `canonical app apps/${app} must exist`,
      ).toBe(true);
    }
  });

  it('keeps every deleted app deleted from apps/', () => {
    for (const app of DELETED_APPS) {
      expect(
        existsSync(join(REPO_ROOT, 'apps', app)),
        `deleted app apps/${app} must NOT exist`,
      ).toBe(false);
    }
  });

  it('keeps owner-portal pure Vite (no next.config.js)', () => {
    expect(
      existsSync(join(REPO_ROOT, 'apps/owner-portal/next.config.js')),
      'owner-portal is pure Vite — next.config.js must not return',
    ).toBe(false);
    // ...and must not pull the Next.js framework as a dep.
    const pkg = JSON.parse(
      readFileSync(join(REPO_ROOT, 'apps/owner-portal/package.json'), 'utf8'),
    );
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    expect(deps.next, 'owner-portal must not depend on next').toBeUndefined();
  });

  it('keeps the deleted-app codemaps deleted', () => {
    for (const app of ['customer-app', 'estate-manager-app']) {
      expect(
        existsSync(join(REPO_ROOT, 'Docs/CODEMAPS', `${app}.md`)),
        `Docs/CODEMAPS/${app}.md must stay deleted`,
      ).toBe(false);
    }
  });

  it('carries no live deleted-app refs in dev-facing docs/config', () => {
    const residue = DEV_FACING_FILES.flatMap(findResidueLines);
    expect(
      residue,
      `dev-facing docs/config still reference deleted apps:\n${residue.join('\n')}`,
    ).toEqual([]);
  });

  it('carries no live deleted-app refs in keeper-app source', () => {
    const files = KEEPER_SOURCE_ROOTS.flatMap(walk);
    const residue = files.flatMap(findResidueLines);
    expect(
      residue,
      `keeper-app source still references deleted apps:\n${residue.join('\n')}`,
    ).toEqual([]);
  });

  it('removes the deleted Flutter app ignore glob from eslint config', () => {
    const eslintCfg = readFileSync(
      join(REPO_ROOT, 'eslint.config.mjs'),
      'utf8',
    );
    expect(
      eslintCfg.includes('apps/bossnyumba_app/'),
      'eslint.config.mjs must not ignore the deleted Flutter app',
    ).toBe(false);
  });
});
