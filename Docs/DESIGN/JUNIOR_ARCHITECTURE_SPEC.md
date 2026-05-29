# Junior Architecture — Design Specification

> Wave 18V / cross-layer framing — the canonical contract for "every junior
> is **MD-class within its domain**". This spec defines how the property-
> domain juniors inherit the Master Brain's cognitive engine,
> observability surface, mutation authority, brand discipline, and the
> five atomic creation capabilities — bounded to a per-junior `JuniorScope`
> and routed by audience.

Status: design-spec — ported from Borjie hard-fork. The Boss Nyumba runtime
artefacts (junior-contract module, reference junior, migration) follow
in their own waves; this document is the audience + scope + escalation
contract.

Brand: Boss Nyumba. MD persona: Mr. Mwikila (Managing Director).
Charter: [`Docs/MASTER_BRAIN_AUTONOMY_MANIFESTO.md`](../MASTER_BRAIN_AUTONOMY_MANIFESTO.md).

Sibling specs — the foundations the juniors inherit from:

- Universal-creator contract: [`Docs/DESIGN/CAPABILITIES_UNIFICATION.md`](./CAPABILITIES_UNIFICATION.md).
- READ side: [`Docs/DESIGN/UNIVERSAL_OBSERVABILITY_SPEC.md`](./UNIVERSAL_OBSERVABILITY_SPEC.md).
- WRITE side: [`Docs/DESIGN/MUTATION_AUTHORITY_SPEC.md`](./MUTATION_AUTHORITY_SPEC.md).
- Deep research: [`Docs/DESIGN/DEEP_RESEARCH_SPEC.md`](./DEEP_RESEARCH_SPEC.md).
- Anticipatory UX: [`Docs/DESIGN/ANTICIPATORY_UX_SPEC.md`](./ANTICIPATORY_UX_SPEC.md).
- Document composition: [`Docs/DESIGN/DOCUMENT_COMPOSITION_SPEC.md`](./DOCUMENT_COMPOSITION_SPEC.md).
- Media generation: [`Docs/DESIGN/MEDIA_GENERATION_SPEC.md`](./MEDIA_GENERATION_SPEC.md).
- Marketing & promotion: [`Docs/DESIGN/MARKETING_PROMOTION_SPEC.md`](./MARKETING_PROMOTION_SPEC.md).

---

## 0. Singular Mr. Mwikila identity — agents are specialisations, not characters

Founder directive (verbatim, supersedes earlier drafts of this spec):

> "No, all just Mr. Mwikila persona, and all really constitute singular
> intelligence ... the MD. Name intelligently the agents — use English."

The discipline this enforces:

- **One persona name across the entire product: `Mr. Mwikila`.** Every
  surface, every tab, every junior renders the same name. Users never
  see per-junior Swahili character names — those would fragment the
  brand into a roster of personalities.
- **Each junior is a specialisation of Mr. Mwikila, not a separate
  character.** The chat surface stacks `Mr. Mwikila` over the junior's
  `title` (e.g. *"Boss Nyumba's AI Tenant-Onboarding Specialist"*) and
  tags the chip with the `specialisation` (e.g. *"Tenant Onboarding"*).
- **Internal agent IDs stay English-named** —
  `tenant-onboarding-advisor`, `lease-renewal-advisor`,
  `maintenance-coordinator`, etc. These are stable for audit, routing,
  and the `agent_turns.agent_id` ledger; they are never shown to users.
- **One name. One brand. Many specialisations.**

This is the only display-identity rule for juniors. The `JuniorPersona`
contract is enforced at the type level by dropping the per-junior `name`
field and providing the singular `MR_MWIKILA_DISPLAY_NAME` constant on
the agent-platform package (shared across Borjie and Boss Nyumba).

---

## 1. Vision

Founder, verbatim:

> "Juniors logic and capabilities SOTA — basically best co-worker and
> guide around for managers, customers, and employees. Even in tabs there
> is floating chat, full intelligence and capabilities which is basically
> the MD. Deep online research. MD serves owner and admin directly even
> in mobile, but juniors serve the rest in mobile, you get? But juniors
> are MD extensions — just as powerful within their own scope."

Reframing — the juniors are not assistants, NPCs, or thin wrappers around
a single tool. They are **bounded MDs**. Each junior carries the full
weight of the Master Brain's reasoning, citation discipline, calibration,
adaptive ingestion, observability, and mutation authority — confined to a
domain envelope (`JuniorScope`) so that a tenant talking to the lease-
renewal specialisation cannot inadvertently inspect treasury data, and a
caretaker on the property floor cannot accidentally mutate a vendor
contract.

