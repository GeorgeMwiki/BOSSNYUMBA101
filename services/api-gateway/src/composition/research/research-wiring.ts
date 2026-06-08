/**
 * Deep-research composition wiring (BossNyumba) — closes the "research is
 * routed inside the brain / has no reachable grounded endpoint" gap.
 *
 * BossNyumba had no standalone research route: research-shaped work was
 * either domain-specific (jurisdiction-discovery) or buried inside brain
 * turns. This file builds a small, REAL deep-research engine the gateway can
 * mount on demand, reusing BossNyumba's own primitives:
 *
 *   - corpus retrieval  — pgvector ANN over `intelligence_corpus_chunks`
 *     (recency/freshness-weighted) via the gateway's live `getDb()`.
 *   - web search        — Brave → Tavily → Serper live providers (the same
 *     ladder `@bossnyumba/truth-engine` uses), degrading to [] when key-less.
 *   - plan + synthesis  — the `@bossnyumba/brain-llm-router` Anthropic
 *     adapter, with deterministic rule-based fallbacks.
 *
 * Exposure: `buildResearchWiring()` returns `{ engine, router, persistent }`.
 * `services/api-gateway/src/index.ts` attaches `engine` onto
 * `services.researchEngine` and mounts `router` at `/api/v1/research`.
 *
 * This module NEVER calls into `index.ts`, NEVER starts a server, and reads
 * env ONLY through the adapters' own documented degradation seams. Pino-only
 * logging.
 */

import { getDb } from '../db-client.js';
import { logger } from '../../utils/logger.js';
import researchRouter from '../../routes/research/research.hono.js';
import { createResearchEngine, type ResearchEngine } from './research-engine.js';
import {
  createBrainLlmPlan,
  createBrainLlmSynthesize,
  createCorpusSearchAdapter,
  createWebSearchAdapter,
} from './research-adapters.js';

interface DbLike {
  execute(query: unknown): Promise<unknown>;
}

export interface ResearchWiring {
  /** The constructed engine — attach to `services.researchEngine`. */
  readonly engine: ResearchEngine;
  /** The router to mount at `/api/v1/research`. */
  readonly router: typeof researchRouter;
  /** True when corpus retrieval is DB-backed. */
  readonly persistent: boolean;
}

/**
 * Build the research engine + return it with its router for the orchestrator
 * to mount. Degraded mode (no DATABASE_URL) keeps the gateway booting: the
 * corpus adapter returns [] and runs proceed on web + LLM alone.
 */
export function buildResearchWiring(): ResearchWiring {
  const db = getDb() as unknown as DbLike | null;

  const engine = createResearchEngine({
    web: createWebSearchAdapter(),
    corpus: createCorpusSearchAdapter(db),
    llmPlan: createBrainLlmPlan(),
    llmSynthesize: createBrainLlmSynthesize(),
  });

  if (!db) {
    logger.warn(
      'research: DATABASE_URL unset — corpus retrieval disabled (runs use web + LLM only)',
      { wiring: 'research' },
    );
  }

  logger.info('research: engine constructed', {
    wiring: 'research',
    corpusRetrieval: db ? 'pgvector' : 'disabled',
    webSearch: 'brave|tavily|serper',
    llm: 'brain-llm-router',
  });

  return { engine, router: researchRouter, persistent: Boolean(db) };
}
