import { apiFetch } from './client'
import { MARKETPLACE_PREFIX } from './config'
import type { Bid, BidMessage, Listing, PropertyType } from '@/types/listing'

/**
 * Bidding/application surface. The property domain models a renter's
 * offer on a listing as an APPLICATION; the api-gateway nests these under
 * the tenders router (POST/GET `/:id/bids`, POST `/:id/award`). This flat
 * client predates that shape — see flagged: the bid endpoints below need
 * a parent tender/listing id and should migrate to
 * `/api/v1/marketplace/listings/:id/applications`.
 */
const TENDERS_PREFIX = '/api/v1/tenders'

export type SortKey = 'newest' | 'price_asc' | 'price_desc' | 'grade'

export interface ListingFilters {
  readonly propertyType?: PropertyType
  readonly region?: string
  readonly minGradeNumeric?: number
  readonly maxGradeNumeric?: number
  readonly sort?: SortKey
  readonly search?: string
}

interface ListingsResponse {
  readonly data: readonly Listing[]
}

interface ListingResponse {
  readonly data: Listing
}

export async function fetchListings(filters: ListingFilters = {}): Promise<readonly Listing[]> {
  const response = await apiFetch<ListingsResponse>(`${MARKETPLACE_PREFIX}/listings`, {
    query: {
      propertyType: filters.propertyType,
      region: filters.region,
      minGrade: filters.minGradeNumeric,
      maxGrade: filters.maxGradeNumeric,
      sort: filters.sort,
      search: filters.search
    }
  })
  return response.data
}

export async function fetchListing(id: string): Promise<Listing | undefined> {
  const response = await apiFetch<ListingResponse>(
    `${MARKETPLACE_PREFIX}/listings/${encodeURIComponent(id)}`
  )
  return response.data
}

export type PaymentTerms = 'instant' | '30d' | '60d'

export interface PlaceBidInput {
  readonly listingId: string
  readonly offerRentPerMonthTzs: number
  readonly floorAreaSqm: number
  readonly paymentTerms: PaymentTerms
  readonly notes?: string
  readonly termsAccepted: boolean
}

interface BidResponse {
  readonly data: Bid
}

/**
 * Payload shape the api-gateway expects when posting a bid/application.
 * Mirrors the bid schema on the tenders router
 * (services/api-gateway/src/routes/tenders.router.ts, POST `/:id/bids`).
 * The applicant enters a monthly rent offer; we surface a total
 * `bidPriceTzs` so the gateway has a single canonical number to validate
 * and persist.
 */
interface GatewayBidPayload {
  readonly listingId: string
  readonly bidPriceTzs: number
  readonly paymentTerms: PaymentTerms
  readonly notes?: string
}

function toGatewayBidPayload(input: PlaceBidInput): GatewayBidPayload {
  return {
    listingId: input.listingId,
    bidPriceTzs: input.offerRentPerMonthTzs,
    paymentTerms: input.paymentTerms,
    notes: input.notes && input.notes.length > 0 ? input.notes : undefined
  }
}

export async function placeBid(input: PlaceBidInput): Promise<Bid> {
  const response = await apiFetch<BidResponse>(`${TENDERS_PREFIX}/bids`, {
    method: 'POST',
    body: toGatewayBidPayload(input)
  })
  return response.data
}

export async function fetchBids(): Promise<readonly Bid[]> {
  const response = await apiFetch<{ readonly data: readonly Bid[] }>(`${TENDERS_PREFIX}/bids`)
  return response.data
}

export async function fetchBid(id: string): Promise<Bid | undefined> {
  const response = await apiFetch<BidResponse>(`${TENDERS_PREFIX}/bids/${encodeURIComponent(id)}`)
  return response.data
}

export interface SendBidMessageInput {
  readonly bidId: string
  readonly body: string
}

export async function sendBidMessage(input: SendBidMessageInput): Promise<BidMessage> {
  const response = await apiFetch<{ readonly data: BidMessage }>(
    `${TENDERS_PREFIX}/bids/${encodeURIComponent(input.bidId)}/messages`,
    {
      method: 'POST',
      body: { body: input.body }
    }
  )
  return response.data
}

export type BidAction = 'accept' | 'withdraw'

export async function updateBidStatus(input: {
  readonly bidId: string
  readonly action: BidAction
}): Promise<Bid | undefined> {
  const response = await apiFetch<BidResponse>(
    `${TENDERS_PREFIX}/bids/${encodeURIComponent(input.bidId)}/${input.action}`,
    { method: 'POST' }
  )
  return response.data
}
