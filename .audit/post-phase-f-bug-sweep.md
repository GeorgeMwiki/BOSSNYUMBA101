# Post-Phase-F Bug Sweep (2026-05-18)

Branch: `main` (post-merge: PRs covering Phase D + E + F).
Scope: 9 categories × 7 new packages × ~50 kLOC of net diff.
Method: targeted read-only inspection of the seams the audit brief named, plus the orchestrator, sovereign ledger, autonomy caps, MCP servers, real connectors, and onboarding BFF. Citations are `path:line` against the working tree.

## Summary

| Class | Count |
|---|---|
| CRITICAL (crash / data-loss / security / compliance) | 8 |
| HIGH (correctness / silent-fail / partial-failure) | 17 |
| MEDIUM (perf / drift / N+1 / cost-bloat) | 9 |
| LOW (style / unreachable / dead-code) | 3 |
| **Total** | **37** |

Five-most-dangerous CRITICAL findings (in fix-cost order, lowest first):

1. **C1 — Onboarding password never persisted.** `apps/.../onboarding.router.ts:188-265` — POST /signup validates `password` via zod, never hashes or persists it. Owners cannot log back in.
2. **C2 — Onboarding session token is `Math.random()`.** `onboarding.router.ts:134` — `newId()` uses `Math.random().toString(36).slice(2,8)`. Predictable; not security-grade. Idempotent-by-email replay (line 236-249) returns the EXISTING token to anyone who knows the email → account takeover via signup-replay.
3. **C3 — Plan-mode does NOT propagate to spawn_sub_md.** `packages/central-intelligence/src/kernel/orchestrator/main-loop.ts:362` — the `evaluatePermissionMode` short-circuit only runs for `decision.kind === 'tool_call'`. A parent in `plan` mode can still `spawn_sub_md`, the child runs without plan-mode → child executes mutates that the parent's plan-mode promised would be previewed.
4. **C4 — MCP servers (NIN, FIRS, NGGIS, OPay) skip per-tenant allowlist.** `services/mcp-server-nin/src/index.ts:62-99` and analogous files in the other three MCP servers — `CallToolRequest` handler dispatches to the adapter without checking caller's `tenantId` against an allowlist or verifying any auth context. Any stdio caller can invoke live NIMC NIVS / FIRS / OPay.
5. **C5 — `sovereign_action_ledger.hashPayload` only sorts top-level keys.** `packages/database/src/services/sovereign-action-ledger.service.ts:130` — `JSON.stringify(payload, Object.keys(payload).sort())` is shallow; nested object key order is producer-dependent, so the hash chain is unstable and reproducing a row's hash later cannot be done deterministically. Breaks the chain-verifier invariant for any non-flat payload.

Three quick wins (≤30 min each):

* **Q1** — Wrap every `await h.fn(...)` in `packages/central-intelligence/src/kernel/orchestrator/hook-chain.ts:379-487` with try/catch that maps thrown errors to `{kind: 'deny', code: 'hook-threw'}`. The module docstring promises that contract; the implementation does not honour it.
* **Q2** — Replace `Math.random()` in `onboarding.router.ts:134` and `onboarding-welcome-md.ts:220` with `crypto.randomUUID()`. Single-line swap.
* **Q3** — Fix the GePG TLD typo: `packages/connectors/src/adapters/gepg-real.ts:54-57` says `gepg.tz.go` / `gepg-sandbox.tz.go`. The Tanzania government TLD is `.go.tz`. DNS resolution fails today.

---

## (1) Concurrency / race / CAS / idempotency

