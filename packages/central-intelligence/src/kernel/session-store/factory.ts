/**
 * createSessionStore — Phase K-A factory, R1 gap #2.
 *
 * Reads the `SESSION_STORE` env var and returns the matching adapter.
 * Fail-closed when the env is unset in production: a silently in-memory
 * store would defeat the entire durability story this module ships for.
 *
 * Contract:
 *
 *   SESSION_STORE=memory   -> InMemorySessionStore (dev/test default)
 *   SESSION_STORE=redis    -> RedisSessionStore (caller injects client)
 *   SESSION_STORE=postgres -> PostgresSessionStore (caller injects client)
 *
 *   unset + NODE_ENV !== 'production' -> InMemorySessionStore + warn
 *   unset + NODE_ENV === 'production' -> THROW
 *
 * The caller passes optional adapter-specific deps when picking the
 * concrete adapter. This keeps the factory orthogonal to "where does
 * the Redis client come from?" — composition root wires that.
 */

import {
  createInMemorySessionStore,
  type InMemorySessionStoreDeps,
} from './in-memory-session-store.js';
import {
  createRedisSessionStore,
  type RedisSessionStoreDeps,
} from './redis-session-store.js';
import {
  createPostgresSessionStore,
  type PostgresSessionStoreDeps,
} from './postgres-session-store.js';
import type { SessionStore } from './types.js';

export type SessionStoreKind = 'memory' | 'redis' | 'postgres';

export interface CreateSessionStoreOptions {
  /**
   * Override the env-derived kind. Useful in tests that don't want to
   * mutate `process.env`.
   */
  readonly kind?: SessionStoreKind;
  /** Forwarded to the in-memory adapter when `kind === 'memory'`. */
  readonly memory?: InMemorySessionStoreDeps;
  /** Forwarded to the Redis adapter when `kind === 'redis'`. */
  readonly redis?: RedisSessionStoreDeps;
  /** Forwarded to the Postgres adapter when `kind === 'postgres'`. */
  readonly postgres?: PostgresSessionStoreDeps;
  /**
   * Override `NODE_ENV` for the fail-closed check. Defaults to
   * `process.env.NODE_ENV`. Useful in tests that exercise the
   * production-fail path without setting NODE_ENV globally.
   */
  readonly nodeEnv?: string;
  /**
   * Override the env-var read so tests don't need to mutate
   * `process.env.SESSION_STORE`.
   */
  readonly env?: Readonly<Record<string, string | undefined>>;
  /** Optional logger; defaults to `console.warn`. */
  readonly logger?: { warn: (msg: string) => void };
}

const VALID_KINDS = new Set<SessionStoreKind>(['memory', 'redis', 'postgres']);

function resolveKind(
  options: CreateSessionStoreOptions,
): { kind: SessionStoreKind | null; source: 'override' | 'env' | 'unset' } {
  if (options.kind !== undefined) {
    return { kind: options.kind, source: 'override' };
  }
  const env = options.env ?? process.env;
  const raw = env.SESSION_STORE;
  if (raw === undefined || raw === '') {
    return { kind: null, source: 'unset' };
  }
  if (VALID_KINDS.has(raw as SessionStoreKind)) {
    return { kind: raw as SessionStoreKind, source: 'env' };
  }
  throw new Error(
    `SESSION_STORE env must be one of 'memory' | 'redis' | 'postgres'; got '${raw}'`,
  );
}

export function createSessionStore(
  options: CreateSessionStoreOptions = {},
): SessionStore {
  const logger = options.logger ?? { warn: (msg: string): void => console.warn(msg) };
  const { kind, source } = resolveKind(options);

  if (kind === null) {
    // Fail-closed in production. Devs and CI fall back to in-memory
    // with a loud warning so a forgotten env doesn't ship to prod.
    const nodeEnv = options.nodeEnv ?? process.env.NODE_ENV;
    if (nodeEnv === 'production') {
      throw new Error(
        'SESSION_STORE env is required in production; set it to memory | redis | postgres',
      );
    }
    logger.warn(
      'session-store: SESSION_STORE env unset — defaulting to in-memory (dev only)',
    );
    return createInMemorySessionStore(options.memory ?? {});
  }

  switch (kind) {
    case 'memory':
      return createInMemorySessionStore(options.memory ?? {});
    case 'redis': {
      // Pass the caller's logger into the adapter so a fallback warn
      // surfaces to the same sink the factory uses (operators wire one
      // logger; tests inject a vi.fn() and assert it was called).
      const deps: RedisSessionStoreDeps = {
        ...(options.redis ?? {}),
        logger: options.redis?.logger ?? logger,
      };
      if (source === 'env' && (deps.redis === undefined || deps.redis === null)) {
        logger.warn(
          'session-store: SESSION_STORE=redis but no Redis client supplied — using in-memory fallback',
        );
      }
      return createRedisSessionStore(deps);
    }
    case 'postgres': {
      const deps: PostgresSessionStoreDeps = {
        ...(options.postgres ?? {}),
        logger: options.postgres?.logger ?? logger,
      };
      if (source === 'env' && (deps.pg === undefined || deps.pg === null)) {
        logger.warn(
          'session-store: SESSION_STORE=postgres but no pg client supplied — using in-memory fallback',
        );
      }
      return createPostgresSessionStore(deps);
    }
  }
}
