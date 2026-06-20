/**
 * Hardcoded-bank-coverage allow-list.
 *
 * Production files that legitimately reference a literal payment-rail /
 * tax-authority / KYC-provider name (`'mpesa'`, `'airtel'`, `'kra'`,
 * `'nida'`, `'gepg'`, `'opay'`, `'firs'`, `'nggis'`, etc.). Test files
 * and fixture files are auto-allowlisted at the scanner level.
 *
 * The platform's vision: provider routing must go through
 * `packages/connectors/src/registry.ts` (the connector registry) and
 * concrete provider names belong inside
 * `packages/connectors/src/adapters/`. A literal `'mpesa'` baked into a
 * business path silently couples that path to one provider.
 *
 * Legitimate categories tracked here:
 *   1. Domain-model Zod enums that enumerate the platform's currently-
 *      supported payment-method / provider types — these are the
 *      schema-level enumeration of WHICH providers exist (not which
 *      one to route to).
 *   2. Knowledge / persona / drift / PII catalogues that need provider
 *      names as detection patterns (e.g. detect "mpesa pin" in chat).
 *   3. Route-prefix / OpenAPI mounting tables that pin a Hono sub-router
 *      to its provider-specific URL prefix (`/gepg`, `/mpesa`).
 *   4. Composition / port-binding wires that pass typed adapter handles
 *      (the literal here is the property NAME on a DI container).
 *   5. Frontend UI pages that present a provider-specific flow
 *      (e.g. a provider-specific `/payments/mpesa` page IS
 *      the M-Pesa flow's UI).
 *
 * Adding a new provider literal in business logic → register here with a
 * justification ≥ 8 characters, OR route through the connector registry.
 *
 * Keys are paths RELATIVE to the repo root.
 */

