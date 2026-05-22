# 04 — AML / KYC / Tenant-Identity Controls (Tanzania)

**Document version:** 1.0
**Date:** 2026-05-22
**Owner:** Money Laundering Reporting Officer (MLRO)
**Jurisdiction:** Tanzania
**Statutes & guidance:**
- Anti-Money Laundering Act, 2006 (Cap. 423)
- Anti-Money Laundering Regulations, 2007 (regulation 29 retention)
- BoT/FIU Anti-Money Laundering Guidelines to Banking Institutions, Guideline No. 2 (March 2020 publication of original 2009 guidance)
- FATF Recommendations (40 + 9)
- Proceeds of Crime Act (Cap. 256)

> **Source PDF for FIU Guideline No. 2:** `https://www.bot.go.tz/Publications/Acts,%20Regulations,%20Circulars,%20Guidelines/Guidelines/en/2020031901533396.pdf`

---

## 1. Programme overview

BossNyumba is **not a financial institution** and does not hold AML obligations in its own name under the AML Act 2006. However, rent flows route through BoT-supervised MNOs and partner banks, and our institutional landlord clients (NHC, pension funds, DFIs) require AML-grade tenant-identity controls. Accordingly, BossNyumba:

1. Operates a **tenant-identity verification programme** that meets the CDD standards expected by partner MNOs and licensed PSPs.
2. Performs **sanctions + PEP screening** on tenants where rent ≥ threshold or where the property owner is an institutional client requiring it.
3. Produces **suspicious-activity output** (unusual rent patterns, structuring, third-party payments) routed to the property owner's MLRO for filing where appropriate.
4. Maintains its own internal AML programme covering corporate dealings, employees, and ML/sanctions risk in vendor relationships.

## 2. Tenant identity tiers (Know-Your-Tenant)

Default tiers; institutional landlords may tighten:

| Tier | Tenant profile | Required evidence | BossNyumba connector / control |
|---|---|---|---|
| **Tier 0 — Public browse** | Marketing-site visitor, public listing browse | None | Session cookie only; no PII collected |
| **Tier 1 — Lead (light)** | Pre-application, listing enquiry | Phone number + name | No NIDA yet; rate-limited |
| **Tier 2 — Standard KYC** | Residential lease, monthly rent < TZS 1.5M | National ID (NIDA), proof of address, employer letter or 3 months bank/mobile-money history | NIDA connector (`services/api-gateway/src/routes/tenants/onboarding/`), Smile Identity liveness, address evidence upload |
| **Tier 3 — Enhanced KYC** | Commercial lease, residential rent ≥ TZS 1.5M, multi-unit lease, corporate tenant | Tier 2 + source-of-funds, BRELA business registration (if corporate), beneficial-owner chain (>25%), references | All Tier 2 + PEP screening, sanctions screening, ownership graph |
| **Tier 4 — Politically exposed** | Tenant or BO is domestic / foreign / IO PEP | Tier 3 + senior-manager approval, source-of-wealth, ongoing monitoring | PEP service includes World-Check or equivalent feed |

## 3. Sanctions screening

| Source list | Scope | Frequency |
|---|---|---|
| UN Security Council Consolidated List | Global terror / proliferation | Real-time on onboarding; daily delta scan |
| OFAC SDN | US sanctions | Real-time; daily delta |
| EU Consolidated List | EU sanctions | Real-time; daily delta |
| UK HMT Consolidated List | UK sanctions | Real-time; daily delta |
| Tanzania domestic lists (FIU notices) | Tanzania-specific | Within 24 h of FIU notice |

Implementation: TODO — wire `services/compliance/src/sanctions-service.ts`. False-positive ratio reviewed monthly by MLRO.

## 4. Suspicious activity — rent-payment red flags

Property management is **lower AML risk** than consumer lending, but rent flows are a known laundering vector ("rent inflation", "ghost tenancy", "structuring through deposit overpayment"). The transaction-monitoring rule set:

- **Deposit overpayment** > 150% of rent (potential layering)
- **Round-number rent paid by unrelated third party**
- **Multi-MNO source-of-payment switching within single rent cycle**
- **Cash-out / refund pattern** (rent paid in, refund requested same week)
- **Rapid lease churn** (lease signed, terminated within 30 days, deposit retained or refunded irregularly)
- **Cross-border source-of-funds** from sanctioned jurisdiction (post-screen)

Alerts surfaced to:

1. The property owner's portal (visible to property manager + finance admin)
2. BossNyumba internal MLRO queue (for vendor / platform-level patterns)

The property owner's MLRO (if regulated) determines whether to file an STR with FIU; BossNyumba produces a structured packet ready for FIU standard format.

### STR workflow

```
Detection (rule + ML)    ──→  Property-mgr review   ──→  Owner MLRO triage
   │                                                          │
   ├── Auto-flagged structured                                ├──→  No filing (close + log)
   │   indicators:                                            │
   │   - deposit-overpay                                      ├──→  Internal SAR
   │   - third-party payer                                    │
   │   - multi-MNO switching                                  └──→  STR to FIU (within 24 h of MLRO sign-off)
   │   - rapid churn
```

Code: TODO — `services/compliance/src/aml-monitor/`. Audit-trail entries for every alert, triage decision and sign-off are written to the unified audit chain (doc 10) — hash-chained and tamper-evident.

## 5. Tipping-off prevention

FIU Guideline §8.0 prohibits tipping off. BossNyumba enforces this in two ways:

- **Role-based access control:** STR records are visible only to MLRO and designated AML team. Tenant-facing portals never show alert flags or MLRO notes.
- **Communication template lockdown:** templates available to property managers exclude AML-related language; the AI copilot's safety layer rejects requests to draft "explain why we filed a report" responses.

## 6. Record-keeping (regulation 29)

| Record | Retention | Storage |
|---|---|---|
| Tenant identification documents | 7 years from end of business relationship | Encrypted object storage; field-level encryption for ID number |
| Transaction records (rent + deposit ledger) | 7 years | `payments-ledger` service + audit chain |
| STR drafts + sign-offs | 7 years | Audit chain |
| Sanctions / PEP screen results | 7 years | Audit chain |
| MLRO training records | 5 years | HR system |

## 7. Training

| Role | Training | Cadence |
|---|---|---|
| All staff | AML / sanctions / data-protection awareness | Annual + on hire |
| MLRO | Specialist AML + FIU liaison | Annual |
| Property managers (institutional client side) | Tenant-identity red flags, tipping-off prevention | Annual + on onboarding |
| Engineers touching payments code | Secure handling, idempotency, log redaction | Annual + on team change |

> TODO: insert training-completion register snapshot.

## 8. Independent review

Annual independent AML audit by external firm; report to Board Audit Committee. First scheduled audit: Q4 2026 (post first full year of operation).

> TODO: insert audit scope memo and firm engagement letter.
