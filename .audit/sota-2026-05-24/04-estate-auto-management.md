# Estate Auto-Management — SOTA 2026-05-24

Veteran-expert auto-management advisor: predictive maintenance,
vendor selection, rent collection, multi-channel comms, lease
workflows, cadence reporting, and RPA orchestration. Pure
functions + injected ports — no DB / network calls inside the
package.

## 1. Predictive maintenance

Industry references: **IBM Maximo APM**, **Augury**, **Senseye**,
**SKF @ptitude**. Inputs:

- Vibration RMS (mm/s)
- Surface temperature (°C)
- Run-hours since last service
- Last-service-age (days)
- Spike events (count last 30d)

Failure probability uses a Weibull-tail model:

```
P(failure ≤ Δd) = 1 − exp(−(η · score) ^ β)
```

`score` is a normalised health index (0–1, lower = healthier).
Class-specific `β` (shape) and `η` (scale) are calibrated per
asset family (HVAC, elevator, pump, generator, gate-motor).

When `P(failure ≤ 30 d) ≥ vendorDispatchThreshold`, the
`vendor-trigger` opens a work-order.

## 2. Vendor selection (multi-criteria scoring)

Weights (institutional ops bench-mark, FacilitySource / JLL Work
Dynamics):

- Price competitiveness (30 %)
- Response-time SLA history (25 %)
- Quality history / re-work rate (25 %)
- Geographic proximity (10 %)
- Compliance & insurance (10 %)

`vendor-bidder` solicits N bids → `vendor-scorer` rates each →
`vendor-selector` picks top by composite, falls back if
unavailable.

## 3. Automated rent collection

- **M-Pesa STK Push** retries with smart escalation: 4 attempts
  at `t+0, t+4h, t+1d, t+3d` with exponential backoff.
- **Escalation policy** (DSCR-protecting): 7-day soft (SMS), 14
  -day firm (call), 30-day notice-to-cure, 60-day eviction
  prep.
- Cure-rate-aware: stop hard escalation if tenant has paid in
  full ≥ 3 of last 6 months and balance ≤ 1 month.

## 4. Multi-channel comms

Best-channel scoring per tenant (`reachability-scorer`):

- WhatsApp delivered → read latency
- SMS delivered ratio
- Email open ratio
- Voice answer ratio

Router fallback order: WhatsApp → SMS → Email → Voice.

## 5. Lease workflows

90 / 60 / 30 / 0-day cadence for renewals; termination workflow
with statutory notice windows; monthly-close workflow.

## 6. Reporting cadences

- **Owner monthly** — NOI, occupancy, AR aging, capex YTD.
- **Board quarterly** — strategic KPIs, variance to budget.
- **Regulator yearly** — VAT / WHT / corporate filings (per
  jurisdiction config injected).

## 7. RPA orchestration

`bot-orchestrator` composes the above as a directed run plan,
executing in dependency order with retries, idempotency keys,
and structured logs.
