# Local Development — BossNyumba

**Last updated:** 2026-05-30

Quick reference for running apps locally.

## Marketing app (port 3010)

Default dev command uses **webpack** (cache-stable). Turbopack is
available as an opt-in flag — it compiles faster first time but its
vega-lite/postcss/manifest cache is known to panic, requiring a
`.next/` wipe to recover.

| Goal | Command |
| --- | --- |
| Normal dev (webpack, stable) | `pnpm --filter @bossnyumba/marketing dev` |
| Dev with Turbopack (faster first compile) | `pnpm --filter @bossnyumba/marketing dev:turbo` |
| Recover from cache crash (vega-lite, postcss, manifest 500s) | `pnpm --filter @bossnyumba/marketing dev:clean` |

The `predev` hook runs before every `dev` invocation and verifies
`apps/marketing/.env.local` exists + is readable. If it fails, copy
the keys from the root `.env.local`.

### Required env keys in `apps/marketing/.env.local`

| Key | Used by | Notes |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | Marketing chat direct-Anthropic fallback | Required for `/api/chat` when api-gateway is down |
| `NEXT_PUBLIC_API_GATEWAY_URL` | All BFF calls | Default `http://localhost:4001` |
| `JWT_SECRET` | Marketing service-token minting | Must match api-gateway value |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser auth | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser auth | Anon key |

### When marketing crashes mid-session

Symptoms: 500s with `vega-lite`, `postcss`, `manifest`, or chunk-load
errors in the terminal. The Turbopack cache has corrupted.

Recovery:

```bash
pnpm --filter @bossnyumba/marketing dev:clean
```

This wipes `.next/` and reboots on webpack (stable). If you were on
Turbopack, switch back manually with `dev:turbo` after the first clean
compile finishes.
