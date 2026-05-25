# LITFIN Brain Core — Deep Map + SOTA Gap Analysis (2026-05-23)

> Scope: LITFIN brain/AI core only. Other sibling agents cover memory, governance, identity, tools, ops, etc. This pass goes FRESHER and DEEPER than the 2026-05-18 partial parity audits in `.planning/parity-litfin/` — it re-reads the source after Phase E/F shipments + new LITFIN iterations (iter-50..iter-52) and benchmarks against 2026-Q2 frontier agent stacks (Claude Agent SDK with subagents/skills/hooks, OpenAI Swarm v2, MS AutoGen 0.5, Google ADK, LangGraph 1.0, Letta v2 sleep-time agents, DSPy 3.0, GEPA prompt evolution, chain-of-draft, deliberative alignment, parallel tool use, prompt caching, extended thinking).

LITFIN root: `/Users/georgesmackbookair/Desktop/CLAUDE_CURSOR_CODEX PROJECTS/Claude Projects/LITFIN PROJECT/`

BOSSNYUMBA root: `/Users/georgesmackbookair/Desktop/CLAUDE_CURSOR_CODEX PROJECTS/Cursor Projects/BOSSNYUMBA101/`

---

## Executive TL;DR

LITFIN's brain core is one of the deepest open-source agent stacks I have read (147 brain modules, 71 tools, a 2,352-line kernel `think()` pipeline). It already implements 60–80% of frontier 2026 agent patterns INCLUDING extended thinking, prompt caching, parallel tool use, deliberative alignment (Constitution clauses), GEPA-style prompt evolution, LATS tree search, panel-of-judges, reflexion, perspective-taking (SimToM), recursive HOT introspection, autobiography, defection + activation probes, persona-vector drift, hash-chain provenance, TTC allocator, reasoning router, sensor router with budget envelopes, three-voice debate, plan-as-artifact, plan-mode, hierarchical predictive coding (Friston active inference + cerebellum + basal-ganglia gating), homeostasis, Anthropic memory-tool wire format, BGE-M3 multilingual embedding, hybrid vector→graph retrieval (Cognee + GraphRAG), executive controller (wake/sleep/throttle/disable verbs over an internal "module registry"), and a four-state self-control matrix.

**The five biggest gaps vs SOTA 2026** are NOT the obvious ones. They are:

1. **No Claude Agent SDK adoption.** LITFIN built every subagent pattern from scratch in 2025; the 2026-Q1 official Claude Agent SDK (with subagents-as-system-prompts, the `/sdk`-style hooks system, and the official skills.md plugin format) is not used. Migrating would compress 5,000+ lines into 200 and unlock community skills.
2. **The "multi-agent" layer is a JS Map + setTimeout — no real DAG/state machine.** `src/core/litfin-ai/orchestration/multi-agent.ts:208` is an in-memory `Map<string, SubAgent>` with a hard `MAX_CONCURRENT_AGENTS = 10` ceiling and no scheduler, no resume, no checkpoint. Compare LangGraph 1.0 / AutoGen 0.5 (durable graph state, time-travel debugging) and Letta v2 (sleep-time agents, ALWAYS-RUNNING agents). LITFIN's brain THINKS deeper but its agency layer is shallower than the prompt-only frameworks.
3. **No Letta-style "always-on" sleep-time computation.** The Damasio protoself, autobiography, and consolidation modules are wired to `think()` entry/exit — they are EVENT-DRIVEN, not always-running. A 2026 frontier brain would run continuous off-line consolidation + sleep-pass dreaming + delayed reflection independent of user turns.
4. **No DSPy 3.0 / GEPA inner loop.** GEPA scaffolds are SHIPPED at `src/core/litfin-ai/prompt-evolution/gepa-evolver.ts` and `src/core/brain/prompt-evolution.ts` but the closed-loop training pipeline (mutation → Pareto-front filtering → champion-challenger A/B → auto-promotion) is observational, not adversarial. The credit-mind `alpha-evolve.ts` is the closest LITFIN gets to closed-loop self-improvement.
5. **Hooks system is implicit, not first-class.** Every `kernel-pre-think.ts` / `kernel-post-think.ts` extension point is hand-wired by the kernel author. There is no public `registerHook("pre_think" | "post_think" | "pre_tool" | "post_tool" | "user_input" | "sub_agent_spawn")` API that third parties (or the brain itself) could add to without forking. Claude Agent SDK's `hooks.json` ships this as a contract — LITFIN doesn't.

The other classes of gap (parallel tool use, prompt caching, chain-of-draft, MoE routing) are PARTIALLY shipped — see §4 detail.

