/**
 * Persona-tool audit sink — real-estate edition.
 *
 * Companion to `loopback-http-client.ts`. The persona-tool gate's
 * `auditSink` is the SECOND layer of observability — "what tool did
 * the brain decide to call, with what stakes, with what outcome" —
 * not a duplicate of any per-domain audit ledger (decision-journal,
 * ai_audit_chain, ledger).
 *
 * Two implementations:
 *
 *   - `createPinoAuditSink(logger)` — production sink. Emits one
 *     structured info log per WRITE-tool call. The `tool.persona_audit`
 *     event name is reserved for this sink — alerts key on it.
 *
 *   - `createInMemoryAuditSink()` — test seam. Collects every append
 *     into an array for assertions.
 *
 * Ported from Borjie's `brain-tools/audit-sink.ts` verbatim — the
 * audit-entry shape is identical.
 */

import type {
  PersonaToolAuditEntry,
  PersonaToolAuditSink,
} from './types.js';

interface PinoLogger {
  info(ctx: object, message?: string): void;
}

/**
 * Production sink. Emits one structured info log per WRITE-tool call
 * so the entry is searchable in the standard Pino pipeline.
 */
export function createPinoAuditSink(
  logger: PinoLogger,
): PersonaToolAuditSink {
  return {
    async append(entry: PersonaToolAuditEntry): Promise<void> {
      logger.info(
        {
          event: 'tool.persona_audit',
          toolId: entry.toolId,
          tenantId: entry.tenantId,
          actorId: entry.actorId,
          personaSlug: entry.personaSlug,
          stakes: entry.stakes,
          inputDigest: entry.inputDigest,
          outcome: entry.outcome,
          occurredAt: entry.occurredAt,
        },
        'persona-tool audit',
      );
    },
  };
}

/**
 * Test sink — collects every append into an array for assertions.
 */
export interface InMemoryAuditSink extends PersonaToolAuditSink {
  readonly entries: ReadonlyArray<PersonaToolAuditEntry>;
}

export function createInMemoryAuditSink(): InMemoryAuditSink {
  const buf: PersonaToolAuditEntry[] = [];
  return {
    get entries(): ReadonlyArray<PersonaToolAuditEntry> {
      return buf;
    },
    async append(entry: PersonaToolAuditEntry): Promise<void> {
      buf.push(entry);
    },
  };
}