* **1.1 [HIGH] `markExecuted` legacy fallback is non-atomic.** `four-eye-approval.ts:594-613` — when `deps.store.casMarkExecuted` is absent (test fakes, but also any store that forgets to implement it) the get→refreshStatus→put sequence has a TOCTOU window. Two concurrent executors can both observe `executed=false` and both flip. The docstring at line 280-289 says it's "optional for back-compat" but the legacy branch is silently unsafe in production if a real Postgres store accidentally omits `casMarkExecuted`.
* **1.2 [CRITICAL] Sovereign-ledger advisory lock is SESSION-scoped, not transaction-scoped.** `sovereign-action-ledger.service.ts:341` uses `pg_advisory_lock(lockKey)` paired with `pg_advisory_unlock` in `finally`. If the connection returns to the pool between acquisition and unlock (e.g. throw before unlock, or pool-reset on transaction error), the held lock leaks. The docstring at line 268 even mentions `pg_advisory_xact_lock` is what's wanted. Use `pg_try_advisory_xact_lock` inside an explicit `db.transaction(...)`.
* **1.3 [MEDIUM] Tenant-lock key truncates SHA-256 to 60 bits but claims 53.** `sovereign-action-ledger.service.ts:265-271` slices 15 hex chars (= 60 bits) and parses as Number. JS Number is precise to 53 bits; values > 2^53 silently quantise and collide. Replace with `BigInt` or use only `digest.slice(0, 13)` (52 bits).
* **1.4 [HIGH] `compileAndDeploySubMd` is not idempotent.** `packages/central-intelligence/src/kernel/orchestrator/self-extension.ts:347-389` — given two concurrent approvals of the same `SubMdProposal`, both calls succeed and `subMdRegistry.register(...)` is invoked twice, producing two registry rows with different `version`. There is no `proposalId` uniqueness check.
* **1.5 [HIGH] Cap evaluator + reservation has no atomic guard.** `packages/autonomy-governance/src/caps/cap-evaluator.ts` is pure; the calling adapter (`tenant-autonomy-cap.ts`) snapshots state then decides allow/deny. Nothing reserves the slot between decision and the next ledger row that proves consumption — two concurrent caller threads can both pass `evaluateAutonomyCap` and overrun the daily cap. The audit point flagged this; the cap module has no `casConsume` primitive at all.
* **1.6 [HIGH] Rate-limit counter is per-process.** `services/api-gateway/src/composition/orchestrator-bindings.ts:351-370` — `createSlidingWindowRateLimitCounter` uses a process-local `Map`. With N api-gateway pods, the real limit is `N × RATE_LIMIT_MAX_CALLS_PER_WINDOW`. The docstring acknowledges "isolated across api-gateway pods until a real Redis adapter is wired" — flagging as bug because no operator alarm fires if pods scale out and the cap silently weakens.
* **1.7 [MEDIUM] Session-checkpoint resume forgets the transcript.** `packages/central-intelligence/src/kernel/orchestrator/main-loop.ts:261` calls `sessionStore.resumeOrCreate(...)` once and never writes back. `session.transcript` is never appended to across turns; resume from any checkpoint loses every user/assistant message. `Checkpoint.transcript` captures the reference, but the main-loop never grows it.
* **1.8 [LOW] `EphemeralCleanup.sweep` throws on first failure.** `packages/forecasting-engine/src/sandbox/ephemeral-cleanup.ts:32-51` — if one dispose throws, remaining expired sandboxes are not swept AND the throwing one is not unregistered. Use `Promise.allSettled` semantics + always-unregister.

## (2) Type / serialization / API contract

