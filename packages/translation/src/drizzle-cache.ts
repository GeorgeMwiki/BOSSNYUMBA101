/**
 * Drizzle-backed translation cache adapter. Mirrors
 * @borjie/translation. Reads/writes against `translation_cache`
 * (migration 0303).
 */

import type {
  TranslationCacheKey,
  TranslationCachePort,
  TranslationCacheValue,
} from './types.js';
import { contentHash } from './hash.js';

export interface DrizzleCacheLogger {
  readonly warn: (msg: string, meta?: Record<string, unknown>) => void;
}

interface CacheRow {
  readonly target_text: string;
  readonly provider: string;
  readonly glossary_version: string;
}

export interface SqlRunner {
  readonly query: <Row = Record<string, unknown>>(
    sql: string,
    params: ReadonlyArray<unknown>,
  ) => Promise<ReadonlyArray<Row>>;
  readonly exec: (sql: string, params: ReadonlyArray<unknown>) => Promise<void>;
}

export interface DrizzleCacheConfig {
  readonly runner: SqlRunner;
  readonly logger?: DrizzleCacheLogger;
}

export function createDrizzleTranslationCache(
  config: DrizzleCacheConfig,
): TranslationCachePort {
  const { runner, logger } = config;

  return Object.freeze({
    async get(key: TranslationCacheKey): Promise<string | null> {
      const hash = contentHash(key);
      try {
        const rows = await runner.query<CacheRow>(
          `SELECT target_text, provider, glossary_version
             FROM translation_cache
            WHERE content_hash = $1
            LIMIT 1`,
          [hash],
        );
        if (rows.length === 0) return null;

        runner
          .exec(
            `UPDATE translation_cache
                SET hits = hits + 1,
                    last_used_at = NOW()
              WHERE content_hash = $1`,
            [hash],
          )
          .catch((err) => {
            logger?.warn('translation.cache.hit-bump-failed', {
              error: (err as Error).message,
            });
          });

        return rows[0]?.target_text ?? null;
      } catch (err) {
        logger?.warn('translation.cache.get.failed', {
          error: (err as Error).message,
        });
        return null;
      }
    },

    async set(
      key: TranslationCacheKey,
      value: TranslationCacheValue,
    ): Promise<void> {
      const hash = contentHash(key);
      try {
        await runner.exec(
          `INSERT INTO translation_cache
             (content_hash, tenant_id, source_lang, target_lang,
              register, surface, source_text, target_text, provider,
              glossary_version, hits, created_at, last_used_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0, NOW(), NOW())
           ON CONFLICT (content_hash) DO UPDATE
             SET last_used_at = NOW(),
                 hits = translation_cache.hits + 1`,
          [
            hash,
            key.tenantId === '' ? null : key.tenantId,
            key.sourceLang,
            key.targetLang,
            key.register,
            key.surface,
            key.sourceText,
            value.targetText,
            value.provider,
            value.glossaryVersion,
          ],
        );
      } catch (err) {
        logger?.warn('translation.cache.set.failed', {
          error: (err as Error).message,
        });
      }
    },
  });
}
