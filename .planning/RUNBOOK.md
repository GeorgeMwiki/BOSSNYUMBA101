# Nyumba Mind — Live Testing Runbook

Audience: a developer or SRE bringing the BossNyumba platform up in
staging or production for live testing of Nyumba Mind (the
central-intelligence Jarvis surface). This runbook assumes the repo is
cloned, `pnpm` is installed, and you have shell access to the target
environment.

---

## 1. Pre-flight checklist

Before booting anything, verify the substrate is reachable and the
required schema migrations are applied. Skip any step here and the
kernel will appear to "work" while silently dropping data.

### 1.1 Postgres reachable

```bash
psql "$DATABASE_URL" -c 'SELECT 1;'
```

`DATABASE_URL` must be set in `.env` (gateway reads it from repo root).
Format: `postgres://user:pass@host:5432/dbname`.

### 1.2 Migrations 0114–0123 applied

The full brain-DNA arc spans ten migrations. Everything below 0114 is
domain substrate (tenants, leases, payments, etc.); 0114 onward is the
central-intelligence kernel and its companions. Nothing in Nyumba Mind
fully works until at least 0114–0116 are applied; the agency layer
(0123) and consolidation cycle (0121) require their own tables before
their respective code paths persist anything.

| Migration | Purpose |
|---|---|
| `0114_kernel_substrate.sql` | Sampled CoT reservoir, persona-drift events, per-think provenance |
| `0115_sovereign_approvals.sql` | Four-eye approval persistence for sovereign-tier writes |
| `0116_platform_privacy_budget.sql` | Postgres-backed DP epsilon ledger + reservation log for cohort signals |
| `0117_currency_rates.sql` | ISO-4217 → USD FX snapshot table (platform-overview revenue normaliser) |
| `0118_persona_branding.sql` | Per-tenant `(tenant_id, surface)` overrides for displayName / openingPreamble / voice profile id |
| `0119_currency_preferences.sql` | Per-user / per-tenant / platform-default display-currency choice (resolution chain user → tenant → platform) |
| `0120_market_data_cache.sql` | Platform-wide TTL cache for external market-data adapters (Zillow, Airbnb, …) |
| `0121_kernel_memory_stores.sql` | Four-tier memory hierarchy: `kernel_memory_episodic`, `_semantic`, `_procedural`, `_reflective` |
| `0122_kernel_feedback.sql` | `kernel_feedback` — thumbs / explicit-correction signals captured per turn for online learning |
| `0123_kernel_agency.sql` | `kernel_goals` (persistent objective stack with JSON `steps`) and `kernel_action_audit` (append-only every-transition log) |

Apply with the workspace's migration runner. The root-level alias and the
package script both call the same runner — use whichever you prefer:

```bash
pnpm migrate                            # repo-root alias (preferred)
pnpm -C packages/database db:migrate    # equivalent
```

After 0117 lands, refresh FX rates whenever they drift. Manual upsert:

```bash
pnpm refresh-fx-rates --rates "USD=1.0,TZS=0.000395,KES=0.0077,EUR=1.08"
# Provider mode (env-gated, requires FIXER_IO_API_KEY):
pnpm refresh-fx-rates --provider fixer-io
```

Or, if you prefer raw `psql` against the SQL files:

```bash
psql "$DATABASE_URL" -f packages/database/src/migrations/0114_kernel_substrate.sql
psql "$DATABASE_URL" -f packages/database/src/migrations/0115_sovereign_approvals.sql
psql "$DATABASE_URL" -f packages/database/src/migrations/0116_platform_privacy_budget.sql
# … through 0123 …
psql "$DATABASE_URL" -f packages/database/src/migrations/0123_kernel_agency.sql
```

Verify the kernel-side tables took:

```bash
psql "$DATABASE_URL" -c "\dt kernel_provenance kernel_persona_drift_events sovereign_approvals platform_privacy_budget kernel_memory_episodic kernel_memory_semantic kernel_memory_procedural kernel_memory_reflective kernel_feedback kernel_goals kernel_action_audit persona_branding currency_preferences currency_rates market_data_cache"
```

All fifteen tables should be listed. Migrations are idempotent (CREATE
TABLE / INDEX / TYPE … IF NOT EXISTS guards), so re-running the runner
on an already-migrated environment is a no-op.

### 1.3 ANTHROPIC_API_KEY

```bash
echo "ANTHROPIC_API_KEY length: ${#ANTHROPIC_API_KEY}"
```

The kernel's LLM sensor needs a valid Anthropic API key. Without it the
gateway boots into **stub-sensor mode** — the kernel responds, but every
"thought" echoes back the user's input verbatim. That's fine for local
smoke tests, but never ship that to staging.

### 1.4 Optional — PRIVACY_BUDGET_EPSILON

```bash
export PRIVACY_BUDGET_EPSILON=1.0    # total ε for the rolling window
export PRIVACY_BUDGET_DELTA=1e-6     # δ if you want non-default
```

