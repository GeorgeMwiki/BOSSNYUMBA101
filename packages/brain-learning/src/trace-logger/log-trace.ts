/**
 * logTrace — idempotent write of one trace event.
 *
 * Behaviour:
 *   1. Computes storage tier based on age (hot/warm/cold).
 *   2. Runs the 4-layer PII redaction pipeline.
 *   3. If quarantined → returns the audit but does not call the store.
 *   4. Otherwise calls TraceEventStore.upsertIfAbsent (idempotent).
 *
 * Idempotence: re-calling with the same (tenantId, turnId) is a no-op
 * if the row already exists. The store implements this via a unique
 * constraint on (tenantId, turnId).
 */

import type {
  TraceEvent,
  TraceToolCall,
  TurnId,
  TurnOutcome,
  TurnRole,
} from '../types.js';
import { storageTierFor } from './storage-tiering.js';
import type {
  RedactionPipeline,
  RedactionInput,
  RedactionOutput,
} from './redaction-pipeline.js';

/**
 * Input to logTrace. Mirrors the spec line:
 *   logTrace({tenantId, conversationId, turn, role, content,
 *             tool_calls?, outcome?})
 */
export interface LogTraceInput {
  readonly tenantId: string;
  readonly conversationId: string;
  readonly turnId: TurnId;
  readonly turn: number;
  readonly role: TurnRole;
  readonly content: string;
  readonly toolCalls?: ReadonlyArray<TraceToolCall>;
  readonly outcome?: TurnOutcome;
  readonly consentForTraining: boolean;
  readonly actorId: string;
}

/**
 * Storage port — wire-side persistence to the J1 `trace_event` entity.
 * Implementations MUST be idempotent on (tenantId, turnId).
 */
export interface TraceEventStore {
  /**
   * Insert if not present. Returns `inserted=false` for the no-op path.
   */
  upsertIfAbsent(event: TraceEvent): Promise<{ inserted: boolean }>;

  /**
   * Existence check; cheap.
   */
  exists(args: { tenantId: string; turnId: TurnId }): Promise<boolean>;
}

/**
 * Trace-logger port bundle. Composes the redaction pipeline and the
 * event store.
 */
export interface TraceLoggerPorts {
  readonly redaction: RedactionPipeline;
  readonly store: TraceEventStore;
  readonly clock: () => Date;
}

/**
 * Outcome of a logTrace call.
 */
export interface LogTraceOutcome {
  readonly inserted: boolean;
  readonly quarantined: boolean;
  readonly storageTier: TraceEvent['storageTier'];
}

/**
 * Public entrypoint.
 */
export async function logTrace(
  ports: TraceLoggerPorts,
  input: LogTraceInput,
): Promise<LogTraceOutcome> {
  const now = ports.clock();
  const tier = storageTierFor({ loggedAt: now, now });

  const redactionInput: RedactionInput = {
    tenantId: input.tenantId,
    content: input.content,
    consentForTraining: input.consentForTraining,
    actorId: input.actorId,
  };
  const redacted: RedactionOutput = await ports.redaction.run(redactionInput);

  if (redacted.quarantined) {
    return Object.freeze({
      inserted: false,
      quarantined: true,
      storageTier: tier,
    });
  }

  const baseEvent = {
    tenantId: input.tenantId,
    conversationId: input.conversationId,
    turnId: input.turnId,
    turn: input.turn,
    role: input.role,
    content: redacted.redactedContent,
    storageTier: tier,
    consentForTraining: input.consentForTraining,
    loggedAt: now.toISOString(),
    redaction: redacted.audit,
  } as const;

  const withToolCalls = input.toolCalls
    ? {
        ...baseEvent,
        toolCalls: Object.freeze(
          input.toolCalls.map((tc) =>
            Object.freeze({
              toolName: tc.toolName,
              argsRedacted: tc.argsRedacted,
              success: tc.success,
            }),
          ),
        ),
      }
    : baseEvent;

  const event: TraceEvent = Object.freeze(
    input.outcome
      ? { ...withToolCalls, outcome: input.outcome }
      : withToolCalls,
  );

  const result = await ports.store.upsertIfAbsent(event);
  return Object.freeze({
    inserted: result.inserted,
    quarantined: false,
    storageTier: tier,
  });
}

/**
 * Convenience: existence check for callers that want to short-circuit
 * before assembling the input.
 */
export async function isAlreadyLogged(
  ports: TraceLoggerPorts,
  args: { tenantId: string; turnId: TurnId },
): Promise<boolean> {
  return ports.store.exists(args);
}
