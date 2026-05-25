# Supabase Bootstrap — One-Command Setup

**Scope**: provisioning a brand-new BOSSNYUMBA Supabase project + populating
`.env.local` with fresh secrets + applying migrations + seeding the dev
tenant. The script (`scripts/setup-bossnyumba-env.mjs`) is idempotent —
re-running converges; it never overwrites a value you set by hand.

> Production deployments differ — see the **Production** section at the
> bottom. This runbook is for **dev / staging** only.

---

## 1. Prerequisites

| Tool                   | Purpose                                   | Install                                          |
| ---------------------- | ----------------------------------------- | ------------------------------------------------ |
| `supabase` CLI         | Project create / link / migrate           | `brew install supabase/tap/supabase`             |
| `openssl`              | Sanity check (script uses Node `crypto`)  | macOS preinstalled                                |
| `node`                 | ESM script runtime                        | `>= 20.0.0` — https://nodejs.org/                |
| `pnpm`                 | Workspace package manager                 | `npm install -g pnpm@8`                          |
| `SUPABASE_ACCESS_TOKEN`| Personal access token for the project API | https://supabase.com/dashboard/account/tokens     |
| `SUPABASE_ORG_ID`      | Your Supabase organisation id             | `supabase orgs list` after `supabase login`      |

Confirm with `pnpm setup-env --dry-run` — it preflights every CLI and prints
exactly what it would do without touching anything.

---

## 2. The one-command setup

```bash
export SUPABASE_ACCESS_TOKEN=sbp_xxxxxxxxxxxxxxxxxxxxxxxxx
export SUPABASE_ORG_ID=abcd1234-...   # optional; will prompt if absent
pnpm setup-env
```

That's it. The script is wrapped in `package.json`:

```json
"scripts": {
  "setup-env": "node scripts/setup-bossnyumba-env.mjs",
  "gen-secrets": "node scripts/generate-bossnyumba-secrets.mjs"
}
```

---

## 3. The 12 steps the script runs

1. **Preflight CLIs** — `supabase`, `openssl`, `node`, `pnpm` must all be on
   `$PATH`. If any is missing the script prints the install command and
   exits 2.
2. **Read `.env.local`** — if present, parsed and user-set values are
   preserved. If only `.env.example` exists the script seeds from it.