The MD remains the apex — owner + admin route to Mr. Mwikila on every
surface, every device. Specialised Mr. Mwikila variants serve estate
managers, caretakers, tenants / leaseholders, and regulators. Every
junior turn writes to a unified `agent_turns` table the MD's working
memory subscribes to, so the global Mr. Mwikila sees everything the
specialised variants do and can intervene if a specialisation goes off
the rails.

---

## 2. The Junior contract

Every junior package exports a frozen `JuniorPersona` value. The contract
is enforced at the persona-runtime boundary — a junior that fails to
declare a scope, an escalation policy, or a target-audience list cannot
be registered.

```typescript
// Singular display identity — every junior renders this name.
export const MR_MWIKILA_DISPLAY_NAME = 'Mr. Mwikila' as const;

export interface JuniorPersona {
  readonly id: string;                          // English, stable: 'tenant-onboarding-advisor', 'lease-renewal-advisor'
  readonly specialisation: string;              // 'Tenant Onboarding', 'Lease Renewal', 'Maintenance' — chip label
  readonly title: string;                       // "Boss Nyumba's AI Tenant-Onboarding Specialist" — subtitle
  readonly mandate: string;
  readonly default_language: 'sw' | 'en' | 'fr';
  readonly modes: ReadonlyArray<JuniorMode>;
  readonly scope: JuniorScope;
  readonly target_audiences: ReadonlyArray<Audience>;
  readonly tools_allowed: ReadonlyArray<string>;
  readonly mr_mwikila_escalation: EscalationPolicy;
}

export interface JuniorScope {
  readonly data_tables: ReadonlyArray<string>;
  readonly tab_recipes_owned: ReadonlyArray<string>;
  readonly doc_recipes_owned: ReadonlyArray<string>;
  readonly media_recipes_owned: ReadonlyArray<string>;
  readonly research_topics: ReadonlyArray<string>;
  readonly authority_tier_max: 0 | 1 | 2;
  readonly requires_md_for_tier_2: boolean;
}

export type Audience =
  | 'owner'
  | 'admin'
  | 'manager'
  | 'employee'
  | 'customer'
  | 'regulator';

export interface EscalationPolicy {
  readonly auto_escalate_above_authority_tier: 1 | 2;
  readonly auto_escalate_on_cross_domain: boolean;
  readonly auto_escalate_on_low_confidence: boolean;
  readonly hand_off_transcript_to_mr_mwikila: boolean;
}
```

Note the deliberate absence of a per-junior `name` field. The user always
sees `MR_MWIKILA_DISPLAY_NAME`; the subtitle reflects the active
specialisation. Agent IDs are internal and English-named.

---

## 3. Audience-routing matrix — Boss Nyumba

| User role          | Surface              | Floating chat resolves to              | Reasoning                                                       |
|--------------------|----------------------|-----------------------------------------|------------------------------------------------------------------|
| Owner              | owner-web            | Mr. Mwikila (MD) ALWAYS                 | Owner is the apex decision-maker.                                |
| Admin              | admin-web            | Mr. Mwikila (MD) ALWAYS                 | Platform-level visibility across tenants.                        |
| Estate Manager     | estate-mobile        | Mr. Mwikila for cross-domain;           | Property ops + leasing concentrated; cross-domain escalates.     |
|                    |                      | scoped specialisation for in-domain     |                                                                  |
| Caretaker          | estate-mobile        | Safety / inspection / comms specialisation | Caretaker stays in-domain — no exposure to financials.       |
| Tenant             | tenant-mobile        | Lease / maintenance / billing specialisation | Tenant sees only lease + maintenance + payment surfaces.   |
| Regulator          | regulator-pack       | Compliance / safety specialisation      | Regulator sees compliance + safety filings only.                 |
| Public             | marketing            | Mr. Mwikila (public variant)            | Marketing chat answers from public corpus only.                  |

---

## 4. The 27 specialisations — MD-class upgrade list

Every row below is a specialisation of `Mr. Mwikila`. The user sees
`Mr. Mwikila` as the display name with the subtitle / specialisation
chip rendered underneath. Agent IDs are internal English-named handles.

