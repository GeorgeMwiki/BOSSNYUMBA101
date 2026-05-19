/**
 * PI-A · observations · fixtures — 12 canonical ObservationEvents covering
 * all six source kinds (2 each). Used by tests in this package AND by
 * downstream packages that need a known-good observation to wire into
 * confidence / auto-fill / history.
 *
 * Each fixture is frozen and constructed via buildObservation so the
 * production invariants are also exercised here.
 */

import { buildObservation } from './build.js';
import type { ObservationEvent } from './types.js';

const TENANT = 'tenant_test_001';
const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);
const HASH_C = 'c'.repeat(64);
const HASH_D = 'd'.repeat(64);
const HASH_E = 'e'.repeat(64);
const HASH_F = 'f'.repeat(64);

/** Chat text — owner typed "Sarah's phone is 0712345678". */
export const FIX_CHAT_TEXT_PHONE: ObservationEvent = buildObservation({
  tenantId: TENANT,
  entityId: 'emp_sarah_001',
  entityKind: 'employee',
  attributeKey: 'phone',
  observedValue: '+254712345678',
  source: { kind: 'chat-text', ref: 'msg_001', confidence: 0.78, observedAt: '2026-05-19T08:00:00Z' },
  evidence: [{ kind: 'chat-message', identifier: 'msg_001', excerpt: "Sarah's phone is 0712345678", hash: HASH_A }],
});

/** Chat text — owner clarified "rent for unit 3A is 45,000". */
export const FIX_CHAT_TEXT_RENT: ObservationEvent = buildObservation({
  tenantId: TENANT,
  entityId: 'unit_3A',
  entityKind: 'unit',
  attributeKey: 'monthly_rent',
  observedValue: 45000,
  source: { kind: 'chat-text', ref: 'msg_002', confidence: 0.7, observedAt: '2026-05-19T08:05:00Z' },
  evidence: [{ kind: 'chat-message', identifier: 'msg_002', excerpt: 'rent for unit 3A is 45,000', hash: HASH_B }],
});

/** Chat attachment — image of an ID card → name extracted. */
export const FIX_CHAT_ATTACHMENT_NAME: ObservationEvent = buildObservation({
  tenantId: TENANT,
  entityId: 'cust_002',
  entityKind: 'customer',
  attributeKey: 'full_name',
  observedValue: 'Jane Wanjiku',
  source: { kind: 'chat-attachment', ref: 'msg_003:att_01', confidence: 0.85, observedAt: '2026-05-19T08:10:00Z' },
  evidence: [{ kind: 'chat-message', identifier: 'msg_003', excerpt: 'OCR(ID-front)', hash: HASH_C }],
});

/** Chat attachment — lease PDF → end date. */
export const FIX_CHAT_ATTACHMENT_LEASE_END: ObservationEvent = buildObservation({
  tenantId: TENANT,
  entityId: 'lease_010',
  entityKind: 'lease',
  attributeKey: 'lease_end_date',
  observedValue: '2027-01-31',
  source: { kind: 'chat-attachment', ref: 'msg_004:att_01', confidence: 0.92, observedAt: '2026-05-19T08:15:00Z' },
  evidence: [{ kind: 'chat-message', identifier: 'msg_004', excerpt: 'Lease ends 31 Jan 2027', hash: HASH_D }],
});

/** Ingest file — CSV row with employee start_date. */
export const FIX_INGEST_FILE_START_DATE: ObservationEvent = buildObservation({
  tenantId: TENANT,
  entityId: 'emp_004',
  entityKind: 'employee',
  attributeKey: 'start_date',
  observedValue: '2024-03-01',
  source: { kind: 'ingest-file', ref: 'file_payroll_2024:row_4', confidence: 0.95, observedAt: '2026-05-19T08:20:00Z' },
  evidence: [{ kind: 'file-row', identifier: 'file_payroll_2024:4', excerpt: 'start_date=2024-03-01', hash: HASH_E }],
});

/** Ingest file — CSV row with payroll salary. */
export const FIX_INGEST_FILE_SALARY: ObservationEvent = buildObservation({
  tenantId: TENANT,
  entityId: 'emp_004',
  entityKind: 'employee',
  attributeKey: 'salary',
  observedValue: 85000,
  source: { kind: 'ingest-file', ref: 'file_payroll_2024:row_4', confidence: 0.95, observedAt: '2026-05-19T08:20:00Z' },
  evidence: [{ kind: 'file-row', identifier: 'file_payroll_2024:4', excerpt: 'salary=85000', hash: HASH_F }],
});

