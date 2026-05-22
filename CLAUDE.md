# How to navigate this codebase (LLM guide)

**Last Updated:** 2026-05-22
**Audience:** Claude Code, Cursor, and any other LLM-based coding
assistant working in this repo.

This file is the entry point for any LLM acting on this repository.
Read the documents in this order before answering or editing.

## Required reads (in order)

1. [`Docs/MEMORY.md`](./Docs/MEMORY.md) — long-lived invariants,
   wave state, hard rules. Load every session.
2. [`Docs/CODEMAPS/INDEX.md`](./Docs/CODEMAPS/INDEX.md) — module-
   level maps for the spine, brain, apps.
3. [`Docs/ARCHITECTURE.md`](./Docs/ARCHITECTURE.md) — developer-
   facing architecture synthesis.
4. [`Docs/MODULAR_MONOLITH.md`](./Docs/MODULAR_MONOLITH.md) —
   package boundaries and import discipline.
5. [`PROJECT_BOUNDARY.md`](./PROJECT_BOUNDARY.md) — this repo is
   BossNyumba only; do not conflate with any other project.

## Routing table — where things live

| Topic | Codemap | Source |
|-------|---------|--------|
| 12-agent brain kernel (think-pipeline, sensors, debate, LATS) | [`Docs/CODEMAPS/central-intelligence.md`](./Docs/CODEMAPS/central-intelligence.md) | `packages/central-intelligence/` |
| Personas, copilots, predictions, governance, audit-trail | [`Docs/CODEMAPS/ai-copilot.md`](./Docs/CODEMAPS/ai-copilot.md) | `packages/ai-copilot/` |
| Hono BFF, auth, composition root, route handlers | [`Docs/CODEMAPS/api-gateway.md`](./Docs/CODEMAPS/api-gateway.md) | `services/api-gateway/` |
| Drizzle schemas, 183 migrations, RLS, pgvector | [`Docs/CODEMAPS/database.md`](./Docs/CODEMAPS/database.md) | `packages/database/` |
| Double-entry ledger, M-Pesa/Stripe providers, statements | [`Docs/CODEMAPS/payments-ledger.md`](./Docs/CODEMAPS/payments-ledger.md) | `services/payments-ledger/` |
| Agent-to-agent auth, webhooks, idempotency, error codes | [`Docs/CODEMAPS/agent-platform.md`](./Docs/CODEMAPS/agent-platform.md) | `packages/agent-platform/` |
| OTel, audit, Sentry, logging, eval, red-team | [`Docs/CODEMAPS/observability.md`](./Docs/CODEMAPS/observability.md) | `packages/observability/` + `evals/` |
| Adaptive layout engine (UI-1) — sections rearrange themselves | [`Docs/CODEMAPS/dynamic-sections.md`](./Docs/CODEMAPS/dynamic-sections.md) | `packages/dynamic-sections/` |
| ProactiveHint (UI-2), MasteryGate (UI-3), LearnedShortcutsPanel (UI-5) | [`Docs/CODEMAPS/chat-ui.md`](./Docs/CODEMAPS/chat-ui.md) | `packages/chat-ui/` |
| Customer app (Next.js — port 3002, tenant + marketing) | [`Docs/CODEMAPS/customer-app.md`](./Docs/CODEMAPS/customer-app.md) | `apps/customer-app/` |
| Estate-manager app (Next.js — port 3003, org operator) | [`Docs/CODEMAPS/estate-manager-app.md`](./Docs/CODEMAPS/estate-manager-app.md) | `apps/estate-manager-app/` |
| Owner portal (Vite SPA — port 3001, 80+ pages) | [`Docs/CODEMAPS/owner-portal.md`](./Docs/CODEMAPS/owner-portal.md) | `apps/owner-portal/` |

## Hard rules (NEVER violate)

- **Money path goes through `LedgerService.post()`** in
  `services/payments-ledger/`. Direct ledger writes break the
  immutable double-entry invariant.
- **RLS is FORCE-enabled** on every tenant-scoped table. The
  `app.current_tenant_id` GUC is bound by api-gateway middleware.
  Never disable RLS or double-filter from app code.
- **Supabase JWT is canonical auth.** No Clerk imports anywhere.
- **Kill-switch fail-closed.** Never catch + ignore its errors.
- **Webhook delivery is at-least-once.** Consumers MUST be
  idempotent via `Idempotency-Key`.
- **AI audit chain is hash-chained, append-only.** No mutation.
- **Predictions APPEND to rule-based decisions.** Never replace.
- **Migrations are immutable.** Never edit a shipped numbered file —
  append a new one.
- **HIGH-risk policy prefixes** (sovereign / kill_switch / four_eye
  / policy_rollout) must hit literal policy rules; no reason-
  resolver generalisation.
- **OTel bootstrap runs first** in `services/api-gateway/src/index.ts`
  before any module emits spans.
- **Multi-currency.** Every money render uses
  `formatCurrency(amount, currencyCode)`. Never hard-code KES /
  TZS / NGN.
- **No `console.log` in services.** Pino logger only — it handles
  redaction.
- **No reflective CORS.** Origin allowlist only.
- **No raw HTML interpolation.** DOMPurify wraps required.
- **No reading `process.env` outside bootstrap.** Dotenv loads once
  in `services/api-gateway/src/index.ts`.

## When uncertain

- Layout / location → [`Docs/CODEMAPS/INDEX.md`](./Docs/CODEMAPS/INDEX.md)
- Tier behaviour / policy → `packages/central-intelligence/src/kernel/
  policy-gate.ts` and `inviolable.ts`
- Recent changes → [`CHANGELOG.md`](./CHANGELOG.md)
- Known issues → [`Docs/KNOWN_ISSUES.md`](./Docs/KNOWN_ISSUES.md)
- Production readiness → [`Docs/PRODUCTION_READINESS.md`](./Docs/PRODUCTION_READINESS.md)
- Boundary / scope → [`PROJECT_BOUNDARY.md`](./PROJECT_BOUNDARY.md)

## Workflow conventions

- Conventional commits (`feat:`, `fix:`, `refactor:`, `chore:`,
  `docs:`). 1-2 sentence body focuses on the "why".
- TDD encouraged; 80%+ test coverage required.
- File size <800 lines, function <50 lines, nesting ≤4.
- Immutability; zod for runtime validation.
- Drizzle ORM only.
- New routes: `*.hono.ts`; older `*.router.ts` deprecated.
- For full conventions see [`CONTRIBUTING.md`](./CONTRIBUTING.md).
