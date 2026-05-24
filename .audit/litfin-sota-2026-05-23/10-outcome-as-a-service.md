# Outcome-as-a-Service — SOTA 2026 Research

**Date**: 2026-05-23
**Subject**: BOSSNYUMBA101 evolution from tool-sale to outcome-sale
**Frame**: "AI runs your entire property management — we charge per filled vacancy, per ticket resolved, per dollar collected, per inspection done, per evicted-tenant-who-paid, per percentage point of renewal rate."

---

## Executive Frame

The 2026 SaaS-to-services migration is real and material. Bessemer's playbook (BVP, Feb 2026) tracks 200+ AI vendors and reports **hybrid pricing rose from 27 percent to 41 percent adoption in 12 months while pure per-seat fell from 21 percent to 15 percent**. Sequoia's "Services: The New Software" thesis (Pat Grady, Sonya Huang — 2026: This Is AGI) frames the prize: for every $1 spent on software, $6 is paid to people doing the work. That $6 trillion services pool is what outcome-priced agents are eating.

But the cautionary tale matters: **Klarna fully reversed its 700-agent AI replacement in mid-2025** after CSAT collapsed on the long tail. CEO Sebastian Siemiatkowski publicly called human CS a "VIP thing" the firm now reinvests in. The lesson: outcome-sale only works when (a) you can measure the outcome unambiguously, (b) you have a credible escalation contract for the tail, and (c) you carry the financial risk when the AI is wrong.

---

## 1. Outcome-Priced Agentic Companies (May 2026)

### 1.1 Sierra — per-resolved-conversation, bespoke contracts

- **Funding**: $950M Series C / E at $15.8B valuation (May 2026)
- **Model**: Bespoke outcome contracts. No public price list. Per-customer success metrics: time-to-resolution, purchase conversion, CSAT, NPS.
- **Indicative economics**: $50K-$200K setup fee, ~$150K annual floor, year-one budgets $200K-$350K+
- **What "resolution" means is the single most consequential clause**: a one-shot FAQ vs a multi-step identity-check + account-action is the same SKU but very different cost basis. Sierra negotiates these definitions per contract.
- **Infra**: real-time deflection telemetry, evals on every conversation, escalation lanes to human agents.
- **For BOSSNYUMBA**: pattern for "per ticket resolved" — but the resolution definition is harder for property tickets (a "leaky tap fixed" requires a real-world handyman, not just a chatbot turn).

### 1.2 Decagon — per-resolution + per-conversation hybrid

- ~$0.50 per resolution at the per-resolution tier; ~$50K annual platform fee
- Median annual contract (Vendr data): $386K, range $95K-$590K+
- SLA terms negotiate on uptime, channel mix (voice costs more than chat), workflow depth (refunds vs basic Q&A)
- **Gray-area billing** is the central operational risk: when is a resolution a "resolution"? Decagon and Sierra both lose contracts on this.

### 1.3 11x — per-meeting-booked (per-SDR-replacement)

- ~$5K-$15K/mo; median annual contract $40K
- Implied per-meeting cost $30-$150 depending on outreach volume
- 12-month annual commitments; enterprise quote-only
- **Architecture pattern**: priced against the human SDR ($90K/yr fully loaded), but contracted on email contacts in scope (3,000 emails @ $5K/mo). Outcome layer (meetings booked) is the marketing pitch, the contract is volume.

### 1.4 Cognition Devin — per-Agent-Compute-Unit, outcome-validated

- **Core plan**: $20/mo + $2.25/ACU pay-as-you-go
- **Team plan**: $500/mo, 250 ACUs at $2.00 each
- **Performance**: 67% of Devin PRs merged in 2025 (up from 34%). On well-defined tasks like migrations: 67% merge rate; on complex/ambiguous: 85% failure without human help.
- **Reported wins**: 5-10% of total dev time saved on security fixes at one large org; 20x speedup on vulnerability triage (30 min human → 1.5 min Devin).
- **Pricing lesson**: started at $500/mo flat → moved to $20/mo + usage → outcome metric (PRs merged) is the marketing claim, billed unit is compute. Same pattern as 11x.

### 1.5 EvenUp — per-case (was per-demand)

- May 2025: introduced **per-case pricing** as the canonical SKU (replacing per-demand)
- Indicative: $300 base per demand, often $500-$800+ with add-ons
- **Why the shift**: per-demand bred over-counting and disputes; per-case aligns to how PI firms actually buy
- Mirror for BOSSNYUMBA: **per-property/month** (not per-lease-action) is likely the durable SKU

### 1.6 Harvey — per-seat enterprise, exploring per-task

- ~$1K-$1.2K/seat/mo; 25-50 seat minimum; $30K-$300K+ annual
- Enterprise legal AI; pricing intent moving toward per-contract-reviewed, per-research-task hybrids
- No public outcome-only tier as of May 2026

