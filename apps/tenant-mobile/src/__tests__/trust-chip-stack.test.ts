/**
 * TrustChipStack deriveTrustChips — pure-derivation tests.
 *
 * Pins the order and tone of the 5 trust chips so the
 * `tenant-marketplace-sota.md` §7 contract does not drift. The component
 * itself is RN-only — these tests cover the derivation logic which is
 * the load-bearing part.
 */

import { describe, expect, it } from 'vitest'
import { deriveTrustChips } from '../marketplace/trustChips'
import type { Listing } from '../types/listing'

function t(key: string): string {
  return key
}

const baseListing: Listing = {
  id: 'lst-1',
  propertyType: 'two_bedroom',
  title: 'Mwanza 2-bed apartment',
  grade: 'A',
  floorAreaSqm: 5,
  propertyAddress: 'Mwanza-North',
  originRegion: 'Mwanza',
  landlord: {
    id: 's-1',
    name: 'Lakeview Estates',
    licenceNumber: 'LIC-2026-0042',
    rating: 4.7,
    verified: true
  },
  rentPerMonthTzs: 320_000_000,
  priceHintTzs: 1_600_000_000,
  photos: [],
  inspectionReportUrl: 'https://example.com/inspection.pdf',
  inspectionResults: [],
  ownershipHistory: ['cryptoseal:abc123', 'cryptoseal:def456'],
  listedAt: new Date().toISOString(),
  status: 'open'
}

const NOW = new Date('2026-05-29T10:00:00.000Z')

describe('deriveTrustChips — tenant-marketplace SOTA §7', () => {
  it('returns all 5 chips in stable order when every signal is present', () => {
    const chips = deriveTrustChips({ listing: baseListing, translate: t, now: NOW })
    expect(chips.map((c) => c.kind)).toEqual([
      'landlord-verified',
      'inspection-verified',
      'bossnyumba-vetted',
      'ownership-verified',
      'landlord-history'
    ])
  })

  it('marks inspection-verified as verified when listed within 30 days', () => {
    const fresh = {
      ...baseListing,
      listedAt: new Date(NOW.getTime() - 7 * 24 * 3600 * 1000).toISOString()
    }
    const chips = deriveTrustChips({ listing: fresh, translate: t, now: NOW })
    const lab = chips.find((c) => c.kind === 'inspection-verified')
    expect(lab?.tone).toBe('verified')
  })

  it('marks inspection-verified as attention when listed > 30 days ago', () => {
    const stale = {
      ...baseListing,
      listedAt: new Date(NOW.getTime() - 60 * 24 * 3600 * 1000).toISOString()
    }
    const chips = deriveTrustChips({ listing: stale, translate: t, now: NOW })
    const lab = chips.find((c) => c.kind === 'inspection-verified')
    expect(lab?.tone).toBe('attention')
    expect(lab?.label).toContain('marketplace.trust.inspection_stale')
  })

  it('drops bossnyumba-vetted when landlord.verified is false', () => {
    const unverified = { ...baseListing, landlord: { ...baseListing.landlord, verified: false } }
    const chips = deriveTrustChips({ listing: unverified, translate: t, now: NOW })
    expect(chips.find((c) => c.kind === 'bossnyumba-vetted')).toBeUndefined()
  })

  it('drops landlord-verified when licenceNumber is empty', () => {
    const noLicense = { ...baseListing, landlord: { ...baseListing.landlord, licenceNumber: '' } }
    const chips = deriveTrustChips({ listing: noLicense, translate: t, now: NOW })
    expect(chips.find((c) => c.kind === 'landlord-verified')).toBeUndefined()
  })

  it('drops ownership-verified chip when ownershipHistory is empty', () => {
    const noChain = { ...baseListing, ownershipHistory: [] }
    const chips = deriveTrustChips({ listing: noChain, translate: t, now: NOW })
    expect(chips.find((c) => c.kind === 'ownership-verified')).toBeUndefined()
  })

  it('landlord-history chip is attention when rating < 4.0', () => {
    const low = { ...baseListing, landlord: { ...baseListing.landlord, rating: 3.2 } }
    const chips = deriveTrustChips({ listing: low, translate: t, now: NOW })
    const history = chips.find((c) => c.kind === 'landlord-history')
    expect(history?.tone).toBe('attention')
    expect(history?.label).toContain('3.2')
  })

  it('landlord-history chip is verified when rating >= 4.0', () => {
    const high = { ...baseListing, landlord: { ...baseListing.landlord, rating: 4.5 } }
    const chips = deriveTrustChips({ listing: high, translate: t, now: NOW })
    const history = chips.find((c) => c.kind === 'landlord-history')
    expect(history?.tone).toBe('verified')
  })

  it('every chip carries an evidence handle where the source supports it', () => {
    const chips = deriveTrustChips({ listing: baseListing, translate: t, now: NOW })
    expect(chips.find((c) => c.kind === 'landlord-verified')?.evidenceHandle).toBe('LIC-2026-0042')
    expect(chips.find((c) => c.kind === 'inspection-verified')?.evidenceHandle).toBe(
      'https://example.com/inspection.pdf'
    )
    expect(chips.find((c) => c.kind === 'ownership-verified')?.evidenceHandle).toBe(
      'cryptoseal:abc123'
    )
  })

  it('returns empty array when no signals are present (no misleading "no trust" chips)', () => {
    const bare: Listing = {
      ...baseListing,
      landlord: { ...baseListing.landlord, licenceNumber: '', verified: false, rating: 0 },
      inspectionReportUrl: '',
      ownershipHistory: []
    }
    const chips = deriveTrustChips({ listing: bare, translate: t, now: NOW })
    expect(chips).toEqual([])
  })
})
