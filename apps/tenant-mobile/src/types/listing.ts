// NOTE (flagged — coordinated follow-up): this whole module is the
// shared wire/domain model for the marketplace and is imported by many
// NON-owned files (app/marketplace/[id].tsx, components/PlaceBidSheet,
// dashboard/sections/*, marketplace/home/derivations, ToolCallRenderer,
// app/(tabs)/bids). The mining vocabulary in the TYPE + FIELD names
// (`Mineral` + its members, `Seller.pmlNumber`, `AssayResult`,
// `originSite`, `assayPdfUrl`, `assayResults`, `chainOfCustody`,
// `quantityKg`, `priceTzsPerKg`, the `'buyer' | 'seller'` union) cannot
// be renamed here without breaking those files and the gateway wire
// contract. The property-domain rename (Mineral→PropertyType,
// pmlNumber→licenceNumber, originSite→propertyAddress,
// assay*→inspection*, chainOfCustody→ownershipHistory,
// buyer/seller→tenant/landlord, etc.) must land in a coordinated pass
// across this type + every consumer + the api-gateway payloads.
export type Mineral =
  | 'gold_concentrate'
  | 'tanzanite_rough'
  | 'coltan'
  | 'copper_concentrate'
  | 'gemstone_mixed'
  | 'gold_dore'
  | 'tin_cassiterite'
  | 'silver_concentrate'

export interface Seller {
  readonly id: string
  readonly name: string
  readonly pmlNumber: string
  readonly rating: number
  readonly verified: boolean
}

export interface AssayResult {
  readonly element: string
  readonly grade: string
  readonly method: string
}

export interface Listing {
  readonly id: string
  readonly mineral: Mineral
  readonly title: string
  readonly grade: string
  readonly quantityKg: number
  readonly originSite: string
  readonly originRegion: string
  readonly seller: Seller
  readonly priceTzsPerKg: number
  readonly priceHintTzs: number
  readonly photos: readonly string[]
  readonly assayPdfUrl: string
  readonly assayResults: readonly AssayResult[]
  readonly chainOfCustody: readonly string[]
  readonly listedAt: string
  readonly status: 'open' | 'reserved' | 'closed'
}

export type BidStatus = 'pending' | 'accepted' | 'rejected' | 'countered'

export interface BidMessage {
  readonly id: string
  readonly from: 'buyer' | 'seller'
  readonly body: string
  readonly sentAt: string
}

/**
 * Chat-as-OS bidirectional parity envelope. Stamped on every bid /
 * inquiry / kyc row at insert time by the gateway. Optional for
 * backwards compatibility with older fixtures.
 */
export interface ProvenanceEnvelope {
  readonly via: 'chat' | 'form' | 'agent_apply' | 'api' | 'legacy' | 'unknown'
  readonly actorId?: string | null
  readonly sessionId?: string | null
  readonly turnId?: string | null
  readonly requestedAt?: string
}

export interface Bid {
  readonly id: string
  readonly listingId: string
  readonly listingTitle: string
  readonly mineral: Mineral
  readonly offerTzsPerKg: number
  readonly quantityKg: number
  readonly status: BidStatus
  readonly placedAt: string
  readonly thread: readonly BidMessage[]
  /**
   * Chat-as-OS bidirectional parity. When `via === 'chat'` the tenant
   * sees a small "via Mr. Mwikila" pill next to the application in the
   * My Applications list; tapping it opens the chat session at the
   * originating turn.
   */
  readonly provenance?: ProvenanceEnvelope
}
