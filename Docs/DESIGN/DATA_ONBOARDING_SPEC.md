# Data Onboarding — Design Specification (Boss Nyumba)

> Wave 18U / persistence layer — the canonical contract for "the
> Central Estate Manager knows where to put the data." Owner drops an
> Excel file in chat and says *"this is a list of my tenants"*; Mr.
> Mwikila reads the structure, compares it against the tenant's
> existing schema, proposes the new columns/tables/tabs that should
> land in the database, persists the rows with full provenance, walks
> the schema to build a profile-chain graph, and enriches every row
> with deep online research. This is the layer that **places data
> where it belongs**.

Status: design-spec (ported from Borjie hard-fork — Wave 18U).
Phase 2 will ship `packages/data-onboarding/` + migration +
api-gateway routes + persona-kernel tool. Reuses (does NOT duplicate)
existing BossNyumba `packages/document-analysis`,
`packages/file-ingest`, `packages/ai-copilot`, `packages/audit-hash-chain`,
and `packages/persona-runtime` infrastructure.

Brand: Boss Nyumba. Persona: Mr. Mwikila (Central Estate Manager).

Sibling specs:

- Anticipatory UX: [`Docs/DESIGN/ANTICIPATORY_UX_SPEC.md`](./ANTICIPATORY_UX_SPEC.md). Onboarding emits `compose_tab_v1` proposals once a profile chain is built.
- Document composition: [`Docs/DESIGN/DOCUMENT_COMPOSITION_SPEC.md`](./DOCUMENT_COMPOSITION_SPEC.md). Per-renter profile sheets composed as documents.
- Deep research: [`Docs/DESIGN/DEEP_RESEARCH_SPEC.md`](./DEEP_RESEARCH_SPEC.md). Enrichment runs through the research adapter contract.
- Capabilities unification: [`Docs/DESIGN/CAPABILITIES_UNIFICATION.md`](./CAPABILITIES_UNIFICATION.md). Onboarding routes from `compose_anything_v1` when a parsed attachment is classified as "data to persist."
- Marketing & promotion: [`Docs/DESIGN/MARKETING_PROMOTION_SPEC.md`](./MARKETING_PROMOTION_SPEC.md). Onboarded renter pools feed campaign-segment audiences.
- Media generation: [`Docs/DESIGN/MEDIA_GENERATION_SPEC.md`](./MEDIA_GENERATION_SPEC.md). Property-profile media uses onboarded fields.

---

## 0. Boss Nyumba Porting Opportunities (Borjie → Boss Nyumba)

When the Borjie implementation of `packages/data-onboarding/`
stabilises, the port to Boss Nyumba is **largely a brand + domain
rename + smaller composition work**. The following porting
opportunities have been identified during the audit:

1. **Reuse `@bossnyumba/file-ingest`** — already present and shares
   the schema-sniff inference + parsing adapters Borjie's
   data-onboarding consumes. Direct path through `packages/file-ingest`
   for the discovery stage; no new parser work required.
2. **Reuse `@bossnyumba/document-analysis`** — BossNyumba's existing
   document-AI layer already parses lease PDFs, payment statements,
   inspection reports. The onboarding pipeline plugs this in as the
   per-row-text extractor for Stage 2 when the source is a PDF.
3. **Reuse `@bossnyumba/audit-hash-chain`** — identical port from the
   shared LITFIN ancestor; provenance + enrichment audit-hash sealing
   is drop-in. No code change needed.
4. **Reuse `@bossnyumba/ai-copilot`** — existing entity-extraction
   subroutines (renter-name normalisation, NIDA detection, property-
   address geocoding) can be invoked by the Stage 3 LLM-driven
   re-typing step. Avoids rebuilding the Tanzania-specific normalisers.
5. **Reuse `@bossnyumba/persona-runtime`** — the persona kernel tool
   `onboard_data_v1` lives here in both forks; the contract is
   identical, only the persona greeting text changes.
6. **Adapt entity-type catalogue** to property-domain: renter,
   property, lease, payment_record, work_order, inspection, document,
   building, unit, vendor, vacancy_listing. The catalogue swap is
   mechanical — column-name regexes plus target-table names.
