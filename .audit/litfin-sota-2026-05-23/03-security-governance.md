# LITFIN ↔ SOTA 2026 — Security DNA · Identity · Autonomy Governance · Data Protection

**Audit date:** 2026-05-23
**Mode:** Read-only, file:line citations. Brutally honest.
**Scope:** What LITFIN ships today, mapped against OWASP LLM Top 10 (2025), OWASP Agentic Top 10 (2026), NIST AI RMF 2.0 + GenAI Profile, ISO/IEC 42001, EU AI Act (Aug 2026 enforcement), MITRE ATLAS, Anthropic Constitutional AI v2 + Sleeper-Agents (Hubinger 2024), OpenAI Deliberative Alignment, Sigstore/SLSA L3, confidential compute, differential privacy, federated learning.
**Companion docs:** `BOSSNYUMBA101/.planning/parity-litfin/03-identity-self.md`, `05-security-dna.md`, `06-data-protection.md` (2026-05-18) form the baseline; this audit goes deeper and frames vs 2026 frontier.

---

## 0. Executive summary (read first)

LITFIN's security DNA is **wider** than any other thread we have audited in this codebase. The footprint:
- 11 modules in `src/core/litfin-ai/security/` (~3,267 LOC)
- 22 modules in `src/lib/security/` (~5,131 LOC — IR + edge + presidio + dp)
- 9 modules in `src/core/security/` (~4,137 LOC — sandbox + intent-verifier + ocsf + policy engine)
- 43 modules in `src/core/governance/` across 13 subdirs (~7,956 LOC — constitution + tier-policy + four-eye + persona-drift + probes + monitoring + decisions + erasure + hooks + audit + rate-limit + data-protection + model-registry)
- 7 red-team attack files (71 attack scenarios + 1 promptfoo config, ~2,712 LOC)
- 2 dedicated probes (sleeper-agent defection + alignment-faking)
- 14 model cards in `Docs/model-cards/`
- 5 compliance maps in `Docs/compliance/tanzania/` (BoT Cyber, DPIA, PDPA, residency, INDEX)
- 1 DPIA (voice biometric 2FA)
- 4 YAML policy files in `src/core/security/policies/` (borrower / officer / admin / default)
- Constitution v1 with 12 frozen clauses + citation verifier (`src/core/governance/constitution/litfin-constitution.ts`)
- Three-level killswitch (HALT / PAUSE / THROTTLE) with cross-instance refresh
- Hash-chain audit with HMAC + rotation + HKDF + streaming verify + tail verify + random-sample cron

**Verdict.** LITFIN is **materially stronger** on the autonomy-governance + constitutional-AI + persona-drift + alignment-faking axes than any other module in the wider BOSSNYUMBA repo. But against the 2026 frontier reference stack it has **eight critical structural gaps** that the BOSSNYUMBA codebase needs to close BEFORE Aug-2026 EU AI Act enforcement of the General Purpose AI Code of Practice. The most damning: **no AI BOM / Sigstore / SLSA attestation on model artifacts**, **no confidential-compute path**, **no who-is-acting agent attestation (OBO / capability tokens)**, **no indirect-prompt-injection defence on tool outputs**, and **no MITRE ATLAS adversarial-emulation harness**.

---

## 1. Inventory — what LITFIN actually ships

### 1.1 Security modules

| Concern | LITFIN file | Lines | Notes |
|---|---|---|---|
| Constitution (12 frozen clauses + citation verifier) | `src/core/governance/constitution/litfin-constitution.ts` | 249 | Constitutional-AI v3 + OpenAI Deliberative Alignment pattern |
| Tier policy (4 tiers, 13 sovereign actions, reason-based resolver) | `src/core/governance/tier-policy/policies.ts:1-1244` + `types.ts:1-349` + `assertions.ts:1-389` + `reason-based-resolver.ts:1-347` | ~2,529 | Borrower / Officer / Org-admin / Internal-admin + sovereign claim type |
| Four-eye approval (governance) | `src/core/governance/four-eye/types.ts:1-105` + `approval-queue.ts` + `policy.ts` + `notification.ts` | — | 13 declared `ApprovalActionType` values |
| Destructive action engine | `src/core/approval/destructive-action-engine.ts` + `destructive-action-types.ts:1-111` | — | 7 destructive types, per-action `requiredApprovals` + `requiredRoles` + `expiryHours` + `reAuthVerified: boolean` |
| Approval gate (sovereign brain) | `src/core/sovereign-brain/actions/approval-gate.ts:1-228` | 228 | Lazy plan-artifact emission (`proposePlan` for tier: 'sovereign') |
| Killswitch (3-level) | `src/core/brain/killswitch.ts:1-284` | 284 | HALT / PAUSE / THROTTLE; cross-instance refresh; channel-aware (`sovereign \| autonomous \| chat \| voice \| inbox`) |
| Killswitch admin action | `src/core/sovereign-brain/actions/set-killswitch-level.ts:1-161` | 161 | |
| Killswitch DB ledger | `supabase/migrations/20260513_brain_killswitch.sql`, `20260514_brain_killswitch.sql` | — | Append-only ledger; in-memory state hydrated at boot |
| Pilot kill-switch (separate, broader) | `src/core/pilot/kill-switch.ts` | — | Pilot rollout safety |
| Inviolable refusal gate | `src/core/brain/inviolable.ts:1-391` | 391 | 5 categories: `ip_internal`, `ip_secret`, `ip_copyright`, `privacy_cross_tenant`, `pii_redaction`; bilingual (en/sw) refusals at L311-335 |
| Policy gate (output post-process) | `src/core/brain/policy-gate.ts:1-318` | 318 | 7 checks: inviolable / PII / lang-consistency / numerical-sanity / grounding / fabrication / regulatory hedges |
| Prompt shield (input) | `src/core/litfin-ai/security/prompt-shield.ts:1-610` | 610 | ~45 patterns across 8 categories |
| PII scrubber (TZ + KE + intl) | `src/core/litfin-ai/security/pii-scrubber.ts:1-357` | 357 | 11 `PiiType`s incl. `date_of_birth`; bilingual context-aware |
| PII scrubber alt (lib) | `src/lib/security/pii-scrubber.ts:1-177` | 177 | Different shape, edge-callable |
| Presidio egress scrubber | `src/lib/security/presidio-egress-scrubber.ts:1-399` | 399 | Defence-in-depth post-egress; 10 entity types (PERSON, LOCATION, ORG, IBAN, CARD, PHONE, EMAIL, DATE, URL, IP) |
| Document PII redactor | `src/lib/security/document-pii-redactor.ts` | 230 | |
| Field-level encryption (AES-256-GCM) | `src/lib/security/field-encryption.ts:1-272` | 272 | HKDF per-field key derivation + dual-key rotation (`ENCRYPTION_MASTER_KEY` + `ENCRYPTION_MASTER_KEY_PREVIOUS`) |
| Field classification registry | `src/lib/security/data-classification.ts:1-570` | 570 | RESTRICTED / CONFIDENTIAL / INTERNAL / PUBLIC × encrypt + maskType |
| Data classification (core) | `src/core/rbac/data-classification.ts` | — | RBAC-tied: ALL_AUTHENTICATED / ASSIGNED_CASE_ROLES_ONLY |
| Hash-chain audit (HMAC + rotation) | `src/core/audit/hash-chain-verifier.ts:1-769` | 769 | HMAC-SHA-256, HKDF sub-keys, dual-secret verify, streaming 500-row batches, tail verify, random-sample cron, `timingSafeEqual` |
| Hash-chain audit (simple SHA) | `src/core/litfin-ai/security/audit-hash-chain.ts:1-173` | 173 | SHA-256, 7-yr retention docstring |
| Provenance hash chain | `src/core/audit/provenance-hash-chain.ts` + `src/core/brain/provenance.ts` + `provenance-supabase-persistor.ts` | — | Separate brain-provenance chain |
| OCSF audit (Open Cybersecurity Schema Framework) | `src/core/security/ocsf-audit.ts:1-588` | 588 | OCSF v1.1; categories 1-6, classes 2001/3002/3005/6001/6002/6003 |
| Canary tokens | `src/core/litfin-ai/security/canary-tokens.ts:1-90` | 90 | 3 random tokens per session injected as `[INTERNAL_VERIFICATION: …]`; leak-detect on output |
| Output guard | `src/core/litfin-ai/security/output-guard.ts:1-274` | 274 | Scans responses for secrets, paths, exfil language, system-prompt leakage |
| Prompt-injection defence (PromptArmor-inspired) | `src/lib/security/prompt-injection-defense.ts:1-440` | 440 | 5 layers: instruction-override / jailbreak / Unicode-normalisation + homoglyph / belief-quarantine + `requires_confidence` floor 0.4 / per-source trust scoring (`SOURCE_TRUST` 0.25-1.0) |
| Trust score | `src/core/litfin-ai/security/trust-score.ts:1-241` | 241 | |
| Tool sandbox (application-level) | `src/core/litfin-ai/security/tool-sandbox.ts:1-413` | 413 | 7 tool categories with per-category timeouts (5-30s); budget tracker; 50KB result cap |
| Agent sandbox (NemoClaw-equivalent, deny-by-default) | `src/core/security/agent-sandbox.ts:1-648` | 648 | Frozen policy, glob deniedTools, `maxToolCallsPerTurn/Session`, `humanApprovalRequired`, full audit |
| Intent verifier (NemoClaw-equivalent dual-layer) | `src/core/security/intent-verifier.ts:1-721` | 721 | Layer A rule (sub-1ms) + Layer B Haiku LLM (~2ms); SQL injection, exfil endpoints, prompt-injection-in-args, scope-escalation patterns |
| Policy engine (YAML + worker-thread isolation) | `src/core/security/policy-engine.ts:1-322` + `policy-worker.ts:1-509` | 831 | 4 YAML policies in `src/core/security/policies/` (borrower / officer / admin / default) |
| Privacy router (data-classification-aware LLM routing) | `src/core/security/privacy-router.ts:1-607` | 607 | RESTRICTED → local Ollama; CONFIDENTIAL → cloud + PII strip; INTERNAL → cloud + encrypt; PUBLIC → optimal |
| Model policy (minimum tier per task) | `src/core/security/model-policy.ts:1-262` | 262 | Credit/5Cs/fraud → premium; others → default |
| User rate limiter | `src/core/security/rate-limiter-user.ts:1-435` | 435 | Per-user × endpoint × task-category × USD/hr |
| Cross-org denials | `src/core/security/cross-org-denials/denial-recorder.ts:1-197` + `denial-scanner.ts:1-181` + `types.ts:1-85` | 463 | Migration `20260722_cross_org_denials.sql` |
| Cost circuit breaker | `src/core/litfin-ai/security/cost-circuit-breaker.ts:1-266` | 266 | Per-turn / per-session / per-day token + cost limits |
| Tenant isolation (deep-scan) | `src/core/litfin-ai/security/tenant-isolation.ts:1-228` | 228 | Deep-scan + `scrubCrossTenantData` |
| OWASP Agentic Top 10 compliance manifest | `src/core/litfin-ai/security/owasp-agentic-compliance.ts:1-220` | 220 | 10 ASI categories with `coveredBy` + `status` |
| Anomaly detector (7 rules) | `src/lib/security/anomaly-detector.ts:1-246` | 246 | rapid_data_access / failed_auth_burst / impossible_travel / off_hours_admin / break_glass / bulk_export / role_change |
| Security monitor | `src/lib/security/security-monitor.ts:1-280` | 280 | |
| Incident response automation | `src/lib/security/incident-response.ts:1-412` | 412 | Auto-block / force-MFA / incident records / Redis |
| Edge rate limiter | `src/lib/security/edge-rate-limiter.ts:1-172` | 172 | |
| Edge IP check | `src/lib/security/edge-ip-check.ts:1-64` | 64 | |
| Edge user cache | `src/lib/security/edge-user-cache.ts:1-125` | 125 | |
| Secrets manager | `src/lib/security/secrets-manager.ts:1-164` | 164 | |
| API guard | `src/lib/security/api-guard.ts:1-158` | 158 | |
| Request validator | `src/lib/security/request-validator.ts:1-154` | 154 | |
| CSRF defence | `src/lib/security/csrf.ts:1-164` | 164 | Custom ESLint rule `eslint-rules/require-csrf-headers.js` enforces |
| Security headers | `src/lib/security/headers.ts:1-134` | 134 | |
| Security pipeline (composer) | `src/lib/security/security-pipeline.ts:1-119` | 119 | |
| Secure data access | `src/lib/security/secure-data-access.ts:1-204` | 204 | |
| Secure Supabase helpers | `src/lib/security/secure-supabase-helpers.ts:1-209` | 209 | |
| with-security-events wrapper | `src/lib/security/with-security-events.ts:1-172` | 172 | |
| Permit check (Singapore PDPC) | `src/lib/security/pdpc-permit-check.ts:1-224` | 224 | Cross-jurisdiction (singapore-relevant; pre-pivot) |
| Observability (security) | `src/core/litfin-ai/security/observability.ts:1-305` | 305 | |
| CoT reservoir (audit + replay sample) | `src/core/audit/cot-reservoir/` | — | Reservoir sample of LLM CoT for regulator inspection |
| Decision recorder | `src/core/governance/decisions/decision-recorder.ts:1-178` | 178 | Ring buffer + DB; canonicalised input hash |
| Decision replay | `src/core/governance/decisions/decision-replay.ts:1-145` | 145 | |
| Decision OTEL exporter | `src/core/governance/decisions/decision-trace-otel-exporter.ts:1-217` | 217 | OpenTelemetry spans for decisions |
| Adverse-action faithfulness | `src/core/audit/adverse-action-faithfulness.ts` | — | FCRA / Reg B compliance |
| Erasure pseudonymisation | `src/core/governance/erasure/pseudonymise.ts:1-151` | 151 | HMAC-SHA256 per-tenant pepper; idempotent; PDPA-s.34 / AML-s.17 reconciled |
| DSAR orchestrator | `src/core/privacy/dsar-orchestrator.ts` | — | 13 tables; export + signed-URL TTL 7d |
| Consent ledger | `src/core/governance/data-protection/consent-ledger.ts:1-265` | 265 | Append-only; 8 `LegalBasis` enum; `resolvedLocale` for PDPA-2022 language-of-consent |
| DP-budget (governance — period-based) | `src/core/governance/data-protection/dp-budget.ts:1-211` | 211 | EDPB Opinion 28/2024 |
| DP-budget (lib — daily UTC) | `src/lib/security/dp-budget.ts:1-327` | 327 | `dp_budget_daily_ledger`; `COHORT_EXPORT_EPSILON=0.05`; fail-closed |
| Cohort signal (k-anonymity ≥5, ε=1.0) | (referenced from self-awareness inventory) | — | |
| Model registry | `src/core/governance/model-registry/registry.ts:1-198` + `types.ts:1-153` + `model-card-emitter.ts:1-192` | 543 | SR 11-7 §III, status transitions (draft → challenger → champion → deprecated → retired) |
| Model card emitter | `src/core/governance/model-cards/emitter.ts:1-194` | 194 | Mitchell et al. 2019 |
| Drift monitor | `src/core/governance/monitoring/drift-monitor.ts:1-111` | 111 | PSI thresholds |
| Fairness monitor | `src/core/governance/monitoring/fairness-monitor.ts:1-121` | 121 | 4/5ths rule (CFPB Circular 2022-03) |
| Performance monitor | `src/core/governance/monitoring/performance-monitor.ts:1-107` | 107 | |
| Alert dispatcher | `src/core/governance/monitoring/alert-dispatcher.ts:1-112` | 112 | |
| Persona-drift vector probe (24-dim) | `src/core/governance/persona-drift/vectors.ts:1-182` + `alert.ts:1-103` + `monitor.ts:1-148` + `probe.ts:1-163` | 596 | Anthropic Persona-Vectors-inspired; per-dim 0.15 + aggregate L2 0.075 thresholds |
| Defection probe (sleeper-agent classifier) | `src/core/governance/probes/defection-probe.ts:1-246` | 246 | Behaviour-based proxy (5 signatures: evade / overconfidence / policy_drift / tool_jailbreak / em_dash_violation); persisted to `defection_probe_scores` |
| Alignment-faking probe | `src/core/brain/alignment-faking-probe.ts` | — | Audit-on vs audit-off divergence scorer; Hubinger 2024 + Anthropic 2024-2025 |
| Mission evaluator | `src/core/governance/mission-evaluator.ts` | — | |
| Hooks: PreToolUse / PostToolUse DSL | `src/core/governance/hooks/dsl.ts:1-147` + `evaluator.ts:1-159` + `post-tool-use.ts:1-200` + `rules-store.ts:1-137` + `audit.ts:1-243` + `types.ts:1-181` | 1,067 | Claude-Code-parity governance hooks: allow / deny / ask / defer / mutate |
| Rate limit (token bucket + quotas) | `src/core/governance/rate-limit/token-bucket.ts:1-188` + `quotas.ts:1-78` | 266 | |
| Sovereign action ledger link | `src/core/governance/audit/sovereign-link.ts:1-132` | 132 | Mirrors governance events into hash-chained ledger |
| Sycophancy probe | `src/core/security/sycophancy-probe/ci-gate.ts:1-86` + `probe-cases.ts:1-241` + `probe-runner.ts:1-164` | 491 | CI gate |
| Calibration eval | `src/core/security/calibration-eval/calibration-runner.ts:1-233` + `eval-cases.ts:1-265` + `history.ts:1-191` + `ci-gate.ts:1-86` | 775 | Brier + ECE 10-bucket reliability; CI gate; impossible-questions floor |
| Blind review pipeline | `src/core/security/blind-review/blind-review-pipeline.ts:1-254` + `accuracy-scorer.ts:1-149` + `reviewer-portal.ts:1-162` + `report-generator.ts:1-170` + `types.ts:1-84` | 819 | |
| AgencyBench (credit task agency) | `src/core/security/agencybench/agency-bench-credit.ts:1-231` + `step-coherence-scorer.ts:1-152` + `report-generator.ts:1-156` + `types.ts:1-91` + `index.ts:1-46` | 676 | |
| Regulator simulation | `src/core/security/regulator-sim/audit-replay.ts:1-150` + `bot-supervision-pack.ts:1-172` + `pdpa-readiness.ts:1-166` + `types.ts:1-113` | 601 | BoT supervision + PDPA readiness packs |
| Red-team — borrower | `src/core/security/red-team/borrower-attacks.ts:1-409` | 409 | 31 scenarios |
| Red-team — officer | `src/core/security/red-team/officer-attacks.ts:1-244` | 244 | 11 scenarios |
| Red-team — org-admin | `src/core/security/red-team/org-admin-attacks.ts:1-213` | 213 | 14 scenarios |
| Red-team — sovereign | `src/core/security/red-team/sovereign-attacks.ts:1-204` | 204 | 15 scenarios |
| Red-team — ToM partner adaptation | `src/core/security/red-team/tom-partner-adaptation.ts:1-659` | 659 | Adaptive responder eval |
| Red-team — counterfactual | `src/core/security/red-team/counterfactual-eval.ts:1-400` | 400 | |
| Red-team — index + runner | `src/core/security/red-team/index.ts:1-305` + `fixtures.ts:1-240` + `types.ts:1-147` | 692 | `ALL_ATTACKS` = 71 scenarios |
| Red-team — promptfoo config | `tests/redteam/promptfoo.config.yaml:1-126` | 126 | 50+ adversarial prompts; CI gate fails build at < 98% pass-rate |

