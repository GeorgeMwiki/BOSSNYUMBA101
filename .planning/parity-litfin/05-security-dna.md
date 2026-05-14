# P5 — Security DNA Parity (LITFIN vs BOSSNYUMBA101)

**Scope.** Inviolable refusals · prompt-shield · policy-gate · PII scrubber ·
hash-chain audit · four-eye approval.
**Mode.** Read-only, cite file:line.
**Verdict at a glance.** Skeletons match; depth/coverage/persistence-grade
diverge sharply. BOSSNYUMBA's kernel-side modules are cleaner and more
typed, but LITFIN ships materially more production-grade machinery
(HMAC-secret rotation, dual-secret verify, streaming batch verify, tail
verify, random-sample cron, plan-artifact emission on every approval,
broader pattern catalogues).

---

## 1. Inviolable Refusal Gates

### 1.1 Files

| Side | File | Lines |
|---|---|---|
| LITFIN | `src/core/brain/inviolable.ts` | 391 |
| BOSS  | `packages/central-intelligence/src/kernel/inviolable.ts` | 103 |
| BOSS  | `packages/central-intelligence/src/kernel/public-inviolable.ts` | 217 |

### 1.2 Refusal categories

| Category | LITFIN (`inviolable.ts:138-147`) | BOSS authed (`inviolable.ts:26`) | BOSS public (`public-inviolable.ts:44-50`) |
|---|---|---|---|
| IP internal / system-prompt | `ip_internal` (regex set L46-104) | not modelled at input | `extraction-attempt` |
| IP secret | `ip_secret` (8 secret shapes L55-80) | — | — |
| IP copyright | `ip_copyright` (prose heuristic L245-256) | — | — |
| Cross-tenant | `privacy_cross_tenant` (L123-132 + tenantContext L110-121) | `cross-tenant` (`inviolable.ts:96-103`) | `cross-tenant-probe` (`public-inviolable.ts:97-104`) |
| Bulk PII export | — (covered by `pii_redaction` gate) | `pii-bulk` (L30-33) | (none separate) |
| Counterfeit-authority | covered via output screen | `authority` (L35-39) | `authority-impersonation` (L113-117) |
| Tribunal/legal autonomy | n/a (lending, not eviction) | `autonomy` (L41-44) | — |
| Token-budget DoS | not modelled | — | `token-budget-abuse` (2000-char cap L68, L134-141) |
| Phishing content | covered by `forbidden_claims` (policy-gate) | — | `phishing-content-request` (L106-111) |
| Injection markers | (prompt-shield package) | — (delegated) | `injection-attempt` (L75-87) |

**Asymmetry.**
* LITFIN models IP/copyright/secret triad at the inviolable layer; BOSS
  pushes those concerns to the prompt-shield and policy-gate.
* BOSS adds a dedicated **`public-inviolable.ts`** for the unauth
  marketing surface — LITFIN has no analogue (LITFIN has no
  unauthenticated AI surface).
* LITFIN's `tenantContext` (`inviolable.ts:110-121`) feeds an
  **output-side** ID-leak scan with an `authorizedIds` allow-list; BOSS
  only does **input-side** scope mismatch on `ScopeContext.kind` (`inviolable.ts:96-103`).
* LITFIN ships bilingual refusal strings (en/sw — `inviolable.ts:311-335`); BOSS does not.

### 1.3 Per-category test cases

| | LITFIN | BOSS |
|---|---|---|
| Tests file(s) | (no dedicated `inviolable.test.ts` found — covered via `policy-gate` integration tests) | `packages/central-intelligence/src/__tests__/public-inviolable.test.ts` + `policy-gate-edges.test.ts` |

**Gap.** BOSS has direct unit-test coverage for the authed inviolable
gate's four categories only via the public-inviolable file; the kernel
`inviolable.ts` itself has no `__tests__/inviolable.test.ts`. LITFIN
exercises rules through the policy-gate integration path; neither side
has a per-category corpus of inviolable test inputs.