### 1.7 Hippocratic AI — per agent-hour ($9/hr)

- $9/hr → $216/day → $6,480/mo for 24-hour coverage
- 8M+ patient calls/month (May 2026); 115M cumulative interactions by Oct 2025
- Polaris safety arch validated by 7,500+ licensed clinicians
- **$141M Series B** raised, unicorn status
- **Pricing lesson**: agent-hour is the closest analog to a human FTE; predictable per-shift but expensive at scale. Buying cycle compressed from 18 months → 8 weeks at enterprise tier.

### 1.8 Maven AGI — resolution-optimized, per-quote pricing

- Optimizes for "resolution rate" (problem actually solved), not "ticket deflection"
- 80-93% resolution rates across industries
- Case study (K1x): cost per ticket $40 → $8 (80% reduction)
- No public per-resolution price; custom quote

### 1.9 Replicant (now in Genesys ecosystem) — outcome-based voice

- $200K-$500K+ annually for mid-size IVR replacement
- $30K-$75K year-1 implementation
- Custom enterprise outcome pricing (per completed work / resolution)
- Integrates with Genesys, Five9, Amazon Connect, Talkdesk

### 1.10 Klarna AI customer service — cautionary tale

- **Feb 2024**: replaced 700 CS agents with OpenAI agent. 2.3M chats month 1, resolution time 11min → 2min, projected ~$40M savings
- **Mid-2025**: reversed strategy. Hallucinations on ~5% of edge cases, CSAT drop on emotional/complex tickets, compliance issues on disputes
- **CEO quote**: human CS now a "VIP thing"
- **Lesson for outcome-sale**: vendors who promise full replacement carry full risk. Hybrid models with explicit tail-escalation contracts survive.

### 1.11 CrewAI — per-execution platform

- Free: $0/mo (50 executions); Pro: $25/mo (100 executions); Enterprise: custom
- Overages: $0.50/execution
- 450M agentic workflows/month, 2B executions in 12 months
- 60% of Fortune 500 trust
- **Pattern**: pure activity-based pricing, but at the "complete crew kickoff" abstraction (not per-token). This is **Stage 2: Workflow** in Sequoia's maturity curve.

### 1.12 Intercom Fin