When `PRIVACY_BUDGET_EPSILON` is unset, the cohort DP-aggregator source
stays inert — no cross-tenant cohort signals will surface in HQ
briefings. You typically want this set in production, but leaving it
unset is a valid "tenant signals only" mode.

### 1.5 Env-var inventory (consolidated)

This is the full list of environment variables the gateway and the
brain-DNA stack read at boot. Verify every required row before
declaring a host "ready"; missing optional rows degrade specific
features but do not block boot.

| Var | Required | Read by | What it activates |
|---|---|---|---|
| `DATABASE_URL` | always | `services/api-gateway/src/composition/db-client.ts` | Postgres connection. Fail-fast at boot; without it pure-DB endpoints return 503 and Drizzle-backed kernel sinks fall back to in-memory. |
| `JWT_SECRET` | always | `services/api-gateway/src/middleware/auth.ts` | Auth middleware refuses to start without it. |
| `REDIS_URL` | recommended in prod | api-gateway rate-limit middleware | Falls back to in-memory rate limiter; prod HPA scales replicas so in-memory under-counts. |
| `ALLOWED_ORIGINS` | prod | api-gateway CORS bootstrap | Comma-separated list of `https://...` origins. Fatal if missing in prod. |
| `API_GATEWAY_URL` | for Next BFFs | `apps/admin-platform-portal/*` BFF routes | Server-side gateway URL; defaults to `http://localhost:4000`. |
| `ANTHROPIC_API_KEY` | for live AI | `services/api-gateway/src/composition/sovereign.ts` | Wires Claude sensors via `@anthropic-ai/sdk`. Without it the gateway boots into **stub-sensor mode** (echoes input verbatim). |
| `PRIVACY_BUDGET_EPSILON` | for cohort signals | sovereign composition | Activates the DP cohort source with ε for the rolling window. Pairs with optional `PRIVACY_BUDGET_DELTA` (default `1e-6`). Unset = "tenant signals only" mode. |
| `PUBLIC_RATE_LIMIT_SALT` | prod (public surface) | `services/api-gateway/src/middleware/public-ai-rate-limit.ts` | Salt mixed into `sha256(req.ip)` so the per-IP sliding-window bucket key is non-guessable. A non-secret dev default is used when unset. Required for the unauthenticated `/api/v1/public/*` surface in production. |
| `MARKET_DATA_PROVIDER` | optional | sovereign composition | `'zillow' \| 'airbnb'`. Selects which adapter is wired into the kernel's market-data tool bundle. Without it no adapter is wired and the tool surfaces a friendly "not configured" message. |
| `ZILLOW_API_KEY` | with `MARKET_DATA_PROVIDER=zillow` | sovereign composition | Real upstream credential for the Zillow adapter. Without it the adapter resolves every call to `{ kind: 'unconfigured' }` (it never throws). |
| `AIRBNB_API_KEY` | with `MARKET_DATA_PROVIDER=airbnb` | sovereign composition | Same pattern as `ZILLOW_API_KEY` for the Airbnb adapter. |
| `FIXER_IO_API_KEY` | optional | `pnpm refresh-fx-rates --provider fixer-io` | Live FX provider. Manual rates remain available without it. |
| `NEXT_PUBLIC_API_GATEWAY_URL` | client-side | `JarvisConsole.tsx` in customer-app, admin-platform-portal, estate-manager-app | Browser-visible gateway URL the `useJarvis` hook uses. Defaults to `http://localhost:4000`. |
| `NEXT_PUBLIC_OWNER_PORTAL_URL` | client-side (HQ) | `apps/admin-platform-portal/src/app/platform/subscriptions/SubscriptionsClient.tsx` | Cross-link out from HQ to a tenant's owner-portal billing page. Defaults to `http://localhost:3001`. |
| `NEXT_PUBLIC_PLATFORM_PORTAL_URL` | client-side | (planned) | Reserved for symmetric reverse links from owner / manager portals back to HQ. Claim — verify before live; not currently referenced in any portal. |

The three production switches that flip the brain from dev-stub to
live remain `ANTHROPIC_API_KEY`, `DATABASE_URL`, and
`PRIVACY_BUDGET_EPSILON` (see `.planning/jarvis-architecture.md` §8).

### 1.6 Brain-DNA modules

The kernel ships nine sub-modules above the original 13-step `think()`
pipeline. Every module is composable behind a duck-typed port — the
api-gateway's composition root binds the production adapter; tests
bind in-memory fakes.

