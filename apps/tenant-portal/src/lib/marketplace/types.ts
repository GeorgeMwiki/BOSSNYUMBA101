/**
 * Wire shapes shared between the tenant-portal marketplace UI and the
 * api-gateway `/v1/marketplace-universal/*` router.
 *
 * Kept in lock-step with `services/api-gateway/src/routes/marketplace/types.ts`.
 * If a field changes here, change it there too (and vice versa).
 */

export interface OrgSummary {
  readonly orgId: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly city: string | null;
  readonly country: string | null;
  readonly listingCount: number;
  readonly tenderCount: number;
}

export interface OrgProfile extends OrgSummary {
  readonly addressLine1: string | null;
  readonly addressLine2: string | null;
  readonly state: string | null;
  readonly postalCode: string | null;
  readonly primaryEmail: string;
  readonly primaryPhone: string | null;
  readonly coverageArea: string | null;
  readonly joinCodePromptHint: string | null;
}

export interface MarketplaceListing {
  readonly listingId: string;
  readonly orgId: string;
  readonly orgName: string;
  readonly propertyId: string;
  readonly propertyName: string;
  readonly unitId: string;
  readonly unitName: string;
  readonly city: string;
  readonly country: string;
  readonly type: string;
  readonly bedrooms: number;
  readonly bathrooms: number;
  readonly squareMeters: number | null;
  readonly priceMin: number;
  readonly priceMax: number;
  readonly currency: string;
  readonly negotiable: boolean;
  readonly furnishing: string | null;
  readonly amenities: ReadonlyArray<string>;
  readonly thumbnailUrl: string | null;
}

export interface ListingMedia {
  readonly type: 'photo' | 'video' | 'floor_360' | 'street_view';
  readonly url: string;
  readonly caption: string | null;
}

export interface MarketplaceListingDetail extends MarketplaceListing {
  readonly description: string | null;
  readonly media: ReadonlyArray<ListingMedia>;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly virtualTourUrl: string | null;
  readonly attributes: Readonly<Record<string, unknown>>;
  readonly priceRange: {
    readonly min: number;
    readonly max: number;
    readonly currency: string;
    readonly negotiable: boolean;
  };
}

export interface ListingsPage {
  readonly items: ReadonlyArray<MarketplaceListing>;
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

export interface TenderSummary {
  readonly tenderId: string;
  readonly orgId: string;
  readonly orgName: string;
  readonly scope: string;
  readonly budgetMin: number;
  readonly budgetMax: number;
  readonly currency: string;
  readonly closesAt: string;
  readonly visibility: 'public' | 'invite_only';
}

export interface InquiryRecord {
  readonly inquiryId: string;
  readonly listingId: string;
  readonly userId: string;
  readonly message: string;
  readonly proposedPrice: number | null;
  readonly createdAt: string;
}

export interface ApplicationRecord {
  readonly applicationId: string;
  readonly listingId: string;
  readonly userId: string;
  readonly status: 'submitted' | 'in_review' | 'approved' | 'rejected' | 'withdrawn';
  readonly letterBody: string;
  readonly expectedResponseAt: string | null;
  readonly createdAt: string;
}

export interface OrgMembership {
  readonly orgId: string;
  readonly orgName: string;
  readonly role: 'tenant' | 'prospect' | 'vendor';
  readonly joinedAt: string;
  readonly activeLeaseCount: number;
}

export interface JoinCodeRedemption {
  readonly orgId: string;
  readonly orgName: string;
  readonly role: 'tenant' | 'prospect' | 'vendor';
  readonly userOrgId: string;
  readonly joinedAt: string;
}

export interface ListingsFilters {
  readonly orgId?: string;
  readonly city?: string;
  readonly type?: string;
  readonly minPrice?: number;
  readonly maxPrice?: number;
  readonly bedrooms?: number;
  readonly page?: number;
  readonly pageSize?: number;
}

export type JoinErrorCode =
  | 'CODE_NOT_FOUND'
  | 'CODE_EXPIRED'
  | 'CODE_EXHAUSTED'
  | 'CODE_REVOKED'
  | 'ALREADY_MEMBER'
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED';