---

## 2. Prompt Shield

### 2.1 Files

| Side | File | Lines |
|---|---|---|
| LITFIN | `src/core/litfin-ai/security/prompt-shield.ts` | 611 |
| BOSS  | `packages/ai-copilot/src/security/prompt-shield.ts` | 270 |
| BOSS test | `packages/ai-copilot/src/__tests__/prompt-shield.test.ts` | — |

### 2.2 Threat signatures (`PATTERNS` table)

| Category | LITFIN entries | BOSS entries | Delta |
|---|---|---|---|
| `instruction_override` | 6 (L57-130) | 5 (L53-63) | LITFIN +1 (`no_restrictions`) ✓ BOSS has too |
| `role_manipulation`    | 6 (L88-123) | 5 (L57-62) | parity |
| `delimiter_attack`     | 9 (L134-191) | 8 (L66-74) | LITFIN +1 (`markdown_separator` L188) |
| `data_exfiltration`    | 8 (L196-242) | 8 (L77-84) | parity |
| `system_probe`         | 5 (L246-274) | 4 (L87-90) | LITFIN +1 (`api_key_probe`); BOSS includes `BOSSNYUMBA_SECRET` token (L89) |
| `encoding_attack`      | 2 (L278-288) | 2 (L93-94) | parity |
| `context_manipulation` | 4 (L292-313) | 2 (L101-102) | LITFIN +2 (`emergency_override`, `maintenance_mode`) |
| `tool_abuse`           | 5 (L318-352) | 4 (L95-98) | LITFIN +1 (`tool_password`, `arbitrary_exec` — both absent in BOSS) |

**Total pattern count:** LITFIN ~45 · BOSS ~38.

### 2.3 Severity levels

Both: `none | low | medium | high | critical` — **identical enum**
(`prompt-shield.ts:18` ↔ `prompt-shield.ts:19`).

### 2.4 Structural / sanitiser parity

| Signal | LITFIN | BOSS |
|---|---|---|
| `instructionDensity` | L398-404 | L130-133 |
| `lengthAnomaly` (>2000 chars + density>0.5) | L407 | L135 |
| `multiLanguageEvasion` (non-Latin + Latin instr) | L410-417 | L137-139 |
| `contextStuffing` (>10000 chars) | L420 | L140 |
| Zero-width + null-byte + newline-flood | L424-426 | L141-145 |
| Sanitiser: ChatML / Llama / `<system>` / Human/Assistant / `<script>` | L449-471 | L165-177 |
| Truncate at 10k | L474-477 | L178-180 |

**Equivalent** with one delta: LITFIN sanitiser is invoked for
`medium|high`; BOSS sanitises on `medium|high` **or** any
`suspiciousFormatting` (`prompt-shield.ts:206-209`) — slightly stricter.

### 2.5 Nonce boundaries + injection-resistance preamble

Both ship identical APIs (`buildPromptBoundaries`, `INJECTION_RESISTANCE_INSTRUCTION`).
Brand string differs (LitFin vs BOSSNYUMBA — expected).

---

## 3. Policy Gate (Output Post-Processing)

### 3.1 Files

| Side | File | Lines |
|---|---|---|
| LITFIN | `src/core/brain/policy-gate.ts` | 318 |
| BOSS  | `packages/central-intelligence/src/kernel/policy-gate.ts` | 105 |

### 3.2 Checks

| Check | LITFIN | BOSS |
|---|---|---|
| Inviolable hard-fail (output screen) | L283-296 (`screenOutputForLeak`) | — (separate `checkInviolable` runs pre-sensor only) |
| PII redaction | L57-77 (NIDA / TZ phone / 16+ digits) | L34-40 (TZ phone, **KE phone**, generic 0[67] phone, **email**, NIDA) |
| Language consistency (en/sw) | L88-141 | — |
| Numerical sanity (10× ground-truth claim) | L147-195 | — |
| Grounding (memory term cite) | L201-224 | — |
| Fabrication (brain identity) | L230-241 | — |
| Regulatory hedges | L247-269 (no AI-issued approvals/rates/promises) | L45-92 (eviction/lease termination must reference arrears ladder) |
| Numerical claim hedging (uncited %, money) | — | L42-78 (auto-hedge uncited %, TZS/KES/USD figures) |

