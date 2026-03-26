/**
 * Sublease Monitoring Schema
 * Detection and tracking of unauthorized sub-leasing
 */

import {
  pgTable,
  text,
  timestamp,
  boolean,
  jsonb,
  index,
  uniqueIndex,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { tenants, users } from './tenant.schema.js';
import { properties, units } from './property.schema.js';
import { customers } from './customer.schema.js';
import { leases } from './lease.schema.js';

// ============================================================================
// Enums
// ============================================================================

export const subleaseAlertStatusEnum = pgEnum('sublease_alert_status', [
  'reported',
  'investigating',
  'confirmed',
  'dismissed',
  'resolved',
]);

export const subleaseAlertSourceEnum = pgEnum('sublease_alert_source', [
  'inspection',
  'neighbor_report',
  'staff_observation',
  'utility_analysis',
  'anonymous_tip',
  'system_detected',
]);

export const subleaseRiskLevelEnum = pgEnum('sublease_risk_level', [
  'none',
  'low',
  'medium',
  'high',
]);

// ============================================================================
// Sublease Alerts Table
// ============================================================================

export const subleaseAlerts = pgTable(
  'sublease_alerts',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),

    // Identity
    alertCode: text('alert_code').notNull(),

    // References
    leaseId: text('lease_id').notNull().references(() => leases.id),
    propertyId: text('property_id').notNull().references(() => properties.id),
    unitId: text('unit_id').references(() => units.id),
    parcelId: text('parcel_id'), // FK to land_parcels
    customerId: text('customer_id').notNull().references(() => customers.id),

    // Alert details
    status: subleaseAlertStatusEnum('status').notNull().default('reported'),
    source: subleaseAlertSourceEnum('source').notNull(),
    reportedBy: text('reported_by'),
    reportedAt: timestamp('reported_at', { withTimezone: true }).notNull(),
    description: text('description').notNull(),
    evidenceUrls: jsonb('evidence_urls').default([]),

    // Suspected sub-tenant
    suspectedSubtenantName: text('suspected_subtenant_name'),
    suspectedSubtenantPhone: text('suspected_subtenant_phone'),
    suspectedSubtenantDetails: text('suspected_subtenant_details'),

    // Investigation
    investigatedBy: text('investigated_by').references(() => users.id),
    investigatedAt: timestamp('investigated_at', { withTimezone: true }),
    investigationNotes: text('investigation_notes'),

    // Confirmation
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    confirmedBy: text('confirmed_by'),

    // Resolution
    resolution: text('resolution'),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    resolvedBy: text('resolved_by'),
    caseId: text('case_id'), // FK to cases table

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: text('created_by'),
    updatedBy: text('updated_by'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: text('deleted_by'),
  },
  (table) => ({
    tenantIdx: index('sublease_alerts_tenant_idx').on(table.tenantId),
    codeTenantIdx: uniqueIndex('sublease_alerts_code_tenant_idx').on(table.tenantId, table.alertCode),
    statusIdx: index('sublease_alerts_status_idx').on(table.status),
    leaseIdx: index('sublease_alerts_lease_idx').on(table.leaseId),
    customerIdx: index('sublease_alerts_customer_idx').on(table.customerId),
    propertyIdx: index('sublease_alerts_property_idx').on(table.propertyId),
  })
);

// ============================================================================
// Lease Monitoring Flags Table
// ============================================================================

export const leaseMonitoringFlags = pgTable(
  'lease_monitoring_flags',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    leaseId: text('lease_id').notNull().references(() => leases.id, { onDelete: 'cascade' }),

    // Monitoring
    subleaseRiskLevel: subleaseRiskLevelEnum('sublease_risk_level').notNull().default('none'),
    subleaseProhibited: boolean('sublease_prohibited').notNull().default(true),
    lastMonitoringCheck: timestamp('last_monitoring_check', { withTimezone: true }),
    monitoringNotes: text('monitoring_notes'),

    // Flags
    flaggedForReview: boolean('flagged_for_review').notNull().default(false),
    flaggedAt: timestamp('flagged_at', { withTimezone: true }),
    flaggedBy: text('flagged_by'),
    flagReason: text('flag_reason'),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('lease_monitoring_tenant_idx').on(table.tenantId),
    leaseTenantIdx: uniqueIndex('lease_monitoring_lease_tenant_idx').on(table.tenantId, table.leaseId),
    riskLevelIdx: index('lease_monitoring_risk_level_idx').on(table.subleaseRiskLevel),
    flaggedIdx: index('lease_monitoring_flagged_idx').on(table.flaggedForReview),
  })
);

// ============================================================================
// Relations
// ============================================================================

export const subleaseAlertsRelations = relations(subleaseAlerts, ({ one }) => ({
  tenant: one(tenants, {
    fields: [subleaseAlerts.tenantId],
    references: [tenants.id],
  }),
  lease: one(leases, {
    fields: [subleaseAlerts.leaseId],
    references: [leases.id],
  }),
  property: one(properties, {
    fields: [subleaseAlerts.propertyId],
    references: [properties.id],
  }),
  unit: one(units, {
    fields: [subleaseAlerts.unitId],
    references: [units.id],
  }),
  customer: one(customers, {
    fields: [subleaseAlerts.customerId],
    references: [customers.id],
  }),
  investigator: one(users, {
    fields: [subleaseAlerts.investigatedBy],
    references: [users.id],
  }),
}));

export const leaseMonitoringFlagsRelations = relations(leaseMonitoringFlags, ({ one }) => ({
  tenant: one(tenants, {
    fields: [leaseMonitoringFlags.tenantId],
    references: [tenants.id],
  }),
  lease: one(leases, {
    fields: [leaseMonitoringFlags.leaseId],
    references: [leases.id],
  }),
}));
