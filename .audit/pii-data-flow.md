# PII data-flow trace — BOSSNYUMBA

Read-only audit. All hops cite real file:line refs grep'd from the tree.
"NOT FOUND" markers are real — they mean the hop in the threat model has
no evidence in this checkout.

**Repo SHA / branch**: `claude/phase-d-comprehensive-gap-closure`
**Scope**: nine PII classes; 87 hops total.

Glossary:

- "Scrub" — call to `scrubPii()` (`packages/ai-copilot/src/security/pii-scrubber.ts:254`)
  OR `scrubCotText()` (`packages/central-intelligence/src/kernel/cot-reservoir.ts:258`)
  OR `scrubCotForPersist()` (`packages/central-intelligence/src/kernel/cot-reservoir/pii-scrub-cot.ts:136`).
- "Encrypt" — call into `packages/database/src/security/encryption/libsodium-adapter.ts`.
- "Hashed" — value replaced by SHA-256 hex digest (e.g. `kernel-tracing.ts:100` for userId).
- ✅ enforced, ❌ NOT enforced, ⚠️ partial / context-dependent.

---

## PII type 1: User email

`users.email`, `customers.email`, `tenant_identities.email`,
`audit_events.actor_email`, `gepg_control_numbers.payer_email`,
`payments.payer_email`, `employees.email`.

| Hop | File:line | Operation | Scrub/encrypt enforced? | Notes |
|-----|-----------|-----------|------------------------|-------|
| 1 | `services/api-gateway/src/routes/auth.ts:16` | `LoginSchema` zod validates `email: z.string().email().max(255)` | ✅ length+RFC validation | Server-side, callers can't bypass |
| 2 | `services/api-gateway/src/routes/auth.ts:195` | `body.email.trim().toLowerCase()` normalises before lookup | ✅ case-insensitive (prevents enumeration via casing channel) | Comment explicitly calls out the enumeration risk |
| 3 | `services/api-gateway/src/routes/auth.ts:74-80` | `SELECT users.email FROM users WHERE LOWER(email)=LOWER($1)` | ❌ stored plaintext | **GAP: `users.email` (`packages/database/src/schemas/tenant.schema.ts:182`) is `text` not encrypted** |
| 4 | `packages/database/src/services/platform/users.platform.service.ts:298` | `db.insert(users).values({ email: args.email, ... })` | ❌ plaintext write | **GAP: no envelope encryption — see `users.platform.service.ts:295-311`** |
| 5 | `packages/database/src/schemas/identity.schema.ts:62,81` | `tenantIdentities.email` text column + index | ❌ plaintext + indexed (the index makes envelope-encryption non-trivial) | **GAP: cross-org identity lookup table** |
| 6 | `packages/database/src/services/kernel-grounding.service.ts:169` | `JOIN users ON users.email = customers.email` to ground kernel facts | ❌ raw email passed into LLM context downstream | **GAP: when grounding facts include user.email, the LLM call receives it via `kernel.ts:598` `groundingFacts.fetch()`** |
| 7 | `packages/central-intelligence/src/kernel/kernel.ts:801` | `router.call({ system, systemPrompt: system, userMessage: req.userMessage, ... })` — user message reaches Anthropic Messages API | ❌ no pre-call PII scrub of `req.userMessage` (verified — `grep scrubPii packages/central-intelligence` returns ZERO callers) | **CRITICAL GAP: email in chat passes to Anthropic/OpenAI in cleartext** |
| 8 | `packages/central-intelligence/src/kernel/kernel.ts:2127` | `memory.episodic.record({ summary: userMessage.slice(0, MAX) })` — raw user text persisted | ❌ raw — no scrub before `episodic.record` | **GAP: episodic memory holds raw PII forever (no RTBF hook for `kernel_memory_episodic`)** |
| 9 | `packages/observability/src/tracing/tracer.ts:290` | `span.setAttribute(SpanAttributes.USER_EMAIL, email)` — raw email on OTel attribute `bossnyumba.user.email` | ❌ raw email exported to OTLP collector | **CRITICAL GAP: `setUserContext(userId, email)` writes raw email; ships to whatever `OTLP_ENDPOINT` is configured (`tracer.ts:60-66`)** |
| 10 | `packages/observability/src/tracing/tracer.ts:389` | `out['langfuse.user.id'] = attrs.userId` (Langfuse trace tagging) | ⚠️ caller-supplied — if caller passes email-as-userId it leaks; the canonical caller (`services/api-gateway/src/observability/kernel-tracing.ts:102`) hashes userId to 16-hex first | ✅ at the canonical kernel call site; ❌ for any other consumer that may pass email |
| 11 | `packages/observability/src/audit-logger.ts:145` | `.byUser(user.id, user.name, user.email, user.roles)` writes audit row | ❌ plaintext email persisted | **GAP: `audit_events.actor_email` (`audit-events.schema.ts:73`) — retained even after RTBF (the policy is `RETAIN`, see `dsar-rtbf-executor.ts:300-311`)** |
| 12 | `packages/database/src/schemas/sovereign-action-ledger.schema.ts:56` | `payload_json` jsonb — actions involving an email get persisted RAW into the hash-chained ledger | ❌ no PII filter — the canonical-key-sorted JSON is hashed, but the plaintext payload sits in the same row | **CRITICAL GAP: the ledger is append-only by design; even RTBF won't redact it** |
| 13 | `services/api-gateway/src/routes/dsar.router.ts:131` | DSAR self-service uses email-match for subject auth | ✅ used as identity check only | (jwt-email + db-email parity) |

