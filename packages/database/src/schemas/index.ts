/**
 * Schema exports for BOSSNYUMBA database
 *
 * Duplicate member conflicts (ledgerEntriesRelations, notices*, auditEvents)
 * are resolved by expose-the-first-export-wins ordering, with
 * export-namespace wrappers around the later conflicting modules so the
 * duplicated names remain reachable under a namespace.
 */

export * from './tenant.schema.js';
export * from './property.schema.js';
export * from './blocks.schema.js';
export * from './customer.schema.js';
export * from './lease.schema.js';
export * from './payment.schema.js';
// payment-plan.schema re-declares paymentPlanStatusEnum (payment.schema
// has a legacy variant). Re-export the tables/relations directly and
// expose the module via `PaymentPlan` namespace for disambiguation.
export {
  paymentPlanAgreements,
  paymentPlanAgreementsRelations,
} from './payment-plan.schema.js';
export * as PaymentPlan from './payment-plan.schema.js';
export * from './maintenance.schema.js';
export * from './inspections.schema.js';
export * from './inspections-extensions.schema.js';
export * from './conditional-survey.schema.js';
export * from './asset-components.schema.js';
export * from './messaging.schema.js';
export * from './scheduling.schema.js';
export * from './utilities.schema.js';
// compliance.schema re-declares notices/noticeTypeEnum/noticesRelations
// which cases.schema also exports. Re-export everything EXCEPT those
// three names directly; expose the compliance notice variants under a
// `Compliance` namespace so both are reachable without collision.
export {
  complianceItemTypeEnum,
  complianceEntityTypeEnum,
  complianceStatusEnum,
  legalCaseTypeEnum,
  legalCaseStatusEnum,
  complianceItems,
  legalCases,
  complianceItemsRelations,
  legalCasesRelations,
} from './compliance.schema.js';
export * as Compliance from './compliance.schema.js';
export * from './intelligence.schema.js';
// ledger.schema re-declares ledgerEntriesRelations (payment.schema has
// a legacy declaration). Re-export the non-conflicting names directly
// and expose the full module under `Ledger` for access to the
// relations alias if needed.
export {
  accountTypeEnum,
  accountStatusEnum,
  ledgerEntryTypeEnum,
  entryDirectionEnum,
  statementTypeEnum,
  statementStatusEnum,
  statementPeriodTypeEnum,
  disbursementStatusEnum,
  accounts,
  ledgerEntries,
  statements,
  disbursements,
  paymentIntents,
  accountsRelations,
  statementsRelations,
  disbursementsRelations,
  paymentIntentsRelations,
} from './ledger.schema.js';
export * as Ledger from './ledger.schema.js';
// Row-shape type aliases (Prisma-parity names) used by
// services/payments-ledger/src/repositories/drizzle-*.repository.ts. The
// tables themselves are already exported above from ledger.schema.js;
// here we re-export only the inferred Row/Insert types to avoid
// duplicate runtime exports.
export type {
  PaymentIntentRow,
  PaymentIntentInsert,
  AccountRow,
  AccountInsert,
  LedgerEntryRow,
  LedgerEntryInsert,
  StatementRow,
  StatementInsert,
  DisbursementRow,
  DisbursementInsert,
} from './payments-ledger.schema.js';
export * from './documents.schema.js';
export * from './occupancy.schema.js';
export * from './cases.schema.js';
export * from './communications.schema.js';

// Audit and Event Infrastructure — tenant.schema already exports a
// parallel `auditEvents` legacy table. Re-export non-conflicting names
// directly and expose this richer module via `AuditEvents` namespace.
export {
  auditCategoryEnum,
  auditOutcomeEnum,
  auditSeverityEnum,
  auditActorTypeEnum,
  auditEventsRelations,
} from './audit-events.schema.js';
export * as AuditEvents from './audit-events.schema.js';
export * from './outbox.schema.js';

// HR / Organization (Brain)
export * from './hr.schema.js';

// Conversation / Thread Store (Brain)
export * from './conversation.schema.js';

