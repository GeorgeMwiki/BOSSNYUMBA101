# TODO Backlog

This file consolidates in-code `TODO` and `FIXME` markers across the monorepo as of the Wave-3 cleanup pass. Each entry should become a GitHub issue; once filed, annotate the source comment as `TODO(#<issue-number>): ...`.

Total: 93 markers (see `grep -rn "TODO\|FIXME" services/ packages/ apps/ --include="*.ts" --include="*.tsx"`).

## Category: AI persona wiring (7)

AI-persona callsites awaiting LLM client wiring via `packages/ai-copilot`.

- `services/domain-services/src/negotiation/negotiation-service.ts:161` — wire Anthropic client for negotiation LLM.
- `services/domain-services/src/inspections/conditional-survey/conditional-survey-service.ts:226,296` — narrative generation persona.
- `services/domain-services/src/inspections/far/far-scheduler.ts:45` — trigger-rule AI decisions.
- `services/domain-services/src/inspections/move-out/photo-comparator.ts:39` — visual diff persona.
- `services/domain-services/src/inspections/move-out/move-out-checklist-service.ts:472` — narrative descriptions.
- `services/document-intelligence/src/services/document-chat.service.ts:306` — RAG chat via Anthropic Messages.

## Category: Payments — GePG (5)

GePG Direct integration stubs; Daraja (M-Pesa) flow is wired, GePG awaits credentials + XML-DSig.

- `services/payments/src/providers/gepg/gepg-signature.ts:4,56` — XML-DSig / RSA verification.
- `services/payments/src/providers/gepg/gepg-client.ts:4,63,145` — SOAP/REST client, sandbox harness.
- `services/api-gateway/src/routes/gepg.router.ts:11` — XML-DSig mode.

## Category: Document rendering (7)

Document renderers awaiting third-party package install.

- `services/domain-services/src/documents/renderers/docxtemplater-renderer.ts:4,35` — install `docxtemplater` + `pizzip`.
- `services/domain-services/src/documents/renderers/typst-renderer.ts:4,30` — install Typst binary/bindings.
- `services/domain-services/src/documents/renderers/react-pdf-renderer.ts:4,31` — install `@react-pdf/renderer`.
- `services/domain-services/src/documents/renderers/nano-banana-imagery-renderer.ts:13,43` — Nano Banana HTTP client + credentials.
- `services/domain-services/src/documents/renderers/renderer-interface.ts:9` — tracking note.

## Category: Document scanning + OCR (7)

Native image ops + Textract stubs.

- `services/document-intelligence/src/scan/scan-service.ts:130,140,249` — WASM OpenCV deskew, pdf-lib assembly, storage fetch.
- `services/document-intelligence/src/services/embedding-service.ts:5,61` — OpenAI embeddings + batching.
- `services/document-intelligence/src/providers/types.ts:7` — Textract adapter stub.
- `packages/design-system/src/ScannerCamera.tsx:50,58,65,134` — getUserMedia, edge-detection, perspective crop, overlay.

## Category: Station-master routing / GeoNode (4)

Polygon coverage disabled until GeoNode goes live.

- `services/domain-services/src/routing/station-master-router.ts:83` — turf polygon containment.
- `services/domain-services/src/routing/types.ts:14` — polygon matching flag.
- `packages/database/src/schemas/station-master-coverage.schema.ts:29` — polygon handler.
- `apps/admin-portal/src/features/station-master-coverage/StationMasterCoverageEditor.tsx:8` — editor polygon mode.
- `apps/admin-portal/src/features/station-master-coverage/StationMasterCoverageMap.tsx:19,38` — coverage endpoint + Mapbox heatmap.

## Category: Identity + auth wiring (6)

- `services/identity/src/otp/otp-service.ts:15,83` — integrate notifications dispatcher.
- `apps/customer-app/src/contexts/AuthContext.tsx:59,64,160,180` — session exchange, org-token exchange, invite-code redemption.
- `apps/customer-app/src/components/OrgSwitcher.tsx:116` — `next/navigation` route for invite-code onboarding.

## Category: Migration (2)

- `services/api-gateway/src/routes/migration.router.ts:131` — wire MigrationWizardCopilot via BrainRegistry.
- `packages/ai-copilot/src/services/migration/parsers/xlsx-parser.ts:4,24`, `.../csv-parser.ts:22` — exceljs / papaparse dependency swap.

