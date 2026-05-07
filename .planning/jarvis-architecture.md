# BossNyumba — Nyumba Mind Architecture

A reference for how the Nyumba Mind ("Jarvis") personal-AI surface is wired across the platform. One kernel, several personas, **four portals**, per-user instances.

---

## 1. The four user-facing portals

BossNyumba ships **exactly four** user-facing frontends. They differ by audience, persona, and visibility scope — but they all consume the same Nyumba Mind kernel through a single `createJarvisRouter()` factory in the gateway.

| App directory | Stack | Dev port | Audience | Tier this app feels like |
|---|---|---|---|---|
| `apps/admin-platform-portal/` | Next.js | 3020 | **BossNyumba HQ employees** (us, internal) | Sovereign — industry-wide |
| `apps/owner-portal/` | Vite (React SPA) | 3001 | **Owners** — and owners *are* the admins; they can invite admin sub-users inside their portal | Portfolio / org — properties they own + their tenants' activity + their own actions |
| `apps/estate-manager-app/` | Next.js | 3003 | Estate managers (mobile) — their Jarvis reports up to the owner's | Property — properties they run |
| `apps/customer-app/` | Next.js | 3002 | Tenant residents (mobile) | Lease — their own lease |

> **DO NOT CONFUSE — owner-portal (customer admin) vs admin-platform-portal (us)**
>
> - `apps/admin-platform-portal/` (Next.js, port **3020**) is **BossNyumba HQ INTERNAL**. This is *us*. Persona `SOVEREIGN_ADMIN_PERSONA` ("Nyumba Mind"). Mounts at `/api/v1/platform/jarvis`.
> - `apps/owner-portal/` (Vite, port **3001**) is **the customer admin portal**. Owners and the admins they appoint run their estate-management business there. Persona `OWNER_ADVISOR_PERSONA`. Mounts at `/api/v1/owner/jarvis`.
>
> The owner's portal **is** the admin portal — there is no separate "agency admin" application. Owners administer their own work inside their portal.

> **Deprecated:** `apps/admin-portal/` (Vite, port 3000) predates this clean four-portal split. It accumulated some HQ-flavoured pages and some agency-admin pages. It is being consolidated into `admin-platform-portal` (HQ pages) and `owner-portal` (admin pages). See `apps/admin-portal/DEPRECATED.md`. The `/api/v1/admin/jarvis` route remains in the gateway for backwards-compatibility but is now a literal alias of `/api/v1/owner/jarvis` — both routes resolve to `OWNER_ADVISOR_PERSONA`. New consumers hit `/api/v1/owner/jarvis` or `/api/v1/platform/jarvis`.

### LITFIN ↔ BossNyumba persona mapping (canonical)

BossNyumba inherits LITFIN's tiered-AI architecture, scoped to property management. The four user-facing seats line up one-to-one:

| LITFIN seat | BossNyumba seat | App | Surface | Persona | Tier |
|---|---|---|---|---|---|
| Borrower | Tenant resident | `apps/customer-app/` | `'tenant-app'` (SDK: `'customer'`) | `TENANT_RESIDENT_PERSONA` | `lease` |
| Officer (loan officer) | Estate manager | `apps/estate-manager-app/` | `'estate-manager-app'` (SDK: `'manager'`) | `ESTATE_MANAGER_PERSONA` | `property` |
| Bank admin / org admin | **Owner (= admin)** | `apps/owner-portal/` | `'owner-portal'` (SDK: `'owner'`) | `OWNER_ADVISOR_PERSONA` | `portfolio` / `org` |
| LitFin HQ internal | BossNyumba HQ internal | `apps/admin-platform-portal/` | `'platform-hq'` (SDK: `'platform'`) | `SOVEREIGN_ADMIN_PERSONA` | `industry` |

**Persona consolidation note.** LITFIN's "bank admin" and "org admin" tiers map to a SINGLE BossNyumba persona — `OWNER_ADVISOR_PERSONA` — because in the BossNyumba portal model the **owner IS the admin**. Owners administer their own work inside `owner-portal` and can invite admin sub-users from there to help them run the business. The previous `ORG_ADMIN_PERSONA` is retained as a deprecated export alias for back-compat; the surface map routes both `'owner-portal'` and `'admin-portal'` (deprecated) to `OWNER_ADVISOR_PERSONA`.