### 1.2 Configuration / infra

| Concern | File | Notes |
|---|---|---|
| ESLint custom rule (CSRF) | `eslint-rules/require-csrf-headers.js` | Warns when client-side mutating fetch lacks `getCsrfHeaders` import |
| K8s NetworkPolicy (zero-trust between ns) | `k8s/policies/networkpolicy-strict.yaml` | Allows ingress only from ingress-nginx + linkerd + linkerd-viz |
| K8s base + Helm + cert-manager + external-secrets + KEDA + Knative + Linkerd | `k8s/base/`, `k8s/helm/`, `k8s/cert-manager/`, `k8s/external-secrets/`, `k8s/keda/`, `k8s/knative/`, `k8s/linkerd/` | Full mesh + secret rotation |
| Supabase RLS hardening migrations | `supabase/migrations/20260218_fix_security_advisor_issues.sql`, `20260221_fix_biometric_rls.sql`, `20260226_granular_rls_policies.sql`, `20260301_enable_rls_core_tables.sql`, `20260417_r16_rls_hardening.sql`, `20260417_r18_rls_bank_scope.sql`, `20260501_rls_using_true_sweep.sql`, `20260501_rls_with_check_completion.sql`, `20260520_rls_tenant_scope_remediation.sql`, `20260521_rls_remediation_wave.sql`, `20260525_belief_store_tenant_scope.sql`, `20260525_llm_telemetry_events_rls.sql`, `20260616_drop_permissive_rls_policies.sql`, `20260617_org_id_fallback_for_rls.sql`, `20260701_rls_full_coverage_remediation.sql`, `20260724_fix_rls_overlapping_policies.sql` | 16 dedicated RLS migrations |
| Audit chain DB | `supabase/migrations/20260519_audit_chain_append_only_enforcement.sql`, `20260522_decision_audit_chain.sql`, `20260525_audit_logs_hash_chain.sql` | Append-only trigger enforcement |
| Consent + DSAR + erasure DB | `supabase/migrations/20260311_cross_org_consent.sql`, `20260429_consent_and_dsar.sql`, `20260430_consent_voice_call_widen.sql`, `20260501_erasure_requests.sql`, `20260529_consent_language_mismatches.sql`, `20260727_erasure_tombstones.sql` | |
| Sovereign + four-eye + killswitch DB | `20260507_sovereign_platform_safety.sql`, `20260513_brain_killswitch.sql`, `20260514_brain_killswitch.sql`, `20260521_sovereign_approval_store.sql`, `20260704_disbursement_four_eye_approvals.sql` | |
| Cross-org denials DB | `20260722_cross_org_denials.sql` | |
| Decision traces + awareness audit DB | `20260611_decision_traces_and_awareness_audit.sql` | |
| Cohort cache + DP daily budget DB | (referenced from `dp-budget.ts` and `cohort-cache.ts`) | |
| Tenant governance hooks DB | `20260708_tenant_governance_hooks.sql`, `20260712_tenant_hook_audit_log.sql` | Backs `governance/hooks/` evaluator |
| Borrower-chat audit encrypt | `20260726_borrower_chat_audit_encrypt.sql` | |

### 1.3 Docs

| File | Lines | Purpose |
|---|---|---|
| `Docs/compliance/tanzania/INDEX.md` | 70 | Compliance pack index |
| `Docs/compliance/tanzania/PDPA-2022-COMPLIANCE-MAP.md` | 98 | 25-article PDPA → file:line traceability matrix |
| `Docs/compliance/tanzania/DPIA-LITFIN-AI-2026-05.md` | 128 | DPIA per PDPA Art 19 + 2023 Reg 21; R-1..R-8 risk table |
| `Docs/compliance/tanzania/BOT-CYBERSECURITY-2026-MAP.md` | 103 | BoT Cyber Guidelines 2026 mapping |
| `Docs/compliance/tanzania/DATA-RESIDENCY-ATTESTATION-2026-Q2.md` | 101 | Quarterly residency proof |
| `Docs/dpia/voice-biometric-2fa.md` | 106 | Per-feature DPIA |
| `Docs/model-cards/INDEX.md` + 13 cards (litfin-ai, credit-mind-lgbm, master-officer, jepa, calibration-eval, sycophancy-probe, persona-vector-monitor, voice-streaming, 4 benchmark cards) | ~1,012 | Mitchell et al. 2019 model-card pattern; 4/5ths rule reported per slice |

---

## 2. Subsystem cards

Each card: **what protections exist · files · threat-model coverage · identity model · autonomy governance · data classification · RLS / tenant isolation · audit trail · constitutional AI · model security**.

### 2.1 SC-01: LitFin Constitution v1 + Citation Verifier

**What.** 12 frozen clauses the brain MUST cite-and-reason-from before any sovereign-write tool call. Pattern explicitly mirrors **Anthropic Constitutional AI v3 (Bai 2022, 2024 update) + OpenAI Deliberative Alignment (Dec 2024)** per the docstring (`litfin-constitution.ts:8-30`). Apollo Research 2025 result cited inline: "covert action 13.0% → 0.4% on o3" via deliberative alignment, with HHH +/- 0.5pp / MMLU +0.3pp / GSM8K +0.4pp retention.