// Marketplace bundle (Negotiation / Marketplace / Waitlist)
export * from './negotiation.schema.js';
export * from './marketplace.schema.js';
export * from './waitlist.schema.js';

// Approval Policies (per-tenant overrides; defaults in domain-services)
export * from './approval-policy.schema.js';

// Payments bundle
// GePG — Tanzania Government e-Payment Gateway (NEW 3)
export * from './gepg.schema.js';
// Arrears Ledger (NEW 4) — arrearsCases already exported from payment.schema,
// so we expose the richer module under `ArrearsLedger` namespace.
export * as ArrearsLedger from './arrears-cases.schema.js';
// Gamification (NEW 9)
export * from './gamification.schema.js';

// Documents bundle — render jobs, letter requests, scan bundles, doc-chat
export * from './document-render-jobs.schema.js';
export * from './letter-requests.schema.js';
export * from './scan-bundles.schema.js';
export * from './document-embeddings.schema.js';
export * from './doc-chat-sessions.schema.js';
export * from './doc-chat-messages.schema.js';
export * from './migration-runs.schema.js';

// Per-org geo-hierarchy (Districts/Regions/Stations etc., org-defined)
export * from './geo.schema.js';

// Lease + Risk + Compliance bundle (additive)
export * from './tenant-finance.schema.js';
export * from './intelligence-history.schema.js';
export * from './tenant-risk-reports.schema.js';
export * from './compliance-exports.schema.js';

// Reports bundle (additive): Interactive Reports (NEW 17) + Station Master Coverage (NEW 18)
export * from './interactive-reports.schema.js';
export * from './station-master-coverage.schema.js';

// Identity bundle — Cross-Org Tenant Identity + Multi-Org (Conflict 2)
export * from './identity.schema.js';

// Wave 8 gap closures — Warehouse inventory (S7), Maintenance taxonomy (S7),
// IoT observations (S3). All additive; no conflicts with existing schemas.
export * from './warehouse-inventory.schema.js';
export * from './maintenance-taxonomy.schema.js';
export * from './iot.schema.js';

// Wave 10 — Feature flags + GDPR right-to-be-forgotten + AI cost ledger
// + webhook retry/DLQ. All additive.
export * from './feature-flags.schema.js';
export * from './gdpr.schema.js';
export * from './ai-cost.schema.js';
export * from './webhook-delivery.schema.js';

// Wave 11 — AI security hardening + semantic memory.
export * from './ai-audit-chain.schema.js';
export * from './ai-semantic-memory.schema.js';

// Wave 11 — AI Classroom (Bayesian Knowledge Tracing for staff training).
export * from './classroom.schema.js';

// Adaptive Training — admin-driven, Mr. Mwikila-generated training paths.
// Sits on top of classroom BKT; replaces the rigid classroom/course model.
export * from './training.schema.js';

// Wave 12 — Intelligence Orchestrator + Progressive Intelligence.
// Decision feedback, proactive alerts, progressive context snapshots.
export * from './ai-intelligence-feedback.schema.js';
export * from './progressive-context.schema.js';

// Wave 13 — Autonomous Department Mode.
// Per-tenant autonomy policies, exception inbox for head-of-department,
// executive briefings, and every autonomous action's reasoning audit.
export * from './autonomy.schema.js';

// Marketing leads — post-chat handoff profiles for signup pre-fill.
export * from './marketing-leads.schema.js';

// Organizational Awareness — process observations, bottlenecks,
// improvement snapshots. Powers "talk to your organization" tool.
export * from './org-awareness.schema.js';

// Tenant Credit Rating — FICO-scale 300-850 rating for internal risk
// management and portable credit certificate (opt-in cross-landlord share).
export * from './credit-rating.schema.js';

// Property grading — A–F report card system (migration 0088).
export * from './property-grading.schema.js';

// Property valuations (migration 0090) — per-property appraisal amounts
// consumed by the property-grading portfolio weighting (asset_value hint).
export * from './property-valuations.schema.js';

