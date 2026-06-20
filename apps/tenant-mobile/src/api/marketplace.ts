import { apiFetch } from './client'
import { MARKETPLACE_PREFIX } from './config'
import type { Bid, BidMessage, Listing, PropertyType } from '@/types/listing'

/**
 * Bidding/application surface. The property domain models a renter's
 * offer on a listing as an APPLICATION; the api-gateway nests these under
 * the tenders router (POST/GET `/:id/bids`, message + transition routes on
 * `/:id/bids/:bidId/*`). A listing id IS the tender id: every bid call is
 * tender-scoped. "My Bids" resolves the applicant from the JWT via the flat
 * `/tenders/bids/mine` read; every other call carries the parent listing id.
 */
const TENDERS_PREFIX = '/api/v1/tenders'

function tenderBidPath(listingId: string): string {
  return `${TENDERS_PREFIX}/${encodeURIComponent(listingId)}/bids`
}

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
 * Mirrors `SubmitBidSchema` on the tenders router
 * (services/api-gateway/src/routes/tenders.hono.ts, POST `/:id/bids`). The
 * applicant enters a monthly rent offer; we surface it as the canonical
 * `price` the gateway validates and persists. The applicant identity
 * (vendorId) is resolved server-side from the JWT — never sent by the client.
 */
interface GatewayBidPayload {
  readonly price: number
  readonly paymentTerms: PaymentTerms
  readonly notes?: string
}

function toGatewayBidPayload(input: PlaceBidInput): GatewayBidPayload {
  return {
    price: input.offerRentPerMonthTzs,
    paymentTerms: input.paymentTerms,
    notes: input.notes && input.notes.length > 0 ? input.notes : undefined
  }
}

export async function placeBid(input: PlaceBidInput): Promise<Bid> {
  const response = await apiFetch<BidResponse>(tenderBidPath(input.listingId), {
    method: 'POST',
    body: toGatewayBidPayload(input)
  })
  return response.data
}

/**
 * "My Applications" — the applicant's own bids across every listing. The
 * gateway resolves the applicant from the JWT; no listing id is needed.
 */
export async function fetchBids(): Promise<readonly Bid[]> {
  const response = await apiFetch<{ readonly data: readonly Bid[] }>(
    `${TENDERS_PREFIX}/bids/mine`
  )
  return response.data
}

/**
 * A single bid by id. There is no applicant-scoped single-bid gateway read;
 * "My Bids" is the canonical applicant-scoped source, so we resolve the bid
 * from it. Returns undefined when the id is not one of the applicant's bids
 * (mirrors the gateway's uniform-404 anti-IDOR posture — a foreign bid is
 * indistinguishable from a missing one).
 */
export async function fetchBid(id: string): Promise<Bid | undefined> {
  const mine = await fetchBids()
  return mine.find((bid) => bid.id === id)
}

export interface SendBidMessageInput {
  /** The parent listing/tender id — every bid call is tender-scoped. */
  readonly listingId: string
  readonly bidId: string
  readonly body: string
}

export async function sendBidMessage(input: SendBidMessageInput): Promise<BidMessage> {
  const response = await apiFetch<{ readonly data: BidMessage }>(
    `${tenderBidPath(input.listingId)}/${encodeURIComponent(input.bidId)}/messages`,
    {
      method: 'POST',
      body: { body: input.body }
    }
  )
  return response.data
}

export async function fetchBidMessages(input: {
  readonly listingId: string
  readonly bidId: string
}): Promise<readonly BidMessage[]> {
  const response = await apiFetch<{ readonly data: readonly BidMessage[] }>(
    `${tenderBidPath(input.listingId)}/${encodeURIComponent(input.bidId)}/messages`
  )
  return response.data
}

export type BidAction = 'accept' | 'withdraw'

export async function updateBidStatus(input: {
  readonly listingId: string
  readonly bidId: string
  readonly action: BidAction
}): Promise<Bid | undefined> {
  const response = await apiFetch<BidResponse>(
    `${tenderBidPath(input.listingId)}/${encodeURIComponent(input.bidId)}/${input.action}`,
    { method: 'POST' }
  )
  return response.data
}