| Module | Code path | One-line summary |
|---|---|---|
| memory | `packages/central-intelligence/src/kernel/memory/` | Four-tier memory hierarchy ports: episodic / semantic / procedural / reflective. Backed by 0121 tables; in-memory fakes for tests. |
| consolidation | `packages/central-intelligence/src/kernel/consolidation/` | The brain's "sleep" pass: episodic → fact extraction → procedural-pattern detection → weekly reflective digest → TTL purge → semantic decay. |
| world-model | `packages/central-intelligence/src/kernel/world-model/` | Forward-simulate property / tenant / owner / agency state vectors so the brain reasons about TRAJECTORY, not just current state. Includes regime detector. |
| debate | `packages/central-intelligence/src/kernel/debate/` | N-voice × R-round internal debate + counterfactual perturbations. Public surface: `runDebate`, `buildCounterfactuals`, `runCounterfactuals`. |
| feedback | `packages/central-intelligence/src/kernel/feedback/` | Online-learning side-channel — read-only access at step 4 (memory recall) to recent thumbs / explicit corrections so the next turn can apologise and bias toward conservative output. |
| introspection | `packages/central-intelligence/src/kernel/introspection/` | Self-knowledge layer: decision-trace replay (re-run history through current logic to detect drift) + per-persona capability cards. |
| agency | `packages/central-intelligence/src/kernel/agency/` | The "acts in full control" slice: persistent goals + plan decomposer, typed write-tool registry, autonomous executor with autonomy policy + audit, wake-loop / initiative triggers. |
| voice | `packages/central-intelligence/src/voice/` + `kernel/voice-bridge.ts` | Voice resolver maps a `ScopeContext` to a first-person voice binding; voice-bridge marries the cognitive persona with the voice-persona-dna profile (tone / pace / register / code-switching / greeting / closing / taboos). |
| branding | `packages/central-intelligence/src/kernel/branding.ts` (+ 0118 table + `persona-branding.service.ts`) | Per-tenant `(tenant_id, surface)` overrides that re-skin `displayName` / `openingPreamble` / `voiceProfileId` without replacing the surface-default persona. |

These nine modules ride on top of the core kernel pipeline (cache →
inviolable → tier check → memory recall → cohort signal → prompt
assembly → sensor → normalise → judge → drift → policy → confidence →
provenance) — they do not replace any existing step; they augment what
the kernel can read at step 4 (memory + feedback) and what it can do
above the kernel (consolidation, debate, agency, introspection).

---

## 2. Boot sequence

Run these in order. Each step assumes the previous one finished cleanly.

### 2.1 Install dependencies

```bash
pnpm install
```

### 2.2 Build core packages

```bash
pnpm -C packages/database build
pnpm -C packages/central-intelligence build
```

The gateway imports from compiled `dist/` for the database package.
Skipping `packages/database` build will cause runtime "module not
found" failures.

### 2.3 Start the gateway

```bash
pnpm -C services/api-gateway dev    # tsx watch on :4000
```

Gateway listens on `:4000` (override with `PORT=...`). Watch the boot
log for:

- `service-registry: live (Postgres-backed domain services wired)` — DB
  is reachable.
- `ai-brain-utilities wired` — confirms the LLM router + budget-guarded
  Anthropic client are constructed.
- `brain-extensions: org.query_organization skill wired` — org-awareness
  skill is registered in the Brain.

If you see `service-registry: degraded`, `DATABASE_URL` is unset or the
DB is unreachable. Pure-DB endpoints will return 503.

### 2.4 Start the user-facing frontends

Each portal has its own dev port. Open one terminal per app:

| App | Command | Port |
|---|---|---|
| HQ portal (us) | `pnpm -C apps/admin-platform-portal dev` | 3020 |
| Owner portal (customer admin) | `pnpm -C apps/owner-portal dev` | 3001 |
| Estate manager (mobile) | `pnpm -C apps/estate-manager-app dev` | 3003 |
| Tenant resident (mobile) | `pnpm -C apps/customer-app dev` | 3002 |
| Marketing | `pnpm -C apps/marketing dev` | 3010 |
| Legacy admin (deprecated) | `pnpm -C apps/admin-portal dev` | 3000 |

The legacy `admin-portal` (port 3000) is being consolidated — see
`apps/admin-portal/DEPRECATED.md`. Do not test new flows against it.

---

## 3. Smoke tests — gateway endpoints

Replace `$TOKEN` with a JWT signed by `JWT_SECRET`. For local dev you
can mint one via the auth router (`POST /api/v1/auth/login`) or use the
seed-staff token your environment provisions.

### 3.1 Single-turn thought (each surface)

The Jarvis routers all share the same shape; only the mount path
differs.

```bash
# Tenant resident
curl -X POST http://localhost:4000/api/v1/customer/jarvis/think \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"threadId":"t-1","userMessage":"hi"}'

# Owner / customer admin
curl -X POST http://localhost:4000/api/v1/owner/jarvis/think \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"threadId":"t-1","userMessage":"hi"}'

# Estate manager
curl -X POST http://localhost:4000/api/v1/manager/jarvis/think \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"threadId":"t-1","userMessage":"hi"}'

# BossNyumba HQ (sovereign)
curl -X POST http://localhost:4000/api/v1/platform/jarvis/think \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"threadId":"t-1","userMessage":"hi"}'
```

