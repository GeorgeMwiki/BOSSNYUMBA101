# Acquisition Advisor — SOTA 2026-05-24

The strategic "head of acquisitions" advisor — reasoning at the level
of a 20-year veteran director of acquisitions at Carmel Partners,
Greystar, SL Green, or Tishman Speyer. Composes deal sourcing,
comp-sale triangulation, LOI / PSA risk scoring, environmental DD,
title DD, survey DD, zoning + entitlement DD, geotechnical DD,
financial DD, title-insurance endorsements, and East-Africa
jurisdictional checks into a defensible go/no-go acquisition
recommendation.

The thesis: most acquisition mistakes happen *before* the deal is
papered — wrong comps, missed Phase-I REC, missed schedule-B
exception, unscored ancestral-claim risk, sloppy T-12 reconciliation.
A veteran director enforces the discipline below before any IC
memo is drafted.

Distinct from `packages/expansion-advisor` (which composes HBU /
absorption / capital stack for a parcel under owner's control); this
package operates on parcels under *negotiation* and on data the
seller controls.

---

## 1. Deal sourcing channels

### 1.1 Broker-network scoring

Authority: **NMHC** *Broker Cooperation Study 2024*, **ALN**
*Marketed-vs-Pocket Trade Velocity* (2024), **CBRE** *Capital
Markets Talent Report 2024*. Heuristics:

- **Closing ratio**: deals closed / deals exclusively listed in the
  trailing 24 months. Tier-1 institutional brokers (CBRE / JLL /
  Cushman / Eastdil / Newmark) median 0.62; Tier-2 regionals 0.41;
  in EA, Knight Frank Kenya / HassConsult / Pam Golding / Knight
  Frank Tanzania / Knight Frank Uganda median 0.36.
- **Time-to-list-to-close**: median 142 days institutional, 198 days
  regional. EA median 240 days for ≥ USD 5 M trades (Knight Frank
  *Africa Capital Markets Q4 2024*).
- **Repricing rate**: how often listing price reduces > 5 % during
  marketing. Tier-1: 0.18; Tier-2: 0.31; EA: 0.42. Higher rate =
  worse comp-pricing instincts.
- **Buyer-pool depth**: median number of executed CAs per listing.
  Tier-1 institutional 38; regional 14; EA 8.
- **Off-market access**: share of last 24 mo closed deals that
  *never went to BOV*. Tier-1 0.41 (Eastdil), EA 0.27.

Composite broker score (0-100):
`0.30·closeRatio_n + 0.20·daysToClose_n + 0.15·repricingInverse_n +
0.20·poolDepth_n + 0.15·offMarketShare_n`.

### 1.2 Off-market trigger mining

Authority: **PERE** *Off-Market Origination Study 2024*, **REBNY**
*Distressed Asset Brief 2024 Q4*. Six trigger families:

| Trigger             | Signal source                       | Lead time | Conversion |
|---------------------|-------------------------------------|-----------|------------|
| Probate filing      | County clerk / KE LRO probate       | 3-9 mo    | 0.18       |
| Foreclosure NOD     | County recorder / KE auctioneers    | 1-4 mo    | 0.31       |
| Tax-lien delinquent | County tax / KE LSK rates ledger    | 6-24 mo   | 0.12       |
| Code-violation      | DOB / KE NCC enforcement orders     | 3-12 mo   | 0.08       |
| Loan-maturity wall  | CMBS Trepp + bank syndication       | 6-18 mo   | 0.22       |
| Divorce filing      | Family court / KE Children's Court  | 4-12 mo   | 0.06       |

Per **Trepp** *CMBS Wall of Maturities 2025-2027* — US institutional
trigger. EA equivalent: Central Bank of Kenya *Bank Supervision
Annual Report 2024* — concentration of mortgage maturities by
quarter.

### 1.3 Pocket-listing networks

Authority: **NAR** *Pocket Listing Survey 2024*. Three formal
networks materially relevant to institutional acquirers:

- **Top Agent Network (TAN)** — verified by NAR; participating
  member must hold ≥ 1 active exclusive listing every 6 months.
- **Pocket Listing Service (PLS)** — broker-led, US-coastal heavy.
- **REBNY Listing Exchange** — Manhattan-specific; 24-h public-
  listing rule kept off-market filings to a 0.4 % share of trades.

EA: **Pam Golding Property Connect** + **Knight Frank Private
Office** (HNW family-office circles). Acquisition team should
build a CRM of named principals + RM relationships, not rely on
formal networks alone.

### 1.4 Owner-direct outreach automation

Authority: **CB Insights** *Multifamily Direct-Acquisition Stack
2024*, **PERE** *Off-Market Origination*. Outreach templates by
owner archetype:

| Owner archetype          | Pain point                  | Hook                             |
|--------------------------|-----------------------------|----------------------------------|
| Aging boutique landlord  | Estate / succession         | Cap-gains-deferred 1031          |
| Family-office gen-3      | Concentration risk          | Liquidity + diversification      |
| Distressed sponsor       | Maturity wall               | Loan-assumption proposal         |
| Out-of-state heir        | Management headache         | Off-market simple-close          |
| Capital-stack-tired GP   | Re-cap need                 | Pref-equity / GP-LP roll         |
| EA generational family   | Land-title clean-up         | Joint-venture upgrade            |

Per **HubSpot** *Real-Estate Outbound Benchmark 2024* — direct-mail
response 1.4 %, email 0.7 %, hand-written-letter 4.2 %. EA: WhatsApp
broadcast 6.8 % response (HassConsult internal data 2024).

---

## 2. Comp-sales triangulation

### 2.1 Data sources by tier

Authority list:

- **RealCapital Analytics / MSCI Real Capital** — institutional,
  ≥ USD 2.5 M trades, global; the gold standard for cap-rate comps.
- **Trepp** — CMBS issuance + cap-rate database; granular.
- **CompStak** — crowd-sourced lease comps; rent-comp triangulation.
- **Cushman MarketBeat** — quarterly cap-rate, vacancy, rent.
- **CBRE Cap Rate Survey H2 2024** — H1/H2 cap-rate by asset class
  / market / Class.
- **JLL Investment Outlook Q4 2024** — capital flows + bid-ask spread.
- **Knight Frank Wealth Report 2024** — global luxury benchmarks.
- **Knight Frank Africa Capital Markets Q4 2024** — EA cap-rate set.
- **HassConsult Property Index** — Kenya residential comp set.
- **Africa Property News** — distressed + auction trades.

### 2.2 Triangulation method (CBRE / Cushman / JLL canon)

1. **Filter**: asset class, sub-market, max-distance (1600 m urban,
   8000 m suburban), max-months-ago (18), size-tolerance ±25 %.
2. **Adjust** each comp for:
   - Time (escalation per HassConsult / RCA YoY rate)
   - Condition (Class A vs Class B; mid-life-cycle vs new)
   - Location (corridor quality; 0.85x for B-corridor)
   - Financing (cap-rate adjust if seller-financed)
   - Lease-up (in-place vs marked-to-market; stabilised vs lease-up)
3. **Outlier drop**: Tukey IQR 1.5x on adjusted $/sqm.
4. **Weight** surviving comps: 0.50 recency + 0.30 distance + 0.20
   quality similarity.
5. **Return**: weighted median, ± 1σ CI, confidence score.

### 2.3 Cap-rate derivative from comp set

Cap rate `r = NOI / Price`. From a comp set with `n` trades:
- Implied cap-rate trimmed-mean (drop top/bottom 10 %).
- Spread to 10-yr Treasury (or 10-yr KE / TZ / UG gov bond) for
  cap-rate-spread compression cycle marker.
- **Carmel Partners rule of thumb**: never underwrite an exit
  cap-rate tighter than entry + 25 bps. We enforce this as a
  hard rule in `underwriting/exit-cap-floor.ts` (cross-package).

### 2.4 Rent-comp triangulation

Same algorithm as sale triangulation, but on lease comps.
**CompStak** is the institutional source; for EA we triangulate
from **Knight Frank** + **Broll** + **HassConsult** rent series.
Anchor-tenant rents are private — proxy via percentage-of-NRA
weighted median of comp-set tenants of similar credit profile.

---

## 3. LOI + PSA risk scoring

### 3.1 LOI 25-axis checklist

Canonical clauses every binding-LOI must address. Each scored 0-5
(0 = unaddressed; 5 = fully buyer-protective):

1. Purchase price (precision, escalators if applicable)
2. Earnest money (size, escrow agent, hard date)
3. Due-diligence period length (30 / 60 / 90 days)
4. DD extension rights (one 30-day pull at buyer's option)
5. Financing contingency (yes/no/cap)
6. Title commitment delivery deadline
7. Survey delivery deadline (ALTA / NSPS 2021)
8. Estoppels delivery + qualification ("knowledge")
9. SNDA delivery
10. Service-contract assignment + cancellation rights
11. Casualty / condemnation thresholds (5 % / 10 % rule)
12. Environmental indemnity scope
13. Rep-and-warranty survival (12 vs 18 vs 24 mo)
14. Cap on R&W liability (typically 1-3 % of price)
15. Closing date + window for buyer extension
16. Prorations baseline (cut-off at midnight closing day)
17. Closing-cost allocation (transfer tax, recording, escrow)
18. Brokerage commissions (who pays, indemnity)
19. Seller representations (operating-statement accuracy)
20. Operating-period covenants (no new leases > 12 mo)
21. Right-of-first-offer / right-of-refusal carve-outs
22. Confidentiality / NDA cross-reference
23. Exclusivity period (no-shop)
24. 1031-cooperation language (US) / land-bank cooperation (EA)
25. Governing law + venue + arbitration

Authority: **ABA Real Property Section** *Model PSA 2024*,
**Pircher Nichols & Meeks** *Acquisition Counsel Templates 2024*,
**Eversheds Sutherland Africa** *EA Deal Mechanics 2024*.

LOI score = sum / 125. Score < 0.65 = "re-draft before
counter-sign". Score < 0.45 = "do not counter-sign".

### 3.2 PSA clause flagger — 30 canonical clauses

Beyond LOI, the PSA layers in:

26. Title-objection mechanic (Notice / Cure / Buyer Termination)
27. Permitted exceptions list
28. Survey-objection mechanic
29. Operating-statement audit right (T-12 + T-3 + budget)
30. Service-contract schedule (terminable on ≤ 30-day notice)
31. Personal-property schedule (FF&E, vehicles)
32. Intangible-property assignment (websites, social, leads DB)
33. Tenant deposit transfer mechanic
34. Prepaid-rent transfer
35. Tax-proration cut-off (calendar vs fiscal)
36. Utility transfer + final-bill responsibility
37. Insurance transfer / new placement before close
38. Lender-required side-letters (assumed loans)
39. Loan-assumption fee allocation
40. Defeasance / yield-maintenance allocation
41. Casualty trigger (the "5 % rule" or material-AML)
42. Condemnation trigger + treatment of proceeds
43. Hazard insurance maintenance covenant
44. Rep-and-warranty insurance (RWI) procurement
45. Indemnification baskets / deductibles
46. Holdback / escrow for post-closing repairs
47. Brokers' lien waivers
48. Construction-warranty assignment
49. Roof / HVAC warranty assignment
50. Soils-report disclosure
51. Mold / moisture disclosure
52. Lead-based-paint disclosure (US: pre-1978 builds)
53. Asbestos disclosure
54. Radon disclosure
55. Mello-Roos / special-tax-district disclosure (CA-specific)

EA additions:
56. Spousal-consent disclosure (KE Matrimonial Property Act 2013)
57. Family-protection-trust disclosure (TZ Family Law 1971)
58. Customary-land-tenure release (UG Land Act 1998)
59. Ancestral-claim release (notarised village-elder attestation)

### 3.3 Casualty + condemnation modeler

The **5 % rule** (industry standard): casualty > 5 % of value =
buyer can terminate; ≤ 5 % = seller restores from insurance
proceeds + deposits credit. **Pircher Nichols** template uses
hard-dollar floor (USD 250 k or 5 %, *whichever lower*).

Condemnation: any partial = full buyer-termination right per
ULI 2024 Acquisition Counsel guidance. For EA, **Tanzania Land
Acquisition Act 1967** + **Kenya Land Acquisition Act 2012** §107
permit government expropriation with compensation; PSA must
allocate proceeds.

---

## 4. Environmental DD

### 4.1 Phase I ESA (ASTM E1527-21)

Authority: **ASTM E1527-21** — *Standard Practice for Environmental
Site Assessments* (current standard since Feb 2023 supersedes
E1527-13). **EPA AAI Rule 40 CFR Part 312** — All Appropriate
Inquiries.

Phase I scope:
1. Records review (regulatory database, historical use)
2. Site reconnaissance (visual inspection)
3. Interviews (current + past owner, occupant, gov't)
4. User-provided info (title, deed restrictions, env-liens)
5. Report with REC identification

**RECs** = recognized environmental conditions. New 2021 additions:
- **Historical REC (HREC)** — past release, regulatory closure with
  unrestricted use (clean closure).
- **Controlled REC (CREC)** — past release, regulatory closure
  with use restrictions (deed restriction, AUL).
- **REC** — current or past unaddressed release.

E1527-21 changes from E1527-13:
- Standard search distance extended for some databases.
- "Emerging contaminants" (PFAS, etc.) now optional but recommended.
- Recommended Significant Data Gap language clarified.
- Photographic documentation required.
- Site-reconnaissance documentation more rigorous.

### 4.2 Phase II (ASTM E1903-19)

Triggered when Phase I identifies a REC needing media-sampling
confirmation. E1903-19 prescribes:
- Sampling design (judgmental + systematic grids)
- QA/QC (chain-of-custody, blanks, duplicates, MS/MSD)
- Lab methods (EPA SW-846 for solids; CWA Part 136 for water)
- Risk-based screening levels (EPA RSLs)

Cost order: USD 8 k - 35 k typical; large industrial 100 k+.

### 4.3 Vapor intrusion (ASTM E2600-15)

For chlorinated-solvent or petroleum impacts: VI assessment per
**E2600-15** *Standard Guide for Vapor Encroachment Screening*.
Triggers: TCE, PCE, BTEX, naphthalene plumes within 100 ft of
building footprint. Mitigation: sub-slab depressurization (SSD),
typical capital cost USD 8-25 k per building.

### 4.4 HBM / lead / asbestos / PCB

- **Lead-based paint** — pre-1978 buildings, US HUD/EPA RRP Rule.
- **Asbestos-containing materials (ACM)** — Cal-OSHA / OSHA 1910.1001
  pre-1980 buildings standard practice. EA: rarely surveyed; assume
  presence in pre-1990 EA commercial structures.
- **PCB** — pre-1979 transformers, ballasts. TSCA Section 6(e).
- **Radon** — EPA action level 4 pCi/L.
- **Mold** — IICRC S520 standard.

### 4.5 Phase II trigger logic

We codify the trigger:
- REC noted in Phase I → Phase II almost always.
- CREC with active deed restriction → Phase II to confirm restriction.
- HREC alone → Phase II optional (insurance carrier may require).
- Suspect ACM/LBP → ACM/LBP-specific O&M plan or survey.

### 4.6 EA jurisdictional environmental

- **Kenya**: NEMA EIA Regulations 2003 — any project on land
  ≥ 0.5 ha or industrial use requires EIA Project Report. NEMA
  *Strategic Environmental Assessment Guidelines 2023* for
  large mixed-use.
- **Tanzania**: NEMC EIA Audit & Regulations 2018 — similar
  thresholds.
- **Uganda**: NEMA Uganda EIA Regulations 2020.

---

## 5. Title DD

### 5.1 ALTA 2021 Commitment

Authority: **ALTA Title Insurance Forms Committee** *2021 Commitment
for Title Insurance* (06-17-06 supersedes 2006 form).

Four schedules:
- **Schedule A** — proposed insured, estate, legal description,
  proposed policy
- **Schedule B-I** — Requirements (deeds to be delivered,
  satisfactions to be filed, surveys, etc.)
- **Schedule B-II** — Exceptions (matters the policy will NOT
  cover; the killer schedule)
- **Standard exceptions** — survey exception, mechanics-lien
  exception, parties-in-possession exception (deletable with
  ALTA survey + owner's affidavit)

### 5.2 Schedule B-II scoring

Score each exception 0-10 (0 = benign; 10 = deal killer):

| Exception type             | Default score | Notes                          |
|----------------------------|---------------|--------------------------------|
| Utility easement           | 1             | Recorded; usually benign       |
| Access easement (private)  | 3             | Verify scope, term, exclusivity|
| Drainage easement          | 2             | Confirm not flooding subject   |
| Conservation easement      | 7             | Use restriction; deal-shaping  |
| Mineral rights reservation | 8             | Sub-surface use; rare in EA    |
| Restrictive covenant       | 5             | Read for use/build restrictions|
| Pending litigation         | 9             | Stop until resolved            |
| Boundary-dispute survey    | 8             | Survey-conflict; resolve first |
| Tax-lien                   | 9             | Curable with payoff            |
| Mechanic-lien              | 7             | Curable with payoff + waiver   |
| HOA-fee arrears            | 5             | Curable with payoff            |
| Mortgage / DOT             | 4             | Standard payoff at close       |
| Lis pendens                | 10            | Stop                           |
| Federal tax lien (IRS)     | 9             | Curable with IRS lien release  |

### 5.3 Easement encumbrance modeler

For an easement burdening the subject:
- **Scope**: surface only / sub-surface / aerial?
- **Term**: perpetual / fixed-years / terminable?
- **Exclusivity**: shared with grantor / exclusive to grantee?
- **Build-around feasibility**: does building envelope still work?
- **Compensation**: any rent owed to grantor of easement?

Quantitative impact estimate: %-of-developable-area lost × value-per-
sqm + entitlement-friction cost.

### 5.4 Restrictive covenant impact

CC&Rs may restrict: use (single-family only), density (max-units
per acre), aesthetics (color, materials), height, building lines,
architectural review (HOA approval). Each scored: probability-of-
breach × cost-of-cure × probability-of-enforcement.

---

## 6. Survey DD

### 6.1 ALTA / NSPS 2021 Survey

Authority: **ALTA / NSPS Land Title Surveys Standards 2021** (06/2021
revision, supersedes 2016). Required for institutional acquisitions
when the buyer wants Standard Exceptions deleted from title policy.

Table A optional items (the buyer-elected fields):
- Item 1: Monuments at corners
- Item 2: Address
- Item 3: Flood-zone classification (FIRM)
- Item 4: Gross area + zoning area
- Item 5: Contours
- Item 6: Zoning classification
- Item 7(a): Building square footage
- Item 8: Substantial features
- Item 9: Parking area (counts)
- Item 10: Adjoining property owners (per title commitment)
- Item 11: Utility companies + locations
- Item 14: Site benchmark
- Item 16: Observed evidence of recent earth-moving
- Item 17: Proposed changes in street ROW
- Item 18: Wetland delineation
- Item 19: Offsite easements
- Item 20(a): Professional liability requirements

### 6.2 Encroachment scoring

For each encroachment found:
- **Subject onto neighbor**: liability + cost to cure.
- **Neighbor onto subject**: title burden + cost to defend.
- **Across public ROW**: regulatory exposure.
- **Setback violation**: zoning entitlement risk.

Score 0-10 per encroachment; aggregate weighted by m² affected.

### 6.3 Setback analysis

Pull current zoning code; compare against actual building footprint.
Existing legal-non-conforming buildings get grandfather rights but
may lose them if redevelopment crosses thresholds (e.g. > 50 %
demolition triggers re-conformance in most jurisdictions).

---

## 7. Zoning + entitlement DD

### 7.1 By-right vs SUP vs variance

| Path             | Process               | Timeline (US) | Timeline (EA)    | Risk     |
|------------------|-----------------------|---------------|------------------|----------|
| By-right         | Building permit only  | 1-3 mo        | 3-6 mo (NCC/DCC) | Low      |
| Administrative   | Plan-check + staff    | 3-6 mo        | 6-9 mo           | Low-Med  |
| Special-use perm | Planning Commission   | 6-12 mo       | 9-18 mo          | Med      |
| Variance         | Hardship showing      | 6-12 mo       | 12-24 mo         | Med-High |
| Rezoning         | City Council vote     | 12-24 mo      | 18-36 mo         | High     |
| PUD / area-plan  | Master-plan amendment | 18-36 mo      | 24-48 mo         | High     |

Authority: **APA** *Zoning Practice Quarterly 2024*, **NCC**
(Nairobi City County) *Development Control Manual 2023*, **DCC**
(Dar es Salaam City Council) *Master Plan 2026-2056*.

### 7.2 Opposition scorer

Per **APA** + **MIT DUSP** *NIMBY Predictor 2023*. Variables:
- Density of registered homeowner-associations within 0.5 mi
- Median tenure (owner-occupied) — longer = more opposition
- Median income — both very high (HOA-active) and very low
  (displacement-fear) score higher than middle.
- History of recent contested rezonings within 1 mi (count)
- Distance to nearest historic district
- Public-transit access (proxy for upzoning sympathy)
- Education attainment (higher = more sophisticated opposition)

Composite 0-100; > 65 = "expect material opposition; plan 2-yr
entitlement runway".

### 7.3 FAR / setback / use analysis

Given current zoning code, compute:
- Max-by-right buildable envelope
- Max-with-upzone buildable envelope
- Use-permitted vs use-conditional vs use-prohibited
- Density-bonus opportunities (affordable, transit, green-build)
- Inclusionary-housing requirements (US) / housing-cess (EA)

---

## 8. Geotechnical DD

### 8.1 Seismic (PGA)

Authority: **USGS** National Seismic Hazard Maps 2023, **GEM
Foundation** Africa Hazard Model 2024, **IBC 2024** Section 1613.
For EA seismic activity:
- East African Rift Zone: moderate-to-high seismicity (Lake
  Tanganyika, Lake Albert, Lake Turkana corridors).
- Coastal EA: low (Mombasa, Dar es Salaam, Mtwara, Tanga).
- Nairobi: moderate (PGA ~ 0.10g 10 %-in-50-yr return).
- Dar es Salaam: low (PGA ~ 0.04g 10 %-in-50-yr return).
- Kampala: low-moderate (PGA ~ 0.06g 10 %-in-50-yr return).

PGA bands:
- < 0.05g: very low; no special design beyond IBC default.
- 0.05 - 0.10g: low; basic seismic detailing.
- 0.10 - 0.20g: moderate; ductile detailing required.
- 0.20 - 0.40g: high; full seismic design + cost +6-12 %.
- > 0.40g: very high; +12-20 % cost.

Soil-amplification factor (site class):
- A (hard rock): 0.8
- B (rock): 0.9
- C (very dense soil): 1.0
- D (stiff soil): 1.1
- E (soft soil): 1.4
- F (special soils — peat, fill): site-specific study

### 8.2 Flood zone

Authority: **FEMA FIRM** (US), **KE NEMA Flood Risk Map 2023**,
**TZ NEMC Flood Mapping 2022**, **UG NEMA Flood Atlas 2024**.

FEMA zones:
- X (unshaded): minimal risk; no flood insurance required.
- X (shaded): 0.2 %-annual-chance; insurance optional.
- A / AE: 1 %-annual-chance (100-yr); insurance required.
- AO / AH: shallow flooding 1 %-annual.
- V / VE: coastal high-hazard (wave action); insurance required.
- D: undetermined; insurable.

EA equivalent risk bands:
- Low: no historical flooding, >500 m from watercourse.
- Moderate: 100-500 m from watercourse, intermittent flooding.
- High: <100 m from watercourse, recurring flooding (Dar es
  Salaam Msimbazi basin, Nairobi Mathare basin).
- Very high: in active floodplain, annual flooding.

### 8.3 Slope stability

Authority: **USGS** Slope Stability Hazard Mapping, **FHWA**
*Geotechnical Design Manual* (2022). Slope grade ranges:
- 0-5 %: flat; no special design.
- 5-15 %: gentle; standard retention.
- 15-25 %: moderate; engineered retaining walls; +5-10 % cost.
- 25-40 %: steep; pile foundations + slope stabilisation; +15-25 % cost.
- > 40 %: very steep; major geotechnical study required.

### 8.4 Soil load (bearing capacity)

- > 200 kPa: excellent; spread footings.
- 100-200 kPa: good; standard footings + minor improvement.
- 50-100 kPa: moderate; rafts or pile caps; +5 % cost.
- 25-50 kPa: poor; piles required; +10-20 % cost.
- < 25 kPa: very poor; deep piles or soil-replacement; +20-40 %.

---

## 9. Financial DD

### 9.1 T-12 + T-3 validator

T-12 = trailing 12 months operating statement; T-3 = trailing 3
months annualized. Checks:
- **Math**: each row sums correctly; YTD ties to T-12.
- **Flow**: gross potential rent → vacancy → effective rent →
  other income → EGI → opex → NOI math is internally consistent.
- **Escalation accuracy**: rent-roll-escalations match T-12 income.
- **T-3 reconciliation**: T-3 annualized ÷ T-12 should be 0.95-1.05
  unless seasonality justifies (e.g. student housing).
- **Expense recoveries**: CAM + tax + insurance billings recovered
  from tenants reconcile to rent-roll recovery clauses.

### 9.2 Rent-roll integrity

Authority: **NCREIF** *Operating Reporting Standards*, **IPMS**
2025. Checks:
- **Gap detection**: no unit appears twice; no missing unit numbers.
- **Lease overlap**: same unit cannot have two active leases.
- **Escalation accuracy**: scheduled increases reconcile to lease
  text.
- **Percentage rent**: sales-floor benchmarks reconcile to retailer
  sales reports.
- **Concessions**: free-rent + TI amortization match lease text.
- **Security deposits**: ledger matches lease text + cash account.
- **Below-market**: identify leases ≥ 15 % below comp market;
  flag for mark-to-market.

### 9.3 Expense reconciler

Major opex categories:
- Property tax (verify with assessor)
- Insurance (verify with broker invoice)
- Utilities (verify with utility-billing statements)
- Repairs & maintenance (categorize: capex vs opex)
- Payroll (on-site staff, with benefits load)
- Management fee (typically 3-4 % of EGI)
- Professional fees (legal, accounting)
- Marketing (typically 0.5-1.5 % of EGI)
- Reserves (capex / replacement reserves; typically $300/unit/yr
  multifamily, more for office)

Red flags:
- Opex / EGI > 50 % multifamily → operationally distressed.
- Opex / EGI < 30 % multifamily → expenses under-reported.
- R&M < $300/unit/yr → deferred maintenance trap.
- Mgmt fee not visible → owner self-managing; need to load market.

### 9.4 Percentage rent verification (retail only)

Each retail lease has natural break-point or artificial break-point.
Verify:
- Sales reports submitted on lease-specified cadence (monthly /
  quarterly / annual)
- Sales-figure auditing rights enforced
- Reconciliation to billed percentage rent

---

## 10. Title insurance + endorsements

### 10.1 ALTA 2006 extended owner's policy

Authority: **ALTA** Owner's Policy (06/17/06) extended coverage
covers loss arising from:
- Title-vesting other than as insured
- Defect in title (forgery, fraud, undue influence)
- Lien or encumbrance
- Unmarketable title
- No right of access
- Title forfeiture
- (Extended) survey matters insurable

### 10.2 9-series endorsements (restrictive covenants)

| Code   | Coverage                                        |
|--------|-------------------------------------------------|
| 9-06   | Restrictions, encroachments, minerals — owner's |
| 9.1-06 | Restrictions, encroachments, minerals — unimproved |
| 9.2-06 | Restrictions, encroachments, minerals — improved   |
| 9.3-06 | Restrictions, encroachments, minerals — loan       |
| 9.10-06| Restrictions, encroachments, minerals — current vio|

### 10.3 22-series (mineral rights)

| Code   | Coverage                                  |
|--------|-------------------------------------------|
| 22-06  | Location (no exception for description)   |
| 22.1-06| Location & dimensions                     |
| 25-06  | Same as survey                            |
| 25.1-06| Same as survey + improvements             |
| 28-06  | Easement — damage from use                |
| 28.1-06| Easement — damage from minerals           |
| 28.2-06| Encroachment — boundary structures        |
| 28.3-06| Same-but-no-survey                        |

### 10.4 Endorsement recommendation matrix

Per **Stewart Title** *Endorsement Decision Guide 2024*:

| Issue identified            | Endorsement to add   |
|-----------------------------|----------------------|
| Restrictive covenants       | 9-06 (or 9.2-06)     |
| Subdivision approval        | 13-06                |
| Encroachment of fence/wall  | 28.2-06              |
| Mineral rights reservation  | 22-06 + 35-06        |
| Access via private road     | 17-06 (access)       |
| Insurable as one parcel     | 19-06 (contiguity)   |
| Survey amendments           | 25-06                |
| Tax-parcel mismatch         | 18-06                |
| Zoning-completed-structure  | 3.1-06               |
| Zoning-vacant-land          | 3-06                 |
| Doing-business-as           | 16-06                |

### 10.5 EA title-insurance equivalents

- **Kenya**: title insurance is nascent; **First American Title
  Kenya** + **Old Mutual Title** offer cover for Tier-1 trades.
  Pre-2010 titles often require manual chain reconstruction.
- **Tanzania**: no formal title-insurance market; risk borne by
  buyer. Use indemnity from seller + escrow.
- **Uganda**: limited; **Britam Title Cover** available for ≥ USD
  500 k trades.

---

## 11. EA jurisdictional DD

### 11.1 Kenya — Land Act 2012 §38 search

Authority: **Land Act 2012** §38, **Land Registration Act 2012**.
Required searches:
1. Land Reference Number (LR No.) search at MoL Ardhi House
2. Charges register (any registered mortgage)
3. Caveats register (third-party claims)
4. Restrictions (court orders, family-trust)
5. Spousal-consent register (Matrimonial Property Act 2013 §12)
6. Rates clearance certificate (CRC) — Nairobi: NCC; other counties
7. Land Rent clearance (LRC) — for leasehold parcels
8. Survey plan + RIM (Registry Index Map) reconciliation
9. Land Control Board (LCB) consent (for agricultural land)
10. Title-deed authentication (NLC + ICT National Land
    Information Management System / NLIMS lookup)

For NLIMS-registered titles (post-2018 Nairobi): also verify QR-code
+ digital seal.

Key risks:
- **Double-allotment** — same LR No. allotted to two parties (esp.
  in Mavoko, Athi River 2008-2014 era).
- **Grabbed public land** — National Land Commission revocation
  risk (Recent: Karen, Lang'ata, Kileleshwa cases).
- **Adverse possession** — Section 7 Limitation of Actions Act:
  12 years uninterrupted occupation can vest title.

### 11.2 Tanzania — Land Act 1999 §22 verification

Authority: **Land Act 1999** §22, **Village Land Act 1999**.
Two classes:
- **General Land** (urban, including Dar es Salaam) — title under
  Land Act 1999.
- **Village Land** (rural) — title under Village Land Act 1999;
  customary right of occupancy.

Required searches:
1. Certificate of Title (CT) or Certificate of Customary Right
   of Occupancy (CCRO)
2. Land Office search at MLHHSD (Ministry of Lands)
3. Encumbrances register
4. Caveats register
5. Tax clearance (TRA)
6. Survey diagram (CT-issued)
7. Plot-rent clearance
8. Village-council attestation (for village-adjacent parcels)
9. NEMC environmental status

Key risks:
- **Customary tenure overlap** — General-Land title issued over
  village land without proper de-gazettement (esp. in fringe
  Dar areas: Pugu, Mbezi, Bunju, Mbweni).
- **Right of occupancy expiry** — 33, 66, or 99 year terms; some
  granted 1970s now expiring.

### 11.3 Uganda — LRA 1922 title trace

Authority: **Land Registration Act 1922** (as amended through 2020),
**Land Act 1998 Cap 227**.

Four tenure systems:
- **Mailo** (Buganda only) — privately held; title-registered
- **Freehold** — full ownership; title-registered
- **Leasehold** — terms 5-99 years
- **Customary** — communal / clan-held; often unregistered

Required searches:
1. Certificate of Title search at MLHUD
2. White Page search (encumbrances)
3. Encroachment search (esp. bibanja-holders on Mailo land)
4. Spousal-consent (Land Amendment Act 2004 §39)
5. KCCA / municipal rates clearance
6. NEMA environmental status
7. Title-authentication via DEMD (Department of Mailo & Estate
   Management)

Key risks:
- **Bibanja-holder** — long-term tenant on Mailo land with statutory
  protection; buyer of Mailo title may inherit unmovable tenant.
- **Overlapping customary claim** — unregistered claim on
  Mailo / freehold land.

### 11.4 Ancestral-claim risk scorer

Universal EA risk: customary / ancestral / clan claims on
seemingly-titled land. Scorer inputs:
- Distance from nearest customary-tenure area
- Age of title (< 10 years → higher risk)
- Title-genesis path (allotment vs adjudication vs grant)
- Family-tree clarity (single owner vs multi-heir)
- Existence of village-elder attestation
- Existence of court-affirmed quiet-title decree
- Pending litigation in High Court / Land & Environment Court

Output 0-100; > 60 = "obtain village-elder attestation +
publication of intended transfer in local press for 60 days
before close."

### 11.5 Village-elder DD

For EA rural / peri-urban parcels:
1. Identify the **wazee wa mtaa** (village elders) — typically 3-7
   long-tenured residents recognized by KE chief / TZ ward-officer
   / UG LC1.
2. Open dialogue 30-90 days pre-close.
3. Document via notarised attestation (KE Public Notary, TZ
   Commissioner for Oaths, UG Commissioner for Oaths).
4. Pay customary-compensation (where applicable, ~ 0.5-2 % of price).
5. Cover photo-record + signed attendance.

---

## 12. Composition + final go/no-go

### 12.1 Acquisition recommender (composition)

Composes:
- Sourcing channel score (broker + off-market + outreach)
- Comp-sale triangulated value
- LOI risk score
- PSA flagged clauses
- Phase I REC list + Phase II recommendation
- Title commitment B-II scores
- Survey encroachment scores
- Zoning entitlement path + opposition score
- Geotech (PGA + flood + slope + soil)
- Financial DD findings
- Title-insurance endorsement matrix
- EA jurisdictional findings + ancestral-claim score

Output: `AcquisitionRecommendation` with:
- Composite confidence (0..1)
- Go/no-go/proceed-with-condition verdict
- Pricing recommendation (vs asking, vs triangulated value)
- Critical findings list
- Closing checklist (must-cure items)
- Veteran narrative

### 12.2 Go/no-go MCDA

Multi-criteria decision analysis weights (Carmel Partners / Greystar /
SL Green tier):

| Criterion                  | Weight |
|----------------------------|--------|
| Financial fit (IRR / YoC)  | 0.25   |
| Comp-triangulated pricing  | 0.15   |
| Environmental risk         | 0.12   |
| Title risk                 | 0.10   |
| Survey + encroachment      | 0.07   |
| Zoning + entitlement       | 0.10   |
| Geotech                    | 0.06   |
| Financial DD integrity     | 0.10   |
| EA jurisdictional          | 0.05   |

Each scored 0-1 (1 = fully passes). Composite ≥ 0.75 = "go".
0.60-0.75 = "proceed with conditions". 0.45-0.60 = "renegotiate".
< 0.45 = "no-go".

### 12.3 Pricing recommendation

Three anchors:
- **Comp-triangulated value** — from §2.
- **Income-cap value** — stabilised NOI / market-cap-rate.
- **Replacement cost less depreciation** — Marshall & Swift cost
  manual.

Final recommended offer = weighted blend:
- 0.50 × comp-triangulated
- 0.30 × income-cap
- 0.20 × replacement-cost-less-depreciation

Negotiation envelope: offer at -8 % to triangulated value; walk-away
+10 % to triangulated value.

---

## 13. References

- ASTM E1527-21 — Phase I ESA
- ASTM E1903-19 — Phase II ESA
- ASTM E2600-15 — Vapor Encroachment
- ALTA 2021 Commitment for Title Insurance
- ALTA / NSPS 2021 Land Title Survey Standards
- ALTA Owner's Policy 06/17/06
- EPA 40 CFR Part 312 (All Appropriate Inquiries Rule)
- ABA Real Property Section — Model PSA 2024
- Pircher Nichols & Meeks — Acquisition Counsel Templates 2024
- Eversheds Sutherland Africa — EA Deal Mechanics 2024
- MSCI Real Capital Analytics
- Trepp — CMBS Wall of Maturities 2025-2027
- CompStak — Lease Comp Database
- CBRE Cap Rate Survey H2 2024
- Cushman MarketBeat Q4 2024
- JLL Investment Outlook Q4 2024
- Knight Frank Wealth Report 2024
- Knight Frank Africa Capital Markets Q4 2024
- HassConsult Property Index
- NMHC Broker Cooperation Study 2024
- PERE Off-Market Origination Study 2024
- REBNY Distressed Asset Brief 2024 Q4
- IBC 2024 Section 1613 (Seismic Design)
- USGS National Seismic Hazard Maps 2023
- GEM Foundation Africa Hazard Model 2024
- FEMA FIRM
- KE NEMA Flood Risk Map 2023
- TZ NEMC Flood Mapping 2022
- UG NEMA Flood Atlas 2024
- Land Act 2012 (KE)
- Land Registration Act 2012 (KE)
- Matrimonial Property Act 2013 (KE)
- Land Act 1999 (TZ)
- Village Land Act 1999 (TZ)
- Land Registration Act 1922 (UG)
- Land Act 1998 Cap 227 (UG)
- NCC Development Control Manual 2023 (Nairobi)
- DCC Master Plan 2026-2056 (Dar es Salaam)
- APA Zoning Practice Quarterly 2024
- MIT DUSP NIMBY Predictor 2023
- BOMA Experience Exchange Report 2024 Q4
- NCREIF Operating Reporting Standards
- IPMS 2025
- Stewart Title Endorsement Decision Guide 2024
- First American Title Endorsement Manual 2024
- Carmel Partners / Greystar / SL Green / Tishman Speyer / Eastdil
  / Newmark — institutional acquisition-process canon (industry
  best practice).
