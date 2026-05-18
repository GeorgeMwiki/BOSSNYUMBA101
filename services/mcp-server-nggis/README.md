# @bossnyumba/mcp-server-nggis

Sandboxed **Model Context Protocol** server for Nigeria's land-registry surface. Fans out to per-state registries behind a single federal-aggregator interface.

## Nigeria — connector status

| Field | Value |
|-------|-------|
| Phase | E.5.4 scaffold (Phase F = real adapter) |
| Federal anchor | NGGIS (National Geospatial Information System) |
| State registries (initial) | LASRRA (Lagos), ABGIS (FCT/Abuja), KADGIS (Kaduna), per-state lands office (fallback) |
| Statute | Land Use Act 1978 + state-specific registration laws |

## Tools

| # | Tool | What it does |
|---|------|--------------|
| 1 | `nggis.verify_title_deed` | Verify a deed number against the relevant state registry (LASRRA / ABGIS / KADGIS / fallback); returns owner + encumbrances |
| 2 | `nggis.search_property` | Free-text search of a state lands registry; returns deed numbers + addresses + status |

## Adapter contract

- `MockNggisAdapter` — deterministic, no IO. Used by tests + composition fallback.
- `NggisFederatedAdapter` — Phase F production adapter (per-state REST clients, dispatched on the 2-letter `stateCode`).

## Setup

```bash
pnpm --filter @bossnyumba/mcp-server-nggis install
pnpm --filter @bossnyumba/mcp-server-nggis typecheck
pnpm --filter @bossnyumba/mcp-server-nggis test
```

## References

- Land Use Act 1978 (Cap. L5 LFN 2004)
- Lagos State Tenancy Law 2011 (rent + tenancy framework, *not* deeds — see Lagos State Property Protection Law 2016 for title-related provisions)
- BOSSNYUMBA jurisdictional rules — `packages/domain-models/src/common/jurisdictional-rules.ts` (entry `NG`)