Expected envelope:

```json
{
  "success": true,
  "surface": "platform-hq",
  "persona": { "id": "sovereign-admin", "displayName": "...", "firstPersonNoun": "Nyumba Mind" },
  "decision": { "kind": "answer", "text": "...", "confidence": { ... }, "provenance": { "thoughtId": "..." } }
}
```

### 3.2 SSE-streamed thought

`/stream` returns Server-Sent Events: `turn_start`, several `delta`,
`confidence`, `done`. Use `-N` (or `--no-buffer`) so curl flushes the
chunks live:

```bash
curl -N -X POST http://localhost:4000/api/v1/platform/jarvis/stream \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"threadId":"t-1","userMessage":"summarise this morning"}'
```

You should see `event: turn_start` immediately, followed by 5–10
`event: delta` lines, then `event: confidence`, then `event: done`.

### 3.3 Briefing

```bash
curl -X POST http://localhost:4000/api/v1/platform/jarvis/briefing \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "threadId": "brief-1",
    "day": "2026-05-05",
    "dataPoints": [
      { "topic": "Arrears trending up in Region A", "summary": "12 cases past 30d, +30% WoW", "severity": "warn" },
      { "topic": "Marketplace funnel", "summary": "Conversion held at 18%", "severity": "info" }
    ]
  }'
```

### 3.4 Sovereign actions (proposal + sign)

Propose a write action:

```bash
curl -X POST http://localhost:4000/api/v1/platform/jarvis/actions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "thoughtId": "thought-abc",
    "summary": "rotate platform API key",
    "toolName": "platform.api_keys.rotate",
    "payload": { "keyId": "key_123" },
    "stakes": "high"
  }'
```

The response carries an `approval.actionId`. Sign with two distinct
operators (proposer cannot self-approve):

```bash
curl -X POST http://localhost:4000/api/v1/platform/jarvis/actions/$ACTION_ID/sign \
  -H "Authorization: Bearer $TOKEN_OPERATOR_2" \
  -H "Content-Type: application/json" \
  -d '{"verdict":"approve","comment":"reviewed"}'
```

### 3.5 Platform overview (HQ KPIs)

```bash
curl http://localhost:4000/api/v1/platform/overview \
  -H "Authorization: Bearer $PLATFORM_TOKEN"
```

Requires a platform-tier role (`SUPER_ADMIN` / `ADMIN` / `SUPPORT`).
Returns `{ success: true, data: { activeTenants, platformUsers,
monthlyRevenue, unitsManaged, currency } }`. If any aggregate query
fails it returns 200 with `success: false, error.code: 'PARTIAL'` so
the frontend renders em-dashes instead of zeros.

---

## 4. Per-portal browser smoke

After the gateway and frontends are running, click through each surface
once. Stub-sensor mode (no `ANTHROPIC_API_KEY`) just echoes input back
— that's fine for confirming the wire-up.

| Portal | URL | What to check |
|---|---|---|
| HQ | http://localhost:3020/jarvis | Persona greeting "I am Nyumba Mind"; `/platform/overview` KPI tiles render numbers (or em-dashes when DB is empty) |
| Owner | http://localhost:3001/jarvis | Persona greets owner by name; tier defaults to `portfolio` |
| Estate manager | http://localhost:3003/jarvis | Terse greeting style; tier defaults to `property` |
| Tenant resident | http://localhost:3002/jarvis | Warm greeting; tier defaults to `lease` |

For each: send `"hi"` as the first message and confirm the persona
introduces itself before any tool use.

---

## 5. Live monitoring

Once thoughts are flowing, these queries answer "is the kernel actually
recording what it claims to record?" Every section below is a
copy-paste-ready Postgres query.

### 5.1 Latest provenance entries

Every `kernel.think()` call writes one row. If this table is empty
after you've poked the surface, the kernel is silently no-oping.

```sql
SELECT thought_id, scope_kind, tenant_id, surface, tier, stakes,
       decision_kind, persona_id, created_at
FROM kernel_provenance
ORDER BY created_at DESC
LIMIT 20;
```

Aggregate view — decisions per surface in the last hour:

```sql
SELECT surface, decision_kind, COUNT(*) AS n
FROM kernel_provenance
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY 1, 2
ORDER BY 1, 2;
```

### 5.2 Persona drift events

Each row is a flagged drift (taboo / first-person-loss / tone /
fabrication). A spike here means the kernel's persona-guard is
catching the LLM going off-leash.

```sql
SELECT thought_id, persona_id, violation, detail, created_at
FROM kernel_persona_drift_events
ORDER BY created_at DESC
LIMIT 50;
```

Drift rate per persona over 24h:

```sql
SELECT persona_id, violation, COUNT(*) AS n
FROM kernel_persona_drift_events
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY 1, 2
ORDER BY n DESC;
```

