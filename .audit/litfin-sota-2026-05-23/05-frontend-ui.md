# LITFIN — Frontend / UI / UX / GenUI / Mobile SOTA Gap Audit (2026-05-23)

**Auditor focus**: frontend, UI, UX, GenUI, design system, mobile, multi-modal
**Subject root**: `/Users/georgesmackbookair/Desktop/CLAUDE_CURSOR_CODEX PROJECTS/Claude Projects/LITFIN PROJECT/`
**Reference root (port target)**: `/Users/georgesmackbookair/Desktop/CLAUDE_CURSOR_CODEX PROJECTS/Cursor Projects/BOSSNYUMBA101/`
**SOTA baseline**: 2026-Q2 frontier (Next 15.5 + React 19, Vercel AI SDK v5 GenUI, Tailwind v4, Motion, View Transitions, PPR, Speculation Rules, RN 0.76 New Arch / Expo Router v4)

---

## 0. TL;DR

LITFIN ships a remarkably **mature in-house Generative-UI substrate** — 47 typed `UIBlockType` primitives, a 1,504-line `ChatPanel`, an SSE protocol that embeds `<generative-ui>…</generative-ui>` tags into the assistant token stream, a server-driven mode router (`guide/learn/extract/risk/draft/mentor/explore`), a chat ↔ smartboard correlation layer, full multi-modal voice (ElevenLabs Scribe + OpenAI Whisper STT, ElevenLabs + Cartesia TTS, Picovoice Porcupine wake-word, Hume affect, MediaPipe + TensorFlow.js face mesh), and a Flutter+Riverpod+Melos mobile workspace.

At the same time the platform is **two minor versions away from the 2026 frontier on every major axis**: Next 16.2 with no PPR / Speculation Rules / View Transitions, React 19 with no Server Actions for streaming, **Tailwind v3** (not v4 CSS-first OKLCH), **Framer Motion 12** (not the renamed `motion` SDK), **no Vercel AI SDK** anywhere (chat is a hand-rolled `useLitFinChat` with custom SSE), **two parallel design-token systems** (HSL CSS variables in `globals.css` versus indigo Tailwind palette in `packages/ui/src/tokens.ts`), and a mobile stack that is **Flutter not React Native** — so nothing in the web GenUI stack is portable to the device.

For BOSSNYUMBA the highest-leverage ports are: (1) the **47-block `UIBlockType` taxonomy** (LITFIN has property-irrelevant blocks but the schema/runtime/validation/dynamic-import wiring is industrial), (2) the **`<generative-ui>` SSE tag protocol** (BOSS already has `chat-ui` consuming a hand-rolled `useChatStream` — adopt the tag protocol for free GenUI without an SDK rewrite), (3) the **smartboard ↔ chat bidirectional correlation** (BOSS `chat-ui` has `Blackboard` but no `useSmartboardBridge`), (4) the **IGNITION OKLCH-noted copper design token system** (BOSS has dual systems too, but no documented brand calibration), and (5) the **per-portal chat-bundle splits in `next.config.js`** (LITFIN has explicit cacheGroups for smartboard/voice/tensorflow that BOSS lacks).

---

## 1. Inventory

### 1.1 Web frontend stack (LITFIN)

| Concern | Library | Version | SOTA 2026 | Gap |
|---|---|---|---|---|
| Framework | `next` | **16.2.4** | 15.5 (latest stable, 16 is canary at the time the SOTA list was sealed) | **Ahead of SOTA on framework, behind on features** — see PPR/View-Transitions below |
| React | `react` / `react-dom` | **19.2.4** | 19.x | At SOTA |
| TypeScript | `typescript` | 5.3.0 | 5.7+ | One minor behind |
| Bundler | Turbopack (Next 16 default) | n/a | Turbopack | At SOTA |
| Tailwind | `tailwindcss` | **3.4.0** | **4.x (CSS-first config, OKLCH native, container queries, 3D transforms)** | **Two-minor SOTA gap** |
| shadcn config | `components.json` `style: default`, `rsc: true`, `baseColor: slate` | shadcn v1 schema | **shadcn v3 (Radix Themes)** | One major behind |
| Radix | 5 individual `@radix-ui/react-*` packages | 1.1-2.1 | Same packages, `@radix-ui/themes` v3 unused | Missing Radix Themes |
| Icons | `lucide-react` | 0.562.0 | 0.500+ | Latest |
| Animation | `framer-motion` | **12.29.0** | **`motion` (renamed package, same author, declarative spring physics)** | Behind: package renamed Q3 2025 — `framer-motion` is the legacy import |
| AI streaming | **None — hand-rolled** `ReadableStream` + custom SSE | n/a | **Vercel AI SDK v5 (`useChat`, `useObject`, `generateObject` + tools)** | **Major SOTA gap** |
| Data fetching | `swr` 2.4.0 + custom hooks | n/a | TanStack Query 5 + RSC `use()` | TanStack Query absent on web (used in mobile Riverpod equivalent only) |
| Forms | (no `react-hook-form`, no `react-form`) | n/a | `react-hook-form` 7.5 + Zod + React 19 `<Form>` Action | No form library — uses raw `useState` + Zod parse |
| State | `useState` + `useReducer` + `sessionStorage` | n/a | Zustand 5 / Jotai / Zedux / RSC | Manual; no central store |
| Charts | `recharts` 2.15, `react-vega` 8, `vega-lite` 6 | 2.15 / 8 / 6 | `shadcn-charts`, Tremor, Visx | Recharts ok; missing shadcn-charts (Tailwind-native) |
| Markdown | `react-markdown` 10 + `remark-gfm` 4 | latest | latest | At SOTA |
| HTML sanitiser | `dompurify` 3.3.4 | latest | latest | At SOTA |
| Drag-drop | `@dnd-kit/*` 6.3 / 10 / 3 | latest | latest | At SOTA |
| Virtualisation | `@tanstack/react-virtual` 3.13 | latest | latest | At SOTA |
| Tables | `@tanstack/react-table` 8.20 | latest | latest | At SOTA |
| Maps | `leaflet` 1.9 + `react-leaflet` 5 | latest | Mapbox GL v3 / MapLibre | Adequate; not at SOTA tile style |
| Particles | `@tsparticles/{engine,react,slim}` 3.9 | latest | latest | At SOTA (BOSS lacks) |
| Force graph | `react-force-graph-2d` 1.29 | latest | latest | At SOTA |
| Fonts | Inter + Syne via `next/font/google` | n/a | `next/font` + variable fonts | At SOTA |
| Calendar | `@fullcalendar/*` 6.1 | latest | latest | At SOTA |
| Stripe Elements | `stripe` 20.3 (server-only) | n/a | `@stripe/react-stripe-js` v3 | No client Stripe Elements; payments are redirect-based |

**LITFIN package count** (root `package.json`): 84 dependencies, 35 devDependencies. **Node 20.x pinned**, npm 10.9.2 (not pnpm — LITFIN diverges from BOSS which is pnpm workspace).

### 1.2 Multi-modal stack (LITFIN web)

