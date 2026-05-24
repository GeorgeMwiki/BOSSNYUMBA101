# Estate Department Advisor — SOTA 2026-05-24

The strategic "head of estate-department" advisor — reasoning at
the level of a 20-year veteran director of property operations.
Decides WHICH operations to run, HOW to staff them, WHEN to act
on signals, and HOW to position the department against industry
benchmarks. Distinct from `packages/estate-auto-management` (the
mechanical predictive-maintenance + RPA layer).

The thesis: most departments fail by doing the right tasks at the
wrong cadence, with the wrong head-count, against the wrong
benchmark. This advisor enforces the discipline a veteran director
applies before any tactical run-book fires.

---

## 1. Strategic portfolio management

### 1.1 Portfolio composition advisor

Authority: **CFA Institute** — *Real Estate Portfolio Management*
(2024), **NCREIF Property Index** sector weights, **PREA**
*Plan Sponsor Real Estate Investment Survey 2024*.

Target asset-mix bands for an institutional-grade balanced portfolio
(2024 NCREIF + PREA medians):

| Asset class      | Target % | Min  | Max  |
|------------------|----------|------|------|
| Multifamily      | 30 %     | 20 % | 40 % |
| Industrial       | 28 %     | 18 % | 38 % |
| Office           | 14 %     | 5 %  | 25 % |
| Retail           | 13 %     | 5 %  | 22 % |
| Hotel / niche    | 7 %      | 0 %  | 15 % |
| Mixed-use / land | 8 %      | 0 %  | 15 % |

For EA mid-size owners the practical bands shrink to {Residential,
Commercial, Mixed-use, Industrial}; we map onto those four.

### 1.2 Asset-cycle decision matrix (refurbish / hold / sell / convert)

Authority: **ULI** *Emerging Trends 2025*, **JLL** *Cost-of-Inertia
Study 2023*. Decision rule:

- **Sell** if `forwardIRR < holdingHurdle - 200 bps` AND
  `marketCapRate ≤ entryCapRate − 50 bps` (cap-rate compression
  realised) AND `taxBasis` doesn't trap value.
- **Refurbish** if `incrementalRefurbIRR ≥ holdingHurdle + 300 bps`
  AND `payback ≤ 5 yrs`.
- **Convert** if `bestAlternativeUseIRR ≥ holdingIRR + 500 bps`
  AND `zoningProbability ≥ 0.5`.
- **Hold** otherwise — *the default in absence of signal*.

### 1.3 Geographic concentration risk (HHI)

Herfindahl–Hirschman Index over property locations. Per **FFIEC**
concentration-risk guidance applied to RE: thresholds adapted from
banking concentration.

| HHI            | Risk level         | Action                           |
|----------------|--------------------|----------------------------------|
| < 1500         | Diversified        | None                             |
| 1500 – 2500    | Moderate           | Watchlist; cap further buys      |
| 2500 – 4000    | Concentrated       | Diversification plan in 24 mo    |
| > 4000         | Critically conc.   | Halt acquisitions in that geo    |

### 1.4 Tenant-mix optimisation

Authority: **ICSC** retail-mix research, **CBRE** *Office Lease
Maturity Wall 2025*. Three levers:

- **Covenant strength** — investment-grade tenants weighted
  150 %; un-rated SMEs 50 %; gov't 200 %.
- **Lease-roll laddering** — no single year should hold > 25 %
  of rent-roll roll-over (ICSC industry tolerance).
- **Anchor analysis** — single tenant > 35 % of revenue is a red
  flag; > 50 % triggers must-act diversification plan.

### 1.5 Capital allocation across portfolio (capex prioritisation matrix)

Per **BOMA** *Preventive Maintenance Guidebook* (2023) and
**IFMA**'s 5-tier urgency model. Score each capex line on:

- **Urgency** (1-5: regulatory ≥ life-safety ≥ revenue-critical ≥
  efficiency ≥ aesthetic)
- **Strategic fit** (0-1 dot product against owner intent)
- **IRR** (forward) — must clear hurdle

Composite = `0.45·urgency_n + 0.30·strategic + 0.25·IRR_n` per IFMA
calibration. Sort descending; budget cap applied top-down.

---

## 2. Operations excellence

### 2.1 BOMA EER benchmarking

Authority: **BOMA Experience Exchange Report 2024 Q4** — opex per
rentable square foot (RSF) by asset class + region.

Office (per RSF/yr, USD median, North-America 2024):