* **2.1 [CRITICAL] `redactPayloadPii` removed PII from JSONB but the HASH is computed on the ORIGINAL.** `sovereign-action-ledger.service.ts:329-330` is correct in intent (hash original, persist redacted). Combined with bug 5.1, the hash is unstable across producers (different key orders). The chain verifier (line 493-499) re-derives `thisHash` from `payloadHash`, so as long as `payloadHash` matches what was persisted, the chain holds. BUT if the payload was constructed with a different key order at re-verification time, the recomputed `payloadHash` differs and the chain shows mismatched. Net: **chain verification is non-deterministic for nested payloads**.
* **2.2 [HIGH] `narrowToLegacyResponse` swallows defer's resumeAfterMs.** `main-loop.ts:207-233` collapses `ack-defer` → `ack-schedule` with `resumeToken = "defer:${resumeAfterMs}"`. Receivers that pattern-match on resumeToken format break; the `reason` and `pendingDecision` are dropped on the floor.
* **2.3 [HIGH] OPay `verifyPayment` swallows all errors to `failed`.** `services/mcp-server-opay/src/adapter-real.ts:247-249` — `catch {}` returns `{status: 'failed', amountKobo: 0}` with no `reason`. Caller cannot distinguish actual decline from network glitch.
* **2.4 [HIGH] OPay GET signature is computed over the path only.** `adapter-real.ts:158-159` — `hmacSignature(path)`; no timestamp, no nonce. Trivially replayable. Real OPay docs specify timestamp-bound HMAC; this implementation diverges silently.
* **2.5 [HIGH] OPay POST response not schema-validated.** `adapter-real.ts:148` — `JSON.parse(text) as R` is an unchecked cast. A malformed OPay response can crash the downstream type checker or, worse, type-check at compile time then fail at runtime when fields are missing.
* **2.6 [HIGH] NIDA `Retry-After` not honoured.** `packages/connectors/src/adapters/nida-real.ts:191` — the docstring (line 13-15) promises "Retry-After honouring on 429"; the implementation hardcodes `retryAfterMs: 60_000`. Upstream's actual `Retry-After` header is never read.
* **2.7 [HIGH] AOP `parseNL` does not catch LLM router throws.** `packages/aop-compiler/src/parser/nl-parser.ts:60-63` — `await llm.complete(...)` is bare; an LLM 500 propagates upward as an unhandled rejection. Promised `ParseResult` shape is bypassed.
* **2.8 [MEDIUM] `compileToSkill` non-null-asserts `steps[0]`.** `packages/aop-compiler/src/compiler/to-skill.ts:75` — `ast.entry ?? ast.steps[0]!.id`. Today zod's `min(1)` guards it, but any caller building an `AOP` value directly (not through `AOPSchema.parse`) can pass `steps: []` and crash at compile time.
* **2.9 [MEDIUM] HookResult ADT not exhaustively re-checked.** `hook-chain.ts:407-431` does NOT use a `_exhaustive: never` discriminator. New outcome variants added later will silently fall through to "return immediately" with whatever they look like — easy missed-case bug as the union grows.
* **2.10 [LOW] AdaptiveRenderer omits exhaustive check.** `packages/genui/src/AdaptiveRenderer.tsx:153-162` — `default` swallows unknown kinds. Intentional for forward-compat, but loses compile-time enforcement when a new kind lands.

## (3) Auth / scope / RBAC / multi-tenancy

* **3.1 [CRITICAL] Onboarding does not persist a password hash.** `services/api-gateway/src/routes/onboarding.router.ts:188-265` — `password` is zod-validated, then dropped. The owner cannot log in subsequently; even if the auth.ts router has a user repo, no user row is created with credentials.
* **3.2 [CRITICAL] Idempotent-signup-by-email leaks the existing token.** `onboarding.router.ts:236-249` — duplicate signup with the same email returns the existing session's `sessionToken`. An attacker who knows a target email recovers the live token.
* **3.3 [HIGH] No session expiry.** `onboarding.router.ts:80` — `sessionsByToken` is unbounded; tokens never expire, sessions never garbage-collect. Memory leak + persistent token attack window.
* **3.4 [HIGH] `country` validated only by length.** `onboarding.router.ts:191` — `z.string().min(2).max(3)` accepts arbitrary 2-3 char strings. ISO-3166 not actually checked.
* **3.5 [CRITICAL] MCP servers skip tenant-allowlist guard.** `services/mcp-server-nin/src/index.ts:62-99`, `mcp-server-firs/src/index.ts:53-80`, `mcp-server-nggis`, `mcp-server-opay`. Each `CallToolRequest` handler dispatches without inspecting the caller's tenant context. Any process with stdio access can call the production NIMC / FIRS / NGGIS / OPay adapter without per-tenant scope.
* **3.6 [HIGH] `executeSkill` allowlist is theatre.** `packages/central-intelligence/src/kernel/orchestrator/skill.ts:134-160` — the `toolAllowed` check rejects the whole skill if any tool isn't allowed (too strict), but the actual `llm({system, user})` call passes **no `tools` array**. The LLM has no way to call tools — the allowlist enforces nothing that matters.
* **3.7 [HIGH] No tenant-scope check on F.5 onboarding endpoints past signup.** `/first-property`, `/first-tenant-import`, `/first-md-chat` rely only on the (insecure) session token. If the token leaks (cf. 3.2) the attacker reaches the tenant directly.
* **3.8 [HIGH] Self-extension deployment is not tenant-scoped at the registry.** `self-extension.ts:347-389` — `subMdRegistry.register({name, spec})` does not bind the registration to a tenant. The `spec.scope.tenantId` lives inside the spec but the registry is global; a deployment for tenant A can be retrieved for tenant B if the registry lookup is by name.

