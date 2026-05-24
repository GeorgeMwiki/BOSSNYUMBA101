# Zero-Friction Conversational Onboarding — SOTA 2026 Research

> Scope: BOSSNYUMBA101 multi-tenant property mgmt. A landlord/PM/owner signs up, talks to "MD" (the tenant-facing AI persona), and the AI extracts portfolio + team + processes + tools + pain points FROM CONVERSATION + uploads, then bootstraps a working tenant workspace WITHOUT wizards or seed data. East Africa primary (Kenya/TZ/UG/Nigeria), WhatsApp-first, multilingual (English / Swahili / Sheng / Luganda / Hausa), M-Pesa-native.
> Date: 2026-05-23. Frontier patterns: Sierra Ghostwriter (Mar 2026), Notion Custom Agents (Sep 2025 + Jan 2026 v3.2), Anthropic Agent Skills + Skill cards (Dec 2025 open standard), OpenAI Workspace Agents (Apr 2026), Decagon Suggestions, Lovable conversational app gen, Lelapa Vulavula Swahili, Intella Swahili voice, Smile ID Africa KYC.

BOSSNYUMBA root: `/Users/georgesmackbookair/Desktop/CLAUDE_CURSOR_CODEX PROJECTS/Cursor Projects/BOSSNYUMBA101/`

Sibling audits in this folder: `01-brain-core.md`, `02-memory-rag-kg.md`, `03-security-governance.md`, `04-ops-infra.md`, `05-frontend-ui.md`, `06-eval-judge.md`, `07-tools-mcp-agency.md`, `08-sota-2026-frontier.md`, `10-outcome-as-a-service.md`.

---

## Executive TL;DR

The single biggest 2026-Q1 shift in onboarding is **"agent built by agent"**: Sierra Ghostwriter (Mar 25 2026), Notion Custom Agents (21k built in beta), OpenAI Workspace Agents (Apr 22 2026), Lovable, Bolt.new — all collapsed onboarding into a conversation. The new contract is: **describe what you want in plain English (or upload your SOPs / call transcripts / whiteboard photos / Excel sheets) and the AI builds the tenant workspace, the database schema, the role assignments, the trigger configuration, and the connector wiring.**

For a Kenya-first property mgmt SaaS this means MD should:

1. **Open with a 4–6 conversation starter card menu** (the OpenAI GPT pattern) — "Tell me about your buildings" / "Upload your tenant ledger" / "Send me a WhatsApp voice note in Swahili" / "Show me your current paybill receipts". Conversation starters double as in-product onboarding (proven to lift completion from 42% → 71%).
2. **Adopt a slot-filling DST loop with a fixed interview budget** (Macquarie/ACL 2026 psychiatric-intake pattern is the SOTA on minimum-question elicitation). 30+ data points (portfolio, team, processes, tools, compliance) extracted in ≤12 conversational turns by asking only the highest-information-gain next-question per state.
3. **Use multi-model document routing** (Reducto / TokenMix unified router pattern, 40–60% cost reduction): digital PDFs → Gemini 2.5 Pro (cheap), complex layouts → Claude Sonnet 4.6 (97.6% extraction accuracy), scanned receipts → GPT-4o Vision (97.3% OCR). Free tier should default to Gemini 2.5 Flash to keep onboarding under $0.05/tenant.
4. **Default to WhatsApp Business Cloud API** as the primary channel for Kenya/TZ/UG. Meta Cloud API is available in Kenya, supports voice notes + photos + receipts + docs natively, Twilio is the integration-friendly secondary. M-Pesa STK-push for the first invoice should land INSIDE the WhatsApp thread — no app install required. Daraja 3.0 (Nov 2025) is the production API.
5. **Apply Anthropic AUP "selective transparency"**: MD MUST disclose AI use at session start (mandatory for high-risk: lending recommendations, payment automation), expose a "capability card" that says WHAT MD can do without leaking system prompts, and route every action above an autonomy budget to human approval. Progressive Disclosure (Anthropic Skills pattern, now open standard adopted by OpenAI/Google/GitHub/Cursor in Q1 2026) is the architectural primitive — load only metadata first, expand on demand.

What BOSSNYUMBA needs to build (10 concrete things, last section): a new `services/onboarding-orchestrator` (Mastra or LangGraph durable state machine), 30+ slot definitions with zod schemas in `packages/domain-models/onboarding/`, a `packages/chat-ui/onboarding-canvas` widget mode (split-pane: chat ↔ live tenant workspace preview), a `packages/document-extraction/` thin wrapper around multi-model routing, and a WhatsApp-first ingress at `services/api-gateway/whatsapp-onboarding/`. NO fake data — only what the user gives.

---

## 1. Frontier examples (May 2026)

### 1.1 Sierra Ghostwriter (Mar 25 2026) — agent that builds agents

The frontier reference. A support manager describes the agent they need in plain English; Ghostwriter ingests SOPs, customer call transcripts, audio recordings, photos of whiteboard sketches, then deploys to voice + chat + email + SMS + WhatsApp in 30+ languages — and runs a continuous improvement loop (Explorer) that analyses real interactions, identifies failures, validates fixes in a sandbox, and queues approved changes for deployment.

- **Pattern (a)**: replace forward-deployed engineers with conversation. Sierra previously did 4–10 week onboarding; Ghostwriter compresses to a single conversation.
- **Pattern (b)**: multi-modal intake (text + audio + image + docs) as the universal description language. Whiteboard photos and call transcripts are first-class inputs.
- **Pattern (c)**: agent assembly line — Explorer is "ChatGPT deep research over your customer conversations", not over the web. Always-on optimisation.
- **What BOSSNYUMBA copies**: MD ingests landlord's existing ledger Excel + lease PDFs + WhatsApp screenshots + verbal description of "how I manage Mwananchi Court". Generates the tenant + property + unit + lease + tenant-resident + vendor entities, the collection rules, the default penalty/grace period, the WhatsApp escalation tree.
- **WhatsApp/voice variant**: native — Ghostwriter accepts audio recordings as input. The Intella Swahili voice and ElevenLabs 70+ language coverage close the language gap for EA.

### 1.2 Decagon Quickstart + Suggestions (2026)

Decagon's "Unified Knowledge Graph" ingests help-centre articles, product docs, past conversations, CRM data, internal APIs, agent macros. The 2026 differentiator is **Suggestions**: analyses conversations where the AI struggled, identifies patterns, auto-drafts new help articles from how top human agents resolved similar issues. 6-week onboarding (sandbox setup, suffix whitelisting, dedicated Slack channel).

- **Pattern**: gap-detection drives KB growth. The agent's failures are training data.
- **WhatsApp/voice variant**: messages where the landlord says "huyu mteja hajalipa" repeatedly without a tool firing → Suggestions flags a missing "manual reminder send" macro.
- **What BOSSNYUMBA copies**: a `services/onboarding-orchestrator/gap-detector.ts` that watches MD's first 100 conversations per tenant and surfaces missing capabilities ("I don't know how to send Sunday reminders" → propose a cron + WhatsApp template).

### 1.3 Notion Custom Agents (Sep 2025 v3.0, Jan 2026 v3.2, May 13 2026 hub)

21,000 custom agents built in beta. Pattern: **describe the agent in chat → system generates instructions, trigger config, access settings, AND the database schema in one shot**. Sample prompt: *"Create a content calendar that includes YouTube videos and an email newsletter."* Returns a populated database + chart + assignments. May 13 2026 release made Notion the **hub** for external agents — assign work to ChatGPT, Claude, Gemini agents inside Notion, track progress.

- **Pattern**: schema-from-prompt. The user never opens a "create database" dialog.
- **What BOSSNYUMBA copies**: MD says "I have 14 units in Mwananchi Court, all 1BR, rent KES 18,000, due 1st" → system creates Property + Unit × 14 + Lease template + Rent-due cron + WhatsApp template, NO forms.
- **Voice/WhatsApp**: prompt becomes voice note; same generation pipeline.