7. **Adapt enrichment adapters** to property regulators: NIDA
   (shared), NHIF (Tanzania National Health Insurance Fund — replaces
   NSSF for renter onboarding), TIN registry (TRA — Tanzania Revenue
   Authority), property-title registry (Ministry of Lands), credit-
   bureau pull (CRB Africa) for renter creditworthiness. Same adapter
   shape as Borjie; different upstream targets. Phase 2 ships 4
   adapters; the existing `packages/credit-rating` already covers CRB
   integration and can be wired in directly.

Estimated port effort once Borjie's package stabilises: **1–2 days**
of brand-rename + entity catalogue swap + adapter retarget. Spec
already complete (this doc).

---

## 1. Vision

Founder, verbatim (transliterated from caps):

> "User says 'this is a list of my tenants' — Boss Nyumba (Mr.
> Mwikila) knows what to do, where to add data, fields, rows,
> columns, tabs to populate, layout of tabs to use, linkage of data
> between tabs to get full profile chain etc. All SOTA deep online
> research."

Mr. Mwikila as universal-creator already composes **tabs**,
**documents**, **media**, **campaigns**. What he could not yet do
is the most foundational creator-act of all: **place the owner's raw
data where it belongs in the property-management operational
substrate**. Until now, file uploads either landed in attached-blob
storage (without becoming queryable rows) or were parsed for a single
chat turn and forgotten.

This spec closes that gap. It defines a 7-stage pipeline that takes
an uploaded tabular file (Excel, CSV, PDF table, image-OCR table)
and walks it through:

1. **Intent + entity recognition** — what kind of entity is this?
2. **Schema discovery** — what columns/types/keys does the file
   contain?
3. **Existing-schema matching** — which of these already exist in the
   tenant's tables? Which need to be added?
4. **Schema evolution proposals** — every new column/table/tab rides
   the Tier-2 approval queue with double-verify on irreversible drops.
5. **Row persistence** — actual writes to the tenant's tables, with
   row-level provenance back to the source file.
6. **Cross-table linkage + profile chain** — Mr. Mwikila walks the
   schema to find every entity a renter (property, lease, payment,
   inspection, work order, …) joins to; suggests a new "People" tab
   layout if the owner doesn't have one; composes via `compose_tab_v1`.
7. **Deep online research enrichment** — NIDA registry, NHIF, TRA,
   CRB Africa credit-bureau, Land registry, market rate comparables —
   Tier 0 read-only research; findings attached to each row's audit
   hash.

Every stage carries an **owner-touch point**: Mr. Mwikila proposes,
the owner confirms or corrects, the persistence proceeds. Nothing
irreversible happens without explicit, double-verified approval.

---

## 2. The 7 Onboarding Stages

### Stage 1 — Intent + Entity Recognition

Owner uploads `Tenants Q3 2025.xlsx` to chat and says "this is my
tenant list." Cognitive engine parses the file. The new onboarding
layer takes that parse result + the chat-turn intent and classifies
the inbound feed as an entity-type from a closed catalogue (§5).
Confidence floor: **0.7** — below that, the Central Estate Manager
asks a clarifying question rather than guess.

Invocation: `onboard_data_v1({ attachment_id, intent_hint })`
returns `{ session_id, inferred_entity_type, entity_confidence }`.

### Stage 2 — Schema Discovery

Sample the first **N = 50** rows. For each column, infer:

- **Inferred type** from the closed taxonomy: `string | number | date
  | datetime | boolean | enum | email | phone | nida | tin |
  coordinate | url`.
- **Cardinality** — unique, high, low, or unknown.
- **Nullability** — fraction of rows with null.
- **Enum values** if cardinality is low and value set ≤ 12.
- **Sample values** — up to 8 deduped, non-PII-redacted samples.

Detect candidate primary keys: columns with cardinality `unique` and
nullability ≤ 0.05. In a renter file, NIDA is almost always the
correct key. The output is a typed `DiscoveredSchema`.

Reuses `packages/file-ingest/src/schema-sniff/*` heuristic
inference. Adds LLM-driven type refinement for borderline cases
(e.g. `"+255 712 ..."` → phone; `"19990321-12345-67890-12"` → NIDA).

