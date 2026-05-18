# @bossnyumba/mcp-server-nin

Sandboxed **Model Context Protocol** server for Nigerian **NIN** (National Identification Number) biometric KYC. Wraps the **NIMC NIVS** (National Identity Verification Service) behind a single MCP tool.

## Nigeria — connector status

| Field | Value |
|-------|-------|
| Phase | E.5.4 scaffold (Phase F = real adapter) |
| Auth | Mock; production uses NIMC NIVS OAuth2 + IP allowlist |
| Region | af-south-1 (closest GA AWS) |
| Statute | National Identity Management Commission Act 2007 |
| Doc shape | 11 digits, Verhoeff checksum |

## Tools

| # | Tool | What it does |
|---|------|--------------|
| 1 | `nin.verify_nin` | Verify an 11-digit NIN against NIMC NIVS (returns verified flag + match score + NIMC reference id) |

## Adapter contract

The MCP entrypoint dispatches to a `NinAdapter` (`src/types.ts`). Two implementations ship:

- `MockNinAdapter` — deterministic, no IO. Used by tests + the api-gateway when env credentials are missing. Verified iff `^\d{11}$` AND last digit is even.
- `NimcNivsAdapter` — Phase F production adapter against the NIMC NIVS REST API (https://nimc.gov.ng/the-nivs-platform/). Currently throws "not yet wired"; tracked as `NotYetWired`.

## Setup

```bash
pnpm --filter @bossnyumba/mcp-server-nin install
pnpm --filter @bossnyumba/mcp-server-nin typecheck
pnpm --filter @bossnyumba/mcp-server-nin test
```

## References

- NIMC NIN spec — https://nimc.gov.ng/nin
- NIMC NIVS platform — https://nimc.gov.ng/the-nivs-platform/
- BOSSNYUMBA jurisdictional rules — `packages/domain-models/src/common/jurisdictional-rules.ts` (entry `NG`)
