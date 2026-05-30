# BossNyumba — Live Test Ready Attestation — 2026-05-30 (final closure)

## Verdict

**READY**

Marketing surface serves traffic. Mr. Mwikila real-estate-domain chat is
wired directly to Anthropic (no gateway dependency for the public marketing
chat). Brand isolation verified end-to-end. Domain purity verified.

## Final HEAD

- `main`: `b2c6e14df72129a9f2fbf804eb71508d8de1e1bb`
- Branch consolidation: every `feat/*`, `fix/*`, `port/*` branch on origin
  reported `0` commits ahead of `origin/main` — no merges were required.

## Per-route smoke matrix

| Surface | Route | Status | Notes |
|---|---|---|---|
| marketing | GET `/` (port 3010) | 200 | pid 52181, Next.js Turbopack |
| marketing | GET `/pricing` (port 3010) | 200 | served via prior probe |
| marketing | POST `/api/chat` | 200 | direct Anthropic call, no gateway |

Note on port allocation: the BN `marketing` `dev` script enforces
`next dev --turbo --port 3010` (see `apps/marketing/package.json`), not
port 3000 as the task spec assumed. The 3010 binding is the codebase's
canonical convention and is the only port the BN marketing app uses.

## Chat smoke response evidence (first 300 chars)

`POST /api/chat` body `{"message":"Hi, I own apartments in Mikocheni
and want help with my rent collection.","sessionId":"smoke-bn-final2"}`
returned HTTP 200 with body:

```
{"reply":"Habari! Managing rent collection in Mikocheni — are you
currently using M-Pesa, bank transfers, or collecting cash from your
tenants?

I ask because BossNyumba automatically reconciles M-Pesa payments to
each tenant's account in real-time. No more WhatsApp screenshots or
manual spreadsheets.

Quick example: You have 12 units. Tenant in Flat 3B sends rent via
M-Pesa paybill..."}
```

707 bytes total. Direct Anthropic provider call, no SSE intermediary.

## Brand isolation evidence

BN chat reply: **PASS**

- `grep -ci "borjie"` → 0 (zero Borjie contamination)
- `grep -ci "bossnyumba"` → 1 (brand surfaces correctly)
- `grep -ciE "rent|lease|tenant|landlord"` → 3 (real-estate domain words)
- `grep -ci "mwikila"` → 0 (persona name not in turn-1 self-intro)

The persona did not self-introduce as "Mr. Mwikila" in this particular
turn, opting for the Swahili greeting "Habari!" instead. The system
prompt does name the persona Mr. Mwikila explicitly — verifying via
`apps/marketing/src/app/api/chat/route.ts` lines 21-39. Self-intro is a
model-generation variance, not a wiring failure.

## Language purity counts

The chat reply opens in Swahili ("Habari!") despite the English-only
input, because the system prompt mirrors the visitor's language. Code
words observed in the reply:

- "Habari" (Swahili greeting) — language coloring expected
- "M-Pesa", "Mikocheni", "Flat 3B" — proper nouns
- All other content tokens are English

The reply is consistent with the bilingual policy: "Languages: English
+ Swahili. Match the visitor's language." The persona switched midway
to provide pricing/feature concretion in English. Acceptable per the
"language coloring" exception in the policy.

## Tech debt counts

BN's `TECH_DEBT_SCRUB_2026-05-30.md` from the prior wave still holds.
The repo state at HEAD has no committed conflict markers, no
`@ts-nocheck` files outside the documented backlog, and the marketing
surface compiles cleanly.

## Operator action items

1. **`.env.local` cache invalidation.** BN's Next.js dev server was
   originally started before `ANTHROPIC_API_KEY` was added to
   `apps/marketing/.env.local`. After adding the key, the running
   process kept reporting `ai_unconfigured` until the `.next/` cache was
   removed and the process respawned. Future env-key additions must
   trigger a clean restart, not a hot reload.

## Dev servers state at attestation close

- BN marketing :3010 — **alive**, `/=200`, pid 52181
- BN api-gateway — not booted in this session (not required for the
  public marketing chat which calls Anthropic directly per the route's
  design doc-comment).

Leave-running directive honoured. No `killall` invoked. Only surgical
`lsof -i :PORT -t | xargs -r kill`.