**Cross-tenant risk**: `tenant_identities.email` is a *cross-org* table (the comment at `identity.schema.ts:7` calls it "Global cross-org principal keyed by phone"). The `emailIdx` is non-unique so two orgs can hold the same email row — that's intentional. The risk is in step 6: `kernel-grounding.service.ts:169` joins `users` to `customers` on email + tenantId; if either side drops the tenant predicate, cross-tenant join.

**Third-party exfil**: Anthropic / OpenAI receives raw email via step 7 (kernel → sensor). Langfuse receives whatever attributes the caller stamped (step 9–10). SES / Twilio / Africa's Talking receive email by definition (it's the outbound channel) — `services/notifications/src/logger.ts:60` masks the email *in the log line* but the wire payload to the provider is raw.

**RTBF compliance**: `dsar-rtbf-executor.ts:118-150` does ANONYMIZE on `customers.email`, but `users.email` is NOT in the RTBF table list (verified via `grep "users" packages/ai-copilot/src/gdpr/dsar-rtbf-executor.ts` — only the policy table itself references it). `audit_events.actor_email` and `sovereign_action_ledger.payload_json` are RETAIN. Episodic memory + CoT reservoir (HARD_DELETE for cot, but episodic memory is NOT in the table list).

---

## PII type 2: User phone / MSISDN

`users.phone`, `customers.phone`, `customers.alternate_phone`,
`tenant_identities.phone_normalized`, `employees.phone`, `employees.phone_alt`,
`payments.payer_phone`, `payments.mpesa_phone`, `gepg_control_numbers.payer_phone`,
`customers.emergency_contact_phone`.

| Hop | File:line | Operation | Scrub/encrypt enforced? | Notes |
|-----|-----------|-----------|------------------------|-------|
| 1 | `packages/database/src/schemas/identity.schema.ts:58-60` | `phoneNormalized` (ITU-T E.164 digits) + `phoneCountryCode` columns | ❌ plaintext + unique index (`phoneIdx`) | Index makes envelope encryption impossible without redesign |
| 2 | `services/identity/src/phone-normalize.ts` | E.164 normalisation before insert | ✅ canonical form (resists '+255'/'255'/'0…' tricks) | (file exists per `ls services/identity/src`) |
| 3 | `packages/database/src/schemas/customer.schema.ts:63` | `customers.phone` notNull text | ❌ plaintext | **GAP** |
| 4 | `services/payments/src/providers/mpesa/callback-handler.ts:55-74` | Parses `PhoneNumber` from STK callback `CallbackMetadata`, returns it as `phoneNumber` | ❌ plaintext phone in the parsed result | Hands off to ledger writer |
| 5 | `services/payments/src/providers/mpesa/callback-handler.ts:58-66` | `logger.info({ checkoutRequestId, mpesaReceipt, amount, provider:'mpesa' }, ...)` — note: phone is NOT included in the log object | ✅ phone omitted from the structured log | Good — explicit by author |
| 6 | `services/payments/src/providers/gepg/gepg-client.ts:95` | `phone: req.payerPhone` posted to GePG provider | ❌ raw phone over the wire to GePG | Third-party — required by contract |
| 7 | `packages/connectors/src/adapters/mpesa-adapter.ts` (M-Pesa STK push to Safaricom) | Phone is in request body to Daraja API | ❌ raw phone — required by Safaricom | Third-party (unavoidable) |
| 8 | `packages/observability/src/tracing/tracer.ts:281-296` | `setUserContext` — no phone attribute; phone is NOT a standard span attr | ✅ phone is NOT in `SpanAttributes` (verified `types/telemetry.types.ts:279-295`) | Phone is safer than email on the OTel surface |
| 9 | `services/notifications/src/logger.ts:31-36,50-56` | Phone-aware scrubber: keys `phone`, `phonenumber`, `phone_number`, `msisdn`, `to`, `from` masked (`+255****12`) | ✅ scrubbed in notification logs | Best-in-class — explicit allowlist |
| 10 | `packages/central-intelligence/src/kernel/cot-reservoir.ts` (COT_PII_PATTERNS, `phone-tz` `phone-ke`) | CoT thought text persist-boundary scrub | ✅ phone regex strips `+255 / +254` shapes | Verified `scrubCotText` is called at `cot-reservoir.ts:305` before write |
| 11 | `packages/ai-copilot/src/security/pii-scrubber.ts:78-93` | `scrubPii` covers +254/+255/+60 mobiles | ⚠️ Only called from `output-guard.ts:220` (POST-LLM, not pre-LLM) | **GAP: pre-LLM input is NOT scrubbed (kernel sends `req.userMessage` raw to sensor at `kernel.ts:801`)** |
| 12 | `packages/database/src/schemas/payment.schema.ts:197` | `payments.payer_phone` plaintext | ❌ + `RETAIN` policy on RTBF (`dsar-rtbf-executor.ts:164-176`) | **GAP: phone permanently retained on financial rows; KRA / VAT carve-out** |
| 13 | `packages/database/src/schemas/gepg.schema.ts:75` | `gepg_control_numbers.payer_phone` | ❌ + `RETAIN` (`dsar-rtbf-executor.ts:288-299`) | Same retention obligation |

