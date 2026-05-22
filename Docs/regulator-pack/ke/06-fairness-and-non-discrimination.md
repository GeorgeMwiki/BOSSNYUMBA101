# 06 — Fairness & Non-Discrimination (Kenya)

**Document version:** 1.0
**Date:** 2026-05-22
**Owner:** CRO + CCO
**Jurisdiction:** Kenya
**Frameworks:**
- Constitution of Kenya, 2010 (Article 27 — equality and freedom from discrimination)
- Landlord and Tenant (Shops, Hotels and Catering Establishments) Act (Cap. 301)
- Rent Restriction Act (Cap. 296)
- Persons with Disabilities Act 2003 (revised)
- HIV and AIDS Prevention and Control Act 2006 — explicit prohibition on discrimination in housing
- Sexual Offences Act 2006
- DPA 2019 s.35 — right not to be subject to automated decision
- EEOC "4/5ths rule" (29 CFR § 1607.4(D)) — adopted by analogy
- EU AI Act Title III — forward-looking reference
- ISO/IEC TR 24027:2021 — bias in AI systems

> **Distinguishing feature from TZ pack:** Kenya's HIV and AIDS Prevention and Control Act 2006 s.31 explicitly prohibits HIV-status-based discrimination in housing. BossNyumba does not collect health data; this is reinforced in the AI safety layer (`packages/ai-copilot/src/safety/`). Additionally, DPA s.35 creates a statutory right to human review of automated decisions.

---

## 1. Why non-discrimination matters in Kenyan property management

Kenyan property management has well-documented patterns of discrimination on tribal, religious, and ability-to-pay-cash-deposits grounds. The Article 27 list and Persons with Disabilities Act create a statutory baseline. The Landlord and Tenant Act + Rent Restriction Act create procedural safeguards. AI amplifies risk: training data reflects historic exclusions; opaque scoring cannot be challenged; voice-agent dialect coverage may default to dominant variants.

BossNyumba commits to fair treatment in three areas where AI directly influences tenant outcomes:

1. **Tenant onboarding / acceptance** — KYC, reference checks, predictive arrears risk
2. **Maintenance dispatch prioritisation** — SLA, vendor allocation, urgency scoring
3. **Communication tone & accessibility** — voice agent language defaults, escalation thresholds

## 2. Protected attributes (Kenya)

| Attribute | Source of risk | Statutory basis |
|---|---|---|
| Gender | Bias against women / female-headed households | Constitution Art. 27(4) |
| Pregnancy | Tenant turned away during pregnancy | Constitution Art. 27 |
| Age (≥ 18) | Bias against young or elderly tenants | Constitution Art. 27 |
| Disability | Bias against tenants needing adaptations | Persons with Disabilities Act 2003 |
| HIV status | Statutorily prohibited in housing | HIV and AIDS Prevention and Control Act 2006 s.31 |
| Health (any) | BossNyumba does not collect | Not processed |
| Ethnicity / tribe | Constitutional non-discrimination | Constitution Art. 27 |
| Religion | Constitutional non-discrimination | Constitution Art. 27 |
| Marital status | Bias against single / single-parent tenants | Constitution Art. 27 |
| Sexual orientation | High-risk in KE; constitutional protection contested but BossNyumba refuses to use | Constitution Art. 27; BossNyumba policy |
| Income source | Informal economy bias | Conduct risk; financial inclusion |
| Language / dialect | Sheng / coastal Kiswahili coverage | Constitution; conduct risk |

Source-of-truth: TODO — `packages/fairness/src/protected-attributes-ke.ts` (region overlay).

## 3. Fairness metrics

Same five metrics as TZ pack (see `tz/06-fairness-and-non-discrimination.md` §3): Disparate Impact Ratio (4/5ths), Equal Opportunity Difference, Demographic Parity Difference, Calibration Error, Counterfactual Fairness.

Critical violations → auto-rollback + model-risk incident.

## 4. Adverse-decision notice — bilingual template

DPA s.35 creates a right of human review on any automated decision. For any AI-influenced material adverse decision affecting a tenant, BossNyumba produces a notice in **English and Kiswahili** including the s.35 review CTA.

### English template

```
Notice of Decision — [Tenant name]
Date: [yyyy-mm-dd]    Reference: [REF-XXXXXX]
Landlord: [Property owner name]    On behalf of: [BossNyumba as decision-support]

Dear [Tenant name],

We have considered your [application / lease renewal / etc.] dated [yyyy-mm-dd].
[Decision: regret-decline / counter-offer / additional-conditions].

The principal reasons for this decision are:

  1. [Specific factor 1]
  2. [Specific factor 2]
  3. [Specific factor 3]

This decision was reached with the help of an automated system. Under Kenya's Data
Protection Act 2019 section 35, you have the right to:
  - Object to an automated decision and request a human review (within 7 days)
  - Receive a copy of the data we relied on
  - Provide additional information that may change the decision
  - Complain to the Office of the Data Protection Commissioner (ODPC)

To exercise your s.35 right, click the "Challenge this decision" button in the
BossNyumba app or contact [property-manager email].

The standards we apply are non-discriminatory: we do not consider your gender,
pregnancy, age, disability, HIV status, ethnicity, tribe, religion, marital
status, sexual orientation, language, or income source.

[Property manager name + signature]
```

### Kiswahili template

> TODO: complete Kiswahili translation; reference KE-Kiswahili reading-level target.

## 5. Property-management-specific fairness scenarios

Same scenarios as TZ pack with KE overlays:

| Scenario | KE risk overlay |
|---|---|
| **Tenant application screening** | Informal-economy bias particularly material in KE; predictive-interventions agent runs in KE-strict mode (stakes = high) |
| **Maintenance dispatch priority** | Nairobi-tier-1 vs. tier-2 / rural neighbourhoods; slice-level SLA monitoring |
| **Voice agent dialect** | Sheng + coastal Kiswahili must be in adversarial corpus |
| **Rent-pricing surveillance** | Rent Restriction Act applies to controlled tenancies; surveillance output must not push above the controlled rate |
| **Eviction-warning automation** | KE Landlord and Tenant Act creates procedural requirements (Form A notice, tribunal recourse); no auto-send |

## 6. Audit & monitoring

Same cadence as TZ pack. KE-specific:

- ODPC-aware quarterly fairness report
- Slice audit covers KE protected attributes (esp. HIV-non-collection verification — confirm zero records)

## 7. Tenant rights & redress

- In-app "Challenge a decision" button (statutory s.35 right)
- Property-manager human review within 7 days
- Escalation to BossNyumba DPO if review not satisfactory
- Escalation to ODPC (data protection) or Rent Restriction Tribunal / Business Premises Rent Tribunal (tenancy)

> TODO: insert KE quarterly fairness dashboard; insert sample s.35 challenge log.