| Region         | Total opex | Cleaning | Utilities | R&M  |
|----------------|------------|----------|-----------|------|
| US Northeast   | 9.85       | 1.65     | 2.85      | 1.95 |
| US Midwest     | 8.40       | 1.40     | 2.45      | 1.75 |
| US South       | 7.85       | 1.30     | 2.30      | 1.65 |
| US West        | 9.20       | 1.55     | 2.65      | 1.85 |

For East-Africa we apply a 35 % cost-band shift (USD), per JLL
Africa 2024 cost-of-occupancy report.

EA-adjusted (per RSF/yr, USD):

| Market           | Total opex | Cleaning | Utilities | R&M  |
|------------------|------------|----------|-----------|------|
| Nairobi Grade A  | 5.10       | 0.95     | 1.70      | 1.05 |
| Dar Grade A      | 4.60       | 0.85     | 1.55      | 0.95 |
| Kampala Grade A  | 4.20       | 0.75     | 1.45      | 0.85 |
| Lagos Ikoyi VI   | 6.20       | 1.10     | 2.45      | 1.25 |

### 2.2 IREM Income/Expense Analysis

Authority: **IREM 2024 Income/Expense Analysis** — Multifamily.
Key ratios (US median):

| Ratio                      | Target | Caution | Action |
|----------------------------|--------|---------|--------|
| Operating expense ratio    | 38 %   | 45 %    | 55 %   |
| NOI margin                 | 58 %   | 50 %    | 42 %   |
| Vacancy & collection loss  | 7 %    | 10 %    | 14 %   |
| Maintenance per unit /yr   | $1,150 | $1,650  | $2,100 |

Peer-percentile positioning: P25 / P50 / P75 / P90 per ratio.

### 2.3 Operating-margin disaggregation

Veteran-director model: split opex into **Controllable** (R&M,
staffing, marketing, admin) vs **Uncontrollable** (utilities, RE
taxes, insurance, ground rent). Only act on controllable variances
> 10 %; uncontrollable variances feed forecast updates, not action.

### 2.4 Utility benchmarking

Authority: **ENERGY STAR Portfolio Manager** (US/CA), **NABERS**
(AU office), **GRESB-O 2024** (real-estate ESG). Targets:

- ENERGY STAR score ≥ 75 → top quartile
- NABERS 4.5 stars → market median; 5.5 stars → premium asset
- Site EUI for office: P25 = 55 kBtu/SF·yr, P50 = 75, P75 = 95
- Water UI for multifamily: 50 gal/SF·yr is the 2024 P25

### 2.5 Satisfaction benchmarking

Authority: **Kingsley Index** (multifamily / commercial tenant
satisfaction), **Trepp** tenant-survey averages.

Multifamily tenant-satisfaction 2024 P50:

| Index              | P50 score |
|--------------------|-----------|
| Overall            | 78        |
| Maintenance        | 76        |
| Communication      | 74        |
| Move-in experience | 81        |
| Renewal intent     | 60 %      |

---

## 3. Department org + staffing

### 3.1 Heads-per-door + heads-per-SF ratios

Authority: **IREM Property Manager Staffing Survey 2024**.
Multifamily PM-doors / FTE bands:

| Asset class        | Doors / PM-FTE | Doors / Maintenance-FTE |
|--------------------|----------------|--------------------------|
| Garden multifamily | 110 – 140      | 80 – 100                 |
| Mid-rise           | 80 – 110       | 60 – 80                  |
| High-rise / luxury | 55 – 80        | 40 – 55                  |
| Affordable / LIHTC | 130 – 170      | 90 – 110                 |

Office (SF / FTE):

| Class | SF / PM-FTE     | SF / Maintenance-FTE |
|-------|-----------------|----------------------|
| A     | 250k – 350k     | 100k – 150k          |
| B     | 350k – 500k     | 150k – 220k          |
| C     | 500k – 700k     | 200k – 300k          |

### 3.2 Span-of-control limits

Per **Deloitte** *Real-Estate Org Design 2023* and **BOMA**
*Manager-to-Direct-Report Standards*:

| Role                | Max direct reports |
|---------------------|--------------------|
| Property manager    | 8 (operational)    |
| Senior PM           | 6 (PMs)            |
| Asset manager       | 12 (properties)    |
| Director of ops     | 7 (senior PMs)     |
| Leasing manager     | 10 (agents)        |
| Accounting manager  | 6 (analysts)       |

