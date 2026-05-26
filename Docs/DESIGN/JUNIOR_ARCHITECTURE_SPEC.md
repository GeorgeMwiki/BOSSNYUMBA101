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
renewal junior cannot inadvertently inspect treasury data, and a
caretaker on the property floor cannot accidentally mutate a vendor
contract.

The MD remains the apex — owner + admin route to Mr. Mwikila on every
surface, every device. Juniors serve estate managers, caretakers,
tenants / leaseholders, and regulators. Every junior turn writes to a
unified `agent_turns` table the MD's working memory subscribes to, so
Mr. Mwikila sees everything the juniors do and can intervene if a junior
goes off the rails.

---

## 2. The Junior contract

Every junior package exports a frozen `JuniorPersona` value. The contract
is enforced at the persona-runtime boundary — a junior that fails to
declare a scope, an escalation policy, or a target-audience list cannot
be registered.

```typescript
export interface JuniorPersona {
  readonly id: string;
  readonly name: string;
  readonly title: string;
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

---

## 3. Audience-routing matrix — Boss Nyumba

| User role          | Surface              | Floating chat resolves to            | Reasoning                                                       |
|--------------------|----------------------|---------------------------------------|------------------------------------------------------------------|
| Owner              | owner-web            | Mr. Mwikila (MD) ALWAYS               | Owner is the apex decision-maker.                                |
| Admin              | admin-web            | Mr. Mwikila (MD) ALWAYS               | Platform-level visibility across tenants.                        |
| Estate Manager     | estate-mobile        | Mr. Mwikila for cross-domain;         | Property ops + leasing concentrated; cross-domain escalates.     |
|                    |                      | scoped junior for in-domain           |                                                                  |
| Caretaker          | estate-mobile        | Safety / inspection / comms junior    | Caretaker stays in-domain — no exposure to financials.           |
| Tenant             | tenant-mobile        | Lease / maintenance / billing junior  | Tenant sees only lease + maintenance + payment surfaces.         |
| Regulator          | regulator-pack       | Compliance / safety junior            | Regulator sees compliance + safety filings only.                 |
| Public             | marketing            | Mr. Mwikila (public variant)          | Marketing chat answers from public corpus only.                  |

---

## 4. Property-domain juniors — MD-class upgrade list

| #  | Junior package                  | Domain                                    | Audiences                | Tier | Modes (suggested)                                    | Junior name        |
|----|---------------------------------|--------------------------------------------|---------------------------|------|------------------------------------------------------|---------------------|
| 1  | estate-department-advisor       | Estate department operations              | manager                   | T1   | plan / report / escalate / brief                     | Mr. Karibu          |
| 2  | estate-auto-management          | Automated estate ops                      | manager, employee         | T1   | dispatch / report / handoff                          | Ms. Auto            |
| 3  | acquisition-advisor             | Property acquisition + DD                 | owner                     | T2   | screen / value / brief                               | Mr. Mnunuzi         |
| 4  | expansion-advisor               | Portfolio expansion modelling             | owner                     | T1   | scenario / rank / brief                              | Mr. Panua           |
| 5  | lifecycle-advisor               | Building lifecycle + CapEx                | owner, manager            | T1   | plan / brief / propose                               | Ms. Mzunguko        |
| 6  | green-angle-advisor             | Sustainability + ESG angle                | owner, manager            | T1   | assess / propose / report                            | Ms. Kijani          |
| 7  | sustainability-advisor          | Sustainability programme                  | owner, manager            | T1   | monitor / report / propose                           | Mr. Endelevu        |
| 8  | role-aware-advisor              | Role-shaped front door                    | all                       | T0   | route / nudge / propose                              | Mr. Sajili          |
| 9  | stage-advisor                   | Org maturity detection                    | owner, admin              | T0   | detect / propose / nudge                             | Ms. Hatua           |
| 10 | market-intelligence             | Property market intel                     | owner, manager            | T0   | watch / brief / alert                                | Mr. Soko            |
| 11 | geo-intelligence                | Geo / parcel / spatial intelligence       | manager                   | T0   | map / overlay / brief                                | Mr. Ramani          |
| 12 | fleet-management                | Vehicle + asset fleet                     | manager, caretaker        | T1   | dispatch / maintain / brief                          | Mr. Gari            |
| 13 | inventory-management            | Inventory / spare parts / consumables     | manager, caretaker        | T1   | count / reconcile / brief                            | Mr. Ghala           |
| 14 | workforce-orchestrator          | Caretaker roster + dispatch               | manager, caretaker        | T1   | roster / dispatch / hand-off                         | Ms. Kazi            |
| 15 | (workforce-safety)              | OSHA / OHS for caretakers                 | caretaker, manager        | T2   | observe / alert / file-propose                       | Mr. Kombo           |
| 16 | (lease-renewal)                 | Lease renewal advisor                     | tenant, manager           | T2   | quote / negotiate / sign-propose                     | Mr. Mkataba         |
| 17 | (tenant-onboarding)             | Tenant onboarding + KYC                   | tenant, compliance        | T2   | onboard / verify / decline-propose                   | Ms. Karibu          |
| 18 | (property-inspection)           | Inspection scheduling + reports           | manager, caretaker        | T1   | schedule / report / file                             | Mr. Tafiti          |
| 19 | (maintenance-coordinator)       | Maintenance tickets + vendor dispatch     | tenant, manager           | T1   | triage / dispatch / track                            | Ms. Marekebisho     |
| 20 | (billing-collections)           | Rent + utility billing + collections      | tenant, manager, finance  | T2   | bill / chase / settle-propose                        | Mr. Bili            |
| 21 | compliance-pack                 | Compliance pack delivery                  | compliance, regulator     | T1   | assemble / verify / brief                            | Ms. Idhini          |
| 22 | content-studio                  | Brand collateral generation               | manager, marketing        | T1   | compose / improve / publish-propose                  | Ms. Sanaa           |
| 23 | document-studio                 | Doc generation per recipe                 | manager, owner            | T1   | draft / cite-check / approve-propose                 | Mr. Hati            |
| 24 | marketing-brain                 | Campaign composition                      | manager (marketing)       | T1   | plan / launch-propose / measure                      | Ms. Tangaza         |
| 25 | proactive-intel                 | Proactive ops intelligence                | owner, manager            | T0   | watch / surface / brief                              | Mr. Macho           |
| 26 | progressive-intelligence        | Adaptive capability surfacing             | owner, admin              | T0   | detect / propose / nudge                             | Ms. Ongezeko        |
| 27 | carbon-market                   | Carbon credit advisory                    | owner                     | T2   | assess / propose / file                              | Dr. Hewa            |

Authority tier guidance is identical to the Borjie spec.

---

## 5. Junior runtime contract — request flow

```
User input via floating chat (any surface)
      |
      v