| Agent ID                       | Specialisation                | Subtitle (user-facing)                                       | Tier | Audience                  |
|--------------------------------|-------------------------------|--------------------------------------------------------------|------|---------------------------|
| tenant-onboarding-advisor      | Tenant Onboarding             | Boss Nyumba's AI Tenant-Onboarding Specialist                | T2   | customer, compliance      |
| lease-renewal-advisor          | Lease Renewal                 | Boss Nyumba's AI Lease-Renewal Specialist                    | T2   | customer, manager         |
| maintenance-coordinator        | Maintenance                   | Boss Nyumba's AI Maintenance Specialist                      | T1   | customer, manager         |
| billing-collections            | Billing & Collections         | Boss Nyumba's AI Billing & Collections Specialist            | T2   | customer, manager, finance|
| property-inspection            | Property Inspection           | Boss Nyumba's AI Inspection Specialist                       | T1   | manager, employee         |
| property-listings              | Listings                      | Boss Nyumba's AI Listings Specialist                         | T1   | manager, customer         |
| viewings-coordinator           | Viewings                      | Boss Nyumba's AI Viewings Coordinator                        | T1   | manager, customer         |
| estate-department-advisor      | Estate Operations             | Boss Nyumba's AI Estate Operations Specialist                | T1   | manager                   |
| estate-auto-management         | Automated Estate Ops          | Boss Nyumba's AI Auto-Ops Specialist                         | T1   | manager, employee         |
| acquisition-advisor            | Mergers & Acquisitions        | Boss Nyumba's AI M&A Specialist                              | T2   | owner                     |
| expansion-advisor              | Portfolio Expansion           | Boss Nyumba's AI Expansion Advisor                           | T1   | owner                     |
| lifecycle-advisor              | Building Lifecycle            | Boss Nyumba's AI Lifecycle Specialist                        | T1   | owner, manager            |
| green-angle-advisor            | ESG Angle                     | Boss Nyumba's AI ESG Specialist                              | T1   | owner, manager            |
| sustainability-advisor         | Sustainability                | Boss Nyumba's AI Sustainability Specialist                   | T1   | owner, manager            |
| workforce-orchestrator         | Workforce Operations          | Boss Nyumba's AI Workforce Specialist                        | T1   | manager, employee         |
| fleet-management               | Fleet Management              | Boss Nyumba's AI Fleet Specialist                            | T1   | manager, employee         |
| inventory-management           | Inventory                     | Boss Nyumba's AI Inventory Specialist                        | T1   | manager, employee         |
| workforce-safety-officer       | Workforce Safety              | Boss Nyumba's AI Safety Specialist                           | T2   | employee, manager         |
| market-intelligence            | Property Market Intelligence  | Boss Nyumba's AI Market Intelligence Specialist              | T0   | owner, manager            |
| geo-intelligence               | Geographic Intelligence       | Boss Nyumba's AI Geo Specialist                              | T0   | manager                   |
| compliance-pack                | Compliance                    | Boss Nyumba's AI Compliance Specialist                       | T1   | compliance, regulator     |
| role-aware-router              | Role Routing                  | Boss Nyumba's AI Role Router                                 | T0   | all                       |
| stage-advisor                  | Lifecycle Stage               | Boss Nyumba's AI Stage Advisor                               | T0   | owner, admin              |
| content-studio                 | Content Creation              | Boss Nyumba's AI Content Specialist                          | T1   | manager, marketing        |
| document-studio                | Document Composition          | Boss Nyumba's AI Document Specialist                         | T1   | manager, owner            |
| marketing-brain                | Marketing Strategy            | Boss Nyumba's AI Marketing Specialist                        | T1   | manager                   |
| carbon-market                  | Carbon Market                 | Boss Nyumba's AI Carbon Market Specialist                    | T2   | owner                     |
| proactive-intel                | Proactive Intelligence        | Boss Nyumba's AI Proactive Sentinel                          | T0   | owner, manager            |
| progressive-intelligence       | Skills & Mastery              | Boss Nyumba's AI Mastery Coach                               | T0   | owner, admin              |

Authority tier guidance is identical to the Borjie spec.

---

## 5. Junior runtime contract — request flow