| Modality | Provider | File | Notes |
|---|---|---|---|
| STT — premium | ElevenLabs Scribe `scribe_v2` | `src/core/voice/transcription-service.ts:86,176` | Auto-selected if `ELEVENLABS_API_KEY` set |
| STT — fallback | OpenAI Whisper `whisper-1` | `src/core/voice/transcription-service.ts:84,179` | Auto-selected if `OPENAI_API_KEY` set |
| STT — local | `local-whisper` | `src/core/voice/transcription-service.ts:87` | On-device path stub |
| TTS — primary | ElevenLabs (multi-voice catalog) | `src/core/voice/tts-service.ts:84` |  |
| TTS — fallback | Cartesia `el-multilingual-male` | `src/core/voice/tts-service.ts:94`, `src/core/voice/tts-providers/cartesia-adapter.ts` | Multi-provider failover |
| Wake-word | Picovoice Porcupine | `@picovoice/porcupine-web@4.0.0`, `@picovoice/web-voice-processor@4.0.10` | On-device |
| LiveKit | `livekit-client` 2.18 | `package.json:121` | Realtime audio rooms |
| Twilio voice | `twilio` 5.12 (server) | `package.json:144` | PSTN out |
| Vision — face mesh | MediaPipe Face Mesh + TF.js face-landmarks-detection | `@mediapipe/face_mesh@0.4.1633559619`, `@tensorflow/tfjs@4.22` | Aliased to stub at build time (Turbopack ESM issue) — see `next.config.js:111` |
| Affect — hume | `src/core/voice/providers/hume-emotion-provider.ts` | Local-acoustic also present | Affect prosody folded into chat |
| OCR | `tesseract.js` 7 (server external) | `next.config.js:135` | Document pipeline |
| File I/O | `pdf-parse` 2.4, `pdf-lib` 1.17, `pdf-lib` (overrides), `mammoth` 1.11, `exceljs` 4.4, `docx` 9.5, `papaparse` 5.5 | server-external | Extensive |
| Realtime data | `kafkajs` 2.2 (server), Supabase Realtime via `@supabase/ssr` | server | Two channels |
| Emotion stream | `use-chat-affect.ts` | `src/core/voice/affect-prosody/use-chat-affect.ts` | Prosody → chat |

### 1.3 Mobile stack (LITFIN — Flutter)

| Concern | Library | Version | SOTA 2026 (React-Native frontier) | Gap |
|---|---|---|---|---|
| Workspace | Melos | latest | Nx / Turborepo + RN | Cross-platform paradigm mismatch |
| Workspace file | `litfin_mobile/melos.yaml` | — | — | — |
| Apps | `apps/borrower_app/pubspec.yaml`, `apps/officer_app/` | Flutter ≥3.24 / Dart ≥3.5 | Expo SDK 53 + RN 0.76 + Hermes + New Arch | **Entire stack is Flutter, not React Native** |
| Navigation | `go_router` 14.6 | latest | Expo Router v4 | Equivalent |
| State | `flutter_riverpod` 2.6 + `riverpod_annotation` | latest | Zustand 5 / Zedux / Jotai | Equivalent semantics |
| Animation | `lottie` 3.2 | latest | Reanimated 4 + Skia v2 | Lottie ≪ Skia |
| Audio record | `record` 5.1 | latest | `expo-av` | Equivalent |
| Audio playback | `just_audio` 0.9 | latest | `expo-av` | Equivalent |
| Push | `firebase_messaging` 15.1 + `firebase_core` 3.6 | latest | Expo Notifications / FCM | Equivalent |
| Markdown | `flutter_markdown` 0.7 | latest | `react-native-markdown-display` | Equivalent |
| Shimmer | `shimmer` 3.0 | latest | `react-native-shimmer-placeholder` | Equivalent |
| PDF | `pdfx` 2.8 | latest | `react-native-pdf` | Equivalent |
| Camera/picker | `image_picker` 1.1, `file_picker` 8.1 | latest | `expo-image-picker`, `expo-document-picker` | Equivalent |
| UI shared | `packages/litfin_ui` (Material Design, Lucide icons via `lucide_icons@0.257`, Google Fonts) | latest | Tamagui / NativeWind / shadcn-rn | Material baseline only |

### 1.4 Design system inventory (LITFIN)

| File | Lines | Role |
|---|---|---|
| `src/app/globals.css` | **2,311** | IGNITION design system: HSL CSS variables for both light/dark + OKLCH **comments only** (not actual OKLCH `color()` values). Custom shadow scale, motion scale (cubic-bezier easings), skip-link, fresh-start bootstrap script wiring. |
| `tailwind.config.ts` | 119 | shadcn-style `hsl(var(--…) / <alpha-value>)` token mapping. Custom `transitionTimingFunction` (`material-standard`, `spring-out`, `smooth-out`). Custom `keyframes`/`animation` (`float-gentle`, `gradient-x`, accordion). |
| `packages/ui/src/tokens.ts` | **406** | **Parallel token system** — hand-coded TypeScript `colors`/`typography`/`spacing` constants with **`primary: indigo` (not copper)**. Used by `app-shell`, `data-table`, `stat-card`, `paywall-modal`, etc. — i.e. the cross-portal shared UI kit. |
| `src/components/chat-ui/index.tsx` | ~700 | Chat shell primitives: `CHAT_HEADER_GRADIENT`, `CHAT_USER_BUBBLE`, `CHAT_AI_BUBBLE` baked-in copper gradients via Tailwind arbitrary `bg-[linear-gradient(...)]` strings. Source of truth claim: "If you change the look here, ChatPanel must follow." |
| `packages/litfin_ui` (Flutter) | n/a | Lucide icons, Google Fonts Syne, shimmer, cached_network_image — minimal Material baseline |

### 1.5 Chat / GenUI subsystem files (LITFIN — the crown jewel)

