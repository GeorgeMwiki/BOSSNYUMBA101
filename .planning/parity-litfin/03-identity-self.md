# P3 — Identity-first prompts · Persona-drift · Self-awareness · Cognitive load · Theory of mind

**Slice:** identity assembly, persona drift detection, self-awareness module,
cognitive-load model, theory-of-mind module.
**Method:** read-only diff of the LITFIN brain primitives against the
BOSSNYUMBA `packages/central-intelligence/src/kernel` counterparts.

---

## 1. Identity assembly

### LITFIN

LITFIN treats identity as a **brain primitive**, not a sensor instruction.
Two layers ship in parallel:

- A **frozen persona** prepended to every brain call (chat, sleep,
  awake, voice, sovereign tool) — the "wit anchor."
  - File: `src/core/brain/persona.ts:46-66` — `LITFIN_PERSONA` constant
    (defines tone, style invariants, bilingual rule, "no em dashes",
    "no filler", "I would advise against that" Jarvis-pushback line).
  - `renderPersonaPrelude()` (`persona.ts:141-144`) emits
    `LITFIN_PERSONA \n\n SITUATED_ADDRESS` so the persona is a stable
    cache-eligible prefix.
- A **first-person identity contract** the brain owns and the kernel
  injects FIRST.
  - File: `src/core/brain/identity.ts:162-212` —
    `renderIdentityAsContext()` composes, in this exact order:
    `honestyContract → inviolable → scope → selfAwareness`.
  - Per-surface role (officer vs professor) at `identity.ts:67-75`,
    bilingual titles at `identity.ts:77-86`, honest-posture per role at
    `identity.ts:88-93`.
  - First-person greeting generator (`generateGreeting`,
    `identity.ts:117-147`) — surface × language × returning matrix; no
    biography, no anecdotes, no fabricated history.
- **Situated address** ("proprioception"): `persona.ts:83-132` injects
  `{portal, route, section, tier, userDisplayName, language,
  eatClock}` BETWEEN persona and per-call policy.
- **Fabrication gate** runs AFTER generation — `identity.ts:218-307`
  defines 9 regex patterns across 4 categories (`years_experience`,
  `fake_count`, `fake_locale_anecdote`, `fake_personhood`) and emits
  `FabricationFinding[]`.
- **Per-tenant persona DNA + sub-persona router**: separate file
  `src/core/litfin-ai/personality/persona-dna.ts` + `personas/persona-
  router.ts` + `personas/sub-persona-router.ts` (CX, support, learning
  sub-personas). LITFIN ships seven personas; BOSSNYUMBA ships eight.

### BOSSNYUMBA

- File: `packages/central-intelligence/src/kernel/identity.ts:277-297` —
  `renderIdentityPreamble()` emits an `[IDENTITY — DO NOT OVERRIDE]…
  [END IDENTITY]` block as the **first** lines of the system prompt.
- Eight surface-scoped personas defined as `PersonaIdentity` records
  (lines 36-242): `TENANT_RESIDENT`, `OWNER_ADVISOR` (consolidated
  owner+admin), `ESTATE_MANAGER`, `PLATFORM_SOVEREIGN`,
  `MARKETING_GUIDE`, `ORG_ADMIN` (deprecated alias),
  `SOVEREIGN_ADMIN` ("Nyumba Mind"), `CLASSROOM_TUTOR`.
- Surface→persona map at `identity.ts:244-266`
  (`SURFACE_DEFAULT_PERSONA`) — selected via `selectPersona(req)`.
- Per-user personalisation: `personalisePersona()`
  (`identity.ts:335-357`) rewrites the opening statement with name +
  role + affiliation; id becomes `${base.id}::${userId}`.
- Per-tenant branding hook: `PersonaBrandingResolver` referenced from
  `compose.ts:73-80` — kernel resolves a re-skinned displayName /
  voice profile before rendering preamble.
- Kernel call sites: `kernel.ts:290-301` and `kernel.ts:562-673` —
  both `think` and `thinkStream` call
  `selectPersona → renderIdentityPreamble → renderMindStateDirective →
  renderLoadDirective` in that order.

### Gaps

