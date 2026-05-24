# Document Generation — SOTA 2026 Research

**Goal**: Give the AI a goal → learn structure → confirm → multi-LLM synthesis → render → cite → sign. Beautiful, accurate documents in `.docx`, `.pdf`, `.xlsx`, `.pptx`, HTML, markdown — for a multi-tenant property management SaaS spanning TZ/KE/NG/UG.

**Context**: BOSSNYUMBA101 already ships `services/reports` (pdfkit + exceljs) and `services/document-intelligence` (Textract + GCP Vision). This audit is the path from "PDFKit Hello World" to a real **Document Studio**.

Date: 2026-05-23. Author: research agent. Companion doc to `08-sota-2026-frontier.md`.

---

## 1. Anthropic Claude Skills — the 2025-2026 chasm-crosser

- **SOTA**: Filesystem-discoverable capabilities packaged as `SKILL.md` (YAML frontmatter + markdown body + optional helper scripts/templates). Loaded on demand by the model — zero context cost when not relevant. Anthropic shipped the launch pad; the format is **the** 2026 portable standard.
- **The official skills (17 as of May 2026)** at `github.com/anthropics/skills`:
  - **Document** (source-available, used by Claude.ai in production): `docx`, `pdf`, `pptx`, `xlsx` — bundle helper scripts (e.g. `pptx/pptxgenjs.md`, `xlsx` with openpyxl helpers), proven patterns (8 PptxGenJS pitfalls documented), and rendering recipes.
  - **Meta**: `skill-creator` (interactive guide — asks about the workflow, generates folder layout, frontmatter, validates), `mcp-builder`, `webapp-testing`.
  - **Design**: `brand-guidelines`, `theme-factory`, `canvas-design`, `algorithmic-art`, `frontend-design`.
  - **Comms / collab**: `doc-coauthoring`, `internal-comms`, `slack-gif-creator`, `web-artifacts-builder`.
  - **Dev**: `claude-api`.
- **Skill structure** (canonical):
  ```
  skill-name/
  ├── SKILL.md          # YAML frontmatter (name, description) + instructions
  ├── helpers/*.py|*.ts # executable code Claude can invoke
  ├── templates/*.docx  # bundled assets
  └── examples/         # reference outputs
  ```