### 3.3 In-house vs outsource decision matrix

Six categories. Decision rule per BOMA / IFMA studies and
**Cushman & Wakefield** *Outsourcing Benchmark 2023*:

| Function     | In-source if                  | Outsource if                |
|--------------|-------------------------------|-----------------------------|
| Legal        | > 50 hrs/wk legal volume      | else                        |
| Maintenance  | > 200 doors / 200k SF + 24x7  | < 100 doors                 |
| Leasing      | > 500 doors + brand-critical  | sub-200 doors               |
| Accounting   | > $50M GAV portfolio          | else                        |
| IT           | > 250 endpoints OR PII heavy  | else                        |
| Janitorial   | luxury / hospital-grade only  | default outsource           |

### 3.4 Career-progression ladders

PM Associate → PM → Senior PM → Regional PM → Director Ops →
VP Ops. Median tenure per rung 2.5 yrs (CEL 2024). Step jumps
without 2.0 yr tenure correlate with 1.6× attrition.

### 3.5 Compensation benchmarking

Authority: **CEL & Associates Real Estate Compensation Survey 2024**.
US base-salary medians (USD):

| Role                  | Base P25  | Base P50  | Base P75  | Bonus % |
|-----------------------|-----------|-----------|-----------|---------|
| Property Manager      | 65k       | 85k       | 110k      | 12 %    |
| Senior PM             | 95k       | 120k      | 155k      | 18 %    |
| Regional PM           | 130k      | 165k      | 210k      | 22 %    |
| Director of Ops       | 165k      | 215k      | 280k      | 28 %    |
| Asset Manager         | 110k      | 145k      | 195k      | 25 %    |
| Leasing Agent         | 45k       | 60k       | 80k       | comm.   |
| Accounting Manager    | 90k       | 115k      | 145k      | 15 %    |

EA adjustments — apply 0.45× factor for Nairobi/Dar/Kampala,
0.55× for Lagos VI/Ikoyi, per Korn Ferry EA 2024 RE comp study.

---

## 4. Vendor portfolio strategy

### 4.1 Concentration risk

Single-vendor spend cap = **25 %** of any category (per **Gartner**
sourcing best-practice + **Procurement Leaders** 2024 RE survey).
Above 25 % requires documented continuity plan; above 40 %
mandates active second-source RFP within 6 months.

### 4.2 Contract structure decision matrix

| Spend type     | Structure                                 |
|----------------|-------------------------------------------|
| Janitorial     | Fixed-bid + KPI clawback                  |
| Landscaping    | Fixed-bid seasonal                        |
| HVAC > 50k     | Performance-based + warranty handoff      |
| Plumbing       | T&M with capped hourly                    |
| Major capex    | Lump-sum competitive bid w/ retainage     |
| Legal          | Hourly + matter-cap; alternative fees     |
| Security       | Fixed monthly + per-incident surcharge    |

### 4.3 Vendor KPIs

- **Response time** P50 (per category SLA)
- **First-time fix rate** ≥ 75 % (CMMS industry standard)
- **Cost variance** vs PO ≤ 8 %
- **Quality score** (post-job inspection) ≥ 4.0 / 5.0

### 4.4 Strategic sourcing waves

Cadence:
- Annual: janitorial, landscaping, supplies
- Bi-annual: HVAC, plumbing, electrical
- 3-year: insurance, payroll, banking
- 5-year: major IT systems / PMS

---

## 5. Risk + insurance

### 5.1 Coverage adequacy advisor (10 axes)

Per **NAREIM** *Real-Estate Risk Management Guidebook 2023* and
**Marsh** *Global Insurance Market 2024 Q4*:

1. All-risk property (replacement cost, not ACV)
2. Business interruption (12 mo + 30-day extension)
3. Ordinance & law (Coverage A + B + C)
4. Equipment breakdown
5. General liability ($1M / $2M minimum)
6. Umbrella ($10M floor for portfolios > 100 units)
7. Cyber ($5M floor; rising 35 %/yr)
8. EPLI (employment practices) — > 25 employees mandatory
9. D&O — for entities with external investors
10. Terrorism (TRIA in US; equivalent UK Pool Re; EA: optional)

### 5.2 Deductible optimisation

Per Marsh 2024 deductible-tuning study:
- Per-incident deductibles: $10k-$25k optimum for owners < $50M GAV
- Aggregate deductibles: best for portfolios > $200M GAV
- Self-insured retention only with cash > 3× expected losses