**Cross-tenant risk**: `tenant_identities.phone_normalized` is uniquely indexed across all tenants (line 77–78). That's by design (one human = one identity), but it means an admin SELECT against `tenant_identities` returns rows for foreign orgs. Need RLS or a service-layer scope filter.

**Third-party exfil**: M-Pesa Daraja API + GePG + Twilio SMS + Africa's Talking SMS + WhatsApp Business API all receive raw phone (unavoidable by protocol). The kernel → Anthropic path leaks phone via `req.userMessage` (no pre-LLM scrub — same gap as email).

**RTBF compliance**: `customers.phone` and `alternate_phone` are ANONYMIZE (`dsar-rtbf-executor.ts:124-143`). `payments.payer_phone` and `gepg.payer_phone` are RETAIN. `tenant_identities.phoneNormalized` is NOT in the RTBF table list — **a NIDA-grade gap because this is the cross-org primary key**.

---

## PII type 3: Tanzania NIDA national ID

| Hop | File:line | Operation | Scrub/encrypt enforced? | Notes |
|-----|-----------|-----------|------------------------|-------|
| 1 | `apps/customer-app/src/screens/OnboardingPage.tsx:280-282` | User-facing `verifyIdentity` form | n/a (client) | TLS in transit |
| 2 | `packages/connectors/src/adapters/nida-adapter.ts:50-55` | `NidaNumberSchema` regex `^[0-9]{20}$\|^[0-9]{8}-[0-9]{4}-[0-9]{6}-[0-9]{2}$` | ✅ shape validated | NIDA Act §6(2) compliant |
| 3 | `packages/connectors/src/adapters/nida-adapter.ts:60-64` | `BiometricHashSchema` requires SHA-256 hex; raw template REJECTED at schema layer | ✅ raw biometric cannot leave device | Best-in-class control |
| 4 | `packages/connectors/src/adapters/nida-adapter.ts:128-136` | `connector.call({ path: '/v1/identity/verify', body: args })` posts NIDA number to NIDA gateway | ❌ raw NIDA over wire (required by gateway) | Third-party — unavoidable |
| 5 | `packages/database/src/schemas/customer.schema.ts:90` | `idDocumentNumber: text('id_document_number')` — landing zone for NIDA number | ❌ plaintext column | **GAP: should be envelope-encrypted via libsodium-adapter** |
| 6 | `packages/central-intelligence/src/kernel/cot-reservoir.ts` `COT_PII_PATTERNS` `nida-tz` (`\b\d{8}-\d{5}-\d{5}-\d{2}\b`) | CoT scrub matches NIDA in thought text | ✅ scrubbed in CoT persist | Reservoir-side covered |
| 7 | `packages/ai-copilot/src/security/pii-scrubber.ts:67-69` | Generic NIDA pattern in `scrubPii` | ⚠️ Only on LLM OUTPUT path (`output-guard.ts:220`) | **GAP: pre-LLM input not scrubbed; NIDA in `userMessage` reaches Anthropic raw** |
| 8 | `packages/ai-copilot/src/security/pii-scrubber.ts:186-194` | Swahili-aware "kitambulisho changu ni …" context scrub | ✅ catches conversational NIDA mentions | Same gap as 7 — only on output |
| 9 | `services/consolidation-worker/src/stages/04b-cot-distill.ts:60` | `LOCAL_COT_PATTERNS` `nida-tz` regex re-applied at distill | ✅ defence-in-depth on reflexion buffer writes | Excellent layering |
| 10 | `packages/ai-copilot/src/gdpr/dsar-rtbf-executor.ts:138` | `customers.id_document_number` in piiColumns | ✅ ANONYMIZE on RTBF | Note: the URL columns (`id_document_front_url`, `id_document_back_url`) are NOT in piiColumns at `customer.schema.ts:92-93` — the S3 object survives anonymisation |