**Asymmetry.**
* LITFIN policy-gate is broader (7 checks vs BOSS 3). LITFIN's
  language-consistency, grounding, and identity-fabrication gates have
  **no BOSS counterpart**.
* BOSS's uncited-numerics auto-hedge (`policy-gate.ts:63-78`) is **not in
  LITFIN** — LITFIN catches hallucinated numbers via the 10× heuristic
  but does not append explicit "(uncited)" tags.
* BOSS's eviction → arrears-ladder appender (L80-92) is unique to its
  property-management domain; LITFIN's equivalent is the "no
  AI-issued approvals" forbidden-claims list (L247-261).

### 3.3 PII regex coverage in the gate

| Pattern | LITFIN (`policy-gate.ts:57-64`) | BOSS (`policy-gate.ts:34-40`) |
|---|---|---|
| TZ NIDA (20-digit) | ✓ | ✓ |
| TZ phone | ✓ | ✓ |
| KE phone (+254) | — | ✓ |
| Generic 0[67] phone | — | ✓ |
| Email | — (covered in pii-scrubber package) | ✓ |
| 16+ digit account | ✓ | — |

**MY phone (Malaysia +60)** — not covered in either side.

### 3.4 Verdict shape

* LITFIN: `PolicyGateResult { verdicts[], anyHardFail, summary }`
  (L276-280) — every gate emits a `GateVerdict`.
* BOSS: `PolicyGateOutput { verdict, redactedText, mutations[] }`
  (`policy-gate.ts:28-32`) — collapses to a single `pass | soften | block`.

LITFIN's verdict log is **strictly more informative** for downstream
provenance / audit.

---

## 4. PII Scrubber

### 4.1 Files

| Side | File | Lines | Tests |
|---|---|---|---|
| LITFIN | `src/core/litfin-ai/security/pii-scrubber.ts` | 357 | `pii-scrubber.test.ts` (in litfin-ai) |
| LITFIN alt | `src/core/staged-call/pii-scrubber.ts` | — | — |
| BOSS | `packages/ai-copilot/src/security/pii-scrubber.ts` | 313 | `packages/ai-copilot/src/__tests__/pii-scrubber.test.ts` |

### 4.2 Regex coverage

| `PiiType` | LITFIN (`PII_PATTERNS` L51-141) | BOSS (`PII_PATTERNS` L62-135) | Delta |
|---|---|---|---|
| `national_id` (NIDA) | `(19|20)\d{2}[-\s]?…\d{2}` | same shape, also accepts `\d{2,4}` tail | BOSS more permissive |
| `tin_number` | TIN labelled, 9 digits | identical | parity |
| `phone_number` TZ | `(\+?255|0)\s?[67]\d{2}…` | identical | parity |
| `phone_number` KE | — | `(\+?254|0)\s?7\d{2}…` (L77-79) | **BOSS only** |
| `phone_number` intl fallback | broad `\+?\d{1,3}…` | conservative `\+\d{1,3}…` (requires `+`) | LITFIN broader |
| `email` | standard RFC-ish | identical | parity |
| `credit_card` | 13-19 digits | 15-19 digits | parity |
| `bank_account` | `(account|a/c|acct)…\d{10,16}` | adds `akaunti` (Swahili) (L108) | BOSS +sw |
| `passport` | `(passport|pasipoti)…[A-Z]{1,2}\d{6,9}` | identical | parity |
| `date_of_birth` | DOB context regex | — | **LITFIN only** |
| `ip_address` | dotted-quad | identical | parity |
| `ssn` | `\d{3}-?\d{2}-?\d{4}` | `\d{3}-\d{2}-\d{4}` (requires dashes) | LITFIN more permissive |
| `api_key` | `(sk|pk|api|key|token)…20+` | `(sk|pk|api_key|token)…16+` (requires `-`/`_`) | LITFIN more permissive (more FP-prone) |

