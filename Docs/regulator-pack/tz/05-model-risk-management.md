# 05 — Model Risk Management (Tanzania)

**Document version:** 1.0
**Date:** 2026-05-22
**Owner:** Model Risk Manager (reports to CRO)
**Jurisdiction:** Tanzania (mapping reused for KE pack)
**Frameworks:**
- US Federal Reserve / OCC Supervisory Letter SR 11-7, "Guidance on Model Risk Management" (2011, reaffirmed in OCC 2011-12)
- ISO/IEC 23894:2023 — AI risk management
- NIST AI Risk Management Framework 1.0 (AI RMF)
- EU AI Act (Reg. 2024/1689) — used as forward-looking reference even where not yet binding
- BoT Risk Management Guidelines, 2010 — model risk treated as sub-category of operational risk

> **SR 11-7 source:** `https://www.federalreserve.gov/supervisionreg/srletters/sr1107.htm`. SR 11-7 defines a "model" as "a quantitative method, system, or approach that applies statistical, economic, financial, or mathematical theories, techniques, and assumptions" to produce decision-relevant outputs. BossNyumba treats this definition expansively to include rule-based decision systems and LLM-driven assistants that influence customer outcomes.

---

## 1. SR 11-7 — section-by-section mapping

SR 11-7 sets out three core areas: (A) model development, implementation and use; (B) model validation; (C) governance, policies and controls.

### A. Model development, implementation and use

| SR 11-7 expectation | BossNyumba control |
|---|---|
| Sound design with documented purpose, conceptual basis, choice of methodology | Every registered model has a model card (`Docs/regulator-pack/tz/model-cards/*.md`) covering identification, intended use, training data, methodology |
| Robust data including data integrity, lineage, transformations | Training-dataset hash recorded in model card; features documented with source and direction |
| Testing prior to use — back-testing, sensitivity analysis, out-of-sample testing | Pre-deploy gate: held-out evaluation set + adversarial corpus (doc 09 model-card on online-judge) |
| Pilot / shadow before production | New scoring / pricing models run as **challenger** alongside production **champion** for ≥ 30 days |
| Implementation: code review, version control, change management | All model code reviewed via PR; signed commits; model registry stores immutable version pointers |
| Use: communicate strengths/limitations to users, training | Model card §Limitations shown to property managers via tooltip in the workbench; mandatory annual training |

### B. Model validation

| SR 11-7 expectation | BossNyumba control |
|---|---|
| Independence of validation from development | Model Risk Manager reports to CRO; not part of model-development team |
| Conceptual soundness | Validation report covers methodology, feature selection rationale, alternatives considered |
| Ongoing monitoring — performance, drift, stability | Live monitoring job emits `model_metric_event` daily; eval-on-traffic online judge (P-9, model card in this folder) flags regressions |
| Outcomes analysis | Quarterly back-test where ground truth is available |
| Effective challenge | Quarterly Model Risk Committee reviews exception logs, override patterns, challenger performance |

### C. Governance, policies, and controls

| SR 11-7 expectation | BossNyumba control |
|---|---|
| Board / senior-management approval of policy | This document approved by CRO; ratified by board annually |
| Roles and responsibilities | RACI: Developer (R), Validator (R), Model Risk Manager (A), CRO (A on production), Property-mgr (C), DPO (C on PII features) |
| Model inventory | `model_registry` table; one row per registered model with version, status, approver chain |
| Lifecycle (request → develop → validate → approve → deploy → monitor → retire) | Documented as state machine |
| Documentation | Model cards generated per version; archived 10 years |

## 2. Model inventory (current snapshot)

