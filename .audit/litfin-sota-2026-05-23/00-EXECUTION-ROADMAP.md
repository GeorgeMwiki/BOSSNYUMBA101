# BOSSNYUMBA SOTA Execution Roadmap — 2026-05-23

Consolidated from 20 parallel research reports (`01-*` … `20-*` in this folder).
Action-oriented: every line is a buildable artifact, not a discussion.

## What we are
A **vertical AI Operating System for property management** in East Africa, with:
- closed-loop intelligence layer over every workflow,
- company-brain primitive ingesting Slack/WhatsApp/M-Pesa/email/calls,
- multi-LLM synthesis (Anthropic + OpenAI + DeepSeek) for deep reasoning,
- dynamic per-user UIs per persona,
- spatial parcel/building/unit engine (Muzima),
- multi-modal content studio (Veo 3.1 + Flux + ElevenLabs),
- scientific discovery + causal AI Discovery Tab,
- outcome-as-a-service pricing (ticket-resolved, rent-collected, vacancy-filled).

## Anchor truths from research (May 2026)
- MCP 2025-06-18 won; A2A protocol has 150+ orgs. Pick protocols, not frameworks.
- Skills + subagents + hooks is the new agent unit (Anthropic, OpenAI, Google).
- Reasoning + interleaved tool use is default; plan-then-act is dead.
- Memory is temporal + graphed (Mem0 / Zep-Graphiti / Letta sleep-time).
- BOSSNYUMBA already AHEAD of LITFIN on 15 dimensions (Self-RAG enforcer, persona-drift, AsyncLocalStorage, hash-chain HMAC, temporal-entity-graph with Louvain, OTel 0.218). Reverse-port is overdue.
- BOSSNYUMBA already has MORE closed-loop primitives than Decagon/Sierra/Glean public architectures. Gap is synthesis + naming.
- EU AI Act high-risk delayed to 2027 (provisional). Colorado SB 24-205 repealed. CA SB 942 delayed to Aug 2, 2026.

## Execution waves (parallelizable within each wave)

### Wave 1 — Quick wins (0.5–1 day each)
1. `cache_control` markers on persona system prompts → 40–90% cost cut (`packages/ai-copilot/src/providers/anthropic.ts` + persona files)
2. Port LITFIN `mem0-semantics.ts` (382 LOC pure) → `services/consolidation-worker/src/stages/04-promote.ts`
3. Port LITFIN `hallucination-guard.ts` → `packages/ai-copilot/src/eval/hallucination-guard.ts`
4. Port LITFIN `judge-panel.ts` 5-rubric jury → `packages/ai-copilot/src/eval/judge-panel.ts`
5. `litfin-backup-restore-test.yml` → `.github/workflows/backup-restore-drill.yml`
6. ✅ TRC test org seed (DONE)
7. ✅ Multi-LLM fan-out synthesizer (DONE)

### Wave 2 — Core foundations (1–3 days each)
8. PortalLayout schema + 5 persona seeds + `<PortalShell>` component (`packages/genui`, `packages/design-system`)
9. Constitution v1 + citation verifier (`packages/autonomy-governance/src/constitution/`)
10. V8 isolate sandbox via `isolated-vm` (`packages/ai-copilot/src/sandbox/`)
11. Defection + alignment-faking probes + auto-killswitch (`packages/autonomy-governance/src/probes/`)
12. Brand+system Skills (`SKILL.md` adoption) for Carbone + ExcelJS + ECharts → `services/reports/skills/`
13. WhatsApp ingress + brain-event fan-out → existing `services/notifications/src/whatsapp/webhook-router.ts`
14. M-Pesa Daraja 3.0 connector → `packages/connectors/src/adapters/mpesa.ts`
15. Anthropic Citations API span verification → `packages/ai-copilot/src/citations/`

### Wave 3 — Major net-new packages (3–7 days each)
16. `packages/content-studio` (Veo 3.1 + Flux 1.2 + Nano Banana + ElevenLabs v3 + brand LoRA + C2PA)
17. `packages/spatial-engine` + `services/parcel-service` (MapLibre v5 + PMTiles + Martin + PostGIS + SAM 2.1)
18. `packages/scientific-discovery` (CausalFusion DAG + Co-Scientist 6-agent debate + PCMCIplus time-series + 25-hypothesis seed library)
19. `services/onboarding-orchestrator` (12-turn MD discovery + Mastra crew + WhatsApp ingress + Lelapa Vulavula STT)
20. `services/brain-evolution-worker` (sleep-time consolidator extending `services/domain-services/src/intelligence/intelligence-history-worker.ts`)
21. `packages/document-studio` (Carbone + Typst + Anthropic Skills + Dropbox Sign + WORM audit)

### Wave 4 — Supervisor / orchestration upgrades
22. Hierarchical dept-supervisor agents (`packages/central-intelligence/src/kernel/supervisor/`)
23. Versioned AOP registry + canary controller wire (`packages/central-intelligence/src/agent/aops/` ↔ `packages/autonomy-governance/src/slo/canary-controller.ts`)
24. Operator-tool MCP_SAFE allowlist + tier-policy guard for queued tools (`packages/mcp-server/`)
25. Plan-and-Execute over ReAct (92% completion, 3.6× speedup)

### Wave 5 — Closed-loop + outcome economics
26. Outcome catalog + metering + escalation infra (ticket-resolved / rent-collected / vacancy-filled)
27. Confidence-band routing (>0.95 auto / 0.70–0.95 audit / <0.70 escalate) — packages/autonomy-governance
28. Shadow-mode-then-convert gates (≥85% agreement, ≥5K decisions, zero criticals)
29. AI failure-mode insurance integration scaffolding (Armilla / Munich Re aiSure)

### Wave 6 — Ops / supply chain / compliance
30. AI BOM + Sigstore + SLSA L3 for model artifacts (EU AI Act GPAI Code of Practice)
31. NetworkPolicy blocking 169.254.169.254 (Capital-One IMDS-SSRF defense)
32. security-route-coverage CI gate (≥90% mutation routes wrap auth+events)
33. ESO 3-backend stack (gcp/aws/kubeseal) + seed-secrets.sh
34. Prometheus alert pack + 10 runbooks with runbook-URL-in-every-alert

## How to dispatch
Wave 1 and 2 items are independent. Dispatch as parallel build agents.
Wave 3 items are larger; can run in parallel but each has 3–10 files.
Wave 4 + 5 depend on some wave 2 outputs (Constitution, probes).
Wave 6 is cross-cutting; can run any time after wave 2.

## Already-done in this session
- `packages/database/src/seeds/trc-test-org-seed.ts` — TRC tenant + 5 users
- `packages/ai-copilot/src/providers/multi-llm-synthesizer.ts` — fan-out synthesis
- `packages/ai-copilot/src/providers/__tests__/multi-llm-synthesizer.test.ts` — 9 tests, all pass