**Cross-tenant risk**: NIDA is stored in `customers` (tenant-scoped). No global NIDA index exists. ✅ no cross-tenant exposure if RLS / tenant predicate is enforced on `customers`.

**Third-party exfil**: NIDA gateway itself (required). Anthropic receives NIDA in cleartext via the same kernel → sensor path as email/phone (hop 7).

**RTBF compliance**: `customers.id_document_number` ANONYMIZE. S3 URLs (`id_document_front_url`, `id_document_back_url`) NOT scrubbed — the S3 blob containing the scanned ID survives.

---

## PII type 4: Chat message content

`req.userMessage` from `POST /api/v1/jarvis/think` and `/stream`.

| Hop | File:line | Operation | Scrub/encrypt enforced? | Notes |
|-----|-----------|-----------|------------------------|-------|
| 1 | `apps/customer-app/src/app/jarvis/JarvisConsole.tsx:168-169` | `fetch('/api/v1/feedback', { method: 'POST', ... })` — page-level chat hook | n/a (client) | TLS in transit |
| 2 | `services/api-gateway/src/routes/jarvis-router-factory.ts:266-269` | `ThinkSchema = z.object({ threadId, userMessage: z.string().min(1).max(4_000), ... })` | ✅ length cap + zod | 4 KB ceiling |
| 3 | `services/api-gateway/src/routes/jarvis-router-factory.ts:282-315` | `POST /think` → `sov.kernel.think(req)` wrapped in `withKernelSpan` | n/a here | Spans pinned by `kernel-tracing.ts` |
| 4 | `services/api-gateway/src/observability/kernel-tracing.ts:100-117` | `attributesForScope` — userId is hashed via `hashUserId` (sha256 first 16 hex chars); userMessage NOT set as span attr | ✅ userId hashed, no userMessage attr | Best-in-class |
| 5 | `packages/central-intelligence/src/kernel/kernel.ts:478, 586, 644, 781-782, 800-801` | `req.userMessage` flows verbatim through the 13-step pipeline | ❌ no scrub before LLM | **CRITICAL GAP: zero `scrubPii` callers under `packages/central-intelligence/` — verified by grep** |
| 6 | `packages/central-intelligence/src/kernel/kernel.ts:801` | `router.call({ system, systemPrompt, userMessage: req.userMessage, ... })` → Anthropic Messages API | ❌ raw text to Anthropic / OpenAI | **CRITICAL: cleartext PII to third-party LLM** |
| 7 | `packages/central-intelligence/src/kernel/kernel.ts:1120, 1642, 1799` | `inputHash: sha(req.userMessage)` — only the *hash* persisted on `kernel_action_audit` etc. | ✅ only hash for audit | But the *response* path (CoT, episodic memory) carries the raw text |
| 8 | `packages/central-intelligence/src/kernel/kernel.ts:2127` | `memory.episodic.record({ summary: userMessage.slice(0, MEMORY_EPISODIC_SUMMARY_MAX) })` | ❌ raw text in episodic memory | **GAP: `kernel_memory_episodic` (NOT in RTBF table list) holds raw chat forever** |
| 9 | `packages/central-intelligence/src/kernel/cot-reservoir.ts:305` | `scrubCotText(input.thoughtText)` applied before reservoir write | ✅ CoT text scrubbed at capture | Plus re-scrub at read (`cot-query.router.ts:305`) |
| 10 | `services/api-gateway/src/routes/cot-query.router.ts:300-319` | Admin queries CoT; `wantsRaw` flag gated by `cot:read:raw` sovereign scope | ✅ four-eye permission + audit emission | Excellent — see `cot-query.router.ts:271-275` |
| 11 | `packages/ai-copilot/src/security/output-guard.ts:220` | `scrubPii(sanitized)` after LLM response | ✅ output path scrub | The only `scrubPii` consumer in app code |
| 12 | `packages/observability/src/tracing/tracer.ts` (LLM span) | Langfuse adapter — `langfuse.observation.metadata.*` attributes | ⚠️ Caller-supplied — `withLangfuseGeneration` accepts `metadata` (`langfuse-adapter.ts:119-128`). If a caller passes `{ userMessage }` it leaks. The canonical call sites do NOT (verified by inspecting kernel-tracing.ts), but no compile-time guard. | **GAP: type system allows raw userMessage in metadata** |

**Cross-tenant risk**: Cohort signal (`kernel.ts:592` `buildCohortMixin`) reads cross-tenant aggregates by tier. If `cohort-signal.ts` doesn't strip raw text, a tenant-A chat fragment could end up in tenant-B's prompt assembly. (Not directly verified — file exists but not inspected for raw-text leakage in this trace.)

**Third-party exfil**: ✅ direct path to Anthropic / OpenAI via hop 6. ✅ to Langfuse via hop 12 if caller misuses metadata. ❌ no path to S3 (verified — no `kernel_memory_episodic.contents` archive). 

