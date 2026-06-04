import { describe, expect, it } from 'vitest'
import sw from '../i18n/sw.json'
import en from '../i18n/en.json'
import { translate } from '../i18n'
import { evaluateDashboardGuard } from '../dashboard/dashboardGuard'
import {
  selectActiveBids,
  selectLiveLobby,
  selectRecommended,
  summarisePipeline
} from '../marketplace/home/derivations'
import { summariseBuyerPerformance } from '../marketplace/home/performance'
import type { Bid, Listing } from '../types/listing'
import type { BuyerUser } from '../types/auth'

// NOTE (flagged): wire field names from the shared `Listing`/`BuyerUser`
// types (`mineral`, `pmlNumber`, `originSite`, `assay*`, `role: 'buyer'`)
// are kept; only display values are property-domain.
const baseSeller = {
  id: 's1',
  name: 'Mwanza Cooperative',
  pmlNumber: 'LIC-001',
  rating: 4.6,
  verified: true
} as const

function buildListing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: overrides.id ?? 'L1',
    mineral: 'gold_concentrate',
    title: overrides.title ?? 'Mwanza 2-bed lot A',
    grade: 'A',
    quantityKg: 25,
    originSite: 'Mwanza block 1',
    originRegion: 'Mwanza',
    seller: baseSeller,
    priceTzsPerKg: 2_500_000,
    priceHintTzs: 62_500_000,
    photos: [],
    assayPdfUrl: 'https://example.invalid/a.pdf',
    assayResults: [],
    chainOfCustody: [],
    listedAt: '2026-05-25T08:00:00Z',
    status: 'open',
    ...overrides
  }
}

function buildBid(overrides: Partial<Bid> = {}): Bid {
  return {
    id: overrides.id ?? 'B1',
    listingId: 'L1',
    listingTitle: 'Mwanza 2-bed lot A',
    mineral: 'gold_concentrate',
    offerTzsPerKg: 2_400_000,
    quantityKg: 20,
    status: overrides.status ?? 'pending',
    placedAt: overrides.placedAt ?? '2026-05-20T08:00:00Z',
    thread: overrides.thread ?? [],
    ...overrides
  }
}

const authedUser: BuyerUser = {
  id: 'tenant-uuid-1',
  role: 'buyer',
  companyName: 'Acme Holdings',
  countryCode: 'TZ',
  preferredLang: 'sw',
  kycStatus: 'approved',
  phone: '+255712345678'
}

describe('dashboard i18n', () => {
  it('exposes a Swahili-first "Dashibodi" tab label', () => {
    expect(sw.tabs.dashboard).toBe('Dashibodi')
    expect(en.tabs.dashboard).toBe('Dashibodi')
    expect(translate('sw', 'tabs.dashboard')).toBe('Dashibodi')
    expect(translate('en', 'tabs.dashboard')).toBe('Dashibodi')
  })

  it('defines a dashboard.* dictionary for every section in both languages', () => {
    const required = [
      'title',
      'subtitle',
      'live_lobby',
      'live',
      'recommended',
      'active_bids',
      'pipeline',
      'performance',
      'win_rate',
      'response_time',
      'deal_volume',
      'load_failed',
      'unauthenticated'
    ] as const
    for (const key of required) {
      expect(translate('sw', `dashboard.${key}`)).not.toBe(`dashboard.${key}`)
      expect(translate('en', `dashboard.${key}`)).not.toBe(`dashboard.${key}`)
    }
  })
})

describe('BuyerDashboard composition (section selection)', () => {
  it('exposes data for all six dashboard sections without crashing', () => {
    const listings: readonly Listing[] = [
      buildListing({ id: 'L1', listedAt: '2026-05-25T08:00:00Z' }),
      buildListing({
        id: 'L2',
        listedAt: '2026-05-24T08:00:00Z',
        seller: { ...baseSeller, id: 's2', rating: 4.9 }
      })
    ]
    const bids: readonly Bid[] = [
      buildBid({ id: 'B1', status: 'pending' }),
      buildBid({ id: 'B2', status: 'accepted', placedAt: '2026-05-15T08:00:00Z' })
    ]
    // 1. trust strip — derived from user (no crash)
    expect(authedUser.kycStatus).toBe('approved')
    // 2. live lobby
    const lobby = selectLiveLobby(listings, 4)
    expect(lobby.length).toBeGreaterThan(0)
    // 3. recommended
    const recommended = selectRecommended(listings, 5)
    expect(recommended.length).toBeGreaterThan(0)
    // 4. active bids
    const active = selectActiveBids(bids, 5)
    expect(active.length).toBe(1)
    // 5. pipeline
    const pipeline = summarisePipeline(bids)
    expect(pipeline.total).toBe(2)
    expect(pipeline.accepted).toBe(1)
    // 6. performance
    const perf = summariseBuyerPerformance(bids, Date.parse('2026-05-26T00:00:00Z'))
    expect(perf.bidsPlaced).toBeGreaterThanOrEqual(0)
  })

  it('shows empty state when tenant has no applications', () => {
    const pipeline = summarisePipeline([])
    expect(pipeline.total).toBe(0)
    expect(pipeline.negotiating).toBe(0)
    expect(pipeline.accepted).toBe(0)
    expect(pipeline.closed).toBe(0)
    const active = selectActiveBids([], 5)
    expect(active.length).toBe(0)
    const perf = summariseBuyerPerformance([])
    expect(perf.bidsPlaced).toBe(0)
    expect(perf.winRatePct).toBe(0)
    expect(perf.dealVolumeTzs).toBe(0)
  })
})

describe('dashboardGuard (tenant isolation)', () => {
  it('allows the matching tenant', () => {
    const outcome = evaluateDashboardGuard({
      user: authedUser,
      expectedTenantId: 'tenant-1',
      currentTenantId: 'tenant-1'
    })
    expect(outcome.kind).toBe('allow')
  })

  it('redirects to /auth/login when tenant mismatches', () => {
    const outcome = evaluateDashboardGuard({
      user: authedUser,
      expectedTenantId: 'tenant-1',
      currentTenantId: 'tenant-2'
    })
    expect(outcome).toEqual({ kind: 'redirect', to: '/auth/login' })
  })

  it('redirects to /auth/login when the user is unauthenticated', () => {
    const outcome = evaluateDashboardGuard({
      user: { ...authedUser, id: '' },
      expectedTenantId: null,
      currentTenantId: null
    })
    expect(outcome).toEqual({ kind: 'redirect', to: '/auth/login' })
  })

  it('allows when tenant claims are not yet known on either side', () => {
    const outcome = evaluateDashboardGuard({
      user: authedUser,
      expectedTenantId: null,
      currentTenantId: null
    })
    expect(outcome.kind).toBe('allow')
  })
})
