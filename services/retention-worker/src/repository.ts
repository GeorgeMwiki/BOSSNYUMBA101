/**
 * Default (stub) Repository Adapter
 *
 * This module provides the wiring between the retention worker and the
 * `@bossnyumba/database` package. Because the concrete ORM models for the
 * many entity types referenced by the default retention policies
 * (LedgerEntry, Payment, Lease, AuditEvent, Message, ...) live across a
 * number of schemas, this adapter is intentionally conservative: it
 * returns an empty candidate set for unknown entity types and logs a
 * warning. Services that want to participate in the sweep register their
 * own handlers via `registerEntityAdapter`.
 *
 * Tests use their own in-memory repository instead of this one; see
 * `src/__tests__/worker.test.ts`.
 */

import { createLogger, type Logger } from './logger.js';
import type {
  RetentionCandidate,
  RetentionRepository,
  SweepResult,
} from './types.js';

export interface EntityAdapter {
  findCandidates(args: { olderThan: Date }): Promise<RetentionCandidate[]>;
  findLegalHoldEntityIds(args: {
    entityIds: readonly string[];
  }): Promise<Set<string>>;
  softDelete(args: {
    entityIds: readonly string[];
    deletedAt: Date;
  }): Promise<number>;
  hardDelete(args: { entityIds: readonly string[] }): Promise<number>;
}

export interface AuditLogSink {
  write(entry: SweepResult): Promise<void>;
}

export interface DefaultRepositoryOptions {
  readonly logger?: Logger;
  readonly auditSink?: AuditLogSink;
}

/**
 * A registry-based repository. Each service contributes its own
 * `EntityAdapter` on startup so it can control exactly how its rows are
 * queried and deleted.
 */
export class RegistryRetentionRepository implements RetentionRepository {
  private readonly adapters = new Map<string, EntityAdapter>();
  private readonly logger: Logger;
  private readonly auditSink: AuditLogSink | undefined;

  constructor(options: DefaultRepositoryOptions = {}) {
    this.logger = options.logger ?? createLogger('retention-repo');
    this.auditSink = options.auditSink;
  }

  registerEntityAdapter(entityType: string, adapter: EntityAdapter): void {
    this.adapters.set(entityType, adapter);
    this.logger.info('registered retention adapter', { entityType });
  }

  async findCandidates(args: {
    entityType: string;
    olderThan: Date;
  }): Promise<RetentionCandidate[]> {
    const adapter = this.adapters.get(args.entityType);
    if (!adapter) {
      this.logger.warn('no retention adapter for entity type, skipping', {
        entityType: args.entityType,
      });
      return [];
    }
    return adapter.findCandidates({ olderThan: args.olderThan });
  }

  async findLegalHoldEntityIds(args: {
    entityType: string;
    entityIds: readonly string[];
  }): Promise<Set<string>> {
    const adapter = this.adapters.get(args.entityType);
    if (!adapter) return new Set();
    return adapter.findLegalHoldEntityIds({ entityIds: args.entityIds });
  }

  async softDelete(args: {
    entityType: string;
    entityIds: readonly string[];
    deletedAt: Date;
  }): Promise<number> {
    const adapter = this.adapters.get(args.entityType);
    if (!adapter) return 0;
    return adapter.softDelete({
      entityIds: args.entityIds,
      deletedAt: args.deletedAt,
    });
  }

  async hardDelete(args: {
    entityType: string;
    entityIds: readonly string[];
  }): Promise<number> {
    const adapter = this.adapters.get(args.entityType);
    if (!adapter) return 0;
    return adapter.hardDelete({ entityIds: args.entityIds });
  }

  async writeAuditLog(entry: SweepResult): Promise<void> {
    if (this.auditSink) {
      await this.auditSink.write(entry);
      return;
    }

    // Fall back to the structured log stream so the record is still
    // captured even if no external sink has been wired up yet.
    this.logger.info('retention sweep audit log', {
      auditLog: entry,
    });
  }
}