// Feedback + complaints (migration 0092) — backs /api/v1/feedback and
// /api/v1/complaints with real persistence so the routers stop serving
// fixture data behind the liveDataRequired gate.
export * from './feedback-complaints.schema.js';

// Brain kernel substrate (migration 0114) — sampled CoT reservoir,
// persona-drift events, and per-think() provenance records. Mirrors
// LITFIN's kernel persistence patterns.
export * from './kernel-substrate.schema.js';

// Vacancy pipeline runs (migration 0098) — Drizzle mirror added at
// migration 0114 cycle so the production repo can drop the in-memory
// adapter wired during wave 27.
export * from './vacancy-pipeline.schema.js';

// Sovereign approvals (migration 0115) — four-eye gate persistence
// for write actions proposed by Nyumba Mind.
export * from './sovereign-approvals.schema.js';

// Platform privacy-budget ledger (migration 0116) — Postgres-backed
// PlatformBudgetLedger so cohort DP-aggregator budget consumption
// survives api-gateway restarts.
export * from './platform-privacy-budget.schema.js';

// Currency rates (migration 0117) — ISO-4217 → USD FX snapshots
// consumed by the platform-overview HQ KPI router's monthly-revenue
// aggregator to normalise mixed-currency payment sums.
export * from './currency-rates.schema.js';

// Persona branding (migration 0118) — per-tenant overrides for the
// kernel's central-intelligence persona (displayName, openingPreamble,
// voiceProfileId). Composite PK on (tenant_id, surface); empty-string
// surface acts as the surface-agnostic fallback row.
export * from './persona-branding.schema.js';

// Currency preferences (migration 0119) — per-user / per-tenant /
// platform-default display-currency choice. ISO-4217 free-form TEXT
// so new currencies are addable without code changes (built for the
// world, starting with TZ). Resolution chain: user → tenant → platform.
export * from './currency-preferences.schema.js';

// Market data cache (migration 0120) — per-(provider, query) TTL
// cache for external market-data adapter responses (Zillow, Airbnb,
// Rentometer, etc.). Not tenant-scoped; platform-tier external data.
export * from './market-data-cache.schema.js';

// Kernel memory hierarchy (migration 0121) — LITFIN-style four-tier
// memory ABOVE the existing thread_events transport: episodic (concrete
// past events with TTL), semantic (extracted facts with confidence +
// evidence_count), procedural (recurring workflow patterns with
// success-rate ranking), and reflective (periodic summaries written by
// the separate consolidation cycle agent). All tenant-scoped; user-
// scoped where the memory is personal, with NULL-user variants for
// tenant-wide facts and tenant-wide rollups.
export * from './kernel-memory-episodic.schema.js';
export * from './kernel-memory-semantic.schema.js';
export * from './kernel-memory-procedural.schema.js';
export * from './kernel-memory-reflective.schema.js';

// Kernel feedback (migration 0122) — online-learning signal store.
// Captures thumbs / corrections / flags per kernel turn so the next
// turn can read the user's recent feedback back at step 4 (memory
// recall) and bias the response toward conservative, citation-heavy
// output when the negative-rate is elevated. Closes the "stock LLMs
// are STATIC" assessment gap.
export * from './kernel-feedback.schema.js';

// Kernel agency (migration 0123) — persistent objectives + executor
// audit trail. `kernel_goals` carries the brain's per-(tenant, user)
// objective stack with a JSON `steps` array; `kernel_action_audit` is
// the append-only every-transition log the executor writes. Together
// they back the agency layer's "acts in full control" kernel slice.
export * from './kernel-goals.schema.js';
export * from './kernel-action-audit.schema.js';

// Sovereign action ledger (migration 0129) — hash-chained tamper-
// evident record of EXECUTED sovereign-tier actions (tenant eviction
// proposed, owner payout executed, KRA MRI filed, GePG control number
// revoked, ...). Closes LITFIN parity Gap C in 07-agency.md. Per-
// tenant chain rooted at GENESIS_HASH; this_hash = sha256(prev_hash
// || tenant_id || action_type || payload_hash || executed_at_iso).
export * from './sovereign-action-ledger.schema.js';

