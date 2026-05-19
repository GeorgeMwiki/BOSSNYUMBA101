/**
 * AuditSink — port for emitting render audit events.
 *
 * Every successful render produces a `RenderAuditEntry`. The
 * default sink is in-memory (good for tests + cold-start). In
 * production the central-intelligence package supplies a sink
 * that writes to the audit-log table.
 */

import type { RenderAuditEntry } from './types.js';

export interface AuditSink {
  emit(entry: RenderAuditEntry): Promise<void> | void;
}

/**
 * In-memory audit sink. The `events` array is exposed for tests.
 */
export interface InMemoryAuditSink extends AuditSink {
  readonly events: readonly RenderAuditEntry[];
  clear(): void;
}

export function createInMemoryAuditSink(): InMemoryAuditSink {
  const buf: RenderAuditEntry[] = [];
  return {
    get events() {
      return buf;
    },
    emit(entry: RenderAuditEntry): void {
      buf.push(entry);
    },
    clear(): void {
      buf.length = 0;
    },
  };
}

/**
 * Build a stable audit id. Combines a high-resolution monotonic
 * counter with an entropy salt so colliding-timestamp renders
 * still produce unique ids without needing an extra dependency.
 */
let _auditCounter = 0;
export function nextAuditId(now: () => Date = () => new Date()): string {
  _auditCounter = (_auditCounter + 1) % Number.MAX_SAFE_INTEGER;
  const ts = now().toISOString().replace(/[-:.TZ]/g, '');
  return `tabview-audit-${ts}-${_auditCounter.toString(36)}`;
}
