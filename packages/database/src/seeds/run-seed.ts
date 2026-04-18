/**
 * Seed runner CLI.
 *
 * Usage:
 *   pnpm db:seed --org=trc
 *   pnpm db:seed --org=all
 *
 * Each org seed is invoked inside its own transaction (managed by the seed
 * itself). The runner simply wires up the database client and dispatches
 * based on the --org flag.
 *
 * Requires DATABASE_URL. Refuses to run without an explicit SEED_ORG_SEEDS=true
 * acknowledgement so org seeds cannot accidentally execute in production.
 */

import { createDatabaseClient } from '../client.js';
import { seedTrc } from './trc-seed.js';

interface ParsedArgs {
  readonly org: string;
}

function parseArgs(argv: readonly string[]): ParsedArgs {
  let org = '';
  for (const arg of argv) {
    const match = arg.match(/^--org=(.+)$/);
    if (match && match[1]) {
      org = match[1].trim().toLowerCase();
    }
  }
  if (!org) {
    throw new Error(
      'Missing --org=<name> flag. Try --org=trc or --org=all.',
    );
  }
  return { org };
}

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) {
    throw new Error(
      `Seed: required env var ${name} is not set.`,
    );
  }
  return v;
}

type OrgSeedRunner = (db: ReturnType<typeof createDatabaseClient>) => Promise<void>;

const ORG_SEEDS: Record<string, OrgSeedRunner> = {
  trc: seedTrc,
  // future: mkotikoti, kilimani, etc.
};

async function main(): Promise<void> {
  const { org } = parseArgs(process.argv.slice(2));

  // Hard gate — org seeds must be opted into explicitly so a dev running
  // `pnpm db:seed` against a prod URL does not inadvertently write fake data.
  if (process.env.SEED_ORG_SEEDS !== 'true') {
    throw new Error(
      'Refusing to run org seeds: set SEED_ORG_SEEDS=true to acknowledge ' +
        'this will write sample data for the requested organization(s).',
    );
  }

  const databaseUrl = requireEnv('DATABASE_URL');
  const db = createDatabaseClient(databaseUrl);

  const targets =
    org === 'all' ? Object.keys(ORG_SEEDS) : [org];

  for (const target of targets) {
    const runner = ORG_SEEDS[target];
    if (!runner) {
      throw new Error(
        `Unknown org seed "${target}". Known: ${Object.keys(ORG_SEEDS).join(', ')}.`,
      );
    }
    console.log(`[run-seed] running seed for ${target}`);
    try {
      await runner(db);
    } catch (err) {
      console.error(`[run-seed] seed failed for ${target}:`, err);
      throw err;
    }
  }

  console.log('[run-seed] all seeds complete');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[run-seed] fatal:', err);
    process.exit(1);
  });
