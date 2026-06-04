import { describe, expect, it } from 'vitest'
import {
  BrainTurnRequestSchema,
  BrainTurnResponseSchema,
  isTenantToolName,
  type ChatTurn
} from '../chat/types'
import {
  BidRecommendationResultSchema,
  BidsResultSchema,
  DealPipelineResultSchema,
  KycStatusResultSchema,
  MarketplaceListingsResultSchema,
  extractPayload
} from '../chat/toolPayloads'
import {
  tenantGreeting,
  tenantSuggestions,
  composerPlaceholder,
  errorLabel,
  loadingLabel
} from '../chat/greeting'
import { settle, fail } from '../chat/historyReducer'

describe('chat/types — request/response schemas', () => {
  it('rejects empty userText on the request', () => {
    const result = BrainTurnRequestSchema.safeParse({ userText: '' })
    expect(result.success).toBe(false)
  })

  it('accepts a minimal turn request and round-trips threadId', () => {
    const result = BrainTurnRequestSchema.safeParse({
      userText: 'Dhahabu inayouzwa sasa',
      threadId: 'thr-1'
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.threadId).toBe('thr-1')
    }
  })

  it('parses a brain response with tool calls', () => {
    const result = BrainTurnResponseSchema.safeParse({
      threadId: 'thr-1',
      responseText: 'Karibu',
      toolCalls: [{ name: 'marketplace.recommended', result: { listings: [] } }]
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.toolCalls?.[0]?.name).toBe('marketplace.recommended')
    }
  })

  it('rejects a brain response that omits responseText', () => {
    const result = BrainTurnResponseSchema.safeParse({ threadId: 'thr-1' })
    expect(result.success).toBe(false)
  })
})

describe('chat/types — renter tool registry', () => {
  it('classifies known tool names', () => {
    expect(isTenantToolName('marketplace.recommended')).toBe(true)
    expect(isTenantToolName('kyc.status')).toBe(true)
    expect(isTenantToolName('bids.recommend')).toBe(true)
  })

  it('rejects unknown tool names so the renderer falls back to JSON', () => {
    expect(isTenantToolName('marketplace.unknown')).toBe(false)
    expect(isTenantToolName('')).toBe(false)
  })
})

describe('chat/toolPayloads — schema gate', () => {
  it('parses marketplace.recommended listings', () => {
    const result = MarketplaceListingsResultSchema.safeParse({
      listings: [
        {
          id: 'L1',
          propertyType: 'two_bedroom',
          title: 'Mwanza 2-bed apartment',
          grade: 'A',
          floorAreaSqm: 60,
          originRegion: 'Mwanza',
          landlord: { id: 'S1', name: 'Lakeview Estates' },
          priceHintTzs: 240_000_000,
          listedAt: '2026-05-20T10:00:00Z',
          status: 'open'
        }
      ]
    })
    expect(result.success).toBe(true)
  })

  it('parses bids.active with optional thread', () => {
    const result = BidsResultSchema.safeParse({
      bids: [
        {
          id: 'B1',
          listingId: 'L1',
          listingTitle: 'Mwanza 2-bed apartment',
          propertyType: 'two_bedroom',
          offerRentPerMonthTzs: 2_000_000,
          floorAreaSqm: 60,
          status: 'pending',
          placedAt: '2026-05-25T11:00:00Z'
        }
      ]
    })
    expect(result.success).toBe(true)
  })

  it('parses kyc.status, deals.pipeline, and bids.recommend payloads', () => {
    expect(KycStatusResultSchema.safeParse({ status: 'approved' }).success).toBe(true)
    expect(
      DealPipelineResultSchema.safeParse({ negotiating: 2, accepted: 1, closed: 0, total: 3 }).success
    ).toBe(true)
    expect(
      BidRecommendationResultSchema.safeParse({
        listingId: 'L1',
        listingTitle: 'Mwanza 2-bed apartment',
        recommendedRentPerMonthTzs: 1_900_000,
        floorAreaSqm: 60
      }).success
    ).toBe(true)
  })

  it('extractPayload prefers result over args', () => {
    expect(extractPayload({ args: { a: 1 }, result: { b: 2 } })).toEqual({ b: 2 })
    expect(extractPayload({ args: { a: 1 } })).toEqual({ a: 1 })
    expect(extractPayload({})).toBeUndefined()
  })
})

describe('chat/greeting — bilingual persona surface', () => {
  it('returns Swahili greeting by default and English when requested', () => {
    // Marketplace Director persona — Swahili default, English on request.
    // Match stable persona-role substrings (not the legacy "Karibu, Mnunuzi"
    // copy that pre-dated the Mr. Mwikila persona).
    expect(tenantGreeting('sw')).toMatch(/Mkurugenzi wako wa Soko la BossNyumba/)
    expect(tenantGreeting('en')).toMatch(/BossNyumba Marketplace Director/)
  })

  it('exposes three renter-intent suggestion chips per language', () => {
    expect(tenantSuggestions('sw').length).toBe(3)
    expect(tenantSuggestions('en').length).toBe(3)
    expect(tenantSuggestions('sw')[0]?.prompt).toBe('Nyumba zinazopatikana sasa')
  })

  it('exposes Swahili loading + error + placeholder copy', () => {
    expect(loadingLabel('sw')).toBe('BossNyumba anafikiri…')
    expect(errorLabel('sw')).toMatch(/BossNyumba/)
    expect(composerPlaceholder('sw')).toMatch(/BossNyumba/)
  })
})

describe('chat/HomeChat — pure settle/fail reducers', () => {
  const pendingUserTurn: ChatTurn = {
    id: 'user-1',
    role: 'user',
    text: 'Bei ya kodi leo',
    pending: true,
    createdAt: '2026-05-27T08:00:00Z'
  }

  it('settles the optimistic user turn and appends a brain turn', () => {
    const next = settle([pendingUserTurn], 'Bei ya kodi leo', {
      threadId: 'thr-1',
      responseText: 'Kodi ya leo ni TZS 1.2M kwa mwezi',
      toolCalls: [{ name: 'marketplace.lobby', result: { listings: [] } }]
    })
    expect(next.length).toBe(2)
    expect(next[0]?.pending).toBe(false)
    expect(next[1]?.role).toBe('brain')
    expect(next[1]?.threadId).toBe('thr-1')
    expect(next[1]?.toolCalls?.[0]?.name).toBe('marketplace.lobby')
  })

  it('fail() flags the pending turn and appends a system error', () => {
    const next = fail([pendingUserTurn], 'Bei ya kodi leo', 'connection lost')
    expect(next.length).toBe(2)
    expect(next[0]?.pending).toBe(false)
    expect(next[0]?.error).toBe('connection lost')
    expect(next[1]?.role).toBe('system')
    expect(next[1]?.text).toBe('connection lost')
  })

  it('settle is immutable — original history is not mutated', () => {
    const original: readonly ChatTurn[] = [pendingUserTurn]
    settle(original, 'Bei ya kodi leo', {
      threadId: 'thr-1',
      responseText: 'ok'
    })
    expect(original[0]?.pending).toBe(true)
    expect(original.length).toBe(1)
  })
})
