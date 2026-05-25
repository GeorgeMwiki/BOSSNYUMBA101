# LITFIN Memory / RAG / Knowledge-Graph — Deep Map + SOTA Gap Analysis (2026-05-23)

> Scope: LITFIN PROJECT memory hierarchy, RAG pipeline, knowledge-graph layers, learning loops, forgetting/TTL strategies. Goes substantially deeper than the partial parity slice at `BOSSNYUMBA101/.planning/parity-litfin/02-memory-learning.md` (2026-05-18) which only covered 4 memory tiers + feedback. This pass benchmarks LITFIN against the 2026-Q2 frontier: Mem0 v2, Letta v2 sleep-time agents, Zep + Graphiti bi-temporal KG, A-MEM, Microsoft GraphRAG + LazyGraphRAG, LightRAG, HippoRAG 2, Self-RAG, CRAG, Anthropic contextual retrieval, late chunking (Jina v3+), ColPali/ColBERT multi-vector, Cohere Rerank 3.5, bge-reranker-v2, Cognee, Marqo, Vespa.

LITFIN root: `/Users/georgesmackbookair/Desktop/CLAUDE_CURSOR_CODEX PROJECTS/Claude Projects/LITFIN PROJECT/`
BOSSNYUMBA root: `/Users/georgesmackbookair/Desktop/CLAUDE_CURSOR_CODEX PROJECTS/Cursor Projects/BOSSNYUMBA101/`

---

## Executive TL;DR

LITFIN's memory stack is the most architecturally ambitious open-source memory layer I have read in 2026. It is the cognitive-neuroscience research lab masquerading as a Next.js app: the 18-file `src/core/litfin-ai/memory/v2/` package (5,364 LOC total) ships Mem0 ADD/UPDATE/DELETE/NOOP semantics, Zep/Graphiti bi-temporal facts (valid_from / valid_to / observed_at / asserted_at + supersedes chain), Microsoft GraphRAG community detection (deterministic Leiden/Louvain, 50-70% global-query lift), Anthropic Contextual Retrieval (per-chunk preface via Haiku + 35-49% retrieval lift), BM25+vector hybrid with convex fusion, Cohere Rerank 3.5 cross-encoder, span-level citations (FRONT pattern, ~37% → <10% citation hallucination), Cursor 2.0 per-org cohort embedding cache (~92% reuse), BGE-M3 multilingual fallback for Swahili, hippocampal-indexing (DG pattern separator + CA3 completer + CA1 replay), a 4-tier RLS-enforced memory hierarchy (borrower / officer / org / sovereign), differential-privacy daily ε-budget on cohort exports, an outbox + salience scorer + autobiography ring that mirrors significant memory events into the morning brief, PDPA Right-to-be-Forgotten erasure RPC, fraud-graph with credit-network traversal (BORROWER_OF / GUARANTOR_FOR / SAME_DEVICE_AS / SAME_BANK_ACCOUNT_AS), and a 15-pass nightly sleep-tick orchestrator with concurrency-lock + stuck-row-reaper + per-pass min-interval + Vercel-or-k8s cron + emission persistence.

This is **substantially more than the 2026-05-18 parity audit caught.** The partial audit fixated on the simple `src/core/memory/` per-user store (5 files, 6 missing + 11 partial gaps) and missed the v2 package and the contextual-rag package entirely.

**The five biggest gaps vs SOTA 2026** for LITFIN's memory/RAG/KG stack are:

1. **No late chunking.** LITFIN chunks BEFORE embedding (paragraph-boundary semantic chunker at `src/core/document-intelligence/rag/embedding-service.ts:36-150`, contextual preface at `src/core/document-intelligence/contextual-rag/contextual-chunker.ts:108`). Jina embeddings v3+ "late chunking" embeds the WHOLE document then pools per-chunk — preserves cross-chunk context that early chunking destroys (≈8% nDCG@10 lift on long-document retrieval). LITFIN bolts contextual preface ONTO early chunks; Jina lets you drop the preface entirely.
2. **No ColBERT / ColPali multi-vector retrieval.** Every fact / chunk gets a SINGLE dense vector (`memory_facts_v2.embedding vector(1536)`, `memory_episodes.embedding vector(1536)`). ColBERT-style late-interaction (per-token vectors + MaxSim aggregation) and ColPali (per-page image patches for visual docs like loan statements / scanned NIDA cards) are not implemented. For LITFIN's PDF-heavy loan-doc pipeline this is the single largest accuracy-vs-cost trade-off left on the table.
3. **No Reciprocal Rank Fusion (RRF) or learned-fuser.** `src/core/document-intelligence/contextual-rag/bm25-hybrid.ts:207` implements **convex combination** (min-max normalize BM25, then `α × vector + (1-α) × bm25Normalised`, default α=0.5) — fine but inferior to RRF (`1 / (k + rank)`) on heterogeneous score-distribution corpora per Anthropic/Cohere benchmarks. Worse: the alpha is HARDCODED at 0.5, no per-query or learned-from-feedback tuning. Mem0 v2 ships a learned RRF; LITFIN does not.
4. **GraphRAG community summarisation is structural but not LLM-summarised.** `src/core/litfin-ai/learning/graph-rag/leiden-communities.ts:1-120` deterministically detects belief communities (Louvain modularity), and the sleep pass `src/core/heartbeat/sleep-passes/belief-community-detection.ts` persists them. But Microsoft GraphRAG's headline value is the HIERARCHICAL COMMUNITY SUMMARIES per level (level-0 leaf summaries → level-1 super-summaries → level-2 global summary). LITFIN computes the partition but does NOT generate level-N LLM summaries that a "global" question could route to. LazyGraphRAG (2025) shows you can defer the per-community summary to query time and still beat ablations — LITFIN does neither path.
5. **Procedural memory has no Voyager-style code-generation loop.** The `recordSkill` / `recallApplicableSkills` API at `src/core/litfin-ai/memory/v2/procedural.ts:97-260` stores skills as **declarative step lists** (`{order, action, inputs?, expects?}[]`), capped at 25 steps. Voyager (NVIDIA 2023, the procedural-memory reference) stores skills as **executable JS/TS code** the agent has written, tested, and proven. LITFIN's skill library cannot run; it can only be re-rendered into a prompt. The closed-loop "agent writes code → tests it → on success promotes to skill library" is missing.

The next five (sub-headline) gaps:

6. **No HyDE (Hypothetical Document Embeddings).** No code in LITFIN generates a hypothetical answer to the user's query, embeds THAT, and uses it as the retrieval probe instead of the raw query. HyDE has been SOTA-for-zero-shot since 2023 and would benefit LITFIN's many tier-0 borrower questions ("how much can I borrow?") that have low literal overlap with the underlying knowledge.
7. **Self-RAG is shipped in BOSSNYUMBA but NOT in LITFIN.** BOSSNYUMBA has `packages/central-intelligence/src/kernel/self-rag/self-rag.ts` (IsREL / IsSUP / IsUSE reflection tokens). LITFIN has CRAG-like patterns (`faithfulness-monitor.ts`, `cot-monitorability.ts` in `src/core/brain/`) but no first-class Self-RAG enforcer that BLOCKS hallucinated financial claims. This is a clear reverse-port opportunity.
8. **No CRAG (Corrective RAG) retrieval evaluator with web-search escalation.** The retrieval path returns whatever it returns; LITFIN does not classify retrieval quality as `correct / ambiguous / incorrect` and escalate to web search on `incorrect`.
9. **Embedding model is text-embedding-3-small only (1536d), BGE-M3 is the only fallback.** No Voyage AI (current SOTA on MTEB), no Cohere Embed v3, no Snowflake Arctic Embed v2. The October 2025 MTEB leaderboard puts voyage-3-large + cohere-embed-multilingual-v3 ahead of text-embedding-3-small by 4-6 points; LITFIN leaves that lift on the table.
10. **Forgetting is purge-by-rule, not decay-curve.** Episodes purge after 30 days if importance < 0.2 (`consolidation.ts:271-278`). Semantic facts have `expires_at` but no exponential decay-with-recall-reinforcement (Ebbinghaus / HippoRAG 2 pattern). The brain knows what the user said three weeks ago with the same certainty as what they said yesterday.

**Inverse direction (LITFIN can port FROM BOSSNYUMBA):** BOSSNYUMBA has already reverse-ported with one feature LITFIN doesn't have: a **first-class Self-RAG enforcer that blocks unsupported financial claims** (`packages/central-intelligence/src/kernel/self-rag/self-rag.ts`). It also has a **typed declarative-fact endpoint** intent (`source = 'declared'` enum on the semantic schema), though the producer is still un-wired. And **typed temporal-entity-graph schema** with explicit `temporal_entities` + `temporal_relationships` + `temporal_communities` tables (`packages/database/src/schemas/temporal-entity-graph.schema.ts`) is cleaner than LITFIN's overloaded `memory_facts_v2` bi-temporal columns. See §5b.

---

## 1. Inventory (file-by-file)