3. **Generate crypto secrets** — seven app-owned secrets are generated via
   Node's `crypto.randomBytes`. Existing user-set values are kept; only
   `TODO_BOSSNYUMBA_*` placeholders are replaced. See
   [§ generated secrets](#generated-secrets) below.
4. **Verify `SUPABASE_ACCESS_TOKEN`** — read from env, or prompted (masked)
   if `--yes` is not set.
5. **Resolve `SUPABASE_ORG_ID`** — same pattern.
6. **Create Supabase project** — `supabase projects create bossnyumba-dev
   --org-id <id> --region eu-west-2`. **Skipped** if `.env.local` already
   has a real `NEXT_PUBLIC_SUPABASE_URL`. The project-ref is parsed from
   the CLI output.
7. **Fetch API keys** — `supabase projects api-keys --project-ref <ref>`
   produces `anon`, `service_role`, and `jwt_secret`. These are patched
   into `.env.local` along with the project URL. **`.env.local` is written
   here** so all riskier steps below can be retried safely.
8. **Link local CLI** — `supabase link --project-ref <ref>` binds the
   local workspace so migrations/seeds use the new project. Non-fatal if
   it fails (you can re-run manually).
9. **Apply migrations** — `cd packages/database && pnpm db:migrate`. This
   runs every migration in `packages/database/drizzle/migrations`.
10. **Seed test users + dev tenant** — calls
    `scripts/bootstrap-tenant.ts` with the bootstrap env vars (admin
    email, tenant name, country=TZ, `--with-demo-data`).
11. **Smoke query** — calls `supabase db remote commit --dry-run` to
    confirm the link + migrations took.
12. **Summary** — prints the dashboard URL, project URL, and next steps.

---

## 4. Generated secrets

The script generates these in step 3 (you can also rotate them
standalone via `pnpm gen-secrets`):

| Variable                | Length        | Purpose                                       |
| ----------------------- | ------------- | --------------------------------------------- |
| `ENCRYPTION_MASTER_KEY` | 32-byte b64   | Field-level AES key (PII at rest)             |
| `JWT_SECRET`            | 48-byte b64   | API-gateway HS256 access-token signing        |
| `JWT_REFRESH_SECRET`    | 48-byte b64   | Refresh-token signing                          |
| `SESSION_HASH_SECRET`   | 48-byte b64   | Audit hash-chain HMAC                         |
| `MCP_API_KEY`           | 32-byte hex   | MCP gateway auth                              |
| `INTERNAL_API_KEY`      | 32-byte hex   | Service-to-service `X-Internal-Key` header    |
| `CRON_SECRET`           | 32-byte hex   | Cron-only endpoint guard                      |

Source of truth: `scripts/lib/env-secrets.mjs`.

---

## 5. Rotating just the secrets (no Supabase rebuild)

```bash
# Print to stdout for review (no side effects)
pnpm gen-secrets

# Patch into .env.local; preserves any non-placeholder values
pnpm gen-secrets --write

# True rotation — overwrites already-set values too
pnpm gen-secrets --write --force
```

Production rotation procedure: see
[`encryption-at-rest-key-rotation.md`](./encryption-at-rest-key-rotation.md).
At a minimum:

1. Generate new value, store as `*_PREVIOUS` for overlap window.
2. Deploy new env to **one** canary instance.
3. Verify decrypt-with-old / encrypt-with-new (24h overlap).
4. Roll fleet, then clear `*_PREVIOUS`.

---

## 6. Troubleshooting

### "project name already exists"

Supabase project names are unique per org. Either:

- Reuse the existing one — set `NEXT_PUBLIC_SUPABASE_URL` to the real
  project URL in `.env.local` and re-run; the script skips step 6.
- Pass `--project-name=bossnyumba-dev-alt`.

### "supabase: command not found"

Step 1 catches this. Install:

```bash
brew install supabase/tap/supabase     # macOS
# or
npm install -g supabase                # any OS
```

### "401 Unauthorized" from `supabase projects create`

`SUPABASE_ACCESS_TOKEN` is invalid or expired. Mint a new one at
https://supabase.com/dashboard/account/tokens and re-export.

### "could not extract project-ref from CLI output"

The Supabase CLI changed its output format. Workarounds:

1. Open `https://supabase.com/dashboard/projects`, find the project,
   copy the ref from the URL.
2. Manually set `NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co` in
   `.env.local` and re-run; step 6 is skipped.
3. File an issue — the parsing logic is in
   `parseSupabaseProjectCreateOutput` in `setup-bossnyumba-env.mjs`.

### "migration apply failed"

The most common cause is a pre-existing partial migration. Recover:

```bash
cd packages/database
pnpm db:reset          # nukes + re-applies everything (DEV ONLY)
pnpm db:migrate
```

If the failure is genuine, see
[`migration-production.md`](./migration-production.md) — the same triage
applies to dev.

### "seeding returned non-zero"

The script continues past seed failures because migrations are already
applied. Retry manually:

```bash
pnpm -s exec tsx scripts/bootstrap-tenant.ts \
  --name "Acme Properties (Dev)" \
  --country TZ \
  --admin-email <your-email> \
  --admin-phone "+255712345678" \
  --with-demo-data
```

### "supabase link failed"

Non-fatal — the project is created and `.env.local` is written. Re-run:

```bash
supabase link --project-ref <ref>
```

The ref is the subdomain in your `NEXT_PUBLIC_SUPABASE_URL`.

---

## 7. Production: what's different

| Step | Dev (`pnpm setup-env`)                | Production                                                |
| ---- | ------------------------------------- | --------------------------------------------------------- |
| 6    | `--region eu-west-2` (cheapest)       | Region picked by data-residency requirements (TZ→eu-west-2, KE→eu-west-2, EU→eu-central-1) |
| 6    | Single project                        | Primary + DR (`bossnyumba-prod`, `bossnyumba-prod-dr`) with cross-region replication |
| 9    | Migrations applied to direct DB       | Migrations applied via `scripts/migrate-prod.ts` with shadow-DB pre-flight (see [migration-production.md](./migration-production.md)) |
| 10   | Demo tenant seeded                    | NO demo seed in prod — first real tenant onboarded via [tenant-onboarding.md](./tenant-onboarding.md) |
| —    | Postgres single-instance              | Postgres HA + anti-affinity (`docker-compose.ha.yml`)     |
| —    | Secrets in `.env.local`               | Secrets in cloud KMS / Doppler / 1Password; `.env.local` empty in prod |

**Do not** run `pnpm setup-env` against a production project. The
production bootstrap is the manual procedure documented at
[`migration-production.md`](./migration-production.md) +
[`backup-restore.md`](./backup-restore.md).

---

## 8. CI usage

```yaml
# Example GitHub Actions step
- name: Setup BOSSNYUMBA env
  env:
    SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
    SUPABASE_ORG_ID: ${{ secrets.SUPABASE_ORG_ID }}
  run: pnpm setup-env --yes --skip-supabase
```

`--skip-supabase` is the right CI mode: regenerate secrets, don't try to
create a new project on every run.

---

## 9. Related docs

- `Docs/SUPABASE_LIVE_TEST.md` — first-time live-test smoke
- `Docs/RUNBOOKS/migration-production.md` — production migration playbook
- `Docs/RUNBOOKS/encryption-at-rest-key-rotation.md` — KEK/DEK rotation
- `Docs/RUNBOOKS/tenant-onboarding.md` — onboarding a real tenant
- `scripts/bootstrap-tenant.ts` — single-tenant provisioning (called by step 10)
- `scripts/lib/env-secrets.mjs` — secret field registry
- `scripts/lib/env-mutators.mjs` — `.env` parse/serialise helpers