### Stage 3 — Existing Schema Matching

Load the tenant's relevant table catalog (gated by `entity_type` → a
short list of target tables; for `renter`: `customers`, `lease`,
`payments`, `arrears_cases`). For each inbound column, attempt to
match against an existing field by name + type + value distribution.
Three outcomes per source column:

- **exact match** — name + type identical → use as-is.
- **fuzzy match** (similarity ≥ 0.8 but < 1.0) — propose mapping +
  optional transform, owner confirms.
- **no match** — propose a new column or table (Stage 4).

Output: `SchemaMatchResult` carrying the target table, the per-column
mappings, the unmatched columns, and a list of `JoinCandidate`s
detected by foreign-key heuristics.

### Stage 4 — Schema Evolution Proposals

For unmatched columns / missing tables / suggested tabs, Mr. Mwikila
builds one or more `SchemaEvolutionProposal`s. Each proposal carries:

- **DDL diff** — `ALTER TABLE customers ADD COLUMN next_of_kin_phone text`
- **Drizzle delta** — TypeScript schema change
- **Migration filename** — next available number
- **RLS policy** — if a new table, default `app.tenant_id` GUC isolation
- **Side-effects summary** — every tab/report that surfaces this column
- **Reversibility flag** — `ALTER TABLE ADD COLUMN` fully reversible;
  `DROP COLUMN` irreversible (second authoriser); `MODIFY COLUMN TYPE`
  partial
- **Research evidence ids** — every proposal cites at least one
  artefact

Every proposal flows through the mutation-authority Tier-2 queue.
Irreversible proposals trigger double-verify.

### Stage 5 — Row Persistence

Once the owner approves (a) the column mappings from Stage 3 and (b)
the schema evolutions from Stage 4, actual row writes proceed. The
persister:

- **UPSERT** by the resolved primary key (NIDA for renters,
  property_id for properties, lease_id for leases, etc).
- **Tier 2** if total rows > 100, or if any row carries a conflicting
  key (potential merge — owner must decide).
- **Each persisted row** carries a `provenance` row in
  `data_onboarding_row_provenance` naming the file, sheet, row
  number, operation, and audit hash.
- **PII fields** (NIDA, bank account, salary) pass through
  `pii-redactor` before being shown in any owner-facing preview.

### Stage 6 — Cross-Table Linkage + Profile Chain

Once rows have landed, Mr. Mwikila walks the tenant schema to find
every table that joins to the newly-onboarded entity. For renters:
`lease`, `payments`, `arrears_cases`, `feedback_complaints`,
`inspections`, `work_orders`, `tenant_risk_reports`. The result is a
`ProfileChainGraph`:

- `root_entity` and `root_table`
- `chain_nodes` — each with `join_to_root`, `cardinality`, aggregates
- `suggested_tab_layout` — list-view fields + detail-view groups +
  drill-through targets

The Central Estate Manager proposes a layout and dispatches
`compose_tab_v1`. Owner sees the rendered tab preview before
promotion to live. A "Renter Profile" detail page is composed as a
sibling document recipe (`compose_doc_v1`) if owner approves.

### Stage 7 — Deep Online Research Enrichment

For each persisted row, optionally enrich via:

