# Round 3 bug sweep — Cascade-3 (CJS↔ESM) + domain-services + cross-cutting

**Branch:** `claude/phase-d-comprehensive-gap-closure`
**Main at:** `7725eaa9`
**Auditor:** Round-3 agent (Anthropic Opus, 2026-05-19)
**Method:** Read-only audit — ran one isolated `tsup --noExternal` build against api-gateway to enumerate the 10 mismatches deterministically; otherwise pure source-read of files in scope.

## Severity rubric

- **CRITICAL** — exploitable security flaw, data loss, or production-blocking
- **HIGH** — known-broken in prod path, or significantly degraded behaviour
- **MEDIUM** — silent fallback / latent risk / inconsistent contract
- **LOW** — code-hygiene, lint, comment drift

## Totals

| Severity   | Count |
| ---------- | ----- |
| CRITICAL   | 3     |
| HIGH       | 8     |
| MEDIUM     | 7     |
| LOW        | 4     |
| **TOTAL**  | **22** |

---

## SECTION A — Cascade #3 (the 10 export mismatches), reproduced verbatim

Reproduced locally by temporarily replacing `services/api-gateway/tsup.config.ts` with `noExternal: [/^@bossnyumba\//]` and running `pnpm run build`. Exact esbuild error list (and exact lines/files):

```
[1]  src/composition/orchestrator-bindings.ts:55  tenantAutonomyCaps        from @bossnyumba/database
[2]  src/routes/audit-trail.router.ts:24          AuditTrail                from @bossnyumba/ai-copilot
[3]  src/routes/session-replay.router.ts:47       createSessionReplayChunksService from @bossnyumba/database
[4]  domain-services/dist/invoice/index.js:3      createInvoice             from @bossnyumba/domain-models
[5]  domain-services/dist/invoice/index.js:3      sendInvoice               from @bossnyumba/domain-models
[6]  domain-services/dist/invoice/index.js:3      recordPayment             from @bossnyumba/domain-models
[7]  domain-services/dist/invoice/index.js:3      markOverdue               from @bossnyumba/domain-models
[8]  domain-services/dist/invoice/index.js:3      voidInvoice               from @bossnyumba/domain-models
[9]  domain-services/dist/invoice/index.js:3      generateInvoiceNumber     from @bossnyumba/domain-models
[10] domain-services/dist/invoice/index.js:3      isOverdue                 from @bossnyumba/domain-models
```

### A1. `tenantAutonomyCaps` missing — **missing barrel**

- **File:** `packages/database/src/schemas/index.ts`
- **Class:** missing barrel export
- **Severity:** HIGH
- **Diagnosis:**
  - The Drizzle schema `tenantAutonomyCaps` DOES exist at `packages/database/src/schemas/autonomy-caps.schema.ts:34`.
  - `packages/database/src/schemas/index.ts:171` re-exports the **adjacent** file `autonomy.schema.ts` (which contains `autonomyPolicies`/`exceptionInbox`/`executiveBriefings`/`autonomousActionAudit`) but NOT `autonomy-caps.schema.ts`.
  - The `autonomy-caps.schema.ts` file ships migration `0160_autonomy_governance.sql` table definition + columns + RLS hooks (migration 0163) but lives orphaned at the barrel level.
- **How it bites:** `services/api-gateway/src/composition/orchestrator-bindings.ts:55` (`createDrizzleCostCircuit`) reads `tenantAutonomyCaps.maxCostUsdCentsPerDay` to enforce per-tenant daily AI spend cap. With this import broken under bundled-mode the cost circuit silently no-ops to `DEFAULT_CEILING_USD=$50`. Under tsx (dev/test) the import lazy-resolves through pnpm symlinks at runtime so the bug doesn't surface; under any production bundling path it does.
- **Fix:** Add `export * from './autonomy-caps.schema.js';` to `packages/database/src/schemas/index.ts` (and a corresponding line in `packages/database/src/repositories/index.ts` if a repository wrapper is desired).

### A2. `AuditTrail` missing — **typo / wrong import shape**

