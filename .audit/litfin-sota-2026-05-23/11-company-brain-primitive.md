# Company Brain Primitive — SOTA 2026 Research

> **Date:** 2026-05-23
> **Project:** BOSSNYUMBA101 — multi-tenant property management SaaS (EA/Africa)
> **Frame:** The "company brain" is the architectural primitive that ingests scattered knowledge (Slack/WhatsApp/email/M-Pesa/inspections/leases/calls/spreadsheets) and emits **executable skills** for AI agents — not just search, not just chat-over-docs. Each tenant (a property-mgmt company) has institutional knowledge trapped in 5+ channels; the brain liberates it into a typed, versioned, ACL-respecting skill catalogue.
> **Companion docs:** §02 (memory/RAG/KG), §07 (tools/MCP/agency), §08 (SOTA frontier). This document is the missing primitive between them: where ingestion meets executable agent behavior.

---

## Executive TL;DR

**The category has consolidated.** What used to be "enterprise search" (Glean, Onyx, Curiosity) is now "Work AI" / "Agent OS" — a unified stack with four layers: **(1) Connectors** that ingest events from every system of record/communication, **(2) Work Graph** that fuses them into a permission-aware entity+relationship store, **(3) Skill library** that packages reusable execution logic (Anthropic's [Agent Skills spec](https://claude.com/blog/skills) is now the open standard, adopted by OpenAI Codex CLI and ChatGPT Dec 2025; [Glean Skills](https://www.glean.com/blog/glean-skills-launch-2026) supports it), and **(4) Routing** that picks the right skill+model+approval-gate for each request.

**Five most important patterns** from 2026 SOTA:

1. **Skills-as-code + skills-as-trajectory.** The unit of company brain output is an executable Skill ([Anthropic SKILL.md format](https://claude.com/blog/skills): YAML frontmatter + Markdown body + optional executable scripts, loaded JIT). Skills come from two sources: (a) hand-authored, (b) **trajectory-mined from past human work** ([Trace2Skill](https://arxiv.org/pdf/2603.25158), [SkillGen](https://arxiv.org/html/2605.10999v1), Glean's "the platform automatically generates skills from work patterns", [Sierra Ghostwriter](https://mlq.ai/news/sierra-ai-introduces-ghostwriter-platform-for-automated-agent-development/)).
2. **Living knowledge with bi-temporal facts + decay.** Static RAG is dead. SOTA brains store every fact with `valid_from / valid_to / observed_at / asserted_at + supersedes` chain (Zep/Graphiti pattern, already in LITFIN's memory v2); freshness signals drive decay; conflicting sources are detected and routed to owners ([DRAGged into Conflicts](https://arxiv.org/pdf/2506.08500), [Whose Facts Win?](https://arxiv.org/html/2601.03746v3)).
3. **Source-based ACL inheritance is non-negotiable.** Onyx, Glean, Notion all enforce **permission-aware retrieval**: a DM stays a DM, a private channel never leaks via answer aggregation. The connector ingests ACL metadata at the same time as content; the retriever filters at query time using the asking user's ACL graph.
4. **Federated + synced connector duality.** Microsoft Graph Connectors now ships [two modes](https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/overview-copilot-connector): **synced** (ingest+index, fast retrieval, ACL snapshot) and **federated** (MCP pass-through, no copy, live ACL, slower). Different sources warrant different modes (lease PDFs: synced; M-Pesa balance: federated). [Unified.to](https://unified.to/blog/7_ticketing_apis_to_integrate_with_in_2026_zendesk_intercom_servicenow_and_unified_ticketing_apis) extends this with **zero-storage pass-through** for compliance-sensitive data.
5. **Trajectory > traces > prompts.** The 2026 frontier brain doesn't fine-tune from labelled data — it **mines successful trajectories** ([Cognition Devin annual report](https://cognition.ai/blog/devin-annual-performance-review-2025), Sierra Expert Answers, Decagon analytics, SkillRL). Every human-completed flow becomes a candidate skill; the consolidation worker clusters by intent, computes success rate, and promotes to the skill library when `successCount/(success+failure) > threshold` over `>= N` observations.

**Top-3 connectors to build first for property-mgmt in EA/Africa:**

1. **WhatsApp Cloud API + Meta Business Suite** — already wired at `services/notifications/src/whatsapp/` for outbound. The brain primitive needs **inbound mining**: webhook → message store → thread-decision-outcome graph. 85% of tenant communication in Kenya/Tanzania flows here.
2. **M-Pesa Daraja 3.0 + Africa's Talking** — already wired at `packages/connectors/src/adapters/mpesa-{adapter,real}.ts`. Brain primitive needs **structured receipt mining** (every paybill push = a `Payment` node + `Tenant→Lease→Property` graph edge with auto-reconciliation) and the [Daraja MCP server](https://mcpmarket.com/server/daraja) pattern so agents can execute B2C disbursements.
3. **Slack + Gmail/Outlook** — the institutional-knowledge channel for the property-mgmt **operator team** (vs WhatsApp for tenants). Drives "James-always-asks-for-receipt-before-approving" rule extraction. Not yet built.

---

## 1. Vendor Landscape (May 2026)

### 1.1 Enterprise "Work AI" leaders

#### Glean — Work AI ($4.6B valuation rumored, $500M+ ARR)
- **What:** Connectors + Search + Work Graph + Skills + Assistant + Agents. May 2026 launch added [Glean Skills](https://www.glean.com/blog/glean-skills-launch-2026), [autonomous agents on the Work Graph](https://www.glean.com/press/glean-launches-the-work-ai-institute-unveils-autonomous-agents-built-on-glean-enterprise-context-to-operationalize-ai-at-work), and [third-generation assistant](https://www.glean.com/press/glean-introduces-third-generation-ai-assistant-new-enterprise-graph-to-enable-the-superintelligent-enterprise).
- **Architectural innovation:** Three-layer Skills (metadata always-loaded → instructions loaded on trigger → resources loaded JIT). Skills auto-evolve from "work patterns" tracked on the personal graph. Adaptive Reasoning matches model to task. 100+ actions via MCP across Salesforce/Jira/Confluence/GitHub/Asana/Canva.
- **BOSSNYUMBA take:** **Most-similar reference architecture.** Mimic the four-layer split (Connectors → Work Graph → Skills → Agents) but as a multi-tenant OSS stack the customer self-hosts. Adopt the Anthropic SKILL.md format Glean now embraces.

#### Microsoft 365 Copilot + Graph Connectors + Office Agents
- **What:** 100+ prebuilt connectors ([Microsoft Learn](https://learn.microsoft.com/en-us/microsoft-365/copilot/connectors/overview)); two modes (synced vs federated/MCP); Copilot Studio for custom agents.
- **Architectural innovation:** **Federated connectors via MCP** with no data copy — closes compliance gap that single-mode systems (Glean, Notion) can't. AI-powered skill inferencing on user profiles (E3/E5 now).
- **BOSSNYUMBA take:** Adopt the **synced+federated duality**: synced for lease PDFs and inspection reports; federated for live M-Pesa balance, GePG rate cards, KRA tax tables. Compliance plugin (Tanzania PDPA, Kenya DPA) can flip a connector mode per data class.

#### Notion AI + Connectors + Custom Agents
- **What:** [Enterprise Search](https://www.notion.com/help/enterprise-search) over Slack/Drive/GitHub/Jira/Teams/OneDrive/SharePoint/Salesforce/Box. [Custom Agents](https://techcrunch.com/2026/05/13/notion-just-turned-its-workspace-into-a-hub-for-ai-agents/) (May 2026) run on schedules + triggers, reply inside private Slack channels.
- **Architectural innovation:** The workspace IS the brain. Custom Agents are first-class workspace citizens with their own pages, schedules, and trigger graphs.
- **BOSSNYUMBA take:** Less relevant as primitive (Notion is product, not infra). But the "Agent-as-workspace-citizen" UX is the right pattern for the operator dashboard.

#### Hebbia (Matrix / Deeper Research)
- **What:** [Matrix](https://dynamicbusiness.com/ai-tools/hebbia-revolutionizes-ai-interface-meet-the-matrix.html) — parallel-processor grid UI. [Deeper Research](https://www.hebbia.com/blog/inside-hebbias-deeper-research-agent) — Orchestrator + Planner + dozens of specialised agents. De-facto "Analyst Engine" for Wall Street and Big Law by 2026.
- **Architectural innovation:** **Matrix-as-workflow-engine**: instructing AI to "Read these 500 leases and extract escalation clause" populates a structured grid in seconds. Sub-agent spawning with planner decomposition.
- **BOSSNYUMBA take:** Build a **Hebbia-style Matrix view** for portfolio analytics — "for every property in my portfolio, compute occupancy / NOI / arrears risk / KRA position." Already half-built in `packages/forecasting-engine/` and `packages/market-intelligence/`.

#### Onyx (formerly Danswer) — OSS
- **What:** [40+ connectors](https://docs.onyx.app/overview/core_features/connectors), hybrid search + StructRAG + LightGraphRAG + LLM-based KGs, SSO/RBAC/encryption, deployable anywhere (laptop → cloud → on-prem).
- **Architectural innovation:** **Permission-aware ingestion** as first-class concern — Onyx ingests ACL metadata at the same time as content. Hundreds of millions of docs tested.
- **BOSSNYUMBA take:** **Closest OSS reference.** Cherry-pick the connector base classes and the ACL-aware retriever. Don't fork — re-implement against BOSSNYUMBA's `packages/connectors/` base which is already richer (circuit-breaker, token-bucket, audit-sink).

#### Maven AGI
- **What:** [Graph of Record](https://www.mavenagi.com/) + voice/chat/messaging/email + 100+ integrations + SOC2/HIPAA/PCI-DSS/ISO27001. 80-93% resolution rates.
- **Architectural innovation:** **Graph of Record** as cornerstone — version-accurate, context-relevant knowledge that allows intelligence to scale while staying compliant. Single reasoning engine across all channels.
- **BOSSNYUMBA take:** The "Graph of Record" naming validates BOSSNYUMBA's existing `packages/graph-sync/` Canonical Property Graph (CPG) approach. Extend with versioning + "as-of" queries.

#### Sierra ($15.8B valuation, $150M ARR)
- **What:** Agent OS across chat/voice/email/SMS/WhatsApp. [Expert Answers](https://sierra.ai/blog/expert-answers) closes the loop turning resolutions into knowledge. [Ghostwriter](https://mlq.ai/news/sierra-ai-introduces-ghostwriter-platform-for-automated-agent-development/) (March 2026) runs auto-improvement: analyzes interactions → identifies failures → validates fixes in sandbox → queues approved changes.
- **Architectural innovation:** **Ghostwriter is the trajectory-mining-to-skill-deployment pipeline productized.** Sandboxed validation before deployment. Human approval gate.
- **BOSSNYUMBA take:** **Directly portable pattern** — build "Ghostwriter for property mgmt": failed WhatsApp/Slack flows → root-cause analysis → propose skill diff → operator reviews → ship as `.claude/skills/<tenant>/<skill>.md`. Already half-built in `packages/ai-copilot/src/learning-loop/`.

#### Decagon
- **What:** Conversational AI for enterprise support. [Knowledge ingestion](https://www.eesel.ai/blog/decagon-knowledge-base-setup) unifies help centers + Confluence + Drive + SharePoint + tickets into a KG.
- **Architectural innovation:** **Knowledge-graph-from-tickets** + analytics that tag conversations to suggest knowledge-base additions.
- **BOSSNYUMBA take:** Apply the pattern to maintenance tickets → "every time vendor X arrived more than 24h late, the work order had no photo attached" becomes a graph signal that propagates to vendor onboarding.

### 1.2 Knowledge-platform OSS / specialist

| Tool | Stars / scale | Best for | BOSSNYUMBA fit |
|---|---|---|---|
| [Onyx](https://github.com/onyx-dot-app/onyx) | OSS, MIT, 100M+ docs tested | Self-hosted enterprise search w/ ACL | Reference for connector ACL ingestion |
| [AnythingLLM](https://anythingllm.com/) | 53k+ stars, MIT | Local-first RAG workspace, 30+ LLM providers | UX reference for tenant chat-with-docs |
| [WeKnora (Tencent)](https://github.com/Tencent/WeKnora) | OSS | Multi-tenant 4-tier RBAC + per-resource ownership + per-tenant audit + Wiki Mode with auto-generated KG | Multi-tenancy blueprint |
| [Klu](https://klu.ai/) | SaaS | LLM ops + multi-provider workspace | Operator console pattern |
| [Curiosity](https://curiosity.ai/) | SaaS, Made-in-Germany | Personal/SME unified search, in-memory engine | UX inspiration for operator-personal-brain |

### 1.3 Personal-brain reference (Mem / Reflect / Tana)

These don't ship into BOSSNYUMBA but inform the **operator persona** UX:

- **Mem AI** — self-organizing notes, no manual structure, "notes as runtime context only" privacy stance.
- **Reflect** — networked-thought minimal app, AI suggests links.
- **Tana** — **node-based, every-piece-of-information-is-an-object** structured graph. Most powerful PKM in 2026.

The Tana node-graph model is the closest single-user analogue to BOSSNYUMBA's tenant-scoped CPG.

---

## 2. Connector / Ingestion Matrix for Property Management (EA/Africa)

| Connector | Impl difficulty | Value (1-5) | EA/Africa specifics | BOSSNYUMBA status |
|---|---|---|---|---|
| **WhatsApp Cloud API (Meta direct)** | M | 5 | 85% of tenant comms in KE/TZ; supports voice notes, images of M-Pesa receipts/leaks/damage | Outbound shipped (`services/notifications/src/whatsapp/`); **inbound mining missing** |
| **WhatsApp via Africa's Talking aggregator** | L | 4 | Easier KYC than direct Meta; bundles SMS+USSD+voice | Not built. Recommended as fallback for tenants without Meta approval |
| **WhatsApp Business Suite (multi-device)** | M | 5 | Captures operator-side group chats + 1:1 chats | Not built. **Critical gap.** |
| **M-Pesa Daraja 3.0 STK Push + C2B + B2C + B2B** | M | 5 | Default payment rail in KE; Daraja 3.0 launched Nov 2025; **[Daraja MCP](https://mcpmarket.com/server/daraja)** exposes payments as agent-callable tools | C2B/STK shipped (`mpesa-adapter.ts`, `mpesa-real.ts`); **MCP wrap missing** |
| **Tigo Pesa + Airtel Money (TZ)** | M | 4 | Tanzania-equivalent rails; Tigo dominant in TZ urban | Not built. **Tier-1 gap for TZ market.** |
| **GePG (Tanzania Govt Payment Gateway)** | M | 4 | Required for any GoT-adjacent property (rents on govt land, KMC, etc.) | Shipped (`gepg-real.ts`) |
| **KRA eTIMS + iTax (KE)** | H | 4 | Mandatory e-invoicing 2024+; rental income reporting | KRA eRITS shipped (`kra-erits-real.ts`); eTIMS missing |
| **TRA (TZ Revenue Authority)** | H | 3 | EFD device integration for rent receipts | Not built |
| **eARDHI (TZ land registry)** | H | 3 | Title verification, lease registration | Shipped (`eardhi-adapter.ts`) |
| **NIDA (TZ National ID)** | M | 5 | KYC for tenant onboarding | Shipped (`nida-adapter.ts`, `nida-real.ts`) |
| **Credit bureaus (Metropol KE, CreditInfo TZ, CRB)** | H | 4 | Rent-reporting + tenant scoring | Shipped (`credit-bureau-adapter.ts`) |
| **Slack** | L | 4 | Operator team comms, ticketing handoff | Not built |
| **Gmail / M365 Outlook (IMAP + Graph)** | M | 4 | Lease attachments, vendor invoices, escalations | Not built |
| **Notion / Confluence** | L | 3 | Internal playbooks, vendor SLAs | Not built |
| **Google Drive / OneDrive / Dropbox** | M | 4 | Inspection photos, lease PDFs, accountant XLSX | Not built (doc-intelligence ingests via upload but no folder watch) |
| **Linear / Jira** | L | 3 | Operator engineering tickets, eviction tracking | Not built |
| **Zendesk / Intercom** | L | 3 | Tenant support tickets | Not built |
| **Gong / Chorus** | L | 3 | Sales-call mining for landlord renewals | Not built; consider [Unified.to](https://unified.to/) abstraction |
| **Zoom / Google Meet / Teams recordings** | M | 4 | Inspection walkthroughs, owner reviews | Not built |
| **Granola / Fathom / Otter / Tactiq / Read.AI** | L | 3 | Inspection meeting transcripts pushed to brain via webhook (Granola local-first → ideal for offline TZ field inspectors) | Not built |
| **Calendar (Google / M365)** | L | 4 | Inspection scheduling, lease-renewal SLAs | Not built |
| **HubSpot / Salesforce** | M | 2 | Larger property mgmt firms have CRMs for owner acquisition | Not built |
| **Twilio / Africa's Talking voice** | M | 4 | Tenant call recording + transcript | Africastalking lib hooked; not yet mining-grade |
| **OPay / mobile wallets (NG expansion)** | M | 3 | Future-proofing for Lagos | Shipped (`services/mcp-server-opay/`) |
| **FIRS / NGGIS (NG)** | H | 3 | Nigeria tax + property registry | Shipped (`services/mcp-server-firs/`, `services/mcp-server-nggis/`) |

**Recommended ingestion priority for v1 brain:**

1. **WhatsApp inbound mining** (operator + tenant groups) — `services/notifications/src/whatsapp/webhook-router.ts` already receives webhooks; need to fan-out into the brain.
2. **M-Pesa receipt mining** (auto-reconciliation of forwarded receipts) — pattern: tenant forwards M-Pesa SMS to WhatsApp → OCR/parse → match to `Lease.id` → post to ledger → notify operator if anomaly.
3. **Slack inbound** (operator team) — install OAuth, subscribe `message.channels` + `message.groups`, ingest only allowed channels per tenant.
4. **Google Drive folder watch** (lease PDFs / inspection photos) — incremental sync + ACL inheritance.
5. **Gmail mining** (operator inbox) — filter by labels `lease/*`, `vendor/*`, `tenant/*`.

---

## 3. Skill-Extraction Pipeline Architecture

The **company brain primitive** is the pipeline:

```
┌─────────────────────────────────────────────────────────────────────┐
│  CONNECTORS (Layer 1) — synced + federated dual mode                │
│  WhatsApp · M-Pesa · Slack · Gmail · Drive · Linear · Calendar · ...│
│  → emit ACL-tagged Event(source, actorId, tenantId, payload, ts)    │
└──────────────────────────────┬──────────────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  WORK GRAPH (Layer 2) — Canonical Property Graph                    │
│  Already shipped: packages/graph-sync/src/schema/{node-labels,      │
│    relationship-types,constraints}.ts                                │
│  Nodes: Org/Property/Unit/Lease/Person/Document/Payment/WorkOrder/  │
│         Message/Inspection/Notice/...                                │
│  Edges: BELONGS_TO / OCCUPIES / PAID_BY / RAISED_BY / FORWARDED /   │
│         DECIDED_BY / SUPERSEDED_BY / ...                             │
│  Bi-temporal: every fact has (valid_from, valid_to, observed_at,    │
│               asserted_at, supersedes_id)                           │
│  ACL: every node carries _tenantId + (private|team|tenant|public)   │
└──────────────────────────────┬──────────────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  TRAJECTORY STORE (Layer 2.5) — append-only Action+Outcome log      │
│  Already half-shipped: packages/ai-copilot/src/learning-loop/       │
│    outcome-capture.ts, pattern-extractor.ts                          │
│  Schema: {tenantId, actorId, intent, domain, actionType, context,   │
│           toolCalls[], outcome: success|failure, latencyMs,          │
│           humanApproved?, ts}                                        │
└──────────────────────────────┬──────────────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  SKILL MINER (Layer 3) — nightly consolidation worker               │
│  Already half-shipped: services/consolidation-worker/                │
│  Pattern: services/consolidation-worker reads trajectory store,      │
│    groups by (domain, actionType), filters successCount/(s+f) >     │
│    THRESHOLD over >= N obs, runs Trace2Skill-style hierarchical     │
│    consolidation, deduplicates, computes chi-squared significance,   │
│    emits SkillCandidate{ name, nlDescription, toolCallTemplate,     │
│      successCount, failureCount, contextFeatures[] }                 │
└──────────────────────────────┬──────────────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  HUMAN APPROVAL GATE (Layer 3.5) — Ghostwriter-style sandbox        │
│  NEW — needs building                                                │
│  Operator UI shows diff (before/after skill), runs sandbox replay   │
│    over historical traces, surfaces "this skill would have fired   │
│    X times last month, succeeded Y times, would have changed Z      │
│    decisions", operator approves → promotes to skill library         │
└──────────────────────────────┬──────────────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  SKILL LIBRARY (Layer 4) — Anthropic SKILL.md format                │
│  Already half-shipped: packages/ai-copilot/src/skills/{kenya,       │
│    estate,admin,org,graph}/*.ts + packages/central-intelligence/    │
│    src/kernel/skill-library/skill-retriever.ts                       │
│  Storage: skill_registry table (Voyager pattern), per-tenant +      │
│    platform-default scoping, embedding column for top-K retrieval   │
│  Discovery: at inference, kernel embeds intent → top-K skill match  │
│    → renders as "Available learned skills: …" system addendum        │
└──────────────────────────────┬──────────────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  SKILL ROUTER (Layer 5) — picks skill + model + approval gate       │
│  Already shipped: packages/ai-copilot/src/orchestrator/             │
│    + packages/central-intelligence/src/kernel/ttc-allocator.ts      │
│  At runtime: skill matched → check ACL of asking actor against      │
│    skill's required scopes → check risk-tier → if exceeds tenant    │
│    autonomy budget, route to four-eye approval                       │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.1 Skill examples extracted from communication

The "James in Slack always asks for the maintenance receipt before approving" rule:

**Trajectory observations (in `trajectory_store`):**
```
{ actorId: 'james', intent: 'approve-workorder', domain: 'maintenance',
  actionType: 'request-attachment', context: { workOrderId: 'WO-123',
    attachmentType: 'receipt' }, outcome: 'success', humanApproved: true,
  ts: '...' } × 47 observations across 12 months
```

**Pattern extractor output:**
```
Feature `attachmentType=receipt` has chi-squared = 18.4 vs baseline
  (3.84 = 95% significance), present in 47/52 (90%) of James's
  approval flows, absent in 60/80 (75%) of decline flows.
  → PATTERN SIGNIFICANT
```

**Mined skill (`.claude/skills/<tenant>/approve-workorder-with-receipt.md`):**
```yaml
---
name: approve-workorder-with-receipt
description: When approving a maintenance work order on behalf of
  operator James (or operators with `requires-receipt` policy flag),
  request and attach the vendor receipt photo BEFORE submitting
  the approval. Skip for emergency-tier work orders.
allowed-tools: ["request-attachment", "ocr-receipt", "match-to-vendor",
  "submit-approval"]
trigger-features:
  domain: maintenance
  actionType: approve-workorder
  actorId: james OR actor.policyFlags.includes('requires-receipt')
exclusions:
  - workOrder.tier == 'emergency'
provenance:
  source: trajectory-mined
  observations: 47
  significance: 18.4
  miner-version: trace2skill-v1
---

# Approve Work Order with Receipt

1. Check if work order has `receiptPhotoUrl` attached.
2. If not, send WhatsApp template `request-receipt-from-vendor` to
   `workOrder.vendor.phoneNumber`.
3. Wait for vendor response (24h timeout → escalate to operator).
4. On photo received: OCR with `services/document-intelligence`,
   extract amount + date + vendor name.
5. Match to `workOrder.estimatedCost` (±15% tolerance).
6. Attach to work order, post comment, submit approval.
```

This skill becomes callable by the agent platform. The trajectory store grows; the consolidation worker periodically re-evaluates and updates `successCount/failureCount`; if the skill stops working (e.g., James leaves company), it auto-deprecates.

### 3.2 Trajectory mining specifics

- **Trace2Skill** (arxiv 2603.25158) — dispatches parallel sub-agents to analyze a diverse pool of executions, extracts trajectory-specific lessons, hierarchically consolidates into a unified, conflict-free skill directory via inductive reasoning. Transfers across LLM scales.
- **SkillRL** — experience-based distillation; transforms diverse experiences into structured skills rather than storing raw trajectories.
- **SkillGen** (arxiv 2605.10999) — verified inference-time skill synthesis. Produces a single, auditable skill.
- **Sierra Ghostwriter** — productized: failures → sandboxed fix validation → deploy queue.
- **Glean** — automatically generates skills from work patterns tracked on the personal graph (private beta).

**BOSSNYUMBA implementation:** the `consolidation-worker` service already exists; it needs to be extended to subscribe to `trajectory_store`, run Trace2Skill-style clustering, and promote to `skill_registry`. See `packages/central-intelligence/src/kernel/skill-library/skill-retriever.ts` for the read-side that's already wired.

---

## 4. Living vs Static Knowledge

| Concern | SOTA 2026 pattern | BOSSNYUMBA status |
|---|---|---|
| **TTL / decay** | Exponential decay with access-boost (Ebbinghaus / HippoRAG 2) | Shipped (`packages/ai-copilot/src/memory/memory-decay.ts`, default `ratePerDay=0.02`, `accessBoost=0.05`, `archiveBelow=0.1`) |
| **Refresh** | Incremental sync with watermark; per-source freshness signal | Partial — connectors framework supports it but no per-source schedule yet |
| **Versioning** | Semantic versioning of ontology (major.minor.patch) + changelog ([Improvado guide 2026](https://improvado.io/blog/enterprise-knowledge-graph)) | Schema has `_version`; ontology versioning not yet first-class |
| **Bi-temporal** | (valid_from, valid_to, observed_at, asserted_at, supersedes_id) — Zep/Graphiti pattern | LITFIN has it; BOSSNYUMBA CPG has `_syncedAt` only — gap |
| **Conflict resolution** | Detect contradictions, classify (freshness/opinion/competence), route to owner ([DRAGged into Conflicts](https://arxiv.org/pdf/2506.08500)) | **Not built. Critical gap.** |
| **Source credibility hierarchy** | `WhoseFactsWin` (arxiv 2601.03746) — ledger > graph > Slack > rumor | Not built |
| **GraphRAG community summaries** | Microsoft GraphRAG: level-0 leaf summaries → level-1 super → level-2 global | Not built; LITFIN does Leiden partition only |

---

## 5. Skills-as-Code (the open standard)

**[Anthropic Agent Skills](https://claude.com/blog/skills) is now the format.** Released as open standard December 2025; **adopted by OpenAI Codex CLI + ChatGPT** within weeks; Glean Assistant supports it May 2026.

**File format:**
```
.claude/skills/<skill-name>/
├── SKILL.md           # YAML frontmatter + Markdown body
├── scripts/           # Optional executable scripts (sandboxed)
│   └── reconcile.py
└── resources/         # Optional templates, data, examples
    └── template.docx
```

**Frontmatter contract:**
```yaml
---
name: <skill-id>
description: <plain-English match criteria — Glean found 20% trigger
  drop without good negative examples + edge cases>
allowed-tools: ["tool-a", "tool-b"]  # ACL hint for skill router
---
```

**Three-layer loading (Glean + Anthropic agree):**
1. **Metadata** — always loaded, drives matching (cheap, ~50 tokens/skill).
2. **Instructions** — loaded when triggered (medium, ~500-2000 tokens).
3. **Resources/code** — loaded on demand during execution (expensive, only when needed).

**BOSSNYUMBA today:**
- Skills exist as **TypeScript ToolHandlers** (`packages/ai-copilot/src/skills/{kenya,estate,admin,org,graph}/*.ts`), not as SKILL.md.
- Skill retrieval exists (`packages/central-intelligence/src/kernel/skill-library/skill-retriever.ts`) with the right Voyager pattern (embed intent → top-K).
- **Gap:** skills are not in the portable spec format; they cannot be authored by non-engineers; they cannot be shared cross-tenant; the marketplace ecosystem (e.g., [SkillsMP](https://skillsmp.com/)) is unreachable.

**Migration path:** add a `SKILL.md` loader that maps frontmatter → ToolHandler at boot. Keep existing TS skills as the "stdlib" but allow per-tenant authored skills via the spec. Reverse-port the Anthropic loader.

**Comparable specs:**
- **Microsoft Copilot Studio agents** — JSON + adaptive cards. Less portable.
- **OpenAI Custom GPTs** — JSON manifest + actions schema. Vendor-locked.
- **Cursor rules** — `.cursorrules` markdown. No frontmatter, no allowed-tools, no executable code.
- **Aider `.aider.conf`** — config only, not skills.

**Conclusion:** Anthropic SKILL.md is the de-facto winner. Adopt it as BOSSNYUMBA's tenant-authored skill format.

---

## 6. Trajectory Mining — Turning Past Human Work Into Agent Skills

Three reference systems:

**Cognition (Devin)** — [annual performance review 2025](https://cognition.ai/blog/devin-annual-performance-review-2025) confirms trajectory replay as the core training mechanism. Devin's 2026 work focuses on understanding real-world codebases via context collaboration.

**Sierra (Ghostwriter)** — analyzes real interactions → identifies failures → validates fixes in sandbox → queues approved changes for deployment.

**Decagon** — analytics tag conversations to identify themes, flag anomalies, suggest KB additions.

**Research:**
- [Trace2Skill](https://arxiv.org/pdf/2603.25158) — parallel sub-agents extract trajectory-specific lessons, hierarchical consolidation.
- [SkillRL](https://arxiv.org/pdf/2602.08234) — experience distillation > raw trajectory storage.
- [SkillGen](https://arxiv.org/html/2605.10999v1) — verified inference-time skill synthesis.
- [Trajectory-Informed Memory Generation](https://arxiv.org/pdf/2603.10600) — actionable learnings from execution trajectories.

**BOSSNYUMBA implementation today:**
- Outcome capture: `packages/ai-copilot/src/learning-loop/outcome-capture.ts` ✓
- Pattern extractor: `packages/ai-copilot/src/learning-loop/pattern-extractor.ts` (chi-squared significance ≥3.841) ✓
- Reflection: `packages/ai-copilot/src/learning-loop/reflection.ts` ✓
- Policy proposer: `packages/ai-copilot/src/learning-loop/policy-proposer.ts` ✓
- Dry-run gate: `packages/ai-copilot/src/learning-loop/dry-run-gate.ts` ✓ (Ghostwriter equivalent — sandbox before promote)
- Memory extractor: `packages/ai-copilot/src/memory/memory-extractor.ts` ✓ (rule-based, no LLM)

**Gap:** the loop exists but isn't fed by **multi-source trajectories** (WhatsApp threads, Slack threads, Gmail threads). It runs over the agent's own tool calls only. Need to ingest **human-only** trajectories too: an operator's WhatsApp thread that resolves a maintenance issue without ever invoking the agent IS still a trajectory the skill miner should learn from.

---

## 7. Graph Structures for Company Brain

BOSSNYUMBA's CPG (`packages/graph-sync/src/schema/`) already models:
- **Org/Property/Unit/Lease/Person** (entity graph)
- **WorkOrder/MaintenanceRequest/Task/Inspection/Issue** (operations graph)
- **Invoice/Payment/LedgerEntry/PaymentPlan** (finance graph)
- **Case/Notice/EvidencePack** (legal graph)
- **Message/Announcement** (comms graph — node exists but underused)
- **TimelineEvent** (chronology)

**Missing brain-specific graphs:**

1. **Slack-thread → decision → outcome graph**
   - Nodes: `SlackThread`, `Decision`, `Outcome`, `Actor`
   - Edges: `STARTED_BY`, `DECIDED_BY`, `LED_TO`, `RESOLVED_BY`
   - Mining: thread auto-classification (decision vs question vs FYI) via lightweight LLM tag

2. **WhatsApp-message → property → action graph**
   - Nodes: extend `Message` with `mediaType` (text/voice/image/document), `forwardedFrom`
   - Edges: `MENTIONS_PROPERTY`, `MENTIONS_TENANT`, `CONTAINS_RECEIPT`, `RESULTED_IN_WORKORDER`

3. **M-Pesa-payment → tenant-account → property graph** (already partially exists)
   - Strengthen with **auto-reconciliation edges** when tenant forwards `M-PESA confirmation` text/screenshot

4. **Lease-document → clause → obligation → calendar graph**
   - Nodes: extend `Document` with `Clause`, `Obligation`, `CalendarTrigger`
   - Edges: `HAS_CLAUSE`, `CREATES_OBLIGATION`, `TRIGGERS_ON`
   - Mining: extract escalation dates, renewal dates, deposit return dates from leases on ingest

5. **Vendor-quote → work-order → completion → review graph**
   - Powers vendor-reliability scoring

---

## 8. Privacy / Access Control

Three permission models from SOTA:

1. **Onyx pattern** — ACL ingested at the same time as content, filtered at query time. Simple, scalable, no leakage via answer aggregation.
2. **Microsoft Graph dual-mode** — synced (ACL snapshot at index time) vs federated (live ACL via MCP). Federated is better for sensitive sources where ACL changes frequently.
3. **WeKnora (Tencent)** — 4-tier role matrix + per-resource ownership + per-tenant audit log. Best for multi-tenant.

**BOSSNYUMBA today:**
- `AsyncLocalStorage`-bound tenant isolation enforcer ✓
- `packages/authz-policy/` — policy engine ✓
- `packages/graph-privacy/` — differential privacy aggregator with ε-budget ledger ✓
- Per-node `_tenantId` in CPG ✓

**Gaps for company brain primitive:**

1. **Source-based ACL inheritance.** A Slack DM ingested into the graph must retain the `dm:user-a:user-b` ACL. A private Slack channel must retain `private:channel-x` ACL. The retriever must check the **asking user's membership** at query time, not at ingest time. Today the connector framework doesn't carry ACL fields.
2. **Skill ACL.** A skill mined from operator-only conversations should not be triggerable by tenant-facing personas. Add `allowed-tools` + `allowed-actors` to SKILL.md frontmatter.
3. **Cross-tenant skill leak.** Skills must default to tenant-scoped; promotion to platform-default requires explicit operator gesture + redaction review.

---

## 9. Voice + Meeting Intelligence

| Tool | Cost | Architecture | EA/Africa fit |
|---|---|---|---|
| [Granola](https://granola.ai/) ($14/mo) | Local-first Mac, transcripts stay local, cloud sync optional | **Best for offline TZ/KE field inspectors** — works on patchy connectivity |
| [Fathom](https://fathom.video/) (free unlimited) | Cloud, 30-sec summaries | Best individual all-rounder for English Zoom |
| [Otter](https://otter.ai/) ($16.99/mo Pro) | Cloud, 89.7% accuracy | Good for English; Swahili spotty |
| [Tactiq](https://tactiq.io/) ($12/mo) | Chrome ext for Google Meet | Specialist for property-owner Meet calls |
| [Read.AI](https://read.ai/) ($19.75/mo) | Meetings+emails+messages unified | **Most-connected — closest to brain primitive** |
| [Fireflies](https://fireflies.ai/) ($10/mo Pro) | Cloud, 91.3% accuracy | Highest tested accuracy |

**Inspection-walkthrough use case (KE/TZ-specific):**
- Field inspector visits property, records 10-min walkthrough on phone.
- Granola/Otter transcribes (Swahili+English code-mix).
- Output ingested via connector → CPG `Inspection` node + linked `Issue` nodes for each defect identified.
- Skill: "every Inspection with `pendingIssue.severity >= 3` triggers WhatsApp template to owner within 24h."

**BOSSNYUMBA action:** add `packages/connectors/src/adapters/granola-webhook.ts` + `otter-webhook.ts`. Already half-positioned by `packages/central-intelligence/src/kernel/voice/`.

---

## 10. The Company-OS Stack

| Vendor | Role | BOSSNYUMBA relevance |
|---|---|---|
| **Workato** (#1 iPaaS, MCP leader) | Enterprise MCP — turns proven business processes into governed agent-ready skills | Reference architecture for skill governance + approval |
| **Zapier Central + Tables** | No-code AI agents for SMBs | UX reference for tenant-admin agent builder |
| **Lutra** | AI-native workflow builder | UX reference |
| **Bardeen** ($20/mo Pro) | Browser-based automation, Chrome ext | Possibly bundle as "operator dashboard skill runner" |

**Pattern:** The "company OS" stack is converging on **MCP as the universal skill-callable protocol**. BOSSNYUMBA already has `packages/mcp-server/` + `services/mcp-server-*` for FIRS / NGGIS / NIN / OPay / process-intel. Extending this pattern means **every connector should also expose an MCP server** so third-party brains (Claude Desktop, Cursor, ChatGPT) can call into BOSSNYUMBA's tenant brain directly.

---

## 11. What BOSSNYUMBA Already Has (cross-reference)

### Already shipped (substantial implementation)
- `packages/connectors/src/base-connector.ts` — token-bucket rate limiting, circuit breaker, OAuth2 refresh, audit sink, Zod validation, idempotency ✓
- `packages/connectors/src/registry.ts` + `orchestrator.ts` + `health-scheduler.ts` — full connector lifecycle ✓
- `packages/connectors/src/adapters/{mpesa,mpesa-real,gepg-real,kra-erits-real,nida,nida-real,eardhi,credit-bureau}.ts` — 8 adapters ✓
- `packages/graph-sync/src/schema/{node-labels,relationship-types,constraints}.ts` — Canonical Property Graph with 60+ node labels across Org/Property/People/Contract/Ops/Finance/Legal/Market/Timeline ✓
- `packages/graph-sync/src/sync/{batch-sync,graph-sync-engine}.ts` + `queries/graph-{agent-toolkit,query-service}.ts` ✓
- `packages/graph-privacy/src/{noise,budget-ledger,aggregators/dp-aggregator}.ts` — ε-budget differential privacy ✓
- `packages/ai-copilot/src/knowledge/{knowledge-store,indexer,retriever,citations,policy-packs,platform-seed,case-studies/}.ts` — tenant-scoped institutional knowledge + RAG ✓
- `packages/ai-copilot/src/memory/{semantic-memory,memory-extractor,memory-decay}.ts` — semantic memory with exponential decay ✓
- `packages/ai-copilot/src/learning-loop/{outcome-capture,pattern-extractor,reflection,policy-proposer,dry-run-gate,confidence-scorer}.ts` — trajectory mining + chi-squared significance + Ghostwriter-equivalent dry-run gate ✓
- `packages/ai-copilot/src/learning-engine/{adaptive-learner,continuous-learning-store,curriculum-builder,micro-learning-engine,learning-style-detector}.ts` ✓
- `packages/ai-copilot/src/skills/{kenya,domain,estate,admin,org,graph}/*.ts` — 20+ executable skills as TS ToolHandlers ✓
- `packages/central-intelligence/src/kernel/skill-library/skill-retriever.ts` — Voyager-pattern top-K skill retrieval ✓
- `packages/central-intelligence/src/kernel/memory/` + `consolidation/` — consolidation pipeline ✓
- `packages/ai-copilot/src/ambient-brain/{ai-presence-manager,behavior-observer,page-context-registry,proactive-intervention}.ts` ✓
- `services/notifications/src/whatsapp/{client,conversation-orchestrator,webhook-router,meta-client,templates,emergency-handler,maintenance-handler,feedback-collector,reminder-engine}.ts` — full WhatsApp stack (outbound + webhook routing) ✓
- `services/document-intelligence/src/providers/{aws-textract,google-vision,mock,ocr-factory}.ts` — OCR ✓
- `services/mcp-server-{firs,nggis,nin,opay,process-intel}/` — 5 MCP servers exposing connectors as agent tools ✓
- `packages/mcp-server/src/{bossnyumba-mcp-server,tool-registry,universal-tool-adapter,mcp-resources,prompts,tier-router}.ts` — MCP server + universal tool adapter ✓
- `packages/ai-copilot/src/ai-native/{doc-intelligence,dynamic-pricing,legal-drafter,market-surveillance,multimodal-inspection,natural-language-query,pattern-mining,policy-simulator,polyglot-support,predictive-interventions,sentiment-monitor,voice-agent}/` — 12 AI-native modules ✓

### Half-shipped / scaffolded
- Slack/Gmail/Drive/Linear/Jira/Zendesk connectors — not built
- WhatsApp **inbound mining** (the brain primitive's #1 input) — webhook receives but does not fan-out to brain
- M-Pesa MCP wrap — adapter shipped, MCP wrap missing
- Bi-temporal facts in CPG — `_syncedAt` only, no `valid_from/to`
- Conflict detection between sources — not built
- SKILL.md authoring + loading — skills exist only as TS code
- Trajectory ingestion from **human-only** flows (operator finishes a WhatsApp thread without invoking agent) — not built
- GraphRAG community summaries — not built
- Source-based ACL inheritance through connector — `_tenantId` only, no fine-grained ACL fields

---

## 12. Twelve Concrete Brain Components to Build (Prioritized)

> Sized assuming current architecture; assumes 1-2 engineers + the existing `packages/connectors/` + `packages/ai-copilot/learning-loop/` foundations. Each builds on the next.

### Tier 1 — Inbound mining (the missing input layer) — 6-8 weeks

1. **WhatsApp inbound brain feed** (1 wk)
   - Wire `services/notifications/src/whatsapp/webhook-router.ts` to fan-out to a new `BrainEventBus` (Kafka/Redis Streams).
   - Persist every inbound `Message` node in CPG with `mediaType`, `forwardedFrom`, `quotedMessage`, `groupId`.
   - **Files:** `services/notifications/src/whatsapp/brain-feed.ts`, `packages/graph-sync/src/sync/whatsapp-sync.ts`
   - **Value:** unlocks 85% of tenant-side knowledge ingestion. Highest ROI single feature.

2. **M-Pesa receipt auto-reconciliation pipeline** (1 wk)
   - Tenant forwards M-Pesa confirmation SMS into WhatsApp → OCR via `services/document-intelligence` → parse `txn_id, amount, payer_name, ref_code` → match to `Lease.id` via ref-code → post `LedgerEntry` → emit `BrainEvent`.
   - **Files:** `packages/ai-copilot/src/ai-native/mpesa-reconciliation/`, extend `packages/graph-sync` with `Payment ↔ Lease ↔ Property` edges.
   - **Value:** kills the #1 manual reconciliation work in KE property mgmt.

3. **Slack connector (operator team brain feed)** (1 wk)
   - OAuth + `message.channels` + `message.groups` subscriptions + ACL-aware ingest.
   - **Files:** `packages/connectors/src/adapters/slack-connector.ts`, `packages/connectors/src/adapters/slack-acl.ts`.
   - **Value:** mines operator decisions ("approved by James", "escalate to legal") into the trajectory store.

4. **Gmail/M365 connector with label-filtered mining** (1-2 wk)
   - Incremental sync via Gmail History API / Graph delta. Filter `lease/*`, `vendor/*`, `tenant/*` labels.
   - Extract attachments → `services/document-intelligence` → CPG.
   - **Files:** `packages/connectors/src/adapters/gmail-connector.ts`, `outlook-connector.ts`.
   - **Value:** captures the "long-form" decision history that doesn't fit in WhatsApp.

### Tier 2 — Skill productization (turn observations into executables) — 4-6 weeks

5. **SKILL.md loader + authoring UI** (1-2 wk)
   - Adopt Anthropic SKILL.md spec. Add `packages/ai-copilot/src/skills/skill-md-loader.ts` that parses YAML frontmatter + Markdown body, maps to existing `ToolHandler`.
   - Per-tenant `.bossnyumba/skills/<tenant>/<skill>.md` directory in tenant blob storage.
   - Operator UI at `apps/operator/src/skills/` for browse/edit/test.
   - **Value:** non-engineer operators can author tenant-specific skills. Aligns with Anthropic/OpenAI/Glean open standard.

6. **Trajectory store fed from human-only flows** (1 wk)
   - Extend `packages/ai-copilot/src/learning-loop/outcome-capture.ts` to subscribe to `BrainEventBus` and capture human-completed flows (no agent involvement) as `OutcomeEvent { actorId, intent: inferred-via-LLM, ... }`.
   - **Value:** brain learns from operators' own work, not just its own.

7. **Ghostwriter-style skill miner + approval UI** (2 wk)
   - Extend `services/consolidation-worker` to run nightly Trace2Skill-style clustering over trajectory store.
   - Emit `SkillCandidate` rows; operator UI shows diff + sandbox replay over historical traces ("this skill would have fired X times last month, succeeded Y times").
   - On approval, write to `.bossnyumba/skills/<tenant>/`.
   - **Files:** `services/consolidation-worker/src/skill-miner/{cluster,candidate-generator,replay-engine}.ts`, `apps/operator/src/skills/ghostwriter.tsx`.
   - **Value:** the brain *generates its own skill catalogue* from observed work. This is the moat.

### Tier 3 — Living knowledge (freshness + conflict) — 3-4 weeks

8. **Bi-temporal CPG migration** (1 wk)
   - Add `valid_from`, `valid_to`, `observed_at`, `asserted_at`, `supersedes_id` to every CPG fact node (`Lease`, `Payment`, `Policy`, etc.).
   - Query helper: `asOf(timestamp)` filter.
   - **Files:** migration in `packages/database/`, extend `packages/graph-sync/src/schema/`.

9. **Source-credibility hierarchy + conflict detection** (1-2 wk)
   - Tag every ingested fact with `source: ledger|graph|email|slack|whatsapp|voice|rumor`.
   - When two facts conflict on the same entity+predicate+window, classify as `freshness|opinion|competence`, route to owner.
   - **Files:** `packages/ai-copilot/src/knowledge/conflict-detector.ts`, `packages/ai-copilot/src/knowledge/source-hierarchy.ts`.
   - **Value:** prevents the brain from confidently asserting outdated lease terms.

### Tier 4 — Voice + meeting intelligence — 2 weeks

10. **Granola/Otter webhook ingest for inspection walkthroughs** (1-2 wk)
    - Field inspectors record on phone → Granola transcribes → webhook fires to `packages/connectors/src/adapters/granola-webhook.ts`.
    - Transcript → CPG `Inspection` node + linked `Issue` nodes (severity-tagged via LLM).
    - **Files:** new connector adapter + webhook handler + `Inspection` graph schema extension.
    - **Value:** operator-friction-free knowledge capture.

### Tier 5 — Privacy + multi-tenancy hardening — 2 weeks

11. **Source-based ACL inheritance through connector** (1-2 wk)
    - Extend `packages/connectors/src/base-connector.ts` to carry `aclScope: {visibility, members, channelId}` per ingested record.
    - Retriever filters at query time against asking user's ACL graph.
    - **Files:** extend base connector types; extend `packages/ai-copilot/src/knowledge/knowledge-retriever.ts`.

12. **MCP server per connector** (1 wk)
    - Every connector also exposes an MCP server so external brains (Claude Desktop, Cursor, ChatGPT) can call tenant tools.
    - Add `packages/connectors/src/mcp-bridge.ts` that wraps any registered connector as an MCP server.
    - **Value:** makes the BOSSNYUMBA brain composable with the wider 2026 ecosystem.

---

## Sources

- [Anthropic — Introducing Agent Skills](https://claude.com/blog/skills)
- [Glean Skills launch May 2026](https://www.glean.com/blog/glean-skills-launch-2026)
- [Glean — Third-generation AI Assistant](https://www.glean.com/press/glean-introduces-third-generation-ai-assistant-new-enterprise-graph-to-enable-the-superintelligent-enterprise)
- [Glean Work AI Institute + autonomous agents](https://www.glean.com/press/glean-launches-the-work-ai-institute-unveils-autonomous-agents-built-on-glean-enterprise-context-to-operationalize-ai-at-work)
- [Glean May 2026 launch (AI coworker)](https://www.glean.com/blog/may-2026-launch)
- [Microsoft 365 Copilot connectors overview](https://learn.microsoft.com/en-us/microsoft-365/copilot/connectors/overview)
- [Microsoft 365 Copilot ecosystem (Agents/Actions/Connectors)](https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/ecosystem)
- [Microsoft Copilot Studio connectors](https://learn.microsoft.com/en-us/microsoft-copilot-studio/copilot-connectors-in-copilot-studio)
- [Notion Enterprise Search](https://www.notion.com/help/enterprise-search)
- [TechCrunch — Notion AI Agent Platform May 2026](https://techcrunch.com/2026/05/13/notion-just-turned-its-workspace-into-a-hub-for-ai-agents/)
- [Onyx (formerly Danswer) GitHub](https://github.com/onyx-dot-app/onyx)
- [Onyx connector docs](https://docs.onyx.app/overview/core_features/connectors)
- [Hebbia Deeper Research](https://www.hebbia.com/blog/inside-hebbias-deeper-research-agent)
- [Hebbia Matrix on Dynamic Business](https://dynamicbusiness.com/ai-tools/hebbia-revolutionizes-ai-interface-meet-the-matrix.html)
- [Sierra Expert Answers](https://sierra.ai/blog/expert-answers)
- [Sierra Ghostwriter platform](https://mlq.ai/news/sierra-ai-introduces-ghostwriter-platform-for-automated-agent-development/)
- [Sierra raises $950M at $15B (CMS Wire)](https://www.cmswire.com/customer-experience/sierra-raises-950m-at-15b-valuation-eyes-transformation-beyond-customer-support/)
- [Maven AGI agent platform](https://www.mavenagi.com/product/agent-platform)
- [Maven AGI primer](https://www.mavenagi.com/resources/enterprise-ai-agent-primer-customer-support-tools-terms-technologies)
- [Decagon knowledge base setup (eesel)](https://www.eesel.ai/blog/decagon-knowledge-base-setup)
- [Klu LLM Ops](https://docs.klu.ai/llm/llm-ops)
- [Klu emerging architectures](https://klu.ai/glossary/llm-emerging-architecture)
- [AnythingLLM](https://anythingllm.com/)
- [WeKnora (Tencent)](https://github.com/Tencent/WeKnora)
- [Curiosity.ai](https://curiosity.ai/)
- [Workato (Enterprise MCP)](https://www.workato.com/)
- [Zapier vs Workato (Zapier blog)](https://zapier.com/blog/zapier-vs-workato/)
- [WhatsApp Business API Africa (Arkesel)](https://arkesel.com/whatsapp-business-api-africa-guide/)
- [WhatsApp adoption across Africa](https://www.mynewsgh.com/how-whatsapp-business-api-is-reshaping-customer-communication-in-africa-key-trends-and-statistics/)
- [Africa's Talking WhatsApp](https://africastalking.com/chat/whatsapp)
- [Africa's Talking platform](https://africastalking.com/)
- [Safaricom Daraja portal](https://developer.safaricom.co.ke/)
- [M-Pesa Daraja API 2026 guide](https://cnbcode.com/blog/m-pesa-daraja-api-integration-requirements-complete-2026-guide)
- [Daraja MCP server](https://mcpmarket.com/server/daraja)
- [Top AI Meeting Notetakers 2026 (alfred_)](https://get-alfred.ai/blog/best-ai-meeting-notetakers)
- [Granola vs Tactiq comparison](https://zackproser.com/blog/granola-vs-tactiq)
- [Read.AI Granola alternatives 2026](https://www.read.ai/articles/granola-ai-alternatives-for-teams-in-2026)
- [Trace2Skill (arxiv 2603.25158)](https://arxiv.org/pdf/2603.25158)
- [SkillRL (arxiv 2602.08234)](https://arxiv.org/pdf/2602.08234)
- [SkillGen (arxiv 2605.10999)](https://arxiv.org/html/2605.10999v1)
- [Trajectory-Informed Memory Generation (arxiv 2603.10600)](https://arxiv.org/pdf/2603.10600)
- [From Transcripts to AI Agents (arxiv 2602.15859)](https://arxiv.org/html/2602.15859v1)
- [DSPy Agent Skills (PyShine)](https://pyshine.com/DSPy-Agent-Skills-Production-Grade-DSPy-3.2-Skills-for-Coding-Agents/)
- [Cognition Devin 2025 review](https://cognition.ai/blog/devin-annual-performance-review-2025)
- [Whose Facts Win? (arxiv 2601.03746)](https://arxiv.org/html/2601.03746v3)
- [DRAGged into Conflicts (arxiv 2506.08500)](https://arxiv.org/pdf/2506.08500)
- [Enterprise Knowledge Graph guide 2026 (Improvado)](https://improvado.io/blog/enterprise-knowledge-graph)
- [Multi-tenant AI Infrastructure isolation (Isuru Chathuranga)](https://isuruig.medium.com/multi-tenant-ai-infrastructure-the-5-isolation-layers-that-determine-whether-your-customers-data-340aaeef4922)
- [Unified.to ticketing APIs 2026](https://unified.to/blog/7_ticketing_apis_to_integrate_with_in_2026_zendesk_intercom_servicenow_and_unified_ticketing_apis)
- [Mem/Reflect/Tana comparison (TaskFoundry)](https://www.taskfoundry.com/2025/06/ai-knowledge-management-tools-mem-reflect-tana.html)
- [Tana knowledge graph](https://tana.inc/knowledge-graph)
- [SkillsMP marketplace](https://skillsmp.com/)
- [Anthropic skills repo](https://github.com/anthropics/skills)
