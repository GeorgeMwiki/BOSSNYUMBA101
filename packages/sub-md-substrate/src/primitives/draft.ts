/**
 * Draft<TInput, TDraft> — generate a reviewable artifact.
 *
 * INPUT     structured signal + style/context guidance
 * OUTPUT    a TDraft (subject, body, optional attachments). Drafts ARE
 *           NEVER sent directly — they exit the primitive in 'draft' or
 *           'awaiting-owner' status and are picked up by a Dispatch
 *           primitive in a separate turn.
 *
 * Examples:
 *   - complaint.triage.empathize    Draft<Complaint, EmpathyReply>
 *   - lease.coordinator.renewal     Draft<LeaseFacts, RenewalLetter>
 *   - hr.offer-letter               Draft<HiringDecision, OfferLetter>
 *   - sales.churn-save              Draft<ChurnSignal, SaveProposal>
 *
 * The substrate caps LLM calls; the strategy decides token count.
 */

import { createCapTracker } from '../hooks/autonomy-cap.js';
import { sealLedgerEntry } from '../hooks/ledger-seal.js';
import { decidePermission } from '../hooks/permission-mode.js';
import type {
  PrimitiveContext,
  PrimitiveResult,
} from '../types.js';
import { isInScope } from '../types.js';

export interface DraftArtifact {
  readonly subject: string;
  readonly body: string;
  readonly format: 'plain' | 'markdown' | 'html';
  readonly languageTag: string;
  readonly attachments?: ReadonlyArray<{
    readonly name: string;
    readonly mimeType: string;
    readonly contentRef: string;
  }>;
  /** PII redaction marker — the primitive sets this so the MD knows. */
  readonly piiRedacted: boolean;
}

export interface DraftStrategy<TInput, TDraft extends DraftArtifact> {
  draft(args: {
    readonly input: TInput;
    readonly ctx: PrimitiveContext;
    readonly recordLlmCall: () => boolean;
  }): Promise<TDraft>;
}

export interface DraftPrimitive<TInput, TDraft extends DraftArtifact> {
  readonly name: string;
  run(args: {
    readonly input: TInput;
    readonly inputTenantId: string;
    readonly ctx: PrimitiveContext;
  }): Promise<PrimitiveResult<TDraft>>;
}

export interface DraftOptions<TInput, TDraft extends DraftArtifact> {
  readonly name: string;
  readonly strategy: DraftStrategy<TInput, TDraft>;
  /** Max body length (in chars) the substrate accepts. Defaults 8000. */
  readonly maxBodyLength?: number;
}

export function createDraft<TInput, TDraft extends DraftArtifact>(
  opts: DraftOptions<TInput, TDraft>,
): DraftPrimitive<TInput, TDraft> {
  const maxBodyLength = opts.maxBodyLength ?? 8000;

  const primitive: DraftPrimitive<TInput, TDraft> = {
    name: opts.name,
    async run({
      input,
      inputTenantId,
      ctx,
    }: {
      readonly input: TInput;
      readonly inputTenantId: string;
      readonly ctx: PrimitiveContext;
    }): Promise<PrimitiveResult<TDraft>> {
      const inScope = isInScope(inputTenantId, ctx.scope);
      if (!inScope.ok) {
        return sealLedgerEntry({
          ctx,
          primitiveName: opts.name,
          primitiveKind: 'draft',
          input,
          output: {
            subject: 'rejected',
            body: inScope.reason,
            format: 'plain',
            languageTag: 'en',
            piiRedacted: true,
          } as unknown as TDraft,
          summary: `draft rejected: ${inScope.reason}`,
          status: 'rejected',
          sideEffectCount: 0,
        });
      }

      const tracker = createCapTracker(ctx.autonomyCap);
      const recordLlmCall = (): boolean => tracker.consume('llm-call').ok;
      const draft = await opts.strategy.draft({ input, ctx, recordLlmCall });

      if (draft.body.length > maxBodyLength) {
        return sealLedgerEntry({
          ctx,
          primitiveName: opts.name,
          primitiveKind: 'draft',
          input,
          output: draft,
          summary: `draft rejected: body ${draft.body.length} > max ${maxBodyLength}`,
          status: 'rejected',
          sideEffectCount: 0,
        });
      }

      // Draft NEVER sends. Status is always non-sealed (draft / awaiting-owner / dry-run).
      const permission = decidePermission(ctx);
      const status =
        permission.ledgerStatus === 'sealed' ? 'draft' : permission.ledgerStatus;

      return sealLedgerEntry({
        ctx,
        primitiveName: opts.name,
        primitiveKind: 'draft',
        input,
        output: draft,
        summary: `draft "${draft.subject.slice(0, 80)}" (${draft.body.length} chars, ${draft.languageTag})`,
        status,
        sideEffectCount: 0,
      });
    },
  };
  return Object.freeze(primitive);
}