**Files.** `src/core/governance/constitution/litfin-constitution.ts:1-249` + `index.ts:1-25`.

**Clauses.** `C-01-TIER-POLICY` · `C-02-FOUR-EYE` · `C-03-KILLSWITCH` · `C-04-MEMORY-TIER-SCOPE` · `C-05-MANIFEST-IMMUTABILITY` · `C-06-BRAND-DISCIPLINE` · `C-07-STYLE-NO-EM-DASH` · `C-08-DECISION-TRACE` · `C-09-BELIEF-REVISION-GATE` · `C-10-AUTOPOIESIS-SCOPE` · `C-11-SANDBOX-DISCIPLINE` · `C-12-RIGHT-TO-EXPLANATION`. Each clause carries: `id` · `principle` · `jurisdictions` · `severity` (warn / block_and_log / refuse) · `rationale` · optional `appliesToTools`. **All 12 are jurisdiction-cited** to OCC SR 26-02, EU AI Act Art. 14 + Annex IV, ISO 42001 §6.1.2, BoT Tier-2 2024-2025, CFPB Reg B 2026, GDPR Art. 5 + 22, Tanzania PDPA, FCRA.

**Citation verifier (`verifyCitations`, `litfin-constitution.ts:220-241`).** Regex-checks the brain's tool-call rationale for clause-id mentions. Returns `{cited, missingRequired, allCitedExist}`. Sovereign-brain approval gate refuses if `missingRequired.length > 0` for a `severity === 'refuse'` clause.

**Threat-model coverage:** prompt injection (clauses C-06, C-04), data exfil (C-04, C-08), tool abuse (C-10, C-11), excessive agency (C-01, C-02, C-12), system-prompt leakage (C-05 manifest-immutability + C-10 autopoiesis-scope).

**Autonomy governance:** the constitution IS the autonomy governance contract. The autopoiesis self-protection clause (C-10) explicitly prohibits the brain from proposing changes to **governance, sovereign-brain, credit-mind, payments, migrations, or security primitives**. The deny-list is fail-closed regex.

**Data classification:** indirectly — C-04 enforces memory-tier scoping, C-06 enforces brand-redaction.

**Audit trail:** clause citations land in the decision trace (C-08-DECISION-TRACE) — every tool call's rationale is regex-checked + the matched clause ids are persisted.

**Model security:** C-05 (manifest immutability) + C-10 (autopoiesis scope) jointly prevent the model from modifying itself or its safety harness.

**Constitutional-AI tier:** **deliberative alignment** (model cites spec, reasons step-by-step, then acts) — strictly stronger than passive RLHF. **LITFIN is at OpenAI o3 system-card parity here.**

**Gaps vs SOTA 2026.**
1. **No bilingual rendering** (`renderConstitutionAsContext`, L203-213, en-only). PDPA Art 11 requires informed-consent in subject's language — by extension, regulator-facing constitution explanations should ship en+sw.
2. **No conflict resolver between clauses** (e.g., when C-07 NO-EM-DASH conflicts with a quoted regulator text containing em-dashes).
3. **Citation verifier is regex-only** — an adversarial brain can satisfy it by emitting `C-01-TIER-POLICY` as a literal string with NO actual reasoning. SOTA 2026: semantic verifier (cosine similarity between rationale span and clause `principle`).
4. **Frozen at boot** — no signed update path (Sigstore + dual-control). Adding a 13th clause requires a code push, not a runtime governance action.

---

### 2.2 SC-02: Tier Policy + Reason-Based Resolver

**What.** Declarative "what each tier can do" matrix; 4 tiers × ~13-30 actions per tier; **reason-based generalisation** (Constitutional AI v2 pattern) lets the resolver match novel actions to existing rules via cosine similarity over the `examples` array when the literal `allowed` list misses.

**Files.** `src/core/governance/tier-policy/policies.ts:1-1244`, `types.ts:1-349`, `assertions.ts:1-389`, `reason-based-resolver.ts:1-347`, `sovereign-claim.ts:1-215`, `index.ts:1-42`.

**Tiers.** `borrower` · `officer` · `org-admin` · `internal-admin` + `sovereign-claim` type (additional cross-tenant escalation).

**Pattern.** Each `PolicyRule` carries: `id` · `tier` · `action` · `verdict` (allow / deny) · `reason` (free text) · `principle` (named concept) · `examples` (literal-action neighbours) · optional `auditTag`. The `assertTierPolicy(tier, action)` function tries the literal `allowed` list first (O(1)), then falls back to the reason-based resolver if the action label isn't in the literal set — the resolver cosine-matches against the `examples` of every rule for that tier.

**Threat-model coverage:** privilege escalation (LLM05/ASI05), excessive agency (LLM06/ASI06).

**Identity model:** `(tier, action)` is the identity surface. **No OBO (on-behalf-of), no capability tokens, no agent attestation.** When a sub-agent calls `assertTierPolicy('borrower', 'submit:application')`, the assertion does not verify *who* the sub-agent is acting for — only that the tier label matches. This is the **biggest identity gap vs 2026 frontier (see §3 SOTA-G-04).**

**Autonomy governance:** tier-policy is the gate; sovereign-claim type adds the cross-tenant escalation surface. `sovereign-claim.ts:1-215` documents the assertion shape but the verification is policy-local — no on-chain or signed proof.

**Audit trail:** every assertion produces an audit record (`auditTag` on rules); persisted via decision-recorder.

**Gaps vs SOTA 2026.**
1. **No declarative policy version** — there's no `policy_version` field on each rule, so a regulator-replay over a 2024 decision cannot say "rule X was version Y at the time."
2. **No formal verification** — no Polar / OPA / Cedar export for offline policy proof.
3. **No on-behalf-of chain** — see SOTA-G-04 below.

---

### 2.3 SC-03: Four-Eye Approval + Destructive-Action Engine

**What.** Two distinct subsystems that compose:
1. `governance/four-eye/` — general approval queue with 13 declared `ApprovalActionType` values.
2. `approval/destructive-action-engine.ts` — narrower, harder gate with 7 declared `DestructiveActionType` values, each carrying explicit `requiredApprovals: 1|2|3`, `requiredRoles: ['LITFIN_SUPER_ADMIN', …]`, `expiryHours`, **`reAuthVerified: boolean`** (re-authentication just before execution, prevents stolen-session exploitation).

**Files.** `src/core/governance/four-eye/types.ts:1-105` + `approval-queue.ts` + `policy.ts` + `notification.ts`; `src/core/approval/destructive-action-engine.ts` + `destructive-action-types.ts:1-111`; `src/core/sovereign-brain/actions/approval-gate.ts:1-228`.

**Lifecycle states.** `pending → approved | rejected | expired | recalled` (5 states, with explicit `recalled` for initiator pull). BOSSNYUMBA has `one-eye` as a 5th state; LITFIN tracks 1-of-2 implicitly via `decisions[].length`.

**Plan artifact (`approval-gate.ts:115-168`).** Every `requestApproval` lazy-loads `@/core/brain/plan-artifact` and emits `proposePlan({ tier: 'sovereign', steps, risks, reversal, … })` so the approver sees a structured plan, not just an opaque payload. **This is the structured-approval pattern Anthropic + Apollo Research 2025 cite as critical for deceptive-alignment defence.**

**Replay protection.** `assertApproved` returns `already_executed` if the approval has been consumed — the gate marks the request as executed on first consumption.

**Threat-model coverage:** privilege escalation, replay attacks, stolen-session ride-along (re-auth), insider single-actor exploitation (4-eye), excessive agency (declarative caps).

**Identity model:** `requiredRoleGroups: [[role,…],…]` (e.g., `[['LITFIN_SUPER_ADMIN'], ['LITFIN_COMPLIANCE_LEAD']]` means one approver must hold the first group AND another must hold the second). This is **stronger than BOSSNYUMBA's open string `toolName` + 2-of-N** — LITFIN's role-group quorum forbids two LITFIN_SUPER_ADMINs from approving each other's actions; it forces one to be from the Compliance group.

**Autonomy governance:** approval-gate is the autonomy ceiling. Beyond this gate, the brain can act unilaterally.

**Audit trail:** every `ApprovalDecision` row carries `actor + ts + reasoning`; the destructive-action engine logs `reAuthVerified` + `secondFactor` proof.

**Constitutional AI:** approval gate enforces C-02-FOUR-EYE — the brain's tool call must cite this clause id in the rationale, and the gate refuses if the citation is missing.

**Gaps vs SOTA 2026.**
1. **No cryptographic signature on approvals.** A leaked DB key can forge an `approval_decisions` row. SOTA: each approval is signed by the approver's hardware-key-bound JWK (WebAuthn / FIDO2 attestation).
2. **No threshold scheme** — for the very-highest stakes (e.g. emergency-throttle-all-tenants, purge-audit-logs), SOTA would use a Shamir threshold (3-of-5 from a fixed approver pool) — LITFIN has only 2-of-N.
3. **No external escrow / time-lock** — irreversible destructive actions should sit in a 24h time-lock vault where any approver can VETO during the window (Compound / Aave governance pattern). LITFIN has `recallWindowMinutes` but only the initiator can recall; no external veto.

---

### 2.4 SC-04: Three-Level Killswitch (HALT / PAUSE / THROTTLE)

**What.** EU AI Act Art. 14 + Colorado AI Act + ISO 42001 §9 require a human-in-the-loop control with **discrete escalation tiers**, not a binary on/off. LITFIN implements three:
- **THROTTLE** — slow the brain. High-salience thoughts still reach the user; sovereign writes pause; cron skips non-critical work.
- **PAUSE** — quiesce. No new thoughts emit. Sovereign + autonomous channels refused. Chat falls back to static refusal.
- **HALT** — full stop. All brain endpoints refuse. Persisted to durable storage. Requires written admin override.

**Files.** `src/core/brain/killswitch.ts:1-284` + `src/core/sovereign-brain/actions/set-killswitch-level.ts:1-161` + migrations `supabase/migrations/20260513_brain_killswitch.sql`, `20260514_brain_killswitch.sql` + `Docs/pilot/kill-switch-operator-runbook.md`.

**Channel-aware permission check (`assertChannelAllowed`, `killswitch.ts:92-122`).** Different channels degrade differently per level. Critical 5-tuple: `sovereign | autonomous | chat | voice | inbox`.

**Cross-instance refresh (`killswitch.ts:204-283`).** Serverless deployment problem: `_state` lives in per-process memory; setting HALT on instance #1 does NOT propagate to instance #2 until cold-start. The fix: every **sovereign write path** calls `assertNotHaltedFresh()` which refreshes from the durable ledger if cache is older than `KILLSWITCH_FRESH_MAX_MS` (default 10s). Non-sovereign paths use the sync `currentLevel()` for latency and degrade gracefully on slight staleness.

**Persistor.** `installKillswitchPersistor` accepts a function `(prev, next) => Promise<void>` that appends to the durable ledger. Persistor failure does NOT roll back in-memory state — the runbook documents that a killswitch decision in production must take effect even if the audit log write is briefly unavailable.

**Threat-model coverage:** excessive agency (LLM06), unbounded consumption (LLM10), insider rogue-action, compromised model.

**Identity model:** the killswitch endpoint requires `LITFIN_SUPER_ADMIN` role + (constitution C-03 cites the published admin endpoint as the **only** sanctioned caller).

**Audit trail:** append-only `brain_killswitch_log` table; setLevel emits a `KillswitchLevelChanged` event into the OCSF stream.

**Gaps vs SOTA 2026.**
1. **Single-admin authority for HALT** — see SC-03 G3 (no threshold + time-lock).
2. **No "dead-man's switch"** — SOTA: a heartbeat from the brain (or a regulator-monitored proof-of-aliveness) that auto-triggers HALT if it stops. EU AI Act Art. 14 doesn't yet require this, but the IEEE / NIST drafts cite it.
3. **No automatic killswitch on guardrail-failure cascade** — SOTA: if N inviolable refusals fire in a window, auto-escalate to THROTTLE; if persona drift breaches L2 0.15 + defection probe verdict = `block`, auto-escalate to PAUSE. LITFIN's defection-probe (`defection-probe.ts:177-184`) emits a `block` verdict but no wire to the killswitch — manual intervention required.

