# Lifecycle Advisor — SOTA 2026-05-24

A veteran-expert advisor for the four real-estate lifecycle stages NOT
covered by other `packages/*-advisor` modules: **development**,
**disposition**, **refinancing**, and **investor relations**.

The thesis: most owners fail at lifecycle inflection points because
each domain demands its own analytical discipline yet must be composed
into a single "what-to-do-next" recommendation. This package encodes
the discipline a veteran director applies before any tactical action
fires. Pure-math core, optional LLM synthesis via injected port.

Distinct from:
- `packages/expansion-advisor` — acquisition & HBU only
- `packages/estate-auto-management` — operational predictive maintenance
- `packages/estate-department-advisor` — head-of-department staffing/cadence
- `packages/forecasting` — pure forward-curve generators

---

## 1. Development

### 1.1 Feasibility study (USPAP Standard 9 + IDM ProForma)

Authority: **Appraisal Institute** — *USPAP Standard 9 — Development
Property Analysis* (2024 ed.), **Institutional Development Manual
(IDM) ProForma 7-step** template, **ULI** *Real Estate Development —
Principles and Process* 5th ed.

Required inputs (USPAP §9-2 (b)):
1. Site description with legal-title & encumbrance review
2. Highest-and-best-use analysis (already reused from expansion-advisor)
3. Cost approach with current Marshall & Swift / RSMeans pricing
4. Discounted cash-flow on stabilised exit
5. Sensitivity (rent ±10 %, cost ±10 %, exit cap ±50 bps)

Go / no-go gate (industry rule of thumb after IDM):
- `untrendedYieldOnCost ≥ goingInCapRate + 150 bps` (positive arbitrage)
- `riskAdjustedIRR ≥ owner's hurdle + 300 bps` (development premium)
- `LTC ≤ 75 %` AND `LTV ≤ 65 %` on stabilised value
- `peakEquity ≤ owner's pocket-depth × 0.75` (reserve cushion)
- `contingency ≥ 7.5 % hard + 10 % soft` (RSMeans median for mid-rise)

