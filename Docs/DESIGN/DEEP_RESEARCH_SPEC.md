# Deep Research Specification

**Status:** Design — Phase 1 (spec only). Phase 2 implementation is staged.
**Author:** Boss Nyumba AI platform.
**Persona owner:** Mr. Mwikila — Boss Nyumba's AI Estate Operations Manager.
**Cross-links:** `docs/DESIGN/ANTICIPATORY_UX_SPEC.md` (sibling spec — fields + citations consumer), `docs/DESIGN/DOCUMENT_COMPOSITION_SPEC.md` (sibling spec — sections + references consumer).

---

## 1. Vision

The founder's emphasis is verbatim: *"Deep online research here we need to be SOTA. Even in all document types creation too. The MD as dynamic UI designer + UX optimizer, not just a tab-spawner."*

Mr. Mwikila is **not** a chat assistant that tab-spawns Google results. He is an **autonomous Estate Operations Manager** with a foundational research capability that is invoked by every other surface in Boss Nyumba:

- The **Anticipatory UX layer** consumes research outputs to pre-fill fields and surface evidence chips before the owner asks.
- The **Document Composition layer** consumes research outputs to compose sections, attach references, and validate claims in owner reports, board memos, regulator submissions, and investor decks.
- The **Proactive intel layer** consumes the **Continuous Watch** mode to emit threshold-cross hints (rent-index moves, FIRS / NLC circulars, title-register diffs).

This document specifies the research half. State of the art for 2026 means: multi-step agentic search, multi-source quality + bias scoring, span-level citations, real-time property-market + regulatory feeds, multi-modal extraction, long-running sessions that survive crashes, and audit-chain provenance per output. No vague "we'll grab the first three Google results" — every artifact is scored, every claim is cited, every output is hashed into `@bossnyumba/audit-hash-chain` so a regulator (FIRS, NGGIS, NLC, NIN) can verify the trail.

---

## 2. Foundation summary (what's already in Boss Nyumba)

The audit (`packages/ai-copilot/src/retrieval/`, `packages/ai-copilot/src/knowledge/`, `packages/document-analysis/src/`, `services/mcp-server-firs/`, `services/mcp-server-nggis/`, `services/mcp-server-nin/`, `packages/audit-hash-chain/`, `packages/brain-llm-router/src/cost-cascade/`, `services/proactive-triggers-worker/`, `services/sleep-pass-orchestrator/`) shows:

- **Strong retrieval primitives.** Hybrid BM25 + dense + Cohere rerank pipeline (`hybrid-search.ts`), contextual chunker (Anthropic pattern), span-level citation extractor (`span-citations.ts`, ports FRONT paper, Jaccard-best-sentence offset) — already gives single-digit hallucination on retrieved corpus.
- **Knowledge store.** `knowledge-store.ts` / `knowledge-retriever.ts` / `citations.ts` produces `Citation` objects with `citationId`, `sourceUrl`, `chunkIndex`, `quotedFrom` — directly reusable as the downstream contract for research outputs.
- **Document analysis pipeline.** OCR (Textract, Google Vision, Anthropic Vision, Docling, Marker, Tesseract adapters), layout parser, doc-classifier, entity extractor, orchestrator (`packages/document-analysis/src/orchestrator.ts`). PDF / image multi-modal already extractable.
- **Regulator MCP servers.** `services/mcp-server-firs/` (tax — VAT, TIN), `services/mcp-server-nggis/` (geo-spatial / land), `services/mcp-server-nin/` (national ID) — first-party tool adapters for the Nigerian regulator surface.
- **Audit-hash-chain.** `packages/audit-hash-chain/` — append-only chain, secret-rotated, pure functions ready to wrap any research output.
- **Cost cascade.** `packages/brain-llm-router/src/cost-cascade/` — model-tier escalation for budgeted research steps.
- **Proactive + sleep-pass workers.** `services/proactive-triggers-worker/` (hourly sweep, idempotent) and `services/sleep-pass-orchestrator/` (nightly passes). Both are the natural homes for **Continuous Watch** and **Daily Briefing**.
- **Personas.** `packages/ai-copilot/src/personas/manager-chat.ts` is Mr. Mwikila with HANDOFF protocol — the research tool surface plugs into his `availableTools` array.

