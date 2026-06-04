/**
 * trustChips — pure derivation logic for the marketplace trust-chip
 * stack. Lives separately from `TrustChipStack.tsx` so it can be unit-
 * tested in a JS environment without pulling React Native imports.
 *
 * See `Docs/RESEARCH/tenant-marketplace-sota.md` §7.
 */

import type { Listing } from '@/types/listing'

export type TrustChipKind =
  | 'landlord-verified'
  | 'inspection-verified'
  | 'bossnyumba-vetted'
  | 'ownership-verified'
  | 'landlord-history'

export interface TrustChip {
  readonly kind: TrustChipKind
  readonly label: string
  /**
   * Visual tone:
   *  - 'verified'   = green/gold, source-backed
   *  - 'attention'  = amber, expiring or partial
   *  - 'neutral'    = grey, informational only
   */
  readonly tone: 'verified' | 'attention' | 'neutral'
  /**
   * Optional evidence handle for deep-linking (license number, PDF
   * URL, chain hash). Absent when fixture does not carry it.
   */
  readonly evidenceHandle?: string
}

export interface DeriveTrustChipsArgs {
  readonly listing: Listing
  readonly translate: (key: string) => string
  /** Injectable for tests + offline-safe defaults. */
  readonly now?: Date
}

const INSPECTION_FRESHNESS_DAYS = 30

/**
 * Returns the chip list given the fixture. Order is stable:
 * landlord-verified → inspection-verified → BossNyumba-vetted →
 * ownership-verified → landlord-history.
 *
 * NOTE (flagged): the `translate('marketplace.trust.*')` i18n keys and
 * the `listing.seller.pmlNumber` / `assayPdfUrl` / `chainOfCustody` wire
 * fields still carry legacy names; they live in non-owned i18n JSON and
 * the shared `Listing` type, so they are kept pending a coordinated
 * rename.
 */
export function deriveTrustChips(args: DeriveTrustChipsArgs): ReadonlyArray<TrustChip> {
  const { listing, translate, now } = args
  const chips: TrustChip[] = []
  const nowDate = now ?? new Date()

  if (listing.seller.pmlNumber.length > 0) {
    chips.push({
      kind: 'landlord-verified',
      label: translate('marketplace.trust.gov_licensed'),
      tone: 'verified',
      evidenceHandle: listing.seller.pmlNumber
    })
  }

  if (listing.assayPdfUrl.length > 0) {
    const listed = new Date(listing.listedAt)
    const ageDays = Math.floor(
      (nowDate.getTime() - listed.getTime()) / (1000 * 60 * 60 * 24)
    )
    const isFresh = Number.isFinite(ageDays) && ageDays <= INSPECTION_FRESHNESS_DAYS
    chips.push({
      kind: 'inspection-verified',
      label: translate(
        isFresh ? 'marketplace.trust.lab_assayed' : 'marketplace.trust.lab_assayed_stale'
      ),
      tone: isFresh ? 'verified' : 'attention',
      evidenceHandle: listing.assayPdfUrl
    })
  }

  if (listing.seller.verified) {
    chips.push({
      kind: 'bossnyumba-vetted',
      label: translate('marketplace.trust.bossnyumba_vetted'),
      tone: 'verified'
    })
  }

  if (listing.chainOfCustody.length > 0) {
    chips.push({
      kind: 'ownership-verified',
      label: translate('marketplace.trust.chain_of_custody'),
      tone: 'verified',
      evidenceHandle: listing.chainOfCustody[0]
    })
  }

  const rating = Number.isFinite(listing.seller.rating) ? listing.seller.rating : 0
  if (rating > 0) {
    const tone: TrustChip['tone'] = rating >= 4.0 ? 'verified' : 'attention'
    const label = translate('marketplace.trust.seller_history') + ` · ${rating.toFixed(1)}★`
    chips.push({ kind: 'landlord-history', label, tone })
  }

  return chips
}
