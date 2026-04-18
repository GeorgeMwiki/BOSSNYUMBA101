# BOSSNYUMBA — Incident Runbook

How to triage, mitigate, and roll back common production incidents.

---

## On-call expectations

- Primary on-call carries pager 24/7 on a 1-week rotation.
- Secondary is backup + weekend escalation.
- **Target**: acknowledge within 10 minutes, initial mitigation within 30.

Contacts (placeholders — replace in the private on-call sheet):

- **Platform eng lead**: TBD
- **Payments SME**: TBD
- **AI / doc-intel SME**: TBD

---

## Incident: OCR provider down

**Symptoms**

- `document-intelligence` `/healthz` returns `{ status: "degraded" }`
- CloudWatch alarm `OCRFailureRate > 5%` firing
- User-facing: document upload spinner never resolves

**Diagnose**

1. Check which provider is configured: `echo $OCR_PROVIDER`.
2. Hit the provider status page:
   - Textract: https://health.aws.amazon.com/
   - Google Vision: https://status.cloud.google.com/
3. Tail the service logs:
   ```bash
   aws logs tail /ecs/bossnyumba-production-document-intelligence --follow
   ```
   Look for `ocr_provider_error` structured log lines.

**Mitigate**

- **Short-term**: failover to the other provider.
  ```bash
  aws ecs update-service \
    --cluster bossnyumba-production \
    --service bossnyumba-production-document-intelligence \
    --force-new-deployment
  # After updating OCR_PROVIDER in the task definition.
  ```
- **Emergency**: set `OCR_PROVIDER=mock` to unblock the UI while you
  investigate. Documents processed during this window will need
  re-extraction — tag them with `ocr_needs_reprocess=true`.

**Close-out**

- File a post-mortem if the mitigation took > 1 hour.
- Re-queue any documents stuck with `ocr_status = 'pending'` via
  `pnpm cli:document-intel reprocess --since=<timestamp>`.

---

## Incident: GePG webhook signature failure

**Symptoms**

- `webhooks` service logs `gepg_signature_invalid` for real traffic
- Finance reports missing control-number reconciliations
- CloudWatch alarm `GePGWebhookRejectionRate > 1%` firing

**Diagnose**

1. Check if a GePG key rotation happened recently — they publish rotations
   with 48h lead time but operators sometimes miss the memo.
   ```bash
   aws secretsmanager describe-secret \
     --secret-id bossnyumba/production/gepg-signing-key \
     --query 'LastChangedDate'
   ```
2. Compare the `GEPG_MODE` env var against the URL the webhook came from.
   Sandbox callbacks to the prod URL or vice versa will fail signing.
3. Pull the raw payload (redacted) from the dead-letter queue:
   ```bash
   aws sqs receive-message \
     --queue-url https://sqs.eu-west-1.amazonaws.com/<acct>/gepg-dlq
   ```

**Mitigate**

- If a rotation was missed: update the secret and force a webhook service
  restart (see DEPLOYMENT §3).
- If a single batch failed: replay from the DLQ using
  `pnpm cli:webhooks replay --queue=gepg --max=50`. Replay is idempotent
  because every control-number reconciliation goes through the
  idempotency key in Redis.

**Close-out**

- Confirm `reports/financial-reconciliation` balances for the affected day.
- Update the GePG rotation calendar (`Docs/ops/gepg-rotation.md`).

---

## Incident: Notifications DLQ full

**Symptoms**

- BullMQ dashboard shows `notifications:failed` queue > 1 000 entries
- Customer complaints about missing rent reminders / receipts
- CloudWatch alarm `NotificationsDLQDepth` firing

**Diagnose**

1. Inspect the first 5 DLQ jobs:
   ```bash
   pnpm cli:notifications inspect-dlq --limit=5
   ```
   Common causes:
   - Resend 429s → hit rate limit
   - Twilio 400s → malformed phone number
   - Missing per-tenant sender identity

**Mitigate**

