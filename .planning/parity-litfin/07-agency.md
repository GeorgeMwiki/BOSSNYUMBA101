# Agency Layer Parity — LITFIN vs BOSSNYUMBA101

> **Status as of 2026-05-18** — see `00-STATUS-2026-05-18.md`. Of the 9 missing + 4 partial items below, **7 are now SHIPPED** and **2 are in-flight in Phase D2 + D12 (DAG / step-deadline / blockers; four-eye recall + plan-artifact + executed flag)**. Original gap prose preserved; SHIPPED items overlaid below.
>
> Headline shipments:
> - ✅ **Hash-chained sovereign-ledger with `pg_advisory_lock`** — `packages/database/src/services/sovereign-action-ledger.service.ts:182+,399` + migration `0129_sovereign_action_ledger.sql`. Closes gaps 4b (hash-chained ledger) + 4d (retention).
> - ✅ **Role-gated approval** — `kernel/four-eye-approval.ts:46-78,210-224` (closes gap 6c). Role-groups + slot-filling logic.
> - ⚠️ **Per-action expiry + recall window** — `kernel/four-eye-approval.ts:59` `maxStaleMinutes` per-action; **Phase D12** ships full recall API + window (closes gaps 6e, 6f).
> - ✅ **Stall detector** — `kernel/agency/stall-detector.ts:263-355` (closes gap 7c). Auto-flips `active → blocked` on N-day inactivity.
> - ✅ **Wake-loop scheduled cron** — `services/api-gateway/src/composition/wake-loop-cron.ts:361` + `k8s/wake-loop-cron.yaml` (closes gap 7b).
> - ✅ **Counter-model LIVE in sovereign.ts** — Phase C C1 commit `b3639d11`. The counter-model module under `kernel/counter-model/` is now invoked inline at sovereign decision-time.
> - ✅ **4 HQ wake triggers** — `kernel/agency/wake-triggers/` registers: `subscription-churn`, `ai-cost-overrun`, `webhook-dlq-depth`, `persona-drift-breach`. Added to `DEFAULT_WAKE_TRIGGERS`.
> - ✅ **18-tool typed-action bus** — `kernel/tool-spec.ts:510` + 18 `platform.*` tools (`platform.file_kra_mri`, `platform.kill_sensor`, `platform.rebalance_routing`, etc.). **BOSSNYUMBA AHEAD** — zero LITFIN counterpart. See `00-STATUS-2026-05-18.md` §3 item 3.
> - ⚠️ **DAG + step-deadline + blockers on goal steps** — Phase D12 in flight (closes gaps 2b, 2c, 2d).
> - ⚠️ **Rollback payload on sovereign ledger** — migration `0144_sovereign_ledger_rollback_payload.sql` SHIPPED (Phase D2; closes gap 4c). Wiring into `recordExecution` is the remaining D2 task.
> - ⚠️ **Four-eye `executed` flag + plan-artifact emission** — migration `0145_approval_executed_flag.sql` SHIPPED (Phase D2; closes gap 6i). Emission into brain outbox is the remaining D2 task.

P7 of the 10-agent parity sweep. Read-only analysis of the agency layer:
persistent goals, executor, action audit, autonomy policy, sovereign approvals,
and the ambient wake-loop.

- **LITFIN**: `src/core/sovereign-brain/` (sovereign tier) + `src/core/litfin-ai/planning/long-horizon-planner.ts` (persistent borrower/officer plans) + `src/core/governance/four-eye/` (approval queue/policy) + `src/core/litfin-ai/actions/action-executor.ts` (tool dispatcher)
- **BOSSNYUMBA**: `packages/central-intelligence/src/kernel/agency/` (goals + executor + autonomy-policy + wake-loop) + `packages/central-intelligence/src/kernel/four-eye-approval.ts` + `packages/database/src/{schemas,services}/kernel-{goals,action-audit}.{schema,service}.ts`, `autonomy.schema.ts`, `sovereign-approvals.schema.ts`

LITFIN's agency layer is split between TWO programs: (a) **sovereign-tier**
cross-org platform actions (hash-chained ledger, four-eye policy table,
risk-scorer, action-types-as-enum) that target the *platform operator* and
(b) **long-horizon plans** (active/stalled/self_healing/completed/abandoned
+ milestones + blockers + health score + decompose/escalate/nudge proposals)
that target *individual borrowers and officers*. BOSSNYUMBA unifies both
under one **kernel agency** layer: per-tenant persistent `Goal` records with
typed `GoalStep[]`, an autonomous **executor** that walks the steps, a
per-tenant **autonomy-policy** that decides autonomous-vs-approval, a
hash-chained four-eye **sovereign-approvals** store, and an ambient
**wake-loop** with three default triggers. BOSSNYUMBA's design is the
property-management equivalent of LITFIN's two-track agency, collapsed.