### 5.3 Self-insurance threshold

Captive insurance economically rational when:
- Portfolio GAV > $500M
- Annual premium spend > $2M
- Predictable loss history (5 yrs)
- Regulatory / tax jurisdiction allows captive

### 5.4 Catastrophe modelling

Authority: **RMS** *RiskLink*, **AIR Worldwide** *Touchstone*.
EA exposures:
- Floods (Kibera, Mathare, Korogocho — Nairobi)
- Earthquakes (East-African Rift Zone — 2.0 EM events / decade)
- Civil unrest (post-election, recurring)

---

## 6. Tax + structure

### 6.1 Cost segregation depreciation acceleration

Authority: **ASCSP** (American Society of Cost Segregation Professionals)
2023 study. Typical reclassification:
- 5-yr life: 15-25 % of basis (carpet, cabinetry, FF&E)
- 7-yr life: 5-10 % (signage, certain equipment)
- 15-yr life: 8-15 % (site improvements, landscaping)

NPV of acceleration on $5M building ~ $400k at 8 % discount.

### 6.2 1031 exchange opportunity (US only)

Per IRC §1031: like-kind, 45-day ID, 180-day close. Stub for EA;
flag jurisdictional equivalent — *Tanzania* (Land Act 1999 §134
permits roll-over within 24 mo for development sites) and *Kenya*
(no direct equivalent; rely on subdivision-rollover under Land
Registration Act 2012).

### 6.3 Property tax appeal advisor

Per-jurisdiction filing windows:

| Jurisdiction      | Window         | Authority                  |
|-------------------|----------------|----------------------------|
| US (typical)      | 30-45 d post-assessment | County assessor       |
| Kenya             | 30 d (Rating Act 2019 §17) | County govt        |
| Tanzania          | 30 d (Local Govt Act 1982) | Local council      |
| Uganda            | 60 d (Local Govt Rating Act 2005) | LG council  |
| Rwanda            | 30 d (Law 75/2018 §52)     | RRA                |
| South Africa      | 30 d (MPRA 2004)           | Municipal valuer   |
| Nigeria           | 30 d (Land Use Charge Law) | LG / state         |

Appeal triggers: assessed value > comp median + 15 %.

### 6.4 Structure advisor (REIT vs traditional vs LLC)

| Structure  | Best for                              | Tax treatment           |
|------------|---------------------------------------|-------------------------|
| C-Corp     | Operating biz w/ < 50 % RE income     | Double-tax              |
| LLC        | Single-asset; flexible governance     | Pass-through            |
| REIT       | Portfolio > $250M; institutional cap  | 90 % distribution rule  |
| Trust      | Estate planning / generational hold   | Settlor/beneficiary mix |
| GP/LP      | Co-investor projects                  | Pass-through w/ promote |

EA equivalents:
- *Kenya REIT* (CMA-regulated; D-REIT, I-REIT, P-REIT classes)
- *Tanzania REITs* (CMSA-registered, 5 since 2021)
- *Nigeria REIT* (SEC Nigeria; 4 listed)

---

## 7. Owner relations

### 7.1 Communication-pattern playbook — 8 owner archetypes

Per **NAR Institute of Real Estate Management** owner-comm
research + **CFA Institute** investor-comm best practice:

| Archetype                  | Asks                          | Needs to hear                       | Cadence       |
|----------------------------|-------------------------------|--------------------------------------|---------------|
| Cashflow-first             | "What's my distribution?"     | Net cash, distribution forecast      | Monthly       |
| Growth (acquisitive)       | "What's next deal?"           | Pipeline, capital available          | Bi-weekly     |
| Exit-prep                  | "What's NAV?"                 | NAV, comp transactions, marketing    | Monthly + ad-hoc |
| Preservation (legacy)      | "Is it safe?"                 | Compliance, insurance, deferred-mtn  | Quarterly     |
| Institutional              | "Show me the data"            | Full reporting package, IRR, equity-MV | Quarterly + audited annual |
| Passive landlord (1-3 ass) | "Is rent paid?"               | Occupancy, arrears, big-ticket items | Monthly       |
| Active investor (broker)   | "Where's the alpha?"          | Market trends, deal flow, leverage   | Weekly        |
| Distressed / forced-sale   | "What's the exit?"            | Marketing plan, broker pkg, timeline | Weekly        |

### 7.2 Reporting frequency advisor

