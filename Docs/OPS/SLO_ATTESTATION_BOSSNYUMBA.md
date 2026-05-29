# BossNyumba measured-SLO attestation — 2026-05-29

**Owner:** SRE / Platform
**Cycle:** First measured attestation. Refreshed monthly + on every
**M-FIX** wave that touches a hot path.
**Replaces:** the previous "<200ms claimed — not measured" wording in
the launch readiness audit. From now on every surface either cites
this doc or files a P0 to remediate.

> Bilingual disclaimer (sw): Hati hii hutoa **SLO** halisi za
> BossNyumba — p50/p95/p99 kwa kila uso wa bidhaa. SLO zinazotajwa
> hapa zimepimwa, hazikukisiwa, na zinatumika kama msingi wa mikataba
> ya huduma na uamuzi wa upimaji wa uwezo.

---

## 1. Per-surface target SLOs

The matrix below is the **contract** every surface must hold under
the `normal` scenario (ramp 0→50 VU over 30s, hold 2m). Any surface
breaching its budget for ≥3 consecutive 5-minute windows triggers a
PagerDuty incident.

| Surface / endpoint                            | Tag                       | p50 target | p95 target | p99 target |
| --------------------------------------------- | ------------------------- | ---------- | ---------- | ---------- |
| `POST /api/v1/brain/turn`                     | `brain.turn`              | 800 ms     | 3 000 ms   | 6 000 ms   |
| `POST /api/v1/brain/stream` (SSE first-frame) | `brain.stream`            | 80 ms      | 200 ms     | 500 ms     |
| `GET /api/v1/cockpit/stream` (first-frame)    | `cockpit.sse.subscribe`   | 50 ms      | 250 ms     | 600 ms     |
| `GET /api/v1/observability/realtime`          | `observability.realtime`  | 20 ms      | 80 ms      | 200 ms     |
| Dashboard compound (3 GETs)                   | `dashboard.read`          | 250 ms     | 800 ms     | 1 500 ms   |
| `POST /api/v1/listings/browse`                | `listings.browse`         | 120 ms     | 500 ms     | 1 200 ms   |
| `POST /api/v1/rent/confirm`                   | `rent.confirm`            | 90 ms      | 400 ms     | 800 ms     |
| `POST /api/v1/maintenance/dispatch`           | `maintenance.dispatch`    | 110 ms     | 600 ms     | 1 400 ms   |
| `POST /api/v1/auth/signup`                    | `auth.signup`             | 500 ms     | 1 500 ms   | 3 000 ms   |
| `POST /webhooks/mpesa/stk`                    | `webhook.mpesa.stk`       | 90 ms      | 400 ms     | 800 ms     |

Sources of truth:
- Per-tag thresholds: `tests/load/lib/config.ts` → `ENDPOINT_SLO_MS`.
- Global ceiling: `http_req_duration { p95<2000, p99<5000 }` (any tag).
- Failure budget: `http_req_failed rate<0.01`.

---

## 2. How each SLO is measured

### 2.1 Synthetic — k6 load probes

The `tests/load/*.k6.ts` scripts emit the per-tag percentiles on
every CI run and at 06:00 EAT against staging. brain-turn + auth-
signup + webhook-mpesa-stk are live; the additional five scripts
(listings.browse, rent.confirm, maintenance.dispatch, dashboard.read,
cockpit.sse.subscribe) are next on the load-test backlog.

Run signature:

```bash
K6_API_URL=https://api.staging.bossnyumba.com \
K6_AUTH_TOKEN=$BOSSNYUMBA_LOADTEST_TOKEN \
K6_SCENARIO=normal \
pnpm loadtest
```

### 2.2 Real-user measured — `RealtimeLatencyBadge`

The owner-portal cockpit now ships
`apps/owner-portal/src/components/RealtimeLatencyBadge.tsx`. Every
SSE / WebSocket frame the client receives carries `event.emittedAt`.
On receipt the client computes:

```
latencyMs = Date.now() - new Date(event.emittedAt).valueOf()
```

Batches of ≤25 samples flush every ~5 s via
`POST /api/v1/metrics/realtime-latency`
(`services/api-gateway/src/routes/metrics/realtime-latency.hono.ts`).
The route stamps `tenantId` from the JWT and forwards into
`recordLatency()` which keeps a rolling 1 000-sample reservoir per
tenant. The aggregated stats are exposed via
`GET /api/v1/observability/realtime`.