### 1.4 Anthropic Claude Projects + Agent Skills (Dec 18 2025 open standard, Mar 2026 memory)

- **Projects**: persistent workspace with project knowledge. Documented friction = context fills with project files; relevance retrieval limited per query.
- **Skills**: filesystem-based `SKILL.md` with progressive disclosure. **Adopted by OpenAI, Google, GitHub, Cursor within weeks** of Dec 18 2025 release — this is the de-facto industry standard for capability declaration.
- **Memory** (Mar 2026): Claude now remembers project context, debugging patterns, preferred approaches across sessions automatically. View/edit/delete in Settings → Capabilities.
- **What BOSSNYUMBA copies**: every MD capability is a `SKILL.md` in `packages/central-intelligence/skills/`. The "discover capabilities" loop loads only metadata + descriptions, then progressively loads the full procedure when the slot/intent matches. This gives MD an honest, signed, scoped capability card per skill without leaking the orchestrator system prompt.

### 1.5 OpenAI Custom GPTs + Workspace Agents (Apr 22 2026)

- **Custom GPTs**: conversational builder ("describe what you want, ChatGPT drafts it") + configuration view. 4–6 conversation starters double as in-product onboarding.
- **Workspace Agents** (Apr 22 2026, free until May 6, credit-based after): shared, cloud-based agents that handle long-running multi-step workflows across the org, schedule themselves, run in background. **Write actions for connectors set to "Always ask during an agent run" by default** — this is the SOTA HITL default.
- **What BOSSNYUMBA copies**: every onboarding session must surface 4–6 conversation starters in the empty state ("Add my buildings", "Upload last month's rent receipts", "Connect M-Pesa", "Tell me what to do with arrears", "Set up reminders", "Hand over a tenant to a manager"). Write actions (invite team, create paybill mapping, send first WhatsApp campaign) default to "Always ask".

### 1.6 Linear AI workflows (Triage Intelligence, MCP agent support, 2026)

Linear's value: minimalist UI + opinionated workflow + near-instant team onboarding. The Linear/Voiceflow pattern is "conversational onboarding logs interactions to the issue tracker for later analysis" — a free observation channel.

- **What BOSSNYUMBA copies**: MD onboarding sessions auto-create Linear-style issues (or our internal equivalent) for every skipped slot, every uncertain answer, every rejected action — for human follow-up during Customer Success week 1.

### 1.7 HubSpot Breeze vs Salesforce Agentforce

- **Breeze** = integration-first, AI embedded in CRM, free Assistant, fast deploy. **Roles-aware** (which is critical for property mgmt: owner vs manager vs caretaker vs vendor vs tenant-resident vs accountant).
- **Agentforce** = customisable enterprise, Data Cloud setup, 18,500 customers, 3B monthly workflows.
- **What BOSSNYUMBA copies**: Breeze's role-aware context resolver. MD must know whether it's talking to a landlord/owner vs a unit-resident vs a property-mgr vs a vendor and serve different onboarding scripts per role.

### 1.8 Glean tenant connector wizard

Glean connectors route fetched data to an isolated tenant, E2E encrypted in transit, encrypted at rest within tenant boundary. Standard enterprise onboarding 2–5 business days, POC in 48h.

- **What BOSSNYUMBA copies**: connector wizard for M-Pesa paybill, WhatsApp Business number, Excel ledger, Google Drive (lease PDFs), Outlook (legacy email threads) — each with explicit "what we read / what we never read / how we encrypt" capability card before the user authorises.

### 1.9 Lovable + Bolt.new

Lovable = chat-first, design-first, structured plan before code. Bolt = developer-first, file tree + IDE. Lovable opens with a chat window, describes structured plan, generates polished MVP. $20M ARR in 2 months — fastest revenue ramp in European startup history.

- **What BOSSNYUMBA copies**: Lovable's "structured plan before action" — MD should always reflect back the plan ("I'll create Mwananchi Court with 14 units, attach landlord George Mwikila as owner, set rent KES 18,000 due 1st, enable M-Pesa STK push to paybill 247247, send WhatsApp reminders Day -3 / Day 0 / Day +5. Proceed?") before any write action.

### 1.10 Crew AI / Mastra / LangGraph (orchestration)

- **CrewAI**: fastest scaffold (~10 min to multi-agent flow), role-based — perfect for the onboarding orchestrator that needs `IntakeAgent`, `ExtractorAgent`, `ConfirmerAgent`, `BootstrapperAgent`, `VerifierAgent`.
- **Mastra**: TS-first, 150k weekly downloads, used by Replit/PayPal/Adobe. Best DX for the BOSSNYUMBA monorepo.
- **LangGraph**: durable execution, checkpoint, resume-on-failure, HITL interrupts — what onboarding actually needs (sessions span days).
- **Recommendation**: **Mastra + LangGraph durable patterns**. Mastra for the TS-native orchestrator surface; copy LangGraph's interrupt-and-resume semantics for the slot-fill loop because onboarding sessions can span multiple WhatsApp days.

---

## 2. Adaptive intake — not forms, conversation

### 2.1 SOTA: LLM-driven slot filling with fixed interview budget

The benchmark frontier (Macquarie / ACL 2026 psychiatric intake; arxiv 2604.22067 + zero-shot industry-grade systems arxiv 2406.08848): treat intake as **question-selection over a bank of 200+ clinically-grounded questions**, ask the highest-information-gain next-question given current state, work under a fixed budget. Beats random questioning and traditional intake forms.

**For BOSSNYUMBA the bank is ~80 questions across 10 slot categories**:

| Slot category | Sample questions | Default extractor |
|---|---|---|
| `tenant_identity` | Owner name, KRA PIN, ID number, phone, primary language | Smile ID + form |
| `portfolio_buildings` | "How many buildings?", "Where?", "What do you call each?" | LLM + map + photos |
| `portfolio_units` | Per building: unit count, types, rent ranges | LLM + Excel parse |
| `team_humans` | "Who helps you collect rent?", "Caretaker?", "Manager?" | LLM + phone numbers |
| `team_vendors` | "Plumber/electrician on call?", "How do you pay them?" | LLM + WhatsApp lookup |
| `processes_collection` | "When is rent due?", "Grace period?", "Penalty?" | LLM |
| `processes_arrears` | "After how many days do you call?", "Eviction policy?" | LLM |
| `processes_maintenance` | "Tenant reports how?", "SLA target?", "Who pays?" | LLM |
| `tools_money` | "M-Pesa paybill?", "Bank account?", "Till number?" | LLM + Daraja verify |
| `tools_comms` | "WhatsApp groups?", "Newsletter?", "Tenant union?" | LLM + WhatsApp link |
| `tools_records` | "Excel?", "Notebook?", "Property mgmt app?" | LLM + upload |
| `compliance_kyc` | Landlord registration, county licence, KRA tax | Smile ID + LLM + doc |
| `compliance_county` | Land rates, Single Business Permit, tenancy register | LLM + doc |
| `pain_points` | "What kills you most?", "What do you wish?" | LLM (free-text) |

### 2.2 Context-aware question selection