## (4) PII / secret leak surfaces

* **4.1 [CRITICAL] OPay `cashflowLookup` puts payer phone in the query string.** `adapter-real.ts:254` — `?phone=${encodeURIComponent(args.payerPhone)}` — query params are recorded by every L7 proxy, WAF, CDN, and access log. Move to POST body.
* **4.2 [MEDIUM] AOP NL inputs may end up in skill markdown unscrubbed.** `aop-compiler/src/compiler/to-skill.ts:62, 79` — `description` and `args` from the AST are interpolated into a Markdown body without PII redaction. If the NL prompt contained a phone or NIDA, it persists into the compiled Skill body verbatim.
* **4.3 [HIGH] `Math.random()` IDs are guessable.** `onboarding.router.ts:134`, `onboarding-welcome-md.ts:220`, `self-extension.ts:318`. `proposalId` and `messageId` are deterministic enough to be guessed in a target window.
* **4.4 [MEDIUM] `Pm4pyClient` accepts `process.env.PYTHON_BIN` for the interpreter path.** `services/mcp-server-process-intel/src/pm4py-client.ts:88`. If an attacker controls the container env, the interpreter is hijacked. Low blast radius in practice (env locked), high in a misconfigured deploy.
* **4.5 [HIGH] Sandbox `schema-clone` mode silently falls back to in-memory.** `packages/forecasting-engine/src/sandbox/sandbox-runtime.ts:79-84` — calling code that requested `schema-clone` gets an `InMemorySandbox` with a side-channel `plan`. PII isolation contract is violated; callers think they have schema-clone isolation but they have an in-process map.

## (5) Crash / null / undefined / unhandled rejection

* **5.1 [HIGH] Hook chain doesn't catch hook throws.** `packages/central-intelligence/src/kernel/orchestrator/hook-chain.ts:373-487` — every `await h.fn(...)` is bare. Module top-docstring at line 22 implies hooks compose safely; throws unwind the entire chain. Should translate to `{kind: 'deny', code: 'hook-threw', reason: …}` as the audit brief noted.
* **5.2 [HIGH] Main-loop dispatch is not wrapped in try/catch.** `main-loop.ts:469` — `const result = await deps.dispatcher.dispatch(toRun, ctx);` unwinds the orchestrator if a dispatcher throws. The other lifecycle awaits (lines 279, 292, 312, 330, 403, 445, 473, 488, 501, 502) are equally bare. One bad tool crashes the whole orchestrator.
* **5.3 [HIGH] `OutcomeRecorder.record` swallows SloEvent emission if persistence throws.** `packages/central-intelligence/src/kernel/sub-mds/shared/outcome-recorder.ts:181-191` — `await sink.record(rec)` first, `await sloEventSink.emit(event)` second. If `sink.record` throws, the SloEvent is never emitted. Auto-rollback depends on SloEvents; misbehaving sub-MDs go undetected.
* **5.4 [HIGH] `Pm4pyClient.send` does not check `stdin.write` return.** `services/mcp-server-process-intel/src/pm4py-client.ts:157` — under backpressure write returns false and the buffer grows unbounded. Large event logs OOM the gateway.
* **5.5 [HIGH] `parseNL` doesn't catch LLM throws.** Duplicate of 2.7 — listing here too because it crashes the parser path.
* **5.6 [HIGH] `parallel-run` is fail-fast `Promise.all`.** `packages/forecasting-engine/src/orchestrator/parallel-run.ts:34` — first scenario's rejection cancels awaiting on the other in-flight scenarios; cleanup may leak. Docstring at line 5-6 promises the caller can choose fail-fast or fail-soft; implementation hardcodes fail-fast.
* **5.7 [MEDIUM] `executeAutoRollback` partial-failure leaves canary in a half-state.** `packages/autonomy-governance/src/slo/auto-rollback.ts:151-152` — `canaryStore.update(..., 'shadow')` then `revertPort.revert(...)`. If `revert` throws, canary is in `shadow` but data is not rolled back. No saga / no compensation.
* **5.8 [MEDIUM] Receipt/state mismatch in kill-and-rollback.** Same file, line 175 — receipt says `toStage: 'disabled'` but the actual `canaryStore.update` set it to `'shadow'`. Operator dashboard shows a stage that doesn't match the DB.