| File | Lines | Role |
|---|---|---|
| `src/core/litfin-ai/components/ChatPanel.tsx` | **1,504** | The widget shell. Voice (CompactWaveform component, mic button, audio level), language toggle EN/SW, persona dispatch, classroom adapter, quiz lockdown overlay, teaching mode layout, discussion mode, blackboard panel, review mode summary. Calls `useLitFinChat` + `useLitFinVoice` + `useVoiceConversation`. |
| `src/core/litfin-ai/components/MessageBubble.tsx` | 454 | Per-message renderer. `AdaptiveRenderer` lazy-loaded, ModeIndicator lazy-loaded, mode badge, `isActiveOnBoard` ring for chat↔smartboard correlation, safe-href markdown components. |
| `src/core/litfin-ai/components/LitFinWidget.tsx` | 442 | Platform-wide floating widget shell |
| `src/core/litfin-ai/components/VoiceConversationOverlay.tsx` | 222 | Full-screen voice modal |
| `src/core/litfin-ai/generative-ui/types.ts` | ~400 | **47 `UIBlockType` types** + 6 `AIMode` types + ModeContext + AdaptiveMessageMetadata |
| `src/core/litfin-ai/generative-ui/AdaptiveRenderer.tsx` | ~600 | Block dispatcher — switch over 47 types, ~25 statically imported, ~22 `nextDynamic`-imported to keep route bundles small |
| `src/core/litfin-ai/generative-ui/blocks/` | 47 files | One file per block type (Quiz, ReadinessRadar, FiveCsChart, BusinessCanvas, FinancialCalculator, RiskHeatmap, AuditTrail, Flashcard, ScenarioDecision, ProgressMilestone, DynamicVisual, ARExperience, XPReward, Achievement, Streak, Leaderboard, PeerDebate, MicroLesson, RankProgress, SystemMetric, SovereignActionCard, LiveQueryResult, BrainLens, DecisionSimulation, DynamicColumns, …) |
| `src/core/litfin-ai/generative-ui/block-generator.ts` | ~n | Server-side block factory (one canonical block from a fact) |
| `src/core/litfin-ai/generative-ui/block-variety-tracker.ts` | ~n | Anti-repeat: tracks recent block types so the AI mode router doesn't spam the same widget |
| `src/core/litfin-ai/generative-ui/teaching-methodology-layer.ts` | ~n | Pedagogy heuristics: which blocks to emit at which Bloom level |
| `src/core/litfin-ai/generative-ui/text-cleanup.ts` | ~n | Strips `<generative-ui>` payload markers from streamed prose |
| `src/core/litfin-ai/hooks/useLitFinChat.ts` | 1,000+ (export at L291) | The chat ViewModel. Session restore from sessionStorage, dynamic greeting injection (calls API for AI-generated welcome), abort controllers (one for greeting, one for in-flight, one for mutex), ChatMode state machine (conversation/teaching/quiz/review/discussion/classroom), persona ID, suggested actions, language. |
| `src/core/litfin-ai/hooks/useLitFinVoice.ts` | — | Voice mode toggle |
| `src/core/litfin-ai/hooks/useVoiceConversation.ts` | — | Full conversation overlay state |
| `src/core/litfin-ai/hooks/useChatSounds.ts` | — | UI sounds (send / receive / error) |
| `src/core/litfin-ai/hooks/useWidgetLanguage.ts` | — | EN/SW language toggle + persistent preference |
| `src/core/litfin-ai/hooks/useSessionEventWiring.ts` | — | Hooks events into chat |
| `src/hooks/useChatSurface.ts` | 73 | Surface tracker: `"main"` (extracts → application data) vs `"theater"` (teaching-only, never bleeds into stepper). Module-level ref + `CustomEvent` for synchronous read. |
| `src/core/brain/stream.ts`, `src/core/brain/stream-tool-loop.ts` | — | Server-side Anthropic streaming with tool loop |
| `src/core/brain/generative-ui/stream-protocol.ts` | 80+ | **`<generative-ui>…</generative-ui>` tag protocol** — wrap JSON inside text stream; client parses with `parseGenerativeUiSegments` into `kind: "text" \| "spec"` segments. Backward-compatible with plain-text clients. |
| `src/app/api/brain/operator-agent/route.ts` | 410+ | Brain-OS chat endpoint. `ReadableStream` SSE, encoder, registered with shutdown registry, AbortController threaded to Anthropic SDK so cancellation kills token consumption. Emits `ready`/`block`/`error` events. Persists `operator_chat_turns` on `done`. |
| `src/app/api/brain/nudges/stream/route.ts`, `src/app/api/brain/inbox/stream/route.ts` | — | Two more SSE streams |
| `src/core/voice/streaming/use-streaming-voice.ts` | 81 | Voice pipeline hook (start/stop/interrupt, TTFB telemetry) |
| `src/core/voice/streaming/streaming-tts.ts`, `streaming-stt.ts` | — | Streaming primitives |
| `src/core/smartboard/BlackboardScene.tsx`, `BlackboardSceneListener.tsx`, `BlackboardScenePortal.tsx` | — | Smartboard (right side of chat) |
| `src/core/smartboard/artifact-renderer.tsx`, `artifact-history-store.ts`, `artifact-replay.ts`, `artifact-narrator.ts`, `accessibility-narrator.ts`, `ai-scene-generator.ts`, `ai-2d-artifact-generator.ts`, `artifact-diff-streamer.ts`, `artifact-telemetry.ts` | — | The smartboard "OS" — accessibility narrator, replay, telemetry, scene generator, diff streamer |
| `src/components/chat-ui/index.tsx` | 700 | Cross-surface chat primitives (`ChatShellHeader`, gloss sweep, bubble token exports) |
| `src/components/spotlight/SpotlightOverlay.tsx`, `SpotlightProvider.tsx`, `SpotlightInfoPanel.tsx`, `FirstTimeTourTrigger.tsx` | — | Tour / spotlight (CSS clip-path cutout, evenodd polygon, keyboard nav) |
| `src/components/generative/` | 6 files | `GenerativeUISection`, `BorrowerDashboardInsights`, `LearningInsights`, `AdminDashboardInsights`, `OfficerDashboardInsights` — drop-in dashboard generative blocks |
| `src/components/voice/VoiceNoteButton.tsx`, `VoiceRecorder.tsx` | — | Standalone voice components |
| `src/components/home/` | 9 files | Marketing home — `BentoGrid`, `HeroDemoPreview`, `MeshGradient`, `NeonGlow`, `ScrollAnimation`, `InteractiveBackground`, `BankLogo` |
| `src/components/home/sections/` | 7 files | Marketing sections — `AIOfficerTabsSection`, `EcosystemSection`, `InsightsAndScaleSection`, `InteractiveModesSection`, `PlatformShowcaseSection`, `RoadmapCTASection`, `UniversalAccessSection` |
| `src/components/transitions/PageTransition.tsx` | — | Page transition (Framer Motion, not View Transitions API) |
| `src/components/skeletons/GenericSkeleton.tsx` | — | Skeleton |
| `src/components/brand/LitfinLogo.tsx`, `BankLogos.tsx` | — | Brand marks (`LitfinMark`, `LitfinIcon`) |
| `src/components/presence/PlatformAliveBanner.tsx`, `ProactiveBubble.tsx`, `WelcomeBackStrip.tsx`, `usePresenceClient.ts` | — | "Platform alive" presence feel |

### 1.6 Layout / app shell (LITFIN)

* **Root layout**: `src/app/layout.tsx` — Inter + Syne fonts via `next/font/google`, theme bootstrap inline script (FOUC prevention, reads `localStorage('litfin-theme')`), **fresh-start bootstrap** (versioned localStorage wipe + IndexedDB delete + service worker unregister + Cache API purge — gated by `FRESH_START_VERSION = '2026-04-30-1'`), skip-link, ThemeProvider → CountryProvider → LanguageProvider → ToastProvider → ErrorBoundaryIntelligent.
* **Portals (4)**: `(admin)`, `(borrower)`, `(litfin-admin)`, `(officer)`, `(marketing)` route groups under `src/app/`.
* **Globals.css length**: 2,311 lines — massive design-system surface.
* **Manifest**: `/manifest.json` (PWA), `apple-icon.tsx`, `opengraph-image.tsx`, `twitter-image.tsx` (dynamic OG via Next ImageResponse).

### 1.7 Storybook & testing

* `.storybook/main.ts` — `@storybook/nextjs` 8.6, `@storybook/addon-a11y`, `@storybook/addon-themes`, scans `packages/ui/src/components/**/*.stories.@(js|jsx|ts|tsx)`, `src/components/**/*.stories.*`, `src/features/**/*.stories.*`.
* Storybook **8.6.15** — SOTA is 8.4+ (so at/ahead).
* `playwright.config.ts` — Playwright 1.58, 6 projects (auth-setup, borrower, officer, compliance, journeys, smoke), Chrome only, `storageState` per role, retries 2 on CI, 60s timeout, html+list reporter.

---

## 2. Subsystem cards

### 2.1 Chat panel & multi-mode shell

