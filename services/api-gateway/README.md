# @bossnyumba/api-gateway

BFF / API gateway for BOSSNYUMBA. Express + Hono. Terminates JWT auth, enforces `@bossnyumba/authz-policy`, fans out to domain services, and exposes the OpenAPI surface documented in `Docs/api/openapi.yaml`.

## Run

```bash
pnpm --filter @bossnyumba/api-gateway dev   # port 4000
```

Routes live in `src/routes/`.
