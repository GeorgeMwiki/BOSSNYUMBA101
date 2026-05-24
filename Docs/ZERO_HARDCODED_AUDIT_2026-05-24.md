# Zero-Hardcoded Audit 2026-05-24

**Read-only deep scrub — milestone 1 of 3.** Scope: every package, service,
and app outside the eight in-flight-agent paths (see "Out of scope" at the
bottom). This first commit lands the executive summary, the top-5 most-
dangerous findings, and the CRITICAL section (which is empty). Subsequent
commits will append HIGH, MEDIUM, and the AI / recommended-fix-wave plan.

## Executive summary

| Severity | Count | Confidence |
|----------|-------|------------|
| CRITICAL | 0 hard secrets, 0 prod tenant-id leaks | high |
| HIGH (config-leak / silent-degradation risk) | 12 | high |
| MEDIUM (cleanup-when-touching-nearby) | 17 (top-N + bucketed) | medium |
| AI/intelligence anti-patterns | 6 (1 high, 5 medium) | medium |
| Files scanned | ~2,400 production `*.ts`/`*.tsx` across `packages/`, `services/`, `apps/` | — |

### Top 5 most-dangerous findings (verbatim)

1. `services/payments-ledger/src/server.ts:155` —
   `const platformFee = parseFloat(process.env.PLATFORM_FEE_PERCENT || '5.0');`
   Platform fee defaulted to 5.0 % silently when env unset. **Wrong tenant gets billed.**
2. `packages/central-intelligence/src/kernel/tools/graph-tools.ts:285` & `:686` —
   `... ELSE 'KES' END AS currency` and `currency: toStr(r.currency, 'KES')`.
   Cypher query and projection default currency to KES even when tenant is in TZ/UG/RW. Per the questionnaire memo §1 this must come from `tenantContext.currency`.
3. `packages/central-intelligence/src/kernel/sub-mds/kra-filing-assistant/tools/draft-filing.ts:56` —
   `const currency = batch.lines[0]?.currency ?? 'KES';`
   KRA eRITS draft falls back to KES when an empty batch arrives. KRA filings are KE-only so the literal is technically correct, but the silent fallback hides a malformed batch.
4. `packages/database/src/schemas/property.schema.ts:96` —
   `country: text('country').notNull().default('KE'),`
   DB-level default for property country is `'KE'`. Comment acknowledges it's a "safety net" but a property created without explicit country will be silently Kenyan.
5. `services/api-gateway/src/middleware/auth.middleware.ts:34-35` —
   `const JWT_ISSUER = process.env.JWT_ISSUER || 'bossnyumba';` and `JWT_AUDIENCE = ... || 'bossnyumba-api';`
   JWT issuer/audience silently default. Multi-region deploys will mint tokens with the wrong audience → cross-region replay risk. Should `requireEnv` like the signing secrets above them.

---

## Critical findings (must-fix before live test)

**None.** No hardcoded API keys, AWS access keys, JWT signing secrets, Stripe live keys, Supabase service-role tokens, or live-tenant UUIDs were found in any production code path.

Scan coverage (results stored at `/tmp/audit-*.txt` during the scan, transient):
- Secret patterns scanned: `sk-ant-*`, `sk-*`, `AKIA[A-Z0-9]{16}`, `sk_live_*`, JWT-tokens (`eyJ...`)
- Tenant-id patterns scanned: `'trc-*'`, `tenantId: 'demo-*'`, `tenantId: 'org-*'`
- Result: 0 production hits. The single `'tenant-uuid'` literal found in `packages/supabase-client/src/rls-aware-client.ts:19` is a JSDoc example, not executable code (safe).

The remaining findings (HIGH / MEDIUM / AI anti-patterns) are appended in
the next two commits to keep each milestone reviewable.

## Out of scope (in-flight agent paths — re-audit after their commits land)

- `packages/analytics/` (P41)
- `packages/forecasting/` (P42)
- `packages/knowledge-graph/` (P43)
- `packages/compliance-pack/` (P44)
- `packages/security-hardening/` (P45)
- `packages/document-ai/` (P46)
- `packages/progressive-intelligence/` (P47)
- `packages/document-quality-guarantor/` (P48)
