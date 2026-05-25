# Cross-Tool Intelligence Stitching — SOTA 2026 Research

**Date:** 2026-05-23
**Scope:** Unified semantic layer pattern — Slack + Linear + GitHub + Notion + CRM + calls + email + M-Pesa + property portals all becoming one queryable layer for AI agents.
**Target packages:** `packages/connectors/`, `packages/graph-sync/`, `packages/central-intelligence/`

---

## Executive Summary

By May 2026, the "unified intelligence plane" pattern has collapsed into a clear architectural consensus:

1. **Connectors** (deep, push-based, permission-aware) feed into
2. **CDC streams** (CloudEvents-shaped, exactly-once) hitting
3. **An entity-resolved Work Graph** (per-tenant, ontology-typed) that is
4. **Exposed via MCP** (federated > synced where possible) with
5. **ACL-at-retrieval-time** (never post-filter, never trust the index alone)

Glean, Microsoft Copilot, Atlassian Rovo, Anthropic Cowork, and OpenAI ChatGPT Apps SDK have all converged on this shape. The differentiation in 2026 is no longer "do you have connectors?" — it's connector *depth*, permission *fidelity*, freshness *latency*, and ontology *expressiveness*.

For BOSSNYUMBA, the win is to be the **only** intelligence plane that natively reasons across EA-specific tools (M-Pesa, Smile ID, BuyRentKenya, Lamudi, KRA iTax, water/electricity utilities, vendor WhatsApp threads) that none of the global players will ever ship native connectors for.

---

## 1. Frontier "Unified Intelligence" Platforms (May 2026)

### 1.1 Glean Work AI — the architectural reference
- **What it is:** 100+ deep connectors + unified index + Enterprise Graph + Personal Graph + Agents + Memory. Recently called the "system of context" by Glean themselves.
- **SOTA approach:** Centralized index unifies all sources; the Enterprise Graph maps entities (people, teams, projects, docs) while the Personal Graph layers individual work patterns (tasks, relationships, recurring work). Permissions are enforced at *retrieval* using the requesting user's ACL inheritance from each source system.
- **Reference architecture:** `Source → Connector (deep crawl + delta) → Permission-aware index → Enterprise Graph + Personal Graph + Memory → Assistant / Agents → User`
- **Quote-worthy stat:** Glean blog (2026) claims results preferred ~2× more than ChatGPT and 1.6× more than Claude in enterprise eval. They explicitly position against "shallow MCP-only" approaches — their pitch is *deep* indexing > federated tool calls.
- **OSS equivalent:** Danswer / Onyx (forked), Quivr, Dust.
- **BOSSNYUMBA gap:** We have `central-intelligence` but not the Personal Graph dimension. We need a "tenant-staff personal graph" overlay on the tenant graph.

### 1.2 Decagon — voice + workflow-control
- $4.5B valuation Jan 2026, raised ~$491M total. Focus on **Agent Operating Procedures (AOPs)** — natural-language workflow definitions that execute deterministically across CRM/ticketing systems.
- **Why it matters:** AOPs are the right abstraction for property management — "rent overdue 5 days → WhatsApp tenant → if no response 24h → escalate to property manager via Slack → if no response 48h → draft demand letter in DocuSign." We already have `aop-compiler` package — this validates the bet.

### 1.3 Maven AGI — integration-depth-as-moat
- $78M raised. Wedge: **measured on resolution rate**, not just deflection. Deep Salesforce, Zendesk, HubSpot integration. They sell against Decagon by emphasizing enterprise security + audit + measurement.
- **Pattern to copy:** outcome-priced AI ($0.50/resolved conv on HubSpot Breeze, similar on Maven) — BOSSNYUMBA could price "AI rent-collected" or "AI maintenance-closed" rather than seats.

### 1.4 Hebbia Matrix — document agent grid
- April 2026: 1B+ pages processed (21× YoY). **Iterative Source Decomposition (ISD)** processes whole documents without chunking. Projects inherit permissions; Email Agent (`intern@hebbia.ai`) lets users delegate research via email.
- **Pattern to copy:** the **tabular agent grid** — a row per entity (tenant, lease, unit), columns are LLM-computed assertions ("rent-current?", "complaint-open?", "lease-expiring-90d?"). This is the right UI for property portfolios.

### 1.5 Microsoft Copilot + Graph Connectors
- **100+ Graph Connectors.** Two models now (critical):
  - **Synced connectors** → ingest into Microsoft Graph index.
  - **Federated connectors** → real-time via MCP without indexing.
- This dual model is the SOTA — index *cold* corpora (docs, wikis), federate *hot* operational systems (CRM, ticketing). BOSSNYUMBA should adopt the same split.

### 1.6 Anthropic Claude Cowork (Feb 2026)
- New connectors: Google Workspace (Calendar/Drive/Gmail), DocuSign, Apollo, Clay, Outreach, Similarweb, MSCI, LegalZoom, FactSet, WordPress, Harvey + 9 creative tools (Blender/Adobe) in April.
- **Industry-specific plugin bundles** (HR, IB, design, ops, PE, wealth).
- May 2026: **Claude for Small Business** — 15 prebuilt workflows + 15 skills + QuickBooks/PayPal/HubSpot/Canva/DocuSign/Workspace/M365 connectors. This is the playbook for BOSSNYUMBA's vertical bundle.

### 1.7 OpenAI ChatGPT Apps SDK (preview Nov 2025; GA Q1 2026)
- "Connectors" renamed to "Apps" Dec 17, 2025 — now covers interactive-UI apps + search/reference connectors. Full MCP support including **write/modify** actions.
- Developer mode for Enterprise/Edu admins lets devs upload + test MCP apps privately.
- **Lesson:** the connector ecosystem is consolidating onto MCP. Build BOSSNYUMBA's MCP server to support both Claude and ChatGPT and Copilot Studio from day one.