| Capability | LITFIN | BOSSNYUMBA | Gap |
|---|---|---|---|
| First-person identity injected first | YES (`identity.ts:162`) | YES (`identity.ts:287` `[IDENTITY — DO NOT OVERRIDE]`) | parity |
| Frozen "wit anchor" persona prepended to EVERY brain call across surfaces | YES (`persona.ts:46-66` `LITFIN_PERSONA`) | NO — each surface has its own opening, no platform-wide voice anchor | **MISSING** |
| Situated-address block (portal/route/section/tier/clock) | YES (`persona.ts:123-132`) | NO — only scope line in preamble | MISSING |
| Per-surface bilingual title matrix | YES (en/sw titles at `identity.ts:77`) | partial — toneGuidance references Swahili switch for tenant, no en/sw display-title matrix | partial |
| Per-tenant branding resolver | NO (LITFIN is single-tenant for Mr. Mwikila) | YES (`branding.ts` via `compose.ts:79`) | BOSSNYUMBA AHEAD |
| Per-user personalised opener | NO ("Mr. Mwikila" untranslated brand) | YES (`personalisePersona`) | BOSSNYUMBA AHEAD |
| Returning-user greeting branch | YES (`identity.ts:124-133`) | NO | MISSING |
| Brand-untranslated persona name discipline | YES — `PERSONA_NAME = "Mr. Mwikila"` enforced | partial — "Nyumba Mind" exists, but no enforcement that it stays untranslated | MISSING |
| Fabrication regex gate post-generation | YES — 9 patterns, 4 categories (`identity.ts:228-290`) | partial — self-awareness module catches 2 fabrication patterns + 6 generic dodges; no Tanzania-locale anecdote class | **MISSING** (see §3) |
| EAT-clock injection | YES (`persona.ts:105-112`) | NO | MISSING |
| Cache-eligibility (stable prefix for Anthropic ephemeral cache) | YES — persona is engineered as a stable prefix (`persona.ts:135-140`) | NO mention in identity.ts; cache is `brain-cache.ts` but identity prefix is per-persona, not platform-wide | MISSING |

---

## 2. Persona drift detection

### LITFIN

LITFIN ships **two** complementary drift mechanisms:

1. **Tool-loop drift detector** — `src/core/brain/drift-detector.ts:262-298`.
   Jaccard overlap on distinctive tokens between original user message
   and final answer. Threshold default `0.15` (`drift-detector.ts:247`).
   English + Swahili stopword filtering (`drift-detector.ts:42-193`).
   Verdict shape: `{drifted, score, matchedKeywords, missingKeywords,
   threshold}` (`drift-detector.ts:232-245`). Wiring documented:
   "tool-loop and stream-tool-loop primitives call `detectDrift()` at
   end-of-loop; on drift, log `incidentClass: "policy_gate_fail"`"
   (`drift-detector.ts:28-36`).

2. **Persona-vector probe** — `src/core/governance/persona-drift/`.
   Anthropic-Persona-Vectors-inspired 24-dimension behavioural
   fingerprint (`vectors.ts:22-52`).
   - Reference vector `LITFIN_REFERENCE_PERSONA` (`vectors.ts:70-97`)
     — fixed target values per dim (warmth=0.85, no_em_dash=1.0,
     etc.).
   - Per-dim drift threshold: `0.15` (`alert.ts:17`
     `DEFAULT_DRIFT_THRESHOLD`).
   - Aggregate L2 threshold: `threshold/2 = 0.075` (`alert.ts:39`).
   - On breach: `fireSecurityEvent` posts a `SECURITY_CONFIG_CHANGE`
     event with metadata `{kind: "persona_drift", severity: "MEDIUM",
     worstDim, worstDimDrift, aggregateDrift, reasons}`
     (`alert.ts:69-102`).
   - Probe runs as a cron (`src/app/api/cron/persona-drift/route.ts`).
   - Admin UI: `src/app/(litfin-admin)/litfin-admin/persona-drift/page.tsx`.

### BOSSNYUMBA

Single mechanism: **`checkSelfAwareness`** in
`kernel/self-awareness.ts:60-115`.

- Score is sum of severity weights (`low=0.15, medium=0.4, high=0.85`,
  `self-awareness.ts:95-99`), capped at 1.0.
