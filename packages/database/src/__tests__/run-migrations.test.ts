/**
 * Unit tests for the refactored `runMigrations` entry point.
 *
 * These tests verify that:
 *   a) Importing the module does not auto-invoke `runMigrations()` — in
 *      particular it must NOT call `process.exit`. This is the core
 *      requirement that lets us mount the function as a boot-time hook.
 *   b) `runMigrations()` throws a clear error when DATABASE_URL is absent.
 *
 * We never open a real Postgres connection here — case (a) confirms no
 * side-effects on import, and case (b) fails before postgres() is called.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('run-migrations module', () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;
  // Typed as `unknown` to sidestep vitest's awkward overloads around
  // process.exit (which has the `never` return type).
  let exitSpy: unknown;
  let exitCalls = 0;

  beforeEach(() => {
    exitCalls = 0;
    // Spy on process.exit so we can assert it was never called during import.
    // Throw on invocation to make accidental exits loud rather than silent.
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      exitCalls += 1;
      throw new Error(`process.exit called with code=${code ?? 'undefined'}`);
    }) as never);
  });

  afterEach(() => {
    (exitSpy as { mockRestore: () => void }).mockRestore();
    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }
    vi.resetModules();
  });

  it('does not call process.exit on import (can be safely loaded as a library)', async () => {
    // Importing the module should register exports only — no side-effects.
    const mod = await import('../run-migrations.js');

    expect(typeof mod.runMigrations).toBe('function');
    expect(exitCalls).toBe(0);
  });

  it('throws "DATABASE_URL not set" when both option and env are absent', async () => {
    delete process.env.DATABASE_URL;
    const { runMigrations } = await import('../run-migrations.js');

    await expect(runMigrations()).rejects.toThrow('DATABASE_URL not set');
    expect(exitCalls).toBe(0);
  });
});

describe('stripWrappingTransaction', () => {
  it('strips a leading BEGIN; and trailing COMMIT;', async () => {
    const { stripWrappingTransaction } = await import('../run-migrations.js');
    const out = stripWrappingTransaction(
      'BEGIN;\nCREATE TABLE x (id int);\nCOMMIT;',
    );
    expect(out).not.toMatch(/\bBEGIN\b/i);
    expect(out).not.toMatch(/\bCOMMIT\b/i);
    expect(out).toContain('CREATE TABLE x');
  });

  it('strips a wrapper preceded by SQL comments, keeping the comment', async () => {
    const { stripWrappingTransaction } = await import('../run-migrations.js');
    const out = stripWrappingTransaction('-- header\nBEGIN;\nSELECT 1;\nEND;\n');
    expect(out).toContain('SELECT 1;');
    expect(out).toContain('-- header');
    expect(out).not.toMatch(/\bBEGIN\b/i);
    expect(out).not.toMatch(/\bEND\b/i);
  });

  it('accepts START TRANSACTION … COMMIT WORK as the wrapper', async () => {
    const { stripWrappingTransaction } = await import('../run-migrations.js');
    const out = stripWrappingTransaction(
      'START TRANSACTION;\nALTER TABLE x ADD c int;\nCOMMIT WORK;',
    );
    expect(out).toContain('ALTER TABLE x ADD c int;');
    expect(out).not.toMatch(/TRANSACTION/i);
  });

  it('returns the body unchanged when there is no wrapping transaction', async () => {
    const { stripWrappingTransaction } = await import('../run-migrations.js');
    const body = 'CREATE INDEX idx ON t (a);';
    expect(stripWrappingTransaction(body)).toBe(body);
  });

  it('does not strip a BEGIN that is not the leading wrapper', async () => {
    const { stripWrappingTransaction } = await import('../run-migrations.js');
    const body = 'CREATE TABLE x (id int);\n-- BEGIN is only mentioned here\n';
    expect(stripWrappingTransaction(body)).toBe(body);
  });

  it('throws on inputs above the 10 MB safety ceiling', async () => {
    const { stripWrappingTransaction } = await import('../run-migrations.js');
    const huge = 'a'.repeat(10_000_001);
    expect(() => stripWrappingTransaction(huge)).toThrow('10 MB');
  });
});

describe('requiresOutOfTransaction', () => {
  it('flags CREATE INDEX CONCURRENTLY', async () => {
    const { requiresOutOfTransaction } = await import('../run-migrations.js');
    expect(
      requiresOutOfTransaction('CREATE INDEX CONCURRENTLY idx ON t (a);'),
    ).toBe(true);
  });

  it('flags DROP INDEX CONCURRENTLY, VACUUM, and REINDEX', async () => {
    const { requiresOutOfTransaction } = await import('../run-migrations.js');
    expect(requiresOutOfTransaction('DROP INDEX CONCURRENTLY idx;')).toBe(true);
    expect(requiresOutOfTransaction('VACUUM ANALYZE t;')).toBe(true);
    expect(requiresOutOfTransaction('REINDEX TABLE t;')).toBe(true);
  });

  it('does NOT flag a plain CREATE INDEX (transaction-safe)', async () => {
    const { requiresOutOfTransaction } = await import('../run-migrations.js');
    expect(requiresOutOfTransaction('CREATE INDEX idx ON t (a);')).toBe(false);
  });
});