LITFIN's memory + RAG + KG stack lives in EIGHT distinct namespaces because the workspace grew organically — there is no single "memory" package. The `packages/memory` and `packages/brain` workspaces are **Phase-1 re-export shells only** (each is a single `src/index.ts` re-exporting from `src/core/...`). The real code is at `src/core/...`.

| Namespace | Files | Lines | Role |
|---|---:|---:|---|
| `src/core/memory/` | 6 | ~750 | Original per-user 4-tier memory (Episodic / Semantic / Procedural / Reflective). Pre-v2, still active. |
| `src/core/litfin-ai/memory/` | 7 + v2/ | 1,200 + 5,364 | Tier-scoped (borrower / officer / org / sovereign) v2 memory. THE primary memory layer. |
| `src/core/litfin-ai/memory/v2/` | 18 | 5,364 | Mem0 + Zep/Graphiti + GraphRAG components. THE deepest subsystem. |
| `src/core/knowledge-graph/` | 4 | ~950 | Ontology (10 subject types × 18 predicates) + triple-store + GraphRAG retrieval. Generic semantic KG. |
| `src/core/graph/` | many | n/a | Neo4j-backed entity graph: temporal (bi-temporal Cypher), graphrag (subgraph→summary→LLM), embeddings (subgraph2vec), gds (community-detection), fraud, queries. |
| `src/core/document-intelligence/rag/` | 6 | ~800 | Document chunker + embedder + pipeline + catalog + consent gate. The doc-RAG layer. |
| `src/core/document-intelligence/contextual-rag/` | 5 | ~800 | iter-51 RAG P1: contextual chunker (Anthropic) + BM25 hybrid + Cohere Rerank 3.5 + span-citations + a `cohere-embedder.ts`. |
| `src/core/heartbeat/sleep-passes/` | 15 | ~3,500 | 15 nightly passes — restructure-token-memory, distill-cot-reservoir, lesson-rot-audit, belief-community-detection (Leiden), etc. Orchestrated by `sleep-tick.ts:80`. |
| `src/core/brain/hippocampal-indexing/` | 5 | ~600 | DG pattern-separator + CA3 pattern-completer + CA1 replay-engine. Neural-faithful indexing primitive. |
| `src/core/brain/memory/engram-allocator.ts` | 1 | n/a | Sparse-coded engram allocation (top-k coding). |
| `src/core/litfin-ai/learning/graph-rag/leiden-communities.ts` | 1 | 400+ | Deterministic Louvain community detection over belief graph. |
| `src/core/litfin-ai/learning/belief-store.ts` (referenced) | 1 | n/a | Belief CRUD with revision-history, per-subject cap. |
| `supabase/migrations/` (memory-related) | 21 | n/a | 20240210/11_vector_embeddings, 20260422_investigation_and_memory, 20260422_graph_node_embeddings, 20260503_memory_v2, 20260505_memory_facts/extended, 20260514_bitemporal_memory, 20260514_cohort_embedding_cache, 20260522_knowledge_triples / memory_graph_edges, 20260613_user_journey_memory_schema_fix. |

Total memory-related: **~13,500 LOC** across 60+ files + 21 migrations.

---

## 2. Subsystem cards

### 2.1 Original 4-tier memory (`src/core/memory/`)

**What it does:** Per-user (single-tenant) 4-tier memory hierarchy. Episodic conversation+message tables, semantic-fact extraction with pgvector cosine retrieval, procedural-pattern detection with promotion floor, weekly reflective digests.

**Key files:**
- `memory-service.ts:31-64` — `loadContext({userId, surface, conversationId, retrievalQuery})` → returns `{recentMessages, relevantFacts, knownPatterns, latestReflection}`. The single canonical recall helper.
- `memory-service.ts:66-121` — `writeContext(turn)` — writes `user` + `assistant` rows, fire-and-forget `extractAndPersistFacts` and (if ≥2 tool calls) `recordPattern`.
- `episodic-store.ts:25-95` — two-table model (`ai_conversations` + `ai_messages` with `role ∈ {system,user,assistant,tool}` + `tokens` + `tool_calls`).
- `semantic-store.ts:31-105` — `extractAndPersistFacts` runs Haiku **per turn**, `MAX_FACTS_PER_TURN=5`, `FACT_CONFIDENCE_FLOOR=0.55`; persists with pgvector embedding.
- `semantic-store.ts:111-150` — `retrieveRelevantFacts(userId, query, k=8)` — pgvector cosine via RPC `match_ai_semantic_facts`, falls back to recency on RPC absence.
- `procedural-store.ts:15` — `PROMOTION_THRESHOLD = 3` (≥3 observations before surfacing).
- `reflective-store.ts:20-83` — weekly Haiku summary into `{focus_summary, top_topics[], sentiment, action_items[]}`.

**Memory types implemented:**
- Episodic: ✅ (conversation+message split, no TTL)
- Semantic: ✅ (pgvector cosine, free-form English facts, `subject` field for entity binding)
- Procedural: ✅ (named patterns, observed-count, success-rate, promotion floor)
- Reflective: ✅ (weekly digest, string sentiment label)
- Working: ❌
- Autobiographical: ❌ (lives in `brain/autobiography.ts`, separate)
- Narrative: ❌ (lives in `memory/v2/narrative.ts`, separate)

**Storage backends:** Postgres + pgvector (Supabase). Single tenant key = `user_id`. No tenant scoping.

**RAG techniques:** Naive vector recall (pgvector `<=>` cosine). No reranker, no hybrid, no contextual preface.

**Knowledge graph:** None at this layer.

**Learning loops:** None — this layer is read/write only. Consolidation lives elsewhere.

**Forgetting:** None — episodes grow monotonically forever. Semantic `expiresAt` exists but is never written.

---

### 2.2 Memory v2 (`src/core/litfin-ai/memory/v2/`) — THE primary stack

**What it does:** Tier-scoped (borrower / officer / org / sovereign) memory hierarchy. Implements Mem0 ADD/UPDATE/DELETE/NOOP semantics, Zep/Graphiti bi-temporal facts, Cursor 2.0 cohort embedding cache, MEMORY.md-pattern topic files, reflective + procedural + narrative extended tiers, PDPA right-to-be-forgotten erasure, fraud-graph credit-network traversal. RLS-locked at every layer.

