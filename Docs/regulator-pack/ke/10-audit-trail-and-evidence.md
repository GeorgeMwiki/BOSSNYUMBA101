# 10 — Audit Trail & Evidence (Kenya)

**Document version:** 1.0
**Date:** 2026-05-22
**Owner:** CCO
**Jurisdiction:** Kenya
**Source files:** `packages/audit-chain/`, `packages/database/src/schema/audit.ts`
**Aligned to:** OCSF (Open Cybersecurity Schema Framework) 1.2; DPA 2019 s.31 (record-keeping for accountability); POCAMLA s.46 (AML record retention); CBK Cybersecurity Guideline 2017 (audit-trail completeness expectation); SR 11-7 §III (model governance auditability).

---

## 1. Design principles

Same four properties as TZ pack: append-only, tamper-evident (HMAC chain), verifiable on read + on schedule, comprehensive.

## 2. Schema

Same drizzle schema as TZ pack — single codebase, region-flagged events. See `packages/database/src/schema/audit.ts`.

## 3. Event categories

Same categories as TZ pack (auth, payments, lease, maintenance, communication, ai, admin, gdpr). Kenya-specific event types:

- `payments.daraja.stk_initiated` / `.callback_received` (Safaricom Daraja-specific)
- `payments.pesalink.transfer_initiated` / `.confirmed`
- `payments.kcb_buni.transfer_initiated` / `.confirmed`
- `payments.equity_eazzy.transfer_initiated` / `.confirmed`
- `tax.itax.export_generated`
- `gdpr.dpa_s35_challenge_submitted` / `.review_completed` (KE-specific automated-decision challenge)

## 4. Hash-chain integrity

Same implementation as TZ pack: `verifyTail` on read, `verifyRandomSample` cron, on-demand verify API.

### 4.1 Threat model

Same threat model as TZ pack (insider with service-role; reorder; delete; tamper; replay from backup).

## 5. Retention (Kenya)

| Record type | Retention | Statutory basis |
|---|---|---|
| Audit events (general) | 7 years | Income Tax Act s.54 (records); DPA accountability principle |
| Payment events | 7 years | Tax + AML record-keeping (POCAMLA s.46) |
| Tenant-identity verification records | 7 years from end of business relationship | POCAMLA Regulations |
| Voice transcripts | 2 years (default); 7 years if material to dispute | Operational + dispute resolution |
| Consent records | Lifetime of relationship + 5 years | DPA accountability |
| Model decisions affecting tenant materially | 10 years | SR 11-7 + DPA s.35 review-right |
| s.35 automated-decision challenges + reviews | 7 years | DPA accountability |
| Security incident records | 10 years | CBK supervisory expectation |

## 6. Sample audit packet (example examiner request)

If ODPC requests an audit packet for tenant T-KE-12345 covering 2026:

1. Pull all events from `audit_events` where `tenant_id = 'T-KE-12345' AND region = 'KE' AND timestamp BETWEEN '2026-01-01' AND '2026-12-31'`.
2. Verify chain integrity; attach verification report.
3. Redact PII of unrelated tenants (verified — none should appear).
4. Bundle as ZIP: events JSON, chain-verification report, consent record export, DSAR history, s.35 challenge history, communication log.
5. Encrypted delivery to ODPC contact; access logged as `audit.regulator_packet.delivered`.

## 7. Access controls

Same as TZ pack:

- Read access: DPO, CCO, MLRO, CISO, designated regulator-liaison.
- Read access scoped per tenant for property-mgr / owner via RLS.
- Service accounts can only **insert**; explicit deny on `update` / `delete` at DB layer.
- All access logged as a meta-event (`audit.access`).

## 8. ODPC-specific evidence requirements

ODPC enforcement (DPA s.63) may require disclosure of:

- All processing of a complainant's data
- Lawful basis applied per processing
- Cross-border transfers
- Automated decisions and their outcomes (DPA s.35)
- Consent records

BossNyumba's audit chain is structured so each of these can be answered with a single query + chain-verified extract.

## 9. Cross-references

- DSAR endpoints (read of own data) → doc 03 §7
- DPA s.35 challenge log → doc 06 §7
- Incident-response evidence preservation → doc 07 §6.2
- Backup & recovery of audit chain → doc 08 §3.1 (RPO = 0)
- Model decision logging → doc 05

> TODO: insert sample chain-verification report; insert sample ODPC packet manifest.