## (6) Hard-coded / config / env

* **6.1 [CRITICAL] GePG base URLs use wrong TLD.** `packages/connectors/src/adapters/gepg-real.ts:54-57` — `gepg.tz.go` / `gepg-sandbox.tz.go` are typos for `gepg.go.tz` / `gepg-sandbox.go.tz`. DNS will not resolve. All TZ government billing wiring fails on first call.
* **6.2 [HIGH] M-Pesa TZ Vodacom base URL is missing.** `packages/connectors/src/adapters/mpesa-real.ts:43-46` — the docstring at line 16-18 claims TZ Vodacom support but `BASE_URLS` only carries Safaricom KE URLs (`safaricom.co.ke`). Tanzania M-Pesa filings fail at runtime.
* **6.3 [MEDIUM] OPay `expireAt: 30` magic number.** `mcp-server-opay/src/adapter-real.ts:207` — 30 minutes per OPay docs; no constant, no comment, no test asserting the value.
* **6.4 [LOW] OPay `callbackUrl: ''`.** Same file line 205 — hardcoded empty; real callbacks never wired.
* **6.5 [MEDIUM] Budget exhaustion doesn't track usd cost.** `packages/central-intelligence/src/kernel/orchestrator/budget.ts:145-152` — `exhaustionAxis()` checks turns/tokens/toolCalls/wallMs but never `usdCost`. Cost overruns can't be capped at the budget layer; relies entirely on the cost-circuit hook.

## (7) Database / migration / RLS

* **7.1 [HIGH] `tenant_autonomy_caps`, `sub_md_slos`, `sub_md_slo_events` have no RLS.** `packages/database/src/migrations/0160_autonomy_governance.sql` — no `ALTER TABLE … ENABLE ROW LEVEL SECURITY` and no `CREATE POLICY`. Tenant-scoped tables without RLS allow cross-tenant reads if any app-side filter is missed.
* **7.2 [HIGH] `mdr_plan_items` has no CHECK on `horizon` / `status` / `proposed_by`.** `packages/database/src/migrations/0161_mdr_plan.sql` — the comment documents the enum, but no DB constraint enforces it. Bad data lands.
* **7.3 [HIGH] `mdr_plan_items` has no FK to `tenants` or self-referential FK.** `0161_mdr_plan.sql:13-14` — orphan rows possible; `parent_id` can point to a deleted item.
* **7.4 [HIGH] `mdr_plan_items` has no RLS, no `CHECK (parent_id IS DISTINCT FROM id)`.** Self-cycle possible.
* **7.5 [HIGH] `owner_skills` has no FK / no CHECK on `trigger_kind` / no RLS.** `0162_owner_skills.sql` — same issue pattern. Plus `installed_at` and `last_run_at` use `TIMESTAMP` not `TIMESTAMPTZ`.
* **7.6 [MEDIUM] `sub_md_slo_events` has no TTL / no partitioning.** `0160_autonomy_governance.sql:103` — high-volume outcome stream accumulates forever; the `(sub_md, metric, timestamp DESC)` index degrades.
* **7.7 [MEDIUM] Cost-circuit `sumRollingSpendUsd` pulls all rows.** `services/api-gateway/src/composition/orchestrator-bindings.ts:422-431` — `db.select({costUsdMicro}).from(aiCostEntries).where(...)` without `sum()`. Pulls every 24h row to the application and sums in JS. O(rows) per tool call.

## (8) Cost / performance / N+1

