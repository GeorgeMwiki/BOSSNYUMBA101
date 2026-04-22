# @bossnyumba/domain-models

Shared TypeScript types and Zod schemas for the BossNyumba domain (Property, Unit, Lease, Tenant, Payment, Case, Inspection, etc.). Consumed by services, API client, and frontends so every boundary speaks the same shape.

## Usage

```ts
import { LeaseSchema, type Lease } from '@bossnyumba/domain-models'

const lease: Lease = LeaseSchema.parse(input)
```
