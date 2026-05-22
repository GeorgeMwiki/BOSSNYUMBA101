# BossNyumba Memory — Long-Lived Assistant Context

**Last Updated:** 2026-05-22 (post Wave 28+ wave-4 — providers, perf
indexes, owner backend, a11y, memory layer, UI-1..5, P-6..10)

This file holds long-lived context that any LLM-based assistant
(Claude Code, Cursor, IDE extensions) should load on every fresh
session. Keep entries to one line under ~200 chars where possible.
Move detail into topic files referenced from here.

## Project identity

- **BossNyumba** = this repo. AI-native multi-tenant property-
  management SaaS for East Africa.
- **PROJECT_BOUNDARY.md** is canonical: never reference Pongezi or
  any other project in code, docs, or config.
- Tanzania-first defaults (TZS), pan-African ambitions (KES, UGX,
  ZAR also supported). Never hard-code jurisdiction / currency /
  locale in business logic — users choose their display currency,
  resolved via `user → tenant → platform-default` chain.

## Current wave state — Wave 28+

Production hardening + AI brain power-up. The brain (central-
intelligence + ai-copilot) is wired through api-gateway composition.
Wave-4 within Wave 28 closed real provider adapters, perf indexes,
owner backend skeletons, a11y, and security follow-ups (see
[`CHANGELOG.md`](../CHANGELOG.md)).

### Recent CL pointers

- **Memory layer (CL-9)** — Drizzle schemas + MMR rerank + drift
  detection. Migration `packages/database/src/migrations/0181_memory_layer.sql`.
- **BFF aggregation (CL-4)** — 7 routers rewritten under
  `services/api-gateway/src/routes/bff/`.
- **Perf indexes (CL-5)** — `0179_missing_tenant_indexes.sql`,
  `0180_perf_indexes.sql`.
- **UI-1..5** — adaptive layout (`packages/dynamic-sections/`),
  ProactiveHint + MasteryGate + LearnedShortcutsPanel
  (`packages/chat-ui/src/components/`), `user_action_tracker` table
  (`0183_user_action_tracker.sql`), `section_layouts` table
  (`0182_section_layouts.sql`).
- **P-6..10 brain power** — Tree-of-Thoughts planner, smart memory
  retrieval, Haiku-first cascade, eval-on-traffic + adversarial
  corpus, multi-agent debate-default at stakes≥high (all under
  `packages/central-intelligence/src/kernel/`).
- **Money path (CL-BUGS)** — 5 CRITICAL closed in payments-ledger.
- **Piece H — Reports + Decks + Socratic tutor** —
  `packages/report-engine/` (PDF/DOCX/PPTX, 7 built-in templates),
  `packages/presentation-engine/` (5 built-in themes, Piece-G
  artifact-compatible), `packages/tutoring-skill-pack/`
  (data-grounded Socratic tutor, 10 built-in concepts). Migrations
  `0208_report_templates.sql`, `0209_presentation_themes.sql`,
  `0210_tutoring_skill_pack.sql`. All three tables: tenant_id NULL
  = platform built-in (SELECT escape via NULL); writes are
  tenant-scoped via RLS.

## Hard invariants (NEVER violate)

- **Money path goes through `LedgerService.post()`** — direct ledger
  writes break the immutable double-entry invariant.
- **RLS is FORCE-enabled on every tenant-scoped table** — `app.current_
  tenant_id` GUC bound by `services/api-gateway/src/middleware/`.
  Never disable RLS, never double-filter from app code.
- **Supabase JWT is canonical auth** — no Clerk imports anywhere.
- **HIGH-risk policy prefixes** (sovereign / kill_switch / four_eye
  / policy_rollout) must hit literal policy rules; no reason-resolver
  generalisation.
- **Kill-switch fail-closed** — never catch + ignore its errors.
- **Webhook delivery is at-least-once** — consumers MUST be
  idempotent (use `Idempotency-Key`).
- **AI audit chain is hash-chained, append-only** — no mutation.
- **Predictions APPEND to rule-based decisions** — never replace.
- **Migrations are immutable** — never edit a shipped numbered file.
- **OTel bootstrap runs first** in `services/api-gateway/src/index.ts`
  before any module emits spans.
- **Multi-currency**: every money render uses
  `formatCurrency(amount, currencyCode)`; never hard-code KES / TZS.
- **Memory recall is tier-scoped at fetch time**. Sovereign /
  litfin-admin equivalents see aggregated, PII-stripped branches.

## Top-level pointers

- API gateway entry: `services/api-gateway/src/index.ts`
- Composition root (the only port↔adapter seam):
  `services/api-gateway/src/composition/`
- Brain kernel: `packages/central-intelligence/src/kernel/kernel.ts`
- Money: `services/payments-ledger/src/services/ledger.service.ts`
- Database client: `packages/database/src/client.ts`
- Migrations: `packages/database/src/migrations/0001..0183_*.sql`
- Audit + OTel: `packages/observability/src/`
- Adaptive layout: `packages/dynamic-sections/src/registry/`
- Brain-aware UI primitives: `packages/chat-ui/src/components/`
- Per-tenant rate limit: Redis-backed (Wave 1)
- Postgres HA + Redis Sentinel: configs under `infrastructure/` +
  `docker-compose.ha.yml`

## Anti-patterns observed (do not reintroduce)

- `console.log` in services — Pino logger only.
- Reflective CORS — origin allowlist only.
- Raw HTML interpolation — DOMPurify wraps required.
- Reading `process.env` outside bootstrap.
- Bypassing api-gateway with direct Supabase queries from clients.
- Importing one Hono route handler from another — compose via
  service-registry instead.
- Disabling RLS for performance — fix the index instead.
- Hard-coded `KES` / `TZS` in app code.
- Editing a shipped migration file.

## Conventions

- Conventional commits: `feat: / fix: / refactor: / chore: / docs:`.
- 80%+ test coverage required; TDD encouraged (write tests first).
- File size <800 lines, function <50 lines, no nesting >4 levels.
- Immutability (no mutation of inputs); zod for runtime validation.
- next-intl v4 for i18n; nodemailer v8 for email.
- Drizzle ORM only (Prisma fully removed from payments-ledger in
  Wave 2 L).
- New routes: `*.hono.ts` convention; older `*.router.ts` deprecated.

## Reading order for new sessions

1. This file (MEMORY.md).
2. `CLAUDE.md` (root) — routing table.
3. `Docs/CODEMAPS/INDEX.md` — module-level maps.
4. `Docs/ARCHITECTURE.md` for synthesis, `Docs/MODULAR_MONOLITH.md`
   for boundaries.
5. `CHANGELOG.md` for the most recent wave detail.

## Related documents

- [`Docs/CODEMAPS/INDEX.md`](./CODEMAPS/INDEX.md)
- [`Docs/ARCHITECTURE.md`](./ARCHITECTURE.md)
- [`Docs/MODULAR_MONOLITH.md`](./MODULAR_MONOLITH.md)
- [`Docs/SECURITY.md`](./SECURITY.md)
- [`Docs/DATA_FLOWS.md`](./DATA_FLOWS.md)
- [`CHANGELOG.md`](../CHANGELOG.md)
- [`PROJECT_BOUNDARY.md`](../PROJECT_BOUNDARY.md)