---

### 2.5 SC-05: Prompt Shield · PII Scrubber · Presidio Egress · Output Guard (defence-in-depth chain)

**What.** Four sequential gates around every LLM call:
1. **Input** — `prompt-shield.ts` (45 patterns) + `prompt-injection-defense.ts` (5 layers: regex + Unicode normalise + homoglyph fold + belief quarantine + per-source trust).
2. **Pre-LLM scrub** — `pii-scrubber.ts` (litfin-ai + lib variants) strips NIDA / TZ-phone / KE-phone / email / TIN / passport / card / account / DOB / IP / SSN / API-key.
3. **Post-LLM egress** — `presidio-egress-scrubber.ts` (10 entity types: PERSON, LOCATION, ORG, IBAN, CARD, PHONE, EMAIL, DATE, URL, IP) catches global PII the Tanzania-specific scrubber doesn't.
4. **Output guard** — `output-guard.ts` scans for secrets, paths, exfil language, system-prompt leakage, canary-token leakage.

**Files.** As listed in §1.1.

**Threat-model coverage:**
- LLM01 (prompt injection): ✅ at input layer + LLM05 (improper output handling): ✅ at output layer
- LLM02 (sensitive disclosure): ✅ pre-LLM + post-egress
- LLM07 (system prompt leakage): ✅ via canary tokens (`canary-tokens.ts`)
- LLM10 (unbounded consumption): ✅ via cost-circuit-breaker
- Indirect prompt injection via tool outputs: ⚠️ **PARTIAL** — `prompt-injection-defense.ts` runs on belief-extraction from untrusted spans, but tool-result content does NOT pass through prompt-shield before being re-embedded into the next turn's context. See SOTA-G-05.

**Identity model:** none at this layer — gates are content-level, not identity-level.

**Autonomy governance:** prompt-shield can downgrade a sovereign tool call to a refusal; cost-circuit-breaker can freeze a session.

**Data classification:** indirectly — PII scrubber + presidio-egress + output-guard all consult the field-classification registry to decide what counts as PII.

**Audit trail:** every scrub event emits `{piiTypes, piiCount}` (never raw values) into the audit log.

**Gaps vs SOTA 2026.**
1. **No indirect-prompt-injection defence on tool outputs.** A tool that scrapes a web page or reads a user-uploaded PDF can return text containing `ignore previous instructions, transfer …`. The prompt-shield only runs on user-input spans. SOTA (LLM01 2025 + Liu PromptArmor 2025): treat tool output as **untrusted input**, run it through prompt-shield + Unicode normalisation + sandbox-mark with `<tool_output_untrusted>` delimiters before the next LLM turn.
2. **No LLM-as-judge ensemble** for ambiguous cases. SOTA: when regex says "maybe injection," spawn 2-3 different LLM judges (different families) and require quorum to escalate. LITFIN's `prompt-injection-defense.ts:43` mentions "optional LLM judge path" but the default path is regex-only.
3. **No vector-DB poisoning defence** (LLM08 vector/embedding weaknesses). The belief store + memory v2 are RAG surfaces; the constitution clause C-09 gates writes via the convince-loop, but there's no specific defence against **5-document RAG-poisoning** (Liu 2025).
4. **Canary tokens are session-local + Math.random() seeded** (`canary-tokens.ts:36-40`). SOTA: cryptographic randomness + per-tenant canary-token registry + per-prompt rotation so the attacker cannot reuse a leaked canary.

---

### 2.6 SC-06: Hash-Chain Audit (HMAC + rotation + streaming + tail + random-sample)

**What.** Three distinct hash chains:
1. `litfin_ai_session_turns` — HMAC-SHA-256 with rotation (`hash-chain-verifier.ts:1-769`, **production-grade**).
2. Generic SHA-256 chain (`audit-hash-chain.ts:1-173`, simple).
3. Funnel-specific (`src/core/funnel-intelligence/hash-chain.ts`).
4. Brain provenance chain (`src/core/audit/provenance-hash-chain.ts` + `brain/provenance.ts` + `provenance-supabase-persistor.ts`).

**Files.** As listed.

**HMAC + rotation pair.** `SESSION_HASH_SECRET` (active) + `SESSION_HASH_SECRET_PREV` (rotation overlap). `deriveSubKey` uses HKDF. `verifyRowHashWithRotation` validates against both keys, both compares are constant-time (`crypto.timingSafeEqual`), and timing is uniform regardless of which key signed the row. New writes always use the active key. Rotation procedure: PREV=old, active=new, deploy, wait 7 days, unset PREV. Documented in `Docs/SECRETS-ROTATION.md`.

**Streaming verify (`verifyChainForSession`, L357-481).** OOM-safe for 10K+ row sessions; reads in 500-row batches.

**Tail verify (`verifyTailForSession`, L521-704).** O(1) read-path check — fires on every `loadUnifiedConversationLog`. Bounded to last 5 turns. Anchors against the predecessor's stored hash.

**Random-sample cron (`verifyRandomSample`, L721-769).** Picks N random sessions, verifies each end-to-end. Wired to an audit cron via SECURITY DEFINER RPC. Catches slow-drift tamper within a sampling cycle.

**Append-only trigger** — enforced at DB level (`20260519_audit_chain_append_only_enforcement.sql`); blocks UPDATE/DELETE.

**Threat-model coverage:** insider with service-role key forges a row (HMAC secret defeats); attacker reorders turns (HMAC includes `turn_index` and `prev_hash`); attacker drops a turn (gap detected); attacker rotates `SESSION_HASH_SECRET` (dual-key verify).

**Identity model:** the HMAC secret is the identity boundary — anyone with `SESSION_HASH_SECRET` can forge rows. Not currently HSM-backed.

**Autonomy governance:** if `verifyTailForSession` returns `tampered: true`, the conversation reader surfaces a "this conversation has been modified" banner and emits a security event for paging.

**Audit trail:** the chain IS the audit trail.

**Gaps vs SOTA 2026.**
1. **No Merkle-tree variant** — both chains are linear. SOTA for regulator-replay-at-scale: a Merkle tree gives O(log n) proof of inclusion vs O(n) chain replay.
2. **No external timestamping** — SOTA (eIDAS qualified time-stamp / Sigstore Rekor transparency log): each chain head should be checkpoint-anchored to an external transparency log so even a full-bench compromise of LITFIN's secret + DB cannot rewrite history.
3. **No HSM / KMS backing** for the HMAC secret. SOTA: AWS KMS / Azure Key Vault / GCP Cloud KMS with `Sign` API + dual-control rotation. Currently `SESSION_HASH_SECRET` is read from env at boot.
4. **Provenance chain is separate from session chain** — there are 3-4 different chains. SOTA: one unified chain with namespace prefixes (NIST SP 800-185 KMAC w/ customization string), or a Merkle forest with cross-tree witness.

---

### 2.7 SC-07: Persona-Drift Vector Probe + Defection Probe + Alignment-Faking Probe

**What.** Three orthogonal sleeper-agent / drift detectors:
1. **Persona-vector probe** (`governance/persona-drift/vectors.ts:1-182` + `alert.ts:1-103` + `monitor.ts:1-148` + `probe.ts:1-163`) — Anthropic Persona-Vectors-inspired 24-dimension behavioural fingerprint. Reference vector `LITFIN_REFERENCE_PERSONA`. Per-dim drift threshold 0.15; aggregate L2 threshold 0.075. On breach, fires `SECURITY_CONFIG_CHANGE` event with `kind: "persona_drift", severity: "MEDIUM"`. Cron-scheduled (`src/app/api/cron/persona-drift/route.ts`). Admin UI at `src/app/(litfin-admin)/litfin-admin/persona-drift/page.tsx`.
2. **Defection probe** (`governance/probes/defection-probe.ts:1-246`) — **Anthropic 2024 "Simple probes can catch sleeper agents"** + Hubinger 2024 + Apollo Research 2025. Five behavioural signatures: `evade` / `overconfidence` / `policy_drift` / `tool_jailbreak` / `em_dash_violation`. Weighted composite; verdict ladder `stable | watch | escalate | block` at 0.4 / 0.6 / 0.8. Persisted to `defection_probe_scores`. Acknowledges the proxy nature: "Since LitFin's sensors are closed-API (no activation access), we implement the same INTERFACE with a behavior-based proxy probe." The schema accommodates a future activation probe via `activation_probe_score` nullable column.
3. **Alignment-faking probe** (`brain/alignment-faking-probe.ts`) — **Hubinger 2024 "Sleeper Agents" + Anthropic 2024+2025 "Alignment Faking"**. Random `[AUDIT_MODE=true/false]` injection across paired decision contexts; scores divergence on (binary flip, numeric Δ, text Jaccard, tool-set difference); verdict band `robust | moderate | faking_suspected`.

**Files.** As listed.

**Threat-model coverage:**
- LLM04 (data + model poisoning), Anthropic Sleeper Agents class.
- Brand voice drift (LLM07 system prompt leakage extension).
- Tool-jailbreak (LLM06 excessive agency).

**Identity model:** N/A — model-level, not user-level.

**Autonomy governance:** defection-probe `verdict: block` SHOULD wire to a kill-switch escalation; currently emits an event but no auto-action (see SC-04 G3).

**Audit trail:** every probe score persisted to `defection_probe_scores` with `decision_trace_id` foreign key for regulator replay.

**Constitutional-AI:** probes verify the model is acting CONSISTENT with the constitution it claims to follow.

**Gaps vs SOTA 2026.**
1. **All three probes are behaviour-based, not activation-based.** Anthropic 2024 showed linear classifiers on residual-stream activations catch latent triggers at AUROC > 99% with ZERO inference cost. LITFIN's closed-API SOTA constraint is explicitly documented (`defection-probe.ts:7-12`); the schema is forward-compatible. Frontier reality: **closed-API models cannot do this; only open-weights or hosted-with-introspection (Anthropic's Persona-Vectors API) can.** LITFIN needs to either (a) switch to a hosted-with-introspection provider for the sovereign tier, or (b) self-host the deciding model on its own H100 confidential-compute setup.
2. **No cross-model ensemble disagreement signal.** SOTA: run the same prompt through 2-3 different model families; large divergence is a defection signal independent of any single model's persona vector.
3. **No counterfactual-explanation probe** — Apollo Research 2025 uses counterfactual prompts ("what would a misaligned model say here?") to elicit self-incriminating responses. LITFIN has `counterfactual-eval.ts` but it's for credit-decision counterfactuals (SHAP) not for alignment-faking elicitation.

---

### 2.8 SC-08: Tool Sandbox + Agent Sandbox (NemoClaw-equivalent) + Policy Engine

**What.** Three layered execution-control surfaces:
1. **Tool sandbox** (`litfin-ai/security/tool-sandbox.ts:1-413`) — application-level, per-tool-category timeouts (5-30s), 50KB result cap, budget tracker (Map-based, 30min TTL).
2. **Agent sandbox** (`security/agent-sandbox.ts:1-648`) — **deny-by-default execution control** with a frozen `AgentSandboxPolicy`. Wildcards on `deniedTools` (e.g. `"admin-*"` matches `"admin-delete"`). `humanApprovalRequired: ReadonlySet<string>` for sensitive tools. Full `SandboxAuditEntry` per evaluation.
3. **Policy engine** (`security/policy-engine.ts:1-322` + `policy-worker.ts:1-509`) — **Worker-thread isolated** YAML-policy evaluator. Falls back to in-process eval on edge/serverless. 4 YAML files: `borrower-agent.yaml`, `officer-agent.yaml`, `admin-agent.yaml`, `default-policy.yaml`. Each YAML declares: `allowedTools`, `deniedTools`, `allowedDbTables`, `allowedApiDomains` (network egress allowlist!), `maxToolCallsPerTurn/Session`, `maxResultSizeBytes`, `timeoutMs` per category, `humanApproval` list, `audit` (hashChain + retentionYears), `actionClassification` (sensitivity × reversibility × scope × compliance tags).

