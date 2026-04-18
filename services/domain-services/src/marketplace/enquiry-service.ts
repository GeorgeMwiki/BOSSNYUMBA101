/**
 * Enquiry Service — thin coordinator between a marketplace listing and
 * the Negotiation domain service.
 *
 * When a prospect hits "Start enquiry" on a listing, the app calls
 * `startEnquiry` which:
 *   1. Validates the listing is published + has a negotiation policy.
 *   2. Delegates to NegotiationService.startNegotiation().
 *   3. Emits a MarketplaceEnquiryStartedEvent.
 *
 * No AI counter is generated at enquiry time — the prospect's opening
 * message is the first turn; the AI responds only when the prospect
 * submits an actual counter.
 */

import type {
  TenantId,
  UserId,
  Result,
} from '@bossnyumba/domain-models';
import { ok, err } from '@bossnyumba/domain-models';
import type { EventBus } from '../common/events.js';
import {
  createEventEnvelope,
  generateEventId,
} from '../common/events.js';

import {
  MarketplaceServiceError,
  type MarketplaceListingId,
  type MarketplaceListingRepository,
  type StartEnquiryInput,
} from './types.js';
import type { NegotiationService } from '../negotiation/negotiation-service.js';
import {
  asNegotiationPolicyId,
  type Negotiation,
} from '../negotiation/types.js';

export interface EnquiryServiceDeps {
  readonly listingRepo: MarketplaceListingRepository;
  readonly negotiationService: NegotiationService;
  readonly eventBus: EventBus;
}

export class EnquiryService {
  private readonly listingRepo: MarketplaceListingRepository;
  private readonly negotiationService: NegotiationService;
  private readonly eventBus: EventBus;

  constructor(deps: EnquiryServiceDeps) {
    this.listingRepo = deps.listingRepo;
    this.negotiationService = deps.negotiationService;
    this.eventBus = deps.eventBus;
  }

  async startEnquiry(
    tenantId: TenantId,
    input: StartEnquiryInput,
    userId: UserId | null,
    correlationId: string
  ): Promise<Result<Negotiation, MarketplaceServiceError>> {
    const listing = await this.listingRepo.findById(input.listingId, tenantId);
    if (!listing) {
      return err(new MarketplaceServiceError('Listing not found', 'NOT_FOUND'));
    }
    if (listing.status !== 'published') {
      return err(
        new MarketplaceServiceError(
          `Listing is ${listing.status}`,
          'LISTING_NOT_PUBLISHED'
        )
      );
    }
    if (!listing.negotiationPolicyId) {
      return err(
        new MarketplaceServiceError(
          'Listing has no negotiation policy attached',
          'POLICY_REQUIRED'
        )
      );
    }

    const negResult = await this.negotiationService.startNegotiation(
      tenantId,
      {
        policyId: asNegotiationPolicyId(listing.negotiationPolicyId),
        unitId: listing.unitId,
        propertyId: listing.propertyId,
        prospectCustomerId: input.prospectCustomerId,
        listingId: listing.id,
        domain: 'lease_price',
        openingOffer: input.openingOffer,
        openingRationale: input.message,
      },
      correlationId,
      userId
    );

    if (!negResult.ok) {
      return err(
        new MarketplaceServiceError(
          `Negotiation start failed: ${negResult.error.message}`,
          'VALIDATION'
        )
      );
    }

    await this.eventBus.publish(
      createEventEnvelope(
        {
          eventId: generateEventId(),
          eventType: 'MarketplaceEnquiryStarted',
          timestamp: new Date().toISOString() as any,
          tenantId,
          correlationId,
          causationId: null,
          metadata: {},
          payload: {
            listingId: listing.id,
            negotiationId: negResult.value.id,
            prospectCustomerId: input.prospectCustomerId,
            openingOffer: input.openingOffer,
          },
        } as any,
        negResult.value.id,
        'MarketplaceEnquiry'
      )
    );

    return ok(negResult.value);
  }
}