* **8.1 [MEDIUM] `detectRecurringGap` scans full activity log.** `packages/central-intelligence/src/kernel/orchestrator/self-extension.ts:220` — `activityLog.recent({windowDays, nowMs})` returns the full window, then JS clusters in-memory. No cursor, no cache; runs daily/weekly on potentially millions of rows.
* **8.2 [MEDIUM] Sovereign-ledger verify reloads the chain row-by-row.** `sovereign-action-ledger.service.ts:469-477` — chunked at `VERIFY_CHUNK=500`, but for deep ledgers each chunk pulls the entire row (no projection of just `id, prev_hash, this_hash, action_type, payload_hash, executed_at, tenant_id`). Wastes IO + RAM.
* **8.3 [HIGH] VP-finance orchestrate doesn't bound the number of line-worker spawns.** `packages/central-intelligence/src/kernel/vp-personas/vp-finance/orchestrate.ts:62-73` — when intent is status-check, the VP iterates all 4 line-workers and emits a spawn for each, serially. For status checks across all 5 VPs this is 20+ concurrent sub-MDs — no cap, no priority.
* **8.4 [MEDIUM] `parallel-run` uses `Promise.all`.** `forecasting-engine/src/orchestrator/parallel-run.ts:34` — actually parallel (good), but cancels on first reject (bad). The Promise.all is correct for concurrency but wrong for fail-soft.
* **8.5 [LOW] Budget `consume()` recomputes `wallMs` each call to `clock()`.** Cheap; flagged only as a profiling note for hot loops.

## (9) Integration seams

* **9.1 [CRITICAL] Plan-mode does not propagate to `spawn_sub_md`.** `main-loop.ts:362-400` — the permission-mode evaluator only runs for `tool_call`. A parent in `permissionMode: 'plan'` can still `spawn_sub_md`. The child's own orchestrator inherits whatever permissionMode the spawn payload carries (or 'default'). Net: plan-mode users see destructive actions execute via sub-MDs they didn't preview.
* **9.2 [HIGH] `Decision.kind === 'monitor'` is unhandled in the main loop.** `main-loop.ts` has explicit branches for `respond_to_owner`, `final`, `schedule_wake`, and `spawn_sub_md` background, but not for `monitor`. The dispatcher's `monitor_ack` flows through `plan.advance()` + `budget.consume()` and the loop continues — meaning the orchestrator does NOT yield, contradicting the docstring intent ("install a watcher and yield" — `decision.ts:18-19`).
* **9.3 [HIGH] Sub-MD spawned line-workers do not re-enter the hook chain.** Looking at `main-loop.ts:472-499`, `spawn_sub_md` decisions go through `runSubagentStart` / `runSubagentStop` but the child's own dispatch happens inside the dispatcher implementation — there's no enforcement that the child's `tool_call` decisions go through the SAME hook chain (pii-scrub, perms, four-eye, denylist, rate-limit, cost-circuit, sandbox, audit). The architectural promise (Phase F.3) is per-tenant uniformity; the wiring proves it only at the parent level.
* **9.4 [HIGH] `pm4py` JSON-line framing has no max-line guard.** `services/mcp-server-process-intel/src/pm4py-client.ts:189-199` — `stdoutBuffer` accumulates until a newline. A malformed sidecar that never emits `\n` causes unbounded memory growth.
* **9.5 [MEDIUM] Orchestrator → real connectors: `lpms-connector` not exercised.** Phase F1 claims sub-MDs use real adapters but the `kra.filing-assistant` sub-MD's automate stage uses an interface; the actual binding to `kra-erits-real.ts` happens at composition root. Without a green integration test on this seam, regressions are silent.
* **9.6 [LOW] AOP round-trip not verified for nested loops.** `aop-compiler` round-trip (parseNL → compile → reparseAST) works for flat steps; `loop.body` recursion is encoded via `z.lazy` (grammar.ts:161-173) but no test exercises the round-trip for a 2-level nested loop.

---

## NOT FOUND (clean surfaces)