Audience-resolver  ->  junior_id (or 'mr-mwikila')
      |
      v
Junior persona system prompt loaded + JuniorScope applied to OrgUserDataContext
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
   compose_campaign_v1 (only if junior owns a campaign recipe)
      |
      v
Mutation Authority — tier check via JuniorScope.authority_tier_max
      |
      +-- if tier exceeded  ->  escalate to Mr. Mwikila with hand-off transcript
      |
      v
Output produced + audit-chained to junior_id + Mr. Mwikila visibility row in agent_turns
```

---

## 6. Mr. Mwikila visibility

Every junior turn writes a row to `agent_turns`. Mr. Mwikila's working
memory has a subscription to `agent_turns where agent_id != 'mr-mwikila'`.
The MD treats those rows as oversight signal — sampling them in the
Daily Briefing, surfacing anomalies (e.g. a junior with sustained
low-confidence turns, or a junior repeatedly escalating cross-domain),
and proactively offering to retrain the junior's persona or extend its
scope. The MD can also intervene mid-turn.

---

## 7. Escalation patterns

The junior escalates to Mr. Mwikila in five clearly-defined situations:

1. **Cross-domain intent.** User asks something spanning the junior's
   scope plus another junior's scope (e.g. lease question + billing
   question). Junior summarises and hands off.
2. **Low confidence.** Cognitive engine returns confidence < 0.4.
3. **Tier exceeded.** User asks for a mutation above the junior's
   `authority_tier_max`.
4. **Owner names a junior + asks cross-domain.** Owner says "ask Mr.
   Mkataba about FX exposure" — Mkataba cannot answer (FX is not in his
   scope) and hands off to Mr. Mwikila.
5. **Safety / compliance critical event.** Any junior detecting a
   critical safety incident or regulatory violation escalates
   immediately.

---

## 8. The 4 capability scopings per junior

Every junior owns a slice of each of the four atomic creation
capabilities. Examples:

**Tab recipes owned.** `lease-renewal` owns `lease_renewal_review`,
`rent_adjustment_proposal`. Trying to compose `vendor_onboarding`
(owned by `maintenance-coordinator`) yields a scope-violation error.

**Doc recipes owned.** `lease-renewal` owns `lease_renewal_letter`,
`rent_adjustment_notice`.

**Media recipes owned.** `marketing-brain` owns `property_listing_image`,
`virtual_tour_video`. Estate-department-advisor does NOT — keeps the
marketing voice consistent.

**Research topics.** `compliance-pack` is an expert in Tanzania
property law, ESTATE regulator filings, ULA Act, and Boss Nyumba's own
historical compliance corpus.

---

## 9. Junior personas have names

Property-domain Swahili names (full list in §4):

- estate-department -> **Mr. Karibu** (karibu = "welcome")
- lease-renewal -> **Mr. Mkataba** (mkataba = "contract")
- tenant-onboarding -> **Ms. Karibu** (welcoming)
- property-inspection -> **Mr. Tafiti** (tafiti = "investigate")
- maintenance-coordinator -> **Ms. Marekebisho** (marekebisho = "repairs")
- billing-collections -> **Mr. Bili** (bili = "bill")
- safety -> **Mr. Kombo** (kombo = "alertness")
- compliance -> **Ms. Idhini** (idhini = "permit / licence")
- carbon-market -> **Dr. Hewa** (hewa = "air / atmosphere")
- workforce-orchestrator -> **Ms. Kazi** (kazi = "work")
- fleet-management -> **Mr. Gari** (gari = "vehicle")
- inventory -> **Mr. Ghala** (ghala = "warehouse")
- market-intelligence -> **Mr. Soko** (soko = "market")
- lifecycle -> **Ms. Mzunguko** (mzunguko = "cycle")
- green-angle -> **Ms. Kijani** (kijani = "green")
- sustainability -> **Mr. Endelevu** (endelevu = "sustainable")
- proactive-intel -> **Mr. Macho** (macho = "eyes / watch")
- progressive-intel -> **Ms. Ongezeko** (ongezeko = "growth")
- acquisition -> **Mr. Mnunuzi** (mnunuzi = "acquirer")
- expansion -> **Mr. Panua** (panua = "expand")
- role-aware -> **Mr. Sajili** (sajili = "register")
- stage -> **Ms. Hatua** (hatua = "stage / step")
- estate-auto-management -> **Ms. Auto** (auto = automation cadre)
- geo-intelligence -> **Mr. Ramani** (ramani = "map")
- content-studio -> **Ms. Sanaa** (sanaa = "art")
- document-studio -> **Mr. Hati** (hati = "document")
- marketing-brain -> **Ms. Tangaza** (tangaza = "announce")

The MD persona name (Mr. Mwikila) is preserved across both brands.

---

## 10. Anti-patterns

- **Output outside scope.** A junior produces a document or tab not in
  its `recipes_owned`. Caught by the persona-runtime scope filter.
- **Bypassing the cognitive engine.** A junior returns a raw model
  completion without routing through the 6 disciplines. Caught by the
  agent-runtime.
- **Writes outside `data_tables`.** Caught at the mutation authority
  gate.
- **Junior shown to an unauthorised audience.** The audience-resolver
  returns the MD as fallback.
- **Owner asks Mr. Mwikila but he silently delegates.** Owner has the
  right to know who is responding — the MD MUST disclose delegation.

---

## 11. Implementation plan — Boss Nyumba phases

Each junior upgrade is 4-8 hours of engineering:

1. Write `<junior>-persona.ts`.
2. Define `JuniorScope`.
3. Write 3-5 modes.
4. Register recipes.
5. Tests.

Sequencing (mirrors Borjie):

- **Wave 18V-B (next batch — 5 juniors).** Top-of-mind for the busiest
  audiences: `estate-department-advisor`, `lease-renewal`,
  `maintenance-coordinator`, `tenant-onboarding`, `billing-collections`.
- **Wave 18V-C (next 10).** Lifecycle, expansion, acquisition,
  workforce, fleet, inventory, property-inspection, compliance, safety,
  market-intelligence.
- **Wave 18V-D (final batch).** Sustainability, green-angle, content-
  studio, document-studio, marketing-brain, geo-intelligence,
  proactive-intel, progressive-intel, role-aware, stage, estate-auto,
  carbon-market.

---

## 12. Schema additions

```sql
CREATE TABLE junior_personas (
  id text PRIMARY KEY,
  display_name text NOT NULL,
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
tenant-scoped and RLS-bound.

---

## 13. Cross-repo

Borjie mirrors this spec at `docs/DESIGN/JUNIOR_ARCHITECTURE_SPEC.md`
with brand + domain swap — property juniors become mining juniors
(`mine-planner-advisor`, `geology-advisor`, `fx-treasury-advisor`,
`mining-commodity-intelligence`, plus the mining-domain workforce /
fleet / inventory juniors) with the same contract and mining-domain
`data_tables`, `tab_recipes_owned`, etc.
