# Architecture Decision Records (ADRs)

> ADRs capture significant architectural decisions, their rationale,
> and consequences. Format: Michael Nygard's lightweight ADR. New
> decisions get a new file; old decisions never get rewritten, only
> superseded.

## Index

| # | Status | Title |
|---|---|---|
| [0001](./0001-pnpm-workspace-monorepo.md) | Accepted | pnpm-workspace monorepo |
| [0002](./0002-drizzle-orm-with-pgvector.md) | Accepted | Drizzle ORM with pgvector |
| [0003](./0003-inngest-and-temporal-coexistence.md) | Accepted | Inngest + Temporal coexistence |
| [0004](./0004-supabase-auth-with-native-postgres.md) | Accepted | Supabase Auth with native Postgres |
| [0005](./0005-otel-observability-baseline.md) | Accepted | OpenTelemetry observability baseline |

## How to add an ADR

1. Copy the most recent ADR as a template.
2. Number sequentially.
3. Status starts as `Proposed`; flip to `Accepted` after review.
4. Keep ≤ 400 words. Link out for detail.
5. If superseding an old ADR, link both ways.