// Legacy migration coverage — Drizzle mirrors for tables that existed
// only in raw SQL. Closes the type-safety gap so consumers don't
// hand-roll raw SQL against these tables.
//
// Monthly close orchestrator (migration 0099) — per-tenant run state +
// step-by-step audit for `MonthlyCloseOrchestrator` (Wave 28 Phase A).
export * from './monthly-close-runs.schema.js';

// Market-rate surveillance snapshots (migration 0103) — daily per-unit
// comparable-rent rolling percentile band fed by the MarketRatePort
// abstraction. ISO-4217 currency, BIGINT minor units.
export * from './market-rate-snapshots.schema.js';

// Tenant predictions + predictive intervention opportunities
// (migration 0106) — nightly per-tenant probability distribution over
// the next 30/60/90 days; advisor surfaces open opportunities.
export * from './tenant-predictions.schema.js';

// Voice conversational turns (migration 0110) — append-only log of
// voice-mediated turns owned by Agent PhL (voice-first tenant/owner
// agent). Detects ANY language (never hardcoded en/sw).
export * from './voice-turns.schema.js';

// Sensor routing control plane (migration 0126) — LITFIN-parity tables
// that let an admin shift the brain's per-task sensor chain or throttle
// a tenant's monthly USD ceiling without a deploy. `sensor_call_log` is
// the append-only telemetry stream (one row per attempt with outcome,
// tokens, microdollar cost); `tenant_budget_envelopes` is the
// period-bound ceiling that the log debits.
export * from './sensor-call-log.schema.js';
export * from './tenant-budget-envelopes.schema.js';

// Per-tenant privacy-budget ledger (migration 0130, parity K6.2) —
// closes parity-gap G2 by tracking the (ε, δ) spend of each tenant's
// DP-aggregator calls over a 30-day rolling window. Sits BESIDE the
// singleton `platform_privacy_budget` so PrivacyBudgetComposerService
// can refuse cross-surface overspend.
export * from './privacy-budget-ledger.schema.js';

// Voyager skill registry (migration 0133, C5 Phase A) — procedural
// memory store of named callable skills promoted from successful trace
// clusters during the nightly consolidation pass. Retrieved at kernel
// step 6 (system-prompt composition) via cosine similarity against
// the user-intent embedding.
export * from './skill-registry.schema.js';

// Reflexion buffer (migration 0134, C5 Phase A) — per-(tenant, user)
// verbal reflections written at session end, read at session start.
// Pure prompt-layer memory; never touches model weights.
export * from './reflexion-buffer.schema.js';

// Implicit feedback signals (migration 0135, C5 Phase A) — the >99% of
// feedback that's NOT a thumbs (copy, re-prompt, edit-resubmit,
// override, abandonment, time-to-resolution). Joined to traces via
// the (trace_id, agent_action_id, tenant_id, user_id, surface, role)
// tuple; consolidation worker stage 03-reflect clusters successes vs.
// failures separately.
export * from './implicit-feedback-signals.schema.js';

// Sensorium event log (migration 0132, C4 Phase A — Central Command).
// Append-only log of filtered client-side sensory events from the
// 14-event taxonomy. Powers the server-side BehaviorObserver aggregator
// and the brain's mind-state inference (engagement.high, frustration.
// detected, task.completed-without-AI). PII-redacted at the client;
// mouse-move + input values never persisted.
export * from './sensorium-event-log.schema.js';

// Agency run checkpoints (migration 0136, C6 Phase A — Central Command).
// Durable substrate for the agency executor. One row per (run_id,
// step_index) with state machine pending → running → success | failure
// | paused. Powers retry + crash-recovery + operator-resumable goals.
// Phase A in-tree implementation of the Inngest AgentKit pattern.
export * from './agency-run-checkpoints.schema.js';

