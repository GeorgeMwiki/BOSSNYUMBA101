# Generative UI Research for BOSSNYUMBA Central Command

**Researched:** 2026-05-15
**Mode:** Ecosystem
**Confidence:** HIGH (primary docs verified)

## 1. Generative UI state-of-the-art (2025-2026)

The market has converged on five practical stacks:

1. **Vercel AI SDK 5 + AI Elements** — SSE-based UIMessage protocol, `useChat` v5
   typed across React/Vue/Svelte/Angular, AI Elements shadcn-style primitives
   for chat shell. AI SDK RSC (`streamUI`) is in maintenance pause; the canonical
   path is tool-result rendering via UIMessage parts (`tool-${toolName}`).
   Source: https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol, https://vercel.com/blog/ai-sdk-5
2. **Anthropic Artifacts** — Claude renders self-contained React 18 + shadcn +
   Tailwind + Recharts + Three.js + Lucide in a sandboxed runner. Three modes:
   `create`, `update` (string replace), `rewrite`. Live Artifacts (April 2026)
   re-execute on open against live data sources.
   Source: https://support.claude.com/en/articles/9487310, https://claudelab.net/en/articles/claude-ai/claude-artifacts-advanced-interactive-prototyping-guide
3. **CopilotKit + AG-UI Protocol** — open-source frontend for agents, ships
   `useCopilotAction` for "render this React component when the tool runs"
   pattern. CopilotKit maintains AG-UI (adopted by Google/LangChain/AWS/Oracle).
   Open Generative UI streams HTML/SVG token-by-token into sandboxed iframe.
   Source: https://www.copilotkit.ai/ag-ui, https://github.com/CopilotKit/CopilotKit
4. **OpenAI Apps SDK / MCP Apps (SEP-1865, stable 26 Jan 2026)** — tools return
   structured content with `_meta.openai/outputTemplate` or `_meta.ui.resourceUri`
   pointing to a `ui://` HTML bundle rendered in a sandboxed iframe with
   JSON-RPC-over-postMessage bridge.
   Source: https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/, https://developers.openai.com/apps-sdk
5. **v0.dev / Bolt / Lovable** — text-to-full-app; transparent shadcn output
   makes the codebase AI-readable. Useful for *design-time* generation, not
   runtime chat embedding.
   Source: https://v0.app/docs

## 2. Streaming protocol layer

**Recommendation: Vercel AI SDK 5 UIMessage Data Stream Protocol over SSE.**

Wire format (SSE, each line `data: {...json...}` then `[DONE]`):

```
data: {"type":"start","messageId":"msg_..."}
data: {"type":"text-start","id":"t1"}
data: {"type":"text-delta","id":"t1","delta":"Pulling arrears..."}
data: {"type":"text-end","id":"t1"}
data: {"type":"tool-input-start","toolCallId":"c1","toolName":"renderChart"}
data: {"type":"tool-input-delta","toolCallId":"c1","delta":"{\"spec\":"}
data: {"type":"tool-input-available","toolCallId":"c1","input":{...}}
data: {"type":"tool-output-available","toolCallId":"c1","output":{...vegaSpec...}}
data: {"type":"data-arrears-trend","data":{"tenantId":"...","points":[...]}}
data: {"type":"finish"}
data: [DONE]
```

- Tool input streaming always-on in v5 (no `toolCallStreaming` flag).
- Custom `data-*` events let the brain push out-of-band UI state (KPI deltas,
  approval prompts) outside tool-call lifecycle.
- For Claude direct: enable `anthropic-beta: fine-grained-tool-streaming-2025-05-14`
  + use `jiter` partial-JSON parsing on `input_json_delta` blocks.
  Source: https://platform.claude.com/docs/en/build-with-claude/structured-outputs

**Why not RSC `streamUI`:** Vercel itself flagged AI SDK RSC development as
paused. UIMessage tool-parts are now the canonical Vercel-blessed path.

## 3. Chart-rendering pipeline — Vega-Lite (winning recommendation)

Three contenders evaluated:

| Lib       | LLM-friendliness                                  | Bundle | Verdict |
| --------- | ------------------------------------------------- | ------ | ------- |
| Vega-Lite | Pure JSON grammar, LLMs trained heavily on it     | ~280KB | WIN     |
| ECharts   | JS-object config with callbacks (LLM can hallucinate functions); 10M-point perf | ~900KB | Backup for >100k points |
| Recharts  | React JSX, no JSON spec — needs translator        | ~95KB  | Use for hand-coded charts only |

**Pick Vega-Lite as the universal chart-spec interchange format** because:

- VegaChat research (2026) shows near-zero invalid-spec rates with LLMs and
  Spec/Vision-Score correlation with humans at 0.65/0.71.
  Source: https://arxiv.org/html/2601.15385v1
- Pure-JSON grammar means we can validate with JSON Schema *before* render,
  killing the "client chokes on unrecognised component" failure mode.
