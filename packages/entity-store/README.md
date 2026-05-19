# @bossnyumba/entity-store

Universal polymorphic entity store substrate for BOSSNYUMBA — Phase J1.

## Why

BOSSNYUMBA is currently property-management-bound (tables/types named
`property`, `lease`, `maintenance`, ...). The Jarvis-class vision needs a
conversational ERP where an owner-customer or internal-admin talks to the MD
and it auto-creates **any** entity type — employee, lead, deal, vendor,
ticket, KRA filing, campaign, internal-staff — without forms.

This package provides the substrate: a generic store where the MD writes new
entity types at runtime.

## Surface

```ts
import {
  createEntityStoreService,
  InMemoryEntityStoreRepository,
} from '@bossnyumba/entity-store';

const svc = createEntityStoreService({
  repository: new InMemoryEntityStoreRepository(),
});

const employee = await svc.createEntity({
  type: 'employee',
  scope: { ownerType: 'tenant', ownerId: 't_acme' },
  tenantId: 't_acme',
  createdBy: 'u_md',
  source: {
    conversationId: 'conv_123',
    messageId: 'msg_456',
    llmInferredSchemaVersion: 1,
    timestamp: '2026-05-19T10:00:00Z',
  },
  attributes: {
    fullName: 'Jane Mwangi',
    role: 'Property Manager',
    startDate: '2026-06-01',
  },
});

await svc.addAttribute({
  entityId: employee.id,
  key: 'phone',
  value: '+254700000000',
  source: { manual: true, timestamp: new Date().toISOString() },
});
```

## Scope model — internal admin vs owner-customer

Both groups chat with the **same** MD; the store distinguishes:

- `scope_owner_type = 'platform'` — BOSSNYUMBA-as-software-company entities
  (internal-staff, platform leads, platform vendors). Only the internal-admin
  scope can read/write these.
- `scope_owner_type = 'tenant'` — owner-customer portfolio entities (their
  employees, their properties, their leads). Both internal-admin (with
  cross-tenant grant) and the owning tenant can read/write.

Cross-leak is prevented at the service layer (`enforceScope`) AND at the
database layer (RLS policy + `FORCE ROW LEVEL SECURITY` on tenant-scoped
rows). `current_app_tenant_id()` must be set for tenant-scoped access.

## Provenance contract

Every attribute carries a `source` envelope. Allowed origins:

```ts
{
  fileHash?: string;
  conversationId?: string;
  messageId?: string;
  rowIdx?: number;
  llmInferredSchemaVersion?: number;
  manual?: boolean;
  llmResearch?: boolean;
  timestamp: string; // ISO-8601, required
}
```

At least one origin signal must be present (validated at insert time).
`applyProvenance` lets a caller retroactively attach research provenance to
an attribute when the MD ran web research mid-conversation.

## Migrations

- `0167_entity_store_core.sql` — `entities`, `entity_attributes`,
  `entity_types`, `entity_relations` with RLS + `FORCE` on tenant-scoped rows.
- `0168_entity_seed_types.sql` — 14 seeded types: `employee`,
  `customer-owner`, `property`, `lease`, `tenant-person`, `vendor`, `lead`,
  `deal`, `ticket`, `kra-filing`, `campaign`, `process-step`,
  `recommendation`, `internal-staff`.

## Backward-compat

`property`, `lease`, `maintenance_requests` tables stay as-is. The
`entity-views` SQL fragment in migration 0167 installs **read-only views**
(`v_entities_property`, `v_entities_lease`, `v_entities_maintenance`) that
union the legacy tables into the new shape so the MD can query both worlds
through one surface. Writes still go through the legacy repositories until
CL-B3/CL-B4 cuts them over.

## Tests

`pnpm --filter @bossnyumba/entity-store test` — 60+ unit tests cover
creation, attribute versioning, relation queries, scope enforcement,
provenance integrity, and registry validation.