/** Connector API — M-Pesa transactions revealing customer phone. */
export const FIX_CONNECTOR_PHONE: ObservationEvent = buildObservation({
  tenantId: TENANT,
  entityId: 'cust_005',
  entityKind: 'customer',
  attributeKey: 'phone',
  observedValue: '+254700000005',
  source: { kind: 'connector-api', ref: 'mpesa:run_2026_05_19', confidence: 0.97, observedAt: '2026-05-19T08:30:00Z' },
  evidence: [{ kind: 'connector-response', identifier: 'mpesa:run_2026_05_19:txn_42', hash: HASH_A }],
});

/** Connector API — KRA filing status. */
export const FIX_CONNECTOR_KRA: ObservationEvent = buildObservation({
  tenantId: TENANT,
  entityId: 'kra_filing_2024_q4',
  entityKind: 'kra_filing',
  attributeKey: 'status',
  observedValue: 'filed',
  source: { kind: 'connector-api', ref: 'kra:itax:run_2026_05_19', confidence: 0.99, observedAt: '2026-05-19T08:35:00Z' },
  evidence: [{ kind: 'connector-response', identifier: 'kra:itax:run_2026_05_19:status', hash: HASH_B }],
});

/** Sub-agent research — verifying vendor business hours. */
export const FIX_SUBAGENT_HOURS: ObservationEvent = buildObservation({
  tenantId: TENANT,
  entityId: 'vendor_009',
  entityKind: 'vendor',
  attributeKey: 'business_hours',
  observedValue: 'Mon-Fri 08:00-17:00',
  source: { kind: 'subagent-research', ref: 'mdr:run_2026_05_19_001', confidence: 0.65, observedAt: '2026-05-19T08:40:00Z' },
  evidence: [{ kind: 'subagent-citation', identifier: 'mdr:run_2026_05_19_001:src_1', excerpt: 'Google listing', hash: HASH_C }],
});

/** Sub-agent research — confirming jurisdiction-specific lease term. */
export const FIX_SUBAGENT_JURISDICTION: ObservationEvent = buildObservation({
  tenantId: TENANT,
  entityId: 'jur_rule_001',
  entityKind: 'jurisdictional_rule',
  attributeKey: 'lease_retention_years',
  observedValue: 7,
  source: { kind: 'subagent-research', ref: 'mdr:run_2026_05_19_002', confidence: 0.88, observedAt: '2026-05-19T08:45:00Z' },
  evidence: [{ kind: 'subagent-citation', identifier: 'kenya_evidence_act:s_106B', excerpt: 'records ≥ 7 yrs', hash: HASH_D }],
});

/** Manual edit — owner directly edited a customer email. */
export const FIX_MANUAL_EMAIL: ObservationEvent = buildObservation({
  tenantId: TENANT,
  entityId: 'cust_010',
  entityKind: 'customer',
  attributeKey: 'email',
  observedValue: 'jane@new.example',
  source: { kind: 'manual-edit', ref: 'usr_owner_001', confidence: 1, observedAt: '2026-05-19T08:50:00Z' },
  evidence: [{ kind: 'manual-edit-actor', identifier: 'usr_owner_001', hash: HASH_E }],
});

/** Manual edit — owner corrected lease end date. */
export const FIX_MANUAL_LEASE_END: ObservationEvent = buildObservation({
  tenantId: TENANT,
  entityId: 'lease_011',
  entityKind: 'lease',
  attributeKey: 'lease_end_date',
  observedValue: '2026-12-31',
  source: { kind: 'manual-edit', ref: 'usr_owner_001', confidence: 1, observedAt: '2026-05-19T08:55:00Z' },
  evidence: [{ kind: 'manual-edit-actor', identifier: 'usr_owner_001', hash: HASH_F }],
});

export const ALL_FIXTURES: ReadonlyArray<ObservationEvent> = Object.freeze([
  FIX_CHAT_TEXT_PHONE,
  FIX_CHAT_TEXT_RENT,
  FIX_CHAT_ATTACHMENT_NAME,
  FIX_CHAT_ATTACHMENT_LEASE_END,
  FIX_INGEST_FILE_START_DATE,
  FIX_INGEST_FILE_SALARY,
  FIX_CONNECTOR_PHONE,
  FIX_CONNECTOR_KRA,
  FIX_SUBAGENT_HOURS,
  FIX_SUBAGENT_JURISDICTION,
  FIX_MANUAL_EMAIL,
  FIX_MANUAL_LEASE_END,
]);