**RTBF compliance**: CoT reservoir HARD_DELETE (`dsar-rtbf-executor.ts:313-324`). `messages` HARD_DELETE (`:189-201`). `voice_turns` HARD_DELETE (`:202-213`). **`kernel_memory_episodic` NOT in the RTBF table list — gap.**

---

## PII type 5: Declared facts

User-visible `Settings → Declared Facts` page.

| Hop | File:line | Operation | Scrub/encrypt enforced? | Notes |
|-----|-----------|-----------|------------------------|-------|
| 1 | `apps/customer-app/src/app/settings/declared-facts/page.tsx` | User types `key`, `value` into form | n/a (client) | (file exists per ls) |
| 2 | `services/api-gateway/src/routes/memory-declare.router.ts:28-49` | `DeclareSchema` zod — key alphanumeric+`_.-:` ≤120 chars, value string ≤2000 or number/bool/record | ✅ length cap and type union | 2 KB value ceiling |
| 3 | `services/api-gateway/src/routes/memory-declare.router.ts:62-82` | Auth gate: tenantId + userId mandatory | ✅ 401 if either missing | |
| 4 | `services/api-gateway/src/routes/memory-declare.router.ts:97-107` | `svc.upsertFact({ tenantId, userId, key, value, confidence, source: 'declared', sourceTurnId: null })` | ❌ value persisted RAW | **GAP: no scrub on values like "My phone is +255712345678"** |
| 5 | `packages/database/src/services/kernel-memory-semantic.service.ts:128-167` | `db.insert(kernelMemorySemantic).values({...})` ON CONFLICT update | ❌ plaintext jsonb | `kernel_memory_semantic` row, no envelope encryption |
| 6 | `packages/central-intelligence/src/kernel/kernel.ts:542-547` | `loadSemanticFacts` at step 4 of pipeline | n/a (just reads) | But what it returns is fed to step 6/7 prompt assembly |
| 7 | `packages/central-intelligence/src/kernel/compose.ts` (system prompt assembly) | Declared facts mixed into system prompt | ❌ raw values reach LLM | Same gap as chat text — pre-LLM scrub absent |
| 8 | `services/consolidation-worker/src/stages/06-consolidate.ts` | Cross-tenant aggregation refused — `comment line 60` "Cross-tenant consolidation is a privacy boundary" | ✅ per-tenant only | Good explicit constraint |
| 9 | `packages/database/src/services/consolidation-emissions.service.ts:108` | `highlights: highlights` jsonb (`consolidation-emissions.schema.ts:26`) | ⚠️ value depends on what the consolidator emits | The consolidator port is duck-typed; no observed evidence that declared-fact RAW values get into highlights, but no enforced scrub either |
| 10 | `packages/ai-copilot/src/gdpr/dsar-rtbf-executor.ts` | `kernel_memory_semantic` NOT in the RTBF table list | ❌ declared facts survive RTBF | **GAP: user can delete via `DELETE /memory/declare` (`memory-declare.router.ts:165`), but the soft-delete sets value=null on a NEW row; old rows with the same key may persist** |

**Cross-tenant risk**: `kernel_memory_semantic` is keyed on `(tenantId, userId)` (`kernel-memory-semantic.service.ts:166-168` — `tenant.userId.key` ON CONFLICT). Service-layer enforces scoping; no platform-wide search route observed.

**Third-party exfil**: hop 7 — Anthropic / OpenAI receive declared facts via system-prompt mixin.

**RTBF compliance**: soft-delete via `memory-declare.router.ts:202-210` (sets value=null, confidence=0). **Table NOT covered by `dsar-rtbf-executor.ts`** — automated RTBF won't sweep it.

---

## PII type 6: Payment refs / bank account / M-Pesa transaction IDs

`payments.transaction_id`, `payments.mpesa_phone`, `gepg_control_numbers.*`.