**Key files (18 files, 5,364 LOC):**
- `types.ts:11-115` — `MemoryTier`, `FactType` (12 values: profile/preference/business/goal/constraint/struggle/milestone/commitment/risk/relationship/event/decision), `RelationType` (10), `TopicName` (6: PREFERENCES/GOALS/CONSTRAINTS/RELATIONSHIPS/RECENT_DECISIONS/NEXT_STEPS), `MemoryEpisode`, `MemoryFact`, `MemoryGraphEdge`, `MemoryTopicFile`, `FactSearchResult`. Pure `cosineSimilarity` at `:99-114`.
- `embedding.ts:33-64` — `generateEmbedding(text)` → OpenAI text-embedding-3-small (1536d, ~$0.02/1M).
- `embedding.ts:104-127` — `generateEmbeddingMultilingual(text)` — auto-detect Swahili, route to BGE-M3 if `BGE_M3_ENDPOINT_URL` set, fall through to OpenAI. **Different pgvector columns per provider** (1024d vs 1536d).
- `embedding.ts:178-203` — `generateEmbeddingCached(text, ctx, client)` — Cursor 2.0 per-org cohort + per-user private cache pattern (~92% reuse on org-shared docs).
- `cohort-cache.ts:1-100` — `hashChunk` (sha256 over lowercase+collapsed-whitespace), `composeStorageHash` (scope+model+text), `getOrComputeEmbedding`. DP daily ε-budget consumed by cohort exports (`consumeEpsilon(COHORT_EXPORT_EPSILON)` at `:31-35`).
- `episodic-writer.ts:1-235` — `recordEpisode({subjectId, tier, content, importance, ...})` with duplicate detection. Idempotency keys.
- `consolidation.ts:222-402` — `consolidateSubject(subjectId, tier, client, llmMode, opts?)`. Five phases: (1) fetch unconsolidated episodes (`is null consolidated_at`, limit 50), (2) purge stale low-importance (`>30d AND importance<0.2`), (3) PII-scrub via `defaultPiiScrubber` (Tanzania phone + NIDA + M-Pesa ref + email regexes — `:195-211`), (4) Haiku extraction with strict JSON parsing (`buildConsolidationPrompt` at `:87-110`), (5) per-fact embedding + insert + mark-consolidated. **Hardened with M-CT1 (tenant-scope every read/write/mark), M-PII (scrub before LLM sees), M-IDEM (only mark episodes whose derived fact actually inserted).**
- `consolidation.ts:75-82` — `isDueForConsolidation(lastConsolidatedAt)` — 4-hour window.
- `graph.ts:111-160` — `extractGraphEdges(subjectId, facts, client, llmMode)` — Haiku-extracts directed relations from fact batch using 10-relation ontology. Persists to `memory_graph_edges` (UNIQUE (source_fact_id, target_fact_id, relation_type)).
- `graph.ts:166-193` — `traverseRelated(factId, client, depth=2)` — calls SQL recursive-CTE RPC `traverse_memory_graph`.
- `topic-files.ts` (183 lines) — `regenerateTopicFiles(...)` — buckets facts by topic, writes markdown into `memory_topic_files`. The Claude MEMORY.md pattern — what the brain knows about you as ONE flat md file per topic.
- `recall.ts:131-171` — `recallFacts({subject, tier, query, k=5, threshold=0.3})` — pgvector RPC `match_memory_facts_v2`, **PII-stripping when `tier='sovereign'`** (hash subject_id with sha256/16-char, strip UUIDs / emails / TZ phones / NIDA / M-Pesa refs from fact text). `stripPiiFromFact` at `:121-127`, `stripIdentifiers` at `:102-114`, `hashId` at `:88-90`.
- `recall.ts:207-249` — `recallRelevantContext(...)` — composes top-K facts + relevant topic-file excerpts into a `<long_term_memory tier="...">` prompt block under a 1500-token budget.
- `mem0-semantics.ts:272-362` — `decideMem0Op(candidate, existing[], opts?)` — **PURE function** returning `{kind: 'add'|'update'|'delete'|'noop', reason, similarity?, supersedesId?, targetId?, matchedId?}`. Negation-aware (`looksLikeNegation` regex panel at `:105-114`, `stripNegation` at `:166-177`, `negationStripSimilarity`). Default thresholds: contradiction=0.85, noop=0.92, delete=0.7. Citing Park et al. 2024 (arXiv 2404.13501) explicitly.
- `bi-temporal.ts:1-138` — Zep/Graphiti pure schema layer. `BiTemporalCoords`={valid_from, valid_to, observed_at, asserted_at}. `pointInTimeAsOf<T>(facts, asOfIso)` for retrospective queries. `currentView<T>(facts)` for present-tense. `renderBiTemporalLine<T>(f)` for audit-pack rendering. `staleSupersessions<T>` to surface orphan invalidations. Citations: Snodgrass 1993, arXiv 2501.13956, Graphiti github link.
- `narrative.ts:1-100` — Pure-functional borrower narrative: `NarrativeMilestone | NarrativeDecisionRef | NarrativeMoodPoint`. `appendMilestone`, `appendDecisionRef`, `appendMoodPoint`, `deriveRelationshipQuality`, `buildSessionOpener`, `persistNarrative`. Used to produce session-start continuity ("Welcome back, Asha. Last time we talked, you were planning to expand to a second shop. How did that go?").
- `procedural.ts:1-100` — Voyager-inspired (NVIDIA 2023) skill library. `SkillStep = {order, action, inputs?, expects?}`. `recordSkill`, `recordSkillInvocation`, `recallApplicableSkills`, `buildSkillsPromptHint`. `MIN_INVOCATIONS_FOR_PREFERENCE = 5`. Skills are declarative step lists, NOT executable code — see Gap 5.
- `reflective.ts:1-100` — Decision-outcome reflection. `RecordReflectionInput = {whatWorked, whatDidnt, why, lesson, contextFeatures}`. `computeContextSignature(features)` produces stable "borrowers like X" hash. `recallSimilarDecisions(currentContext, k)` returns past decisions + outcomes. `rollupReflections` computes accuracy% per context signature.
- `fraud-graph.ts:1-100` — Credit-network entity graph. `CREDIT_RELATION_TYPES = [BORROWER_OF, GUARANTOR_FOR, SUPPLIER_OF, CUSTOMER_OF, SAME_DEVICE_AS, SAME_PHONE_AS, SAME_ADDRESS_AS, SAME_BANK_ACCOUNT_AS, SAME_TAX_ID_AS]`. Detects `shared_device_ring`, `overloaded_guarantor`, `circular_guarantee`, `shared_address_no_relation`, `shared_supplier_inflation_ring`.
- `graph-edges.ts` (500 LOC) — graph-edge layer above the facts.
- `cohort-concentration.ts` — concentration metric for sovereign tier (Herfindahl-Hirschman style).
- `erasure.ts:35-115` — `eraseSubjectMemory(subjectId, client)` — prefers SECURITY DEFINER RPC `erase_subject_memory` (atomic single round-trip), falls back to per-table deletes across `memory_episodes`, `memory_facts_v2`, `memory_graph_edges`, `memory_topic_files`, `personal_lexicon`, `user_behavior_profile`, `concept_abstractions`. Wired into nightly `process-erasure-requests` cron.

**Memory types implemented:** Working ❌, Episodic ✅, Semantic ✅, Procedural ✅, Reflective ✅, Autobiographical ✅ (via `brain/autobiography.ts`), Narrative ✅ (v2/narrative.ts), Bi-temporal ✅ (v2/bi-temporal.ts), Sensorimotor ❌.

**Storage backends:** Postgres + pgvector. Optional Neo4j via `src/core/graph/`. Different pgvector columns for 1024d (BGE-M3) vs 1536d (OpenAI). No Pinecone, no Weaviate, no Qdrant, no Milvus, no Chroma, no Redis vector, no Memgraph, no Kuzu.

**RAG techniques:** Vector cosine via pgvector ivfflat (`lists=100`). PII-strip for sovereign tier. ADD/UPDATE/DELETE/NOOP write semantics. Bi-temporal queries.

**Knowledge graph:** 10-relation fact-to-fact graph (`memory_graph_edges`), recursive-CTE BFS via Postgres RPC. Credit-network entity graph (`fraud-graph.ts`).

**Learning loops:** 4-hour consolidation cycle per subject. Nightly sleep passes (see §2.7). Reflection-on-decision feeds prompt context.

**Forgetting / TTL / decay:** Episodes purge after 30d if importance<0.2 (rule, not curve). Semantic `expires_at` settable but no auto-decay (gap). RtbF erasure RPC.

---

### 2.3 Document RAG + Contextual RAG (`src/core/document-intelligence/`)

**What it does:** PDF and document ingestion → chunking → embedding → semantic search with privacy-tier filtering. Iter-51 layered the contextual-retrieval upgrades (Anthropic pattern + BM25 hybrid + Cohere rerank + span citations) on top.

**Key files:**

`rag/embedding-service.ts` (the baseline):
- `:66-150` — `chunkDocument(text, chunkSize=1000)` — semantic chunking: split on paragraph boundaries, accumulate to `DEFAULT_CHUNK_SIZE=1000` chars, 100-char overlap. `detectSemanticType` distinguishes header/list/table/code/paragraph.
- Uses `text-embedding-3-small` (1536d). Stores with `DocumentPrivacyTier` for RLS scoping.
- **Limitation: early chunking.** Each chunk is embedded standalone — cross-chunk context is destroyed.

`contextual-rag/contextual-chunker.ts` (iter-51 P1):
- `:108-167` — `contextualizeChunks(documentText, rawChunks, options?)` — Anthropic Contextual Retrieval pattern. For each chunk batch (default 6), call Haiku with the FULL doc (capped 180k chars) in the prompt-cache and ask for a 1-2 sentence preface that situates the chunk. Anthropic data: 35-49% reduction in top-20 retrieval failure.
- `:193-234` — `defaultContextualize` — uses `brain.think({cachePolicy: true, cognitionMode: 'fast', taskName: 'doc-rag.contextualize'})`. Prompt-cache makes per-chunk marginal cost ~$1/M doc tokens.
- Returns `{chunkIndex, chunkText, contextSummary, embedText}` — `embedText = summary + "\n\n" + chunk`. Identity fallback when LLM call fails — degrades gracefully.

`contextual-rag/bm25-hybrid.ts`:
- `:112-153` — `buildBM25Index(docs)` — pure TS BM25 (k1=1.5, b=0.75 from Anthropic reference). Robertson IDF (`log((N-df+0.5)/(df+0.5) + 1)`). Pre-computed IDF for O(|q|) scoring.
- `:92-106` — `tokenize` — lowercase alphanumeric, preserves digit runs (so "4,250,000" survives as one token). Intentionally NO stemming — Swahili+English vocabulary overlap is hurt by aggressive stems.
- `:207-237` — `hybridScore(candidates, alpha=0.5)` — min-max normalize BM25, then convex combination `α × vector + (1-α) × normBm25`. **Hardcoded α=0.5, no RRF, no learned fuser.** Gap.

`contextual-rag/cohere-reranker.ts`:
- `:83-164` — `rerankCandidates<T>(query, candidates, options?)` — POST to https://api.cohere.com/v2/rerank, `model=rerank-v3.5`. Per-doc cap 16k chars, max 1000 docs. Anthropic data: cuts failure 5.7%→1.9%. **Identity fallback** when `COHERE_API_KEY` absent — synthetic descending scores 1.0..0.5 so downstream `> previousScore` comparisons stay valid.
- Cohere Rerank 3.5 is multilingual (100+ languages, native Swahili). Priced ~$2/1k searches.

`contextual-rag/span-citations.ts`:
- `:144-166` — `extractCitedSpans(answer, chunks)` — walks `[chunkId]` markers in LLM output, extracts a 240-char context window around each, picks the best-matching sentence inside the chunk by Jaccard overlap. Returns `{chunkId, startOffset, endOffset, quotedSpan, overlap}` so the UI can highlight the EXACT line inside a PDF.
- `:89-129` — `splitChunkIntoSentences` — sentence segmentation with offset-preservation (`chunk.text.slice(s.startOffset, s.endOffset) === s.text`). Handles `Mr.` / `T.Sh.` runs.
- `MIN_OVERLAP_FOR_SPAN=0.15` — below this we fall back to whole-chunk highlight.
- `:255-260` — `verifySpan(chunk, span)` — for the FRONT-style verifier that BLOCKS answers when too many citations fail verification. Cuts citation hallucination from ~37% to single digits per FRONT paper.