// Temporal entity graph (migration 0140, B4 Phase B — Central Command).
// Zep / Graphiti-style bi-temporal knowledge graph. Three tables:
// `temporal_entities` (typed nodes with valid_from/valid_to windows),
// `temporal_relationships` (typed edges between entities, also with
// their own validity windows), and `temporal_communities` (output of
// nightly Louvain community detection — see
// https://arxiv.org/abs/0803.0476). Rows are never deleted: the
// consolidation worker writes a fresh row with a new validity window
// when the world changes, and back-references the prior row via
// `invalidated_at`. Powers "who was living in 4B in March?" queries.
export * from './temporal-entity-graph.schema.js';

// Platform feature flags (migration 0137, B1 Phase B — Central Command HQ).
// Per-tenant JSONB key/value store backing platform.feature.flag.set /
// platform.feature.flag.read HQ tools. Boolean or string values; prior
// values snapshotted for rollback via the kill-switch / restore path.
export * from './platform-feature-flags.schema.js';

// Platform killswitch state (migration 0138, B1 Phase B — Central Command).
// Tracks the global killswitch level (off / read-only / paused / locked)
// plus prior-state snapshots for rollback. Mutations fan out across all
// portals via the cross-portal-bus; reads stay local to the gateway.
export * from './platform-killswitch-state.schema.js';

// Platform announcements (migration 0139, B1 Phase B — Central Command).
// HQ-issued platform-wide notifications with queue/dispatch state.
// Status flow: draft → queued → dispatched → retracted. Audience
// resolution + notification dispatch handled by injected ports
// (recipient resolver + notification dispatcher in composition root).
export * from './platform-announcements.schema.js';

// Session replay chunks (migration 0142, B5 Phase B — Central Command).
// Cold-store metadata for rrweb session-replay payloads (gzipped JSON in
// S3-emulated local storage or AWS S3). UNIQUE(session_id, sequence_number)
// enforces append-only idempotency. PII masked at the client BEFORE upload;
// inputs (password / cc / NIDA / KRA / M-Pesa) never persist to cold store.
export * from './session-replay-chunks.schema.js';

// Core memory blocks (migration 0151, D8 — Letta-style self-summary).
// Per-agent persistent blocks injected at the TOP of every system prompt.
export * from './core-memory-blocks.schema.js';

// Consolidation emissions (migration 0152, D8 — morning digest publish).
// One row per (tenant, day) summarising the consolidation tick.
export * from './consolidation-emissions.schema.js';

// MDR plan items (migration 0161, Phase E.7) — owner-visible, steerable
// plan tree spanning annual → daily horizons.
export * from './mdr-plan.schema.js';

// Owner skills marketplace (migration 0162, Phase E.7) — owner-installable
// Skills (cron / event / manual triggered workflows).
export * from './owner-skills.schema.js';

// Portal layouts (migration 0164) — per-(tenant, persona, user)
// `PortalLayout` documents backing the dynamic per-user UI primitive
// (`.audit/litfin-sota-2026-05-23/12-dynamic-per-user-ui.md`).
// JSONB layout blob + composite uniqueness on (tenant, persona, user).
export * from './portal-layouts.schema.js';

// WORM audit log (migration 0165) — append-only hash-chained audit
// substrate for every document leaving `@bossnyumba/document-studio`.
// Persistent backing for the `WormAuditStore` port in
// `packages/document-studio/src/signing/worm-audit.ts`.
// SOC 2 / GDPR Art. 30 audit trail for personal-data exports.
export * from './worm-audit-log.schema.js';

// Reflexion lessons (migration 0166) — per-(tenant, task_tag) bucketed
// teaching material distilled from CoT traces. Persistent backing for
// the `LessonStore` port in `packages/ai-copilot/src/reflexion/types.ts`.
// Render order: recency_score DESC, created_at DESC.
export * from './lesson-store.schema.js';

