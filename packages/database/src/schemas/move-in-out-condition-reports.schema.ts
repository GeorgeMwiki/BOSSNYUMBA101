/**
 * move_in_out_condition_reports — bilingual move-in/move-out/mid-lease
 * condition narratives.
 *
 * Companion to migration 0282. Ported from Borjie 0136
 * (inspection_narratives) — adapted from mining safety/environmental
 * inspections to real-estate move-in/out condition reports.
 *
 * Bilingual Markdown (sw/en). Landlord + tenant double-signed.
 * Authority routing for deposit-protection schemes / tenancy
 * tribunals.
 */

import {
  pgTable,
  text,
  numeric,
  timestamp,
  bigint,
} from 'drizzle-orm/pg-core';

export const CONDITION_REPORT_KINDS = [
  'move_in',
  'move_out',
  'mid_lease',
  'damage',
  'safety',
  'other',
] as const;
export type ConditionReportKind = (typeof CONDITION_REPORT_KINDS)[number];

export const CONDITION_REPORT_STATUSES = [
  'draft',
  'manager_ok',
  'landlord_signed',
  'tenant_signed',
  'submitted',
  'delivered',
  'superseded',
] as const;
export type ConditionReportStatus = (typeof CONDITION_REPORT_STATUSES)[number];

export const CONDITION_REPORT_AUTHORITIES = [
  'rht-za',
  'tpos-uk',
  'nsw-tribunal-au',
  'deposit-scheme-uk',
  'housing-tz',
  'rent-tribunal-ke',
  'lands-ministry-ug',
  'none',
] as const;
export type ConditionReportAuthority =
  (typeof CONDITION_REPORT_AUTHORITIES)[number];

export const moveInOutConditionReports = pgTable(
  'move_in_out_condition_reports',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull(),
    inspectionId: text('inspection_id').notNull(),
    reportKind: text('report_kind')
      .$type<ConditionReportKind>()
      .notNull()
      .default('move_in'),
    status: text('status')
      .$type<ConditionReportStatus>()
      .notNull()
      .default('draft'),
    draftMdSw: text('draft_md_sw').notNull(),
    draftMdEn: text('draft_md_en').notNull(),
    llmProvider: text('llm_provider'),
    llmModel: text('llm_model'),
    promptVersion: text('prompt_version').notNull().default('v1'),
    costUsd: numeric('cost_usd', { precision: 12, scale: 4 }),
    generatedAt: timestamp('generated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    managerOkAt: timestamp('manager_ok_at', { withTimezone: true }),
    managerOkBy: text('manager_ok_by'),
    landlordSignedAt: timestamp('landlord_signed_at', { withTimezone: true }),
    landlordSignedBy: text('landlord_signed_by'),
    landlordSigSha256: text('landlord_sig_sha256'),
    tenantSignedAt: timestamp('tenant_signed_at', { withTimezone: true }),
    tenantSignedBy: text('tenant_signed_by'),
    tenantSigSha256: text('tenant_sig_sha256'),
    authoritySentAt: timestamp('authority_sent_at', { withTimezone: true }),
    authority: text('authority').$type<ConditionReportAuthority>(),
    authorityRef: text('authority_ref'),
    auditChainSeq: bigint('audit_chain_seq', { mode: 'number' }),
    managerNotes: text('manager_notes'),
    supersededById: text('superseded_by_id'),
    createdBy: text('created_by'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);

export type MoveInOutConditionReportRow =
  typeof moveInOutConditionReports.$inferSelect;
export type NewMoveInOutConditionReportRow =
  typeof moveInOutConditionReports.$inferInsert;
