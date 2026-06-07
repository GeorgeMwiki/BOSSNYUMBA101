/**
 * Translation wiring — composition-root binding for the
 * `@bossnyumba/translation` facade.
 *
 * Builds:
 *   1. A Claude translator (Anthropic SDK, latest Sonnet via the dynamic
 *      registry, temp 0) configured with the BossNyumba domain hint.
 *   2. A Drizzle-backed cache adapter that targets the
 *      `translation_cache` table (migration 0303).
 *   3. A Pino logger shim that routes through the api-gateway's Pino.
 *
 * Calls `setGlobalTranslate()` exactly once so every consumer of the
 * package-level `translate(...)` export resolves to the real, cached,
 * Claude-backed implementation.
 *
 * Fails open with a logged warning when ANTHROPIC_API_KEY is not set
 * (per the facade's documented contract).
 */

import Anthropic from '@anthropic-ai/sdk';
import {
  createTranslate,
  setGlobalTranslate,
  createDrizzleTranslationCache,
  createInMemoryTranslationCache,
  createClaudeTranslator,
  type SqlRunner,
} from '@bossnyumba/translation';
import { getModelLatest } from '@bossnyumba/brain-llm-router/dynamic-registry';
import { sql } from 'drizzle-orm';
import type pino from 'pino';

export interface TranslationWiringInput {
  readonly db: any | null;
  readonly logger: pino.Logger;
}

export interface TranslationWiringResult {
  readonly bound: boolean;
  readonly reason?: string;
}

function resolveAnthropicKey(): string | null {
  const key =
    process.env['ANTHROPIC_API_KEY'] ??
    process.env['CLAUDE_API_KEY'] ??
    process.env['ANTHROPIC_KEY'];
  if (typeof key !== 'string') return null;
  const trimmed = key.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function makeSqlRunner(db: { execute: (q: unknown) => Promise<unknown> }): SqlRunner {
  return {
    async query<Row = Record<string, unknown>>(
      query: string,
      params: ReadonlyArray<unknown>,
    ) {
      const stmt = buildParamSql(query, params);
      const result = await db.execute(stmt);
      const rows = (result as any).rows ?? (result as unknown as Row[]);
      return rows as ReadonlyArray<Row>;
    },
    async exec(query: string, params: ReadonlyArray<unknown>) {
      const stmt = buildParamSql(query, params);
      await db.execute(stmt);
    },
  };
}

function buildParamSql(query: string, params: ReadonlyArray<unknown>) {
  const parts = query.split(/(\$\d+)/);
  const chunks: ReturnType<typeof sql>[] = [];
  for (const part of parts) {
    const m = part.match(/^\$(\d+)$/);
    if (m) {
      const idx = Number(m[1]) - 1;
      chunks.push(sql`${params[idx]}`);
    } else if (part.length > 0) {
      chunks.push(sql.raw(part));
    }
  }
  return chunks.reduce(
    (acc, c, i) => (i === 0 ? c : sql`${acc}${c}`),
    sql``,
  );
}

export function wireTranslation(
  input: TranslationWiringInput,
): TranslationWiringResult {
  const apiKey = resolveAnthropicKey();
  if (apiKey === null) {
    input.logger.warn(
      'translation: ANTHROPIC_API_KEY not set — translate() will fall back to source text',
    );
    return { bound: false, reason: 'missing-api-key' };
  }
  if (input.db === null) {
    input.logger.warn(
      'translation: DATABASE_URL not set — cache disabled, every request hits Claude',
    );
  }

  try {
    const client = new Anthropic({ apiKey });
    // Inject the latest Sonnet id from the dynamic registry so translation
    // dispatch tracks the current model instead of the package's in-house
    // fallback literal.
    const translator = createClaudeTranslator({
      client,
      config: { model: getModelLatest('sonnet') },
    });

    const cache =
      input.db !== null
        ? createDrizzleTranslationCache({
            runner: makeSqlRunner(input.db),
            logger: {
              warn: (msg, meta) => input.logger.warn(meta ?? {}, msg),
            },
          })
        : createInMemoryTranslationCache();

    const translate = createTranslate({
      cache,
      translator,
      logger: {
        info: (msg, meta) => input.logger.info(meta ?? {}, msg),
        warn: (msg, meta) => input.logger.warn(meta ?? {}, msg),
        error: (msg, meta) => input.logger.error(meta ?? {}, msg),
      },
      defaultSurface: 'api-gateway',
    });

    setGlobalTranslate(translate);
    input.logger.info(
      'translation: bound (latest Claude Sonnet via registry + Drizzle cache + Pino logger)',
    );
    return { bound: true };
  } catch (err) {
    input.logger.error(
      { err: err instanceof Error ? err.message : String(err) },
      'translation: wiring failed',
    );
    return {
      bound: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}