// AOP registry (migration 0167) — versioned, append-only catalogue of
// Agent Operating Procedures. Three sibling tables: aop_specs,
// aop_regression_sets, aop_active_versions. Persistent backing for
// the `AOPRegistryStore` port in
// `packages/central-intelligence/src/agent/aops/aop-registry.ts`.
export * from './aop-registry.schema.js';

// A2A v1.0 task store (migration 0168) — persistent backing for the
// `TaskStore` port in `packages/agent-platform/src/a2a/task-lifecycle.ts`.
// Status transitions: submitted -> working -> { completed | failed | canceled }.
// Adds mandatory tenant_id on the adapter side so a compromised session_id
// can't be replayed across tenants (in-memory port is single-tenant).
export * from './a2a-tasks.schema.js';

// Carbon-market book (migration 0170) — persistent backing for the
// `BookEntryRepository` port in `packages/carbon-market/src/types.ts`.
// Booked spot/forwards + their open/settled/cancelled state. Adapter
// in `services/carbon-market-book-service.ts`; the carbon-market
// package re-exports a `createPostgresBookRepository({ db })` helper
// that closes over this service.
export * from './carbon-market-book.schema.js';

// Persistent memory layer (migration 0181) — three tables backing the
// kernel's A-Mem / Letta-style memory:
//   - memory_blocks    : per-(tenant, session) Letta blocks injected
//                        at the top of every system prompt.
//   - episodic_notes   : A-Mem note ledger with importance score,
//                        embedding, parents links, FadeMem access
//                        counters.
//   - anchor_summaries : auto-condensed transcripts when the prompt
//                        window approaches ~70% context budget.
// Tenant-scoped, RLS-protected via `app.current_tenant_id` GUC.
export * from './memory.schema.js';

// Wave 12 — adaptive MD persistence:
//   - section_layouts      : per-(tenant, user, route) saved layout
//                            decisions for the adaptive layout engine
//                            (UI-1).
//   - user_action_tracker  : per-(tenant, user, action) frequency +
//                            confirm-rate ledger powering mastery tiers
//                            (UI-3) and learned shortcuts (UI-5).
// Both tables are RLS-protected via `app.current_tenant_id` GUC; see
// migrations 0182_section_layouts.sql and 0183_user_action_tracker.sql.
export * from './section-layouts.schema.js';
export * from './user-action-tracker.schema.js';

// Decision traces (migration 0185) — F10 DecisionTrace persistence.
// One row per finalised trace from `@bossnyumba/observability`. Tenant-
// scoped via RLS; service-role bypass for the admin replay UI. See
// migration `0185_decision_traces.sql` for the gold-standard ENABLE +
// FORCE + REVOKE FROM anon + canonical helper + FOR ALL policy.
export * from './decision-traces.schema.js';

// Piece L — brain↔tab loop (migrations 0229-0232):
//   - conversation_capture     : per-exchange capture (entities + intent +
//                                 confidence)
//   - module_update_proposals  : dispatcher output, HITL-gated
//   - tab_subscriptions        : persona × module → realtime channel
//   - tab_event_log            : append-only state-transition audit
// All tenant-scoped via RLS (`app.current_tenant_id` GUC); see migrations
// 0229_conversation_capture.sql ... 0232_tab_event_log.sql.
export * from './conversation-capture.schema.js';
export * from './module-update-proposals.schema.js';
export * from './tab-subscriptions.schema.js';
export * from './tab-event-log.schema.js';

// ─── Borjie port batch (migrations 0274-0283) ──────────────────────────────
//   - tenants.scale_tier             : T1 single_unit → T5 multi_country
//   - marketing_pilot_applications   : landlord/PM portfolio onboarding leads
//   - tenants.rate_limit_*           : per-tenant rate-limit overrides
//   - regulator_jurisdictions        : real-estate authority catalogue
//   - onboarding_state               : Day-1 jumpstart gate (1-per-tenant)
//   - tab_proposals_inbox            : autonomous tab-suggester proposals
//   - corpus_doc_uploads / summaries : Company Brain ingestion (append-only)
//   - request_for_applications       : vacancy listings + applicant pipeline
//   - move_in_out_condition_reports  : bilingual move-in/out narratives
//   - maintenance_tasks / toolbox    : crew task queue + safety briefings
export * from './marketing-pilot-applications.schema.js';
export * from './onboarding-state.schema.js';
export * from './regulator-jurisdictions.schema.js';
export * from './tab-proposals-inbox.schema.js';
export * from './corpus-doc-uploads.schema.js';
export * from './request-for-applications.schema.js';
export * from './move-in-out-condition-reports.schema.js';
export * from './maintenance-tasks.schema.js';