`contextual-rag/cohere-embedder.ts` — Cohere embed-v3 wrapper (alternative to OpenAI).

`rag/processing-pipeline.ts` — orchestrates the full ingestion path.

**Memory types implemented:** Document-RAG only.

**Storage backends:** Postgres + pgvector for vectors. In-memory BM25 index (per-document scope — `searchBM25(query, docs, limit=20)` builds an index each call). **Gap: no persistent BM25 index across documents.**

**RAG techniques:** ✅ semantic chunking (paragraph boundaries), ✅ contextual retrieval (Anthropic pattern), ✅ BM25+vector hybrid (convex combo), ✅ Cohere Rerank 3.5, ✅ span-level citations + verification. ❌ late chunking, ❌ multi-vector / ColBERT, ❌ ColPali (image-patch retrieval), ❌ HyDE, ❌ query rewriting / multi-query, ❌ RAG-Fusion / RRF, ❌ contextual compression (LlamaIndex pattern), ❌ parent-child chunking.

**Knowledge graph:** None at this layer.

**Learning loops:** None — read/write only.

**Forgetting:** RLS-tier-scoped reads; no TTL.

---

### 2.4 Generic Knowledge Graph (`src/core/knowledge-graph/`)

**What it does:** Ontology-validated triple store with 10 subject types × 18 predicates. BFS traversal in application code (no Neo4j needed). Generic semantic KG distinct from the v2 memory graph.

**Key files:**

`ontology.ts:23-34` — `SUBJECT_TYPES = [borrower, bank, officer, product, cohort, region, industry, macro_indicator, concept, skill]` (10).
`ontology.ts:52-76` — `PREDICATES = [is_a, works_at, lives_in, manages, borrows_from, lends_to, guarantees, co_signs, similar_to, differs_from, caused_by, predicts, complies_with, violates, regulated_by, belongs_to_cohort, produces, consumes]` (18).
`ontology.ts:108-250` — `PREDICATE_CONSTRAINTS` — per-predicate subject/object type allow-lists. `manages: officer → borrower|product|cohort`. `co_signs: borrower → borrower (symmetric)`. **Hard rule**: predicates added here only; non-ontology writes rejected at app layer.
`ontology.ts:280-306` — `validateTriple` returns `{ok, reason}` — distinguishes unknown subject/object type, unknown predicate, subject_type_not_allowed, object_type_not_allowed.

`triple-store.ts:173-252` — `assertTriple(input, client)` — validates ontology, persists to Postgres `knowledge_triples`. Dedup via 23505 unique-violation; `deduped: true` on re-assertion.
`triple-store.ts:284-310` — `findBySubject(type, id, client, predicate?)` — outgoing edges, optional predicate filter.
`triple-store.ts:316-343` — `findByObject(type, id, client, predicate?)` — incoming edges.
`triple-store.ts:355-429` — `traverse(seed, client, options?)` — BFS with `depth ≤ HARD_DEPTH_CAP=6`, `maxNodes ≤ HARD_MAX_NODES=2000`, `minConfidence` floor, optional predicate restriction.
`triple-store.ts:441-490` — `query(pattern, client)` — SPARQL-lite pattern matching (`"*"` wildcards, ANDed in SQL).

`graph-rag.ts:139-296` — `retrieve(query, seeds, client, options?)` — Graph-RAG retrieval. Given vector-seeded entities, BFS up to depth 3 (default), score each visited node by `vectorScore × 0.45 + graphProximity × 0.35 + confidence × 0.2` (`DEFAULT_WEIGHTS` at `:93-97`). `proximityForDepth(d) = max(0.1, 0.66^d)`. Returns top-K nodes with HUMAN-READABLE EXPLANATION PATHS (`"borrower:A -> works_at -> bank:B -> regulated_by -> concept:BOT"`).

**Storage backends:** Postgres only (no Neo4j). BFS in application code.

**Knowledge graph patterns:** ✅ ontology validation, ✅ triples, ✅ BFS traversal, ✅ explanation paths, ❌ Cypher-like query language, ❌ community detection at this layer, ❌ centrality metrics.

---

### 2.5 Neo4j-backed Entity Graph (`src/core/graph/`)

**What it does:** Production-grade Neo4j entity graph for the org-scoped business KG (people / applications / accounts / officers / branches / addresses / devices). Distinct from `src/core/knowledge-graph/` (Postgres-only) and `src/core/litfin-ai/memory/v2/graph.ts` (fact-to-fact). This is the operational fraud + risk + compliance graph.

**Key files:**

`neo4j-client.ts`, `neo4j-config.ts` — connection management.
`schema/init-schema.ts`, `schema/constraints.cypher` — uniqueness + range indexes for `valid_from`, `valid_to`, `org_id`.

`temporal/queries.ts:165-186` — `getEdgesValidAt(orgId, timestamp)` — `MATCH (a)-[r]->(b) WHERE datetime(r.valid_from) <= datetime($timestamp) AND (r.valid_to IS NULL OR datetime(r.valid_to) > datetime($timestamp))`. **Bi-temporal Cypher.** Per-org scoped. Limit 5000.
`temporal/queries.ts:196-233` — `getEdgeEvolution(orgId, nodeType, nodeId)` — full timeline of edges touching a node, sorted by validFrom ASC, with counterparty. Inlines nodeLabel after `/^[A-Za-z_][A-Za-z0-9_]*$/` whitelist (Cypher cannot parameterise labels).
`temporal/queries.ts:239-285` — `getAllActiveAt(orgId, timestamp)` — full graph snapshot at T. Returns `{asOf, orgId, nodes, edges}`.

`graphrag/index.ts:1-30` — barrel exports `buildEntityContext`, `buildApplicationContext`, `buildMinimalContext`, `summariseConnections / FraudRisk / RiskExposure / SimilarCases / Alerts`, `queryGraphRAG`.

`graphrag/query.ts:75-130` — `queryGraphRAG(prompt, orgId)` — Plain-English query → full-text Neo4j search (`queryGraphSearch`, limit 12 seeds) → one-hop expansion (`queryConnectedParties`, max 6 per seed, total cap 40) → summarise subgraph → Claude grounded answer + citations + confidence. Returns `{answer, subgraph: {nodes, edges}, citations, confidence}`. **Empty result with "graph is warming up" fallback when Neo4j not configured.**

`embeddings/subgraph-embed.ts:1-100` — Node2Vec/GraphSAGE-like subgraph embeddings. Transport hierarchy: (1) `GRAPH_EMBED_URL` HTTP sidecar (real graph embedder model), (2) text-fallback (serialise subgraph to deterministic text, embed via OpenAI). Cache: `graph_node_embeddings` table keyed on `subgraph_hash`. Used by cohort-similarity + UBO-overlap + multi-org fraud-ring detectors.

`gds/community-detection.ts` — Neo4j GDS community detection bridge.

**Storage backends:** Neo4j (optional — fully degrades to empty results when `isNeo4jConfigured() = false`). Plus Postgres for the subgraph-embedding cache.

**Knowledge graph patterns:** ✅ bi-temporal Cypher, ✅ org-scoped (multi-tenant), ✅ full-text search seeding, ✅ one-hop expansion, ✅ subgraph2vec via sidecar/text fallback, ✅ deterministic cache (subgraph hash), ✅ community detection via Neo4j GDS, ❌ Memgraph, ❌ Kuzu.

---

### 2.6 Hippocampal Indexing (`src/core/brain/hippocampal-indexing/`)

**What it does:** Neural-faithful pattern separation + pattern completion + replay. Layers on top of the standard pgvector index to make similar episodes DISTINGUISHABLE downstream.

**Key files:**

`pattern-separator.ts:52-130` — `separate(episode)`. DG-style sparse top-k coding over the embedding (`TOP_K=24`) plus a hashed n-gram fingerprint of cue tokens (`NGRAM=3`). Maintains a bounded ring of recent peers per source store (`MAX_NEIGHBORS_PER_STORE=256`). Returns `{fingerprint, distinctness}` where distinctness = `1 - max(cosine to nearest neighbor)`. Citations: Marr 1971, Yassa & Stark 2011, Schapiro et al. 2017.
`pattern-completer.ts` — CA3-style attractor recall: given a partial cue, walk to the nearest registered episode.
`replay-engine.ts` — CA1↔neocortex replay loop. `replayCycle()` is invoked by the nightly consolidation cron.

`brain/memory/engram-allocator.ts` — sparse-coded engram allocation primitive.

**Memory types implemented:** Indexing layer — augments existing episodic/semantic stores.

**Storage backends:** In-memory ring + standard Postgres/pgvector.

**Knowledge graph patterns:** N/A — this is a retrieval-precision layer, not a KG.

