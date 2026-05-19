/**
 * hr.dispatch — route a candidate submission to the right recruiter.
 *
 * Triage<CandidateSubmission, RecruiterPick>
 *   + Dispatch<RecruiterPick, InterviewInvite>
 *
 * The MD-level chat: "any new senior engineering CVs this week?" →
 * the MD pages this sub-MD's last-N triage entries from the ledger
 * and surfaces them. The dispatch step (booking a slot, emailing the
 * candidate) only fires under `act-on-yes` mode by default.
 */

import {
  createDispatch,
  type DispatchCandidate,
  type DispatchPrimitive,
  type DispatchSelector,
  type DispatchTransportPort,
} from '../../primitives/dispatch.js';
import {
  createTriage,
  type TriageClassification,
  type TriagePrimitive,
  type TriageStrategy,
} from '../../primitives/triage.js';
import type {
  CandidateSubmission,
  RecruiterCandidate,
  RoleFamily,
  SeniorityBand,
} from './entities.js';

export type RecruiterRouteLabel =
  | 'auto-assigned'
  | 'awaiting-pool-capacity'
  | 'role-family-mismatch';

export interface RecruiterPick extends TriageClassification<RecruiterRouteLabel> {
  readonly recruiterPreferenceId: string | null;
  readonly seniority: SeniorityBand;
  readonly roleFamily: RoleFamily;
}

export interface HrDispatchTriageInputs {
  readonly pool: ReadonlyArray<RecruiterCandidate>;
}

/**
 * Default strategy: pick the recruiter with matching role-family and
 * highest remaining bandwidth. Confidence drops if no match.
 */
export function createHrTriageStrategy(
  args: HrDispatchTriageInputs,
): TriageStrategy<CandidateSubmission, RecruiterPick> {
  return {
    async classify({ input }) {
      const matching = args.pool.filter((r) => r.roleFamily === input.roleFamily);
      if (matching.length === 0) {
        return {
          label: 'role-family-mismatch',
          confidence: 0.6,
          rationale: `no recruiter covers ${input.roleFamily}`,
          recruiterPreferenceId: null,
          seniority: input.seniority,
          roleFamily: input.roleFamily,
        };
      }
      // Sort: highest bandwidth, fastest screen time, lex order for ties.
      const sorted = [...matching].sort((a, b) => {
        if (b.bandwidth !== a.bandwidth) return b.bandwidth - a.bandwidth;
        if (a.avgTimeToFirstScreenHours !== b.avgTimeToFirstScreenHours) {
          return a.avgTimeToFirstScreenHours - b.avgTimeToFirstScreenHours;
        }
        return a.displayName.localeCompare(b.displayName);
      });
      const top = sorted[0]!;
      if (top.bandwidth <= 0) {
        return {
          label: 'awaiting-pool-capacity',
          confidence: 0.7,
          rationale: 'matching recruiters at capacity',
          recruiterPreferenceId: top.id,
          seniority: input.seniority,
          roleFamily: input.roleFamily,
        };
      }
      const confidence =
        input.seniority === 'senior' || input.seniority === 'staff'
          ? 0.88
          : 0.82;
      return {
        label: 'auto-assigned',
        confidence,
        rationale: `match on ${input.roleFamily}, bandwidth ${top.bandwidth}`,
        recruiterPreferenceId: top.id,
        seniority: input.seniority,
        roleFamily: input.roleFamily,
        routeHint: top.id,
      };
    },
  };
}

export function createHrRecruiterSelector(): DispatchSelector<RecruiterPick, string> {
  return {
    async pick({ classification, candidates }) {
      if (candidates.length === 0) {
        throw new Error('hr.dispatch: no recruiter candidates supplied');
      }
      // Prefer the triage-recommended id when present.
      const pref = candidates.find(
        (c) => c.id === classification.recruiterPreferenceId,
      );
      if (pref !== undefined) {
        return {
          chosen: pref,
          fallbacks: candidates.filter((c) => c.id !== pref.id),
        };
      }
      const sorted = [...candidates].sort((a, b) => b.score - a.score);
      return {
        chosen: sorted[0]!,
        fallbacks: sorted.slice(1),
      };
    },
  };
}

export interface HrDispatchSubMd {
  readonly name: string;
  readonly triage: TriagePrimitive<CandidateSubmission, RecruiterPick>;
  readonly dispatch: DispatchPrimitive<RecruiterPick, string>;
}

export interface CreateHrDispatchArgs {
  readonly pool: ReadonlyArray<RecruiterCandidate>;
  readonly transport: DispatchTransportPort<string>;
}

export function createHrDispatch(args: CreateHrDispatchArgs): HrDispatchSubMd {
  return Object.freeze({
    name: 'hr.dispatch',
    triage: createTriage({
      name: 'hr.dispatch.triage',
      strategy: createHrTriageStrategy({ pool: args.pool }),
      minConfidenceForAuto: 0.85,
    }),
    dispatch: createDispatch({
      name: 'hr.dispatch.send',
      selector: createHrRecruiterSelector(),
      transport: args.transport,
      maxFallbacks: 2,
    }),
  });
}

export function recruiterToDispatchCandidate(
  r: RecruiterCandidate,
  classification: RecruiterPick,
): DispatchCandidate<string> {
  const familyMatch = r.roleFamily === classification.roleFamily ? 1 : 0;
  const bandwidthScore = Math.min(1, r.bandwidth / 5);
  const speedScore = Math.max(0, 1 - r.avgTimeToFirstScreenHours / 48);
  const score = 0.5 * familyMatch + 0.3 * bandwidthScore + 0.2 * speedScore;
  return {
    id: r.id,
    displayName: r.displayName,
    score,
    channel: 'inbox',
  };
}