**What's missing for SOTA agentic research:**

1. No web-search integration. There are zero hits for Tavily / Exa / Brave / Serper in the codebase. This is the largest gap.
2. No research-plan / step / artifact / result schema. Research is currently single-shot retrieval against the local corpus.
3. No source quality + bias scorer. Citations carry a `quotedFrom` field but not a quality score, bias flag, or recency tier.
4. No long-running session model. Research today is per-request; there is no `research_session` table, no checkpointing, no resume protocol.
5. No multi-source synthesizer with calibrated confidence + disagreement tracking.
6. No property-index / regulatory / news live feeds beyond the regulator MCP servers.

This spec closes those gaps.

---

## 3. The 5 Research Modes

### 3.1 Reactive Query
Owner asks a question in chat. Mr. Mwikila runs a 1–3 step plan, cites, replies inline.

- **Trigger:** chat message classified as a research-intent question.
- **Steps:** typically `corpus_query` → optional `web_search` → optional `web_fetch` of top hit.
- **Latency budget:** ≤8 s shallow (corpus-only), ≤30 s medium (web fallback).
- **Cost budget:** ≤$0.05 per query.
- **UX:** inline answer with evidence chips. Each chip links to the source (corpus chunk highlight OR external URL).

### 3.2 Anticipatory Sweep
Mr. Mwikila detects an intent and pre-researches the next 3 questions the owner is likely to ask. Runs in parallel with the chat response; output cached for instant follow-up.

- **Trigger:** intent classifier flags a topic with known follow-up patterns (e.g. "show me C of O status for plot X" → pre-research "renewal cost", "encumbrance / charge history on adjacent plots", "current ground-rent rate for the zone").
- **Steps:** 3 parallel plans, each capped at 3 steps.
- **Latency budget:** ≤30 s (runs in background, never blocks owner).
- **Cost budget:** ≤$0.10 per sweep.
- **UX:** pre-cached. When the owner asks the predicted follow-up, the answer is served from cache with a "researched ahead" badge.

### 3.3 Daily Briefing
Overnight cron — pull rent-index movements, regulatory feeds, competitor title-register diffs, FX moves, mortgage-rate signals; synthesize into a morning brief.

- **Trigger:** cron in `services/proactive-triggers-worker/` at 05:00 owner-local time.
- **Steps:** rent-index pulls (Knight Frank / NIESV / JLL Africa where APIs exist; scrape otherwise), regulatory-diff (FIRS / NLC / NGGIS / NIN gazette), news scan (GDELT), FX (CBN), competitor title-register diff.
- **Latency budget:** 5–15 min off-peak.
- **Cost budget:** ≤$2.00 per tenant per night.
- **UX:** email + in-app banner at 06:00 owner-local. Click expands to full report with citations.

### 3.4 Deep Dive
Owner says "research X deeply." Multi-hour, multi-step, may span days. Maintains an explicit research plan + progress ledger. Owner can pause / resume / re-prompt mid-run.

- **Trigger:** explicit owner command (e.g. "research the rent-control implications of the 2026 Lagos Tenancy Law amendment for the next 18 months").
- **Steps:** unlimited within budget. Planner re-plans after each batch based on findings.
- **Latency budget:** multi-hour to multi-day. Checkpointed every step.
- **Cost budget:** ≤$25 per dive with owner re-confirmation at $5 and $15 spent.
- **UX:** progress page with live updates + interim findings. Owner sees the research plan, can edit steps, can stop, can request a checkpoint summary.

### 3.5 Continuous Watch
Once configured (e.g. "watch Lagos Island prime-rent index + FIRS circulars for tenant TIN 12345"), Mr. Mwikila polls per cadence and emits proactive hints when thresholds cross.

- **Trigger:** owner-configured watch + cron poll.
- **Steps:** poll → diff → score-threshold-check → emit notification if crossed.
- **Latency budget:** poll cadence configurable (5 min for liquidity-traded indices, hourly for regulators, daily for news).
- **Cost budget:** ≤$1.00 per watch per day.
- **UX:** push notification on threshold cross + audit-chain entry. Owner sees a "watches" tab listing all active watches with last-fire timestamp.

