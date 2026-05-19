/**
 * Triage<TInput, TClassification> — classify-and-route.
 *
 * INPUT     a single inbound signal (ticket, complaint, lead, incident,
 *           CV, expense receipt, support ticket)
 * OUTPUT    a TClassification (category, severity, owner-team, suggested
 *           handler) + a confidence score
 *
 * Examples on the same substrate:
 *   - maintenance.dispatch.classify   Triage<MaintenanceTicket, Severity>
 *   - complaint.triage                Triage<Complaint, ComplaintCategory>
 *   - hr.triage                       Triage<CvSubmission, RecruiterPick>
 *   - incident.triage (internal)      Triage<OpsIncident, OncallTeam>
 *
 * The base implementation accepts a `classifier` strategy so each
 * concrete sub-MD plugs in its own rules / LLM call / heuristic. The
 * substrate handles permission-mode, cap, ledger.
 */

import { createCapTracker } from '../hooks/autonomy-cap.js';
import { sealLedgerEntry } from '../hooks/ledger-seal.js';
import { decidePermission } from '../hooks/permission-mode.js';
import type {
  PrimitiveContext,
  PrimitiveResult,
} from '../types.js';
import { isInScope } from '../types.js';

export interface TriageClassification<TLabel = string> {
  readonly label: TLabel;
  readonly confidence: number;
  readonly rationale: string;
  /**
   * Optional follow-on routing hint (e.g. "vendor-team-A", "ops-oncall",
   * "recruiter:senior-eng"). Consumed by a downstream Dispatch primitive.
   */
  readonly routeHint?: string;
}

export interface TriageStrategy<TInput, TClassification extends TriageClassification> {
  /**
   * The pure decision: given the input + ctx, produce a classification.
   * Strategies may use heuristics, LLM, or rule-tables. They MAY call
   * `recordLlmCall()` to declare an LLM consumption to the cap tracker.
   */
  classify(args: {
    readonly input: TInput;
    readonly ctx: PrimitiveContext;
    readonly recordLlmCall: () => boolean;
  }): Promise<TClassification>;
}

export interface TriagePrimitive<TInput, TClassification extends TriageClassification> {
  readonly name: string;
  run(args: {
    readonly input: TInput;
    readonly inputTenantId: string;
    readonly ctx: PrimitiveContext;
  }): Promise<PrimitiveResult<TClassification>>;
}

export interface TriageOptions<TInput, TClassification extends TriageClassification> {
  readonly name: string;
  readonly strategy: TriageStrategy<TInput, TClassification>;
  /** Confidence floor below which the entry is sealed as 'draft' regardless of mode. */
  readonly minConfidenceForAuto?: number;
}

export function createTriage<
  TInput,
  TClassification extends TriageClassification,
>(opts: TriageOptions<TInput, TClassification>): TriagePrimitive<TInput, TClassification> {
  const minConfidenceForAuto = opts.minConfidenceForAuto ?? 0.75;

  const primitive: TriagePrimitive<TInput, TClassification> = {
    name: opts.name,
    async run({
      input,
      inputTenantId,
      ctx,
    }: {
      readonly input: TInput;
      readonly inputTenantId: string;
      readonly ctx: PrimitiveContext;
    }): Promise<PrimitiveResult<TClassification>> {
      const inScope = isInScope(inputTenantId, ctx.scope);
      if (!inScope.ok) {
        return sealLedgerEntry({
          ctx,
          primitiveName: opts.name,
          primitiveKind: 'triage',
          input,
          output: {
            label: 'rejected' as unknown,
            confidence: 0,
            rationale: inScope.reason,
          } as TClassification,
          summary: `triage rejected: ${inScope.reason}`,
          status: 'rejected',
          sideEffectCount: 0,
        });
      }

      const tracker = createCapTracker(ctx.autonomyCap);
      const recordLlmCall = (): boolean => tracker.consume('llm-call').ok;

      const classification = await opts.strategy.classify({
        input,
        ctx,
        recordLlmCall,
      });

      const permission = decidePermission(ctx);
      // Confidence floor: if 'auto' but low-confidence, downgrade to 'draft'.
      const status =
        permission.ledgerStatus === 'sealed' &&
        classification.confidence < minConfidenceForAuto
          ? 'draft'
          : permission.ledgerStatus;

      return sealLedgerEntry({
        ctx,
        primitiveName: opts.name,
        primitiveKind: 'triage',
        input,
        output: classification,
        summary: `triage → ${String(classification.label)} (conf ${classification.confidence.toFixed(2)})`,
        status,
        sideEffectCount: 0,
      });
    },
  };
  return Object.freeze(primitive);
}