// ─── COMPANY-BRAIN wave (migrations 0285-0286) ─────────────────────────────
//   - intelligence_corpus_chunks  : pgvector-backed brain memory store
//                                    (global + per-tenant chunks).
//   - entity_index                : (tenant, kind, id) registry with
//                                    semantic embedding + tags + summary.
//   - entity_cross_references     : typed (source -> target) edges for
//                                    one-hop knowledge-graph traversal.
// All tenant-scoped via the canonical `app.current_tenant_id` GUC.
export * from './intelligence-corpus.schema.js';
export * from './entity-index.schema.js';

// ─── DIM-B port (migrations 0293-0294) ─────────────────────────────────────
//   - pinned_items     : per-owner quick-access strip + folder grouping
//   - saved_searches   : owner-defined alert rules with cadence-based
//                        worker re-runs (Roadmap R2).
export * from './pinned-items.schema.js';
export * from './saved-searches.schema.js';

// ─── Wave SUPERPOWERS — chat-as-OS backend routes (migration 0297) ──
//   - share_links      : time-limited shareable URLs for entities
//                        (mig 0297, route: /owner/share-links).
//
// undo_journal, bulk_action, and prefill schemas are introduced in
// subsequent migrations in the same wave.
export * from './share-links.schema.js';

// ─── Federated Personal Knowledge Base (migration 0296, ported from Borjie) ─
//   - persons                : canonical human identity (one row per
//                              real human; opt-in unified-KB flag).
//   - person_links           : (person × tenant × supabase_user × role)
//                              join. Many hats per human.
//   - personal_memory_cells  : federated personal-memory cells. NO RLS
//                              by design — gated by `app.current_person_id`
//                              GUC + Chinese-wall boundary-tagger in
//                              `packages/ai-copilot/src/memory/`.
//
// Closes BN "memory persistence" superpower #11 (PARTIAL → REAL): tenant-
// scoped memory (`core_memory_blocks`, `ai_semantic_memories`) survives,
// but a multi-tenancy landlord no longer loses her preferences when she
// switches estates.
export * from './persons.schema.js';
export * from './personal-memory.schema.js';

// ─── Wave SUPERPOWERS — chat-as-OS backend routes (migrations 0297-0299) ──
//   - share_links      : time-limited shareable URLs for entities
//                        (mig 0297, route: /owner/share-links).
//   - undo_journal     : generic 5-min undo ledger for chat-initiated
//                        writes (mig 0298, route: /owner/undo-journal).
//                        bulk_action + prefill emissions also append here.
export * from './share-links.schema.js';
export * from './undo-journal.schema.js';
//   - idempotency_keys : server-side hard uniqueness for mutation
//                        requests (mig 0299, middleware:
//                        services/api-gateway/src/middleware/db-idempotency.middleware.ts).
//                        Closes H2 deferral: prior Redis cache could
//                        not enforce uniqueness under split-brain.
export * from './idempotency-keys.schema.js';

// ─── Wave OWNER-OS — server-side tab persistence (migration 0300) ────
//   - owner_tabs : per-(tenant, user) tab strip ledger. Closes commit
//                  a935776e's deliberate localStorage-only deferral.
//                  Routes: /api/v1/owner/tabs. Real-estate FE pins
//                  lease/unit/maintenance_case/tenant/property
//                  context shapes into jsonb `state.tabs[].context`.
export * from './owner-tabs.schema.js';