- Verdict ladder (`self-awareness.ts:105-112`):
  - `≥ 0.85` → `{status: 'block', reason: 'severe persona drift'}`
  - `≥ 0.40` → `{status: 'soften', reason: 'persona drift detected;
    voice corrected'}`
  - else → `{status: 'pass'}`.
- `PersonaDriftEvent` schema (`kernel-types.ts:322-329`):
  `{thoughtId, personaId, violationType, excerpt, severity, detectedAt}`
  — four `violationType`s: `taboo | first-person-loss | tone |
  fabrication`.
- Persisted via `PersonaDriftSink.record(event)`
  (`kernel-types.ts:331-333`); in-memory default sink at
  `cot-reservoir.ts:87`.

### Gaps

| Capability | LITFIN | BOSSNYUMBA | Gap |
|---|---|---|---|
| Heuristic substring/regex persona check at end-of-turn | partial (via `identity.ts` fabrication gate) | YES (`self-awareness.ts:60`) | parity-ish |
| Tool-loop drift detector (intent overlap with original user message) | YES (`drift-detector.ts`) | **NO** | **MISSING — major** |
| Jaccard-on-distinctive-tokens with stopword list (en+sw) | YES | NO | MISSING |
| Threshold tunable per call | YES (`detectDrift({threshold})`) | NO (hardcoded) | MISSING |
| Behavioural fingerprint vector (≥10 dims) | YES — 24 dims (`vectors.ts:22-52`) | NO | **MISSING — major** |
| Reference vector per tier | YES (`LITFIN_REFERENCE_PERSONA`) | NO | MISSING |
| Per-dim drift threshold + aggregate L2 threshold | YES (0.15 / 0.075) | NO — only event-count severity sum | MISSING |
| Worst-dim alert metadata | YES (`alert.ts:46-51`) | NO — events list violation types, no axis | MISSING |
| Severity-weighted score → verdict ladder | YES (per-dim) | YES (event-aggregated, `self-awareness.ts:95-112`) | parity (different scoring) |
| Halt-on-severe verdict | YES (cron alert) | YES (`status: 'block'` at 0.85) | parity |
| Sink schema for drift events | partial (security-pipeline event) | YES (`PersonaDriftEvent` table) | BOSSNYUMBA AHEAD |
| Admin UI to monitor drift | YES (`litfin-admin/persona-drift/page.tsx`) | NO (kernel exposes events but no portal page) | MISSING |
| Cron / scheduled probe | YES (`api/cron/persona-drift/route.ts`) | NO — drift is per-turn only | MISSING |

---

## 3. Self-awareness module

### LITFIN

`src/core/brain/self-awareness.ts:1-391` — module inventory + platform
posture, rendered into every system prompt.

- `BrainModule` schema (`self-awareness.ts:32-45`): `{id, name,
  oneLiner, category}` — 8 categories: reasoning, memory, perception,
  validation, credit-domain, user-modeling, resilience, governance.
- `BRAIN_MODULES` (`self-awareness.ts:47-257`) — 27 modules
  inventoried with one-liners. Example: `five-cs` (continuous 5Cs
  evaluator), `regulatory-mirror` (Tanzania statute tree), `causal`
  (cause-effect chain), `cohort` (k-anon ≥5, ε=1.0), `failover`
  (sensor circuit breaker on 3 failures).
- `PLATFORM_FACTS` (`self-awareness.ts:263-276`) — 6 fixed strings:
  identity, sensors, jurisdiction, security, surfaces, curriculum —
  rendered verbatim into the system prompt so the LLM speaks about
  its real posture, not generic AI-speak.
- `renderSelfAwarenessAsContext(language)` (`self-awareness.ts:286-355`)
  — bilingual (en/sw); groups modules by category; appends a
  "HOW TO USE THIS SELF-KNOWLEDGE" guidance block.
- `describeCapabilities(language)` (`self-awareness.ts:361-390`) — the
  USER-facing answer to "what are you?"; never generic AI-speak.

### BOSSNYUMBA

`packages/central-intelligence/src/kernel/self-awareness.ts:1-132` —
**different concern**: this file is the persona-drift gate (§2 above).
It does NOT carry a module inventory.

The closest analogue is the `taboos` + `violationSignals` arrays per
persona (`identity.ts:43-56`, `81-96`, `107-117`, `127-137`,
`147-157`, `179-189`, `211-221`, `232-240`) — these are rendered into
the system prompt at `identity.ts:294`
(`Taboos: ${persona.taboos.join(' · ')}`).