---

## 4. The Research Engine architecture

Five components, each isolated, all communicating via typed messages on the existing event-bus (`packages/notifications/`):

### 4.1 Planner
LLM-driven research-plan generator. Inputs:
- `query` (owner intent or Mr. Mwikila's anticipatory hypothesis)
- current corpus state (recent ingests, active cases)
- available tools (web_search, web_fetch, corpus_query, rent_index, regulatory_diff, pdf_extract, image_ocr, table_parse)

Output: typed `ResearchPlan` (see §6) with steps, expected sources, success criteria, and a budget envelope. Uses `cost-cascade` to pick the right model tier (Haiku for shallow, Sonnet for medium, Opus for Deep Dive re-planning).

### 4.2 Executor
Runs each step sequentially or in parallel where the DAG allows. Tool calls return `ResearchArtifact` rows with provenance + a preliminary confidence score from the tool itself. The executor is responsible for retries, fallback (e.g. Tavily failed → try Exa → try Brave), and budget enforcement (aborts if `spent_usd_cents > budget_usd_cents`).

### 4.3 Scorer
Pure function that assesses each artifact on:
- **Source quality** — whitelist class (see §7).
- **Recency** — older than 90 days for fast-moving topics (rent indices, regs) → downweight 0.7x.
- **Agreement with other sources** — if ≥2 independent sources concur, boost.
- **Internal-corpus consistency** — if the artifact contradicts a high-confidence internal corpus fact, flag as disagreement.

Outputs `quality_score ∈ [0, 1]` and a `bias_flags[]` array (e.g. `paid_promotion`, `opinion`, `unverified`, `ai_generated`).

### 4.4 Synthesizer
Composes artifacts into a structured `summary_md` answer with span-level citations. Each claim carries `[doc:UUID p.PAGE]` for corpus sources or `[web:hash-id]` for web sources. Confidence is calibrated:
- **high** — 3+ independent high-quality sources agree.
- **medium** — 1 high-quality source + corpus consistency, OR 2 medium-quality sources agree.
- **low** — single source, no corroboration. UI shows a warning chip.

Disagreements are surfaced as a separate `disagreements[]` array — never silently averaged.

### 4.5 Audit-chain emitter
Every `ResearchResult` is canonical-JSON-hashed and appended to the tenant's `audit_hash_chain` via `appendEntry()` in `@bossnyumba/audit-hash-chain`. The chain row carries: plan_id, result_id, summary hash, citation hashes, model_id, cost, elapsed_ms. Regulators or owners can later verify the chain with `verifyChain()`.

---

## 5. SOTA tool integrations (2026 picks)

### 5.1 Web search — primary + fallback
- **Primary: Tavily Search API.** Agentic-native search, supports `search_depth=advanced`, returns AI-ready synthesised results plus raw URLs. Lower per-query cost than Exa for shallow queries.
- **Secondary fallback: Exa Search.** Semantic embedding search; superior on long-tail "find me a paper / filing / niche source" queries. Switch the executor to Exa when Tavily's top-3 quality_score is below 0.5.
- **Tertiary fallback: Brave Search API.** Cheap, broad, complementary index. Use as a sanity-check oracle (do Tavily + Exa miss something Brave found?).

### 5.2 Web fetch + extraction
- **JS-rendered pages: Firecrawl.** Returns markdown-cleaned content plus images + structured tables; outperforms ScrapingBee on dynamic property-market sites.
- **Static fetch: native `fetch` + `jsdom`.** No vendor cost for plain HTML.
- **Anti-bot escalation:** Firecrawl with proxy_rotation when a target returns 403 / 429.

### 5.3 PDF extraction
- **Existing** `packages/document-analysis/src/orchestrator.ts` is reused.
- **Table extraction** — add `tabula-py`-equivalent (`tabular-pdf` npm) for native PDFs; for image-only PDFs route through the existing Anthropic Vision adapter (`packages/document-ai/src/ocr/anthropic-vision-adapter.ts`) with a "extract this table as JSON" prompt.

### 5.4 OCR
- **Existing:** AWS Textract, Google Vision, Anthropic Vision, Docling, Marker, Tesseract — picked by the existing `ocr-factory`. No new integration needed — research just calls the existing orchestrator.

### 5.5 Chart / image extraction
- **Primary:** Anthropic Claude Haiku 4.5 vision (cheap, 90% of Sonnet quality per cost-cascade pricing). Reads chart axes + extracts data points as JSON.
- **Multi-modal embedding:** OpenAI `text-embedding-3-large` (3072-d) — for cross-modal search ("find me charts that look like this Lagos Island prime-rent 5-year trend").

### 5.6 Property-market feeds
- **Knight Frank / JLL Africa research notes** — RSS where available; otherwise scheduled scrape with diff against last-seen hash. TTL 24 hr.
- **NIESV (Nigerian Institution of Estate Surveyors and Valuers)** — circulars + benchmark valuation tables. Scrape; TTL 24 hr.
- **CBN (Central Bank of Nigeria)** — official FX rates + monetary-policy statements. Structured feed available; TTL 1 hr on FX, 24 hr on statements.

### 5.7 Regulatory feeds
- **FIRS** — `services/mcp-server-firs/` first-party MCP tools (verify_tin, file_vat_return, get_payment_status). Augment with FIRS gazette scrape for tax-rule changes. TTL 1 hr on filings status, 24 hr on rule diffs.
- **NLC (Nigerian Land Commission) / state land registries** — title-register diffs. Per-state availability varies; scrape Lagos, Abuja, Rivers, Ogun first.
- **NGGIS** — `services/mcp-server-nggis/` for geo-spatial / zoning lookups.
- **NIN** — `services/mcp-server-nin/` for identity verification (only on owner-confirmed lookups; PII-handled).

### 5.8 News
- **GDELT 2.0 API** — free, real-time, multilingual. Query for mentions of: regulator names, state government names, property-developer names in `extracted_entities`, Nigerian title-register IDs (C of O numbers, R of O numbers). Cost ≈ free.

---

## 6. The ResearchPlan + Artifact contract

TypeScript sketch (not full code). Lives in a new package `packages/research-tools/` (Phase 2).

```typescript
interface ResearchPlan {
  readonly id: string;
  readonly tenant_id: string;
  readonly mode: 'reactive_query' | 'anticipatory_sweep' | 'daily_briefing' | 'deep_dive' | 'continuous_watch';
  readonly query: string;
  readonly created_by: 'mr_mwikila' | 'owner_explicit';
  readonly created_at: string;
  readonly budget_ms: number;
  readonly budget_usd_cents: number;
  readonly steps: ReadonlyArray<ResearchStep>;
  readonly status: 'planned' | 'running' | 'paused' | 'complete' | 'failed';
  readonly result_id: string | null;
}

interface ResearchStep {
  readonly id: string;
  readonly plan_id: string;
  readonly seq: number;
  readonly tool: 'web_search' | 'web_fetch' | 'corpus_query' | 'rent_index' | 'regulatory_diff' | 'pdf_extract' | 'image_ocr' | 'table_parse';
  readonly tool_input: Record<string, unknown>;
  readonly status: 'pending' | 'running' | 'done' | 'failed';
  readonly artifact_ids: ReadonlyArray<string>;
  readonly cost_usd_cents: number | null;
  readonly duration_ms: number | null;
}

interface ResearchArtifact {
  readonly id: string;
  readonly step_id: string;
  readonly source_kind: 'web' | 'corpus' | 'feed' | 'pdf' | 'image' | 'table';
  readonly source_uri: string;
  readonly retrieved_at: string;
  readonly content: string;
  readonly extracted_entities: ReadonlyArray<Entity>;
  readonly quality_score: number;     // 0-1 from the Scorer
  readonly bias_flags: ReadonlyArray<string>;  // 'paid_promotion', 'opinion', 'unverified'
  readonly citation_id: string;       // for downstream span-citation linking
}

interface ResearchResult {
  readonly id: string;
  readonly plan_id: string;
  readonly summary_md: string;
  readonly span_citations: ReadonlyArray<SpanCitation>;
  readonly confidence: 'high' | 'medium' | 'low';
  readonly disagreements: ReadonlyArray<{ topic: string; sources: ReadonlyArray<string> }>;
  readonly audit_hash: string;
}
```

All types are `readonly` per the project immutability rule — no mutation between Planner → Executor → Scorer → Synthesizer.

---

## 7. Source quality scoring rubric

Concrete table. Used by the Scorer as the base score; modifiers (recency, corroboration, internal-consistency) are applied on top to produce final `quality_score`.

| Source class                                              | Base score | Notes                                       |
|-----------------------------------------------------------|------------|---------------------------------------------|
| Nigeria official (FIRS, NLC, NGGIS, NIN, CBN, state gov)  | 0.95       | First-party regulator data + gazette        |
| Tier-1 property analytics (Knight Frank, JLL, NIESV)      | 0.90       | Benchmarks, valuation indices, rent moves   |
| Academic / peer-reviewed                                   | 0.85       | Urban economics, land tenure, planning law  |
| Established news (BBC, FT, Premium Times, Business Day)   | 0.75       | Treat market opinion as commentary          |
| Industry trade press (Estate Intel, Nairametrics)         | 0.70       | Discount opinion pieces                     |
| Corporate filings (NGX-listed REITs, developers)          | 0.85       | But check disclosure incentives             |
| Forums / social                                            | 0.30       | Use only as lead, not as cite               |
| Unknown / generic blogs                                    | 0.20       | Require corroboration                       |
| AI-generated content (detected)                            | 0.10       | Reject unless verifiably sourced            |

**Modifiers:**
- Recency: published >90 days ago on a fast-moving topic → ×0.7.
- Corroboration: artifact agrees with ≥2 other high-quality sources → +0.10 (capped at 1.0).
- Internal-consistency: contradicts a `confidence=high` corpus fact → ×0.5 + emit `disagreements[]` entry.
- AI-generated detection: if `bias_flags` includes `ai_generated` → hard cap at 0.20 unless corroborated by a Tier-1+ source.

---

## 8. Citation contract

Every research output reuses the existing `packages/ai-copilot/src/retrieval/span-citations.ts` and `packages/ai-copilot/src/knowledge/citations.ts` formats. Two key extensions:

1. **Web citations** — new `kind: 'web'` value on `CitationSchema`. `sourceUrl` is required; `chunkIndex` is `0`; `quotedFrom` is the literal claim-supporting sentence extracted from the page.
2. **Audit linkage** — every `ResearchResult.audit_hash` ties into the tenant's chain via `@bossnyumba/audit-hash-chain`'s `appendEntry()`. The chain row's `payload` is the canonical-JSON of `{ result_id, plan_id, summary_hash, citation_hashes, model_id, cost_usd_cents, elapsed_ms }`. A regulator pulling the chain can verify the trail end-to-end.

---

## 9. Cost + latency controls

Budgets per mode (re-stated for ops clarity):

| Mode                  | Latency budget         | Cost budget                                    |
|-----------------------|------------------------|------------------------------------------------|
| Reactive Query        | ≤8 s shallow / ≤30 s   | ≤$0.05                                         |
| Anticipatory Sweep    | ≤30 s (background)     | ≤$0.10                                         |
| Daily Briefing        | 5–15 min off-peak      | ≤$2.00                                         |
| Deep Dive             | hours / days           | ≤$25 with owner re-confirm at $5 and $15       |
| Continuous Watch      | per-cadence            | ≤$1.00 / day                                   |

Cost-cascade router (`packages/brain-llm-router/src/cost-cascade/`) is reused so the Planner, Synthesizer, and any LLM-driven scorer step pick the cheapest tier that meets the quality bar. Cost meter integration via `services/outcomes-metering/` records per-plan spend and surfaces to ops dashboards.

---

## 10. Long-running session model

Deep-dive sessions use a `research_sessions` table with a checkpointed `state` jsonb column. Behaviour:

- Every step's `started_at` / `finished_at` is persisted to `research_steps`.
- Every artifact is persisted to `research_artifacts` immediately (not buffered in memory).
- A crash mid-dive resumes from the last completed step on next worker pickup.
- Owner can pause via the progress page; pause is a status change, not a worker kill — in-flight step completes, then the worker yields.
- Owner can re-prompt mid-run; the Planner re-plans from the current artifact set.
- Budget gates (`owner_sign_off_required_at_usd numeric[]`) — when spend crosses a gate, the dive pauses and the owner gets a notification with current findings + projected remaining cost. Owner must click "continue" to release.

---

## 11. Owner-touch points

| Mode                  | Surface                                                          |
|-----------------------|------------------------------------------------------------------|
| Reactive              | Inline chat reply with evidence chips. Click chip → source view. |
| Anticipatory          | Pre-cached, surfaces when owner asks the predicted follow-up. Carries a "researched ahead" badge.|
| Daily Briefing        | Email + in-app banner at 06:00 owner-local time. Banner click → full briefing page.|
| Deep Dive             | Progress page with live updates + interim findings + plan-edit affordance.|
| Continuous Watch      | Push notification on threshold cross + audit-chain entry. "Watches" tab lists actives.|

All surfaces consume the same `ResearchResult` shape. UI components live in `apps/admin-web/components/research/` (Phase 2).

---

## 12. Anti-patterns (MUST NOT)

The research engine MUST NOT:

1. Cite a single unverified source as fact. Below `quality_score=0.6` AND zero corroboration → confidence='low' + warning chip; never claim 'high'.
2. Mask AI-generated content as primary research. If the AI-detector flags an artifact, the bias_flag is propagated to the citation chip.
3. Exceed the budget without owner reconfirmation. Deep-dive budget gates at $5 / $15 are hard pauses, not soft warnings.
4. Lose state on a deep-dive crash. Every step's artifacts are persisted before the step is marked done.
5. Return a result without an audit hash. The Synthesizer refuses to emit a `ResearchResult` until `audit_hash` is computed and the chain row appended.

---

## 13. Phase 2 implementation plan

Concrete next steps, ordered by leverage:

1. **`services/research-orchestrator/`** — new service. Planner + Executor + Scorer + Synthesizer pipeline. Subscribes to `research.plan.requested` events; emits `research.result.ready` + `audit.chain.append`. Hosts the long-running session worker for Deep Dive.
2. **`packages/research-tools/`** — new package. Typed wrappers around Tavily, Exa, Brave, Firecrawl, GDELT, Knight Frank, JLL, NIESV, CBN, FIRS gazette, NLC title-registry, NGGIS, state-government scrapers. Each tool returns a `ResearchArtifact`. Pure adapters, no business logic.
3. **DB schema additions** — see §14.
4. **Persona system-prompt additions** — append three tools to Mr. Mwikila's `availableTools` (in `packages/ai-copilot/src/personas/manager-chat.ts`):
   - `research_v1` — run a fresh research plan.
   - `research_continuous_watch_v1` — configure / list / pause watches.
   - `research_resume_v1` — resume a paused or crashed deep-dive session.
5. **Cron jobs in `services/proactive-triggers-worker/`** — add Daily Briefing trigger (per tenant, 05:00 local) and Continuous Watch poll trigger (per watch cadence).
6. **Env vars** — `TAVILY_API_KEY`, `EXA_API_KEY`, `BRAVE_SEARCH_API_KEY`, `FIRECRAWL_API_KEY`, `KNIGHT_FRANK_FEED_URL`, `JLL_FEED_URL`, `CBN_FEED_URL`, `GDELT_BASE_URL`. Validated in `services/api-gateway/src/config/validate-env.ts` and the new service's bootstrap.
7. **Cost meter integration** — extend `services/outcomes-metering/` schema with `research_cost_usd_cents` per tenant per day; surface to ops dashboards.
8. **Audit-chain integration** — wire `appendEntry()` from `@bossnyumba/audit-hash-chain` into the Synthesizer's emit path.
9. **UI components** — `apps/admin-web/components/research/{EvidenceChip,ResearchProgressPage,WatchesTab,DailyBriefingBanner}.tsx`.

---

## 14. Schema additions

DDL sketches. Migrations land in `packages/database/migrations/` in Phase 2.

```sql
CREATE TABLE research_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  mode text NOT NULL,                        -- reactive_query|anticipatory_sweep|daily_briefing|deep_dive|continuous_watch
  query text NOT NULL,
  created_by text NOT NULL,                  -- mr_mwikila|owner_explicit
  created_at timestamptz NOT NULL DEFAULT now(),
  budget_ms int,
  budget_usd_cents int,
  status text NOT NULL DEFAULT 'planned',    -- planned|running|paused|complete|failed
  result_id uuid REFERENCES research_results(id),
  audit_hash text
);

CREATE TABLE research_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES research_plans(id),
  seq int NOT NULL,
  tool text NOT NULL,                        -- web_search|web_fetch|corpus_query|...
  tool_input jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  started_at timestamptz,
  finished_at timestamptz,
  cost_usd_cents int,
  duration_ms int,
  UNIQUE (plan_id, seq)
);

CREATE TABLE research_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id uuid NOT NULL REFERENCES research_steps(id),
  source_kind text NOT NULL,                 -- web|corpus|feed|pdf|image|table
  source_uri text NOT NULL,
  retrieved_at timestamptz NOT NULL DEFAULT now(),
  content text NOT NULL,
  extracted_entities jsonb,
  quality_score numeric(3,2),                -- 0.00-1.00
  bias_flags text[],
  citation_id text NOT NULL                  -- linked to span-citations
);

CREATE TABLE research_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES research_plans(id),
  summary_md text NOT NULL,
  span_citations jsonb NOT NULL,
  confidence text NOT NULL,                  -- high|medium|low
  disagreements jsonb,
  audit_hash text NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE research_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  topic text NOT NULL,
  active_plan_id uuid REFERENCES research_plans(id),
  state jsonb NOT NULL,                      -- checkpoint payload
  started_at timestamptz NOT NULL DEFAULT now(),
  last_progress_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'running',    -- running|paused|complete|failed
  owner_sign_off_required_at_usd numeric[]   -- e.g. {5, 15} budget gates
);

CREATE TABLE continuous_watches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  topic text NOT NULL,
  cadence_minutes int NOT NULL,
  last_run_at timestamptz,
  next_run_at timestamptz,
  thresholds jsonb,                          -- {rent_pct_change_above: 5, etc.}
  status text NOT NULL DEFAULT 'active'      -- active|paused
);
```

Indexes (Phase 2): `research_plans(tenant_id, status, mode)`, `research_steps(plan_id, seq)`, `research_artifacts(step_id)`, `research_sessions(tenant_id, status)`, `continuous_watches(next_run_at) WHERE status='active'`.

RLS (Phase 2): every table is tenant-scoped with the existing `tenant_id`-on-jwt policy template.

---

## 15. Cross-references

- Anticipatory UX layer: consumes `ResearchResult.span_citations` to surface evidence chips next to pre-filled fields. See `docs/DESIGN/ANTICIPATORY_UX_SPEC.md`.
- Document Composition layer: consumes `ResearchResult.summary_md` + `span_citations` to compose report / memo / submission sections with inline references. See `docs/DESIGN/DOCUMENT_COMPOSITION_SPEC.md`.
- Audit chain: `packages/audit-hash-chain/` — every research output appended.
- Cost cascade: `packages/brain-llm-router/src/cost-cascade/` — Planner + Synthesizer model-tier selection.
- Persona: `packages/ai-copilot/src/personas/manager-chat.ts` — Mr. Mwikila is the research entry point.

---

## 16. Porting note

This document was ported from the Borjie hard-fork's `docs/DESIGN/DEEP_RESEARCH_SPEC.md`. The architecture, schema, modes, scorer rubric, and cost / latency budgets are identical. The brand, persona-context, and domain-specific source classes were swapped for the Boss Nyumba property-management domain. Regulatory feeds were rerouted to the Nigerian regulator surface (FIRS / NLC / NGGIS / NIN / CBN); commodity feeds were replaced with property-market analytics (Knight Frank / JLL / NIESV).