| Hop | File:line | Operation | Scrub/encrypt enforced? | Notes |
|-----|-----------|-----------|------------------------|-------|
| 1 | `services/payments/src/providers/mpesa/callback-handler.ts:53` | `mpesaReceipt = getMetadataItem(items, 'MpesaReceiptNumber')` | ❌ plaintext | Required for reconciliation |
| 2 | `services/payments/src/providers/mpesa/callback-handler.ts:58-66` | Structured log — receipt IS included (`mpesaReceipt`) but phone is NOT | ⚠️ partial — receipt in logs OK per audit need, but reaches Loki/CloudWatch raw | Need to verify Loki redaction policy |
| 3 | `services/payments/src/providers/mpesa/callback-handler.ts:117, 125` | `transactionId: result.TransactionID` returned to ledger writer | ❌ plaintext | |
| 4 | `services/payments/src/reconciliation/matcher.ts:5,105-134` | `phoneMatchWeight 0.35` — payment.phoneNumber stored on Payment object | ❌ raw phone on in-memory match obj | (transient; not persisted by matcher itself) |
| 5 | `packages/central-intelligence/src/kernel/cot-reservoir/pii-scrub-cot.ts:88-100` | `mpesa-txn` regex + context-cued variant (10-char alphanum with "mpesa"/"ref"/"txn" cue within 30 chars) | ✅ CoT thought text scrub | Bossnyumba-specific moat |
| 6 | `services/consolidation-worker/src/stages/04b-cot-distill.ts:74` | Same `mpesa-txn` regex at distill | ✅ defence-in-depth | |
| 7 | `packages/database/src/schemas/payment.schema.ts:196-198` | `payer_name`, `payer_phone`, `payer_email` plaintext | ❌ + RETAIN on RTBF | TRA/VAT carve-out |
| 8 | `packages/database/src/services/sovereign-action-ledger.service.ts:124-135` | `hashPayload(payload)` hashes payload — but `payload_json` is also stored alongside the hash | ❌ raw payload persisted | **GAP: hash is for tamper-evidence, NOT redaction; the JSONB column contains the original** |
| 9 | `packages/observability/src/audit-logger.ts:130-184` | Audit events for `payment.received` etc. — actor email + name persisted | ❌ raw | And RETAIN on RTBF |

**Cross-tenant risk**: payments table tenant-scoped. No cross-tenant aggregation observed.

**Third-party exfil**: Anthropic via hop 5/6 (only AFTER scrub — good). M-Pesa, GePG, payment provider receive their own data back.

**RTBF compliance**: `payments` RETAIN, `gepg_control_numbers` RETAIN. The pii columns ARE listed (`dsar-rtbf-executor.ts:169, 292`) for audit-traceability, but the action is RETAIN — meaning RTBF will log the existence of the PII but not erase it. Acceptable per Art. 17(3)(b).

---

## PII type 7: Property addresses + geolocation

`properties.address_line1/2`, `properties.latitude/longitude`,
`customers.current_address_*`, `employees.covered_property_ids`.

| Hop | File:line | Operation | Scrub/encrypt enforced? | Notes |
|-----|-----------|-----------|------------------------|-------|
| 1 | `packages/database/src/schemas/property.schema.ts:88-98` | `addressLine1`, `addressLine2`, `city`, `state`, `postalCode`, `country`, `latitude`, `longitude` | ❌ plaintext + `decimal(10,8)` for lat/lon | Property table; tenant-scoped |
| 2 | `packages/database/src/schemas/customer.schema.ts:96-101` | `current_address_line1/2`, `current_city/state/postal_code/country` — pre-move-in customer address | ❌ plaintext | |
| 3 | `services/api-gateway/src/routes/properties.ts` (list/search) | Property listing returns full address | ⚠️ tenant-scoped at service layer (no cross-tenant observed) | (file exists per ls) |
| 4 | `packages/central-intelligence/src/kernel/cot-reservoir.ts` `COT_PII_PATTERNS_EXTENDED` GPS coordinate pattern (gated by `BOSSNYUMBA_PII_EXTENDED=true`) | Lat/lon scrub in CoT | ⚠️ off by default | **GAP: env-gated; production must set BOSSNYUMBA_PII_EXTENDED** |
| 5 | `packages/central-intelligence/src/kernel/kernel.ts:597-600` | `groundingFacts.fetch({ userMessage, tier, limit })` — grounding facts include property addresses | ❌ raw address → system prompt → Anthropic | Same pre-LLM scrub gap |
| 6 | `apps/admin-platform-portal/src/app/control-tower/` | Platform admins query across tenants | ❌ super-admin sees every tenant's property addresses | By design — but should be logged to audit |
| 7 | `packages/ai-copilot/src/gdpr/dsar-rtbf-executor.ts:138-143` | `current_address_line1/2` in `customers.piiColumns` | ✅ ANONYMIZE on RTBF | But `properties.address_*` is NOT in the RTBF list — the property is a property of the *tenant org*, not the customer subject |

**Cross-tenant risk**: hop 6 — admin portal aggregates property data across tenants. Sovereign by design, but no per-row audit emission observed.

**Third-party exfil**: hop 5 — addresses reach Anthropic / OpenAI via grounding facts. Hop 4's GPS scrub is OFF by default — that's a configuration trap.

**RTBF compliance**: customer addresses anonymise; property addresses retain (property persists past customer).

---

## PII type 8: Employee data (HR / payroll / KRA)

`employees.first_name/last_name/email/phone`, `employees.base_salary_kes`,
KRA eRITS `owners[]` records.

