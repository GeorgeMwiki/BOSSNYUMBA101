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

### 1.2 Migrations 0114, 0115, 0116 applied

These three are the kernel's persistence floor — nothing else in
Nyumba Mind works until they are in place.

| Migration | Purpose |
|---|---|
| `0114_kernel_substrate.sql` | Sampled CoT reservoir, persona-drift events, per-think provenance |
| `0115_sovereign_approvals.sql` | Four-eye approval persistence for sovereign-tier writes |
| `0116_platform_privacy_budget.sql` | Postgres-backed DP epsilon ledger for cohort signals |

Apply with the workspace's migration runner:

```bash
pnpm -C packages/database db:migrate
```

Or, if you prefer raw `psql` against the SQL files:

```bash
psql "$DATABASE_URL" -f packages/database/src/migrations/0114_kernel_substrate.sql
psql "$DATABASE_URL" -f packages/database/src/migrations/0115_sovereign_approvals.sql
psql "$DATABASE_URL" -f packages/database/src/migrations/0116_platform_privacy_budget.sql
```

Verify they took:

```bash
psql "$DATABASE_URL" -c "\dt kernel_provenance kernel_persona_drift_events sovereign_approvals platform_privacy_budget"
```

All four tables should be listed.

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

### 1.5 Other required env

| Var | Required when | Notes |
|---|---|---|
| `DATABASE_URL` | always | Fail-fast at boot |
| `JWT_SECRET` | always | Auth middleware refuses to start without it |
| `REDIS_URL` | recommended in prod | Falls back to in-memory rate limiter; prod HPA scales replicas so in-memory under-counts |
| `ALLOWED_ORIGINS` | prod | Comma-separated list of `https://...` origins, fatal if missing in prod |
| `API_GATEWAY_URL` | for BFFs | Read by Next.js BFF routes (admin-platform-portal etc.). Defaults to `http://localhost:4000` |

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
recording what it claims to record?"

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

### 5.3 Pending approvals

Sovereign-tier write proposals waiting on a second eye:

```sql
SELECT action_id, tenant_id, proposer_user_id, summary, tool_name,
       stakes, status, proposed_at, expires_at
FROM sovereign_approvals
WHERE status IN ('pending', 'one-eye')
ORDER BY proposed_at DESC;
```

### 5.4 DP epsilon spend

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

## 6. Known limitations

Be honest with operators about what's not yet wired. None of these
block the kernel from booting; they are gaps to flag in the rollout
note.

- **Voice audio I/O.** The /voice router exists but the round-trip
  audio path (mic capture → STT → kernel → TTS → playback) is not
  wired through the portals. Text-only Jarvis works; voice does not.
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

## 7. Troubleshooting

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

## 8. Reference

- `.planning/jarvis-architecture.md` — canonical reference for the
  four-portal split, persona catalogue, scope lattice, and grounding
  pyramid.
- `apps/admin-portal/DEPRECATED.md` — why the legacy admin-portal
  exists, what's being migrated where.
- `packages/database/src/migrations/0114_kernel_substrate.sql` —
  kernel CoT reservoir + persona drift + provenance schema.
- `packages/database/src/migrations/0115_sovereign_approvals.sql` —
  four-eye approval table and audit log.
- `packages/database/src/migrations/0116_platform_privacy_budget.sql`
  — Postgres-backed DP epsilon ledger.
- `services/api-gateway/src/routes/jarvis-router-factory.ts` — the
  factory every Jarvis surface goes through (`/think`, `/stream`,
  `/briefing`, `/actions`).
- `services/api-gateway/src/routes/platform-overview.router.ts` — HQ
  KPI aggregator wired into `admin-platform-portal /platform/overview`.