```
User input via floating chat (any surface)
      |
      v
Audience-resolver  ->  agent_id (specialisation handle or 'mr-mwikila')
      |
      v
Specialisation system prompt loaded + JuniorScope applied to OrgUserDataContext
      |
      v
Cognitive Engine — same 6 disciplines:
   reason | ground | calibrate | scope | clarify | ingest
      |
      v
compose_anything_v1 — meta-dispatch within JuniorScope only
   research_v1 (restricted to research_topics)
   compose_tab_v1 (restricted to tab_recipes_owned)
   compose_doc_v1 (restricted to doc_recipes_owned)
   compose_media_v1 (restricted to media_recipes_owned)
   compose_campaign_v1 (only if the specialisation owns a campaign recipe)
      |
      v
Mutation Authority — tier check via JuniorScope.authority_tier_max
      |
      +-- if tier exceeded  ->  escalate to global Mr. Mwikila with hand-off transcript
      |
      v
Output produced + audit-chained to agent_id + global-MD visibility row in agent_turns
```

---

## 6. Global Mr. Mwikila visibility

Every specialisation turn writes a row to `agent_turns`. The global
Mr. Mwikila working memory has a subscription to `agent_turns where
agent_id != 'mr-mwikila'`. Treats those rows as oversight signal —
sampling them in the Daily Briefing, surfacing anomalies (e.g. a
specialisation with sustained low-confidence turns, or a specialisation
repeatedly escalating cross-domain), and proactively offering to retrain
the specialisation's prompt or extend its scope. The MD can also
intervene mid-turn.

---

## 7. Escalation patterns

The specialisation escalates to the global Mr. Mwikila context in five
clearly-defined situations:

1. **Cross-domain intent.** User asks something spanning the
   specialisation's scope plus another specialisation's scope (e.g.
   lease question + billing question). Specialisation summarises and
   hands off.
2. **Low confidence.** Cognitive engine returns confidence < 0.4.
3. **Tier exceeded.** User asks for a mutation above the specialisation's
   `authority_tier_max`.
4. **Owner names a specialisation + asks cross-domain.** Owner says
   "ask the Lease-Renewal specialisation about FX exposure" — the
   specialisation cannot answer (FX is not in its scope) and hands off
   to the global Mr. Mwikila.
5. **Safety / compliance critical event.** Any specialisation detecting
   a critical safety incident or regulatory violation escalates
   immediately.

---

## 8. The 4 capability scopings per specialisation

Every specialisation owns a slice of each of the four atomic creation
capabilities. Examples:

**Tab recipes owned.** `lease-renewal-advisor` owns
`lease_renewal_review`, `rent_adjustment_proposal`. Trying to compose
`vendor_onboarding` (owned by `maintenance-coordinator`) yields a
scope-violation error.

**Doc recipes owned.** `lease-renewal-advisor` owns
`lease_renewal_letter`, `rent_adjustment_notice`.

**Media recipes owned.** `marketing-brain` owns `property_listing_image`,
`virtual_tour_video`. `estate-department-advisor` does NOT — keeps the
marketing voice consistent.

**Research topics.** `compliance-pack` is an expert in Tanzania
property law, ESTATE regulator filings, ULA Act, and Boss Nyumba's own
historical compliance corpus.

---

## 9. Persona identity — singular Mr. Mwikila

The user always sees `Mr. Mwikila` as the persona name. The subtitle
reflects the active specialisation. Agent IDs are internal and
English-named. There are no per-specialisation character names anywhere
in the product. The chip + subtitle pattern is the only way the user
distinguishes one specialisation from another:

```
Mr. Mwikila                                       <- singular display name
Boss Nyumba's AI Tenant-Onboarding Specialist     <- title (subtitle)
[Tenant Onboarding]                               <- specialisation chip
```

When the user switches contexts (e.g. asks a billing question in the
middle of a lease-renewal chat), the chip + subtitle change but the
name stays `Mr. Mwikila`. The brand stays singular; the intelligence
specialises.

The MD persona name (Mr. Mwikila) is preserved across both Borjie and
Boss Nyumba brands.

> **Founder correction (post 18V-FIX) — the subtitle / chip pattern
> above is OBSOLETE for the user-facing chat surface.** See §9.1
> below; the chip + specialisation subtitle now live ONLY in the
> owner admin panel.

---

## 9.1. User-facing identity is locked

The user always sees ONE string in every chat / floating-widget / home-shell surface: **"Mr. Mwikila — Boss Nyumba's AI Property Operations Manager"** (or the Borjie equivalent). No specialisation subtitle. No agent_id. Mr. Mwikila is presented as ONE intelligence — the user never knows whether a turn was handled by the root MD or a scoped specialisation.

