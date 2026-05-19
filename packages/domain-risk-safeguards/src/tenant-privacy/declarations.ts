/**
 * Tenant-privacy channel declarations.
 *
 * Each of the four PII channels declares:
 *   - Retention period (days)
 *   - Access-control role list
 *   - Egress-audit endpoint
 *   - Lawful-basis citations (PDPA-TZ / DPA-KE / NDPA-NG / GDPR / HIPAA)
 *
 * The declarations are immutable defaults. Tenants can extend the
 * retention period via the BOSSNYUMBA-HQ admin UI (downstream wiring),
 * but cannot reduce access controls or skip egress audit.
 *
 * NOTE: Retention defaults are conservative — the minimum required by
 * regulator. Tenants may choose longer retention (audit purposes) but
 * cannot reduce below these floors without an HQ-admin override.
 */

import type { PiiChannel, PiiChannelDeclaration } from '../types.js';

/**
 * Smartlock biometric channel. Tanzanian PDPA 2022 + biometric special-
 * category data treatment under EU GDPR Art. 9. Strict 90-day default;
 * Hardware-vendor agreement requires deletion on lease termination.
 */
const BIOMETRIC_DECLARATION: PiiChannelDeclaration = Object.freeze({
  channel: 'biometric-smartlock',
  retentionDays: 90,
  accessControlRoles: Object.freeze([
    'tenant-owner',
    'tenant-emergency-contact',
    'bossnyumba-platform-admin',
  ]),
  egressAuditEndpoint: '/audit/pii-egress/biometric',
  lawfulBasisCitations: Object.freeze([
    'Tanzanian PDPA 2022 §17(2) — biometric data special category',
    'GDPR Art. 9(2)(b) — employment & social-security exception',
    'Kenyan DPA 2019 §44 — sensitive personal data',
  ]),
});

/**
 * Chat transcript channel. Includes WhatsApp / SMS / in-app chat. 365-
 * day default for dispute-resolution + tax-receipt obligations.
 */
const TRANSCRIPT_DECLARATION: PiiChannelDeclaration = Object.freeze({
  channel: 'chat-transcript',
  retentionDays: 365,
  accessControlRoles: Object.freeze([
    'tenant',
    'tenant-owner',
    'bossnyumba-support-tier-2',
    'bossnyumba-platform-admin',
  ]),
  egressAuditEndpoint: '/audit/pii-egress/transcript',
  lawfulBasisCitations: Object.freeze([
    'Tanzanian PDPA 2022 §11 — legitimate interest (dispute resolution)',
    'GDPR Art. 6(1)(f) — legitimate interest',
    'EU AI Act Art. 50 — transparency obligation',
  ]),
});

/**
 * M-Pesa SMS parse channel. Contains rent-payment receipts + bank
 * partial details. 730-day default for KRA / TRA tax-audit obligations.
 */
const MPESA_SMS_DECLARATION: PiiChannelDeclaration = Object.freeze({
  channel: 'mpesa-sms',
  retentionDays: 730,
  accessControlRoles: Object.freeze([
    'tenant',
    'tenant-owner',
    'bossnyumba-platform-admin',
    'bossnyumba-tax-export-service',
  ]),
  egressAuditEndpoint: '/audit/pii-egress/mpesa-sms',
  lawfulBasisCitations: Object.freeze([
    'TRA / KRA tax-audit retention requirement — 7 years (we cap at 2y for app retention)',
    'Tanzanian PDPA 2022 §11 — legal obligation basis',
    'Kenyan Tax Procedures Act §23(1)',
  ]),
});

/**
 * Lease PDF channel. Contains tenant + owner + guarantor PII. 7-year
 * retention for legal-evidence purposes (Tanzanian Limitation Act).
 */
const LEASE_PDF_DECLARATION: PiiChannelDeclaration = Object.freeze({
  channel: 'lease-pdf',
  retentionDays: 2555, // 7 years
  accessControlRoles: Object.freeze([
    'tenant',
    'tenant-owner',
    'tenant-guarantor',
    'bossnyumba-platform-admin',
    'bossnyumba-legal-team',
  ]),
  egressAuditEndpoint: '/audit/pii-egress/lease-pdf',
  lawfulBasisCitations: Object.freeze([
    'Tanzanian Limitation Act Cap. 89 §3 — 6-year contract claims',
    'GDPR Art. 6(1)(b) — contract performance',
    'Kenyan Land Act §43(2) — lease evidentiary retention',
  ]),
});

/**
 * Lookup table — the canonical declaration per channel.
 */
export const TENANT_PRIVACY_DECLARATIONS: Readonly<
  Record<PiiChannel, PiiChannelDeclaration>
> = Object.freeze({
  'biometric-smartlock': BIOMETRIC_DECLARATION,
  'chat-transcript': TRANSCRIPT_DECLARATION,
  'mpesa-sms': MPESA_SMS_DECLARATION,
  'lease-pdf': LEASE_PDF_DECLARATION,
});

/**
 * The four enforced channels — useful for iterating in cron sweeps.
 */
export const ALL_PII_CHANNELS: ReadonlyArray<PiiChannel> = Object.freeze([
  'biometric-smartlock',
  'chat-transcript',
  'mpesa-sms',
  'lease-pdf',
]);