Maps archetype → cadence above + special triggers (covenant
breach, major loss, lawsuit → immediate notification within 24 h
per CFA Institute Code §V(A)).

### 7.3 Distribution policy (frequency + smoothing)

Per **NAREIT** REIT distribution practice + **PERE** private-fund
study:
- Quarterly distribution is institutional standard
- Smoothing rule: distribution targets P50 of trailing 4 quarters
- Special distributions for refi / sale events
- Reserve cap: 6 mo opex + scheduled capex before distribution

### 7.4 Crisis communication templates (6 incident types)

Per **PRSA** crisis-comm playbook + **NAREIM** RE-specific
templates:

1. **Default / foreclosure** — workout plan first, transparent timeline
2. **Lawsuit** — counsel-vetted; never speculate on outcome
3. **Major repair** (> 5 % asset value) — cost, timeline, insurance recovery
4. **Tenant death / incident** — empathy first, legal second
5. **Fraud / embezzlement** — forensic engagement before disclosure
6. **Regulatory action** — full timeline, remediation plan, attorney coordination

---

## 8. Tenant strategy

### 8.1 Acquisition vs retention economics

Per **NMHC** *Resident Survey 2024* + **JTurner** retention study:
- Acquisition cost (CAC): $1,200-$2,500 per unit (US multifamily 2024)
- Retention concession value: $500-$1,200 per renewal
- Break-even retention period: 8.5 months of tenancy
- Industry rule: $1 retention spend = $4-$7 acquisition cost

### 8.2 Concession-vs-upgrade-vs-amenity ranking

Per **JTurner** 2024 retention study, per $ effectiveness:

| Lever                    | $ Effect / $ spent | Notes                |
|--------------------------|---------------------|----------------------|
| Rent reduction           | 1.8 – 2.4           | Lasts only as long as offered |
| Smart-home upgrade       | 2.2 – 3.1           | One-time spend, durable      |
| In-unit washer/dryer     | 3.5 – 4.8           | Highest ROI upgrade          |
| Reserved parking         | 2.0 – 2.8           | Where parking is scarce      |
| Free Wi-Fi               | 1.5 – 2.2           | Now table-stakes             |
| Gym / pool refresh       | 1.2 – 1.8           | Aging amenities hurt more    |
| Resident events          | 0.9 – 1.4           | Social fit; soft signal      |

### 8.3 Demographic-fit scoring

Per **HUD** demographic guidelines + **Zillow** rent-burden study:
- Income / rent ratio target: 3.0+ (rent-burdened if < 2.5)
- Household composition (single / couple / family) vs unit-mix
- Stage-of-life vs amenity-mix (gym vs playground)
- Distance-to-work commute < 30 min target

### 8.4 Move-in / move-out friction

Per **NMHC** friction-reduction research:
- Move-in: digital lease (8-hr saved); pre-arrival walkthrough vid
- Move-out: 60-day notice digital portal; auto-deposit return < 14 d (TX, CA) / < 21 d (KE)

---

## 9. Crisis + incident playbooks

Eight incident types, each with triage matrix + first-72-hour
actions + 30-day recovery + post-mortem.

Per **PRSA** crisis-comm + **BOMA** *Emergency Preparedness Guide
2023* + **NIMS** Incident Command for property events.

| Incident          | First 72 hr critical actions                       |
|-------------------|----------------------------------------------------|
| Fire              | Fire-marshal, insurer, tenant comms, alt housing   |
| Flood             | Water-stop, dehumidify, mold-remediation pkg       |
| Eviction (mass)   | Notice service, sheriff scheduling, comms cadence  |
| Lawsuit served    | Counsel, insurer notify, document hold, no comm    |
| Loan default      | Lender meeting, workout package, equity call       |
| Fraud discovered  | Forensic accountant, freeze, insurer, AG notice    |
| Ransomware        | IR firm, isolate, backup restore, breach counsel   |
| Employee misconduct | Suspend, investigate, HR + legal, terminate path |

Post-mortem template per **Atlassian** *Incident Management Handbook*
(open-source) — adapted for RE: trigger, response timeline,
root-cause (5-whys), customer/tenant impact, financial impact,
action items + owner.

---

## 10. Regulatory calendar

Per-jurisdiction filing windows (TZ, KE, UG, NG, RW, ZA):

