/**
 * Adapter that bridges brain-ingestion's `KnowledgeGraphGrower` port
 * to the real-estate `growKnowledgeGraphFromDoc` implementation.
 *
 * Wave COMPANY-BRAIN (C-4). Composition root binds this so any tenant
 * upload that flows through `ingest()` gets entity extraction +
 * cross-references for free.
 *
 * RLS (#16 follow-up): the optional `boundDb` is the REQUEST-bound
 * tenant transaction handle (`c.get('db')`) that the corpus-upload
 * handler already uses for its own persistence. Threading it here keeps
 * the grower's `entity_index` / `entity_cross_references` writes on the
 * SAME tenant-bound transaction (where `app.current_tenant_id` is set
 * via `SET LOCAL`), instead of the grower escaping to the raw
 * process-singleton client and bypassing the RLS GUC. Omit it and the
 * grower falls back to the singleton — unchanged behaviour for callers
 * that have no request transaction.
 */

import { growKnowledgeGraphFromDoc } from '../knowledge-graph/index.js';
import type { KnowledgeGraphGrower } from './ingest.js';

export function createDefaultKnowledgeGraphGrower(
  boundDb?: unknown,
): KnowledgeGraphGrower {
  return async (input) => {
    const growth = await growKnowledgeGraphFromDoc(
      input,
      // The grower's `UpsertableDb` is the structural query-builder
      // surface drizzle's tx handle satisfies; the caller passes the
      // already-resolved request db so we type-erase the bridge here.
      boundDb as Parameters<typeof growKnowledgeGraphFromDoc>[1],
    );
    return {
      entitiesExtracted: growth.entitiesExtracted,
      previewEntities: growth.previewEntities.map((e) => ({
        kind: e.kind,
        displayName: e.displayName,
      })),
    };
  };
}
