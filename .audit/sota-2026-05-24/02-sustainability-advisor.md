# SOTA 2026 — Sustainability Advisor (ESG + carbon + green finance) for Property Management

Date: 2026-05-24
Scope: world-class state of the art for the `@bossnyumba/sustainability-advisor` package — the systems, frameworks, factor tables, and disclosure regimes any veteran-expert ESG/carbon/green-finance advisor for real estate must know as of May 2026.

Each section lists (a) what the framework is, (b) the *single* SOTA reference / version that matters, (c) the inputs we need to ingest, (d) the calculation surface or scoring shape, (e) the constants / look-up tables our package must encode (with sources), (f) the East-Africa / emerging-market angle where it materially differs.

---

## 1. GHG Protocol — Scope 1, 2, 3 for real estate

- **Framework**: GHG Protocol Corporate Standard (2004, rev 2015) + Scope 2 Guidance (2015) + Scope 3 Standard (2011) + Real Estate sector guidance from CRREM (Carbon Risk Real Estate Monitor) and PCAF (Partnership for Carbon Accounting Financials) v2.0 (Dec 2024) for financed/leased real-estate emissions.
- **Why this version**: PCAF v2.0 + CRREM Pathways v2.04 (Mar 2026) are the de-facto answer for European banks and asset managers — they bound the question of "what does the building emit per m²/yr and when does it stop being aligned with 1.5 °C".
- **Scope 1** — direct on-site combustion + fugitive:
  - Natural gas (heating, hot water, cooking): emission factor 0.18316 kgCO2e/kWh net CV (UK BEIS/DEFRA 2024 conversion factors, updated annually).
  - Diesel for genset / boiler: 2.687 kgCO2e/litre.
  - LPG: 1.557 kgCO2e/kg.
  - Refrigerants (HFC R-410A 2088 GWP100, R-32 675, R-134a 1430, R-1234ze 7) — leak rate × charge × GWP, AR6 GWP100 values (IPCC AR6 WG1, 2021).
- **Scope 2** — purchased electricity:
  - Market-based vs location-based (Scope 2 Guidance 2015). Both reported.
  - Country grid intensities (kgCO2e/kWh, IEA + EmberClimate 2025 data, AR6 GWP):
    - UK 0.207, DE 0.380, FR 0.058, US-avg 0.367, AU 0.620, JP 0.435, KE 0.111, TZ 0.347, UG 0.149, RW 0.255, ET 0.025, IN 0.713, CN 0.582, ZA 0.928, NG 0.439.
  - Renewable energy certificates (REGOs UK / GOs EU / RECs US / I-REC for EM/AF) net-out the market-based intensity.
- **Scope 3** — 15 categories; for property the high-materiality ones are:
  - **C1 purchased goods & services** (capex maintenance, cleaning chemicals, paper)
  - **C2 capital goods** (fit-outs, major refurb)
  - **C5 waste generated in operations** (kgCO2e/tonne by stream: mixed-MSW landfill 467, recycled mixed 21, food waste compost 10, anaerobic digestion 8 — DEFRA 2024)
  - **C6 business travel**
  - **C7 employee commuting**
  - **C8 upstream leased assets** (not material for asset owners — material for tenants)
  - **C11 use of sold products** (n/a for landlords)
  - **C13 downstream leased assets** — THIS is the big one for property: tenant-controlled energy + fuel use. PCAF Standard Part A Method for Real Estate (Mar 2024) is the disclosed accounting boundary.
  - **C14 franchises** + **C15 investments** — for real-estate funds.
- **Embodied carbon (Scope 3 C2 + decommissioning)** — see §3.
- **Ref**: https://ghgprotocol.org/sites/default/files/standards/ghg-protocol-revised.pdf · https://pcafglobal.com/wp-content/uploads/2024/12/PCAF_Standard_Part_A_v2.pdf · CRREM v2.04 Pathways · DEFRA 2024 conversion factors.

---

## 2. Green-building rating systems — input → estimated cert level

Five mainstream + two regional. Each is a *credits-of-credits* scheme — the calculator returns an indicative score band, NOT a guaranteed certificate (those need accredited assessors).