## Category: API-gateway filter push-down (2)

- `services/api-gateway/src/routes/properties.ts:64` — push filters into `repos.properties.findMany`.
- `services/api-gateway/src/routes/vendors.hono.ts:56` — push filters into `repos.vendors.findMany`.

## Category: Payments-ledger infra (1)

- `services/payments-ledger/src/middleware/mpesa-webhook.middleware.ts:11` — Redis-backed replay protection for multi-replica deployments.

## Category: Customer-app UI wiring (7)

- `apps/customer-app/src/app/settings/notifications/page.tsx:38,63` — GET/PUT notification prefs.
- `apps/customer-app/src/app/marketplace/[unitId]/negotiate/page.tsx:36,71` — marketplace + negotiations endpoints.
- `apps/customer-app/src/app/lease/move-out/disputes/page.tsx:29,52` — disputes GET/POST.
- `apps/customer-app/src/app/lease/sublease/page.tsx:35` — sublease POST.
- `apps/customer-app/src/app/requests/letters/page.tsx:32` — letters request.

## Category: Owner-portal UI wiring (8)

- `apps/owner-portal/src/features/damage-deductions/DamageDeductionApproval.tsx:26,45`.
- `apps/owner-portal/src/features/negotiations/NegotiationsList.tsx:25,44`.
- `apps/owner-portal/src/features/gamification/GamificationDashboard.tsx:25,42`.
- `apps/owner-portal/src/features/conditional-surveys/SurveyApprovalsQueue.tsx:22,35`.

## Category: Admin-portal UI wiring (6)

- `apps/admin-portal/src/features/gepg-config/GepgCredentialsForm.tsx:35`.
- `apps/admin-portal/src/features/compliance/ComplianceExports.tsx:21,34`.
- `apps/admin-portal/src/features/policies/ApprovalPolicyEditor.tsx:4,37,104`.

## Category: Estate-manager-app UI wiring (11)

- `apps/estate-manager-app/src/app/negotiations/page.tsx:21`.
- `apps/estate-manager-app/src/app/tenders/page.tsx:19`.
- `apps/estate-manager-app/src/app/payments/arrears/page.tsx:8,27` — + TanStack Table virtualization.
- `apps/estate-manager-app/src/app/inspections/conditional-surveys/page.tsx:18`.
- `apps/estate-manager-app/src/app/inspections/move-out/page.tsx:18`.
- `apps/estate-manager-app/src/app/units/[id]/subdivide/page.tsx:41`.
- `apps/estate-manager-app/src/app/units/[id]/components/page.tsx:27`.
- `apps/estate-manager-app/src/app/leases/[id]/renewal/page.tsx:24,45`.
- `apps/estate-manager-app/src/app/leases/[id]/move-out/page.tsx:42`.
- `apps/estate-manager-app/src/app/documents/chat/page.tsx:37`.

## Category: Reports / UI polish (1)

- `services/reports/src/generators/interactive-html-generator.ts:61` — videojs/Plyr skinned player.

## Category: Type safety — internal `any` (89 occurrences)

Zero `any` usages in exported barrel APIs (`packages/*/src/index.ts`) — public API surface is clean.

Service-internal `any` usages cluster in:

- `services/api-gateway/src/routes/*.ts` — Hono `c: any` handler params (should use `Context<Env>` from hono); row mappers in `db-mappers.ts` accepting `row: any`.
- `services/api-gateway/src/routes/customers.ts`, `invoices.ts`, `users.hono.ts` — repo type (`repos: any`) and `row: any` in enrichment helpers.
- `services/identity/src/postgres-invite-code-repository.ts:231` — `rawRows: any[]` from Drizzle locked-query result.

Recommendation (backlog): tighten gateway handler context to `Context<{ Variables: { auth: AuthPrincipal; db: DatabaseClient; repos: Repos } }>`; replace row maps with Drizzle `InferSelectModel<typeof table>` types from `@bossnyumba/database`.

## Workflow

1. For each category above, open a tracking issue (or epic) on GitHub.
2. Replace `TODO:` / `FIXME:` in the source with `TODO(#<issue>): <original text>`.
3. When landing the implementation, remove the `TODO(#N):` marker and close the issue.
