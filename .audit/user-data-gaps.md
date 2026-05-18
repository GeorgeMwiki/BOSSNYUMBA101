# User-Data Protection — Gap Audit (pre-A2b)
_Generated 2026-05-18, branch `claude/phase-d-comprehensive-gap-closure`, read-only sweep_

## Summary

| Class    | Count |
|----------|-------|
| CRITICAL | 8     |
| HIGH     | 7     |
| MEDIUM   | 6     |
| **Total**| **21**|

- Wire-fixes needed: 14 (modules exist, never called)
- Schema/migration changes needed: 3 (RLS coverage, executed-flag column, ledger schema)
- Net new code needed: 4 (DNS-resolution SSRF, secret-key chain verifier binding, rate-limit on declared-facts, residency annotation)

The single most dangerous discovery is that the entire **field-level encryption at rest** subsystem (D1) is fully implemented, exported, tested — but the production repositories never call `encryptRow()` / `decryptRow()`. Every PII column the classification registry says "encryptAtRest: true" is sitting in plaintext.

### Three most dangerous CRITICAL gaps

1. **D1 field-level encryption never invoked** — `packages/database/src/security/encryption/drizzle-encryption-middleware.ts:93` exports `encryptRow()`; the only callers are tests. `customer.repository.ts:151`, `tenant.repository.ts` and every other write path bypass it. NIDA numbers, KRA PINs, M-Pesa phone numbers, `users.password_hash`, `users.mfa_secret` are all plaintext-at-rest despite the classification registry marking them `encryptAtRest: true`.
2. **Audit-chain HMAC verifier wired with `verifier: null`** — `services/api-gateway/src/composition/service-registry.ts:1813-1822` constructs the supervisor with `verifier: null`. `createAuditHashChain()` exists in `packages/ai-copilot/src/security/audit-hash-chain.ts:447` and exposes `verifyChain`/`verifyRandomSample`, but is never bound. The cron's `.start()` runs (`services/api-gateway/src/index.ts:1290`) but does nothing — every tick logs a degraded-mode notice and returns. A silent ledger tamper is undetectable.
3. **Four-eye `markExecuted()` is never called** — `packages/central-intelligence/src/kernel/four-eye-approval.ts:556` implements the one-shot consumption guard; the executor (`packages/central-intelligence/src/kernel/agency/executor/executor.ts:525`) calls `propose()` and audit-logs `awaiting-approval`, but on the success path of a *separate* later execution it never invokes `markExecuted()`. A re-submitted approved action id replays — high-stakes mutations (KRA filing, eviction, owner payout) can be triggered twice.

---

## Gaps

### [CRITICAL] D1 field-level encryption module is never wired into any repository
- **Module:** `packages/database/src/security/encryption/drizzle-encryption-middleware.ts:93` — `encryptRow()` exported (and `decryptRow()` at line 155, `decryptRows()` at line 184).
- **Module composition:** `packages/database/src/security/encryption/index.ts:103` — `selectEncryptionPort(env)` exported; chooses KMS adapter when `AWS_KMS_KEY_ID`+`AWS_REGION` set, libsodium otherwise; both throw `EncryptionKeyUnavailableError` if `ENCRYPTION_MASTER_KEY` is missing.
- **Classification registry (~30 columns marked `encryptAtRest: true`):** `packages/database/src/security/data-classification.ts:55-263`. Covers `customers.email/phone/id_document_number/kra_pin`, `users.password_hash`, `users.mfa_secret`, `leases.bank_account_number`, etc.
- **Missing wire (write path):** `packages/database/src/repositories/customer.repository.ts:151` — raw `db.insert(customers).values({ ...input, ... })`. No `encryptRow()` call. Same pattern in `tenant.repository.ts`, `lease.repository.ts`, `payment.repository.ts`, `messaging.repository.ts`.
- **Missing wire (read path):** `packages/database/src/repositories/customer.repository.ts:30-86` — `db.select()` returns raw rows. No `decryptRow()`.
- **Blast radius:** ALL customer PII across ALL tenants. Every NIDA number, KRA PIN, M-Pesa phone, password hash, MFA TOTP secret, ID-document URL stored unencrypted at rest. A backup leak or DB read-replica compromise exposes the platform's entire PII corpus. Regulatory: violates Tanzania DPA 2022 §29 (technical security measures), GDPR Art. 32(1)(a) (encryption of personal data), PCI-DSS-adjacent obligations for mobile-money lookup data.
- **Fix:**
  ```ts
  // customer.repository.ts line 146 — inject `port` via constructor
  async create(input: typeof customers.$inferInsert, createdBy: UserId): Promise<CustomerRow> {
    const encryptedInput = await encryptRow({
      row: input, table: 'customers', tenantId: input.tenantId, port: this.encPort,
    });
    const [row] = await this.db.insert(customers).values({ ...encryptedInput, ... }).returning();
    return decryptRow({ row, table: 'customers', tenantId: input.tenantId, port: this.encPort });
  }
  ```