- **Rate-limit hit**: pause the worker for 10 min, then replay in batches
  of 100 every 60 s:
  ```bash
  pnpm cli:notifications replay-dlq --rate=100/minute
  ```
- **Malformed recipients**: bulk-resolve via
  `pnpm cli:notifications drop-invalid-dlq` — only drops jobs whose
  payload fails validation. Prompts for confirmation.
- **Sender not verified**: verify in Resend / Twilio console, then
  replay.

**Close-out**

- Zero the alarm counter with a `cloudwatch set-alarm-state OK`.
- Run `pnpm cli:notifications coverage --since=<incident-start>` to
  confirm no customer is still missing messages.

---

## Incident: SLA worker stuck / not firing

**Symptoms**

- `scheduler` `/healthz` shows `sla-worker.lastSuccessAt` > 30 min stale
- Overdue cases not auto-escalating
- CloudWatch alarm `SchedulerWorkerStale` firing

**Diagnose**

1. Inspect scheduler logs for the worker ID:
   ```bash
   aws logs tail /ecs/bossnyumba-production-scheduler --follow \
     --filter-pattern '"workerId":"sla-worker"'
   ```
2. Check the inFlight list in `/healthz` — a worker with no tick progress
   but present in `inFlight` means its handler is hung (usually a blocking
   DB query).

**Mitigate**

- **Hung handler**: restart the scheduler service.
  ```bash
  aws ecs update-service \
    --cluster bossnyumba-production \
    --service bossnyumba-production-scheduler \
    --force-new-deployment
  ```
  Because the service is pinned to desired_count=1, the new task waits
  for the old one to drain (up to 30 s per the shutdown handler) — no
  risk of double-firing.
- **Downstream timeout**: check the case repo's Postgres pool — look for
  idle-in-transaction queries:
  ```sql
  SELECT pid, state, query_start, query
  FROM pg_stat_activity
  WHERE state = 'idle in transaction'
  ORDER BY query_start;
  ```
  Kill offenders with `SELECT pg_terminate_backend(<pid>);`.

**Close-out**

- Backfill any missed escalations by manually invoking the worker:
  ```bash
  curl -X POST https://scheduler.internal.bossnyumba.io/admin/run/sla-worker
  ```
  (admin endpoint added in a follow-up wave — until then, restart is the
  recovery path and the next scheduled tick picks up the backlog).

---

## Rollback procedure

All services run on ECS Fargate with rolling deploys. Rollback = redeploy
a previous task-definition revision.

```bash
# 1. List recent revisions
aws ecs list-task-definitions \
  --family-prefix bossnyumba-production-api-gateway \
  --sort DESC --max-items 5

# 2. Point the service at the known-good revision
aws ecs update-service \
  --cluster bossnyumba-production \
  --service bossnyumba-production-api-gateway \
  --task-definition bossnyumba-production-api-gateway:<revision>

# 3. Monitor the deploy
aws ecs wait services-stable \
  --cluster bossnyumba-production \
  --services bossnyumba-production-api-gateway
```

**DB migrations** are forward-only. If a migration broke production,
roll back the application to a compatible revision first, then write a
compensating migration. Do not run `DROP`-style rollbacks against a live
database without a backup verified in the last hour.

---

## Escalation matrix

| Severity | Examples                                                        | Response                                           |
| -------- | --------------------------------------------------------------- | -------------------------------------------------- |
| SEV-1    | API gateway down, payments not processing, data loss            | Page primary, page secondary immediately           |
| SEV-2    | One tenant's reports broken, OCR degraded, notifications behind | Page primary                                       |
| SEV-3    | Scheduler worker stale (non-blocking), dashboard numbers stale  | Ticket, address within business hours              |
| SEV-4    | Cosmetic / flakiness                                            | Backlog                                            |

---

## Change freezes

- **Tanzania month-end (25th–1st)**: payments-related changes gated on
  SRE approval — rent cycle is sensitive.
- **EOY / EOF**: no deploys between 22 Dec and 2 Jan without exec sign-off.