- **File:** `services/api-gateway/src/routes/audit-trail.router.ts:24`
- **Class:** wrong import shape (not a typo, not a missing barrel — namespace expected, value imported)
- **Severity:** HIGH
- **Diagnosis:**
  - `@bossnyumba/ai-copilot` does NOT export a top-level identifier named `AuditTrail`. Grep returns zero matches in `packages/ai-copilot/src/index.ts`.
  - But the underlying surface exists. `packages/ai-copilot/src/audit-trail/index.ts` exports `exportBundle`, `createAuditTrailRecorder`, `createAuditTrailVerifier`, etc.
  - audit-trail.router.ts:237 calls `AuditTrail.exportBundle(...)` — expecting a NAMESPACE alias.
- **How it bites:** Route returns ReferenceError / 500 the moment any tenant admin clicks "Export Bundle" in the audit UI.
- **Fix (one-line):** Re-export the namespace from the ai-copilot top barrel:
  ```ts
  // packages/ai-copilot/src/index.ts (add)
  export * as AuditTrail from './audit-trail/index.js';
  ```
  (the existing surrounding pattern is `export * as XxxNamespace from './xxx/index.js';` — 30+ namespaces are already aliased that way.)

### A3. `createSessionReplayChunksService` missing — **missing barrel**

- **File:** `packages/database/src/services/index.ts`
- **Class:** missing barrel export
- **Severity:** HIGH
- **Diagnosis:**
  - `packages/database/src/services/session-replay-chunks.service.ts:106` defines `createSessionReplayChunksService` and the file is fully implemented.
  - But `packages/database/src/services/index.ts` does not re-export it. The only place it's referenced from outside is the test file in `__tests__/`.
  - The `database/src/index.ts` top-level barrel does `export * from './services/index.js'` so any missing service-level export propagates up.
- **How it bites:** `services/api-gateway/src/routes/session-replay.router.ts:47` imports `createSessionReplayChunksService` from `@bossnyumba/database`. Under tsx this resolves through node's module loader walking into the file, but under bundled-mode esbuild errors out. **POST /api/v1/session-replay/chunks** is the rrweb upload endpoint for the admin platform's session-replay capture — the chunks pipeline is silently uncovered in any bundled deployment.
- **Fix:** Add to `packages/database/src/services/index.ts`:
  ```ts
  export {
    createSessionReplayChunksService,
    type SessionReplayChunksService,
  } from './session-replay-chunks.service.js';
  ```

### A4–A10. `createInvoice` / `sendInvoice` / `recordPayment` / `markOverdue` / `voidInvoice` / `generateInvoiceNumber` / `isOverdue` missing — **wrong import path (namespace vs flat)**

- **File:** `services/domain-services/src/invoice/index.ts:21-35` AND `packages/domain-models/src/index.ts:134`
- **Class:** wrong import path (re-export aliased as namespace `Invoice` but consumer imports flat)
- **Severity:** HIGH
- **Diagnosis:**
  - `packages/domain-models/src/financial/invoice.ts` exports 7 functions: `createInvoice`, `sendInvoice`, `recordPayment`, `markOverdue`, `voidInvoice`, `generateInvoiceNumber`, `isOverdue` — all present at lines 193, 288, 300, 327, 339, 359, 369.
  - `packages/domain-models/src/financial/index.ts:5` exports them flat: `export * from './invoice';`
  - BUT `packages/domain-models/src/index.ts:134` re-exports as namespace: `export * as Invoice from './financial/invoice';` (because adjacent file `Transaction`, `Receipt`, `ArrearsCase` also need namespacing to dodge symbol collisions).
  - `services/domain-services/src/invoice/index.ts:21-35` imports them flat from `@bossnyumba/domain-models`. The flat names are not at the top level — they're nested under `Invoice.*`.
  - The `financial/index.ts` barrel itself flatly exports them BUT is NOT directly accessible as a subpath from `@bossnyumba/domain-models` (no `./financial` subpath is declared in `domain-models/package.json` exports map).
