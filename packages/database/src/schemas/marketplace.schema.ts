/**
 * Marketplace Schema
 *
 * Three core entities for the listing + tender bundle (NEW 11):
 *  - marketplace_listings : unit listings (rent / lease / sale)
 *  - tenders              : RFP-style bid invitations for maintenance work
 *  - bids                 : vendor bids against a tender
 *
 * Bids track their own negotiation history inline (denormalised jsonb)
 * but may also be referenced by a row in `negotiations` for AI-driven
 * back-and-forth (see negotiation.schema.ts).
 */

import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  decimal,
  jsonb,
  index,
  uniqueIndex,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { tenants } from './tenant.schema.js';
import { properties, units } from './property.schema.js';

// ============================================================================
// Enums
// ============================================================================

export const listingKindEnum = pgEnum('marketplace_listing_kind', [
  'rent',
  'lease',
  'sale',
]);

export const listingStatusEnum = pgEnum('marketplace_listing_status', [
  'draft',
  'published',
  'paused',
  'closed',
]);

export const tenderStatusEnum = pgEnum('tender_status', [
  'open',
  'closed',
  'awarded',
  'cancelled',
]);

export const tenderVisibilityEnum = pgEnum('tender_visibility', [
  'public',
  'invite_only',
]);

export const bidStatusEnum = pgEnum('bid_status', [
  'submitted',
  'negotiating',
  'awarded',
  'rejected',
  'withdrawn',
]);

// ============================================================================
// Marketplace Listings
// ============================================================================

export const marketplaceListings = pgTable(
  'marketplace_listings',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    unitId: text('unit_id')
      .notNull()
      .references(() => units.id),
    propertyId: text('property_id').references(() => properties.id),

    listingKind: listingKindEnum('listing_kind').notNull().default('rent'),
    headlinePrice: integer('headline_price').notNull(), // minor units
    currency: text('currency').notNull().default('KES'),
    negotiable: boolean('negotiable').notNull().default(true),

    // Media: photos / video / 360 / street-view urls
    media: jsonb('media').notNull().default([]),

    // Free-form attributes — bedrooms, amenities, etc.
    attributes: jsonb('attributes').notNull().default({}),

    // Lifecycle
    status: listingStatusEnum('status').notNull().default('draft'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),

    // Optional link to a negotiation policy for this unit
    negotiationPolicyId: text('negotiation_policy_id'),

    // Audit
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: text('created_by'),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedBy: text('updated_by'),
  },
  (table) => ({
    tenantIdx: index('marketplace_listings_tenant_idx').on(table.tenantId),
    unitIdx: index('marketplace_listings_unit_idx').on(table.unitId),
    statusIdx: index('marketplace_listings_status_idx').on(
      table.tenantId,
      table.status
    ),
    publishedAtIdx: index('marketplace_listings_published_idx').on(
      table.publishedAt
    ),
  })
);

// ============================================================================
// Tenders
// ============================================================================

export const tenders = pgTable(
  'tenders',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),

    workOrderId: text('work_order_id'),

    scope: text('scope').notNull(),
    details: text('details'),

    budgetRangeMin: integer('budget_range_min').notNull(),
    budgetRangeMax: integer('budget_range_max').notNull(),
    currency: text('currency').notNull().default('KES'),

    status: tenderStatusEnum('status').notNull().default('open'),
    visibility: tenderVisibilityEnum('visibility').notNull().default('public'),
    invitedVendorIds: jsonb('invited_vendor_ids').default([]),

    aiNegotiatorEnabled: boolean('ai_negotiator_enabled')
      .notNull()
      .default(true),
    negotiationPolicyId: text('negotiation_policy_id'),

    // Timing
    closesAt: timestamp('closes_at', { withTimezone: true }).notNull(),
    awardedAt: timestamp('awarded_at', { withTimezone: true }),
    awardedBidId: text('awarded_bid_id'),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancellationReason: text('cancellation_reason'),

    // Audit
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: text('created_by'),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedBy: text('updated_by'),
  },
  (table) => ({
    tenantIdx: index('tenders_tenant_idx').on(table.tenantId),
    statusIdx: index('tenders_status_idx').on(table.tenantId, table.status),
    workOrderIdx: index('tenders_work_order_idx').on(table.workOrderId),
    closesAtIdx: index('tenders_closes_at_idx').on(table.closesAt),
  })
);

// ============================================================================
// Bids
// ============================================================================

export const bids = pgTable(
  'bids',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    tenderId: text('tender_id')
      .notNull()
      .references(() => tenders.id, { onDelete: 'cascade' }),

    vendorId: text('vendor_id').notNull(),

    price: integer('price').notNull(),
    currency: text('currency').notNull().default('KES'),
    timelineDays: integer('timeline_days').notNull(),

    notes: text('notes'),
    attachments: jsonb('attachments').default([]),

    status: bidStatusEnum('status').notNull().default('submitted'),

    // Inline negotiation snapshot — mirror of `negotiation_turns` for the
    // currently-linked negotiation (if any). Authoritative store remains
    // the negotiation tables.
    negotiationId: text('negotiation_id'),
    negotiationTurns: jsonb('negotiation_turns').default([]),

    submittedAt: timestamp('submitted_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    awardedAt: timestamp('awarded_at', { withTimezone: true }),
    rejectedAt: timestamp('rejected_at', { withTimezone: true }),
    rejectionReason: text('rejection_reason'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    tenantIdx: index('bids_tenant_idx').on(table.tenantId),
    tenderIdx: index('bids_tender_idx').on(table.tenderId),
    vendorIdx: index('bids_vendor_idx').on(table.vendorId),
    statusIdx: index('bids_status_idx').on(table.tenderId, table.status),
    uniqueBidIdx: uniqueIndex('bids_tender_vendor_unique_idx').on(
      table.tenderId,
      table.vendorId
    ),
  })
);

// ============================================================================
// Relations
// ============================================================================

export const marketplaceListingsRelations = relations(
  marketplaceListings,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [marketplaceListings.tenantId],
      references: [tenants.id],
    }),
    unit: one(units, {
      fields: [marketplaceListings.unitId],
      references: [units.id],
    }),
    property: one(properties, {
      fields: [marketplaceListings.propertyId],
      references: [properties.id],
    }),
  })
);

export const tendersRelations = relations(tenders, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [tenders.tenantId],
    references: [tenants.id],
  }),
  bids: many(bids),
}));

export const bidsRelations = relations(bids, ({ one }) => ({
  tender: one(tenders, {
    fields: [bids.tenderId],
    references: [tenders.id],
  }),
  tenant: one(tenants, {
    fields: [bids.tenantId],
    references: [tenants.id],
  }),
}));