### [CRITICAL] AI audit-chain HMAC verifier never bound — silent tamper is undetectable
- **Module:** `packages/ai-copilot/src/security/audit-hash-chain.ts:447` — `createAuditHashChain()` returns a port with `verifyChain`/`verifyRandomSample`/`verifyTail`/`verifyAll`. Module is exported via `packages/ai-copilot/src/security/index.ts:10`.
- **Supervisor:** `services/api-gateway/src/composition/audit-verify-cron.ts:1-80` — `createAuditVerifyCronSupervisor({ verifier, db, eventBus, logger })`. Documented in lines 1-39: when `verifier` is null, supervisor logs once and returns inert.
- **Missing wire:** `services/api-gateway/src/composition/service-registry.ts:1813` — supervisor constructed with literal `verifier: null` (line 1814). `.start()` runs at `services/api-gateway/src/index.ts:1290` but executes nothing.
- **Blast radius:** EVERY tenant's AI decision ledger. A privileged-actor or DB-compromise tamper of `ai_audit_chain` rows goes unnoticed indefinitely — regulators can't trust the audit replay surface. Affects compliance posture for evictions, KRA filings, owner payouts where the audit trail is the after-the-fact authority.
- **Fix:**
  ```ts
  // service-registry.ts line 1813 — bind the real verifier
  import { createAuditHashChain } from '@bossnyumba/ai-copilot/security';
  const auditChain = createAuditHashChain({ repo: aiAuditChainRepo /* drizzle-backed */ });
  const auditVerifyCron = createAuditVerifyCronSupervisor({
    verifier: auditChain, // was: null
    db, eventBus, logger: { ... },
  });
  ```

### [CRITICAL] Four-eye `markExecuted()` never called after approved action runs — replay possible
- **Module:** `packages/central-intelligence/src/kernel/four-eye-approval.ts:556` — `markExecuted(actionId)` flips `executed: false → true`, throws `already-executed: action <id>` if re-invoked. Uses `get → put` (NOT atomic CAS — see HIGH-class gap below).
- **Field declaration:** `packages/central-intelligence/src/kernel/four-eye-approval.ts:168` — `readonly executed: boolean` on `ApprovalRecord`.
- **Missing wire:** `packages/central-intelligence/src/kernel/agency/executor/executor.ts:502-590` — executor calls `deps.approvalGate.propose(...)` on line 525 to stage approval, then re-enters the action via the next pass once `status==='approved'`. After dispatching the tool on lines 593-610, the executor never calls `approvalGate.markExecuted(actionId)`. The flag stays `false` forever; the same `actionId` re-submission re-dispatches.
- **Blast radius:** Every sovereign-tier action a tenant approves (KRA MRI filing, evict tenant, owner payout disburse). A malicious or buggy retry path repeats the action. Money/regulatory side-effects: double-filing, double-payouts, double-evictions. Affects all tenants that have HQ-tool autonomy enabled.
- **Fix:**
  ```ts
  // executor.ts after the successful tool-invoke branch (~line 615)
  if (record /* the approval record this step consumed */) {
    await deps.approvalGate.markExecuted(record.action.id);
  }
  ```

