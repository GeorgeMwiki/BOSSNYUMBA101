/**
 * run-bench.ts — PMS-bench-1 driver.
 *
 * Usage:
 *   pnpm pms-bench:run
 *   pnpm pms-bench:run -- --scenario arrears-triage
 *   pnpm pms-bench:run -- --k 3
 *
 * Phase E.4 (this wave): the driver loads fixtures + scorers + a *stub*
 * sub-MD runner that returns a deterministic empty observation. This
 * confirms the wiring works end-to-end and produces a baseline-failing
 * report (0% pass rate). Phase E.5 swaps the stub runner for the real
 * sub-MD adapter.
 */

import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import {
  ALL_SCORERS,
  type ObservedRun,
  type ScoreResult,
  type TaskFixture,
} from '../scorers/index.js';
import { renderReport } from './report.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TASKS_DIR = join(ROOT, 'tasks');
const REPORTS_DIR = join(ROOT, 'reports');

interface Args {
  readonly scenario?: string;
  readonly k: number;
}

function parseArgs(argv: ReadonlyArray<string>): Args {
  let scenario: string | undefined;
  let k = 5;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--scenario') scenario = argv[++i];
    else if (a === '--k') k = Number(argv[++i] ?? 5);
  }
  return scenario === undefined ? { k } : { scenario, k };
}

async function listScenarios(): Promise<ReadonlyArray<string>> {
  const entries = await readdir(TASKS_DIR, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => e.name);
}

async function loadFixtures(scenario: string): Promise<ReadonlyArray<TaskFixture>> {
  const scenarioDir = join(TASKS_DIR, scenario);
  const files = await readdir(scenarioDir);
  const out: TaskFixture[] = [];
  for (const f of files) {
    if (!f.endsWith('.yaml')) continue;
    const raw = await readFile(join(scenarioDir, f), 'utf8');
    const parsed = parseYaml(raw) as TaskFixture;
    out.push(parsed);
  }
  return out;
}

/**
 * Phase E.4 stub. Returns a deterministic "nothing happened" observation.
 * The runner is structurally exercised, but every task naturally fails.
 * This is intentional: it forces Phase E.5 to wire a real sub-MD before
 * the suite can pass.
 */
function stubSubMdRunner(fixture: TaskFixture, _seed: number): ObservedRun {
  return {
    actions: [],
    escalated: false,
    comm: '',
    costUsdCents: 1,
    resolutionQuality: 0,
  };
}

interface TaskRunSummary {
  readonly taskId: string;
  readonly scenario: string;
  readonly runs: ReadonlyArray<{
    readonly composite: number;
    readonly scores: ReadonlyArray<ScoreResult>;
    readonly pass: boolean;
  }>;
  readonly passK: boolean;
  readonly passCount: number;
  readonly totalRuns: number;
}

function compose(scores: ReadonlyArray<ScoreResult>, weights: Readonly<Record<string, number>>): number {
  let total = 0;
  let denom = 0;
  for (const s of scores) {
    const w = weights[s.scorer] ?? 0;
    total += s.score * w;
    denom += w;
  }
  return denom > 0 ? total / denom : 0;
}

async function scoreRun(
  fixture: TaskFixture,
  run: ObservedRun,
): Promise<ReadonlyArray<ScoreResult>> {
  const results: ScoreResult[] = [];
  for (const name of Object.keys(fixture.scorer_weights)) {
    const scorer = ALL_SCORERS[name];
    if (!scorer) continue;
    results.push(await scorer(fixture, run));
  }
  return results;
}

async function runTask(fixture: TaskFixture, k: number): Promise<TaskRunSummary> {
  const runs: TaskRunSummary['runs'] = await Promise.all(
    Array.from({ length: k }, async (_, i) => {
      const observed = stubSubMdRunner(fixture, i);
      const scores = await scoreRun(fixture, observed);
      const composite = compose(scores, fixture.scorer_weights);
      return { composite, scores, pass: composite >= 0.8 };
    }),
  );
  const passCount = runs.filter((r) => r.pass).length;
  // pass^k @ k=5: fail if more than 2 of 5 fail.
  const required = Math.ceil(k * 0.6);
  return {
    taskId: fixture.id,
    scenario: fixture.scenario,
    runs,
    passCount,
    totalRuns: k,
    passK: passCount >= required,
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const scenarios = args.scenario ? [args.scenario] : await listScenarios();

  const allSummaries: TaskRunSummary[] = [];
  for (const scenario of scenarios) {
    const fixtures = await loadFixtures(scenario);
    for (const fixture of fixtures) {
      const summary = await runTask(fixture, args.k);
      allSummaries.push(summary);
      const verdict = summary.passK ? 'PASS' : 'FAIL';
      process.stdout.write(
        `[${verdict}] ${summary.taskId} (${summary.passCount}/${summary.totalRuns})\n`,
      );
    }
  }

  await mkdir(REPORTS_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = join(REPORTS_DIR, `${stamp}.md`);
  const markdown = renderReport(allSummaries);
  await writeFile(reportPath, markdown, 'utf8');
  process.stdout.write(`\nReport written: ${reportPath}\n`);
}

main().catch((err: unknown) => {
  process.stderr.write(`pms-bench run failed: ${String(err)}\n`);
  process.exit(1);
});

// Re-export TaskRunSummary so report.ts can consume it without duplicating shape.
export type { TaskRunSummary };