- **Integration surfaces**: Claude apps (Pro/Max/Team/Enterprise — Settings toggle), API (`/v1/skills` endpoint with Code Execution Tool beta), Claude Code (`anthropics/skills` marketplace or `~/.claude/skills`). Org-wide management + partner-built skills directory shipped in 2026.
- **Property mgmt use case**: A `bossnyumba-owner-report` skill that bundles a DOCX template, an xlsx ledger template, a pptx board deck template, and helper scripts that fetch from `services/reports` data providers. Claude can compose these without re-reading docs.
- **BOSSNYUMBA need**: Create `~/.claude/skills/bossnyumba-*` for each doc type AND ship them in `services/reports/skills/` so the runtime agent (not just Claude Code dev) can use them.
- **Refs**: [Introducing Agent Skills (Anthropic)](https://claude.com/blog/skills); [anthropics/skills repo](https://github.com/anthropics/skills); [Complete Guide to Building Skills PDF](https://resources.anthropic.com/hubfs/The-Complete-Guide-to-Building-Skill-for-Claude.pdf).

---

## 2. Google Workspace AI (May 2026)

- **SOTA**: Gemini-in-Workspace is now **cross-app**. From a single prompt, Gemini creates Docs/Sheets/Slides and pulls data from email, chats, Drive, Search — fully autonomous multi-file synthesis.
- **Stack**:
  - **Gemini 3 Flash** drives text generation/summarisation; **Gemini 3 Deep Think** does science/finance reasoning; **Nano Banana 2** generates editable slide diagrams + text-to-image (multi-image-to-image style transfer).
  - **APIs**: Docs API, Slides API, Sheets API, Apps Script v2; Smart Canvas with @-mention chips for live data.
  - GA in beta to AI Ultra/Pro subscribers (English globally for Docs/Sheets/Slides).
- **Property mgmt use case**: Generate a board meeting Slides deck from this month's owner reports + Gmail correspondence with the chair, then export to `.pptx` or share view-only link.
- **BOSSNYUMBA need**: Add a Workspace OAuth integration (only for tenants who want to publish to a shared Drive folder) — useful for KE/UG body-corporate boards who already live in Google Workspace. Not a primary path; **the primary path is portable file generation**.
- **Refs**: [Google blog March 2026 Gemini updates](https://blog.google/products-and-platforms/products/workspace/gemini-workspace-updates-march-2026/); [Gemini in Workspace feature explainer](https://www.buildfastwithai.com/blogs/gemini-google-workspace-features-guide); [VentureBeat: cross-app gen](https://venturebeat.com/orchestration/google-upgrades-gemini-for-workspace-allowing-it-to-pull-data-from-multiple).

---

## 3. Microsoft 365 Copilot Word/Excel/PowerPoint Agents

- **SOTA (GA 2026-04-22)**: Dedicated Word/Excel/PowerPoint Agents in Copilot Chat — natural language → fully formatted documents. The agents ask clarifying questions before producing. Excel engagement +67%, retention +50%, satisfaction +65% in preview.
- **Custom agent builder — "Copilot Tuning"**: Template-based agents that can be tuned with org-proprietary data + processes (e.g. "always use our company writing style"). Available to enterprises with ≥5,000 Copilot licences (Frontier April, worldwide June 2026). Microsoft Certified: AI Agent Builder Associate cert in beta.
- **Property mgmt use case**: A "BOSSNYUMBA Owner Report" custom agent that ingests CSV + analytics, produces a branded Word/PDF deliverable in the property manager's Outlook workflow.
- **BOSSNYUMBA need**: Treat M365 as an **export target**, not the engine — produce `.docx`/`.xlsx`/`.pptx` so the owner's Word/Excel/PowerPoint Agents can refine them post-delivery. This is the lowest-friction path for the Nairobi/Dar enterprise segment that lives in M365.
- **Refs**: [MS 365 Blog: agentic GA](https://www.microsoft.com/en-us/microsoft-365/blog/2026/04/22/copilots-agentic-capabilities-in-word-excel-and-powerpoint-are-generally-available/); [Microsoft Learn — get started](https://learn.microsoft.com/en-us/microsoft-365/copilot/wordexcelppt-agents); [Redmondmag: Agent Builder cert](https://redmondmag.com/articles/2026/04/23/microsoft-expands-copilot-agentic-capabilities.aspx).

---

## 4. OSS document libraries (TypeScript + Python)

### Word (DOCX)
- **JS/TS**: [`docx` by dolanmiu](https://github.com/dolanmiu/docx) — declarative API, v9.6.1, 571+ projects on npm, browser + Node. The default for programmatic generation.
- **Python**: `python-docx` — read/write/edit, supports styles, headings, tables, tracked changes.
- **DOCX ↔ HTML**: [`mammoth.js`](https://github.com/mwilliamson/mammoth.js/) v1.12 (May 2026) — Word → clean semantic HTML/markdown; supports style mapping (`WarningHeading` → `h1.warning`). Available in browser, Node, JVM, .NET, Python.
- **Templating**: [`docxtemplater`](https://www.npmjs.com/package/docxtemplater) for DOCX/PPTX/XLSX from templates; commercial-friendly licence.

### PDF
- **HTML→PDF**: **Playwright** (now winning vs Puppeteer per npmtrends 2026) and **Puppeteer** — real browser rendering; best for complex layouts. **WeasyPrint** (Python, CSS Paged Media) for print-fidelity. **Tectonic** (XeTeX, single-pass, no aux files). **Typst** (see below — the disruptor).
- **Programmatic**: [`pdf-lib`](https://pdf-lib.js.org/) — pure-JS PDF manipulation (no HTML rendering). [`react-pdf`](https://react-pdf.org/) and [`@react-pdf/renderer`](https://react-pdf.org/) — JSX → PDF, `renderToFile`/`renderToString`/`renderToStream` for Node, the go-to for React shops.
- **Tabular/template**: PDFKit (already in `services/reports`), pdfmake — light, structured-data-friendly.

### PPTX
- **JS/TS**: [`pptxgenjs`](https://gitbrent.github.io/PptxGenJS/) — Node/React/Vite/Electron/browser. Charts (bar/line/pie/doughnut), images, shapes, slide masters. **Pitfall**: never reuse option objects — PptxGenJS mutates in place. Anthropic's own skill bundles the 8-pitfalls cheat sheet.
- **Python**: `python-pptx` — works for simple slides; consulting-quality output is 60+ LOC/slide (manual fonts/alignment/colors).

### XLSX
- **JS/TS**: [`exceljs`](https://www.npmjs.com/package/exceljs) (already a BOSSNYUMBA dep) — formulas, formatting, pivot, streaming. **SheetJS** (`xlsx`) for read/write across CSV/XLSX/ODS but doesn't execute formulas (Excel does on open).
- **Python**: `openpyxl` — full read/write/modify, charts, pivot, formulas.

### Markdown → anything
- **[Pandoc](https://pandoc.org/MANUAL.html)** — universal converter (CommonMark + 30 input/40 output formats), supports tables/footnotes/citations/math. Docker image `pandoc/typst` ships with Typst PDF engine.
- **Marked.js / Remark** — for in-app markdown rendering (web preview).

### LaTeX / Typst — the disruptor
- **[Typst](https://github.com/typst/typst)** is the 2025-2026 LaTeX killer for new projects:
  - Written in **Rust**; compiles **10–100× faster** than LaTeX (milliseconds vs seconds/minutes).
  - **Single-pass** reference resolution (LaTeX needs 2-3 passes).
  - Rust-inspired scripting syntax; `typst watch` gives live preview.
  - Pandoc supports `typst` as a PDF engine since 2024; Docker image `pandoc/typst` is the production combo.
- **Tectonic** = best modern XeTeX wrapper if you need full LaTeX package ecosystem; mirrors XeTeX, no aux files.
- **Property mgmt use case**: Eviction notices, lease documents, owner reports — all benefit from Typst's speed (sub-second), modern syntax, and clean error messages.
- **Refs**: [Typst vs LaTeX 2026 benchmark](https://www.typetex.app/comparisons/typst-vs-latex-speed); [Typst with Pandoc](https://slhck.info/software/2025/10/25/typst-pdf-generation-xelatex-alternative.html).

---

## 5. Templating engines for documents

- **[Carbone.io](https://carbone.io/)** — open-source report generator. Templates in any DOCX/ODT/HTML/XLSX/PPTX; one template renders to PDF/DOCX/XLSX/PPTX/ODS/HTML/CSV. **v5 (2026)** adds AI-assisted tag completion + integrated error fixes; ships a **Carbone Skill** that teaches AI assistants its Universal Templating Language. Cloud/On-prem/AWS/Docker — no codebase changes between them. 181M+ documents generated, 800+ paid customers across 40+ countries, 4.9/5 G2.
- **[docxtemplater](https://docxtemplater.com/)** — DOCX/PPTX/XLSX from templates + JSON; battle-tested in legal/finance shops.
- **Handlebars / Liquid / Jinja2 / Nunjucks** — string-templating for HTML→PDF pipelines (when you control rendering downstream).
- **Property mgmt fit**: Carbone is the killer pick for BOSSNYUMBA — multi-format from one template = perfect for monthly owner report (PDF), board pack (DOCX/PPTX), and tenant ledger (XLSX) all from the same data model. The on-prem option matters for KE Data Protection Act / NDPR compliance.

---

## 6. AI document-gen products (May 2026)

| Product | Sweet spot | Notes |
|---------|------------|-------|
| **[Gamma](https://gamma.app/)** | Decks + docs + webpages with card UI | AI generates layouts + designs; strong consumer-y aesthetic |
| **[Genspark](https://www.genspark.ai/)** | Research-first → drafts/slides | Multi-agent research → first draft; "content-first" |
| **[Plus AI](https://plusai.com/)** | Google Slides + PowerPoint add-on | Live spreadsheet → slides; brand-consistent formatting |
| **[Beautiful.ai](https://www.beautiful.ai/)** | Pitch decks; rules-based design | "Design-first" — auto-formats slides |
| **Tome** | Was an AI deck pioneer; **pivoted away from consumer decks 2024**, now a B2B sales-collateral tool | Not relevant for property mgmt |
| **Decktopus / Slidebean** | Template-driven deck builders | OK for marketing collateral, not for reports |
| **Microsoft Designer** | Image/graphic gen in Office | Use via M365 Copilot |
| **Adobe Express + Acrobat AI Assistant** | PDF read/sum/edit + design | Acrobat AI is the de facto enterprise PDF AI |

**Pattern**: All of these are consumer/SaaS-shaped; **none replace** a multi-tenant, jurisdiction-aware, audit-traceable report engine for property management. They're useful as inspiration (Gamma's card model, Plus AI's live-spreadsheet-to-slide).

---

## 7. Structured doc gen — legal, financial, regulated

- **[Harvey](https://www.harvey.ai/)** — $3B valuation (Series C Dec 2025), $1K+/lawyer/month, 20-seat min. Briefs, memos, contracts, M&A workflows for elite firms.
- **[CoCounsel](https://legal.thomsonreuters.com/en/products/cocounsel-legal)** (Thomson Reuters) — research/analysis/drafting; CoCounsel Core $225/mo. Processed 10M+ legal docs combined with Harvey in Q1 2026.
- **[EvenUp](https://www.evenuplaw.com/products/ai-drafts/)** — specialised for personal-injury demand letters + medical chronologies. **Demand letters in minutes** — the model for what BOSSNYUMBA should do for **eviction notices**.
- **[DraftWise](https://www.draftwise.com/)** — uses a firm's historical deal data; agentic editing.
- **[Spellbook](https://www.spellbook.legal/)** — runs inside Word; 3,400+ firms.
- **[HotDocs](https://mitratech.com/products/hotdocs/)** (Mitratech) — legacy doc assembly, proprietary HotDocs Scripting Language; 90% time reduction claim; modernised as "HotDocs Advance" with AI.
- **[Docassemble](https://docassemble.org/)** — open-source, Python + YAML + **Jinja2** — the closest open-source equivalent to HotDocs, used by legal aid orgs globally.
- **[Gavel](https://www.gavel.io/)** — replaces HotDocs in many shops, no-code workflows.
- **Property mgmt application**: Adopt the EvenUp pattern for eviction notices (state/jurisdiction-aware templates + AI-drafted facts section + lawyer review queue) and the Docassemble pattern (Python+YAML+Jinja2) for OSS-licensed jurisdictional lease templates.

---

## 8. Citation, accuracy & brand systems

- **[Anthropic Citations API](https://claude.com/blog/introducing-citations-api)** (Sonnet/Haiku 3.5+; GA on Bedrock + Vertex 2025-06): Claude grounds answers in source documents with sentence/passage-level citations. **Cut hallucination from 10% → 0%** in a reported case study, +20% references per response. Critical for monthly owner reports ("This $487 plumbing charge was approved by the owner on 2026-03-14 per WhatsApp message #4421").
- **Span-level verification** is the 2026 best practice: retrieval-augmented gen + separate process checks each claim against retrieved sources. (Fraudulent-citation rate in academia 1:277 in early 2026, up from 1:2828 in 2023 — verification is no longer optional.)
- **Tools**: Citely, SwanRef, CiteCheck, RefCheck-AI (commercial); for legal redlines, Litera/Vaquill/Spellbook detect clause-meaning changes — character-diff alone misses semantic shifts.
- **Brand kit / design system enforcement**:
  - **Design tokens (W3C DTCG format)** → Style Dictionary → Tailwind/CSS/PDF stylesheet — single source of truth across web, PDF, DOCX.
  - **Figma variable export → JSON tokens → consumed by Carbone/docx/pptx renderers** keeps brand fidelity across formats.
  - Drop a `CLAUDE.md` in the doc-gen package that references the tokens — every AI session produces brand-compliant output.
- **Property mgmt application**: Every cell in an owner report must cite source (lease #, payment ID, photo evidence). Use Anthropic Citations API for AI narrative sections; pure data tables get programmatic citations.

---

## 9. Multi-modal documents

- **Charts**: **Apache ECharts** (complex dashboards, large datasets), **Plotly.js** (scientific/3D), **Tremor** (Tailwind+Recharts, fastest path to beautiful dashboards), **Observable Plot** (Mike Bostock's modern grammar of graphics; rough React ergonomics), **Chart.js** (lightweight), **Recharts** (composable). For server-side PNG embedding in PDFs/DOCX: Plotly + Kaleido (Python) or ECharts headless export.
- **Images / generative**: **Flux 1.1 Pro**, **Ideogram 3.0** (best for text-in-image — property listings, branded covers), **DALL-E 3 / GPT-image-1**. **Nano Banana 2** (Google) does multi-image-to-image with style transfer.
- **Maps**: **[Mapbox Static Images API](https://docs.mapbox.com/api/maps/static-images/)** — direct PNG/JPEG; up to 1280×1280 @2x; free 50K req/mo, then $1/1K. Use for property location embed in listings, vacancy heat-maps, route-to-property in dispatch sheets. Alternatives: Maptiler, Google Static Maps API.
- **Tables with computed data**: ExcelJS formulas evaluated by Excel on open; for PDF use programmatic computation + frozen values.
- **Property mgmt application**: Vacancy analytics PDF = ECharts SVG → embed in HTML → Playwright PDF. Property cover sheet = Mapbox static PNG of property location + ECharts mini-map of occupancy.

---

## 10. Validation & sign-off flows

- **Redline diffs**: Spellbook, Vaquill AI (DOCX→DOCX with native Word Track Changes, cross-format diff), Litera (semantic-change detection — beats raw LLM diff on tables/images).
- **Comment-thread review**: Carbone has native comment workflow; Workspace and M365 obvious paths.
- **E-signature**:
  - **[Dropbox Sign](https://sign.dropbox.com/products/dropbox-sign-api)** (formerly HelloSign) — REST API, SDKs, embedded signing, **non-editable audit trails**, ISO 27001 / SOC 2 Type II / HIPAA / eIDAS / GDPR. Webhook events (`signature_request_viewed`, etc.) for Node.js.
  - **[DocuSign](https://www.docusign.com/products/electronic-signature/features/api)** — bigger brand, more enterprise features, audit-log API for compliance retrieval.
  - **Anvil, SignNow, eversign** — alternatives.
  - **For African markets**: Most TZ/KE/UG/NG contracts accept e-signatures under their respective e-transactions acts; check whether court-admissibility requires qualified e-signatures (rarer in residential lease context).
- **Audit trails**: Tamperproof PDF with embedded signature certificate + WORM storage of the signed bundle.

---

## Doc-type catalog for BOSSNYUMBA (20+)

| # | Document | Recipient | Format | Library / Skill | Jurisdiction logic |
|---|----------|-----------|--------|-----------------|---------------------|
| 1 | Monthly Owner Report | Property owner | PDF + XLSX | Carbone (DOCX template → both) + ECharts for graphs | Currency display per owner pref (already in MEMORY) |
| 2 | Eviction Notice | Tenant + court copy | PDF (court-formatted) | Typst or Docassemble jurisdictional templates | TZ Rent Restriction Act / KE Distress for Rent Act / NG Recovery of Premises Law / UG Land Act |
| 3 | Lease Agreement | Landlord + tenant | PDF + DOCX | Carbone + jurisdictional template pack; integrate `@bossnyumba/authz-policy` for jurisdiction routing | LRA-62 KE; TIC reg TZ; standard fixed-term NG/UG |
| 4 | Lease Renewal / Variation | Both | DOCX with redline | dolanmiu/docx + Vaquill-style diff | All |
| 5 | Maintenance Work Order | Vendor | PDF | react-pdf | Vendor cert reqs per jurisdiction |
| 6 | Maintenance Invoice (vendor → owner) | Owner | PDF | Carbone (XLSX template) | VAT rates: NG 7.5%, KE 16%, UG 18%, TZ 18% |
| 7 | Tenant Payment Ledger | Tenant/owner | XLSX + PDF | ExcelJS + Playwright PDF | Currency display + FX (see MEMORY guidance) |
| 8 | Rent Increase Notice | Tenant | PDF | Typst | Jurisdictional notice periods (KE 30d, TZ 60d, etc.) |
| 9 | Vacancy Analytics PDF | Owner/exec | PDF | ECharts → Playwright | All |
| 10 | Board Memo (body corporate) | Board | DOCX | dolanmiu/docx | Sectional Titles Act KE / Condominium Act NG |
| 11 | Board Deck (quarterly) | Board | PPTX + PDF | pptxgenjs + Plus AI export | All |
| 12 | AGM Notice + Minutes | Members | PDF | Carbone | Statutory format per jurisdiction |
| 13 | Regulatory Filing (NDPR/TZDPA/KE-DPA/UG-DPA) | DPA regulator | PDF | python-docx + signed PDF | Per-DPA forms |
| 14 | Audit Report | External auditor | XLSX + PDF | ExcelJS + Carbone PDF | IFRS for SMEs (E. Africa) |
| 15 | Property Valuation | Bank/owner | PDF | Carbone with photos + map | RICS Red Book style (where adopted) |
| 16 | Tenant Reference Letter | Future landlord | DOCX | dolanmiu/docx | None |
| 17 | Move-in / Move-out Inventory | Tenant | PDF with photos | react-pdf | None |
| 18 | Security Deposit Refund Notice | Tenant | PDF | Typst | KE: 21d; TZ: 30d post-departure |
| 19 | Receipt (rent / deposit / refund) | Tenant | PDF + thermal-printer | pdf-lib + ESC/POS | NG: FIRS e-invoice req'd >₦50M annual turnover |
| 20 | Service Charge Statement | Owner | XLSX + PDF | ExcelJS + Carbone | All |
| 21 | Insurance Certificate / Renewal Reminder | Owner | PDF | Carbone | Per insurer template |
| 22 | Vendor Onboarding Pack | Vendor | DOCX | Carbone | KYB rules per jurisdiction |
| 23 | Tenant Welcome Pack | Tenant | PDF (multi-page) | Carbone | Localised greeting/lang |
| 24 | Default Demand Letter (pre-eviction) | Tenant | PDF | EvenUp-pattern + Anthropic Citations | Jurisdictional cure periods |
| 25 | Property Listing Sheet | Public/broker | PDF + image carousel | Carbone + Mapbox static + Flux 1.1 cover | All |

---

## Reference architecture: goal → learn structure → confirm → multi-LLM synth → render → cite → sign

```
┌─────────────────────────────────────────────────────────────────────────┐
│  USER GOAL                                                              │
│  "Generate this month's owner report for property #4421"                │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  1. INTENT PARSER (Claude Haiku 4.5)                                    │
│  - Doc type:           owner_monthly_report                             │
│  - Tenant context:     bossnyumba-org-42                                │
│  - Recipient:          owner@example.com, prefers Swahili + KES         │
│  - Jurisdiction:       KE-Nairobi                                       │
│  - Period:             2026-04-01 → 2026-04-30                          │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  2. STRUCTURE LEARNER                                                    │
│  - Loads SKILL.md for "owner-monthly-report" (Anthropic Skill format)   │
│  - Pulls last 3 reports from this tenant (RAG) — learns their style    │
│  - Plans sections via structured output (JSON schema, Zod-validated)   │
│  - Returns OUTLINE.json + ASSET_REQUIREMENTS.json                       │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  3. CONFIRM (HITL — human in the loop)                                  │
│  - Shows outline to property manager in chat-ui                        │
│  - PM can edit sections, add notes, approve                             │
│  - LangGraph durable state — pause/resume across sessions               │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  4. MULTI-LLM SYNTHESIS                                                 │
│  - Data sections (rent ledger, vacancy %): deterministic SQL → ExcelJS │
│  - Narrative (executive summary, anomalies): Opus 4.7 with Citations    │
│  - Charts: ECharts headless → PNG → embed                              │
│  - Photos: pulled from maintenance tickets + Flux gen for cover only    │
│  - Map: Mapbox Static API for property location                         │
│  - Translation: LILT for any Swahili sections (human-verified)         │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  5. RENDER (Carbone)                                                    │
│  - Template: owner-monthly-report.docx (Carbone Universal Tags)        │
│  - One template → outputs PDF + DOCX + XLSX bundle                     │
│  - Brand tokens from design-system → Carbone style overrides            │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  6. CITE & VERIFY                                                       │
│  - Span-level check: every $ figure linked to ledger row                │
│  - Every claim in narrative linked to source doc/event via Citations    │
│  - Auto-redline against last month's report (Vaquill-style)            │
│  - QA gate fails if any uncited claim > threshold                      │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  7. SIGN & DELIVER                                                      │
│  - WORM-store the bundle (S3 Object Lock)                              │
│  - For lease/eviction: Dropbox Sign API (embedded signing)             │
│  - Email PDF to owner via Notifications service                        │
│  - Audit-log every step (who saw, who signed, when)                    │
└─────────────────────────────────────────────────────────────────────────┘
```

**Why this works**: each step is independently testable, each LLM call has a typed schema, and the **human approves the outline** (not the final 30-page doc — the *outline*). HITL at the right altitude.

---

## Anthropic Skills + Claude Code skills strategy for BOSSNYUMBA

Three tiers:

1. **Dev-time skills** (`~/.claude/skills/bossnyumba-dev-*`) — for engineers building on the platform:
   - `bossnyumba-jurisdiction-router` — given a tenant context, pull the right legal template.
   - `bossnyumba-template-creator` — wraps Anthropic's `skill-creator` with our SKILL.md conventions.
   - `bossnyumba-test-pack-runner` — generate fixture docs per jurisdiction.
2. **Runtime skills** (shipped in `services/reports/skills/`) — used by the agent at runtime (not dev):
   - `owner-monthly-report`, `eviction-notice-{KE,TZ,NG,UG}`, `lease-agreement-{...}`, `board-deck`, `audit-report`, `valuation`, etc.
   - Each bundles: SKILL.md, Carbone template, ExcelJS schema, citation schema, brand tokens.
3. **Tenant-customisable skills** (per-org overrides in S3 / DB):
   - Letterhead, signature blocks, signing authority list, language preferences.
   - Override at runtime — base skill in code, override blob in tenant context.

**Skill marketplace play**: publish a subset (the **jurisdictional pack**) to a public skills directory. KE/TZ/UG/NG legal templates are rare in open source — strong inbound-marketing signal.

---

## 10 concrete things to build (in priority order)

1. **`packages/document-studio`** — new package. Houses:
   - `studio/intent-parser.ts` (Haiku-tier classifier)
   - `studio/structure-learner.ts` (RAG over past docs + JSON schema planner)
   - `studio/synthesis-pipeline.ts` (LangGraph durable workflow)
   - `studio/render/{carbone,playwright,typst,exceljs}.ts` adapters
   - `studio/citations.ts` (span-level verification via Anthropic Citations API)
   - `studio/skills/` (runtime skill loader compatible with `~/.claude/skills` format)
2. **`@bossnyumba/document-templates`** — versioned Carbone/Typst templates, one per jurisdiction × doc-type. Bundled via `pnpm publish` so tenants can pin versions.
3. **Anthropic Citations API integration** in `services/reports/src/generators/narrative.ts` — replace any prompt-engineered "please cite" pattern with the structured API.
4. **Carbone container** added to `docker/`. Carbone runs as a side-car (Docker image is the on-prem distribution); call from `studio/render/carbone.ts`.
5. **Typst PDF engine** for legally-formatted docs (eviction, lease, demand letter, court filings). Use `pandoc/typst` Docker image; install `tectonic` as fallback for LaTeX-only templates.
6. **`services/reports/skills/`** — first 5 runtime skills (`owner-monthly-report`, `eviction-notice-ke`, `lease-agreement-ke`, `maintenance-invoice`, `tenant-ledger`).
7. **Brand tokens pipeline**: `@bossnyumba/design-system/tokens.json` (W3C DTCG format) → Style Dictionary → Carbone CSS + DOCX style mapping + PPTX theme. Single source for web, PDF, DOCX, PPTX.
8. **Dropbox Sign integration** in `services/reports/src/sign/dropbox-sign.ts` — embedded signing for leases & evictions. Audit-trail PDF auto-attached to bundle.
9. **Span-level verifier** (`packages/document-studio/src/verifier.ts`) — runs after generation; checks every numeric claim against ledger source, every legal clause against template, every quote against source document. Hard-fails the pipeline if uncited claim > 0 for legal docs.
10. **Custom Claude Code skill `bossnyumba-doc-author`** — installable via `~/.claude/skills`. Lets a property manager type "Generate eviction notice for unit 4B, 60-day cure period, missed April + May rent" in Claude Code and get a courtroom-ready PDF.

---

## Sources (consolidated)

- [Anthropic Agent Skills launch](https://claude.com/blog/skills)
- [anthropics/skills GitHub repo](https://github.com/anthropics/skills)
- [Complete Guide to Building Skills for Claude (PDF)](https://resources.anthropic.com/hubfs/The-Complete-Guide-to-Building-Skill-for-Claude.pdf)
- [Anthropic Skills walkthrough — 17 skills](https://claudecn.com/en/blog/claude-official-skills-walkthrough/)
- [PptxGenJS skill (Anthropic)](https://github.com/anthropics/skills/blob/main/skills/pptx/pptxgenjs.md)
- [Anthropic Citations API blog](https://claude.com/blog/introducing-citations-api)
- [Google Workspace Gemini March 2026 updates](https://blog.google/products-and-platforms/products/workspace/gemini-workspace-updates-march-2026/)
- [Gemini in Workspace explainer 2026](https://www.buildfastwithai.com/blogs/gemini-google-workspace-features-guide)
- [MS 365 Copilot agentic GA April 2026](https://www.microsoft.com/en-us/microsoft-365/blog/2026/04/22/copilots-agentic-capabilities-in-word-excel-and-powerpoint-are-generally-available/)
- [Microsoft Learn — Word/Excel/PowerPoint Agents](https://learn.microsoft.com/en-us/microsoft-365/copilot/wordexcelppt-agents)
- [Carbone.io homepage](https://carbone.io/)
- [Carbone v5 release notes](https://carbone.io/company/carbone-v5-news.html)
- [docx (dolanmiu) GitHub](https://github.com/dolanmiu/docx)
- [mammoth.js GitHub](https://github.com/mwilliamson/mammoth.js/)
- [docxtemplater npm](https://www.npmjs.com/package/docxtemplater)
- [PptxGenJS docs](https://gitbrent.github.io/PptxGenJS/)
- [Typst GitHub](https://github.com/typst/typst)
- [Typst vs LaTeX 2026 benchmark](https://www.typetex.app/comparisons/typst-vs-latex-speed)
- [Pandoc User's Guide](https://pandoc.org/MANUAL.html)
- [Best Node.js HTML-to-PDF libs 2026](https://apitemplate.io/blog/how-to-convert-html-to-pdf-using-node-js/)
- [Harvey AI platform](https://www.harvey.ai/)
- [EvenUp AI Drafts](https://www.evenuplaw.com/products/ai-drafts/)
- [CoCounsel Legal](https://legal.thomsonreuters.com/en/products/cocounsel-legal)
- [HotDocs (Mitratech)](https://mitratech.com/products/hotdocs/)
- [Dropbox Sign API](https://sign.dropbox.com/products/dropbox-sign-api)
- [Mapbox Static Images API](https://docs.mapbox.com/api/maps/static-images/)
- [Beautiful.ai vs Genspark comparison](https://www.beautiful.ai/comparison/genspark-ai-alternatives)
- [Plus AI Genspark review](https://plusai.com/blog/in-depth-genspark-review)
- [Spellbook contract redlining 2026](https://spellbook.com/learn/redline-contracts)
- [Vaquill AI document comparison](https://www.vaquill.ai/features/document-comparison)
- [LILT April 2026 release — 67 new languages](https://lilt.com/blog/april-2026-monthly-product-release)
- [Clarity AI: Ultimate Guide to AI Citation Checking 2026](https://claritybot.io/ai-content-verification/the-ultimate-guide-to-ai-citation-checking-in-2026-how-to-verify-research-citations-and-stop-hallucinations/)
- [Structured outputs guide 2026 (Pydantic + Zod)](https://techsy.io/en/blog/llm-structured-outputs-guide)
- [Design tokens in 2026](https://www.oneminutebranding.com/blog/design-tokens-2026)
- [10 best React chart libs 2026](https://arcdev.in/10-best-react-chart-libraries-2026-fast-beautiful-powerful/)
