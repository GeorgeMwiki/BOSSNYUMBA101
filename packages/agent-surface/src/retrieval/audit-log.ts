/**
 * Tiny audit-log for retrieval events.
 *
 * Every retrieval — same-tenant or cross-tenant — produces an audit
 * entry. Cross-tenant entries carry the `crossTenant: true` marker so
 * downstream review can filter them out for review.
 *
 * The in-memory store here is the contract; production implementations
 * persist via the central-intelligence audit pipeline.
 */

import type { Principal } from '../types.js';

export interface RetrievalAuditEvent {
  readonly auditId: string;
  readonly at: Date;
  readonly principalId: string;
  readonly principalKind: Principal['kind'];
  readonly tenantId: string;
  readonly query: string;
  readonly entityKinds: ReadonlyArray<string>;
  readonly topK: number;
  readonly crossTenant: boolean;
  readonly resultCount: number;
  readonly tenantsSeen: ReadonlyArray<string>;
  /** Optional `reason` string the principal supplied. */
  readonly reason?: string;
}

export interface AuditSink {
  record(event: RetrievalAuditEvent): Promise<void>;
  /** For tests + admin tools. Returns immutable snapshot. */
  list(): ReadonlyArray<RetrievalAuditEvent>;
}

export function createInMemoryAuditSink(): AuditSink {
  // Immutable: every `record` produces a NEW array.
  let log: ReadonlyArray<RetrievalAuditEvent> = [];
  return {
    async record(event) {
      log = [...log, event];
    },
    list() {
      return log;
    },
  };
}

let counter = 0;
export function nextAuditId(now: () => Date = () => new Date()): string {
  counter += 1;
  const ts = now().getTime();
  return `aud_${ts.toString(36)}_${counter.toString(36)}`;
}
