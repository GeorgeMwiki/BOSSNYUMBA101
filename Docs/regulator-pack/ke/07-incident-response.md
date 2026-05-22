# 07 — Incident Response Plan (Kenya)

**Document version:** 1.0
**Date:** 2026-05-22
**Owner:** CISO
**Jurisdiction:** Kenya
**Plan tier:** P0–P3 with 24-hour regulator notification SLA
**Aligned to:** NIST SP 800-61r2 Computer Security Incident Handling Guide; ISO/IEC 27035; CBK Cybersecurity Guideline 2017 §F (Incident management); CBK BCM Guideline CBK/PG/16; DPA 2019 s.43 (breach notification).

---

## 1. Scope

This plan covers all incidents that affect BossNyumba's confidentiality, integrity or availability of tenant, property, lease, or financial data, including: data breaches, account takeover, insider misuse, vendor compromise, ransomware, application outages, payment-rail failures, model failures producing biased outputs, voice-agent hallucination at scale, and AI-prompt-injection incidents.

## 2. Severity definitions

Same definitions as TZ pack (see `tz/07-incident-response.md` §2). Kenya-specific examples:

- **P0:** confirmed breach of tenant PII; unauthorised M-Pesa Kenya disbursement; mass mis-charge; hash-chain tamper
- **P1:** Daraja API integration partially down; AI voice agent producing high-confidence wrong answers at scale
- **P2:** Pesalink integration > 1 h elevated error rate; M-Pesa Kenya STK callback errors > 1% for > 1 h
- **P3:** minor functional bug

## 3. Crisis Management / Incident Response Team

Same IRT structure as TZ pack. Kenya-specific local-language readiness:

- Communications Lead briefed in English + Kiswahili
- External DFIR firm with KE local presence preferred

## 4. Detection sources

Same as TZ pack. Kenya-specific:

- Daraja API status monitoring
- KE-CIRT / IcTI threat-intel feed (if subscribed)
- Communications Authority of Kenya (CA) advisories

## 5. Regulator notification SLAs (Kenya)

| Regulator / Body | Trigger | Notification SLA |
|---|---|---|
| **Office of the Data Protection Commissioner (ODPC)** | Personal-data breach likely to result in risk (DPA s.43) | **≤ 24 h** internal target (statutory: 72 h) |
| **Central Bank of Kenya (CBK)** | Material incident affecting payment-rail or institutional landlord operations | **≤ 24 h** (contractual to institutional clients exceeding any supervisory expectation on BossNyumba directly) |
| Kenya Revenue Authority (KRA) | Incident causing iTax / MRI reporting feed to fail > 24 h | Per integration agreement |
| Communications Authority (CA) | Telecom-related incident (voice / SMS) | Per CA notification rules |
| KE-CIRT/CC (Communications Authority's CIRT) | Cybersecurity incident with sector implications | Per CIRT MOU |
| MNO / PSP partners (Safaricom Daraja, Airtel Money, Pesalink, KCB Buni, Equity Eazzy) | Any incident affecting payment-rail integration | **≤ 1 h** (contractual) |
| Capital Markets Authority (CMA) | Incident affecting REIT manager client's operations | Via institutional client |
| Institutional landlord clients (REIT managers, pension funds, DFIs) | Any incident with their tenant or financial data exposed | **≤ 1 h** (contractual) |
| Affected data subjects (tenants) | High-risk PII breach (DPA s.43) | **≤ 72 h** |

## 6. Response phases (NIST 800-61r2)

Same as TZ pack:

- 6.1 Preparation (annual tabletop, quarterly drill, runbook library, pre-drafted comms)
- 6.2 Detection & analysis
- 6.3 Containment, eradication, recovery
- 6.4 Post-incident (5-whys, post-mortem within 5 business days, archive at `Docs/POSTMORTEMS/`)

## 7. Crisis comms templates

> TODO: insert pre-drafted KE-specific templates: tenant breach notification (sw / en), property-owner notification, ODPC notification, CBK / institutional-client notification.

## 8. AI-incident-specific playbook

Same as TZ pack (see `tz/07-incident-response.md` §8). Kenya-specific:

- Voice-agent dialect failure (Sheng / coastal Kiswahili) → escalate to human; queue improvement in adversarial corpus

## 9. Cross-references

- BCM / DR runbooks → doc 08
- Audit-trail evidence preservation → doc 10
- Existing post-mortem index → `Docs/POSTMORTEMS/`
