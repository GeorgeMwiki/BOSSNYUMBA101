# Omnidata Connector Inventory — Design Specification

> The catalogue of every external source Boss Nyumba will ingest into
> Mr. Mwikila's awareness. Pillar 1 of
> [`CAPABILITY_BOOST_VISION.md`](../STRATEGY/CAPABILITY_BOOST_VISION.md).
> Sibling specs:
> [`TACIT_KNOWLEDGE_HARVESTING_SPEC.md`](./TACIT_KNOWLEDGE_HARVESTING_SPEC.md),
> [`CAPABILITY_CATALOGUE_SPEC.md`](./CAPABILITY_CATALOGUE_SPEC.md),
> [`SELF_IMPROVING_LOOPS_SPEC.md`](./SELF_IMPROVING_LOOPS_SPEC.md),
> [`DATA_ONBOARDING_SPEC.md`](./DATA_ONBOARDING_SPEC.md),
> [`COGNITIVE_ENGINE_SPEC.md`](./COGNITIVE_ENGINE_SPEC.md).

Brand: Boss Nyumba. Persona: Mr. Mwikila — Boss Nyumba's autonomous
Central Estate Manager for Tanzanian property operators. Status:
design-spec. The package scaffold (`packages/omnidata/`) lands
Borjie-side first; Boss Nyumba port follows once interfaces are
proven on the mining vertical.

---

## 1. Vision — Why Omnidata Matters

The founder, verbatim:

> "MD is aware of every data point — no knowledge missed, used or
> unanalysed organisation-wide. Utilisation of all this — information
> historically in different areas such as Slack, email, Notion,
> Instagram, WhatsApp, Facebook, TikTok, Salesforce etc — or heads of
> people — by stitching them into domain knowledge for the
> organisation."

Every property business already runs on a dozen tools. Slack or
WhatsApp groups for caretaker ops. Gmail or Outlook for tenant
correspondence. WhatsApp for everything Tanzanian (rent reminders,
maintenance calls, tenant negotiations). Notion or Google Docs for
the rental playbook. Google Drive / OneDrive / Dropbox for lease
PDFs and inspection photos. Salesforce or HubSpot for prospect /
tenant CRM. Linear / Jira / Asana for maintenance tickets.
GitHub / GitLab for any in-house tech. Zoom / Meet for tenant
inductions. Instagram, Facebook, TikTok, LinkedIn for the marketing
surface. M-Pesa, NBC, CRDB for the rent collection. QuickBooks, Xero,
or Tally for the accounting. And — uniquely for Boss Nyumba's domain —
TANESCO LUKU, water-utility portals, Manispaa local-government portals,
NHC / NSSF for employer-funded housing.

Mr. Mwikila cannot be a real Central Estate Manager until he sees
them all. This document is the contract for how each source enters
his awareness.

---

## 2. Connector Field Definitions

Every entry below carries the same eight fields:

- **Connector kind** — OAuth 2.0 REST API / IMAP / Webhook / Browser
  automation / Manual export / MCP server (Anthropic spec).
- **Data shape ingested** — messages, files, contacts, events, posts,
  transcripts, ledger entries, utility-bill records, etc.
- **Auth flow** — OAuth 2.0 (which scopes), API key (env var),
  Webhook secret (HMAC), Browser session (cookie jar via Playwright),
  Manual upload (signed URL).
- **Refresh cadence** — real-time (webhook-driven) / hourly / daily
  delta / on-demand only.
- **PII handling** — boundary-redact, hash-salt-on-store (NIDA, TIN),
  encrypt at rest (Supabase Vault), consent-gated retention.
- **Volume class** — light (<10 MB/day), medium (10 MB–1 GB/day),
  heavy (>1 GB/day).
- **Phase** — P0 (Month 1), P1 (Months 2–4), P2 (Months 5–6), P3
  (selective per-tenant demand).
- **MCP server opportunity** — ship as an MCP server under
  `services/mcp-server-<source>/`? Yes / No / Already-shipped.

---

## 3. P0 — Critical Connectors (Month 1)

These six are the minimum surface area for capability boost to feel
like a real property-management brain. Every Tanzanian estate firm
has at least two; most have three or four.

### 3.1 Slack

- **Connector kind:** OAuth 2.0 REST API + Events API (webhook).
- **Data shape ingested:** channel messages, thread replies, DM
  messages (consent-gated, off by default), file attachments, user /
  channel metadata, reactions, pinned items, app events.
