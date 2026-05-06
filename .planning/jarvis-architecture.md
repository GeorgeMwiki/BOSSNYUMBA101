# BossNyumba — Nyumba Mind Architecture

A reference for how the Nyumba Mind ("Jarvis") personal-AI surface is wired across the platform. One kernel, six personas, five portals, per-user instances.

---

## 1. The five user-facing portals

BossNyumba ships five distinct frontends, each compiled into its own app and served on its own port. They differ by audience, persona, and visibility scope — but they all consume the same Nyumba Mind kernel through a single `createJarvisRouter()` factory in the gateway.

| App directory | Stack | Dev port | Audience | Tier this app feels like |
|---|---|---|---|---|
| `apps/admin-platform-portal/` | Next.js | 3020 | **BossNyumba HQ employees** (us) | Sovereign — industry-wide |
| `apps/admin-portal/` | Vite (React SPA) | 3000 | **Agency administrators** (our customers) | Org — agency-wide |
| `apps/owner-portal/` | Vite (React SPA) | 3001 | Property owners | Portfolio — properties they own |
| `apps/estate-manager-app/` | Next.js | 3003 | Estate managers / operations | Property — properties they run |
| `apps/customer-app/` | Next.js | 3002 | Tenant residents | Lease — their own lease |

> **DO NOT CONFUSE — `admin-portal` vs `admin-platform-portal`**
>
> These two apps are **not** the same thing and must **never** be conflated in code, docs, configuration, or conversation:
>
> - `apps/admin-platform-portal/` (Next.js, port **3020**) is **BossNyumba HQ INTERNAL**. This is *us*. The audience is BossNyumba staff. Persona is `SOVEREIGN_ADMIN_PERSONA` ("Nyumba Mind"). Default tier is `industry`. It mounts at `/api/v1/platform/jarvis`.
> - `apps/admin-portal/` (Vite, port **3000**) is the **agency admin portal — our customers' app**. The audience is the agency CEO/admin running their estate-management business on top of BossNyumba. Persona is `ORG_ADMIN_PERSONA` ("Nyumba Mind — Agency Brain"). Default tier is `org`. It mounts at `/api/v1/admin/jarvis`.
>
> Both personas brand as "Nyumba Mind", but the seat, audience, scope, and persona are different. When in doubt, look at the path prefix: `/admin/` is the agency, `/platform/` is HQ.

The `owner-portal` is a property-owner seat. Owners can themselves invite their own admins inside the portal — that does not make those admins agency admins or HQ staff; they remain inside the owner's portfolio scope.

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

The five productional surfaces — what each one defaults to:

| Portal | Path prefix | `surface` | Persona | Default tier | Visibility (in plain English) |
|---|---|---|---|---|---|
| `admin-platform-portal` | `/api/v1/platform/jarvis` | `platform-hq` | `SOVEREIGN_ADMIN_PERSONA` (Nyumba Mind HQ) | `industry` | Whole platform via DP-aggregate cohort signals |
| `admin-portal` (agency) | `/api/v1/admin/jarvis` | `admin-portal` | `ORG_ADMIN_PERSONA` (Agency Brain) | `org` | Their full org |
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

---

## 9. Migration roster — must run before live testing

The kernel substrate and approval gate require two SQL migrations to be applied against the configured `DATABASE_URL`:

| Migration | File | Tables introduced |
|---|---|---|
| `0114_kernel_substrate.sql` | `packages/database/src/migrations/0114_kernel_substrate.sql` | `kernel_cot_reservoir`, `kernel_persona_drift_events`, `kernel_provenance` (plus enums `kernel_stakes`, `kernel_tier`, `kernel_scope_kind`, `persona_drift_violation`, `persona_drift_severity`) |
| `0115_sovereign_approvals.sql` | `packages/database/src/migrations/0115_sovereign_approvals.sql` | `sovereign_approvals` (plus enums `sovereign_approval_status`, `sovereign_approval_stakes`) |

If either migration is missing, the gateway will boot — the composition layer skips the Drizzle sinks when the DB query for the table fails — but the audit chain becomes in-memory and resets on every gateway restart. Production must apply both before serving live thinks.

---

## 10. Frontend integration — one hook, one factory

All five portals consume Nyumba Mind through the same primitive: the `useJarvis` hook from `@bossnyumba/chat-ui`, fed a surface-bound client built from `createJarvisClient(client, surface)` in `@bossnyumba/api-sdk`.

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

## 14. File map (essential paths)

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
│   ├── sources/dp-cohort-source.ts
│   └── sensors/anthropic-sensor.ts, anthropic-judge.ts

services/api-gateway/src/
├── routes/
│   ├── jarvis-router-factory.ts   // createJarvisRouter() + 5 pre-configured surface routers
│   ├── admin-jarvis.router.ts     // thin re-export of orgAdminJarvisRouter
│   └── …
├── composition/
│   ├── sovereign.ts               // getSovereignBrain({ tenantId }) — env-driven boot
│   └── db-client.ts               // getDb()
└── index.ts                       // mounts /api/v1/{customer,owner,manager,admin,platform}/jarvis

packages/database/src/
├── migrations/
│   ├── 0114_kernel_substrate.sql  // CoT reservoir, drift events, provenance
│   └── 0115_sovereign_approvals.sql // four-eye approval gate
└── services/
    ├── kernel-grounding.service.ts
    ├── kernel-memory.service.ts
    └── kernel-substrate.service.ts

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

## 15. Quick reference — at-a-glance answers

- **Where is the persona catalogue?** `packages/central-intelligence/src/kernel/identity.ts`.
- **Where is the surface → persona map?** Same file, `SURFACE_DEFAULT_PERSONA`.
- **Where is the tier lattice enforced?** `packages/central-intelligence/src/kernel/awareness-scopes.ts`.
- **Where do I add a new portal?** Add a `createJarvisRouter({ surface, defaultTier, … })` in `jarvis-router-factory.ts`, mount it in `services/api-gateway/src/index.ts`, add a persona to `identity.ts` if needed, add a `JarvisSurface` entry to `packages/api-sdk/src/jarvis-client.ts`'s `SURFACE_PATH`, and call `useJarvis` in the new app.
- **Why does my dev gateway answer with "[stub sensor — …]"?** `ANTHROPIC_API_KEY` is not set.
- **Why is my think() succeeding but provenance not appearing in `kernel_provenance`?** `DATABASE_URL` is unset, or migrations 0114 / 0115 have not been applied.
- **Why does my industry-tier think() return no cohort grounding?** `PRIVACY_BUDGET_EPSILON` is unset, zero, or non-numeric.
- **Can a tenant resident escalate themselves to an industry-tier query?** No. The factory tightens the per-request `tier` enum to consumer tiers, and even if the body bypassed Zod, `isTierCompatibleWithScope` would refuse it.
- **Can two users in the same tenant share a cached thought?** No. `thoughtCacheKey` mixes in `actorUserId`.
- **Does `admin-portal` mean BossNyumba HQ?** No — `admin-portal` is the agency admin (our customers). HQ is `admin-platform-portal`. See the DO NOT CONFUSE callout in Section 1.