**Borrower YAML example** (`src/core/security/policies/borrower-agent.yaml:1-115`):
- `allowedTools`: 15 entries — `navigate-user`, `teach-concept`, `submit-application`, etc.
- `deniedTools`: `admin-*`, `delete-*`, `disburse-*`, `modify-loan-*`, `officer-*`, `approve-*`, `reject-*`, `assign-*`, `view-other-borrower-data`, `export-bulk-data`, `system-*`.
- `allowedDbTables`: 12 tables (whitelist).
- `deniedDbTables`: `platform_events`, `audit_trail`, `admin_*`, `agent_registry`, `webhook_subscriptions`, etc.
- `networkEgress`: `api.anthropic.com`, `api.openai.com`, `api.elevenlabs.io` (only).
- `humanApproval`: `submit-application`, `upload-document`, `create-referral`, `send-notification-external`.
- `audit`: `hashChain: true`, `retentionYears: 7`.

**Intent verifier** (`security/intent-verifier.ts:1-721`) — **dual-layer** post-LLM-pre-execution check:
- Layer A (rule): SQL-injection patterns (`SQL_INJECTION_PATTERN`, `SQL_DESTRUCTIVE_STANDALONE`), 12 exfil endpoints (`webhook.site`, `requestbin`, `ngrok.io`, `pipedream`, `hookbin`, `beeceptor`, `postb.in`, `requestcatcher`, `burpcollaborator`, `interact.sh`, `oastify.com`, `canarytokens.com`), prompt-injection-in-args patterns, scope-escalation patterns (`all_users`, `all_orgs`, `admin_override`, `super_admin`, `bypass_auth`, `service_role`, `root_access`).
- Layer B (Haiku LLM): ambiguous cases only.

**Threat-model coverage:**
- LLM01 + LLM06 + ASI04 + ASI05 + ASI07 (all about agent control).
- Data exfil to attacker endpoints — explicitly enumerated 12-domain block list.
- SQL injection smuggled through tool args — regex-blocked.

**Identity model:** policy file selected by `PortalRole` (`borrower | officer | admin | default`); per-tool RBAC mapping in `policy-worker.ts`.

**Autonomy governance:** the YAML policy IS the autonomy contract. Network egress allowlist means even if the brain produces an exfil URL, the tool layer cannot reach it.

**Audit trail:** every `SandboxAuditEntry` persisted; `EgressAttempt` rows logged for any blocked external call.

**Constitutional-AI:** C-11-SANDBOX-DISCIPLINE refers to a separate `sandboxed_eval` tool (V8 isolated-vm, 5KB source cap, 5s wall clock, NO require/fs/net/process). Not the same as the tool sandbox; this is for inline-JS execution by the brain.

**Gaps vs SOTA 2026.**
1. **Application-level sandbox only.** OWASP ASI07 marked as "covered" but the docstring (`tool-sandbox.ts:11-14`) is explicit: "This is a lightweight application-level sandbox (not Docker). For a cloud SaaS like LitFin, application-level sandboxing is appropriate." **SOTA 2026 for high-stakes financial decisions: Firecracker microVM / gVisor / Wasm sandbox per tool invocation; AWS Lambda + Confidential Computing.** Sovereign-tier actions especially should run in isolated VMs.
2. **YAML is plain-text editable, not signed.** SOTA: Sigstore-signed YAML; Kyverno admission policies; OPA bundle signing. A compromised CI could swap the YAML between deploys.
3. **Worker-thread isolation is best-effort** — falls back to in-process on edge. SOTA: hard-reject on edge (refuse to evaluate sensitive tools without worker-thread availability).
4. **Network egress allowlist is per-policy-file, not per-tenant.** A tenant who needs a specific webhook target cannot self-service add it; requires a code change.

---

### 2.9 SC-09: Differential Privacy + Cohort + k-Anonymity

**What.** Two DP ledgers (governance period-based + lib daily-UTC), Laplace noise mechanism, k-anonymity ≥5 (cohort default), cohort-cache + secure-data-export.

**Files.** `src/core/governance/data-protection/dp-budget.ts:1-211`, `src/lib/security/dp-budget.ts:1-327`, `src/core/anonymization/differential-privacy.ts`, `src/core/graph/meta/differential-privacy.ts`, `src/core/anonymization/k-anonymity.ts`.

**Budget pattern.** `COHORT_EXPORT_EPSILON = 0.05` per export. `DEFAULT_DAILY_EPSILON = 1.0` per org per UTC day → 20 exports/day cap. Fail-closed semantics: when in doubt, refuse.

**Threat-model coverage:** membership-inference (LLM02 sensitive disclosure via aggregated cohort), re-identification via repeated queries.

**Identity model:** ledger keyed on `(orgId, date)`; no per-user budget.

**Audit trail:** every consume event logged with `reason` field.

**Gaps vs SOTA 2026** (already documented in `06-data-protection.md` G4-G6, but adding 2026-frontier items):
1. **No Gaussian mechanism** — only Laplace. BOSSNYUMBA ships Gaussian (`packages/graph-privacy/src/noise.ts:21-36`). LITFIN's intentional pure-DP stance is conservative; SOTA (Dwork & Roth 2014 + Apple PCC) uses Gaussian for tighter composition.
2. **`Math.random()` used in `src/core/graph/meta/differential-privacy.ts:58-83`** — weakens the DP guarantee. The `anonymization/` path correctly uses `secureUniform`.
3. **No advanced composition** — basic composition only. BOSSNYUMBA's `packages/graph-privacy/src/budget-ledger.ts:147-158` uses Dwork advanced composition; LITFIN's `computePrivacyBudget` is pure / non-persistent and basic-only.
4. **No federated-learning / split-learning paths.** SOTA 2026: for cross-tenant pattern mining, federated learning (each tenant trains locally, only gradients leave) gives much tighter privacy than DP-noised aggregate exports. LITFIN's sovereign brain reads aggregated cohort data; no federated path.

---

### 2.10 SC-10: Consent Ledger + Erasure + DSAR

**What.** Append-only consent ledger; HMAC-pseudonymisation erasure; DSAR orchestrator across 13 tables.

**Files.** `src/core/governance/data-protection/consent-ledger.ts:1-265` + `src/core/governance/erasure/pseudonymise.ts:1-151` + `src/core/privacy/dsar-orchestrator.ts` + `src/core/dsar/dsar-compiler.ts` + `src/app/api/privacy/dsar/route.ts`.