- **How it bites:** Every consumer of `InvoiceService` in `domain-services` resolves `createInvoice` etc. as `undefined` under bundling. Under tsx, node's loose CJS↔ESM cross-resolution masks the bug because both the `Invoice` namespace AND the flat barrel reach the same underlying functions through the named exports of `./financial/invoice.ts` directly. esbuild's strict ESM checker catches it.
- **Fix (one-line each, two options):**
  - **Option A (minimum-change):** Fix the import site in domain-services to use the namespace:
    ```ts
    import { Invoice as InvoiceModel } from '@bossnyumba/domain-models';
    const { createInvoice, sendInvoice, ... } = InvoiceModel;
    ```
  - **Option B (preferred):** Re-export the financial functions flat in `packages/domain-models/src/index.ts` AND keep the `Invoice` namespace alias so existing namespace consumers keep working. Add a single line:
    ```ts
    export {
      createInvoice, sendInvoice, recordPayment, markOverdue,
      voidInvoice, generateInvoiceNumber, isOverdue,
    } from './financial/invoice';
    ```

### Summary of the 10 — categorized

| # | Identifier                          | Class             | Effort       |
| - | ----------------------------------- | ----------------- | ------------ |
| 1 | `tenantAutonomyCaps`                | missing barrel    | 1-line       |
| 2 | `AuditTrail`                        | wrong shape       | 1-line       |
| 3 | `createSessionReplayChunksService`  | missing barrel    | 4-line       |
| 4 | `createInvoice`                     | namespace mismatch | 1-line (Option B) |
| 5 | `sendInvoice`                       | namespace mismatch | (same)       |
| 6 | `recordPayment`                     | namespace mismatch | (same)       |
| 7 | `markOverdue`                       | namespace mismatch | (same)       |
| 8 | `voidInvoice`                       | namespace mismatch | (same)       |
| 9 | `generateInvoiceNumber`             | namespace mismatch | (same)       |
| 10| `isOverdue`                         | namespace mismatch | (same)       |

**All 10 are either missing barrel exports (4 of them) or wrong export shape on existing code (6 of them). NONE are genuinely-missing functionality.** Every function/value referenced exists in source — only barrels need updating.

### Cascade-3 fix-strategy recommendation

**Single PR, 3 barrel edits, 4 file changes total.** Estimated time: 30 minutes including local validation.

1. `packages/database/src/schemas/index.ts` — add `export * from './autonomy-caps.schema.js';`
2. `packages/database/src/services/index.ts` — add 4-line export for `createSessionReplayChunksService` + `SessionReplayChunksService` type
3. `packages/ai-copilot/src/index.ts` — add `export * as AuditTrail from './audit-trail/index.js';`
4. `packages/domain-models/src/index.ts` — add flat re-export of the 7 financial functions (preserving the existing `Invoice` namespace alias for back-compat)

After those four edits, flip `services/api-gateway/tsup.config.ts` to `noExternal: [/^@bossnyumba\//]` and `format: ['esm']` (so the gateway emits ESM that matches the workspace `"type": "module"` declarations). Validate with `pnpm --filter @bossnyumba/api-gateway build && node services/api-gateway/dist/index.js --version-check`.

