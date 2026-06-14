/**
 * Memory writer adapter — dispatches approved memory deltas to the three
 * real Drizzle-backed memory services in `@bossnyumba/database`:
 *
 *   - core      → `createCoreMemoryBlocksService.upsert`
 *   - semantic  → `createSemanticMemoryService.upsertFact`
 *   - embedded  → `createSemanticMemoryService.upsertFact` (embedded
 *                 narrative facts share the semantic surface; the kernel's
 *                 read-side embedder lifts them into `ai_semantic_memories`
 *                 lazily — keeping the worker off the embedding hot-path).
 *
 * Idempotency contract (stage-04 `MemoryWriter`): the writer MUST no-op
 * when a delta carrying the same `appliedKey` was already written. The
 * delta's `appliedKey` is the deterministic idempotency hash from
 * stage-03, so:
 *
 *   - core blocks  — the `appliedKey` is stamped into the block metadata.
 *     The core service soft-archives the prior active block of the same
 *     (tenant, user, persona, kind) and inserts the new one, so re-running
 *     the same day's reflection would re-stamp the identical text. We
 *     guard that with an in-adapter per-key set so a second pass in the
 *     same run is a true no-op; cross-run dedupe rides on the stable
 *     `appliedKey` text being identical (no net content change).
 *   - semantic / embedded facts — `upsertFact` is keyed on
 *     (tenant, user, key); a second write of the same key is an update,
 *     not a duplicate, and the deterministic `appliedKey` keeps the value
 *     stable. The adapter additionally short-circuits already-seen keys.
 *
 * `skipped: true` is returned for the in-run dedupe path so the report
 * tabulates it as `idempotency_no_op` rather than `applied`.
 */

import {
  createCoreMemoryBlocksService,
  createSemanticMemoryService,
} from '@bossnyumba/database';

import type { MemoryWriter } from '../pipeline/stage-04-write-memory.js';
import type { BrainWorkerLogger } from '../types.js';
import type { DrizzleLikeClient } from './shared.js';

export interface MemoryWriterAdapterDeps {
  readonly db: DrizzleLikeClient;
  readonly logger?: BrainWorkerLogger;
}

const PERSONA_DEFAULT = 'mr-mwikila';

/**
 * Build a memory writer over the real core + semantic memory services.
 * The `appliedKey` set lives for the lifetime of the adapter (one sweep)
 * and provides in-run idempotency on top of the services' own keying.
 */
export function createMemoryWriterAdapter(
  deps: MemoryWriterAdapterDeps,
): MemoryWriter {
  const core = createCoreMemoryBlocksService(deps.db as never);
  const semantic = createSemanticMemoryService(deps.db as never);
  const seen = new Set<string>();

  return {
    async writeCore(args) {
      if (seen.has(args.appliedKey)) return { skipped: true };
      seen.add(args.appliedKey);
      await core.upsert({
        tenantId: args.tenantId,
        userId: args.userId,
        personaId: args.personaId ?? PERSONA_DEFAULT,
        blockKind: args.coreSubKind,
        blockText: args.content,
        metadata: { appliedKey: args.appliedKey, source: 'brain-evolution-worker' },
      });
      return { skipped: false };
    },

    async writeSemantic(args) {
      if (seen.has(args.appliedKey)) return { skipped: true };
      seen.add(args.appliedKey);
      await semantic.upsertFact({
        tenantId: args.tenantId,
        userId: args.userId,
        key: args.key,
        value: args.value,
        confidence: args.confidence,
        source: 'consolidated',
      });
      return { skipped: false };
    },

    async writeEmbedded(args) {
      if (seen.has(args.appliedKey)) return { skipped: true };
      seen.add(args.appliedKey);
      await semantic.upsertFact({
        tenantId: args.tenantId,
        userId: null,
        key: `autobiography:${args.personaId ?? PERSONA_DEFAULT}`,
        value: { text: args.content, kind: 'autobiography' },
        confidence: args.confidence,
        source: 'consolidated',
      });
      return { skipped: false };
    },
  };
}