### 5.3 Episodic memory — what the brain has seen recently

```sql
SELECT id, tenant_id, user_id, thread_id, kind, summary, captured_at
FROM kernel_memory_episodic
WHERE captured_at > NOW() - INTERVAL '24 hours'
ORDER BY captured_at DESC
LIMIT 50;
```

Per-tenant episodic volume — useful before kicking off a consolidation
run to confirm there is something to consolidate:

```sql
SELECT tenant_id, COUNT(*) AS rows, MIN(captured_at) AS first, MAX(captured_at) AS latest
FROM kernel_memory_episodic
WHERE captured_at > NOW() - INTERVAL '14 days'
GROUP BY tenant_id
ORDER BY rows DESC;
```

### 5.4 Active goals (agency layer)

```sql
SELECT id, tenant_id, user_id, title, status, priority,
       steps_done, steps_total, created_at, updated_at
FROM kernel_goals
WHERE status IN ('open', 'running', 'awaiting-approval')
ORDER BY priority DESC, updated_at DESC
LIMIT 50;
```

### 5.5 Action audit — every executor transition

Append-only log of every step the executor walks; powers replay +
drift dashboards.

```sql
SELECT goal_id, step_id, tool_name, decision, outcome,
       error_message, latency_ms, captured_at
FROM kernel_action_audit
ORDER BY captured_at DESC
LIMIT 50;
```

Failure rate per tool in the last 24h:

```sql
SELECT tool_name,
       COUNT(*) FILTER (WHERE decision = 'failed') AS failed,
       COUNT(*) FILTER (WHERE decision = 'done')   AS done,
       COUNT(*) AS total
FROM kernel_action_audit
WHERE captured_at > NOW() - INTERVAL '24 hours'
GROUP BY tool_name
ORDER BY total DESC;
```

### 5.6 Pending approvals

Sovereign-tier write proposals waiting on a second eye:

```sql
SELECT action_id, tenant_id, proposer_user_id, summary, tool_name,
       stakes, status, proposed_at, expires_at
FROM sovereign_approvals
WHERE status IN ('pending', 'one-eye')
ORDER BY proposed_at DESC;
```

### 5.7 DP epsilon spend

Single-row table reflecting the rolling-window cohort budget. If
`spent_epsilon` is creeping toward `total_epsilon`, the cohort source
will stop returning signals until the window rolls forward.

```sql
SELECT id, total_epsilon, spent_epsilon,
       total_delta, spent_delta, updated_at
FROM platform_privacy_budget;

-- Reservation log (one row per successful reserve()):
SELECT id, epsilon, delta, reserved_at
FROM platform_privacy_budget_reservations
ORDER BY reserved_at DESC
LIMIT 25;
```

---

## 6. Cron / scheduled jobs

Two brain-DNA modules need to be invoked on a schedule. Neither
installs its own cron — they expose a CLI entry and a library entry,
and the deployment chooses how to fire them (Kubernetes `CronJob`,
container-host crontab, GitHub-Actions scheduled workflow, etc.).

### 6.1 Consolidation runner — the brain's "sleep" cycle

Composition entry: `services/api-gateway/src/composition/consolidation-runner.ts`.

What it does (per `(tenantId, userId)` scope with episodic activity in
the last 14 days):

1. Reads recent episodic entries.
2. Extracts SEMANTIC FACTS via a Haiku judge call; upserts each into
   `kernel_memory_semantic`.
3. Detects PROCEDURAL PATTERNS by sliding a 3-step window over the
   tool-result episodic stream; upserts repeats into
   `kernel_memory_procedural`.
4. Once per week per scope, generates a REFLECTIVE DIGEST (summary +
   top topics + sentiment + action items) into `kernel_memory_reflective`.
5. Calls `episodic.purgeExpired()` to enforce TTL.
6. Calls `semantic.decay({ decayPerDay: 0.005 })` so old facts fade
   unless re-seen.

Per-tenant failures are caught + logged and the runner moves on.
Missing prerequisites (`DATABASE_URL` or `ANTHROPIC_API_KEY`) make the
runner a no-op rather than a crash, so a misconfigured cron does not
take a deployment down.

CLI invocation (production wiring):

```bash
# Build first if running from compiled JS:
pnpm -C services/api-gateway build
node services/api-gateway/dist/composition/consolidation-runner.js
```

Recommended cadence: hourly to twice-daily depending on episodic
volume per tenant. The runner exits 0 on full success, 1 on
partial-with-errors, 2 on a fatal config error.

Suggested Kubernetes `CronJob` shape (*claim — the chart does not
ship one yet; verify before live*):

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: consolidation-runner
spec:
  schedule: "17 * * * *"          # 17 past every hour
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: runner
            image: <api-gateway-image>
            command: ["node", "services/api-gateway/dist/composition/consolidation-runner.js"]
            envFrom:
              - secretRef: { name: api-gateway-env }
          restartPolicy: OnFailure
