/**
 * Marketplace Listing Service.
 *
 * Publish / search / update-status flow for unit listings. Listings are
 * the front-door of the marketplace; enquiries against them create
 * negotiations via enquiry-service.ts.
 */

import { prefixedId } from '../common/id-generator.js';
import type { EventBus } from '../common/events.js';
import {
  createEventEnvelope,
  generateEventId,
} from '../common/events.js';
import type {
  TenantId,
  UserId,
  ISOTimestamp,
  Result,
} from '@bossnyumba/domain-models';
import { ok, err } from '@bossnyumba/domain-models';

import {
  MarketplaceServiceError,
  asMarketplaceListingId,
  type MarketplaceListing,
  type MarketplaceListingId,
  type MarketplaceListingRepository,
  type PublishListingInput,
  type SearchListingsInput,
  type ListingStatus,
} from './types.js';

function nowIso(): ISOTimestamp {
  return new Date().toISOString() as ISOTimestamp;
}

export interface ListingServiceDeps {
  readonly repo: MarketplaceListingRepository;
  readonly eventBus: EventBus;
  readonly now?: () => ISOTimestamp;
}

export class ListingService {
  private readonly repo: MarketplaceListingRepository;
  private readonly eventBus: EventBus;
  private readonly now: () => ISOTimestamp;

  constructor(deps: ListingServiceDeps) {
    this.repo = deps.repo;
    this.eventBus = deps.eventBus;
    this.now = deps.now ?? nowIso;
  }

  async publish(
    tenantId: TenantId,
    input: PublishListingInput,
    userId: UserId | null,
    correlationId: string
  ): Promise<Result<MarketplaceListing, MarketplaceServiceError>> {
    if (input.headlinePrice <= 0) {
      return err(
        new MarketplaceServiceError(
          'headlinePrice must be positive',
          'VALIDATION'
        )
      );
    }
    const timestamp = this.now();
    const listing: MarketplaceListing = {
      id: asMarketplaceListingId(prefixedId('lst')),
      tenantId,
      unitId: input.unitId,
      propertyId: input.propertyId ?? null,
      listingKind: input.listingKind,
      headlinePrice: input.headlinePrice,
      // Currency must be supplied by caller from tenant region-config.
      // We no longer default to KES here — that would silently mislabel
      // listings for non-Kenya tenants.
      currency: input.currency ?? '',
      negotiable: input.negotiable ?? true,
      media: input.media ?? [],
      attributes: input.attributes ?? {},
      status: input.publishImmediately ? 'published' : 'draft',
      publishedAt: input.publishImmediately ? timestamp : null,
      expiresAt: input.expiresAt ?? null,
      negotiationPolicyId: input.negotiationPolicyId ?? null,
      createdAt: timestamp,
      createdBy: userId,
      updatedAt: timestamp,
      updatedBy: userId,
    };

    const created = await this.repo.create(listing);

    if (created.status === 'published') {
      await this.publishEvent(
        tenantId,
        correlationId,
        created,
        'MarketplaceListingPublished',
        timestamp
      );
    }

    return ok(created);
  }

  async search(
    tenantId: TenantId,
    query: SearchListingsInput
  ): Promise<{
    readonly items: ReadonlyArray<MarketplaceListing>;
    readonly total: number;
  }> {
    return this.repo.search(tenantId, query);
  }

  async updateStatus(
    tenantId: TenantId,
    id: MarketplaceListingId,
    nextStatus: ListingStatus,
    userId: UserId | null,
    correlationId: string
  ): Promise<Result<MarketplaceListing, MarketplaceServiceError>> {
    const existing = await this.repo.findById(id, tenantId);
    if (!existing) {
      return err(new MarketplaceServiceError('Listing not found', 'NOT_FOUND'));
    }

    const timestamp = this.now();
    const patch: { -readonly [K in keyof MarketplaceListing]?: MarketplaceListing[K] } = {
      status: nextStatus,
      updatedAt: timestamp,
      updatedBy: userId,
    };
    if (nextStatus === 'published' && !existing.publishedAt) {
      patch.publishedAt = timestamp;
    }

    const updated = await this.repo.update(id, tenantId, patch);

    await this.publishEvent(
      tenantId,
      correlationId,
      updated,
      nextStatus === 'published'
        ? 'MarketplaceListingPublished'
        : nextStatus === 'closed'
          ? 'MarketplaceListingClosed'
          : 'MarketplaceListingUpdated',
      timestamp
    );

    return ok(updated);
  }

  async findById(
    tenantId: TenantId,
    id: MarketplaceListingId
  ): Promise<MarketplaceListing | null> {
    return this.repo.findById(id, tenantId);
  }

  private async publishEvent(
    tenantId: TenantId,
    correlationId: string,
    listing: MarketplaceListing,
    eventType: string,
    timestamp: ISOTimestamp
  ): Promise<void> {
    await this.eventBus.publish(
      createEventEnvelope(
        {
          eventId: generateEventId(),
          eventType,
          timestamp,
          tenantId,
          correlationId,
          causationId: null,
          metadata: {},
          payload: {
            listingId: listing.id,
            unitId: listing.unitId,
            status: listing.status,
          },
        } as any,
        listing.id,
        'MarketplaceListing'
      )
    );
  }
}