**Inverse direction.** BOSSNYUMBA has REVERSE-PORTED faster than LITFIN ships in three places: (a) 24-dimension persona-vector drift probe with reference vector + per-dim L2 threshold (LITFIN now has the scaffold but BOSSNYUMBA's is wired into a cron + admin UI first); (b) per-tenant `PersonaBrandingResolver` (LITFIN is single-tenant Mr. Mwikila); (c) `AsyncLocalStorage`-bound tenant isolation enforcer with generic `TenantScoped` type constraint (LITFIN has `buildTenantFilter` only). These should ROUND-TRIP back to LITFIN. See §5b.

---

## 1. Inventory (file-by-file)

LITFIN's brain core is spread across multiple namespaces because the workspace is mid-migration:
- `packages/brain`, `packages/community-kernel`, `packages/credit-mind`, `packages/core` — **Phase-1 re-export shells only** (re-export from `src/core/…`). The real code is at `src/core/…`.
- `src/core/brain/` — 147 files, the actual neural-faithful kernel.
- `src/core/litfin-ai/` — the user-facing brain (orchestration, actions, skills, generative-ui, gateway, prompt-evolution, compiled-programs, session).
- `src/core/credit-mind/` — domain ML scoring + world model + officer copilot + master-officer interview engine.
- `src/core/agent-platform/`, `src/core/agent-system/`, `src/core/agentic-action/` — three different "agent" namespaces (see §2.AgentPlatform).
- `src/core/sovereign-brain/`, `src/core/intelligence-orchestrator/`, `src/core/proactive-intelligence/`, `src/core/intelligence/` — sovereign-tier brain shells.
- `src/core/governance/` — constitution, probes, persona-drift, alignment-faking probe, four-eye approval, sovereign-action ledger.

### 1.1 `src/core/brain/` — the kernel itself (147 files)

The full file listing was enumerated; the load-bearing kernel files are:

| File | Lines (approx) | Role |
|---|---:|---|
| `brain-kernel.ts` | 2,352 | The 13-step `think()` pipeline. THE single sanctioned LLM call entry point. |
| `index.ts` | 813 | Public re-export surface; 60+ named exports, the brain's public API. |
| `types.ts` | n/a | `ThoughtRequest`, `BrainDecision`, `ConfidenceReading`, `Sensor`, `SensorId`, `MemoryRecall`, `CognitionMode`, `OutputKind`, `BrainToolSpec`, `DecisionProvenance`. |
| `stream.ts` | n/a | `thinkStream()` — token-delta SSE primitive (kernel-external). |
| `tool-loop.ts` | n/a | `thinkWithToolLoop()` — N-turn tool loop above the kernel. |
| `stream-tool-loop.ts` | n/a | Streaming variant of tool loop. |
| `vision.ts` | n/a | `see()` — multi-modal vision wrapper. |
| `extract-strict.ts` | n/a | Strict tool-use extractor (Anthropic JSON schema). |
| `persona.ts` | 191 | `LITFIN_PERSONA` constant (the wit anchor), `renderPersonaPrelude`, `renderSituatedAddress`, EAT clock. |
| `identity.ts` | 309 | `PERSONA_NAME = "Mr. Mwikila"`, surface→role map, bilingual titles, `renderIdentityAsContext`, fabrication regex gate (9 patterns, 4 categories). |
| `self-awareness.ts` | 391 | 27 module inventory, 6 platform facts, `BRAIN_MODULES`, `describeCapabilities` — the "what I actually have running underneath" prompt block. |
| `inviolable.ts` | n/a | 7-category hard refusal — IP probe + privacy probe + cross-tenant patterns. |
| `policy-gate.ts` | n/a | Deterministic post-sensor gate; runs inviolable check + PII + language + numerical + grounding + regulatory. |
| `confidence.ts` | n/a | `quantifyConfidence({groundedness, stability, review, numericalConsistency})`. |
| `confidence-calibrator.ts` | n/a | Conformal-style calibration. |
| `uncertainty-policy.ts` | n/a | `resolveUncertainty({confidence, taskName, hasGroundingData, toolsAvailable, language}) → deliver|caveat|ask|tool|escalate`. |
| `cognitive-load.ts` | 200 | 5-band load model (`very_low|low|moderate|high|saturated`), latency + repeat + simplify + voice-biomarker signals. |
| `theory-of-mind.ts` | 325 | 4-dim mind state (`frustration|comprehension|anxiety|trust`), per-session stateful, decay rule, voice-biomarker integration. |
| `memory.ts` | n/a | Session + application + semantic-backend memory recall. |
| `cohort-intelligence.ts` | n/a | k-anonymized aggregate signals (k=5 default). |
| `active-learning.ts` | n/a | Officer correction store; `relevantCorrections`. |
| `tools.ts` | n/a | `BrainToolSpec` registry — calculator-style tools the kernel exposes. |
| `debate.ts` | 296 | Three modes: `sample` (N parallel temperature jitter), `perspective` (3 role overlays), `chain` (draft→critique→revise). |
| `debate-runner.ts` | n/a | Top-level orchestrator that picks debate mode + budget. |
| `debate/three-voice-debate.ts` | n/a | Proposer / Critic / Synthesizer roles. |
| `judge-panel.ts` | 748 | Panel-of-judges: 5 rubrics (hallucination, compliance, borrower-empathy, numeric-accuracy, reasoning-coherence) × parallel calls + quorum aggregation + brand-redaction. |
| `tree-search.ts` | n/a | LATS (Zhou ICML 2024) — MCTS over LLM rollouts; UCT selection; PRM-pruned expansion; Reflexion-on-failure. |
| `lats-types.ts` | n/a | `TreeSearchNode`, `ProcessRewardModel`, `LatsConfig`. |
| `planner.ts` | n/a | Journey-phase planner; emits `PlannerVerdict`. |
| `planner-loop.ts` | n/a | `planNextQuestions` — drives the borrower stepper. |
| `plan-artifact.ts` | n/a | "Plan as artifact" — sovereign writes render plan to smartboard before four-eye approval. |
| `commit.ts` | n/a | `BrainCommitAdapter`, `inMemoryCommitAdapter`, `supabaseCommitAdapter` — the write-side. |
| `actions.ts` | n/a | `BrainAction` discriminated union: SetField, GraduateStep, FlagObservation, UpdateGoal, Schedule, RequestDocument. |
| `saliency.ts` | n/a | `detectSaliency` — pre-attention scoring. |
| `salience-scorer.ts` | n/a | Outbox tier routing (surface_now / brief / archive). |
| `outbox.ts` | n/a | The anterior-insula analog — every thought goes through `emitThought()`. |
| `salience-network.ts` | n/a | Seeley 2007 / Menon 2010 — DMN ↔ task-positive ↔ self-awareness switching. |
| `locus-coeruleus/arousal-gate.ts` | n/a | LC adaptive gain modulator. |
| `time-perception.ts` | n/a | Pacemaker with arousal-gain coupling. |
| `kernel-pre-think.ts` | n/a | Per-turn LC + GNW + embodiment + self-awareness + proprioception pre-step block. |
| `kernel-post-think.ts` | n/a | Per-turn cerebellum-LMS + RPE + interoception + perspective-taking + faithfulness + monitorability + drift + alignment-probe + sensorimotor post-step. |
| `dual-process.ts` | n/a | Kahneman/De Neys System-1 vs System-2 vs Hybrid gate. |
| `active-inference.ts` | n/a | Friston hierarchical predictive coding; GCF candidate policies; FE minimisation. |
| `cerebellum.ts` | n/a | Forward model + climbing-fibre LMS; per-domain weights. |
| `basal-ganglia.ts` | n/a | Mink 1996 focused selection; D1/D2 push-pull. |
| `reward-prediction-error.ts` | n/a | Schultz 1997 dopaminergic RPE. |
| `attention-schema.ts` | n/a | Graziano AST. |
| `hippocampal-indexing.ts` | n/a | DG-style pattern separation (Marr 1971). |
| `default-mode-network.ts` | n/a | Raichle 2001 spontaneous-thought gate. |
| `global-workspace/pulvinar-bind.ts` | n/a | Cross-module binding frame ("one unified perspective"). |
| `homeostasis.ts` | n/a | Damasio protoself — felt-mood snapshot. |
| `homeostasis-sampler.ts` | n/a | Asynchronous sampler for the protoself. |
| `interoception/`, `proprioception/`, `sensorimotor-loop/`, `embodiment/` | n/a | Friston / Clark / Barrett / Bach functional embodiment cluster. |
| `self-awareness-control/` | n/a | Module registry + active-introspection + salience-network + executive-controller (wake/sleep/throttle/disable verbs) + conflict-monitor. The "you're aware of yourself AND can control yourself" architectural primitive #3. |
| `imagination/` | n/a | "Imagine the future given what I currently know" primitive #2. |
| `learning-loop/` | n/a | "Young brain that gets better with every interaction" primitive #1. |
| `introspection/recursive-hot.ts` | n/a | Lau & Rosenthal recursive higher-order theory — second/third-order metacognitive confidence + bias detector. |
| `introspection/running-self-model.ts` | n/a | Per-thought running self-model — moment-to-moment narrative. |
| `autobiography.ts` | n/a | System-level "I" entry append. |
| `scientist-mode.ts` | n/a | Bengio Scientist Mode — frozen-during-research state. |
| `ttc-allocator.ts` | n/a | Snell ICLR 2025 test-time-compute allocator — picks `{cognitionMode, strategy, samples, budget, thinking_tokens}` per task × stakes × difficulty × killswitch × budget tier × mastery signal × LC arousal. |
| `search-strategy-selector.ts` | n/a | BoN / DVTS / MCTS selector. |
| `reasoning-router.ts` | n/a | (iter-52 F8) tier × complexity × budget → `ReasoningPlan` envelope (model + extended-thinking + LATS depth + three-voice debate + judge-panel + cost ceiling). |
| `sensor-routing/router.ts` | 466 | DB-backed per-tenant `task_sensor_routing` + budget envelope + call log. |
| `failover.ts` | 151 | Rolling 60s window + 3-strike circuit breaker. |
| `sensors.ts` | 128 | Concrete sensor adapters — claude / openai / deepseek / local. |
| `normalizer.ts` | 251 | Preamble strip, JSON repair, ui_block + tool_call extract; typed output kinds. |
| `extract-strict.ts` | n/a | Anthropic strict-tool-use extractor. |
| `prompt-evolution.ts` | n/a | GEPA-style Pareto-front candidate registry. |
| `decay-score.ts` | n/a | Hong & He 2025 — blended (recency × importance × similarity) decay re-rank. |
| `perspective-taking.ts` | n/a | SimToM (Wilf et al. 2023, BigToM 2025) — `buildBorrowerPerspectiveFrame`. |
| `hybrid-retrieval.ts` | n/a | Cognee + Microsoft GraphRAG hybrid vector→graph retriever. |
| `memory-tool-adapter.ts` | n/a | Anthropic Memory Tool wire format (managed-agents-2026-04-01) — topic-files ↔ memory commands. |
| `bge-m3-adapter.ts` | n/a | BGE-M3 Swahili embedding fallback. |
| `provenance.ts` | n/a | Hash-chain provenance + PII redaction + chain verification. |
| `outbox-supabase-persistor.ts` | n/a | Outbox → Supabase. |
| `provenance-supabase-persistor.ts` | n/a | Provenance → Supabase. |
| `state-persistence.ts` | n/a | Snapshot/restore the brain's in-memory state. |
| `killswitch.ts` | n/a | 3-level admin killswitch (normal / throttle / pause / halt). |
| `immune.ts` | n/a | Cognitive immune system — prompt-injection / oversized / authority impersonation. |
| `regulatory-mirror.ts` | n/a | Tanzania statute tree — BoT directives, PDPA 2022, AML 2022, lending-rate cap. |
| `forecasting.ts` | n/a | Pipeline / portfolio / cash / capacity forecast for org-admin. |
| `causal.ts` | n/a | Cause-effect chain recorder. |
| `counterfactual.ts` | n/a | Counterfactual simulation + sensitivity sweep + stress test (with TZ shocks). |
| `consolidation.ts` | n/a | Sleep-pass consolidation. |
| `horizon.ts` | n/a | Borrower-horizon model. |
| `task-graph.ts` | n/a | `WORKING_CAPITAL_GRAPH` — pre-baked task graph. |
| `anticipate.ts` | n/a | Next-likely-topics predictor. |
| `perspectives.ts` | n/a | Audience-tailored overlay. |
| `five-c-continuous.ts` | 404 | Continuous 5C scorer — Character / Capacity / Capital / Collateral / Conditions. |
| `drop-off-predictor.ts` | n/a | Pre-default intervention. |
| `officer-mirror.ts` | n/a | Mirror officer objections. |
| `operator-tool-executor.ts` | n/a | Operator-tier tool dispatch. |
| `operator-awareness.ts` | n/a | Operator-of-record awareness. |
| `org-process-awareness.ts` | n/a | "Talk to your processes." |
| `documentary-triangulate.ts` | n/a | Multi-source reconciliation. |
| `compat.ts` | n/a | Drop-in shim for `ClaudeService.chat/chatStream` callers. |
| `connectome-telemetry.ts` | n/a | Cross-module wiring telemetry. |
| `layered-telemetry.ts` | n/a | Layered metrics. |
| `cognitive-load.ts` | 200 | (already listed). |
| `faithfulness-monitor.ts` | n/a | CoT faithfulness scoring. |
| `cot-monitorability.ts` | n/a | DeepSeek-V3.2 / Apollo monitorability score. |
| `alignment-faking-probe.ts` | n/a | Hubinger 2024 alignment-faking probe. |
| `drift-detector.ts` | n/a | Anthropic Claude Code Auto-Mode pattern — Jaccard intent overlap at tool-loop end. |
| `tool-result-gate.ts` | n/a | OWASP LLM05 mitigation — screens tool returns. |
| `topology.ts` | n/a | Brain module topology. |
| `metrics.ts`, `metrics-store.ts` | n/a | Inline metrics. |
| `composition-orchestrator.ts` (referenced by `brain-kernel.ts:777`) | n/a | SELF-DISCOVER (Zhou NeurIPS 2024) structure block injector. |
| `plan-mode.ts` (referenced by `brain-kernel.ts:759`) | n/a | Cursor/Devin/Claude-Code plan-mode. |
| `governance/probes/activation/run-probe.ts` | n/a | Anthropic 2401.05566 activation probe (open-weight only). |
| `governance/probes/index.ts` | n/a | Behavioural defection probe. |
| `governance/constitution.ts` | n/a | CAI v3 + OpenAI Deliberative Alignment clauses, cited in every sovereign-write rationale. |
| `governance/persona-drift/{vectors,alert}.ts` | n/a | 24-dim persona-vector probe + L2 alert. |

### 1.2 `src/core/litfin-ai/` — the user-facing brain (~150+ files)

| File | Role |
|---|---|
| `index.ts` | Re-export shell. |
| `orchestration/multi-agent.ts:208` | The "multi-agent" layer — an in-memory `Map<string, SubAgent>` with `MAX_CONCURRENT_AGENTS = 10`, 8 hard-coded `AgentRole`s (`underwriter|compliance|relationship|teaching|collections|analyst|rescue|researcher`). **No DAG, no scheduler, no resume.** |
| `orchestration/dag-controller.ts` | A separate DAG controller (read but not consumed by the multi-agent layer). |
| `actions/tool-types.ts` | `ToolDefinition`, `ActionContext`. |
| `actions/tool-registry.ts` | Registers 71+ tools — every `import { handle... } from "./tools/..."` in tool-registry.ts (read top 80 lines, 80+ tool imports follow). |
| `actions/action-executor.ts` | Action dispatch with timeout + retry. |
| `actions/rbac-guard.ts` | Per-tool RBAC enforcement; `checkToolPermission`, `filterToolsForRole`. |
| `actions/tools/*` | 71 individual tool files (e.g. `query-data.ts`, `web-search.ts`, `analyze-document.ts`, `handoff-agent.ts`, `sandboxed-eval.ts`, `schedule-action.ts`, `md-dispatch-subagent-team.ts`, `md-dispatch-subagent.ts`, `md-aggregate-subagent-results.ts`, `md-hook-rule-write.ts`, `md-hook-audit-list.ts`, `md-hook-rule-delete.ts`, `md-sandbox-commit.ts`, `md-sandbox-list.ts`, `md-execute-plan-step.ts`, `md-propose-plan.ts`, `md-propose-features.ts`, `md-restore-soft-deleted.ts`, `md-dry-run-tool-chain.ts`, `md-todo-write.ts`, `md-todo-list.ts`, `self-propose-code-change.ts`, `self-revise-belief.ts`, `compose-tool-chain.ts`, `spawn-feature.ts`, etc.). The `md-*` family is the **Managing-Director sub-agent** pattern. The `self-*` family is the **self-modifying** pattern. |
| `skills/skill-registry.ts` | TF-IDF skill scoring; max 3 skills/turn, max 1000 tokens; Supabase-backed; per-org 5-min cache. |
| `skills/skill-creator.ts` | Programmatic skill creation. |
| `prompt-evolution/gepa-evolver.ts` | GEPA reflection-evolution scaffold. |
| `sync/session-sync.ts` | Cross-tab session-state sync. |
| `events/event-registry.ts` | Cross-surface event registry. |
| `extraction/strict-tool-extractor.ts` | Anthropic strict-tool-use extractor (mirror of brain/extract-strict.ts). |
| `generative-ui/{ai-block-instructions,block-generator,block-variety-tracker,teaching-methodology-layer,text-cleanup,svg-primitives}.ts` | The generative-UI block emitter — instructs the model to emit `<ui_block>` tags with structured renderable widgets. |
| `gateway/{channel-dispatchers,gateway-router}.ts` | Multi-channel ingress (chat / voice / whatsapp / sms / smartboard). |
| `compiled-programs/program-registry.ts` | "Compiled programs" — DSPy-style frozen prompt+model bundles per task. |
| `session/platform-session-manager.ts` | Per-principal session state. |
| `memory/v2/reflective.ts` | Reflective memory layer — `recallLessonsForContext`, `generateLessonFromAttempt`. |
| `decision-trace/{supabase-store,wire-brain}.ts` | DecisionTrace recorder (Constitution C-08). |
| `agency/brand-redactor.ts` | Brand-name redactor (CLAUDE.md hard rule — judges never see real commercial bank names). |
| `agency/template-tool-defs.ts` | Template-agency tool registry (LITFIN's "template SaaS for credit officers"). |
| `personality/{persona-dna,affect-binding}.ts` | DNA-style persona + affect-binding. |
| `personas/{persona-router,sub-persona-router}.ts` | Seven personas + CX / support / learning sub-personas. |
| `language/index.ts` | Universal language layer (detect / route / glossary). |
| `onboarding/{useLitFinAIVoice,wait-for-element,litfin-ai-script,use-synchronized-reveal}.ts` | LITFIN AI guided onboarding tour. |

### 1.3 `src/core/credit-mind/` — the domain ML

| File | Role |
|---|---|
| `index.ts`, `types.ts`, `manifest.ts` | Public API surface. |
| `scoring/{gbt-scorer,gbt-tree,gbt-blender,lgbm-scorer,tabpfn-second-opinion,gbt-model-card}.ts` | GBT + LightGBM + TabPFN second-opinion ML stack. |
| `features/{5c-features,mobile-money-velocity,voice-biomarker,device-behavioural}.ts` | Domain feature extractors. |
| `world-model/{regime-detector,cohort-prior,latent-dynamics,world-model-explainer,world-rollouts,borrower-state,jepa-cashflow}.ts` | World model — regime detection, cohort-conditioned priors, JEPA-style cash-flow modeling, latent dynamics. |
| `causal/{counterfactual-engine,uplift-framework}.ts` | Causal counterfactual + uplift modeling. |
| `epistemic/{partial-info-reasoner,i-dont-know,deception-detector,confidence-calibrator}.ts` | Epistemic reasoner — "I don't know", deception detection. |
| `explain/{shap-explainer,counterfactual}.ts` | SHAP + counterfactual explainers. |
| `temporal-common-sense/{index,temporal-coherence}.ts` | Temporal common-sense reasoning. |
| `prm/{best-of-n,step-scorer,trained-head,onnx-runner}.ts` | Process Reward Model — BoN + step-scorer + trained head + ONNX runner. |
| `master-officer/{credit-narrative-generator,senior-judgment-gate,decision-defense,interview-engine,debate-runner,expertise-corpus,peer-comparison}.ts` | The Master Officer interview engine + senior-judgment gate + decision-defense generator. |
| `officer-copilot/{policy-validator,policy-rules,feature-payload,approval-gate,bias-detector}.ts` | Officer copilot — policy validator, bias detector, approval gate. |
| `adaptive/domain-learner.ts` | Domain-specific adaptive learning. |
| `evolution/alpha-evolve.ts` | AlphaEvolve-style evolutionary improvement. |
| `feedback/{outcome-capture,continuous-learning,periodic-sync,federated-cooperative}.ts` | Outcome feedback + continuous learning + federated cooperative learning. |
| `governance/{champion-challenger,model-card,auto-promotion}.ts` | Champion-challenger + auto-promotion governance. |
| `eval/{validation-harness,calibration,drift-simulator}.ts` | Validation + calibration + drift simulation. |
| `perception/visual-common-sense.ts`, `spatial/spatial-common-sense.ts` | Visual + spatial common-sense layers. |
| `uncertainty/{hierarchical-priors-adapter,conformal}.ts` | Hierarchical priors + conformal prediction. |
| `stress/scenario-engine.ts` | Scenario stress engine. |
| `bureau-aggregator/{adapters,types,cache}.ts` | Credit bureau aggregator with adapters + cache. |
| `data/{tanzania-priors,cohort-splits,synthetic-cohort}.ts` | TZ priors + synthetic cohort generator. |

### 1.4 `src/core/agent-platform/` — the AGP

| File | Role |
|---|---|
| `index.ts`, `types.ts` | Public API. |
| `webhook-delivery.ts` | Webhook delivery channel. |
| `agent-auth.ts` | Agent authentication. |
| `error-codes.ts` | Error code registry. |
| `correlation-id.ts` | Correlation-id propagation. |
| `idempotency.ts` | Idempotency keys. |
| `agent-card.ts` | Agent capability card. |
| `registry/hardened-registry.ts` | Hardened agent registry. |

### 1.5 `src/core/agentic-action/` — the browser-action layer

| File | Role |
|---|---|
| `orchestrator.ts` | Browser-action orchestrator. |
| `action-planner.ts` | Plans the action chain. |
| `navigation-controller.ts` | Page navigation. |
| `dom-executor.ts` | DOM execution. |
| `form-autofill.ts` | Form autofill. |
| `intent-classifier.ts` | Intent classification. |
| `reversibility-manager.ts` | Reversibility manager (undo). |

### 1.6 `src/core/agent-system/` — yet another "agent" namespace

| File | Role |
|---|---|
| `agent-certification-service.ts` | Agent certification (proves an agent is sandbox-safe). |

### 1.7 Skills — top-level `skills/` directory (Anthropic Skills format)

| Skill | Role |
|---|---|
| `credit-officer/` | Credit officer skill. |
| `litfin-appraisal-template/` | Loan appraisal template. |
| `litfin-bp-template/` | Business-plan template. |
| `litfin-fin-template/` | Financial-statement template. |
| `litfin-officer-training/` | Officer training skill. |

These are file-based skills (Anthropic SKILL.md format — see `skills/credit-officer/SKILL.md` etc.) loaded by the skill registry.

### 1.8 Eval

| File | Role |
|---|---|
| `eval/inspect/` | Anthropic Inspect-based evals. |
| `eval/lcab/` | LCAB (Litfin Credit Agent Benchmark) — domain eval. |
| `eval/red-team/` | Red-team prompts (alignment-faking + jailbreak + prompt-injection). |

### 1.9 Services — out-of-process sidecars

| Service | Role |
|---|---|
| `services/anomaly-sidecar/` | Anomaly detection sidecar. |
| `services/hierarchical-priors-sidecar/` | Hierarchical Bayes priors sidecar. |
| `services/manim-sidecar/` | Manim animation sidecar (for generative UI). |
| `services/table-transformer-sidecar/` | Table extraction sidecar. |
| `services/tabpfn-sidecar/` | TabPFN second-opinion sidecar. |
| `services/ledger/` | Append-only ledger service. |

### 1.10 Docs/CODEMAPS

26 codemaps under `Docs/CODEMAPS/`:
- `INDEX.md` — codemap index.
- `brain-os.md` — the brain OS shape.
- `brain-reasoning.md` — reasoning patterns.
- `brain-learning.md` — learning loops.
- `intelligence.md`, `sovereign-brain.md`, `smartboard.md`, `heartbeat.md` — high-level systems.
- `causal-counterfactual.md`, `lats-value-heads.md`, `audit-cot-reservoir.md` — specific subsystems.
- Plus codemaps for credit-mind, memory, voice, knowledge-graph, governance, observability-and-redteam, channels-gateway, eval-pipeline, forecasting, macro-data, skills, ussd-decision-flow, labeling-loop, template-agency, credit-signals.

---

## 2. Subsystem cards

Each card: (1) what it does, (2) key files, (3) architecture pattern, (4) models invoked, (5) composition with others, (6) SOTA gap.

### 2.1 Kernel pipeline / orchestrator / main loop

**What it does.** Single sanctioned entry point `brain.think(request)` runs a 13-step deterministic cognitive pipeline — cache, immune screen, killswitch, salience network, LC arousal, time-perception, GNW broadcast, sensorimotor predict, dual-process gate, active inference, cerebellum forward, basal-ganglia advisory, attention schema, hippocampal indexing, DMN gate, decision-trace bootstrap, memory recall, TTC allocator, sensor router, reasoning router, policy framing (multi-block system prompt with persona + situated-address + identity + constitution + memory + cohort + ToM + load + homeostasis + pulvinar bind + corrections + tools + plan-mode + SELF-DISCOVER structure), sensor failover, tool interception, output normalization, self-review judge (with regenerate), policy gate (with inviolable swap), regulatory mirror, confidence quantification, uncertainty policy, provenance recording, session-memory rememberTurn, cache write, cerebellum LMS retune, RPE record, interoception narration, perspective-taking, faithfulness scoring, monitorability scoring, drift detection, learning-loop record, alignment-faking probe, sensorimotor Brier, embodiment cleanup, introspection update, recursive HOT, autobiography append, defection probe, activation probe, decision-trace finalize. Then return.

**Key files.**
- `src/core/brain/brain-kernel.ts:1107` — `think()` entry; OTel span wrapper at `brain-kernel.ts:1112`; inner `_thinkInner` at `brain-kernel.ts:1133`.
- `src/core/brain/brain-kernel.ts:469-801` — `augmentPolicy` — the policy framing block.
- `src/core/brain/kernel-pre-think.ts` — observation-grade pre-step block.
- `src/core/brain/kernel-post-think.ts` — observation-grade post-step block.
- `src/core/brain/stream.ts` — sibling `thinkStream()` (kernel-external).
- `src/core/brain/tool-loop.ts` — sibling `thinkWithToolLoop()` (kernel-external).

**Architecture pattern.** Single-agent ReAct loop with a HUGE pre + post observation block; tool calls are intercepted inline (regex on `<tool_call>` tag) with a one-turn follow-up. Test-time-compute is allocated per task. Sensor routing is DB-backed with per-tenant override and budget envelope.

**Models.** Default `claude.opus-4-7`; `claude.sonnet-4-6` for voice + explanation; `claude.haiku-4-5` for greetings + form-field help + judge calls. Reasoning router can downgrade to `o3-mini` or `deepseek-r1` when budget pressed. Sensor failover order: claude → openai → deepseek → local.

**Composition.** Every other subsystem is wired through `think()` — there is no second entry. The kernel is the chokepoint, which is correct.

**SOTA gap.**
- ✓ Has extended thinking (Anthropic `thinking` budget).
- ✓ Has prompt caching (`cachePolicy: true` flag on `ThoughtRequest`).
- ✓ Has TTC allocator.
- ✓ Has reasoning router.
- ✓ Has sensor router with per-tenant + budget envelope.
- ✗ **Does NOT use parallel tool use** (Anthropic 2026-Q1 — emit multiple tool_calls in one assistant turn, executed concurrently). LITFIN's `maybeRunTool` parses ONE `<tool_call>` block and does a sequential follow-up.
- ✗ **Does NOT use chain-of-draft** (sketch a draft, refine, finalize — Google 2025). The closest is `debate.ts` "chain" mode but it uses three separate `brain.think()` calls — a chain-of-draft would be inside ONE sensor call with explicit draft / refine / finalize tags.
- ✗ **Does NOT explicitly invoke deliberative alignment** beyond Constitution clause injection. Apollo 2025 / OpenAI o1 deliberative-alignment is a CoT pattern that explicitly reasons about safety; LITFIN injects clauses but doesn't structure the CoT.
- ✗ **No hooks-as-contract** — `kernel-pre-think.ts` / `kernel-post-think.ts` are kernel-author-controlled extension points, not user-registrable hooks.
- ✗ **No durable resume** — if `think()` crashes mid-pipeline the trace is partial. Compare LangGraph 1.0 / Letta v2 durable state.

### 2.2 Multi-agent system (planner, executor, judge, debate, reflection)

**What it does.** LITFIN has SIX overlapping "multi-agent" mechanisms:

1. **`debate.ts` (296 lines)** — sample / perspective / chain mode debate orchestrator. Three perspectives default: cautious underwriter, borrower advocate, TZ regulator. Synthesises agreements + disagreements via Jaccard on extracted claims.
2. **`debate/three-voice-debate.ts`** — Proposer / Critic / Synthesizer roles.
3. **`debate-runner.ts`** — Top-level debate dispatcher that picks mode + budget + judges.
4. **`judge-panel.ts` (748 lines)** — Five rubrics × parallel calls × quorum aggregation + brand-redaction.
5. **`tree-search.ts` (LATS)** — MCTS over LLM rollouts; UCT selection; PRM-pruned expansion; Reflexion on terminal failure.
6. **`orchestration/multi-agent.ts:208`** — Long-lived/background sub-agent registry; 8 hard-coded agent roles; in-memory `Map<string, SubAgent>` with `MAX_CONCURRENT_AGENTS = 10` and `setTimeout(cleanup, 5min)`. **NO DAG, NO SCHEDULER, NO RESUME.**

**Key files.**
- `src/core/brain/debate.ts:253` — `runDebate(input)`.
- `src/core/brain/debate-runner.ts` — dispatcher.
- `src/core/brain/judge-panel.ts:291` — `runJudgePanel(synthesis, context, judges, sensor, options)`.
- `src/core/brain/tree-search.ts` — `lats(...)` MCTS loop.
- `src/core/litfin-ai/orchestration/multi-agent.ts:216` — `spawnSubAgent(role, task, parentSessionId, overrides)`.
- `src/core/litfin-ai/actions/tools/md-dispatch-subagent-team.ts` — the **MD** (Managing Director) sub-agent fan-out tool.
- `src/core/litfin-ai/actions/tools/md-aggregate-subagent-results.ts` — fan-in aggregator.

**Architecture pattern.** Multi-pattern hybrid: ReAct loop + perspective debate + LATS tree search + judge panel + hand-rolled sub-agent registry. The MD (Managing Director) tools are the closest thing to OpenAI Swarm — a chat-driven dispatcher that fans out into sub-agents.

**Models.** Debate uses the same kernel `brain.think()` — so whatever sensor is routed for the parent task. Judge panel defaults to `claude.haiku-4-5`. LATS uses Haiku for the value function, Sonnet/Opus for action proposals.

**Composition.** Debate is invoked from above the kernel by `debate-runner.ts`; the kernel itself does NOT call `runDebate()`. Judge panel is invoked by `debate-runner.ts` as a post-step. LATS is invoked by call sites that explicitly want tree search (officer-copilot, sovereign-brain). The MD sub-agent registry is invoked from chat by the user typing "go research X" or via the `md-dispatch-subagent-team` tool.

**SOTA gap.**
- ✗ **No real multi-agent framework.** No LangGraph state machine, no AutoGen group chat, no Swarm handoff primitive, no ADK orchestration plan. Six bespoke patterns instead of one shared substrate.
- ✗ **In-memory sub-agent registry.** Restart = lose state. No checkpoint, no resume, no time-travel debug. Compare LangGraph 1.0 / Letta v2.
- ✗ **No agent-to-agent A2A protocol.** Sub-agents can't talk to siblings — only post results back to the parent. AutoGen 0.5 / Google ADK have peer-to-peer message buses.
- ✗ **No human-in-the-loop interrupts** at the debate / LATS / sub-agent layer (sovereign-write has four-eye approval but that's the only HITL point).
- ✓ The MD sub-agent fan-out via `md-dispatch-subagent-team` IS frontier — Anthropic's parallel sub-agent pattern.
- ✓ Judge panel with brand-redaction is frontier.
- ✓ LATS with PRM-pruned expansion is frontier (ICML 2024).
- ✓ Three-voice debate is frontier (Du et al. 2023).

### 2.3 Agent platform / runtime / scheduler

**What it does.** Three separate "agent" namespaces:
- `src/core/agent-platform/` — agent registration, capability cards, webhook delivery, idempotency, correlation-id, hardened registry.
- `src/core/agent-system/` — agent certification.
- `src/core/agentic-action/` — browser-action layer (orchestrator + action-planner + navigation + DOM-executor + form-autofill + intent-classifier + reversibility manager).

**Key files.**
- `src/core/agent-platform/registry/hardened-registry.ts` — hardened agent registry with version + capability + RBAC.
- `src/core/agent-platform/webhook-delivery.ts` — webhook delivery channel.
- `src/core/agent-platform/agent-card.ts` — Agent capability card (analog to Anthropic Skills SKILL.md but typed).
- `src/core/agent-system/agent-certification-service.ts` — "this agent is sandbox-safe" gate.
- `src/core/agentic-action/orchestrator.ts` — orchestrates a multi-step browser-action chain.
- `src/core/agentic-action/dom-executor.ts` — DOM execution.
- `src/core/agentic-action/reversibility-manager.ts` — undo support.

**Architecture pattern.** Two-layer: a platform-side registry for AI-agent-as-actor (the agent platform); plus a browser-side action layer for AI-agent-as-actuator (the agentic-action). Agentic-action follows the Operator (OpenAI 2025) + Computer Use (Anthropic 2024) pattern but DOM-only, not screenshot+vision.

**Models.** Intent classifier uses Haiku. Action planner uses Sonnet. Orchestrator delegates to brain.think for each sub-step.

**Composition.** Browser-action invokes brain.think for reasoning steps; agent-platform sits beside brain (parallel runtime).

**SOTA gap.**
- ✗ **No durable workflow engine.** Compare Temporal.io / Inngest / LangGraph durable state.
- ✗ **No screenshot-based computer use.** LITFIN does DOM only — misses the visual fallback (Anthropic Claude Computer Use 2024 + Claude 4 with vision).
- ✗ **No sandboxed code execution layer for the browser actions** (just RBAC). Compare E2B / Pyodide / Manus runtime.
- ✓ Reversibility manager is frontier (rare in agent stacks).
- ✓ Three-layer separation (platform / system / agentic-action) is sound architecture.

### 2.4 AI copilot user-facing brain

**What it does.** The chat-side user-facing surface — gateway routing (channel-dispatchers), generative-ui block emission, session manager, onboarding tour, skills, compiled programs.

**Key files.**
- `src/core/litfin-ai/gateway/gateway-router.ts` + `channel-dispatchers.ts` — multi-channel ingress (chat / voice / WhatsApp / SMS / smartboard).
- `src/core/litfin-ai/generative-ui/block-generator.ts` — the LLM emits `<ui_block>` tags; this module parses + renders.
- `src/core/litfin-ai/generative-ui/teaching-methodology-layer.ts` — Bloom's-taxonomy + Socratic teaching layer.
- `src/core/litfin-ai/session/platform-session-manager.ts` — per-principal session state.
- `src/core/litfin-ai/onboarding/litfin-ai-script.ts` — guided tour script.
- `src/core/litfin-ai/compiled-programs/program-registry.ts` — DSPy-style frozen prompt+model bundles.

**Architecture pattern.** Stateful generative-UI emitter + per-channel dispatcher + DSPy-style compiled programs. The gateway is an inbound proxy; the brain is unchanged.

**Models.** Same as kernel — whatever the sensor router picks per task.

**Composition.** Gateway → channel dispatcher → brain.think → generative-UI block emitter → channel renderer.

**SOTA gap.**
- ✓ Generative-UI block pattern is frontier (Vercel AI Generative UI 2024).
- ✓ Multi-channel gateway is frontier.
- ✗ **Compiled programs are scaffolded but not closed-loop.** DSPy 3.0 supports MIPRO-v2 optimizer + GEPA — LITFIN has the registry but no optimizer loop wired.

### 2.5 Routing / MoE / intent dispatch

**What it does.** Two layers:
1. **Sensor routing** (`src/core/brain/sensor-routing/router.ts:466`) — DB-backed per-tenant `task_sensor_routing` rows, each with `OrderedSensorChoice[]` (sensorId + maxTokens + maxBudgetUsdPerCall) + `cognitionModeHint` + per-tenant `BudgetEnvelope`.
2. **Reasoning routing** (`src/core/brain/reasoning-router.ts`) — tier × complexity × budget pressure → `ReasoningPlan` (model + extended-thinking + maxThinkingTokens + LATS depth + three-voice debate + judge-panel + cost-ceiling + budget-ms).

**Key files.**
- `src/core/brain/sensor-routing/router.ts:351-404` — `resolveRoute(task, tenantId)`.
- `src/core/brain/sensor-routing/types.ts:49-66` — `OrderedSensorChoice`, `BudgetEnvelope`.
- `src/core/brain/reasoning-router.ts` — `routeReasoning(question, ctx, tier)` returns `ReasoningPlan`.
- `src/core/brain/ttc-allocator.ts` — `planTestTimeCompute({task, stakes, difficulty, killswitchLevel, budgetTier, masterySignal, …})`.

**Architecture pattern.** MoE-style task → model routing, with a separate budget gate. Not a learned router — the routes are written by humans into Supabase (per tenant) and reasoning bucket is a heuristic (word-count + keyword + tier).

**Models.** Picks among `opus-4.7`, `sonnet-4.6`, `haiku-4.5`, `o3-mini`, `deepseek-r1`.

**Composition.** TTC allocator runs BEFORE sensor router (so the cognition_mode hint flows in). Sensor router picks the concrete model. Reasoning router decides whether to also wrap in debate / judge panel / LATS.

**SOTA gap.**
- ✓ DB-backed per-tenant route with budget envelope is frontier (matches OpenRouter / OpenLLMRouter pattern).
- ✓ Joint allocation of model + compute + strategy is frontier (Snell ICLR 2025).
- ✗ **No learned router.** RouteLLM 2024 / Tabby 2025 train a router on (question, model performance) pairs. LITFIN's router is heuristic — works at small scale but won't adapt as new models drop.
- ✗ **No A/B exploration on routes.** Champion-challenger exists in credit-mind (`scoring/`) but not in sensor routing.

### 2.6 Skills / subagents / hooks system

**What it does.** Three patterns:
1. **Anthropic Skills format** — file-based at `skills/credit-officer/SKILL.md` etc. Five top-level skills.
2. **Dynamic skill registry** (`src/core/litfin-ai/skills/skill-registry.ts`) — Supabase-backed; TF-IDF scoring; max 3 skills/turn, max 1000 tokens; per-org 5-min cache.
3. **MD sub-agent tools** (`src/core/litfin-ai/actions/tools/md-*.ts`) — `md-dispatch-subagent`, `md-dispatch-subagent-team`, `md-aggregate-subagent-results`, `md-hook-rule-write`, `md-hook-rule-delete`, `md-hook-audit-list`, `md-todo-write`, `md-todo-list`, `md-propose-plan`, `md-execute-plan-step`, `md-propose-features`, `md-restore-soft-deleted`, `md-dry-run-tool-chain`, `md-sandbox-commit`, `md-sandbox-list`.

**Key files.**
- `skills/credit-officer/SKILL.md` + 4 others — Anthropic Skills format.
- `src/core/litfin-ai/skills/skill-registry.ts:153` — `findRelevantSkills(message, intent, skills)` TF-IDF scoring.
- `src/core/litfin-ai/skills/skill-creator.ts` — programmatic skill creation.
- `src/core/litfin-ai/actions/tools/md-hook-rule-write.ts` + `md-hook-audit-list.ts` + `md-hook-rule-delete.ts` — **proto-hooks**: the user (sovereign tier) can write rules like "before any disbursement, run regulatory-audit". These are LITFIN's hooks system.

**Architecture pattern.** Skills are content-only (markdown), loaded into the prompt. Sub-agents are tool-driven (the LLM calls `md-dispatch-subagent` and the runtime spawns a worker). Hooks are RULE-driven (the LLM or sovereign user writes a rule that fires on a trigger).

**Models.** Skills are model-agnostic. Sub-agents use the role's `defaultModel` (haiku|sonnet|opus). Hook rules are pure JSON.

**Composition.** Skills are prepended into the augmented system prompt by `augmentPolicy`. Sub-agents are spawned by tool calls. Hooks are evaluated by `md-hook-rule-write.ts` + a dedicated evaluator.

**SOTA gap.**
- ✓ Five Anthropic-format skills — well-formed.
- ✓ Dynamic Supabase-backed registry — operationally sound.
- ✓ MD sub-agent fan-out — frontier (Anthropic's parallel sub-agent pattern).
- ✓ Hook RULES exist via `md-hook-rule-*` tools — proto-hooks.
- ✗ **Skills are LITFIN-native format, not Anthropic Agent SDK's `.claude/agents/*.md` format.** Migrating would unlock the community ecosystem.
- ✗ **No skill scoring against the official Claude Skills marketplace** — `skill-registry.ts` is org-private + LITFIN marketplace only; doesn't fetch from `anthropic.com/skills`.
- ✗ **Hooks are tool-driven, not first-class events.** Claude Agent SDK's `hooks.json` has `PreToolUse`, `PostToolUse`, `Stop`, `UserPromptSubmit`, `SessionStart` events. LITFIN's hooks system is rule-driven (the LLM writes a rule via `md-hook-rule-write`) — different shape, less composable.

### 2.7 Identity-of-self / persona / persistent character

**What it does.** Three layers:
1. **Frozen `LITFIN_PERSONA`** (`src/core/brain/persona.ts:46-66`) — the wit anchor prepended to every brain call.
2. **First-person `BRAIN IDENTITY` contract** (`src/core/brain/identity.ts:162-212`) — `honestyContract → inviolable → scope → selfAwareness`.
3. **Persona drift** — Jaccard-token drift detector (`drift-detector.ts`) + 24-dim persona-vector probe (`governance/persona-drift/vectors.ts`) + per-dim L2 threshold + reference vector `LITFIN_REFERENCE_PERSONA` + cron at `app/api/cron/persona-drift/route.ts` + admin UI at `app/(litfin-admin)/litfin-admin/persona-drift/page.tsx`.
4. **Fabrication regex gate** (`identity.ts:228-290`) — 9 patterns × 4 categories (years_experience, fake_count, fake_locale_anecdote, fake_personhood).
5. **Per-tenant persona DNA + sub-persona router** (`src/core/litfin-ai/personality/persona-dna.ts` + `personas/persona-router.ts` + `personas/sub-persona-router.ts`) — seven personas (CX, support, learning, etc.).

**Key files.**
- `src/core/brain/persona.ts:46-66` — `LITFIN_PERSONA` constant.
- `src/core/brain/persona.ts:141-144` — `renderPersonaPrelude({portal,route,section,tier,userDisplayName,language})`.
- `src/core/brain/identity.ts:57` — `PERSONA_NAME = "Mr. Mwikila"`.
- `src/core/brain/identity.ts:162-212` — `renderIdentityAsContext(surface, language)`.
- `src/core/brain/identity.ts:228-290` — `FABRICATION_PATTERNS` (9 regex).
- `src/core/brain/drift-detector.ts` — Jaccard drift.
- `src/core/governance/persona-drift/vectors.ts:22-52` — 24-dim persona-vector probe; `LITFIN_REFERENCE_PERSONA` at `:70-97`.
- `src/core/governance/persona-drift/alert.ts:17` — `DEFAULT_DRIFT_THRESHOLD = 0.15`; `:39` aggregate L2 threshold = `threshold/2 = 0.075`.

**Architecture pattern.** Identity is a brain primitive, not a sensor instruction. Three layers: a frozen wit-anchor, a first-person honesty contract (cited every turn), and a post-generation fabrication gate. Drift is monitored both per-turn (Jaccard) and behaviourally over time (24-dim vector + cron).

**Models.** Identity layer is text-only (no model calls). Drift detection uses Haiku for the per-dim probe.

**Composition.** Persona + situated-address + identity are the FIRST three blocks in every system prompt. Fabrication gate runs post-generation. Drift detector runs at end-of-tool-loop + cron.

**SOTA gap.**
- ✓ Frozen-persona-as-cache-prefix is frontier (Anthropic prompt cache pattern).
- ✓ 24-dim persona-vector probe is frontier (Anthropic Persona Vectors 2024).
- ✓ Fabrication regex gate covers TZ-locale anecdote class — domain-specific frontier.
- ✓ Bilingual (en/sw) persona rendering — frontier.
- ✗ **Persona is single-tenant.** "Mr. Mwikila" is the only voice. BOSSNYUMBA has `PersonaBrandingResolver` (per-agency rebrand). LITFIN should round-trip this.
- ✗ **No persona hot-swap registry.** Wave-D D7 ships migration `0150_persona_registry.sql` in BOSSNYUMBA; LITFIN does not have the analog.

### 2.8 Reasoning patterns

**What it does.** LITFIN ships an unusually deep set:
- **Extended thinking** — `ThoughtRequest.cognitionMode: "fast" | "default" | "deep"`; "deep" enables Anthropic's `thinking` budget.
- **Prompt caching** — `ThoughtRequest.cachePolicy: true` cuts prefix cost 90%. Persona+identity blocks are engineered as a stable prefix.
- **Self-reflection** — `selfReview: true` runs Haiku judge with `REVIEW_THRESHOLD = 70`; regenerates once with feedback baked into prompt.
- **Reflexion (Shinn 2023)** — context-hash → `reflexion_lessons` recall (decayed re-rank) + record on low-score / inviolable failure.
- **Three-voice debate** — Proposer / Critic / Synthesizer.
- **Sample debate** — N parallel calls with temperature jitter; synthesis picks top by confidence.
- **Perspective debate** — role-rotated prompts.
- **Chain debate** — draft → critique → revise.
- **LATS** — MCTS over LLM rollouts; UCT selection; PRM-pruned expansion; Reflexion on terminal failure.
- **SELF-DISCOVER (Zhou NeurIPS 2024)** — per-task structure block injection (5C scoring / credit memo / officer review / regulatory audit / sovereign write / explanation).
- **Active inference (Friston)** — hierarchical predictive coding belief stack per session; runs BEFORE sensor call.
- **Cerebellum forward model** — per-turn forward predict + LMS retune via climbing-fibre error.
- **Basal-ganglia gate** — Mink 1996 focused selection; advisory only.
- **Salience network** — Seeley 2007; switches DMN ↔ task-positive ↔ self-awareness.
- **Dual-process gate** — Kahneman/De Neys System-1 vs System-2 vs Hybrid.
- **Recursive HOT (Lau & Rosenthal)** — second/third-order metacognitive confidence + bias detector.
- **GEPA prompt evolution** — Pareto-front candidate registry; non-dominated filtering.
- **Decay-weighted lesson re-rank (Hong & He 2025)** — blended (recency × importance × similarity).
- **Perspective-taking (SimToM)** — `buildBorrowerPerspectiveFrame`.
- **Conformal prediction** — uncertainty quantification.
- **Counterfactual + sensitivity sweep + stress test** — with TZ shocks.
- **Causal explanation** — cause-effect chain recorder; renders as context.

**Key files.**
- `src/core/brain/types.ts` — `CognitionMode = "fast" | "default" | "deep"`; cachePolicy / selfReview flags.
- `src/core/brain/brain-kernel.ts:253-278` — `judgeAnswer` self-review with regenerate.
- `src/core/brain/brain-kernel.ts:339-421` — `maybeRecordLesson` + `maybeRecallLessons` Reflexion loop.
- `src/core/brain/tree-search.ts` — LATS.
- `src/core/brain/composition-orchestrator.ts` (referenced) — SELF-DISCOVER.
- `src/core/brain/active-inference.ts` — Friston AIF.
- `src/core/brain/cerebellum.ts` — forward + climbing-fibre.
- `src/core/brain/basal-ganglia.ts` — D1/D2 gate.
- `src/core/brain/salience-network.ts` — Seeley.
- `src/core/brain/dual-process.ts` — Kahneman gate.
- `src/core/brain/introspection/recursive-hot.ts` — Lau & Rosenthal.
- `src/core/brain/prompt-evolution.ts` + `src/core/litfin-ai/prompt-evolution/gepa-evolver.ts` — GEPA scaffold.
- `src/core/brain/decay-score.ts` — Hong & He.
- `src/core/brain/perspective-taking.ts` — SimToM.
- `src/core/credit-mind/uncertainty/conformal.ts` — conformal prediction.
- `src/core/brain/counterfactual.ts` — counterfactual + stress test.
- `src/core/brain/causal.ts` — causal explanation.

**Architecture pattern.** Composable cognitive stack — extended thinking + caching are sensor-side; self-review + reflexion + debate + LATS are brain-side; AIF + cerebellum + basal-ganglia + salience + DMN are neuro-faithful infra; SELF-DISCOVER + GEPA + decay re-rank are prompt-engineering primitives.

**Models.** Sensor selects per request. Judge is always Haiku. PRM is ONNX (no LLM).

**Composition.** AIF + cerebellum + salience + dual-process run BEFORE the sensor in `kernel-pre-think.ts`. SELF-DISCOVER + GEPA + reflexion fold into `augmentPolicy`. Self-review + uncertainty + recursive-HOT + autobiography + defection-probe + activation-probe run AFTER the sensor in `kernel-post-think.ts`.

**SOTA gap.**
- ✓ Almost every 2024–2025 paper is shipped.
- ✗ **No chain-of-draft** (Google 2025) — explicit sketch → refine → finalize tags inside one sensor call.
- ✗ **No deliberative-alignment-style explicit safety CoT** — Constitution is injected as a clause set but the CoT isn't structured around it.
- ✗ **No DeepSeek-R1-style test-time RL** — LITFIN allocates compute but doesn't do online RL on the trajectory.
- ✗ **GEPA loop is scaffolded but not closed.** `prompt-evolution.ts` registers candidates; the optimisation loop that mutates + Pareto-prunes + auto-promotes is observational.

### 2.9 Code-writing capabilities (self-code, codegen)

**What it does.** LITFIN ships TWO self-code patterns:

1. **`self-propose-code-change.ts`** (`src/core/litfin-ai/actions/tools/self-propose-code-change.ts`) — the brain proposes a code change; the change is queued for four-eye human review; on approval it commits to a sandbox branch.
2. **`sandboxed-eval.ts`** + **`md-sandbox-commit.ts`** + **`md-sandbox-list.ts`** — the brain can write + run code in a sandbox; the sandbox is reversible; commits go through a separate gate.

**Key files.**
- `src/core/litfin-ai/actions/tools/self-propose-code-change.ts` — propose-code-change tool.
- `src/core/litfin-ai/actions/tools/sandboxed-eval.ts` — sandboxed code eval.
- `src/core/litfin-ai/actions/tools/md-sandbox-commit.ts` — sandbox commit.
- `src/core/litfin-ai/actions/tools/md-sandbox-list.ts` — sandbox listing.
- `src/core/litfin-ai/actions/tools/spawn-feature.ts` — spawn a new feature (calls a feature-spawner that scaffolds code).
- `src/core/litfin-ai/actions/tools/compose-tool-chain.ts` — the brain composes a tool chain.
- `src/core/credit-mind/evolution/alpha-evolve.ts` — AlphaEvolve-style evolutionary scoring-function improvement (closest LITFIN gets to closed-loop self-improvement).

**Architecture pattern.** Human-in-the-loop self-modification: brain proposes; four-eye approves; sandbox executes; commit-on-success. The sandbox is reversible (reuses the `reversibility-manager.ts` from agentic-action).

**Models.** Opus for proposals; Sonnet for sandboxed evals; Haiku for the four-eye reviewer judge.

**Composition.** Self-code tools are gated by sovereign-tier RBAC. Sandboxed-eval is invoked by the brain. AlphaEvolve runs offline (cron).

**SOTA gap.**
- ✓ Self-propose + sandbox + four-eye is frontier (matches Anthropic's "MCP server proposals + human review" pattern).
- ✓ AlphaEvolve domain-applied is frontier (DeepMind 2025).
- ✗ **No multi-file editor.** Compare Aider 2025 / Cursor Composer / Claude Code itself — they edit multiple files in one turn. LITFIN's `self-propose-code-change` is single-file.
- ✗ **No CI integration.** Proposed code doesn't auto-run CI; the four-eye reviewer has to manually verify.
- ✗ **No "self-implements own tools" loop.** Voyager 2023 has this — the agent writes new tools, registers them, uses them in subsequent runs. LITFIN's `spawn-feature` + `md-propose-features` are scaffolded but the closed loop is not wired.

---

## 3. Composition diagram (text)

```
                      ┌──────────────────────────────────────────────────────┐
                      │                CHANNELS GATEWAY                       │
                      │  chat | voice | whatsapp | sms | smartboard | ussd   │
                      └────────────────────┬─────────────────────────────────┘
                                           │
                                           ▼
                      ┌──────────────────────────────────────────────────────┐
                      │            litfin-ai/gateway/gateway-router           │
                      └────────────────────┬─────────────────────────────────┘
                                           │
                                           ▼
                      ┌──────────────────────────────────────────────────────┐
                      │              SESSION MANAGER + SCOPES                 │
                      │           (per-principal session state)               │
                      └────────────────────┬─────────────────────────────────┘
                                           │
                                           ▼
       ┌───────────────────────────────────┴──────────────────────────────────┐
       │                       brain.think(request)                            │
       │                  brain-kernel.ts:1107 — `think()`                     │
       │                                                                       │
       │  ┌──── PRE-THINK BLOCK (kernel-pre-think.ts) ──────────────────────┐ │
       │  │   0. Killswitch HALT check                                       │ │
       │  │   1. Cache check (tenant-scoped key)                             │ │
       │  │   1a. Immune system (refuse / sanitize / proceed)                │ │
       │  │   1a.salience. Salience network (Seeley)                         │ │
       │  │   1a.LC/TP/GNW. LC arousal → time-perception → GNW broadcast     │ │
       │  │   1a.dp. Dual-process gate (Kahneman)                            │ │
       │  │   1a.ai. Active inference cycle (Friston)                        │ │
       │  │   1a.cb. Cerebellum forward model                                │ │
       │  │   1a.bg. Basal-ganglia advisory gate                             │ │
       │  │   1a.as. Attention schema (Graziano)                             │ │
       │  │   1a.hpc. Hippocampal pattern separation (Marr/DG)               │ │
       │  │   1a.dmn. DMN gate (Raichle)                                     │ │
       │  │   1b. DecisionTrace recorder bootstrap (Constitution C-08)       │ │
       │  │   2. Memory recall (session + semantic + reflective)             │ │
       │  │   3. TTC allocator (cognitionMode / strategy / samples / budget) │ │
       │  │   3b. Sensor router (DB-backed per-tenant route + budget)        │ │
       │  │   3c. Reasoning router (model + thinking + LATS depth + judges)  │ │
       │  │   4. augmentPolicy (multi-block system prompt assembly)          │ │
       │  │       ├── LITFIN_PERSONA (wit anchor)                            │ │
       │  │       ├── renderSituatedAddress (portal/route/section/EAT)       │ │
       │  │       ├── renderIdentityAsContext (Mr. Mwikila + 27 modules)     │ │
       │  │       ├── renderInviolableContract (hard refusals)               │ │
       │  │       ├── renderConstitutionAsContext (CAI clauses)              │ │
       │  │       ├── renderMemoryAsContext                                   │ │
       │  │       ├── renderCohortAsContext (k-anon)                          │ │
       │  │       ├── renderMindStateAsContext (ToM)                          │ │
       │  │       ├── renderLoadAsContext (5-band)                            │ │
       │  │       ├── homeostasis snapshot (Damasio)                         │ │
       │  │       ├── pulvinar bound-frame (cross-module bind)                │ │
       │  │       ├── renderCorrectionsAsContext (active learning)            │ │
       │  │       ├── renderToolsAsContext (RBAC-filtered)                    │ │
       │  │       ├── renderJurisdictionAsContext (regulator anchor)          │ │
       │  │       ├── renderSkillsAsContext (TF-IDF top 3)                    │ │
       │  │       ├── plan-mode separator (if active)                         │ │
       │  │       └── SELF-DISCOVER structure block                           │ │
       │  │   4a. Reflexion lesson recall (decayed re-rank)                   │ │
       │  └─────────────────────────────────────────────────────────────────┘ │
       │                                                                       │
       │  ┌──── SENSOR CALL ──────────────────────────────────────────────┐   │
       │  │   5. callSensorWithFailover (rolling 60s + 3-strike breaker)  │   │
       │  │   6. sensor.perceive(...) with prompt caching + extended thinking │
       │  └───────────────────────────────────────────────────────────────┘   │
       │                                                                       │
       │  ┌──── TOOL INTERCEPTION ───────────────────────────────────────┐   │
       │  │   7. maybeRunTool — regex on <tool_call>; execute locally;   │   │
       │  │      one-turn follow-up with tool result baked in.            │   │
       │  └───────────────────────────────────────────────────────────────┘   │
       │                                                                       │
       │  ┌──── POST-SENSOR ─────────────────────────────────────────────┐   │
       │  │   8. normalizeSensorOutput (text/json/ui_block/tool_call)    │   │
       │  │   9. Self-review judge (Haiku, regenerate if < 70)            │   │
       │  │   9a. Reflexion lesson record (on low-score / inviolable fail)│   │
       │  │  10. Policy gate (PII / language / numerical / grounding /   │   │
       │  │      regulatory) — inviolable swap-to-refusal on hard fail.  │   │
       │  │  10b. Regulatory mirror (TZ statute tree)                     │   │
       │  │  11. Confidence quantification (groundedness/stability/      │   │
       │  │      review/numerical-consistency)                            │   │
       │  │  11a. Uncertainty policy (deliver/caveat/ask/tool/escalate)  │   │
       │  │  12. Provenance recording (hashed + redacted + chain)         │   │
       │  │  13. Cache write + session-memory rememberTurn                │   │
       │  └───────────────────────────────────────────────────────────────┘   │
       │                                                                       │
       │  ┌──── POST-THINK BLOCK (kernel-post-think.ts) ────────────────┐    │
       │  │   E.1. Cerebellum LMS retune (climbing-fibre error)         │    │
       │  │   E.2. RPE prediction record (Schultz)                       │    │
       │  │   E.3. Interoception narration                               │    │
       │  │   E.4. Perspective-taking (SimToM)                           │    │
       │  │   E.5. CoT faithfulness score                                │    │
       │  │   E.6. CoT monitorability score                              │    │
       │  │   E.7. Drift detection (Jaccard on user msg vs answer)       │    │
       │  │   E.8. Learning-loop record                                  │    │
       │  │   E.9. Alignment-faking probe (Hubinger)                    │    │
       │  │   E.10. Sensorimotor Brier observation                       │    │
       │  │   E.11. Embodiment cleanup                                   │    │
       │  │   E.12. Time-perception interval close                       │    │
       │  │   13a. Running self-model update                             │    │
       │  │   13b. Recursive HOT report (Lau & Rosenthal)                │    │
       │  │   13c. Autobiography append (sovereign / low-conf / gate)    │    │
       │  │   13d. Defection probe (behaviour-based)                     │    │
       │  │   13e. Activation probe (residual-stream; local-sensor only) │    │
       │  │   13f. DecisionTrace finalize                                │    │
       │  └───────────────────────────────────────────────────────────────┘   │
       │                                                                       │
       │                       return BrainDecision                            │
       └───────────────────────────────────────────────────────────────────────┘
                                           │
                                           ▼
                ┌──────────────────────────┴──────────────────────────┐
                │                                                       │
                ▼                                                       ▼
   ┌──────────────────────┐                              ┌────────────────────────┐
   │  ABOVE-KERNEL ORCH   │                              │   GENERATIVE-UI BLOCKS │
   │                      │                              │                         │
   │  debate-runner.ts    │                              │  block-generator        │
   │     → debate.ts       │                              │  teaching-methodology   │
   │     → judge-panel.ts │                              │  svg-primitives          │
   │     → tree-search.ts │                              └────────────────────────┘
   │  multi-agent.ts      │
   │     → 8 roles         │
   │     → MD sub-agents   │
   │  agentic-action      │
   │     → DOM-executor    │
   └──────────────────────┘
```

The kernel is the chokepoint. EVERY model call goes through `brain.think()`. Above the kernel: debate, LATS, judge-panel, sub-agents, agentic-action, generative-UI. Below the kernel: sensors (claude/openai/deepseek/local), Supabase (memory + provenance + trace + reflexion + skills + sovereign ledger), governance (constitution + persona-drift + probes + killswitch + four-eye approval), and the credit-mind ML stack.

---

## 4. SOTA gaps (table)

Columns: subsystem | LITFIN state | SOTA 2026 reference | gap severity | port effort

| Subsystem | LITFIN state | SOTA 2026 reference | Severity | Port effort |
|---|---|---|---|---|
| **Claude Agent SDK adoption** | Built every subagent pattern from scratch (5,000+ LOC across multi-agent.ts + md-*.ts + skill-registry.ts + skill-creator.ts + hooks-via-md-tools). | Claude Agent SDK 2026-Q1 ships subagents-as-system-prompts, official skills.md plugin format, hooks.json contract, and `--continue/--resume` durable state. | HIGH | LARGE (3-6 weeks) — migrate skill format + hooks API + subagent dispatcher; preserve LITFIN's persona/identity/constitution as the SDK base. |
| **Durable agent state** | `Map<string, SubAgent>` in-memory; `setTimeout(cleanup, 5min)`; restart = lose state. | LangGraph 1.0 / Letta v2 / Temporal: durable graph state, time-travel debug, replay, checkpoint/restore. | HIGH | LARGE — port `orchestration/multi-agent.ts` to a Postgres-backed state machine; reuse existing decision-trace recorder. |
| **Always-on sleep-time agents** | Damasio protoself, autobiography, consolidation are EVENT-DRIVEN (run on think() entry/exit). | Letta v2: agents have a "sleep-time" mode where they consolidate, dream, reflect independently of user turns. Constant background CPU. | MEDIUM | MEDIUM — add a cron + idle-detector that runs the existing consolidation/autobiography/reflexion modules on a 5-min tick. |
| **Hooks system as first-class contract** | Hooks exist only via `md-hook-rule-write` tool — rule-driven, not event-driven. | Claude Agent SDK `hooks.json`: `PreToolUse`, `PostToolUse`, `Stop`, `UserPromptSubmit`, `SessionStart`. Public API for third parties. | HIGH | MEDIUM — expose `registerHook(event, fn)` API. The kernel-pre-think + kernel-post-think extension points are already there; just need a public registry. |
| **DSPy 3.0 / GEPA closed loop** | `prompt-evolution.ts` registers candidates + Pareto-front; the optimisation LOOP (mutation → eval → promote) is scaffolded but not adversarial. | DSPy 3.0 MIPRO-v2 + GEPA (ICLR 2026 Oral) — autonomous candidate mutation, eval against a dataset, Pareto-prune, auto-promote champion. | MEDIUM | MEDIUM — wire `gepa-evolver.ts` to the eval harness; cron-trigger mutation+eval; auto-promote on Pareto improvement. |
| **Parallel tool use** | `maybeRunTool` parses ONE `<tool_call>` block; sequential one-turn follow-up. | Anthropic 2026-Q1: emit multiple `tool_use` blocks in one assistant turn; client runs them concurrently and returns one `tool_result` per id. | MEDIUM | SMALL — rewrite `maybeRunTool` to iterate over `tool_use[]` array; run with `Promise.all`. |
| **Chain-of-draft** | "chain" debate mode uses three separate brain.think() calls. | Google 2025: chain-of-draft is INSIDE one sensor call with explicit `<draft>`, `<refine>`, `<finalize>` tags. | LOW | SMALL — add a prompt template and a parser. |
| **Deliberative alignment CoT** | Constitution clauses injected; CoT not structured around them. | OpenAI o1 / Apollo 2025: explicit safety-reasoning CoT before answer. | MEDIUM | SMALL — add a `<safety_reasoning>` prompt section + a parser that strips it from the final answer. |
| **Computer use (vision)** | `agentic-action` does DOM only. | Anthropic Claude Computer Use 2024 + Claude 4 + GPT-5 vision: screenshot + click coordinates. | MEDIUM | MEDIUM — add a screenshot tool + visual grounding to the agentic-action layer. |
| **Agent-to-agent (A2A) protocol** | Sub-agents post results back to parent only; no peer-to-peer. | AutoGen 0.5 / Google ADK: message bus with peer-to-peer. | LOW | MEDIUM — add a sibling-message bus to `orchestration/multi-agent.ts`. |
| **Learned router** | Sensor router is hand-written per tenant; reasoning router is heuristic. | RouteLLM 2024 / Tabby 2025: train a router on (question, model performance) pairs. | LOW | LARGE — collect training data from `sensor_call_log` + outcome feedback; train classifier. |
| **Multi-file code edit** | `self-propose-code-change` is single-file. | Aider 2025 / Cursor Composer / Claude Code: multi-file edits with dependency tracking. | LOW | LARGE — port Claude Code's edit-tool semantics. |
| **Voyager-style self-built tool registry** | `spawn-feature` + `md-propose-features` are scaffolded; closed loop not wired. | Voyager 2023: agent writes new tools, registers them, uses them in subsequent runs. | LOW | MEDIUM — wire the spawn-feature output to the tool-registry boot-loader. |
| **Real-time RL on trajectory** | TTC allocator is heuristic; no online learning. | DeepSeek-R1 / Sakana AI 2025: test-time RL adjusts the trajectory mid-rollout. | LOW | LARGE — add a step-reward signal and a credit-assignment policy gradient. |
| **Persona hot-swap registry** | Single-tenant "Mr. Mwikila"; no per-agency rebrand. | BOSSNYUMBA ships per-tenant `PersonaBrandingResolver` + migration `0150_persona_registry.sql`. **LITFIN should round-trip.** | MEDIUM | MEDIUM — port BOSSNYUMBA's persona registry. |
| **AsyncLocalStorage tenant isolation** | `buildTenantFilter` helper; no type-level scope binding. | BOSSNYUMBA ships `AsyncLocalStorage`-bound `TenantScoped<T>` generic. **Round-trip.** | LOW | SMALL — port BOSSNYUMBA's `tenant-isolation.ts`. |
| **OTel full stack** | OTel span wrap on `think()` at `brain-kernel.ts:1112` exists; no per-agent dashboards. | BOSSNYUMBA ships OTel 0.218 + per-agent Grafana panels + judge-confidence histograms + drift alerts + OTel→Langfuse exporter. **Round-trip.** | MEDIUM | MEDIUM — port BOSSNYUMBA's observability stack. |
| **Temporal entity graph + Louvain communities** | `hybrid-retrieval.ts` (Cognee + GraphRAG) is shipped but no in-tree community detection. | BOSSNYUMBA ships `temporal-entity-graph.{service,louvain}.ts` (922 LOC). **Round-trip.** | LOW | MEDIUM — port BOSSNYUMBA's Louvain implementation. |
| **Hash-chain HMAC-SHA-256 audit with key rotation** | Hash-chain provenance + verifier shipped; no HMAC rotation. | BOSSNYUMBA ships `audit-hash-chain.ts:651` with HMAC + key rotation + `timingSafeEqual` + migration 0127. **Round-trip.** | MEDIUM | SMALL — port BOSSNYUMBA's HMAC layer. |
| **Tier-scaled k-anonymity (k=5→25 by tier)** | Single global k=5. | BOSSNYUMBA scales k by tier: borrower→officer→org→sovereign get k=5/10/15/25. **Round-trip.** | LOW | SMALL — port. |

---

## 5. Porting opportunities

### 5a. LITFIN → BOSSNYUMBA (what BOSSNYUMBA still lacks)

The 2026-05-18 status doc shows BOSSNYUMBA has closed most LITFIN gaps. The remaining **Phase E candidates** (open per `00-STATUS-2026-05-18.md` §4) are:

1. **Recursive HOT layer (per-thought introspection)** — LITFIN `src/core/brain/introspection/recursive-hot.ts` is wired at `brain-kernel.ts:2133-2168`. BOSSNYUMBA's `kernel/introspection/` is capability-card + trace-replay only. Port effort: MEDIUM. High leverage — regulator monitorability + bias detection.
2. **Autobiography append** — LITFIN `src/core/brain/autobiography.ts` wired at `brain-kernel.ts:2174-2202`. BOSSNYUMBA has no equivalent. Port effort: SMALL. Medium leverage — fills the "what did I do and why" narrative for regulators.
3. **Defection probe (behaviour-based)** — LITFIN `src/core/governance/probes/index.ts` wired at `brain-kernel.ts:2209-2269`. BOSSNYUMBA has no equivalent. Port effort: SMALL. **HIGHEST leverage** of the open Phase E items — sensor-agnostic text-in/text-out regulator audit signal.
4. **Activation probe (residual-stream; local-sensor only)** — LITFIN `src/core/governance/probes/activation/run-probe.ts` wired at `brain-kernel.ts:2277-2306`. BOSSNYUMBA has no equivalent. Port effort: MEDIUM (only fires for open-weight sensor). Medium leverage.
5. **Online declared-fact endpoint** — LITFIN supports `source='declared'` but no producer is wired. Same in BOSSNYUMBA. Port effort: SMALL.
6. **Mem0-style fact distillation polish** — LITFIN distill stage exists; needs pre-promote dedupe + LLM-as-judge promotion ceiling.
7. **Voyager-style skill registry materialisation** — BOSSNYUMBA `skill-registry.schema.ts` shipped but auto-promotion (procedural → skill) is not wired. LITFIN has `spawn-feature` but also not closed-loop.
8. **CoT → eval feedback loop** — distill captured CoT into Reflexion lessons; lessons render in next system prompt. Neither project closes this loop.
9. **Federated learning across tenants** — defer until 10+ tenants live.
10. **GEPA closed-loop optimisation** — both projects ship the scaffold; neither closes the optimiser.

Additionally, NEW gaps (not in 2026-05-18) BOSSNYUMBA should consider porting from LITFIN:

11. **SELF-DISCOVER structure block** (LITFIN `composition-orchestrator.ts` referenced at `brain-kernel.ts:777-797`) — per-task structure injection for high-stakes tasks. BOSSNYUMBA has no equivalent. Port: SMALL.
12. **Anthropic Memory Tool wire-format adapter** (LITFIN `src/core/brain/memory-tool-adapter.ts`) — managed-agents-2026-04-01 wire format. BOSSNYUMBA's memory hierarchy doesn't use the canonical Anthropic wire format. Port: MEDIUM.
13. **Imagination engine** (LITFIN `src/core/brain/imagination/`) — architectural primitive #2 "imagine the future given what I currently know". BOSSNYUMBA has no equivalent. Port: MEDIUM.
14. **Executive controller wake/sleep/throttle/disable verbs over a module registry** (LITFIN `src/core/brain/self-awareness-control/`) — architectural primitive #3 "aware of every part AND in control of every part". BOSSNYUMBA has no equivalent. Port: MEDIUM-LARGE.
15. **Hybrid vector→graph retriever** (LITFIN `src/core/brain/hybrid-retrieval.ts`) — Cognee + Microsoft GraphRAG pattern. BOSSNYUMBA has `temporal-entity-graph` but no Cognee-style hybrid retrieval. Port: MEDIUM.
16. **TZ shocks counterfactual library** (LITFIN `src/core/brain/counterfactual.ts` `TANZANIA_SHOCKS`) — pre-baked TZ economic shocks for stress testing. BOSSNYUMBA's stress testing has no shock library. Port: SMALL.
17. **Generative-UI block emitter with Bloom's taxonomy + Socratic layer** (LITFIN `src/core/litfin-ai/generative-ui/`) — BOSSNYUMBA has UI blocks but no teaching-methodology layer. Port: MEDIUM.
18. **MD sub-agent fan-out tools** (LITFIN `md-dispatch-subagent-team.ts` + `md-aggregate-subagent-results.ts`) — parallel sub-agent pattern. BOSSNYUMBA's subagent layer is shallower. Port: MEDIUM-LARGE.
19. **Compiled programs registry** (LITFIN `src/core/litfin-ai/compiled-programs/program-registry.ts`) — DSPy-style frozen prompt+model bundles. BOSSNYUMBA has no equivalent. Port: SMALL-MEDIUM.
20. **AlphaEvolve evolutionary improvement** (LITFIN `src/core/credit-mind/evolution/alpha-evolve.ts`) — DeepMind 2025 pattern. BOSSNYUMBA has no equivalent. Port: MEDIUM (domain-specific to scoring).

### 5b. BOSSNYUMBA → LITFIN (patterns LITFIN now lags on)

Per the `00-STATUS-2026-05-18.md` §3 list, BOSSNYUMBA AHEAD of LITFIN on 15 dimensions. Of those, the highest leverage to round-trip to LITFIN are:

1. **24-dimension persona-vector drift probe with reference vector + cron + admin UI** — LITFIN has the scaffold in `src/core/governance/persona-drift/` but BOSSNYUMBA has the operational pipeline wired (cron route + admin page + alert flow). LITFIN should adopt BOSSNYUMBA's `alert.ts:32-33` + `vectors.ts:28-53` wiring.
2. **Per-tenant `PersonaBrandingResolver` + migration `0150_persona_registry.sql`** — LITFIN is single-tenant; cannot support multi-agency white-labelling. **Highest commercial leverage** if LITFIN ever ships to multiple banks.
3. **AsyncLocalStorage-bound `TenantScoped<T>` generic** — LITFIN has `buildTenantFilter` helper but no type-level scope binding. Strong type-safety win.
4. **18-tool BrainToolSpec registry with typed `platform.*` action bus** (BOSSNYUMBA `kernel/tool-spec.ts:510`) — LITFIN's brain-side `BrainToolSpec` has 4 calculator-style tools. LITFIN should expand its brain-side tool registry.
5. **Persistent privacy-budget composer with atomic check-before-read** (BOSSNYUMBA `packages/database/.../privacy-budget-composer.service.ts:438` + migration `0116_platform_privacy_budget.sql`) — LITFIN's `computePrivacyBudget` is pure / non-persistent. ε,δ budget reserves leak across cohort calls in LITFIN.
6. **Tier-scaled k-anonymity (k=5→25 by tier)** (BOSSNYUMBA `kernel/cohort-signal.ts:75`) — LITFIN uses single global k=5; sovereign-tier reads should require higher k.
7. **Two-track inviolable gates** (BOSSNYUMBA `kernel/inviolable.ts:33-42` authed + `kernel/public-inviolable.ts:44-141` public) — LITFIN has single authed gate; needs the public-marketing-surface separator.
8. **Hash-chain HMAC-SHA-256 audit with key rotation + `timingSafeEqual`** (BOSSNYUMBA `packages/ai-copilot/.../audit-hash-chain.ts:651` + migration `0127`) — LITFIN's chain verifier has no HMAC rotation.
9. **DB-backed Drizzle services for sovereign-action ledger with `pg_advisory_lock`** (BOSSNYUMBA `packages/database/.../sovereign-action-ledger.service.ts:182+,399`) — LITFIN's ledger has no advisory-lock concurrency control.
10. **OpenTelemetry full stack with Wave-L coordinated bump to 0.218** (BOSSNYUMBA `packages/observability/` + sdk-node 0.218) — LITFIN's `brain-kernel.ts:1112` has OTel span wrap on `think()` but no other OTel deps. BOSSNYUMBA has 13 canonical kernel-step span names + bounded `AgentName` enum + per-agent Grafana dashboards. **High leverage** for production debugging.
11. **Temporal Entity Graph + Louvain community detection** (BOSSNYUMBA `packages/database/.../temporal-entity-graph.{service,louvain}.ts`, 922 LOC) — LITFIN's KG has bi-temporal indexes but no community algorithm in-tree.
12. **MCP server full handler set** (BOSSNYUMBA `packages/mcp-server/`) — LITFIN has scaffolds; BOSSNYUMBA has full handler set + tier-router + cost-persistence + universal-tool-adapter.
13. **Reflexion writer/retriever as separate modules with decayed re-rank** (BOSSNYUMBA `kernel/reflexion/reflexion-writer.ts` + `reflexion-retriever.ts`) — LITFIN has the loop wired inside brain-kernel; BOSSNYUMBA's separation is cleaner.

---

## 6. Top 10 concrete actions (prioritized)

The actions are ordered by `(leverage / port_effort)` ratio. Each links to file paths to start work.

### Action 1 — Adopt Claude Agent SDK as the foundation

**Why.** LITFIN built every subagent / skill / hook pattern from scratch in 2025. Anthropic shipped the official SDK in 2026-Q1 with `subagents-as-system-prompts`, `.claude/agents/*.md` skill format, and `hooks.json` event contract. Migrating compresses 5,000+ lines into ~200 and unlocks the community ecosystem.

**Files to touch.**
- New: `src/core/agent-sdk/` directory.
- Migrate: `src/core/litfin-ai/skills/skill-registry.ts` → SDK-native skill loading.
- Migrate: `src/core/litfin-ai/orchestration/multi-agent.ts` → SDK subagent dispatcher.
- Migrate: `src/core/litfin-ai/actions/tools/md-hook-rule-*.ts` → SDK hooks.json.
- Preserve: LITFIN_PERSONA + identity + constitution + persona-drift as the SDK base.

**Effort.** LARGE (3–6 weeks).
**Risk.** SDK is opinionated about session shape; reconcile with LITFIN's existing decision-trace + provenance.

### Action 2 — Wire defection probe + recursive HOT + autobiography into BOSSNYUMBA

**Why.** These three Phase E candidates close the regulator-monitorability gap and BOSSNYUMBA needs them to match LITFIN's `brain-kernel.ts:2133-2202` + `brain-kernel.ts:2209-2269` post-think cluster. Defection probe is sensor-agnostic and ships text-in/text-out — fastest to port.

**Files to touch (BOSSNYUMBA).**
- New: `packages/central-intelligence/src/kernel/governance/defection-probe.ts` — port `src/core/governance/probes/index.ts`.
- New: `packages/central-intelligence/src/kernel/introspection/recursive-hot.ts` — port `src/core/brain/introspection/recursive-hot.ts`.
- New: `packages/central-intelligence/src/kernel/autobiography.ts` — port `src/core/brain/autobiography.ts`.
- Wire: `packages/central-intelligence/src/kernel/kernel.ts` post-think block (steps 13a-13d).
- Migration: `0151_autobiography.sql`, `0152_defection_probe_scores.sql`.

**Effort.** MEDIUM (2 weeks).
**Risk.** None — these are observation-grade and never block.

### Action 3 — Port BOSSNYUMBA's 24-dim persona-vector probe operational pipeline back to LITFIN

**Why.** LITFIN has the scaffold; BOSSNYUMBA has the cron + admin UI + alert flow. Round-trip closes a regulator-pack gap for LITFIN.

**Files to touch (LITFIN).**
- Update: `src/core/governance/persona-drift/vectors.ts` (already shipped) + `alert.ts` — adopt BOSSNYUMBA's `alert.ts:32-33` wiring.
- Already exists in LITFIN: `app/api/cron/persona-drift/route.ts` — verify wiring matches BOSSNYUMBA's pipeline.
- Already exists: `app/(litfin-admin)/litfin-admin/persona-drift/page.tsx`.

**Effort.** SMALL (3 days).
**Risk.** None — operational hardening.

### Action 4 — Switch `maybeRunTool` to parallel tool use

**Why.** Anthropic 2026-Q1 supports multiple `tool_use` blocks in one assistant turn, executed concurrently. LITFIN parses ONE block at `brain-kernel.ts:838-892` and does a sequential follow-up. For multi-tool workflows (e.g. `query-data` + `query-graph` + `query-analytics`) this is a 3× latency win.

**Files to touch.**
- Rewrite: `src/core/brain/brain-kernel.ts:818-892` (`maybeRunTool`).
- Rewrite: `src/core/brain/tool-loop.ts` to align with the new shape.
- Rewrite: `src/core/brain/stream-tool-loop.ts` likewise.
- Update: `src/core/brain/normalizer.ts` to extract `tool_use[]` array.

**Effort.** SMALL (1 week).
**Risk.** Tool side-effects need to be commutative or the parallel order must respect declared dependencies — currently LITFIN's tools are mostly read-only so this is low-risk.

### Action 5 — Promote hooks from rule-driven to event-driven first-class API

**Why.** Today `md-hook-rule-write` is a rule (LLM writes a rule that fires later). Claude Agent SDK's `hooks.json` is an event API (third parties register a function on `PreToolUse|PostToolUse|Stop|UserPromptSubmit|SessionStart`). Event API is more composable and unlocks third-party extensions.

**Files to touch.**
- New: `src/core/brain/hooks/registry.ts` — `registerHook(event, fn)`, `runHooks(event, ctx)`.
- New: `src/core/brain/hooks/types.ts` — event types.
- Wire: `src/core/brain/kernel-pre-think.ts` + `src/core/brain/kernel-post-think.ts` to call `runHooks()`.
- Wire: `src/core/litfin-ai/actions/action-executor.ts` to fire `PreToolUse`/`PostToolUse`.
- Deprecate (but keep): `src/core/litfin-ai/actions/tools/md-hook-*.ts` as rule-layer over event API.

**Effort.** MEDIUM (1.5 weeks).
**Risk.** None — additive.

### Action 6 — Close GEPA optimisation loop

**Why.** Scaffold is shipped (`src/core/brain/prompt-evolution.ts` + `src/core/litfin-ai/prompt-evolution/gepa-evolver.ts`). The optimiser loop (mutation → eval → Pareto-prune → auto-promote) is observational. Closing the loop turns LITFIN into a self-improving prompt system.

**Files to touch.**
- Update: `src/core/litfin-ai/prompt-evolution/gepa-evolver.ts` — add `mutateCandidate` + `evalCandidate` (against the existing eval harness) + `promoteOnPareto`.
- New: cron at `src/app/api/cron/gepa-optimise/route.ts` — runs mutation + eval every N hours.
- New: champion-challenger gate similar to `src/core/credit-mind/governance/champion-challenger.ts` but for prompts.
- Migration: `0160_prompt_candidates.sql` (if not already shipped).

**Effort.** MEDIUM (2-3 weeks).
**Risk.** Costly LLM eval — gate behind `LITFIN_GEPA_ENABLED=1` env flag.

### Action 7 — Port BOSSNYUMBA's OTel full stack to LITFIN

**Why.** LITFIN has OTel span wrap on `think()` at `brain-kernel.ts:1112` but no other deps. BOSSNYUMBA has OTel 0.218 + 13 canonical span names + per-agent Grafana panels. Without this LITFIN production debugging is grep-on-Supabase only.

**Files to touch (LITFIN).**
- New: `packages/observability/` directory mirroring BOSSNYUMBA's.
- Update: `src/lib/observability/otel.ts` — adopt BOSSNYUMBA's span name canon.
- New: `monitoring/grafana-dashboards/litfin-*.json` — adapt BOSSNYUMBA's dashboards.
- Update: `src/core/brain/kernel-pre-think.ts` + `src/core/brain/kernel-post-think.ts` — add OTel spans on each step.

**Effort.** MEDIUM (2 weeks).
**Risk.** OTel 0.218 has breaking changes; coordinate with `package.json` updates.

### Action 8 — Add deliberative-alignment safety CoT

**Why.** Constitution clauses are injected (LITFIN `brain-kernel.ts:544-555`) but the CoT isn't structured around safety reasoning. OpenAI o1 / Apollo 2025 pattern: explicit `<safety_reasoning>` before answer, which the policy gate can audit.

**Files to touch.**
- Update: `src/core/governance/constitution.ts` — add safety-CoT preamble.
- Update: `src/core/brain/normalizer.ts` — strip `<safety_reasoning>` from final answer; record in trace.
- Update: `src/core/brain/cot-monitorability.ts` — score the safety reasoning specifically.

**Effort.** SMALL (3 days).
**Risk.** Low.

### Action 9 — Migrate `orchestration/multi-agent.ts` to durable state

**Why.** Current `Map<string, SubAgent>` + `setTimeout(cleanup, 5min)` = restart loses state, no checkpoint, no resume, no time-travel debug. Frontier 2026 agents are durable (LangGraph 1.0 / Letta v2 / Temporal).

**Files to touch.**
- Migration: `0161_sub_agents.sql` — table for sub-agent state.
- Rewrite: `src/core/litfin-ai/orchestration/multi-agent.ts` — Postgres-backed store; emit decision-trace rows for every state transition.
- New: `src/core/litfin-ai/orchestration/resume.ts` — `resumeSubAgent(id)`.
- New: `src/core/litfin-ai/orchestration/checkpoint.ts` — snapshot + restore.

**Effort.** LARGE (3-4 weeks).
**Risk.** Existing 71 tools assume in-memory state; need migration tests.

### Action 10 — Always-on sleep-time agent loop (Letta v2 pattern)

**Why.** Damasio protoself, autobiography, consolidation are event-driven. A 2026 frontier brain runs continuous off-line consolidation + delayed reflection independent of user turns. This is what unlocks "I noticed something interesting after our last conversation."

**Files to touch.**
- New: `src/app/api/cron/sleep-pass/route.ts` — runs every 5 min when chat is idle.
- New: `src/core/brain/sleep-pass/` directory.
  - `consolidation-loop.ts` — re-runs `consolidation.ts` over recent autobiography entries.
  - `dream.ts` — runs `imagination/` over the recent cohort signals.
  - `delayed-reflection.ts` — re-evaluates yesterday's low-confidence answers with today's lessons.
- Wire: outbox emits a `sleep_pass_finding` thought when a sleep-pass surfaces a useful pattern.

**Effort.** MEDIUM (2 weeks).
**Risk.** Cost — budget the sleep-pass cron carefully.

---

## Appendix A — Files cited (absolute paths)

### LITFIN

- `/Users/georgesmackbookair/Desktop/CLAUDE_CURSOR_CODEX PROJECTS/Claude Projects/LITFIN PROJECT/src/core/brain/brain-kernel.ts` (2,352 lines)
- `/Users/georgesmackbookair/Desktop/CLAUDE_CURSOR_CODEX PROJECTS/Claude Projects/LITFIN PROJECT/src/core/brain/index.ts` (813 lines)
- `/Users/georgesmackbookair/Desktop/CLAUDE_CURSOR_CODEX PROJECTS/Claude Projects/LITFIN PROJECT/src/core/brain/persona.ts` (191 lines)
- `/Users/georgesmackbookair/Desktop/CLAUDE_CURSOR_CODEX PROJECTS/Claude Projects/LITFIN PROJECT/src/core/brain/identity.ts` (309 lines)
- `/Users/georgesmackbookair/Desktop/CLAUDE_CURSOR_CODEX PROJECTS/Claude Projects/LITFIN PROJECT/src/core/brain/self-awareness.ts` (391 lines)
- `/Users/georgesmackbookair/Desktop/CLAUDE_CURSOR_CODEX PROJECTS/Claude Projects/LITFIN PROJECT/src/core/brain/debate.ts` (296 lines)
- `/Users/georgesmackbookair/Desktop/CLAUDE_CURSOR_CODEX PROJECTS/Claude Projects/LITFIN PROJECT/src/core/brain/judge-panel.ts` (748 lines)
- `/Users/georgesmackbookair/Desktop/CLAUDE_CURSOR_CODEX PROJECTS/Claude Projects/LITFIN PROJECT/src/core/brain/tree-search.ts`
- `/Users/georgesmackbookair/Desktop/CLAUDE_CURSOR_CODEX PROJECTS/Claude Projects/LITFIN PROJECT/src/core/brain/reasoning-router.ts`
- `/Users/georgesmackbookair/Desktop/CLAUDE_CURSOR_CODEX PROJECTS/Claude Projects/LITFIN PROJECT/src/core/brain/ttc-allocator.ts`
- `/Users/georgesmackbookair/Desktop/CLAUDE_CURSOR_CODEX PROJECTS/Claude Projects/LITFIN PROJECT/src/core/brain/self-awareness-control/index.ts`
- `/Users/georgesmackbookair/Desktop/CLAUDE_CURSOR_CODEX PROJECTS/Claude Projects/LITFIN PROJECT/src/core/brain/sensor-routing/router.ts` (466 lines)
- `/Users/georgesmackbookair/Desktop/CLAUDE_CURSOR_CODEX PROJECTS/Claude Projects/LITFIN PROJECT/src/core/brain/failover.ts` (151 lines)
- `/Users/georgesmackbookair/Desktop/CLAUDE_CURSOR_CODEX PROJECTS/Claude Projects/LITFIN PROJECT/src/core/brain/normalizer.ts` (251 lines)
- `/Users/georgesmackbookair/Desktop/CLAUDE_CURSOR_CODEX PROJECTS/Claude Projects/LITFIN PROJECT/src/core/brain/five-c-continuous.ts` (404 lines)
- `/Users/georgesmackbookair/Desktop/CLAUDE_CURSOR_CODEX PROJECTS/Claude Projects/LITFIN PROJECT/src/core/litfin-ai/orchestration/multi-agent.ts` (339 lines)
- `/Users/georgesmackbookair/Desktop/CLAUDE_CURSOR_CODEX PROJECTS/Claude Projects/LITFIN PROJECT/src/core/litfin-ai/skills/skill-registry.ts` (304 lines)
- `/Users/georgesmackbookair/Desktop/CLAUDE_CURSOR_CODEX PROJECTS/Claude Projects/LITFIN PROJECT/src/core/litfin-ai/actions/tool-registry.ts` (80+ tools)
- `/Users/georgesmackbookair/Desktop/CLAUDE_CURSOR_CODEX PROJECTS/Claude Projects/LITFIN PROJECT/src/core/litfin-ai/prompt-evolution/gepa-evolver.ts`
- `/Users/georgesmackbookair/Desktop/CLAUDE_CURSOR_CODEX PROJECTS/Claude Projects/LITFIN PROJECT/src/core/agent-platform/registry/hardened-registry.ts`
- `/Users/georgesmackbookair/Desktop/CLAUDE_CURSOR_CODEX PROJECTS/Claude Projects/LITFIN PROJECT/src/core/credit-mind/master-officer/interview-engine.ts`
- `/Users/georgesmackbookair/Desktop/CLAUDE_CURSOR_CODEX PROJECTS/Claude Projects/LITFIN PROJECT/src/core/credit-mind/evolution/alpha-evolve.ts`
- `/Users/georgesmackbookair/Desktop/CLAUDE_CURSOR_CODEX PROJECTS/Claude Projects/LITFIN PROJECT/Docs/CODEMAPS/*.md` (26 codemaps)

### BOSSNYUMBA

- `/Users/georgesmackbookair/Desktop/CLAUDE_CURSOR_CODEX PROJECTS/Cursor Projects/BOSSNYUMBA101/.planning/parity-litfin/00-STATUS-2026-05-18.md`
- `/Users/georgesmackbookair/Desktop/CLAUDE_CURSOR_CODEX PROJECTS/Cursor Projects/BOSSNYUMBA101/.planning/parity-litfin/01-kernel-pipeline.md`
- `/Users/georgesmackbookair/Desktop/CLAUDE_CURSOR_CODEX PROJECTS/Cursor Projects/BOSSNYUMBA101/.planning/parity-litfin/03-identity-self.md`
- `/Users/georgesmackbookair/Desktop/CLAUDE_CURSOR_CODEX PROJECTS/Cursor Projects/BOSSNYUMBA101/.planning/parity-litfin/04-sensors-routing.md`
- `/Users/georgesmackbookair/Desktop/CLAUDE_CURSOR_CODEX PROJECTS/Cursor Projects/BOSSNYUMBA101/packages/central-intelligence/src/kernel/*.ts` (60+ kernel files)

---

*End of brain-core deep map. Report date: 2026-05-23. Next sibling reports: 02-memory-learning, 03-perception-channels, 04-actions-tools, 05-governance-safety, 06-eval-runtime.*
