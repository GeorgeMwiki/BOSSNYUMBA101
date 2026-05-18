# @bossnyumba/mcp-server-opay

Sandboxed **Model Context Protocol** server for **OPay** — Nigeria's largest mobile-money operator (~40 % daily-active share per CBN Q1-2026 returns).

## Nigeria — connector status

| Field | Value |
|-------|-------|
| Phase | E.5.4 scaffold (Phase F = real adapter) |
| API | OPay Merchant API (OAuth2 + HMAC-signed requests) |
| Market share | ~40 % daily-active wallets, 100M daily transactions (2024) |
| Tool grammar | Mirrors M-Pesa Daraja so the kernel stays rail-agnostic |
| Statute | CBN Mobile Money Operators Regulations 2021 |

## Tools

| # | Tool | What it does |
|---|------|--------------|
| 1 | `opay.initiate_payment` | Push a collection prompt to a Nigerian OPay wallet; returns OPay transactionId |
| 2 | `opay.verify_payment` | Poll for settlement status (pending / succeeded / failed / reversed) |
| 3 | `opay.cashflow_lookup` | Daily inflows / outflows over a window (used by underwriting) |

## Adapter contract

- `MockOpayAdapter` — deterministic, no IO. Used by tests + composition fallback.
- `OpayMerchantAdapter` — Phase F production adapter (OPay Merchant API). Currently throws "not yet wired".

## Setup

```bash
pnpm --filter @bossnyumba/mcp-server-opay install
pnpm --filter @bossnyumba/mcp-server-opay typecheck
pnpm --filter @bossnyumba/mcp-server-opay test
```

## References

- OPay Merchant API docs — https://documentation.opaycheckout.com/
- CBN Mobile Money Operators Regulations 2021
- BOSSNYUMBA jurisdictional rules — `packages/domain-models/src/common/jurisdictional-rules.ts` (entry `NG`, `mobileMoney[0]`)