* **PII scrubber pattern coverage** (`packages/ai-copilot/src/security/pii-scrubber.ts:70-211`) — comprehensive E.Africa + nigerian phone catalogue, idempotent, no obvious regex gap for the 6 jurisdictions covered.
* **Four-eye approval state-machine** — refresh-status discipline (`four-eye-approval.ts:455-551`) correctly handles expiry/recall/proposer-self-approve/duplicate-signer. The atomic CAS surface is wired (`casMarkExecuted` on `ApprovalStore`).
* **Awareness-scopes tier containment** (`awareness-scopes.ts:43-74`) — lattice rank + platform/tenant compatibility check is correct and complete.
* **Permission-mode evaluator** (`permission-mode.ts:87-128`) — six-mode precedence is correctly encoded; tenantOverride wins; reads/asks/denies are exhaustive over the mode enum (modulo the spawn-propagation bug C3 at the consumer side).
* **Forecasting-engine `WorldModel` immutability** — every mutator returns a new instance; version monotonically advances.
* **AOP grammar zod schemas** — `min(1)` invariants on `steps`, `body`; cron + duration regex precise; discriminated unions exhaustive across step kinds.
* **`createBaseConnector` discipline** — `mpesa-real`, `kra-erits-real`, `nida-real`, `gepg-real`, `opay/adapter-real` all wrap retry / rate-limit / circuit-breaker / audit. No raw fetch leaks.
* **Sovereign-ledger redaction-before-write** is sound; the hash chain is invariant-safe under PII redaction (the verifier never re-derives `payloadHash` from persisted JSON).
* **Genui AdaptiveRenderer** — every of the 42 kinds handled, unknown kind degrades gracefully via `UnknownKindCard`, never crashes.

---

## Wire-summary table (paste into a fix-wave ticket)

