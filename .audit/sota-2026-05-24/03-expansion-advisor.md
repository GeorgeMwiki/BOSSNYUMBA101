# Expansion Advisor — SOTA 2026-05-24

Veteran-expert real-estate-development advisor: feeds a single
parcel (plus market context) through Appraisal-Institute-grade
HBU, market-absorption, capital-stack, and lease-up analyses,
returns a ranked set of expansion opportunities with a defensible
narrative.

## 1. Highest-and-Best-Use (HBU)

Authority: **Appraisal Institute** — *The Appraisal of Real
Estate* (15th ed.), 4-test framework.

| Test                  | What we check                                  |
|-----------------------|-------------------------------------------------|
| Legally permissible   | Zoning, FAR, setbacks, overlays, entitlements   |
| Physically possible   | Slope, soils, utilities, frontage, access       |
| Financially feasible  | Positive NPV @ market discount, IRR > hurdle    |
| Maximally productive  | Highest residual land value / yield-on-cost     |

Each test runs as a *gate*: if a use fails it, it is dropped
before the next test (per AI methodology). Only the survivors
are ranked by `maximally-productive`.

## 2. Market absorption forecast

- Months-of-supply (MOS) = `active_inventory / monthly_absorption`
- Velocity = units leased or sold per month
- Comparable absorption curves (Logistic / Bass diffusion)
- Source models: **CoStar**, **JLL Africa H1/H2**, **Knight Frank
  PIRI**, **Estate Intel** (Lagos), **Knight Frank Nairobi /
  Kampala / Dar es Salaam reports**

Output: probabilistic absorption curve `P(t)` so cash-flow
modelling can use stochastic lease-up.

## 3. Capital stack (4 tiers)

Per CRE convention (NCREIF, ULI, PERE):

1. **Senior debt** — 50–65 % LTC, 5.5–7.5 % rate, 1.20–1.30 DSCR.
2. **Mezzanine** — 10–20 % LTC, 9–13 % rate, intercreditor.
3. **Preferred equity** — 8–12 % pref, no compounding above stack.
4. **Common equity** — promote / waterfall.

Constraints enforced: DSCR ≥ floor, ICR ≥ floor, LTC ≤ ceiling,
LTV ≤ ceiling, yield-on-cost ≥ market spread over going-in cap.

## 4. Lease-up curves

Per asset class (sources: NMHC, NAIOP, ICSC):

| Asset class   | Typical stabilised vacancy | Lease-up months |
|---------------|----------------------------|------------------|
| Multifamily   | 5 %                        | 9–18             |
| Office (CBD)  | 12 %                       | 18–36            |
| Retail (NC)   | 7 %                        | 12–24            |
| Industrial    | 4 %                        | 6–12             |

Curve = logistic with class-specific midpoint & steepness.

## 5. REIT comparables

- **FFO** = Net income + depreciation + amortisation − gains on
  sale.
- **AFFO** = FFO − recurring capex − straight-line rent
  adjustments.
- **NAV** = (NOI / cap-rate) + cash − debt − pref.
- Sector multiples: Multifamily ~22× AFFO, Industrial ~28×,
  Office ~14×, Retail ~16× (2026 Greenstreet/Nareit).

## 6. Value-add scoring

Weights (calibrated to 2026 institutional underwriting):

- Rent-to-comp gap (40 %): `(comp_rent − in_place_rent) / comp_rent`
- Turnover headroom (25 %): `annual_turnover` × `mark_to_market`
- Expense-ratio efficiency (20 %): `(comp_OER − actual_OER)`
- Capex catch-up potential (15 %)

## 7. Neighborhood gentrification index (8 axes)

DataDelve / AEM / Knight Frank-inspired. Each axis 0–1, weighted
mean. Higher = more gentrification.

| Axis                     | Weight |
|--------------------------|--------|
| Median income trajectory | 0.15   |
| Educational attainment   | 0.10   |
| New-build permit density | 0.15   |
| Coffee / cafe density    | 0.10   |
| Crime-rate decline       | 0.10   |
| Rent growth velocity     | 0.15   |
| Owner-occupier share     | 0.10   |
| Transit accessibility    | 0.15   |

## 8. Zoning leverage

Three lever scores (0–1):

- **Variance** — likelihood of approval × delta-in-residual.
- **Upzone** — current-FAR vs corridor-target-FAR.
- **Mixed-use overlay** — premium over single-use yield.

## 9. Comparable-sales triangulation

Per CBRE / Cushman / JLL methodology:

1. Filter comparables (≤ 18 mo, ≤ 1 mi, ±25 % size, same class).
2. Drop outliers (Tukey 1.5 × IQR on $/sf).
3. Weight by recency, distance, and quality similarity.
4. Triangulated value = weighted median × confidence interval.

## 10. East Africa (EA) overlays

Sources used as bench-marks (no live feeds inside package):

- **Knight Frank Africa Wealth Report** (HNWI density)
- **JLL Africa H1 / H2** (cap-rate snapshots)
- **Estate Intel** — Lagos absorption + pricing
- **Knight Frank Nairobi / Kampala / Dar es Salaam** city reports
- **Cytonn Quarterly Market Reports**

EA-specific corrections applied (multiplier overrides exposed as
`marketOverrides` in `ExpansionInputs`).

## 11. Land banking / bareland appreciation

City-edge curves following the classic concentric-zone Burgess
model + modern modifications (von-Thunen rent gradient, accessible
employment surface). Inputs: distance-from-CBD, distance-from-
trunk-road, infra-pipeline overlap (5 / 10 yr), zoning-elasticity.
