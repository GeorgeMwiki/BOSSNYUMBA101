# BOSSNYUMBA Environment Configuration

**This repo is BOSSNYUMBA only. Pongezi is a separate project.**

This project uses a **production-ready env template** for **Boss Nyumba only** (no other projects). Set keys for AI, voice, payments, and notifications with **no hardcoded secrets or defaults** in code.

## Quick start

```bash
cp .env.example .env
# Edit .env and set all [REQUIRED] and [IMPORTANT] values for your environment.
```

**Never commit `.env`** — it is gitignored.

## Where the template came from

- **Root `.env.example`** includes every key used across the **Boss Nyumba** monorepo:
  - **AI**: Anthropic (Claude), OpenAI, DeepSeek, ElevenLabs, Hume, Azure, Google
  - **Auth**: JWT (access + refresh), Clerk, API keys
  - **Payments**: M-Pesa, Stripe, Flutterwave, bank transfer (env-only display)
  - **Notifications**: Africa’s Talking, Twilio, SendGrid, Resend, WhatsApp Business
  - **Infra**: Postgres, Neo4j, Redis/Upstash, S3, Sentry, feature flags

All values in `.env.example` are **placeholders**. Use your own keys and secrets.

## Production checklist

1. **Copy and fill**
   - `cp .env.example .env` and set every variable you use. **No hardcoded URLs or secrets in production.**
2. **Required in production**
   - `DATABASE_URL` — PostgreSQL connection string (migrations, seed, API).
   - `REDIS_URL` — Redis for BullMQ (notifications, reports). No localhost fallback in production.
   - `API_URL` and `FRONTEND_URL` — API gateway and frontend base URLs (used by `@bossnyumba/config`).
   - `NEXT_PUBLIC_API_URL` — Set in each Next.js frontend app (marketing, admin-platform-portal) to your API base. The Vite owner-portal uses `VITE_API_URL`; the Expo mobile apps (tenant-mobile, staff-mobile) use `EXPO_PUBLIC_API_GATEWAY_URL`.
3. **Secrets**
   - Generate strong `JWT_SECRET` and `JWT_REFRESH_SECRET` (e.g. `openssl rand -base64 64`).
   - Set `ENCRYPTION_MASTER_KEY` (and optional previous key for rotation).
4. **Support (customer-facing)**
   - `NEXT_PUBLIC_SUPPORT_PHONE`, `NEXT_PUBLIC_SUPPORT_WHATSAPP`, `NEXT_PUBLIC_SUPPORT_EMAIL` — no hardcoded fallbacks.
   - Optional: `NEXT_PUBLIC_EMERGENCY_PRIMARY_PHONE`, `NEXT_PUBLIC_EMERGENCY_MAINTENANCE_PHONE`, `NEXT_PUBLIC_EMERGENCY_SECURITY_PHONE` for support page.
5. **AI**
   - Set at least one of: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or `DEEPSEEK_API_KEY` (and optional `AI_PROVIDER`) for full intelligence.
6. **Per-app**
   - Owner-portal (`VITE_*`), Marketing + Admin-platform-portal (`NEXT_PUBLIC_*`), and the Expo mobile apps (`EXPO_PUBLIC_*`) URLs should match your deployed URLs.

## App-specific examples

- **apps/owner-portal** (Vite): see `apps/owner-portal/.env.example` if present; uses `VITE_*` vars (`VITE_API_URL`). Root `.env` is often used via the Vite proxy.
- **apps/marketing**, **apps/admin-platform-portal** (Next.js): need `NEXT_PUBLIC_API_URL` and the relevant `NEXT_PUBLIC_*` keys (Supabase, Sentry, support contacts) where applicable.
- **apps/tenant-mobile**, **apps/staff-mobile** (Expo): need `EXPO_PUBLIC_API_GATEWAY_URL`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, and support-contact keys where applicable.

## Africa’s Talking

The notifications service reads **either** `AFRICAS_TALKING_*` **or** `AT_*`. Prefer `AFRICAS_TALKING_API_KEY`, `AFRICAS_TALKING_USERNAME`, `AFRICAS_TALKING_SENDER_ID`, and `AFRICAS_TALKING_ENVIRONMENT` for consistency.

## M-Pesa

Both naming styles are supported so one value can be used for both:

- `MPESA_SHORTCODE` / `MPESA_SHORT_CODE`
- `MPESA_PASSKEY` / `MPESA_PASS_KEY`

Set one of each pair in `.env`.

## E2E / Full live demo tests

Playwright reads target URLs from the environment so **no URLs are hardcoded** in tests:

- `OWNER_PORTAL_URL` — owner portal (default `http://localhost:3000`).
- `ADMIN_PORTAL_URL` — admin platform portal (default `http://localhost:3020`).

(The tenant/workforce surfaces are now Expo mobile — `tenant-mobile`, `staff-mobile` — exercised by their own native test runners, not these web Playwright projects.)

For **local** runs, leave these unset and Playwright uses default `localhost` ports. For **CI or production demo**, set all of them (e.g. in CI env or source `e2e/.env`). See `e2e/.env.example`. Optional **demo credentials** (no hardcoded creds in prod): `E2E_TEST_OWNER_EMAIL`, `E2E_TEST_OWNER_PASSWORD`, `E2E_TEST_ADMIN_EMAIL`, `E2E_TEST_ADMIN_PASSWORD`, `E2E_TEST_MANAGER_EMAIL`, `E2E_TEST_MANAGER_PASSWORD`, `E2E_TEST_CUSTOMER_PHONE`, `E2E_TEST_OTP_CODE` — when set, E2E fixtures use these instead of defaults.

```bash
# Example: run E2E against deployed apps
export OWNER_PORTAL_URL=https://owners.yoursite.com
export ADMIN_PORTAL_URL=https://admin.yoursite.com
pnpm run test:e2e

# Smoke / live demo only (one spec, all projects)
pnpm run test:e2e:demo
```

## Mobile apps (Expo — tenant-mobile, staff-mobile)

The mobile surfaces are Expo/React Native. They read public config from
`EXPO_PUBLIC_*` env vars (inlined at bundle time — never put secrets here):

```bash
# Point a mobile app at your API gateway + Supabase project
export EXPO_PUBLIC_API_GATEWAY_URL=https://api.yoursite.com
export EXPO_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
export EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
pnpm --filter @bossnyumba/tenant-mobile start   # or @bossnyumba/staff-mobile
```

For local development, leave these unset and the app falls back to its
`localhost` defaults. Because `EXPO_PUBLIC_*` values ship inside the client
bundle, only browser-safe values (gateway URL, Supabase anon key) belong here.
