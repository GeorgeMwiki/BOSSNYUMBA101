/**
 * IoT Sensors + Observations + Anomalies — Wave 8 (S3 gap closure)
 *
 * Time-series ingestion for post-lease usage monitoring:
 *   - iot_sensors       — registered sensor metadata (kind, bounds, owner)
 *   - iot_observations  — append-only readings (BRIN-indexed by time)
 *   - iot_anomalies     — detected events needing operator action
 */

import {
  pgTable,
  text,
  integer,
  doublePrecision,
  boolean,
  jsonb,
  timestamp,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { tenants } from './tenant.schema.js';

export const iotSensors = pgTable(
  'iot_sensors',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    externalId: text('external_id').notNull(),
    vendor: text('vendor').notNull(),
    unitId: text('unit_id'),
    propertyId: text('property_id'),
    geoNodeId: text('geo_node_id'),
    label: text('label'),
    unitOfMeasure: text('unit_of_measure'),
    samplingIntervalSeconds: integer('sampling_interval_seconds'),
    expectedMin: doublePrecision('expected_min'),
    expectedMax: doublePrecision('expected_max'),
    silenceThresholdSeconds: integer('silence_threshold_seconds'),
    active: boolean('active').notNull().default(true),
    metadata: jsonb('metadata').notNull().default({}),
    registeredAt: timestamp('registered_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  },
  (table) => ({
    uniqueTenantExternal: unique().on(table.tenantId, table.externalId),
    tenantIdx: index('idx_iot_sensors_tenant').on(table.tenantId),
  })
);

export const iotObservations = pgTable(
  'iot_observations',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    sensorId: text('sensor_id').notNull().references(() => iotSensors.id, { onDelete: 'cascade' }),
    observedAt: timestamp('observed_at', { withTimezone: true }).notNull(),
    numericValue: doublePrecision('numeric_value'),
    booleanValue: boolean('boolean_value'),
    stringValue: text('string_value'),
    jsonbValue: jsonb('jsonb_value'),
    quality: text('quality').notNull().default('good'),
    rawPayload: jsonb('raw_payload'),
    ingestedAt: timestamp('ingested_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantTimeIdx: index('idx_iot_obs_tenant_time').on(table.tenantId, table.observedAt),
    sensorTimeIdx: index('idx_iot_obs_sensor_time').on(table.sensorId, table.observedAt),
  })
);

export const iotAnomalies = pgTable(
  'iot_anomalies',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    sensorId: text('sensor_id').notNull().references(() => iotSensors.id, { onDelete: 'cascade' }),
    detectedAt: timestamp('detected_at', { withTimezone: true }).notNull().defaultNow(),
    anomalyType: text('anomaly_type').notNull(),
    severity: text('severity').notNull().default('medium'),
    observationId: text('observation_id'),
    observedValue: doublePrecision('observed_value'),
    expectedRangeMin: doublePrecision('expected_range_min'),
    expectedRangeMax: doublePrecision('expected_range_max'),
    message: text('message').notNull(),
    acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
    acknowledgedBy: text('acknowledged_by'),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    resolvedBy: text('resolved_by'),
    resolutionNotes: text('resolution_notes'),
    metadata: jsonb('metadata').notNull().default({}),
  },
  (table) => ({
    tenantTimeIdx: index('idx_iot_anomalies_tenant').on(table.tenantId, table.detectedAt),
    sensorIdx: index('idx_iot_anomalies_sensor').on(table.sensorId),
  })
);

export const iotSensorsRelations = relations(iotSensors, ({ many }) => ({
  observations: many(iotObservations),
  anomalies: many(iotAnomalies),
}));

export const iotObservationsRelations = relations(iotObservations, ({ one }) => ({
  sensor: one(iotSensors, {
    fields: [iotObservations.sensorId],
    references: [iotSensors.id],
  }),
}));

export const iotAnomaliesRelations = relations(iotAnomalies, ({ one }) => ({
  sensor: one(iotSensors, {
    fields: [iotAnomalies.sensorId],
    references: [iotSensors.id],
  }),
}));