## Summary

| # | LITFIN feature (canonical) | LITFIN ref | BOSSNYUMBA ref | Status | Gap |
|---|---|---|---|---|---|
| 1 | Persistent objective lifecycle states | `long-horizon-planner.ts:23-28` `active|stalled|self_healing|completed|abandoned` | `agency/goals/types.ts:15-20` `active|paused|blocked|completed|abandoned` | NAMED-DIFFERENTLY | Same 5-card cardinality but two cards differ: LITFIN has `stalled` + `self_healing` (auto-detected by stall sweep); BOSSNYUMBA has `paused` (user-initiated) + `blocked` (waiting on approval/dep). Neither has the other's mode. |
| 1a | Goal-level priority | — | `agency/goals/types.ts:22` `low|medium|high|critical` | EXTENDED IN BOSSNYUMBA | LITFIN's plan record carries `tier` (`borrower`/`officer`/etc.) but no priority axis. |
| 2 | Goal step JSON shape | `long-horizon-planner.ts:30-37` `{id, label, done, due, completedAt, dependsOn}` | `agency/goals/types.ts:31-42` `{id, seq, description, toolName, toolPayload, status, startedAt, endedAt, outcome, errorMessage}` | NAMED-DIFFERENTLY | LITFIN steps are *milestones* (deadline + dependency graph, no tool call); BOSSNYUMBA steps are *executable tool invocations* (toolName + toolPayload). Different cognitive substrates. |
| 2a | Step status enum | implicit via `done:boolean` (`long-horizon-planner.ts:32`) | `agency/goals/types.ts:24-29` `pending|running|done|failed|skipped` | EXTENDED IN BOSSNYUMBA | LITFIN has a 2-state step (done/not); BOSSNYUMBA has a 5-state machine + `awaiting-approval` carried as an `outcome` string marker (`executor.ts:267-274`). |
| 2b | Step dependency graph (DAG) | `long-horizon-planner.ts:37` `dependsOn:string[]` + `computePlanHealth` checks `blocked` (`long-horizon-planner.ts:206-210`) | — | MISSING | BOSSNYUMBA steps are strictly sequential by `seq` (`executor.ts:83`). No dependency edges, no fan-out. |
| 2c | Step deadline (due date) | `long-horizon-planner.ts:35` `due` per milestone | — | MISSING | BOSSNYUMBA has no per-step deadline. The goal lacks a deadline field entirely (vs LITFIN `LongHorizonPlan.deadline`, `long-horizon-planner.ts:56`). |
| 2d | Step blockers list | `long-horizon-planner.ts:39-45` `PlanBlocker[]` with `raisedAt`/`resolvedAt` | — | MISSING | BOSSNYUMBA encodes blockage via the `blocked` goal status only — no separate blocker entity. |
| 3 | Executor transition states | implicit / no explicit step-walking executor; LITFIN runs *tools* (`action-executor.ts:90-317`) per-turn but not goal-bound | `agency/executor/executor.ts:51-53` `executeGoal` walks steps emitting `running|done|failed|awaiting-approval|skipped|unknown-tool` | EXTENDED IN BOSSNYUMBA | LITFIN has no equivalent of "autonomous executor that walks a persisted goal". `executeActions` (`action-executor.ts:90`) runs a batch of tool calls in one turn; goal-tracking lives in `long-horizon-planner` but is not auto-executed. |
| 3a | Bail-on-failure semantics | — | `agency/executor/executor.ts:85-87,165,213,262,332` `bailed = true` skips subsequent steps | EXTENDED IN BOSSNYUMBA | No LITFIN equivalent (LITFIN's action-executor batches independent tool calls). |
| 3b | Auto-complete the goal | — | `executor.ts:359-366` flips goal to `completed` when every step is `done` | EXTENDED IN BOSSNYUMBA | LITFIN's plan stays `active` until an external write moves it; no auto-promotion. |
| 4 | Action audit fields | `audit-ledger.ts:30-71` (sovereign hash-chained: `action_type, actor_user_id, actor_session_id, target_org_id, target_resource_id, proposed_payload, risk_score, risk_band, approval_required, approval_quorum, state, executed_at, result_payload, rollback_payload, prev_hash, this_hash`) | `kernel-action-audit.schema.ts:18-48` (`tenantId, userId, goalId, stepId, toolName, decision, payloadHash, outcome, errorMessage, startedAt, endedAt, latencyMs, capturedAt`) | NAMED-DIFFERENTLY | Same intent (audit a privileged action) but disjoint field sets. LITFIN ledger is **hash-chained** (`prev_hash`/`this_hash`) for tamper-evident replay + carries a **rollback_payload**; BOSSNYUMBA logs **latencyMs** + step-level granularity (per-step transition) which LITFIN does not. |
| 4a | Payload hashing | implicit in `computeLedgerHash` (`audit-ledger.ts:77-100`) — hashes the *whole row*, not just the payload | `audit-sink.ts:38-49` `hashPayload(payload)` — SHA-256 over canonical-key-sorted JSON, **payload only** | NAMED-DIFFERENTLY | Both hash. BOSSNYUMBA hashes only the tool payload (lets the audit prove "the same payload ran twice"); LITFIN's hash binds the row to its predecessor for chain-of-custody. |
| 4b | Hash-chained ledger (prev_hash / this_hash) | `audit-ledger.ts:46-71,77-100,260-299` (`verifyLedgerChain`, GENESIS_HASH, full re-derive) | — | MISSING | BOSSNYUMBA's audit table is append-only but NOT hash-chained. Tampering a past `kernel_action_audit` row is undetectable. |
| 4c | Rollback payload | `audit-ledger.ts:41,66,148` `rollback_payload` carried per row | — | MISSING | BOSSNYUMBA does not persist a per-action reversal blob. |
| 4d | Retention / cleanup | not explicit in source; cap is `verifyPersistedChain(limit=1000)` for verification window (`audit-ledger.ts:307`) | not explicit | PARITY | Neither codebase declares a retention window in the schema/service layer. Both are effectively infinite-retain until ops intervenes. |
| 5 | Autonomy / risk classifier | `sovereign-brain/actions/risk-scorer.ts:46-128` numeric 0-100 score → band `low|medium|high|critical`, factors `blast_radius|after_hours|novel_target|burst_pattern|irreversible` | `agency/action-tools/types.ts:9` `stakes: 'low'|'medium'|'high'|'critical'` declared per-tool at registration | NAMED-DIFFERENTLY | LITFIN computes risk **per call** from runtime context (affected-org-count, recent-bursts, business-hours); BOSSNYUMBA pins it **statically per tool** at registration. LITFIN's design adapts; BOSSNYUMBA's is simpler but cannot detect novel-target or burst patterns. |
| 5a | Per-stake auto-approve rules | implicit in `evaluateGate` (`approval-gate.ts:194-227`): `low` band auto-execute; medium/high require approval id; critical requires 2-of-N quorum | `executor/autonomy-policy.ts:36-53` (default) + `autonomy-policy.service.ts:78-91` schema: `actions.{toolName}: {authorized, requiresApproval}` and `stakes.{low|medium|high|critical}: {authorized, requiresApproval}` | PARITY | Same intent, different shape. BOSSNYUMBA's per-tenant `policy_json` allows operators to flip rules per-tool OR per-stake; LITFIN's gate is hard-coded per band. BOSSNYUMBA's `defaultAllowLowStakes` (`autonomy-policy.service.ts:55-71`) matches LITFIN's default. |
| 5b | Stake categories carried into gate | `approval-gate.ts:178-227` `riskTier: low|medium|high|critical` | `executor.ts:55-56,414-417` `approvalStakeFor(tool.stakes)` → `'medium'|'high'|'critical'` (low maps up to medium) | PARTIAL | LITFIN preserves all four; BOSSNYUMBA folds `low` into `medium` at the gate boundary so `low` cannot route through the gate at all (it must be autonomous or the executor would request `medium`-stake approval). This is a defensible choice but reduces granularity. |
| 5c | Per-tenant autonomy config | — (LITFIN policies are platform-wide in `policy.ts:32-154`) | `autonomy.schema.ts:24-51` `autonomy_policies` table per `tenant_id` + `autonomous_mode_enabled` master switch | EXTENDED IN BOSSNYUMBA | LITFIN's approval-policy table is hard-coded `APPROVAL_POLICIES` (`policy.ts:32-154`); a tenant cannot raise/lower their own threshold. BOSSNYUMBA's is tenant-scoped per migration 0080. |
| 5d | Master autonomous-mode kill-switch | — | `autonomy.schema.ts:30-32` `autonomousModeEnabled` + service `autonomy-policy.service.ts:175-177` falls back to default-allow-low-stakes when off | EXTENDED IN BOSSNYUMBA | LITFIN has no per-tenant kill of autonomous behaviour. |
| 6 | Sovereign approval lifecycle | `four-eye/types.ts:33-38` `pending|approved|rejected|recalled|expired` + `decisions: ApprovalDecision[]` (each with `approverId, approverRole, decision, comment, decidedAt`) | `four-eye-approval.ts:25-30` `pending|one-eye|approved|rejected|expired` + `signatures: ApprovalSignature[]` (each with `approverUserId, verdict, comment, signedAt`) | NAMED-DIFFERENTLY | Both 5-state. LITFIN has explicit `recalled` (initiator pulls within window — `policy.ts:42,84,150,153` recallWindowMinutes); BOSSNYUMBA has explicit `one-eye` (interim state after first signature, before second). Effectively `pending = one-eye-needs-second` for LITFIN since the approve count is tracked by `decisions.length`. |
| 6a | Self-approval forbidden | `types.ts:94` `self_approval_forbidden` outcome code + queue rejects | `four-eye-approval.ts:118-120` throws "proposer cannot self-approve" | PARITY | Both block. LITFIN returns a typed outcome; BOSSNYUMBA throws. |
| 6b | Duplicate signature forbidden | `types.ts:98` `duplicate_decision` outcome | `four-eye-approval.ts:121-123` throws "approver has already signed" | PARITY | Same rule. |
| 6c | Role-gated approval (which roles can sign) | `policy.ts:18-30,175-199` (`SUPER_ADMIN_ONLY`, `FINANCE`, `RISK_OR_COMPLIANCE`, `BANK_ADMIN_ONLY` slot-filling) + `roleCanFillSlot()` | — | MISSING | BOSSNYUMBA's gate has NO role gate — any non-proposer user with API access can sign. LITFIN's `roleCanFillSlot` enforces "1 SUPER_ADMIN + 1 FINANCE", "2 SUPER_ADMINs", "RISK_OR_COMPLIANCE single", etc. This is the **biggest sovereign-tier gap** for regulator-grade controls. |
| 6d | Action-type taxonomy | `four-eye/types.ts:17-30` 13 enumerated `ApprovalActionType` values + per-type policy in `policy.ts:32-154` | `sovereign-approvals.schema.ts:44` `toolName: text` (free string) | NAMED-DIFFERENTLY | LITFIN has a curated allow-list (every action is a known type with a declared `requiredApprovals`, `autoRejectAfterHours`, `recallWindowMinutes`); BOSSNYUMBA stores the tool name as opaque text — the policy lives elsewhere (in the action-tool's `stakes` and the autonomy-policy `policy_json`). |
| 6e | Per-action expiry window | `policy.ts:41-153` per-action `autoRejectAfterHours` (1h / 12h / 24h / 48h / 72h) | `four-eye-approval.ts:79` single `DEFAULT_TTL_MS = 24 * 60 * 60 * 1000` for ALL approvals | PARTIAL | BOSSNYUMBA uses one 24h TTL for every sovereign approval; LITFIN tunes per action. A "reroute_ai_traffic" in LITFIN expires after 1h (a hot incident); a "policy_rollout" after 72h. |
| 6f | Recall window | `policy.ts:42-153` per-action `recallWindowMinutes` (5/10/15/30) | — | MISSING | BOSSNYUMBA proposers cannot withdraw a proposed action; only an approver can reject. |
| 6g | Approval gate links the executor to a step | `approval-gate.ts:115-168` `requestApproval` + the sovereign-service binds the approval id back into the action ctx (`approval-gate.ts:55-57`) | `executor.ts:222-275` proposes approval, marks step `outcome:awaiting-approval:<actionId>`, leaves step `pending` for next executor pass to retry | PARTIAL | Both link. BOSSNYUMBA's bridge is in-band (string-prefixed `outcome` marker); LITFIN's is structural (`ctx.approvalId`). LITFIN's design is harder to mis-parse; BOSSNYUMBA's is observable from the UI without joining tables. |
| 6h | Signature audit (who signed when, with comment) | `four-eye/types.ts:52-58` `ApprovalDecision[]` persisted | `sovereign-approvals.schema.ts:48` `signatures jsonb[]` (default `[]`) — each is `{approverUserId, verdict, comment, signedAt}` | PARITY | Both persist. LITFIN keeps it relational with `ApprovalRequest.decisions`; BOSSNYUMBA embeds JSON in the row. |
| 6i | Plan-as-artifact emission on approval request | `approval-gate.ts:115-168` `proposePlan` emits to brain outbox + event bus `sovereign.plan_proposed` (`approval-gate.ts:131-157`) | — | MISSING | BOSSNYUMBA stores the approval but does not emit a brain event for the smartboard/admin overlay. (BOSSNYUMBA does have an event bus — `packages/central-intelligence/src/kernel/event-bus*` — but the four-eye gate does not call it.) |
| 7 | Ambient wake-loop (brain self-wakes) | — (LITFIN has `checkPlanHealth` in `long-horizon-planner.ts:258-279` designed to be cron-driven, but no explicit cron route was found in `src/app/api/cron/`) | `agency/initiative/wake-loop.ts:66-141` `runWakeCycle({tenantIds}, {goals, executor, triggers, clock})` + `DEFAULT_WAKE_TRIGGERS` (arrears/lease-expiring/vacancy) (`wake-loop.ts:177-181`) | EXTENDED IN BOSSNYUMBA | BOSSNYUMBA ships an explicit wake-loop primitive. LITFIN has a self-heal sweep (`checkPlanHealth` + `selfHeal`, `long-horizon-planner.ts:258-375`) but it acts on EXISTING plans only — it cannot open a fresh plan from observed conditions. BOSSNYUMBA's wake-loop opens AND executes. |
| 7a | Real detectors wired | — | `agency/initiative/real-detectors.ts:1-321` defines `ArrearsReadPort`, `LeaseReadPort`, `VacancyReadPort` with real queries (per-tenant minDaysOverdue / windowDays / longVacant) | EXTENDED IN BOSSNYUMBA | LITFIN's plan-health stalls and proposes self-healing actions but does not detect *novel goals* (e.g. "this lease is about to expire, open a renewal plan"). |
| 7b | Wake-loop scheduled | — (no cron route found) | NOT WIRED — `grep -rn "runWakeCycle"` in `apps/` and `services/` returns zero hits (only the kernel-internal callers and tests). The primitive exists but no scheduler invokes it. | MISSING | BOSSNYUMBA's wake-loop is built but never triggered. To match LITFIN's intent (a brain that wakes on schedule) BOSSNYUMBA needs a cron job that calls `runWakeCycle({tenantIds:[...]})`. |
| 7c | Stall detection / self-heal proposals | `long-horizon-planner.ts:189-252,289-341` (`computePlanHealth`, `proposeSelfHealingActions` with `nudge|decompose|escalate` categories) | — | MISSING | BOSSNYUMBA has no stall detection on an existing goal. Steps go `pending` indefinitely if the executor never gets called again. |
| 8 | Decision-trace emission | `sovereign-service.ts:170-258` `startTrace` + `recorder.considerTool` + `recorder.useTool` + `recorder.finalize` to Supabase | `executor.ts:99-355` audit-sink records every transition; no separate decision-trace recorder | NAMED-DIFFERENTLY | LITFIN's sovereign chat emits a constitution C-08 DecisionTrace (input/output hashes + every tool); BOSSNYUMBA's executor emits per-step audit rows. Different granularity. (See P1 for the kernel-side trace bootstrap gap.) |
| 9 | Plan decomposer (LLM-based) | — (LITFIN's plan is human-authored via `createPlan(input)` `long-horizon-planner.ts:153-184`) | `agency/goals/plan-decomposer.ts:39-58` single Haiku call with tool registry → JSON `DecomposedStep[]` | EXTENDED IN BOSSNYUMBA | BOSSNYUMBA can ask an LLM to break a goal into steps. LITFIN expects the caller to ship pre-shaped milestones. |

**Counts**
- Full parity: 3 (4d retention, 6a self-approval, 6b duplicate-signature, 6h signature audit)
- Partial: 4 (5b stake categories carried to gate, 6e per-action expiry, 6g executor↔step link, 5a per-stake rules)
- Named-differently: 7 (1 lifecycle states, 2 step JSON shape, 4 audit field set, 4a payload hashing, 5 risk classifier, 6 approval lifecycle, 6d action-type taxonomy, 8 decision-trace)
- Missing in BOSSNYUMBA: 9 (2b step DAG, 2c step deadline, 2d blockers, 4b hash-chained ledger, 4c rollback payload, 6c role-gated approval, 6f recall window, 6i plan-artifact emission, 7b wake-loop scheduled, 7c stall detection)
- Extended in BOSSNYUMBA only: 9 (1a goal priority, 2a step-status enum, 3 executor.executeGoal, 3a bail-on-failure, 3b auto-complete goal, 5c per-tenant autonomy config, 5d master kill-switch, 7 wake-loop primitive, 7a real detectors wired, 9 plan decomposer)

## Detailed gaps

### Gap A — Goal lifecycle states (NAMED-DIFFERENTLY)
- LITFIN: `active|stalled|self_healing|completed|abandoned` (`long-horizon-planner.ts:23-28`). The `stalled` and `self_healing` cards are **auto-detected**: `computePlanHealth` flips `active→stalled` when `daysSinceLastAction >= 3` (`long-horizon-planner.ts:236-238`); `selfHeal` flips to `self_healing` after proposing actions (`long-horizon-planner.ts:362-369`).
- BOSSNYUMBA: `active|paused|blocked|completed|abandoned` (`agency/goals/types.ts:15-20`). `paused` is user-initiated (no auto-flipper found); `blocked` means waiting on approval/dep (set by the executor when a step routes through the gate? — actually the executor leaves the GOAL `active` and only marks the STEP — so `blocked` is currently unused by the executor).
- Behavioural diff: BOSSNYUMBA cannot show "this goal has stalled for 3 days" or auto-propose self-healing. Goals are either being worked on (`active`) or done.
- Closure effort: **moderate**. Port LITFIN's `STALL_DAYS_THRESHOLD` constant + a `computeGoalHealth(goal, now)` pure function + a sweep that flips `active→blocked` when no executor activity for N days. Re-use the existing `blocked` state.

### Gap B — Step JSON shape & DAG (NAMED-DIFFERENTLY + MISSING DAG)
- LITFIN `PlanMilestone`: `{id, label, done, due?, completedAt?, dependsOn?}` (`long-horizon-planner.ts:30-37`). Milestones can wait on others.
- BOSSNYUMBA `GoalStep`: `{id, seq, description, toolName, toolPayload, status, startedAt, endedAt, outcome, errorMessage}` (`agency/goals/types.ts:31-42`). Steps execute a tool and progress linearly by `seq`.
- Behavioural diff: BOSSNYUMBA cannot model "step 3 depends on steps 1 AND 2". The executor walks by sorted `seq` (`executor.ts:83`) and bails on first failure (`executor.ts:85-87`). Useful for tool chains; weak for multi-week plans with parallel tracks.
- Closure effort: **moderate**. Add optional `dependsOn?: string[]` to `GoalStep` + change `executor.ts:83` to topologically order ready-steps. Existing tests pass when `dependsOn` is unset.

### Gap C — Hash-chained ledger (MISSING)
- LITFIN: `sovereign_action_ledger` table with `prev_hash` + `this_hash`, computed via `computeLedgerHash` (`audit-ledger.ts:77-100`). `verifyLedgerChain` walks oldest-first and rejects on mismatch (`audit-ledger.ts:260-299`). GENESIS_HASH anchors the first row.
- BOSSNYUMBA: `kernel_action_audit` is append-only but unchained (`kernel-action-audit.schema.ts:18-48`). The `payloadHash` field hashes ONLY the tool payload, not the row. Tampering rows post-hoc is undetectable.
- Behavioural diff: regulator-grade replay is impossible. BOSSNYUMBA cannot prove "the audit log has not been edited since the action ran".
- Closure effort: **moderate**. Add `prev_hash text` + `this_hash text` columns; compute on insert; ship a verifier endpoint. Migration is additive (default the existing rows to a one-off backfilled chain).

### Gap D — Rollback payload (MISSING)
- LITFIN: every ledger row carries `rollback_payload jsonb` (`audit-ledger.ts:41,66,148`). Specific sovereign tools (e.g. `change-pricing`, `flip-feature-flag`) populate it so a future operator can replay the inverse.
- BOSSNYUMBA: no rollback blob persisted with executed actions.
- Behavioural diff: BOSSNYUMBA cannot offer one-click rollback on a completed sovereign action.
- Closure effort: **moderate**. Add a `rollback_payload jsonb` column on `kernel_action_audit` + a `reverse()` slot on `ActionToolDef` that, given the original `toolPayload`, returns a reversal payload.

### Gap E — Role-gated approval (MISSING — highest leverage)
- LITFIN: `four-eye/policy.ts:18-30` declares role groups (`SUPER_ADMIN_ONLY`, `FINANCE`, `RISK_OR_COMPLIANCE`, `BANK_ADMIN_ONLY`); each action declares the required role groups (`policy.ts:38-153`); `roleCanFillSlot` greedily deducts filled slots (`policy.ts:175-199`).
- BOSSNYUMBA: `four-eye-approval.ts:103-147` `sign()` checks only that (a) the signer ≠ the proposer and (b) the signer has not already signed. Any user with API access to the sovereign endpoint can be the second eye.
- Behavioural diff: BOSSNYUMBA's "two-eye" gate is **two-distinct-humans**, not "two-distinct-humans-with-the-right-roles". A junior support engineer could approve a `lease.suspend-tenant` action a sovereign brain proposed.
- Closure effort: **moderate**. Add `requiredRoleGroups` to `ProposedAction` (or a side `approval_policy` table keyed by `tool_name`) + check signer role at `four-eye-approval.ts:118`. Wire to the existing role system in `apps/api-gateway/src/auth/*`.

### Gap F — Per-action expiry & recall window (PARTIAL + MISSING)
- LITFIN: every action has its own `autoRejectAfterHours` (1h for `reroute_ai_traffic`, 72h for `policy_rollout`) + a `recallWindowMinutes` so the initiator can withdraw (`policy.ts:41-153`).
- BOSSNYUMBA: one 24h TTL for everything (`four-eye-approval.ts:79 DEFAULT_TTL_MS`). No recall.
- Behavioural diff: a hot-incident proposal cannot auto-expire after 1h; a rollout sitting for 72h is also wrong-sized. Initiators cannot withdraw.
- Closure effort: **moderate**. Replace `defaultTtlMs` with a `policyForTool(toolName) → {ttlMs, recallWindowMs, requiredRoleGroups}` table. Co-design with Gap E.

### Gap G — Stall detection / self-heal proposals (MISSING)
- LITFIN: `computePlanHealth` returns a `health score` (0-1), `missedMilestones`, `blockedMilestones`, `daysSinceLastAction`, `stalled:boolean` (`long-horizon-planner.ts:189-252`). `proposeSelfHealingActions` returns up to three actions in three categories: `nudge` (remind the owner), `decompose` (break the stuck milestone smaller), `escalate` (route to a human reviewer) (`long-horizon-planner.ts:289-341`). `selfHeal` persists the proposal but does NOT auto-execute it (`long-horizon-planner.ts:347-375`).
- BOSSNYUMBA: nothing equivalent. Goals stay `active` even when no executor pass has moved a step for weeks.
- Behavioural diff: BOSSNYUMBA cannot tell an operator "you have 12 lease-renewal goals stuck for >7 days, here are the unblocking actions".
- Closure effort: **moderate**. Add `health_score` + `last_action_at` columns to `kernel_goals` + `computeGoalHealth(goal, audit_entries, now)` pure function + a stall-sweep that opens a "self-heal proposal" sibling goal.

### Gap H — Wake-loop scheduled (MISSING)
- BOSSNYUMBA built the wake-loop primitive (`wake-loop.ts:66-141`) AND the three real detectors (`real-detectors.ts:1-321`). But `grep -rn "runWakeCycle"` across `apps/` and `services/` returns ZERO hits (only kernel-internal callers + tests). The brain cannot wake itself.
- Behavioural diff: BOSSNYUMBA's "ambient brain" is wired but never runs. The arrears/lease-expiry/vacancy triggers fire only if a developer invokes the function manually.
- Closure effort: **trivial** (the hardest work is already done — wire one cron). Add a Cloud Scheduler / pg_cron / queue-worker entrypoint in `apps/api-gateway/src/jobs/agency-wake-cycle.ts` that calls `runWakeCycle({tenantIds: <all-active-tenants>}, {goals, executor, triggers: DEFAULT_WAKE_TRIGGERS})` every N minutes. Schedule it in `infra/terraform/scheduler.tf` (file already exists at the repo for `services/reports`).

### Gap I — Plan-as-artifact emission on approval request (MISSING)
- LITFIN: `approval-gate.ts:115-168 requestApproval()` dynamic-imports `proposePlan` from `@/core/brain/plan-artifact` and emits a structured plan to the brain outbox + the smartboard side panel — BEFORE the approver decides. The approver sees WHAT will happen, not just a generic "approve?" prompt. (Approval-gate.ts:108-114 comment: "Web SOTA Jarvis #7 — Sir, I would like to do the following".)
- BOSSNYUMBA: the approval lands in `sovereign_approvals` but no event is emitted on the brain event bus and no plan-artifact is rendered for the approver.
- Behavioural diff: BOSSNYUMBA approvers see only `{summary, toolName, payload}` — they cannot see the brain's *reasoning* behind the proposal or the *steps* the brain plans to take after approval.
- Closure effort: **small**. Add `emitBrainEvent('sovereign.plan_proposed', {actionId, summary, toolName, payload, stakes})` inside `four-eye-approval.ts:propose` (line 99-100 boundary). The event bus already exists.

### Gap J — Risk classifier (runtime vs static stakes)
- LITFIN's risk-scorer (`risk-scorer.ts:46-128`) computes a 0-100 score per call from runtime context: `affectedOrgCount` (blast radius), `outsideBusinessHours`, `novelTarget`, `recentSimilarActionsLastHour` (burst pattern), `actionType` (irreversibility). The band emerges from the score.
- BOSSNYUMBA's `ActionToolDef.stakes` (`agency/action-tools/types.ts:9`) is **declared at registration** and never recomputed. A `lease.send-reminder` is always `low`; a `lease.suspend-tenant` is always `critical`.
- Behavioural diff: BOSSNYUMBA cannot detect "this is the 5th lease-suspend in 10 minutes — that's burst-pattern abuse" and lift the stake band. Cannot detect "this rent-adjustment hits 47 leases — that's high-blast-radius".
- Closure effort: **moderate**. Add a `riskFactors?: RiskFactor[]` field on `ActionToolDef` + a `scoreAction(toolDef, payload, runtimeContext) → {score, band}` adapter the executor calls before invoking. Default = static stakes when factors absent (preserves current behaviour).

## Recommended closure order

1. **Gap E — Role-gated approval.** Highest leverage by far. Today BOSSNYUMBA's "four-eye" is only "two-eye-non-self"; any user with API access satisfies the second eye. For regulator-grade controls or enterprise sales, this MUST gate by role. ~80 lines + a `approval_policy` lookup table or a `requiredRoleGroups` field on the proposed action.
2. **Gap H — Wake-loop scheduled.** Trivial to land — the entire primitive is built. Adding a single cron entry flips BOSSNYUMBA from "an agent that needs to be poked" to "an ambient brain that wakes on schedule". This is the headline LITFIN-style behaviour that BOSSNYUMBA already paid 90% of the build cost for and has not collected the payoff.
3. **Gap C — Hash-chained ledger.** Mid-cost but high regulator leverage. Two new columns + insert-time hash + a verify endpoint. Closes the "tamper-evident audit" claim BOSSNYUMBA's docs implicitly make.

Honourable mentions: Gap G (stall detection — most product-visible; users see "your goal is stuck for 5 days, here's how to unblock"), Gap F (per-action TTL + recall — small cost, big DX win), Gap I (plan-as-artifact on approval — flips the approver UX from "approve a blob" to "approve a story").

## Out of scope / different by design

- **LITFIN's two-track agency split (sovereign-tier ledger vs long-horizon-planner)** is a deliberate response to LITFIN's mission split (cross-org platform actor + per-org credit advisor). BOSSNYUMBA's domain is uniformly "property manager", so a unified agency model is correct. Do not port the split.
- **LITFIN's `tier: borrower|officer|admin|sovereign` on plans** maps to per-portal mental-model differences that BOSSNYUMBA does not have. BOSSNYUMBA's `tenantId` + `userId` does the equivalent work.
- **Sovereign tool taxonomy** (`change-pricing`, `suspend-org`, `reroute-ai-traffic`) is LITFIN-specific. BOSSNYUMBA's equivalents (`lease.suspend-tenant`, `rent.adjust-rate`, `unit.archive`) live in property-management space — same shape, different verbs.
- **BOSSNYUMBA's plan decomposer (LLM-based step generation)** is more agent-y than LITFIN's pre-shaped milestones. Different cognitive choice; do not converge.
- **BOSSNYUMBA's per-tenant autonomous_mode_enabled master switch** is a multi-tenant SaaS feature LITFIN doesn't need (its sovereign tier is platform-wide). Do not port to LITFIN.

---

**Caveat.** Every claim cites a `file:line`. Where I report "MISSING", I verified by reading both the kernel layer (`packages/central-intelligence/src/kernel/`) and the database services (`packages/database/src/{schemas,services}/`) plus a `grep -rn` across `apps/` and `services/`. The wake-loop "wired but not scheduled" finding is the most consequential — the primitive is fully built but no scheduler invokes it; closing this is trivial but transforms BOSSNYUMBA's agency behaviour from passive to ambient.
