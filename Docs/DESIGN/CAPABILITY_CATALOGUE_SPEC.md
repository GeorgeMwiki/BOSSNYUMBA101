# Capability Catalogue — Design Specification

> Pillar 3 of [`CAPABILITY_BOOST_VISION.md`](../STRATEGY/CAPABILITY_BOOST_VISION.md).
> Sibling specs:
> [`OMNIDATA_CONNECTOR_INVENTORY.md`](./OMNIDATA_CONNECTOR_INVENTORY.md),
> [`TACIT_KNOWLEDGE_HARVESTING_SPEC.md`](./TACIT_KNOWLEDGE_HARVESTING_SPEC.md),
> [`SELF_IMPROVING_LOOPS_SPEC.md`](./SELF_IMPROVING_LOOPS_SPEC.md),
> [`BOSSNYUMBA_SPEC.md`](../BOSSNYUMBA_SPEC.md).

Brand: Boss Nyumba. Persona: Mr. Mwikila — Boss Nyumba's autonomous
Central Estate Manager for Tanzanian property operators. Status:
design-spec.

---

## 1. The Thesis — Capabilities Are Measurable

Existing AI-maturity literature (cf.
[larridin.com — AI Maturity 2026](https://larridin.com/solutions/ai-maturity-the-complete-enterprise-guide-2026),
[thinking.inc — 5 stages](https://thinking.inc/en/pillar-pages/ai-maturity-model/),
[hyscaler.com — AI Maturity Model 2026](https://hyscaler.com/insights/ai-maturity-model/))
measures *organisations* on aggregate AI maturity. Boss Nyumba
inverts the unit: we measure **discrete capabilities**, not
organisational stages. An organisation does not "have AI maturity
Stage 3"; it has — or fails to have — the capability to run a
move-in inspection in under thirty minutes with 0.98 accuracy at
$0.06 per invocation. That is a shippable, testable, observable
property. Either the estate firm can do it, or it cannot.

The shift matters. Maturity models tell the owner *where they are*.
A capability catalogue tells the owner *what they can do, what they
cannot, and what is changing this week*. The catalogue is the
**operational surface** of capability boost: every gap is an
opportunity; every improvement is a celebration; every weekly
briefing references the catalogue.

The founder's brief implies this directly:

> "Think intelligent AI-powered organisation with AI-native
> software."

The intelligent estate firm knows its own capabilities.

The 2026 AI-maturity research itself flags the same gap:

> "A key limitation of existing models is that they're organisational-
> level assessments that miss granular variation — an enterprise
> doesn't have a single maturity level, as different teams may be at
> different stages."
> — [larridin.com / AI Maturity Measurement](https://larridin.com/blog/ai-maturity-measurement)

The catalogue is exactly the granular variation.

---

## 2. The `OrgCapability` Model

```typescript
export interface OrgCapability {
  readonly id: string;                              // 'run_move_in_inspection'
  readonly tenant_id: string;
  readonly name: string;
  readonly description: string;
  readonly domain: CapabilityDomain;
  readonly required_inputs: ReadonlyArray<CapabilityInput>;
  readonly required_actors: ReadonlyArray<ActorRole>;
  readonly required_know_how: ReadonlyArray<KnowHowRequirement>;
  readonly measurement: CapabilityMeasurement;
  readonly gap_analysis: CapabilityGap | null;
  readonly dependencies: ReadonlyArray<string>;
  readonly value_estimate_usd: number;
  readonly priority_tier: 'must' | 'should' | 'nice';
  readonly created_at: string;
  readonly last_measured_at: string;
  readonly audit_hash: string;
}

export type CapabilityDomain =
  | 'regulatory'      // Manispaa, TRA, NHC, NSSF
  | 'commercial'      // tenant acquisition, pricing, lease admin
  | 'operational'     // maintenance, caretakers, utilities
  | 'financial'       // rent collection, accounting, treasury
  | 'compliance'      // safety, audit, governance
  | 'marketing'       // listings, brand, social
  | 'people'          // staff hiring, retention, training
  | 'strategic';      // expansion, M&A, capital

export interface CapabilityInput {
  readonly kind: 'data_source' | 'document_template' | 'connector' | 'know_how_artifact';
  readonly reference_id: string;
  readonly required: boolean;
}

export interface ActorRole {
  readonly role_tag: string;       // 'caretaker' | 'accounts_clerk' | 'estate_manager' | etc.
  readonly autonomy_tier: 'autonomous' | 'staged' | 'execute';
}

export interface KnowHowRequirement {
  readonly kind: KnowHowKind;
  readonly tag: string;            // e.g. 'manispaa_filing_procedure'
  readonly minimum_artifacts: number;
}

export interface CapabilityMeasurement {
  readonly achievability: AchievabilityLevel;
  readonly speed_p50_minutes: number;
  readonly speed_p95_minutes: number;
  readonly accuracy_pct: number;
  readonly cost_per_invocation_usd: number;
  readonly invocations_last_30d: number;
  readonly success_rate_30d: number;
  readonly last_measured_at: string;
  readonly measurement_method: 'observed' | 'shadow' | 'declared';
}

export type AchievabilityLevel =
  | 'not_yet'
  | 'manual_only'
  | 'partial_ai_assist'
  | 'fully_ai_assisted'
  | 'autonomous';

export interface CapabilityGap {
  readonly id: string;
  readonly missing_inputs: ReadonlyArray<CapabilityInput>;
  readonly missing_know_how: ReadonlyArray<KnowHowRequirement>;
  readonly missing_actors: ReadonlyArray<ActorRole>;
  readonly recommended_actions: ReadonlyArray<RecommendedAction>;
  readonly estimated_close_effort: 'low' | 'medium' | 'high';
}

export interface RecommendedAction {
  readonly kind: 'install_connector' | 'run_interview' | 'compose_template' | 'hire_role';
  readonly target_id: string;
  readonly rationale: string;
}
```

---

## 3. Capability Emergence — How New Capabilities Appear

Capabilities are not authored manually by a product team. They emerge
continuously from three sources:

### 3.1 Backwards-Derived From Successful Task Completions

When a tenant completes a task end-to-end (e.g. owner approves a
Manispaa property-tax filing the MD drafted), the post-action audit-
chain entry includes a `task_signature`. The capability-emergence
worker proposes a new `OrgCapability` for the tenant when it sees a
new signature. The owner can confirm, edit, or reject.

### 3.2 Stitched From Omnidata + Tacit Knowledge

When omnidata + tacit-knowledge harvesting cross a coverage threshold
— e.g. the firm now has a Salesforce connector + the senior estate
manager has been interviewed + a `relationship` artifact pool of
≥30 — Mr. Mwikila proposes a new capability: *"You now have the
substrate to run tenant-segmentation-by-payment-history."*

### 3.3 External Research

The deep-research loop scans industry literature for capability
mentions. *"Three peer firms now offer corporate-let to NGOs — do
you?"* If no, surface as a gap with priority tier `should`.

---

## 4. Gap Surfacing

Three channels:

1. **Morning Briefing** — top 3 gaps by value × close-effort.
2. **Capability Catalogue Dashboard** (§5).
3. **In-Flow Triggers** — `ProactiveHint` for adjacent missing
   capabilities mid-task.

---

## 5. The Owner-Facing Catalogue Dashboard

Surface at `apps/owner-dashboard/src/capabilities/`. Renders:

- **Capability Heatmap** by domain × achievability colour band.
- **Capability Detail Page** — measurement, gap, recommendations,
  dependencies, contributing know-how, audit trail.
- **Gap Backlog** — sortable list with one-tap actions.
- **Weekly Changes** — diff view of achievability transitions.

Charts use the existing `genui` block surface.

---

## 6. Measurement

The measurement worker runs hourly:

- **Observed mode (default):** 30-day audit-chain scan; speed p50 /
  p95, accuracy, cost, success rate.
- **Shadow mode:** synthetic invocation against `RegressionFixture`s
  for low-volume capabilities.
- **Declared mode:** owner-declared metrics for externally executed
  capabilities; periodically reconfirmed.

Every measurement event writes a `capability_measurements` row +
anchors the audit chain.

---

## 7. Capability Composition

Composite capability (e.g. *"compose a monthly landlord report"*)
declares its sub-capability ids in `dependencies`. The measurement
worker propagates failures upward.

---

## 8. Anti-Patterns

Mr. Mwikila MUST NOT:

1. **Declare a capability without measurement** (at least a shadow
   baseline).
2. **Hide regressions from the owner** (weekly report).
3. **Conflate capability with usage** (both tracked separately).
4. **Surface low-value gaps prominently** (sorted by value).
5. **Catalogue capabilities the tenant has not consented to track**
   (e.g. personnel performance — default off).
6. **Use one tenant's data for another tenant's benchmark** without
   the cross-tenant federation differential-privacy regime.

---

## 9. Schema Additions

Migration adds:

- `org_capabilities`
- `capability_measurements` (append-only)
- `capability_gaps`
- `capability_dependencies`

Indexes: `(tenant_id, domain, priority_tier)`,
`(tenant_id, achievability)`,
`(tenant_id, value_estimate_usd DESC)`.

---

## 10. Persona-Kernel Tools

- `list_capabilities_v1({ domain?, priority_tier?, achievability? })`
- `describe_capability_v1({ capability_id })`
- `measure_capability_v1({ capability_id, mode })`
- `close_capability_gap_v1({ capability_id, action_id })`
- `propose_capability_v1({ name, description, signature })`

---

## 11. Cross-Spec Integration Map

- **Omnidata:** `required_inputs` include connector references;
  missing → `install_connector` action.
- **Tacit knowledge:** `required_know_how` references; missing → 
  `run_interview` action.
- **Self-improving loops:** classes of weakness read from the
  catalogue.
- **Cognitive engine:** every invocation routes through cognitive
  loop; measurement reads the trace + confidence.
- **Mutation authority:** Tier-2 approvals write outcomes.
- **Anticipatory UX:** only `partial_ai_assist`+ capabilities are
  eligible for pre-staging.

The catalogue is what turns Mr. Mwikila from a chat surface into an
**operational instrument**. The owner does not chat with an AI; the
owner runs a property business whose capabilities are visible,
measured, ranked, and improving — with Mr. Mwikila as the engine
that closes the gaps.