- **Auth flow:** OAuth 2.0; Enterprise Grid orgs require org-level
  install with `is_enterprise_install=true` per
  [api.slack.com / enterprise / developing](https://api.slack.com/enterprise/developing).
  Scopes: `channels:history`, `groups:history`, `im:history` (gated),
  `files:read`, `users:read`, `team:read`.
- **Refresh cadence:** real-time (Events API push); scheduled hourly
  backfill via `conversations.history` for resilience.
- **PII handling:** boundary-redact emails / phones / KRA-PIN / NIDA /
  TIN; DM ingestion is opt-in per-user.
- **Volume class:** medium.
- **Phase:** P0.
- **MCP server opportunity:** Yes — `services/mcp-server-slack/`.
  Slack is one of the named MCP launch partners
  ([anthropic.com / news / model-context-protocol](https://www.anthropic.com/news/model-context-protocol)).

### 3.2 Gmail / Outlook

- **Connector kind:** OAuth 2.0 REST API (Gmail API / Microsoft Graph)
  + IMAP fallback.
- **Data shape ingested:** message headers + body + attachments,
  thread structure, labels / categories, contacts, calendar invites.
- **Auth flow:** OAuth 2.0; Gmail scopes `gmail.readonly`,
  `gmail.metadata`; Graph scopes `Mail.Read`, `Contacts.Read`,
  `Calendars.Read`.
- **Refresh cadence:** push notifications (Pub/Sub watch / Graph
  subscriptions); daily delta as fallback.
- **PII handling:** boundary-redact + hash-salt PII inside body text;
  attachments route through `packages/document-analysis/` for OCR +
  PII strip.
- **Volume class:** medium.
- **Phase:** P0.
- **MCP server opportunity:** Yes — combined
  `services/mcp-server-mail/`.

### 3.3 Google Calendar / Outlook Calendar

- **Connector kind:** OAuth 2.0 REST API.
- **Data shape ingested:** events (lease signings, inspections,
  tenant inductions), attendees, recurring rules, attached meeting
  links.
- **Auth flow:** shares the Gmail / Outlook bundle.
- **Refresh cadence:** push notifications; real-time.
- **PII handling:** attendee emails redacted on store; org-internal
  attendees retain readable values.
- **Volume class:** light.
- **Phase:** P0.
- **MCP server opportunity:** Yes — folded into
  `services/mcp-server-mail/`.

### 3.4 WhatsApp Business Cloud API

- **Connector kind:** Webhook + Meta Cloud API REST. Per
  [chatarmin.com — WhatsApp Cloud API guide 2026](https://chatarmin.com/en/blog/whatsapp-cloudapi)
  the Cloud API has been Meta's only path since October 2025.
- **Data shape ingested:** inbound + outbound messages, media (image,
  audio, document, video), reactions, template responses, contact
  cards, read receipts.
- **Auth flow:** Meta system-user access token + webhook HMAC secret.
- **Refresh cadence:** real-time (webhook); no backfill for history
  older than webhook activation — forward-capture only.
- **PII handling:** phone numbers hash-salted; media downloaded into
  Supabase Storage with boundary-PII strip; consent-gated per
  contact.
- **Volume class:** medium.
- **Phase:** P0.
- **MCP server opportunity:** Yes — `services/mcp-server-whatsapp/`.
  **Critical for property:** WhatsApp is the default channel for
  rent reminders, maintenance ticketing, and tenant negotiation.

### 3.5 Notion

- **Connector kind:** OAuth 2.0 REST API.
- **Data shape ingested:** pages, blocks, databases (rental
  playbooks, tenant lists, maintenance trackers).
- **Auth flow:** OAuth 2.0; workspace-level grant.
- **Refresh cadence:** daily delta via `last_edited_time` filter;
  on-demand re-sync triggered by chat-detected page mentions.
- **PII handling:** boundary-redact page content; preserve page IDs
  for citation.
- **Volume class:** medium.
- **Phase:** P0.
- **MCP server opportunity:** Yes — `services/mcp-server-notion/`.

### 3.6 Google Drive / OneDrive / Dropbox

- **Connector kind:** OAuth 2.0 REST API.
- **Data shape ingested:** file metadata + content (lease PDFs,
  inspection photos, ID scans), folder structure, sharing acls.
- **Auth flow:** OAuth 2.0; user opt-in per folder (not whole-drive
  by default).
- **Refresh cadence:** push notifications + nightly delta sweep.
- **PII handling:** content routes through
  `packages/document-analysis/` OCR + PII strip; file metadata
  stored separately from content.
- **Volume class:** heavy.
- **Phase:** P0.
- **MCP server opportunity:** Yes — combined
  `services/mcp-server-drive/`.

---

## 4. P1 — High-Value Connectors (Months 2–4)

### 4.1 Microsoft Teams

- **Kind:** OAuth 2.0 (Microsoft Graph) + Webhook subscriptions.
- **Data:** channel messages, chat DMs, meeting recordings +
  transcripts.
- **Auth:** Graph scopes `ChannelMessage.Read.All`, `Chat.Read`,
  `OnlineMeetingRecording.Read.All`.
- **Refresh:** real-time webhook + hourly backfill.
- **PII:** standard boundary redaction; transcripts via
  `@bossnyumba/audio-capture`.
- **Volume:** medium. **MCP:** Yes — `services/mcp-server-teams/`.

### 4.2 Salesforce

- **Kind:** OAuth 2.0 REST API + Streaming / CDC.
- **Data:** Accounts (landlord + corporate-tenant), Contacts (lead
  tenants), Opportunities (corporate-let deals), Activities, Tasks,
  Cases (maintenance).
- **Auth:** Connected App OAuth 2.0; refresh tokens rotated.
- **Refresh:** Streaming push + daily delta.
- **PII:** standard; preserve record IDs.
- **Volume:** medium. **MCP:** Yes (Salesforce is an MCP launch
  partner per
  [anthropic.com / model-context-protocol](https://www.anthropic.com/news/model-context-protocol)).

### 4.3 HubSpot

- **Kind:** OAuth 2.0 REST + Webhooks.
- **Data:** Contacts, Companies, Deals, Tickets, Engagements.
- **Auth:** OAuth 2.0; HubSpot app scopes.
- **Refresh:** webhook real-time + daily delta.
- **PII:** standard. **Volume:** medium. **MCP:** Yes.

### 4.4 Linear / Jira / Asana

- **Kind:** OAuth 2.0 REST + Webhooks.
- **Data:** maintenance tickets / tasks, comments, status
  transitions, attachments.
- **Auth:** OAuth 2.0 per-vendor.
- **Refresh:** webhook real-time.
- **PII:** light. **Volume:** light. **MCP:** Yes.

### 4.5 GitHub / GitLab

- **Kind:** OAuth 2.0 REST + GraphQL + Webhooks.
- **Data:** PRs, commits, issues, comments, CI status (where the
  firm has in-house tech).
- **Auth:** OAuth 2.0 per-vendor.
- **Refresh:** webhook real-time.
- **PII:** light. **Volume:** medium. **MCP:** Yes.

### 4.6 Zoom / Meet Recordings

- **Kind:** OAuth 2.0 REST + Webhooks.
- **Data:** meeting metadata, recording URLs, auto-transcribed
  transcripts (tenant inductions, owner reviews).
- **Auth:** OAuth 2.0.
- **Refresh:** webhook on `recording.completed`.
- **PII:** transcripts route through boundary redactor.
- **Volume:** heavy. **MCP:** No — recordings via drive connector +
  audio-capture pipeline.

### 4.7 Phone Calls (Vapi / Retell / Twilio)

- **Kind:** Webhook + REST API.
- **Data:** call recordings, transcripts, metadata.
- **Auth:** API key; webhook HMAC secret.
- **Refresh:** real-time webhook on `call.ended`.
- **PII:** phone hash-salted; transcripts boundary-redacted.
- **Volume:** light per call; medium per tenant.
- **MCP:** No — covered by existing `services/voice-agent/` integration.

---

## 5. P2 — Public Social Connectors (Months 5–6, marketing-side)

These power the marketing-side capabilities (property listings,
audience intelligence, neighbourhood brand monitoring).

- **Instagram Business** — Meta Graph API; DMs, comments, posts.
  OAuth 2.0; webhooks. Volume: medium. MCP: Yes.
- **Facebook Pages** — Meta Graph API; page posts, comments, Page
  Inbox messages. Shares the Meta OAuth bundle. Volume: medium.
- **TikTok for Business** — TikTok API for Business; posts,
  comments, view metrics. OAuth 2.0; webhooks. Volume: light.
- **Twitter / X** — paid X API tier (Basic / Pro); tweets, replies,
  DMs (DM scope is restricted). Volume: light.
- **LinkedIn Page** — LinkedIn Marketing API; page posts, comments,
  follower analytics. OAuth 2.0. Volume: light.
- **YouTube Channel** — YouTube Data API; videos, comments,
  analytics. OAuth 2.0. Volume: light.

---

## 6. P3 — Specialised Connectors (Per-Tenant Demand)

- **TANESCO LUKU portal** — browser automation via Playwright +
  scheduled scrape; landlord prepaid-electricity vending records.
  Auth: tenant-specific credentials in Supabase Vault. Volume:
  light. MCP: Yes (build).
- **Water utility portals (DAWASA, etc.)** — browser automation;
  billing records, outage notices. Same pattern as LUKU.
- **Manispaa local-government portals** — browser automation;
  property-tax filings, land permits. Per-region (Kinondoni,
  Ilala, Ubungo, Temeke, ...).
- **NHC / NSSF portals** — corporate-housing flows; browser
  automation.
- **Bank statements (M-Pesa, NBC, CRDB)** — Stitch / Mono / Pngme
  aggregator APIs where available; OFX file upload + parse where
  not. Volume: light. MCP: optional.
- **QuickBooks / Xero / Tally** — OAuth 2.0 REST API; chart-of-
  accounts, journals, invoices. Refresh: hourly delta. MCP: Yes —
  `services/mcp-server-accounting/`.
- **TRA portal** — corporate-tax + VAT filing flows for the property
  firm itself. Re-uses the
  `services/mcp-server-tra/` pattern from the Borjie sibling repo.

---

## 7. The MCP (Model Context Protocol) Opportunity

Anthropic's MCP — donated to the Agentic AI Foundation under the
Linux Foundation in December 2025 ([en.wikipedia.org / Model_Context_Protocol](https://en.wikipedia.org/wiki/Model_Context_Protocol))
— is now the de-facto open standard for AI ↔ external-system
bindings. ~10,000+ active MCP servers run in production per WorkOS's
2026 survey ([workos.com — MCP in 2026](https://workos.com/blog/everything-your-team-needs-to-know-about-mcp-in-2026)).
Boss Nyumba's strategic position mirrors Borjie's:

1. **All P0 + P1 + most P2 connectors ship as MCP servers** under
   `services/mcp-server-<source>/`. One source of truth, two
   transports.
2. **The `@bossnyumba/omnidata` package wraps the MCP server in the
   omnidata connector contract** — adding sync scheduling, PII
   redaction, provenance stamping, audit-hash-chain integration.
3. **Boss Nyumba publishes its property-domain MCP servers to the
   MCP Registry** so the Tanzanian developer ecosystem can compose
   Boss Nyumba connectors into their own Claude apps.

---

## 8. The Sync Scheduler — Cadence + Backpressure

Every connector declares a `RefreshPolicy`:

```typescript
export type RefreshPolicy =
  | { readonly kind: 'realtime'; readonly webhookSecret: string }
  | { readonly kind: 'pushed'; readonly subscriptionToken: string }
  | { readonly kind: 'cron'; readonly cron: string; readonly maxRowsPerRun: number }
  | { readonly kind: 'on-demand' };
```

Scheduler (`services/omnidata-sync-worker/`) honours per-connector
rate-limits via the existing token-bucket and backs off automatically
on `429` / `503` upstream.

---

## 9. Provenance + Audit

Every ingested item carries an `OmnidataIngestedItem` envelope with
audit-hash anchoring. Identical contract to Borjie:

```typescript
export interface OmnidataIngestedItem<T = unknown> {
  readonly id: string;
  readonly tenant_id: string;
  readonly connector_id: string;
  readonly source_kind: OmnidataSourceKind;
  readonly source_record_id: string;
  readonly retrieved_at: string;
  readonly payload: T;
  readonly redaction_applied: ReadonlyArray<string>;
  readonly consent_record_id: string | null;
  readonly audit_hash: string;
}
```

---

## 10. Anti-Patterns

Mr. Mwikila MUST NOT, at the omnidata layer:

1. **Ingest without scope.** No "give me everything" sweeps.
2. **Cross PII to LLM unredacted.** Boundary redactor enforced at
   the contract level.
3. **Store DMs without per-user consent.** WhatsApp 1:1 threads,
   Gmail personal mail — all require an explicit consent record.
4. **Skip audit-hash anchoring.** Every ingested item gets a
   hash-chain entry.
5. **Ignore rate-limits.** Hitting `429` widens the next-sync
   interval automatically.
6. **Fabricate source identifiers.** Every item carries the upstream
   `source_record_id` exactly as given.

---

## 11. Schema Additions

New migration adds:

- `omnidata_connectors` — installed-connector registry per tenant.
- `omnidata_ingested_items` — every envelope, partitioned by
  tenant_id + retrieved_at month.
- `omnidata_sync_audit` — sync attempt log.
- `omnidata_consent_records` — per-user / per-channel consent.

Indexes: `(tenant_id, connector_id, retrieved_at DESC)`,
`(tenant_id, source_kind, source_record_id)` unique.

---

## 12. Cross-Spec Integration Map

- **Tacit knowledge:** harvested `KnowHowArtifact`s reference
  `OmnidataIngestedItem`s in `evidence_citations`.
- **Capability catalogue:** capability measurements pull from
  `omnidata_ingested_items` aggregations (e.g. "rent-collection
  success rate" derived from M-Pesa + WhatsApp thread timings).
- **Self-improving loops:** cross-tenant federation reads (PII-
  stripped, DP-bounded) aggregates of `omnidata_ingested_items`.
- **Cognitive memory:** new `MemoryKind = 'connector_signal'` lets
  the unified-memory store learn "tenant X tends to ask about
  water pressure between 18:00–20:00" as a first-class memory cell.
- **Data onboarding:** when a connector first activates, the
  initial backfill flows through the 7-stage onboarding pipeline.

This is the connector inventory. Real implementations follow in
dedicated sub-waves per source.