### 4.3 Replacement tokens

| Token | LITFIN | BOSS |
|---|---|---|
| `[NIDA_ID]` | ✓ | ✓ |
| `[TIN]` | ✓ | ✓ |
| `[PHONE]` | ✓ | ✓ |
| `[EMAIL]` | ✓ | ✓ |
| `[CARD]` | ✓ | ✓ |
| `[ACCOUNT]` | ✓ | ✓ |
| `[PASSPORT]` | ✓ | ✓ |
| `[DOB]` | ✓ | — |
| `[IP]` | ✓ | ✓ |
| `[SSN]` | ✓ | ✓ |
| `[API_KEY]` | ✓ | ✓ |

Tokens identical for the intersecting set.

### 4.4 Context-aware patterns (Swahili-aware)

| Pattern | LITFIN | BOSS |
|---|---|---|
| `my (phone) number is …` / `namba yangu ni …` | L160-164 | L147-152 |
| `my email is …` / `email yangu ni …` | L166-171 | L154-158 |
| `my (national) id is …` / `kitambulisho changu …` / `nida yangu …` | L173-179 | L161-167 |
| `account number …` | L181-186 | — |
| `piga simu` (Swahili "call me") trigger | — | L148 |

### 4.5 Monetary preservation

Both detect and **skip** monetary contexts to avoid scrubbing `TSh
500,000` as PII (LITFIN L197-204; BOSS L171-179). BOSS adds Kenyan
`KSh` and Swahili `milioni / bilioni` cues.

### 4.6 Idempotency

BOSS explicitly guards against re-scrubbing already-replaced placeholders
via `PLACEHOLDER_RX` and `overlapsPlaceholder` (L182-203). LITFIN has no
equivalent guard — running `scrubPii` twice could in theory match the
placeholder text.

### 4.7 Audit record

Both expose `buildPiiAuditRecord` that emits `piiTypes` + `piiCount` but
**never** the raw values (LITFIN L345-357 ↔ BOSS L305-313).

---

## 5. Hash-Chain Audit

### 5.1 Files (three distinct LITFIN chains, two BOSS)

| Side | File | Purpose |
|---|---|---|
| LITFIN | `src/core/audit/hash-chain-verifier.ts` (770 lines) | HMAC chain over `litfin_ai_session_turns` — production-grade |
| LITFIN | `src/core/litfin-ai/security/audit-hash-chain.ts` (174 lines) | Simple SHA-256 chain |
| LITFIN | `src/core/funnel-intelligence/hash-chain.ts` | Funnel-specific |
| BOSS | `packages/ai-copilot/src/security/audit-hash-chain.ts` (259 lines) | SHA-256 chain w/ Drizzle adapter |
| BOSS | `packages/ai-copilot/src/audit-trail/hash-chain.ts` | (secondary; not deep-read) |
| BOSS schema | `packages/database/src/schemas/ai-audit-chain.schema.ts` | `ai_audit_chain` table |

### 5.2 Chain structure (Merkle-like, linear)

Neither side ships a true **Merkle tree**. Both are **linear hash
chains** (each row hashes `prev_hash || canonical(row)`).