### 1.8 Salesforce Agentforce
- 18,500 customers, **3B monthly workflows** by early 2026. Built on Einstein AI + Data Cloud — autonomous multi-step workflows across the Salesforce ecosystem.
- **Pattern to copy:** Data Cloud as the unified semantic substrate. BOSSNYUMBA's `central-intelligence` should be our "Data Cloud" — every connector lands here first.

### 1.9 HubSpot Breeze
- AI integrated across all hubs, free tier included. April 14, 2026: moved to **outcome-based pricing** — $0.50/resolved conv, $1/qualified lead.
- HubSpot's MCP Connectors play means external agents (Claude, ChatGPT) can talk to HubSpot — pressure to be **MCP-server-first** rather than MCP-client-first.

### 1.10 Notion AI + Atlassian Rovo
- **Atlassian Teamwork Graph (May 2026, Team '26 event):** "150 billion connections" living shared context layer. 50+ third-party connectors (SharePoint, Slack, Salesforce, Notion). 90%+ of Atlassian enterprise cloud customers on Rovo.
- Notion AI has two-way Slack integration; Notion pages flow into Rovo with permission inheritance.
- **Pattern to copy:** Atlassian's "Teamwork Graph" branding. BOSSNYUMBA should have a **"Property Graph"** — the answer to "how many connections live in your tenant's graph?"

### 1.11 Cresta — contact center
- March 17, 2026: **Knowledge Agent** — browser-sidebar that follows agents across CRM/billing tabs, fuses **live audio + on-screen context**, eliminates toggle-tax.
- Pattern for property management: a **Maintenance Coordinator Sidebar** that follows the staff member across WhatsApp, Sheets, vendor portals, KPLC, and surfaces the right action.

---

## 2. MCP Catalog Wins (May 2026)

| Catalog | Servers | Niche | BOSSNYUMBA fit |
|---|---|---|---|
| **Glama** | 22,775 indexed | Largest registry | Discover but don't depend |
| **Smithery** | 7,000+ | "Docker Hub for MCP" — hosted + local | Use for prototyping; not prod |
| **Composio** | 300+ MCP (toolkits) | Managed auth, enterprise-grade | **Prod-ready dependency for the long tail** |
| **Pipedream MCP** | Massive (every Pipedream app) | Auto-generated from Pipedream apps | Backup for any tool we don't ship native |
| **Cloudflare MCP** | 13+ official servers | DNS/CDN/Workers/security + sandboxes (with Daytona/Modal/Vercel) | **Use Cloudflare MCP tunnels for private agent access to BOSSNYUMBA backends** |
| **Mintlify MCP** | Doc-derived servers | Auto-generated from product docs | Generate one from our own API docs |
| **Anthropic Remote MCP** | Cowork connector library | First-party Anthropic | Primary distribution channel for Claude users |
| **Atlassian Remote MCP** | Jira/Confluence/Compass | First-party Atlassian | Bridge to teams that live in Jira |

**Key insight:** Smithery wins discovery; Composio wins production reliability. BOSSNYUMBA should publish to Smithery for visibility but architect against Composio's enterprise pattern (managed OAuth, secret vault, retry/idempotency).

**Anthropic MCP Tunnels (May 2026, InfoQ):** Private agent access to internal systems via tunneled connections. Critical for property managers who run on-prem accounting (Sage, Tally, Pastel are common in EA) — the tunnel pattern lets us reach those without exposing them publicly.

---

## 3. Unified Semantic Layer Patterns

### SOTA pattern (Atlan + DataHub + Open Semantic Interchange consensus)
A unified context layer has **five layers**, not one:

```
┌──────────────────────────────────────────────────────┐
│ Active Metadata (lineage, freshness, decision memory) │
├──────────────────────────────────────────────────────┤
│ Operational Playbooks (routing, governance, escalation)│
├──────────────────────────────────────────────────────┤
│ Ontology (entity relationships, taxonomy)              │
├──────────────────────────────────────────────────────┤
│ Semantic Layer (governed metrics, dimensions)          │
├──────────────────────────────────────────────────────┤
│ Storage / Vector / Graph (physical substrate)          │
└──────────────────────────────────────────────────────┘
```

**Industry convergence (Atlan, May 2026):** "Open Semantic Interchange (OSI)" effort is unifying semantic-layer definitions across vendors. BOSSNYUMBA's ontology should target OSI-compatibility from the start.

**Ontology vs Semantic Layer split (DataHub blog):** Use the **ontology** for *cross-system identity* (the Property entity, the Tenant entity, the Lease entity) and the **semantic layer** for *governed metrics* (occupancy rate, collection rate, NOI). They reference the same IDs but solve different problems. BOSSNYUMBA needs *both* — our `domain-models` package is the ontology; we need a separate semantic-metrics layer.

**Freshness signals are mandatory:** Every entity in the graph must carry `last_synced_at`, `source_id`, `source_ttl`, and a lineage chain. AI assertions must cite freshness or be flagged stale.

### Reference Implementations
- **Atlas (Apache)** + **DataHub** for catalog + lineage
- **Cube.dev** + **dbt Semantic Layer** + **AtScale** for metrics
- **TigerGraph / Neo4j / Apache AGE (Postgres)** for graph

---

## 4. Identity Resolution Across Tools

### Person resolution
- **Senzing:** API-first, ML-based, real-time entity resolution. Purpose-built. Most expensive.
- **Zingg (OSS):** Active-learning ER on Databricks-native. Best fit for our budget.
- **Tilores:** Flexible entity resolution platform; lighter weight.
- **Awesome-Entity-Resolution (OlivierBinette/GitHub):** the canonical OSS landscape.

### Property-management-specific (household resolution)
Critical insight: **the entity is rarely a single person.** A lease has multiple lessees ("co-tenants"), a household has primary tenant + spouse + dependents + occasional occupants. Standard person-ER fails here.

**Pattern for BOSSNYUMBA:**
```
Person ←→ Household ←→ Lease ←→ Unit ←→ Property
   ↑          ↑          ↑        ↑         ↑
M-Pesa MSISDN│Lease PDF │ MoU   │Photos │KRA PIN/title deed
KYC ID       │WhatsApp  │ KRA   │meter  │maps coordinate
Smile ID     │group chat│ filing│reading│
```

Each edge is a **resolution candidate** with confidence score. Use Zingg for the person→household resolution + a property-specific rule engine for the rest. Don't try to be Senzing.

**Reference:** AWS multi-tenant RAG with JWT pattern (Bedrock + OpenSearch) — JWT carries the tenant_id + user_id + role, used at retrieval-time as a hard filter at the vector index level (not post-filter).

---

## 5. Permission Inheritance Through Unified Retrieval

### The 2026 rule (Truto, Medium, Kiteworks consensus)
**Permissions are a first-class data model alongside content.** Synced through the same pipeline, versioned the same way, enforced at filter-time *and* at authorization-check-time.

### Anti-patterns to avoid
- **Post-filter authorization** — retrieving then filtering. Dangerous: model can leak via attention even if final output is filtered.
- **Trusting the index alone** — index ACLs can stale; re-verify at retrieval.
- **Cross-tenant index reuse** — tenant_id must be hard-isolated at the **vector index level**, not just a metadata field.

### The pattern
```typescript
// Every chunk carries:
{
  content: string
  embedding: number[]
  tenant_id: string         // hard isolation key — own index per tenant
  acl: string[]             // normalized ACL array
  acl_version: number       // for instant cache invalidation
  source_id: string         // which source system
  source_acl_ref: string    // pointer back to source for re-verification
  classification: 'pii'|'pii-strict'|'public'|'tenant-confidential'
  last_synced_at: ISO8601
}
```

### ACL inheritance by source
- **Slack DM** → `acl = [sender_user_id, recipient_user_id]`
- **Slack channel** → `acl = channel_members + workspace_admins`
- **Linear ticket** → `acl = workspace_members ∩ project_members + assignees + watchers + creator`
- **GitHub PR** → `acl = repo_collaborators + watchers + reviewers + author`
- **Notion page** → walk the page ancestry and union all explicit grants (Notion permission graph is tree-inherited)
- **HubSpot deal** → `acl = deal_owner + team_members + admins + (sharing-rule-grants)`
- **WhatsApp business** → `acl = phone_number_holders_in_thread + assigned_agents_in_inbox`
- **M-Pesa payment** → `acl = payer_msisdn ∪ payee_short_code_holders + tenant_finance_team`

Each connector must implement an `extractACL(record): ACL` method.

### Slack engineering blog pattern (referenced)
Slack uses the **requesting user's ACL** to ensure the LLM only sees data the user could see in Slack — never the indexed-ACL alone. BOSSNYUMBA must do the same: every retrieval uses (user_acl ∩ chunk_acl), then verifies against source-of-truth before display.

---

## 6. Event-Driven vs Batch Sync — SOTA 2026

**Verdict: hybrid is the standard. Webhook-first hot path + scheduled reconciliation.**

### Webhook-first (hot path)
- ~98% API call reduction vs polling
- CloudEvents (CNCF spec) is the **lingua franca** of payload envelopes
- Stripe / GitHub / Shopify all ship exponential backoff + jitter + visible retry history out-of-the-box
- AsyncAPI is becoming OpenAPI-equivalent for event-driven APIs — every connector should ship an AsyncAPI spec

### Reconciliation (cold path)
- Nightly diff against source → catch missed webhooks (up to **27% failure rate observed under stress** in carrier-API benchmark)
- Snapshot for slow-change dimensions

### The "events beat webhooks" critique (Stacksync)
Webhooks struggle with out-of-order delivery, traffic spikes, audit. True event-streaming (Kafka, Confluent, Pub/Sub) gives ordering + replay + audit but raises integration cost.

**BOSSNYUMBA pattern:**
1. **Webhook ingest** → push to internal Kafka topic immediately (acks the webhook ≤200ms)
2. **Kafka topic** is source of truth — ordering + replay + audit
3. **Consumers**: graph-sync (entity update), search-index (RAG chunk update), notifier (downstream webhooks)
4. **Reconciliation job** nightly: full-page-scan via REST → diff against graph → emit missing events to the same Kafka topic

---

## 7. Streaming Changelog (CDC for Everything)

### The 2026 leaderboard
| Tool | Latency | Strength | BOSSNYUMBA fit |
|---|---|---|---|
| **Estuary Flow** | <1s, ms-level streaming | Right-time CDC + ETL + unified transforms | **Primary CDC engine** for Postgres → graph |
| **Airbyte 1.0** | Minutes (batch-on-schedule) | 350+ connectors OSS | Long-tail batch sources |
| **Fivetran** | 6h default | Managed enterprise | Heavy / regulated sources |
| **Confluent Cloud** | Sub-second | Kafka + Stream Designer | Kafka backbone |
| **Striim** | Sub-second | Enterprise CDC, legacy DB | Skip unless we need Oracle CDC |
| **Singer Taps** | Batch | OSS spec, many community taps | Use for one-offs only |
| **Hightouch** | Reverse ETL | Warehouse → SaaS sync | **Reverse-push** insights back to Slack/HubSpot/etc. |
| **Census** | Reverse ETL | Same | Alternative to Hightouch |

### The recommended BOSSNYUMBA stack
- **Estuary Flow** (or Debezium + Kafka) for our own Postgres → Property Graph
- **Airbyte** for sources we have to pull (Property24/Lamudi scrape, KRA iTax)
- **Webhook intake** for M-Pesa, Stripe, WhatsApp, Slack, HubSpot, Gmail
- **Hightouch reverse-ETL** to push insights ("tenant X likely to churn") back into HubSpot/Slack/WhatsApp threads

---

## 8. Tool Result Reasoning (Cross-Source Inference)

### SOTA examples in 2026
- **Continue Slack Cloud Agent:** Slack message → analyzes thread → finds files in GitHub → generates fix → opens PR. Cross-source closure.
- **Cursor + Linear + GitHub agentic loop:** Linear ticket → mark in-progress → branch → code → PR → comment back to Linear.
- **OpenAI Workspace Agents (April 2026):** join Slack threads, retrieve context across documents/email/chats/code/internal systems, execute approved actions (update Linear, create docs, send messages).
- **Cyrus (Claude Code-powered for Linear/GitHub/Slack):** dedicated cross-tool dev agent.

### The pattern
1. **Triage agent** classifies the inbound (Slack/email/WhatsApp/ticket)
2. **Retrieval agent** fans out across the graph + RAG indexes + live MCP federated tools
3. **Plan-and-Execute** (cited 92% completion, 3.6× speedup vs ReAct in 2026 benchmarks): planner produces a DAG of subtasks
4. **Worker agents** execute leaves (read source, write destination)
5. **Re-planner** evaluates results, adjusts
6. **Verifier** checks against the source-of-truth + ACLs before commit
7. **Action** logged to audit trail with full causal chain

BOSSNYUMBA needs this in `central-intelligence` + `agent-platform`.

### Source-citation grounding
Every assertion must carry:
- `claim: "Tenant John is 5 days overdue on rent"`
- `evidence: [{ source: 'mpesa', tx_id: 'X', ts }, { source: 'lease', clause: 4.2 }, { source: 'reminder', sent_at }]`
- `confidence: 0.94`
- `freshness: { mpesa: '2m ago', lease: '3 months ago' }`

This is non-negotiable for liability in the property mgmt domain.

---

## 9. Cross-Tool Action (Agent Orchestration)

### The pattern (validated by Continue, Cursor, Cyrus 2026)
```
Inbound (Slack / WhatsApp / email / portal / call)
    ↓
Triage (intent + entity extraction)
    ↓
Plan (DAG of subtasks)
    ↓
[parallel] Retrieval (graph + RAG + MCP tools)
    ↓
[parallel] Drafts (rent demand, PR comment, vendor SMS)
    ↓
Approval gate (human or autonomous threshold)
    ↓
[parallel] Execute (M-Pesa request, WhatsApp send, sheet update, calendar block, ticket create)
    ↓
Reflection (did each side-effect succeed? side-effects always cited)
    ↓
Audit log (full DAG + IO + decision rationale)
```

### Key 2026 advances
- **Bedrock AgentCore / Microsoft Agent Builder / Anthropic Cowork Agents** all converge on this DAG-of-tools pattern.
- **n1n.ai "5 Design Patterns 2026"**: Plan-and-Execute, Reflection, Tool-Use, Multi-Agent, Routing. BOSSNYUMBA should implement all five.

---

## 10. Tenant-Isolation Hard Guarantees (50 tools per tenant)

### The threat model
- **Vector store side-channel:** chunk-A indexed for tenant-1 gets returned to tenant-2 due to a query embedding accidentally matching.
- **Connector OAuth-token leak:** tenant-1's HubSpot token used to fetch tenant-2's data (mis-scoped key).
- **Cache poisoning:** redis cache key not tenant-prefixed; tenant-2 reads tenant-1's cached deal.
- **Cross-tenant agent memory:** "remembered" deal from tenant-1 surfaces in tenant-2's chat (we already audited this — see `04-ops-infra.md`).
- **Postgres RLS subquery bypass (CVE-2024-10976):** RLS in connection-pooled multi-tenant SaaS bypassed mid-session.

### The 7 hard guarantees we need

| # | Guarantee | Mechanism |
|---|---|---|
| 1 | **Hard tenant isolation in vector store** | Index-per-tenant (not metadata-filter). Pinecone namespaces, Weaviate tenants, Qdrant collections. |
| 2 | **Tenant-scoped OAuth vault** | Every connector token in a tenant-keyed envelope; KMS key per tenant for envelope encryption. |
| 3 | **Tenant-prefixed cache keys** | `{tenant_id}:{user_id}:{cache_key}` everywhere; lint rule to enforce. |
| 4 | **Tenant-isolated agent memory** | `central-intelligence` memory is tenant-keyed; cross-tenant reads impossible by construction. |
| 5 | **RLS without subquery bypass** | Postgres RLS + SET LOCAL tenant_id per request; never reuse connections across tenants without RESET. |
| 6 | **Audit-trail per cross-tool action** | Every connector write logged with tenant_id + user_id + agent_id + plan_id. |
| 7 | **Egress monitoring** | If chunks for tenant-1 ever appear in a tenant-2 response (caught in eval), alert + revoke the agent's session. |

### Test harness: "leak canary"
Every tenant gets a synthetic canary record. Eval pipeline asks every other tenant's agent to find that canary. Any leak = block deploy.

---

## "Property Management Universe" Connector Map

Every tool a tenant might use, grouped by domain:

### Money in
- **M-Pesa Daraja API** (STK Push, C2B, B2C, transaction status, balance) — webhook-first
- **Airtel Money** (Kenya, Tanzania, Uganda)
- **Equitel** (Kenya)
- **Stripe** (international, cards)
- **Pesapal** (East Africa aggregator)
- **Flutterwave** (pan-African)
- **DPO Group** (corporates)
- **TIGOpesa / Mpamba / MoMo** (Tanzania/Malawi/Ghana/Uganda M-Mo variants)
- **Bank statement import** (NCBA / KCB / Equity / Stanbic CSV/MT940/PDF)
- **Cheque scanner OCR**

### Money out
- **B2B M-Pesa payout** (vendors)
- **Bank EFT** (NCBA, KCB, Equity APIs)
- **PayPal / Wise** (international payouts to overseas owners)

### Communications
- **WhatsApp Business Cloud API** (Meta) — webhook-first
- **SMS gateways**: Africa's Talking, Safaricom SMS API, Twilio
- **Voice**: Africa's Talking voice, Twilio, Vonage
- **Email**: Gmail API, Outlook/M365 Graph, IMAP/SMTP fallback
- **Slack** (for property mgmt teams)
- **Microsoft Teams** (for larger landlords)
- **Telegram** (used in some markets)

### Property listings (intake + outbound syndication)
- **Property24** (.co.ke, .co.za)
- **BuyRentKenya**
- **Jumia House** (formerly Lamudi)
- **Hauzisha** (.co.ke)
- **Pigiame** (.co.ke)
- **Maploti** (regional)
- **OLX / Jiji** (cross-category, but property is a major segment)
- **Facebook Marketplace** (massive in EA)
- **WhatsApp Status / Channels** (informal listing)

### KYC / Identity
- **Smile Identity** (pan-African — 54-country coverage)
- **Jumio** (international ID, biometrics)
- **Youverify** (Africa)
- **Dojah** (Nigeria-led, pan-African)
- **IdentityPass** (Nigeria)
- **IPRS / e-Citizen** (Kenya gov registry lookup)
- **BRS** (Kenya Business Registration)

### Accounting / Finance
- **QuickBooks Online** (most common SME accounting in EA)
- **Xero** (per-tenant OAuth, GET /connections; 60/min/tenant + 5K/day/tenant + 10K/min/app rate limits)
- **Wave** (free, freelancer-grade)
- **Sage Pastel** (corporate Kenya)
- **Tally** (still very common in dukas + agencies)
- **Zoho Books**
- **Odoo** (multi-property mgmt companies)
- **NetSuite** (only for the largest)

### Maintenance / Vendors
- **Vendor WhatsApp threads** (the actual workflow)
- **Trello / Notion** (work-order tracking)
- **ClickUp / Asana / Linear** (for tech-savvier shops)
- **Custom vendor portals** (PUMA security, KK Security, G4S — proprietary integrations)
- **Plumber/electrician scheduling apps**

### Utilities
- **KPLC e-bill API + Token vending** (Kenya Power) — pre-paid + post-paid
- **Nairobi Water** API (e-bill)
- **Tanesco** (Tanzania power)
- **DAWASA** (Dar es Salaam water)
- **TANESCO / UMEME / NWSC** (region-specific)
- **Solar inverter telemetry** (Victron, Goodwe, Huawei)
- **Borehole pump telemetry** (where instrumented)
- **Meter reading photos** (computer vision parse)

### Tax / Compliance
- **KRA iTax API** (PIN validation, VAT, withholding, rental income MRI)
- **eTIMS** (Kenya electronic tax invoicing — MANDATORY for property mgmt invoices >$0)
- **TRA** (Tanzania revenue)
- **URA** (Uganda)
- **AML/sanctions screens**: OFAC, UN, EU consolidated lists
- **PEP screening** (politically exposed persons)

### Legal / Eviction
- **Kenya Judiciary CauseList API** (where available)
- **DocuSign / Adobe Sign** (lease execution)
- **HelloSign / SignNow** (alternatives)
- **Kenya Law (Kenyalaw.org)** — case law search
- **Lawyer firm DMS** (Worldox, NetDocuments)

### Marketing / CRM
- **HubSpot** (small/medium landlords)
- **Salesforce** (largest portfolios)
- **Pipedrive**
- **Mailchimp / Klaviyo** (drip campaigns)
- **Google Business Profile** (listings)
- **Facebook/Instagram Ads** (lead-gen)
- **TikTok Ads** (younger renter cohort)

### Calendar / Productivity
- **Google Calendar** (viewing slots, vendor visits)
- **Outlook Calendar**
- **Cal.com / Calendly** (self-service viewing booking)
- **Google Sheets** (the actual data layer for 70% of EA landlords today — read/write)
- **Google Drive / OneDrive / Dropbox** (lease PDFs, property photos)

### Security / Access
- **Smart lock APIs**: Yale Link, August, Igloohome
- **Estate gate intercom systems** (custom)
- **CCTV providers** (Hikvision, Dahua APIs)
- **Estate guard scheduling apps**

### Insurance
- **Britam, Jubilee, APA, AAR** (motor + property insurance APIs)
- **Lemonade-style API insurers** (not yet in EA but watch)

### Maps / Geo
- **Google Maps Platform** (places, geocoding, street view)
- **Mapbox**
- **OpenStreetMap** (Kenya is well-mapped)

---

## Reference Architecture: Connector → CDC → ER → Graph → MCP → Agent

```
┌────────────────────────────────────────────────────────────┐
│                  TENANT SOURCE SYSTEMS                      │
│  M-Pesa │ WhatsApp │ HubSpot │ Slack │ QB │ Property24 │... │
└──────────┬─────────────┬────────────┬────────┬─────────────┘
           │             │            │        │
      [webhook]      [poll/CDC]   [federated MCP]
           │             │            │        │
           ▼             ▼            ▼        ▼
┌────────────────────────────────────────────────────────────┐
│         packages/connectors/  (per-tenant OAuth vault)     │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ extractACL() │ normalize() │ idempotency │ retry(jitter)│ │
│  └──────────────────────────────────────────────────────┘ │
└─────────────────────────┬──────────────────────────────────┘
                          │  CloudEvents envelopes
                          ▼
┌────────────────────────────────────────────────────────────┐
│         Kafka / Redpanda (per-tenant topic prefix)         │
│   Ordering │ Replay │ Exactly-once │ Audit │ Dead-letter   │
└─────────────────┬───────────────────┬──────────────────────┘
                  │                   │
                  ▼                   ▼
┌────────────────────────┐  ┌───────────────────────────────┐
│ packages/graph-sync/   │  │ packages/central-intelligence/│
│  Entity Resolver       │  │  RAG index (per-tenant)       │
│  (Zingg + property KB) │  │  + freshness                   │
│  → Property Graph      │  │  + ACL-attached chunks         │
│    (Apache AGE / Neo4j)│  │                                │
│  Ontology layer        │  │                                │
└────────────┬───────────┘  └─────────────┬─────────────────┘
             │                            │
             ▼                            ▼
         ┌──────────────────────────────────────┐
         │ Semantic-layer (metrics + dimensions) │
         │ cube.dev / dbt-semantic / custom      │
         └─────────────────┬────────────────────┘
                           │
                           ▼
         ┌──────────────────────────────────────┐
         │       packages/mcp-server/            │
         │ Federated tools + indexed retrieval   │
         │  Permission-aware retrieval (ACL ∩)   │
         └─────────────────┬────────────────────┘
                           │
                           ▼
         ┌──────────────────────────────────────┐
         │      packages/agent-platform/         │
         │  Plan-and-Execute │ Reflection        │
         │  Multi-Agent │ Verifier │ Audit       │
         └─────────────────┬────────────────────┘
                           │
                           ▼
         ┌──────────────────────────────────────┐
         │   packages/chat-ui/ + packages/genui/ │
         │  Tabular Agent Grid (Hebbia-style)    │
         │  Sidebar Coordinator (Cresta-style)   │
         └──────────────────────────────────────┘
```

### Reverse path (insight push)
```
Property Graph + Semantic Layer
    ↓
Hightouch / Census reverse-ETL
    ↓
HubSpot custom property "churn_risk" │ Slack DM digest │ WhatsApp tenant nudge
```

### Hard isolation per tenant
- Per-tenant Kafka topic prefix: `t.{tenant_id}.events.{source}`
- Per-tenant graph: `g_{tenant_id}` (Neo4j multi-database or AGE per-schema)
- Per-tenant vector index/namespace
- Per-tenant KMS envelope for OAuth tokens
- Per-tenant agent memory key
- Per-tenant cache key prefix

---

## 12 Concrete Connectors to Build for EA/Africa Property Mgmt

Ranked by leverage × moat × frequency-of-tenant-use:

### Tier 1 — ship in next sprint
1. **M-Pesa Daraja** — STK Push + C2B + B2C + transaction status + reconciliation. The single most valuable connector. (Webhook-first; CDC via callback; idempotent on `MpesaReceiptNumber`.)
2. **WhatsApp Business Cloud API** — receive + send + media + templates + interactive buttons. Permission model = phone-number-holder + assigned-agent. (Webhook-first.)
3. **Google Sheets** (read/write/realtime via Drive API push notifications) — 70% of EA landlords actually live here. We must mirror sheets into the graph and write back. (CDC via Drive push notifications; ACL inherited from Sheet sharing model.)

### Tier 2 — quarter 2
4. **KPLC e-bill + token vending** — pre-paid + post-paid bill fetch, token purchase, unit balance. (Polling — KPLC has no webhooks. ACL = property-meter-owner.)
5. **KRA iTax + eTIMS** — PIN validation, MRI filing, electronic tax invoice issuance. eTIMS is mandatory for any invoice over zero shillings since 2024. (Compliance, not optional.)
6. **Smile Identity** — KYC for tenant onboarding, national ID + facial liveness across 54 African countries. (Sync API; per-tenant config + per-end-user PII tagging.)
7. **QuickBooks Online + Xero** — invoice push, payment match, GL mapping. (Multi-tenant OAuth via Xero `/connections`; webhook on payment events.)

### Tier 3 — quarter 3
8. **BuyRentKenya + Property24 + Jumia House syndication** — outbound listing publish (likely scraping + portal automation since they don't all have public APIs; check partnership/affiliate routes).
9. **HubSpot CRM** (publishing BOSSNYUMBA as MCP server in their Breeze ecosystem) — lead intake from forms, deal updates, contact sync.
10. **Slack** (for property mgmt teams' internal coord) — DM + channel + slash commands + workflow blocks. Permission = sender+recipient or channel-members.
11. **Africa's Talking SMS + Voice** — SMS reminders, OTP, IVR rent reminders in Kiswahili/Sheng/English.
12. **Gmail + Outlook (M365 Graph)** — inbound lease inquiries, vendor quotes, owner statements. (Gmail push via Pub/Sub; M365 via Graph subscriptions.)

### Connector contract (every one of these implements)
```typescript
interface BossNyumbaConnector<TRecord, TACL> {
  readonly id: string                          // 'mpesa' | 'whatsapp' | ...
  readonly tenant_id: string                   // hard isolation
  readonly mode: 'webhook' | 'cdc' | 'poll' | 'federated-mcp'

  // Auth (per-tenant OAuth in KMS envelope)
  authenticate(): Promise<AuthHandle>
  refreshToken(handle: AuthHandle): Promise<AuthHandle>

  // Sync
  pullDelta(since: ISO8601): AsyncIterable<TRecord>     // for batch reconcile
  onWebhook(payload: unknown): AsyncIterable<TRecord>    // for hot path

  // Normalization → graph
  normalize(record: TRecord): GraphEntity[]              // ontology mapping
  extractACL(record: TRecord): TACL                       // permission inheritance
  freshness(record: TRecord): { ttl: number; source_ts: ISO8601 }

  // Write-back (for cross-tool actions)
  performAction(action: ConnectorAction, ctx: AuditCtx): Promise<ActionReceipt>

  // MCP server contract (so this connector is callable by ChatGPT/Claude/Copilot)
  asMcpServer(): McpServerDefinition
}
```

---

## What BOSSNYUMBA Needs in Each Package

### `packages/connectors/`
- Per-connector module implementing `BossNyumbaConnector<T, A>`
- Per-tenant OAuth vault (KMS envelope per tenant_id)
- Common: idempotency, retry-with-jitter, CloudEvents envelope, rate-limit per-tenant, dead-letter queue
- AsyncAPI spec per connector
- Lint rule: every connector must export `extractACL`
- Leak-canary test harness

### `packages/graph-sync/`
- Kafka consumer per source topic
- **Entity resolver** (Zingg integration + property-management rule layer for household resolution)
- Ontology → `domain-models` (already exists; needs household + lease-occupant + meter-reading + vendor + complaint entities)
- Graph backend: Apache AGE on Postgres (lower ops cost than Neo4j; same Cypher) — per-tenant schema
- Freshness tracker — every entity has `last_synced_at`, `source_id`, `source_ttl`
- Reverse-ETL hooks (Hightouch-style) — push insights back to source systems

### `packages/central-intelligence/`
- Per-tenant vector index (namespace-per-tenant in Qdrant/Weaviate)
- ACL-attached chunks with `acl_version` for invalidation
- Permission-aware retrieval (intersect requesting-user's ACL with chunk ACL at filter-time, re-verify at hydration)
- Plan-and-Execute orchestrator (cite n1n.ai's 92% completion benchmark — adopt the DAG pattern)
- Reflection + Verifier loops with source-citation grounding
- Tabular Agent Grid (Hebbia-style) for portfolio assertions
- Coordinator Sidebar (Cresta-style) for staff workflow follow-along
- Memory: per-tenant key, never cross-tenant, decay policy

### Cross-cutting (lives in `packages/security` + `packages/observability`)
- Egress monitoring — chunk-leak canary
- Per-tenant audit trail of every cross-tool action
- ACL-drift alerter — if source ACL changes, force re-index

---

## Key Quotes & Stats Worth Citing

- **Glean (2026):** results preferred 2× more than ChatGPT, 1.6× more than Claude in enterprise eval.
- **Atlassian Teamwork Graph (May 2026):** 150B+ connections, 90%+ enterprise cloud adoption.
- **Salesforce Agentforce (Q1 2026):** 18,500 customers, 3B monthly workflows.
- **Hebbia (April 2026):** 1B+ pages processed (21× YoY).
- **Plan-and-Execute pattern (n1n.ai 2026 benchmark):** 92% task completion, 3.6× speedup vs sequential ReAct.
- **Webhook efficiency:** ~98% API call reduction vs polling (Hooklistener 2026 study).
- **Webhook failure rate under stress:** up to 27% (carrier-API benchmark).
- **HubSpot Breeze pricing (April 14, 2026):** $0.50/resolved conv, $1/qualified lead — outcome-based standard.
- **Postgres CVE-2024-10976:** RLS subquery bypass in connection pools — direct relevance to BOSSNYUMBA multi-tenant SQL.

---

## Top 3 BOSSNYUMBA Implementation Priorities

1. **Stand up the per-tenant Kafka topic + CloudEvents envelope today.** Every connector flows through it. Without this, the graph cannot have ordering/replay/audit guarantees.
2. **Ship M-Pesa + WhatsApp + Google Sheets connectors first** — these three alone cover ~80% of EA landlord workflow. Build the `BossNyumbaConnector` interface around them and the rest fall out.
3. **Hard-isolate the vector store per tenant** (index-per-tenant, not metadata-filter). Add the "leak canary" eval to CI. Without this, we cannot ethically onboard the second tenant.

---

## Sources

- [Glean — Work AI that Works](https://www.glean.com/)
- [Glean — System of Context (unified index)](https://www.glean.com/product/system-of-context)
- [Glean — Enterprise search eval 2026 (preferred 2× vs ChatGPT)](https://www.glean.com/blog/enterprise-search-evaluation-2026)
- [Anthropic Cowork expansion (Feb 2026)](https://techcrunch.com/2026/02/24/anthropic-launches-new-push-for-enterprise-agents-with-plugins-for-finance-engineering-and-design/)
- [Anthropic Claude for Small Business (May 13, 2026)](https://www.roborhythms.com/anthropic-claude-for-small-business-launch-2026/)
- [Anthropic MCP Tunnels (May 2026)](https://www.infoq.com/news/2026/05/claude-mcp-tunnels/)
- [Cloudflare — 13 new MCP servers](https://blog.cloudflare.com/thirteen-new-mcp-servers-from-cloudflare/)
- [Microsoft 365 Copilot Connectors overview](https://learn.microsoft.com/en-us/microsoft-365/copilot/connectors/overview)
- [Microsoft Graph connector agent](https://learn.microsoft.com/en-us/microsoft-365/copilot/connectors/connector-agent)
- [OpenAI Apps SDK + Connectors](https://help.openai.com/en/articles/11487775-connectors-in-chatgpt)
- [Salesforce Agentforce vs HubSpot Breeze 2026](https://slashdot.org/software/comparison/Agentforce-vs-HubSpot-Breeze-AI/)
- [HubSpot outcome-based AI pricing (April 14, 2026)](https://www.cxtoday.com/crm/hubspot-outcome-based-ai-pricing-breeze/)
- [Atlassian Teamwork Graph + Rovo (May 2026)](https://siliconangle.com/2026/05/06/atlassian-opens-teamwork-graph-pushes-rovo-agentic-execution-team-26/)
- [Cresta Knowledge Agent (March 17, 2026)](https://cresta.com/press/cresta-launches-knowledge-agent-an-agentic-assistant-delivering-proactive-intelligence-to-contact-center-workers)
- [Hebbia Matrix April 2026 update](https://www.hebbia.com/blog/whats-new-april-disclosure-2026)
- [Hebbia Multi-Agent Redesign](https://www.hebbia.com/blog/divide-and-conquer-hebbias-multi-agent-redesign)
- [Decagon — VentureBeat coverage](https://venturebeat.com/ai/decagon-emerges-from-stealth-to-provide-human-like-ai-agents-transforming-customer-support-for-enterprises)
- [Maven AGI vs Decagon comparison](https://www.eesel.ai/blog/decagon-vs-maven-agi)
- [Atlan — Context Layer for AI Agents (2026)](https://atlan.com/know/context-layer-for-ai-agents/)
- [Atlan — Ontology vs Semantic Layer](https://atlan.com/know/ontology-vs-semantic-layer/)
- [Atlan — Unified Context Layer](https://atlan.com/know/unified-context-layer/)
- [DataHub — Ontology vs Semantic Layer](https://datahub.com/blog/ontology-vs-semantic-layer/)
- [Promethium — Enterprise Knowledge Graph Buyer's Guide 2026](https://promethium.ai/guides/enterprise-knowledge-graph-buyers-guide-2026/)
- [Ampcome — Enterprise Agentic AI Platform Architecture 2026](https://www.ampcome.com/post/enterprise-agentic-ai-platform-architecture-2026)
- [n1n.ai — 5 AI Agent Design Patterns 2026](https://explore.n1n.ai/blog/5-ai-agent-design-patterns-master-2026-2026-03-21)
- [Atlan — Agent Memory Architectures](https://atlan.com/know/agent-memory-architectures/)
- [Senzing entity resolution](https://senzing.com/)
- [Zingg (OSS) entity resolution](https://github.com/zinggAI/zingg)
- [Awesome-Entity-Resolution list](https://github.com/OlivierBinette/Awesome-Entity-Resolution)
- [TianPan — Permission-aware Retrieval in Enterprise RAG (May 2026)](https://tianpan.co/blog/2026-05-04-permission-aware-retrieval-enterprise-rag-access-control)
- [Slack Engineering — How we built enterprise search to be secure](https://slack.engineering/how-we-built-enterprise-search-to-be-secure-and-private/)
- [Truto — Document-Level RBAC in RAG (2026)](https://truto.one/blog/how-to-maintain-document-level-rbac-in-enterprise-rag-pipelines/)
- [Kiteworks — Prevent Data Leakage in RAG](https://www.kiteworks.com/cybersecurity-risk-management/prevent-data-leakage-rag-pipelines/)
- [Blockchain Council — Securing vector DBs 2026](https://www.blockchain-council.org/ai/securing-and-governing-vector-databases-privacy-prompt-injection-multi-tenant-access-control/)
- [AWS — Multi-tenant RAG with Bedrock + OpenSearch + JWT](https://aws.amazon.com/blogs/machine-learning/multi-tenant-rag-implementation-with-amazon-bedrock-and-amazon-opensearch-service-for-saas-using-jwt/)
- [Estuary Flow — right-time CDC](https://estuary.dev/)
- [Estuary — CDC landscape](https://estuary.dev/blog/change-data-capture-landscape/)
- [Airbyte — Top CDC tools 2026](https://airbyte.com/top-etl-tools-for-sources/cdc-tools)
- [Hightouch — Reverse ETL](https://hightouch.com/platform/reverse-etl)
- [Stacksync — Why events beat webhooks](https://www.stacksync.com/blog/events-beat-webhooks-reliable-data-sync)
- [Hooklistener — Webhooks fundamentals 2026 (CloudEvents lingua franca)](https://www.hooklistener.com/learn/webhooks-fundamentals)
- [AsyncAPI + CloudEvents](https://www.asyncapi.com/blog/asyncapi-cloud-events)
- [Obsidian Security — Webhook security 2026](https://www.obsidiansecurity.com/blog/what-is-webhook-security-securing-saas-integrations-2026)
- [Continue — Slack Cloud Agent with GitHub + Linear](https://blog.continue.dev/slack-cloud-agent-github-linear)
- [OpenAI Workspace Agents in Slack and Linear (2026)](https://blockchain.news/ainews/openai-workspace-agents-in-slack-and-linear-latest-2026-analysis-on-cross-app-automation-and-roi)
- [Cyrus — Claude Code for Linear/GitHub/Slack](https://www.atcyrus.com/changelog)
- [Smithery — MCP marketplace](https://smithery.ai/)
- [TrueFoundry — Best MCP Registries 2026](https://www.truefoundry.com/blog/best-mcp-registries)
- [MCP Bundles — Best MCP Servers 2026](https://www.mcpbundles.com/blog/best-mcp-servers)
- [Composio — Smithery alternatives](https://composio.dev/blog/smithery-alternative)
- [Atlassian Remote MCP Server](https://www.atlassian.com/blog/announcements/remote-mcp-server)
- [M-Pesa Daraja Developer Portal](https://developer.safaricom.co.ke/)
- [Daraja 3.0 integration guide 2026](https://cnbcode.com/blog/m-pesa-daraja-api-integration-requirements-complete-2026-guide)
- [Statum — WhatsApp + M-Pesa bot 2026](https://blog.statum.co.ke/blog/how-to-build-an-ai-whatsapp-bot-with-m-pesa-in-kenya-2026)
- [Pangoni — Property mgmt software Kenya 2026](https://pangoni.io/blog/guides/property-management-software-kenya)
- [BuyRentKenya](https://www.buyrentkenya.com/)
- [Property24 Kenya](https://www.property24.co.ke/)
- [Jumia House Kenya](https://house.jumia.co.ke/)
- [Smile Identity](https://usesmileid.com/)
- [Jumio Platform](https://www.jumio.com/platform/)
- [Korahq — Top KYC providers Africa](https://www.korahq.com/blog/best-kyc-verification-providers)
- [Unified.to — 15 Accounting APIs 2026](https://unified.to/blog/15_accounting_apis_to_integrate_with_in_2026_quickbooks_xero_freshbooks_and_unified_accounting_apis)
- [Apideck — Xero Integrations guide 2026](https://www.apideck.com/blog/xero-integrations)
- [Satva — Xero/QuickBooks API rate limits 2026](https://satvasolutions.com/blog/saas-leaders-guide-api-rate-limits-in-accounting-platforms)
- [DZone — Multi-tenant data isolation + RLS](https://dzone.com/articles/multi-tenant-data-isolation-row-level-security)
- [AWS — Postgres RLS for multi-tenant](https://aws.amazon.com/blogs/database/multi-tenant-data-isolation-with-postgresql-row-level-security/)
- [GSoft — Multi-tenant SaaS 2026 pitfalls](https://gsoftconsulting.com/en/blog/building-multi-tenant-saas-2026)
- [Atlassian Rovo — Notion connector](https://www.atlassian.com/software/rovo/connectors/notion)
- [Atlassian Rovo — features](https://www.atlassian.com/software/rovo/features)