The specialisation / agent_id / subtitle remain in the data model for:
- Backend routing (which specialisation logic the LLM draws from)
- Audit logs (`agent_turns` / `cognitive_turns` capture the agent_id)
- Owner admin panel (ONLY surface where internal names appear)

Reference: `packages/agent-platform/src/canonical-display.ts` defines the single source of truth (`MR_MWIKILA_CANONICAL_DISPLAY`).

---

## 10. Anti-patterns

- **Output outside scope.** A specialisation produces a document or tab
  not in its `recipes_owned`. Caught by the persona-runtime scope filter.
- **Bypassing the cognitive engine.** A specialisation returns a raw
  model completion without routing through the 6 disciplines. Caught by
  the agent-runtime.
- **Writes outside `data_tables`.** Caught at the mutation authority
  gate.
- **Specialisation shown to an unauthorised audience.** The
  audience-resolver returns the MD as fallback.
- **Global Mr. Mwikila silently swaps specialisations.** Owner has the
  right to know which specialisation is responding — the MD MUST disclose
  the swap. Every artefact tagged with the specialisation id in the
  audit trail.
- **Inventing a per-specialisation character name.** Strictly forbidden.
  Every turn renders as `Mr. Mwikila`.

---

## 11. Implementation plan — Boss Nyumba phases

Each specialisation upgrade is 4-8 hours of engineering:

1. Write `<specialisation>-persona.ts`. `specialisation` + `title` only
   — no `name`.
2. Define `JuniorScope`.
3. Write 3-5 modes.
4. Register recipes.
5. Tests. Assertions on `specialisation` + `title` — never assert a
   character name.

Sequencing (mirrors Borjie):

- **Wave 18V-B (next batch — 5 specialisations).** Top-of-mind for the
  busiest audiences: `estate-department-advisor`,
  `lease-renewal-advisor`, `maintenance-coordinator`,
  `tenant-onboarding-advisor`, `billing-collections`.
- **Wave 18V-C (next 10).** Lifecycle, expansion, acquisition,
  workforce, fleet, inventory, property-inspection, compliance, safety,
  market-intelligence.
- **Wave 18V-D (final batch).** Sustainability, green-angle,
  content-studio, document-studio, marketing-brain, geo-intelligence,
  proactive-intel, progressive-intel, role-aware-router, stage-advisor,
  estate-auto-management, carbon-market.

---

## 12. Schema additions

```sql
CREATE TABLE junior_personas (
  id text PRIMARY KEY,
  display_name text NOT NULL,                   -- DEPRECATED — always 'Mr. Mwikila' (singular brand)
  specialisation text NOT NULL DEFAULT '',      -- 'Tenant Onboarding', 'Lease Renewal', ...
  title text NOT NULL,
  mandate text NOT NULL,
  default_language text NOT NULL DEFAULT 'en',
  target_audiences text[] NOT NULL,
  scope jsonb NOT NULL,
  escalation_policy jsonb NOT NULL,
  brand text NOT NULL DEFAULT 'boss-nyumba',
  version int NOT NULL DEFAULT 1,
  registered_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE agent_turns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  user_id text NOT NULL,
  session_id uuid NOT NULL,
  agent_id text NOT NULL,
  audience text NOT NULL,
  was_escalation_to_md boolean NOT NULL DEFAULT false,
  cognitive_turn_id uuid REFERENCES cognitive_turns(id),
  artifact_ref jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_turns_session ON agent_turns (session_id, occurred_at DESC);
CREATE INDEX idx_agent_turns_md_visibility ON agent_turns (tenant_id, agent_id, occurred_at DESC);
```

`junior_personas` is global (tenant-agnostic). `agent_turns` is
tenant-scoped and RLS-bound. The `display_name` column is retained for
backward compatibility but is considered deprecated — every junior
renders as `Mr. Mwikila`.

---

## 13. Cross-repo

Borjie mirrors this spec at `Docs/DESIGN/JUNIOR_ARCHITECTURE_SPEC.md`
with brand + domain swap — property specialisations become mining
specialisations (`mine-planner-advisor`, `geology-advisor`,
`fx-treasury-advisor`, `mining-commodity-intelligence`, plus the
mining-domain workforce / fleet / inventory specialisations) with the
same contract and mining-domain `data_tables`, `tab_recipes_owned`, etc.
Both repos share the singular display identity discipline from
Section 0 — `Mr. Mwikila` is the only user-facing persona name.