* **Files**: `src/core/litfin-ai/components/ChatPanel.tsx:1504`, `MessageBubble.tsx:454`, `LitFinWidget.tsx:442`, `VoiceConversationOverlay.tsx:222`, `src/components/chat-ui/index.tsx`, `src/core/litfin-ai/hooks/useLitFinChat.ts:291+`.
* **Streaming pattern**: hand-rolled. Server: `new ReadableStream({ start(controller) { for await (const chunk of thinkStreamWithToolLoop(…)) { enqueue(event, data) } } })` → SSE `text/event-stream` (`src/app/api/brain/operator-agent/route.ts:296,412`). Client: `fetch` + `.body.getReader()`, parses `<generative-ui>` tags inline.
* **Mode router**: 6 AI modes (`guide/learn/extract/risk/draft/mentor/explore`) detected server-side from `ModeContext` (route, last message, session history, portal, stepper step, voice active, doc upload).
* **Chat mode state machine**: `ChatModeState` with `mode: conversation/teaching/quiz/review/discussion/classroom`. Quiz lockdown disables input. Persisted in sessionStorage for refresh resilience.
* **Surface tracking**: `useChatSurface` (`src/hooks/useChatSurface.ts:73`) — `"main"` mutates application data, `"theater"` is sandboxed teaching. Stack-aware: nested mounts unwind correctly.
* **Persona dispatch**: messages get `personaId` so multiple AI personas can share the bubble.
* **Sounds**: `useChatSounds.ts` — send/receive/error UI sounds.
* **Language**: `useWidgetLanguage` toggles EN/SW with `WIDGET_TEXT` lookup, persisted preference. **Bilingual built in everywhere** (most blocks have `titleSw`, `messageSw` shadow props).
* **SOTA gap**: **No Vercel AI SDK** — every other 2026 chat surface (V0, Tambo, AnthropicDocs, Linear Asks, Vercel Storefront chat) is on `@ai-sdk/react` `useChat` with `streamObject`. The hand-rolled SSE is functional but reinvents tool-call streaming, message parts, attachment handling, etc. **No React 19 Server Functions** for the chat submit — it's `fetch('/api/brain/operator-agent', { method: 'POST' })`.

### 2.2 Generative-UI engine (the standout subsystem)

* **47 typed block types** in `src/core/litfin-ai/generative-ui/types.ts:46-94`:
  * Learning: `quiz`, `concept_card`, `flashcard`, `micro_lesson`, `mastery_badge`, `rank_progress`, `streak_display`, `xp_reward`, `achievement_unlock`, `challenge_card`, `leaderboard`, `peer_debate`, `progress_milestone`.
  * Decision: `scenario_decision`, `sim_decision`, `decision_simulation`, `think_about_it`, `risk_heatmap`, `five_cs_chart`, `readiness_radar`, `coaching_score`, `kpi_card`, `audit_trail`, `case_summary`.
  * UX scaffolding: `quick_replies`, `action_buttons`, `step_progress`, `comparison_table`, `extraction_table`, `checklist`, `timeline`, `proactive_nudge`, `insight_card`, `celebration`, `voice_feedback`.
  * Authoring: `business_canvas`, `financial_calculator`, `progress_chart`, `dynamic_visual`, `interactive_artifact`, `ar_experience`.
  * Brain-OS: `system_metric`, `sovereign_action_card`, `live_query_result`, `brain_lens`.
  * Dynamic-UI: `dynamic_columns`.
* **`AdaptiveRenderer.tsx`** dispatches via switch; heavy blocks (financial calculator, AR, dynamic visual, all Brain-OS blocks, dynamic columns) are `nextDynamic`-imported — keeps borrower bundle thin. Static imports only for the ~25 always-on blocks.
* **Stream protocol** (`src/core/brain/generative-ui/stream-protocol.ts`): server wraps JSON in `<generative-ui>{...}</generative-ui>` and emits inline with prose. `parseGenerativeUiSegments(text)` splits into alternating `text`/`spec` segments; invalid JSON returned with `rawInvalid` (never silently dropped). **Backward compatible** — any client that doesn't parse them just sees raw JSON inline.
* **Server-side**: `block-generator.ts` factories, `block-variety-tracker.ts` anti-repeat, `teaching-methodology-layer.ts` Bloom-level pedagogy heuristics, `text-cleanup.ts` strips markers from streamed prose.
* **Validation**: every block goes through Zod-validated `parseGenerativeUiSpec` in the wrap call — malformed blocks can never reach the renderer.
* **Per-message metadata**: `AdaptiveMessageMetadata` on `ChatMessage` carries blocks + `aiMode`. `extractUIBlocks(message)` + `extractAIMode(message)` consumed by MessageBubble.
* **Anti-pattern**: the `interactive_artifact` block routes through `SmartboardArtifactRenderer` (smartboard) — coupling chat to smartboard via a UIBlockType.
* **SOTA gap**: this is **more sophisticated than what Vercel AI SDK v5 ships out-of-the-box** (V0 streams `ReactNode` chunks; LITFIN streams typed schemas and renders them client-side — closer to AG-UI / Tambo). The gap is that there is no `useObject`-style structured-streaming hook for partial-block updates (today blocks arrive whole, not as a JSON-stream of fields).

### 2.3 Voice / multi-modal

* **STT**: `transcription-service.ts:84-200` — ElevenLabs Scribe `scribe_v2` (preferred), OpenAI Whisper `whisper-1` fallback, local-whisper stub. Auto-select by env. Provider returned in `result.provider`.
* **TTS**: `tts-service.ts:30,84,94` — ElevenLabs (multi-voice catalog) + Cartesia (multilingual male) + `auto-failover.ts` between providers.
* **Voice config**: `@/config/elevenlabs-voices` — `getVoiceForContext`, `VOICE_SETTINGS` per persona.
* **Pipeline**: `src/core/voice/streaming/use-streaming-voice.ts:37-81` — feature-flag gated (`litfin_streaming_voice`), creates `VoicePipelineHandle` with `start`/`stop`/`interrupt`, exposes `state`, `ttfbMs`. Falls back to existing path when disabled (never to browser speechSynthesis).
* **Wake-word**: Picovoice Porcupine (`@picovoice/porcupine-web@4.0.0` + `web-voice-processor@4.0.10`) — on-device wake-word for "hey LitFin" or equivalent.
* **VAD**: `src/core/voice/vad/` — local VAD.
* **Affect/prosody**: `src/core/voice/affect-prosody/use-chat-affect.ts` — emotion stream folded into chat metadata.
* **Voiceprint**: `src/core/voice/voiceprint-extractor.ts` — speaker identification.
* **On-device**: `src/core/voice/on-device/` — local models.
* **Adversarial**: `adversarial-voice-classifier.ts` — voice-clone detection.
* **Compliance**: `src/core/voice/compliance/` — consent gates.
* **CompactWaveform** (`ChatPanel.tsx:90-130`): per-bar `motion.div` driven by `audioLevel`, 28 bars by default, centre-weighted envelope, baseline pulse during silence. Framer Motion handles interpolation.
* **VoiceConversationOverlay**: full-screen mic mode with transcript entries.
* **Camera/vision**: MediaPipe Face Mesh + TF.js face-landmarks-detection — used by `useEmotionDetector` (lazy `await import('@mediapipe/face_mesh')`). Turbopack alias to a stub at `src/lib/stubs/mediapipe-face-mesh-stub.js` because Turbopack's static analyzer rejects MediaPipe's runtime-globals bundle (`next.config.js:111`).
* **LiveKit**: `livekit-client@2.18.9` — realtime audio rooms (likely classroom).
* **Twilio**: `twilio@5.12` (server) — PSTN out.
* **SOTA gap**: voice is **at SOTA on providers** (Scribe + Cartesia + Picovoice + Hume is exactly the 2026 frontier roster). Missing: **OpenAI Realtime / Anthropic Voice** (not yet GA at audit date but worth a flag), **ElevenLabs Conversational AI** (referenced but no `useElevenLabsAgent` hook visible).