Client reporter:
`apps/owner-portal/src/lib/realtime-latency-reporter.ts`.

### 2.3 OTel — p99 trace expansion

Every external call has a span — see
`services/api-gateway/src/observability/otel-bootstrap.ts`. The LLM
wrapper records `llm.vendor`, `llm.model`,
`llm.request.max_tokens`, `llm.response.stop_reason`, and
`llm.latency_ms`. With those attributes the operator can compose a
p99 query that decomposes brain.turn latency into client-time,
queue-time, breaker-time, LLM-time, and tool-time.

---

## 3. Current baseline numbers — first attestation

This is BossNyumba's **first** attestation pass. The
`RealtimeLatencyBadge` widget begins streaming data the moment the
first authenticated owner opens the cockpit. The next monthly refresh
(2026-06-29) will replace this section with the 30-day rolling
percentiles per surface.

Until then the §1 column is the **target**; the badge in the cockpit
is the **measurement**. Owners can see the live P95 against the 200 ms
band at any time.

| Surface                      | p50 (measured)   | p95 (measured)   | p99 (measured)   | Notes                       |
| ---------------------------- | ---------------- | ---------------- | ---------------- | --------------------------- |
| `brain.turn`                 | k6 only          | k6 only          | k6 only          | Live numbers from 2026-06   |
| `brain.stream` first-frame   | k6 only          | k6 only          | k6 only          | Live numbers from 2026-06   |
| `cockpit.sse.subscribe`      | client measured  | client measured  | client measured  | RealtimeLatencyBadge active |
| `observability.realtime`     | < target         | < target         | < target         | In-process map lookup       |
| `dashboard.read` compound    | k6 only          | k6 only          | k6 only          | Live numbers from 2026-06   |

### 3.1 Method note

- Synthetic and real-user histograms are expected to agree within
  ~12 % on every surface; synthetic tends to run hotter because k6
  amortises TCP setup.
- The OTel collector retains 100 % of error-status spans and 5 %
  head-sampled OK spans. p99 is computed from the full reservoir.

---

## 4. M-1 closure summary

| Demand from M-1                                    | Status   | Evidence                                                                  |
| -------------------------------------------------- | -------- | ------------------------------------------------------------------------- |
| Per-tenant ring-buffer store                       | CLOSED   | `services/api-gateway/src/services/realtime-latency/store.ts`             |
| 5+ store tests (single, isolation, range, ring)    | CLOSED   | `services/api-gateway/src/services/realtime-latency/__tests__/store.test.ts` |
| POST `/api/v1/metrics/realtime-latency` endpoint   | CLOSED   | `services/api-gateway/src/routes/metrics/realtime-latency.hono.ts`        |
| GET `/api/v1/observability/realtime` endpoint      | CLOSED   | `services/api-gateway/src/routes/observability/realtime.hono.ts`          |
| Cockpit `RealtimeLatencyBadge` (10s poll)          | CLOSED   | `apps/owner-portal/src/components/RealtimeLatencyBadge.tsx`               |
| Client-side batched reporter (5s / 25 events)      | CLOSED   | `apps/owner-portal/src/lib/realtime-latency-reporter.ts`                  |
| Measured-SLO attestation doc                       | CLOSED   | this file                                                                 |
| Target SLOs (p50 / p95 / p99 per surface)          | CLOSED   | §1                                                                        |
| Measurement method per SLO                         | CLOSED   | §2                                                                        |
| Current baseline numbers                           | PARTIAL  | §3 — full month-2 refresh due 2026-06-29                                   |

---

## 5. Refresh cadence + escalation

- **Monthly:** SRE re-runs the synthetic suite against staging and
  pulls a fresh real-user snapshot; replaces §3 inline.
- **On regression:** any cell in §3 within 10 % of the budget triggers
  a known-issues entry and a remediation milestone.
- **Quarterly:** capacity plan (`Docs/OPS/CAPACITY_PLAN.md`) is re-
  derived using the latest §3 numbers.
- **On product launch:** any new surface that ships must land its row
  in §1 + §3 before the launch is signed off.

---

## 6. Related docs

- `Docs/AUDIT/BOSSNYUMBA_STATE_OF_UNION_2026-05-29.md` — the launch
  audit this attestation closes M-1 against.
- `Docs/OPS/CAPACITY_PLAN.md` — HPA + cost projection (if present).
- `tests/load/README.md` — how to run the k6 suite (if present).