| Scheme | Version | Geo | Bands | Categories |
|---|---|---|---|---|
| **BREEAM** | v7 (UK, 2026-01) | UK + intl. | Pass ≥30, Good ≥45, Very Good ≥55, Excellent ≥70, Outstanding ≥85 | 10: Management, Health&WB, Energy, Transport, Water, Materials, Waste, LandUseEcology, Pollution, Innovation |
| **LEED** | v5 (USGBC, 2025-04) | US + intl. | Certified ≥40, Silver ≥50, Gold ≥60, Platinum ≥80 | 5 impact areas: Decarbonisation, Quality of Life, Ecological Conservation & Restoration, Integrative Process, Innovation |
| **Green Star** | Buildings v1.3 (GBCA, 2024) | AU/NZ | 4★ ≥45, 5★ ≥60, 6★ ≥75 (world-leadership) | 9: Responsible, Healthy, Resilient, Positive, Places, People, Nature, Leadership, Innovation |
| **EDGE** | IFC 2.1 (2024) | EM/AF | EDGE (≥20% in each of E/W/M), Advanced (≥40% energy), Zero Carbon (100% off-set) | 3 dimensions: Energy, Water, Embodied-Materials |
| **CASBEE** | for Buildings 2022 | JP | C, B-, B+, A, S | BEE (Q/L ratio) — Q1-3 (Environmental Quality) / L1-3 (Loadings) |
| **DGNB** | System v2023 | DE/EU | Bronze ≥35, Silver ≥50, Gold ≥65, Platinum ≥80 | 6: ENV, ECO, SOC, TEC, PRO, SITE |
| **EPC** | UK SAP10.2 / EU EPBD-Recast (Dec 2024) | UK / EU | A (≥92) → G (≤20) | kWh/m²/yr + kgCO2/m²/yr |

EDGE is the right default for East Africa — IFC built it for emerging markets, the methodology runs in a browser, and Kenya/Tanzania/Rwanda have certified EDGE auditors.

EU EPBD recast (Dec 2024) tightens minimum energy performance standards (MEPS) — all non-residential ≥ EPC E by 2027, ≥ EPC D by 2030, zero-emission by 2050.

- **Ref**: BREEAM v7 Technical Manual SD250 · LEED v5 BD+C Rating System · EDGE User Guide v3.1 · DGNB System Version 2023 · UK MEES Regulations · EU 2024/1275 (EPBD recast).

---

## 3. Embodied carbon — ICMS 3rd ed, EN 15978, EPDs, One Click LCA, EC3

- **ICMS 3rd ed (Nov 2021)** — RICS International Cost Management Standard, harmonised carbon + cost reporting structure. Defines reporting carbon at L0-L3 (Project → Sub-element).
- **EN 15978:2011** — calculation of environmental performance of buildings (LCA), modules A1-A5 (product + construction), B1-B7 (use), C1-C4 (end-of-life), D (benefits beyond boundary).
- **EPDs** — Environmental Product Declarations per ISO 14025 / EN 15804. Concrete (CEM I) ~410 kgCO2e/m³; CEM III/A ~210 kgCO2e/m³; steel rebar EU avg 1.55 kgCO2e/kg; structural timber CLT -560 kgCO2e/m³ (sequestered, A1-A3 only — released in module C if landfilled / burnt).
- **One Click LCA** + **EC3 Tool (Embodied Carbon in Construction Calculator)** by Building Transparency — open EPD database, default = ~10,000 EPDs covering 95% of common materials.
- **Indicative new-build embodied (RICS WLCA 2023 benchmarks, A1-A5, kgCO2e/m² GIA)**:
  - Residential timber-frame: 350-500
  - Residential concrete-frame: 600-900
  - Commercial office: 700-1200
  - Hospital / labs: 1100-1600
- **Refurbishment** is ALWAYS lower-carbon than demolish-and-rebuild within first 30-50 yrs. UKGBC retrofit-first hierarchy.
- **Ref**: https://www.rics.org/profession-standards/rics-standards-and-guidance/sector-standards/construction-standards/whole-life-carbon-assessment · EN 15978:2011 · EC3 Tool docs · LETI Climate Emergency Design Guide.

---

## 4. GRESB Real Estate Assessment