```

### 6.2 Wake-loop — proactive initiative triggers

Library entry: `runWakeCycle` from
`packages/central-intelligence/src/kernel/agency/initiative/wake-loop.ts`.

Per-tenant detector pass:

1. For each registered `WakeTrigger`, call `detect({ tenantId, clock })`.
2. Each detected `WakeTriggerDetectedGoal` is opened via
   `goals.open(...)` (writes a `kernel_goals` row).
3. Each opened goal is immediately handed to `executor.executeGoal(goalId)`,
   whose every step transition writes one `kernel_action_audit` row.

Trigger-level failures are isolated — a failing detector or executor
for one trigger never stops the others. The loop is single-pass; the
deployment schedules it (cron, queue worker, SaaS scheduler).

Each `WakeTrigger` exposes an optional `cron` string field — the
schedule the trigger PREFERS. The wake-loop itself does not consume
the field; it is metadata for whoever wires the cron. Wire one
scheduled job per cadence (e.g. one `CronJob` for hourly triggers, one
for daily triggers) and pass the matching trigger subset.

Recommended cadence: every 5–15 minutes for "near-real-time" triggers
(arrears spike detector, vacancy-rate jump), hourly for digest-style
triggers, daily for reflection / capability-card refresh.

Both runners are deliberately single-shot so the deployment owns the
retry + backoff policy. Do not loop them inside the api-gateway
process — they belong in their own short-lived workload.

### 6.3 AI-native agents — Monthly Close, Voice, Market Surveillance, Predictive Interventions

Four AI-native agents are wired into the api-gateway composition root
(`services/api-gateway/src/composition/{monthly-close,voice-agent,market-surveillance,predictive-interventions}-wiring.ts`).
Each is exposed as an optional slot on `ServiceRegistry` and returns
`null` when `DATABASE_URL` is unset — routers that depend on a slot
already render a 503 envelope when they see a null wiring, so a missing
DB does not crash boot.

#### Env vars that flip stub adapters to real

The wirings ship with graceful stubs for every external port; setting
the env var below activates the real adapter when (and only when) it
lands. Until then the agent runs in degraded mode and persistence still
works.

| Agent | Env var (when adapter lands) | Today's stub |
|---|---|---|
| Monthly Close — Reconciliation / Statement / Disbursement / Notification / Event ports | (no env gate yet — concrete adapters land in follow-up commits, then they will read existing `services/payments-ledger`, notification, and event-bus config) | Each stub emits a single `console.warn` the first time it is invoked so degraded mode is observable in logs. |
| Monthly Close — `AutonomyPolicyPort` | (no env gate yet — concrete autonomy-policy adapter lands in follow-up commit) | Stub returns `autonomousModeEnabled = false` so disbursement batches park as `awaiting_approval`. **Money never auto-moves in degraded mode.** |
| Voice Agent — `VoiceBrainPort` | `ANTHROPIC_API_KEY` (Anthropic-backed brain reuses the existing key once the adapter lands) | Heuristic-language detection (`sw` / `es` / `fr` / `en`) — never hardcodes 'en'. |
| Voice Agent — `VoiceSttPort` / `VoiceTtsPort` / `CustomerResolverPort` | (no env gate yet — adapters land in follow-up) | All three pass as `null`; the agent's degraded mode preserves text-only behaviour. |
| Market Surveillance — `MarketRatePort` | (no env gate yet — Zillow / Rentometer adapter lands in follow-up; will read `MARKET_DATA_PROVIDER`, `ZILLOW_API_KEY`, `AIRBNB_API_KEY`, see §1.5) | Stub `MarketRatePort` with `adapterId='stub-not-configured'`. `listActiveUnits` returns `[]` so the surveillance loop no-ops cleanly. |
| Predictive Interventions — LLM port | `ANTHROPIC_API_KEY` (LLM-backed predictor lands in follow-up commit) | LLM port is `undefined` → heuristic-baseline predictions only. `listActiveTenants` returns `[]` until the occupancy/leases adapter lands. |

#### Inspecting run state

The four agents persist state through the Drizzle services in
`packages/database/src/services/`. Live monitoring queries:

```sql
-- Monthly Close: most recent run per tenant + period
SELECT id, tenant_id, period_year, period_month, status, trigger,
       started_at, completed_at, last_error
FROM monthly_close_runs
ORDER BY started_at DESC
LIMIT 25;

-- Monthly Close: per-step audit trail for a run
SELECT step_name, decision, actor, policy_rule, started_at,
       completed_at, duration_ms, error_message
FROM monthly_close_run_steps
WHERE run_id = '<runId>'
ORDER BY step_index;

-- Voice Agent: recent voice turns. degraded_mode = TRUE means the STT /
-- TTS / brain adapter was not configured; the row is still persisted so
-- the conversation is auditable.
SELECT id, tenant_id, session_id, turn_index, detected_language,
       degraded_mode, model_version, latency_ms, created_at