| Field | LITFIN simple (`audit-hash-chain.ts:19-27`) | LITFIN HMAC (`hash-chain-verifier.ts:202-216`) | BOSS (`audit-hash-chain.ts:18-30`) |
|---|---|---|---|
| `sequenceId` / `turn_index` | ✓ | ✓ (UNIQUE per session) | ✓ |
| `prevHash` | ✓ | ✓ | ✓ |
| `thisHash` / `row_hash` / `entryHash` | ✓ | ✓ | ✓ |
| Tenant scoping | — (session only) | bank_id + user_id + application_id | `tenantId` (FK to `tenants`) |
| Genesis sentinel | `GENESIS_0000…` (L72) | `"GENESIS"` (L247) | `GENESIS_0000…` (L62-63) |
| Hash function | SHA-256 (createHash) | HMAC-SHA-256 + secret | SHA-256 (createHash) |
| Canonical payload | JSON.stringify of all fields | JSON.stringify of 11 fields (L229-243) | JSON.stringify of 7 fields (L82-91) |

**Critical gap.** Only LITFIN's `hash-chain-verifier.ts` uses an
**HMAC with a separate secret** (`SESSION_HASH_SECRET`); BOSS's chain
is plain SHA-256, which means an attacker with DB write access can
forge a valid-looking row by simply hashing the payload — there's no
keyed-MAC requirement (`audit-hash-chain.ts:81-92`).

### 5.3 Secret rotation

| | LITFIN | BOSS |
|---|---|---|
| Active-secret env var | `SESSION_HASH_SECRET` | — |
| Rotation overlap secret | `SESSION_HASH_SECRET_PREV` (L114-122) | — |
| Dual-key verify | `verifyRowHashWithRotation` (L290-312) | — |
| HKDF sub-key derivation | `deriveSubKey` (L186-196) | — |
| Constant-time compare | `crypto.timingSafeEqual` (L265-278) | — |

### 5.4 Verification API

| Capability | LITFIN | BOSS |
|---|---|---|
| Verify full chain for session/tenant | `verifyChainForSession` (L357-481, streaming 500-row batches) | `verify(tenantId)` (`audit-hash-chain.ts:164-214`, loads full list) |
| Tail-only verify (cheap read-path check) | `verifyTailForSession` (L521-704, anchors against predecessor) | — |
| Random-sample audit cron | `verifyRandomSample` (L721-769, SECURITY DEFINER RPC) | — |
| Streaming / OOM safety on 10K+ row sessions | ✓ | ✗ (`listByTenant` returns full array) |
| Constant-time hash compare | ✓ | ✗ (uses `!==`) |

### 5.5 Retention policy

* LITFIN simple chain docstring states **7-year retention capability**
  (`audit-hash-chain.ts:12`).
* LITFIN HMAC table — append-only enforced at **trigger level**
  (`hash-chain-verifier.ts:12-14`).
* BOSS — schema has no retention enforcement, no append-only trigger
  declared. The Drizzle table allows DELETE/UPDATE by any role with the
  right grant.

---

## 6. Four-Eye Approval

### 6.1 Files

| Side | File | Lines |
|---|---|---|
| LITFIN | `src/core/governance/four-eye/types.ts` | 105 |
| LITFIN | `src/core/governance/four-eye/approval-queue.ts` | — |
| LITFIN | `src/core/governance/four-eye/policy.ts` | — |
| LITFIN | `src/core/governance/four-eye/notification.ts` | — |
| LITFIN | `src/core/sovereign-brain/actions/approval-gate.ts` | 228 |
| LITFIN | `src/core/approval/destructive-action-engine.ts` | — (separate destructive-action engine) |
| LITFIN | `src/core/approval/destructive-action-types.ts` | 111 |
| BOSS | `packages/central-intelligence/src/kernel/four-eye-approval.ts` | 188 |
| BOSS | `packages/database/src/schemas/sovereign-approvals.schema.ts` | 63 |
| BOSS | `packages/database/src/repositories/sovereign-approvals.repository.ts` | 138 |
| BOSS test | `packages/central-intelligence/src/__tests__/four-eye-approval.test.ts` | 167 |

### 6.2 Lifecycle states

