#!/usr/bin/env node
/**
 * E2E spec-coverage guard.
 *
 * Playwright silently drops any *.spec.ts that matches no project `testMatch`.
 * That is exactly how all 23 @security @critical critical-flows specs went
 * uncollected for a full wave while CI reported green. This guard makes the
 * drop LOUD: it diffs every *.spec.ts on disk under e2e/tests against the set
 * Playwright actually enumerates (`playwright test --list`) and exits non-zero
 * if any spec is uncollected.
 *
 * Run before `pnpm test:e2e` in CI (no docker stack required — `--list` does
 * not execute the suite). Locally: `node e2e/scripts/assert-spec-coverage.mjs`.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const e2eRoot = resolve(here, '..');
const testsRoot = join(e2eRoot, 'tests');
const configPath = join(e2eRoot, 'playwright.config.ts');

/** Recursively collect every *.spec.ts under a directory. */
function walkSpecs(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkSpecs(full));
    } else if (entry.isFile() && entry.name.endsWith('.spec.ts')) {
      out.push(resolve(full));
    }
  }
  return out;
}

const repoRoot = resolve(e2eRoot, '..');

/**
 * Normalise a spec path to its tests-relative form so the comparison is
 * version-agnostic — Playwright's JSON reporter has emitted `file` as both an
 * absolute path and a rootDir-relative path across releases.
 */
function normaliseSpec(file) {
  const marker = `${testsRoot}/`;
  // Candidate absolute paths for the (possibly relative) reporter file. A
  // relative `file` may be rooted at testDir (./tests), e2e/, or the repo root
  // depending on the Playwright release.
  const candidates = file.startsWith('/')
    ? [file]
    : [resolve(testsRoot, file), resolve(e2eRoot, file), resolve(repoRoot, file)];
  // Pick the candidate whose path lands inside testsRoot; strip on the LAST
  // marker occurrence so a candidate that doubled the `tests/` segment
  // (e.g. resolve(testsRoot, 'tests/x')) still yields the true tests-relative
  // path.
  const inTree = candidates.filter((p) => p.includes(marker));
  const abs = inTree.length > 0 ? inTree[inTree.length - 1] : resolve(testsRoot, file);
  const idx = abs.lastIndexOf(marker);
  return idx >= 0 ? abs.slice(idx + marker.length) : abs;
}

/** Ask Playwright which spec files it actually enumerates across all projects. */
function collectedSpecs() {
  const raw = execFileSync(
    'pnpm',
    ['exec', 'playwright', 'test', `--config=${configPath}`, '--list', '--reporter=json'],
    { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  const report = JSON.parse(raw);
  const files = new Set();
  const visitSuites = (suites = []) => {
    for (const suite of suites) {
      if (suite.file) files.add(normaliseSpec(suite.file));
      for (const spec of suite.specs ?? []) {
        if (spec.file) files.add(normaliseSpec(spec.file));
      }
      visitSuites(suite.suites);
    }
  };
  visitSuites(report.suites);
  return files;
}

const onDisk = walkSpecs(testsRoot).map((f) => relative(testsRoot, f));
const collected = collectedSpecs();
const uncollected = onDisk.filter((f) => !collected.has(f)).sort();

if (uncollected.length > 0) {
  // eslint-disable-next-line no-console
  console.error(
    `\n✖ E2E spec-coverage guard FAILED: ${uncollected.length} spec(s) match no ` +
      `project testMatch in playwright.config.ts and would be SILENTLY dropped ` +
      `from \`pnpm test:e2e\`:\n` +
      uncollected.map((f) => `    - tests/${f}`).join('\n') +
      `\n\nAdd a project (or widen an existing testMatch) so every spec is ` +
      `collected. See the "Surface → project map" comment in playwright.config.ts.\n`,
  );
  process.exit(1);
}

// eslint-disable-next-line no-console
console.log(
  `✓ E2E spec-coverage guard: all ${onDisk.length} spec(s) under e2e/tests are ` +
    `collected by a Playwright project.`,
);
