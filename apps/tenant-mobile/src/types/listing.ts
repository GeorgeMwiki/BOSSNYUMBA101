// Shared domain model for the tenant-mobile marketplace, imported by
// app/marketplace/[id].tsx, components/PlaceBidSheet, dashboard/sections/*,
// marketplace/home/derivations, ToolCallRenderer, app/(tabs)/bids. The
// real-estate domain models a unit listing a landlord posts and a renter's
// application (bid) against it.
export type PropertyType =
  | 'studio'
  | 'one_bedroom'
  | 'two_bedroom'
  | 'three_bedroom'
  | 'four_bedroom_plus'
  | 'commercial'
  | 'industrial'
  | 'mixed_use'

export interface Landlord {
  readonly id: string
  readonly name: string
  readonly licenceNumber: string
  readonly rating: number
  readonly verified: boolean
}

export interface InspectionResult {
  readonly element: string
  readonly grade: string
  readonly method: string
}

export interface Listing {
  readonly id: string
  readonly propertyType: PropertyType
  readonly title: string
  readonly grade: string
  readonly floorAreaSqm: number
  readonly propertyAddress: string
  readonly originRegion: string
  readonly landlord: Landlord
  readonly rentPerMonthTzs: number
  readonly priceHintTzs: number
  readonly photos: readonly string[]
  readonly inspectionReportUrl: string
  readonly inspectionResults: readonly InspectionResult[]
  readonly ownershipHistory: readonly string[]
  readonly listedAt: string
  readonly status: 'open' | 'reserved' | 'closed'
}

export type BidStatus = 'pending' | 'accepted' | 'rejected' | 'countered'

export interface BidMessage {
  readonly id: string
  readonly from: 'tenant' | 'landlord'
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
  readonly propertyType: PropertyType
  readonly offerRentPerMonthTzs: number
  readonly floorAreaSqm: number
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