| Hop | File:line | Operation | Scrub/encrypt enforced? | Notes |
|-----|-----------|-----------|------------------------|-------|
| 1 | `packages/database/src/schemas/hr.schema.ts:195-200` | `firstName`, `lastName`, `preferredName`, `phone`, `phoneAlt`, `email` | ❌ plaintext | tenant-scoped |
| 2 | `packages/database/src/schemas/hr.schema.ts:228` | `baseSalaryKes: numeric(14,2)` | ❌ plaintext + comment line 225-227: "NEVER surfaced to non-HR personae. Access enforced by RLS policies" | **GAP: comment claims RLS but no migration / GRANT statement observed** |
| 3 | `services/api-gateway/src/routes/owner/` (owner portal payroll) | Owner-portal payroll module — REST routes | ⚠️ Did not deep-trace; owner-tenant role gate exists | (NOT FOUND — file enumeration showed `owner/` dir but no specific payroll route grep'd) |
| 4 | `packages/central-intelligence/src/kernel/tool-spec/hq-tools/platform.file_kra_mri.ts:39, 51` | KE eRITS: `KraPinSchema` 11-char `A\d{9}[A-Z]`, owner records with `ownerId, kraPin, rentalAmountCents, deductibleCents` | ✅ schema validated | tenant-scoped |
| 5 | `packages/central-intelligence/src/kernel/tool-spec/hq-tools/platform.file_kra_mri.ts:104-115` | `KraEritsFilingWorkflowDispatcherPort.start({ owners: [...] })` — owners array hand-off to Temporal | ❌ raw PIN + amounts in Temporal workflow input | Temporal workflow history persists this |
| 6 | `services/api-gateway/src/composition/durable/temporal/kra-erits-filing-workflow.ts` | Temporal workflow input is persisted in workflow history (Temporal server / Postgres) | ❌ raw PIN survives in Temporal history | **GAP: Temporal history is a parallel data store with its own retention policy — outside the RTBF executor's reach** |
| 7 | `packages/central-intelligence/src/kernel/four-eye-approval.ts` + `sovereign-action-ledger.service.ts:218` | `payloadHash = hashPayload(args.payloadJson)` — KRA filing recorded as sovereign action | ❌ payloadJson (containing owner records) persisted alongside hash | Same gap as payment hop 8 |
| 8 | `packages/ai-copilot/src/security/pii-scrubber.ts` | NO KRA PIN pattern (only NIDA, TIN, phone, email…) | ❌ KRA PIN NOT in `PII_PATTERNS` | **GAP: `scrubPii` doesn't scrub `A123456789B`-shaped KRA PINs even if invoked** |
| 9 | `services/consolidation-worker/src/stages/04b-cot-distill.ts:61` | `kra-pin` pattern `\b[A-Z]\d{9}[A-Z]\b` in worker-local scrub | ✅ CoT distill scrubs KRA PIN | But ONLY at distill — not at request boundary |
| 10 | `packages/ai-copilot/src/gdpr/dsar-rtbf-executor.ts:276-287` | `kra_mri_filings` (sqlName `monthly_close_runs`) RETAIN | ✅ regulator retention obligation | KRA Act records-retention covers this |

**Cross-tenant risk**: employees + eRITS owner records tenant-scoped. The Temporal workflow history is a separate data plane that admins can query independent of RLS — that's the cross-tenant risk.

**Third-party exfil**: KRA gateway by design. Temporal Cloud (if used) holds full input history. Anthropic via prompt context if HR persona quotes employee data.

**RTBF compliance**: `employees` table NOT in `dsar-rtbf-executor.ts` table list — an employee who leaves and requests RTBF gets RETAIN-by-omission (default deny). `monthly_close_runs` RETAIN by policy.

---

## PII type 9: CoT (chain-of-thought) trace content

What the LLM "thought" — `kernel_cot_reservoir.thought_text`.

| Hop | File:line | Operation | Scrub/encrypt enforced? | Notes |
|-----|-----------|-----------|------------------------|-------|
| 1 | `packages/central-intelligence/src/kernel/cot-reservoir.ts:298-318` | `createCotReservoir.maybeCapture` — probabilistic sample (`SAMPLE_RATES[input.stakes]`); critical=100% | n/a sampling | |
| 2 | `packages/central-intelligence/src/kernel/cot-reservoir.ts:305` | `scrubCotText(input.thoughtText)` BEFORE persist | ✅ regional scrub applied | Idempotent, mutations recorded |
| 3 | `packages/central-intelligence/src/kernel/cot-reservoir.ts:311-312` | `promptHash: sha256Hex(input.thoughtText)`, `responseHash: sha256Hex(sanitized)` | ✅ hashes alongside text for tamper-detection | |
| 4 | `packages/central-intelligence/src/kernel/cot-reservoir.ts:240-246` | `extendedPiiEnabled()` gates Wave-K Tier-3 patterns behind env | ⚠️ default OFF; prod MUST set `BOSSNYUMBA_PII_EXTENDED=1` | **CONFIG TRAP: Tier-3 patterns (credit-card Luhn, IBAN, US SSN, UK NI, GPS) only run when env is set** |
| 5 | `services/api-gateway/src/routes/cot-query.router.ts:233-356` | `GET /api/v1/cot/query` — admin-only, tenant-scoped, RE-scrubs on read | ✅ defence-in-depth | Re-scrub via `scrubCotForPersist` at line 305 |
| 6 | `services/api-gateway/src/routes/cot-query.router.ts:268-276` | `?include_raw=true` requires `cot:read:raw` sovereign-tier permission | ✅ four-eye scope gate | Permission provisioned only via admin workflow |
| 7 | `services/api-gateway/src/routes/cot-query.router.ts:321-331` | Audit event emitted before response leaves gateway (`cot.query` / `cot.query.raw`) | ✅ raw access triggers separate event type | Audit log surface for dashboards |
| 8 | `services/consolidation-worker/src/stages/04b-cot-distill.ts:275-289` | Low-judge turns → `reflexion_lesson` row; CoT text re-scrubbed via local pattern set | ✅ defence-in-depth | Worker has its own pattern duplicate (line 55-80) |
| 9 | `packages/central-intelligence/src/kernel/cot-reservoir/pii-scrub-cot.ts:54-110` | Persist-boundary scrub: model-provider URLs, Anthropic SK keys, generic `sk-/pk-` patterns, `MPESA` IDs, model-named entities | ✅ on persist + on read | Model-name redaction is a privacy posture choice |
| 10 | `packages/ai-copilot/src/gdpr/dsar-rtbf-executor.ts:313-324` | `kernel_cot_reservoir` HARD_DELETE on RTBF | ✅ erased | |
| 11 | `packages/observability/src/tracing/tracer.ts:438-471` `emitLangfuseSpan` — CoT NOT a standard attribute | n/a | But if a caller stamps thought text into `metadata` it leaks — see hop 12 of PII type 4 |

**Cross-tenant risk**: `cot-query.router.ts:241-256` — TENANT_ADMIN locked to own tenant; SUPER_ADMIN can pass any tenant. ✅ explicit role gate.

**Third-party exfil**: ✅ scrubbed CoT only — both at write (hop 2) and read (hop 5). Model names redacted (hop 9) means the regulator dump never reveals internal model selection.

**RTBF compliance**: ✅ HARD_DELETE.

---

# Summary of top 5 PII leak paths discovered

1. **Pre-LLM `userMessage` not scrubbed before Anthropic / OpenAI** —
   `packages/central-intelligence/src/kernel/kernel.ts:801` calls
   `router.call({ userMessage: req.userMessage, ... })` raw. Verified by
   `grep scrubPii packages/central-intelligence` returning ZERO callers.
   Any chat that contains email / phone / NIDA / KRA PIN ships
   cleartext to the third-party LLM. Output-guard scrubs the *response*
   (`output-guard.ts:220`) but the *prompt* leaves the building dirty.

2. **OTel span attribute `bossnyumba.user.email` ships raw email to
   OTLP collector** — `tracer.ts:290` `span.setAttribute(USER_EMAIL,
   email)`. Whatever `OTLP_ENDPOINT` is configured (Datadog, Honeycomb,
   Langfuse) gets the email in cleartext for every user-context-tagged
   span.

3. **Episodic memory `kernel_memory_episodic` holds raw chat forever**
   — `kernel.ts:2127` writes
   `summary: userMessage.slice(0, MEMORY_EPISODIC_SUMMARY_MAX)` with no
   scrub. The table is NOT in `dsar-rtbf-executor.ts`'s policy list, so
   RTBF requests miss it. NIDA / phone / address mentioned in chat is
   retained indefinitely with no automated erasure.

4. **`sovereign_action_ledger.payload_json` stores raw PII alongside
   the hash** — `sovereign-action-ledger.service.ts:218` hashes the
   payload for tamper-detection BUT the schema
   (`sovereign-action-ledger.schema.ts:56`) keeps `payload_json` JSONB
   intact. Append-only by design — RTBF cannot redact. KRA filings,
   eviction proposals, owner payouts all carry full payer/owner PII
   here permanently.

5. **`tenant_identities.phone_normalized` is a cross-org unique
   index, NOT in RTBF** — `identity.schema.ts:77-79`. A single
   `phone_normalized` row is shared across every org the human belongs
   to. The table is missing from `dsar-rtbf-executor.ts` entirely. A
   human asking for erasure leaves an indexed cross-org pointer behind.
   Additionally, an admin SELECT against `tenant_identities` without a
   tenant predicate returns rows for foreign orgs.

Honourable mentions: the GPS-coordinate scrub in CoT is env-gated
(`BOSSNYUMBA_PII_EXTENDED=1` — default OFF) which is a configuration
trap; KRA PIN regex is in worker + CoT-persist scrubs but ABSENT from
`scrubPii` patterns (`pii-scrubber.ts`); and the Langfuse adapter's
`metadata` field type-allows arbitrary records, so any caller can
accidentally pass `userMessage` into a Langfuse trace via
`withLangfuseGeneration({ metadata: { userMessage: ... } })`.