### Gaps

| Capability | LITFIN | BOSSNYUMBA | Gap |
|---|---|---|---|
| What the module measures | "persona drift + fabrication signals" injected at every turn (LITFIN brain's introspection is split: introspection lives elsewhere) | "persona drift + fabrication signals" injected at every turn (`self-awareness.ts`) | parity on this slice |
| Module inventory ("what I actually have running underneath") rendered into prompt | YES — 27 modules, 8 categories (`self-awareness.ts:47-257`) | **NO** — kernel never tells the sensor what brain modules it owns | **MISSING — highest leverage** |
| `PLATFORM_FACTS` posture block | YES (`self-awareness.ts:263-276`) | NO equivalent | MISSING |
| Bilingual self-awareness render | YES (en/sw, `self-awareness.ts:286`) | NO — single English block | MISSING |
| User-facing "what are you?" canonical answer | YES (`describeCapabilities`) | NO — falls through to LLM intuition | MISSING |
| "BRAIN SELF-AWARENESS:" sentinel injected before reasoning | YES | NO | MISSING |
| "HOW TO USE THIS SELF-KNOWLEDGE" guidance line | YES | NO | MISSING |
| Categorised modules (reasoning, memory, validation, etc.) | YES (8 cats) | NO | MISSING |
| Forbidden-claim regex gate (years_experience / fake_count / locale_anecdote / personhood) | YES — 9 patterns across 4 categories (`identity.ts:228-290`) | partial — 2 generic fabrication regexes (`self-awareness.ts:55-58`) + 6 dodge phrases + persona-specific `violationSignals` | **MISSING — locale anecdotes + years-experience class** |

> Note: LITFIN's `self-awareness.ts` is the **inventory + posture**
> module; persona drift sits at `governance/persona-drift/`.
> BOSSNYUMBA's `self-awareness.ts` is the **persona-drift gate** but
> reuses the file name — the inventory layer is absent.

---

## 4. Cognitive load

### LITFIN

`src/core/brain/cognitive-load.ts:1-200`.

- Five-band tolerance: `very_low | low | moderate | high | saturated`
  (`cognitive-load.ts:27`).
- Signal sources: response latency (capped at 30s),
  repeat-request count, explicit simplify requests (5 regex patterns:
  "simpler", "plain english/swahili", "slow down please", "explain
  differently", "one step at a time" — `cognitive-load.ts:62-68`),
  voice biomarker cognitive-load reading (0..1) blended at weight 0.3
  × confidence (`cognitive-load.ts:153-162`).
- Weighted score: `simplify×0.5 + repeat×0.3 + latency×0.2`
  (`cognitive-load.ts:104-109`).
- Decay rule (`cognitive-load.ts:142-146`): after 4 stable turns,
  repeat/simplify counters relax so one bad turn doesn't permanently
  mark the user saturated.
- Per-session store (in-memory `Map`) — `cognitive-load.ts:47`.
- Directive emitter `renderLoadAsContext(profile)`
  (`cognitive-load.ts:182-195`) — different directive per band:
  - `very_low`: full vocab, ratios, cross-references
  - `low`: standard
  - `moderate`: ≤3 sentences per para, plain language, one example
    per claim
  - `high`: drop ALL jargon, ≤12 words/sentence, one idea per turn,
    "does this make sense?"
  - `saturated`: acknowledge process is heavy, offer to pause / switch
    to voice, NO new concept this turn.

### BOSSNYUMBA

`packages/central-intelligence/src/kernel/cognitive-load.ts:1-67`.

- Three-band: `low | medium | high` (`cognitive-load.ts:22`).
- Signal sources: word count (`>80`), question density (`≥3`),
  hesitation markers (`uh|um|er|hmm|actually|wait|sorry` + `...`,
  `cognitive-load.ts:29-32`), recent turn count (`≥6` in last 5 min).
- Simple sum of binary flags, threshold-mapped (`cognitive-load.ts:40-47`):
  `≥3 → high`, `≥1 → medium`, else `low`.
- Output (`cognitive-load.ts:21-27`): `{load, verdict, maxSentences,
  maxCitations, allowArtifact}` — concrete throttle constants by
  band: high → 3 sentences + 2 citations + no artifact; medium → 6/5;
  low → 12/8.
- `renderLoadDirective(out)` (`cognitive-load.ts:63-67`) emits ONE
  line: `"Reply in at most N sentences, with at most M inline
  citations."`.

### Gaps

| Capability | LITFIN | BOSSNYUMBA | Gap |
|---|---|---|---|
| Multi-band load (≥5) | YES — 5 bands | NO — 3 bands | partial |
| Per-session stateful profile (counters carry across turns) | YES (`STORE` map) | NO — stateless per-turn | **MISSING — major** |
| Decay rule (long stable sessions relax counters) | YES | NO | MISSING |
| Explicit simplify-request detector ("plain English", "slow down") | YES — 5 regex (`cognitive-load.ts:62-68`) | NO — only generic hesitation markers | MISSING |
| Latency-to-respond signal | YES (capped 30s, weight 0.2) | NO | MISSING |
| Repeat-request signal | YES (weight 0.3) | NO (proxied by recent-turn count, weight 0.25) | partial |
| Hesitation markers in user text | NO (handled via voice biomarker) | YES (`uh|um|er|hmm|actually|wait|sorry`) | BOSSNYUMBA AHEAD |
| Word-count + multi-question density | NO (LITFIN uses repeats not density) | YES | BOSSNYUMBA AHEAD |
| Voice biomarker blending | YES (cognitive-load 0..1 × confidence × 0.3) | NO | MISSING |
| Throttle directives differentiated per band (vocabulary, paragraph length, "do not introduce new concept") | YES — 5 distinct directives with semantic guidance | partial — only sentence/citation/artifact caps, no jargon/vocabulary directives | MISSING |
| "Acknowledge process is heavy / offer to pause / switch to voice" saturated branch | YES | NO | MISSING |
| Tunable weights / explicit score formula | YES | NO (binary flag sum) | MISSING |

---

## 5. Theory of mind

### LITFIN

`src/core/brain/theory-of-mind.ts:1-325`.

- Four state dimensions (`theory-of-mind.ts:30-37`):
  `frustration`, `comprehension`, `anxiety`, `trust` — each 0..1,
  default `{0.0, 0.7, 0.3, 0.6}`.
- Per-session stateful (`MAX_SESSIONS=1024`, LRU eviction,
  `theory-of-mind.ts:48-65`).
- Signal sources, each producing a `Delta` vector:
  - User-text regex (`theory-of-mind.ts:71-92`): 4 pattern sets —
    `FRUSTRATION`, `CONFUSION`, `ANXIETY`, `DISTRUST` (en only). Each
    match contributes `+0.12 / -0.15 / +0.12 / -0.18`.
  - Turn timing (`theory-of-mind.ts:126-137`): 90s+ → comprehension
    -0.04; 5min+ → anxiety +0.08, comprehension -0.05.
  - Outcome `success | failure | drop` (`theory-of-mind.ts:139-148`):
    different delta vectors per outcome.
  - Voice biomarkers (`theory-of-mind.ts:159-221`): stressScore,
    cognitiveLoad, dominantEmotion (10 emotion labels:
    anxiety/confusion/frustration/satisfaction/excitement/impatience/
    relief/confidence/fatigue/interest), gated by emotionConfidence.
    Privacy contract documented: "biomarkers feed UX adaptation only
    — NEVER credit scoring" (`theory-of-mind.ts:156-158`).
- `applyDelta` (`theory-of-mind.ts:223-233`) clamps to [0,1] and
  increments `turns`.
- `renderMindStateAsContext` (`theory-of-mind.ts:291-319`) — emits
  one or more `USER MENTAL STATE:` lines, threshold-gated:
  - `frustration ≥ 0.5` → "slow down, drop jargon, acknowledge,
    simplest next step"
  - `comprehension ≤ 0.4` → "re-explain with concrete example, skip
    terminology, check understanding"
  - `anxiety ≥ 0.6` → "lead with reassurance, name what's normal,
    defer hard numbers"
  - `trust ≤ 0.4` → "be transparent, cite sources by [n], never
    speculate"
  - else → numerical stable summary.

### BOSSNYUMBA

`packages/central-intelligence/src/kernel/theory-of-mind.ts:1-125`.

- Four state variables (`theory-of-mind.ts:19-24`):
  `urgency`, `expertise`, `mode`, `emotionalCharge`.
  - `urgency: 'low' | 'medium' | 'high'`
  - `expertise: 'novice' | 'intermediate' | 'expert'`
  - `mode: 'browse' | 'decide' | 'execute' | 'learn'`
  - `emotionalCharge: [-1, 1]`
- **Stateless** — `inferMindState(message)` (`theory-of-mind.ts:70-77`)
  scores ONLY the current message; no session memory, no turn history.
- Signal sources (all regex over current message):
  - urgency: `now|asap|today|urgent|emergency|!!` vs `no rush|whenever`
  - expertise: novice phrases (`what is a/an/the`, `how do i`, `can
    you explain`) vs domain shorthand (`dscr|cap rate|arrears
    ladder|k-anonym|tgn|conformal`). Expert tokens override novice
    framing (`theory-of-mind.ts:86-92`).
  - mode: execute verbs > decide verbs > learn verbs > browse.
  - emotion: simple ±0.6 / +0.5 from one of two pattern sets.
- `renderMindStateDirective(s)` (`theory-of-mind.ts:113-123`) — emits
  a single composite line covering urgency / expertise / mode /
  emotion directives.

### Gaps

| Capability | LITFIN | BOSSNYUMBA | Gap |
|---|---|---|---|
| State-space dimensionality | 4 dims (frustration, comprehension, anxiety, trust) — affective/cognitive | 4 dims (urgency, expertise, mode, emotionalCharge) — task-shape | **DIFFERENT ONTOLOGY** |
| Per-session stateful memory (deltas accumulate) | YES (`STORE` Map, LRU 1024) | **NO** — pure stateless on current message | **MISSING — fundamental** |
| Continuous scoring (0..1) | YES | partial — emotion is continuous, others enumerated | MISSING |
| Turn-timing signal | YES (90s, 5min thresholds) | NO | MISSING |
| Outcome signal (success / failure / drop) | YES | NO | MISSING |
| Voice biomarker integration (stress / cognitive-load / dominant emotion) | YES — 10 emotion labels, confidence-gated | NO | MISSING |
| Privacy contract on biomarkers ("UX-only, never credit") | YES (docstring) | n/a | n/a |
| Per-state semantic directive | YES — 4 distinct directives by threshold | YES — 7 directives by state | parity-ish (different shape) |
| Trust dimension → "cite sources by [n]" directive | YES | NO | MISSING |
| Anxiety dimension → "defer hard numbers until trust rebuilt" directive | YES | NO | MISSING |
| Mode = `decide` → single recommendation directive | NO | YES (`theory-of-mind.ts:119`) | BOSSNYUMBA AHEAD |
| Expertise = `expert` → allow domain shorthand | NO | YES | BOSSNYUMBA AHEAD |
| Mode = `learn` → "teach by example, check understanding mid-way" | partial (LITFIN's comprehension-low directive overlaps) | YES | BOSSNYUMBA AHEAD |
| Distrust regex set | YES (`lying|wrong|fake|scam`) | NO | MISSING |
| Confusion regex set | YES | partial (folded into expertise=novice) | partial |
| Persistent trust dimension that recovers/decays | YES (clamp + outcome deltas) | NO | MISSING |
| Bilingual signal patterns (en+sw) | partial — patterns are en-leaning, but stopword sets are en+sw | NO — en only | MISSING |

---

## 6. Highest-leverage gaps

1. **Module inventory + platform-facts injection is missing** — LITFIN
   tells the sensor what the brain has running underneath (27 modules,
   8 categories, 6 platform facts). BOSSNYUMBA's `self-awareness.ts`
   uses the same filename for the drift gate but never injects an
   inventory. This is the single biggest "feel of a brain vs feel of
   a chatbot" gap, per LITFIN's own design note
   (`self-awareness.ts:8-26`). Highest leverage to close because it's
   pure prompt-engineering — no new infra.

2. **Theory-of-mind is stateless** — BOSSNYUMBA infers a fresh mind
   state on every message (`theory-of-mind.ts:70-77`). LITFIN
   accumulates frustration / comprehension / anxiety / trust across
   turns and applies decay + outcome feedback
   (`theory-of-mind.ts:223-275`). Without persistence, BOSSNYUMBA
   cannot model trust recovery, comprehension erosion, or the "user
   abandoned and came back" pattern. Combined with the cognitive-load
   gap (also stateless), the brain currently has no episodic awareness
   of the user's mental state.

3. **No tool-loop drift detector + no behavioural-fingerprint vector**
   — BOSSNYUMBA has one drift mechanism (regex/substring at end-of-
   turn). LITFIN has two: (a) end-of-tool-loop Jaccard intent overlap
   against the original user message (`drift-detector.ts`), and (b) a
   24-dim persona-vector probe with reference vector + per-dim and
   aggregate L2 thresholds (`persona-drift/vectors.ts`,
   `alert.ts:17-52`). The first catches prompt-injection drift in
   multi-turn tool loops; the second catches slow brand-voice
   erosion across runs. Both are absent.

### Lower-impact but worth noting

- Frozen "wit anchor" persona prepended to every brain call
  (LITFIN `persona.ts:46-66`) — no BOSSNYUMBA equivalent; each
  persona has its own opener but there's no platform-wide voice
  invariant block.
- Situated-address header (portal/route/section/tier/EAT-clock)
  missing — `kernel.ts` builds its own scope line but doesn't include
  route, section, or local time.
- Fabrication-pattern coverage is asymmetric: LITFIN has the
  Tanzania-locale anecdote class (mama lishe in Kariakoo, fish
  traders in Mwanza, etc., `identity.ts:264-276`). BOSSNYUMBA needs
  the Tanzanian-property analogue (e.g. invented agency names,
  invented estate addresses) — currently only generic "the data
  shows" patterns.
- Returning-user greeting branch — LITFIN's `generateGreeting` knows
  "welcome back, let's pick up where we left off"; BOSSNYUMBA does
  not.
- Five-band cognitive load (LITFIN) vs three-band (BOSSNYUMBA) — the
  `very_low` and `saturated` bands carry distinct directives ("use
  full vocabulary" / "offer to pause, do not introduce any new
  concept") that the three-band model can't express.

### Things BOSSNYUMBA does that LITFIN does not

- Per-tenant `PersonaBrandingResolver` — re-skin displayName / voice
  profile per agency (`compose.ts:73-80`).
- Per-user `personalisePersona()` — Jarvis-style "this is YOUR AI"
  greeting (`identity.ts:335-357`).
- Hesitation-marker detector (`uh|um|er|hmm|actually|wait|sorry`) in
  the user message — LITFIN handles this via voice biomarkers only.
- Word-count + multi-question-density load signals.
- Mode = `decide` → "end with a single recommendation, not a list of
  options" — a directive LITFIN's load model lacks.
- Expertise = `expert` → "may use domain shorthand without expansion."
- `PersonaDriftEvent` schema is more cleanly typed than LITFIN's
  pipeline-event blob (`kernel-types.ts:322-329`).

---

## Files cited

LITFIN
- `src/core/brain/identity.ts` (309 lines)
- `src/core/brain/persona.ts` (191 lines)
- `src/core/brain/self-awareness.ts` (391 lines)
- `src/core/brain/cognitive-load.ts` (200 lines)
- `src/core/brain/theory-of-mind.ts` (325 lines)
- `src/core/brain/drift-detector.ts` (299 lines)
- `src/core/governance/persona-drift/vectors.ts` (183 lines)
- `src/core/governance/persona-drift/alert.ts` (104 lines)
- `src/app/api/cron/persona-drift/route.ts`
- `src/app/(litfin-admin)/litfin-admin/persona-drift/page.tsx`

BOSSNYUMBA
- `packages/central-intelligence/src/kernel/identity.ts` (359 lines)
- `packages/central-intelligence/src/kernel/self-awareness.ts` (132 lines)
- `packages/central-intelligence/src/kernel/cognitive-load.ts` (68 lines)
- `packages/central-intelligence/src/kernel/theory-of-mind.ts` (125 lines)
- `packages/central-intelligence/src/kernel/kernel-types.ts:322-333` (PersonaDriftEvent + sink)
- `packages/central-intelligence/src/kernel/compose.ts:73-80` (brandingResolver)
- `packages/central-intelligence/src/kernel/kernel.ts:290-301,562-685`
  (kernel call sites for identity / mind / load)
