# Pre-existing Failures Triage Manifest

**Branch**: `claude/fix-all-pre-existing-failures` (from `911a8a90`)
**Triaged**: 2026-05-19
**Scope**: typecheck + test + build across whole monorepo (50 packages/apps/services)

## Top-line summary

| Stream | Result | Notes |
|---|---|---|
| `pnpm -r typecheck` | 10 fails, 40 passes | **197 errors, ALL TS2307 "Cannot find module"** |
| `pnpm -r test` | (in progress at time of triage) | log captured to `.audit/pre-existing-tests.log` |
| `pnpm -r build` | (deferred until after fix lands) | will rerun after fix |

## Failure buckets

### Bucket A — Missing-module errors (workspace barrel-export gap) — **197/197 errors**

**Root cause (single)**: workspace packages declare `"main": "./dist/index.js"` + `"types": "./dist/index.d.ts"` in their `package.json` `exports`, but **the `dist/` folders do not exist** in the worktree. Running `pnpm install` only triggers `prepare` hooks for two packages (`packages/genui`, `services/payments-ledger`). All other consumers fail typecheck because the `@bossnyumba/*` packages haven't been built.

**Verified empty dist dirs**:
- `packages/design-system/dist/` — does not exist (118 import errors)
- `packages/central-intelligence/dist/` — does not exist (18 import errors)
- `packages/forecasting/dist/` — does not exist (13 import errors)
- `packages/observability/dist/` — does not exist (7 import errors)
- `services/domain-services/dist/` — does not exist (15 subpath errors)
- `packages/mcp-server/dist/`, `packages/realtime-rooms/dist/`, etc.

**Missing module breakdown** (count = import sites):

| Module | Count | Status |
|---|---|---|
| `@bossnyumba/design-system` | 118 | needs `pnpm -F @bossnyumba/design-system build` |
| `@bossnyumba/central-intelligence` | 18 | needs `pnpm -F @bossnyumba/central-intelligence build` |
| `@bossnyumba/forecasting` | 13 | needs `pnpm -F @bossnyumba/forecasting build` |
| `@bossnyumba/observability` | 7 | needs `pnpm -F @bossnyumba/observability build` |
| `@bossnyumba/mcp-server` | 5 | needs `pnpm -F @bossnyumba/mcp-server build` |
| `@bossnyumba/realtime-rooms` | 4 | needs `pnpm -F @bossnyumba/realtime-rooms build` |
| `@bossnyumba/domain-services/*` (15 subpaths) | 17 | needs `pnpm -F @bossnyumba/domain-services build` |
| `@bossnyumba/lpms-connector`, `graph-sync`, `graph-privacy`, `enterprise-hardening`, `connectors`, `browser-perception`, `agent-platform` | 7 | each needs `build` |
| `../../../packages/central-intelligence/dist/...` direct path | 1 | resolves once central-intelligence is built |

### Bucket B — Type errors from version drift — **0 errors**

None detected. No drizzle pgEnum, Hono v4 narrowing, PaginationParams rename, or other version-drift errors found in current snapshot.

### Bucket C — Test-runner config drift

Per-package vitest 4.1.6 alignment looks consistent; tests are running across the monorepo without immediate config aborts. Will assess fully after tests log lands.

### Bucket D — Build config drift

Will assess after Bucket A fix lands and we rerun `pnpm -r build`.

### Bucket E — Real broken code — **0 errors**

No logic/syntax errors detected in typecheck pass once `node_modules` resolution is excluded.

## Failures by package

| Package | Errors | Severity | Bucket | Est. fix |
|---|---|---|---|---|
| `apps/owner-portal` | 63 | HIGH | A | 0 min (downstream of build) |
| `services/api-gateway` | 57 | HIGH | A | 0 min (downstream of build) |
| `apps/estate-manager-app` | 47 | HIGH | A | 0 min (downstream of build) |
| `apps/customer-app` | 13 | MEDIUM | A | 0 min (downstream of build) |
| `apps/marketing` | 5 | MEDIUM | A | 0 min (downstream of build) |
| `apps/admin-platform-portal` | 5 | MEDIUM | A | 0 min (downstream of build) |
| `packages/ai-copilot` | 4 | MEDIUM | A | 0 min (downstream of build) |
| `services/document-intelligence` | 1 | LOW | A | 0 min (downstream of build) |
| `services/consolidation-worker` | 1 | LOW | A | 0 min (downstream of build) |
| `packages/agent-platform` | 1 | LOW | A | 0 min (downstream of build) |

## Fix plan

**Priority A — build the dependency packages**:
1. Run `pnpm -r build` topologically (pnpm handles order via `workspace:` deps)
2. Re-run `pnpm -r typecheck` and verify all 197 TS2307 errors are gone
3. Inspect any newly-uncovered errors (build itself might surface tsup/tsc errors)

If `pnpm -r build` itself fails inside a leaf package, that's a separate fix and we document it here.

**Priority B/C/D**: Only re-run after A lands. Likely empty post-fix.

## Out-of-scope deferrals

- Cascade-3 (CJS↔ESM bundle work)
- LITFIN scanners
- New features
- E2E flaky chronic (already shipped on parallel branch)

## Status

| Step | State |
|---|---|
| Triage manifest committed | pending |
| Build dependency packages | pending |
| Verify typecheck clean | pending |
| Run + log tests | pending |
| Run + log builds | pending |
| PR opened | pending |
