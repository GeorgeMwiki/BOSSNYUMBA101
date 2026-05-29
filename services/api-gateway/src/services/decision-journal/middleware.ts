/**
 * Decision Journal — middleware that wraps brain WRITE tools so the
 * brain's structured `decision` framing automatically lands in the
 * decisions table.
 *
 * Port from Borjie services/api-gateway/src/services/decision-journal/
 * middleware.ts (real-estate retailoring: tool ids are property /
 * lease / tenant / maintenance scoped instead of mining domain).
 *
 * Contract: when the orchestrator dispatches a WRITE brain tool, it
 * may attach a structured `decision` envelope to the tool input under
 * the reserved `__decision` key. Example:
 *
 *   {
 *     "__decision": {
 *       "subject": "Rent increase Apr 2027: 5% or 7%",
 *       "alternatives": [
 *         {"option": {"choice": "increase_7pct"}, "whyNot": "tenant churn risk"}
 *       ],
 *       "rationale": "5% matches local-market median while keeping the tenant",
 *       "confidence": 0.78
 *     },
 *     leaseId: "l_42",
 *     newRent: 800000
 *   }
 *
 * The wrapper strips `__decision` from the input before the underlying
 * handler runs, then after a successful WRITE it persists the decision
 * with `decidedByKind = 'brain'` (or `agent_apply` for autonomous
 * agents). Failures are swallowed (logged) so a recorder hiccup never
 * blocks the WRITE.
 */

import { z } from 'zod';

import type { DecisionRecorder } from './recorder.js';
import type {
  DecidedByKind,
  DecisionProvenance,
  RecordDecisionInput,
} from './types.js';

interface LoggerLike {
  warn(obj: unknown, msg?: string): void;
  error(obj: unknown, msg?: string): void;
}

export const DECISION_ENVELOPE_KEY = '__decision' as const;

const AlternativeShape = z
  .object({
    option: z.union([
      z.string().min(1).max(400),
      z.record(z.string(), z.unknown()),
    ]),
    whyNot: z.string().min(1).max(400),
  })
  .strict();

const DecisionEnvelopeShape = z
  .object({
    subject: z.string().min(3).max(400),
    alternatives: z.array(AlternativeShape).max(8).optional(),
    rationale: z.string().min(3).max(2000),
    confidence: z.number().min(0).max(1).optional(),
    scopeIds: z.array(z.string().min(1).max(80)).max(20).optional(),
    relatedPredictionId: z.string().min(1).max(120).optional(),
    decisionSubjectEntityKind: z.string().min(1).max(80).optional(),
    decisionSubjectEntityId: z.string().min(1).max(120).optional(),
  })
  .strict();

export type DecisionEnvelope = z.infer<typeof DecisionEnvelopeShape>;

export function extractDecisionFraming(
  toolInput: Record<string, unknown>,
): {
  readonly strippedInput: Record<string, unknown>;
  readonly envelope: DecisionEnvelope | null;
} {
  if (
    toolInput === null ||
    typeof toolInput !== 'object' ||
    !(DECISION_ENVELOPE_KEY in toolInput)
  ) {
    return { strippedInput: toolInput, envelope: null };
  }
  const raw = toolInput[DECISION_ENVELOPE_KEY];
  const stripped: Record<string, unknown> = {};
  for (const key of Object.keys(toolInput)) {
    if (key === DECISION_ENVELOPE_KEY) continue;
    stripped[key] = toolInput[key];
  }
  if (raw === null || typeof raw !== 'object') {
    return { strippedInput: stripped, envelope: null };
  }
  const parsed = DecisionEnvelopeShape.safeParse(raw);
  if (!parsed.success) {
    return { strippedInput: stripped, envelope: null };
  }
  return { strippedInput: stripped, envelope: parsed.data };
}

export interface WrapWithRecorderDeps {
  readonly recorder: DecisionRecorder;
  readonly logger?: LoggerLike;
  readonly now?: () => Date;
}

export interface WrapToolContext {
  readonly tenantId: string;
  readonly actorId: string;
  readonly personaSlug?: string;
  readonly chatSessionId?: string;
  readonly chatTurnId?: string;
}

export type BrainToolHandler = (
  input: Record<string, unknown>,
  ctx: WrapToolContext,
) => Promise<unknown>;

export interface WrapBrainToolOptions {
  /** Tool id (e.g. `lease.renewal.draft` / `rent.increase.propose`). */
  readonly toolId: string;
  /** Whether this tool is a WRITE. */
  readonly isWrite: boolean;
  /** Defaults to 'brain'. 'agent_apply' for autonomous-agent dispatches. */
  readonly actorKind?: DecidedByKind;
}

export interface DecisionJournalMiddlewareDeps extends WrapWithRecorderDeps {}

/**
 * Wrap a brain WRITE tool with the decision recorder.
 */
export function wrapBrainToolWithDecisionRecorder(
  deps: WrapWithRecorderDeps,
  handler: BrainToolHandler,
  options: WrapBrainToolOptions,
): BrainToolHandler {
  if (!options.isWrite) return handler;

  const logger = deps.logger;
  const actorKind: DecidedByKind = options.actorKind ?? 'brain';

  return async (input, ctx) => {
    const { strippedInput, envelope } = extractDecisionFraming(input);
    const result = await handler(strippedInput, ctx);

    if (envelope === null) return result;

    const provenance: DecisionProvenance = Object.freeze({
      via: 'chat',
      sessionId: ctx.chatSessionId ?? null,
      turnId: ctx.chatTurnId ?? null,
      personaSlug: ctx.personaSlug ?? null,
      toolId: options.toolId,
    });

    const decisionInput: RecordDecisionInput = {
      tenantId: ctx.tenantId,
      decidedByKind: actorKind,
      decidedByActorId: ctx.actorId,
      decisionSubject: envelope.subject,
      ...(envelope.decisionSubjectEntityKind !== undefined && {
        decisionSubjectEntityKind: envelope.decisionSubjectEntityKind,
      }),
      ...(envelope.decisionSubjectEntityId !== undefined && {
        decisionSubjectEntityId: envelope.decisionSubjectEntityId,
      }),
      decidedValue: {
        toolId: options.toolId,
        input: strippedInput,
      },
      ...(envelope.alternatives && { alternativesConsidered: envelope.alternatives }),
      rationale: envelope.rationale,
      ...(envelope.confidence !== undefined && { confidence: envelope.confidence }),
      ...(envelope.scopeIds && { scopeIds: envelope.scopeIds }),
      ...(envelope.relatedPredictionId !== undefined && {
        relatedPredictionId: envelope.relatedPredictionId,
      }),
      provenance,
    };

    try {
      await deps.recorder.recordDecision(decisionInput);
    } catch (err) {
      logger?.warn(
        {
          toolId: options.toolId,
          tenantId: ctx.tenantId,
          actorId: ctx.actorId,
          err: err instanceof Error ? err.message : String(err),
        },
        'decision-recorder failed; continuing — audit chain still recorded the WRITE',
      );
    }

    return result;
  };
}

/**
 * Compatibility re-export so brain-tools wiring imports as
 * `decisionJournalMiddleware` if that's the convention.
 */
export const decisionJournalMiddleware = wrapBrainToolWithDecisionRecorder;
