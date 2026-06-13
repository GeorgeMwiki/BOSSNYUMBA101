/**
 * Rate-limit coverage allow-list.
 *
 * Mutating route files that legitimately skip an in-handler rate limit.
 * Each entry MUST justify why.
 *
 * Legitimate categories:
 *   1. The route is wrapped at the edge by gateway middleware that
 *      applies a default limiter (documented in middleware.ts).
 *   2. The route is for a single internal cron / scheduled job — rate
 *      is bounded by the cron schedule itself, not per-request.
 *   3. Platform-tier SUPER_ADMIN/ADMIN surfaces — low request volume,
 *      privileged operators behind `requireRole`; a per-tenant token
 *      budget adds no protection that the role gate does not.
 *   4. The route DOES rate-limit but via a helper the scanner's regex
 *      cannot see (aliased import / dedicated helper module). The entry
 *      documents the real limiter so the gate is honest, not silenced.
 *
 * NOTE: the 2026-06 `.router.ts` → `.hono.ts` reclaim retired ~76 legacy
 * router files; their stale entries were removed. Files that gained a
 * real limiter during the reclaim (perTenantRateBudget / withSecurityEvents)
 * also dropped off — only entries that are STILL needed remain.
 *
 * Keys are paths RELATIVE to the repo root.
 */

