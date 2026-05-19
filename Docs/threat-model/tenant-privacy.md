# Tenant-Privacy Threat Model

**Phase M-F — Domain-Risk Safeguards.** Generated alongside
`@bossnyumba/domain-risk-safeguards`.

This document is the **declared** threat model for the four BOSSNYUMBA PII
channels that flow through the platform. Each channel has machine-readable
declarations in
`packages/domain-risk-safeguards/src/tenant-privacy/declarations.ts`; the
cron sweeps enforce retention, and egress events flow through a typed
audit endpoint. This Markdown is the human-readable counterpart that
auditors / regulators / owners read.

The threat model is owned by BOSSNYUMBA HQ Admin. Tenant-owners may
*extend* retention (longer) but may not *reduce* below the floors below.

---

## Channel 1 — Biometric (Smartlock)

| Field | Value |
|---|---|
| Data class | Special-category biometric (fingerprint / face geometry) |
| Retention floor | 90 days |
| Retention rationale | Hardware-vendor agreement; lease-termination triggers immediate deletion |
| Access roles | `tenant-owner`, `tenant-emergency-contact`, `bossnyumba-platform-admin` |
| Egress audit endpoint | `/audit/pii-egress/biometric` |
| Lawful basis | Tanzanian PDPA 2022 §17(2) — special-category data; GDPR Art. 9(2)(b) — employment & social-security exception; Kenyan DPA 2019 §44 — sensitive personal data |

### Threats

| Threat | Severity | Mitigation |
|---|---|---|
| Vendor breach (smartlock cloud) | Critical | At-rest encryption; vendor SOC 2 attestation; off-vendor deletion on lease termination |
| Tenant-without-consent enrolment | High | Enrolment requires explicit informed consent screen + signature flow |
| Replay attack on lock | High | Per-event nonce; rolling-code firmware |
| Disclosure via subject-access | Medium | Subject-access flow scrubs other-tenant data |
| Disclosure via audit-log leak | Medium | Audit logs are PII-redacted (record-id tokens, no biometric raw) |
| Retention drift | Medium | Cron sweep auto-deletes records ≥ retentionDays old |

### Egress destinations (allowlist)

- Smartlock vendor API (encrypted, attested)
- Tenant-owner subject-access export (PDF, watermarked)
- Regulator request (PDPA-TZ §23, GDPR Art. 15) under HQ-admin approval

---

## Channel 2 — Chat Transcript (WhatsApp / SMS / in-app)

| Field | Value |
|---|---|
| Data class | PII + potential special-category disclosure (health / belief / household composition) |
| Retention floor | 365 days |
| Retention rationale | Dispute-resolution + EU AI Act Art. 50 transparency |
| Access roles | `tenant`, `tenant-owner`, `bossnyumba-support-tier-2`, `bossnyumba-platform-admin` |
| Egress audit endpoint | `/audit/pii-egress/transcript` |
| Lawful basis | Tanzanian PDPA 2022 §11 — legitimate interest; GDPR Art. 6(1)(f); EU AI Act Art. 50 |

### Threats

| Threat | Severity | Mitigation |
|---|---|---|
| Prompt-injection via tenant message | High | K-E #108 input-shield + RAG spotlighting (M-E Phase) |
| Special-category leak in chat | High | Output guard scrubs accidental health / religion / disability mentions before logging |
| Cross-tenant transcript bleed | Critical | Tenant-isolation policy (graph-privacy); RLS at DB layer |
| Auto-execution of judgment cases (Klarna failure) | Critical | Klarna-pattern wrap — see Module 3 of this package |
| AI-summary fabrication | Medium | M-B pre-action verification stack (CoVe + ORM) |
| Retention drift | Medium | Cron sweep |

### Egress destinations (allowlist)

- Tenant-owner subject-access export
- Regulator export under HQ-admin approval
- BOSSNYUMBA support tier query (audited per query)

---

## Channel 3 — M-Pesa SMS Parse

