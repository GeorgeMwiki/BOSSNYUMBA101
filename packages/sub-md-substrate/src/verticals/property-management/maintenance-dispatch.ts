/**
 * maintenance.dispatch — Triage<MaintenanceTicket, Severity>
 *                         + Dispatch<Severity, Vendor>
 *
 * Substrate-mirror of the existing property-bound sub-MD. This is a
 * pure composition of two primitives + a deterministic classifier +
 * a score-ranked selector. Connectors (email/sms transport) are wired
 * by the runtime — the vertical only declares them.
 *
 * The existing kernel sub-MD stays untouched (per phase scope). This
 * mirror exists so the substrate can prove the composition works AND
 * be the migration target in a follow-up phase.
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
  MaintenanceCategory,
  MaintenanceSeverity,
  MaintenanceTicket,
  VendorCandidate,
} from './entities.js';

export interface MaintenanceClassification extends TriageClassification<MaintenanceSeverity> {
  readonly category: MaintenanceCategory;
}

/**
 * Default classifier: simple keyword + photo-count heuristic. Real
 * production sub-MD uses an LLM call gated by the cap. The substrate
 * accepts either via the TriageStrategy port.
 */
export const defaultClassifier: TriageStrategy<MaintenanceTicket, MaintenanceClassification> = {
  async classify({ input }) {
    if (input.preClassified !== undefined) {
      return {
        label: input.preClassified.severity,
        category: input.preClassified.category,
        confidence: 0.95,
        rationale: 'reporter pre-classified',
        routeHint: input.preClassified.category,
      };
    }

    const text = input.issueText.toLowerCase();
    const emergencyKeywords = [
      'flood',
      'fire',
      'no water',
      'no power',
      'gas leak',
      'sewage',
      'electrocut',
      'burst pipe',
    ];
    const urgentKeywords = [
      'leak',
      'broken',
      'cracked',
      'overflow',
      'not working',
      'sparking',
    ];

    const isEmergency = emergencyKeywords.some((kw) => text.includes(kw));
    const isUrgent = !isEmergency && urgentKeywords.some((kw) => text.includes(kw));

    const category: MaintenanceCategory =
      text.includes('water') || text.includes('pipe') || text.includes('drain')
        ? 'plumbing'
        : text.includes('power') ||
          text.includes('socket') ||
          text.includes('light') ||
          text.includes('electric')
        ? 'electrical'
        : text.includes('roof') ||
          text.includes('crack') ||
          text.includes('door') ||
          text.includes('wall')
        ? 'structural'
        : text.includes('ac') || text.includes('heat') || text.includes('hvac')
        ? 'hvac'
        : text.includes('pest') || text.includes('roach') || text.includes('rat')
        ? 'pest'
        : 'general';

    const severity: MaintenanceSeverity = isEmergency
      ? 'emergency'
      : isUrgent
      ? 'urgent'
      : input.photoCount > 0
      ? 'standard'
      : 'cosmetic';

    // Confidence scales with keyword hits + photos.
    const baseConfidence = isEmergency ? 0.92 : isUrgent ? 0.82 : 0.7;
    const confidence = Math.min(1, baseConfidence + 0.03 * input.photoCount);

    return {
      label: severity,
      category,
      confidence,
      rationale: isEmergency
        ? 'emergency keyword match'
        : isUrgent
        ? 'urgent keyword match'
        : 'no severity keyword match',
      routeHint: category,
    };
  },
};

export interface MaintenanceSelectorOptions {
  /** When true, the selector enforces afterHoursAvailable for emergency severity. */
  readonly enforceAfterHoursForEmergency?: boolean;
}

export function createMaintenanceVendorSelector(
  opts: MaintenanceSelectorOptions = {},
): DispatchSelector<MaintenanceClassification, string> {
  const enforceAfterHours = opts.enforceAfterHoursForEmergency ?? true;

  return {
    async pick({ classification, candidates }) {
      const eligible = candidates.filter((c) => {
        // Specialty match.
        if (c.id.startsWith('vendor:')) {
          // candidates are wrapped DispatchCandidates; we use displayName
          // suffix as a stable specialty marker since the wrapper hides it.
        }
        // For test/prod parity we keep all candidates available; the
        // scoring below downranks mismatches.
        return true;
      });
      if (eligible.length === 0) {
        return {
          chosen: candidates[0]!,
          fallbacks: candidates.slice(1),
        };
      }

      // Sort by score DESC, break ties by name for determinism.
      const sorted = [...eligible].sort((a, b) =>
        b.score !== a.score
          ? b.score - a.score
          : a.displayName.localeCompare(b.displayName),
      );

      // Emergency override: prefer after-hours vendors if available.
      if (classification.label === 'emergency' && enforceAfterHours) {
        const afterHours = sorted.find((c) => c.displayName.includes('[24h]'));
        if (afterHours !== undefined) {
          return {
            chosen: afterHours,
            fallbacks: sorted.filter((c) => c.id !== afterHours.id),
          };
        }
      }

      return {
        chosen: sorted[0]!,
        fallbacks: sorted.slice(1),
      };
    },
  };
}

export interface MaintenanceDispatchSubMd {
  readonly name: string;
  readonly triage: TriagePrimitive<MaintenanceTicket, MaintenanceClassification>;
  readonly dispatch: DispatchPrimitive<MaintenanceClassification, string>;
}

export interface CreateMaintenanceDispatchArgs {
  readonly transport: DispatchTransportPort<string>;
  readonly classifier?: TriageStrategy<MaintenanceTicket, MaintenanceClassification>;
  readonly selectorOptions?: MaintenanceSelectorOptions;
}

export function createMaintenanceDispatch(
  args: CreateMaintenanceDispatchArgs,
): MaintenanceDispatchSubMd {
  return Object.freeze({
    name: 'maintenance.dispatch',
    triage: createTriage<MaintenanceTicket, MaintenanceClassification>({
      name: 'maintenance.dispatch.triage',
      strategy: args.classifier ?? defaultClassifier,
      minConfidenceForAuto: 0.8,
    }),
    dispatch: createDispatch<MaintenanceClassification, string>({
      name: 'maintenance.dispatch.send',
      selector: createMaintenanceVendorSelector(args.selectorOptions),
      transport: args.transport,
      maxFallbacks: 3,
    }),
  });
}

/**
 * Helper: wrap VendorCandidate (vertical-specific) as a generic
 * DispatchCandidate the substrate understands.
 */
export function vendorToDispatchCandidate(
  v: VendorCandidate,
  classification: MaintenanceClassification,
): DispatchCandidate<string> {
  // Score: lower SLA breach + faster response + matching specialty.
  const specialtyMatch = v.specialty === classification.category ? 1 : 0;
  const responseScore = Math.max(0, 100 - v.avgResponseMinutes) / 100;
  const slaScore = 1 - v.slaBreachRate;
  const score = 0.5 * specialtyMatch + 0.3 * responseScore + 0.2 * slaScore;
  const after = v.afterHoursAvailable ? '[24h]' : '';
  return {
    id: v.id,
    displayName: `${v.displayName}${after}`.trim(),
    score,
    channel: 'email',
  };
}