- **NIDA registry** (TZ public lookup) — verify identity
- **NHIF** (Tanzania National Health Insurance Fund) — confirm
  enrollment for renters with dependents (replaces Borjie's NSSF)
- **TRA / TIN registry** — taxpayer identification verification
- **CRB Africa** (credit bureau) — renter creditworthiness pull,
  routed via the existing `@bossnyumba/credit-rating` package
- **Ministry of Lands title registry** — property-title verification
  for property feeds
- **Market-rate comparables** — local-area rent benchmarks via the
  existing `market-rate-snapshots` schema

Each enrichment is **Tier 0** (read-only research, no mutation).
Findings get attached to the row's audit-chain entry. Owner-visible
badge on the renter profile: `Verified via NIDA, CRB, NHIF` or
`Unverified — research pending` or `Verification failed — NIDA
mismatch`.

Budget reservation through `@bossnyumba/llm-budget-governor` before
any paid-API call.

---

## 3. The DataOnboardingRecipe Contract

```typescript
export interface DataOnboardingRecipe {
  readonly id: string;                          // 'renters_onboarding', 'properties_onboarding'
  readonly entity_type: EntityType;
  readonly version: number;
  readonly status: 'draft' | 'shadow' | 'live' | 'locked' | 'deprecated';
  readonly discover: (sample: TabularSample) => Promise<DiscoveredSchema>;
  readonly match: (discovered: DiscoveredSchema, ctx: TenantSchemaCtx) => Promise<SchemaMatchResult>;
  readonly propose_evolution: (match: SchemaMatchResult) => Promise<ReadonlyArray<SchemaEvolutionProposal>>;
  readonly persist: (rows: ReadonlyArray<Row>, approved_schema: AppliedSchema) => Promise<PersistResult>;
  readonly build_chain: (entity_type: EntityType, ctx: TenantSchemaCtx) => Promise<ProfileChainGraph>;
  readonly enrich: (rows: ReadonlyArray<PersistedRow>, ctx: EnrichmentCtx) => Promise<EnrichmentResult>;
  readonly authority_tier: 0 | 1 | 2;
  readonly brand: 'bossnyumba';
}

export type EntityType =
  | 'renter' | 'property' | 'lease' | 'payment_record' | 'work_order'
  | 'inspection' | 'document' | 'building' | 'unit' | 'vendor'
  | 'vacancy_listing' | 'arrears_case' | 'kpi' | 'unknown';

export interface DiscoveredSchema {
  readonly source_file: { id: string; name: string; sheet?: string };
  readonly columns: ReadonlyArray<DiscoveredColumn>;
  readonly sample_rows_count: number;
  readonly inferred_entity_type: EntityType;
  readonly inferred_primary_key: string | null;
  readonly entity_confidence: number;
}

export interface DiscoveredColumn {
  readonly name: string;
  readonly inferred_type: 'string' | 'number' | 'date' | 'datetime' | 'boolean' | 'enum' | 'email' | 'phone' | 'nida' | 'tin' | 'coordinate' | 'url';
  readonly cardinality: 'unique' | 'high' | 'low' | 'unknown';
  readonly nullability: number;
  readonly enum_values?: ReadonlyArray<string>;
  readonly sample_values: ReadonlyArray<unknown>;
}

export interface SchemaMatchResult {
  readonly target_table: { schema: string; table: string };
  readonly column_mappings: ReadonlyArray<ColumnMapping>;
  readonly unmatched_columns: ReadonlyArray<DiscoveredColumn>;
  readonly join_keys_to_other_tables: ReadonlyArray<JoinCandidate>;
}

export interface SchemaEvolutionProposal {
  readonly id: string;
  readonly kind: 'add_column' | 'add_table' | 'add_index' | 'add_join_view' | 'add_tab' | 'modify_column';
  readonly ddl: string;
  readonly drizzle_delta: string;
  readonly migration_filename: string;
  readonly side_effects: ReadonlyArray<string>;
  readonly reversibility: 'fully' | 'partial' | 'irreversible';
  readonly authority_tier: 2;
  readonly research_evidence_ids: ReadonlyArray<string>;
}

export interface ProfileChainGraph {
  readonly root_entity: EntityType;
  readonly root_table: string;
  readonly chain_nodes: ReadonlyArray<ChainNode>;
  readonly suggested_tab_layout: SuggestedTabLayout;
}

export interface EnrichmentResult {
  readonly per_row: ReadonlyArray<RowEnrichment>;
  readonly overall_quality: 'high' | 'medium' | 'low';
  readonly audit_hash: string;
}
```

---

## 4. The 7-Stage Flow

```
upload ─▶ S1 Intent ─▶ S2 Discover ─▶ S3 Match ─▶ S4 Propose Evolution ─▶ (Owner approves Tier 2)
                                              │
                                              └▶ S5 Persist Rows ─▶ S6 Build Chain ─▶ S7 Enrich (Tier 0 research)
                                                                              │
                                                                              ▼
                                                                       compose_tab_v1
                                                                              │
                                                                              ▼
                                                                       compose_doc_v1 (per renter profile)
                                                                       (optional)
```

---

## 5. Entity-Type Recognition Catalogue

```
| File content signature                       | Entity type      | Target table              |
|----------------------------------------------|------------------|---------------------------|
| Cols include NIDA, name, lease_id            | renter           | customers                 |
| Cols include property_id, address, units     | property         | properties                |
| Cols include lease_id, start_date, end_date  | lease            | lease                     |
| Cols include amount, paid_at, period         | payment_record   | payments                  |
| Cols include work_order_id, severity         | work_order       | maintenance               |
| Cols include inspection_date, score          | inspection       | inspections               |
| Cols include building_id, blocks, units      | building         | buildings                 |
| Cols include unit_id, floor, bedrooms        | unit             | units                     |
| Cols include vendor_name, scope_of_work      | vendor           | vendors                   |
| Cols include listing_id, asking_rent         | vacancy_listing  | vacancy_pipeline          |
| Cols include arrears_amount, days_overdue    | arrears_case     | arrears_cases             |
| Cols include doc_type, signed_at             | document         | documents                 |
```

Recognition runs as a deterministic-first pass (regex / column-name
matching) with a confidence score; below threshold, an LLM step
re-classifies using sample-row content. The Central Estate Manager
never silently guesses — below 0.7 confidence, it asks the owner.

---

## 6. Profile-Chain Examples (Property Domain)

**Renter profile chain.**
`customers → lease → payments → arrears_cases (active) →
feedback_complaints → inspections (last 90d) → work_orders →
tenant_risk_reports → credit_rating → next_of_kin_records`.

Surfaced as: a list-view "Renters" tab with `name | property |
lease_status | last_payment | arrears_status`; drill into detail →
multi-section renter profile (Identity, Lease, Payment History,
Compliance, Maintenance, Verifications); aggregate KPIs (on-time
payment %, arrears amount, complaint volume, lease-renewal pipeline).

**Property profile chain.**
`properties → units → lease (active) → customers (renters) → payments
(YTD) → property_valuations → property_grading → maintenance →
inspections → market_rate_snapshots`.

Surfaced as: a "Properties" tab with `property_id | address |
units_count | occupancy_pct | gross_rent_ytd`; drill into detail →
Overview, Units, Renters, Financials, Maintenance, Valuations.

**Building profile chain.**
`buildings → blocks → units → lease → customers → payments →
inspections_extensions → maintenance → vacancy_pipeline`.

Surfaced as: a "Buildings" tab with each building's KPI dashboard,
occupancy, gross rent YTD, maintenance burn rate, vacancy pipeline.

---

## 7. Owner-Touch Points

- **After Stage 1+2.** "I think this is a renter feed (confidence
  0.91, primary key looks like NIDA). Confirm or correct?"
