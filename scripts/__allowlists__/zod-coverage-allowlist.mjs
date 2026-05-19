/**
 * Zod-coverage allow-list.
 *
 * Mutating route handlers (POST/PUT/PATCH/DELETE) that legitimately
 * skip Zod / schema validation. Each entry MUST justify why.
 *
 * Legitimate categories:
 *   1. The handler takes NO body — it's a pure action trigger keyed by
 *      a path param (e.g. POST /things/[id]/lock).
 *   2. The body is passthrough proxied; upstream service validates.
 *   3. Validation is delegated to a service-layer schema (the route
 *      file is a thin orchestrator).
 *
 * TRACKED GAPS: 14 mutating routes flagged by the 2026-05-18 scanner
 * pass. Each TODO entry should be removed when the route adds a Zod
 * schema + .safeParse() guard. This list is the concrete worklist for
 * incremental Zod-coverage remediation.
 *
 * Keys are paths RELATIVE to the repo root.
 */

export const ZOD_ALLOWLIST = new Map([
  // ─── Streaming/SSE proxy passthroughs ──────────────────────────────
  [
    'apps/admin-platform-portal/src/app/api/platform/intelligence/thread/[threadId]/message/route.ts',
    'SSE proxy — body forwarded as-is to gateway; upstream validates.',
  ],

  // ─── TRACKED GAPS: mutating routes without Zod validation ──────────
  [
    'services/api-gateway/src/routes/bff/estate-manager-app.ts',
    'TODO: add Zod schema; tracked gap from universal scanner pass.',
  ],
  [
    'services/api-gateway/src/routes/bff/owner-portal.ts',
    'TODO: add Zod schema; tracked gap from universal scanner pass.',
  ],
  [
    'services/api-gateway/src/routes/dsar.router.ts',
    'TODO: add Zod schema; tracked gap from universal scanner pass.',
  ],
  [
    'services/api-gateway/src/routes/mcp.router.ts',
    'JSON-RPC envelope — validated inside BossnyumbaMcpServer.dispatch; route file is thin proxy.',
  ],
  [
    'services/api-gateway/src/routes/messaging.ts',
    'TODO: add Zod schema; tracked gap from universal scanner pass.',
  ],
  [
    'services/api-gateway/src/routes/risk-reports.router.ts',
    'TODO: add Zod schema; tracked gap from universal scanner pass.',
  ],
  [
    'services/api-gateway/src/routes/scheduling.ts',
    'TODO: add Zod schema; tracked gap from universal scanner pass.',
  ],
  [
    'services/api-gateway/src/routes/tenants.hono.ts',
    'TODO: add Zod schema; tracked gap from universal scanner pass.',
  ],
  [
    'services/api-gateway/src/routes/training.router.ts',
    'TODO: add Zod schema; tracked gap from universal scanner pass.',
  ],
  [
    'services/api-gateway/src/routes/unit-subdivision.router.ts',
    'TODO: add Zod schema; tracked gap from universal scanner pass.',
  ],
  [
    'services/api-gateway/src/routes/users.hono.ts',
    'TODO: add Zod schema; tracked gap from universal scanner pass.',
  ],
  [
    'services/api-gateway/src/routes/webhook-dlq.router.ts',
    'TODO: add Zod schema; tracked gap from universal scanner pass.',
  ],
  [
    'apps/customer-app/src/app/api/brain/turn/route.ts',
    'manual type-narrowing on req.json() with explicit guards; TODO migrate to Zod.',
  ],
  [
    'apps/estate-manager-app/src/app/api/brain/turn/route.ts',
    'manual type-narrowing on req.json() with explicit guards; TODO migrate to Zod.',
  ],
  [
    'apps/admin-platform-portal/src/app/api/platform/login/route.ts',
    'login proxy — credentials forwarded to identity service which validates.',
  ],

  // ─── TRACKED GAPS: surfaced by tightened C6/C7 zod regex (round-3) ───
  // The previous loose pattern matched `JSON.parse(` and `z.infer<>(...)`
  // type helpers, masking these mutating routes. The tightened regex
  // requires `<Schema|Validator|Body>.parse(` or `z.<builder>(...)`. The
  // following entries are tracked-gap remediation candidates; route
  // owners SHOULD migrate to Zod schemas. Out of scope for this fix-wave
  // (route files live in apps/services which FW-B3 does NOT touch).
  [
    'services/api-gateway/src/routes/inngest-webhook.router.ts',
    'tracked-gap: Inngest webhook envelope — body shape enforced by Inngest SDK signature verifier upstream; tightened C6/C7 scanner surfaced this. Migrate to Zod when next-touched.',
  ],
  [
    'services/api-gateway/src/routes/notification-webhooks.router.ts',
    'tracked-gap: notification provider callback envelopes (Twilio/SendGrid) — provider-side HMAC verifier asserts shape before the handler runs. Migrate to per-provider Zod schema when next-touched.',
  ],
  [
    'apps/admin-platform-portal/src/app/api/platform/intelligence/thread/route.ts',
    'tracked-gap: SSE thread-init proxy — body forwarded as-is to gateway intelligence service which validates. Migrate to Zod when next-touched.',
  ],
]);
