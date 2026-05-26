# Self-Improving Loops — Design Specification

> Pillar 4 of [`CAPABILITY_BOOST_VISION.md`](../STRATEGY/CAPABILITY_BOOST_VISION.md).
> Sibling specs:
> [`OMNIDATA_CONNECTOR_INVENTORY.md`](./OMNIDATA_CONNECTOR_INVENTORY.md),
> [`TACIT_KNOWLEDGE_HARVESTING_SPEC.md`](./TACIT_KNOWLEDGE_HARVESTING_SPEC.md),
> [`CAPABILITY_CATALOGUE_SPEC.md`](./CAPABILITY_CATALOGUE_SPEC.md),
> [`BOSSNYUMBA_SPEC.md`](../BOSSNYUMBA_SPEC.md).

Brand: Boss Nyumba. Persona: Mr. Mwikila — Boss Nyumba's autonomous
Central Estate Manager for Tanzanian property operators. Status:
design-spec.

---

## 1. The Thesis — The MD Identifies + Closes His Own Gaps

The founder's brief, verbatim:

> "Literal self-improving AI loops from the ground up."

The 2026 academic literature confirms the architecture is now
operational, not theoretical. [Arxiv 2506.05109 — *Truly Self-Improving
Agents Require Intrinsic Metacognitive Learning*](https://arxiv.org/pdf/2506.05109)
names the discipline: an agent's intrinsic ability to actively
evaluate, reflect on, and adapt its own learning processes.
[Arxiv 2508.00271 — MetaAgent](https://arxiv.org/pdf/2508.00271)
operationalises this through tool meta-learning, self-reflection, and
answer-verification cycles. The Boss Nyumba kernel runs four of the
five loops described below; this spec names them, formalises the
fifth (meta-learning), and binds them to the owner-visible weekly
self-improvement report that makes the regime accountable.

What makes Boss Nyumba's self-improvement different from prior art is
**owner transparency**. Self-improving systems that hide their
improvement from the principal violate the cite-or-stay-silent
principle. Mr. Mwikila does not get smarter behind the owner's back;
every improvement is named, dated, scored, and authorised in the
weekly report.

---

## 2. The Five Self-Improvement Loops

### 2.1 Per-Turn Loop

**Frequency:** every owner-MD turn.

**Mechanism:** at the end of every cognitive turn, the engine writes
a `TurnFeedback` record:

```typescript
export interface TurnFeedback {
  readonly turn_id: string;
  readonly outcome: 'success' | 'partial' | 'failure' | 'declined';
  readonly owner_correction: string | null;
  readonly latency_ms: number;
  readonly cost_usd: number;
  readonly confidence_label: 'high' | 'medium' | 'low' | 'refused';
  readonly recipe_id: string;
  readonly memory_cells_read: ReadonlyArray<string>;
  readonly memory_cells_written: ReadonlyArray<string>;
  readonly capability_id: string | null;
}
```

Consolidation worker reads `TurnFeedback`, promotes / demotes
`CognitiveMemoryCell`s.

**Audit:** records anchor in the audit-hash chain.

### 2.2 Per-Recipe Loop

**Frequency:** continuous; canary-tested overnight.

**Mechanism:** the existing anticipatory-UX recipe-variant and
document-composition recipe-variant testing frameworks generate
recipe variants, run them against canary tenants (opted-in), and
promote winners. The reflexion-sleep-canary workflow gates promotion
on zero-regression across a hold-out tenant set.

**Audit:** every recipe promotion writes to `recipe_evolution_audit`.

### 2.3 Per-Junior Loop

**Frequency:** continuous, per-junior lifecycle stage.

**Mechanism:** the junior lifecycle (proposed → spawning → trial →
seasoned → sunset) matures specialisations. The junior-evolution
worker monitors performance and advances or retires juniors based on
observed task completions.

**Audit:** lifecycle transitions anchor in the audit chain.

### 2.4 Cross-Tenant Federation Loop

**Frequency:** weekly batch.

**Mechanism:** patterns observed in ≥10 distinct tenants (where each
has explicitly opted into federation) promote to **platform-memory**
— a tenant-agnostic store of `MemoryKind = 'pattern'` cells. Uses
**differential privacy**: only aggregate statistics move across the
boundary, never raw artifact text. The DP primitives follow the
practice in [arXiv 2007.05553 — Differentially Private Cross-Silo
Federated Learning](https://arxiv.org/pdf/2007.05553) and
[arXiv 2403.11343 — Federated Transfer Learning with DP](https://arxiv.org/pdf/2403.11343).

**Default state:** OFF. Per-tenant explicit opt-in.

**Audit:** every federated pattern carries provenance showing tenant
count, ε-budget, promotion timestamp.

### 2.5 Meta-Learning Loop

**Frequency:** weekly.

**Mechanism:** the **Meta-Learning Conductor** service
(`services/meta-learning-conductor/`) audits the prior 7 days of the
audit chain and identifies **classes of weakness**. Example outputs
for Boss Nyumba:

- *"Mr. Mwikila refused 23% of late-rent escalation questions with
  horizon > 14d because the corpus is missing the per-Manispaa
  notice-to-vacate procedural map. Proposal: ingest the public
  notice-to-vacate templates for Kinondoni, Ilala, Ubungo, Temeke."*
- *"Mr. Mwikila scored 'medium' confidence on 41% of tenant-screening
  questions for new tenants. Proposal: spawn a `tenant-screening-historian`
  junior at tenant onboarding to seed initial pattern memory from
  the omnidata Slack + Gmail back-fill."*
- *"Mr. Mwikila spent 18% of cost-budget on web-search calls that
  returned no novel information. Proposal: tighten the source-quality
  scorer's recency cap."*

For each class-weakness, the conductor proposes one of: (a) request a
new omnidata connector, (b) propose a new tacit-knowledge interview,
(c) propose a new junior specialisation, (d) propose a corpus
expansion, (e) propose a kernel-level recipe revision, (f) ask the
owner for a clarifying input.

**Audit:** every proposal anchors in the audit chain.

---

## 3. The Owner-Facing Weekly Self-Improvement Report

Lands every Monday at 06:00 owner-local.

### Header

> Mr. Mwikila — Week of Mon DD–Sun DD. Summary: 3 capabilities
> upgraded; 1 capability regressed; 7 know-how artifacts captured;
> 2 federation patterns adopted; 3 self-improvement proposals for
> your review.

### Body sections

1. **Capabilities upgraded** — e.g. *"`run_move_in_inspection` moved
   manual_only → partial_ai_assist after the photo-OCR recipe landed
   Tuesday"*.
2. **Capabilities regressed** — with suspected cause + proposed
   remediation.
3. **Know-how captured this week** — count by mode, top 5 artifacts,
   playbook link.
4. **Federation patterns adopted** — list of new platform-memory
   patterns the tenant inherited, with provenance.
5. **Self-improvement proposals** — top proposals for owner review
   with one-tap approve/defer/decline.

### Footer

> Generated by `meta-learning-conductor` v0.X. Audit-chain head:
> `abc123...`. Verifiable from genesis via the audit panel.

Delivered to owner-dashboard (`apps/owner-dashboard/src/self-improvement/`)
+ email.

---

## 4. The Meta-Learning Conductor — Service Contract

```typescript
export interface MetaLearningConductorService {
  readonly runWeeklyAudit: (params: { tenant_id: string; window_days: number }) => Promise<WeeklyAuditResult>;
  readonly proposeImprovement: (params: ProposeImprovementParams) => Promise<ImprovementProposal>;
  readonly recordOwnerDecision: (params: { proposal_id: string; decision: 'approve' | 'defer' | 'decline' }) => Promise<void>;
}

export interface WeeklyAuditResult {
  readonly tenant_id: string;
  readonly window_start: string;
  readonly window_end: string;
  readonly capabilities_upgraded: ReadonlyArray<CapabilityTransition>;
  readonly capabilities_regressed: ReadonlyArray<CapabilityTransition>;
  readonly know_how_captured_count: number;
  readonly federation_patterns_adopted: ReadonlyArray<FederationPatternAdoption>;
  readonly class_weaknesses: ReadonlyArray<ClassWeakness>;
  readonly proposals: ReadonlyArray<ImprovementProposal>;
}

export interface ClassWeakness {
  readonly id: string;
  readonly description: string;
  readonly evidence_turns: ReadonlyArray<string>;
  readonly impact_estimate: 'low' | 'medium' | 'high';
  readonly affected_capabilities: ReadonlyArray<string>;
}

export interface ImprovementProposal {
  readonly id: string;
  readonly tenant_id: string;
  readonly kind: 'install_connector' | 'run_interview' | 'spawn_junior'
              | 'expand_corpus' | 'revise_recipe' | 'request_owner_input';
  readonly description: string;
  readonly target_class_weakness_id: string;
  readonly recommended_action_payload: Record<string, unknown>;
  readonly projected_close_effort: 'low' | 'medium' | 'high';
  readonly projected_value_usd: number;
  readonly status: 'pending' | 'approved' | 'deferred' | 'declined' | 'executed';
  readonly created_at: string;
  readonly audit_hash: string;
}
```

Runs on a weekly cron. Reuses sleep-pass-orchestrator scheduling +
research-orchestrator benchmark queries.

---

## 5. Cross-Tenant Federation — Privacy Mechanics

1. **Opt-in only.** Default off.
2. **Aggregate only.** No raw `KnowHowArtifact` or
   `OmnidataIngestedItem` content ever crosses tenant boundaries.
   Statistics with Laplace / Gaussian noise per the ε-budget.
3. **K-anonymity floor.** ≥10 distinct contributing tenants + ≥5
   invocations per tenant.
4. **Revocation tombstones** within 30 days.
5. **Audit-chain proof.** Every federation event with ε-consumed
   metadata.
6. **No model training.** Federation writes platform-memory cells
   only.

---

## 6. Anti-Patterns

Mr. Mwikila MUST NOT:

1. **Self-improve invisibly** (weekly report is mandatory).
2. **Train base models on tenant data.**
3. **Federate without consent** (default off).
4. **Cause trust regressions** (canary gate enforces).
5. **Spawn juniors without measurement** (trial-period gate).
6. **Hide regressions** (weekly report shows them).
7. **Use tenant identity in platform memory** (tenant-agnostic
   only).

---

## 7. Schema Additions

Migration adds:

- `self_improvement_reports`
- `meta_learnings`
- `gap_identifications`
- `improvement_proposals`
- `federation_consent`
- `federation_contributions`
- `federation_adoptions`
- `platform_memory_cells`

Indexes: `(tenant_id, window_end DESC)` on reports;
`(tenant_id, status)` on proposals.

---

## 8. Cross-Spec Integration Map

- **Omnidata:** `install_connector` proposals land in the install
  flow.
- **Tacit knowledge:** `run_interview` proposals trigger scheduling.
- **Capability catalogue:** proposals reference capability ids.
- **Cognitive memory:** per-turn loop writes reinforcement counters.
- **Junior architecture:** `spawn_junior` proposals route to the
  junior-dynamic-spawning lifecycle.
- **Mutation authority:** owner approvals on proposals ride the
  Tier-2 queue.

---

## 9. Why This Closes the Capability-Boost Loop

A productivity tool delivers a function. A capability-boost platform
delivers a *learning organism*. The five loops are what makes Boss
Nyumba the organism:

- **per-turn:** every interaction shifts memory.
- **per-recipe:** every approach gets tested; only winners promote.
- **per-junior:** specialisations earn their place.
- **federation:** the platform compounds across customers with each
  owner's explicit consent + strict DP regime.
- **meta-learning:** the discipline that names the next thing to
  improve, surfaces it transparently to the owner, and closes the
  gap.

The 2026 self-improvement literature ([timesofai.com — Self-Improving
AI in 2026](https://www.timesofai.com/industry-insights/self-improving-ai-myth-or-reality/))
positions 2026 as the inflection year when self-improving
architectures become mainstream. Boss Nyumba ships an
**owner-visible, audit-anchored, consent-gated** version of that
architecture from day one. That is what makes Mr. Mwikila a real
Central Estate Manager — not a chatbot that learns, but a colleague
who gets better every week, in front of the owner, with the owner's
authorisation, against measurable benchmarks.

The four pillars compound because the fifth loop, the meta-learning
conductor, knows how to ask for more of each. *"You're at 60%
omnidata coverage; the next 20% would close 3 high-value gaps.
Approve?"* That is the platform improving itself. That is the
differentiator.
