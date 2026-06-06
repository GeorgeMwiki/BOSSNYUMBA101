/**
 * verify-migrations tests — migration ledger-drift guard (KI-001 / KI-004).
 *
 * Coverage:
 *   1. `parseTableNames` extracts plain, `IF NOT EXISTS`, and `public.`-
 *      prefixed CREATE TABLE names; lower-cases; de-duplicates.
 *   2. Comment- and string-literal-aware: a table name that appears only
 *      inside `-- ...`, `/* ... *\/`, or a quoted value is NOT counted.
 *   3. Transient / non-base forms (TEMP, UNLOGGED, AS SELECT, PARTITION OF)
 *      are skipped — only durable base tables are verified.
 *   4. `parseExpectedTables` unions across files and attributes each table to
 *      the FIRST migration that declared it.
 *   5. `detectDrift` (TS helper) returns the expected-but-absent set, case-
 *      insensitively, immutably.
 *   6. PARSER EQUIVALENCE: the standalone `.mjs` script and the in-package
 *      `migration-drift.ts` helper return identical table sets for the same
 *      SQL. This locks the two copies together (the .mjs must run under bare
 *      node in CI, so it cannot import the TS source).
 *   7. END-TO-END skip path: running the script binary with NO DATABASE_URL
 *      exits 0 (safe no-op for DB-less CI) and writes the report.
 *
 * No live Postgres is used — the live `to_regclass` probe is exercised by the
 * runtime fail-closed path in packages/database (run-migrations) and by manual
 * `pnpm verify-migrations` against a real DB.
 */

import { describe, it, expect } from 'vitest';
import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

// Pure helpers from the standalone .mjs script (main() is guarded, so import
// never triggers CLI side-effects).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const script: any = await import(
  '../verify-migrations.mjs' as unknown as string
);

// In-package typed helper.
const helper = await import(
  '../../packages/database/src/migration-drift.js'
);

describe('parseTableNames', () => {
  it('extracts plain, IF NOT EXISTS, and public.-prefixed tables', () => {
    const sql = `
      CREATE TABLE accounts (id uuid primary key);
      CREATE TABLE IF NOT EXISTS leases (id uuid);
      CREATE TABLE IF NOT EXISTS public.owner_statements (id uuid);
    `;
    expect(script.parseTableNames(sql).sort()).toEqual([
      'accounts',
      'leases',
      'owner_statements',
    ]);
  });

  it('lower-cases and de-duplicates re-declared tables', () => {
    const sql = `
      CREATE TABLE Cases (id uuid);
      CREATE TABLE IF NOT EXISTS cases (id uuid);
    `;
    expect(script.parseTableNames(sql)).toEqual(['cases']);
  });

  it('ignores table names that only appear in comments or strings', () => {
    const sql = `
      -- CREATE TABLE commented_out (id uuid);
      /* CREATE TABLE block_commented (id uuid); */
      INSERT INTO log (msg) VALUES ('CREATE TABLE string_literal (x int)');
      CREATE TABLE real_table (id uuid);
    `;
    expect(script.parseTableNames(sql)).toEqual(['real_table']);
  });

  it('skips TEMP / UNLOGGED and non-base (AS SELECT / PARTITION OF) forms', () => {
    const sql = `
      CREATE TEMP TABLE scratch (id int);
      CREATE UNLOGGED TABLE fast_but_fragile (id int);
      CREATE TABLE summary AS SELECT 1 AS n;
      CREATE TABLE measure_y2026 PARTITION OF measure FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');
      CREATE TABLE durable (id uuid);
    `;
    expect(script.parseTableNames(sql)).toEqual(['durable']);
  });

  it('unwraps quoted identifiers', () => {
    const sql = 'CREATE TABLE IF NOT EXISTS "Weird Name" (id int);';
    expect(script.parseTableNames(sql)).toEqual(['weird name']);
  });
});

