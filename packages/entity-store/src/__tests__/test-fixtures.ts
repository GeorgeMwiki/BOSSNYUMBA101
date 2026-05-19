/**
 * Shared test fixtures + factories.
 */

import { createEntityStoreService } from '../service/entity-store-service.js';
import { InMemoryEntityStoreRepository } from '../repository/in-memory-repository.js';
import { createEntityTypeRegistry } from '../registry/registry.js';
import type { ProvenanceSource } from '../types/provenance.js';

export function makeService(opts?: { startId?: number; clock?: string }) {
  let counter = opts?.startId ?? 1;
  const repository = new InMemoryEntityStoreRepository();
  const registry = createEntityTypeRegistry();
  const clockIso = opts?.clock ?? '2026-05-19T10:00:00Z';
  const service = createEntityStoreService({
    repository,
    registry,
    now: () => new Date(clockIso),
    idFactory: () => `id_${String(counter++).padStart(4, '0')}`,
  });
  return { service, repository, registry };
}

export function chatSource(
  conversationId = 'conv_abc',
  messageId = 'msg_42',
): ProvenanceSource {
  return {
    conversationId,
    messageId,
    llmInferredSchemaVersion: 1,
    timestamp: '2026-05-19T10:00:00Z',
  };
}

export function manualSource(): ProvenanceSource {
  return {
    manual: true,
    timestamp: '2026-05-19T10:00:00Z',
  };
}

export function fileSource(): ProvenanceSource {
  return {
    fileHash: 'sha256:abcd1234',
    rowIdx: 7,
    timestamp: '2026-05-19T10:00:00Z',
  };
}

export function researchSource(): ProvenanceSource {
  return {
    llmResearch: true,
    conversationId: 'conv_xyz',
    timestamp: '2026-05-19T11:00:00Z',
  };
}

export const TENANT_ALPHA = 't_alpha_uuid';
export const TENANT_BETA = 't_beta_uuid';
export const ADMIN_USER = 'u_md_admin';
