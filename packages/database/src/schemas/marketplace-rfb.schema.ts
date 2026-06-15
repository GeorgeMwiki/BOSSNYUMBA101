/**
 * Marketplace RFB schemas — applicant inbox + landlord responses.
 *
 * Mirrors migration 0338_applicant_notifications.sql:
 *   * applicant_notifications — the tenant-mobile (counterparty) L7 inbox the
 *     FE contract in apps/tenant-mobile/src/api/notifications.ts reads. DOUBLE
 *     scoped: tenant_id (RLS) + applicant_user_id (per-applicant anti-IDOR at
 *     the route). Bilingual title/body (single-locale render). read_at NULL =
 *     unread.
 *   * rfb_responses — the landlord response to an applicant rfb_requests row,
 *     carrying the settlement linkage (rent/term/deposit/currency/landlord) the
 *     L8 SettlementOrchestrator runs against. At most one accepted response per
 *     request (partial unique index in the migration).
 *
 * The api-gateway routes read/write these via raw `db.execute(sql)` (matching
 * the existing rfb_requests + notifications router style); this schema is the
 * typed source of truth for any future drizzle-query callers.
 */

import {
  pgTable,
  text,
  uuid,
  numeric,
  integer,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const applicantNotifications = pgTable(
  'applicant_notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: text('tenant_id').notNull(),
    applicantUserId: text('applicant_user_id').notNull(),
    applicantTenantId: text('applicant_tenant_id').notNull(),
    landlordTenantId: text('landlord_tenant_id'),

    rfbId: uuid('rfb_id'),
    responseId: uuid('response_id'),
    taskId: uuid('task_id'),

    kind: text('kind').notNull(),

    titleSw: text('title_sw').notNull(),
    titleEn: text('title_en').notNull(),
    bodySw: text('body_sw').notNull(),
    bodyEn: text('body_en').notNull(),

    payload: jsonb('payload').notNull().default({}),

    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantApplicantIdx: index('idx_applicant_notifications_tenant_applicant').on(
      table.tenantId,
      table.applicantUserId,
      table.createdAt,
    ),
  }),
);

export const rfbResponses = pgTable(
  'rfb_responses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: text('tenant_id').notNull(),
    rfbId: uuid('rfb_id').notNull(),
    landlordUserId: text('landlord_user_id').notNull(),

    // Numeric column DB defaults live in migration 0338 (drizzle here is a
    // typing mirror); the producer always writes explicit values.
    rentAmount: numeric('rent_amount', { precision: 18, scale: 2 }).notNull(),
    leaseTermMonths: integer('lease_term_months').notNull().default(12),
    depositAmount: numeric('deposit_amount', { precision: 18, scale: 2 }).notNull(),
    currencyCode: text('currency_code').notNull().default('TZS'),

    status: text('status').notNull().default('pending'),
    notes: text('notes'),

    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantRfbIdx: index('idx_rfb_responses_tenant_rfb').on(
      table.tenantId,
      table.rfbId,
      table.createdAt,
    ),
    acceptedPerRequestUq: uniqueIndex('uq_rfb_responses_accepted_per_request').on(
      table.rfbId,
    ),
  }),
);
