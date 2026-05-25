# Domain Services Codemap

**Last Updated:** 2026-05-22
**Module:** `services/domain-services/`
**Public entry:** `services/domain-services/src/index.ts`
**Tier scope:** platform spine (core business logic)

## Purpose

The core business-logic layer for the BossNyumba domain: tenants,
identity, properties, customers, leases, units, work orders,
inspections, cases, approvals, audit, compliance, documents,
feature flags, feedback, gamification. Every operation is
tenant-scoped, audits via the observability layer, and persists
through Drizzle repositories.

## Entry points

- `src/index.ts` — barrel (`// @ts-nocheck` — pending explicit
  named re-exports across ~30 colliding symbols).
- Each subdomain has its own `src/<domain>/index.ts`.
- Standard subdomains: `tenant`, `identity`, `property`, `customer`,
  `lease`, `compliance`, `documents`, `cases`, `inspections`,
  `approvals`, `audit`, `gamification`, `feedback`, `feature-flags`.
- `src/common/` — shared error types, validators, DI tokens.

## Internal structure

- Per-domain folder with `service.ts`, `repository.ts`, `types.ts`.
- `__tests__/` per domain.
- Events emitted via `@bossnyumba/observability` event bus.

## Dependencies

- Upstream: `@bossnyumba/database`, `@bossnyumba/domain-models`,
  `@bossnyumba/observability`, `@bossnyumba/authz-policy`.
- Downstream: api-gateway (routes call services here),
  notifications, reports, payments-ledger.

## Common workflows

- **Create a tenant** →
  `tenantService.create({ name, country, currency })`.
- **Renew a lease** →
  `leaseService.renew({ leaseId, term })` (audited).
- **Approve a case** → `approvalsService.approve({ caseId, approverId })`.
- **Get policy constitution** →
  `tenantService.getPolicyConstitution(tenantId)`.

## Anti-patterns to avoid

- Never bypass the service layer from a route — always go through.
- Never write to DB without setting tenant GUC (`app.tenant_id`).
- Never expose internal repository methods through the barrel.
- Never mix two domains in one transaction without a saga.

## Related codemaps

- [api-gateway.md](./api-gateway.md) — primary consumer
- [database.md](./database.md) — persistence
- [observability.md](./observability.md) — audit emissions
