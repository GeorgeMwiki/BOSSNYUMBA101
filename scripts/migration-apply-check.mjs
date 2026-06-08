#!/usr/bin/env node
/**
 * migration-apply-check — fresh-DB migration apply validator.
 *
 * Companion to scripts/validate-migration-safety.mjs. Where the safety
 * validator catches NOT-NULL backfill hazards via static analysis,
 * THIS script catches ANY error that surfaces when applying every
 * migration in lex order against an empty Postgres database, e.g.:
 *
 *   - operator does not exist: text = uuid   (Z-MIG verifier, 2026-05-21)
 *   - relation "owner_statements" does not exist
 *   - syntax error at or near "IN" (window reserved word)
 *   - could not open extension control file (pgvector missing)
 *
 * Strategy:
 *
 *   1. Read every *.sql file under --migrations-dir, sorted in
 *      lex order (matches the runtime apply order in
 *      packages/database/src/run-migrations.ts).
 *   2. Connect to --db-url with ON_ERROR_STOP semantics (each file
 *      wrapped in a transaction; if a single statement errors the
 *      whole file is rolled back).
 *   3. Apply each file via the `psql` shell-out path (one transaction
 *      per file, matching the production runner).
 *   4. Capture ERROR / FATAL lines from stderr; record per-file PASS
 *      / FAIL with the first error line.
 *   5. Emit a markdown summary + JSON sidecar.
 *
 * Exit codes:
 *   0  every migration applied without error
 *   1  one or more migrations failed (ERROR / FATAL detected)
 *   2  fatal harness error (DB unreachable, psql missing, etc.)
 *
 * CLI:
 *   node scripts/migration-apply-check.mjs \
 *     --migrations-dir=packages/database/src/migrations \
 *     --db-url=$DATABASE_URL \
 *     [--report=.audit/migration-apply.md] \
 *     [--reset-db=true]    # DROP+CREATE the target DB first
 *     [--enable-vector=true]  # CREATE EXTENSION vector before applying
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  isMigrationApplyAllowlisted,
  migrationApplyAllowlistReason,
} from './__allowlists__/migration-apply-allowlist.mjs';

const ROOT = resolve(fileURLToPath(import.meta.url), '..', '..');

const DEFAULTS = {
  migrationsDir: 'packages/database/src/migrations',
  dbUrl: process.env.DATABASE_URL || '',
  report: '',
  resetDb: false,
  enableVector: true,
};

function parseArgs(argv) {
  const args = { ...DEFAULTS };
  for (const raw of argv) {
    if (!raw.startsWith('--')) continue;
    const eq = raw.indexOf('=');
    const key = eq === -1 ? raw.slice(2) : raw.slice(2, eq);
    const value = eq === -1 ? 'true' : raw.slice(eq + 1);
    switch (key) {
      case 'migrations-dir': args.migrationsDir = value; break;
      case 'db-url':         args.dbUrl = value; break;
      case 'report':         args.report = value; break;
      case 'reset-db':       args.resetDb = value === 'true' || value === '1'; break;
      case 'enable-vector':  args.enableVector = value === 'true' || value === '1'; break;
      case 'help':
      case 'h':              printHelp(); process.exit(0); break;
      default: break;
    }
  }
  return args;
}

function printHelp() {
  // eslint-disable-next-line no-console
  console.log([
    'migration-apply-check — fresh-DB apply validator',
    '',
    'Usage:',
    '  node scripts/migration-apply-check.mjs [flags]',
    '',
    'Flags:',
    '  --migrations-dir=<path>  default packages/database/src/migrations',
    '  --db-url=<url>           required, or set $DATABASE_URL',
    '  --report=<path>          optional, write markdown report to this path',
    '  --reset-db=true|false    drop + recreate the target DB (default false)',
    '  --enable-vector=true|false  CREATE EXTENSION vector first (default true)',
    '',
    'Exit codes:',
    '  0  every migration applied without ERROR / FATAL',
    '  1  one or more migrations failed',
    '  2  harness error',
  ].join('\n'));
}

function findMigrationFiles(dir) {
  const abs = resolve(ROOT, dir);
  if (!existsSync(abs)) {
    throw new Error(`Migrations dir not found: ${abs}`);
  }
  return readdirSync(abs)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => ({ name: f, path: join(abs, f) }));
}

function applyOne(dbUrl, file) {
  // -v ON_ERROR_STOP=1 = abort the file on the first ERROR. Single
  // transaction per file matches the production runner. Capture
  // BOTH stdout (NOTICE messages) and stderr (errors).
  const result = spawnSync(
    'psql',
    [dbUrl, '-v', 'ON_ERROR_STOP=1', '-X', '-q', '-f', file.path],
    { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
  );

  const stderr = result.stderr || '';
  const stdout = result.stdout || '';

  // ERROR / FATAL detection — psql emits these on stderr.
  const errorLines = stderr
    .split('\n')
    .filter((line) => /^(psql:.*:\s*)?(ERROR|FATAL):/i.test(line));

  const passed = result.status === 0 && errorLines.length === 0;

  // Known-broken migrations (already shipped to production; cannot be
  // edited per the CLAUDE.md immutability rule). The error is still
  // reported in the markdown but the gate exit code treats them as
  // accepted-risk, identical to the .trivyignore + audit-with-allowlist
  // patterns for transitive CVEs.
  const allowlisted = !passed && isMigrationApplyAllowlisted(file.name);

  return {
    file: file.name,
    exitCode: result.status ?? -1,
    stderr,
    stdout,
    errorLines,
    passed,
    allowlisted,
    allowlistReason: allowlisted ? migrationApplyAllowlistReason(file.name) : null,
  };
}

function isAlreadyApplied(dbUrl, file) {
  // Mirror the production runner's per-file skip EXACTLY
  // (packages/database/src/run-migrations.ts ~L284-293): the runner keys
  // the skip on `hash = <filename-without-.sql>` in
  // drizzle.__drizzle_migrations and `continue`s past any file already
  // recorded there. The preempt migrations (0186b / 0226b) deliberately
  // INSERT the hashes of their UNPARSEABLE successors (0187 / 0227 / 0228)
  // into that ledger so the runner NEVER executes those file bodies in
  // production. Honoring the same skip here makes the apply-check faithful:
  // it stops force-applying files that production skips, which is the repo's
  // documented strategy for parse-time-broken immutable migrations (see the
  // 0186b / 0226b / 0216 / 0240 headers) rather than editing the shipped
  // files in violation of the immutability rule.
  const name = file.name.replace(/\.sql$/, '');
  const result = spawnSync(
    'psql',
    [
      dbUrl,
      '-X',
      '-q',
      '-tA',
      '-c',
      `SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash = '${name}' LIMIT 1`,
    ],
    { encoding: 'utf8' },
  );
  // status !== 0 means the probe itself failed (e.g. ledger table missing);
  // treat that as "not applied" so the file is attempted and any real error
  // surfaces — never silently skip on a probe failure.
  if (result.status !== 0) return false;
  return (result.stdout || '').trim() === '1';
}

function maybeResetDb(dbUrl) {
  // Parse out the dbname from a postgres://user:pass@host:port/dbname URL.
  const m = /^(postgres(?:ql)?:\/\/[^/]+)\/([^?]+)/.exec(dbUrl);
  if (!m) {
    throw new Error(`Cannot parse db-url for reset: ${dbUrl}`);
  }
  const baseUrl = m[1];
  const dbName = m[2];
  const adminUrl = `${baseUrl}/postgres`;

  // Drop + create. ON_ERROR_STOP off so DROP IF NOT EXISTS doesn't abort.
  const drop = spawnSync(
    'psql',
    [adminUrl, '-X', '-q', '-c', `DROP DATABASE IF EXISTS "${dbName}"`],
    { encoding: 'utf8' },
  );
  if (drop.status !== 0) {
    throw new Error(`DROP DATABASE failed: ${drop.stderr}`);
  }
  const create = spawnSync(
    'psql',
    [adminUrl, '-X', '-q', '-c', `CREATE DATABASE "${dbName}"`],
    { encoding: 'utf8' },
  );
  if (create.status !== 0) {
    throw new Error(`CREATE DATABASE failed: ${create.stderr}`);
  }
}

function maybeEnableVector(dbUrl) {
  // Best-effort. If pgvector isn't installed on the server, the rest
  // of the apply still works via the 0178 guard.
  const result = spawnSync(
    'psql',
    [dbUrl, '-X', '-q', '-c', 'CREATE EXTENSION IF NOT EXISTS vector'],
    { encoding: 'utf8' },
  );
  return result.status === 0;
}

function bootstrapDrizzleLedger(dbUrl) {
  // Faithfully mirror the production runner's pre-apply bootstrap in
  // packages/database/src/run-migrations.ts (~L270-277). The runner
  // ALWAYS creates schema "drizzle" + table "drizzle.__drizzle_migrations"
  // BEFORE applying any migration, so the preempt migrations
  // (0159b / 0164c9 / 0186b / 0210b / 0226b) can INSERT their hash
  // into that ledger. Without this bootstrap the apply-check is
  // unfaithful: those migrations fail with
  //   relation "drizzle.__drizzle_migrations" does not exist
  // even though they apply cleanly under the real runner.
  //
  // The column shape (id / hash / created_at) is copied EXACTLY from
  // the runner; do not drift it. ON_ERROR_STOP=1 so a bootstrap
  // failure surfaces loudly rather than masking later ledger errors.
  const bootstrapSql = [
    'CREATE SCHEMA IF NOT EXISTS drizzle;',
    'CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (',
    '  id SERIAL PRIMARY KEY,',
    '  hash TEXT NOT NULL,',
    '  created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT',
    ');',
  ].join('\n');
  const result = spawnSync(
    'psql',
    [dbUrl, '-v', 'ON_ERROR_STOP=1', '-X', '-q', '-c', bootstrapSql],
    { encoding: 'utf8' },
  );
  if (result.status !== 0) {
    throw new Error(
      `drizzle ledger bootstrap failed (CREATE SCHEMA / __drizzle_migrations): ${result.stderr || result.error}`,
    );
  }
}

function bootstrapSupabaseRoles(dbUrl) {
  // Faithfully mirror the roles that ALWAYS exist on a real Supabase
  // Postgres cluster (the project bootstrap provisions them via the
  // roles migration that ships with every Supabase database):
  //
  //   anon          — unauthenticated PostgREST role
  //   authenticated — logged-in JWT role (BossNyumba's canonical app role)
  //   service_role  — privileged backend role that bypasses RLS
  //
  // Many shipped migrations REVOKE/GRANT to these roles inside their RLS
  // sections (e.g. `GRANT SELECT ... TO authenticated`,
  // `REVOKE ALL ... FROM anon`). On a vanilla fresh Postgres the roles do
  // not exist, so psql aborts the WHOLE file transaction with
  //   role "authenticated" does not exist
  // even though the migration applies cleanly on real Supabase. Worse, the
  // per-file rollback cascades: a table created earlier in the same file is
  // discarded, so a LATER migration's FK to that table also fails (e.g.
  // 0224's FK to module_templates seeded in the rolled-back 0221).
  //
  // Postgres has no `CREATE ROLE IF NOT EXISTS`, so each role is created in
  // an idempotent DO block guarded by a pg_roles existence check. The role
  // attributes match Supabase: NOLOGIN (these are GRANT targets, not login
  // roles) + NOINHERIT. ON_ERROR_STOP=1 so a genuine bootstrap failure
  // surfaces loudly rather than masking later role errors.
  const roles = ['anon', 'authenticated', 'service_role'];
  const rolesSql = roles
    .map(
      (role) =>
        `DO $$\nBEGIN\n  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${role}') THEN\n    CREATE ROLE ${role} NOLOGIN NOINHERIT;\n  END IF;\nEND\n$$;`,
    )
    .join('\n');
  const result = spawnSync(
    'psql',
    [dbUrl, '-v', 'ON_ERROR_STOP=1', '-X', '-q', '-c', rolesSql],
    { encoding: 'utf8' },
  );
  if (result.status !== 0) {
    throw new Error(
      `Supabase role bootstrap failed (anon / authenticated / service_role): ${result.stderr || result.error}`,
    );
  }
}

function renderMarkdown(results) {
  const total = results.length;
  const passed = results.filter((r) => r.passed);
  const allowlisted = results.filter((r) => !r.passed && r.allowlisted);
  const failed = results.filter((r) => !r.passed && !r.allowlisted);
  const status = failed.length === 0 ? 'PASS' : 'FAIL';
  const lines = [
    '# Migration Apply Check',
    '',
    `**Total migrations:** ${total}`,
    `**Passed:** ${passed.length}`,
    `**Allowlisted (known-broken on fresh DB):** ${allowlisted.length}`,
    `**Failed (blocking):** ${failed.length}`,
    `**Status:** ${status}`,
    '',
  ];
  if (failed.length === 0 && allowlisted.length === 0) {
    lines.push('All migrations applied successfully against a fresh Postgres DB.');
    lines.push('');
    return lines.join('\n');
  }
  if (failed.length > 0) {
    lines.push('## Failed Migrations (blocking)');
    lines.push('');
    for (const r of failed) {
      lines.push(`### ${r.file}`);
      lines.push('');
      lines.push(`Exit code: ${r.exitCode}`);
      lines.push('');
      if (r.errorLines.length > 0) {
        lines.push('First error:');
        lines.push('```');
        lines.push(r.errorLines[0]);
        lines.push('```');
      } else {
        lines.push('No ERROR line captured — stderr tail:');
        lines.push('```');
        lines.push(r.stderr.split('\n').slice(-10).join('\n'));
        lines.push('```');
      }
      lines.push('');
    }
  }
  if (allowlisted.length > 0) {
    lines.push('## Allowlisted Migrations (known-broken on fresh DB, accepted)');
    lines.push('');
    lines.push(
      'These migrations are documented in `scripts/__allowlists__/migration-apply-allowlist.mjs` ' +
        'as legitimately-broken on a fresh DB but already healed in production by a later fixup ' +
        'migration. Per `CLAUDE.md` the shipped files cannot be edited; the fix lives in the ' +
        'append-only fixup migration referenced in the allowlist reason.',
    );
    lines.push('');
    for (const r of allowlisted) {
      lines.push(`### ${r.file}`);
      lines.push('');
      lines.push(`Reason: ${r.allowlistReason}`);
      lines.push('');
      if (r.errorLines.length > 0) {
        lines.push('First error (informational):');
        lines.push('```');
        lines.push(r.errorLines[0]);
        lines.push('```');
        lines.push('');
      }
    }
  }
  return lines.join('\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.dbUrl) {
    // eslint-disable-next-line no-console
    console.error('ERROR: --db-url is required (or set $DATABASE_URL).');
    process.exit(2);
  }

  try {
    if (args.resetDb) {
      // eslint-disable-next-line no-console
      console.log('Resetting target database...');
      maybeResetDb(args.dbUrl);
    }
    if (args.enableVector) {
      // eslint-disable-next-line no-console
      console.log('Attempting CREATE EXTENSION vector (best-effort)...');
      const ok = maybeEnableVector(args.dbUrl);
      // eslint-disable-next-line no-console
      console.log(`  pgvector available: ${ok}`);
    }

    // Mirror real Supabase: provision the anon / authenticated /
    // service_role roles BEFORE applying any migration, so the RLS sections
    // that GRANT/REVOKE to them apply faithfully instead of aborting the
    // file transaction with `role "authenticated" does not exist`. Without
    // this the apply-check is unfaithful to production (Supabase always has
    // these roles) and the per-file rollback cascades into downstream FK
    // failures.
    // eslint-disable-next-line no-console
    console.log('Bootstrapping Supabase roles (anon / authenticated / service_role)...');
    bootstrapSupabaseRoles(args.dbUrl);

    // Mirror the production runner: create the drizzle schema + ledger
    // table BEFORE applying any migration, so the preempt migrations can
    // INSERT into drizzle.__drizzle_migrations (see run-migrations.ts
    // ~L270-277). This does not change apply order or which dirs apply.
    // eslint-disable-next-line no-console
    console.log('Bootstrapping drizzle.__drizzle_migrations ledger (mirrors run-migrations.ts)...');
    bootstrapDrizzleLedger(args.dbUrl);

    const files = findMigrationFiles(args.migrationsDir);
    // eslint-disable-next-line no-console
    console.log(`Applying ${files.length} migrations from ${args.migrationsDir}...`);

    const results = [];
    let skippedCount = 0;
    for (const f of files) {
      // Faithful to production: if a preempt migration already recorded this
      // file's hash in the ledger, the runner skips it — so do we. This is
      // how 0187 / 0227 / 0228 (parse-time-broken, immutable) are handled in
      // production: 0186b / 0226b record their hashes and the runner never
      // executes their bodies. See isAlreadyApplied().
      if (isAlreadyApplied(args.dbUrl, f)) {
        skippedCount += 1;
        // eslint-disable-next-line no-console
        console.log(`  SKIP  ${f.name} (already recorded in ledger by a preempt migration)`);
        continue;
      }
      const r = applyOne(args.dbUrl, f);
      results.push(r);
      let tag;
      if (r.passed) {
        tag = 'PASS';
      } else if (r.allowlisted) {
        tag = 'KNOWN';
      } else {
        tag = 'FAIL';
      }
      // eslint-disable-next-line no-console
      console.log(
        `  ${tag}  ${r.file}${r.passed ? '' : ` — ${r.errorLines[0] || 'exit ' + r.exitCode}`}${r.allowlisted ? ' [ALLOWLISTED]' : ''}`,
      );
    }
    if (skippedCount > 0) {
      // eslint-disable-next-line no-console
      console.log(`Skipped ${skippedCount} migration(s) already recorded in the ledger (mirrors run-migrations.ts).`);
    }

    const md = renderMarkdown(results);
    // eslint-disable-next-line no-console
    console.log('\n' + md);

    if (args.report) {
      mkdirSync(dirname(resolve(ROOT, args.report)), { recursive: true });
      writeFileSync(resolve(ROOT, args.report), md, 'utf8');
    }

    // Blocking failures are anything that failed AND is not in the
    // documented allowlist. Allowlisted breakage is treated as accepted
    // risk (identical to the .trivyignore / audit-with-allowlist pattern
    // for transitive CVEs the team has reviewed and signed off on).
    const blocking = results.filter((r) => !r.passed && !r.allowlisted);
    process.exit(blocking.length === 0 ? 0 : 1);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`Harness error: ${err.message}`);
    process.exit(2);
  }
}

main();