- Vega-Lite specs are stable across years (we can persist them in `audit_log`
  for replay/regulator review — important for BNB compliance trail).

**Concrete pipeline:**

```
admin chat → brain → tool: render_chart
  → LLM returns Vega-Lite v5 spec as JSON (validated via @vega-lite/schema)
  → server emits `tool-output-available` with the spec
  → <VegaLite spec={spec} data={data} /> on client (vega-embed)
```

For *dashboard* tiles where Tailwind/shadcn aesthetics matter (KPI cards,
small bars), wrap **shadcn/ui Chart + Recharts v3** primitives — same JSON
contract but emit a `recharts-config` variant when explicitly requested.

## 4. Form-filling pipeline

**Recommendation: TanStack Form + Zod schemas + custom AI-fill bridge** (NOT
RJSF or Formily directly).

Reasoning:

- BOSSNYUMBA already uses Zod everywhere (per `~/.claude/rules/coding-style.md`
  input-validation rule). One schema source = form generator + tool input
  schema + DB validator.
- TanStack Form is the 2026 default in shadcn/ui forms docs and handles
  dynamic validation, async, multi-step. RJSF (`react-jsonschema-form`) is
  battle-tested but its widget library is dated. Formily is powerful but
  Alibaba-centric and heavy.
- React Formule (CERN) proves the LLM-fill pattern: chat-driven prompt → LLM
  returns diff → user sees diff popover → accept/reject (or "Vibe Mode" auto-apply).
  Source: https://github.com/cern-sis/react-formule

**Concrete pipeline:**

```
schema (Zod) → zod-to-json-schema → tool inputSchema for Claude
admin: "create a tenant for Otieno at Westlands Plaza unit 4B"
brain → tool: prefill_form(formId="tenant.create")
  → LLM emits { values: {...}, confidence: {...} } against same Zod schema
  → server validates with .safeParse; if fail, repair-pass then re-emit
  → UIMessage `data-prefill-form` part with { formId, values, diffs }
  → client mounts <PrefillForm schema={tenantSchema} values={values}
       diffMode="approve-reject" />
  → user reviews diff, hits "Save" → standard form submission to existing
       Hono route (no agent in the write path — security boundary)
```

Anti-hallucination guard: never let the LLM write the schema; it only
populates *values* against a server-owned schema.

## 5. Top 10 generative-UI primitives BOSSNYUMBA brain needs

Each primitive = a versioned, JSON-schema-validated UIMessage data-part type
the brain can emit. Property-management framing throughout.

| # | Primitive | Data-part type | Underlying lib | PM use cases |
|---|-----------|----------------|----------------|--------------|
| 1 | Time-series chart (line/bar/area) | `data-chart-vega` | Vega-Lite v5 | arrears trend, occupancy %, FX exposure, water consumption |
| 2 | Data table | `data-table` | TanStack Table v8 | rent roll, late-payers, maintenance backlog (sort/filter/CSV) |
| 3 | Timeline / event log | `data-timeline` | Custom over shadcn vertical-timeline | tenant lifecycle, payment history, complaint thread |
| 4 | KPI card cluster | `data-kpi-grid` | Tremor + shadcn Card | dashboard hero: collected, due, occupancy, NOI, FX delta |
| 5 | Pre-filled form (approve/reject diff) | `data-prefill-form` | TanStack Form + Zod | add-user, create-tenant, file-KRA-MRI, lease-renewal |
| 6 | Approval prompt with diff preview | `data-approval` | shadcn Dialog + jsondiffpatch viewer | bulk rent-adjust, FX-rate update, owner-payout batch |
| 7 | Workflow status tracker | `data-workflow` | shadcn Stepper + state machine | onboarding, eviction, KRA filing, maintenance ticket |
| 8 | Map view | `data-map` | react-leaflet + OSM (no Mapbox token cost in TZ) | property locations, route to inspection, geo-fenced arrears |
| 9 | Calendar | `data-calendar` | FullCalendar v6 or shadcn Calendar | lease renewals, inspections, KRA deadlines, rent-due dates |
| 10 | File preview | `data-file-preview` | react-pdf + shadcn Sheet | owner statements, signed leases, MRI receipts, ID scans |

Each primitive ships with: (a) Zod schema, (b) renderer component, (c) tool
definition exposing it to the brain, (d) audit-log entry on render.

## 6. Concrete tech-stack recommendation