**Reports-up chain.** Each lower-tier Jarvis is visible to the higher-tier Jarvis through the awareness lattice: tenant ⊂ lease ⊂ unit ⊂ property ⊂ portfolio ⊂ org ⊂ industry. The estate manager's Jarvis "reports up" to the owner's Jarvis (the owner sees the estate manager's slice plus the tenants under it); the owner's Jarvis "reports up" to BossNyumba HQ via DP-aggregate cohort signals. Same intelligence, same kernel, same gates — narrowed visibility per seat.

---

## 2. Route mounts in the API gateway

Every portal is paired with one `createJarvisRouter()` instance, mounted at a portal-specific path inside the gateway. They are sister routers — same factory, different `surface` + `defaultTier` config.

The mount block lives at `services/api-gateway/src/index.ts`:

```ts
api.route('/customer/jarvis', tenantJarvisRouter);
api.route('/owner/jarvis',    ownerJarvisRouter);
api.route('/manager/jarvis',  managerJarvisRouter);
api.route('/admin/jarvis',    adminJarvisRouter);          // agency admin (Nyumba Mind — Agency Brain)
api.route('/platform/jarvis', platformHqJarvisRouter);     // BossNyumba HQ (Nyumba Mind sovereign)
```

The factory is in `services/api-gateway/src/routes/jarvis-router-factory.ts`. The shape of every mounted router is identical:

| Verb | Path | Purpose |
|---|---|---|
| `POST` | `/think` | Single-turn thought |
| `POST` | `/stream` | SSE-streamed turn (`turn_start` / `delta` / `confidence` / `done`) |
| `POST` | `/briefing` | Compose a daily briefing for the operator |
| `POST` | `/actions` | Propose a sovereign-tier write action (four-eye gate) |
| `POST` | `/actions/:id/sign` | First or second signature |
| `GET` | `/actions/:id` | Fetch approval status |
| `GET` | `/actions` | List approvals (filter by `status`) |

### Surface matrix

The four productional surfaces — plus the deprecated agency-admin route — and what each one defaults to:

| Portal | Path prefix | `surface` | Persona | Default tier | Visibility (in plain English) |
|---|---|---|---|---|---|
| `admin-platform-portal` | `/api/v1/platform/jarvis` | `platform-hq` | `SOVEREIGN_ADMIN_PERSONA` (Nyumba Mind HQ) | `industry` | Whole platform via DP-aggregate cohort signals |
| `admin-portal` (deprecated — agency admins should use owner-portal instead) | `/api/v1/admin/jarvis` | `admin-portal` | `ORG_ADMIN_PERSONA` (Agency Brain) | `org` | Their full org |
| `owner-portal` | `/api/v1/owner/jarvis` | `owner-portal` | `OWNER_ADVISOR_PERSONA` | `portfolio` | Their properties + their tenants' activity + their own actions |
| `estate-manager-app` | `/api/v1/manager/jarvis` | `estate-manager-app` | `ESTATE_MANAGER_PERSONA` | `property` | Their assigned properties |
| `customer-app` | `/api/v1/customer/jarvis` | `tenant-app` | `TENANT_RESIDENT_PERSONA` | `lease` | Their own lease |

Two more surfaces exist in the kernel (`marketing`, `classroom`) but are not currently wired to dedicated portals; they are reusable identities for product-page chat and training scenarios respectively.

The factory accepts a `consumerSurface` flag for the tenant app. When set, it tightens the per-request `tier` enum to `tenant | lease | unit | property` so a logged-in resident cannot escalate themselves to org or industry tier through a hand-crafted body.

```ts
const ALL_TIERS      = ['tenant','lease','unit','block','property','portfolio','org','industry'] as const;
const CONSUMER_TIERS = ['tenant','lease','unit','property'] as const;
```

---

## 3. Single intelligence, per-user instance

Nyumba Mind is **one** intelligence with **per-user instantiation**. There is no separate model, separate prompt, or separate brain per portal — the differentiation is configuration on top of a shared kernel.

What is shared across every user, every portal, every tier:

- The kernel pipeline (see `packages/central-intelligence/src/kernel/kernel.ts`) — 13 steps from cache → inviolable → tier check → memory → cohort → prompt assembly → sensor → normalise → judge → drift → policy → confidence → provenance.
- The persona system (`identity.ts`) — eight persona records and one personalisation function.
- The gates — inviolable, tier compatibility, policy, four-eye approval.
- The audit chain — CoT reservoir, drift events, provenance records.
- The sensors — Anthropic Opus / Sonnet / Haiku presets behind a router with failover.

What changes per user:

- The `SovereignBrain` *instance* — cached per `(tenantId, userId)` composition key (see Section 7).
- The visibility scope inherited from auth (tenant id + roles + actor user id).
- The persona — selected by `surface`, then personalised by `UserProfile`.
- The default tier of the surface (and the per-request tier ceiling for consumer surfaces).
- The grounding facts the kernel can reach (filtered by tenant scope).

> Same intelligence, same power — narrowed to that user's domain.

A tenant resident asking "what is my balance?" and a HQ employee asking "what is the platform-wide arrears trend?" hit identical kernel code paths. They diverge only in the inputs: persona, scope, tier, grounding source, and cohort source.

---

## 4. The visibility hierarchy / awareness scope lattice

Tiers form a strict containment lattice. Lower tiers see the smallest unit; higher tiers see broader rollups. The lattice is enforced in `packages/central-intelligence/src/kernel/awareness-scopes.ts`:

```
tenant ⊂ lease ⊂ unit ⊂ block ⊂ property ⊂ portfolio ⊂ org ⊂ industry
```

Each tier's locus phrase — what the assistant *is* at that tier — is rendered into the system prompt by `locusPhrase()`:

| Tier | Locus phrase |
|---|---|
| `tenant` | this resident's personal concierge inside the estate |
| `lease` | this lease, in conversation with its signatories |
| `unit` | this unit, summarising its leases over time |
| `block` | this block of units |
| `property` | this property, summarising every block |
| `portfolio` | this owner's portfolio of properties |
| `org` | this estate-management organisation in full |
| `industry` | the platform-wide aggregate |

### Tier compatibility — `isTierCompatibleWithScope`

Beyond the lattice, the kernel enforces a binary gate between the two `ScopeContext` kinds (`tenant` vs `platform`) and the requested tier:

| Scope kind | Allowed tiers |
|---|---|
| `tenant` | `tenant`, `lease`, `unit`, `block`, `property`, `portfolio`, `org` |
| `platform` | `industry` only |

```ts
if (scope.kind === 'platform' && tier !== 'industry') {
  return { ok: false, reason: `platform scope can only think at tier=industry; got tier=${tier}` };
}
if (scope.kind === 'tenant' && tier === 'industry') {
  return { ok: false, reason: 'tenant scope cannot reach industry tier; route through platform HQ' };
}
```

The kernel refuses (with `gate: 'inviolable'`) any thought that violates this rule before any sensor is called. Industry-tier reasoning is reachable only through the platform HQ portal; everything below industry is reachable only through the tenant scope.

### k-anonymity floor — `cohortMinK`

Each tier also pins a minimum `k` for any cohort-derived signal that gets mixed in. Higher tiers require stronger anonymity:

| Tier | Minimum k |
|---|---|
| `tenant`, `lease` | 5 |
| `unit`, `block` | 7 |
| `property` | 10 |
| `portfolio` | 15 |
| `org` | 20 |
| `industry` | 25 |

A cohort signal that cannot meet the floor for the current tier is dropped at step 5 of the kernel pipeline.

---

## 5. The grounding pyramid

"Grounding" is the read-only factual layer the kernel injects into the system prompt at step 5b so the sensor reasons against real tenant state, not training memory. Grounding is tier-aware:

| Tier | What grounds the answer |
|---|---|
| `tenant` | The asker's own lease facts (balance, last payment, open work-orders on their unit) |
| `lease` / `unit` | Lease state + unit state (occupancy, dates, deductions) |
| `property` | Property-wide rollups (occupancy %, vacant units, open WO count, expiring leases) |
| `portfolio` | Owner's portfolio rollups (across their properties) |
| `org` | Agency-wide rollups (across the org's properties) |
| `industry` | **DP-aggregate cohort findings only** — no per-tenant grounding |

Tenant-scope tiers (everything below `industry`) read from `createKernelGroundingProvider(db, { tenantId })` — a Drizzle-backed provider that issues cheap COUNT queries against `units`, `leases`, and `work_orders`, all scoped by `tenantId`.

Industry tier rides on `createDpCohortSource()` instead. There is no per-tenant grounding at industry tier — only differentially-private aggregates produced by `@bossnyumba/graph-privacy`'s `createDpAggregator()` against the privacy budget ledger. The platform persona literally cannot name a tenant; the channel does not deliver per-tenant data.

---

## 6. The persona personalisation flow

A request from any portal flows through the gateway like this:

```
POST /api/v1/<portal>/jarvis/think
  └─ authMiddleware
       └─ ctx.auth = { userId, tenantId, roles, displayName, ... }
            └─ actorProfileFromContext(c, greetingStyle)  →  UserProfile
                 ↓
                 scopeFromContext(c, surface)             →  ScopeContext
                      ↓
                      basePersona = selectPersona(req)         // by surface
                           ↓
                           personalised = personalisePersona(basePersona, profile)
                                ↓
                                kernel.think(req)
                                  └─ renderIdentityPreamble({ persona: personalised, scope })  // FIRST in system prompt
                                       └─ … sensor call → judge → drift → policy → confidence …
                                            ↓
                                            audited BrainDecision  →  { kind, text, confidence, provenance }
```

`personalisePersona()` rewrites the persona's `openingStatement` so the AI greets the operator by name, references their role, and names their affiliation. Greeting style toggles tone:

| `greetingStyle` | Opening shape |
|---|---|
| `formal` | `Jane Doe,` |
| `warm` | `Hello Jane,` |
| `terse` | `Jane —` |

The result then flows through `renderIdentityPreamble()`, which wraps the personalised opening with `[IDENTITY — DO NOT OVERRIDE]` markers and adds the scope line, voice line, first-person form, and taboos. This block is the first content of the system prompt — downstream prompt assembly may append, but never prepend or replace it.

Per-portal default greeting styles (configured in the factory):

| Surface | Greeting style |
|---|---|
| `tenant-app` | `warm` |
| `owner-portal` | `warm` |
| `estate-manager-app` | `terse` |
| `admin-portal` | `warm` |
| `platform-hq` | `warm` |

---

## 7. Per-user privacy and data isolation

Three independent layers prevent any cross-user bleed:

### 7.1 Brain cache key includes `actorUserId`

`packages/central-intelligence/src/kernel/brain-cache.ts → thoughtCacheKey(req)` hashes:

```
scope.kind | tenantId | actorUserId | personaId | tier | surface | stakes | sha(userMessage)
```

Two users in the same agency tenant who happen to ask the exact same question must NOT share a cache entry — every thought is grounded against the actor's own permissions, voice, and provenance, so the cached `BrainDecision` is intrinsically per-actor.

### 7.2 SovereignBrain composition cache key is `tenantId`

`services/api-gateway/src/composition/sovereign.ts → getSovereignBrain({ tenantId })` keeps one cached `SovereignBrain` per tenant scope, with `__platform__` reserved for tenant-less platform-tier callers. The brain itself is otherwise stateless except for its 60s thought cache; the per-tenant cache exists so sensor connections and the Postgres approval store stay warm.

The next iteration will widen this key to `tenantId::userId` so per-user-scoped role data (per the role-aware Drizzle adapters) lives in its own brain instance. The composition layer is the single point that has to change; downstream callers already pass actor identity via `ScopeContext.actorUserId`.

### 7.3 Drizzle adapters scope by `tenantId` (and now `userId` where role-aware)

Every kernel-substrate sink, memory service, grounding provider, approval store, and tenant-aggregate source the gateway wires into the brain takes `{ tenantId }` at construction:

```ts
const svc        = createKernelSubstrateService(db, { tenantId: scope.tenantId });
const memory     = createKernelMemoryService(db, { tenantId: scope.tenantId });
const grounding  = createKernelGroundingProvider(db, { tenantId: scope.tenantId });
const approvals  = createPgApprovalStore(db, { tenantId: scope.tenantId });
```

Role-aware adapters take `{ tenantId, userId }` so a portfolio-scoped owner reads only their properties, a property-scoped manager only their assigned ones, and a lease-scoped resident only their own lease.

---

## 8. Production environment switches

Three environment variables flip the brain from dev-stub to live:

| Env var | What it activates |
|---|---|
| `ANTHROPIC_API_KEY` | Real Claude sensors (Opus / Sonnet) via `@anthropic-ai/sdk`, with the auto-Haiku judge wired by `composeSovereign`. Without it, a clearly-marked stub sensor responds `[stub sensor — set ANTHROPIC_API_KEY for live AI] You said: …`. |
| `DATABASE_URL` | Drizzle-backed substrate sinks (`kernel_cot_reservoir`, `kernel_persona_drift_events`, `kernel_provenance`), the `sovereign_approvals` Postgres store, the kernel memory service (prior turns + recent-turn count), and the kernel grounding provider. Without it, in-memory sinks are used. |
| `PRIVACY_BUDGET_EPSILON` | DP cohort source becomes live with that ε budget (and δ = 1e-6). The `createDpAggregator` is constructed against `createInMemoryBudgetLedger({ totalEpsilon, totalDelta: 1e-6 })`. Unset / zero / non-numeric disables the channel, and the kernel falls back to skipping cohort signals — industry-tier prompts then have no cohort grounding. |

The Anthropic SDK is dynamically imported so the gateway can boot without the package installed; if `import('@anthropic-ai/sdk')` fails, the composition layer logs once and falls back to the stub sensor.

These three are the *brain-on/off* switches. The brain-DNA layer above
the kernel (memory, market data, public surface rate-limit, NEXT_PUBLIC
client-side URLs, etc.) consumes a second tier of variables —
`MARKET_DATA_PROVIDER` + `ZILLOW_API_KEY` + `AIRBNB_API_KEY`,
`PUBLIC_RATE_LIMIT_SALT`, `NEXT_PUBLIC_API_GATEWAY_URL`,
`NEXT_PUBLIC_OWNER_PORTAL_URL`. See RUNBOOK §1.5 for the consolidated
inventory.

---

## 9. Migration roster — must run before live testing

The brain-DNA arc spans migrations **0114 through 0123**. The first
three (`0114`, `0115`, `0116`) are the audit + approvals + privacy
floor — without them the kernel boots in-memory and the audit chain
resets on every gateway restart. Migrations 0117–0123 unlock specific
brain-DNA modules (currency, branding, market-data cache, memory
hierarchy, online-learning feedback, agency layer); see RUNBOOK §1.2
for the full ten-row table and verification queries.

| Migration | File | Tables introduced |
|---|---|---|
| `0114_kernel_substrate.sql` | `packages/database/src/migrations/0114_kernel_substrate.sql` | `kernel_cot_reservoir`, `kernel_persona_drift_events`, `kernel_provenance` (plus enums `kernel_stakes`, `kernel_tier`, `kernel_scope_kind`, `persona_drift_violation`, `persona_drift_severity`) |
| `0115_sovereign_approvals.sql` | `packages/database/src/migrations/0115_sovereign_approvals.sql` | `sovereign_approvals` (plus enums `sovereign_approval_status`, `sovereign_approval_stakes`) |
| `0116_platform_privacy_budget.sql` | same path | `platform_privacy_budget`, `platform_privacy_budget_reservations` (DP epsilon ledger + reservation log) |
| `0117_currency_rates.sql` | same path | `currency_rates` (ISO-4217 → USD FX snapshot for the platform-overview revenue normaliser) |
| `0118_persona_branding.sql` | same path | `persona_branding` keyed by `(tenant_id, surface)` — re-skins displayName / openingPreamble / voiceProfileId |
| `0119_currency_preferences.sql` | same path | `currency_preferences` — user → tenant → platform-default resolution chain |
| `0120_market_data_cache.sql` | same path | `market_data_cache` — TTL cache for Zillow / Airbnb / regional rent feeds |
| `0121_kernel_memory_stores.sql` | same path | `kernel_memory_episodic`, `_semantic`, `_procedural`, `_reflective` (four-tier memory hierarchy) |
| `0122_kernel_feedback.sql` | same path | `kernel_feedback` — thumbs / explicit-correction signal store for online learning |
| `0123_kernel_agency.sql` | same path | `kernel_goals` (persistent objective stack) and `kernel_action_audit` (append-only every-transition log) |

All ten migrations are idempotent (`CREATE … IF NOT EXISTS` /
`DO $$ EXCEPTION duplicate_object` guards) and safe to re-run on an
already-migrated environment. The composition layer in
`services/api-gateway/src/composition/sovereign.ts` skips the
Drizzle-backed sinks when the corresponding table query fails, so a
partial migration set still boots — it just runs in-memory.

---

## 10. Frontend integration — one hook, one factory

All four user-facing portals (HQ + owner + estate-manager + customer) consume Nyumba Mind through the same primitive: the `useJarvis` hook from `@bossnyumba/chat-ui`, fed a surface-bound client built from `createJarvisClient(client, surface)` in `@bossnyumba/api-sdk`. (The deprecated `apps/admin-portal/` also has a `/jarvis` page that uses the same primitive, but that app is being consolidated; new agency-admin work goes through `owner-portal`.)

| Page | Path | Surface arg |
|---|---|---|
| `apps/admin-platform-portal/src/app/jarvis/JarvisConsole.tsx` | `/jarvis` | `'platform'` |
| `apps/admin-portal/src/pages/Jarvis.tsx` | `/jarvis` | `'admin'` |
| `apps/owner-portal/src/pages/Jarvis.tsx` | `/jarvis` | `'owner'` |
| `apps/estate-manager-app/src/app/jarvis/JarvisConsole.tsx` | `/jarvis` | `'manager'` |
| `apps/customer-app/src/app/jarvis/JarvisConsole.tsx` | `/jarvis` | `'customer'` |

The `createJarvisClient` factory maps the surface argument to a path prefix and delegates to the shared `BossnyumbaClient.request()` transport:

```ts
const SURFACE_PATH: Record<JarvisSurface, string> = {
  customer: '/api/v1/customer/jarvis',
  owner:    '/api/v1/owner/jarvis',
  manager:  '/api/v1/manager/jarvis',
  admin:    '/api/v1/admin/jarvis',
  platform: '/api/v1/platform/jarvis',
};
```

The hook is intentionally headless. It manages:

- The `turns` rendering buffer (user / assistant pairs).
- A `status` machine (`idle | thinking | error`).
- The current `persona` returned by the gateway after the first `think()`.
- A `think(message, override?)` method that submits to the kernel and appends the resulting turn (or a refusal placeholder).
- A `reset()` method to clear local state.

Layout, styling, and the rendering of confidence / refusal / softened states are the calling app's responsibility. Threads are *not* persisted client-side — the gateway already records every turn through the kernel's audit chain; the local buffer is the rendering buffer only.

---

## 11. The `BrainDecision` shape

Every `kernel.think(req)` resolves to one of three discriminated cases:

| `decision.kind` | When | Shape |
|---|---|---|
| `answer` | Sensor produced text, judge passed, no policy/drift violation | `{ kind: 'answer', text, confidence, citations?, artifacts?, provenance }` |
| `softened` | Same as `answer` but the policy gate or judge softened the wording (e.g. removed an absolute claim) | Same shape; `provenance.gates` records which gate softened it |
| `refusal` | Inviolable, tier mismatch, policy block, or drift block | `{ kind: 'refusal', reason, gate: 'inviolable' \| 'policy' \| 'drift', provenance }` |

`provenance` is a `ProvenanceRecord` written to `kernel_provenance` (when `DATABASE_URL` is set) carrying `thoughtId`, `threadId`, `tenantId`, `actorUserId`, `personaId`, `tier`, `surface`, `stakes`, `sensorId`, `modelId`, `latencyMs`, gate verdicts, judge score, and a SHA of the rendered system prompt. The `thoughtId` is the idempotency anchor — the brain cache, the four-eye approval store, and the CoT reservoir all key off it.

The streaming variant (`POST /stream`) emits the same decision but progressively. The kernel itself is single-shot; the gateway chunks `decision.text` into ~7 whitespace-snapped pieces and emits them as SSE deltas:

```
event: turn_start    data: { persona: { id, displayName, firstPersonNoun } }
event: delta         data: { delta: '<chunk>' }     // 5–10 events
event: confidence    data: ConfidenceVector         // answer / softened only
event: done          data: { thoughtId, kind }
```

A refusal collapses to a single `delta` carrying the refusal reason, no `confidence`, then `done`. A sensor exception emits one `error` event followed by a final `done` so the client always closes cleanly.

---

## 12. Four-eye approval — sovereign-tier writes

Any sovereign-tier write action proposed by Nyumba Mind passes through `ApprovalGate` (`packages/central-intelligence/src/kernel/four-eye-approval.ts`) before execution. The gate enforces:

- **Two distinct approvers** — proposer cannot self-approve.
- **Stakes floor** — the action's `stakes` (`medium | high | critical`) must match what the kernel emitted; the gateway rejects mismatches at `POST /actions`.
- **TTL** — pending approvals expire automatically; expired records cannot be signed.
- **Status transitions** — `pending → one-eye → approved | rejected | expired`. Approved is the only terminal status that authorises a downstream tool call.

Lifecycle through the per-portal Jarvis router:

| Step | Endpoint | Side-effects |
|---|---|---|
| 1. Brain proposes | `POST /actions` body `{ thoughtId, summary, toolName, payload, stakes }` | Insert into `sovereign_approvals` with `status='pending'`, `proposer_user_id` from `ctx.auth.userId`. |
| 2. First signer | `POST /actions/:id/sign` body `{ verdict, comment? }` | If `verdict='approve'`, status moves to `one-eye`; if `verdict='reject'`, status moves to `rejected` and short-circuits. |
| 3. Second signer | `POST /actions/:id/sign` (different user) | Approve → status `approved`; reject → status `rejected`. Self-sign by proposer is refused with `SIGN_REJECTED`. |
| 4. Inspect | `GET /actions/:id` and `GET /actions?status=…` | Read-only audit surface. |

In Postgres mode (`DATABASE_URL` set), `createPgApprovalStore(db, { tenantId })` writes to the `sovereign_approvals` table. In dev / test, an in-memory store is used. The gate is portal-agnostic — the same approval lifecycle applies whether the proposing brain belongs to a tenant resident, an estate manager, or a HQ employee. Stakes and tier interact: at `industry` tier, `medium`-stakes proposals are still gated.

---

## 13. Putting it all together — life of a HQ think()

A HQ employee at `apps/admin-platform-portal/` opens `/jarvis`, types "what is the platform-wide collection trend this month?", presses send.

1. `useJarvis.think(message)` appends a user turn locally and calls `client.request({ method: 'POST', path: '/api/v1/platform/jarvis/think', body: { threadId, userMessage, tier: 'industry', stakes: 'medium' } })`.
2. The gateway `authMiddleware` populates `ctx.auth` with the HQ employee's `userId`, no `tenantId` (HQ users are tenant-less), roles, display name.
3. `actorProfileFromContext()` produces a `UserProfile` and `scopeFromContext()` produces `{ kind: 'platform', actorUserId, roles, personaId: 'sovereign-admin' }`.
4. `getSovereignBrain({ tenantId: null })` returns the cached platform-tier `SovereignBrain` (or builds one — Drizzle sinks if `DATABASE_URL` is set, real Anthropic sensors if `ANTHROPIC_API_KEY` is set, DP cohort source if `PRIVACY_BUDGET_EPSILON` is set).
5. `selectPersona(req)` returns `SOVEREIGN_ADMIN_PERSONA` (Nyumba Mind). `personalisePersona(base, profile)` rewrites its opening with the operator's name.
6. `kernel.think(req)`:
   - cache miss
   - inviolable: pass
   - tier compatibility: `kind=platform, tier=industry` → ok
   - memory recall: prior turns for this `threadId`
   - cohort signal: DP-aggregate query against the privacy budget, k ≥ 25
   - prompt assembly: `[IDENTITY] … [SCOPE] … [LOCUS = the platform-wide aggregate] … [COHORT] …`
   - sensor: routed to the Opus 4.7 sensor (preset `opus47`) with failover to Sonnet
   - normalise: strip preamble, extract `ui_block`
   - judge: Haiku score (auto-judge enabled)
   - drift: substring scan against `SOVEREIGN_ADMIN_PERSONA.violationSignals`
   - policy gate: PII / numerical / regulatory checks
   - confidence: scored
   - provenance: written to `kernel_provenance`
7. Gateway responds `{ success: true, surface: 'platform-hq', persona: { id, displayName, firstPersonNoun }, decision }`.
8. `useJarvis` appends an assistant turn with the decision attached; the `JarvisConsole` page renders the text plus a confidence pill.

---

## 14. Brain-DNA layer — modules above the kernel

The 13-step `think()` pipeline in §13 is the *cognitive core*. Above
it, the brain-DNA layer adds nine sub-modules that give the kernel
persistent memory, world simulation, internal debate, online learning,
self-knowledge, agency, voice, and per-tenant branding. Every module
is composable behind a duck-typed port; the api-gateway composition
root binds the production adapter and tests bind in-memory fakes.

| Module | Code path | Role above the kernel |
|---|---|---|
| memory | `packages/central-intelligence/src/kernel/memory/` | Four-tier hierarchy: episodic / semantic / procedural / reflective. Read at step 4 of `think()`; written by the surface routers and the consolidation runner. Backed by 0121. |
| consolidation | `packages/central-intelligence/src/kernel/consolidation/` | Runs offline (cron) — extracts facts, detects procedural patterns, writes weekly digests, purges TTL'd episodes, decays old facts. |
| world-model | `packages/central-intelligence/src/kernel/world-model/` | Forward-simulation tools (`forecastPropertyTrajectory`, `forecastTenantArrearsTrajectory`, `forecastOwnerCashflow`, `detectMarketRegime`) the kernel can invoke through the tool registry. |
| debate | `packages/central-intelligence/src/kernel/debate/` | High-stakes deliberation — `runDebate(question, context, deps, config)` for N-voice × R-round synthesis, `buildCounterfactuals` + `runCounterfactuals` for "what-if" perturbations. |
| feedback | `packages/central-intelligence/src/kernel/feedback/` | Online-learning side-channel — at step 4 the kernel reads recent thumbs / corrections and biases the next turn toward conservative output when the negative-rate is elevated. Backed by 0122. |
| introspection | `packages/central-intelligence/src/kernel/introspection/` | Decision-trace replay (`runDecisionReplay`) re-runs historical thoughts through current logic to detect drift / regression / fairness anomalies; `CAPABILITY_CARDS` document each persona's claims, refusals, and uncertainty bands. |
| agency | `packages/central-intelligence/src/kernel/agency/` | Persistent `goals/` + plan decomposer; typed `action-tools/` registry; `executor/` with autonomy policy + audit; `initiative/` wake-loop. Backed by 0123. |
| voice | `packages/central-intelligence/src/voice/` + `kernel/voice-bridge.ts` | Voice resolver maps `ScopeContext` → `VoiceBinding`; voice-bridge marries the cognitive persona with the voice-persona-dna profile (tone / register / code-switching / greeting / closing / taboos). |
| branding | `packages/central-intelligence/src/kernel/branding.ts` (+ `services/persona-branding.service.ts`) | Per-tenant `(tenant_id, surface)` overrides re-skin `displayName` / `openingPreamble` / `voiceProfileId` immutably without replacing the surface-default persona. Backed by 0118. |

### Two-mode invocation

| Mode | Entry | Trigger |
|---|---|---|
| In-process — read-only at step 4 of `think()` | `kernel.think(req)` | Memory recall, feedback recall, capability-card lookup. |
| In-process — tool call from the kernel | Tool registry | World-model forecasts, debate, counterfactuals, market-data adapters. |
| Out-of-process — scheduled | `consolidation-runner.ts` CLI; `runWakeCycle` library | The brain's "sleep" cycle and the proactive-initiative loop. See RUNBOOK §6 for cron wiring. |

### Online-learning loop in detail

1. User sends a turn → kernel writes one episodic row.
2. User leaves a thumbs-down or correction → gateway writes a
   `kernel_feedback` row.
3. Next turn from the same user → step 4 of `think()` reads the
   recent feedback through the feedback port; the system prompt is
   augmented with an apology / conservative-bias hint.
4. Overnight, the consolidation cycle re-reads episodes and writes
   higher-confidence facts to `kernel_memory_semantic` whenever the
   same fact recurred (`evidence_count` increments).
5. Procedural patterns detected over the same window become
   ranked-by-success-rate suggestions for future tool invocations.

### Agency layer in detail

The agency layer is the kernel's "acts in full control" slice:

- `goals.open(...)` writes a `kernel_goals` row with a JSON
  `steps` decomposition produced by the plan-decomposer.
- `executor.executeGoal(goalId)` walks each step, calls the typed
  action-tool, writes one `kernel_action_audit` row per transition
  (`running` → `done` | `failed` | `awaiting-approval` | `skipped` |
  `unknown-tool`).
- `awaiting-approval` outcomes are routed through the existing
  four-eye `sovereign_approvals` gate (§12) — sovereign-tier writes
  remain double-signed even when the executor proposes them.
- The wake-loop runs each registered `WakeTrigger.detect(...)`,
  opens any returned goals, and immediately executes them — so the
  brain can act between user turns when a deterministic detector
  fires (arrears spike, vacancy-rate jump, expiring leases).

### Per-tenant branding in detail

Tenants (typically agencies) configure overrides in the
`persona_branding` table keyed by `(tenant_id, surface)`. An empty
`surface` row is the surface-agnostic fallback; surface-specific rows
override it. The kernel loads the override at request time and applies
it IMMUTABLY — a fresh `PersonaIdentity` is returned, the base persona
is left untouched, and `voice` / `tone` / `taboos` / `firstPersonNoun`
all flow through unchanged. Voice profile id is consumed by the
voice-bridge separately.

---

## 15. File map (essential paths)

```
packages/central-intelligence/src/
├── kernel/
│   ├── kernel.ts                  // 13-step think() pipeline
│   ├── compose.ts                 // composeSovereign() — wires kernel + approvals + briefing + nudges
│   ├── identity.ts                // 8 personas + selectPersona() + personalisePersona() + renderIdentityPreamble()
│   ├── awareness-scopes.ts        // tier lattice + isTierCompatibleWithScope() + cohortMinK()
│   ├── brain-cache.ts             // thoughtCacheKey() — includes actorUserId
│   ├── inviolable.ts              // hard refusal gate
│   ├── policy-gate.ts             // PII / numerical / regulatory
│   ├── self-awareness.ts          // persona-drift detection
│   ├── confidence.ts              // ConfidenceVector scorer
│   ├── normalizer.ts              // sensor output normaliser
│   ├── four-eye-approval.ts       // ApprovalGate
│   ├── briefing.ts                // BriefingComposer
│   ├── proactive-nudge.ts         // NudgeRouter
│   ├── cohort-signal.ts           // CohortSource port + buildCohortMixin()
│   ├── cot-reservoir.ts           // sampled chain-of-thought reservoir
│   ├── branding.ts                // per-tenant persona overrides (table 0118)
│   ├── voice-bridge.ts            // marries cognitive persona + voice-persona-dna profile
│   ├── public-inviolable.ts       // hard refusal gate for the unauthenticated public surface
│   ├── memory/                    // four-tier memory ports (table 0121)
│   ├── consolidation/             // "sleep" cycle — facts / patterns / digests / TTL / decay
│   ├── world-model/               // trajectory + regime-detector tools
│   ├── debate/                    // N-voice × R-round + counterfactuals
│   ├── feedback/                  // online-learning side-channel (table 0122)
│   ├── introspection/             // decision-trace replay + capability cards
│   ├── agency/                    // goals + action-tools + executor + wake-loop (table 0123)
│   ├── sources/dp-cohort-source.ts
│   └── sensors/anthropic-sensor.ts, anthropic-judge.ts
└── voice/resolver.ts              // ScopeContext → VoiceBinding

services/api-gateway/src/
├── routes/
│   ├── jarvis-router-factory.ts   // createJarvisRouter() + 5 pre-configured surface routers
│   ├── admin-jarvis.router.ts     // thin re-export of orgAdminJarvisRouter
│   ├── platform-overview.router.ts
│   └── …
├── composition/
│   ├── sovereign.ts               // getSovereignBrain({ tenantId }) — env-driven boot
│   ├── consolidation-runner.ts    // CLI + library entry for the brain's "sleep" cycle
│   └── db-client.ts               // getDb()
├── middleware/public-ai-rate-limit.ts  // sliding-window guard on /api/v1/public/*
└── index.ts                       // mounts /api/v1/{customer,owner,manager,admin,platform}/jarvis

packages/database/src/
├── migrations/
│   ├── 0114_kernel_substrate.sql       // CoT reservoir, drift events, provenance
│   ├── 0115_sovereign_approvals.sql    // four-eye approval gate
│   ├── 0116_platform_privacy_budget.sql // DP epsilon ledger + reservation log
│   ├── 0117_currency_rates.sql         // FX snapshot
│   ├── 0118_persona_branding.sql       // per-tenant persona overrides
│   ├── 0119_currency_preferences.sql   // user / tenant / platform display-currency
│   ├── 0120_market_data_cache.sql      // TTL cache for Zillow / Airbnb
│   ├── 0121_kernel_memory_stores.sql   // episodic / semantic / procedural / reflective
│   ├── 0122_kernel_feedback.sql        // thumbs / corrections store
│   └── 0123_kernel_agency.sql          // kernel_goals + kernel_action_audit
└── services/
    ├── kernel-grounding.service.ts
    ├── kernel-memory.service.ts
    ├── kernel-substrate.service.ts
    └── persona-branding.service.ts

packages/api-sdk/src/jarvis-client.ts   // createJarvisClient(client, surface)
packages/chat-ui/src/hooks/useJarvis.ts // useJarvis hook (headless)

apps/
├── admin-platform-portal/src/app/jarvis/JarvisConsole.tsx   // surface = 'platform'
├── admin-portal/src/pages/Jarvis.tsx                        // surface = 'admin'
├── owner-portal/src/pages/Jarvis.tsx                        // surface = 'owner'
├── estate-manager-app/src/app/jarvis/JarvisConsole.tsx      // surface = 'manager'
└── customer-app/src/app/jarvis/JarvisConsole.tsx            // surface = 'customer'
```

---

## 16. Quick reference — at-a-glance answers

- **Where is the persona catalogue?** `packages/central-intelligence/src/kernel/identity.ts`.
- **Where is the surface → persona map?** Same file, `SURFACE_DEFAULT_PERSONA`.
- **Where is the tier lattice enforced?** `packages/central-intelligence/src/kernel/awareness-scopes.ts`.
- **Where do I add a new portal?** Add a `createJarvisRouter({ surface, defaultTier, … })` in `jarvis-router-factory.ts`, mount it in `services/api-gateway/src/index.ts`, add a persona to `identity.ts` if needed, add a `JarvisSurface` entry to `packages/api-sdk/src/jarvis-client.ts`'s `SURFACE_PATH`, and call `useJarvis` in the new app.
- **Why does my dev gateway answer with "[stub sensor — …]"?** `ANTHROPIC_API_KEY` is not set.
- **Why is my think() succeeding but provenance not appearing in `kernel_provenance`?** `DATABASE_URL` is unset, or migrations 0114 / 0115 have not been applied.
- **Why does my industry-tier think() return no cohort grounding?** `PRIVACY_BUDGET_EPSILON` is unset, zero, or non-numeric.
- **Can a tenant resident escalate themselves to an industry-tier query?** No. The factory tightens the per-request `tier` enum to consumer tiers, and even if the body bypassed Zod, `isTierCompatibleWithScope` would refuse it.
- **Can two users in the same tenant share a cached thought?** No. `thoughtCacheKey` mixes in `actorUserId`.
- **Does `admin-portal` mean BossNyumba HQ?** No — and `admin-portal` is **deprecated**. HQ is `admin-platform-portal`. Customer-side admin work belongs in `owner-portal` (owners are the admins; they invite their own admin sub-users there). See the DO NOT CONFUSE callout in Section 1 and `apps/admin-portal/DEPRECATED.md`.
- **Where do the brain-DNA modules live?** §14 above; code under `packages/central-intelligence/src/kernel/{memory,consolidation,world-model,debate,feedback,introspection,agency}/` plus `voice/` and `kernel/branding.ts`.
- **How does the brain learn from feedback?** Thumbs / corrections written to `kernel_feedback` (table 0122) are read at step 4 of the next `think()` and bias the system prompt. Overnight, the consolidation cycle reinforces semantic facts whose `evidence_count` increased. See §14 "Online-learning loop".
- **Where is the consolidation runner wired?** `services/api-gateway/src/composition/consolidation-runner.ts`. RUNBOOK §6 has the cron wiring.
- **How does a tenant agency rebrand the AI?** Insert a row in `persona_branding` keyed by `(tenant_id, surface)` with a `display_name` / `opening_preamble` / `voice_profile_id`. The kernel applies the override immutably; voice / tone / taboos / first-person-noun all flow through unchanged. See §14 "Per-tenant branding".
- **Does the brain take action on its own?** Yes — through the agency layer (§14). Persistent goals decompose into typed action-tool calls; the executor walks each step and writes one `kernel_action_audit` row per transition; sovereign-tier writes still pass through the four-eye gate (§12).
- **Which user-memory rules are load-bearing here?** `feedback_user_currency_choice.md` (migration 0119 is its implementation) and `feedback_world_starting_tz.md` (no hard-coded jurisdiction / currency / locale branches in business logic).