### Kenya
- Property rates: Jan 1 — May 1 (Rating Act 2019)
- NEMA (NEEAP) self-audit: Mar 31 annual
- ICPAK financials: 6 mo post-year-end
- KRA rental-income (10 % monthly): 20th of month
- Land-rent: Apr 1 deadline (Lands Act 2012)

### Tanzania
- Property tax (TRA): Jul 1 — Aug 31 (Local Govt Finance Act 1982)
- NEMC EIA refresh: as triggered (5-yr cycle for commercial)
- ICPA Tanzania financials: 6 mo post-year-end
- NSSF: 7th of month; LST: 7th of month
- Land lease renewal: per certificate (33/66/99 yr)

### Uganda
- Property rates (Local Govt Rating Act 2005): Jul-Sep
- NEMA EIA renewal: 3-5 yr cycle
- ICPAU financials: 6 mo post-year-end
- URA rental tax: 20th of following month
- Ground rent: anniversary of land title

### Nigeria
- Land Use Charge: Jul-Dec annually (LASG); state-variable
- FIRS rental withholding (10 %): monthly 21st
- NESREA env. audit: 5-yr cycle
- ICAN financials: 6 mo post-year-end
- Tenement rates: state-level varies

### Rwanda
- Property tax (RRA): Mar 31 (Law 75/2018)
- REMA EIA: as triggered
- ICPAR financials: 6 mo post-year-end
- Rental income tax: 15th of following month

### South Africa
- Municipal rates: monthly (MPRA 2004 valuation roll cycle)
- SARS rental income: tax-year filing
- SAICA financials: 6 mo post-year-end
- DEA environmental audit: per EIA cycle

### Estate-specific cross-cutting
- ICPAK / ICPA (KE/TZ) — accounting standards updates
- TRA, KRA, URA, FIRS — tax cycles
- NEMA (KE), NEMC (TZ), NEMA (UG), NESREA (NG), REMA (RW), DEA (ZA) — env

---

## 11. Composition: Department Health Report

Composer logic: given a `PortfolioSnapshot` (properties, tenants,
financials, staffing, vendors, insurance, jurisdiction), produce
multi-section report:

1. **Headline** — 3-bullet "what a veteran director would say"
2. **Portfolio health** — composition vs target bands; HHI; lease-roll ladder
3. **Operations excellence** — BOMA + IREM percentile; opex gap analysis
4. **Staffing** — ratio gaps; span-of-control flags; comp drift
5. **Vendors** — concentration risk; KPI breaches; RFP-due
6. **Risk** — coverage gaps; deductible mis-optimization
7. **Tax** — open opportunities; appeal windows due
8. **Owner relations** — comm cadence drift; reporting gaps
9. **Tenant strategy** — retention spend vs CAC; lever effectiveness
10. **Crisis readiness** — playbook freshness; tabletop overdue
11. **Compliance** — calendar gaps; filings due in 30/60/90

Each section ranks recommendations by MCDA:
`composite = 0.45·strategic + 0.30·IRR + 0.25·urgency`.

Final priority list: top-5 with citations, IRR/cost estimates,
owners assigned, due-by.

---

## 12. Citations (key sources)

- BOMA Experience Exchange Report 2024 Q4
- IREM 2024 Income/Expense Analysis (Multifamily)
- IREM Property Manager Staffing Survey 2024
- CEL & Associates Real Estate Compensation Survey 2024
- NCREIF Property Index 2024 Q4
- PREA Plan Sponsor Investment Survey 2024
- ULI Emerging Trends in Real Estate 2025
- Appraisal Institute *Appraisal of Real Estate* 15th ed.
- CFA Institute Real Estate Portfolio Management 2024
- NAREIM Real-Estate Risk Management Guidebook 2023
- Marsh Global Insurance Market 2024 Q4
- ASCSP Cost-Segregation 2023 Study
- ENERGY STAR Portfolio Manager
- NABERS office rating (AU)
- GRESB-O 2024
- Kingsley Index tenant satisfaction (2024)
- JTurner retention research 2024
- NMHC Resident Survey 2024
- PRSA Crisis Communications Playbook
- BOMA Emergency Preparedness Guide 2023
- Atlassian Incident Management Handbook
- JLL Africa H1/H2 2024 cost-of-occupancy reports
- Knight Frank East Africa 2024
- Kenya Rating Act 2019; Tanzania Local Govt Finance Act 1982
- Uganda Local Govt Rating Act 2005; Rwanda Law 75/2018
- South Africa MPRA 2004; Nigeria Land Use Charge Law (state)
