/**
 * Drizzle-backed corpus search adapter — JC-1 (real-estate edition).
 *
 * Thin keyword search over `intelligence_corpus_chunks`. Uses ILIKE
 * over the chunk text + section + source_file metadata; the corpus
 * doesn't carry a `title` column on BossNyumba so the adapter
 * synthesises one from `section` / `source_file`.
 *
 * The corpus is tenant-AGNOSTIC for global chunks (per CLAUDE.md —
 * `tenant_id IS NULL` rows are shared across every tenant) so the
 * adapter doesn't bind a tenant context for these queries; the RLS
 * policy on the table already allows global reads. Mirror of the
 * citations / brain-ingestion read pattern.
 *
 * Ported from Borjie — column mapping retailored:
 *   content  → text         (BN schema column)
 *   title    → COALESCE(section, source_file, 'corpus chunk')
 *   id       → text PK (no cast needed; was uuid on Borjie).
 */

import { sql } from 'drizzle-orm';
import pino from 'pino';

import type { CorpusSearchAdapter } from './types.js';

const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  name: 'jurisdiction-discovery-corpus',
});

interface DbLike {
  execute(query: unknown): Promise<unknown>;
}

interface ChunkRow {
  readonly id: string;
  readonly title: string | null;
  readonly text: string;
  readonly source_file: string | null;
}

export function createDrizzleCorpusSearch(
  db: DbLike | null,
): CorpusSearchAdapter {
  return {
    async search({ query, limit = 6 }) {
      if (!db) return [];
      const safeLimit = Math.max(1, Math.min(20, limit));
      // ILIKE-based scan — keeps the adapter portable across corpus
      // variants. The query is short + targeted ("country housing
      // tribunal revenue authority") so the scan stays bounded.
      try {
        const result = (await db.execute(sql`
          SELECT
            id,
            COALESCE(section, source_file, 'corpus chunk') AS title,
            COALESCE(text, '')                              AS text,
            source_file
          FROM intelligence_corpus_chunks
          WHERE (
            text ILIKE ${`%${query}%`}
            OR section ILIKE ${`%${query}%`}
            OR source_file ILIKE ${`%${query}%`}
          )
          LIMIT ${safeLimit}
        `)) as unknown;
        const rows: ReadonlyArray<ChunkRow> = Array.isArray(result)
          ? (result as ReadonlyArray<ChunkRow>)
          : ((result as { rows?: ReadonlyArray<ChunkRow> }).rows ?? []);
        return rows.map((row) => ({
          evidenceId: row.id,
          title: row.title ?? row.source_file ?? 'corpus chunk',
          snippet: (row.text ?? '').slice(0, 480),
        }));
      } catch (err) {
        logger.warn(
          {
            err: err instanceof Error ? err.message : String(err),
            query,
          },
          'discovery-corpus: search failed',
        );
        return [];
      }
    },
  };
}
