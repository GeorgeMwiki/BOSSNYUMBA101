export interface DailyBriefCard {
  id: string
  kind: 'cash_runway' | 'open_decisions' | 'today_blockers' | 'generic'
  title: string
  value: string
  caption?: string
}

export interface DailyBriefResponse {
  generatedAt: string
  cards: ReadonlyArray<DailyBriefCard>
}

export type LeaseBucket = 't7' | 't30' | 't90' | 'expired'

export interface Lease {
  id: string
  leaseRef: string
  propertyName: string
  /** Optional unit label (e.g. unit number, block). */
  unitLabel?: string
  /** ISO-8601 expiry; preferred over `expiresOn` for client-side bucketing. */
  expiresAt?: string
  /** Legacy date-only expiry string. */
  expiresOn: string
  daysLeft: number
  bucket: LeaseBucket
}

export interface LeasesResponse {
  generatedAt: string
  leases: ReadonlyArray<Lease>
}

/**
 * Server response for the lease-renewal request (expiry tracking lives on
 * /api/v1/compliance; lease renewal is queued there).
 * Echoed back so the UI can confirm the queued renewal id and the new
 * expiry it will apply on success.
 */
export interface LeaseRenewalResponse {
  renewalId: string
  leaseId: string
  status: 'queued' | 'submitted' | 'accepted'
  submittedAt: string
}