FROM voice_turns
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 50;

-- Market Surveillance: latest comparable-rent snapshots per unit.
-- source_adapter='stub-not-configured' marks degraded-mode snapshots.
SELECT unit_id, observed_at, currency_code, our_rent_amount_minor,
       market_median_minor, market_p25_minor, market_p75_minor,
       drift_flag, source_adapter
FROM market_rate_snapshots
ORDER BY observed_at DESC
LIMIT 50;

-- Predictive Interventions: open opportunities (need owner attention).
-- signal_type carries the kind ('high_default_risk', 'high_churn_risk', …).
SELECT id, tenant_id, customer_id, signal_type, suggested_action,
       status, created_at
FROM predictive_intervention_opportunities
WHERE status = 'open'
ORDER BY created_at DESC
LIMIT 50;
```

#### Manually triggering a monthly-close run

The Monthly Close Orchestrator runs on the `monthly_close` background
task (registered unconditionally in
`services/api-gateway/src/composition/background-wiring.ts`, schedule
`0 2 1 * *` — 02:00 on the 1st of every month). To run a tenant's close
ad-hoc, POST to the router (mounted at `/api/v1/monthly-close`):

```bash
# Trigger (or resume) the close for the caller's tenant + period.
# Tenant id is bound from the JWT, not the body.
curl -X POST http://localhost:4000/api/v1/monthly-close/trigger \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"periodYear":2026,"periodMonth":4}'
```

Idempotency: a re-trigger for an in-progress `(tenantId, periodYear,
periodMonth)` returns the same run with `resumed: true`. A re-trigger
for a completed period returns 409 `MonthlyCloseAlreadyCompleted`.
These invariants are also enforced at the DB layer via the unique
indexes on `monthly_close_runs (tenant_id, period_year, period_month)`
and `monthly_close_run_steps (run_id, step_name)` — re-triggers surface
Postgres `23505` to the orchestrator.

If a step pauses as `awaiting_approval` (the autonomy-policy stub
forces this on disbursement batches today), an operator approves and
the orchestrator resumes:

```bash
curl -X POST http://localhost:4000/api/v1/monthly-close/<runId>/approve-step \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"stepName":"propose_disbursement_batch"}'
```

Auth: the router is gated on `SUPER_ADMIN` / `ADMIN` / `TENANT_ADMIN`.
Returns 503 `MONTHLY_CLOSE_UNAVAILABLE` when the registry slot is
`null` (most commonly because `DATABASE_URL` is unset), 404 when the
run is not found, and 409 when the step is not in
`awaiting_approval` state.

#### Boot-log smoke-check

If `service-registry: live (Postgres-backed domain services wired)` is
in the boot log, the four wirings will have run. Each stub external
port emits a single `console.warn` (or `logger.warn`) prefixed with the
agent name (`[monthly-close]`, voice-agent, market-surveillance,
predictive-interventions) the FIRST time it is invoked, so you will see
degraded-mode noise in logs only once per stub per process. If
`service-registry: degraded` was logged instead, every slot is `null` —
the routers will return 503 with a clear reason until `DATABASE_URL`
is set and the gateway is restarted.

---

## 7. Known limitations

Be honest with operators about what's not yet wired. None of these
block the kernel from booting; they are gaps to flag in the rollout
note.

- **Voice audio I/O.** The voice resolver, voice-bridge (in
  `kernel/voice-bridge.ts`), and per-tenant `voiceProfileId` plumbing
  through the persona-branding table are all shipped — but the
  end-to-end audio path (mic capture → STT → kernel → TTS → playback)
  is not wired through the portals. Text-only Jarvis works; the
  speaking surface does not.
- **HQ overview trend chart.** The recharts panel on
  `/platform/overview` is a placeholder shape. The KPI tiles are live;
  the trendline is mocked until the time-series source is wired.
- **i18n stubs.** Some `owner-portal` pages still render the i18n
  message keys verbatim where translations have not been backfilled.
  Cosmetic, not functional.
- **Some support endpoints.** A small number of routers exist in
  `services/api-gateway/src/routes/` but are not yet mounted in
  `index.ts` (look for files imported nowhere). Not a blocker; they
  return 404 on the un-mounted path.
- **Monthly revenue.** `/api/v1/platform/overview` returns `0` for
  `monthlyRevenue` with a TODO. The `payments` table mixes currencies
  (KES / TZS / USD) per tenant; until an FX-normalising aggregator is
  wired we refuse to add mixed-currency minor-units together.

---

## 8. Troubleshooting

### "Stub sensor: echoing user message back"

The kernel's LLM adapter fell back to its stub. Set
`ANTHROPIC_API_KEY` and restart the gateway. Confirm via boot log:

```
ai-brain-utilities wired { providers: { anthropic: true, ... } }
```

### `relation "kernel_substrate" does not exist`

Migration 0114 was not applied. Run:

```bash
pnpm -C packages/database db:migrate
```

…and confirm with `\dt kernel_*` in psql.

### Cohort signals always empty

Check, in order:

1. `PRIVACY_BUDGET_EPSILON` is set in the gateway's environment.
2. The user's message contains a keyword the cohort source matches —
   check the source's keyword list before assuming the budget is the
   problem.
3. The DP ledger budget is not exhausted:
   `SELECT spent_epsilon, total_epsilon FROM platform_privacy_budget;`.
   If `spent >= total`, wait for the rolling window to roll forward
   (or bump `total_epsilon` and rerun migration 0116's seed).

### Gateway returns 503 on every endpoint

`service-registry: degraded` was logged at boot. `DATABASE_URL` is
unset or the DB is unreachable. Fix the env var; the gateway's
fail-fast validator will print a precise error message on next boot.

### CORS errors in the browser

`ALLOWED_ORIGINS` does not include the portal's origin. Add
`http://localhost:3020` (etc.) to the comma-separated list in `.env`.
In production, this is fatal at boot when unset.

