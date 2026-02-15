/**
 * Intelligence Schemas
 * AI personalization, risk scoring, and next best actions
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
import { customers } from './customer.schema.js';
import { leases } from './lease.schema.js';

// ============================================================================
// Enums
// ============================================================================

export const riskLevelEnum = pgEnum('risk_level', [
  'very_low',
  'low',
  'medium',
  'high',
  'very_high',
  'critical',
]);

export const riskTypeEnum = pgEnum('risk_type', [
  'payment',
  'churn',
  'dispute',
  'maintenance',
  'compliance',
]);

export const actionTypeEnum = pgEnum('action_type', [
  'send_reminder',
  'offer_payment_plan',
  'schedule_call',
  'send_renewal_offer',
  'service_recovery',
  'proactive_maintenance',
  'loyalty_reward',
  'escalate_to_manager',
  'legal_notice',
  'community_engagement',
  'feedback_request',
  'check_in',
]);

export const actionStatusEnum = pgEnum('action_status', [
  'recommended',
  'approved',
  'scheduled',
  'in_progress',
  'completed',
  'skipped',
  'expired',
  'failed',
]);

export const channelPreferenceEnum = pgEnum('channel_preference', [
  'whatsapp',
  'sms',
  'email',
  'app_push',
  'voice_call',
  'in_person',
]);

export const segmentTypeEnum = pgEnum('segment_type', [
  'payment_behavior',
  'communication_preference',
  'lifecycle_stage',
  'risk_profile',
  'value_tier',
  'engagement_level',
  'maintenance_pattern',
  'custom',
]);

export const segmentStatusEnum = pgEnum('segment_status', [
  'active',
  'inactive',
  'archived',
]);

// ============================================================================
// Tenant Segments Table (Dynamic customer segmentation)
// ============================================================================

export const tenantSegments = pgTable(
  'tenant_segments',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    
    // Segment identity
    name: text('name').notNull(),
    code: text('code').notNull(),
    description: text('description'),
    
    // Type
    segmentType: segmentTypeEnum('segment_type').notNull(),
    status: segmentStatusEnum('status').notNull().default('active'),
    
    // Criteria
    criteria: jsonb('criteria').notNull().default({}),
    criteriaVersion: integer('criteria_version').notNull().default(1),
    
    // Color/display
    color: text('color'),
    icon: text('icon'),
    displayOrder: integer('display_order').default(0),
    
    // Membership rules
    isAutomatic: boolean('is_automatic').notNull().default(true),
    refreshIntervalHours: integer('refresh_interval_hours').default(24),
    lastRefreshedAt: timestamp('last_refreshed_at', { withTimezone: true }),
    
    // Statistics
    memberCount: integer('member_count').notNull().default(0),
    lastMemberCountAt: timestamp('last_member_count_at', { withTimezone: true }),
    
    // Associated actions/policies
    defaultActions: jsonb('default_actions').default([]),
    policyOverrides: jsonb('policy_overrides').default({}),
    
    // Analytics
    avgPaymentScore: decimal('avg_payment_score', { precision: 5, scale: 2 }),
    avgChurnRisk: decimal('avg_churn_risk', { precision: 5, scale: 2 }),
    avgLifetimeValue: integer('avg_lifetime_value'),
    
    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: text('created_by'),
    updatedBy: text('updated_by'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: text('deleted_by'),
  },
  (table) => ({
    tenantIdx: index('tenant_segments_tenant_idx').on(table.tenantId),
    codeTenantIdx: uniqueIndex('tenant_segments_code_tenant_idx').on(table.tenantId, table.code),
    segmentTypeIdx: index('tenant_segments_segment_type_idx').on(table.segmentType),
    statusIdx: index('tenant_segments_status_idx').on(table.status),
    memberCountIdx: index('tenant_segments_member_count_idx').on(table.memberCount),
  })
);

// ============================================================================
// Customer Segment Memberships Table
// ============================================================================

export const customerSegmentMemberships = pgTable(
  'customer_segment_memberships',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    customerId: text('customer_id').notNull().references(() => customers.id, { onDelete: 'cascade' }),
    segmentId: text('segment_id').notNull().references(() => tenantSegments.id, { onDelete: 'cascade' }),
    
    // Membership details
    score: decimal('score', { precision: 5, scale: 2 }),
    confidence: decimal('confidence', { precision: 5, scale: 4 }),
    isPrimary: boolean('is_primary').notNull().default(false),
    
    // Entry/exit tracking
    enteredAt: timestamp('entered_at', { withTimezone: true }).notNull().defaultNow(),
    exitedAt: timestamp('exited_at', { withTimezone: true }),
    
    // Entry reason
    entryReason: text('entry_reason'),
    entrySource: text('entry_source'),
    
    // Exit reason (if exited)
    exitReason: text('exit_reason'),
    
    // Previous segment (for transitions)
    previousSegmentId: text('previous_segment_id'),
    
    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('customer_segment_memberships_tenant_idx').on(table.tenantId),
    customerIdx: index('customer_segment_memberships_customer_idx').on(table.customerId),
    segmentIdx: index('customer_segment_memberships_segment_idx').on(table.segmentId),
    activeIdx: index('customer_segment_memberships_active_idx').on(table.customerId, table.segmentId, table.exitedAt),
    primaryIdx: index('customer_segment_memberships_primary_idx').on(table.customerId, table.isPrimary),
    enteredAtIdx: index('customer_segment_memberships_entered_at_idx').on(table.enteredAt),
  })
);

// ============================================================================
// Tenant Preferences Table
// ============================================================================

export const tenantPreferences = pgTable(
  'tenant_preferences',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    customerId: text('customer_id').notNull().references(() => customers.id, { onDelete: 'cascade' }),
    
    // Communication preferences
    preferredChannel: channelPreferenceEnum('preferred_channel').notNull().default('whatsapp'),
    secondaryChannel: channelPreferenceEnum('secondary_channel'),
    preferredLanguage: text('preferred_language').default('en'),
    
    // Timing preferences
    preferredContactTime: text('preferred_contact_time'),
    quietHoursStart: text('quiet_hours_start'),
    quietHoursEnd: text('quiet_hours_end'),
    timezone: text('timezone').default('Africa/Nairobi'),
    
    // Notification preferences
    paymentReminders: boolean('payment_reminders').notNull().default(true),
    maintenanceUpdates: boolean('maintenance_updates').notNull().default(true),
    communityNews: boolean('community_news').notNull().default(true),
    marketingMessages: boolean('marketing_messages').notNull().default(false),
    emergencyAlerts: boolean('emergency_alerts').notNull().default(true),
    
    // Frequency preferences
    reminderFrequency: text('reminder_frequency').default('standard'),
    
    // Format preferences
    messageFormat: text('message_format').default('standard'),
    receiptFormat: text('receipt_format').default('digital'),
    
    // Accessibility
    accessibilityNeeds: jsonb('accessibility_needs').default([]),
    largeText: boolean('large_text').notNull().default(false),
    voiceAssistance: boolean('voice_assistance').notNull().default(false),
    
    // Household info
    householdSize: integer('household_size'),
    hasChildren: boolean('has_children'),
    hasPets: boolean('has_pets'),
    householdDetails: jsonb('household_details').default({}),
    
    // Lifestyle
    workSchedule: text('work_schedule'),
    parkingNeeds: jsonb('parking_needs').default({}),
    amenityPreferences: jsonb('amenity_preferences').default([]),
    
    // Consent
    dataProcessingConsent: boolean('data_processing_consent').notNull().default(false),
    dataProcessingConsentAt: timestamp('data_processing_consent_at', { withTimezone: true }),
    testimonialConsent: boolean('testimonial_consent').notNull().default(false),
    testimonialConsentAt: timestamp('testimonial_consent_at', { withTimezone: true }),
    
    // Version
    version: integer('version').notNull().default(1),
    
    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: text('created_by'),
    updatedBy: text('updated_by'),
  },
  (table) => ({
    tenantIdx: index('tenant_preferences_tenant_idx').on(table.tenantId),
    customerIdx: uniqueIndex('tenant_preferences_customer_idx').on(table.tenantId, table.customerId),
    channelIdx: index('tenant_preferences_channel_idx').on(table.preferredChannel),
  })
);

// ============================================================================
// Friction Fingerprints Table
// ============================================================================

export const frictionFingerprints = pgTable(
  'friction_fingerprints',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    customerId: text('customer_id').notNull().references(() => customers.id, { onDelete: 'cascade' }),
    
    // Sensitivity scores (0-100)
    noiseSensitivity: integer('noise_sensitivity').default(50),
    maintenanceSensitivity: integer('maintenance_sensitivity').default(50),
    communicationSensitivity: integer('communication_sensitivity').default(50),
    priceSensitivity: integer('price_sensitivity').default(50),
    cleanlinessExpectation: integer('cleanliness_expectation').default(50),
    privacyPreference: integer('privacy_preference').default(50),
    
    // Response patterns
    avgResponseTime: integer('avg_response_time'),
    preferredResponseWindow: text('preferred_response_window'),
    
    // Sentiment baseline
    baselineSentiment: decimal('baseline_sentiment', { precision: 5, scale: 4 }),
    currentSentiment: decimal('current_sentiment', { precision: 5, scale: 4 }),
    sentimentTrend: text('sentiment_trend'),
    
    // Issue patterns
    commonIssues: jsonb('common_issues').default([]),
    triggerPatterns: jsonb('trigger_patterns').default([]),
    
    // Communication style
    communicationStyle: text('communication_style'),
    formalityLevel: text('formality_level'),
    detailPreference: text('detail_preference'),
    
    // History
    pastFrictions: jsonb('past_frictions').default([]),
    resolvedFrictions: jsonb('resolved_frictions').default([]),
    
    // Confidence
    confidenceScore: decimal('confidence_score', { precision: 5, scale: 4 }),
    dataPoints: integer('data_points').default(0),
    
    // Last update triggers
    lastSignalAt: timestamp('last_signal_at', { withTimezone: true }),
    lastSignalSource: text('last_signal_source'),
    
    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('friction_fingerprints_tenant_idx').on(table.tenantId),
    customerIdx: uniqueIndex('friction_fingerprints_customer_idx').on(table.tenantId, table.customerId),
    sentimentIdx: index('friction_fingerprints_sentiment_idx').on(table.currentSentiment),
  })
);

// ============================================================================
// Risk Scores Table
// ============================================================================

export const riskScores = pgTable(
  'risk_scores',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    customerId: text('customer_id').notNull().references(() => customers.id, { onDelete: 'cascade' }),
    leaseId: text('lease_id').references(() => leases.id, { onDelete: 'set null' }),
    
    // Risk type
    riskType: riskTypeEnum('risk_type').notNull(),
    
    // Score (0-100)
    score: decimal('score', { precision: 5, scale: 2 }).notNull(),
    previousScore: decimal('previous_score', { precision: 5, scale: 2 }),
    scoreChange: decimal('score_change', { precision: 5, scale: 2 }),
    
    // Level
    riskLevel: riskLevelEnum('risk_level').notNull(),
    previousLevel: riskLevelEnum('previous_level'),
    
    // Factors contributing to score
    factors: jsonb('factors').notNull().default([]),
    primaryFactor: text('primary_factor'),
    
    // Model info
    modelVersion: text('model_version').notNull(),
    modelConfidence: decimal('model_confidence', { precision: 5, scale: 4 }),
    
    // Predictions
    predictedOutcome: text('predicted_outcome'),
    probabilityOfOutcome: decimal('probability_of_outcome', { precision: 5, scale: 4 }),
    expectedTimeToOutcome: integer('expected_time_to_outcome'),
    
    // Thresholds
    alertThreshold: decimal('alert_threshold', { precision: 5, scale: 2 }),
    isAboveThreshold: boolean('is_above_threshold').notNull().default(false),
    
    // Alert status
    alertTriggeredAt: timestamp('alert_triggered_at', { withTimezone: true }),
    alertAcknowledgedAt: timestamp('alert_acknowledged_at', { withTimezone: true }),
    alertAcknowledgedBy: text('alert_acknowledged_by'),
    
    // Validity
    validFrom: timestamp('valid_from', { withTimezone: true }).notNull(),
    validUntil: timestamp('valid_until', { withTimezone: true }),
    isLatest: boolean('is_latest').notNull().default(true),
    
    // Timestamps
    calculatedAt: timestamp('calculated_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('risk_scores_tenant_idx').on(table.tenantId),
    customerIdx: index('risk_scores_customer_idx').on(table.customerId),
    leaseIdx: index('risk_scores_lease_idx').on(table.leaseId),
    riskTypeIdx: index('risk_scores_risk_type_idx').on(table.riskType),
    riskLevelIdx: index('risk_scores_risk_level_idx').on(table.riskLevel),
    scoreIdx: index('risk_scores_score_idx').on(table.score),
    latestIdx: index('risk_scores_latest_idx').on(table.customerId, table.riskType, table.isLatest),
    calculatedAtIdx: index('risk_scores_calculated_at_idx').on(table.calculatedAt),
  })
);

// ============================================================================
// Next Best Actions Table
// ============================================================================

export const nextBestActions = pgTable(
  'next_best_actions',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    customerId: text('customer_id').notNull().references(() => customers.id, { onDelete: 'cascade' }),
    leaseId: text('lease_id').references(() => leases.id, { onDelete: 'set null' }),
    
    // Action
    actionType: actionTypeEnum('action_type').notNull(),
    status: actionStatusEnum('status').notNull().default('recommended'),
    
    // Priority (1-10)
    priority: integer('priority').notNull().default(5),
    
    // Recommendation details
    title: text('title').notNull(),
    description: text('description'),
    rationale: text('rationale'),
    
    // Impact prediction
    expectedImpact: jsonb('expected_impact').default({}),
    impactScore: decimal('impact_score', { precision: 5, scale: 2 }),
    confidenceScore: decimal('confidence_score', { precision: 5, scale: 4 }),
    
    // Suggested execution
    suggestedChannel: channelPreferenceEnum('suggested_channel'),
    suggestedTiming: timestamp('suggested_timing', { withTimezone: true }),
    suggestedMessage: text('suggested_message'),
    messageTemplateId: text('message_template_id'),
    
    // Parameters
    actionParams: jsonb('action_params').default({}),
    
    // Policy constraints
    policyConstraints: jsonb('policy_constraints').default([]),
    requiresApproval: boolean('requires_approval').notNull().default(false),
    approvalThreshold: integer('approval_threshold'),
    
    // Trigger
    triggerReason: text('trigger_reason').notNull(),
    triggerRiskScoreId: text('trigger_risk_score_id'),
    
    // Expiry
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    
    // Execution
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
    executedAt: timestamp('executed_at', { withTimezone: true }),
    executedBy: text('executed_by'),
    executionMethod: text('execution_method'),
    
    // Approval
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    approvedBy: text('approved_by'),
    rejectedAt: timestamp('rejected_at', { withTimezone: true }),
    rejectedBy: text('rejected_by'),
    rejectionReason: text('rejection_reason'),
    
    // Outcome
    outcome: jsonb('outcome').default({}),
    outcomeRecordedAt: timestamp('outcome_recorded_at', { withTimezone: true }),
    wasSuccessful: boolean('was_successful'),
    
    // Fairness audit
    fairnessFactors: jsonb('fairness_factors').default({}),
    
    // Model info
    modelVersion: text('model_version'),
    
    // Timestamps
    recommendedAt: timestamp('recommended_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('next_best_actions_tenant_idx').on(table.tenantId),
    customerIdx: index('next_best_actions_customer_idx').on(table.customerId),
    leaseIdx: index('next_best_actions_lease_idx').on(table.leaseId),
    actionTypeIdx: index('next_best_actions_action_type_idx').on(table.actionType),
    statusIdx: index('next_best_actions_status_idx').on(table.status),
    priorityIdx: index('next_best_actions_priority_idx').on(table.priority),
    recommendedAtIdx: index('next_best_actions_recommended_at_idx').on(table.recommendedAt),
    expiresAtIdx: index('next_best_actions_expires_at_idx').on(table.expiresAt),
  })
);

// ============================================================================
// Intervention Logs Table
// ============================================================================

export const interventionLogs = pgTable(
  'intervention_logs',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    customerId: text('customer_id').notNull().references(() => customers.id, { onDelete: 'cascade' }),
    nextBestActionId: text('next_best_action_id').references(() => nextBestActions.id, { onDelete: 'set null' }),
    
    // Intervention details
    interventionType: text('intervention_type').notNull(),
    channel: channelPreferenceEnum('channel'),
    
    // Content
    messageContent: text('message_content'),
    offerDetails: jsonb('offer_details').default({}),
    
    // Execution
    executedAt: timestamp('executed_at', { withTimezone: true }).notNull(),
    executedBy: text('executed_by'),
    executionMethod: text('execution_method'),
    
    // Response
    responseReceivedAt: timestamp('response_received_at', { withTimezone: true }),
    responseType: text('response_type'),
    responseContent: text('response_content'),
    
    // Outcome measurement
    preInterventionState: jsonb('pre_intervention_state').default({}),
    postInterventionState: jsonb('post_intervention_state').default({}),
    measuredAt: timestamp('measured_at', { withTimezone: true }),
    
    // Success metrics
    wasSuccessful: boolean('was_successful'),
    successMetrics: jsonb('success_metrics').default({}),
    
    // Cost
    cost: integer('cost'),
    costCurrency: text('cost_currency').default('KES'),
    
    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('intervention_logs_tenant_idx').on(table.tenantId),
    customerIdx: index('intervention_logs_customer_idx').on(table.customerId),
    nextBestActionIdx: index('intervention_logs_next_best_action_idx').on(table.nextBestActionId),
    interventionTypeIdx: index('intervention_logs_intervention_type_idx').on(table.interventionType),
    executedAtIdx: index('intervention_logs_executed_at_idx').on(table.executedAt),
  })
);

// ============================================================================
// Relations
// ============================================================================

export const tenantSegmentsRelations = relations(tenantSegments, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [tenantSegments.tenantId],
    references: [tenants.id],
  }),
  memberships: many(customerSegmentMemberships),
}));

export const customerSegmentMembershipsRelations = relations(customerSegmentMemberships, ({ one }) => ({
  tenant: one(tenants, {
    fields: [customerSegmentMemberships.tenantId],
    references: [tenants.id],
  }),
  customer: one(customers, {
    fields: [customerSegmentMemberships.customerId],
    references: [customers.id],
  }),
  segment: one(tenantSegments, {
    fields: [customerSegmentMemberships.segmentId],
    references: [tenantSegments.id],
  }),
}));

export const tenantPreferencesRelations = relations(tenantPreferences, ({ one }) => ({
  tenant: one(tenants, {
    fields: [tenantPreferences.tenantId],
    references: [tenants.id],
  }),
  customer: one(customers, {
    fields: [tenantPreferences.customerId],
    references: [customers.id],
  }),
}));

export const frictionFingerprintsRelations = relations(frictionFingerprints, ({ one }) => ({
  tenant: one(tenants, {
    fields: [frictionFingerprints.tenantId],
    references: [tenants.id],
  }),
  customer: one(customers, {
    fields: [frictionFingerprints.customerId],
    references: [customers.id],
  }),
}));

export const riskScoresRelations = relations(riskScores, ({ one }) => ({
  tenant: one(tenants, {
    fields: [riskScores.tenantId],
    references: [tenants.id],
  }),
  customer: one(customers, {
    fields: [riskScores.customerId],
    references: [customers.id],
  }),
  lease: one(leases, {
    fields: [riskScores.leaseId],
    references: [leases.id],
  }),
}));

export const nextBestActionsRelations = relations(nextBestActions, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [nextBestActions.tenantId],
    references: [tenants.id],
  }),
  customer: one(customers, {
    fields: [nextBestActions.customerId],
    references: [customers.id],
  }),
  lease: one(leases, {
    fields: [nextBestActions.leaseId],
    references: [leases.id],
  }),
  interventionLogs: many(interventionLogs),
}));

export const interventionLogsRelations = relations(interventionLogs, ({ one }) => ({
  tenant: one(tenants, {
    fields: [interventionLogs.tenantId],
    references: [tenants.id],
  }),
  customer: one(customers, {
    fields: [interventionLogs.customerId],
    references: [customers.id],
  }),
  nextBestAction: one(nextBestActions, {
    fields: [interventionLogs.nextBestActionId],
    references: [nextBestActions.id],
  }),
}));