Failing any gate → **redesign** (don't fund). Passing all four → **go**.
Failing one only → **conditional go** with risk-mitigant attached.

### 1.2 GC selection — qualifications-based vs price-based

Authority: **Construction Management Association of America (CMAA)** —
*Standard CM Practice* (2024), **ConsensusDocs 510** *Owner-CM Agreement*,
**AIA A133/A134**.

Three primary delivery methods:

| Method                  | When to use                                  | Risk to owner | Pricing |
|-------------------------|----------------------------------------------|---------------|---------|
| **Design-Bid-Build (DBB)** | Simple repeatable project, complete drawings | High GC | Lump sum |
| **Construction-Mgmt-At-Risk (CMAR)** | Mid-complexity, fast-track tolerated, partial drawings | Shared | GMP + savings split |
| **Design-Build (DB)**   | Complex/innovative, single point of resp.  | Low owner | Lump sum / GMP |
| **Integrated Project Delivery (IPD)** | Highest complexity, multi-party risk-pool | Pooled | Risk-pool |

Bid evaluation weights (CMAA recommended for qualifications-based):
- Past performance & similar-project track record: **35 %**
- Project team strength (PM + supt cv): **20 %**
- Schedule realism: **15 %**
- Price competitiveness: **15 %**
- Safety record (DART rate < 1.5): **10 %**
- DBE / local-employment commitment: **5 %**

For EA: KCB and Equity Bank-funded projects increasingly require an
NCA Class-1 contractor for KES 1 B+ jobs (National Construction
Authority Act §12, 2024 amendment).

### 1.3 Cost benchmarking — RSMeans + EA indices

Authority: **RSMeans Square Foot Costs 2026**, **Cumming Corp Q1-2026
Cost Index**, **Turner Building Cost Index Q1-2026** (TBCI), **AAK
Construction Cost Index 2026** (Architectural Association of Kenya),
**TIC Construction Cost Index 2026** (Tanzania Investment Centre).

Benchmark $/sqm (2026 USD constant) for mid-rise (5-8 floor) residential:

| Region              | $/sqm gross | Notes                              |
|---------------------|-------------|------------------------------------|
| US Tier 1 (NYC, SF) | 3,800       | TBCI 1,330                         |
| US Tier 2 (Dallas)  | 2,600       | TBCI 1,330                         |
| London              | 3,500       | Turner UK Index 1,290              |
| Lagos               | 1,400       | Cumming Africa Index +18 % YoY     |
| Nairobi             | 1,150       | AAK 2026 +9 % YoY                  |
| Dar es Salaam       | 980         | TIC 2026 +12 % YoY                 |
| Kampala             | 920         | Estimated from AAK + 15 % country uplift |

Variance > 25 % vs regional median is a red flag → reprice or rebid.

### 1.4 Schedule risk — Monte Carlo P50/P80/P90

Authority: **PMI Practice Standard for Project Risk Management 2024**,
**ASCE/CMAA Cost & Schedule Risk Assessment Guide 2023**.

For each schedule task, model:
- Optimistic (10th percentile), most-likely (50th), pessimistic (90th)
- Triangular or PERT-beta distribution per CMAA guide
- 10,000-iteration Monte Carlo sums task durations
- Critical-path criticality index = % of iterations where task on CP

Owner reporting:
- **P50 schedule** — internal planning
- **P80 schedule** — owner-disclosure commitment
- **P90 schedule** — lender / equity-partner commitment (with float)
- Contingency curve: `weeks_of_contingency = (P90 - P50)` (typical
  for mid-rise: 10-14 weeks)

### 1.5 Buyout-vs-self-perform decision matrix

Authority: **Lean Construction Institute** *Last Planner® System*
(2024), **Associated General Contractors of America (AGC) Self-Perform
Calculator 2024**.

Self-perform if ALL:
- In-house crew utilisation < 70 % for next 6 months
- Trade margin > 12 % (vs subcontractor at 7-9 %)
- Quality-control criticality high (life-safety / signature trade)
- No specialty insurance requirement gap

Buyout if ANY:
- Specialty trade (curtain wall, elevator, fire suppression)
- Bond cost < 1.5 % of trade value
- Sub has > 95 % on-time delivery track record

### 1.6 LEED / BREEAM / EDGE construction-phase scoring

Authority: **USGBC LEED v4.1 BD+C 2024 amendment**, **BRE BREEAM
International New Construction 2024**, **IFC EDGE 3.0 Methodology 2024**.

Construction-phase points checklist (LEED v4.1 BD+C):
- IPpc1 Integrative Process: 1 pt
- LTc1 LEED for Neighborhood Development location: 1-16 pts
- SS Sustainable Sites cluster: up to 10 pts
- WE Water Efficiency: 11 pts
- EA Energy & Atmosphere: 33 pts (largest)
- MR Materials & Resources: 13 pts
- EQ Indoor Environmental Quality: 16 pts
- IN Innovation: 6 pts

Minimum thresholds: Certified ≥ 40, Silver ≥ 50, Gold ≥ 60, Platinum ≥ 80.

EDGE (most relevant in EA): ≥ 20 % energy + 20 % water + 20 %
embodied-energy reduction vs baseline → EDGE Certified.

### 1.7 BIM maturity + COBie deliverable

Authority: **NBIMS-US v4 (NIBS National BIM Standard 2024)**, **PAS
1192-3 (now ISO 19650-3)**.

BIM maturity levels:
- Level 0: 2D CAD only
- Level 1: Mixed 2D/3D, no collaboration
- Level 2: Federated 3D models, structured data exchange (PAS 1192)
- Level 3: Single live model, IPD-aligned (ISO 19650)

COBie deliverable: spreadsheet (or IFC) handover with asset
attribute data. Required for FM-handover on most institutional
projects > USD 50 M.

### 1.8 Permit-path optimisation

Per-jurisdiction average permit-cycle (2026 data):

| Jurisdiction         | Mid-rise SD-DD-CD-Permit | Notes                              |
|----------------------|--------------------------|------------------------------------|
| Manhattan, NY        | 14-18 mo                | DOB BIS + LL97 review              |
| Los Angeles          | 12-16 mo                | LADBS PLAN + ZIMAS                 |
| London (LBs avg)     | 10-14 mo                | Pre-app + Section 106              |
| Nairobi              | 6-10 mo                 | NCA + KEBS + NEMA EIA              |
| Dar es Salaam        | 7-11 mo                 | Ministry of Lands + NEMC EIA       |
| Kampala              | 6-9 mo                  | KCCA + NEMA                        |

Lead-time-saving levers: pre-application meeting, fast-track plan
check (US: 30-40 % time saving for + 2× fee), neighbourhood-board
early engagement (-2 mo if friendly, +6 mo if hostile).

### 1.9 Change-order risk modelling — top 12 root causes

Authority: **Construction Industry Institute (CII) RT-43 Final
Report 2024**, **ENR Cost Report 2026**.

Top-12 with median impact (% of contract):

| Rank | Root cause                          | Median impact | Prevention                          |
|------|-------------------------------------|---------------|-------------------------------------|
| 1    | Owner scope change                  | 4.5 %         | Lock scope at 90 % CD               |
| 2    | Drawing errors / omissions          | 3.8 %         | Independent peer review at 80 % CD  |
| 3    | Differing site conditions           | 2.9 %         | Pre-bid geotech + survey            |
| 4    | Permit / authority changes          | 2.2 %         | Pre-app meeting + buffer            |
| 5    | Material substitution               | 1.9 %         | Spec backups in CD                  |
| 6    | Schedule acceleration request       | 1.7 %         | P80 commit, not P50                 |
| 7    | Subcontractor default               | 1.6 %         | Bonding > USD 5 M trades            |
| 8    | Weather / force majeure             | 1.4 %         | Critical-path weather model         |
| 9    | Labour shortage / wage escalation   | 1.3 %         | Early-procurement labour locks      |
| 10   | Coordination conflicts (clash)      | 1.2 %         | Level-2 BIM mandate                 |
| 11   | Owner-furnished equipment delay     | 0.9 %         | OFE schedule audit at 60 % CD       |
| 12   | Inspection / regulatory failure     | 0.8 %         | 3rd-party QA programme              |

### 1.10 Punch-list acceptance criteria

Authority: **AIA Document G704 — Certificate of Substantial Completion**,
**AGC Punch List Tolerances 2024**.

Substantial completion: project usable for intended purpose. Punch
list captures non-conforming items. Industry tolerances (AGC 2024):
- **Cosmetic** (paint, tile): ≤ 0.5 items per 100 m²
- **Mechanical** (HVAC, plumbing): ≤ 0.2 items per 100 m²
- **Life-safety** (fire alarm, egress): **zero defects** acceptable
- **Total** items at SC: ≤ 1.0 per 100 m² for mid-rise

Final acceptance: punch list ≤ 0.1 items per 100 m², all life-safety
cleared.

---

## 2. Disposition

### 2.1 Exit-timing — hold-period IRR vs forward-curve cap rates

Authority: **NCREIF Property Index Q1-2026**, **Real Capital
Analytics (RCA) US Trends 2026**, **Trepp CMBS Issuance Tracker
2026**.

Exit-now rule (composite trigger):
1. `forwardIRR_next_24mo < holdingHurdle - 200 bps`
2. AND `marketCapRate ≤ entryCapRate - 50 bps` (cap-rate compression
   realised so further compression unlikely)
3. AND `taxBasis × (1 - depreciationRecapture) > debtPaydown` (no
   tax-trap)
4. AND `RCA velocity > 12-month avg + 0.5σ` (liquid market)
5. AND `Trepp CMBS issuance > avg - 0.5σ` (debt-market open)

If 4 of 5 → sell now. 3 of 5 → list with brokers, soft-test market.
≤ 2 → continue hold, re-evaluate quarterly.

### 2.2 Buyer-pipeline (5-tier matrix)

Authority: **Knight Frank Prime International Residential Index (PIRI)
2026 Q1**, **JLL Capital Tracker 2026**.

Five tiers per asset:

| Tier | Buyer type            | Pricing power | Typical hold | Closing speed | Notes                          |
|------|-----------------------|---------------|--------------|---------------|--------------------------------|
| 1    | Institutional         | High          | 7-10 yr      | 60-90 days    | Bid-ask gap negotiable         |
| 2    | Private investor      | Med           | 5-7 yr       | 45-60 days    | More fee-sensitive             |
| 3    | 1031 exchange         | High          | 5-10 yr      | 30-45 days    | Time-pressure → premium price  |
| 4    | Owner-occupier        | Low           | 10+ yr       | 60-120 days   | Highest emotional value        |
| 5    | International (PIRI)  | Variable      | Variable     | 90+ days      | FX & repatriation friction     |

Match score per tier: 0-1 composite of asset-class fit × cap-rate
appetite × ticket-size fit × buyer-pool activity. Top 2 tiers drive
marketing strategy.

### 2.3 Broker selection — qualification matrix

Authority: **NAR Commercial Membership Survey 2024**, **CCIM (Certified
Commercial Investment Member) Compensation Study 2024**.

Score brokers on (each 0-1):
- Track record (closed comparable trades, last 24 mo): **30 %**
- Asset-class fit (% of book in same class): **20 %**
- Buyer-pool match (% buyer rolodex in top-2 tiers): **20 %**
- Marketing budget (% of expected fee committed): **10 %**
- Local-market depth (years in submarket): **10 %**
- Co-broker willingness (yes / no): **10 %**

Top 2 brokers → BOV bake-off → select higher value with
qualifications-justified delta < 5 %.

### 2.4 Marketing — OM, teaser, BOV, best-and-final

Authority: **Institutional Real Estate, Inc. (IREI) OM Standard 2024**,
**RealNex OM Template Library**.

12-section OM (IREI):
1. Executive summary (1-2 pp)
2. Investment highlights (3-5 bullet)
3. Property description
4. Location & demographics
5. Market overview (submarket fundamentals)
6. Financial analysis (rent roll + OPEX + DCF)
7. Tenant profiles (top-10 by rent)
8. Capital plan (in-place + projected)
9. Comparable sales & leases
10. Title, zoning, environmental disclosures
11. Tour schedule + offer process
12. Disclaimers & confidentiality

Best-and-final structure: 2 rounds. Round 1: indicative bids by date
T. Round 2: top 3-5 invited, hard deposit + tighter contingencies,
final by T + 21 d.

### 2.5 1031 reverse-exchange feasibility (US)

Authority: **IRC §1031(a)(3)**, **Rev. Proc. 2000-37** (parking
arrangements), **FEA Federation of Exchange Accommodators 2024 Best
Practices**.

Reverse exchange when seller needs to buy replacement BEFORE selling
relinquished property. Structure: EAT (Exchange Accommodation
Titleholder) parks one leg.

Feasibility gates:
- `equity_in_relinquished ≥ replacement_purchase × 0.30` (typical
  parking-fee headroom)
- `closing_on_relinquished ≤ 180 days from parking` (statutory)
- `identification_of_replacement ≤ 45 days from parking` (statutory)
- `EAT_fee ≤ 2 % of replacement value` (typical)

EA equivalent: **TZ Land Act §47 Like-Kind Land Swap** — no
deferral on developed property but available on undeveloped land.
Kenya: no statutory like-kind deferral; use rollover via SPV
re-investment (Income Tax Act §15(2)(s) — capital-gains roll-over
for asset replacement within 12 months).

### 2.6 Seller-financing structuring

Authority: **Mortgage Bankers Association (MBA) Seller-Financing
Guide 2024**.

Use cases:
- Buyer credit constrained (sub-IG)
- Tax-deferral via installment-sale (IRC §453)
- Higher headline price acceptable for "soft" financing terms

Common terms:
- LTV 60-70 % (lower than bank to compensate seller risk)
- Term 5-7 yr (typical) with 25-30 yr amortisation
- Rate: bank rate + 100-200 bps
- Personal guarantee from buyer principal
- Cross-collateralised by buyer's other assets if available

### 2.7 Tax-deferred exchange optimisation

For US: §1031 forward exchange (relinquished sells first), reverse
exchange (replacement bought first), improvement exchange (build to
suit on EAT-parked land). Each has 45-day ID + 180-day close limits.

For EA: rollover relief, like-kind land swap (TZ), or SPV
re-investment (KE) — slower but functional.

---

## 3. Refinancing

### 3.1 LTV optimisation across debt tranches

Authority: **CMSA / CREFC IRP 2024**, **Mortgage Bankers Association
2026 Commercial Real Estate Outlook**.

Multi-tranche stack:
- Senior: LTV up to 65 % (life-co), 70 % (CMBS), 75 % (agency)
- Mezz: incremental LTV to 80-85 %
- Pref equity: incremental LTV-equivalent to 90 %

Optimise total weighted cost subject to DSCR ≥ 1.25× (CMBS) /
1.30× (life-co), debt-yield ≥ 8 % (CMBS).

### 3.2 Lender selection — agency, life-co, CMBS, bank, debt-fund, mezz

Authority: **Fannie Mae DUS Lender Memo 2026**, **Freddie Mac Optigo
Conventional 2026**, **Trepp CMBS Q1-2026 Issuance Report**, **MBA
2026 Commercial/Multifamily Mortgage Origination Survey**.

| Lender type      | Best for                | Typical LTV | Spread (vs UST) | Pre-pay |
|------------------|-------------------------|-------------|-----------------|---------|
| Agency (Fannie/Freddie) | Multifamily, large| 75 %        | 175-225 bps     | Yield maint or defeasance |
| Life insurance   | Trophy office, retail   | 60-65 %     | 150-225 bps     | YM or open |
| CMBS             | Mid-sized, all classes  | 65-70 %     | 250-350 bps     | Defeasance |
| Bank             | Construction, bridge    | 60-75 %     | 250-400 bps     | Open      |
| Debt fund        | Transitional, value-add | 70-80 %     | 400-700 bps     | Open + exit fee |
| Mezz             | Top-up to 80-85 %       | n/a         | 800-1200 bps    | Open      |

EA tiers:
- **KCB / Equity / Stanbic Kenya** — senior, up to 65 % LTV, 5-7 yr
- **CRDB / NMB Tanzania** — senior, up to 60 % LTV
- **Africa-focused debt funds (e.g. Helios, Norfund)** — bridge,
  USD-denominated, 70-75 % LTV

### 3.3 Rate-lock timing

Authority: **Bloomberg US Treasury Forward Curves 2026 Q1**, **BondPro
Lock-Fee Survey 2024**.

Decision:
- If `10Y_forward_in_6mo < 10Y_spot - 15 bps` → wait, lock later
- If `lock_fee_for_6mo < spot - forward_premium` → lock now, save fee
- If volatility (1-month implied) > 80 bps → lock now (insurance)

### 3.4 Defeasance vs yield-maintenance

Authority: **Standard & Poor's Defeasance Methodology 2024**.

Defeasance cost ≈ `present-value of remaining payments at
Treasury-strip rates - principal balance`. Higher when rates fall.

Yield-maintenance cost ≈ `present-value of yield-spread × remaining
balance`. Generally cheaper than defeasance unless rates have moved
significantly.

Rule: if rates declined > 100 bps since origination, defeasance > YM
by 10-30 %; if rates increased, YM ≈ defeasance.

### 3.5 Recourse vs non-recourse + bad-boy carveouts

Authority: **ABA Commercial Real Estate Lending Survey 2024**.

Standard CMBS / agency = non-recourse with bad-boy carveouts (recourse
triggered only for: fraud, intentional misapplication, voluntary
bankruptcy, environmental indemnity breach, transfer w/o consent).

Bank / debt-fund construction = often partial recourse (25-50 % to
sponsor net worth) burning down to non-recourse at C/O + 12-month
stabilisation.

### 3.6 Loan-covenant compliance scanner

Authority: **CREFC Investor Reporting Package (IRP) 2024**.

Standard covenants:
- **DSCR** ≥ 1.25× quarterly (cash flow / debt service)
- **Debt-yield** ≥ 8 % (NOI / outstanding balance)
- **Occupancy** ≥ 85 % (multifamily) / 80 % (office) / 75 % (retail)
- **Capex reserve** ≥ USD 0.25/sqft/yr (multifamily) / 0.50 (office)
- **DSCR test for distribution lockbox** ≥ 1.20× (typical)
- **Springing lockbox** triggered at DSCR < 1.10× or occupancy < 75 %

Scanner reports breaches, time-to-breach (months), and cure cost.

### 3.7 Refi proceeds — cash-out vs rate-and-term

Authority: **MBA 2026 Commercial Mortgage Outlook**, **Trepp Refi
Tracker 2026**.

- **Rate-and-term**: pay off existing + closing costs, no cash to sponsor
- **Cash-out**: existing + closing + cash dividend to sponsor

Cash-out tax-free at federal level (return of debt, not gain) but
re-establishes basis at higher LTV — subsequent depreciation
recapture risk if held to sale.

Decision: cash-out if `cash_proceeds × IRR_on_reinvestment > extra
debt cost × (1 - tax_rate)` AND `DSCR post-cash-out ≥ 1.30×`.

---

## 4. Investor relations

### 4.1 Capital raise — 506(b) vs 506(c)

Authority: **SEC Reg D — Rules 506(b), 506(c)** (17 CFR §230.506),
**JOBS Act 2012 amendments**, **2020 amendments to accredited-investor
definition**.

| Feature             | 506(b)                          | 506(c)                          |
|---------------------|--------------------------------|--------------------------------|
| General solicitation | NOT allowed                    | ALLOWED                         |
| Investor type        | Up to 35 non-accredited + unlimited accredited | Accredited only |
| Verification         | Self-cert OK                   | Reasonable steps to verify      |
| Marketing            | Pre-existing relationship      | Web, social, public             |
| Resale restrictions  | Restricted securities, 6+ mo hold | Same                         |

For EA:
- **Kenya** — Capital Markets Authority Act, *Public Offers, Listing &
  Disclosures Regulations 2002*. Private placement to ≤ 20 investors
  exempt from full prospectus; **Capital Markets (Alternative
  Investment Funds) Regulations 2023** permit regulated AIFs.
- **Tanzania** — Capital Markets & Securities Authority. Private
  placement ≤ 50 sophisticated investors exempt.

### 4.2 Subscription doc + PPM hygiene

Authority: **PPM Standard Template (Schwabe Williamson 2024 ed.)**,
**ILPA Standard Subscription Document v3.0**.

Required sections of PPM:
1. Executive summary
2. Risk factors (3-5 pp; ULPA-style)
3. Sponsor track record
4. Investment strategy
5. Property description (if asset-level) / portfolio thesis (if fund)
6. Sources & uses
7. Capital stack & waterfall
8. Fees & expenses
9. Tax matters (incl. K-1 distribution)
10. ERISA & investor-eligibility
11. Sub doc + investor questionnaire

Sub-doc hygiene:
- Accredited-investor questionnaire signed
- Subscription agreement counter-signed by GP
- W-9 / W-8BEN collected per investor entity
- Bad-actor representation (Rule 506(d))
- Anti-money-laundering KYC for funds > USD 1 M

### 4.3 Investor reporting cadence

Authority: **ILPA Reporting Template v1.1 (2024)**, **NCREIF
Reporting Standards 2024**.

Recommended cadence:
- **Institutional LPs**: quarterly written report (NAV, IRR, MOIC,
  DPI, TVPI, attribution) + annual GP-led meeting
- **Individual / accredited**: monthly recap email + quarterly long
  report + annual K-1
- **Family-office**: same as institutional plus 30-min quarterly call

ILPA quarterly report content:
- Fund summary (NAV, called, distributed, unfunded commit)
- Performance metrics (IRR net, gross; MOIC net, gross; DPI, RVPI, TVPI)
- Capital account statement per LP
- Schedule of investments (top 10 + tail)
- Material events
- Outlook & GP commentary

### 4.4 Distribution forecasting — waterfall + promote

Authority: **PERE Waterfall Survey 2024**, **NAIOP Real Estate
Capital Markets Survey 2024**.

Common 4-tier waterfall (European or American style):
1. Return of capital to LP
2. **Pref return** — 7-10 % typical (annualised, compounded)
3. **Catch-up** — GP catches up to 20 % promote (100 % to GP) or
   straight to split
4. **Split** — 80/20 to 70/30 to 60/40 with IRR hurdles

Forecasting: build per-period cash flow → apply waterfall in tier
order → output LP & GP distribution series. Compute IRR and MOIC for
each.

### 4.5 Capital-call communication

Authority: **ILPA Capital-Call Notice Template 2024**.

Best practice:
- Notice ≥ 10 business days before due date
- Wire instructions verified by phone (anti-fraud)
- Use of proceeds clearly explained (which investment, which milestone)
- Cumulative called as % of commitment
- Late-payment cure period (typical 5 business days) + default
  consequences

Message-pattern templates per common situations:
- Standard call (planned investment)
- Bridge call (covering short-term need pending refi)
- Defaulting-LP cure call (re-stating position to remaining LPs)
- Final call (closing out unfunded commitment)

### 4.6 LP-side data room

Authority: **VirtualVaults 2024 LP Data Room Best Practices**, **ILPA
Due-Diligence Questionnaire 2.0**.

Folder structure (institutional standard):
- 01 Sponsor (org chart, bios, ADV, references)
- 02 Track record (gross + net IRR tables, MOIC)
- 03 Fund docs (LPA, PPM, sub-doc, side letters)
- 04 Investments (asset-by-asset memo + financials)
- 05 Compliance (Form ADV, ERISA, KYC)
- 06 Operations (back-office, fund admin, audit)
- 07 ESG (policy, reporting, Article 8 / 9 status if EU)
- 08 Tax (K-1, blocker structures, FATCA / CRS)
- 09 Material agreements (PMA, sub-advisor, ext counsel)
- 10 Investor questions Q&A log

### 4.7 LP Q&A drafting — top 30 questions

Common LP questions to pre-draft answers for:
- "What is your CO-investment percentage?"
- "What is your prior fund's net IRR / MOIC?"
- "Walk me through the worst-performing deal in the prior fund"
- "What is your team-departure / succession plan?"
- "How do you source deals not on the broker circuit?"
- "What is your fee waiver / management-fee offset?"
- "What is your hurdle / promote / waterfall?"
- "How will you handle a write-down?"
- "What is your borrowing limit at the fund level (i.e. subline)?"
- "What is your concentration limit per investment / sector / geography?"
- "What is your strategy for managing development risk?"
- "How do you select a GC / broker / lender?"
- "What is your ESG policy?"
- "What is your fund-level diversity & inclusion policy?"
- "What is your treatment of recycled distributions?"
- "What is your reporting cadence and template?"
- "What does your audit committee structure look like?"
- "Who is your fund administrator / auditor / counsel?"
- "Have you been the subject of an SEC inquiry?"
- "What is your strategy in a recession?"
- "Show me your stress-test scenarios"
- "What is your cybersecurity programme?"
- "How do you handle related-party transactions?"
- "What is your succession plan for the senior partner?"
- "Show me a sample LP capital account statement"
- "What is your distribution-in-kind policy?"
- "How are deal expenses allocated between fund and partners?"
- "What is your placement agent fee?"
- "Tell me about your most recent capital call"
- "What is your fund's path to first-loss vs preferred return?"

### 4.8 ILPA Reporting Template renderer

Authority: **ILPA Reporting Template v1.1 (2024)**.

The Lifecycle Advisor includes a renderer that converts a fund's
internal data model into ILPA-compliant quarterly report (sections
1.1 through 4.5) ready for LP transmission.

---

## 5. Composition — lifecycle orchestrator

A single `lifecycle-orchestrator` reads the asset's current
lifecycle position and returns the **next-best-action** across all
four domains:

| Asset state            | Active domain(s)                       | Output                          |
|-------------------------|----------------------------------------|--------------------------------|
| **Pre-development**     | Development (feasibility, GC)          | Go / no-go, GC RFP, cost benchmark |
| **Under construction**  | Development (schedule, COs, punch)     | Risk-adjusted schedule, top-3 CO risks |
| **Lease-up**            | (mostly auto-mgmt; this advisor inactive) | Watchlist only                |
| **Stabilised hold**     | Investor relations + refi (if upcoming)| Reporting, refi-window scan    |
| **Refi window**         | Refinancing                            | Lender shortlist, lock advice  |
| **Disposition window**  | Disposition + IR (final report)        | Exit-now score, buyer shortlist, OM draft |

Each domain produces a `DomainRecommendation` with `(action, priority,
confidence, rationale, citations)`. The orchestrator returns a
prioritised list of recommendations across all active domains.

---

## 6. Optional LLM synthesis

A single `MultiLLMSynthesizer` port accepts `(rationaleBundle,
audience)` and returns a natural-language narrative tailored to the
audience (LP, lender, internal IC, GC).

The port is OPTIONAL: every domain produces its own deterministic
narrative; LLM only enriches with tone, prior-context, comparable
deals.

---

## 7. Citations index

- USPAP 2024 Standard 9
- IDM ProForma 7-step (Urban Land Institute)
- ULI Real Estate Development — Principles and Process 5th ed.
- CMAA Standard CM Practice 2024
- ConsensusDocs 510, AIA A133 / A134
- RSMeans Square Foot Costs 2026
- Cumming Corp Q1-2026 Cost Index
- Turner Building Cost Index Q1-2026
- AAK Construction Cost Index 2026
- TIC Construction Cost Index 2026
- PMI Practice Standard for Project Risk Management 2024
- ASCE / CMAA Cost & Schedule Risk Assessment Guide 2023
- Lean Construction Institute Last Planner® System 2024
- AGC Self-Perform Calculator 2024
- USGBC LEED v4.1 BD+C 2024
- BRE BREEAM International New Construction 2024
- IFC EDGE 3.0 Methodology 2024
- NBIMS-US v4 (NIBS) 2024
- PAS 1192-3 / ISO 19650-3
- CII RT-43 Final Report 2024
- AIA G704 Substantial Completion
- NCREIF Property Index Q1-2026
- RCA US Trends 2026
- Trepp CMBS Issuance Tracker 2026
- Knight Frank PIRI 2026 Q1
- JLL Capital Tracker 2026
- NAR Commercial Membership Survey 2024
- CCIM Compensation Study 2024
- IREI OM Standard 2024
- IRC §1031 + Rev. Proc. 2000-37
- FEA Federation of Exchange Accommodators 2024 Best Practices
- TZ Land Act §47, KE Income Tax Act §15(2)(s)
- MBA Seller-Financing Guide 2024
- CMSA / CREFC IRP 2024
- MBA 2026 Commercial Real Estate Outlook
- Fannie Mae DUS Lender Memo 2026, Freddie Mac Optigo 2026
- Bloomberg US Treasury Forward Curves 2026 Q1
- BondPro Lock-Fee Survey 2024
- S&P Defeasance Methodology 2024
- ABA Commercial Real Estate Lending Survey 2024
- CREFC IRP 2024
- SEC Reg D — Rules 506(b), 506(c); JOBS Act 2012
- Capital Markets Act (Kenya) + AIF Regs 2023; CMSA (Tanzania)
- PPM Standard Template (Schwabe Williamson 2024)
- ILPA Standard Subscription Document v3.0
- ILPA Reporting Template v1.1 (2024)
- NCREIF Reporting Standards 2024
- PERE Waterfall Survey 2024
- NAIOP Real Estate Capital Markets Survey 2024
- ILPA Capital-Call Notice Template 2024
- VirtualVaults 2024 LP Data Room Best Practices
- ILPA Due-Diligence Questionnaire 2.0