- **Framework**: GRESB Real Estate Assessment 2026 (released April 2026) — the global ESG benchmark for property funds (~1900 funds, ~$7T AUM at 2025 cut-off).
- **Scoring shape**: 100 pts split into **Management Component (30)** + **Performance Component (70)**.
  - Management: Leadership, Policies, Reporting, Risk Management, Stakeholder Engagement.
  - Performance: Energy, GHG, Water, Waste, Tenant Engagement, Health & Wellbeing, Building Certification.
- **Output**: GRESB Score 0-100, GRESB Star Rating (1-5), peer-group quintile.
- **For property mgmt our `gresb-input-builder.ts` must emit**: like-for-like energy/GHG/water/waste intensities by asset class (office / residential / retail / industrial / hotel) with prior-year comparators, and BMS-coverage %.
- **Ref**: https://www.gresb.com/nl-en/2026-real-estate-assessment

---

## 5. Carbon credit valuation — VCS, Gold Standard, EU ETS, Article 6.4 (PACM)

- **Verra VCS (Verified Carbon Standard)** — largest voluntary registry. Token: VCU (Verified Carbon Unit). Spot ~$3-8/tCO2e for nature-based, $15-50 for engineered removals (May 2026, Sylvera+CarbonPlan ratings).
- **Gold Standard** — premium voluntary tier, co-benefits requirement (SDG alignment). Spot ~$5-12/tCO2e for community projects, $25-80 for removals.
- **EU ETS (Phase IV, 2021-2030)** — compliance market, EUA price ~€78/tCO2e (Q1 2026, ICE Endex). Floor via MSR (Market Stability Reserve).
- **REDD+ / Article 5 Paris** — forestry. Reputational risk peaked 2023 (Verra REDD+ rework). New REDD+ baselines required jurisdictional + remote-sensing MRV (Spatial Inf · Pachama · Sylvera). Use Sylvera grade ≥B as our quality floor.
- **Article 6.4 / PACM (Paris Agreement Crediting Mechanism)** — UN-supervised successor to CDM. Standards adopted COP28-COP30. First A6.4ERs (UN-issued credits) expected Q3 2026. Methodology library focused on additionality + DH (Durable Harm) avoidance.
- **Article 6.2** — bilateral ITMOs (Internationally Transferred Mitigation Outcomes). Switzerland-Ghana / Singapore-Bhutan / Sweden-Dominican Republic are the canonical live deals.
- **For our calculator**: provide injectable `CarbonPriceFeed` port; default stub returns mid-of-band prices for VCS / GS / EUA / A6.4; production adapter pulls from ICE Endex (EUA) + AlliedOffsets / Viridios AI (voluntary mid-market).
- **Ref**: https://verra.org/programs/verified-carbon-standard/ · https://www.goldstandard.org · https://www.ice.com/products/197/EUA-Futures · UNFCCC Article 6.4 Supervisory Body Annual Report 2025.

---

## 6. EU Taxonomy alignment for buildings

- **Reg (EU) 2020/852** + Delegated Acts (Climate DA 2021/2139, Env DA 2023/2486).
- **Six objectives**: 1. Climate change mitigation, 2. CCA (adaptation), 3. Water, 4. Circular economy, 5. Pollution prevention, 6. Biodiversity.
- **Real-estate activities** (NACE L68 / F41):
  - 7.1 Construction of new buildings
  - 7.2 Renovation of existing buildings
  - 7.3 Installation/repair of energy-efficient equipment
  - 7.4 Installation/repair of EV charging
  - 7.5 Instruments for measuring energy
  - 7.6 Renewable energy installation
  - 7.7 Acquisition & ownership of buildings
- **For 7.7 (Acquisition & ownership)** the technical screening criteria require:
  - Built before 2021: EPC ≥ A **OR** top 15% of national stock (kWh/m²/yr).
  - Built after 2021: ≤ 10% less than NZEB threshold.
- **DNSH (Do No Significant Harm)** thresholds for buildings:
  - **Water**: water-use leak fittings ≤ certain L/min (taps 6, showers 8, WCs 6L).
  - **Circular economy**: 70% (by weight) of non-hazardous construction & demolition waste diverted from landfill / incineration.
  - **Pollution**: indoor VOCs from paints/sealants/floor coverings ≤ EU Ecolabel thresholds.
  - **Biodiversity**: not on sensitive land (Natura 2000, IUCN I-IV); EIA done where required.
