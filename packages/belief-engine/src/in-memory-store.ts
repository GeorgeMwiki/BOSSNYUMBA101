/**
 * In-memory belief store — reference {@link BeliefStorePort} backed by a Map.
 *
 * Used by tests and single-replica dev. Production hosts inject a
 * Drizzle/Supabase-backed store (the brain_beliefs / belief_revisions /
 * belief_review_queue tables) instead — this package has no DB dependency.
 * `upsert` mints an id when none is supplied and returns a fresh immutable
 * belief; `update`-style writes never mutate the stored object in place.
 *
 * @module @bossnyumba/belief-engine/in-memory-store
 */

import type { BeliefStorePort } from './ports.js';
import type {
  Belief,
  BeliefDomain,
  BeliefScope,
  RevisionRecord,
  ReviewQueueItem,
} from './types.js';

function scopeKey(
  subject: string,
  userId: string | null,
  orgId: string | null,
): string {
  return `${subject}|${userId ?? ''}|${orgId ?? ''}`;
}

export interface InMemoryBeliefStore extends BeliefStorePort {
  /** Test introspection — append-only revision log. */
  readonly revisions: ReadonlyArray<RevisionRecord>;
  /** Test introspection — queued split-band items. */
  readonly reviewQueue: ReadonlyArray<ReviewQueueItem>;
  /** Test introspection — current live beliefs. */
  snapshot(): ReadonlyArray<Belief>;
}

/**
 * Build an in-memory {@link BeliefStorePort}. `idFactory` mints belief ids on
 * insert (default: incrementing counter). Deterministic + dependency-free.
 */
export function createInMemoryBeliefStore(
  seed: ReadonlyArray<Belief> = [],
  idFactory?: () => string,
): InMemoryBeliefStore {
  const beliefs = new Map<string, Belief>();
  const revisions: RevisionRecord[] = [];
  const reviewQueue: ReviewQueueItem[] = [];
  let counter = 0;
  const nextId =
    idFactory ??
    (() => {
      counter += 1;
      return `belief-${counter}`;
    });

  for (const b of seed) {
    beliefs.set(
      scopeKey(b.subject, b.subjectUserId ?? null, b.subjectOrgId ?? null),
      b,
    );
  }

  return {
    get revisions() {
      return revisions;
    },
    get reviewQueue() {
      return reviewQueue;
    },
    snapshot() {
      return Array.from(beliefs.values());
    },

    async findBySubject(
      subject: string,
      scope?: BeliefScope,
    ): Promise<Belief | null> {
      const key = scopeKey(
        subject,
        scope?.subjectUserId ?? null,
        scope?.subjectOrgId ?? null,
      );
      return beliefs.get(key) ?? null;
    },

    async listByDomain(
      domain: BeliefDomain,
      limit = 100,
      scope?: BeliefScope,
    ): Promise<ReadonlyArray<Belief>> {
      const wantUser = scope?.subjectUserId ?? null;
      const wantOrg = scope?.subjectOrgId ?? null;
      return Array.from(beliefs.values())
        .filter(
          (b) =>
            b.domain === domain &&
            (b.subjectUserId ?? null) === wantUser &&
            (b.subjectOrgId ?? null) === wantOrg,
        )
        .sort((a, b) => Date.parse(b.revisedAt) - Date.parse(a.revisedAt))
        .slice(0, limit);
    },

    async upsert(belief: Belief): Promise<Belief> {
      const id = belief.id || nextId();
      const persisted: Belief = { ...belief, id };
      beliefs.set(
        scopeKey(
          persisted.subject,
          persisted.subjectUserId ?? null,
          persisted.subjectOrgId ?? null,
        ),
        persisted,
      );
      return persisted;
    },

    async recordRevision(record: RevisionRecord): Promise<void> {
      revisions.push(record);
    },

    async enqueueReview(item: ReviewQueueItem): Promise<void> {
      reviewQueue.push(item);
    },
  };
}