- **After Stage 3.** "Here's the column mapping I propose: 28 fields
  match your existing schema, 4 need new columns, 1 needs a new table
  (`renter_emergency_info`). Any corrections before I persist?"
- **At Stage 4.** Tier-2 schema evolution proposals → owner-approval
  queue. New-table-with-PII triggers second-authoriser.
- **At Stage 5.** Row-level diff preview → owner approves persist.
- **At Stage 6.** Tab layout preview → owner approves; promoted from
  shadow to live.
- **At Stage 7.** "I can verify identities via NIDA, NHIF, CRB
  Africa. Should I? (Budget: 47 rows × $0.02 = $0.94.)"

---

## 8. Anti-Patterns

- **Auto-persist rows without owner approval.** Even Tier-1 row
  inserts require Stage 5 confirmation.
- **Create a new column / new table without Tier 2 approval.**
- **Drop a column or DELETE rows without explicit owner direction.**
- **Persist data with PII fields unredacted in previews.**
- **Enrich a row via paid API without budget reservation.**
- **Build a profile chain with circular joins.**
- **Bypass schema-sniff and feed raw CSV to the persister.**

---

## 9. Schema Additions

Two new tables:

```sql
CREATE TABLE data_onboarding_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  user_id text NOT NULL,
  attachment_id uuid NOT NULL,
  inferred_entity_type text NOT NULL,
  entity_confidence numeric(3,2) NOT NULL,
  status text NOT NULL DEFAULT 'discovering',
  discovered_schema jsonb,
  schema_match_result jsonb,
  evolution_proposals jsonb,
  persist_result jsonb,
  profile_chain_graph jsonb,
  enrichment_result jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE data_onboarding_row_provenance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  target_table text NOT NULL,
  target_row_id text NOT NULL,
  source_session_id uuid NOT NULL REFERENCES data_onboarding_sessions(id),
  source_file_name text,
  source_sheet text,
  source_row_number int NOT NULL,
  operation text NOT NULL,
  audit_hash text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE data_onboarding_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON data_onboarding_sessions
  USING (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE data_onboarding_row_provenance ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON data_onboarding_row_provenance
  USING (tenant_id = current_setting('app.tenant_id', true));
```