- **Output of our `eu-taxonomy-alignment.ts`**: boolean (substantial contribution) + DNSH checklist + alignment % (revenue or CapEx eligible/aligned).
- **Ref**: https://eur-lex.europa.eu/eli/reg_del/2021/2139/oj · EU Taxonomy Compass (Commission) · EFRAG ESRS E1.

---

## 7. TCFD + IFRS S1/S2 climate disclosures

- **TCFD** — recommendations published 2017; "disbanded" 2023, work transferred to IFRS Foundation (ISSB). 11 recommended disclosures across 4 pillars: Governance / Strategy / Risk Management / Metrics & Targets.
- **IFRS S1** — General Requirements for Disclosure of Sustainability-related Financial Information (June 2023, effective FY24).
- **IFRS S2** — Climate-related Disclosures (June 2023). **Mandatory in EU & UK from FY26** (1 Jan 2026 onwards), assured for big issuers from FY27. UK FCA TR-30 mirror, EU via ESRS E1 (CSRD).
- **Required for S2** for a property co:
  - Scope 1, 2, 3 GHG emissions (financed emissions for REITs/funds).
  - Cross-industry metrics: emissions, transition risk exposure, physical risk exposure, climate-related capex/opex, internal carbon price.
  - **Industry-specific (SASB Real Estate IF-RE-130 / IF-RE-410 / IF-RE-450)**: site energy consumption by property subsector, % grid electricity, % renewable; like-for-like Scope 1+2; like-for-like water withdrawn; certified GFA %.
  - Scenarios analysed (≥1 °C-aligned scenario — usually IEA NZE 2050 + a >2 °C BAU baseline).
  - Quantified targets + transition plan (TPT Disclosure Framework Oct 2023, adopted by UK Sustainability Reporting Standards SDS 1+2).
- **Ref**: https://www.ifrs.org/issued-standards/ifrs-sustainability-standards-navigator/ifrs-s2-climate-related-disclosures/ · TPT Disclosure Framework (Oct 2023) · ESRS E1.

---

## 8. Biodiversity Net Gain (BNG) + SBTN

- **UK Environment Act 2021** — mandatory BNG from 12-Feb-2024 (TCPA developments) and 02-Apr-2024 (NSIPs from Nov-2025). Min **+10%** biodiversity uplift, secured for **30 years**, measured via **Defra Biodiversity Metric 4.0** (March 2023; minor amendments in 5.0 cons-tracked).
- **Metric units**: biodiversity units = area (ha) × distinctiveness × condition × strategic-significance, with multipliers for habitat creation/enhancement time-to-target and spatial risk.
- **Hierarchy**: avoid → minimise → onsite → offsite → statutory credits (DEFRA, ~£42k per unit Tier A as of 2026, designed to be cost-prohibitive).
- **SBTN (Science Based Targets for Nature)** — initial v1 methods (May 2024). 5-step AR3T framework: Assess → Interpret → Prioritise → Measure-Set-Disclose → Act → Track. First validated nature targets land 2026. Property = land-use change + water + pollution drivers most relevant.
- **TNFD (Taskforce on Nature-related Financial Disclosures)** v1.0 (Sept 2023) — adopted by 500+ orgs; LEAP approach (Locate, Evaluate, Assess, Prepare).
- **Ref**: https://www.gov.uk/guidance/biodiversity-net-gain · https://sciencebasedtargetsnetwork.org · https://tnfd.global.

---

## 9. East-Africa specifics

