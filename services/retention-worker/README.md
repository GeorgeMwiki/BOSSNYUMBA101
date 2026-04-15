# @bossnyumba/retention-worker

Scheduled background worker that enforces data-retention policies across
BOSSNYUMBA's operational datastores.

## Registered adapters

| Entity              | Default retention | Mode                      | Env override                         |
| ------------------- | ----------------- | ------------------------- | ------------------------------------ |
| `audit_events`      | 90 days           | Hard delete (legal-hold aware) | `RETENTION_AUDIT_EVENTS_DAYS`       |
| `chat_messages`     | 365 days          | Soft delete (if `deleted_at`) | `RETENTION_CHAT_MESSAGES_DAYS`      |
| `communication_logs`| 365 days          | Soft delete (if `deleted_at`) | `RETENTION_COMMUNICATION_LOGS_DAYS` |
| `ai_interactions`   | 180 days          | Hard delete (no-op until table exists) | `RETENTION_AI_INTERACTIONS_DAYS`    |
| `deleted_user_pii`  | 30 days           | Hard delete (post soft-delete grace) | `RETENTION_DELETED_PII_DAYS`       |

Adapters:

- Skip rows with `legal_hold = true` when that column exists.
- No-op with a warning when the backing table is missing.
- Process up to `RETENTION_BATCH_LIMIT` (default 1000) rows per sweep
  per adapter to avoid long locks.
- Set `RETENTION_DRY_RUN=true` to count candidates without modifying data.

## Scheduling

Configured via `RETENTION_CRON` (default `15 2 * * *`, i.e. 02:15 daily)
and `RETENTION_CRON_TZ` (default `UTC`). A mutex prevents overlapping
runs. On container start, the worker runs an immediate sweep so
short-lived deployments still perform a pass.

## Env reference

| Env                                     | Default       |
| --------------------------------------- | ------------- |
| `DATABASE_URL`                          | required      |
| `RETENTION_CRON`                        | `15 2 * * *`  |
| `RETENTION_CRON_TZ`                     | `UTC`         |
| `RETENTION_DRY_RUN`                     | `false`       |
| `RETENTION_BATCH_LIMIT`                 | `1000`        |
| `RETENTION_AUDIT_EVENTS_DAYS`           | `90`          |
| `RETENTION_CHAT_MESSAGES_DAYS`          | `365`         |
| `RETENTION_COMMUNICATION_LOGS_DAYS`     | `365`         |
| `RETENTION_AI_INTERACTIONS_DAYS`        | `180`         |
| `RETENTION_DELETED_PII_DAYS`            | `30`          |
