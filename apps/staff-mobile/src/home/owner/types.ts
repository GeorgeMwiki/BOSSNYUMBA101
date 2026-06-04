/**
 * Owner-home data contract — what each of the 7 slots expects, both when
 * the unified `/v1/owner/brief` endpoint ships (preferred, one round-trip)
 * and when we fall back to composing six independent cockpit endpoints.
 *
 * All shapes are `readonly` and consumed via spreads — never mutated.
 */

export type Severity = 'high' | 'amber' | 'info'
export type PillarStatus = 'ok' | 'warn' | 'danger'

export interface DecisionItem {
  readonly id: string
  readonly severity: Severity
  readonly titleSw: string
  readonly titleEn: string
  readonly kind:
    | 'incident'
    | 'licence'
    | 'sale'
    | 'billing'
    | 'report'
    | 'other'
  readonly primaryActionUrl: string
  readonly secondaryActionUrl?: string
}

export interface OccupancyPillar {
  readonly currentUnits: number
  readonly targetUnits: number
  readonly deltaPct: number
  readonly status: PillarStatus
  readonly sparkline7d: ReadonlyArray<number>
  readonly perProperty: ReadonlyArray<{
    readonly propertyId: string
    readonly propertyName: string
    readonly occupied: number
    readonly target: number
  }>
}

export interface CashPillar {
  readonly currentTzs: number
  readonly deltaPct: number
  readonly status: PillarStatus
  readonly sparkline7d: ReadonlyArray<number>
  readonly daysRemaining: number
  readonly usdCliffActive: boolean
  readonly usdExposureTzs: number
}

export interface SafetyPillar {
  readonly openHighCount: number
  readonly licencesStatus: PillarStatus
  readonly licenceLabelSw: string
  readonly licenceLabelEn: string
  readonly sparkline7d: ReadonlyArray<number>
}

export interface OwnerBrief {
  readonly briefId: string
  readonly generatedAtIso: string
  readonly swText: string
  readonly enText: string
  readonly evidenceIds: ReadonlyArray<string>
  readonly needsReview: ReadonlyArray<DecisionItem>
  readonly occupancy: OccupancyPillar
  readonly cash: CashPillar
  readonly safety: SafetyPillar
}

/** Maximum decision queue size per spec §A — "Alert-first" home ≤5 items. */
export const MAX_DECISIONS = 5