- **Kenya — NEMA (National Environment Management Authority)** — EMCA (Environmental Management and Coordination Act) 1999 (rev 2015). EIA + Annual Environmental Audit mandatory for buildings >5000 m² GFA. Climate Change Act 2016 amended 2023 → mandatory GHG inventory + climate-action reporting for designated entities, regulated by CCD (Climate Change Directorate). Kenya Carbon Markets Regulations 2024 (under Climate Change Act, gazetted May 2024) — establishes National Carbon Registry, 25% Land-based / 40% non-Land-based community benefit share.
- **Tanzania — NEMC (National Environment Management Council)** — EMA 2004. EIA & Audit Regulations 2005 + 2018 amendments. Climate Change Strategy 2021-2026.
- **Uganda — NEMA** (different from KE) — National Environment Act 2019. Climate Change Act 2021.
- **Rwanda — REMA**, NDC commits to 38% emissions reduction by 2030 (most ambitious in EAC). Green Building Minimum Compliance System (GBMCS) mandatory since 2019 — EDGE-aligned.
- **EAC Climate Change Policy 2010** + EAC Climate Change Master Plan 2011-2031 + recently EAC Climate Change Bill 2024 (under EALA debate as of Q1 2026).
- **Mobile-money carbon offsets**:
  - **M-PESA Green** (Safaricom 2024) — micro-offsets through Verra-registered Kenyan cookstove + reforestation projects via M-Pesa pay-bill; UI delivered through Safaricom super-app.
  - **Komaza, Wildlife Works, Sustainable Travel International** — registered Kenyan project developers issuing VCUs.
  - **Selva Carbon, Cecaño** — voluntary offset platforms with M-PESA / MTN MoMo rails for EAC.
- **Stock-exchange listings**: NSE (Nairobi) Sustainability Disclosure Guidelines 2021 — voluntary; CMA-K issued 2023 Green Bond Listing Rules; Acorn Holdings (East Africa's largest student-housing developer) issued KES 4.3B green bond 2019, re-tapped 2023.
- **Ref**: NEMA-KE website; Kenya Climate Change Act 2023 amendment; Acorn ASA Green Bond Framework v2 (2023).

---

## 10. Nature-based Solutions (NbS) for property management

IUCN Global Standard for NbS (v1.0, 2020) — 8 criteria, 28 indicators. For property the bankable NbS interventions:

| Intervention | Primary benefit | Cost (£/m² or £/unit, 2026 GB indicative) | Carbon (kgCO2e/m²/yr seq.) | Biodiversity uplift % |
|---|---|---|---|---|
| Intensive green roof | Cooling, stormwater, biodiv | £180-£300/m² | 4-8 | 50-150% |
| Extensive green roof (sedum) | Stormwater, urban-heat | £80-£140/m² | 2-4 | 20-50% |
| Urban tree (large canopy) | CO2 seq, cooling, well-being | £350-£900/tree (10y CapEx incl. mgmt) | 8-25/tree | habitat unit per 4-6 trees |
| Permeable pavement | Stormwater attenuation, recharge | £75-£140/m² | n/a (avoided concrete) | low |
| SuDS (rain garden / bioretention) | Stormwater + biodiversity + water-quality | £40-£100/m² | 3-7 | 30-80% |
| Green wall (modular) | Cooling, air quality, well-being | £400-£700/m² | 4-9 | 20-60% |
| Constructed wetland | Stormwater, water-quality, BNG units | £80-£200/m² | 6-12 | 200-500% |
| Pollinator corridor (wildflower strip) | Biodiversity, BNG | £15-£40/m² | 1-2 | 50-200% |

- **NbS recommender** should rank by **£/biodiv-unit + carbon co-benefit + climate-risk reduction** for the input property's climate zone (Köppen-Geiger). EAC contexts: prioritise SuDS + indigenous tree planting (Acacia spp., Markhamia lutea, Cordia africana) and rooftop rainwater harvesting (statutory in Nairobi since 2021).
- **Ref**: IUCN Global Standard for NbS v1.0 · UKGBC Nature-based Solutions Guide (2024) · NbS Initiative (Oxford) Evidence Platform.

---

## 11. Decision summary for the package

1. **Be a calculator, not a certifier**. Output bands + percent-likelihood, never claim a cert.
2. **Pure functions everywhere**. Inject factor tables; never hard-code per call.
3. **Multi-jurisdiction by construction**. Country code drives grid intensity, EPC scheme, EIA threshold.
4. **EAC + EM-first defaults** — but every constant exposed for override (TZ NEMC threshold ≠ KE NEMA threshold).
5. **Disclose everything**. Reports cite which factor table + version were used (auditability).
6. **Composable**. Each calculator returns a typed report fragment; the advisor module aggregates with explainable narrative.

End of research file.