```jsonc
// package.json deps to add for Central Command generative UI layer
{
  "dependencies": {
    "ai": "^5.0.0",                              // Vercel AI SDK 5
    "@ai-sdk/anthropic": "^2.0.0",
    "@ai-sdk/openai": "^2.0.0",
    "@ai-sdk/react": "^2.0.0",                   // useChat v5 hook
    "@vercel/ai-elements": "latest",             // shadcn-style AI primitives (CLI install)
    "react-vega": "^7.6.0",                      // <VegaLite> component
    "vega-lite": "^5.20.0",
    "vega": "^5.30.0",
    "vega-embed": "^6.27.0",
    "recharts": "^3.0.0",                        // for shadcn charts (KPI cluster, small bars)
    "@tremor/react": "^3.18.0",                  // KPI cards
    "@tanstack/react-table": "^8.20.0",
    "@tanstack/react-form": "^1.0.0",
    "zod": "^3.23.0",                            // already in repo
    "zod-to-json-schema": "^3.23.0",             // Zod → tool inputSchema
    "react-leaflet": "^4.2.1",
    "leaflet": "^1.9.4",
    "@fullcalendar/react": "^6.1.15",
    "react-pdf": "^9.1.0",
    "jsondiffpatch": "^0.6.0",                   // approval prompt diffs
    "ajv": "^8.17.0"                             // validate LLM-emitted Vega specs
  }
}
```

Use **AG-UI events as the wire protocol** when integrating non-Vercel agents
(LangGraph, Mastra) — `useCopilotAction` then bridges into the same primitives.
For now keep the surface area small: AI SDK 5 UIMessage protocol is enough.

**File layout** (matches BNB many-small-files rule):

```
apps/admin/src/lib/genui/
  primitives/
    Chart.tsx               # Vega-Lite renderer + JSON-schema validator
    KpiGrid.tsx
    DataTable.tsx
    Timeline.tsx
    PrefillForm.tsx
    ApprovalPrompt.tsx
    WorkflowTracker.tsx
    MapView.tsx
    CalendarView.tsx
    FilePreview.tsx
  schemas/                  # one Zod schema per primitive
    chart.ts
    kpi.ts
    ...
  registry.ts               # type → component map, used by <UIMessageRenderer>
  validate.ts               # ajv + zod guards, repair pipeline
packages/agency/src/tools/
  render_chart.ts
  render_table.ts
  prefill_form.ts
  ...
```

## 7. Anti-patterns (and the fixes)

| Anti-pattern | Failure mode | Fix |
|--------------|-------------|-----|
| LLM emits raw React/JSX code for the UI | Brittle, prompt-injection vector, deeply-nested-bracket hallucinations | NEVER let the LLM emit code. Brain emits **values** against server-owned **typed primitives**. |
| Deep nested JSON tool schemas (>3 levels) | Models lose track of which object they're in → malformed output | Flatten primitives; one type per data-part; compose at render time, not at emission time. |
| No JSON-schema validation on tool output | Production failures from missing fields, wrong types, dangling brackets, trailing commas | ajv-validate every Vega-Lite spec and Zod-validate every form payload **before** UIMessage emit. Reject + repair-pass with smaller model. |
| Letting the LLM write/modify the form's schema | Privilege escalation, broken DB writes | Schema is server-owned. LLM only emits *values*. |
| Streaming chart spec piece-by-piece into renderer | Vega-embed re-renders on every chunk → flicker, crash | Render only on `tool-output-available` (complete object). For text use deltas; for components use complete tool outputs. |
| Single chart library at all sizes | Recharts at 100k points freezes; ECharts overkill for KPI tile | Tiered: Vega-Lite (default), Recharts/shadcn (KPI cluster), ECharts (>100k points only). |
| Forgetting the audit trail | Regulators (KRA, BNB) can't replay what was shown | Persist `(message_id, data_part_type, payload_hash)` in `audit_log` on every emit. |
| Map without offline tile fallback | Tanzania field staff hit dead zones | Use OSM with localStorage tile cache; never hard-depend on Mapbox token. |
| Mixing v4 RSC `streamUI` with v5 UIMessages | Type errors, double-stream paths | Pick **one** path. Use v5 UIMessage + tool-parts; treat RSC as legacy. |
| LLM-emitted Tailwind classes | Class purging strips them in production build | Primitives own their own classnames; LLM only chooses *which* primitive + which *values*. |

## Confidence

- AI SDK 5 protocol: HIGH (official docs fetched)
- MCP Apps spec: HIGH (official blog, stable status verified)
- AG-UI / Open-JSON-UI: HIGH (CopilotKit docs)
- Vega-Lite vs ECharts vs Recharts: HIGH (npmtrends + VegaChat paper)
- TanStack Form for LLM-fill: MEDIUM (Formule pattern proves concept on RJSF;
  need PoC on TanStack to fully confirm)
- v0/Bolt protocol details: LOW (mostly UX, not documented as runtime protocol)

## Open questions for phase-specific research

- Best client-side Vega-Lite-spec sandboxer (CSP for iframe vs in-process)?
- TanStack Form + Zod + diff-preview ergonomics — needs prototype.
- AG-UI vs Vercel UIMessage when we eventually swap agents — does it cost us
  a primitive rewrite? Likely no, but verify.