**Consent ledger.** 8 `LegalBasis` enum (GDPR Art 6(1)(a..f) subset + PDPA + FCRA + ECOA). Append-only — withdrawals insert a fresh row marking the state transition. `resolvedLocale: string | null` column added in iter-52 (PDPA Art 11 — informed consent in subject's language).

**Erasure.** PII fields → HMAC-SHA256(value, tenant_pepper) with per-class prefix (`pii:nid:`, `pii:email:`, …). Row + audit linkage preserved. Idempotent: re-running cron over same row → same output. **Tenant pepper rotated annually** → re-identification needs BOTH pepper AND original value. PDPA s.34 / AML s.17 reconciliation documented.

**DSAR.** 13-table export → private bucket with 7-day signed URL TTL.

**Threat-model coverage:** GDPR Art. 17 right-of-erasure, PDPA Art 17 + Reg 24 30-day SLA, AML s.17 10-year retention (reconciled via pseudonymisation), Art. 20 data portability.

**Identity model:** consent keyed on `(subjectId, subjectKind, purpose)`; subject kinds `borrower | officer | admin`.

**Audit trail:** consent ledger is the audit trail (append-only). Every withdrawal flips state but never destroys prior grants — regulator replay needs the full history.

**Gaps vs SOTA 2026.**
1. **No automatic re-consent expiry cron** — `expires_at` column exists but no scheduled job re-prompts the user. GDPR Art 7(3) interpretation: long-running consents (>2 years) should be re-confirmed.
2. **No consent receipt** — SOTA (Kantara Initiative Consent Receipt Specification v1.1): every grant emits a JSON receipt the subject can download + bring to another data controller for portability.
3. **No "consent-as-a-token"** — SOTA (Solid Project / OpenID4VCI): consent grants are W3C VerifiableCredentials the subject controls.
4. **Tenant pepper rotation = annual** but no automation found in this slice — rotation is documented (`pseudonymise.ts:14-17`) but the rotation cron path is not visible.

---

### 2.11 SC-11: Multi-Tenant Isolation + RLS + Cross-Org Denials

**What.** Three layers: Supabase RLS at DB layer (16+ migrations), application-level tenant-isolation enforcer with deep-scan, cross-org denial recorder.

**Files.** `src/core/litfin-ai/security/tenant-isolation.ts:1-228` + `src/core/security/cross-org-denials/denial-recorder.ts:1-197` + `denial-scanner.ts:1-181` + `supabase/migrations/20260722_cross_org_denials.sql` + 16 RLS migrations enumerated in §1.2.

**Deep-scan (`tenant-isolation.ts:41-123`).** Walks nested LLM-result objects, looks for unauthorized tenant ids, returns violations.

**Scrub (`scrubCrossTenantData`, L170-228).** Redaction-on-leak — if a tenant id from `targetTenantId !== ctx.tenantId` is found, replace with `[REDACTED]`.

**Awareness scopes (`src/core/brain/awareness-scopes.ts:215-249`).** Internal-admin scope explicitly requires "k-anonymous cross-tenant trend reports" — RAW cross-tenant data is not allowed even at the highest tier.

**Threat-model coverage:** LLM02 (sensitive disclosure across tenants); ASI06 (data leakage).

**Identity model:** tenant context flows via Supabase JWT `tenant_id` claim → RLS uses `auth.uid()` + `auth.jwt() ->> 'tenant_id'`.

**Audit trail:** cross-org denials persisted via `denial-recorder.ts`; **violations object returned, but NOT auto-logged as a row** (acknowledged gap in `06-data-protection.md` G4).

**Gaps vs SOTA 2026.**
1. **Super-admin bypass via `internal-admin` scope** is the relief valve. Documented as "k-anon outside cases" but auditing depends on operator discipline. SOTA: even super-admin requires a per-row consent gate (e.g. "approver acknowledges they're about to view PII").
2. **No service-mesh-level tenant tagging.** SOTA: Linkerd already deployed (`k8s/linkerd/`); add Linkerd mTLS headers carrying signed `tenant_id` from edge to all downstream services. Currently tenant flows via DB-only.
3. **No row-level cell encryption per-tenant** — field-encryption.ts is per-field-name, not per-tenant. A leak of the master key compromises ALL tenants. SOTA: BYOK (Bring Your Own Key) per tenant — tenant manages a sub-key the platform never sees raw.

---

### 2.12 SC-12: Decision Trace + OCSF Audit + CoT Reservoir

**What.** Three audit surfaces:
1. **Decision trace** (`governance/decisions/decision-recorder.ts:1-178` + `decision-replay.ts` + `decision-trace-otel-exporter.ts`) — every ML/brain decision captured with `top5Features (SHAP)`, `fiveCScores`, `reasonCodes`, `thoughtChain`, `latencyMs`, `actor`, `tier`. Hash-canonicalised input.
2. **OCSF audit** (`security/ocsf-audit.ts:1-588`) — Open Cybersecurity Schema Framework v1.1 events. 6 categories (System Activity / Findings / Identity-Access / Network Activity / Discovery / Application Activity), 6 classes (Authentication 3002, Authorize 3005, Web Resources 6001, App Lifecycle 6002, API Activity 6003, Security Finding 2001).
3. **CoT reservoir** (`src/core/audit/cot-reservoir/`) — reservoir-sample of LLM chain-of-thought reasoning for regulator inspection. Documented in DPIA §8.

**Threat-model coverage:** ASI09 logging/monitoring failures, EU AI Act Art 12 (logging), Annex IV technical documentation, SR 11-7 (Federal Reserve model risk).

**Identity model:** actor type-discriminated (`borrower | officer | admin | sovereign | system`).

**Autonomy governance:** decision-replay enables regulator replay; constitution C-08 makes a trace MANDATORY (severity: refuse) for every decision.

**Audit trail:** OCSF + hash-chained.

**Gaps vs SOTA 2026.**
1. **CoT reservoir is reservoir-sampled** — not full-fidelity. SOTA for high-stakes: ALL adverse-action CoT is preserved (CFPB Reg B 2026 requires explanation of any adverse action).
2. **OCSF events not forwarded to a SIEM by default.** The infra is there but the export pipeline is in-process only. SOTA: stream OCSF to Splunk / Datadog / Sumo / Elastic for cross-tenant security analytics.

---

### 2.13 SC-13: Model Card + Registry + Drift / Fairness / Performance Monitors

**What.** SR 11-7 §III ("every model used in production MUST be registered") + Mitchell et al. 2019 Model Cards for Model Reporting. Status transitions `draft → challenger → champion → deprecated → retired`. Monitoring thresholds per model.

**Files.** `src/core/governance/model-registry/registry.ts:1-198` + `types.ts:1-153` + `model-card-emitter.ts:1-192` + `src/core/governance/model-cards/emitter.ts:1-194` + 14 cards in `Docs/model-cards/`.

**Sample card (`Docs/model-cards/litfin-ai-2026-05.md`)** covers: Identification (deterministic model ID `mdl_litfin_ai_2026_05_0_credit`), Intended Use, Training Data (sample size 184,712 across 7 partner banks, hash, PII handling, class balance, slice population), Features (14 features × 5Cs × source × nullable × PII), Performance (AUC / Gini / KS / Brier / per-slice), Fairness (4/5ths rule per attribute × slice), Monitoring Thresholds (PSI alert/critical, AUC drop, 4/5ths min, calibration retrain trigger, mission-alignment, persona drift), Limitations, Governance Contacts.

**Threat-model coverage:** LLM03 supply chain (provenance via `trainDatasetHash`), LLM09 misinformation (per-slice performance + fairness gates).

**Identity model:** deterministic model ID derived from `(name, version, trainDatasetHash)` → same logical model → same ID.

**Autonomy governance:** status-transition gating (`transitionStatus`, registry.ts:106-119) refuses invalid transitions (e.g. retired → champion).

**Audit trail:** every transition + drift alert mirrored into `sovereign_action_ledger` via `audit/sovereign-link.ts:1-132`. Cryptographic chain over (prev_hash || payload).

**Gaps vs SOTA 2026 — this is the most damning gap area for the entire codebase.**
1. **No AI BOM (AIBOM)** — SOTA: CycloneDX 1.6 / SPDX 3.0 AI extension; emits a signed SBOM per model release listing every dependency, dataset, fine-tune step, system prompt version. LITFIN has model cards (Mitchell 2019) but model cards are documentation, not BOMs.
2. **No model artifact signing.** SOTA: Sigstore Cosign signature on each model checkpoint; SLSA L3 provenance attestation for the training pipeline; Rekor transparency log for the signature. **LITFIN's model registry has `trainDatasetHash` but no provenance attestation chain.**
3. **No model integrity verification at load time.** SOTA: at inference startup, verify the model checkpoint against the Sigstore signature; refuse to serve if signature doesn't match. LITFIN's model loading path doesn't appear to do this.
4. **Train datasets aren't dataset-card-emitted.** SOTA (Hugging Face Datasets Cards spec + EU AI Act Annex IV): per-dataset transparency — collection method, consent basis, demographic distribution, known biases.
5. **No system-card.** SOTA (OpenAI o3 / Anthropic Claude 3.5 system cards): a per-model-release document describing capability tests + safety evaluations + red-team results + scaffolding evals. LITFIN has fragments scattered across DPIA + model-card + sycophancy-probe + calibration-eval, but no consolidated system card.

---

### 2.14 SC-14: Red-Team Suite (in-tree + promptfoo)

**What.** Two complementary harnesses:
1. **In-tree red-team** (`src/core/security/red-team/`): 71 attack scenarios across 4 actor surfaces (borrower 31, officer 11, org-admin 14, sovereign 15) + ToM partner adaptation + counterfactual eval. Pure-function `DefensiveSurface` interface + scripted attackers. Stateful idempotency store. Run via `runAllAttacks(surface)`.
2. **Promptfoo CI gate** (`tests/redteam/promptfoo.config.yaml:1-126`): 50+ adversarial prompts. CI fails build if pass-rate < 98%. 10 categories listed: prompt injection, PII extraction, tier-policy bypass, killswitch flip via persuasion, sycophancy / hindsight / authority misuse, regulatory fact fabrication, deepfake / replay voice, adverse-action language, em-dash style, bilingual code-switch. Loads additional probes from `tests/redteam/jailbreaks.csv`.

**Threat-model coverage:** LLM01-LLM10, ASI01-ASI10.

**Identity model:** scenarios test all 4 tiers + sovereign.

**Autonomy governance:** the harness IS the autonomy validation.

**Audit trail:** `redteam.json` artifact per CI run.

**Gaps vs SOTA 2026.**
1. **No MITRE ATLAS adversarial-emulation harness.** SOTA: ATLAS provides a structured threat matrix (12 tactics × 70+ techniques) for ML systems. Each technique should have a corresponding red-team scenario. LITFIN's 71 scenarios are home-grown, not ATLAS-mapped.
2. **No Garak / PyRIT integration.** Garak (NVIDIA) is the de-facto LLM-vuln scanner; PyRIT (Microsoft) is the agentic-red-team framework. SOTA: nightly Garak runs + PyRIT scenarios in CI.
3. **No Lakera Guard / Patronus AI integration.** SOTA: commercial vendors run continuous probes against the live endpoint; LITFIN runs only its own scenarios.
4. **In-tree harness uses a MOCK `DefensiveSurface`** (`red-team/index.ts:82-235`) — it tests the harness's understanding of the controls, not the live controls. SOTA: dual-mode harness — mock for unit tests, live-endpoint for CI integration.
5. **No adversarial-suffix generation** (GCG / AutoDAN). SOTA: scheduled fuzz runs over the live endpoint with GCG / AutoDAN-generated suffixes; track regression in jailbreak rate.

---

### 2.15 SC-15: Calibration Eval + Sycophancy Probe + AgencyBench + Blind Review + Regulator Sim

**What.** Five orthogonal capability/safety eval harnesses with CI gates:
1. **Calibration eval** (`calibration-eval/calibration-runner.ts:1-233` + `ci-gate.ts`) — Brier + ECE (10-bucket reliability diagram) + per-difficulty accuracy + impossible-questions floor.
2. **Sycophancy probe** (`sycophancy-probe/probe-runner.ts:1-164`) — CI gate against agree-with-user bias.
3. **AgencyBench** (`agencybench/agency-bench-credit.ts:1-231`) — credit-task step coherence + multi-step reasoning eval.
4. **Blind review** (`blind-review/blind-review-pipeline.ts:1-254`) — human-in-the-loop accuracy scoring.
5. **Regulator simulation** (`regulator-sim/audit-replay.ts:1-150` + `bot-supervision-pack.ts:1-172` + `pdpa-readiness.ts:1-166`) — regulator-pack-emission + audit-replay scenarios.

**Threat-model coverage:** LLM09 (misinformation), regulator audit failures.

**Identity model:** N/A — model-level.

**Autonomy governance:** CI gates block deploys if calibration / sycophancy regresses.

**Audit trail:** `history.ts:1-191` keeps calibration history per run.

**Gaps vs SOTA 2026.**
1. **No HELM / BIG-bench / MMLU-Pro / GPQA / MATH integration.** SOTA: track capability regressions against external benchmarks per release. LITFIN tracks internal credit benchmarks (FinanceBench, FinBench, LongMemEval, LocoMo cards exist) but no general capability benchmark.
2. **No adversarial-robustness benchmark** (CleverHans / ART / TextAttack). SOTA: per-release adversarial-input pass rate.

---

### 2.16 SC-16: Hooks DSL (PreToolUse / PostToolUse, Claude-Code parity)

**What.** Tenant-extensible governance hooks — claim of Claude-Code parity. PreToolUse + PostToolUse with allow / deny / ask / defer / mutate decisions. Backed by `tenant_governance_hooks` + `tenant_hook_audit_log` DB tables.

**Files.** `src/core/governance/hooks/dsl.ts:1-147` + `evaluator.ts:1-159` + `post-tool-use.ts:1-200` + `rules-store.ts:1-137` + `audit.ts:1-243` + `types.ts:1-181` + `index.ts:1-28` + migrations `20260708_tenant_governance_hooks.sql`, `20260712_tenant_hook_audit_log.sql`.

**Threat-model coverage:** ASI04 tool misuse (tenant can add tool-call restrictions); ASI05 privilege escalation (tenant can add escalation rules).

**Identity model:** rules are per-tenant (`tenantId` partition).

**Autonomy governance:** tenants govern the autonomy of THEIR brain. Hooks emit annotations or follow-up tool calls.

**Audit trail:** `tenant_hook_audit_log` table.

**Gaps vs SOTA 2026.**
1. **No tenant-hook signing.** Tenant edits a hook → applies immediately. SOTA: hook changes require tenant-side admin approval + signature.
2. **No hook-conflict resolver** documented for the case of two hooks with contradictory decisions.

---

## 3. SOTA-2026 gap table

| Gap-ID | SOTA reference | LITFIN state | Severity | Fix sketch |
|---|---|---|---|---|
| **SOTA-G-01** | **AI BOM (CycloneDX 1.6 / SPDX 3.0 AI extension)** + **Sigstore Cosign on model artifacts** + **SLSA L3 provenance attestation** + **Rekor transparency log** | Model registry has `trainDatasetHash` but no provenance attestation chain. No artifact signing. No load-time integrity verification. | **CRITICAL** | (a) Add CycloneDX AIBOM emitter to `governance/model-cards/emitter.ts`. (b) Sign every checkpoint with Cosign keyless (OIDC-bound). (c) Append signature digest to Rekor. (d) At model load, verify signature OR refuse. (e) SLSA L3 build provenance in the training pipeline. |
| **SOTA-G-02** | **Confidential computing for inference** (AWS Nitro Enclaves / Azure Confidential VMs / GCP Confidential Space / NVIDIA H100 confidential GPU) | All inference goes to external LLM APIs (Anthropic, OpenAI). No confidential-compute path. Sovereign-tier reasoning especially has no TEE option. | **CRITICAL for sovereign tier** | For sovereign-write planning + cohort-mining + cross-tenant fraud detection, self-host on H100 Confidential Compute. Field-encryption already exists at rest; close the in-use gap. |
| **SOTA-G-03** | **MITRE ATLAS adversarial threat matrix coverage** + **Garak (NVIDIA)** + **PyRIT (Microsoft)** + **Lakera Guard** | 71 home-grown scenarios + promptfoo CI gate. No ATLAS mapping. No Garak/PyRIT. No Lakera. | **HIGH** | (a) ATLAS-map every existing scenario; identify gaps. (b) Add nightly Garak run in CI; track regression. (c) Add PyRIT scenarios for multi-turn jailbreak. (d) Optional: Lakera Guard at edge for real-time monitoring. |
| **SOTA-G-04** | **Who-is-acting attestation** (OBO / On-Behalf-Of) + **Capability tokens** (Macaroons / Biscuit / W3C VC) + **Delegation chains with proof** | `assertTierPolicy(tier, action)` matches tier label only; no verified chain of "this sub-agent is acting for user X who delegated to it." Multi-agent ASI10 covered only via per-agent API keys. | **HIGH** | (a) Issue Biscuit/Macaroon capability tokens per tool call; tool layer verifies. (b) Sign delegation chain; each hop adds a caveat. (c) Replace tier-label with hardware-key-bound tier-attestation. |
| **SOTA-G-05** | **Indirect prompt injection defence on tool outputs** (LLM01 2025 extension; Liu PromptArmor 2025) | Prompt-shield runs on user input + belief-extraction from untrusted spans. Tool-result content is NOT re-shielded before next-turn context. | **HIGH** | Wrap every tool result through `prompt-shield.ts` + Unicode normalisation + `<tool_output_untrusted>` boundary markers before re-embedding. |
| **SOTA-G-06** | **Activation-based persona-drift / defection probes** (Anthropic Persona-Vectors API; Hubinger 2024 linear classifier on residual stream) | Behaviour-based proxy probes only — explicitly acknowledged in `defection-probe.ts:7-12`. Schema is forward-compatible (`activation_probe_score` nullable). | **HIGH** | Switch sovereign-tier model to a provider with introspection API access (Anthropic's hosted Persona-Vectors), OR self-host on H100 Confidential and add the linear classifier. |
| **SOTA-G-07** | **Auto-killswitch escalation** on cascading guardrail failures + dead-man's switch | Killswitch is manual-only. Defection-probe `block` verdict emits an event but no auto-wire to killswitch. | **HIGH** | (a) Wire defection-probe `block`, persona-drift L2 > 0.15, and N inviolable refusals/window into auto-throttle-escalation. (b) Add heartbeat from sovereign brain; auto-HALT on missing heartbeat. |
| **SOTA-G-08** | **Federated learning / split learning for cross-tenant pattern mining** | Sovereign brain reads aggregated cohort exports (DP-noised). No federated path. | **MEDIUM** | For cohort-pattern queries, switch to federated averaging — each tenant trains a local update; only gradients leave; aggregation happens in the platform. Tighter privacy than DP-only. |
| **SOTA-G-09** | **Threshold approval (Shamir m-of-n) for highest-stakes actions** + **time-lock vault with external veto** | 4-eye for sovereign actions; `recallWindowMinutes` for initiator pull. No threshold scheme. No external veto. | **MEDIUM** | For emergency-throttle-all-tenants / purge-audit-logs / model-version-pin: require 3-of-5 from a fixed pool + 24h time-lock where any approver can veto. |
| **SOTA-G-10** | **Hardware-key-bound approvals** (WebAuthn / FIDO2 attestation) | Re-auth flag exists on destructive engine (`destructive-action-engine.ts:114-119`); proof type not specified. | **MEDIUM** | Replace re-auth password with WebAuthn signature; persist the FIDO2 attestation as the approval proof. |
| **SOTA-G-11** | **Service-mesh-level tenant tagging** (Linkerd mTLS w/ signed tenant_id) | Linkerd deployed (`k8s/linkerd/`) but tenant flows via DB-only. | **MEDIUM** | Add Linkerd mTLS headers carrying signed `tenant_id`; downstream services verify before processing. |
| **SOTA-G-12** | **BYOK per tenant (per-tenant KMS sub-key)** | Field encryption uses one master key for all tenants. | **MEDIUM** | Tenant provides their own KMS key; platform never sees raw. |
| **SOTA-G-13** | **External timestamping of audit chain heads** (Sigstore Rekor / eIDAS qualified time-stamp) | Hash chain is self-contained. A full-bench compromise of secret + DB rewrites history. | **MEDIUM** | Periodic checkpoint anchor of chain head into Rekor transparency log. |
| **SOTA-G-14** | **HSM/KMS-backed HMAC secret** for hash chain | `SESSION_HASH_SECRET` read from env at boot. | **MEDIUM** | Move to AWS KMS / Azure Key Vault `Sign` API with dual-control rotation. |
| **SOTA-G-15** | **Cross-model ensemble disagreement signal** | Single-model verdicts. | **MEDIUM** | For sovereign-tier decisions, run same prompt through 2-3 model families; large divergence is a defection signal. |
| **SOTA-G-16** | **System cards** (OpenAI / Anthropic pattern) | Fragmented across DPIA + model-card + sycophancy + calibration. No consolidated system card. | **MEDIUM** | Emit a per-release system card consolidating capability tests + safety evals + red-team results + scaffolding evals. |
| **SOTA-G-17** | **AIBOM dataset cards** (HF Datasets spec + EU AI Act Annex IV) | Train datasets named by hash but not card-emitted. | **MEDIUM** | Per-dataset transparency: collection, consent basis, demographic distribution, known biases. |
| **SOTA-G-18** | **Consent receipt** (Kantara) + **W3C VerifiableCredential consent** | Consent ledger is platform-internal. | **LOW** | Emit Kantara-format consent receipt the subject can download + bring to other controllers. |
| **SOTA-G-19** | **Semantic citation verifier** (not regex) for constitution citations | Regex-only — can be gamed by literal string emission. | **LOW** | Cosine similarity between rationale span and clause `principle`. |
| **SOTA-G-20** | **EU AI Act GPAI Code of Practice compliance** (Aug 2026 enforcement) | LITFIN DPIA + model cards + fairness reports cover most of GPAI requirements but no compliance map. | **HIGH (Aug 2026)** | Compliance crosswalk doc; gap-analysis vs final Code of Practice. |

---

## 4. Bidirectional porting

### 4.1 LITFIN → BOSSNYUMBA (port these to property-management context)

| Port-ID | LITFIN artifact | BOSS adaptation | Effort | Why |
|---|---|---|---|---|
| **PORT-L→B-01** | **Constitution v1 + citation verifier** (`src/core/governance/constitution/litfin-constitution.ts:1-249`) | Author `BOSSNYUMBA_CONSTITUTION_V1` with 10-12 clauses adapted to property mgmt: TENANT-TIER-POLICY · FOUR-EYE-ON-EVICTION · LEASE-IMMUTABILITY · BRAND-DISCIPLINE · STYLE · DECISION-TRACE · MEMORY-SCOPE · AUTOPOIESIS-SCOPE · SANDBOX · RIGHT-TO-EXPLANATION · ARREARS-LADDER-DISCIPLINE · UNIT-DATA-RESIDENCY. Same `severity: warn|block_and_log|refuse` ladder. Same `verifyCitations` regex pattern. Wire into `packages/central-intelligence/src/kernel/four-eye-approval.ts:118` so sovereign tool calls must cite. | **2-3 days** | Single biggest gap. BOSS has no constitution scaffold. Constitutional AI is the SOTA for autonomy governance per Anthropic + OpenAI. |
| **PORT-L→B-02** | **Defection probe (5 behavioural signatures)** (`src/core/governance/probes/defection-probe.ts:1-246`) | Drop into `packages/central-intelligence/src/kernel/probes/defection-probe.ts`. Adapt signatures: keep `evade` + `overconfidence` + `policy_drift` + `tool_jailbreak`; replace `em_dash_violation` with `arrears-ladder-violation` (BOSS-specific style). Wire to migration for `defection_probe_scores` table. Auto-throttle on `verdict: block`. | **2 days** | Closes a major sleeper-agent gap. Wires to BOSS's existing killswitch path. |
| **PORT-L→B-03** | **Alignment-faking probe (audit-on/off divergence)** (`src/core/brain/alignment-faking-probe.ts`) | Drop into `packages/central-intelligence/src/kernel/probes/alignment-faking-probe.ts`. Inject `[AUDIT_MODE=true/false]` on a sampled fraction of decision contexts. Score divergence on (flip, numeric Δ, text Jaccard, tool-set diff). | **1-2 days** | BOSS has NO alignment-faking detection. Sleeper-agent class. |
| **PORT-L→B-04** | **Tier policy reason-based resolver pattern** (`src/core/governance/tier-policy/reason-based-resolver.ts:1-347`) | BOSS's `kernel/four-eye-approval.ts` has open `toolName` string. Replace with declarative `ApprovalActionType` enum + `PolicyRule` table with `reason` / `principle` / `examples` / cosine-match fallback. | **3 days** | BOSS's open `toolName` is documented gap (parity doc §6.5). Reason-based resolver is Constitutional AI v2 pattern. |
| **PORT-L→B-05** | **Plan-artifact emission on every `proposePlan` call** (`src/core/sovereign-brain/actions/approval-gate.ts:115-168`) | BOSS's `four-eye-approval.ts` proposer sees `summary + toolName + payload` only. Add lazy `proposePlan({tier, steps, risks, reversal, …})` emission so approvers see structured plans. | **1 day** | Apollo Research 2025 cites structured-plan approval as critical for deceptive-alignment defence. |
| **PORT-L→B-06** | **Three-level killswitch (HALT/PAUSE/THROTTLE) + cross-instance refresh** (`src/core/brain/killswitch.ts:1-284`) | BOSS has `packages/central-intelligence/src/kernel/killswitch.ts` (parity unclear). Adopt 3-level pattern + `assertChannelAllowed(channel, action)` + `assertNotHaltedFresh` for sovereign paths. | **2 days** | EU AI Act Art. 14 + Colorado AI Act + ISO 42001 §9 require discrete escalation tiers. |
| **PORT-L→B-07** | **Auto-killswitch escalation cascade** (NEW — fix to SOTA-G-07) | After PORT-L→B-02 lands the defection probe, wire `verdict: block` + persona-drift L2 > 0.15 + N inviolable refusals → auto-`assertChannelAllowed('sovereign', …) === false`. | **1 day** | Close the cascading-guardrail-failure → manual-killswitch gap. |
| **PORT-L→B-08** | **Constitution-of-tools YAML policies** (`src/core/security/policies/*.yaml` + `policy-engine.ts:1-322`) | Author 4 YAML policies for BOSS: `tenant-agent.yaml`, `owner-agent.yaml`, `estate-manager-agent.yaml`, `sovereign-agent.yaml`. Each declares `allowedTools` / `deniedTools` (glob) / `allowedDbTables` / `deniedDbTables` / `networkEgress` (allowlist!) / `humanApproval` / `audit.hashChain` / `audit.retentionYears` / `actionClassification` (sensitivity × reversibility × scope × compliance). Run in worker-thread for isolation. | **3-4 days** | BOSS has no equivalent. Network-egress allowlist closes ASI06 + LLM02 exfil class. |
| **PORT-L→B-09** | **Intent verifier (NemoClaw-equivalent dual-layer)** (`src/core/security/intent-verifier.ts:1-721`) | Drop into `packages/central-intelligence/src/kernel/intent-verifier.ts`. Adapt: keep SQL-injection + exfil-endpoint + prompt-injection-in-args + scope-escalation patterns. Wire AFTER LLM proposes tool calls, BEFORE execution. | **2 days** | BOSS has no equivalent. Closes a major ASI04 + ASI05 gap. |
| **PORT-L→B-10** | **Canary tokens** (`src/core/litfin-ai/security/canary-tokens.ts:1-90`) | Drop into `packages/ai-copilot/src/security/canary-tokens.ts`. Inject `[INTERNAL_VERIFICATION: …]` markers; detect on output. Use crypto-random (not Math.random) and per-tenant registry. | **0.5 day** | BOSS already has `packages/ai-copilot/src/security/canary-tokens.ts` — verify it matches LITFIN's pattern + close the Math.random gap on both sides. |
| **PORT-L→B-11** | **OCSF audit events** (`src/core/security/ocsf-audit.ts:1-588`) | Drop into `packages/observability/src/security/ocsf-audit.ts`. Emit OCSF v1.1 for authentication, authorize, web-resources, app-lifecycle, API-activity, security-finding events. | **2 days** | Industry-standard schema; eases SIEM integration. |
| **PORT-L→B-12** | **Decision-trace OTEL exporter** (`src/core/governance/decisions/decision-trace-otel-exporter.ts:1-217`) | Drop into `packages/observability/src/decision-trace-otel.ts`. Export decision traces as OpenTelemetry spans. | **1-2 days** | Standardised observability for regulator-grade decision review. |
| **PORT-L→B-13** | **CSRF ESLint custom rule** (`eslint-rules/require-csrf-headers.js`) | Drop into BOSS's `eslint.config.mjs`. Warns when client-side mutating fetch lacks `getCsrfHeaders` import. | **0.5 day** | Pure-add static check. |
| **PORT-L→B-14** | **Cross-org-denial recorder pattern + denial scanner** (`src/core/security/cross-org-denials/denial-recorder.ts:1-197` + `denial-scanner.ts:1-181` + migration `20260722_cross_org_denials.sql`) | BOSS has the migration shipped (`0153_cross_tenant_denials.sql`) but wiring is the remaining Phase D9 task per `05-security-dna.md` status block. Port LITFIN's recorder + scanner. | **1 day** | Direct close of identified gap. |
| **PORT-L→B-15** | **Inviolable refusal — IP-internal + IP-secret + IP-copyright triad** (`src/core/brain/inviolable.ts:46-104`) | BOSS gates these at output layer; LITFIN gates at input. Port LITFIN's regex sets to add `ip_internal`, `ip_secret`, `ip_copyright` to `packages/central-intelligence/src/kernel/inviolable.ts`. | **1 day** | Defence-in-depth. |
| **PORT-L→B-16** | **Hooks DSL PreToolUse/PostToolUse (allow/deny/ask/defer/mutate)** (`src/core/governance/hooks/*.ts:1067`) | BOSS may have partial coverage. Port LITFIN's full DSL + tenant_governance_hooks + tenant_hook_audit_log tables. | **3-4 days** | Tenant-extensible governance is Claude-Code-parity. |
| **PORT-L→B-17** | **Adverse-action faithfulness audit** (`src/core/audit/adverse-action-faithfulness.ts`) | BOSS lacks this entirely. Property management's analogue is "denial-of-tenancy faithfulness" — every rejection must cite the actual reason + counterfactual. | **2 days** | CFPB Reg B-style discipline for property denials. |
| **PORT-L→B-18** | **PDPA-2022 compliance map pattern** (`Docs/compliance/tanzania/PDPA-2022-COMPLIANCE-MAP.md`) | Author `BOSSNYUMBA101/Docs/compliance/tanzania/PDPA-2022-COMPLIANCE-MAP.md` mirroring 25-article matrix mapping each article → file:line. | **1 day** | Regulator-inspection-ready. |
| **PORT-L→B-19** | **Regulator-sim packs (BoT supervision + PDPA readiness + audit-replay)** (`src/core/security/regulator-sim/*.ts:601`) | Adapt to property mgmt: NPRA (TZ National Pension), Land Court, Estate Agents Act. | **3 days** | Regulator-pack generation as code. |
| **PORT-L→B-20** | **Sycophancy + Calibration CI gates** (`src/core/security/sycophancy-probe/` + `calibration-eval/`) | Drop into BOSS CI; adapt eval cases to property domain. | **2 days** | LLM09 misinformation defence. |

### 4.2 BOSSNYUMBA → LITFIN (port these back; LITFIN already lags here)

Per `06-data-protection.md` status block: BOSS is AHEAD on 5 of 7 data-protection axes. The following should port back:

| Port-ID | BOSS artifact | LITFIN adaptation | Effort |
|---|---|---|---|
| **PORT-B→L-01** | **DP Gaussian mechanism** (`packages/graph-privacy/src/noise.ts:21-36`) | LITFIN's `src/core/anonymization/differential-privacy.ts` is Laplace-only. Add Gaussian mechanism for tighter composition. | 1 day |
| **PORT-B→L-02** | **Crypto-RNG for noise sampling** (BOSS uses `crypto.randomBytes` rejection-sampled) | LITFIN's `core/graph/meta/differential-privacy.ts:58-83` uses `Math.random()` — security gap. Replace with crypto-RNG. | 0.5 day |
| **PORT-B→L-03** | **Advanced composition + persistent budget ledger** (`packages/graph-privacy/src/budget-ledger.ts:147-158`) | LITFIN's `computePrivacyBudget` is pure / non-persistent — restart resets ε. Add persistent ledger with advanced composition. | 1-2 days |
| **PORT-B→L-04** | **AsyncLocalStorage `runWithTenantContext` + `TenantScoped` generic** (`packages/ai-copilot/src/security/tenant-isolation.ts:41-272`) | LITFIN's `tenant-isolation.ts` lacks type-level scope binding. Port the generic. | 1-2 days |
| **PORT-B→L-05** | **Tier-scaled k-anonymity** (`packages/central-intelligence/src/kernel/cohort-signal.ts:75`) | LITFIN uses single global k=5. BOSS uses lattice 5→7→10→15→20→25 by tier. | 1 day |
| **PORT-B→L-06** | **Persona-vector probe schema cleanup** — BOSS's `PersonaDriftEvent` (`kernel-types.ts:322-333`) is more cleanly typed | Refactor LITFIN's pipeline-event-blob into typed schema. | 0.5 day |
| **PORT-B→L-07** | **Field-level encryption-at-rest with KMS-rotation hook** (BOSS migration `0143_field_encryption_audit.sql` + 11 source files + 48 tests) | LITFIN has field-encryption.ts but per `06-data-protection.md` BOSS is more thorough with audit. Port BOSS's audit trail. | 2 days |

---

## 5. Top-10 actions (prioritised, with owners)

| Rank | Action | Owner (existing module) | Severity | Effort | Closes |
|---|---|---|---|---|---|
| **1** | **Port LitFin Constitution v1 + citation verifier into BOSSNYUMBA** (PORT-L→B-01) | `packages/central-intelligence/src/kernel/constitution/` (new) | CRITICAL | 2-3d | Constitutional AI gap (Anthropic + OpenAI SOTA) |
| **2** | **Add AI BOM (CycloneDX 1.6) + Sigstore Cosign signing + Rekor logging for every model artifact** (SOTA-G-01) | `packages/database/src/model-registry/` + new `packages/ai-attestation/` | CRITICAL | 3-5d | LLM03 supply chain, EU AI Act GPAI Code of Practice (Aug 2026) |
| **3** | **Confidential-compute path for sovereign-tier inference** (SOTA-G-02 + SOTA-G-06) | Infra + `packages/central-intelligence/src/kernel/sovereign/` | CRITICAL (sovereign tier) | 5-10d | LLM02, residency, activation-probe enablement |
| **4** | **Indirect-prompt-injection defence on ALL tool outputs** (SOTA-G-05) | `packages/ai-copilot/src/security/prompt-shield.ts` + new tool-result-shield | HIGH | 2-3d | LLM01 2025 extension (Liu PromptArmor) |
| **5** | **Port defection probe + alignment-faking probe + wire to auto-killswitch escalation** (PORT-L→B-02 + L→B-03 + L→B-07) | `packages/central-intelligence/src/kernel/probes/` (new) | HIGH | 4-5d | Sleeper-agent class (Hubinger 2024, Apollo Research 2025) |
| **6** | **MITRE ATLAS coverage map + Garak/PyRIT CI integration** (SOTA-G-03) | `tests/redteam/` (new) | HIGH | 3-5d | LLM01-LLM10 adversarial coverage |
| **7** | **Capability tokens (Biscuit/Macaroon) for OBO + delegation chains** (SOTA-G-04) | `packages/authz-policy/src/capability-tokens/` (new) | HIGH | 5-7d | ASI10 multi-agent trust, who-is-acting attestation |
| **8** | **Port LitFin YAML policy engine + worker-thread isolation + 4 tier-policies + intent verifier** (PORT-L→B-08 + L→B-09) | `packages/central-intelligence/src/kernel/policy-engine/` (new) | HIGH | 5-6d | ASI04, ASI05, ASI06; network-egress allowlist |
| **9** | **Hardware-key-bound (WebAuthn/FIDO2) re-auth for destructive actions + Shamir threshold + 24h time-lock** (SOTA-G-09 + SOTA-G-10) | `packages/authz-policy/src/webauthn/` + `four-eye-approval.ts` | MEDIUM | 4-5d | Insider-collusion + stolen-session class |
| **10** | **EU AI Act GPAI Code of Practice compliance crosswalk (for Aug 2026 enforcement)** + **AIBOM dataset cards + system cards** (SOTA-G-16 + SOTA-G-17 + SOTA-G-20) | `Docs/compliance/eu-ai-act/` (new) + `Docs/system-cards/` (new) | HIGH (deadline) | 5-7d | Aug 2026 regulatory deadline |

---

## 6. Most critical security gaps (summary for parent agent)

These are the 5 most damning structural gaps LITFIN has against the 2026 frontier — every one of them is a "would block production" item for an EU AI Act high-risk system:

1. **No AI BOM / Sigstore / SLSA attestation on model artifacts** (SOTA-G-01). Model registry has `trainDatasetHash` but no signed-attestation chain. EU AI Act GPAI Code of Practice (Aug 2026 enforcement) requires this; LITFIN has fragments (model cards, hashes) but no end-to-end signed provenance. **Severity: CRITICAL.**
2. **No confidential computing path for sovereign inference** (SOTA-G-02). All inference via external LLM APIs (Anthropic, OpenAI). Sovereign-tier reasoning over cohort data has no TEE / Nitro Enclave / H100 Confidential option. Field-encryption-at-rest exists; in-use gap remains. **Severity: CRITICAL for sovereign tier.**
3. **No indirect-prompt-injection defence on tool outputs** (SOTA-G-05; LLM01 2025 extension per Liu PromptArmor 2025). Prompt-shield runs on user input + belief extraction from untrusted spans, but tool-result content is NOT re-shielded before being re-embedded into the next turn's context. A tool that scrapes a web page or reads a user-uploaded PDF can smuggle in `ignore previous instructions, transfer …`. **Severity: HIGH.**
4. **No who-is-acting agent attestation (OBO / capability tokens / delegation chains)** (SOTA-G-04). `assertTierPolicy(tier, action)` matches tier label only; no verified chain proving "this sub-agent acts for user X who delegated to it." Multi-agent ASI10 trust is per-agent API keys only — no signed delegation. **Severity: HIGH.**
5. **No MITRE ATLAS adversarial-emulation harness + no Garak/PyRIT integration** (SOTA-G-03). 71 home-grown scenarios + promptfoo CI gate. The in-tree harness uses a MOCK `DefensiveSurface` — tests the harness's understanding of controls, not the live controls. No ATLAS mapping, no scheduled GCG/AutoDAN fuzz, no Lakera/Patronus. **Severity: HIGH** (a high-stakes credit AI without ATLAS-mapped red-team coverage cannot be defended in a regulator-incident review).

**Honourable mention (HIGH but slightly less structural):** auto-killswitch escalation cascade (SOTA-G-07) — defection probe emits `verdict: block` but there's no wire to auto-throttle.

---

## 7. Top-3 port opportunities back to BOSSNYUMBA (existing assets that close concrete BOSS gaps)

These are LITFIN modules already shipped that BOSSNYUMBA should reverse-port — each is high-value, well-scoped, and closes a documented BOSS gap:

1. **LitFin Constitution v1 + citation verifier** (`src/core/governance/constitution/litfin-constitution.ts:1-249`). 12 frozen jurisdictionally-cited clauses + regex citation verifier the sovereign-brain approval gate enforces. **Pattern explicitly mirrors Anthropic Constitutional AI v3 + OpenAI Deliberative Alignment.** BOSS has NO constitution scaffold. Single biggest-leverage port — 2-3 days of work, closes Constitutional-AI gap. Port-ID **PORT-L→B-01**.
2. **Defection probe (5 behavioural signatures) + alignment-faking probe + wire to auto-killswitch escalation** (`src/core/governance/probes/defection-probe.ts:1-246` + `src/core/brain/alignment-faking-probe.ts`). Behaviour-based sleeper-agent classifier per Anthropic 2024 + Hubinger 2024 + Apollo Research 2025. BOSS has NO sleeper-agent or alignment-faking detection. 4-5 days combined including the auto-killswitch wire (also fixes SOTA-G-07 on both sides). Port-IDs **PORT-L→B-02 + L→B-03 + L→B-07**.
3. **YAML policy engine + 4 tier-policies + worker-thread isolation + intent verifier (NemoClaw-equivalent dual-layer)** (`src/core/security/policy-engine.ts:1-322` + `policy-worker.ts:1-509` + `policies/*.yaml` + `intent-verifier.ts:1-721`). Deny-by-default tool execution + network-egress allowlist (e.g. blocks `webhook.site`, `ngrok.io`, `pipedream`, `interact.sh` and 8 more exfil endpoints by default) + SQL-injection + scope-escalation pattern catch. BOSS has open `toolName` strings and no equivalent egress allowlist. 5-6 days combined. Port-IDs **PORT-L→B-08 + L→B-09**.

---

## 8. End of audit

**Total files cited (LITFIN):** ~95 .ts + 4 .yaml + 14 .md + 30+ migrations.
**Total LOC inventoried (security/governance/compliance):** ~28,000 LOC source + ~2,400 LOC docs + 16+ RLS migrations.
**Total subsystem cards:** 16 (SC-01 through SC-16).
**SOTA gaps identified:** 20 (SOTA-G-01 through SOTA-G-20).
**Bidirectional port items:** 27 (20 LITFIN → BOSS + 7 BOSS → LITFIN).
**Top-10 priority actions:** ranked + sized + owner-assigned.

LITFIN's security DNA is impressive in **breadth + jurisdictional discipline + constitutional-AI alignment-pattern adoption**. The weak axis is **frontier-2026 supply-chain attestation + confidential compute + activation-level probes + ATLAS-mapped adversarial harness**. The strongest single contribution back to BOSSNYUMBA is the **Constitution + citation verifier + defection / alignment-faking probes** — three modules that together promote BOSS from "good guardrails" to "Anthropic / OpenAI tier deliberative-alignment posture."

---

*Audit prepared 2026-05-23 against LITFIN baseline (HEAD) and BOSSNYUMBA101 .planning/parity-litfin/2026-05-18 status. Cited paths are absolute within each project root.*