| State | LITFIN (`types.ts:33-38`) | BOSS (`four-eye-approval.ts:25-30`) |
|---|---|---|
| `pending` | ✓ | ✓ |
| `one-eye` (1 of 2 signatures) | — (implicit via `decisions[]` length) | ✓ explicit |
| `approved` | ✓ | ✓ |
| `rejected` | ✓ | ✓ |
| `expired` | ✓ | ✓ |
| `recalled` (initiator pulls request) | ✓ | — |

### 6.3 Proposal / sign / expiry

| Property | LITFIN | BOSS |
|---|---|---|
| Proposer self-approval block | `self_approval_forbidden` code (`types.ts:97`) | thrown `Error('proposer cannot self-approve')` (`four-eye-approval.ts:118-120`) |
| Duplicate-signature block | `duplicate_decision` (`types.ts:98`) | `Error('approver has already signed')` (L121-123) |
| Required approvals count | declarative per-action `1|2|3` (`types.ts:81`) | hard-coded `>= 2` (`four-eye-approval.ts:136-137`) |
| Role-group requirements | `requiredRoleGroups: [[role,…],…]` (`types.ts:83`) | — (no role check) |
| Auto-reject TTL | `autoRejectAfterHours` per policy (`types.ts:85`) | injectable `defaultTtlMs` (default 24h L79) |
| Recall window | `recallWindowMinutes` (`types.ts:87`) | — |
| Replay protection on execution | `assertApproved` returns `already_executed` (`approval-gate.ts:42`) — gate marks request as executed | — (no executed-flag in record) |
| Re-authentication required | LITFIN destructive engine: `reAuthVerified` boolean required (`destructive-action-engine.ts:114-119`) | — |

### 6.4 Plan-artifact emission

LITFIN's `requestApproval` (`approval-gate.ts:115-168`) lazy-loads
`@/core/brain/plan-artifact` and **emits a `proposePlan({ tier:
'sovereign', steps, risks, reversal, … })`** so the approver sees a
structured plan, not just an opaque payload. BOSS has no equivalent —
the approver sees `summary + toolName + payload` only.

### 6.5 Action-type catalogue

* LITFIN: 13 declared `ApprovalActionType` values (`types.ts:17-30`)
  covering pricing, suspend org, reroute AI traffic, fraud flag,
  compliance review, secret rotation, policy rollout, model pin,
  emergency throttle, cohort insight publish, plus loan
  approve/reject.
* LITFIN destructive engine: separate 7-value `DestructiveActionType`
  (`destructive-action-types.ts:12-19`) for delete-bank, suspend-bank,
  delete-user, block-user, delete-application, purge-audit-logs,
  revoke-all-sessions — each with declarative `requiredApprovals`,
  `expiryHours`, `requiredRoles`.
* BOSS: no declared catalogue — `toolName` is an open string
  (`four-eye-approval.ts:42`). The kernel proposer can submit any tool.

### 6.6 Persistence

* BOSS: production `sovereignApprovals` Drizzle table
  (`sovereign-approvals.schema.ts:34-63`) with pg enums for status +
  stakes, `signatures` as `jsonb`, indices on tenant+status, proposer,
  expiresAt.
* LITFIN: `destructive_approval_requests` + `destructive_approval_decisions`
  tables referenced from engine but schema declarations live in
  `supabase/migrations/*` (not in this slice).

---

## 7. Summary Counts

