/**
 * vacancy_pipeline_runs (migration 0098).
 *
 * Drizzle mirror of the table created in migration 0098. The shape
 * matches `VacancyPipelineRun` in
 * `@bossnyumba/ai-copilot/src/orchestrators/vacancy-to-lease/types.ts`.
 *
 * The table has lived in the database since wave 27; this schema
 * file makes it queryable from the Drizzle client so the production
 * `VacancyPipelineRunRepository` can drop the in-memory adapter.
 */

import {
  pgTable,
  text,
  integer,
  jsonb,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { tenants } from './tenant.schema.js';

export const vacancyPipelineRuns = pgTable(
  'vacancy_pipeline_runs',
  {
    runId: text('run_id').primaryKey(),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    unitId: text('unit_id').notNull(),
    state: text('state').notNull(),
    listingId: text('listing_id'),
    applicantCustomerId: text('applicant_customer_id'),
    negotiationId: text('negotiation_id'),
    leaseId: text('lease_id'),
    creditRatingScore: integer('credit_rating_score'),
    historyJson: jsonb('history_json').notNull().default([]),
    startedAt: timestamp('started_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    cancelledReason: text('cancelled_reason'),
    approvalReason: text('approval_reason'),
  },
  (t) => ({
    tenantIdx: index('idx_vacancy_pipeline_runs_tenant').on(t.tenantId),
    tenantUnitIdx: index('idx_vacancy_pipeline_runs_tenant_unit').on(
      t.tenantId,
      t.unitId,
    ),
    tenantStateIdx: index('idx_vacancy_pipeline_runs_tenant_state').on(
      t.tenantId,
      t.state,
    ),
  }),
);
