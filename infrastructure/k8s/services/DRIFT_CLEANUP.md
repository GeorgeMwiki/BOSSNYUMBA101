# infrastructure/k8s/services — drift cleanup

Removed on 2026-04-21 as part of DEPLOY blocker B:

- `notifications-deployment.yaml` — referenced `bossnyumba/notifications:latest`.
  No Dockerfile produces that image; `services/notifications` has no HTTP
  server bootstrap (`listen(` / `serve(` / `hono.fetch`) — it is a pure
  library consumed in-process by `api-gateway`.
- `payments-deployment.yaml` — referenced `bossnyumba/payments:latest`.
  Same story: pure library under `services/payments`, no Dockerfile, no
  HTTP entrypoint. Consumed in-process.
- `reports-deployment.yaml` — referenced `bossnyumba/reports:latest`.
  The only HTTP surface in `services/reports` is `src/scheduler/scheduler-runner.ts`,
  which is already shipped as the separate `bossnyumba/scheduler:latest` image
  via `docker/Dockerfile.scheduler`. The `reports` image is orphan.
- `kustomization.yaml` — empty after the three deployments were removed.
  The parent `infrastructure/k8s/kustomization.yaml` was updated to drop
  the `services` entry.

Authoritative statement on library services lives in `docker/Dockerfile.service`
(top comment) and `docker-compose.yml` (lines 96-117). Adding these services
back as standalone deployables requires a thin HTTP wrapper (hono/express)
exposing `/healthz` plus a Dockerfile — tracked as a known gap.