### 2.4 Smartboard (chat ↔ artifact bridge)

* **Files**: `src/core/smartboard/BlackboardScene.tsx`, `BlackboardSceneListener.tsx`, `BlackboardScenePortal.tsx`, `SovereignPlanCard.tsx`, `artifact-renderer.tsx`, `artifact-history-store.ts`, `artifact-replay.ts`, `artifact-narrator.ts`, `artifact-policy-gate.ts`, `artifact-prompt-context.ts`, `artifact-diff-streamer.ts`, `artifact-telemetry.ts`, `artifact-telemetry-bridge.ts`, `blackboard-history.ts`, `blackboard-reader.ts`, `blackboard-repository.ts`, `accessibility-narrator.ts`, `ai-scene-generator.ts`, `ai-2d-artifact-generator.ts`.
* **Pattern**: AI emits an `interactive_artifact` block, AdaptiveRenderer routes to `SmartboardArtifactRenderer`, which projects to the right panel and records in artifact-history. Bidirectional: clicking a bubble projects, clicking the artifact scrolls chat back via `data-message-id` (`MessageBubble.tsx` doc comment).
* **Accessibility narrator**: `accessibility-narrator.ts` — narrates artifact state for screen-readers (rare to find).
* **Replay**: `artifact-replay.ts` — time-travel debug.
* **Policy gate**: `artifact-policy-gate.ts` — RBAC before projection.
* **Webpack split**: explicit `smartboard` cacheGroup in `next.config.js:365-372` (`src/core/smartboard/*` → `smartboard` chunk, async, enforced) so the four portals share one module copy.
* **SOTA gap**: ahead of Vercel AI SDK GenUI on this axis — the smartboard is a **stateful, replayable, narrated, policy-gated artifact surface**, which V0/Tambo do not have.

### 2.5 Generative dashboards & insights

* **Files**: `src/components/generative/GenerativeUISection.tsx`, `BorrowerDashboardInsights.tsx`, `LearningInsights.tsx`, `AdminDashboardInsights.tsx`, `OfficerDashboardInsights.tsx`.
* **Pattern**: `GenerativeUISection` props `type: insight/nudge/celebration/streak/recommendation` + `priority: low/medium/high`, bilingual (`titleSw`/`messageSw`), Tailwind gradient + Lucide icon per type. Drop-in for any dashboard.
* **SOTA gap**: shape is fine but **no streaming** — these blocks are server-rendered or props-driven, not LLM-streamed. (The chat blocks are the streamed path; dashboards are static-prop blocks.)

### 2.6 Spotlight / tour / command palette

* **Files**: `src/components/spotlight/SpotlightOverlay.tsx`, `SpotlightProvider.tsx`, `SpotlightInfoPanel.tsx`, `FirstTimeTourTrigger.tsx`.
* **Pattern**: full-screen dark overlay + CSS `clip-path: polygon(evenodd, …)` cutout that reveals the spotlighted DOM element. Comma-separated fallback selectors. Keyboard nav (Escape, Arrow keys), click-outside dismiss, step counter ("2 of 5"), responsive positioning.
* **First-time tour**: `FirstTimeTourTrigger` shows the tour the first time a user lands; preference stored under `litfin-tour-completed:*` (preserved across fresh-start wipes — see `layout.tsx:207`).
* **SOTA gap**: solid implementation. **No command-palette / cmdk fuzzy search** — Spotlight is tour-only, not action-launcher. BOSS has `@bossnyumba/spotlight` with `action-catalog.ts` + `entity-resolver.ts` + `spotlight-engine.ts` (a full command palette).

### 2.7 Animation / transitions

* **Library**: `framer-motion@12.29.0` (the legacy import path — the package was renamed to `motion` in Q3 2025; new projects use `motion` and import from `motion/react`).
* **`barrel-optimized`** in `next.config.js:163` so unused exports are tree-shaken.
* **Custom easings**: `tailwind.config.ts:77` defines `material-standard`, `spring-out`, `smooth-out` cubic-beziers so arbitrary `ease-[cubic-bezier(…)]` strings don't trigger class-ambiguity warnings.
* **Custom keyframes**: `accordion-down/up`, `float-gentle`, `gradient-x`.
* **Animations dedicated chunk**: `framer-motion` gets its own webpack `animations` cacheGroup (`next.config.js:354-359`).
* **No View Transitions API** anywhere (`grep View.Transitions \| viewTransition \| startViewTransition`: zero hits).
* **No GSAP** — Framer Motion handles all animation.
* **PageTransition**: `src/components/transitions/PageTransition.tsx` — framer-motion based, not native View Transitions.
* **SOTA gap**: View Transitions API is the 2026 default for cross-route morphing (shadcn v3 uses it; Vercel v0 uses it). **Framer Motion 12 → motion** rename is cosmetic but new docs/examples all assume `motion`. **Reduced motion**: `useReducedMotion()` is used inside `ChatShellHeader` — good practice present but not enforced repo-wide.

### 2.8 Real-time / collab

* **LiveKit**: `livekit-client@2.18.9` for audio rooms.
* **Supabase Realtime**: via `@supabase/ssr@0.8.0` + `@supabase/supabase-js@2.39`.
* **Kafka**: `kafkajs@2.2.4` server-side.
* **Twilio**: `twilio@5.12.0` server-side.
* **WebRTC**: via LiveKit.
* **No Liveblocks**, no Yjs, no automerge — **no collaborative editing primitives**. (BOSS uses Liveblocks + Yjs heavily.)
* **Presence**: custom in `src/components/presence/usePresenceClient.ts`, `PlatformAliveBanner.tsx`, `ProactiveBubble.tsx`, `WelcomeBackStrip.tsx`.

### 2.9 Theming, brand, white-label

* **Theme tokens**: HSL CSS variables in `src/app/globals.css:19-130`. Comments note the OKLCH-equivalent (`oklch(0.60 0.14 45)`) but the actual variable values are HSL — Tailwind v3 requires HSL for `hsl(var(--…) / <alpha-value>)`. Tailwind v4 would let these be OKLCH natively.
* **Brand**: IGNITION palette — copper (`hsl(24 58% 48%)` light, `hsl(24 68% 58%)` dark). Single hero color, comparison Stripe/Netflix/Spotify documented in the CSS comments.
* **ThemeProvider**: `src/components/providers/ThemeProvider.tsx` (referenced from layout) — `defaultTheme="system"`, `enableSystem`.
* **Theme bootstrap inline script** in `layout.tsx:167-182` — reads `localStorage('litfin-theme')`, sets class + `data-theme` + `colorScheme` before hydration to kill FOUC.
* **Country/Language providers**: `CountryProvider` (jurisdictional defaults), `LanguageProvider` (EN/SW) — both wrap the entire tree.
* **No white-label / brand customization layer** — there's a `scripts/check-brands.mjs` script but no per-tenant brand swap mechanism. (LITFIN is single-brand; BOSS will need multi-tenant brand → opportunity to invent.)

### 2.10 Mobile (Flutter — fundamentally different paradigm)

