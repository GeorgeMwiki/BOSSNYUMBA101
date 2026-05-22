# BossNyumba Codemaps — Index

**Last Updated:** 2026-05-22
**Wave:** Wave 28+ (wave-4 perf indexes + real provider adapters + memory layer + UI-1..5 + P-6..10)

This directory contains module-level architectural maps for the BossNyumba
multi-tenant property-management SaaS. Each codemap is a one-page reference
describing the public surface, internal structure, dependencies, and common
workflows of one package or app.

## How to read these maps

Each codemap follows the same shape:

1. Purpose (1-2 sentences) + tier scope
2. Entry points (public exports + key paths)
3. Internal structure (subdirs / key files)
4. Dependencies (upstream + downstream)
5. Common workflows (file:line pointers)
6. Anti-patterns to avoid
7. Related codemaps

Codemaps are written from source. When source moves, update the codemap.

## Codemaps

### Cognitive core (the Brain)

| Codemap | Module | Purpose |
|---------|--------|---------|
| [central-intelligence.md](./central-intelligence.md) | `packages/central-intelligence/` | 12-agent embodied-agent kernel — sensors, persona, policy gate, theory-of-mind, debate, LATS, four-eye |
| [ai-copilot.md](./ai-copilot.md) | `packages/ai-copilot/` | Personas, prompts, knowledge, security, copilot workflows (triage, churn, occupancy, communications) |
| [observability.md](./observability.md) | `packages/observability/` + `evals/` | OTel + audit + online-judge + decision-trace + red-team corpora |

### Platform spine

| Codemap | Module | Purpose |
|---------|--------|---------|
| [api-gateway.md](./api-gateway.md) | `services/api-gateway/` | Hono BFF + composition root — auth, routing, aggregation, brain wiring |
| [database.md](./database.md) | `packages/database/` | Drizzle schemas, 183 migrations, RLS, pgvector, multi-tenancy GUC |
| [payments-ledger.md](./payments-ledger.md) | `services/payments-ledger/` | Drizzle double-entry ledger, Stripe + M-Pesa providers, statements, disbursements |
| [agent-platform.md](./agent-platform.md) | `packages/agent-platform/` | Agent auth, idempotency, webhooks, A2A error codes |

### User surface (UI-1..5)

| Codemap | Module | Purpose |
|---------|--------|---------|
| [dynamic-sections.md](./dynamic-sections.md) | `packages/dynamic-sections/` | Adaptive layout engine (UI-1) — sections rearrange by brain signal + viewport |
| [chat-ui.md](./chat-ui.md) | `packages/chat-ui/` | ProactiveHint (UI-2), MasteryGate (UI-3), LearnedShortcutsPanel (UI-5), blackboard, dopamine, voice |

### Apps

| Codemap | Module | Purpose |
|---------|--------|---------|
| [customer-app.md](./customer-app.md) | `apps/customer-app/` | Next.js tenant + how-it-works portal (port 3002) |
| [estate-manager-app.md](./estate-manager-app.md) | `apps/estate-manager-app/` | Next.js estate-manager workspace (port 3003) |
| [owner-portal.md](./owner-portal.md) | `apps/owner-portal/` | Vite owner SPA (port 3001) — 80+ pages |

## Reading order for new engineers

1. [`Docs/MEMORY.md`](../MEMORY.md) — long-lived assistant context
2. [`Docs/ARCHITECTURE.md`](../ARCHITECTURE.md) — synthesis
3. [`Docs/MODULAR_MONOLITH.md`](../MODULAR_MONOLITH.md) — package boundaries
4. [api-gateway.md](./api-gateway.md) — request lifecycle + composition root
5. [database.md](./database.md) — RLS, GUC, migration discipline
6. [central-intelligence.md](./central-intelligence.md) — kernel pipeline (14 steps)
7. [payments-ledger.md](./payments-ledger.md) — money path (CRITICAL)
8. Remaining codemaps as feature work demands

## Related documents

- [`Docs/ARCHITECTURE.md`](../ARCHITECTURE.md)
- [`Docs/MODULAR_MONOLITH.md`](../MODULAR_MONOLITH.md)
- [`Docs/DATA_FLOWS.md`](../DATA_FLOWS.md)
- [`Docs/SECURITY.md`](../SECURITY.md)
- [`CHANGELOG.md`](../../CHANGELOG.md)
- [`Docs/MEMORY.md`](../MEMORY.md) — session-load file for LLM assistants