export const RATE_LIMIT_ALLOWLIST = new Map([
  // ─── Next.js app-router surfaces (edge-limited; tracked) ────────────
  ['apps/admin-platform-portal/src/app/api/platform/intelligence/thread/[threadId]/message/route.ts', 'TRACKED GAP — wire perTenantRateBudget or withSecurityEvents; tracked from scanner pass.'],
  ['apps/admin-platform-portal/src/app/api/platform/intelligence/thread/route.ts', 'TRACKED GAP — wire perTenantRateBudget or withSecurityEvents; tracked from scanner pass.'],
  ['apps/admin-platform-portal/src/app/api/platform/login/route.ts', 'TRACKED GAP — wire perTenantRateBudget or withSecurityEvents; tracked from scanner pass.'],
  ['apps/customer-app/src/app/api/brain/turn/route.ts', 'TRACKED GAP — wire perTenantRateBudget or withSecurityEvents; tracked from scanner pass.'],
  ['apps/estate-manager-app/src/app/api/brain/migrate/commit/route.ts', 'TRACKED GAP — wire perTenantRateBudget or withSecurityEvents; tracked from scanner pass.'],
  ['apps/estate-manager-app/src/app/api/brain/migrate/extract/route.ts', 'TRACKED GAP — wire perTenantRateBudget or withSecurityEvents; tracked from scanner pass.'],
  ['apps/estate-manager-app/src/app/api/brain/review/route.ts', 'TRACKED GAP — wire perTenantRateBudget or withSecurityEvents; tracked from scanner pass.'],
  ['apps/estate-manager-app/src/app/api/brain/turn/route.ts', 'TRACKED GAP — wire perTenantRateBudget or withSecurityEvents; tracked from scanner pass.'],

  // ─── api-gateway: tracked gaps awaiting an in-handler limiter ───────
  ['services/api-gateway/src/routes/auth-mfa.ts', 'TRACKED GAP — wire perTenantRateBudget or withSecurityEvents; tracked from scanner pass.'],
  ['services/api-gateway/src/routes/customers.ts', 'TRACKED GAP — wire perTenantRateBudget or withSecurityEvents; tracked from scanner pass.'],
  ['services/api-gateway/src/routes/executive-brief.hono.ts', 'TRACKED GAP — executive-brief mutating endpoints; wire perTenantRateBudget in Wave 11.'],
  ['services/api-gateway/src/routes/modules.hono.ts', 'TRACKED GAP — modules CRUD wire perTenantRateBudget in Wave 11.'],
  ['services/api-gateway/src/routes/proposals.hono.ts', 'TRACKED GAP — proposals submit/update wire perTenantRateBudget in Wave 11.'],

  // ─── api-gateway: helper modules the scanner double-flags ───────────
  ['services/api-gateway/src/routes/ask/ask-rate-limit.ts', 'ask-rate-limit IS the rate-limit helper module (per-tenant tokens for /ask); the audit double-flags the helper itself.'],
  ['services/api-gateway/src/routes/reports/reports-rate-limit.ts', 'reports-rate-limit IS the rate-limit helper module (per-tenant tokens for /reports); the audit double-flags the helper itself.'],

  // ─── api-gateway: platform-tier SUPER_ADMIN/ADMIN surfaces ──────────
  ['services/api-gateway/src/routes/admin/superpowers.hono.ts', 'Platform-tier admin superpowers behind requireRole(SUPER_ADMIN|ADMIN|SUPPORT); privileged low-volume surface, role gate is the bound.'],
  ['services/api-gateway/src/routes/admin-audit.hono.ts', 'SUPER_ADMIN audit-read + emergency-purge behind requireRole; purge also requires a confirmTenantName body match — privileged low-volume surface.'],
  ['services/api-gateway/src/routes/audit-trail.hono.ts', 'Append-only audit-record write behind requireRole(SUPER_ADMIN|ADMIN|TENANT_ADMIN); privileged low-volume surface.'],
  ['services/api-gateway/src/routes/sovereign-ledger.hono.ts', 'Sovereign action-ledger admin surface gated app-wide by requireRole(SUPER_ADMIN|ADMIN); platform-tier only, role gate is the bound.'],
  ['services/api-gateway/src/routes/tenants-admin.hono.ts', 'Tenant-OWNER destructive routes (DELETE /tenants/:id) behind requireRole(SUPER_ADMIN|ADMIN) AND killSwitchGuard; privileged low-volume surface.'],

  // ─── api-gateway: brain-kernel surfaces (per-handler principal auth) ─
  ['services/api-gateway/src/routes/brain-dispatch.hono.ts', 'Brain-kernel dispatch resolves the principal per-request via principalToBrainContexts; @ts-nocheck (hono#3891). Kernel-internal surface — token budget applies upstream at the brain gateway.'],
  ['services/api-gateway/src/routes/brain-teach.hono.ts', 'Brain-kernel teach resolves the principal per-request via principalToBrainContexts; @ts-nocheck (hono#3891). Kernel-internal surface — token budget applies upstream at the brain gateway.'],

  // ─── api-gateway: real limiter the scanner regex misses ─────────────
  ['services/api-gateway/src/routes/missions.hono.ts', 'DOES rate-limit: per-user checkRate() → sharedRateLimiter.check(...) returns 429. The limiter is imported as `rateLimiter as sharedRateLimiter`, so the scanner regex /rateLimiter\\./ cannot see it.'],

  // ─── other services behind api-gateway internal mTLS edge limiter ───
  ['services/document-intelligence/src/routes/documents.routes.ts', 'TRACKED GAP — wire perTenantRateBudget or withSecurityEvents; tracked from scanner pass.'],
  ['services/field-capture-service/src/routes/captures.ts', 'field-capture-service captures POST; service sits behind api-gateway internal mTLS, edge limiter applies.'],
  ['services/outcomes-metering/src/routes/events.ts', 'outcomes-metering events POST; service sits behind api-gateway internal mTLS, edge limiter applies.'],
  ['services/parcel-service/src/routes/geocode.ts', 'parcel-service geocode POST; service sits behind api-gateway internal mTLS, edge limiter applies.'],
  ['services/parcel-service/src/routes/parcels.ts', 'parcel-service parcels CRUD; service sits behind api-gateway internal mTLS, edge limiter applies.'],
  ['services/parcel-service/src/routes/snap.ts', 'parcel-service snap-to-parcel POST; service sits behind api-gateway internal mTLS, edge limiter applies.'],
  ['services/voice-agent/src/routes/call.ts', 'voice-agent call-orchestration POST; service sits behind api-gateway internal mTLS, edge limiter applies.'],
]);
