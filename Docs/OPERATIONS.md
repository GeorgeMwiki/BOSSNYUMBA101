# BOSSNYUMBA — Operations Runbook

Operational handbook for running BOSSNYUMBA in production. Paired with `Docs/DEPLOYMENT.md` (bring-up) and `Docs/RUNBOOK.md` (legacy).

## Table of Contents

1. [Incident Response](#1-incident-response)
2. [Rollback Procedure](#2-rollback-procedure)
3. [Known-Issue Catalog](#3-known-issue-catalog)
4. [Capacity Planning](#4-capacity-planning)
5. [Cost + Observability Dashboards](#5-cost--observability-dashboards)
6. [Emergency Contacts](#6-emergency-contacts)
7. [Data-Deletion SLA per Country](#7-data-deletion-sla-per-country)
8. [Operational Scripts Reference](#8-operational-scripts-reference)

---

## 1. Incident Response

### 1.1 Severity ladder

| Severity | Definition | Ack target | Resolve target |
|---------|-----------|------------|----------------|
| P0 | Full platform down, data loss, paid tenants cannot transact | 5 min | 1 h |
| P1 | Major feature down for >5% of tenants (e.g. payments, auth) | 15 min | 4 h |
| P2 | Degraded experience, workarounds exist | 30 min | 24 h |
| P3 | Cosmetic / no user impact | 24 h | Next sprint |

### 1.2 Escalation Path

1. **Primary on-call engineer** — paged by PagerDuty / OpsGenie (see Section 6).
2. **Engineering lead** — paged after 15 min without ack, or immediately on P0.
3. **CTO** — paged on P0 or if engineering lead unreachable for 15 min.
4. **CEO** — notified on P0 that lasts >1 h or affects customer funds.

### 1.3 Response Steps

1. Acknowledge page. Join `#incident-<id>` Slack channel (auto-created).
2. Check dashboards: Sentry, PostHog, Grafana, Postgres RDS monitoring.
3. Run `scripts/smoke-test.sh` against the impacted region.
4. Hit `GET /api/v1/health/deep` with an admin token — every upstream is probed.
5. If an upstream is `unhealthy`, consult Section 3 for known failure modes.
6. Post status updates every 15 min to `#status-ops`.
7. On resolve, open a blameless post-mortem within 48 h.

### 1.4 On-Call Rotation Template

```yaml
# config/on-call-rotation.yaml
primary:
  schedule: weekly-rotating
  handoff: Monday 09:00 EAT
  members:
    - engineer_a@example.com
    - engineer_b@example.com
    - engineer_c@example.com
escalation:
  - role: engineering_lead
    members: [lead@example.com]
  - role: cto
    members: [cto@example.com]
```

---

## 2. Rollback Procedure

### 2.1 Application code

```bash
# 1. Confirm the last-known-good git SHA
git log --oneline -n 10 main

# 2. Roll the deployment back
# (Kubernetes)
kubectl -n bossnyumba-prod rollout undo deployment/api-gateway
kubectl -n bossnyumba-prod rollout status deployment/api-gateway

# (ECS / Fargate)
aws ecs update-service --cluster prod --service api-gateway \
  --task-definition api-gateway:<previous-revision>
```

### 2.2 Database migrations

**Migrations are forward-only by default.** If a recently-applied migration
is the cause, follow this procedure:

1. Check the `_migrations` audit table for the offending version + timestamp.
2. Write a *compensating* migration (e.g. `0099_revert_0098.sql`) that undoes the schema change.
3. Apply with `scripts/migrate-prod.sh`.
4. **Never** drop rows from `_migrations` — the audit trail is sacrosanct.

### 2.3 Full snapshot restore (LAST RESORT)

```bash
BOSSNYUMBA_ALLOW_RESTORE=true \
  BACKUP_BUCKET=s3://bossnyumba-backups \
  BACKUP_ENCRYPTION_KEY="$(pass show bossnyumba/backup-key)" \
  scripts/restore.sh --key bossnyumba/daily/2026-04-18/postgres-20260418T020000Z.dump.gz.enc
```

You will be asked to type `RESTORE` and the key suffix twice. After the restore,
**re-run** `scripts/migrate-prod.sh` so any migrations applied AFTER the snapshot
get replayed.

---

## 3. Known-Issue Catalog

| ID | Symptom | Diagnosis | Mitigation |
|----|---------|-----------|------------|
| KNOWN-01 | `/health` returns 503 after deploy | Gateway in graceful-shutdown window (10s drain) | Wait 15 s; if persists check `kubectl logs` for `shutdown: forced exit` |
| KNOWN-02 | Anthropic probe `degraded` | Upstream rate limit or key rotation | `ANTHROPIC_API_KEY` env var check; tier bump via console |
| KNOWN-03 | GePG webhook replays | Deliveries retried when receipt signature fails | Inspect `webhook_deliveries` DLQ via `/api/v1/webhooks/dlq` |
| KNOWN-04 | Outbox backlog > 1000 | Event bus runner not draining | `OUTBOX_INTERVAL_MS` too high OR DB pressure; rerun with `OUTBOX_BATCH_SIZE=200` |
| KNOWN-05 | `_migrations` count mismatch | Deployment shipped files without running migrator | `scripts/migrate-prod.sh --dry-run` then rerun without flag |
| KNOWN-06 | SSE chat stalls mid-stream | Load-balancer idle timeout < 60 s | Verify ALB/NLB `idle_timeout` ≥ 120 s |
| KNOWN-07 | Autonomy actions missing audit rows | Policy evaluator crashed before persist | Check `autonomous_action_audit` — re-run via `/api/v1/autonomous-actions-audit/replay` |
| KNOWN-08 | Redis `MOVED` errors | Cluster rebalance mid-request | Retry idempotent reads; writes route via gateway middleware |

---

## 4. Capacity Planning

### 4.1 Baseline (per 100 active tenants)

| Resource | Baseline | At 2x load | At 10x load |
|----------|----------|-----------|------------|
| API Gateway CPU | 0.5 vCPU | 1.0 vCPU | 4.0 vCPU |
| API Gateway memory | 512 MiB | 1 GiB | 4 GiB |
| Postgres connections | 40 | 80 | 200 (enable PgBouncer) |
| Postgres storage | 20 GiB | 40 GiB | 200 GiB (partition `audit_events`) |
| Redis memory | 256 MiB | 512 MiB | 2 GiB |
| Outbox throughput | 20 events/s | 40 events/s | 200 events/s (scale workers) |

### 4.2 Load-test budgets (enforced by CI)

Run `scripts/load-test-suite.sh` — every scenario has a P95 budget; the script
exits non-zero if any exceeds. Baselines:

| Scenario | P95 Budget |
|----------|-----------|
| `health` | 10 ms |
| `streaming-chat-init` | 150 ms |
| `mcp-manifest` | 80 ms |
| `mcp-tools-call` | 200 ms |
| `listings-list` | 200 ms |
| `listings-create` | 300 ms |
| `arrears-projection` | 250 ms |
| `training-generate` | 400 ms |
| `compliance-plugins` | 150 ms |
| `ai-costs-summary` | 200 ms |

### 4.3 Scale-out triggers

- **Gateway**: CPU > 70 % for 5 min OR p95 > 400 ms for 2 min
- **Postgres**: connections > 80 % of `max_connections` OR replica lag > 5 s
- **Redis**: memory > 75 % of `maxmemory`
- **Outbox worker**: backlog > 500 events pending for > 60 s

---

## 5. Cost + Observability Dashboards

| Tool | Purpose | URL (example) |
|------|---------|---------------|
| Sentry | Error tracking, traces | `https://sentry.io/organizations/bossnyumba/` |
| PostHog | Product analytics, funnels | `https://app.posthog.com/project/bossnyumba` |
| Grafana | System metrics, Prometheus | `https://grafana.internal.bossnyumba.com` |
| AWS Cost Explorer | Infrastructure spend | IAM → CostExplorer |
| Anthropic Console | AI token usage + cost | `https://console.anthropic.com/settings/billing` |
| OpenAI Dashboard | (Fallback AI) usage | `https://platform.openai.com/usage` |
| GePG TX Monitor | Tanzania payments | `https://gepg-portal.tz/dashboard` |

Replace the example URLs with your real tenant URLs at deploy time. Keep the
links in `Docs/OPERATIONS.md` so the on-call reference is one search away.

---

## 6. Emergency Contacts

Keep this block in a **secrets store** (1Password / Vault) and re-render into
this doc on release. Template:

```
Engineering Lead:  <name> / <phone> / <email>
CTO:               <name> / <phone> / <email>
CEO:               <name> / <phone> / <email>
AWS TAM:           <name> / <phone> / <email>
Anthropic Support: <email> (24/7 priority for Scale tier)
DB Ops:            <name> / <phone> / <email>
Security Officer:  <name> / <phone> / <email>
Legal / DPO:       <name> / <phone> / <email>
```

PagerDuty service keys:
- `api-gateway`  — P0 paging path
- `background-jobs` — P1
- `infrastructure` — P0

---

## 7. Data-Deletion SLA per Country

BOSSNYUMBA exposes `/api/v1/gdpr/delete-request` for every tenant. The SLA
for full erasure depends on the tenant's `country` code and the applicable
plugin in `@bossnyumba/compliance-plugins`:

| Country | Regulation | Deletion SLA | Retention override |
|---------|-----------|--------------|--------------------|
| Tanzania (TZ) | Personal Data Protection Act 2022 | 30 days | Tax records retained 10 years (BoT) |
| Kenya (KE) | DPA 2019 | 30 days | KRA tax retention 7 years |
| Uganda (UG) | Data Protection & Privacy Act 2019 | 30 days | URA tax retention 10 years |
| Nigeria (NG) | NDPA 2023 | 30 days | FIRS retention 6 years |
| South Africa (ZA) | POPIA | 30 days | SARS retention 5 years |
| United States (US) | CCPA / state-level | 45 days | IRS retention 7 years |

Audit trail of every deletion request lives in `gdpr_deletion_requests`.
Financial / tax records survive the deletion under a legal-hold flag.

---

## 8. Operational Scripts Reference

| Script | Purpose | Gate |
|--------|---------|------|
| `scripts/bootstrap-tenant.sh` | Create a new tenant end-to-end | — |
| `scripts/teardown-tenant.sh` | Remove a tenant (TEST/DEV only) | `BOSSNYUMBA_ALLOW_TEARDOWN=true` |
| `scripts/migrate-prod.sh` | Apply pending SQL migrations with audit | — |
| `scripts/migrate-prod.sh --dry-run` | Show what would be applied | — |
| `scripts/backup.sh` | Encrypted S3 backup (daily + monthly) | `BACKUP_ENCRYPTION_KEY` |
| `scripts/restore.sh` | Interactive restore (double-confirm) | `BOSSNYUMBA_ALLOW_RESTORE=true` |
| `scripts/load-test-suite.sh` | 10-scenario autocannon suite + budgets | Gateway reachable |
| `scripts/smoke-test.sh` | Post-deploy health checks | Gateway reachable |
| `scripts/uat-walkthrough.sh` | End-to-end API assertion sweep | Gateway + auth |

### 8.1 Graceful shutdown log lines

The gateway emits the following lines during a controlled SIGTERM:

```
shutdown: signal received — starting drain
shutdown: outbox worker stopped
shutdown: heartbeat supervisor stopped
shutdown: background supervisor stopped
shutdown: server drained (no in-flight requests)
shutdown: postgres pool closed
shutdown: complete, exiting 0
```

If the last line is missing OR `shutdown: forced exit after 10s drain timeout`
appears, a request handler hung. File a KNOWN-issue entry and attach the trace.

---

**Linked from**: `Docs/DEPLOYMENT.md`, `Docs/RUNBOOK.md`, `Docs/PRODUCTION_READINESS.md`.