describe('parseExpectedTables — first-migration attribution', () => {
  it('unions across files and attributes each table to the first declarer', () => {
    const files = [
      { name: '0001_init.sql', sql: 'CREATE TABLE accounts (id uuid);' },
      {
        name: '0002_more.sql',
        sql: 'CREATE TABLE IF NOT EXISTS leases (id uuid); CREATE TABLE IF NOT EXISTS accounts (id uuid);',
      },
    ];
    const expected = script.parseExpectedTables(files);
    expect(expected).toEqual([
      { name: 'accounts', migration: '0001_init.sql' },
      { name: 'leases', migration: '0002_more.sql' },
    ]);
  });
});

describe('detectDrift (TS helper)', () => {
  it('returns expected-but-absent tables, case-insensitively', () => {
    const expected = [
      { name: 'accounts', migration: '0001.sql' },
      { name: 'leases', migration: '0002.sql' },
      { name: 'compliance_exports', migration: '0021.sql' },
    ];
    const present = ['ACCOUNTS', 'leases'];
    const report = helper.detectDrift(expected, present);
    expect(report.hasDrift).toBe(true);
    expect(report.missing).toEqual(['compliance_exports']);
  });

  it('reports no drift when every expected table is present', () => {
    const report = helper.detectDrift(['a', 'b'], ['b', 'a']);
    expect(report.hasDrift).toBe(false);
    expect(report.missing).toEqual([]);
  });

  it('does not mutate its inputs', () => {
    const expected = ['a', 'b'];
    const present = ['a'];
    const frozenExpected = Object.freeze([...expected]);
    const frozenPresent = Object.freeze([...present]);
    expect(() => helper.detectDrift(frozenExpected, frozenPresent)).not.toThrow();
  });
});

describe('parser equivalence — .mjs script vs .ts helper', () => {
  it('returns identical table sets for the same SQL', () => {
    const sql = `
      -- header mentioning CREATE TABLE ghost (x int)
      CREATE TABLE IF NOT EXISTS public.owner_statements (id uuid);
      CREATE TABLE Accounts (id uuid);
      CREATE TEMP TABLE scratch (id int);
      CREATE TABLE summary AS SELECT 1;
      INSERT INTO t VALUES ('CREATE TABLE quoted (x int)');
      CREATE TABLE "Mixed Case" (id int);
    `;
    const fromScript = script.parseTableNames(sql).sort();
    const fromHelper = helper.parseTableNames(sql).sort();
    expect(fromScript).toEqual(fromHelper);
  });

  it('agrees on the real migration tree', async () => {
    // Parse the actual shipped migrations through both implementations and
    // assert the expected-table sets are identical — the strongest guard
    // against the two parser copies drifting apart over time.
    const { readdirSync, readFileSync } = await import('node:fs');
    const dir = resolve(
      __dirname,
      '../../packages/database/src/migrations',
    );
    const files = readdirSync(dir)
      .filter((f: string) => f.endsWith('.sql'))
      .map((name: string) => ({
        name,
        sql: readFileSync(join(dir, name), 'utf8'),
      }));
    const scriptNames = script
      .parseExpectedTables(files)
      .map((e: { name: string }) => e.name);
    const helperNames = helper
      .parseExpectedTables(files)
      .map((e: { name: string }) => e.name);
    expect(scriptNames).toEqual(helperNames);
    // Sanity: the tree creates a large, non-trivial set of tables.
    expect(scriptNames.length).toBeGreaterThan(100);
  });
});

describe('end-to-end — skip path (no DATABASE_URL)', () => {
  it('exits 0 and writes a SKIPPED report when no DB is configured', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'verify-mig-'));
    await writeFile(
      join(dir, '0001_init.sql'),
      'CREATE TABLE IF NOT EXISTS accounts (id uuid primary key);',
    );
    const reportPath = join(dir, 'drift.md');
    const scriptPath = resolve(__dirname, '../verify-migrations.mjs');

    const env = { ...process.env };
    delete env.DATABASE_URL;
    delete env.NODE_ENV;

    const result = spawnSync(
      'node',
      [
        scriptPath,
        `--migrations-dir=${dir}`,
        `--report=${reportPath}`,
      ],
      { encoding: 'utf8', env },
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/needs DATABASE_URL/i);
    const report = await readFile(reportPath, 'utf8');
    expect(report).toMatch(/SKIPPED/);
    expect(report).toMatch(/Expected tables parsed from migrations:\*\*\s*1/);
  });
});