After each user response: re-rank remaining questions by information gain *given* current state, suppress redundant questions (don't ask "how many buildings" if user already said "Mwananchi Court, Sunrise Apartments, and the four houses in Karen"), batch related questions ("Tell me about Sunrise — units? rent? caretaker?" not three turns), and inject parallel discovery (ask one question, simultaneously fire a Smile ID lookup on the volunteered phone number to skip identity-verification turns).

### 2.3 Progressive profiling

HubSpot pattern: never re-ask. Each WhatsApp session continues the previous session's slot state. Slot persistence is in `services/onboarding-orchestrator/state-store` — a Postgres `onboarding_sessions` table with `slot_state JSONB`, `next_questions TEXT[]`, `interview_budget INT`, `completed_at TIMESTAMPTZ`. Resume via session ID embedded in WhatsApp message metadata.

### 2.4 Friction targets

- **Conversational onboarding lifts completion 42% → 71%** (industry benchmark, 2026). Voice/multimodal lifts it 3.5× over email-only.
- **MD's interview budget**: 12 turns for free tier, 25 turns for paid tier. After budget, surface remaining slots as a deferred checklist in the dashboard.

---

## 3. Document & file extraction

### 3.1 SOTA tooling comparison (May 2026)

| Tool | Strength | Cost (per 10pg) | EA-relevant? |
|---|---|---|---|
| **Claude Sonnet 4.6 (vision + docs)** | 97.6% accuracy on complex layouts | $0.060 | Default for leases, contracts |
| **GPT-4o Vision** | 97.3% character accuracy on scanned/low-quality | $0.048 | Default for handwritten receipts, faded forms |
| **Gemini 2.5 Pro** | Cheapest for bulk digital | $0.029 | Default for clean PDFs, Excel |
| **Gemini 2.5 Flash** | Sub-cent | $0.005 | Default for onboarding free tier |
| **Reducto** | Best table extraction (merged cells, multi-page tables); on-prem, SOC 2, zero-data-retention | Custom | When tenant uploads complex rent rolls |
| **LlamaParse** | Direct XLSX output; JSON + Markdown + screenshots | $0.003/page | Default for Excel rent ledgers |
| **Docling** (IBM) | Open-source, strong layout, low compute | Free | On-prem fallback |
| **Unstructured** | 30+ formats, chunking | Free + paid | Fallback for weird formats |
| **TokenMix unified router** | Auto-routes by doc type, 40–60% cost reduction | Per-route | Recommended router |

### 3.2 BOSSNYUMBA extraction pipeline

```
WhatsApp/web upload
  → detect doc type (PDF vs Excel vs image vs voice note vs heic)
  → route by type:
     - clean PDF       → Gemini 2.5 Flash (free) or Pro (paid)
     - complex lease   → Claude Sonnet 4.6
     - scanned receipt → GPT-4o Vision
     - Excel ledger    → LlamaParse → XLSX → zod-parsed
     - voice note      → ElevenLabs / OpenAI Whisper / Lelapa Vulavula
                          (Sw/Lug auto-detect)
     - photo of unit   → Claude Sonnet 4.6 (multimodal)
  → normalise to canonical schema
     (Property | Unit | Lease | Tenant | Vendor | Payment)
  → zod validation
  → diff vs current tenant state
  → propose change set to MD
  → MD confirms with user
  → commit
```

### 3.3 Voice-note transcription (critical for EA)

- **Intella Swahili voice** (Africa Forward Summit 2026) — target 2B-person voice market, EA-native.
- **Lelapa Vulavula** — transcription + translation + sentiment in Swahili, Lug, Hausa, isiZulu, Sesotho, African French. Enterprise-grade, AWS Marketplace, on-prem option.
- **OpenAI Whisper / GPT-4o-mini-transcribe** — multilingual fallback.
- **ElevenLabs Scribe** — sub-100ms latency, 70+ languages.
- **Recommendation**: **Lelapa Vulavula primary for Swahili/Lug, ElevenLabs fallback for everything else**. Cost diversity reduces vendor risk.

---

## 4. Capability discovery / explanation without IP leak

### 4.1 The disclosure problem

The 2026 AI Agent Index (MIT) found: only 4 of 30 agents publish agent-specific system cards; 25 of 30 disclose no internal safety results; 23 of 30 have no third-party testing. Vendors share far more about capabilities than safety. AND Anthropic's own system card admits Claude Code Security Review "is not hardened against prompt injection". A 2026 PoC showed malicious "agent cards" can embed adversarial instructions and exfiltrate data via the host LLM.

So the rule is: **publish capability descriptions (what), DO NOT publish system prompts (how)**. And every capability card MUST be cryptographically signed (NVIDIA-verified-skill-card pattern).

### 4.2 Anthropic Skills as the IP-safe pattern

Skills metadata (name + description + tags + inputModes/outputModes) is loaded into the model initially — this is the *only* layer exposed. The skill body (procedure, scripts, references, assets) loads progressively only when the skill is selected for the task. The agent2agent (A2A) Protocol's `AgentCard` formalises this contract.

### 4.3 Anthropic AUP-compatible disclosure (high-risk uses)

For property mgmt, the high-risk overlap is: **financial decisions (lending recommendations to retail), payment automation, employment decisions (vendor hiring/firing recs)**. AUP requires:

- Disclose AI use at the **beginning of each session** ("Hi, I'm MD, your property AI. I work alongside humans — your accountant George reviews every payment over KES 50,000.")
- Keep humans in the loop on consequential decisions.
- Document the disclosure mechanism in the public privacy policy.

### 4.4 The "MD capability card" pattern

A static + signed card shown in the onboarding "About MD" drawer. Example:

> **What MD can do:**
> - Read your lease PDFs and rent ledgers (you upload, MD parses)
> - Send WhatsApp messages to tenants (you approve the first 5 of each template)
> - Trigger M-Pesa STK-push for rent collection (you approve every push above KES 100k for first 30 days)
> - Verify tenant identities with Smile ID (with tenant consent at signup)
> - Draft eviction notices (you sign every one for the first 90 days)
>
> **What MD does NOT do:**
> - Take payments to its own account
> - Send messages without a template you reviewed
> - Make hiring/firing decisions about your staff
> - Share your tenant data with other landlords

This is the user-facing capability card. The orchestrator system prompt is never exposed.

### 4.5 "Ask before reveal" pattern

The 2026 OpenAI GPT pattern: 4–6 conversation starters in the empty state. Each starter is "AI can do X — would you like to see?", not a system-prompt dump.

---

## 5. Action-taking during onboarding

### 5.1 Autonomy budget (HITL gradient)

Industry consensus from 2026 (getclaw, AlignX, Galileo, OpenAI Agents SDK):

| Action class | Default policy | Approval | Reversibility |
|---|---|---|---|
| **Read tenant's own data** | Auto | none | n/a |
| **Read tenant's vendor's data** | Auto | none | n/a |
| **Create property/unit/lease** (within tenant boundary) | Auto with diff preview | "Looks right?" | Soft-delete; one-tap undo |
| **Invite team member** (email/SMS) | Approve each | Confirm | Cancellable until accepted |
| **Send first WhatsApp template to tenants** | Approve | Per-template | Cannot recall; rate-limit 50/min |
| **Trigger M-Pesa STK-push** | Approve every one under KES 100k, two-person above | Always | Cannot recall; 24h dispute window |
| **Move money B2C** | Two-person approval, always | Always | Cannot recall |
| **Sign legal docs** (notice, eviction) | Human sign always | Always | Until served |

### 5.2 OpenAI Workspace Agents default

Write actions for connectors set to "Always ask during an agent run" by default. **Copy this exactly** for the first 30 days of every tenant — the "supervised landing" period. After 30 days + 50 successful approvals on a class, auto-promote to "approve once" mode for that class.

### 5.3 Diff before commit (Lovable pattern)

Every write action produces a `ChangeSet` rendered in chat:
```
I'll do this:
+ Create property "Mwananchi Court"
+ Create units 1A..1G (7 units, 1BR, KES 18,000)
+ Create units 2A..2G (7 units, 1BR, KES 18,000)
+ Create lease template "Mwananchi standard"
+ Schedule rent-due reminder Day -3/0/+5
+ Wire M-Pesa paybill 247247 → unit ID

Looks right?  [Yes, do it] [Edit] [Cancel]
```

### 5.4 Reversible micro-actions (Hermes Agent / ASDLC pattern)

Every write action is a **micro-commit** with an idempotency key derived from `(tenant_id, session_id, step_index, action_type)`. Retries are safe. Rollback by reverse-applying the diff. Implementation: domain events into `audit_events` table; rollback handler reads forward then applies inverse.

### 5.5 Idempotency

Every side-effecting tool call gets a unique, deterministic key BEFORE execution (Anthropic 2026 best practice; Buildmvpfast retry-safe patterns). Workflow run ID + step index + action type. Onboarding sessions WILL retry — WhatsApp delivery flakes, M-Pesa STK-push times out — idempotency is not optional.

---

## 6. Workspace bootstrapping from chat

### 6.1 Programmatic schema creation

The onboarding orchestrator produces a `TenantBlueprint` zod object and feeds it through an idempotent provisioner:

```ts
// services/onboarding-orchestrator/src/bootstrap/blueprint.ts
type TenantBlueprint = {
  tenant: { name, country, currency, primary_language }
  properties: Property[]
  units: Unit[]
  leases: Lease[]
  team: TeamMember[]
  vendors: Vendor[]
  rules: { collection_day, grace_period, penalty_pct, ... }
  connectors: { mpesa_paybill?, whatsapp_number?, ... }
}
```

The provisioner is a sequence of idempotent steps:
1. `create_tenant` (org_id assigned, every row has org_id — WorkOS 2026 multi-tenant SaaS guidance)
2. `create_properties_bulk`
3. `create_units_bulk`
4. `create_leases_bulk`
5. `invite_team` (email/SMS via Notifications)
6. `wire_connectors` (M-Pesa paybill, WhatsApp number, Excel sync)
7. `seed_rules` (collection/penalty/maintenance)
8. `enable_templates` (rent-due reminder, arrears chase, maintenance ack)
9. `generate_dashboard` (auto-shape based on portfolio size)

Each step writes to `audit_events` with the idempotency key. Re-running the blueprint is a no-op.

### 6.2 Auto-generated dashboards from data shape

Notion v3.0 pattern: schema-from-prompt auto-generates the dashboard (chart, table, calendar). Apply to BOSSNYUMBA:
- 1–4 units total → simple table view, no charts.
- 5–20 units → table + occupancy gauge.
- 21–100 units → table + occupancy + arrears chart + collection-rate line + caretaker leaderboard.
- 100+ units → all of above + per-building drill-down + per-caretaker drill-down + heatmap.

Dashboard shape is computed by `packages/genui/dashboard-shape.ts` from `TenantBlueprint`, NOT chosen by the user.

### 6.3 Dry-run mode

Before commit, `npm run blueprint:dry-run -- --session <id>` (or in-chat "preview") emits the full action sequence + side-effects WITHOUT executing. Required for tenants > 50 units.

---

## 7. Voice-first onboarding

### 7.1 SOTA platforms (May 2026)

| Platform | Strength | EA fit |
|---|---|---|
| **ElevenLabs Agents** | Sub-100ms latency, 11k voices, 70+ languages, fastest prototype | Best for English/Sw/Lug TTS quality |
| **Vapi** | Provider-agnostic orchestration, 14+ providers, 99.99% SLA, $0.05/min orchestration | Best for production-grade reliability |
| **Retell** | Faster ship-to-prod than ElevenLabs/Vapi for week-1 calls | Good middle option |
| **Intella** | Native Swahili voice, EA-native | Best for outbound to tenants |
| **Bland.ai** | Cheapest at scale | Good for cost-sensitive |

### 7.2 Voice onboarding pattern

1. Landlord taps "Talk to MD" — opens browser/WhatsApp voice call.
2. MD opens: "Hi, I'm MD. I'm an AI and your conversation is recorded for training and audit. Are you OK to continue? Say 'yes' or hang up." (AUP-compliant.)
3. MD runs the slot-fill in voice. Async: transcribes, extracts, stores.
4. At end: MD says "I'll send you a WhatsApp + email with everything I heard and my proposed setup. Reply 'GO' to commit. Bye."
5. Email + WhatsApp confirmation with TenantBlueprint + Yes/Edit/No buttons.

### 7.3 Voice + email confirmation (Brilo / Voxing 2026 pattern)

Confirmation rates 85% (vs 42% manual). Critical pattern: voice for elicitation, written for confirmation (gives the user a record + lets them edit before commit).

---

## 8. WhatsApp-first onboarding (huge for EA)

### 8.1 Why WhatsApp first

- Kenya/TZ/UG: WhatsApp is the default business channel. Landlords run their entire mgmt today in WhatsApp Groups.
- Meta Cloud API is available in Kenya, free to start, supports voice notes + photos + receipts + docs + buttons + lists + flows.
- Daraja 3.0 (Nov 2025) supports STK-push from within a WhatsApp thread (M-Pesa Super App integration).

### 8.2 SOTA providers (May 2026)

| Provider | Strength | Cost | EA fit |
|---|---|---|---|
| **Meta Cloud API direct** | Free, full feature, no markup | $0.005-$0.05/msg | Best long-term |
| **Twilio** | SDK ergonomics, multichannel | +20% markup | Best for fast ship |
| **Infobip** | Local presence, enterprise SLA | Custom | Best for enterprise EA |
| **WaveSMS / Celcom / Arkesel** | Kenya-local, 24-72h onboarding | Mid | Best for Kenya-only |

### 8.3 WhatsApp onboarding flow

1. Landlord scans QR or sends "BOSS" to +254XXX.
2. MD replies in Swahili/English (auto-detect) with the 4–6 conversation-starter buttons.
3. Landlord taps "Niambie kuhusu majengo yako" → MD asks open question.
4. Landlord sends voice note in Sheng+Swahili: *"Niko na ploti tatu, moja Karen, mbili Kilimani. Karen iko na sita single rooms ya 12K, Kilimani iko na ten bedsitter ya 25K kila moja"* → MD transcribes (Lelapa Vulavula) + extracts.
5. MD reflects back as a structured list message: *"Nimepata: Karen (6 single rooms × KES 12,000), Kilimani A (10 bedsitter × KES 25,000), Kilimani B (?). Sahihi?"*
6. Landlord uploads photo of last month's rent ledger Excel → LlamaParse extracts → MD diffs.
7. Landlord sends one-line "go" → MD bootstraps tenant + sends first M-Pesa STK-push test for KES 1.

### 8.4 Required for Kenya

- Meta Business verification (48h typical for Kenyan businesses).
- KRA + CR12 for the Business Manager.
- Dedicated phone number.
- WhatsApp Business Solution Provider (BSP) account.
- Approved message templates (rent-due, arrears, maintenance ack, evict notice).

---

## 9. Multilingual onboarding

### 9.1 Target languages (priority)

1. **English** — fallback for everyone, default for paid tenants.
2. **Swahili (Standard)** — Tanzania, Kenya cities. Claude 4.6, GPT-4o, Gemini 2.5 native. Lelapa Vulavula best for voice + sentiment.
3. **Sheng** — Nairobi vernacular. Claude 4.6 ~80% comprehension, GPT-4o ~70%. NEEDS custom fine-tune or RAG-from-glossary.
4. **Luganda** — Uganda. Lelapa, MMS/NLLB, Jacaranda Health UlizaLlama. Limited Claude/GPT support.
5. **Hausa** — northern Nigeria. Lelapa InkubaLM, Jacaranda UlizaLlama, Claude 4.6 OK.
6. **Yoruba, isiZulu** — Lelapa InkubaLM coverage.
7. **French, Arabic** — Claude/GPT/Gemini native; expansion markets.

### 9.2 SOTA stack

| Layer | Default | Fallback |
|---|---|---|
| Voice STT | Lelapa Vulavula (Sw/Lug/Hausa) | ElevenLabs / Whisper |
| Text understanding | Claude Sonnet 4.6 | GPT-4o |
| Translation | Lelapa-X-Glot | NLLB-200 |
| TTS | Intella Swahili / ElevenLabs | OpenAI TTS |
| Sentiment | Lelapa Vulavula | Custom |

### 9.3 Language auto-detect + per-tenant pin

First message detects language (cld3 + LLM second opinion). Pinned per tenant after 3 turns. User can change in settings or by saying "switch to English / niongelee kwa Kiswahili". Critical: the SAME slot-fill state survives language switch.

### 9.4 Code-switching (essential for Nairobi)

Sheng + Swahili + English in one sentence is the norm in Nairobi. Treat as one logical language; extract entities regardless of code-switch frame. Test corpus required at `apps/customer-app/__tests__/sheng-extraction.test.ts`.

---

## 10. Compliance + KYC during onboarding (EA real estate)

### 10.1 SOTA Africa-first KYC

| Provider | Coverage | Best for |
|---|---|---|
| **Smile ID** | Kenya, Nigeria, Ghana, RSA, Rwanda, Tanzania, Uganda, Zambia (national IDs + phone + selfie + liveness + KYB) | **Default for EA landlords** |
| **Veriff** | Global, 11k+ doc types | When landlord is non-Kenyan |
| **Jumio** | Global, sanctions screening | Enterprise tier |
| **iDenfy** | Global, KYC + AML | Cost-sensitive enterprise |
| **Persona** | US-strong, customisable flows | Diaspora landlords |
| **IDfy** | India-strong | Diaspora landlords from India |

**Recommendation**: **Smile ID as default for landlord + property mgr + caretaker verification**. Smile ID specifically beats global KYC providers for Africa-focused businesses on connectivity, device compatibility, document coverage, and cost.

### 10.2 Per-role KYC matrix

| Role | KYC required | Provider | Trigger |
|---|---|---|---|
| **Landlord/Owner** | National ID + KRA PIN + selfie liveness + KYB if entity | Smile ID | Before first M-Pesa B2C above KES 10,000 |
| **Property Manager** | National ID + selfie | Smile ID | At invitation accept |
| **Caretaker** | National ID + phone | Smile ID phone verify | At invitation accept |
| **Vendor (paid)** | Phone + selfie OR KRA PIN if regular | Smile ID | Before first vendor payment |
| **Tenant-resident** | Phone verify + national ID OR passport + selfie | Smile ID | At first lease sign |
| **Diaspora landlord** | Passport + selfie + utility bill + KRA non-resident | Smile ID + Veriff | At signup |

### 10.3 KYC during conversation

NOT a separate flow. MD asks "Send me your ID — front and back as photos" inside the chat. Smile ID processes async, MD shows result in chat ("OK, John Mwangi verified, ID 12345678, ready to proceed"). If KYC fails, MD steps down the autonomy budget AND surfaces remediation: "Try again with better lighting" or "Use your KRA iTax instead".

### 10.4 KYB for property mgmt companies

If the entity is a registered company (Pty Ltd, LLC, Sacco), KYB pulls directors + UBO from the registry. Smile ID has KYB for KE/NG/RSA/GH. Required for any tenant above 50 units OR any tenant with corporate ownership.

---

## 11. The "MD discovery script" — 30+ slot-fill questions in conversational form

This is the actual interview MD runs, in order of expected information gain. Bracketed `[slot]` is the slot key. Strikethrough `[skip]` if auto-extracted from prior turn or upload. Conversational not interrogative — group related slots into one turn where natural.

> **MD (turn 1):** Hi, I'm MD — your property AI. I'm an AI, recorded for training and audit, and I work alongside humans for any consequential decision. To set up your workspace I need to know a bit about you. You can talk, type, send voice notes, or upload your existing rent records — anything works. Where shall we start? [Buildings | Tenants | Team | Money | Just talk to me]

> **MD (turn 2 — open):** Tell me about the buildings you manage. Where are they? `[portfolio_locations]` What do you call each? `[portfolio_names]` Roughly how many units? `[portfolio_unit_count]`

> **MD (turn 3 — extracted):** *(After landlord uploads Excel + describes "Karen has 6 units, Kilimani 10")* — Great, I've got Karen (6 units) and Kilimani (10 units). Per building — are they all the same type (1BR / bedsitter / 3BR)? `[unit_types]` Same rent? `[rent_range]`

> **MD (turn 4):** Who collects rent today? You, a manager, a caretaker, or your own family? `[team_collector]` Phone number for them? `[team_collector_phone]`

> **MD (turn 5):** When is rent due? `[collection_day]` What happens if someone doesn't pay by day X? `[grace_period]` `[arrears_policy]`

> **MD (turn 6):** How do tenants pay you today? M-Pesa paybill / till / bank / cash / mix? `[payment_methods]` Paybill or till number? `[mpesa_paybill]`

> **MD (turn 7):** When something breaks — pipe burst, fuse, broken lock — how does the tenant tell you, and how do you fix it? `[maintenance_flow]` `[maintenance_sla]` `[vendor_pool]`

> **MD (turn 8 — pain):** What's the most painful thing about managing your buildings right now? `[pain_points]` (Free text, NOT a slot to constrain — gold for product feedback.)

> **MD (turn 9):** Are you registered? County permit / Single Business Permit / KRA? `[compliance_status]`

> **MD (turn 10):** Last thing — send me a photo of your National ID front & back so I can verify it's really you. (Smile ID, takes 10 seconds.) `[kyc_landlord]`

> **MD (turn 11 — confirm):** Here's what I'll set up:
> + Karen (6 × bedsitter KES 12,000)
> + Kilimani A (10 × 1BR KES 25,000)
> + Caretaker: John Mwangi (0712 345 678)
> + Rent due 1st, grace 5 days, late fee 5%
> + M-Pesa paybill 247247
> + Rent-due reminders Day -3 / 0 / +5
> + KYC verified: George Mwikila ✓
>
> Shall I create this? [Yes, do it] [Edit] [Not yet]

> **MD (turn 12 — bootstrap + handover):** Done. I created your workspace at boss.nyumba.app/m/yourname. I sent you an email with login and a WhatsApp test of the rent-due reminder. What would you like to do first? [Send first reminder to a tenant | Invite caretaker | Add another building | Upload all my old leases]

**Total slots filled in 12 turns**: ~30. Vs the typical SaaS 5-page wizard with 60+ fields requiring 25 minutes of clicking — MD does it in 8 minutes of conversation.

---

## 12. Reference architecture: chat → extract → confirm → bootstrap → dashboard

```
┌─────────────────────────────────────────────────────────────────┐
│ INGRESS                                                          │
│   ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌──────────┐ │
│   │ Web chat   │  │ WhatsApp   │  │ Voice call │  │ Email     │ │
│   │ (Next.js)  │  │ (Meta API) │  │ (ElevenLabs│  │ (parse)   │ │
│   └─────┬──────┘  └──────┬─────┘  └──────┬─────┘  └────┬──────┘ │
└────────┼─────────────────┼────────────────┼────────────┼────────┘
         │                 │                │            │
         └─────────────────┴──────┬─────────┴────────────┘
                                  │
            ┌─────────────────────▼──────────────────────┐
            │ services/onboarding-orchestrator           │
            │  ┌────────────┐  ┌──────────────────────┐  │
            │  │ Session    │  │ Slot State (zod)     │  │
            │  │ State Store│◄─┤ DST + budget tracker │  │
            │  │ (Postgres) │  └──────────┬───────────┘  │
            │  └────────────┘             │              │
            │  ┌─────────────────────────▼────────────┐  │
            │  │ Crew of agents (Mastra)              │  │
            │  │  ┌──────────┐ ┌──────────┐           │  │
            │  │  │ Intake   │ │Extractor │           │  │
            │  │  │ Agent    │ │ Agent    │           │  │
            │  │  └────┬─────┘ └────┬─────┘           │  │
            │  │       │            │                 │  │
            │  │  ┌────▼────────────▼────┐            │  │
            │  │  │ Confirmer Agent      │            │  │
            │  │  │ (diff + HITL gate)   │            │  │
            │  │  └────────┬─────────────┘            │  │
            │  │           │                          │  │
            │  │  ┌────────▼─────────────┐            │  │
            │  │  │ Bootstrapper Agent   │            │  │
            │  │  │ (idempotent commit)  │            │  │
            │  │  └────────┬─────────────┘            │  │
            │  └───────────┼──────────────────────────┘  │
            └──────────────┼─────────────────────────────┘
                           │
       ┌───────────────────┼───────────────────┐
       │                   │                   │
┌──────▼──────┐  ┌─────────▼─────────┐  ┌──────▼───────┐
│ Doc Extract │  │ KYC               │  │ Connector    │
│  - Gemini   │  │  - Smile ID       │  │  Wizard      │
│  - Claude   │  │  - Veriff         │  │  - M-Pesa    │
│  - GPT-4o   │  │                   │  │  - WhatsApp  │
│  - Vulavula │  │                   │  │  - Email     │
│  - LlamaPar │  │                   │  │  - Excel     │
└──────┬──────┘  └─────────┬─────────┘  └──────┬───────┘
       │                   │                   │
       └───────────────────┼───────────────────┘
                           │
                ┌──────────▼──────────┐
                │ Tenant Blueprint    │
                │  (zod, signed)      │
                └──────────┬──────────┘
                           │
            ┌──────────────▼──────────────┐
            │ Bootstrap (idempotent steps)│
            │ 1. create_tenant            │
            │ 2. create_properties_bulk   │
            │ 3. create_units_bulk        │
            │ 4. create_leases_bulk       │
            │ 5. invite_team              │
            │ 6. wire_connectors          │
            │ 7. seed_rules               │
            │ 8. enable_templates         │
            │ 9. generate_dashboard       │
            └──────────────┬──────────────┘
                           │
            ┌──────────────▼──────────────┐
            │ packages/genui              │
            │ Auto-shape dashboard        │
            │ (table / charts / heatmap)  │
            └──────────────┬──────────────┘
                           │
            ┌──────────────▼──────────────┐
            │ apps/customer-app           │
            │ Tenant dashboard READY      │
            │ (no fake data — only real)  │
            └─────────────────────────────┘
```

Cross-cutting:
- **Audit events** to `audit_events` on every action (idempotency keys).
- **Capability cards** signed + exposed at `/about/md/capabilities`.
- **Autonomy budget** enforced by `packages/autonomy-governance`.
- **AUP disclosure** at every session start (web + voice + WhatsApp).
- **Slot persistence** across sessions (resumable WhatsApp days-long flows).

---

## 13. Action-taking budget & rollback

### 13.1 Budget tiers per tenant lifecycle

| Lifecycle stage | Auto-budget | HITL gate | Two-person gate |
|---|---|---|---|
| **Day 0 (onboarding, first session)** | Read-only + create-within-tenant | Invite team, send first WhatsApp | Any M-Pesa B2C |
| **Days 1–7 (supervised landing)** | + send WhatsApp templates after first 5 approved | + connector wiring | + rules change above defaults |
| **Days 8–30** | + auto-approve actions of class "X" after 50 successful approvals on class X | + new template send | + B2C above KES 50k |
| **Days 30+ (settled)** | + scheduled cron actions, + arrears chase auto-send | + bulk actions (>100 tenants) | + B2C above KES 200k |
| **Crisis (anomaly detected)** | Read-only freeze | All actions | All money |

### 13.2 Rollback primitives

Every write action emits a domain event with an inverse:
- `tenant.created` ↔ `tenant.archived` (soft-delete; full hard-delete after 30d)
- `unit.created` ↔ `unit.removed`
- `lease.created` ↔ `lease.voided`
- `team_member.invited` ↔ `team_member.invitation_cancelled`
- `whatsapp.sent` → cannot rollback; rate-limit (Day 0: 50/hour cap)
- `mpesa.stk_push_initiated` → cannot rollback; reversal-only by Safaricom dispute window (24h)
- `connector.wired` ↔ `connector.disconnected`

`apps/customer-app/onboarding/undo` UI exposes a chronological feed of the last 30 actions with one-tap inverse buttons for the reversible classes.

### 13.3 Dry-run

Every step in the bootstrapper has a `--dry-run` flag. When tenant has >50 units, MD MUST dry-run first and surface the side-effect manifest before commit.

### 13.4 Idempotency keys

`(tenant_id, session_id, blueprint_version, step_name)` SHA-256. Stored in `idempotency_log` with result. Re-issue of the same key returns cached result.

---

## 14. Ten concrete things to build for TRC test org → first real tenant

Targeted at `apps/customer-app/onboarding`, `apps/owner-portal/onboarding`, `packages/chat-ui`, new `services/onboarding-orchestrator`.

### 14.1 New service: `services/onboarding-orchestrator/`
- Mastra-based crew (IntakeAgent, ExtractorAgent, ConfirmerAgent, BootstrapperAgent, VerifierAgent).
- LangGraph-style interrupt-and-resume durable state (sessions span days on WhatsApp).
- Postgres `onboarding_sessions` table: `session_id`, `tenant_handle`, `channel` (web/whatsapp/voice/email), `language`, `slot_state JSONB`, `interview_budget INT`, `turns_used INT`, `blueprint JSONB`, `committed_at TIMESTAMPTZ`.
- Public endpoints: `POST /onboarding/sessions`, `POST /onboarding/sessions/:id/turns`, `POST /onboarding/sessions/:id/commit`, `GET /onboarding/sessions/:id/blueprint`, `POST /onboarding/sessions/:id/rollback`.

### 14.2 Slot definitions in `packages/domain-models/onboarding/`
- 80+ zod schemas, one per slot.
- Per slot: `key`, `prompt_template` (per language), `extractor` (LLM | regex | doc-parse | KYC-call), `priority` (info-gain rank), `dependencies` (other slots required), `validators`.
- Generated TypeScript types consumed by orchestrator + UI.

### 14.3 Chat onboarding widget at `packages/chat-ui/onboarding-canvas/`
- Split pane (Lovable pattern): left = chat, right = live tenant workspace preview that materialises as slots fill.
- 4–6 conversation starters in the empty state (OpenAI GPT pattern).
- "About MD" drawer with the signed capability card (Anthropic Skills pattern).
- File-drop zone accepting PDFs, Excels, images, voice notes; UI shows extraction progress + diff preview.
- AUP disclosure banner at session start.

### 14.4 Multi-model document extraction in `packages/document-extraction/`
- Thin wrapper around: Gemini 2.5 Flash/Pro, Claude Sonnet 4.6, GPT-4o Vision, LlamaParse, Lelapa Vulavula.
- Auto-router by doc-type detection (mime + first-page heuristic).
- Normalises everything to canonical `Property | Unit | Lease | Tenant | Vendor | Payment` schemas.
- Free tier defaults to Gemini Flash to keep onboarding cost < $0.05/tenant.

### 14.5 WhatsApp ingress at `services/api-gateway/whatsapp-onboarding/`
- Meta Cloud API primary (Twilio fallback).
- Webhook handler: maps phone → session_id, enqueues to orchestrator.
- Outbound: structured messages (buttons, lists, flows) + voice notes (Lelapa TTS) + WhatsApp Flows for KYC.
- Daraja 3.0 M-Pesa integration for in-thread STK-push test.

### 14.6 Voice onboarding at `services/api-gateway/voice-onboarding/`
- ElevenLabs Agents primary, Vapi fallback orchestration.
- Lelapa Vulavula for Swahili/Luganda STT.
- AUP voice script at call start.
- Email + WhatsApp confirmation after call ends (85% confirmation rate pattern).

### 14.7 KYC integration in `packages/compliance-plugins/smile-id-kyc/`
- Smile ID SDK for landlord + property-mgr + caretaker + tenant-resident.
- Veriff fallback for non-EA passports (diaspora landlords).
- Per-role KYC matrix as policy in `packages/authz-policy/kyc-policy.ts`.
- KYC failure de-escalates autonomy budget automatically.

### 14.8 Capability card at `apps/customer-app/onboarding/about-md/`
- Static + signed card describing what MD can do (NOT how).
- Per-skill card pulled from `packages/central-intelligence/skills/*/SKILL.md` frontmatter.
- AUP disclosure block (mandatory for high-risk uses).
- Updated by `scripts/generate-capability-cards.mjs` from the skills directory on every release.

### 14.9 Autonomy budget enforcement in `packages/autonomy-governance/`
- Per-tenant `autonomy_budget` config (Day 0 / Days 1–7 / Days 8–30 / Days 30+ / Crisis tiers).
- Every write action passes through `enforceAutonomyBudget(tenant_id, action_class, amount)`.
- Returns `auto` | `require_approval` | `require_two_person`.
- Approvals routed via existing notifications service + new `apps/owner-portal/approvals/` queue.
- 30 days successful operation auto-promotes class to higher autonomy.

### 14.10 Idempotent bootstrapper + rollback in `services/onboarding-orchestrator/bootstrap/`
- 9-step provisioner (create_tenant → ... → generate_dashboard).
- Each step writes to `audit_events` with idempotency key.
- Inverse-action registry for the reversible classes.
- `apps/customer-app/onboarding/undo/` UI = chronological feed with one-tap inverse buttons.
- Dry-run mode produces a manifest WITHOUT side-effects for tenants > 50 units.

---

## 15. What does NOT exist yet in BOSSNYUMBA (gap inventory)

Verified by inspecting the repo at scan time (2026-05-23):

- ❌ No `services/onboarding-orchestrator` — completely new.
- ❌ No `packages/chat-ui/onboarding-canvas` mode (existing modes: `blackboard`, `chat-modes`, `dopamine`, `generative-ui`, `voice`, `widget` — none is the split-pane workspace-preview canvas).
- ❌ No `packages/document-extraction` (existing `services/document-intelligence` does some extraction but is not multi-model-routed for onboarding).
- ❌ No `services/api-gateway/whatsapp-onboarding/` (no WhatsApp ingress at all yet).
- ❌ No `services/api-gateway/voice-onboarding/` (no voice ingress).
- ❌ No `packages/compliance-plugins/smile-id-kyc/` (existing `compliance-plugins` does not include EA KYC providers).
- ❌ No capability card scaffolding (no `/about/md/capabilities` route, no SKILL.md harvest script).
- ❌ Autonomy budget tiers not parameterised by tenant lifecycle stage (current `autonomy-governance` is global).
- ❌ Idempotent bootstrapper with rollback feed not present (current onboarding screens at `apps/customer-app/src/screens/onboarding*` are form-based and not orchestrated).
- ❌ Slot-fill DST loop not implemented (no zod slot bank in `packages/domain-models`).
- ❌ Lelapa Vulavula integration missing (only Whisper/ElevenLabs partial wiring in `packages/chat-ui/voice`).

The 10 build items above close all 11 gaps.

---

## 16. Sources

- [Sierra Ghostwriter (Mar 25 2026)](https://www.linkedin.com/posts/brettaylor_today-sierra-is-releasing-ghostwriter-our-activity-7442624473176080385-tqi6) — agent-building-agent in plain English; multi-modal input including whiteboard photos
- [Sierra Explorer](https://sierra.ai/blog/explorer) — agent-optimising agent; always-on Suggestions over real customer conversations
- [Sierra AI Complete Guide 2026 (MyAskAI)](https://myaskai.com/blog/sierra-ai-complete-guide-2026) — 4–10 week sales-led onboarding baseline before Ghostwriter
- [Decagon Knowledge Base Setup (eesel)](https://www.eesel.ai/blog/decagon-knowledge-base-setup) — Unified Knowledge Graph ingestion patterns
- [Decagon Pricing 2026 (Featurebase)](https://www.featurebase.app/blog/decagon-pricing) — 6-week implementation timeline, technical discovery patterns
- [Notion AI Agents hub (TechCrunch May 13 2026)](https://techcrunch.com/2026/05/13/notion-just-turned-its-workspace-into-a-hub-for-ai-agents/) — Notion as multi-vendor agent hub
- [Notion Custom Agents 21k beta (Y Build)](https://ybuild.ai/en/blog/notion-custom-agents-autonomous-ai-teammates-2026) — schema-from-prompt
- [Notion Custom Agents (Notion Help Center)](https://www.notion.com/help/custom-agents) — describe in natural language → instructions + trigger + access auto-generated
- [Anthropic Agent Skills (engineering blog)](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills) — progressive disclosure, SKILL.md spec
- [Claude API Agent Skills docs](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview)
- [Agent Skills Deep Dive (leehanchung)](https://leehanchung.github.io/blogs/2025/10/26/claude-skills-deep-dive/) — first-principles analysis
- [Progressive Disclosure as System Design (swirlai)](https://www.newsletter.swirlai.com/p/agent-skills-progressive-disclosure) — Dec 18 2025 open standard; adopted by OpenAI/Google/GitHub/Cursor
- [OpenAI Custom GPTs (introducing-gpts)](https://openai.com/index/introducing-gpts/) — conversation starters pattern
- [OpenAI Creating a GPT (help center)](https://help.openai.com/en/articles/8554397-creating-a-gpt) — 4–6 starters double as in-product onboarding
- [OpenAI Workspace Agents (Apr 22 2026)](https://openai.com/index/introducing-workspace-agents-in-chatgpt/) — "Always ask during agent run" default for writes
- [Workspace Agents review (Decrypt)](https://decrypt.co/365220/openai-workspace-agents-feature-chatgpt) — credit-based pricing model
- [Lovable vs Bolt 2026 (NxCode)](https://www.nxcode.io/resources/news/lovable-vs-bolt-new-2026-ai-app-builder-comparison) — chat-first vs IDE-first
- [Lovable $20M ARR Banani](https://www.banani.co/blog/lovable-vs-bolt-comparison) — structured plan-before-code pattern
- [HubSpot Breeze Complete Guide 2026](https://syncbricks.com/hubspot-breeze-ai-complete-guide-2026/) — Copilot + Agents + Intelligence + Studio
- [HubSpot vs Salesforce 2026 AI-agent ready (Vantage Point)](https://vantagepoint.io/blog/sf/hubspot-vs-salesforce-ai-agent-ready-2026-comparison) — Breeze role-aware context
- [Glean Connectors Hub](https://docs.glean.com/connectors/) — tenant-isolated connector ingestion
- [Glean Notion integration](https://www.glean.com/connectors/notion) — connector wizard pattern
- [Mastra TS-first 2026 (Speakeasy)](https://www.speakeasy.com/blog/ai-agent-framework-comparison) — 150k weekly downloads, Replit/PayPal/Adobe
- [LangGraph vs CrewAI vs Mastra (DigitalApplied)](https://www.digitalapplied.com/blog/agentic-orchestration-frameworks-langgraph-vs-crewai) — durable execution, ramp time comparison
- [Agent Frameworks Tier List 2026 (paperclipped)](https://www.paperclipped.de/en/blog/ai-agent-frameworks-tier-list-2026/) — 7 production capabilities
- [Zero-Shot Slot Filling (arxiv 2406.08848)](https://arxiv.org/html/2406.08848v1) — industry-grade conversational assistant DST
- [Adaptive Question Selection for Psychiatric Intake (arxiv 2604.22067)](https://arxiv.org/html/2604.22067) — fixed budget question selection, SOTA over random + traditional forms
- [LLM Context 2026 (LogRocket)](https://blog.logrocket.com/llm-context-problem-strategies-2026/) — context-aware question selection patterns
- [Document Parser Comparison (Reducto)](https://llms.reducto.ai/document-parser-comparison) — Docling vs LlamaParse vs Unstructured vs Reducto
- [Best Document Processing AI 2026 (TokenMix)](https://tokenmix.ai/blog/best-ai-for-document-processing) — Claude 97.6% / GPT-4o 97.3% / Gemini cost
- [LlamaParse XLSX output](https://www.llamaindex.ai/insights/best-document-parsing-software)
- [Files API Claude](https://platform.claude.com/docs/en/build-with-claude/files) — up-to-100-page PDFs with vision
- [Progressive Disclosure UI Patterns (agentic-design.ai)](https://agentic-design.ai/patterns/ui-ux-patterns/progressive-disclosure-patterns) — what to show first / what NOT to reveal
- [NVIDIA verified skill cards (aidailypost)](https://aidailypost.com/news/nvidia-introduces-verified-skill-cards-govern-ai-agent-capabilities) — cryptographically signed capability metadata
- [A2A Protocol AgentCard](https://agent2agent.info/docs/concepts/agentcard/) — agent skills + cards spec
- [Anthropic AUP](https://www.anthropic.com/legal/aup) — disclosure required at session start for high-risk uses
- [Anthropic AUP compliance (kindatechnical)](https://kindatechnical.com/claude-ai/anthropics-acceptable-use-policy-and-compliance.html) — high-risk categories list
- [Top Agentic AI security resources May 2026 (Adversa)](https://adversa.ai/blog/top-agentic-ai-security-resources-may-2026/) — system card best practices
- [2025 AI Agent Index MIT](https://aiagentindex.mit.edu/) — 4-of-30 system cards baseline
- [Human-in-the-Loop AI Agents 2026 (getclaw)](https://getclaw.sh/blog/human-in-the-loop-ai-agents-approvals-2026) — $300–$2k/mo platform budget; design > tools
- [HITL Production-Ready LangGraph 2026 (GrowwStacks)](https://growwstacks.com/blog/human-in-the-loop-ai-agents-langgraph)
- [Designing HITL for Agentic Workflows (AlignX March 2026)](https://medium.com/@AlignX_AI/designing-human-in-the-loop-for-agentic-workflows-079faec737ed)
- [Idempotent AI Agents (Buildmvpfast)](https://www.buildmvpfast.com/blog/idempotent-ai-agent-retry-safe-patterns-production-workflow-2026) — unique deterministic keys per side-effect
- [Hermes Agent checkpoints/rollback](https://hermes-agent.nousresearch.com/docs/user-guide/checkpoints-and-rollback) — /rollback diff N pattern
- [Micro-Commits (ASDLC)](https://asdlc.io/practices/micro-commits/) — agent workflow versioning
- [How reversible is an agentic mistake? (ITBrew Mar 2026)](https://www.itbrew.com/stories/2026/03/06/how-reversible-is-an-agentic-mistake) — every action reversible or delayed
- [Multi-tenant SaaS architecture 2026 (Ariel)](https://www.arielsoftwares.com/multi-tenant-architecture-saas-guide/) — hybrid tenancy model
- [Developer's guide SaaS multi-tenant (WorkOS)](https://workos.com/blog/developers-guide-saas-multi-tenant-architecture) — every table has org_id
- [Vapi vs ElevenLabs vs Retell 2026 (Retell)](https://www.retellai.com/blog/vapi-vs-elevenlabs)
- [Voice AI Agents Business (DigitalApplied)](https://www.digitalapplied.com/blog/voice-ai-agents-business-elevenlabs-vapi-retell-bland)
- [Voice AI in 2026 (AssemblyAI)](https://www.assemblyai.com/blog/voice-ai-in-2026-series-1)
- [Voice AI Onboarding (Brilo)](https://www.brilo.ai/resources/customer-onboarding-automation-with-ai) — 85% confirmation rate vs 42% manual
- [Voxing AI Voice Onboarding](https://voxing.ai/voice-ai-onboarding)
- [Voice AI for Event Management 2026 (KNVI)](https://www.knvilabs.com/stories/voice-ai-future) — 3.5× faster activation
- [AI Chatbot Trends Reshaping CX 2026 (Robylon)](https://www.robylon.ai/blog/ai-chatbot-trends-2026) — 42% → 71% completion improvement
- [Intella Swahili AI Voice (iAfrica)](https://iafrica.com/intella-launches-swahili-ai-voice-capabilities-at-africa-forward-summit-targeting-2-billion-person-voice-market/) — Africa Forward Summit 2026
- [Lelapa Vulavula](https://lelapa.ai/products/vulavula/) — Sw/Lug/Hausa/isiZulu/Sesotho transcription + translation + sentiment
- [Lelapa Vulavula on AWS Marketplace](https://aws.amazon.com/marketplace/pp/prodview-li2rffe3oqt2a) — enterprise deployment
- [InkubaLM (Lelapa)](https://lelapa.ai/inkubalm-a-small-language-model-for-low-resource-african-languages/) — small model for low-resource African languages
- [African LLMs Who Is Building (Voxilens)](https://www.voxilens.com/african-language-llms-who-is-building-them/)
- [UlizaLlama (Jacaranda Health)](https://gcgh.grandchallenges.org/grant/dialogues-delivery-fine-tuning-large-language-models-llms-prenatal-and-perinatal-care-east) — Sw/Lug/Hausa/Yoruba health LLM
- [WhatsApp Business API Africa Guide (Arkesel)](https://arkesel.com/whatsapp-business-api-africa-guide/)
- [How to Build AI WhatsApp Bot with M-Pesa (Statum 2026)](https://blog.statum.co.ke/blog/how-to-build-an-ai-whatsapp-bot-with-m-pesa-in-kenya-2026) — STK push inside WhatsApp threads
- [Best WhatsApp API Providers 2026 (Infobip)](https://www.infobip.com/blog/best-whatsapp-api)
- [M-Pesa API Integration Kenya 2026 (SmartBiz)](https://www.smartbizsystems.co.ke/blog/mpesa-api-guide) — Daraja 3.0 (Nov 2025)
- [Safaricom Daraja Portal](https://developer.safaricom.co.ke/)
- [Smile ID](https://usesmileid.com/) — KE/NG/RSA/GH/RW + TZ/UG/Zambia coverage
- [Why Smile Identity beats global KYC for Africa](https://usesmileid.com/blog/why-smile-identity-beats-global-kyc-providers-like-onfido-veriff-and-jumio-for-africa-focused-businesses)
- [Tanzania KYC Guide (Smile ID)](https://usesmileid.com/reports-and-guides/the-tanzania-kyc-guide/)
- [Best KYC Providers Africa (Korahq)](https://www.korahq.com/blog/best-kyc-verification-providers)
- [Jumio Identity Verification](https://www.jumio.com/products/identity-verification/)
- [Top 10 real estate KYC tools 2026 (Agora)](https://agorareal.com/compare/top-10-real-estate-kyc-tools-in-2025/)
- [Best ID Verification Software 2026 (iDenfy)](https://idenfy.com/blog/best-identity-verification-software/)
- [Progressive KYC onboarding (Ondorse)](https://www.ondorse.co/blog/kyc-doesnt-have-to-kill-conversion-enter-progressive-onboarding)
- [KYC Data Intake Workflows 2026 (EasySend)](https://www.easysend.io/blog/complete-guide-to-kyc-data-intake-workflows-in-2025)
- [ChatIE: Zero-Shot Information Extraction via Chatting (arxiv 2302.10205)](https://arxiv.org/abs/2302.10205) — chat → structured entities
- [State of AI Agents 2026 (Prosus)](https://www.prosus.com/news-insights/2026/state-of-ai-agents-2026-autonomy-is-here)
- [WEF: Governance for AI Agents (Mar 2026)](https://www.weforum.org/stories/2026/03/ai-agent-autonomy-governance/)
- [AI Onboarding Tools 2026 (Perspective)](https://getperspective.ai/blog/ai-onboarding-tools-2026-buyer-comparison-by-onboarding-mode-and-customer-segment)
- [AI Powered Client Onboarding (MindStudio)](https://www.mindstudio.ai/blog/ai-powered-client-onboarding-tools-workflows)
