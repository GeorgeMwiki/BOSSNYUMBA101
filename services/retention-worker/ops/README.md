# Retention Worker — Operations Guide

`@bossnyumba/retention-worker` is a standalone cron container that runs the
nightly data-retention sweep for BOSSNYUMBA. It consumes retention policy
definitions from `@bossnyumba/enterprise-hardening` and deletes records that
have outlived their retention period, **with legal-hold exemptions enforced
at every step**.

---

## What it does

Every night (default 02:00 UTC) the worker:

1. Loads all enabled retention policies from
   `@bossnyumba/enterprise-hardening` (`DefaultRetentionPolicies` via the
   `DataRetentionManager`). Retention windows today include:
   - Financial records: 7 years
   - Lease documents: 6 years after termination
   - Audit logs: 3 years
   - Analytics snapshots: 5 years
   - Maintenance records: 2 years
   - Communication logs / messages: 1 year
   - PII: 1 year after relationship ends
   - Backups: 90 days
2. For each policy, computes a cutoff timestamp of `now - retentionPeriodDays`.
3. Asks the registered repository adapters for records older than the cutoff.
4. Filters out anything held (see "Legal hold exemption guarantee" below).
5. Soft-deletes (sets `deletedAt`) or hard-deletes eligible records.
6. Writes a single audit log entry summarising the sweep: counts per
   policy, counts excluded by legal hold, errors, and dry-run flag.

The worker is designed to be idempotent and safe to re-run.

---

## Legal hold exemption guarantee

**No record under a legal hold will ever be deleted by this worker,
regardless of age or policy type.** This is enforced in three
independent layers; a record is only eligible for deletion if it passes
all three:

1. **Row-level flag** — candidates with `legal_hold: true` on the source
   row are excluded before any delete path is considered. Repository
   adapters MUST surface this column on `RetentionCandidate.legalHold`.
2. **`legal_holds` registry table** — after the row-level filter, the
   worker cross-checks the remaining candidate IDs against a separate
   `legal_holds` table via `findLegalHoldEntityIds`. Any match is
   excluded.
3. **`DataRetentionManager` scoped holds** — finally, the worker calls
   `DataRetentionManager.isUnderLegalHold(entityType, tenantId, createdAt)`
   to catch holds defined at the tenant / entity-type / date-range level,
   including those created in-memory by compliance tooling but not yet
   persisted to the registry.

Every exclusion is counted in the sweep result's
`totalExcludedByLegalHold` and logged with the hold context. If you need
to verify that a hold is effective, run a dry-run sweep and grep the
structured logs for `excluded records by legal hold`.

---

## Running locally

### Prerequisites

- Node 20+
- pnpm 8
- A local Postgres that `@bossnyumba/database` can reach

### Build and run once (recommended for first try)

```bash
# From the repo root
pnpm install
pnpm --filter=@bossnyumba/retention-worker build

# One-off dry run (no deletes, full logging)
pnpm --filter=@bossnyumba/retention-worker sweep:dry-run

# One-off live sweep
pnpm --filter=@bossnyumba/retention-worker sweep
```

### Run the daemon (cron loop)

```bash
pnpm --filter=@bossnyumba/retention-worker start
# or:
node services/retention-worker/dist/index.js
```

The daemon installs a `node-cron` schedule and sleeps until the next
tick. `SIGINT` and `SIGTERM` cleanly stop the schedule.

### Run tests

```bash
pnpm --filter=@bossnyumba/retention-worker test
```

The tests use an in-memory repository fake and do not touch a real
database.

---

## Environment variables

| Variable                   | Default        | Purpose                                                                 |
| -------------------------- | -------------- | ----------------------------------------------------------------------- |
| `RETENTION_CRON_SCHEDULE`  | `0 2 * * *`    | Cron expression for the nightly sweep. Validated at startup.            |
| `RETENTION_CRON_TZ`        | `UTC`          | Timezone the cron expression is evaluated in.                           |
| `LOG_LEVEL`                | `info`         | One of `debug`, `info`, `warn`, `error`. Structured JSON logging.       |
| `NODE_ENV`                 | `production`   | Standard Node env flag.                                                 |
| `DATABASE_URL`             | (from shared)  | Read from `@bossnyumba/database` via the adapters registered at boot.   |

Operators can shift the sweep without rebuilding the image. Example to
run at 03:30 UTC:

```bash
RETENTION_CRON_SCHEDULE="30 3 * * *" node dist/index.js
```

---

## CLI flags

| Flag         | Description                                                       |
| ------------ | ----------------------------------------------------------------- |
| `--once`     | Run a single sweep and exit. Skips the cron schedule entirely.    |
| `--dry-run`  | Do not actually delete anything. Audit log still records counts.  |

Combine them for a manual audit:

```bash
node dist/index.js --once --dry-run
```

---

## Docker

A production Dockerfile lives at `services/retention-worker/Dockerfile`.
Build from the repo root:

```bash
docker build \
  -f services/retention-worker/Dockerfile \
  -t bossnyumba/retention-worker:latest \
  .
```

Run it:

```bash
docker run --rm \
  -e RETENTION_CRON_SCHEDULE="0 2 * * *" \
  -e DATABASE_URL="postgres://..." \
  bossnyumba/retention-worker:latest
```

The container has no exposed ports; it is a pure cron daemon. Liveness
is observed via the process healthcheck and via the structured audit
log stream.

---

## Runbooks

### "I need to unblock a stuck sweep"

Check the structured logs for `retention sweep crashed` or
`retention sweep entity-type failed`. Per-entity errors are isolated:
one broken entity type will not stop the rest of the sweep. The per-policy
error list is emitted in the final audit log.

### "A record got deleted that shouldn't have"

1. Confirm whether the record had `legal_hold: true` at the time of the
   sweep (consult point-in-time audit tables).
2. Confirm whether a `legal_holds` registry entry covered the record's
   `entityType` and id.
3. If neither is true, the retention policy matched as designed. File a
   ticket to add or tighten the legal hold rather than reverting the
   worker's deletion.

### "I need to hard-delete a class of records immediately"

Prefer running a one-off sweep with explicit hard-delete opt-in rather
than a manual SQL delete, so the audit log still captures the action:

```ts
await runRetentionSweep(
  { repository },
  { hardDeletePolicyIds: ['BACKUP_RETENTION'] },
);
```

Legal hold exemptions still apply.