| Model ID | Family | Purpose | Status | Stake | Owner |
|---|---|---|---|---|---|
| `voice-agent-mrmwikila-v1` | LLM / agent | Tenant-facing voice assistant; routes intents to tools | Production | Medium-high | Voice team |
| `monthly-close-orchestrator-v1` | LLM / agent | Owner monthly-close run orchestration | Production | Medium | Finance team |
| `market-rate-surveillance-v1` | rules + LLM | Detect off-market rent (under / over) per neighbourhood | Production | Medium | Intelligence team |
| `predictive-interventions-v1` | ML | Predict tenant payment-arrears risk; surface opportunities | Production | **High** (touches credit-like outputs) | Intelligence team |
| `adaptive-layout-engine-v1` | rules + LLM | Rearrange UI based on tenant behaviour (UI-1) | Production | Low | UX team |
| `three-agent-debate-v1` | LLM ensemble | Multi-agent debate at stakes ≥ high (P-10) | Production | High (gates high-stakes decisions) | Brain team |
| `online-judge-v1` | LLM | Eval-on-traffic + adversarial corpus (P-9) | Production | Medium (meta — gates other models) | Eval team |
| `pii-scrubber-v1` | rules + classifier | Strip PII from LLM inputs | Production | High (privacy guarantee) | Security team |
| `tree-of-thoughts-planner-v1` | LLM | Search-based planning for multi-step tasks (P-6) | Production | Medium-high | Brain team |
| `mmr-memory-retriever-v1` | embeddings + rerank | Smart memory retrieval (P-7) | Production | Medium | Brain team |

Model cards for each live model live in `Docs/regulator-pack/tz/model-cards/<model-id>-v<version>.md`. Three cards are scaffolded in this pack (UI-1, P-10, P-9); the remainder are TODO.

## 3. Model lifecycle

```
   ┌────────┐     ┌─────────┐     ┌──────────┐     ┌──────────┐     ┌─────────┐     ┌──────────┐     ┌─────────┐
   │ Intake │ ──→ │ Develop │ ──→ │ Validate │ ──→ │ Approve  │ ──→ │ Deploy  │ ──→ │ Monitor  │ ──→ │ Retire  │
   └────────┘     └─────────┘     └──────────┘     └──────────┘     └─────────┘     └──────────┘     └─────────┘
       │              │                │                 │                │                │                 │
       └──────────────┴────────────────┴─────────────────┴────────────────┴────────────────┴─────────────────┘
                                              audit log (doc 10)
```

| Stage | Gate | Sign-off |
|---|---|---|
| Intake | Business case + DPIA pre-screen | Product owner |
| Develop | Code review + unit tests | Eng lead |
| Validate | Held-out eval + adversarial + fairness slice (doc 06) | Model Risk Manager |
| Approve | Pre-deploy review + DPIA (if PII) | CRO + DPO (if PII) |
| Deploy | Canary / shadow → 100% | Eng on-call |
| Monitor | Drift + fairness + cost dashboards | Model Risk Manager |
| Retire | Decommission + archive | Model Risk Manager |

## 4. AI-specific risks

| Risk | Mitigation |
|---|---|
| Hallucination (voice agent inventing facts) | Grounding to property + lease database; refuse-if-uncertain prompt; eval-on-traffic online judge |
| Prompt injection (tenant attempts to escalate) | Layered system prompt + intent verifier + tool ACLs (kernel safety layer) |
| Drift (model performance decays as user behaviour shifts) | Daily drift detection job; rollback to last-known-good champion on > 5% regression |
| Bias (e.g., dispatch slower in low-income neighbourhoods) | Quarterly fairness audit (doc 06); slice-level monitoring |
| Cost runaway (LLM bill spike) | Per-tenant budget caps; Haiku-first cascade (P-8); circuit breaker on cost-per-session |
| Insecure tool invocation (agent triggers refund / eviction) | Kill-switches per route; four-eyes on irreversible actions; agent policy engine deny-by-default |

## 5. Cross-references

- Adversarial corpus + online-judge: see `model-cards/online-judge-v1.md`
- Multi-agent debate at high stakes: see `model-cards/three-agent-debate-v1.md`
- Adaptive layout engine: see `model-cards/adaptive-layout-engine-v1.md`

> TODO: insert most recent Model Risk Committee minutes + champion / challenger snapshot.