`data_onboarding_sessions.status` lifecycle: `discovering → matching
→ proposing → awaiting_owner → persisting → enriching → complete |
failed`.

---

## 10. Phase 2 Implementation Map (Port from Borjie)

- **New package** `packages/data-onboarding/` ported from Borjie with
  brand rename (`@borjie/*` → `@bossnyumba/*`) and entity-type
  catalogue swap.
- **3 seed recipes** ported and retargeted: `renter_onboarding`,
  `property_onboarding`, `lease_onboarding`.
- **New api-gateway routes**:
  - `POST /api/v1/data-onboarding/start`
  - `POST /api/v1/data-onboarding/:session_id/approve-schema`
  - `POST /api/v1/data-onboarding/:session_id/persist`
  - `GET /api/v1/data-onboarding/:session_id/status`
- **Wire into `compose_anything_v1`**.
- **Persona kernel tool** `onboard_data_v1`.
- **Migration**: next available number — at last check, the highest
  is `0002_notification_dispatch_log.sql.skip`. Migration will be
  numbered when porting.
- **Reuses**: `@bossnyumba/file-ingest`, `@bossnyumba/document-analysis`,
  `@bossnyumba/audit-hash-chain`, `@bossnyumba/credit-rating`,
  `@bossnyumba/ai-copilot`, `@bossnyumba/persona-runtime`.

Out-of-scope for Phase 2 (explicitly): automatic schema-evolution
**without owner approval** (never), recipe self-authoring (deferred),
bulk re-onboarding of previously imported files (deferred).

---

## 11. Test Strategy

- **Unit** — entity-recognizer, column-type-inferer, column-matcher,
  proposal-builder, chain-graph-builder, persister, enrichment
  orchestrator. ≥70 % per file.
- **Integration** — seed recipes against fixture spreadsheets
  (renters / properties / leases, each with 5 rows). End-to-end
  pipeline from upload to enrichment.
- **Failure paths** — confidence floor below 0.7, schema-evolution
  rejection by owner, Tier-2 expiry, NIDA-mismatch enrichment failure.
- **Coverage** — package ≥ 70 % at scaffold; ramps to 80 %+ once seed
  recipes harden.

---

## 12. Acceptance Criteria (Boss Nyumba Wave 18U exit)

1. Spec doc lands (this file). ✅
2. `packages/data-onboarding/` ported from Borjie; typechecks clean;
   `pnpm -F @bossnyumba/data-onboarding test` passes.
3. Migration lands; the two new tables exist with RLS and the
   `app.tenant_id` policy.
4. The three seed recipes are wired into the registry and exercised
   by smoke tests.
5. Spec doc cross-references render in the `Docs/DESIGN/` index.
6. No modifications outside the new package, the migration, the
   database schema barrel, and this spec file.

Subsequent waves will:

- Add the four api-gateway routes.
- Wire `onboard_data_v1` into the persona kernel tool registry.
- Implement the BossNyumba-specific enrichment adapters (NHIF, TRA,
  CRB Africa, Ministry of Lands) using the existing `credit-rating`
  package where possible.
- Promote each seed recipe from `shadow` to `live` once owner-tested.

— *Mr. Mwikila does not move data without knowing where it belongs.*