| Field | Value |
|---|---|
| Data class | Financial PII (mobile-money receipt, last-4 of phone, last-4 of bank where applicable) |
| Retention floor | 730 days (2 years in-app; tax obligation retained off-app at warm storage to 7y) |
| Retention rationale | TRA / KRA tax-audit obligations |
| Access roles | `tenant`, `tenant-owner`, `bossnyumba-platform-admin`, `bossnyumba-tax-export-service` |
| Egress audit endpoint | `/audit/pii-egress/mpesa-sms` |
| Lawful basis | TRA Tax Procedures Act 2015; Kenyan Tax Procedures Act §23; PDPA-TZ §11 — legal obligation |

### Threats

| Threat | Severity | Mitigation |
|---|---|---|
| SMS provider impersonation | High | Provider whitelist (Safaricom / Vodacom only) + signature verification |
| Receipt-tampering | High | Per-receipt cryptographic chain (audit-chain-verify scanner from J7) |
| Disclosure of phone number to non-tenant | High | Tokenization at prompt layer (T-XXXXX), de-tokenize at action only |
| Cross-rail (Airtel/T-Pesa) confusion | Medium | Provider-tag stored alongside record; routing predicate checks |
| Retention drift | Medium | Cron sweep |
| Tax-export over-scope | High | Tax-export service uses dedicated narrow role; egress events audited |

### Egress destinations (allowlist)

- Tax-export service (one-way, KRA / TRA bound)
- Tenant-owner subject-access export
- Regulator export under HQ-admin approval

---

## Channel 4 — Lease PDF

| Field | Value |
|---|---|
| Data class | Multi-party PII (tenant + owner + guarantor identity + addresses + signatures) |
| Retention floor | 2555 days (7 years) |
| Retention rationale | Tanzanian Limitation Act Cap. 89 §3 — 6-year contract claims; we add 1y safety margin |
| Access roles | `tenant`, `tenant-owner`, `tenant-guarantor`, `bossnyumba-platform-admin`, `bossnyumba-legal-team` |
| Egress audit endpoint | `/audit/pii-egress/lease-pdf` |
| Lawful basis | Tanzanian Limitation Act Cap. 89 §3; GDPR Art. 6(1)(b) — contract performance; Kenyan Land Act §43(2) |

### Threats

| Threat | Severity | Mitigation |
|---|---|---|
| RAG-poisoning via uploaded PDF | High | PDF intake passes through spotlighting + instruction-detection |
| OCR/extracted-PII leak to prompt | High | PII-tokenization layer wraps OCR output |
| Cross-tenant PDF bleed | Critical | Per-tenant bucket isolation; signed-URL TTL ≤ 5min |
| Forged signature insertion | High | Signature-chain verification on every upload |
| Long-tail retention exposure (7y) | Medium | At-rest encryption; access requires re-auth after 90 days idle |
| Subject-access redaction (other parties) | Medium | Export pipeline redacts non-requester PII |

### Egress destinations (allowlist)

- Tenant / owner / guarantor download (signed URL, audited per fetch)
- Legal team export under court order
- Subject-access export with cross-party redaction

---

## Cross-Cutting Controls

- **Tokenization-at-prompt** — never include raw PII in an LLM prompt. The
  PII layer issues stable tokens (`T-XXXXX`, `U-XXXXX`, `L-XXXXX`,
  `B-XXXXX`) and de-tokenizes only at the action boundary.
- **Activation-probe runtime classifier** — every output is scanned for
  unusual sentiment / scheming markers (M-E Phase).
- **Quarterly compliance report** — egress + retention counts roll up to
  the per-tenant + platform-wide report under
  `Docs/compliance/quarterly/`.
- **Subject-access portal** — tenants and owners can request their data
  via a guided flow; the response is auto-redacted for other parties.

## Citations

- Tanzanian PDPA 2022, full Act + supporting regulations.
- Kenyan Data Protection Act 2019, especially Part IV.
- Nigerian NDPA 2023, full Act.
- EU GDPR (with EU AI Act Art. 50 overlay).
- HUD AI Guidance May 2024 — fair-housing applies to AI tenant-screening.
- EU AI Act phased rollout 2025-2026 — HIGH-RISK list including
  tenant-screening.
- SafeRent settlement (2024) — disparate-impact testing playbook.