### `/api/platform/overview` returns `GATEWAY_UNREACHABLE`

The Next.js BFF route in admin-platform-portal couldn't reach the
gateway. Check `API_GATEWAY_URL` in the portal's environment and that
the gateway is actually listening on that host:port.

---

## 9. Reference

### Planning docs

- `.planning/jarvis-architecture.md` — canonical reference for the
  four-portal split, persona catalogue, scope lattice, grounding
  pyramid, and the brain-DNA layer above the kernel.
- `.planning/litfin-parity-plan.md` — origin doc for the
  brain+mind-parity work that produced migrations 0114–0123.
- `apps/admin-portal/DEPRECATED.md` — why the legacy admin-portal
  exists, what's being migrated where.

### Migrations (kernel substrate + companions)

- `packages/database/src/migrations/0114_kernel_substrate.sql` —
  kernel CoT reservoir + persona drift + provenance schema.
- `packages/database/src/migrations/0115_sovereign_approvals.sql` —
  four-eye approval table and audit log.
- `packages/database/src/migrations/0116_platform_privacy_budget.sql`
  — Postgres-backed DP epsilon ledger + reservation log.
- `packages/database/src/migrations/0117_currency_rates.sql` — FX
  snapshot table for revenue normalisation.
- `packages/database/src/migrations/0118_persona_branding.sql` —
  per-tenant persona overrides.
- `packages/database/src/migrations/0119_currency_preferences.sql` —
  per-user / per-tenant / platform display-currency choice.
- `packages/database/src/migrations/0120_market_data_cache.sql` —
  TTL cache for external market-data adapters.
- `packages/database/src/migrations/0121_kernel_memory_stores.sql` —
  episodic / semantic / procedural / reflective stores.
- `packages/database/src/migrations/0122_kernel_feedback.sql` —
  thumbs / explicit-correction signal store.
- `packages/database/src/migrations/0123_kernel_agency.sql` —
  `kernel_goals` + `kernel_action_audit`.

### Code paths

- `services/api-gateway/src/routes/jarvis-router-factory.ts` — the
  factory every Jarvis surface goes through (`/think`, `/stream`,
  `/briefing`, `/actions`).
- `services/api-gateway/src/routes/platform-overview.router.ts` — HQ
  KPI aggregator wired into `admin-platform-portal /platform/overview`.
- `services/api-gateway/src/composition/sovereign.ts` — single source
  of truth for how the api-gateway boots the sovereign AI; reads
  `ANTHROPIC_API_KEY`, `MARKET_DATA_PROVIDER`, `ZILLOW_API_KEY`,
  `AIRBNB_API_KEY`.
- `services/api-gateway/src/composition/consolidation-runner.ts` —
  composition entry + CLI for the brain's "sleep" cycle.
- `packages/central-intelligence/src/kernel/agency/initiative/wake-loop.ts`
  — `runWakeCycle` proactive-initiative loop.
- `packages/central-intelligence/src/kernel/memory/` — four-tier
  memory hierarchy ports.
- `packages/central-intelligence/src/kernel/world-model/` —
  trajectory + regime-detector tools.
- `packages/central-intelligence/src/kernel/debate/` — N-voice
  internal debate + counterfactuals.

### User-memory rules referenced by this codebase

The following per-user feedback rules (in
`~/.claude/projects/.../memory/`) document policy choices that are now
load-bearing in the migrations and brain-DNA modules described above:

- `feedback_user_currency_choice.md` — `currency_preferences` table
  and the user → tenant → platform-default resolution chain
  (migration 0119 implements it).
- `feedback_world_starting_tz.md` — "built for the world, starting
  with TZ" — TZ defaults are seeded values, never hard-coded
  jurisdiction / currency / locale branches in business logic.
