/**
 * Negotiation Schema
 *
 * Policy-sandboxed AI price negotiation engine. Three tables:
 *  - negotiation_policies : hard floor/ceiling rules per unit or property
 *  - negotiations         : individual negotiation sessions
 *  - negotiation_turns    : append-only audit of every offer exchanged
 *
 * CRITICAL: The AI never counters below `floorPrice` and always escalates
 * when an offer is below `approvalRequiredBelow`. Policy enforcement is
 * deterministic, happens BEFORE any LLM call (see policy-enforcement.ts).
 *
 * Negotiation turns are append-only (no UPDATE, no DELETE).
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
import { customers } from './customer.schema.js';

// ============================================================================
// Enums
// ============================================================================

export const negotiationStatusEnum = pgEnum('negotiation_status', [
  'open',
  'counter_sent',
  'accepted',
  'rejected',
  'expired',
  'escalated',
]);

export const negotiationActorEnum = pgEnum('negotiation_actor', [
  'prospect',
  'ai',
  'owner',
  'agent',
  'vendor',
]);

export const negotiationDomainEnum = pgEnum('negotiation_domain', [
  'lease_price', // prospect <-> PRICE_NEGOTIATOR
  'tender_bid',  // vendor <-> TENDER_NEGOTIATOR
]);

export const negotiationToneEnum = pgEnum('negotiation_tone', [
  'firm',
  'warm',
  'flexible',
]);

// ============================================================================
// Negotiation Policies
// ============================================================================

export const negotiationPolicies = pgTable(
  'negotiation_policies',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),

    // Scope: either unit-level or property-level; at least one required.
    unitId: text('unit_id').references(() => units.id, { onDelete: 'cascade' }),
    propertyId: text('property_id').references(() => properties.id, {
      onDelete: 'cascade',
    }),

    // Domain of the policy (lease vs tender)
    domain: negotiationDomainEnum('domain').notNull().default('lease_price'),

    // Pricing (all in minor currency units)
    listPrice: integer('list_price').notNull(),
    floorPrice: integer('floor_price').notNull(), // AI NEVER goes below
    approvalRequiredBelow: integer('approval_required_below').notNull(),
    maxDiscountPct: decimal('max_discount_pct', { precision: 5, scale: 2 })
      .notNull()
      .default('0'),
    currency: text('currency').notNull().default('KES'),

    // Flexibility levers
    acceptableConcessions: jsonb('acceptable_concessions').default([]),
    // e.g. [{ kind: 'free_month', maxCount: 1 }, { kind: 'waived_deposit', ... }]

    toneGuide: negotiationToneEnum('tone_guide').notNull().default('warm'),
    autoSendCounters: boolean('auto_send_counters').notNull().default(false),

    // Lifecycle
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    active: boolean('active').notNull().default(true),

    // Auditing
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
    tenantIdx: index('negotiation_policies_tenant_idx').on(table.tenantId),
    unitIdx: index('negotiation_policies_unit_idx').on(table.unitId),
    propertyIdx: index('negotiation_policies_property_idx').on(table.propertyId),
    activeIdx: index('negotiation_policies_active_idx').on(
      table.tenantId,
      table.active
    ),
  })
);

// ============================================================================
// Negotiations
// ============================================================================

export const negotiations = pgTable(
  'negotiations',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),

    // Scope
    unitId: text('unit_id').references(() => units.id),
    propertyId: text('property_id').references(() => properties.id),

    // Counterparty. For lease_price: prospect customer.
    // For tender_bid: vendor (stored via counterpartyId; vendor_id fk omitted
    // to avoid cyclic dependency on vendor schema at this layer).
    prospectCustomerId: text('prospect_customer_id').references(
      () => customers.id
    ),
    counterpartyId: text('counterparty_id'),

    // Tender/marketplace linkage (nullable — plain enquiries don't need them)
    listingId: text('listing_id'),
    tenderId: text('tender_id'),
    bidId: text('bid_id'),

    // Policy used
    policyId: text('policy_id')
      .notNull()
      .references(() => negotiationPolicies.id),

    domain: negotiationDomainEnum('domain').notNull().default('lease_price'),
    status: negotiationStatusEnum('status').notNull().default('open'),
    aiPersona: text('ai_persona').notNull().default('PRICE_NEGOTIATOR'),

    // Current state snapshot (also reconstructable from turns, kept for fast reads)
    currentOffer: integer('current_offer'),
    currentOfferBy: negotiationActorEnum('current_offer_by'),
    roundCount: integer('round_count').notNull().default(0),

    // Closure
    agreedPrice: integer('agreed_price'),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    closureReason: text('closure_reason'),

    // Escalation flag (offer below approvalRequiredBelow)
    escalatedAt: timestamp('escalated_at', { withTimezone: true }),
    escalatedTo: text('escalated_to'),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastActivityAt: timestamp('last_activity_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
  },
  (table) => ({
    tenantIdx: index('negotiations_tenant_idx').on(table.tenantId),
    unitIdx: index('negotiations_unit_idx').on(table.unitId),
    statusIdx: index('negotiations_status_idx').on(table.tenantId, table.status),
    bidIdx: index('negotiations_bid_idx').on(table.bidId),
    tenderIdx: index('negotiations_tender_idx').on(table.tenderId),
  })
);

// ============================================================================
// Negotiation Turns (APPEND-ONLY)
// ============================================================================

export const negotiationTurns = pgTable(
  'negotiation_turns',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    negotiationId: text('negotiation_id')
      .notNull()
      .references(() => negotiations.id, { onDelete: 'cascade' }),

    // Turn ordinal — enforced unique per negotiation
    sequence: integer('sequence').notNull(),

    actor: negotiationActorEnum('actor').notNull(),
    actorUserId: text('actor_user_id'),

    // Offer details
    offer: integer('offer'),
    concessionsProposed: jsonb('concessions_proposed').default([]),
    rationale: text('rationale'),

    // AI / policy metadata
    aiModelTier: text('ai_model_tier'),
    policySnapshotId: text('policy_snapshot_id'),
    policyCheckPassed: boolean('policy_check_passed').notNull().default(true),
    policyCheckViolations: jsonb('policy_check_violations').default([]),
    advisorConsulted: boolean('advisor_consulted').notNull().default(false),
    advisorDecision: text('advisor_decision'),

    // Raw payload (for replay / debugging)
    rawPayload: jsonb('raw_payload'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    negotiationIdx: index('negotiation_turns_negotiation_idx').on(
      table.negotiationId
    ),
    tenantIdx: index('negotiation_turns_tenant_idx').on(table.tenantId),
    sequenceIdx: uniqueIndex('negotiation_turns_sequence_idx').on(
      table.negotiationId,
      table.sequence
    ),
    createdAtIdx: index('negotiation_turns_created_at_idx').on(table.createdAt),
  })
);

// ============================================================================
// Relations
// ============================================================================

export const negotiationPoliciesRelations = relations(
  negotiationPolicies,
  ({ one, many }) => ({
    tenant: one(tenants, {
      fields: [negotiationPolicies.tenantId],
      references: [tenants.id],
    }),
    unit: one(units, {
      fields: [negotiationPolicies.unitId],
      references: [units.id],
    }),
    property: one(properties, {
      fields: [negotiationPolicies.propertyId],
      references: [properties.id],
    }),
    negotiations: many(negotiations),
  })
);

export const negotiationsRelations = relations(
  negotiations,
  ({ one, many }) => ({
    tenant: one(tenants, {
      fields: [negotiations.tenantId],
      references: [tenants.id],
    }),
    unit: one(units, {
      fields: [negotiations.unitId],
      references: [units.id],
    }),
    property: one(properties, {
      fields: [negotiations.propertyId],
      references: [properties.id],
    }),
    prospectCustomer: one(customers, {
      fields: [negotiations.prospectCustomerId],
      references: [customers.id],
    }),
    policy: one(negotiationPolicies, {
      fields: [negotiations.policyId],
      references: [negotiationPolicies.id],
    }),
    turns: many(negotiationTurns),
  })
);

export const negotiationTurnsRelations = relations(
  negotiationTurns,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [negotiationTurns.tenantId],
      references: [tenants.id],
    }),
    negotiation: one(negotiations, {
      fields: [negotiationTurns.negotiationId],
      references: [negotiations.id],
    }),
  })
);
