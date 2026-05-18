# @bossnyumba/mcp-server-firs

Sandboxed **Model Context Protocol** server for Nigeria's **FIRS** (Federal Inland Revenue Service) and **NRS** (Nigeria Revenue Service) tax surface.

## Nigeria — connector status

| Field | Value |
|-------|-------|
| Phase | E.5.4 scaffold (Phase F = real adapter) |
| Portal | TaxProMax (https://taxpromax.firs.gov.ng) + NRS Tax ID Portal |
| VAT rate | 7.5 % (Finance Act 2020 §15) |
| Filing | Monthly |
| TIN format | Legacy FIRS = 12 digits; NRS Tax ID (2026+) = 13 digits derived from NIN/RC |

## Tools

| # | Tool | What it does |
|---|------|--------------|
| 1 | `firs.file_vat_return` | File a monthly VAT return (7.5 % of gross sales − input-VAT credit) |
| 2 | `firs.verify_tin` | Verify a 12-digit FIRS TIN or 13-digit NRS Tax ID; returns issuer |
| 3 | `firs.get_payment_status` | Poll the payment status of a filed return by ack id |

## Adapter contract

The MCP entrypoint dispatches to a `FirsAdapter` (`src/types.ts`). Two implementations ship:

- `MockFirsAdapter` — deterministic, no IO. Used by tests + composition fallback.
- `FirsTaxProMaxAdapter` — Phase F production adapter (TaxProMax REST + NRS Tax ID portal). Currently throws "not yet wired".

## Setup

```bash
pnpm --filter @bossnyumba/mcp-server-firs install
pnpm --filter @bossnyumba/mcp-server-firs typecheck
pnpm --filter @bossnyumba/mcp-server-firs test
```

## References

- FIRS TaxProMax — https://taxpromax.firs.gov.ng
- Nigeria Tax Act 2025 (NRS Tax ID, effective 2026-01-01)
- Finance Act 2020 (raised VAT 5 % → 7.5 %)
- BOSSNYUMBA jurisdictional rules — `packages/domain-models/src/common/jurisdictional-rules.ts` (entry `NG`)
