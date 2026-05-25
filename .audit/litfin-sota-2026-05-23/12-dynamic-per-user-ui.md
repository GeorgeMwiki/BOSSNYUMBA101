# Dynamic Per-User UI — SOTA 2026 Research

**Date**: 2026-05-23
**Topic**: Software where each user gets a UI shape generated/adapted to THEIR specific needs and mental model — NOT GenUI (reactive, tool-rendered components from a chat turn), but **generative interfaces** (the entire app shape is generated from user description, persisted, edited iteratively, and evolved by usage).
**Subject**: BOSSNYUMBA101 — 5 personas (property managers, estate managers, customers/tenants, owners, admin platform), 5 portals, shared `packages/genui/` + `packages/chat-ui/` + `packages/design-system/`.
**Reference frame**: a16z "Year of Me" thesis, Wabi personal software, Ink & Switch malleable software, Tambo/CopilotKit/Flutter GenUI primitives, Lovable/v0/Bolt/Replit generative app builders, Linear/Notion/Airtable per-user view configs.

---

## 0. TL;DR

**The frame is shifting from "we ship a UI you customize" → "you describe your job-to-be-done, we ship YOUR UI".**

The 2026 frontier (Wabi, Lovable Agent Mode, v0 with Git Branches, Replit Agent 4, Bolt WebContainers, Tldraw computer, Builder.io Visual Copilot 2.0, Tambo, Flutter GenUI SDK, Plasmic SDUI) converges on one architecture:

1. A **primitive registry** of well-typed, well-designed, accessibility-correct UI blocks (Tambo/Flutter GenUI's "components-as-tools", BOSS's `GENUI_REGISTRY`).
2. A **layout DSL** persisted per-user as a JSON document (CopilotKit DataModel, Plasmic SDUI schema, Linear "Custom View", Airtable Interface) — NOT generated React code.
3. An **LLM-mediated edit loop** where the user describes a need in chat, the model proposes a layout patch, the user accepts, and the layout document evolves (Lovable's "Visual Edits + Agent Mode", Notion Agent's "personalize by adding instructions", Wabi's "prompts as remixable mini-apps").
4. A **bandit/RL feedback layer** that reorders surfaces by signal — Eppo Contextual Bandits, VWO AI predictive segmentation, Asana's adaptive task dashboard, MARLUI-style multi-agent RL frameworks.
5. **Persistence in a typed document store** (not in component instance state) — DataModel pattern, observable, time-travelable, server-replicatable, used to re-render the per-user UI on any device.

**BOSSNYUMBA already has the primitive registry** (47 typed `AgUiUiPart` kinds in `packages/genui/src/registry.ts` — chart-vega, data-table, kanban, dashboard-grid, calendar, kpi-grid, workflow, approval, etc.) and the **schema-validated render boundary** (`AdaptiveRenderer.tsx` + Zod `schemas/index.ts`). What it does NOT have:

- A **`PortalLayout` document** per (`tenant_id`, `user_id`, `portal`) that persists the chosen `dashboard-grid` composition.
- A **layout-edit chat mode** in `packages/chat-ui/src/chat-modes/` (today the chat modes drive content, not layout).
- A **contextual bandit** on which `kpi-tile` / `kanban-column` / `workflow-step` to surface first per user.
- A **persona seed templates** library (`Owner-financial`, `Estate-manager-ops`, `Tenant-mobile-first`, `Property-manager-legacy`, `Admin-platform`) the AI can clone-and-edit on first login.
- A **layout-evolution memory** that captures "user dismissed widget X 3 times → remove from primary surface" and feeds it back into the proposal loop.

**Top 3 surface-level wins to make first**:
1. **Add `PortalLayout` schema + REST CRUD + 5 persona seeds** — gets per-user dashboards live without an AI loop.
2. **Add "layout" chat mode** to `chat-ui` that emits `dashboard-grid` patches against the user's `PortalLayout` (small extension of the existing `<generative-ui>` SSE protocol).
3. **Add a `surface_signal` event** to `packages/observability/` that records dismiss/use/reorder for each cell, plumbed into a stub bandit picker (start with Thompson sampling — Eppo-style real bandits later).

---

## 1. Per-topic SOTA Sections

### 1.1 — "Software-for-one-user" pattern (a16z thesis, OS-as-spreadsheet, prompts-as-apps)

**SOTA (May 2026)**:
- a16z's "Year of Me" / "Notes on AI Apps 2026" calls 2026 the year mass-produced apps yield to **personalized software per user**. The compounding driver is that "the more a user interacts with an AI assistant, the more context the system accumulates" — creating a retention flywheel of per-user UI fit.
- **Wabi** (a16z-backed, Eugenia Kuyda) is the canonical reference — described as "the YouTube of apps", where users "transform prompts into remixable, screen-first mini-apps", connecting to real personal data (Apple Health, calendar, email), supporting notifications, streaks, calculated fields. Mantra: **"prompt-built apps, not chat boxes"**.
- **OS-as-spreadsheet** thesis (LLMs Are the New Operating System): the LLM is the runtime, the spreadsheet is the document model, the prompts are the apps. Microsoft SpreadsheetLLM is the productized form.
- The **Ink & Switch "Malleable Software" essay** (the deepest essay in the space) names the principles: gentle slope from consumption → creation, point-of-use modification, shared data layer across tools, in-place toolchain, schema flexibility, collaborative version control. **AI alone doesn't deliver this — you also need a malleable substrate**.

**Architectural pattern**: User-Generated Software (UGS) — apps are **declarative documents stored per-user**, runtime is shared, primitives are vetted by the platform, and the AI is a **scaffolder + editor + remixer** of those documents. **Critically not code generation** at the per-user layer; that's reserved for the platform team.

**Killer demo**: **Wabi mini-app remixing** — fork another user's app, swap the data source for yours, ship.

**What BOSSNYUMBA needs**:
- A `personal_apps` table keyed by `(user_id, app_id)`, document body = `AgUiUiPart` tree (BOSS already has the tree primitives — they're just rendered ephemerally today).
- A "Save this view as a mini-app" affordance on every chat turn that emits a `uiPart` tree.
- A `packages/genui/src/persistence/` module: serialize/deserialize/version/diff the tree.

---

### 1.2 — Vendors building this (May 2026)

| Vendor | What it is | SOTA pattern | Killer demo |
|---|---|---|---|
| **Tambo** (tambo-ai) | React SDK for generative UI with AI agents. Components registered with Zod schemas become LLM tool definitions; agent calls them; props **stream incrementally**. "Generative" (render-once: charts, summaries) vs "Interactable" (persistent: task boards, carts) component split. | Components-as-tools registry; Zod-schemas-as-tool-defs; Tambo Cloud or self-hosted Docker for state/orchestration. | Agent decides at runtime which of N registered components to render and configures them with streaming props. |
| **V0 by Vercel** | AI UI builder, full Next.js sandbox. **Git panel: each chat session = new branch; PR against main; deploy on merge.** | Each session is a branch in your repo — but **sessions are still independent** (no per-user UI memory across sessions yet). | "Import any GitHub repo, prompt, see preview, branch, PR." |
| **Plasmic AI Studio** | Visual builder + server-driven UI. "Components, variants, slots, composable state management". **Fits SDUI naturally** — editors manipulate UI directly, devs query Plasmic API for the latest arrangement. | Components + variants + slots + tokens + composable state; SDUI for runtime fetch of the arrangement. | A non-dev visually drags-and-drops; the React app re-fetches the layout JSON next render. |
| **Replit Agent 4** | "Describe app in plain language → Agent builds, deploys, configures DB." | Full-stack natural-language app gen, supports web/data-viz/3D games/agents/automations. | Non-coder builds working web scraper in 20 minutes. |
| **Anthropic Claude Code Skills** | SKILL.md files with a description; Claude reads ALL descriptions, matches against your request, loads the skill. Global (`~/.claude/skills/`) or project (`.claude/skills/`). | **Per-user skills as personalization vehicle**. Skill Creator generates new skills interactively. | Each developer ships their own skill library that travels across projects. |
| **Cursor Composer Agent** | `.cursor/rules/` directory; rules can be `alwaysApply: true`, intelligent (Cursor decides), or manual (@ mention). Rules survive in agent context but **can get compressed out on long sessions**. | Project-level rules vs personal preferences — `.cursorrules` committed to git for team consistency. | One file, one set of conventions, consistent output across the whole team. |
| **Cline / Continue** | `.clinerules/` workspace + system-wide global rules. Workspace > global on conflict. **Plugin can register tools, observe lifecycle, add rules and commands** (Cline SDK released May 2026). | Same hierarchical rules pattern as Cursor. | Cline Kanban — agent runs in a board, plugin-extensible. |
| **Bolt.new (StackBlitz)** | **WebContainers** in-browser VM; AI controls filesystem, node server, package manager, terminal, browser console. "Single meticulously crafted prompt → full app". | Browser-native dev environment; full app lifecycle in-browser. | "Prompt → full Next app with backend + DB + deploy in minutes." |
| **Lovable** | Chat-first; **structured plan before code**; "feels like working with a product manager". **Agent Mode** (default since Jul 2025): autonomous research + debug + self-validate. **Visual Edits** (Apr 2026): click any element, tweak inline. **Themes**: brand tokens panel, live preview. $330M Series B at $6.6B valuation Dec 2025. | "Chat-driven build → visual tweak → re-deploy" loop. | "Describe app → walk through proposed data model → see UI generated → click any element to refine." |
| **Tempo Labs** | Visual editor for React — "design tool UX, IDE under the hood". Generates 60–80% of front-end code; AI from text or image prompts; Figma plugin integration. | Visual + code dual editing for collab between PMs/designers/engineers. | Designers and PMs editing real React components without touching code. |
| **Tldraw computer** | Spatial AI: nodes on infinite canvas connected by arrows; LLM "reads" the diagram and flows data through "messy hand-drawn pipelines". Multiplayer. | **"The best interface for AI isn't a chat window, but a map."** Visual programming via canvas + LLM runtime. | Drag arrow from "Project Notes" → "Summary"; hit run; LLM executes. |
| **Builder.io Visual Copilot 2.0** | "Design to Interactive" — Figma to working code, with **design system + tokens + per-user A/B variants** baked in. | Visual Copilot CLI maps design tokens to your real components; generates A/B test variations + personalized variants. | "Generate this Figma frame as interactive with my real design system and 3 audience variants." |
| **Wabi** | Personal software platform; **"prompts + UI compose personal software"**; iOS app live; backed by a16z. | UGS (User-Generated Software) — fork-and-remix mini-apps; connects to personal data; notifications + streaks + calculated fields are native primitives. | Voice-prompt or text-prompt → screen-first mini-app in seconds, fully usable. |

---

### 1.3 — Generative interfaces (NOT GenUI)

**Distinction**: GenUI = chat turn renders a chart. Generative interface = your entire portal is described by a JSON document the user authored (with AI help), persisted, edited iteratively, evolved by usage signal. **State lives in the document, not the component tree.**

**SOTA (May 2026)**:
- **CopilotKit Enterprise Intelligence Platform** explicitly markets **"persistent memory to agent apps across sessions and devices, with continuous learning from real usage"**. This is the persistence story.
- **Flutter GenUI SDK** (flutter/genui) productizes the **DataModel pattern**: "centralized, observable store for all dynamic UI state. Widgets are 'bound' to data in this model. When data in the model changes, only the widgets that depend on that specific piece of data are rebuilt." Then "state changes are fed back to the agent, creating a high-bandwidth loop."
- Research: **"Gradual Generation of User Interfaces as a Design Method for Malleable Software"** (arxiv 2601.17975) — the academic spine for the iterate-with-AI-then-persist pattern.
- **"UI Layout Generation with LLMs Guided by UI Grammar"** (arxiv 2310.15455) — uses a grammar to constrain LLM layout output, making it controllable/explainable.

**Architectural pattern**:
```
User prompt ──▶ LLM (with primitive registry as tools, prior layout as context)
                   │
                   ▼
              Layout patch (JSON Patch / Automerge op against the PortalLayout document)
                   │
                   ▼
              User confirms (auto-accept low-risk patches)
                   │
                   ▼
              Persist new PortalLayout to store
                   │
                   ▼
              Re-render via existing AdaptiveRenderer
                   │
                   ▼
              Observe usage → feed bandit → next prompt sees updated weights
```

**Killer demo**: **Flutter GenUI SDK's bound widgets** — change one cell in the DataModel, ONE widget rebuilds, and the change is observable by the agent so it can adapt the next render.

**What BOSSNYUMBA needs**:
- `packages/genui/src/document.ts` — the `PortalLayout` document (Automerge or JSON Patch).
- A persistence service in `services/` or `packages/api-sdk/` for `GET/PUT /portal-layout`.
- The `AdaptiveRenderer` already takes a list of `parts` — wire it to read from the document instead of an ephemeral prop.

---

### 1.4 — Contextual bandits for UI layout (Eppo / VWO AI / Adobe Target / Optimizely)

**SOTA (May 2026)**:
- **Eppo**'s personalization product **explicitly leverages Contextual Bandits and real-time AI model optimizations to deliver tailored user experiences** — for "recommendations, content, and user interfaces". This is the closest off-the-shelf bandit-for-UI today.
- **VWO Copilot** (2026): AI-powered **predictive segmentation auto-identifies high-value user groups**; pre-test outcome modeling estimates results before running; **predictive heatmaps** highlight ignored areas; targeting segments via plain-language prompts.
- **Statsig + Optimizely + Adobe Target**: feature flags + experiments + audience-targeted variants. Statsig is all-in-one; Optimizely is enterprise; Adobe Target is the legacy giant.
- **Kameleoon** + **Braze** ship contextual-bandit personalization for marketing — same engine, different domain.
- Academic spine: **MARLUI (Multi-Agent RL for Adaptive UIs)** uses two agents — user model + interface agent — to adapt the UI online without real user data. **Reinforcement Learning-Based Framework for Intelligent UI Adaptation** (arxiv 2405.09255) frames the actions: "change layout, change color scheme, change font size, show/hide content, do nothing." Q-learning, REINFORCE, PPO.

**Architectural pattern**:
- **Context vector** per render: user features (role, tenure, completion rate, device), session features (time of day, prior path), task features.
- **Arms** = layout variants (which `dashboard-grid` composition, which order of `kpi-tile`s, which `workflow` to surface first).
- **Reward** = a composite of click-through, completion, dismissals (negative), and explicit thumbs-up/down.
- **Updates** = Thompson sampling or LinUCB at the start; full Eppo integration later.

**Killer demo**: **Eppo's contextual bandit** auto-promoting the highest-performing creative variant per audience segment without an explicit A/B test.

**What BOSSNYUMBA needs**:
- A `packages/observability/src/surface-signal.ts` that records `viewed`, `clicked`, `dismissed`, `reordered`, `completed` events keyed by `(user_id, portal, cell_id, kind)`.
- A `packages/genui/src/picker.ts` that wraps the layout document with a **Thompson-sampling bandit picker** for which N of M candidate cells to show.
- An "audit trail" of why a given cell was promoted (for governance — see audit pattern in `packages/autonomy-governance/`).

---

### 1.5 — RL-driven layout / progressive disclosure (surface next, hide rest)

**SOTA (May 2026)**:
- The MARLUI / RL-based adaptation literature (arxiv 2209.12660, 2312.07216, 2405.09255) has matured into a **standard recipe**: model user as MDP, define action space (layout/color/size/visibility), reward by task completion + dwell + dismissal, train Q-learning or PPO offline-then-online.
- Asana's task dashboard, cited in 2026 SaaS personalization roundups, **"adapts to individual workflow patterns — showing the most relevant view for each user's role and habits"**. The product pattern is **"if you know the user's role on signup, skip irrelevant steps entirely — onboarding answers are routing signals for the entire UX"**.
- Progressive disclosure (Nielsen-classic) is no longer a static design choice; it's **dynamic per user** — what counts as "primary" vs "secondary" is learned.

**Architectural pattern**:
- A **state vector** of (recent actions, session features, role, tenure, completion).
- An **action space**: show widget X / hide widget Y / promote Z to primary / collapse menu group W.
- A **reward signal** plumbed from telemetry.
- A **policy** (Q-table → DQN → PPO as data grows).

**Killer demo**: Asana adaptive dashboard, plus the academic MARLUI demos that train a UI to a synthetic user model.

**What BOSSNYUMBA needs**:
- A `surface_priority` field on every `AgUiUiPart` (or a sidecar table keyed by `cell_id`).
- A nightly job that re-ranks cells per `(user_id, portal)` using the latest bandit estimates.
- A "Why is this here?" affordance that opens an explanation panel (governance + trust).

---

### 1.6 — Adaptive design systems (shadcn-style tokens scaling to N variants per persona)

**SOTA (May 2026)**:
- Tokens have evolved from `color-primary: #000` into **multi-dimensional data objects with logic, intent, cross-platform mapping**. Three-layer model is canonical: **Primitives → Semantics → Components**.
- shadcn/ui's `registry-item.json` supports `cssVars` per theme (light/dark + arbitrary brand layers); **OKLCH is the default color format**. Tailwind v4 OKLCH tokens are standard in 2026.
- "Multi-mode collections" — your Light, Dark, brand variations, and density options all live in one structured system.
- Style Dictionary remains the industrial bridge — one source JSON → CSS variables + Swift constants + Android XML + Flutter Dart + custom formats.
- Composition + configuration pattern: "a single component can stretch to fit diverse brands, layouts, and experiences."

**Architectural pattern**:
- Three layers: **primitives** (`color-amber-500`, `space-4`), **semantics** (`color-action-primary`, `space-card-gap`), **component vars** (`button-primary-bg`).
- Multiple **persona themes** (Owner: dense + financial green, Tenant: airy + warm warm, Estate-manager: ops dense + amber, Property-manager: legacy familiar palette, Admin: cool neutral) layered as CSS variable overrides at the portal root.
- Density tokens (`density-compact` / `density-comfortable`) as first-class as color.

**Killer demo**: Lovable's **Themes** panel — "define your brand tokens once, propagate across every component" with live preview.

**What BOSSNYUMBA needs** (you have `packages/design-system/src/styles/` and `tailwind.config.ts` already — Midnight Ledger + Cinematic Display direction):
- Move to **layered semantic tokens** with persona overrides (today the system is one brand).
- Density tokens.
- A `useThemeOverride(persona)` hook to swap CSS variable scope.
- Export the token tree as JSON so the GenUI primitive registry can read it (today primitives use hard-coded Tailwind classes — they should consume semantic tokens so they reskin automatically per persona).

---

### 1.7 — "Painted door" / fast-iteration patterns

**SOTA (May 2026)**:
- **Painted/fake-door tests** remain the lean-startup-canonical method for validating feature demand before building. Amplitude, Optimizely, ProdPad, Userpilot, Contentful all document the pattern; the **Domino's premium cookie 1-week 4-variant test** is the canonical case study.
- The **fast-iteration play in 2026**: pair painted doors with **contextual bandits** so you don't lose users — the bandit naturally allocates traffic away from doors that don't open.

**Architectural pattern**:
- Ship a button. Wire it to a "coming soon" sheet + analytics event. Watch click-through. If high, build it. If low, kill it.
- In a personalized-UI world, **paint different doors for different personas** and let the bandit decide.

**Killer demo**: Domino's 4-cookie 1-week test.

**What BOSSNYUMBA needs**:
- A `<PaintedDoor>` component in `packages/genui/src/components/` that records click + shows a stub modal.
- Standard analytics event vocabulary `painted_door_clicked`.
- Documented playbook in `Docs/` for product team.

---

### 1.8 — Per-user theming AND per-user information architecture

**SOTA (May 2026)**:
- Per-user **theming** is solved (Lovable Themes, shadcn OKLCH, Tailwind v4 CSS-first, design tokens with mode collections).
- Per-user **information architecture** (which tabs, which order, which menu items, which primary action) is the active frontier:
  - **Linear**: "Personal vs Team" view scope; **AI Filter** ("Show me issues assigned to me, due next week" in natural language); **Personal Dashboards** under workspace Views.
  - **Notion** (April 2026 updates): workspace admins set custom instructions (tone, section structure, length); **"Me" filter** without hardcoded IDs; Notion Agent personalization templates.
  - **Airtable Interfaces**: per-user view scope; **AI-generated interface elements** ("custom visualizations and layouts created by Omni from natural language prompts, including full table layouts and dashboard elements").
  - **Retool AppGen**: "describe internal tool in plain English, Retool generates UI + queries + workflows against your actual database schema. The output is a full Retool app — not a prototype." Respects SSO / RBAC / data-level perms.

**Architectural pattern**:
- IA is **data**, not code: tabs, menu items, primary action, default route — all fields on a `PortalLayout` document per user.
- A library of **layout patches** the AI can apply: `addCell`, `removeCell`, `reorderCells`, `setPrimaryAction`, `renameTab`, `pinToTopbar`.

**Killer demo**: Linear's natural-language AI filter creating a custom view that becomes saveable, shareable, dashboard-able.

**What BOSSNYUMBA needs**:
- Today menu items + tab order + primary action are hard-coded in each `apps/*-portal/`. They should be **fields on the `PortalLayout` document**.
- A `<PortalShell>` component in `packages/design-system/` that reads the document and renders the topbar/sidebar accordingly.
- 5 **persona seed layouts** committed to the repo so the doc is never empty on first login.

---

### 1.9 — Voice-first UX flipping (when primary is voice, what's the screen for?)

**SOTA (May 2026)**:
- The **mode-switching** literature converges: voice is primary for hands-busy / eyes-busy / mobile contexts; screen is **complementary confirmation + visual context** ("if user speaks, confirm visually").
- **Multimodal UX context-switching**: never make users repeat info when switching modes (LogRocket). Screen shows the **available command set** when the user can't scan a voice interface for options.
- Apple Intelligence (May 2026 release): **Magnifier with assistive exploration + visual description for low-vision users** as a separate high-contrast surface — **explicitly NOT a polyfill of the main app**.

**Architectural pattern**:
- One **input modality switch** per surface (mic ↔ keyboard ↔ touch); state is always rendered.
- Voice-first surface: minimal screen, large transcript, suggested next-prompts as chips (BOSS already has `PromptSuggestions` primitive — perfect fit).
- Screen-first surface with optional voice: mic button, push-to-talk, transcript displayed.

**Killer demo**: Apple Magnifier 2026 — same Apple Intelligence brain, fundamentally different UI surface for low vision users.

**What BOSSNYUMBA needs** (you have `packages/chat-ui/src/voice/`):
- A `voice-first` portal mode that swaps the layout to large transcript + chips.
- A persistent **modality preference** on the user (`primary_modality: voice|text|hybrid`).
- Mode-switching that preserves session state (use the same chat thread regardless of input).

---

### 1.10 — Accessibility as personalization (separate surface, not polyfill)

**SOTA (May 2026)**:
- Apple's May 2026 release frames accessibility features as **separate adaptive surfaces** — Magnifier is its own UI, not a screen-reader veneer of the main app.
- Academic research (arxiv 2502.14288 GCN-based accessibility checker, arxiv 2502.15142 AccessFixer R-GCN) attacks GUI accessibility for low-vision users specifically — the framing is "the original GUI is broken for low-vision; build a different one".
- **Morae** (arxiv 2508.21456): "Proactively Pausing UI Agents for User Choices" — bringing human-in-the-loop pauses into agent-driven UIs as an accessibility primitive.

**Architectural pattern**:
- Accessibility flags on user profile (`prefers_high_contrast`, `prefers_large_text`, `prefers_screen_reader`, `prefers_voice_input`).
- Each flag gates a **different layout document**, not a CSS overlay.
- A flag for "agent-mediated mode" — let the AI do the navigation, user just confirms.

**Killer demo**: Apple Magnifier high-contrast mode + visual description as its own first-class entry point.

**What BOSSNYUMBA needs**:
- Accessibility preferences on the user model.
- Per-preference layout documents (or layout transformers that apply on-render).
- A "Use voice mode" entry point on every portal that takes a low-literacy/low-vision user into a different surface entirely.

---

### 1.11 — Mobile vs desktop divergence (different apps or same UI?)

**SOTA (May 2026)**:
- Property management 2026 buyer guides explicitly call out **"separate landlord and tenant apps designed to help everyone manage their rentals with ease, and a separate owner portal"** as the modern pattern.
- "Platforms are tested on phones, not laptops" — **mobile is the primary surface for tenants**; desktop is the primary surface for property managers + estate managers + admins.
- The middle ground (single responsive web) **loses on both**: too cramped for ops, too desktop-feeling for tenants.

**Architectural pattern**:
- **Mobile**: native app (React Native or Expo or native iOS/Android) for tenants → optimized for one-tap rent pay, photo-upload maintenance, push notifications.
- **Desktop web**: dense ops surface for managers / estate managers → tables, kanbans, multi-window flows.
- **Shared**: design tokens, primitive vocabulary, chat backend, GenUI primitive registry — but **different shells, different layouts, different primary surfaces**.

**Killer demo**: AppFolio's separate landlord/tenant/owner apps.

**What BOSSNYUMBA needs** (you have `apps/customer-app/` for tenants + `apps/owner-portal/` + `apps/estate-manager-app/` + `apps/admin-platform-portal/` + `apps/bossnyumba_app/`):
- Confirm `customer-app` is mobile-first/native (it should be), other portals are desktop-first web.
- Share `packages/genui/` primitives across all but **let each portal pick a different default primitive set** for its layout seeds (mobile: `KpiGrid` + `PromptSuggestions` + `ChatEmbed`; desktop ops: `DashboardGrid` + `DataTable` + `Kanban` + `WorkflowStepper`).
- A token of which primitives are **mobile-friendly** in the registry metadata.

---

### 1.12 — Real-world 2026 examples (Linear, Notion, Airtable, Retool)

| Product | Per-user UI pattern (2026) |
|---|---|
| **Linear** | Custom views (personal/team scope), AI natural-language filters, personal dashboards, dashboard-level filters as saved chips, AI surfacing patterns proactively. |
| **Notion** | Notion Agent personalization templates; workspace admin custom instructions for AI; per-user "Me" filter without hardcoded IDs; 30,000+ template marketplace; AI templates that teach Agent exactly how you work. |
| **Airtable Interfaces** | Per-user view scope, role-based permission, **AI-generated interface elements via Omni from natural language prompts** including "full table layouts and dashboard elements". |
| **Retool AppGen** | Describe internal tool in plain English → Retool generates UI + queries + workflows against your actual schema. Respects SSO / RBAC / data perms. |
| **Asana** | Task dashboard adapts to individual workflow patterns — most relevant view for each user's role and habits. |
| **Lovable Agent Mode** | Autonomous research + debug + self-validate; Visual Edits click-to-tweak; Themes panel with live preview. |
| **Wabi** | UGS — prompts compose mini-apps; fork-remix-share; calculated fields, streaks, notifications as first-class. |
| **Cline / Cursor** | Hierarchical rules: project workspace > global system; rules survive in agent context; SDK lets plugins register tools and shape what agent sees. |

---

## 2. UI Primitive Registry — What Blocks Should Be Remixable Per-User

BOSSNYUMBA's current `GENUI_REGISTRY` (in `packages/genui/src/registry.ts`) has these 40+ kinds — they ARE the remixable primitives:

| Kind | Per-user remixability | Notes |
|---|---|---|
| `dashboard-grid` | **Layout root** | The container of layouts; per-user UI = a per-user `dashboard-grid` tree |
| `kpi-grid` | High | Owner wants different KPIs than manager |
| `data-table` | High | Each persona needs different columns/sort/filter defaults |
| `kanban` | High | Estate managers vs property managers want different swimlanes |
| `calendar` | High | Tenants vs managers see different events |
| `timeline` | Medium | Same shape, different events |
| `workflow` (stepper) | High | Each tenant journey, each manager journey is different |
| `prefill-form` | High | Onboarding form differs per persona |
| `approval` | Medium | Same dialog, different policies |
| `map` | Medium | Property locations, geo-fences |
| `geo-fence` | Medium | Estate manager primary surface |
| `prompt-suggestions` | **HIGH** | Should be persona-specific seed prompts |
| `chart-vega` | High | Different chart per persona — owners want financials, managers want ops |
| `heatmap` | Medium | Occupancy heatmap |
| `tree` | Medium | Org chart, document hierarchy |
| `diff-view` | Low | Same shape always |
| `gauge` | Medium | KPI gauge — different metric per persona |
| `metric-sparkline` | High | Different metric per persona |
| `image-annotation` | Medium | Maintenance ticket photos |
| `signature-pad` | Low | Same shape always |
| `pdf-viewer` | Low | Same shape |
| `slider-input` | Low | Same shape |
| `multistep-wizard` | High | Each persona's onboarding is a different wizard |
| `media-grid` | Medium | Photo grids |
| `chat-embed` | High | Embed the chat anywhere — per persona placement |
| `live-counter` | Medium | KPI ticker |
| `org-chart` | Low | Same shape |
| `comparison-table` | Medium | Plan comparison, property comparison |
| `notification-toast` | Low | Same shape, different content |
| `decision-trace` | Medium | Governance/audit primitive — admin-heavy |
| `code-block` | Low | Admin/dev only |
| `dataflow-diagram` | Low | Admin/dev only |
| `markdown-card` | High | Content card — persona-specific copy |
| `evidence-card` | Medium | Compliance/governance |
| `file-preview` | Low | Same shape |
| `frame` | **Container** | All primitives wrap in `Frame` for consistent borders/titles |

**Missing primitives BOSS should add for per-user UI** (proposed):
- `quick-actions` — a row of FAB-style buttons; per-user primary actions live here.
- `painted-door` — analytics-instrumented "coming soon" link.
- `persona-switcher` — for admin users who manage multiple personas (an admin viewing as an owner).
- `tour-step` — interactive product tour cell, personalized per persona.
- `recommendation-card` — bandit-driven recommended action.
- `feedback-thumbs` — per-cell thumbs-up/down for the bandit reward signal.
- `mini-app-card` — Wabi-style "open this saved view" card linking to a `PortalLayout` document.

---

## 3. Persona-to-UI Mapping for BOSSNYUMBA's 5 Portals

### 3.1 — Property Managers (legacy, in `apps/bossnyumba_app/` or similar)

**Mental model**: spreadsheet + email + phone.
**Primary actions**: rent collection, maintenance dispatch, lease renewal.
**Default `dashboard-grid` seed**:
- Row 1 (12 cols): `kpi-grid` — Outstanding rent, Vacancy rate, Open maintenance, Renewals due 30d.
- Row 2 (8/4): `data-table` (rent roll) + `prompt-suggestions` (chat shortcuts).
- Row 3 (6/6): `kanban` (maintenance pipeline) + `calendar` (renewals).
- Row 4 (12): `timeline` (recent activity).
**Theme**: dense (Excel-familiar), warm amber (BOSS Midnight Ledger direction), large legible numbers.
**Modality**: desktop web primary, mobile responsive.

### 3.2 — Estate Managers (tech-savvy, ops, in `apps/estate-manager-app/`)

**Mental model**: ops dashboard + map + work-order app.
**Primary actions**: dispatch, route, inspect, escalate.
**Default `dashboard-grid` seed**:
- Row 1 (12): `map` with `geo-fence` (active properties + incidents).
- Row 2 (6/6): `kanban` (work orders by status) + `heatmap` (incident density).
- Row 3 (4/4/4): `live-counter` (open incidents) + `metric-sparkline` (SLA) + `prompt-suggestions`.
**Theme**: ops dense + dark mode default + status colors prominent.
**Modality**: desktop primary + mobile native for field work.

### 3.3 — Customers / Tenants (mobile-first, in `apps/customer-app/`)

**Mental model**: WhatsApp + payment app.
**Primary actions**: pay rent, request maintenance, message manager, see lease.
**Default `dashboard-grid` seed (mobile single-column)**:
- Row 1: `quick-actions` — Pay Rent, Request Maintenance, Message.
- Row 2: `kpi-grid` (1 tile) — Next due / paid status.
- Row 3: `chat-embed` (open AI helper).
- Row 4: `timeline` (recent activity).
**Theme**: airy + warm + large touch targets + minimal text.
**Modality**: mobile native primary; voice-first option for low-literacy users.

### 3.4 — Owners (financial-focused, in `apps/owner-portal/`)

**Mental model**: investment portfolio + bank statement.
**Primary actions**: see returns, approve big expenses, drill into a property.
**Default `dashboard-grid` seed**:
- Row 1 (12): `kpi-grid` — Portfolio value, Monthly cash flow, YoY return, Occupancy.
- Row 2 (8/4): `chart-vega` (cash flow trend) + `comparison-table` (properties).
- Row 3 (6/6): `data-table` (property list) + `evidence-card` (compliance status).
- Row 4 (12): `approval` queue (decisions awaiting owner).
**Theme**: financial green/red, condensed numerals, calm.
**Modality**: desktop primary + email summary daily.

### 3.5 — Admin Platform (in `apps/admin-platform-portal/` or `apps/admin-portal/`)

**Mental model**: ops console + governance.
**Primary actions**: tenant config, compliance audit, billing, escalations.
**Default `dashboard-grid` seed**:
- Row 1 (12): `kpi-grid` — Active tenants, MRR, Open escalations, SLA breaches.
- Row 2 (6/6): `decision-trace` + `evidence-card` (governance).
- Row 3 (6/6): `data-table` (tenants) + `notification-toast` queue.
- Row 4 (12): `dataflow-diagram` (system health).
**Theme**: cool neutral + dark default + governance accent.
**Modality**: desktop primary.

---

## 4. Architecture — User Describes Need → AI Proposes Layout → User Confirms → Persists → Evolves

### 4.1 — End-to-end flow

```
┌──────────────────────────────────────────────────────────────────────┐
│ 1. USER (in chat-ui)                                                 │
│    "I want to see all my overdue rent on one screen, by property"    │
└──────────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────────────┐
│ 2. CHAT KERNEL (packages/central-intelligence)                       │
│    Receives prompt; loads:                                           │
│      - user's current PortalLayout document                          │
│      - GENUI_REGISTRY metadata (kind, description, when-to-use)      │
│      - persona seed reference                                        │
│      - past surface_signal events (what user uses/dismisses)         │
└──────────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────────────┐
│ 3. LLM (Claude/GPT/Gemini)                                           │
│    Tool: propose_layout_patch(patch: JsonPatch[])                    │
│    Output: a JSON Patch against PortalLayout                         │
│      e.g. [{"op": "add", "path": "/cells/0",                         │
│             "value": {"kind": "data-table", "title":                 │
│             "Overdue rent by property", "columns":[...]}}]            │
└──────────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────────────┐
│ 4. VALIDATION (packages/genui/src/schemas)                           │
│    Zod-validate every patched cell; reject if invalid                │
│    Check authz-policy (this user can see this data)                  │
└──────────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────────────┐
│ 5. USER CONFIRM (chat-ui)                                            │
│    Show diff of layout (before/after)                                │
│    Auto-accept if patch is small + low-risk                          │
│    Otherwise "Apply / Discard" buttons                               │
└──────────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────────────┐
│ 6. PERSIST (services/portal-layout-service or api-sdk)               │
│    PUT /portal-layouts/{user_id}/{portal}                            │
│    Version increment; old version retained for undo                  │
└──────────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────────────┐
│ 7. RENDER (AdaptiveRenderer)                                         │
│    Re-read document; re-render via existing primitive switch         │
└──────────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────────────┐
│ 8. OBSERVE (packages/observability/surface-signal)                   │
│    Record viewed/clicked/dismissed events per cell                   │
└──────────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────────────┐
│ 9. EVOLVE (nightly job + bandit picker)                              │
│    Re-rank cells; suggest pruning low-engagement cells               │
│    Suggest new cells based on similar-persona high-performers        │
│    Surface as proactive chat suggestion next session                 │
└──────────────────────────────────────────────────────────────────────┘
```

### 4.2 — Data model

```typescript
// PortalLayout — the per-user UI document
interface PortalLayout {
  readonly id: string;                // ulid
  readonly tenantId: string;
  readonly userId: string;
  readonly portal: 'customer' | 'owner' | 'estate-manager' | 'property-manager' | 'admin';
  readonly persona: string;           // seed it was forked from
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly root: AgUiUiPart;          // typically a dashboard-grid
  readonly menu: ReadonlyArray<MenuItem>;    // sidebar/topbar IA
  readonly primaryAction: PrimaryAction;
  readonly preferences: {
    readonly modality: 'voice' | 'text' | 'hybrid';
    readonly density: 'compact' | 'comfortable';
    readonly themePersona: string;
    readonly accessibility: AccessibilityPrefs;
  };
}

interface SurfaceSignal {
  readonly tenantId: string;
  readonly userId: string;
  readonly portal: string;
  readonly cellId: string;
  readonly kind: AgUiUiPart['kind'];
  readonly event: 'viewed' | 'clicked' | 'dismissed' | 'reordered' | 'completed' | 'thumbs_up' | 'thumbs_down';
  readonly ts: string;
  readonly context: Readonly<Record<string, unknown>>;
}
```

### 4.3 — Bandit picker (start simple, evolve)

```typescript
// packages/genui/src/picker.ts (stub)
// Thompson sampling on Beta(alpha, beta) where alpha = clicks, beta = dismissals
function pickTopN(
  candidates: ReadonlyArray<{cellId: string; alpha: number; beta: number}>,
  n: number,
): ReadonlyArray<string> {
  const draws = candidates.map((c) => ({
    cellId: c.cellId,
    sample: betaSample(c.alpha + 1, c.beta + 1),
  }));
  return draws.sort((a, b) => b.sample - a.sample).slice(0, n).map((d) => d.cellId);
}
```

Eventually swap for **Eppo SDK** contextual bandits + LinUCB with the context vector.

---

## 5. Ten Concrete Things to Build (Prioritized)

### Tier 1 — Foundational (do these first, no AI required)

1. **`PortalLayout` document model + persistence**
   - New table `portal_layouts (tenant_id, user_id, portal, version, root jsonb, menu jsonb, primary_action jsonb, preferences jsonb, created_at, updated_at)`
   - Service in `services/` or routes in `apps/*-portal/api/` for `GET/PUT /portal-layouts/{user_id}/{portal}`
   - Zod schema in `packages/genui/src/document.ts`
   - Migration in `packages/database/`

2. **5 persona seed layouts in `packages/genui/src/seeds/`**
   - `customer-mobile-seed.json`, `owner-financial-seed.json`, `estate-manager-ops-seed.json`, `property-manager-legacy-seed.json`, `admin-governance-seed.json`
   - On first login, fork the persona seed into the user's document.

3. **`<PortalShell>` in `packages/design-system/`**
   - Reads `PortalLayout` document; renders topbar/sidebar/primary-action from `menu` + `primaryAction`.
   - Replaces the per-portal hard-coded layouts in `apps/*-portal/`.

### Tier 2 — Layout AI loop (extends existing chat)

4. **"Layout" chat mode in `packages/chat-ui/src/chat-modes/`**
   - New mode that loads the current `PortalLayout` as context.
   - Single tool: `propose_layout_patch(patches: JsonPatch[])`.
   - Renders the proposed diff inline before applying.

5. **Layered semantic tokens + 5 persona theme overrides**
   - Refactor `packages/design-system/src/styles/` from one brand to **primitives → semantics → component vars**.
   - 5 persona theme CSS variable scopes.
   - `useThemeOverride(persona)` hook.
   - Density tokens (`compact` vs `comfortable`).

6. **`surface-signal` event vocabulary in `packages/observability/`**
   - Emit on viewed/clicked/dismissed/reordered/completed/thumbs.
   - Persist to a time-series table.
   - Expose query API for the picker.

### Tier 3 — Adaptive loop (evolve UI by usage)

7. **Thompson-sampling bandit picker in `packages/genui/src/picker.ts`**
   - Read past surface signals.
   - Re-rank cells per `(user_id, portal)`.
   - Apply at render time as a wrapper around the layout document.

8. **Nightly "layout suggestion" job**
   - Compare user's signals to high-performing similar-persona users.
   - Generate proactive "I noticed you never use X — want to remove it? I also see managers like you find Y useful — try it?" prompts.
   - Land in chat history with one-click accept.

### Tier 4 — Accessibility + voice surface

9. **Voice-first portal mode + modality preference**
   - `preferences.modality = 'voice' | 'text' | 'hybrid'` on every layout.
   - Voice mode swaps in a different `PortalLayout` (large transcript + `prompt-suggestions` chips + `chat-embed`).
   - Same chat thread regardless of input mode.

10. **Accessibility-as-personalization profile + dedicated layouts**
    - `preferences.accessibility = { largeText, highContrast, screenReader, voiceOnly }`.
    - Each flag points to a **dedicated layout transformer** (not a CSS overlay).
    - "Use voice mode" entry button on every portal home.

---

## 6. Sources

- [a16z Notes on AI Apps in 2026](https://a16z.com/notes-on-ai-apps-in-2026/)
- [a16z Speedrun 14 Big Ideas for 2026](https://superframeworks.com/articles/a16z-speedrun-ideas-indie-hackers-2026)
- [a16z Top 100 Gen AI Consumer Apps March 2026](https://www.a16z.news/p/top-100-gen-ai-consumer-apps-march)
- [Wabi — The first personal software platform](https://wabi.ai/)
- [Wabi & the Rise of Prompt-Built Apps](https://aibusinessasia.beehiiv.com/p/wabi-the-rise-of-prompt-built-apps-the-next-software-wave)
- [Ink & Switch — Malleable Software essay](https://www.inkandswitch.com/essay/malleable-software/)
- [Tambo — Generative UI SDK for React](https://github.com/tambo-ai/tambo)
- [Tambo — What is Generative UI](https://tambo.co/blog/posts/what-is-generative-ui)
- [Tambo docs](https://docs.tambo.co/)
- [Flutter GenUI SDK](https://docs.flutter.dev/ai/genui)
- [CopilotKit — Developer's Guide to Generative UI in 2026](https://www.copilotkit.ai/blog/the-developer-s-guide-to-generative-ui-in-2026)
- [Vercel v0 announcement](https://vercel.com/blog/announcing-v0-generative-ui)
- [Introducing the new v0](https://vercel.com/blog/introducing-the-new-v0)
- [v0 by Vercel 2026 guide](https://blog.vibecoder.me/v0-by-vercel-complete-guide)
- [Plasmic — The visual builder for developers](https://www.plasmic.app/developers)
- [Plasmic — Server-driven UI](https://docs.plasmic.app/learn/sdui/)
- [Replit Agent 4](https://replit.com/products/agent)
- [Replit Agent 4 AI Building Apps Without Code](https://www.startuphub.ai/ai-news/artificial-intelligence/2026/replit-s-agent-4-ai-building-apps-without-code)
- [Lovable AI App Builder](https://lovable.dev/)
- [Lovable Visual Edits](https://lovable.dev/blog/introducing-visual-edits)
- [Lovable for Designers — Muzli 2026](https://muz.li/blog/lovable-for-designers-the-complete-guide-to-building-apps-with-ai-2026/)
- [Bolt.new — StackBlitz](https://github.com/stackblitz/bolt.new)
- [Bolt.new Complete Guide 2026](https://blog.vibecoder.me/bolt-new-complete-guide)
- [Tempo Labs](https://www.tempo.new/)
- [Tempo Labs review 2026](https://aichief.com/ai-design-tools/tempo-labs/)
- [Tldraw computer](https://computer.tldraw.com/)
- [Tldraw computer — Hack Science](https://www.hackscience.education/the-computer-you-draw-inside-tldraws-natural-language-os/)
- [Builder.io Visual Copilot 2.0](https://www.builder.io/blog/visual-copilot-2)
- [Anthropic — Complete Guide to Building Skills for Claude](https://resources.anthropic.com/hubfs/The-Complete-Guide-to-Building-Skill-for-Claude.pdf)
- [Claude Skills Explained — Analytics Vidhya 2026](https://www.analyticsvidhya.com/blog/2026/03/claude-skills-custom-skills-on-claude-code/)
- [Cursor — Composer, Agent Mode 2026](https://www.deployhq.com/guides/cursor)
- [Cursor — Best practices for coding with agents](https://cursor.com/blog/agent-best-practices)
- [Cline — Rules documentation](https://docs.cline.bot/customization/cline-rules)
- [Cline SDK release May 2026](https://www.marktechpost.com/2026/05/14/cline-releases-cline-sdk-an-open-source-agent-runtime-now-powering-its-cli-and-kanban-with-ide-extensions-being-migrated/)
- [Microsoft Copilot Studio — Declarative Agents](https://learn.microsoft.com/en-us/microsoft-365-copilot/extensibility/overview-declarative-agent)
- [M365 Copilot Declarative Agents April 2026](https://www.voitanos.io/blog/microsoft-365-copilot-declarative-agents-whats-new-202604-april-2026/)
- [Linear Custom Views](https://linear.app/docs/custom-views)
- [Linear Dashboards](https://linear.app/docs/dashboards)
- [Linear advanced filters Feb 2026](https://linear.app/changelog/2026-02-13-advanced-filters-and-share-issues-in-private-teams)
- [Notion AI Templates Library](https://www.notion.com/templates/category/ai)
- [Notion Update April 2026](https://fazm.ai/blog/notion-update-april-2026-new-features)
- [Notion AI Personalization Guide template](https://www.notion.com/templates/ai-personalization-guide)
- [Airtable AI-generated interface elements](https://support.airtable.com/docs/ai-generated-interface-elements-in-airtable)
- [Airtable Interface Layout — Dashboard](https://support.airtable.com/docs/interface-layout-dashboard)
- [Retool AppGen — Enterprise AI App Generation](https://retool.com/ai-app-generation)
- [Retool AI](https://retool.com/ai)
- [Retool becomes the Platform for Enterprise AppGen — Neon](https://neon.com/blog/retool-becomes-the-platform-for-enterprise-appgen)
- [Apple Accessibility 2026 features](https://www.apple.com/newsroom/2026/05/apple-unveils-new-accessibility-features-and-updates-with-apple-intelligence/)
- [Eppo Feature Flags & Personalization](https://www.geteppo.com/feature-flagging)
- [Statsig Alternatives — Flagsmith 2026](https://www.flagsmith.com/blog/statsig-alternatives)
- [VWO Copilot](https://vwo.com/copilot/)
- [VWO AI Personalization](https://vwo.com/blog/ai-personalization/)
- [Braze — AI Decisioning with Contextual Bandits](https://www.braze.com/resources/articles/contextual-bandits)
- [Kameleoon — Contextual Bandits](https://www.kameleoon.com/blog/contextual-bandits)
- [Reinforcement Learning-Based Framework for Intelligent UI Adaptation — arxiv 2405.09255](https://arxiv.org/html/2405.09255v1)
- [MARLUI — Multi-Agent RL for Adaptive UIs — arxiv 2209.12660](https://arxiv.org/pdf/2209.12660)
- [Learning from Interaction — UI Adaptation using RL — arxiv 2312.07216](https://arxiv.org/html/2312.07216v1)
- [Gradual Generation of UIs as a Design Method for Malleable Software — arxiv 2601.17975](https://arxiv.org/html/2601.17975)
- [UI Layout Generation with LLMs Guided by UI Grammar — arxiv 2310.15455](https://arxiv.org/pdf/2310.15455)
- [Generative Interfaces for Language Models — arxiv 2508.19227](https://arxiv.org/html/2508.19227v2)
- [Server-Driven UI at Scale 2026](https://blog.weskill.org/2026/04/server-driven-ui-sdui-at-scale-json.html)
- [Server-Driven UI 2026 Guide — WeWeb](https://www.weweb.io/blog/server-driven-ui-guide-architecture-examples)
- [Painted Door Tests — Amplitude](https://amplitude.com/explore/experiment/painted-door-testing)
- [Painted Door Test — ProdPad](https://www.prodpad.com/blog/painted-door-test/)
- [Painted Door Test — Optimizely](https://www.optimizely.com/optimization-glossary/painted-door-test/)
- [Design Systems 2026 — Airbnb & Uber Scale](https://wearepresta.com/design-systems-for-scale-2026/)
- [Design Tokens in 2026 — OneMinuteBranding](https://www.oneminutebranding.com/blog/design-tokens-2026)
- [Multi-Brand Design Systems — zeroheight](https://zeroheight.com/blog/opinionated-vs-global-design-tokens-simplifying-multi-brand-design-systems/)
- [Multi-Brand Systems with Tokens and Composability — Frontend Masters](https://frontendmasters.com/blog/exploring-multi-brand-systems-with-tokens-and-composability/)
- [shadcn/ui Theming](https://ui.shadcn.com/docs/theming)
- [shadcn/ui Registry](https://ui.shadcn.com/docs/registry/registry-item-json)
- [shadcn/ui in 2026 — Dev.to](https://dev.to/whoffagents/shadcn-ui-in-2026-the-component-library-that-changed-how-we-build-uis-296o)
- [Personalization in UX Using AI — 2026 Guide](https://www.parallelhq.com/blog/personalization-in-ux-using-ai)
- [SaaS Dashboard UX Patterns 2026 — GitNexa](https://www.gitnexa.com/blogs/saas-dashboard-ux-patterns)
- [Voice UI Design Guide 2026 — Fuselab](https://fuselabcreative.com/voice-user-interface-design-guide-2026/)
- [Multimodal UX context switching — LogRocket](https://blog.logrocket.com/ux-design/multimodal-ux-context-switching)
- [Information Architecture for 2026 — Slickplan](https://slickplan.com/blog/information-architecture-trends)
- [Best Property Management Software 2026 — AppFolio](https://www.appfolio.com/blog/best-property-management-softwares-compared-2026)
- [DoorLoop — Best Property Management Apps 2026](https://www.doorloop.com/blog/best-property-management-apps)
- [Intent-Based UI — UX Tigers Design Bootcamp Medium](https://medium.com/design-bootcamp/generative-ui-smart-intent-based-and-ai-driven-a45c0ee18f94)
- [Generative UI smart, intent-based, AI-driven](https://medium.com/design-bootcamp/generative-ui-smart-intent-based-and-ai-driven-a45c0ee18f94)
- [GenUI Frameworks 2026 Complete Guide — Akshay Chame](https://medium.com/@akshaychame2/the-complete-guide-to-generative-ui-frameworks-in-2026-fde71c4fa8cc)
- [Customizable Dashboard Widgets using React Grid Layout — AntStack](https://medium.com/@antstack/building-customizable-dashboard-widgets-using-react-grid-layout-234f7857c124)
- [How to Customize Dashboard in Linear — Storylane](https://www.storylane.io/tutorials/how-to-customize-your-dashboard-in-linear)