* **Workspace**: Melos (Dart equivalent of Nx/Turborepo).
* **Apps**: `litfin_mobile/apps/borrower_app/`, `litfin_mobile/apps/officer_app/`.
* **Shared packages**: `litfin_mobile/packages/litfin_core/`, `litfin_mobile/packages/litfin_ui/`.
* **State**: Riverpod 2.6 + riverpod_annotation + riverpod_generator (codegen).
* **Navigation**: go_router 14.6.
* **AI integration**: none visible in mobile workspace — likely calls the same `api/brain/operator-agent` SSE endpoint via Dart `http` + sse stream parser.
* **No code sharing with web** — different language (Dart vs TypeScript), different runtime (Dart VM / Skia vs JS / DOM), different UI primitives (Material/Cupertino vs shadcn/Radix).
* **SOTA gap**: a 2026 frontier mobile would be **React Native 0.76 + New Arch + Expo SDK 53 + Reanimated 4 + Skia v2 + Tamagui** sharing components with web via NativeWind or Tamagui. Flutter is excellent in isolation but **incompatible with the web GenUI investment**. To port the 47 UIBlockType primitives to mobile, every block needs a Flutter rewrite.

### 2.11 Performance / bundling

* **Standalone output**: `next.config.js:90` — `.next/standalone/server.js` self-contained build for Cloud Run / Fly.io / Docker (Vercel ignores it; failover targets consume it).
* **Image opts**: AVIF + WebP, 30-day cache TTL, 8 device sizes, 8 image sizes (`next.config.js:219-224`).
* **CSP / security headers**: HSTS 2y preload, frame-ancestors none, COOP same-origin, Permissions-Policy per-API (camera/microphone/geolocation/payment scoped to `self`, fullscreen `self`, accelerometer/gyroscope/magnetometer empty). CSP with `unsafe-inline`/`unsafe-eval` (documented as pending nonce migration when Next 17 nonce support lands).
* **Webpack split chunks** (`next.config.js:322-403`):
  * `framework` (react/react-dom/scheduler) — enforce, priority 40.
  * `pdf-libs` (jspdf/pdf-lib/pdf-parse/pdfjs-dist) — async, enforce, 30.
  * `doc-libs` (mammoth/docx/tesseract.js) — async, enforce, 30.
  * `animations` (framer-motion) — all chunks, 20.
  * `smartboard` (`src/core/smartboard/*`) — async, enforce, 25.
  * `graph-libs` (neo4j-driver/react-force-graph-2d/d3-*) — async, enforce, 20.
  * `voice` (`src/core/voice/*`) — async, enforce, 25.
  * `tensorflow` (`@tensorflow/* + @mediapipe/*`) — async, enforce, 35 (max priority to ensure they NEVER land in main bundle — 1.5MB if pulled).
