/**
 * request_for_applications + request_for_application_responses —
 * landlord-initiated vacancy listings + prospective-tenant pipeline.
 *
 * Companion to migration 0281. Ported from Borjie 0127
 * (request_for_bids) — domain-shifted from mineral marketplace to
 * real-estate vacancy / tenancy applications.
 *
 * Property types: residential | commercial | mixed | industrial |
 * student_housing | vacation_rental | other.
 *
 * Multi-currency (matches tenant.primary_currency). Geo-scoped
 * nearby-feed visibility via location + radius_km.
 */

import {
  pgTable,
  text,
  integer,
  numeric,
  date,
  timestamp,
  jsonb,
  uuid,
  index,
} from 'drizzle-orm/pg-core';

export const RFA_STATUSES = [
  'open',
  'filled',
  'expired',
  'cancelled',
] as const;
export type RfaStatus = (typeof RFA_STATUSES)[number];

export const RFA_RESPONSE_STATUSES = [
  'pending',
  'accepted',
  'rejected',
  'withdrawn',
] as const;
export type RfaResponseStatus = (typeof RFA_RESPONSE_STATUSES)[number];

export const RFA_PROPERTY_TYPES = [
  'residential',
  'commercial',
  'mixed',
  'industrial',
  'student_housing',
  'vacation_rental',
  'other',
] as const;
export type RfaPropertyType = (typeof RFA_PROPERTY_TYPES)[number];

export const requestForApplications = pgTable(
  'request_for_applications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    landlordId: text('landlord_id').notNull(),
    propertyType: text('property_type').$type<RfaPropertyType>().notNull(),
    bedroomsMin: integer('bedrooms_min'),
    bedroomsMax: integer('bedrooms_max'),
    areaSqmMin: numeric('area_sqm_min', { precision: 10, scale: 2 }),
    areaSqmMax: numeric('area_sqm_max', { precision: 10, scale: 2 }),
    rentPerMonth: numeric('rent_per_month', { precision: 15, scale: 2 }).notNull(),
    currencyCode: text('currency_code').notNull().default('TZS'),
    availableFrom: date('available_from').notNull(),
    leaseTermMonths: integer('lease_term_months').notNull().default(12),
    locationLat: numeric('location_lat', { precision: 9, scale: 6 }),
    locationLon: numeric('location_lon', { precision: 9, scale: 6 }),
    neighbourhood: text('neighbourhood'),
    radiusKm: integer('radius_km').notNull().default(25),
    status: text('status').$type<RfaStatus>().notNull().default('open'),
    notes: text('notes'),
    provenance: jsonb('provenance')
      .notNull()
      .default({ via: 'unknown' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (t) => ({
    tenantStatusTypeIdx: index('rfa_tenant_status_type_idx').on(
      t.tenantId,
      t.status,
      t.propertyType,
    ),
  }),
);

export const requestForApplicationResponses = pgTable(
  'request_for_application_responses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    rfaId: uuid('rfa_id').notNull(),
    tenantId: uuid('tenant_id').notNull(),
    applicantId: text('applicant_id').notNull(),
    offeredRent: numeric('offered_rent', { precision: 15, scale: 2 }).notNull(),
    currencyCode: text('currency_code').notNull().default('TZS'),
    moveInBy: date('move_in_by').notNull(),
    leaseTermMonths: integer('lease_term_months'),
    notes: text('notes'),
    status: text('status').$type<RfaResponseStatus>().notNull().default('pending'),
    provenance: jsonb('provenance')
      .notNull()
      .default({ via: 'unknown' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    rfaStatusIdx: index('rfa_responses_rfa_status_idx').on(
      t.rfaId,
      t.status,
      t.createdAt,
    ),
    tenantApplicantIdx: index('rfa_responses_tenant_applicant_idx').on(
      t.tenantId,
      t.applicantId,
      t.createdAt,
    ),
  }),
);

export type RequestForApplicationRow =
  typeof requestForApplications.$inferSelect;
export type NewRequestForApplicationRow =
  typeof requestForApplications.$inferInsert;
export type RequestForApplicationResponseRow =
  typeof requestForApplicationResponses.$inferSelect;
export type NewRequestForApplicationResponseRow =
  typeof requestForApplicationResponses.$inferInsert;
