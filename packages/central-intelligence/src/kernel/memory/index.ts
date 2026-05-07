/**
 * Kernel memory ports — barrel.
 *
 * The kernel's four-tier memory hierarchy: episodic, semantic,
 * procedural, reflective. All ports are duck-typed so adapters in
 * `@bossnyumba/database` can be wired without an inter-package type
 * dependency. Production composition root in `services/api-gateway`
 * binds the Drizzle services; tests bind in-memory fakes.
 */

export type {
  EpisodicEntry,
  EpisodicKind,
  EpisodicMemoryPort,
  EpisodicRecallArgs,
  EpisodicRecordArgs,
  MemoryHierarchy,
  ProceduralMatchArgs,
  ProceduralMemoryPort,
  ProceduralPattern,
  ProceduralRecordArgs,
  ReflectiveDigest,
  ReflectiveDigestInput,
  ReflectiveLatestArgs,
  ReflectiveMemoryPort,
  ReflectivePeriodKind,
  ReflectiveTopicCount,
  SemanticDecayArgs,
  SemanticFact,
  SemanticLookupArgs,
  SemanticMemoryPort,
  SemanticSearchArgs,
  SemanticSource,
  SemanticUpsertArgs,
} from './types.js';