| ID | Class | File:Line | Bug | Fix sketch | Cost |
|---|---|---|---|---|---|
| C1 | CRITICAL | `onboarding.router.ts:188-265` | password never persisted | wire `users` repo + bcrypt; persist user + tenant atomically | M |
| C2 | CRITICAL | `onboarding.router.ts:134,236-249` | predictable token, email-replay leaks it | `crypto.randomUUID()` + delete the idempotency branch (or scope it to admin reset flow) | S |
| C3 | CRITICAL | `main-loop.ts:362-400` | plan-mode doesn't propagate to spawn | re-run `evaluatePermissionMode` for `spawn_sub_md` (treat as `mutate`) OR thread `permissionMode` into the spawn payload and verify in dispatcher | M |
| C4 | CRITICAL | `mcp-server-{nin,firs,nggis,opay}/src/index.ts` | no per-tenant allowlist | wrap `CallToolRequest` with a `tenantId` extraction + allowlist port (deny when absent) | M |
| C5 | CRITICAL | `sovereign-action-ledger.service.ts:130` | hashPayload sorts only top-level keys | swap to a deep canonicaliser (e.g. `json-canonicalize` or a hand-rolled deep-sort) | S |
| C6 | CRITICAL | `gepg-real.ts:54-57` | wrong TLD (`.tz.go` should be `.go.tz`) | fix the two BASE_URLS strings | S |
| C7 | CRITICAL | `opay/adapter-real.ts:254` | phone PII in URL query | POST body for `/account/balance` (or accept-as-batched-RPC) | S |
| H1 | HIGH | `hook-chain.ts:373-487` | hook throws unwind the chain | wrap each `await h.fn(...)` in try/catch → return `{kind:'deny', code:'hook-threw', reason: ...}` | S |
| H2 | HIGH | `main-loop.ts:469 (and 9 other awaits)` | dispatcher/hook throws crash the loop | wrap dispatch in try/catch → translate to `tool_error` DispatchResult | S |
| H3 | HIGH | `four-eye-approval.ts:594-613` | legacy fallback TOCTOU | delete the fallback OR make it a hard error when `casMarkExecuted` is absent | S |
| H4 | HIGH | `sovereign-action-ledger.service.ts:341` | session-scoped advisory_lock | switch to `pg_try_advisory_xact_lock` inside a `db.transaction(...)` | M |
| H5 | HIGH | `self-extension.ts:347-389` | no idempotency on compile/deploy | unique-key on `proposalId` in `subMdRegistry.register` OR fail-on-duplicate | S |
| H6 | HIGH | `caps/cap-evaluator.ts` + adapter | no atomic reserve | introduce `casReserveCapSlot(tenantId, mutations, costCents)` returning bool | M |
| H7 | HIGH | `orchestrator-bindings.ts:351-370` | rate limit per-process | wire Redis-backed counter OR explicit operator alarm on pod-count change | M |
| H8 | HIGH | `main-loop.ts:261` | session transcript not appended | append user/assistant turns to `session.transcript` and persist on every checkpoint | M |
| H9 | HIGH | `outcome-recorder.ts:181-191` | SloEvent silently swallowed on persistence failure | `Promise.allSettled` over both sinks, surface error to logger | S |
| H10 | HIGH | `parallel-run.ts:34` | fail-fast hardcoded | accept policy param, use `allSettled` for soft mode | S |
| H11 | HIGH | `auto-rollback.ts:151-152` | partial-failure leaves canary in shadow | wrap as saga: revert first, then update canary OR persist a 'rolling-back' intermediate state | M |
| H12 | HIGH | `opay/adapter-real.ts:158-159` | HMAC over path only — replayable | append timestamp header, sign `ts || path` | M |
| H13 | HIGH | `nida-real.ts:191` | hardcoded 60s retry | parse `Retry-After` header from upstream-error outcome | S |
| H14 | HIGH | `mpesa-real.ts:43-46` | TZ Vodacom URL missing | add `tz-sandbox`/`tz-production` entries; default by tenant region | S |
| H15 | HIGH | `mdr_plan_items` 0161 | no CHECK / FK / RLS | follow-up migration adds constraints | M |
| H16 | HIGH | `tenant_autonomy_caps` etc 0160 | no RLS | follow-up migration `ENABLE RLS + CREATE POLICY` | M |
| H17 | HIGH | `owner_skills` 0162 | no CHECK / FK / RLS / TIMESTAMPTZ | follow-up migration | M |
| H18 | HIGH | `pm4py-client.ts:157` | stdin.write backpressure | check return value, await `'drain'` on false | S |
| H19 | HIGH | `pm4py-client.ts:189-199` | no max-line guard on buffer | cap buffer at e.g. 16MB, emit `BAD_FRAME` on overflow | S |
| H20 | HIGH | `main-loop.ts` (no monitor case) | `Decision.kind==='monitor'` falls through | add explicit `if (toRun.kind === 'monitor') return {kind:'ack-schedule', resumeToken: toRun.watch.watchId}` (or new variant) | S |
| M1 | MEDIUM | `sovereign-action-ledger.service.ts:265-271` | 60-bit lock-key truncated to 53 | use BigInt or slice 13 chars | S |
| M2 | MEDIUM | `orchestrator-bindings.ts:422-431` | cost-circuit pulls all rows | `db.select({total: sum(aiCostEntries.costUsdMicro)})...` | S |
| M3 | MEDIUM | `self-extension.ts:220` | full activity-log scan | maintain a rolling cluster summary table updated by triggers OR cron-build | L |
| M4 | MEDIUM | `auto-rollback.ts:175` | receipt says 'disabled' but stage is 'shadow' | reconcile: either update store to 'disabled' or change receipt | S |
| M5 | MEDIUM | `sandbox-runtime.ts:79-84` | schema-clone silently falls back to in-memory | throw "schema-clone adapter not wired" instead | S |
| M6 | MEDIUM | `budget.ts:145-152` | usdCost not in exhaustion axes | add `usdCost >= maxUsdCost` axis | S |
| M7 | MEDIUM | `vp-finance/orchestrate.ts:62-73` | unbounded line-worker spawns on status-check | cap at top-N (rotate weekly) | S |
| M8 | MEDIUM | `sovereign_action_ledger.verifyLedgerChain` | full-row pulls | project minimal columns | S |
| M9 | MEDIUM | `to-skill.ts:62,79` | no PII redaction in compiled body | run `redactPayloadPii` over `description` + JSON.stringify(args) | S |
| L1 | LOW | `ephemeral-cleanup.ts:32-51` | first-failure aborts sweep | allSettled + always unregister | S |
| L2 | LOW | `parallel-run.ts:26`, `ephemeral-cleanup.ts:40` | `console.error` in package code | switch to injected logger port | S |
| L3 | LOW | `AdaptiveRenderer.tsx:79-162` | no exhaustive `never` check | add `_exhaustive: never` discriminator to assert all kinds at compile time | S |

Cost legend: S = ≤30 min; M = 1-3 h; L = ≥1 day.