- $0.99/ticket resolved (per Bessemer's playbook)
- Pure outcome pricing at the simplest end of the spectrum

---

## 2. Pricing & Metering Patterns

### 2.1 Sequoia's Pricing Maturity Curve

| Stage | Unit | Examples | Risk profile |
|-------|------|----------|--------------|
| **1. Activity** | Per API call, token, action | CrewAI Free, raw LLM APIs | Commoditizes fast |
| **2. Workflow** | Per completed task | CrewAI Pro ($0.50/execution), Devin ($2.25/ACU) | Buyer-friendly |
| **3. Outcome** | Per successful result | Sierra, Decagon, Intercom Fin ($0.99/ticket), EvenUp per-case | Max alignment, max variance |
| **4. Agent** | Per deployed agent | 11x ("$20K/agent" benchmarked vs $90K SDR), Hippocratic ($9/hr) | Targets headcount budgets |

Companies should advance stages when facing margin pressure, value-pricing gaps, or customer demand for outcomes. Most successful 2026 cohort lives at **Stage 3+4 hybrid**.

### 2.2 Bessemer's Hybrid Formula (BVP Playbook 2026)

```
Platform fee (~2x calculated delivery costs) + outcome credits
```

Worked example:
- $12K annual platform fee
- Includes 100 resolutions
- Overages: $5K per 100 tickets

**Why hybrid wins**: predictable floor for buyer, upside for vendor, doesn't expose either party to pure outcome-variance. Hybrid adoption: 27% → 41% in 12 months across 200+ AI vendors tracked by BVP.

### 2.3 Shadow-mode pilot → conversion

Brightlume's framework (March 2026) is the canonical pattern:

**Phase 1 (Wk 1-2)**: isolated execution env, input mirroring, decision log DB
**Phase 2 (Wk 3-8)**: shadow on high-volume/low-risk first, weekly calibration, capture human reasoning on disagreements
**Phase 3 (Wk 9-12)**: graduated responsibility, stratified review (100% high-stakes, 10% medium, 0% low-stakes), rollback triggers pre-agreed

**Conversion gates**:
- ≥85% agreement rate
- Zero critical policy violations in last 500 decisions
- Confidence correlation ≥0.7
- Minimum 5,000-10,000 decisions processed
- Stakeholder sign-off (business, compliance, ops)

**Result**: orgs that run proper shadow modes have **85%+ success rate on production cutover**. Most pilots fail because they skip this — 85% of enterprises pilot, only 5% reach production.

### 2.4 Success-fee + retainer (contingency-style)

Most AI agency contracts in 2026:
- **Retainer**: $2K-$15K/mo for access, monitoring, baseline support
- **Outcome bonus**: per-lead, per-meeting, per-resolution layered on top
- **"Role + Outcomes"** = contingency model (lawyers' analog)
- **"Access + Outcomes"** = predictable floor + upside

### 2.5 The "AI-as-employee" pricing thesis

The pitch: "We'll replace 70% of your CS team for 30% of cost."

- 11x prices Alice at ~$20K-$60K/yr, benchmarked vs $90K SDR
- Hippocratic at $9/hr is benchmarked vs $30+/hr human nurse callbacks
- Anti-cannibalization: enterprise contracts increasingly include **"AI hiring freeze"** clauses where the customer agrees not to fire all humans in scope while the AI ramps, and the vendor agrees not to displace beyond a contracted percentage
- **Regulatory headwind**: May 2026 Hangzhou Intermediate People's Court ruling — companies cannot fire employees solely to replace with LLMs (PRC). EU: Algorithmic Impact Assessment required for any deployment affecting >10% of workforce duties.
- US: Illinois AI in Employment law (Jan 1, 2026) — anti-discrimination obligations when AI affects hiring/promotion.

---

## 3. SLA Architecture for Outcomes You Don't Fully Control

### 3.1 Confidence-band routing (industry standard, May 2026)

```
confidence > 0.95   → auto-process, no audit trail required
0.70 ≤ conf ≤ 0.95  → auto-process, full audit trail
confidence < 0.70   → human escalation
```

### 3.2 SLA lane by risk tier

| Risk | Lane | SLA |
|------|------|-----|
| Low-risk action | 15 seconds | Auto-decide |
| PII access | 2 minutes | Human acknowledgment |
| Financial disbursement | 15 minutes | Human approval |

(Reference: AlignX / Galileo / Strata 2026 human-in-loop guides)

### 3.3 Outcome SLAs (BPO-style, per Mayer Brown Feb 2026)

Replace SaaS uptime metrics with **business results**:
- **Accuracy**: "99% of invoices processed correctly"
- **Timeliness**: "99% of tickets actioned within service window"
- **Satisfaction**: "<1% of autonomous actions lead to complaints"

### 3.4 Refund / clawback for failed outcomes

- Intercom Fin: no resolution → no charge
- Sierra/Decagon: bespoke clawback clauses tied to CSAT thresholds
- Replicant: outcome-only billing for some enterprise contracts

### 3.5 EU AI Act enforcement (August 2026)

Agentic AI in healthcare, credit, employment, critical infrastructure = **high-risk**. Confidence thresholds, escalation triggers, compliance controls must be architected in, not bolted on.

---

## 4. Measurement Infrastructure

### 4.1 Three ROI dimensions (industry standard 2026)

- **Completion ROI**: throughput (tickets handled, calls placed)
- **Outcome ROI**: business impact (revenue collected, vacancies filled)
- **Composite Agent Value**: outcomes × quality / cost

### 4.2 Counterfactual baselines

- **Naive A/B**: AI cohort vs human cohort, controlling for property type / market
- **Synthetic counterfactual**: train a model on pre-AI period, predict what would have happened, measure delta
- **Causal attribution research (May 2026)**:
  - CAIR (Counterfactual-based Agent Influence Ranker, arXiv 2510.25612) — per-agent influence on agentic workflow outputs
  - Counterfactual Credit Policy Optimization for multi-agent collaboration (arXiv 2603.21563)
- **In multi-agent**: naive per-agent credit double-counts value. Shared-credit or critical-path attribution keeps the math honest.

### 4.3 Outcome graph

```
input event → agent action(s) → real-world effect → measured outcome → billing event
                                       ↑
                              causal attribution model
```

Every action gets a **stamp of completion**: signed log entry (agent ID, action, timestamp, confidence, downstream effects observed).

---

## 5. Legal / Contracting Architecture (BPO-style)

Per Mayer Brown (Feb 2026), agentic AI contracts shift from SaaS-licensing to BPO-services. Six critical clause types:

1. **Service Definition & Scope** — explicit "can do" / "cannot do" lists, mandatory HITL triggers
2. **Performance Warranties** — "performed in a good, professional, diligent, workmanlike manner" + adherence to delegation boundaries
3. **Outcome SLAs** — accuracy, timeliness, satisfaction (above)
4. **Indemnification** — provider indemnifies customer for third-party claims from autonomous agent actions, carve-outs for customer misconfiguration / bad data
5. **Governance & Audit Rights** — decision-log access, formal SLA performance assessment
6. **Data Ownership** — customer owns inputs/outputs; vendor prohibited from training on customer data without consent

**Liability caps**: increasingly tied to **provider's professional indemnity insurance limits**.
**Algorithmic bias**: explicitly carved into indemnification (esp. fair-housing exposure for property mgmt).

### 5.1 Property-management licensing (TZ/KE/NG)

- **Kenya**: Estate Agents Registration Board (EARB) per Estate Agents Act 1984 Cap 533. Requires ISK Full Membership in Valuation & Estate Management Chapter (degree/diploma + 2 yrs supervised practice). **Implication for BOSSNYUMBA**: cannot operate as licensed agent itself in KE; must contract with EARB-licensed firm or position as software/service-bureau to licensed firms.
- **Tanzania**: less mature regulatory regime as of May 2026; Tanzania Real Estate Regulatory Authority and Valuers Registration Board (VRB) handle subsets. BOSSNYUMBA can operate B2B with licensed valuers and registered estate firms.
- **Nigeria**: NIESV (Nigerian Institution of Estate Surveyors and Valuers) governs estate practice. Real Estate Developers Association (REDAN) and ESVARBON registration apply. Same B2B-to-licensed pattern.

**Operational implication**: BOSSNYUMBA's outcome-as-a-service offer in all three markets must run **through** licensed local agents — vendor is the AI/SaaS infra, licensee carries the regulatory bag. Revenue share splits naturally between AI infra fee (us) and licensee retainer (them).

---

## 6. AI-as-Employee Pricing Specifics

- **Seat-replacement benchmark**: AI agent priced at 20-40% of fully loaded human FTE
- **Anti-cannibalization clauses**: vendor commits not to displace beyond X% of in-scope role; customer commits to retain Y% human floor during ramp
- **"VIP human" carveout**: post-Klarna, contracts increasingly carve out a named segment (high-value tenants, complex disputes) that stays human even after full AI deployment
- **Job-replacement law (2026)**:
  - China (Hangzhou): cannot fire to replace with LLM
  - EU: AIA for >10% workforce impact
  - Illinois: anti-discrimination obligations for AI hiring/promotion
  - GSA (US federal): new AI clause requirements for contractors

---

## 7. Property-Management-Specific Outcome Metrics

Industry-standard KPIs (per Revela, Pacific ABS, Buildium, Cove 2026 surveys):

| Metric | Target | Why it matters | BOSSNYUMBA monetization unit |
|--------|--------|----------------|------------------------------|
| **Occupancy rate** | ≥95% residential | Direct revenue | Per occupied-unit-month |
| **Days vacant** | <30 days residential | Vacancy cost is direct loss | Per day reduced below benchmark |
| **Collection rate** | >98%/month | Cash flow integrity | % of incremental collected above baseline |
| **Renewal rate** | 60-70%+ | Turn cost avoidance ($2-5K/turn) | Per renewed lease |
| **Delinquency rate** | <2% | Bad debt | Per dollar recovered |
| **Maintenance backlog** | <14 days | Tenant retention | Per ticket resolved within SLA |
| **Avg completion time** (work orders) | <72h non-emergency, <4h emergency | Tenant CSAT | Per ticket within SLA |
| **Repeat work orders** | <10% | Quality of fix | Per "first-time-fix" rate point |
| **NOI** | property-specific | Owner value | % of incremental NOI |
| **Operating expense ratio** | 35-45% | Owner value | Per ppt reduction |
| **Make-ready cost per turn** | $1.5-5K | Margin | Per dollar saved vs baseline |
| **Budget variance** | <5% | Owner trust | Per ppt accuracy improvement |

Industry baseline: total revenue per door **$150-$250/mo**; if you're below $130/door you're leaving money on the table. Residential mgmt fees 8-12% of collected rent; commercial 3-6%.

---

## 8. Process Control Loops for Long-Running Outcomes

Outcomes like "vacancy filled in 25 days" or "rent collected on the 5th" are **7-30 day horizons**, not one-turn tasks. Industry stack (May 2026):

- **Temporal**: macro-level workflow orchestration. Durable execution across infrastructure events. Guarantees workflow code runs to completion.
- **LangGraph**: micro-level agent reasoning. Directed cyclic graphs, state, branching.
- **Hybrid pattern**: Temporal workflow activity spins up LangGraph agent for a reasoning-intensive subtask, returns result, Temporal decides next step.
- **Claude Agent SDK** (Anthropic): control-loop primitives, pairs natively with Temporal for durable execution.
- **Other frameworks tracked 2026**: Dagster, CrewAI, AutoGen, OpenAgents.

**For BOSSNYUMBA**: a "vacancy-fill" outcome spans listing creation → marketing → showings → applicant screening → background check → lease signing → move-in inspection. This is a Temporal workflow with LangGraph nodes for the reasoning-heavy parts (applicant ranking, lease drafting).

---

## 9. Failure-Mode Insurance (Emerging 2026)

### 9.1 Armilla (Lloyd's Coverholder)

- **Armilla Guaranteed** warranty product — backed by Chaucer, Greenlight Re, Swiss Re
- **AI Performance Warranty**: triggers compensation if **accuracy drops below verified thresholds**
- **AI Liability Policy** (expanded 2026): up to **$25M per organization**
- Covers: AI model error liability, harmful outputs, AI agent failures, AI-driven property damage, EU AI Act / Colorado AI Act defence costs
- **Vanguard AI** (Chaucer + Armilla, Feb 2026): combined cyber + tech E&O + AI liability single coordinated coverage
- **$25M raise** Jan 2026

### 9.2 Munich Re aiSure

- **Parametric structure** for fast objective claims on AI performance failures
- Partnered with Mosaic Insurance
- Targets AI vendors and deployers

### 9.3 Market context

- Global parametric insurance market: $20-24B in 2026 (~13% CAGR)
- 95% generative AI pilot failure rate is now an actuarial reality for E&O / D&O carriers
- 57% YoY increase in documented AI incidents

**For BOSSNYUMBA**: an outcome-priced offer becomes underwritable. The premium becomes a line item in the contract (or absorbed by vendor margin), but it converts unbounded liability into a known cost.

---

## 10. Outcome Catalog for Property Management (20+ outcomes)

Proposed pricing units, ordered by ease of measurement / monetization:

| # | Outcome | Pricing unit | Floor / Cap | Measurement source |
|---|---------|--------------|-------------|--------------------|
| 1 | **Ticket resolved within SLA** | $5-15 per ticket | Cap at 95% of human cost ($40 baseline) | work-order system, tenant confirmation |
| 2 | **Rent collected** | 1-3% of collected amount | Min retainer $200/property/mo | bank reconciliation |
| 3 | **Vacancy filled** | 0.5-1 month rent equivalent | Per executed lease | signed lease + move-in |
| 4 | **Renewal secured** | $100-300 per renewal | Per signed renewal | signed renewal agreement |
| 5 | **Applicant screened (compliant)** | $25-50 per screen | Pass-through cost + margin | credit/background check completion |
| 6 | **Inspection completed** | $50-150 per inspection | Per signed report | inspection report + photos |
| 7 | **Delinquency cured** | 5-15% of recovered amount | No recovery, no fee | bank reconciliation |
| 8 | **Eviction processed (to completion)** | $500-1500 per case | Per filing + per execution | court records |
| 9 | **Lease drafted + executed** | $50-150 per lease | Per countersigned lease | document hash |
| 10 | **Compliance filing submitted (LHA, tax, utility)** | $25-100 per filing | Per filing receipt | regulator confirmation |
| 11 | **CSAT point improvement** | $X per ppt above baseline | Quarterly true-up | tenant survey |
| 12 | **Reduction in days-vacant** | $20-50 per day reduced vs market benchmark | Per property per month | listing + lease dates |
| 13 | **NOI improvement** | 10-20% of incremental NOI | Annual true-up | accounting integration |
| 14 | **Maintenance cost reduction** | 20-30% of savings vs prior 12mo | Annual true-up | accounting integration |
| 15 | **Tenant communications handled** | $0.50-1.50 per resolved thread | Cap 90% of human CS cost | conversation log + tenant signal |
| 16 | **Marketing impression / lead generated** | $5-20 per qualified lead | Per qualified lead | CRM signal |
| 17 | **Showings booked** | $10-30 per held showing | Per attended showing | calendar + check-in |
| 18 | **Move-in / move-out completed** | $50-200 per turn | Per signed turn checklist | inspection + handover |
| 19 | **Vendor dispatched + work verified** | $5-25 per dispatch | Per closed work order | vendor invoice + tenant confirmation |
| 20 | **Insurance claim filed/recovered** | 5-10% of recovered amount | No recovery, no fee | insurer payout |
| 21 | **Utility bill optimization** | 25% of savings vs prior 12mo | Annual true-up | utility statements |
| 22 | **Owner report generated + delivered** | $5-15 per report | Per acknowledged report | owner portal acknowledgment |
| 23 | **Compliance violation prevented** | $50-500 per prevented citation | Per agent-detected risk → owner-acted | compliance audit log |

**Headline SKU bundles**:

- **"Full Door"** (most properties): $X per occupied-unit-month with capped outcomes basket (tickets, communications, screening, reports). Aligns with industry $150-250/door benchmark.
- **"Vacancy Filler"** (turn periods): success fee = 0.5 month rent equivalent per filled vacancy.
- **"Cash Guard"** (collections-heavy portfolios): 1-3% of collected rent + 10% of recovered delinquency.
- **"Renewal Maximizer"** (quarterly): % of renewal-rate increase × portfolio rent roll.

---

## 11. Reference Architecture: Agents → Outcomes → Metering → Billing → Escalation

```
┌───────────────────────────────────────────────────────────────────┐
│                    EVENT BUS (NATS / Kafka)                        │
│  rent.payment.received, ticket.opened, lease.signed, etc.          │
└──────────────────┬─────────────────────────────────────────────────┘
                   │
       ┌───────────┼───────────┬─────────────┬──────────────┐
       ▼           ▼           ▼             ▼              ▼
   ┌───────┐  ┌────────┐  ┌────────┐   ┌──────────┐  ┌──────────┐
   │Vacancy│  │Ticket  │  │Collect │   │Inspection│  │Renewal   │
   │Agent  │  │Agent   │  │Agent   │   │Agent     │  │Agent     │
   └───┬───┘  └───┬────┘  └───┬────┘   └────┬─────┘  └────┬─────┘
       │          │           │             │             │
       │   Temporal Workflows (durable, 7-30 day horizons) │
       │   LangGraph nodes inside each for reasoning       │
       │                                                    │
       ▼          ▼           ▼             ▼             ▼
   ┌────────────────────────────────────────────────────────┐
   │           CONFIDENCE-BAND ROUTER                       │
   │  >0.95 auto │ 0.70-0.95 audit │ <0.70 escalate         │
   └─────────────────────────┬──────────────────────────────┘
                             │
              ┌──────────────┴──────────────┐
              ▼                             ▼
        ┌──────────┐                 ┌──────────────┐
        │ AUTO     │                 │  HUMAN-IN-   │
        │ EXECUTE  │                 │  LOOP QUEUE  │
        └─────┬────┘                 │ (SLA-bound)  │
              │                      └──────┬───────┘
              │                             │
              └──────────────┬──────────────┘
                             ▼
                  ┌──────────────────────┐
                  │  OUTCOME LEDGER      │  ← stamp of completion
                  │  (immutable log)     │  ← causal attribution
                  └──────────┬───────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
        ┌─────────┐    ┌──────────┐   ┌─────────────┐
        │ METER   │    │ EVIDENCE │   │ COUNTERFACT-│
        │ ENGINE  │    │ ARCHIVE  │   │ UAL BASELINE│
        └────┬────┘    └──────────┘   └─────────────┘
             │
             ▼
        ┌─────────────────────────┐
        │  BILLING / CLAWBACK     │
        │  Stripe + ledger ops    │
        │  per-outcome SKU rules  │
        └────────────┬────────────┘
                     │
                     ▼
        ┌─────────────────────────┐
        │  WARRANTY / INSURANCE   │  ← Armilla AI Performance
        │  Trigger if SLA breach  │  ← Munich Re aiSure parametric
        └─────────────────────────┘
```

Key invariants:

- Every outcome event must have a **signed stamp of completion** (agent ID, evidence hash, timestamp, confidence, downstream effect)
- Every billing event must be **clawback-reversible** until the outcome stabilizes (e.g., 14-day window for "ticket resolved" — if it reopens, clawback)
- Every escalation must be **SLA-bound** with named accountable humans
- Every counterfactual baseline must be **owner-visible** so the customer can audit attribution

---

## 12. 10 Concrete Things to Build in BOSSNYUMBA to Support Outcome-Sale

### 1. Outcome Ledger Service (`@bossnyumba/outcomes`)
Immutable append-only log of outcome events. Schema: `{ outcomeType, propertyId, tenantId?, agentId, evidenceHash, confidence, timestamp, stabilityWindow, billingStatus }`. Postgres + WORM bucket for evidence. **Must exist before any per-outcome billing can be charged.**

### 2. Stamp-of-Completion (`packages/agent-attestation`)
Every agent action emits a signed envelope: input, action, confidence, downstream observables. Ed25519 keys per agent. Verifiable in customer audit. Reuses existing audit infra.

### 3. Confidence Router (`packages/confidence-router`)
Three-band routing (>0.95 / 0.70-0.95 / <0.70). Configurable per outcome type, per tenant, per property class. SLA-bound queues for human review.

### 4. Temporal Workflows for Long Outcomes (`apps/orchestrator`)
Vacancy-fill, renewal-secure, eviction-process — all multi-week. Temporal cluster with workflow versions for safe rollout. LangGraph nodes for the reasoning hops.

### 5. Counterfactual Baseline Engine (`packages/counterfactual`)
For each outcome type, maintain (a) historical pre-AI baseline per property cohort, (b) synthetic counterfactual model. Customer-visible "attribution panel" showing AI delta vs baseline. **This is the trust contract.**

### 6. Outcome Meter & Billing SKU Engine (`packages/meter`, `packages/billing`)
Defines outcome SKUs (the 20+ outcomes in §10). Computes invoiceable events from ledger. Clawback windows (e.g., 14 days for tickets, 30 days for vacancies, 90 days for renewals). Stripe + escrow integration for outcomes that need to clear.

### 7. Shadow-Mode Harness (`apps/shadow-runner`)
Every new outcome agent ships in shadow first. Mirror real events, log decisions, no execution. Conversion gates (≥85% agreement, ≥5K decisions, zero critical violations). Reuses existing eval harness.

### 8. Outcome-SLA Contract Templates (`legal/contracts/outcomes-as-service-v1.md`)
BPO-style contract per Mayer Brown framework: scope, warranties, outcome SLAs, indemnification, audit rights, data ownership. Per outcome SKU. Reviewed by counsel in KE/TZ/NG.

### 9. Warranty / Insurance Wrapper (`packages/warranty`)
Optional bolt-on. Procure Armilla AI Performance Warranty (or local equivalent) per outcome SKU above $X annual contract value. Embed premium in pricing or absorb in margin. Track triggers (accuracy drops below contracted threshold → automatic clawback or insurance claim).

### 10. Licensee Partner Layer (`apps/licensee-portal`)
For KE/TZ/NG markets: BOSSNYUMBA contracts **through** EARB / VRB / NIESV-registered firms. Portal lets licensees onboard properties, sign owner contracts under their license, white-label BOSSNYUMBA as their service-bureau. Revenue split logic, licensee dashboard, regulatory reporting (tax/utility filings).

---

## 13. Top 3 Outcomes to Monetize First (recommendation)

Ranked by (ease of measurement) × (ease of attribution) × (existing baseline data):

### #1 — Ticket resolved within SLA
- **Why first**: easy to define ("tenant confirms fix within 14d"), easy to attribute (1:1 ticket-to-agent), industry baseline well-documented ($40/ticket human cost), aligns with Intercom Fin / Maven AGI / Decagon proven pattern.
- **Unit**: $5-15/ticket resolved, capped at 95% of human cost.
- **Build first**: confidence router + outcome ledger + shadow harness. Most reusable infra.

### #2 — Rent collected (% of collected above baseline)
- **Why second**: bank reconciliation = ground truth; 1-3% fee is industry-familiar; counterfactual baseline is straightforward (prior 12-mo collection rate per property).
- **Unit**: 1-3% of collected rent + 10% of recovered delinquency.
- **Build add**: counterfactual baseline engine + clawback (90-day window — if tenant claws back / chargeback / dispute, vendor returns fee).

### #3 — Vacancy filled (success fee per lease)
- **Why third**: high-dollar event (0.5-1 month rent), clean signal (signed lease + move-in), addresses landlord's single biggest pain. Mirrors real-estate agent commission model = familiar contract.
- **Unit**: 0.5-1 month rent equivalent per executed lease.
- **Build add**: Temporal workflow for the 25-day listing-to-move-in journey; LangGraph reasoning nodes for applicant ranking / lease drafting. Plus licensee partner layer (must execute lease under a licensed agent in KE/TZ/NG).

---

## Sources

- [Sequoia: Pricing Maturity Curve for Agentic AI](https://inferencebysequoia.substack.com/p/the-pricing-maturity-curve-for-agentic)
- [Sequoia: 2026 — This is AGI](https://sequoiacap.com/article/2026-this-is-agi/)
- [Sequoia: Pricing in the AI Era — From Inputs to Outcomes (Paid CEO podcast)](https://sequoiacap.com/podcast/pricing-in-the-ai-era-from-inputs-to-outcomes-with-paid-ceo-manny-medina/)
- [Bessemer Venture Partners: AI Pricing & Monetization Playbook](https://www.bvp.com/atlas/the-ai-pricing-and-monetization-playbook)
- [Bessemer: AI Pricing Playbook PDF (Feb 2026)](https://www.bvp.com/assets/uploads/2026/02/The_AI_pricing_playbook_for_founders_Bessemer_Venture_Partners_2026.pdf)
- [a16z: Big Ideas 2026 — The Agentic Interface](https://a16z.com/podcast/big-ideas-2026-the-agentic-interface/)
- [a16z: Surviving AI Price Wars Without Destroying Your Business](https://a16z.com/surviving-ai-price-wars-without-destroying-your-business/)
- [Mayer Brown: Contracting for Agentic AI — Shifting from SaaS to Services](https://www.mayerbrown.com/en/insights/publications/2026/02/contracting-for-agentic-ai-solutions-shifting-the-model-from-saas-to-services)
- [Armilla AI: AI Performance Warranty Brief](https://www.armilla.ai/ai-performance-warranty-brief)
- [Armilla AI: Lloyd's Coverholder AI Insurance](https://www.armilla.ai/ai-insurance)
- [Chaucer + Armilla: Vanguard AI launch](https://natlawreview.com/press-releases/chaucer-and-armilla-launch-vanguard-ai-clarify-cyber-technology-and-ai)
- [Munich Re aiSure](https://www.munichre.com/en/solutions/for-industry-clients/insure-ai.html)
- [Brightlume: Shadow Mode Rollouts for AI Agents](https://brightlume.ai/blog/shadow-mode-rollouts-ai-agents-pilot-production)
- [AlignX: Designing Human-in-the-Loop for Agentic Workflows](https://medium.com/@AlignX_AI/designing-human-in-the-loop-for-agentic-workflows-079faec737ed)
- [AgentMarketCap: LangGraph vs Temporal for Long-Running Agent Workflows](https://agentmarketcap.ai/blog/2026/04/08/langgraph-vs-temporal-long-running-agent-workflows-2026)
- [Sierra revenue, valuation & funding (Sacra)](https://sacra.com/c/sierra/)
- [Sierra AI Pricing: What Outcome-Based Really Costs (OpenNash)](https://opennash.com/blog/sierra-ai-pricing-what-outcome-based-really-costs-and-when/)
- [Decagon resolution-based pricing](https://decagon.ai/glossary/what-is-resolution-based-pricing)
- [Decagon AI cost 2026 (eesel)](https://www.eesel.ai/blog/decagon-ai-cost)
- [11x AI Pricing breakdown 2026](https://marketbetter.ai/blog/11x-ai-pricing-2026/)
- [Cognition Devin pricing](https://devin.ai/pricing/)
- [Devin 2025 Performance Review](https://cognition.ai/blog/devin-annual-performance-review-2025)
- [Devin 73x ARR Surge (AgentMarketCap)](https://agentmarketcap.ai/blog/2026/04/11/cognition-devin-73x-arr-growth-coding-agent-revenue)
- [EvenUp: Introducing AI Drafts & Case-Based Pricing](https://www.evenuplaw.com/blog/introducing-ai-drafts-suite/)
- [Harvey AI Pricing 2026 (CostBench)](https://costbench.com/software/ai-legal-tools/harvey-ai/)
- [Hippocratic AI Deployment Numbers 2026 (CallSphere)](https://callsphere.ai/blog/td30-vrt-hippocratic-ai-deployment-numbers-2026)
- [Hippocratic AI $126M raise (OnHealthcare)](https://www.onhealthcare.tech/p/hippocratic-ais-126m-raise-why-healthcares)
- [Maven AGI Resolution Rate glossary](https://www.mavenagi.com/glossary/resolution-rate)
- [Maven AGI K1x case study](https://www.mavenagi.com/case-studies/k1x)
- [Replicant outcome-based pricing (Aloware)](https://aloware.com/ai-voice-agent/outcome-based-pricing)
- [CrewAI Pricing 2026](https://crewai.com/pricing)
- [CrewAI Platform Statistics 2026 (Panto)](https://www.getpanto.ai/blog/crewai-platform-statistics)
- [Klarna AI Reverses Layoffs (DigitalApplied)](https://www.digitalapplied.com/blog/klarna-reverses-ai-layoffs-replacing-700-workers-backfired)
- [Klarna OpenAI case study](https://openai.com/index/klarna/)
- [OaAS: Outcome-Based AI Agent Contracts (Alhena)](https://alhena.ai/blog/oaas-outcome-based-ai-agents-ecommerce/)
- [2026 Guide to SaaS / AI / Agentic Pricing Models (Monetizely)](https://www.getmonetizely.com/blogs/the-2026-guide-to-saas-ai-and-agentic-pricing-models)
- [Property Management KPIs 2026 (Revela)](https://www.revela.co/resources/property-management-kpis)
- [14 Essential KPIs Property Managers (Pacific ABS)](https://www.pacificabs.com/knowledge-center/blog/14-essential-kpis-property-managers-must-track-this-year/)
- [Property Management Fees by State 2026 (DoorLoop)](https://www.doorloop.com/blog/property-management-fees-by-state)
- [Average Property Management Fees 2026 (PropertyCEO)](https://thepropertyceo.com/blog/how-much-property-managers-charge-guide)
- [Kenya Estate Agents Registration Board (EARB)](https://estateagentsboard.or.ke/)
- [Counterfactual-based Agent Influence Ranker (arXiv 2510.25612)](https://arxiv.org/pdf/2510.25612)
- [AI in Parametric Insurance 2026 (Insurnest)](https://insurnest.com/blog/ai-in-parametric-insurance/)
- [Armilla AI $25M raise (FinTech Global)](https://fintech.global/2026/01/23/armilla-ai-raises-25m-to-expand-ai-liability-coverage/)