---

### 2.7 Sleep / Consolidation Orchestrator (`src/core/heartbeat/sleep-passes/`)

**What it does:** Off-peak EAT autonomous reasoning. 15 registered passes orchestrated by `runSleepTick(...)` with per-pass `minIntervalMinutes`, `maxDurationMs` (raced via AbortController), `brain_sleep_runs` row bookend (`running` → `done|failed|timeout|skipped`), `brain_sleep_emissions` persistence, AND mirroring into the brain outbox (`emitThought`) so "what the brain dreamed about" surfaces in the morning brief.

**Key files:**

`sleep-tick.ts:80-139` — `runSleepTick({supabase, passes?, maxOverallDurationMs?, now?})`. Default overall budget 18 min (14 min on Vercel — `effectiveOverallDurationMs` at `:69-74` undercuts the 15-min Vercel cap by 1 min for log flush).
`sleep-tick.ts:152-222` — `runOnePass({pass, supabase, maxDurationMs, now})`. Captures `setTimeout` handle, `clearTimeout` in finally (so fast passes don't leak timers under sustained load).
`sleep-tick.ts:272-330` — `insertRunningRow` with **SLEEP-LOCK + SLEEP-RESCUE** (HIGH iter-24 audit fix): scans for stuck `running` rows of the same pass, reaps if older than `RESCUE_AGE_MS = 30min` (2x max-pass-duration), otherwise skips (`return null`) so concurrent workers don't double-emit.
`sleep-tick.ts:368-442` — `persistEmissions` writes to `brain_sleep_emissions` AND lazy-imports `@/core/brain/outbox` to `emitThought({source: 'sleep-pass', kind, content, salience: {importance: 0.45..0.6}})` per emission. The outbox → salience scorer → morning brief is what makes consolidation VISIBLE to the user.

`sleep-passes/index.ts:108-124` — `SLEEP_PASSES = [reanalyzeFailedDecisions, precomputeCounterfactuals, distillCotReservoir, proactiveBorrowerNudges, restructureTokenMemory, lessonRotAudit, proactiveOperatorNudges, mdMorningBrief, pruneExtractedTemplates, sweepStaleApprovals, officerBiasDetection, extractionEval, consentLanguageAudit, beliefCommunityDetection, cohortEvalPass]` (15).

`sleep-passes/restructure-token-memory.ts:1-80` — Letta/Mem0-style token-space restructure. Citations: Letta 2024 "Continual Learning in Token Space", mem0 2025 memory-management blog. Detects near-duplicate beliefs (TF-IDF + cosine, `SIMILARITY_THRESHOLD=0.92`), merges via convince-loop, resolves contradictions (delta > 0.25). `MAX_DURATION_MS=5min`, `MIN_INTERVAL_MINUTES=18h`. Writes through `belief-store.ts` so RLS + per-subject cap + revision history are preserved. Idempotent.

`sleep-passes/belief-community-detection.ts` — wraps `src/core/litfin-ai/learning/graph-rag/leiden-communities.ts` to detect communities over the belief + correlation graph. `detectCommunities(graph)` is PURE (deterministic Leiden/Louvain — 50-70% lift on global queries per Microsoft GraphRAG paper). `summariseCommunity` is I/O (calls brain). **Gap: hierarchical LLM summaries per level not yet implemented — see headline Gap 4.**

`sleep-passes/distill-cot-reservoir.ts` — distills the chain-of-thought reservoir into reusable lesson templates.
`sleep-passes/lesson-rot-audit.ts` — audits stored lessons for staleness/contradiction.
`sleep-passes/precompute-counterfactuals.ts` — pre-runs "what if" scenarios so morning brief can show "if you'd done X yesterday, Y would have happened".

**Memory types touched:** All four (episodic via restructure, semantic via lesson-rot + distill, procedural via prune-extracted-templates, reflective via cohort-eval). Plus the autobiography ring.

**Storage backends:** Postgres + outbox.

**Learning loops:** ✅ Mem0-style merging, ✅ contradiction resolution, ✅ counterfactual precompute, ✅ community detection (structural), ❌ DPO / RLAIF / RLHF, ❌ fine-tuning, ❌ prompt evolution closed loop (GEPA is implemented in `litfin-ai/prompt-evolution/` but not driven by the sleep cycle), ❌ executable-skill promotion (Voyager loop missing).

**Scheduling:** Vercel cron entries in `vercel.json` schedule `/api/cron/brain-sleep-tick` at 00:00, 01:00, 22:00, 23:30, 02:30 UTC (5 entries → effectively one per off-peak slot). Plus `/api/cron/learning-consolidation` at `0 3 * * *` and `/api/cron/learning-consolidation-pass` at `30 3 * * *`. Also k8s `CronJob` manifests at `k8s/base/cronjobs.yaml` (18 jobs mirroring vercel.json). Production scheduling is REAL — this differs starkly from BOSSNYUMBA's missing scheduler.

---

### 2.8 Autobiography + Outbox (`src/core/brain/autobiography.ts`, `outbox.ts`)

**What it does:** System-level "I" thread. Every significant brain event (sovereign decision, refusal, belief revision, drift detection, language acquired, lesson distilled) appends to a 256-entry ring + a persistor (Supabase row) + the outbox via `emitThought`. `salience ≥ 0.4` entries surface to the morning brief. This is Damasio's autobiographical self in code.

**Key files:**

`autobiography.ts:25-41` — `AutobiographyKind` enum (17 kinds: sovereign_decided / sovereign_refused / belief_revised / belief_split / skill_proposed / skill_promoted / killswitch_changed / dissent_surfaced / plan_approved / plan_rejected / drift_detected / ignition_fired / self_modified / regulator_finding / language_acquired / lesson_distilled).
`autobiography.ts:43-55` — `AutobiographyEntry = {id, tsMs, kind, text, payload?, salience, subjectId?}`. Brain-perspective first-person verb phrase ("I refused the sovereign write because…").
`autobiography.ts:73-90` — `appendAutobiography(entry)` — ring + persistor + outbox emission when salience≥0.4.

**Memory types implemented:** Autobiographical ✅ (the only project I've seen that explicitly models this).

---

## 3. SOTA Gap Table

| # | Capability | LITFIN ref | SOTA 2026 reference | Gap | Closure effort |
|---|---|---|---|---|---|
| 1 | **Late chunking (Jina v3+)** | `document-intelligence/rag/embedding-service.ts:66-150` (early semantic chunker); `contextual-rag/contextual-chunker.ts:108` (contextual preface) | Jina embeddings v3 / v4 late chunking: embed full doc first, mean-pool per chunk window — preserves cross-chunk context | Missing | M (need Jina endpoint or self-host BGE-M3 with late-chunk pooling; per-chunk-embed call changes shape) |
| 2 | **ColBERT / ColPali multi-vector** | Single-dense `embedding vector(1536)` on every fact / episode / chunk | ColBERT v2 (per-token vectors + MaxSim); ColPali (per-page image patches for visual docs) | Missing | L (requires multi-vector index — Vespa or self-host; pgvector cannot do MaxSim efficiently. ColPali changes the whole PDF pipeline.) |
| 3 | **Reciprocal Rank Fusion (RRF)** | `contextual-rag/bm25-hybrid.ts:207-237` convex combo, α=0.5 hardcoded | RRF: `1/(k + rank)` summed across rankers. Anthropic / Cohere data: beats convex combo on heterogeneous score distributions | Different shape | S (~50 LOC swap; add per-query alpha or RRF + ablation harness) |
| 4 | **Hierarchical GraphRAG community summaries** | `leiden-communities.ts` detects communities deterministically; `belief-community-detection.ts` sleep pass persists them | Microsoft GraphRAG: level-0 leaf summaries → level-1 super-summaries → level-2 global summary. LazyGraphRAG defers to query time but still wins | Partial (structure only, no per-level summaries) | M (sleep-pass extension calling brain.think per community, hierarchical pass at level N+1) |
| 5 | **Voyager executable skills** | `procedural.ts:97-260` stores skills as declarative `SkillStep` lists, `MIN_INVOCATIONS_FOR_PREFERENCE=5` | Voyager (NVIDIA 2023): skills are EXECUTABLE JS/TS code the agent writes + tests; closed-loop "fail → revise → promote on success" | Missing | L (needs sandboxed code-exec runtime, skill-test harness, promotion gate. Tier-2 effort.) |
| 6 | **HyDE** | none | Hypothetical Document Embeddings — embed an LLM-generated answer to query, retrieve over THAT | Missing | S (one wrapper around `recallFacts`/`searchBM25` that pre-generates a hypothetical) |
| 7 | **Self-RAG (IsREL/IsSUP/IsUSE)** | `brain/faithfulness-monitor.ts`, `brain/cot-monitorability.ts` exist but no first-class Self-RAG enforcer; BOSSNYUMBA has `packages/central-intelligence/src/kernel/self-rag/self-rag.ts` | Asai et al. ICLR 2024 (arXiv 2310.11511): three categorical reflection tokens, BLOCK on financial claims when IsSUP<high | **Missing in LITFIN, present in BOSSNYUMBA** | S (reverse-port from BOSSNYUMBA — see §5b #1) |
| 8 | **CRAG (Corrective RAG)** | none | Yan et al. 2024: retrieval evaluator classifies `correct/ambiguous/incorrect`, escalates to web-search on `incorrect` | Missing | M (eval-judge call + web-search adapter wiring) |
| 9 | **Voyage AI / Cohere Embed v3 / Snowflake Arctic v2** | `text-embedding-3-small` (1536d) + BGE-M3 (1024d) fallback | Voyage-3-large (current MTEB SOTA), cohere-embed-multilingual-v3, Snowflake Arctic-Embed-v2 | Partial (BGE-M3 multilingual present; not top of MTEB) | S (per-provider adapter mirroring `bge-m3-adapter.ts`) |
| 10 | **Decay curve forgetting** | Episodes purge by rule (>30d & importance<0.2); semantic `expires_at` settable but no auto-decay | HippoRAG 2: Ebbinghaus decay with recall-reinforcement; Letta v2 memory blocks with confidence half-life | Missing | M (per-fact `lastAccessedAt`, half-life curve, sleep-pass that decays then deletes below floor) |
| 11 | **Query rewriting / multi-query** | none | LangChain / LlamaIndex multi-query expansion: LLM rewrites query 3-5 times, retrieves over each, fuses | Missing | S (wrapper + RRF fusion) |
| 12 | **Contextual compression** | none | LlamaIndex contextual-compression retriever: LLM filters/compresses retrieved chunks per-query | Missing | S (post-retrieval LLM pass — could share Cohere Rerank slot) |
| 13 | **Parent-child chunking** | none | LlamaIndex: embed small child chunks, return parent on hit | Missing | M (schema change: `parent_chunk_id` column + return-parent recall flag) |
| 14 | **Persistent BM25 index** | `searchBM25(query, docs, limit=20)` builds index per call in `bm25-hybrid.ts:255-262` | Elasticsearch / Tantivy / OpenSearch persistent inverted index; Postgres FTS (`tsvector` + GIN) is the pragmatic compromise | Missing | S (Postgres FTS migration: `to_tsvector('english', chunk_text)` + GIN index; per-row update on insert) |
| 15 | **Mem0 v2 LLM-native long-term memory** | `mem0-semantics.ts:272-362` PURE ADD/UPDATE/DELETE/NOOP decision, fully shipped | Mem0 v2 (May 2025): adds learned RRF + per-tenant fact relevance model | Partial (ops correct; relevance model not learned) | M (training data exists in feedback table; needs offline fit) |
| 16 | **Zep / Graphiti bi-temporal KG** | `bi-temporal.ts:1-138` pure schema + `pointInTimeAsOf`/`currentView`; migration `20260514_bitemporal_memory.sql` adds 4 columns + index + recall RPC filter | Graphiti (Zep): native graph (Neo4j-backed), entity-resolution, **typed edges with bi-temporal validity**, BFS over typed edges | Partial (have bi-temporal on facts; the EDGES `memory_graph_edges` do NOT carry bi-temporal coords) | M (extend edge schema with valid_from/valid_to; mirror traversal RPC) |
| 17 | **A-MEM (agentic memory)** | None named A-MEM; closest is Mem0 + reflective decisions | Xu et al. 2025 arXiv 2502.12110: links memory notes via tags + categories + structured fields the AGENT itself proposes (Zettelkasten for agents) | Missing | M (tag-extraction step in consolidation; cross-link sleep pass) |
| 18 | **LightRAG** | Closest is `knowledge-graph/graph-rag.ts:139-296` (Graph-RAG retrieval with explanation paths) | LightRAG (HKU 2024): dual-level retrieval (low-level entities + high-level concepts) with incremental graph maintenance | Partial (low-level only; high-level concept layer not surfaced) | M (concept-extraction pass + dual retrieval) |
| 19 | **HippoRAG 2** | DG/CA3/CA1 in `hippocampal-indexing/` is structurally faithful to HippoRAG family | HippoRAG 2 (May 2025): personalised PageRank over the KG + multi-hop reasoning | Partial (DG separation + CA3 completion + CA1 replay; no PPR) | M (NetworkX-style PPR in JS) |
| 20 | **Cohere Rerank 3.5** | `cohere-reranker.ts:83-164` fully shipped with identity fallback | Cohere Rerank 3.5 + bge-reranker-v2 (BAAI; self-hostable, lower cost) | Partial (Cohere only; no bge-reranker fallback) | S (wrap a self-hosted bge-reranker endpoint as fallback when COHERE_API_KEY absent) |
| 21 | **Anthropic contextual retrieval** | `contextual-rag/contextual-chunker.ts:108-167` fully shipped with prompt-caching, identity fallback | Same — September 2024 Anthropic blog, still SOTA baseline | ✅ Parity | — |
| 22 | **Span-level citations (FRONT)** | `contextual-rag/span-citations.ts:144-260` fully shipped with verifier | FRONT paper — same | ✅ Parity | — |
| 23 | **BM25 + vector hybrid** | `bm25-hybrid.ts` — convex combo, α=0.5 hardcoded | Same; SOTA fusion uses RRF + learned alpha (see #3) | ✅ Parity (with #3 improvement) | — |
| 24 | **Cursor 2.0 cohort embedding cache** | `cohort-cache.ts:1-100` + migration `20260514_cohort_embedding_cache.sql`; ~92% reuse | Cursor 2.0 — same | ✅ Parity | — |
| 25 | **Letta v2 sleep-time agents** | `heartbeat/sleep-passes/` 15 passes orchestrated nightly + sleep-tick concurrency-lock + outbox mirror | Letta v2: **always-running** sleep-time agents that hand-off context between user-facing + background workers, NOT just nightly | Partial (nightly only; no always-on consolidation) | L (needs persistent worker process; can't run on Vercel — k8s only) |
| 26 | **Pinecone / Weaviate / Qdrant / Milvus / Chroma** | pgvector only | Pinecone serverless (current production default for many); Qdrant (open source, fast); Milvus (HPC-scale) | Decision (not gap) — pgvector is sufficient at LITFIN scale; ColBERT-style retrieval would force the move | — |
| 27 | **Neo4j / Memgraph / Kuzu** | Neo4j via `src/core/graph/` (optional) + Postgres for facts/triples | Memgraph (in-memory, lighter), Kuzu (embedded, ~SQLite for graphs) | Decision (not gap) — Neo4j optional path is well-built | — |
| 28 | **Cognee / Marqo / Vespa** | None | Cognee (memory layer for LLM apps); Marqo (vector+text engine); Vespa (industrial-scale ranking) | Decision (not gap) | — |
| 29 | **Anthropic prompt caching** | `embedding.ts` not cached, but `contextual-chunker.ts:219-228` uses `brain.think({cachePolicy: true})`; `semantic-store.ts:60` uses `cacheSystemPrompt: true`; `reflective-store.ts:59` uses same | Anthropic prompt caching — same | ✅ Parity | — |
| 30 | **Extended context** | Haiku 200k window already used (`contextual-chunker.ts:34`); doc-truncation cap 180k chars | Claude Sonnet 1M context (Sep 2024) | Partial (using 200k; not 1M Sonnet for whole-doc reasoning) | S (route long-doc tasks via Sonnet 1M when budget allows) |
| 31 | **DSPy 3.0 / GEPA prompt evolution** | `litfin-ai/prompt-evolution/gepa-evolver.ts` (separate dir) + `brain/prompt-evolution.ts` | DSPy 3.0 with GEPA, MIPRO-2; closed-loop mutation → Pareto-front → A/B → auto-promotion | Partial (scaffolds shipped, closed-loop is observational not adversarial) | L (per `01-brain-core.md` headline gap #4 — out of scope for memory slice) |
| 32 | **RLHF / RLAIF / DPO fine-tuning of embedder** | None | Embedder fine-tuning on user feedback (Voyage AI does this in production) | Missing | XL (offline training pipeline + embedder retrain — Tier-3 effort) |
| 33 | **Differential privacy on cohort exports** | `cohort-cache.ts:31-35` `consumeEpsilon(COHORT_EXPORT_EPSILON)` daily ε-budget; fails closed on exhaustion | DP-SGD-style ε-δ budget management | ✅ Parity (rare; few production stacks ship this) | — |
| 34 | **PDPA Right to be Forgotten** | `erasure.ts:35-115` with SECURITY DEFINER RPC + per-table fallback | GDPR/PDPA — same | ✅ Parity | — |
| 35 | **Tier-scoped PII stripping at recall** | `recall.ts:121-127` `stripPiiFromFact` for sovereign tier; UUID + email + TZ-phone + NIDA + M-Pesa + account regexes | Differential aggregate exposure | ✅ Parity (rare) | — |

**Counts:**
- ✅ Parity / shipped: 10 (21-24, 29, 33-35, partial of 25 & 31)
- Partial (have structure, missing depth): 9 (4, 9, 15, 16, 18-20, 30, 31)
- Missing entirely: 11 (1, 2, 5-8, 10-14, 17, 32)
- Different shape but defensible: 1 (3 convex vs RRF)
- Decisions (not gaps): 4 (26-28)

---

## 4. Memory-type-by-storage-backend matrix (LITFIN today)

| Memory type | Where | Backend | RLS-scoped | Embedding | TTL |
|---|---|---|---|---|---|
| Working (in-prompt) | `kernel.ts` think() per-turn state | none (transient) | n/a | n/a | turn-scoped |
| Episodic (raw events) | `memory_episodes` + `ai_messages` | pgvector 1536d | tier + subject_id | OpenAI 3-small | 30d soft-purge if importance<0.2 |
| Semantic (extracted facts) | `memory_facts_v2` + `ai_semantic_facts` | pgvector 1536d | tier + subject_id | OpenAI 3-small / BGE-M3 | `expires_at` settable, not auto-set |
| Procedural (skills) | `memory_skills` (via procedural.ts) | Postgres | tier + subject_id | OpenAI 3-small | none |
| Reflective (decision retrospectives) | `memory_reflections` + `ai_reflections` | Postgres | tier + subject_id | OpenAI 3-small (context-sig) | weekly cap |
| Autobiographical | `brain_autobiography` (via persistor) | Postgres + 256-ring | service-role | none | ring-bounded |
| Narrative | `borrower_narratives` (via narrative.ts) | Postgres | subject_id | none (structured) | none |
| Bi-temporal | `memory_facts_v2.valid_from/valid_to/observed_at/asserted_at/supersedes_id` | Postgres | tier + subject_id | inherits | supersession chain |
| Knowledge graph (fact-to-fact) | `memory_graph_edges` | Postgres recursive-CTE | via fact RLS | none on edge | none |
| Knowledge graph (entity-ontology) | `knowledge_triples` | Postgres + app BFS | org_id | none | `expires_at` settable |
| Entity graph (operational) | Neo4j | Neo4j | org_id property | subgraph2vec cache (pgvector) | bi-temporal edges |
| Topic files (MEMORY.md pattern) | `memory_topic_files` | Postgres (markdown text) | tier + subject_id | none | last_consolidated_at |
| Cohort embedding cache | `embedding_chunk_cache` | pgvector 1536d | scope (cohort|private) + org_id/user_id | OpenAI 3-small | DP ε-budget |
| Subgraph embedding cache | `graph_node_embeddings` | pgvector 1024-1536d | org_id | sidecar or text-fallback | computed_at |
| Translation memory | `translation_memory` | Postgres | role=authenticated read | none | none |

**Observation:** 14 distinct memory tables. No project I have read has more.

---

## 5. Bidirectional porting recommendations

### 5a. LITFIN → BOSSNYUMBA (port FROM LITFIN)

| # | What to port | LITFIN ref | BOSSNYUMBA gap | Effort |
|---|---|---|---|---|
| 1 | **Mem0 ADD/UPDATE/DELETE/NOOP semantics** | `litfin-ai/memory/v2/mem0-semantics.ts:1-382` (PURE function, 382 LOC, zero deps) | BOSSNYUMBA consolidation worker `services/consolidation-worker/src/stages/04-promote.ts` just promotes — no negation handling, no contradiction detection, no NOOP | **S** (drop-in copy; pure module — adapt to use BOSSNYUMBA's embedder) |
| 2 | **Bi-temporal facts** | `litfin-ai/memory/v2/bi-temporal.ts:1-138` + migration `20260514_bitemporal_memory.sql` | BOSSNYUMBA `temporal-entity-graph.schema.ts` has bi-temporal on ENTITIES; the SEMANTIC facts at `kernel-memory-semantic.schema.ts` do not. Hybrid model: copy LITFIN's column additions to the semantic schema | **M** (migration + recall RPC update; the helpers port as-is) |
| 3 | **Contextual chunker (Anthropic pattern)** | `document-intelligence/contextual-rag/contextual-chunker.ts:1-268` | BOSSNYUMBA RAG layer (if any) does early chunking; this gives 35-49% retrieval lift on docs | **S** (single file, brain.think wrapper — adapt to BOSSNYUMBA brain API) |
| 4 | **BM25+vector hybrid + Cohere Rerank** | `contextual-rag/bm25-hybrid.ts:1-264` + `cohere-reranker.ts:1-199` | BOSSNYUMBA has neither | **S** (two files, ~460 LOC; identity fallbacks make them safe to ship before keys arrive) |
| 5 | **Span-level citations + verifier** | `contextual-rag/span-citations.ts:1-261` | BOSSNYUMBA has no citation hallucination guard | **S** (PURE module; ports as-is) |
| 6 | **Cursor 2.0 cohort embedding cache** | `litfin-ai/memory/v2/cohort-cache.ts:1-525` + migration `20260514_cohort_embedding_cache.sql` + DP ε-budget at `lib/security/dp-budget.ts` | BOSSNYUMBA re-embeds every chunk per tenant — wasted spend ~92% | **M** (cache table + RLS policies + the helper) |
| 7 | **Multi-hop graph traversal with explanation paths** | `knowledge-graph/graph-rag.ts:139-296` returns `{explanation: "borrower:A -> works_at -> bank:B"}` | BOSSNYUMBA temporal-entity-graph has the data, no explanation-path renderer | **S** (~120 LOC) |
| 8 | **Voyager-style declarative skills** | `litfin-ai/memory/v2/procedural.ts:1-278` | BOSSNYUMBA `skill-registry.schema.ts` exists but no recall/promote/apply layer | **M** (port procedural.ts + the SQL migration for the skills table — schema mostly matches) |
| 9 | **Sleep-tick concurrency-lock + stuck-row reaper** | `heartbeat/sleep-tick.ts:272-330` (SLEEP-LOCK + SLEEP-RESCUE) | BOSSNYUMBA consolidation orchestrator at `services/consolidation-worker/src/orchestrator.ts` lacks this — if a pod crashes mid-run, the next run skips forever | **S** (~60 LOC) |
| 10 | **Autobiography ring + outbox emission** | `brain/autobiography.ts:1-130` | BOSSNYUMBA has no "I" thread; significant events vanish into audit tables | **M** (ring + persistor + outbox bridge — needs BOSSNYUMBA's equivalent of `emitThought`) |
| 11 | **PII-scrubbing at sovereign-tier recall** | `litfin-ai/memory/v2/recall.ts:88-127` (`hashId`, `stripIdentifiers`, `stripPiiFromFact`) | BOSSNYUMBA cross-tenant analytics path lacks this | **S** (~50 LOC; the regex panel is TZ-specific — adapt for KE/RW where BOSSNYUMBA expands) |
| 12 | **BGE-M3 multilingual fallback for Swahili** | `brain/bge-m3-adapter.ts:1-80` + `litfin-ai/memory/v2/embedding.ts:104-127` | BOSSNYUMBA Swahili borrowers get OpenAI-only embeddings (weaker on Swahili) | **S** (one adapter + the routing helper) |
| 13 | **Hippocampal pattern separator** | `brain/hippocampal-indexing/pattern-separator.ts:52-130` | BOSSNYUMBA episodic similar episodes interfere at recall | **M** (~200 LOC + bound-ring; mostly pure) |
| 14 | **15 sleep passes registry pattern** | `heartbeat/sleep-passes/index.ts:108-124` | BOSSNYUMBA consolidation-worker has 8 stages all called every run; LITFIN's pattern lets each pass have its own min-interval + max-duration + emission kind | **M** (refactor of orchestrator; adds the SleepPass interface) |

### 5b. BOSSNYUMBA → LITFIN (LITFIN should adopt FROM BOSSNYUMBA)

| # | What to port | BOSSNYUMBA ref | LITFIN gap | Effort |
|---|---|---|---|---|
| 1 | **First-class Self-RAG enforcer** | `packages/central-intelligence/src/kernel/self-rag/self-rag.ts` (IsREL / IsSUP / IsUSE tokens, BLOCKS on `low|unknown` IsSUP when financial regex matches the response) | LITFIN has `faithfulness-monitor.ts` and `cot-monitorability.ts` but no first-class blocking enforcer — citation hallucination on rent/loan numbers can slip | **S** (drop in the BOSSNYUMBA module, wire the kernel call site) |
| 2 | **Typed declared-fact `source` enum** | `packages/database/src/schemas/kernel-memory-semantic.schema.ts:59-61` `source ∈ {extracted, declared, consolidated}` | LITFIN treats every fact as extracted — no "user said so explicitly" trust signal | **S** (migration + enum + producer endpoint) |
| 3 | **Cleanly separated `temporal_entities` + `temporal_relationships` + `temporal_communities` tables** | `temporal-entity-graph.schema.ts:52-100` | LITFIN bi-temporal columns are bolted onto `memory_facts_v2` — overloaded shape | **M** (a refactor; not urgent, but cleaner long-term) |
| 4 | **Per-tenant `PersonaBrandingResolver`** | (see `01-brain-core.md` §5b) | LITFIN is single-tenant brand-frozen as "Mr. Mwikila" | **L** (architectural — same concern as brain-core, but the memory layer's `<long_term_memory tier=...>` block at `recall.ts:261` would also benefit from per-tenant rendering) |

---

## 6. Top-10 actions (prioritised)

Ordered by impact-per-effort for LITFIN's own memory-stack evolution (i.e. what LITFIN should ship next, NOT what to port).

### Action 1 — Replace convex combo with RRF (1 day) — **highest ROI**
- Swap `hybridScore` in `bm25-hybrid.ts:207-237` with reciprocal rank fusion: `score(d) = Σ_ranker 1/(k + rank_ranker(d))` with `k=60` (Anthropic / Cohere reference).
- Keep convex combo as an option behind a `fuseMethod: 'rrf' | 'convex'` flag for A/B.
- Wire a tiny ablation harness in `__tests__/` to assert RRF doesn't regress.
- **Why:** Anthropic + Cohere benchmarks both show RRF beats convex on heterogeneous score distributions. LITFIN's BM25 score is unbounded; min-max normalizing it before convex is theoretically lossy.

### Action 2 — Reverse-port Self-RAG enforcer from BOSSNYUMBA (½ day)
- Copy `packages/central-intelligence/src/kernel/self-rag/self-rag.ts` from BOSSNYUMBA.
- Wire `enforceSelfRag(...)` after the sensor's response and before the policy gate in the borrower / officer chat surfaces.
- Block when `IsSUP ∈ {low, unknown}` AND the response contains a financial regex match (rent / loan amount / interest %).
- **Why:** LITFIN's faithfulness monitor flags; it does not block. The cleanest closed-loop hallucination guard for credit numbers.

### Action 3 — Add HyDE wrapper around recall (½ day)
- New module `src/core/litfin-ai/memory/v2/hyde-recall.ts`: pre-generate a one-paragraph hypothetical answer via Haiku, embed THAT, pass to `recallFacts`.
- Toggle behind `req.hydeMode: 'off' | 'short' | 'verbose'` so we can A/B per surface.
- **Why:** LITFIN's tier-0 borrower queries ("how much can I borrow?") have low literal overlap with the underlying knowledge. HyDE closes that.

### Action 4 — Persist BM25 index via Postgres FTS (1 day)
- Migration: `ALTER TABLE memory_episodes ADD COLUMN ts_vec tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;` + GIN index.
- Same for `memory_facts_v2.fact_text` and `document_chunks.chunk_text`.
- Replace `searchBM25(query, docs)` with a Postgres FTS RPC for corpora-scale queries; keep `searchBM25` for per-document use.
- **Why:** Today every cross-document BM25 search builds the index from scratch (O(N) per call). Postgres FTS is the pragmatic compromise — no Elasticsearch dependency.

### Action 5 — Wire decay-curve forgetting (1 day)
- New sleep pass `decay-and-prune.ts`: per-fact half-life curve `confidence *= 0.5^(daysSinceLastAccess / halfLifeDays)` where `halfLifeDays` varies by `fact_type` (preference=30d, profile=180d, milestone=∞).
- Track `last_accessed_at` per fact (new column, default `observed_at`); update on every recall hit (fire-and-forget).
- Delete when `confidence < FORGET_FLOOR=0.1`.
- **Why:** Without decay, three-week-old user statements weigh equally with yesterday's. HippoRAG 2 / Letta v2 patterns both ship this.

### Action 6 — Hierarchical GraphRAG community summaries (2 days)
- Extend `belief-community-detection.ts` sleep pass: after `detectCommunities`, for each community at level 0, call `brain.think({systemPolicy: "Summarize the SHARED THEMES across these N beliefs in 3 sentences", userInput: belief-texts-of-community})`. Persist to `belief_communities.summary_level_0`.
- At level 1, summarise the level-0 summaries (recursive). Stop at `maxLevels=2`.
- Add `recallGlobalAnswer(orgId, query)` that routes queries with "platform" / "across" / "trend" markers to the level-2 summary instead of vector recall.
- **Why:** Microsoft GraphRAG paper shows this is the WHOLE point. LITFIN computes the partition then leaves the value on the floor.

### Action 7 — Late chunking via BGE-M3 (2 days)
- Self-host BGE-M3 with the late-chunking pooling option (the upstream BAAI repo supports this since v1.5).
- Add `lateChunkEmbed(documentText, chunkBoundaries[])` that embeds the WHOLE doc once and pools per-chunk windows.
- Route long financial PDFs (>5k chars) through the new path; keep early chunking for short / structured docs.
- **Why:** Jina v3+ data: ~8% nDCG@10 lift on long-doc retrieval. LITFIN's contextual preface is bolted onto early chunks; late chunking would let us drop the preface entirely and save Haiku spend.

### Action 8 — Multi-query rewriting + RRF fusion (1 day)
- New wrapper: `recallFactsMultiQuery(req)` — generate 3 query rewrites via Haiku (`taskName: 'recall-multi-query'`, `cachePolicy: true`), recall over each, RRF-fuse the result lists (composes with Action 1).
- Toggle behind `req.multiQueryMode: 'off' | 'k=3' | 'k=5'`.
- **Why:** Cheap win on ambiguous user phrasing; especially helps Swahili-English mixed queries.

### Action 9 — Bi-temporal on `memory_graph_edges` (1 day)
- Migration: add `valid_from`, `valid_to`, `observed_at`, `asserted_at`, `supersedes_id` to `memory_graph_edges` (mirrors the fact-level columns).
- Update `traverse_memory_graph` RPC to filter by valid window.
- Update `extractGraphEdges` to set `valid_from = now()`.
- **Why:** Today the graph layer can answer "who is connected to X right now" but not "who was connected to X in March" — partial-credit on the regulator audit story that bi-temporal facts already nail.

### Action 10 — Embedder fine-tuning data export (1 day, infra only)
- Sleep pass `embedder-finetune-export.ts`: nightly emit `(query, positive_passage, negative_passage)` triples from feedback into S3.
- Triples are sourced from `kernel_feedback` (or LITFIN's feedback-collector) — `thumbs-up` → positive, `thumbs-down` on a recalled fact → negative.
- Format: standard `jsonl` for Voyage / Cohere / BGE retraining workflows.
- **Why:** Eventual embedder fine-tuning is XL effort (Action 33 in §3 table), but EXPORTING the training data is the cheap precursor that unblocks it. Voyage AI specifically advertises this workflow.

---

## 7. Surprises (vs the 2026-05-18 parity audit)

The partial parity audit found 6 missing + 11 partial + 7 extended gaps. **It massively undercounted what LITFIN ships** because it only looked at `src/core/memory/` (the original 4-tier per-user layer) and ignored the v2 package + contextual-rag package + Neo4j graph + hippocampal indexing + sleep-passes orchestrator. What that audit recorded as "MISSING" gaps in BOSSNYUMBA are mostly real (BOSSNYUMBA still genuinely lacks the cron, the UI button before it shipped, the multi-sink fan-out, etc.) — but the audit underdescribed what LITFIN itself has. Adding to the 25-item gap table from 2026-05-18:

- **Mem0 semantics** — fully shipped at `mem0-semantics.ts:272-362` with negation handling, similarity thresholds, ADD/UPDATE/DELETE/NOOP. The audit didn't even mention Mem0.
- **Bi-temporal facts (Zep/Graphiti)** — fully shipped at `bi-temporal.ts:1-138` with migration `20260514_bitemporal_memory.sql`. Audit treated bi-temporal as out-of-scope.
- **Cursor 2.0 cohort cache** — fully shipped + DP ε-budget. Audit didn't mention.
- **GraphRAG community detection** — Leiden/Louvain at `leiden-communities.ts`. Audit didn't mention.
- **Cohere Rerank 3.5** — shipped. Audit didn't mention.
- **Span-level citations** — shipped with FRONT verifier. Audit didn't mention.
- **BGE-M3 multilingual** — shipped with auto-Swahili-detect. Audit didn't mention.
- **Hippocampal indexing** — DG/CA3/CA1 neural-faithful primitives. Audit didn't mention.
- **PII-strip on sovereign tier recall** — shipped with TZ-specific regexes + UUID/email/account stripping + sha256 subject hashing. Audit didn't mention.
- **PDPA Right to be Forgotten erasure RPC** — shipped. Audit didn't mention.
- **15-pass nightly sleep-tick with concurrency-lock + stuck-row reaper + outbox mirror** — shipped. Audit only noted the cron presence, not the orchestrator depth.

This audit re-grounds the comparison on the FULL v2 stack.

---

*Last updated 2026-05-23. Author: codebase-mapper agent (LITFIN memory/RAG/KG slice). LITFIN refs are line-numbered against the LITFIN PROJECT working tree at the same date. SOTA refs are 2026-Q2 frontier per memory: Mem0 v2 (May 2025), Letta v2 (Apr 2025), Zep+Graphiti (Jan 2025), A-MEM (Feb 2025), GraphRAG + LazyGraphRAG (Apr 2024 / Nov 2024), HippoRAG 2 (Apr 2025), LightRAG (Oct 2024), Anthropic Contextual Retrieval (Sep 2024, still SOTA baseline), Jina late chunking (Aug 2024 v3), ColPali (Jul 2024), Cohere Rerank 3.5 (May 2025), bge-reranker-v2 (Sep 2024), Voyage-3-large (Oct 2025 MTEB SOTA).*