The **alternative incremental strategy** (one barrel at a time over multiple PRs) is NOT recommended — the 10 mismatches together unblock a single boot path. Splitting them just multiplies CI cost without partial-progress value (the gateway still won't boot until all 10 are closed).

### Cascade-3 corollary: tsx (dev) still works after fix

`pnpm dev` runs via `tsx watch --env-file=../../.env src/index.ts`. tsx uses node's native ESM loader with TS-on-the-fly transpilation; it does NOT pre-resolve subpath exports the way esbuild does at bundle time. So the same `tsup --noExternal` change has zero impact on the dev loop. Tests use vitest 4.x which does its own ESM resolution (separate from tsx) and ALSO already handles these imports — adding the barrel exports cannot regress test behaviour because the names appear in source as already-named exports.

---

## SECTION B — Domain-services deep audit

### B1. `services/domain-services/src/index.ts:1` — blanket `@ts-nocheck` on the top-level barrel — **HIGH**

- The barrel admits `// @ts-nocheck — barrel re-export collisions (CustomerCreatedEvent, Invoice, DateRange, etc.) across nested submodules; needs explicit named re-exports across ~30 symbols. Tracked.`
- This means TYPE errors at the consumer boundary are invisible. Drizzle drift, schema renames, and stale references will not surface during build of the importing package (api-gateway). The previous `@ts-nocheck` comment has been there long enough that the original "tracked" reference no longer points anywhere actionable.
- **Fix:** Convert the 11 `export *` calls to explicit named re-exports. Estimated time: 1 hour to enumerate, then test.

### B2. Mass `@ts-nocheck` across domain-services — **HIGH**

Sixteen files in `services/domain-services/src/` carry `// @ts-nocheck`:

```
src/index.ts                      barrel collisions
src/tenant/tenant-service.ts      domain-models drift
src/scheduling/scheduling-service.ts   "
src/scheduling/types.ts                "
src/scheduling/memory-repositories.ts  "
src/property/index.ts                  "
src/marketplace/postgres-marketplace-repository.ts  drizzle pgEnum narrowing
src/cases/postgres-case-repository.ts  pg row callbacks + PaginationParams drift
src/lease/index.ts                "
src/compliance/gdpr-service.ts    TenantId brand vs raw string
src/iot/iot-service.ts            drizzle pgEnum narrowing
src/documents/document-service.ts StorageProvider interface missing download()
src/maintenance/index.ts          domain-models drift
src/approvals/approval-repository.memory.ts  PaginationParams drift
src/approvals/approval-service.ts PaginatedResult<T> data vs rows rename
src/migration/postgres-migration-repository.ts  drizzle pgEnum narrowing
src/invoice/index.ts              domain-models drift
src/customer/index.ts             Customer has no metadata field
```

Each one represents a **production-blind region of code**. Tenant scoping, error shape, repository signature drift — none of it is type-checked. The root causes are three:

1. `domain-models` shipped a breaking change to `WorkOrder` / `Block` / `Money` / `TenantStatus` without updating consumers
2. `drizzle-orm` 0.36 narrowed `pgEnum` to a stricter union type → bare string args are now reject
3. `PaginatedResult<T>` renamed `{ page, pageSize, data }` to `{ limit, offset, rows }`

- **Fix:** Each `@ts-nocheck` should be replaced with the minimum-narrow `@ts-expect-error <reason>` on the specific drift line. That makes the failure mode loud the moment domain-models reverts the breaking change.

### B3. `services/domain-services/src/onboarding/` — orphaned from top barrel — **MEDIUM**

- `services/domain-services/src/index.ts` (97 lines) does NOT re-export `./onboarding/index.js` or `./intelligence/index.js`.
- The api-gateway router (`services/api-gateway/src/routes/onboarding.ts:35`) gets at it via the SUBPATH `@bossnyumba/domain-services/onboarding`, which works because the package.json's `./*` wildcard export resolves to `./dist/onboarding/index.js`.
- BUT if anyone tries to import `OnboardingService` from `@bossnyumba/domain-services` flat (which is how every other 24 modules in the barrel are imported), they get `undefined`. **Discoverability mismatch.**
- **Fix:** Add `export * as Onboarding from './onboarding/index.js';` (namespace, since the barrel comment confesses symbol collisions). Same for intelligence.

### B4. `services/domain-services/src/invoice/index.ts:1` — relies on domain-models drift (the `@ts-nocheck` mask) — **HIGH** (already covered by A4–A10 fix)

When the namespace mismatch is fixed at the source, this `@ts-nocheck` becomes unnecessary AND any further drift becomes visible.

### B5. Logger-style logging — **MEDIUM**

- `services/domain-services/src/common/events.ts:255,280` — `console.error('Event handler error for ${eventType}:', message)`. Should be `logger.error({ eventType, msg: message }, '...')`.
- `services/domain-services/src/intelligence/intelligence-history-worker.ts:126`, `services/domain-services/src/waitlist/waitlist-vacancy-handler.ts:189`, `services/domain-services/src/compliance/gdpr-service.ts:315`, `services/domain-services/src/vendor-api/orchestration.ts:446`, `services/domain-services/src/inspections/far/far-scheduler.ts:94`, `services/domain-services/src/negotiation/negotiation-service.ts:581` — all `console.error` with bare interpolation. No traceId. No tenantId. Unstructured.
- `services/domain-services/src/cases/sla-worker.ts:88,123,151,155` — uses `this.logger.*` correctly (this is the right pattern).
- **Fix:** Replace `console.*` with the injected logger port (every domain service already accepts a `logger?` option — this is uniform-fix territory).

### B6. Side-effect repository pattern is uniformly clean — **PASS**

- All `findById` / `findMany` / `findByCustomer` signatures across 27 services carry `tenantId: TenantId` as a required argument. No N+1 — the queries that need joins pull `.leftJoin()` once and aggregate.
- All raw-SQL in domain-services is via `sql\`...\`` template literals (drizzle's parameterized SQL). Zero string-concat SQL. Tested via `grep -rn "execute(\`\|execute('"` returning only `sql\`...\`` template-literal usage at three locations in `property-grading/live-metrics-source.ts`.

### B7. `services/domain-services/src/feature-flags/feature-flags-service.ts:331` — eslint-disable comment without justification — **LOW**

Cosmetic; tracked.

---

## SECTION C — Cross-cutting concerns

### C1. **CRITICAL** — `/api/v1/health/deep` admin gate is trivially spoofable

- **File:** `services/api-gateway/src/index.ts:512-572`
- **Class:** authn bypass / info disclosure
- **Severity:** CRITICAL
- **Diagnosis:**
  - The deep-health handler is created with:
    ```ts
    requireAdmin: (req) => {
      const roleHeader = req.header('x-user-role');
      if (roleHeader === 'TENANT_ADMIN' || roleHeader === 'PLATFORM_ADMIN') return true;
      return process.env.NODE_ENV !== 'production';
    }
    ```
    Any unauthenticated request that sends `X-User-Role: TENANT_ADMIN` passes. There is no JWT verification, no signature check, no session check — just a string comparison against a trivially-attacker-controlled header.
  - Additionally, the route is registered on the Express `app` (line 574) BEFORE the `api = new Hono()` block that owns the auth middleware (line 578+). So `ensureTenantIsolation` and `authMiddleware` never touch it.
  - **AND** in any environment where `NODE_ENV !== 'production'` (which includes most CI E2E envs + every staging/preview env that forgot to set `NODE_ENV=production`), the handler is wide open without even the spoofable header.
- **How it bites:** Returns to anonymous attackers: Postgres version + Redis status + which AI providers (Anthropic / OpenAI / ElevenLabs / GePG) are configured — the latter five lines telling an attacker exactly which OPEX-bearing dependencies are reachable from this gateway. Combined with the version field that exposes `APP_VERSION` (and the boot logger leaks `GIT_SHA` to Sentry breadcrumbs from line 1189), an attacker can fingerprint the exact build and CVE-target known vulnerabilities.
- **Fix:** Replace `requireAdmin` with a JWT-verifying middleware that calls `authMiddleware` and reads `req.auth.role`. Remove the `NODE_ENV !== 'production'` open-door fallback.

### C2. **CRITICAL** — Raw SQL string-concat in `orchestrator-bindings.ts:287-292`

- **File:** `services/api-gateway/src/composition/orchestrator-bindings.ts:287-292`
- **Class:** SQL-injection (mitigated but defensive-coding violation)
- **Severity:** CRITICAL (vulnerability class — actual exploitability low due to escape logic)
- **Diagnosis:**
  - `createDrizzleToolDenylistPort` interpolates `deps.tenantId` and `toolName` into a SQL string with a manual `.replace(/'/g, "''")` escape. This works for ASCII but it is the only escape, and it's the kind of code that's one refactor away from injecting via:
    - Unicode escape variants (`'`)
    - Backslash + quote combinations on databases that interpret backslash-escapes
    - Multi-byte UTF-8 sequences where the encoding can fool the escape
  - The comment says "Raw SQL to avoid the missing Drizzle schema for tool_call_denylist" — but the file already imports `drizzle-orm` and could use `sql\`tenant_id = ${deps.tenantId}\`` (parameterized).
- **How it bites:** If an attacker controls `toolName` via the tool-registry (e.g. by crafting a `platform.<crafted>` HQ tool spec), they can inject arbitrary WHERE-clause content.
- **Fix:** Replace with parameterized `sql\`...\``:
  ```ts
  import { sql } from 'drizzle-orm';
  const result = await deps.db.execute(sql`
    SELECT tenant_id, tool_name, expires_at
      FROM tool_call_denylist
      WHERE tenant_id = ${deps.tenantId}
        AND tool_name = ${toolName}
      LIMIT 1
  `);
  ```

### C3. **CRITICAL** — `LEDGER_SEAL_HMAC_KEY` falls back to ephemeral random in dev — but the dev-prod branch is not enforced

- **File:** `services/api-gateway/src/composition/orchestrator-bindings.ts:632-646`
- **Class:** crypto-degraded-silently-in-prod
- **Severity:** CRITICAL
- **Diagnosis:**
  - `resolveLedgerSealHmacKey` checks `raw.length >= 16` — if unset or too short it returns `dev-fallback-${randomUUID()}` and only logs a `WARN`.
  - There is NO `NODE_ENV === 'production' → throw` branch like the JWT secret has (`config/jwt.ts:21`).
  - An ops mistake (e.g. deleting `LEDGER_SEAL_HMAC_KEY` from secrets manager) will cause the sovereign-action-ledger seal hashes to silently use a per-boot ephemeral key. Every restart breaks the chain of custody. **The ledger's "tamper-evident chain" guarantees collapse to a per-boot guarantee, undetectable by the verifier cron because the seals chain WITHIN a boot.**
- **Fix:**
  ```ts
  if (!raw || raw.length < 16) {
    if (env.NODE_ENV === 'production') {
      throw new Error('LEDGER_SEAL_HMAC_KEY must be set in production (32+ chars)');
    }
    logger?.warn?.(/* dev fallback */);
    return `dev-fallback-${randomUUID()}`;
  }
  ```

### C4. **HIGH** — Module-system parity matrix has 5 traps

**Packages declaring `"type": "module"`:** agent-platform, ai-copilot, aop-compiler, api-sdk, authz-policy, autonomy-governance, central-intelligence, compliance-plugins, config, connectors, database, forecasting-engine, forecasting, graph-privacy, graph-sync, lpms-connector, market-intelligence, marketing-brain, mcp-server, spotlight (20)

**Packages WITHOUT `"type"` (CJS default):** api-client, browser-perception, chat-ui, design-system, **domain-models**, enterprise-hardening, genui, observability, realtime-rooms (9)

**Services declaring `"type": "module"`:** mcp-server-firs, mcp-server-opay, mcp-server-nin, mcp-server-nggis, identity, domain-services, document-intelligence, webhooks, notifications, mcp-server-process-intel, reports (11)

**Services WITHOUT (CJS):** payments, consolidation-worker, **api-gateway**, payments-ledger (4)

**Services' tsup format:**
- mcp-server-firs / opay / nin / nggis / process-intel → ESM ✓ matches type:module
- **api-gateway → CJS** ✗ does not match its CJS package.json (which is consistent with itself, BUT inconsistent with the ESM packages it consumes — this is cascade-3)
- domain-services → CJS ✗ **does not match its `"type": "module"` package.json** — emits CJS into a folder that node will treat as ESM via the parent declaration

**Trap #1:** `services/domain-services/package.json` declares `"type": "module"` but `services/domain-services/tsup.config.ts` outputs `format: ['cjs']`. tsup emits `.js` files; node sees the parent `type: module` declaration; node tries to load the `.js` as ESM and fails at the first `require(...)`. Today this works ONLY because api-gateway is CJS and `require()`s the CJS .js output directly without going through node's ESM loader.

**Trap #2:** `packages/domain-models/package.json` has no `"type"` field (defaults to CJS) but the `exports.import` field points to `.mjs` files. tsup is configured to produce dual CJS+ESM. Consumer ai-copilot (`type:module`) resolves via `exports.import` → `.mjs`. Consumer api-gateway (CJS) resolves via `exports.require` → `.js`. This works today but is fragile to any tsup config change.

**Trap #3:** `packages/observability` is CJS but its source uses ESM-only syntax in some files (top-level `await`, no `module.exports` declarations). Tsup transpiles but the published declarations file does not declare ESM exports cleanly.

**Trap #4:** Re-exports from CJS packages into ESM consumers go through esbuild's CJS-named-import-detection heuristic. For domain-models in particular, esbuild can't see the named exports because the CJS output uses `Object.defineProperty(exports, '__esModule', { value: true })` + `exports.createInvoice = ...` pattern, which sometimes fools the heuristic. **This is the actual reason A4–A10 fail under bundling — even after the namespace mismatch is fixed.** The real fix is to flip domain-models to `"type": "module"` and emit pure ESM.

**Trap #5:** `services/api-gateway/src/index.ts:366` uses `require('ioredis')` inside an IIFE. This works because api-gateway is CJS. The moment cascade-3 fixes flip api-gateway to ESM, that `require` call must become `await import('ioredis')`.

- **Fix:** A migration ticket should flip in this order: (1) domain-models to `type: module` + emit pure ESM, (2) api-gateway to `type: module` + tsup format `esm` + replace `require('ioredis')` with `await import()` at line 366, (3) verify each `@bossnyumba/*` package's exports map declares both `import` and `require` keys with correct file extensions.

### C5. **HIGH** — Zero OTel instrumentation in domain-services

- **Files:** `services/domain-services/src/**`
- **Diagnosis:** `grep -r "trace.getTracer\|@opentelemetry/api"` in `services/domain-services/src/` returns ZERO matches. Every business-logic call (createInvoice, transitionLease, dispatchWorkOrder, generateReport, etc.) emits no span.
- **How it bites:** Latency / error traces for the bulk of business logic are invisible. The OTel auto-instrumentations on pg and express capture only the SQL query and the HTTP request — not the structured business operation. Investigating a slow payment flow means manually correlating Postgres slow-query logs with HTTP traces.
- **Fix:** Inject a tracer through the same DI port the logger uses. Wrap each service method body with `tracer.startActiveSpan('bossnyumba.${module}.${method}', span => { ... })`.

### C6. **HIGH** — OTel bootstrap is only in api-gateway

- `grep -rln "@opentelemetry/sdk-node"` returns ONLY `services/api-gateway/src/observability/otel-bootstrap.ts`.
- Services that boot independently (payments, payments-ledger, consolidation-worker, identity, document-intelligence, notifications, reports) do NOT call `NodeSDK.start()`. They emit zero spans even with the auto-instrumentations available. Cross-service correlation is broken.
- **Fix:** Extract `otel-bootstrap.ts` into `@bossnyumba/observability` and wire it into each service's `index.ts` boot path.

### C7. **HIGH** — `services/payments-ledger/src/server.ts:353-364` `/health` leaks provider config flags

```ts
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'payments-ledger',
    timestamp: new Date().toISOString(),
    providers: { stripe: !!stripeProvider, mpesa: !!mpesaProvider }
  });
});
```
- **Diagnosis:** Unauthenticated. Returns which payment providers are configured. Combined with C1 in the api-gateway, an attacker can enumerate exactly which payment-rail integrations are live. **Class:** info disclosure on unauthenticated endpoint.
- **Fix:** Remove the `providers` field. Health endpoints should be a single boolean status check.

### C8. **HIGH** — `services/api-gateway/src/index.ts:415` `/health` leaks `APP_VERSION`

- Returns `version: process.env.APP_VERSION ?? 'dev'` in the payload.
- Class: info disclosure (CWE-200). Allows fingerprinting the exact deployment for CVE targeting.
- **Fix:** Drop `version` from the public `/health` payload (move it to the admin-gated `/api/v1/health/deep`).

### C9. **MEDIUM** — `services/api-gateway/src/index.ts:425` returns the `deep` upstream stub in `/health` payload

The string `'see GET /api/v1/health/deep for upstream cascade'` advertises the deep-health endpoint to anonymous attackers. Combined with C1 this signposts the attack surface.

- **Fix:** Drop the `upstreams` field entirely from the public `/health` payload.

### C10. **MEDIUM** — `validate-env.ts` does not assert `LEDGER_SEAL_HMAC_KEY`

- `services/api-gateway/src/config/validate-env.ts:39-213` lists every "expected" env var but `LEDGER_SEAL_HMAC_KEY` (C3 above) is not in the schema. The boot path will not flag it as missing in production.
- **Fix:** Add to `OptionalSchema` with a production-required flag.

### C11. **MEDIUM** — `process.env.NODE_ENV === 'production'` checks scattered across 14 files

- Each `NODE_ENV === 'production'` is a manual policy decision that can be missed or misordered. Concentrating them in a single `isProd()` utility (or in the validate-env return) closes the gap.

### C12. **MEDIUM** — `services/api-gateway/src/composition/service-registry.ts:1424-1429` falls back from `AGENT_CERT_SIGNING_SECRET` to `JWT_SECRET`

- If `AGENT_CERT_SIGNING_SECRET` is unset, the agent-certification system signs certificates with the JWT secret. Same key for two purposes violates the "key reuse" hygiene rule.
- **Fix:** In production, fail-closed if `AGENT_CERT_SIGNING_SECRET` is unset.

### C13. **MEDIUM** — `services/api-gateway/src/index.ts:1189` `release: process.env.GIT_SHA`

- Sentry's `release` is set from `GIT_SHA`. If breadcrumbs include outbound HTTP request logs (the default Sentry HTTP integration captures these), the GIT_SHA may leak through the breadcrumb chain. Verify the Sentry config strips outbound URLs.

### C14. **MEDIUM** — `services/domain-services/src/documents/renderers/nano-banana-imagery-renderer.ts:77` reads `NANO_BANANA_API_KEY` at constructor time, not at call time

- If the renderer is constructed in test mode (no key) and then the env var becomes available, the constructed instance keeps the stale value. Tests that mutate env via `vi.stubEnv` will silently see the wrong key.
- **Fix:** Read on every call OR validate at constructor and throw if missing.

### C15. **LOW** — `services/api-gateway/src/composition/db-client.ts:37` no validation of `DATABASE_URL`

- `validate-env.ts:24-30` validates `DATABASE_URL` at the boot path but `db-client.ts:37` then re-reads `process.env.DATABASE_URL` independently. If both paths drift, the latter wins. Use the validated env from `validate-env`'s return value.

### C16. **LOW** — `services/api-gateway/src/index.ts:280` `process.exit(1)` after env validation failure

- Express keeps file handles open after `process.exit`. Use `process.exit(1)` only AFTER `await app.close()` or use `setTimeout(() => process.exit(1), 0)`. Currently this is fine because validation fails BEFORE Express binds; just noting for future-proofing.

### C17. **LOW** — `services/api-gateway/src/middleware/rate-limit.middleware.ts:11` in-memory store is per-process

- The dev fallback is unsharded across replicas. Production has Redis; preview/staging deployments without REDIS_URL silently use in-memory. A noisy neighbor on one replica still escapes the limit on another replica.
- Acceptable risk for dev; just document in the route comment.

### C18. **LOW** — `apps/customer-app/.env.example:11-12` `NEXT_PUBLIC_SUPPORT_PHONE` and `NEXT_PUBLIC_SUPPORT_WHATSAPP`

- These are intentional public values, not secrets. Acceptable but worth a comment in `.env.example` so engineers understand `NEXT_PUBLIC_*` semantics.

---

## SECTION D — Notes for the future

1. **The `@ts-nocheck` cohort is the single biggest hidden-bug surface in domain-services.** Every type drift since the WorkOrder/Money/TenantStatus refactor in domain-models is invisible. A separate ticket to convert each `@ts-nocheck` into a narrow `@ts-expect-error <reason>` (or to fix the underlying drift) would expose dozens of latent bugs.
2. **The "tracked" comments throughout `@ts-nocheck` are stale.** None of them have an issue number. Recommendation: introduce a `// TODO(ISSUE-NNN):` discipline for tracked items, fail CI on `tracked` without an issue ref.
3. **The deep-health probe has an underspecified contract.** It rolls up "degraded" as 200 (line 144 `case 'degraded': return 200`). Operators may not see degraded states as alerts if their dashboards only watch for non-200. Tracked by the production-readiness-gaps.md audit but worth re-flagging.

