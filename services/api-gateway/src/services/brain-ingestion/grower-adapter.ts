/**
 * Adapter that bridges brain-ingestion's `KnowledgeGraphGrower` port
 * to the real-estate `growKnowledgeGraphFromDoc` implementation.
 *
 * Wave COMPANY-BRAIN (C-4). Composition root binds this so any tenant
 * upload that flows through `ingest()` gets entity extraction +
 * cross-references for free.
 */

import { growKnowledgeGraphFromDoc } from '../knowledge-graph/index.js';
import type { KnowledgeGraphGrower } from './ingest.js';

export function createDefaultKnowledgeGraphGrower(): KnowledgeGraphGrower {
  return async (input) => {
    const growth = await growKnowledgeGraphFromDoc(input);
    return {
      entitiesExtracted: growth.entitiesExtracted,
      previewEntities: growth.previewEntities.map((e) => ({
        kind: e.kind,
        displayName: e.displayName,
      })),
    };
  };
}