* **Barrel optimisation**: 24 packages in `experimental.optimizePackageImports` (lucide-react, framer-motion, recharts, all Radix primitives, swr, zod, uuid, supabase, date-fns, lodash-es, react-hook-form, tailwind-merge, cva, clsx, react-virtual, remark-gfm, dompurify, tsparticles, react-force-graph-2d).
* **`serverExternalPackages`**: 18 packages forced server-only (MediaPipe, TF, pdf-parse, pdf-lib, mammoth, exceljs, docx, papaparse, tesseract, neo4j, kafkajs, twilio, anthropic SDK, stripe, upstash redis + ratelimit). Bundler hard-fails if a client file imports any of these.
* **Bundle analyzer**: `npm run analyze` (`ANALYZE=true`), `@next/bundle-analyzer@16.1.6`.
* **Compiler**: `compiler.removeConsole` in prod (excludes error/warn) — only outside Turbopack dev (Turbopack doesn't support removeConsole).
* **SOTA gap**:
  * **No Partial Prerendering** (`experimental.ppr` absent).
  * **No Speculation Rules** for instant nav (`<script type="speculationrules">…</script>` absent).
  * **No `"use cache"`** annotations (Next 15+ caching DSL).
  * **No View Transitions** for route changes (would replace the framer-motion `PageTransition`).
  * `removeConsole` only outside Turbopack — Turbopack dev still ships console statements.
  * INP / Core Web Vitals: no on-page Web Vitals reporter visible (`web-vitals` package absent from `package.json`).

### 2.12 Accessibility

* **Skip-link**: `<a href="#main-content" className="skip-link">` first focusable (`layout.tsx:278`). Visually hidden until focused.
* **`suppressHydrationWarning`** on `<html>` and `<body>` — intentional, theme bootstrap mutates classes.
* **`prefers-reduced-motion`**: `useReducedMotion()` used in `ChatShellHeader` — opt-in per component.
* **`@storybook/addon-a11y`** present.
* **`aria-hidden`** on decorative gloss sweep.
* **Accessibility narrator**: `src/core/smartboard/accessibility-narrator.ts` — narrates artifact state for SR.
* **WCAG colour calibration** noted in `globals.css:48-56`: destructive darkened to L 36%, success darkened to L 28% — explicit 4.5:1 ratio annotations.
* **Permissions-Policy header** scopes device APIs to `self` only — defense-in-depth for screen readers / a11y tooling.
* **SOTA gap**: no automated a11y in CI (Playwright is functional only). No `axe-core` integration. No `aria-live` region for the chat stream (screen-reader users miss streamed tokens). Skip-link is one of many WCAG 2.2 bypass requirements; full audit pending.

### 2.13 Forms / validation

* **No `react-hook-form`** (despite being in `optimizePackageImports` as a hint).
* **No React 19 `<Form>` Server Actions** for chat submit.
* **Zod**: `zod@3.22.4` — schemas mostly server-side.
* **Field-level**: ad-hoc `useState` + manual `zod.parse` per form. `field-error.tsx` UI component for inline errors.
* **SOTA gap**: 2026 frontier would be **`react-hook-form` 7.5 + Zod resolver + RSC Form Actions**. LITFIN's pattern is fine for chat-first UX but slow to author multi-field stepper forms.

---

## 3. SOTA gap table

| Concern | LITFIN current | 2026 SOTA | Gap severity |
|---|---|---|---|
| **Tailwind** | v3.4 (HSL CSS vars) | v4 (CSS-first config, OKLCH `color()` natively, container queries, 3D transforms) | **HIGH** — affects entire token system |
| **AI SDK** | None (hand-rolled SSE + custom tag protocol) | Vercel AI SDK v5 (`useChat`, `useObject`, `generateObject`, tool streaming) | **HIGH** — but the in-house substrate is more capable; could *adopt* parts of AI SDK without replacing |
| **Animation lib** | `framer-motion@12.29` (legacy name) | `motion` (renamed package, identical API) | **LOW** — cosmetic rename, drop-in |
| **shadcn** | v1 schema (`components.json`) | v3 (Radix Themes) | **MEDIUM** — would need component rewrite |
| **Mobile** | Flutter + Riverpod + Melos | React Native 0.76 + Expo Router v4 + Reanimated 4 + Skia v2 | **CRITICAL paradigm mismatch** — no code share possible |
| **Generative-UI primitives** | 47 typed UIBlockType + Adaptive renderer + tag protocol | Vercel AI SDK ReactNode streaming + Tambo / V0 components | **AHEAD of SOTA on count and typing**; behind on partial-streaming hook (no `useObject` equivalent) |
| **Streaming protocol** | Custom `<generative-ui>…</generative-ui>` text-tag SSE | AI SDK Data Stream Protocol (`Stream Data parts`) | **Functional parity, less ecosystem support** |
| **View Transitions API** | Absent | Cross-document + same-document VT for instant route morphs | **HIGH** — losing user-perceived perf |
| **Partial Prerendering** | Absent (`experimental.ppr` not set) | PPR for static shells + dynamic islands | **MEDIUM** — Next 15+ feature |
| **Speculation Rules** | Absent | `<script type="speculationrules">{ prerender: […] }</script>` | **MEDIUM** — instant nav |
| **`use cache`** | Absent | React 19 + Next 15 caching DSL | **MEDIUM** |
| **RSC Form Actions** | Absent | Native React 19 `<form action={fn}>` | **LOW** — would simplify chat submit |
| **`<form>` library** | None (raw useState + Zod) | `react-hook-form` + Zod resolver | **LOW** — but multi-step forms suffer |
| **Voice — STT** | ElevenLabs Scribe + Whisper + local | Same + OpenAI Realtime | At SOTA; missing Realtime API |
| **Voice — TTS** | ElevenLabs + Cartesia + failover | Same + Deepgram Aura-2 | At SOTA |
| **Voice — wake-word** | Picovoice Porcupine on-device | Same | At SOTA |
| **Voice — affect** | Hume + local acoustic | Same | At SOTA |
| **Voice — voiceprint** | Custom extractor + adversarial classifier | Few off-the-shelf | **AHEAD of SOTA** |
| **Realtime collab** | LiveKit (audio only) | Liveblocks + Yjs + LiveKit for multi-cursor + audio | **MEDIUM** — collab editing absent |
| **Theming — tokens** | HSL CSS vars + parallel `tokens.ts` indigo | OKLCH + single source via Tailwind v4 `@theme` | **HIGH** — two systems disagree |
| **Theming — fluid type** | None (`text-base`/`text-lg` step ladder) | `clamp()` + `--text-fluid-*` tokens (fluid typography) | **LOW** |
| **Container queries** | None (`@container` absent) | Native Tailwind v4 `@container` | **MEDIUM** — responsive composition lost |
| **Web Vitals reporter** | Absent (`web-vitals` not in package.json) | `web-vitals@4` + `next/web-vitals` route handler | **MEDIUM** — no INP/LCP/CLS production telemetry |
| **a11y CI** | `@storybook/addon-a11y` only | `axe-core` in Playwright + CI gate | **MEDIUM** |
| **Storybook** | 8.6.15 | 8.4+ | At/ahead of SOTA |
| **Playwright** | 1.58 | 1.50+ | At SOTA |
| **Cmdk / palette** | Spotlight is tour-only | `cmdk` + action-catalog (BOSS has this!) | **MEDIUM** — LITFIN missing the action launcher |
| **PWA / offline** | Manifest + service-worker (unregistered on fresh-start) | Same + Workbox | At SOTA |
| **OG images** | Dynamic via `opengraph-image.tsx` + `twitter-image.tsx` (Next ImageResponse) | Same | At SOTA |
| **Fonts** | Inter + Syne via next/font, variable + preconnect | Variable fonts + `font-display: swap` | At SOTA |
| **Charts** | recharts + react-vega + vega-lite | shadcn-charts + Tremor + Visx | **LOW** — recharts adequate |
| **Bundling** | Custom webpack cacheGroups for smartboard/voice/tensorflow + `optimizePackageImports` + `serverExternalPackages` | Same + RSC `use cache` | **AHEAD of SOTA on splits, behind on RSC cache** |
| **`removeConsole`** | Prod webpack only (Turbopack dev keeps them) | Build-time strip everywhere | **LOW** — Turbopack catching up |
| **State mgmt** | useState + sessionStorage | Zustand 5 / Jotai / RSC | **LOW** — chat works fine |

---

## 4. Bidirectional porting

### 4.1 LITFIN → BOSSNYUMBA (LITFIN has it, BOSS should adopt)

| What | Why BOSS benefits | Target BOSS path | Effort |
|---|---|---|---|
| **47-block UIBlockType taxonomy + AdaptiveRenderer + Zod validation + nextDynamic lazy splits** | BOSS `packages/genui` has only 10 typed primitives; LITFIN has 47 (incl. quiz, flashcard, leaderboard, peer-debate, achievement, streak, micro-lesson — all directly applicable to BOSS tenant/owner training/onboarding) | `packages/genui/src/components/` add the missing 37; keep existing 10. Maintain `BlockType` registry parity. | M |
| **`<generative-ui>` text-tag SSE protocol** | BOSS `packages/chat-ui` has `useChatStream` + custom SSE — adopting the tag protocol gives BOSS structured-block rendering *without* a Vercel-AI-SDK migration. Backward-compatible with existing plain-text consumers. | `packages/genui/src/format.ts` (already exists — extend with tag wrap/parse fns) + `packages/chat-ui` `parseSseChunk` honour `<generative-ui>` tags | S |
| **Smartboard ↔ chat bidirectional correlation** (`isActiveOnBoard` ring + `data-message-id` scroll-back + `useSmartboardBridge`) | BOSS has `packages/chat-ui/src/blackboard` but no chat-bubble ↔ blackboard sync | `packages/chat-ui/src/hooks/useSmartboardBridge.ts` (new), update `Blackboard.tsx` to publish active artifact id, MessageBubble adds `isActiveOnBoard` prop + ring class | M |
| **Chat-surface tracker** (`useChatSurface` "main" vs "theater") | BOSS has tenant/owner application data that *should not* be mutated by sandbox/learning chats — exact same hazard | `packages/chat-ui/src/hooks/useChatSurface.ts` ported one-to-one (~70 lines) | S |
| **Block-variety tracker + teaching-methodology layer** (anti-repeat + Bloom-level heuristics) | BOSS estate-manager AI should not spam the same KPI card; tenant chat should not always quiz | `packages/ai-copilot/src/conversation-state/block-variety-tracker.ts` + `teaching-methodology-layer.ts` | M |
| **Webpack cacheGroups split** (smartboard/voice/tensorflow async chunks) | BOSS apps have heavy AI/voice surfaces but no explicit splits — would shrink customer-app initial bundle | `apps/customer-app/next.config.js` add cacheGroups paralleling LITFIN's | S |
| **IGNITION single-hero-color tokens + WCAG-calibrated destructive/success** (`destructive: 10 68% 36%`, `success: 150 42% 28%` — explicitly tested for 4.5:1) | BOSS has dual token systems too; LITFIN has documented colour-science calibration that BOSS lacks | `packages/design-system/src/styles/tokens.css` add WCAG calibration comments + adopt single-hero discipline | S |
| **Theme-bootstrap inline script** (FOUC prevention, `localStorage` read + class + colorScheme set before hydration) | BOSS layouts may have theme flash on first paint | `apps/*/src/app/layout.tsx` adopt the script from `LITFIN src/app/layout.tsx:167-182` | XS |
| **Fresh-start bootstrap** (versioned localStorage wipe + IndexedDB delete + SW unregister + Cache API purge with PRESERVE list for theme/lang/country) | BOSS will inevitably ship a backend wipe / breaking change — this script lets browsers self-recover | `apps/*/src/app/layout.tsx` adopt from `LITFIN src/app/layout.tsx:185-272` | S |
| **Voice multi-provider failover** (ElevenLabs ↔ Cartesia) | BOSS may rely on a single TTS — failover is bank-grade resilience | `services/voice-service` (or copilot) `tts-providers/auto-failover.ts` ported from `LITFIN src/core/voice/tts-providers/auto-failover.ts` | M |
| **Picovoice wake-word** | BOSS estate-manager could benefit from "hey BOSS" hands-free | New: `packages/chat-ui/src/voice/wake-word.ts` wrapping `@picovoice/porcupine-web` | M |
| **Accessibility-narrator for artifacts** | BOSS GenUI blocks should be SR-narrated when they render — a true differentiator | `packages/genui/src/lib/accessibility-narrator.ts` ported from `LITFIN src/core/smartboard/accessibility-narrator.ts` | M |
| **CSP / Permissions-Policy / HSTS preload baseline** | LITFIN has bank-grade defaults (HSTS 2y preload, frame-ancestors none, Permissions-Policy scoped) — BOSS should match for trust posture | `apps/*/src/middleware.ts` or `next.config.js headers()` paralleling LITFIN `next.config.js:258-318` | S |

### 4.2 BOSSNYUMBA → LITFIN (BOSS has it, LITFIN should adopt)

| What | Why LITFIN benefits | Target LITFIN path | Effort |
|---|---|---|---|
| **Liveblocks + Yjs multi-cursor presence** | LITFIN classroom chat would benefit from collaborative cursors + multi-user editing of business canvas blocks | `package.json` add `@liveblocks/client`, `@liveblocks/react`, `@liveblocks/yjs`, `yjs`; new `src/core/collab/` | L |
| **`cmdk` action-catalog command palette** | LITFIN Spotlight is tour-only — BOSS's `packages/spotlight/src/spotlight-engine.ts` + `action-catalog.ts` + `entity-resolver.ts` is a full launcher | New `src/core/command-palette/` paralleling BOSS spotlight; LITFIN spotlight rename to `tour` | M |
| **TanStack Query 5 on web** | LITFIN web uses `swr@2.4` + hand-rolled hooks; BOSS customer-app uses `@tanstack/react-query@5.24` which has better suspense + RSC integration | Replace SWR call sites incrementally; keep SWR for legacy | L |
| **`next-intl` 3.26** for i18n | LITFIN has hand-rolled `@litfin/i18n` package + `LanguageProvider` + `useTranslation`; BOSS uses `next-intl` which is standard | Migration is large; current works; defer | L |
| **`@hookform/resolvers` + `react-hook-form` 7.72** | LITFIN has ad-hoc useState forms; BOSS uses RHF + Zod resolver | `package.json` add; refactor application stepper | M |
| **AG-UI registry pattern** (`packages/genui/src/registry.ts`) | BOSS's GenUI uses a registry lookup vs LITFIN's switch dispatch — cleaner extension | LITFIN `src/core/litfin-ai/generative-ui/AdaptiveRenderer.tsx` refactor to registry | S |
| **next-intl middleware-based locale routing** | LITFIN routes are `/en/*`-style absent; BOSS has middleware-driven locale prefixes | Adopt if Spanish/French expansion is on the roadmap | L |

### 4.3 Wholly new (neither has)

| What | Build in which project | Notes |
|---|---|---|
| **Vercel AI SDK v5 adapter** wrapping the in-house SSE + tag protocol | Both | Lets you call `useChat()` from `@ai-sdk/react` against the existing `/api/brain/operator-agent` SSE by writing a Data-Stream-Protocol-compatible writer. Gives ecosystem (Vercel AI Console, AI Gateway, observability) without rewriting the brain. |
| **View Transitions API page transitions** | Both | Replace Framer Motion `PageTransition.tsx` with `document.startViewTransition()` + Tailwind v4 `view-transition-name` utilities. |
| **Tailwind v4 CSS-first migration** | Both | Big-bang upgrade — config moves to `@theme` block in CSS, OKLCH becomes native, container queries land. Plan as a dedicated migration sprint. |
| **`web-vitals@4` + production reporter** | Both | `app/_components/WebVitalsReporter.tsx` posts INP/LCP/CLS/FID-deprecated/TTFB to `/api/telemetry/web-vitals`. |
| **`axe-core` Playwright integration** | Both | `e2e/a11y.spec.ts` runs axe on every authenticated portal. |
| **React Native bridge for LITFIN GenUI blocks** | Both | A React Native + Skia rewrite of the 47 blocks so the LITFIN brain can drive an Expo mobile app — replaces the Flutter mobile workspace or runs alongside. Strategic call. |

---

## 5. Top-10 actions (prioritised)

1. **[BOSS port — week 1]** Adopt LITFIN's `<generative-ui>…</generative-ui>` tag protocol in `packages/genui/src/format.ts` + `packages/chat-ui` `parseSseChunk`. Zero AI-SDK churn; unlocks structured GenUI streaming for all BOSS portals immediately.
2. **[BOSS port — week 2]** Port LITFIN's 37 missing UIBlockType primitives into `packages/genui/src/components/` (skip the loan-specific FiveCsChart/ReadinessRadar; keep all learning/decision/UX-scaffolding ones). Adopt the `nextDynamic` lazy-load pattern from `AdaptiveRenderer.tsx:50-117`.
3. **[BOSS port — week 2]** Port `useChatSurface` ("main" vs "theater") to `packages/chat-ui/src/hooks/useChatSurface.ts` — single hazard prevention for tenant data mutation from sandbox chats.
4. **[BOSS port — week 3]** Build chat ↔ smartboard bidirectional correlation (`useSmartboardBridge`, `isActiveOnBoard` ring, `data-message-id` scroll-back) on top of BOSS's existing `Blackboard.tsx`.
5. **[BOSS new — week 3]** Adopt LITFIN's bank-grade CSP / Permissions-Policy / HSTS preload baseline (`next.config.js:258-318`) in every BOSS `apps/*/next.config.js`. Trust posture parity.
6. **[BOSS port — week 4]** Port LITFIN's webpack `splitChunks.cacheGroups` for `framework/voice/tensorflow/graph-libs/animations` into BOSS `apps/customer-app/next.config.js`. Pair with `optimizePackageImports` list (24 packages). Audit BOSS bundle size before/after.
7. **[LITFIN new — week 4]** Migrate Tailwind v3 → v4 (CSS-first config in `@theme`, OKLCH native, container queries enabled). Replace dual token systems (`globals.css` HSL CSS vars + `packages/ui/src/tokens.ts` indigo) with a single OKLCH source. Convert `oklch(…)` comments to real values.
8. **[LITFIN new — week 5]** Adopt View Transitions API for route transitions in `src/components/transitions/PageTransition.tsx` — replace framer-motion route morphing with `document.startViewTransition()` + Tailwind v4 `view-transition-name`. Gate behind `prefers-reduced-motion`.
9. **[LITFIN new — week 5]** Add Vercel AI SDK v5 adapter layer (`src/core/litfin-ai/ai-sdk-adapter.ts`) implementing Data Stream Protocol over the existing `/api/brain/operator-agent` SSE. Then the next surface that needs `useChat()` semantics gets them for free, without ripping out the in-house brain.
10. **[Both — week 6]** Ship `web-vitals@4` + `/api/telemetry/web-vitals` reporter in both projects + `axe-core` in Playwright CI gate. Establishes the SOTA telemetry baseline before any of the above visible-perf work, so improvement is measurable.

---

*Audit complete. Source: 2026-05-23 walkthrough by Claude Opus 4.7 (1M context).*
