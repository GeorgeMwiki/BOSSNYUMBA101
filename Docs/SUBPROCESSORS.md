# BOSSNYUMBA Subprocessor Register

## Overview

This register lists all third-party subprocessors that BOSSNYUMBA engages to process
Personal Data on behalf of its customers (tenants). It is maintained in accordance
with:

- **GDPR** (EU Regulation 2016/679) — Article 28 (processor obligations) and Article 30
  (records of processing activities)
- **Kenya Data Protection Act, 2019** — Sections 40-42 (processor/sub-processor duties,
  cross-border transfer)
- **Tanzania Personal Data Protection Act, 2022** (PDPA) — Part V (processor
  obligations, cross-border transfer controls)

BOSSNYUMBA customers are notified before any new subprocessor is added or an existing
subprocessor is changed in a manner that materially affects the processing of Personal
Data, in accordance with our Data Processing Addendum (DPA).

The canonical machine-readable source of truth for application code is
`packages/enterprise-hardening/src/compliance/subprocessors.ts`. The database table
`subprocessors` mirrors this register and is seeded from the same data.

---

## DPA Status Legend

| Status           | Meaning                                                                 |
|------------------|-------------------------------------------------------------------------|
| `signed`         | A Data Processing Addendum is executed and in force.                    |
| `pending`        | DPA has been requested / is in negotiation; MUST be signed before GA.   |
| `not_applicable` | Subprocessor does not process Personal Data (e.g., pure infra metrics). |

---

## Active Subprocessors

| # | Name      | Purpose                          | Data Categories Processed                                | Location / Region         | DPA Status          | Risk Flags |
|---|-----------|----------------------------------|----------------------------------------------------------|---------------------------|---------------------|------------|
| 1 | Anthropic | AI copilot (primary LLM)         | Tenant chat logs, document OCR text                      | United States             | **PENDING** (TO SIGN) | None |
| 2 | OpenAI    | Secondary LLM / fallback         | Tenant chat logs, document OCR text                      | United States             | Signed              | None |
| 3 | DeepSeek  | Tertiary LLM / cost-optimised    | Tenant chat logs, document OCR text                      | People's Republic of China | Signed              | **RISK FLAGGED — Disabled at code level for TZ and KE tenants** |
| 4 | Twilio    | Transactional SMS delivery       | Phone numbers, SMS message bodies                        | United States             | Signed              | None |
| 5 | Resend    | Transactional email delivery     | Email addresses, email bodies                            | United States             | Signed              | None |
| 6 | Supabase  | Managed Postgres, Auth, Storage  | All PII (at-rest encrypted; RLS enforced)                | EU and US regions         | Signed              | None — EU region MUST be used for EU tenants |

---

## Notes on Specific Subprocessors

### Anthropic (Claude API) — DPA TO SIGN

Anthropic provides the primary large-language-model backend for the BOSSNYUMBA AI
copilot. **The DPA is currently pending execution and must be signed prior to
General Availability (GA).** Until the DPA is signed, Anthropic MUST NOT be used to
process production tenant data for customers in GDPR, Kenya DPA, or Tanzania PDPA
jurisdictions.

### DeepSeek — Disabled for Tanzania and Kenya Tenants

Although a DPA is in place with DeepSeek, the provider's primary data-processing
infrastructure is located in the People's Republic of China. To mitigate PRC data
sovereignty concerns and to comply with the cross-border transfer restrictions of
the Kenya Data Protection Act and Tanzania PDPA, DeepSeek is **disabled at the
application layer** for all tenants whose country is `TZ` (Tanzania) or `KE`
(Kenya).

This restriction is enforced by `packages/ai-copilot/src/llm-provider-gate.ts`,
which reads the `disabledForCountries` list from
`packages/enterprise-hardening/src/compliance/subprocessors.ts` and refuses to
route traffic from restricted tenants to DeepSeek. The DeepSeek seed entry in the
`subprocessors` database table carries `disabled_for_countries = ['TZ', 'KE']`.

### Supabase — Regional Residency

Supabase is used as the managed Postgres, auth, and object-storage provider.
EU-based tenants MUST be provisioned on an EU Supabase project to satisfy GDPR
data-residency expectations. US and rest-of-world tenants may be provisioned on
US regions.

### Twilio and Resend

Both providers operate under SCCs for cross-border transfers and encrypt data
both in transit and at rest. Only the minimum fields necessary for message
delivery are transmitted.

---

## Change Control

| Action                         | Responsible Party        | SLA                                             |
|--------------------------------|--------------------------|-------------------------------------------------|
| Add new subprocessor           | DPO + Engineering Lead   | 30-day advance customer notice                  |
| Change region of subprocessor  | DPO + Engineering Lead   | 30-day advance customer notice                  |
| Remove subprocessor            | DPO                      | Same-day public register update                 |
| Flag subprocessor for risk     | DPO or Security Lead     | Immediate code-level gate + register update     |

All changes to this register MUST be reflected in:

1. This document (`Docs/SUBPROCESSORS.md`)
2. `packages/enterprise-hardening/src/compliance/subprocessors.ts` (typed source of truth)
3. The `subprocessors` database table (via a new migration — the table is append-only for audit history)

---

## Contact

Data Protection Officer: `dpo@bossnyumba.com`
Last Reviewed: 2026-04-08