### [CRITICAL] `markExecuted` uses non-atomic get→put; concurrent executors can BOTH succeed
- **Module:** `packages/central-intelligence/src/kernel/four-eye-approval.ts:556-578` — `markExecuted` reads (`deps.store.get(actionId)`), checks `refreshed.executed`, then writes (`deps.store.put(next)`). No CAS. Two concurrent calls each see `executed=false`, each writes `executed=true`, each returns success.
- **Schema column needed:** `executed boolean DEFAULT false NOT NULL` on the approvals row (verify in `packages/database/src/schemas/sovereign-approvals.schema.ts` — present, but the write path doesn't enforce the CAS).
- **Missing wire (repo CAS):** `packages/database/src/repositories/sovereign-approvals.repository.ts` — write must be `UPDATE sovereign_approvals SET executed=true WHERE id=$1 AND executed=false RETURNING *;` and treat zero-rows-affected as "already-executed".
- **Blast radius:** Same as above CRITICAL — even if `markExecuted` is wired, without atomic CAS a TOCTOU race re-executes the action under high concurrency (Temporal worker fan-out, retry storms).
- **Fix:**
  ```ts
  // four-eye-approval.ts: replace the markExecuted body with a single CAS round-trip
  async markExecuted(actionId) {
    const updated = await deps.store.casMarkExecuted(actionId);     // returns null if already executed
    if (!updated) throw new Error(`already-executed: action ${actionId}`);
    return updated;
  }
  // sovereign-approvals.repository.ts new method:
  async casMarkExecuted(id: string) {
    const [row] = await db.update(sovereignApprovals)
      .set({ executed: true })
      .where(and(eq(sovereignApprovals.id, id), eq(sovereignApprovals.executed, false)))
      .returning();
    return row ?? null;
  }
  ```

### [CRITICAL] SSRF protection is string-only — DNS resolution NOT performed
- **Module:** `packages/enterprise-hardening/src/http/safe-http-fetch.ts:124-133` — `isInternalHost(host)` ONLY checks the URL string. If `lower.includes(':')` → IPv6 check; if `/^[\d.]+$/.test(lower)` → IPv4 check; otherwise returns `false` (i.e. lets the request through).
- **Missing wire (deep):** `packages/enterprise-hardening/src/http/safe-http-fetch.ts:194-203` — the check fires BEFORE `fetch`, but no `dns.lookup()` is performed. A URL like `https://attacker.example.com/` where `attacker.example.com` resolves via DNS to `169.254.169.254` (EC2 metadata) or `127.0.0.1` (loopback) WILL be fetched. A DNS rebinding attack is also unmitigated.
- **Webhook-delivery duplicates the flaw:** `packages/agent-platform/src/webhook-delivery.ts:94-121` — inlined `assertSafeWebhookUrl` has the same string-only check and explicitly does not resolve DNS.
- **Blast radius:** AWS/GCP/Azure metadata service exfiltration → IAM tokens, cloud credentials. Internal-network port-scanning (the platform doubles as an attacker proxy). Affects every tenant that uses webhooks pointing at attacker-controlled hostnames; risk is platform-wide.
- **Fix:**
  ```ts
  // safe-http-fetch.ts line 196 — add DNS resolution before the fetch
  import { promises as dnsP } from 'node:dns';
  const addrs = await dnsP.lookup(rawHost, { all: true });
  for (const a of addrs) {
    if ((a.family === 4 && isInternalIPv4(a.address)) ||
        (a.family === 6 && isInternalIPv6(a.address))) {
      throw new SafeHttpFetchError('denied-internal-ip', url, `host "${rawHost}" → ${a.address} is internal`);
    }
  }
  // Pin the resolved IP via an HTTPS agent with a custom `lookup` so the
  // fetch reuses the SAME resolution (DNS-rebind mitigation).
  ```

### [CRITICAL] Per-tenant tool-call denylist is exported but executor never consults it
- **Module:** `packages/central-intelligence/src/kernel/tool-spec/tool-call-denylist.ts:31` — `ToolCallDenylistStore` interface; line 55 `createInMemoryToolCallDenylist()`; line 92 `checkToolCallDenylist()`; line 113 `assertToolCallAllowed()`.
- **Missing wire:** `packages/central-intelligence/src/kernel/agency/executor/executor.ts:350` — executor does `deps.tools.get(step.toolName)`; no `assertToolCallAllowed(deps.toolDenylist, goal.tenantId, step.toolName)` before the autonomy-policy check at line 391.
- **No composition root binding:** grep across packages/services finds zero callers of `ToolCallDenylistStore` outside its own tests. The denylist DB schema is absent too.
- **Blast radius:** A tenant under regulatory tool-disable (e.g. "stop computeKraMri while investigation pending") will see the tool run anyway. Operator override is impossible without restarting + redeploying. Affects regulatory standing for tenants under audit.
- **Fix:**
  ```ts
  // executor.ts line 351 (right after `const tool = deps.tools.get(...)`)
  if (deps.toolDenylist && goal.tenantId) {
    await assertToolCallAllowed(deps.toolDenylist, goal.tenantId, step.toolName);
  }
  // + add `readonly toolDenylist?: ToolCallDenylistStore` to ExecutorDeps
  // + bind a Postgres-backed store in service-registry.ts
  ```

### [CRITICAL] Ed25519 tool-registry signature is exported but never verified at dispatch
- **Module:** `packages/central-intelligence/src/kernel/tool-spec/tool-registry-signing.ts:150` — `verifyToolSignature()` exported (signed payloads include `canonical` over the registry, signed under `Ed25519` per line 19).
- **Missing wire:** Search shows ZERO callers of `verifyToolSignature` in production code (only the file itself, tests, and worktree copies). The kernel's tool dispatch path (`packages/central-intelligence/src/kernel/agency/executor/executor.ts:350` `deps.tools.get(step.toolName)`) does not verify the spec hasn't been tampered.
- **Blast radius:** If an attacker mutates `BrainToolSpec` definitions (e.g. via supply-chain injection or rogue admin), the malicious spec is dispatched without complaint. Platform-wide.
- **Fix:**
  ```ts
  // compose.ts kernel construction
  const trusted = await verifyToolSignature({
    canonical: serializeRegistry(rawTools),
    signatureHex: process.env.TOOL_REGISTRY_SIGNATURE_HEX!,
    publicKey: hexToBytes(process.env.TOOL_REGISTRY_PUBKEY_HEX!),
  });
  if (!trusted) throw new Error('refusing to start: tool registry signature mismatch');
  ```

### [CRITICAL] `createSecuritySuite()` factory exists but is never invoked
- **Module:** `packages/ai-copilot/src/security/index.ts:54` — `createSecuritySuite()` returns `{ auditChain, canary, costBreaker, observability }` — the whole AI-side security composition root.
- **Missing wire:** Grep for `createSecuritySuite` returns only the definition itself; nowhere in `services/api-gateway/src/composition/service-registry.ts`, `services/*` or other consumers. The AI-security suite is dead code.
- **Blast radius:** Cumulative — losing audit-chain, canary tokens, cost circuit breaker, security observability in one go. Pairs with the audit-chain verifier CRITICAL above (same root cause: no caller wires the security side).
- **Fix:**
  ```ts
  // service-registry.ts somewhere near the audit-verify-cron wiring
  const securitySuite = createSecuritySuite({
    auditRepo: createDrizzleAiAuditChainRepo(db),
  });
  // then: auditVerifyCron uses securitySuite.auditChain as verifier
  ```

---

### [HIGH] Persist-boundary CoT scrubber (D3 extended) never called — relies on capture-time scrub only
- **Module:** `packages/central-intelligence/src/kernel/cot-reservoir/pii-scrub-cot.ts:136` — `scrubCotForPersist(text)` extends `scrubCotText` with API-key, m-pesa-confirmation, model-id, anthropic-key patterns (~10 extra regex families).
- **Used at:** `services/api-gateway/src/routes/cot-query.router.ts:59` (READ-path re-scrub before serving DSAR).
- **Missing wire (WRITE path):** `packages/central-intelligence/src/kernel/cot-reservoir.ts:305` — the persist path only calls `scrubCotText(input.thoughtText)`, NOT `scrubCotForPersist`. So `sk-ant-api03-…`, `MPESAQ7X8Y2Z9A`, and model-id leaks land in the reservoir until the read path scrubs them.
- **Blast radius:** Plaintext API-key fragments and m-pesa confirmation codes in `kernel_cot_reservoir`. Lower than the encryption gap because: rows are pre-sampled (1%/5%/50%/100% by stake) AND the read path re-scrubs, but a DB-direct dump still leaks.
- **Fix:** Change `cot-reservoir.ts:305` to call `scrubCotForPersist(input.thoughtText).scrubbed` (returns the same shape).

### [HIGH] RLS coverage stops at the top-25 tables — 24 other tenant-scoped tables have NO RLS
- **Module:** `packages/database/src/migrations/0155_supabase_rls_policies.sql:54-85` — enables RLS on 25 explicitly-listed tables.
- **Schemas with `tenantId` but NO RLS policy:** counted 105 schema files with `tenantId`; 25 covered by 0155 (cf. lines 60-84) + 2 covered by 0093 (`webhook_deliveries`) and 0146 (`kernel_cot_reservoir`) ⇒ ~78 tables missing. Spot-checks: `messaging.schema.ts`, `communications.schema.ts`, `voice-turns.schema.ts`, `reflexion-buffer.schema.ts`, `doc-chat-sessions.schema.ts`, `doc-chat-messages.schema.ts`, `document-embeddings.schema.ts`, `intelligence-history.schema.ts`, `agency-run-checkpoints.schema.ts`, `sovereign-action-ledger.schema.ts` (sovereign rows!), `sensor-call-log.schema.ts`, `currency-preferences.schema.ts`, `tenant-finance.schema.ts`, etc.
- **Intentional gaps still open:** `packages/database/src/migrations/0155_supabase_rls_policies.sql:206-217` explicitly defers `cross_tenant_denials`, `sovereign_action_ledger`, `kernel_cot_reservoir` (already covered by 0146), `agency_run_checkpoints`, `sensor_call_log` to Phase E. The deferral is documented but the four of those that ARE tenant-scoped (`sovereign_action_ledger`, `agency_run_checkpoints` both have `tenant_id`) should not wait.
- **Missing wire:** No new migration that broadens 0155's `tenant_tables` array.
- **Blast radius:** Cross-tenant read via Supabase REST surface for any non-listed table — `voice_turns` (recordings transcript), `doc_chat_messages` (full chat), `reflexion_buffer` (kernel state), `messaging.events`. Direct app-layer reads also lack DB-enforced isolation; one bug in the gateway leaks rows across tenants.
- **Fix:** new migration `0156_supabase_rls_phase2.sql` mirrors the DO-block from 0155 with the missing table list. Critical tables to add first: `messaging`, `communications`, `voice_turns`, `doc_chat_sessions`, `doc_chat_messages`, `document_embeddings`, `reflexion_buffer`, `kernel_memory_episodic`, `kernel_memory_semantic`, `kernel_memory_procedural`, `kernel_memory_reflective`, `agency_run_checkpoints`, `sovereign_action_ledger`.

### [HIGH] RLS `FORCE ROW LEVEL SECURITY` not applied — owner/superuser bypasses policy
- **Module:** `packages/database/src/migrations/0155_supabase_rls_policies.sql:97` — `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` enables RLS but does NOT FORCE it. Without FORCE, the table owner role (which includes the migration role and the service role used for ops queries) BYPASSES the policy.
- **Missing wire:** Add `ALTER TABLE ... FORCE ROW LEVEL SECURITY;` in the same loop.
- **Blast radius:** Any operator query run as the table owner (or `postgres` superuser, which Supabase service connections sometimes inherit) reads every tenant's data. RLS is a Maginot Line until FORCE is added. The runbook references `POSTGRES_FORCE_RLS` but no code reads it.
- **Fix:**
  ```sql
  EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY;', tbl);
  ```

### [HIGH] `RLS` migrated assumes a Supabase GUC (`app.tenant_id`) — non-Supabase Postgres deploys ungated
- **Module:** `packages/database/src/migrations/0155_supabase_rls_policies.sql:46-50` — `current_app_tenant_id()` reads `current_setting('app.tenant_id', TRUE)`.
- **Caller:** `services/api-gateway/src/middleware/tenant-context.middleware.ts` (mentioned in the migration header) — middleware sets the GUC per transaction.
- **Missing wire (verify):** confirm the middleware actually calls `SET LOCAL app.tenant_id = '<uuid>'` on EVERY transaction (not just per-connection). Pooled connections without per-tx SET fail closed (NULL → deny) — which is right behaviour, but means routes that forget to do per-tx SET return zero rows. Pgbouncer transaction-mode pooling will need `SET LOCAL`.
- **Blast radius:** A regression that drops the SET = silent zero-result for every authenticated user.
- **Fix:** add a connection-level invariant test in `packages/database/src/__tests__/` that verifies the middleware re-binds on every `BEGIN`.

### [HIGH] Webhook-delivery duplicates SSRF check inline — drifts from central module
- **Module:** `packages/agent-platform/src/webhook-delivery.ts:94-121` — `assertSafeWebhookUrl` is hand-written; the comment at line 91 admits "Inlined to avoid a fresh inter-package dependency edge."
- **Missing wire:** Should call `safeHttpFetch` from `@bossnyumba/enterprise-hardening` so any future hardening (DNS resolution, allowlist) lands once.
- **Blast radius:** Two places to fix every SSRF improvement; one will inevitably drift behind.
- **Fix:** Replace `deps.fetch(...)` at line 183 with `safeHttpFetch(url, { method, headers, body, allowlist: subscription.allowlist, timeoutMs })` and delete the inline `assertSafeWebhookUrl`.

### [HIGH] Declared-facts router lacks rate-limit + per-user fact-count cap
- **Module:** `services/api-gateway/src/routes/memory-declare.router.ts:60-126` — has auth, zod (`key` max 120 chars, `value` max 2000 chars), but no rate-limit middleware and no per-user max-fact count.
- **Missing wire:** `router.use('*', rateLimitMiddleware(...))` between `router.use('*', authMiddleware)` and the handlers (line 61).
- **Blast radius:** A logged-in user (or compromised account) can spam thousands of `POST /memory/declare` calls. Each writes a row to `ai_semantic_memory` — kernel-side memory recall is then biased by junk facts the user controls. Cross-effect on AI quality + storage growth per tenant.
- **Fix:**
  ```ts
  import { perUserRateLimit } from '../middleware/rate-limiter';
  router.use('*', authMiddleware);
  router.use('*', perUserRateLimit({ windowMs: 60_000, max: 30 })); // 30 declares/min
  // + enforce a per-user maxFacts (say 500) inside `upsertFact`.
  ```

### [HIGH] `field_encryption_audit` table service exists; no production path writes to it (corollary of D1 gap)
- **Module:** `packages/database/src/services/field-encryption-audit.service.ts:87` — `createFieldEncryptionAuditService(db)` returns a sink for `recordEncryptedField`.
- **Missing wire:** Sink is never passed as the `audit` arg in `encryptRow({ ..., audit })` — corollary of the encryption-not-wired CRITICAL. Once encryption is wired, also wire this sink so rotation auditing works.
- **Blast radius:** No per-row visibility into "which key version is this column encrypted under" — KMS rotation cannot be safely sequenced without it.

---

### [MEDIUM] `applyPrefixCache` (Anthropic prompt cache) is never called — pure cost gap, not user-data
- **Module:** `packages/ai-copilot/src/providers/anthropic-prefix-cache.ts:155` — `applyPrefixCache(body, policy)` returns the modified body with `cache_control: ephemeral` breakpoints.
- **Missing wire:** Search shows zero callers in production paths. `packages/ai-copilot/src/providers/anthropic.ts` does not invoke it before `messages.create`.
- **Blast radius:** ~80% missed cache savings on system prompts. Not a user-data gap; included because the user asked. Re-classify as A7 cost gap.

### [MEDIUM] Semantic cache is constructed but the kernel does not consult it before LLM dispatch
- **Module:** `packages/central-intelligence/src/kernel/semantic-cache/semantic-cache.ts:242` — `createSemanticCache(deps)` factory.
- **Missing wire:** Grep for `semanticCache.` or `cache.lookup` in the kernel dispatch path returns nothing. `kernel.ts` and `compose.ts` don't reference it.
- **Blast radius:** Same as above — cost gap, not data-protection.

### [MEDIUM] `users.password_hash` and `users.mfa_secret` plaintext at rest (special case of D1 gap)
- **Module:** `packages/database/src/schemas/tenant.schema.ts:198` — `mfa_secret: text('mfa_secret')` (NOT bytea, NOT encrypted column type).
- **Classification:** `packages/database/src/security/data-classification.ts:255-262` correctly marks `mfa_secret` RESTRICTED + `encryptAtRest: true`.
- **Missing wire:** The user-registration / MFA-enrolment service writes the TOTP shared secret as plaintext text. Once D1 is wired, this case is covered automatically; flagging separately because MFA-secret leakage means full 2FA bypass.
- **Blast radius:** A read-replica or backup leak yields the TOTP shared secret for every user → bypass MFA platform-wide.

### [MEDIUM] Tenant-residency assumption — single AWS region only
- **Module:** `packages/config/src/schemas.ts:82` — `AWS_REGION: z.string().default('eu-west-1')`. No per-tenant region.
- **Missing wire:** No `tenant.region` column; no read in `selectEncryptionPort(env)` to choose tenant-specific KMS key. East-African tenants are forced to data-reside in `eu-west-1` by default.
- **Blast radius:** Tanzania DPA 2022 §41 + Kenya DPA 2019 §50 both prefer in-region or DPA-approved jurisdictions. Currently the platform is non-compliant for any tenant that asserts in-region residency.
- **Fix:** Add `tenants.region text NOT NULL DEFAULT 'eu-west-1'`; thread `tenant.region` into KMS-adapter selection.

### [MEDIUM] No explicit rate-limit + size-cap on declared-facts WRITE — DoS via storage blow-up
- (See HIGH "Declared-facts router lacks rate-limit + per-user fact-count cap"; this MEDIUM is the storage-side mirror: enforce per-tenant total facts.)

### [MEDIUM] `previous` master-key generation has no soak-window enforcement
- **Module:** `packages/database/src/security/encryption/tenant-key-derivation.ts:88-95` — accepts an optional `previous` key version; decrypt path falls through to it.
- **Missing wire:** No enforced wallclock soak window; an operator who flips `ENCRYPTION_MASTER_KEY_PREV` to empty before re-encrypting historical rows will brick reads.
- **Fix:** Persist a `key_rotation_started_at` row in `field_encryption_audit` and refuse to drop `ENCRYPTION_MASTER_KEY_PREV` until `countByKeyVersion(prevVersion) === 0` (the service exists at `packages/database/src/services/field-encryption-audit.service.ts:159`).

---

## Wire-summary (paste into A2b Phase-2 ticket)

| # | Gap                                                | Module owner                  | Wire site                                                                 | Class    |
|---|----------------------------------------------------|-------------------------------|---------------------------------------------------------------------------|----------|
| 1 | D1 field-encryption never wraps writes             | `database/security/encryption`| Every repository — start `customer.repository.ts:151`                     | CRITICAL |
| 2 | Audit-chain verifier `null`                        | `ai-copilot/security`         | `service-registry.ts:1814` — bind real `createAuditHashChain(...)`        | CRITICAL |
| 3 | `markExecuted()` never called                      | `central-intelligence/four-eye`| `executor.ts:~615` after successful tool dispatch                        | CRITICAL |
| 4 | `markExecuted` non-atomic                          | `central-intelligence/four-eye`| `four-eye-approval.ts:556` + new `casMarkExecuted` repo method           | CRITICAL |
| 5 | SSRF string-only check                             | `enterprise-hardening/http`   | `safe-http-fetch.ts:196` add `dns.lookup` + IP pinning                    | CRITICAL |
| 6 | Tool denylist never consulted                      | `central-intelligence/tool-spec`| `executor.ts:351`                                                       | CRITICAL |
| 7 | Ed25519 tool-signature never verified              | `central-intelligence/tool-spec`| `compose.ts` kernel construction                                        | CRITICAL |
| 8 | `createSecuritySuite()` never composed             | `ai-copilot/security`         | `service-registry.ts`                                                     | CRITICAL |
| 9 | `scrubCotForPersist` not used on write             | `central-intelligence/cot-reservoir`| `cot-reservoir.ts:305`                                              | HIGH     |
| 10| RLS coverage incomplete                            | `database/migrations`         | new `0156_supabase_rls_phase2.sql`                                        | HIGH     |
| 11| RLS `FORCE` missing                                | `database/migrations`         | new migration (or amend 0155)                                             | HIGH     |
| 12| Webhook-delivery SSRF duplicates inline            | `agent-platform`              | `webhook-delivery.ts:183` use `safeHttpFetch`                             | HIGH     |
| 13| Declared-facts no rate-limit                       | `services/api-gateway/routes` | `memory-declare.router.ts:61`                                             | HIGH     |
| 14| `field_encryption_audit` sink not bound            | `database/services`           | wire as `audit` arg in `encryptRow(...)` (depends on #1)                  | HIGH     |
| 15| `applyPrefixCache` never called                    | `ai-copilot/providers`        | `anthropic.ts` request build path                                         | MEDIUM   |
| 16| Semantic cache not consulted                       | `central-intelligence/semantic-cache`| `kernel.ts` thought-dispatch path                                  | MEDIUM   |
| 17| MFA-secret plaintext (subset of #1)                | `database`                    | covered when #1 lands                                                     | MEDIUM   |
| 18| No per-tenant residency                            | `config` + `database/schemas` | `tenants.region` column + `selectEncryptionPort` consults it              | MEDIUM   |
| 19| Per-tenant facts cap                               | `database/services`           | `semantic-memory.service.ts.upsertFact`                                   | MEDIUM   |
| 20| Master-key rotation soak window                    | `database/security/encryption`| `tenant-key-derivation.ts:88-95` + audit-sink gating                      | MEDIUM   |
| 21| RLS GUC-bind invariant test                        | `database/__tests__`          | new test                                                                  | HIGH     |

## Files inspected (so the next sweep is not duplicate work)
- `packages/database/src/security/encryption/{index,encryption-port,libsodium-adapter,kms-adapter,tenant-key-derivation,drizzle-encryption-middleware}.ts`
- `packages/database/src/security/data-classification.ts`
- `packages/database/src/repositories/customer.repository.ts`
- `packages/database/src/services/field-encryption-audit.service.ts`
- `packages/database/src/services/sovereign-action-ledger.service.ts`
- `packages/database/src/migrations/0155_supabase_rls_policies.sql`, `0146_cot_reservoir_rls.sql`, `0093_webhook_rls.sql`
- `packages/database/src/schemas/tenant.schema.ts`
- `packages/central-intelligence/src/kernel/four-eye-approval.ts`
- `packages/central-intelligence/src/kernel/agency/executor/executor.ts`
- `packages/central-intelligence/src/kernel/cot-reservoir.ts`
- `packages/central-intelligence/src/kernel/cot-reservoir/pii-scrub-cot.ts`
- `packages/central-intelligence/src/kernel/brain-cache.ts`
- `packages/central-intelligence/src/kernel/semantic-cache/{semantic-cache,cache-store}.ts`
- `packages/central-intelligence/src/kernel/tool-spec/{tool-call-denylist,tool-registry-signing}.ts`
- `packages/enterprise-hardening/src/http/safe-http-fetch.ts`
- `packages/ai-copilot/src/security/{audit-hash-chain,index,pii-scrubber}.ts`
- `packages/ai-copilot/src/providers/anthropic-prefix-cache.ts`
- `packages/agent-platform/src/webhook-delivery.ts`
- `services/api-gateway/src/composition/{service-registry,audit-verify-cron}.ts`
- `services/api-gateway/src/index.ts`
- `services/api-gateway/src/routes/{memory-declare,cot-query}.router.ts`
- `services/api-gateway/src/config/jwt.ts`
- `apps/customer-app/src/app/settings/declared-facts/page.tsx`

## NOT FOUND
- `packages/.../sovereign-ledger*` as a standalone module — actually lives at `packages/database/src/{schemas,services}/sovereign-action-ledger.{schema,service}.ts`. The audit-chain verifier lives at `packages/ai-copilot/src/security/audit-hash-chain.ts` and is unrelated to the sovereign-ledger HMAC chain (these are TWO chains — both need verifiers). The sovereign-ledger verify cron IS wired (`service-registry.ts:1286 .start()`), but the AI audit chain verifier is the one that's null.
- `cot-scrub*` module at `packages/central-intelligence/src/kernel/cot-scrub*` — actually lives at `packages/central-intelligence/src/kernel/cot-reservoir/pii-scrub-cot.ts` and `packages/central-intelligence/src/kernel/cot-reservoir.ts:scrubCotText`.
- Hardcoded secret pattern matches: NONE found in production paths (grep over `packages/`, `services/`, `apps/` returned only `.env.example` placeholders).