| Dimension | LITFIN | BOSS | Notes |
|---|---|---|---|
| Inviolable categories (input-side) | 5 (`InviolableViolation.rule`) | 4 authed + 6 public = 10 distinct | BOSS has wider taxonomy across two gates |
| Inviolable test coverage | covered via policy-gate tests only | dedicated `public-inviolable.test.ts` + `policy-gate-edges.test.ts` | both lack per-rule inviolable corpus |
| Prompt-shield patterns | ~45 | ~38 | LITFIN +7 |
| Prompt-shield severity levels | 5 (`none/low/medium/high/critical`) | 5 — identical enum | parity |
| Policy-gate checks | 7 | 3 | LITFIN +4 (language, grounding, fabrication, numerical sanity) |
| Policy-gate PII regex set | TZ NIDA + TZ phone + long-number | TZ phone + KE phone + generic phone + email + NIDA | BOSS broader; both miss MY phone |
| PII scrubber `PiiType` set | 11 incl. `date_of_birth` | 10 (no `date_of_birth`) | LITFIN +1 |
| PII redaction tokens | identical for intersecting set | identical | parity |
| Hash-chain verify APIs | 3 (`verifyChainForSession`, `verifyTailForSession`, `verifyRandomSample`) | 1 (`verify`) | LITFIN +2 |
| Hash-chain key material | HMAC + secret + rotation overlap + HKDF | plain SHA-256 (no MAC) | LITFIN is keyed |
| Hash-chain streaming | 500-row batches | full-list load | LITFIN is OOM-safe |
| Hash-chain constant-time compare | `timingSafeEqual` | `!==` | LITFIN only |
| Four-eye states | 5 (`pending/approved/rejected/recalled/expired`) | 5 (`pending/one-eye/approved/rejected/expired`) | different fifth state |
| Four-eye role-group enforcement | yes (declarative per action) | no | LITFIN only |
| Four-eye plan-artifact on propose | yes (`proposePlan`) | no | LITFIN only |
| Four-eye re-auth requirement | yes (destructive engine) | no | LITFIN only |
| Four-eye action catalogue | 13 sovereign + 7 destructive = 20 declared | open string | LITFIN is enumerated |

---

## 8. Top 3 Highest-Leverage Gaps

1. **BOSS hash chain is unkeyed and not OOM-safe.** Switch
   `packages/ai-copilot/src/security/audit-hash-chain.ts` from
   `createHash('sha256')` to `createHmac('sha256', secret)`, gate
   `verify()` with a constant-time `timingSafeEqual`, and add a
   streaming batched read mode to `listByTenant`. Mirror LITFIN's
   `SESSION_HASH_SECRET` + `SESSION_HASH_SECRET_PREV` rotation pair
   (`hash-chain-verifier.ts:114-176`) and ship a
   `verifyTailForTenant` + `verifyRandomSample` to the gateway so the
   read path and an audit cron both check integrity. Also add the
   append-only DB trigger to `ai_audit_chain.schema.ts` (block
   UPDATE/DELETE).

2. **BOSS four-eye gate has no enumerated action-type catalogue, no
   role-group requirement, no replay-protection executed-flag, no
   plan-artifact emission, and no re-authentication requirement on
   destructive ops.** Port LITFIN's `ApprovalPolicy` declarative table
   (`four-eye/types.ts:78-88`) so each tool name has explicit
   `requiredApprovals: 1|2|3`, `requiredRoleGroups`,
   `autoRejectAfterHours`, and `recallWindowMinutes`. Add an
   `executed` boolean to `sovereign_approvals` so a single approved
   record cannot be re-submitted to the executor twice. Emit a
   `proposePlan` artifact on every `propose()` call (mirrors
   `approval-gate.ts:131-165`).

3. **BOSS policy-gate is missing 4 of LITFIN's 7 output checks** —
   numerical-sanity (10× ground-truth heuristic), grounding (must cite
   at least one retrieved memory term), fabrication (no
   AI-self-fabricating claims), and language-consistency. Adapt
   LITFIN's `policy-gate.ts:147-241` and add a Swahili/English token
   matrix appropriate for property management. Also broaden BOSS PII
   coverage with the **MY phone** (`+60`) and **TZ 16+ digit
   account-number** patterns currently missing on both sides. And
   close the symmetry gap by giving BOSS's authed `inviolable.ts`
   the IP-secret + IP-internal-reveal categories that LITFIN gates at
   the output layer (`inviolable.ts:46-104`).