export const HARDCODED_BANK_ALLOWLIST = new Map([
  // ─── Domain-model Zod enums / type unions ─────────────────────────
  [
    'packages/database/src/schemas/payment.schema.ts',
    'Drizzle schema payment-method enum lists supported providers; this IS the schema-level registry.',
  ],
  [
    'packages/domain-models/src/common/enums.ts',
    'Domain-model PaymentMethod enum maps MPESA → mpesa as the schema-level provider enumeration.',
  ],
  [
    'packages/domain-models/src/financial/transaction.ts',
    'Transaction Zod enum lists supported payment providers including mpesa as the canonical token.',
  ],
  [
    'packages/domain-models/src/maintenance/vendor.ts',
    'Vendor preferredPaymentMethod type union lists supported methods; mpesa is the canonical token.',
  ],
  [
    'packages/domain-models/src/payments/payment-method.ts',
    'PaymentMethod discriminated-union lists supported providers; mpesa is the canonical token.',
  ],

  // ─── Knowledge / case-study / persona / detection catalogues ──────
  [
    'packages/ai-copilot/src/knowledge/case-studies/11-short-cases.ts',
    'Knowledge case-study tags reference gepg/kra/mpesa as content discoverability metadata.',
  ],
  [
    'packages/ai-copilot/src/knowledge/platform-seed.ts',
    'Platform-seed playbook tags reference kra/mpesa/gepg as content discoverability metadata.',
  ],
  [
    'packages/ai-copilot/src/knowledge/policy-packs.ts',
    'Policy-pack tags reference kra/tra/ura as jurisdiction-scoped content discoverability metadata.',
  ],
  [
    'packages/ai-copilot/src/personas/sub-persona-types.ts',
    'Sub-persona-types enumerate mpesa/kra as canonical persona-domain identifiers in the persona registry.',
  ],
  [
    'packages/central-intelligence/src/kernel/critics/constitutional-critic.ts',
    'Constitutional-critic inviolable-ip pattern detects mpesa/till/api-key as secret-leak keywords in PII scrub.',
  ],
  [
    'packages/central-intelligence/src/kernel/drift-detector.ts',
    'Drift-detector keyword list includes kra/rera/pdpa as authority-name signals for drift classification.',
  ],
  [
    'packages/central-intelligence/src/kernel/tool-spec/hq-tools/index.ts',
    'HQ-tools type-spec exposes nida property name on the SeedHqBrainToolsDeps DI container.',
  ],

  // ─── api-gateway composition wires / mounted routers ──────────────
  [
    'services/api-gateway/src/composition/hq-tool-port-bindings.ts',
    'HQ-tool port-bindings access SeedHqBrainToolsDeps[nida] property; literal is DI-container key, not routing.',
  ],
  [
    'services/api-gateway/src/composition/hq-tool-registry.ts',
    'HQ-tool registry access SeedHqBrainToolsDeps[nida] property; literal is DI-container key, not routing.',
  ],
  [
    'services/api-gateway/src/health/deep-health.ts',
    'Deep-health probe enumerates per-rail health-check names (gepg, mpesa) for observability dashboard.',
  ],
  [
    'services/api-gateway/src/index.ts',
    'Hono index mounts router subtrees under /gepg, /mpesa URL prefixes; literal is the route prefix, not logic.',
  ],
  [
    'services/api-gateway/src/openapi/export-cli.ts',
    'OpenAPI export-cli enumerates mounted router prefixes (/gepg) for the spec export step.',
  ],
  [
    'services/api-gateway/src/openapi/mounted-routers.ts',
    'Mounted-routers table pins router subtrees to /gepg, /mpesa URL prefixes for the OpenAPI registry.',
  ],
  // ─── Document-intelligence + payments-ledger provider modules ─────
  [
    'services/document-intelligence/src/utils/name-matcher.ts',
    'Name-matcher utility enumerates common bank-name aliases (mpesa, airtel-money) for OCR fuzzy match.',
  ],
  [
    'services/payments-ledger/src/providers/mpesa-provider.ts',
    'M-Pesa provider module in payments-ledger is the M-Pesa adapter; literal is the adapter identity.',
  ],
  [
    'services/payments-ledger/src/server.ts',
    'Payments-ledger server enumerates provider names for the boot-time provider-resolution map.',
  ],

  // ─── Frontend-app provider-specific UI pages ──────────────────────
  [
    'apps/admin-platform-portal/src/app/mission-eval/MissionEvalClient.tsx',
    'Mission-eval UI references mpesa/kra as eval-scenario filter tokens; UI tag, not routing decision.',
  ],
  [
    'apps/admin-platform-portal/src/lib/session-replay/pii-mask.ts',
    'PII-mask uses mpesa as a detection keyword for session-replay redaction; observability tool.',
  ],
  [
    'packages/file-ingest/src/proposal/heuristic-map.ts',
    'Heuristic mapping of CSV column headers to entity attributes; "nida" is the KE national-ID schema-attribute label, not a routing decision.',
  ],
  [
    'packages/dynamic-sections/src/lib/adaptive-layout/policies/intent-policy.ts',
    'Adaptive-layout intent-policy compliance bucket contains kra/gepg as substring matchers for section IDs (e.g. detect "kra-filings" section); UI section-ID tokens, not provider routing.',
  ],

  // ─── WZ-CI-GREEN 2026-05-25: new sources flagged after WX/WY merges ─
  [
    'packages/database/src/seeds/trc-elastic-config.ts',
    'TRC elastic-config seed binds Tanzania jurisdiction default payment-provider to gepg — schema-level enumeration of the seeded default, not provider routing.',
  ],
  [
    'packages/document-analysis/src/extract/doc-classifier.ts',
    'Document classifier weight matrix uses gepg/nida as detection keywords for KE/TZ compliance documents — text-detection patterns, not provider routing.',
  ],
  [
    'packages/litfin-port-security-extra/src/webhook-signatures.ts',
    'LITFIN-port webhook-signature verifier dispatches by provider vendor (mpesa/gepg) to the matching HMAC scheme — signature-verification dispatch, not provider routing.',
  ],
  [
    'packages/payments-event-store/src/events.ts',
    'Payments event-store provider field is the schema-level enumeration of supported payment rails (mpesa|stripe|bank-transfer) — domain-model Zod enum, not provider routing.',
  ],
  [
    'packages/tab-need-detector/src/scoring-matrix.ts',
    'Tab-need-detector scoring matrix uses kra/tra as compliance-keyword detection tokens (e.g. detect "kra-filing" tab need); UI-tab-need detection patterns, not provider routing.',
  ],

  // ─── WZ-CI-GREEN 2026-06-13: non-gateway domain / NLP / UI flows ───
  [
    'packages/document-reconciliation/src/types.ts',
    'PROPERTY_DOC_TYPES tuple (backing a zod enum) lists nida as the canonical TZ national-ID document-type slug; doc-type taxonomy, not provider routing.',
  ],
  [
    'packages/swahili-intelligence/src/noun-roots.ts',
    'Swahili noun-root lexicon: "huduma" is the Swahili common noun for "service" in the linguistic dictionary — NLP false-positive, not the Huduma ID provider.',
  ],
  [
    'apps/tenant-mobile/app/(tabs)/kyc/index.tsx',
    'KYC wizard renders the nida step; literal is the KycStepKey step identity (TZ national-ID capture step), not provider routing.',
  ],
  [
    'apps/tenant-mobile/src/kyc/state.ts',
    'KYC wizard state machine: nida is a KycStepKey in the typed stepOrder for the national-ID capture step; step-key identity, not provider routing.',
  ],
  // ─── api-gateway payment-rail / jurisdiction bank literals (Mode-C grind, Borjie-parity) ───
  ['services/api-gateway/src/routes/gepg.hono.ts', 'GePG is the Tanzania government payment-gateway rail this dedicated route integrates; jurisdiction-pinned rail identity, not generic provider routing.'],
  ['services/api-gateway/src/routes/parity-capability-dashboard.hono.ts', 'Capability dashboard lists supported payment-rail names (mpesa/gepg) as capability labels; display registry, not a routing decision.'],
  ['services/api-gateway/src/routes/payments.ts', 'Payment channel literals (mpesa/...) are members of the PaymentProcessSchema zod enum mirroring the supported-rail set; schema contract, not hardcoded routing.'],
  ['services/api-gateway/src/services/cockpit-events/types.ts', 'Cockpit event type references a payment-rail name as an event discriminant; schema-level event identity.'],
  ['services/api-gateway/src/services/ingestion-intent-inferrer/heuristic.ts', 'Ingestion NLP heuristic matches rail keywords (mpesa/bank) in uploaded text to infer document intent; lexical matcher, not provider routing.'],
  ['services/api-gateway/src/services/jurisdiction-discovery/synthesizer.ts', 'Jurisdiction-discovery synthesizer maps a discovered country to its bank/mobile-money rails; the literals ARE the jurisdiction rail registry, not routing.'],

  // ─── Ported born-dark CORE packages (uplift parity) — 59-package sibling-vertical port, unconsumed by any running surface yet; sibling/PACK residue (mining regulators, NIDA detection patterns) re-instantiated at live-wiring per the Domain-Residue Scrub ───
  ['packages/ambient-listener/src/extract/entity-extractor.ts', "ported born-dark CORE package (uplift parity); sibling/PACK residue re-instantiated at live-wiring per the Domain-Residue Scrub — 'tra' is a mining-domain org-keyword in the reference entity-extractor lexicon (gold/tanzanite/tumemadini), not provider routing."],
  ['packages/cognitive-engine/src/ingest/pii-redactor.ts', "ported born-dark CORE package (uplift parity); sibling/PACK residue re-instantiated at live-wiring per the Domain-Residue Scrub — 'nida' is a PII-redaction pattern `kind` label (national-ID masking), not provider routing."],
  ['packages/data-onboarding/src/discovery/column-type-inferer.ts', "ported born-dark CORE package (uplift parity); sibling/PACK residue re-instantiated at live-wiring per the Domain-Residue Scrub — 'nida' is the inferred column-type slug for a national-ID column, not provider routing."],
  ['packages/data-onboarding/src/discovery/primary-key-detector.ts', "ported born-dark CORE package (uplift parity); sibling/PACK residue re-instantiated at live-wiring per the Domain-Residue Scrub — 'nida' is a candidate primary-key column name (national-ID), not provider routing."],
  ['packages/data-onboarding/src/enrichment/adapters/nida-verifier.ts', "ported born-dark CORE package (uplift parity); sibling/PACK residue re-instantiated at live-wiring per the Domain-Residue Scrub — 'nida' is this enrichment adapter's source identity (national-ID verifier), not provider routing."],
  ['packages/data-onboarding/src/enrichment/enrichment-orchestrator.ts', "ported born-dark CORE package (uplift parity); sibling/PACK residue re-instantiated at live-wiring per the Domain-Residue Scrub — 'nida' is an allowed-adapter id checked in the enrichment gate, not provider routing."],
  ['packages/data-onboarding/src/intent/entity-recognizer.ts', "ported born-dark CORE package (uplift parity); sibling/PACK residue re-instantiated at live-wiring per the Domain-Residue Scrub — 'nida' is a required-attribute synonym for the national-ID entity recognizer, not provider routing."],
  ['packages/omnidata/src/connector-base/pii-redactor.ts', "ported born-dark CORE package (uplift parity); sibling/PACK residue re-instantiated at live-wiring per the Domain-Residue Scrub — 'nida' is a sensitive field-name to redact (alongside tin/kraPin/mpesaNumber), not provider routing."],
  ['services/research-orchestrator/src/planner/plan-builder.ts', "ported born-dark CORE package (uplift parity); sibling/PACK residue re-instantiated at live-wiring per the Domain-Residue Scrub — 'tra' is a mining daily-briefing regulator (alongside tumemadini/nemc, minerals:['gold']) in the fallback template, not provider routing."],

  // ─── Existing (non-ported) legit payments-ledger infrastructure ───
  ['services/payments-ledger/src/services/disbursement.service.ts', "legit: M-Pesa B2C disbursement infrastructure — 'mpesa' is the provider-rail key for findByTransferId() row lookup on Safaricom B2C result/timeout callbacks and the provider.name match that selects the M-Pesa B2C rail by destination shape; the M-Pesa B2C callback handler is provider-specific by nature, not a generic routing decision."],
]);
