/**
 * Tests for the security-critical contract of `createRepositories` —
 * specifically the fail-loud-in-production behaviour added to close the
 * silent-fallback CRITICAL.
 *
 * The factory uses a lazy `require('@bossnyumba/database')` (so prod
 * paths don't pay the import cost in DB-less local runs). To intercept
 * that require call we stub `require.cache` directly — `vi.mock` on its
 * own does not work for CommonJS `require()` inside the factory.
 *
 * Pair with `payment-intent-tenant-scope.test.ts` which exercises
 * the tenant-scoping predicate on `findByExternalId`.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Module from 'node:module';

type LogEntry = { level: 'warn' | 'info'; obj: object; msg: string };

function makeLogger(): { logger: { warn: (o: object, m: string) => void; info: (o: object, m: string) => void }; captured: LogEntry[] } {
  const captured: LogEntry[] = [];
  return {
    captured,
    logger: {
      warn: (obj, msg) => captured.push({ level: 'warn', obj, msg }),
      info: (obj, msg) => captured.push({ level: 'info', obj, msg }),
    },
  };
}

// Each test does `await import('../factory')`, which cold-loads the
// payments-ledger entry-point. Under CI parallel-test pressure this dynamic
// ESM import can exceed vitest's default 5s test timeout (observed
// consistently in the "Code Quality" job which runs `pnpm -r test` across
// ~50 packages concurrently). Bump to 15s for this suite only.
describe('createRepositories', { timeout: 15_000 }, () => {
  const originalEnv = { ...process.env };
  // Patch require so the lazy `require('@bossnyumba/database')` inside
  // factory.ts hits our stub instead of the real package.
  const moduleProto = Module.prototype as unknown as {
    require: NodeJS.Require;
  };
  const originalRequire = moduleProto.require;
  let throwOnDatabaseRequire = false;

  beforeEach(() => {
    throwOnDatabaseRequire = false;
    moduleProto.require = function patchedRequire(this: unknown, id: string) {
      if (id === '@bossnyumba/database') {
        if (throwOnDatabaseRequire) {
          throw new Error('simulated_db_init_failure');
        }
        return {
          createDatabaseClient: () => {
            throw new Error('simulated_db_init_failure_lazy');
          },
        };
      }
      return originalRequire.call(this, id);
    } as NodeJS.Require;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    moduleProto.require = originalRequire;
  });

  it('returns in-memory repos when DATABASE_URL is unset (dev path)', async () => {
    delete process.env.DATABASE_URL;
    process.env.NODE_ENV = 'development';
    const { logger } = makeLogger();
    const { createRepositories } = await import('../factory');

    const repos = createRepositories(logger);

    expect(repos.paymentIntentRepository.constructor.name).toBe(
      'InMemoryPaymentIntentRepository',
    );
  });

  it('throws in production when DATABASE_URL is set but driver init fails', async () => {
    process.env.DATABASE_URL = 'postgres://does-not-exist:5432/none';
    process.env.NODE_ENV = 'production';
    throwOnDatabaseRequire = true;

    const { logger, captured } = makeLogger();
    const { createRepositories } = await import('../factory');

    expect(() => createRepositories(logger)).toThrow(
      /Cannot start payments-ledger: DB unreachable/i,
    );
    expect(
      captured.some(
        (c) =>
          c.level === 'warn' &&
          /DB unreachable in production/i.test(c.msg),
      ),
    ).toBe(true);
  });

  it('degrades to in-memory in dev/test when driver init fails', async () => {
    process.env.DATABASE_URL = 'postgres://does-not-exist:5432/none';
    process.env.NODE_ENV = 'test';
    throwOnDatabaseRequire = true;

    const { logger, captured } = makeLogger();
    const { createRepositories } = await import('../factory');

    const repos = createRepositories(logger);
    expect(repos.paymentIntentRepository.constructor.name).toBe(
      'InMemoryPaymentIntentRepository',
    );
    expect(
      captured.some(
        (c) =>
          c.level === 'warn' &&
          /falling back to InMemory/i.test(c.msg),
      ),
    ).toBe(true);
  });
});
