# Tacit Knowledge Harvesting — Design Specification

> Pillar 2 of [`CAPABILITY_BOOST_VISION.md`](../STRATEGY/CAPABILITY_BOOST_VISION.md).
> Sibling specs:
> [`OMNIDATA_CONNECTOR_INVENTORY.md`](./OMNIDATA_CONNECTOR_INVENTORY.md),
> [`CAPABILITY_CATALOGUE_SPEC.md`](./CAPABILITY_CATALOGUE_SPEC.md),
> [`SELF_IMPROVING_LOOPS_SPEC.md`](./SELF_IMPROVING_LOOPS_SPEC.md),
> [`COGNITIVE_ENGINE_SPEC.md`](./COGNITIVE_ENGINE_SPEC.md),
> [`BOSSNYUMBA_SPEC.md`](../BOSSNYUMBA_SPEC.md).

Brand: Boss Nyumba. Persona: Mr. Mwikila — Boss Nyumba's autonomous
Central Estate Manager, here cast specifically as a **conversational
anthropologist** of the property domain.

---

## 1. The Thesis — Most Knowledge Lives in Heads, Not Data

Squirro's 2026 research, cited widely in the enterprise-AI literature
([squirro.com — Corporate Amnesia](https://squirro.com/squirro-blog/ai-tacit-knowledge-capture)),
puts the figure plainly: **roughly 80% of business value sits in tacit
knowledge** — the intuition, context, unwritten rules, tenant
relationships, failure stories, and trade craft that make property
management actually work. Omnidata gives Mr. Mwikila the raw
substrate; the cognitive engine gives him the reasoning discipline.
None of those, by themselves, extracts the *why* from the caretaker
who knows it. Without interviewing people, the platform reads the
surface of the estate firm while missing its operating logic.

The founder's brief is direct:

> "Literal ability to poke, identify, and document critical know-hows
> that are in people's heads by prompting more or asking follow-ups
> or curious explanations or clarifications into domain knowledge,
> learning, etc. Look continues."

The state of the art in 2026 is converging on the same point.
Deloitte Tohmatsu shipped an "AI Interview Agent" in January 2026
([itbusinesstoday.com](https://itbusinesstoday.com/hr-tech/deloitte-tohmatsu-develops-ai-interview-agent-to-digitize-tacit-knowledge-within-companies/));
KS-Agents markets an AI-powered exit-interview product
([ks-agents.com/offboarding](https://ks-agents.com/offboarding/));
JoySuite, CogniCache, and Squirro itself sell variations of the same
idea. Where every existing product has *one* harvesting mode —
typically exit interviews — Boss Nyumba ships **five**, each tuned to
a different moment in the employee lifecycle. That is what makes
Mr. Mwikila a real anthropologist, not a leaving-employee survey.

---

## 2. The Five Harvesting Modes

### 2.1 Onboarding Interview

**When fired:** within 24 hours of a new employee being added to the
tenant.

**What it does:** Mr. Mwikila runs a structured 20–30 minute
conversational interview with the new employee (caretaker, accounts
clerk, property coordinator, junior estate manager). Topics: their
role, recurring tasks, methods they use, software they touch, key
relationships (tenants, vendors, utility agents), one-week / one-month /
one-quarter deliverables, what they think they will need to learn,
what they worry will go wrong. Bilingual (Swahili / English
toggleable mid-session); the question generator adapts depth to
seniority (a senior estate manager gets methodology-elicitation-style
questions; a new junior caretaker gets a checklist-style intake).

**Output:** between 30 and 90 `KnowHowArtifact`s per session.

**Frequency:** once per employee, at hire. Optional 30-day follow-up.

### 2.2 Departure Interview

**When fired:** triggered by HR / owner marking an employee as
exiting. Voluntary — employees opt in or decline.

**What it does:** between one and five 60–90 minute sessions over the
notice period, depending on role seniority. Mr. Mwikila asks deep
methodology-elicitation questions: *"Walk me through how you decide
which tenant gets a payment-extension grant"*, *"What do you wish
someone had told you on your first month here?"*, *"If your
replacement had three weeks with you, what would you teach them?"*.
The MD asks **until satisfied** — re-prompts on shallow answers,
follows up on names dropped, surfaces inconsistencies with the
omnidata record.

**Output:** 150–500 artifacts for a senior expert; 50–150 for a
mid-level role.

**Frequency:** once per departing employee, multi-session as needed.

### 2.3 Curious Follow-up

**When fired:** in-flight, mid-chat, when an employee mentions a
name, a process, a number, or a relationship Mr. Mwikila has no
know-how artifact for.

**What it does:** Mr. Mwikila injects 1–3 follow-up questions inline
— *"You mentioned 'the Friday LUKU run' — is that your standard
cycle? Who handles it if you're out?"* — and stops as soon as the
gap is closed or the employee signals they want to move on. Never
pushy; never blocking the original task.

**Output:** 1–5 artifacts per follow-up.

**Frequency:** ad-hoc; triggered hundreds of times per week.

### 2.4 Methodology Elicitation

**When fired:** scheduled by the owner for a specific senior expert —
typically a 3- to 5-session arc. Used for the depth case: a 22-year
caretaker, a senior accounts manager with a private spreadsheet
system, a tenant-relations expert with a relationship book.

**What it does:** structured "walk me through how you do X" sequence,
combining 5-Whys (Toyota Production System), Cynefin sense-making
(simple / complicated / complex / chaotic), and ethnographic
"narrative reconstruction".

**Output:** 100–300 artifacts per arc; produces a **playbook
artifact** the team can read.

**Frequency:** as the owner schedules — a handful per year per
tenant.

### 2.5 Just-in-Time Documentation

**When fired:** when an employee completes a task Mr. Mwikila has
flagged as either novel (no know-how artifacts match) or unusually
successful (outcome metrics exceeded baseline).

**What it does:** Mr. Mwikila offers, in chat: *"That looked like a
useful approach — should I save it for the team?"* If yes, runs a
short 3-question recap and adds an artifact to the tenant's playbook.

**Output:** 5–15 artifacts per event.

**Frequency:** triggered dozens of times per week.

---

## 3. The Interview Engine Contract

```typescript
export type HarvestMode =
  | 'onboarding'
  | 'departure'
  | 'curious_followup'
  | 'methodology_elicitation'
  | 'jit_documentation';

export interface InterviewSession {
  readonly id: string;
  readonly tenant_id: string;
  readonly employee_id: string;
  readonly mode: HarvestMode;
  readonly initiated_by: 'system' | 'owner' | 'employee';
  readonly consent_record_id: string;             // mandatory
  readonly language: 'sw' | 'en';
  readonly target_artifact_count: number;
  readonly created_at: string;
  readonly completed_at: string | null;
  readonly status: 'pending' | 'in_progress' | 'completed' | 'declined' | 'paused';
}

export interface InterviewTurn {
  readonly id: string;
  readonly session_id: string;
  readonly turn_index: number;
  readonly question: string;
  readonly question_frame: QuestionFrame;
  readonly response: string;
  readonly response_audio_url: string | null;
  readonly extracted_artifacts: ReadonlyArray<string>;
  readonly follow_up_signals: ReadonlyArray<FollowUpSignal>;
  readonly created_at: string;
}

export type QuestionFrame =
  | 'intake'
  | 'five_whys'
  | 'cynefin_categorise'
  | 'ethnographic'
  | 'gap_probe'
  | 'failure_elicit'
  | 'relationship_map';

export interface FollowUpSignal {
  readonly kind: 'name_dropped' | 'process_mentioned' | 'tool_named' | 'metric_cited' | 'failure_alluded';
  readonly value: string;
  readonly should_probe: boolean;
}
```

The engine exposes one persona-kernel tool per mode plus a shared
`generate_next_question_v1` primitive.

---

## 4. Question Generation

LLM-driven but structured. Receives, per turn: the running
transcript, the employee's role / seniority, the harvesting mode +
question frame, omnidata signals about this employee (informational
only — not used to surveil), and the running artifact yield.

Uses Anthropic Claude with extended thinking (4000 token budget for
methodology elicitation, 1500 for curious follow-up, 2500 otherwise)
to compose a single next question that:

1. Sits within the chosen `QuestionFrame`.
2. Is **minimally invasive** — never personal information unrelated
   to work; never attributable opinions about other employees.
3. Maximises information gain.
4. Is **culturally calibrated** — Swahili generation tested against a
   Tanzania-specific eval set with property-domain vocabulary
   (kodi, mpangaji, mwenye nyumba, mhudumu, askari, LUKU, Manispaa).

Five structural frames: 5-Whys (TPS), Cynefin, Ethnographic
narrative, Failure elicitation, Relationship mapping. Generator caps
sessions at the configured `max_turns` to prevent fatigue.

---

## 5. Output Format — `KnowHowArtifact`

```typescript
export type KnowHowKind =
  | 'process'
  | 'rule'
  | 'relationship'
  | 'tool'
  | 'preference'
  | 'history'
  | 'failure'
  | 'metric'
  | 'terminology';

export interface KnowHowArtifact {
  readonly id: string;
  readonly tenant_id: string;
  readonly kind: KnowHowKind;
  readonly text: string;
  readonly structured: Record<string, unknown>;
  readonly source_session_id: string;
  readonly source_turn_id: string;
  readonly contributed_by_employee_id: string;
  readonly corroborated_by_employee_ids: ReadonlyArray<string>;
  readonly evidence_citations: ReadonlyArray<EvidenceCitation>;
  readonly confidence: number;
  readonly reusability_tags: ReadonlyArray<string>;
  readonly created_at: string;
  readonly audit_hash: string;
}

export interface EvidenceCitation {
  readonly kind: 'interview_turn' | 'omnidata_item' | 'corpus_chunk' | 'external_source';
  readonly reference_id: string;
}
```

Examples per kind (property domain):

- **process:** *"Monthly rent collection: send WhatsApp template on
  the 1st, send reminder on the 4th, escalate to caretaker visit on
  the 7th, formal notice on the 14th."*
- **rule:** *"Never accept a deposit in cash for properties > TSh
  500k/month — always via M-Pesa Till or bank transfer for
  evidence trail."*
- **relationship:** *"Unit 3F tenant pays on the 4th every month,
  never late, always asks about water pressure between 18:00–20:00.
  Last 36 months, p-value 0.001."*
- **failure:** *"In 2024 Q2 we filed Manispaa property-tax without
  the correct house-number suffix; got flagged. Always include
  block-letter suffix now."*

---

## 6. Knowledge Cell Integration

Every `KnowHowArtifact` is also written as a `CognitiveMemoryCell`
(per the unified-memory substrate) with `kind` mapped to memory
kind, `contributed_by_specialisation` set to the harvest mode,
`evidence_citations` carried, and `promotion_status` starting as
`observed` and advancing to `reinforced` when corroborated.

---

## 7. Privacy + Consent

Tacit-knowledge harvesting is **the most consent-sensitive surface
in Boss Nyumba.** The regime:

1. **Every employee consents at hire.**
2. **Employees see their own know-how artifacts.** A `/me/knowhow`
   page lists every artifact; they can edit, redact, or hard-delete.
3. **Departure interviews are voluntary.**
4. **Personal opinions about other employees are forbidden.**
5. **The owner sees aggregate know-how only.** Attribution shown
   only when the source employee opted in.
6. **Revocation triggers tombstoning** within 30 days.
7. **Audit-hash anchoring** on every consent grant, revocation,
   tombstone.

---

## 8. Anti-Patterns

Mr. Mwikila MUST NOT:

1. **Surveil employees without consent.**
2. **Capture personal information unrelated to work.**
3. **Treat one employee's opinion as canonical** without corroboration.
4. **Fail to attribute know-how to the source.**
5. **Push when fatigue is detected** (yield < 60% → pause).
6. **Repeat questions across modes** — per-employee history avoids
   redundancy.
7. **Use harvest data to train base models.** Federation uses only
   DP-bounded aggregates.

---

## 9. UX Surface

The chat-mode adapter `TacitInterviewChatAdapter` (lands in
`packages/chat-ui/src/chat-modes/`) renders structured interview
experience: session-progress chip, inline artifact previews,
pause / resume, language toggle, decline button.

Home dashboard renders a `KnowHowDigest` block showing weekly
captures.

---

## 10. Schema Additions

Migration adds: `interview_sessions`, `interview_turns`,
`know_how_artifacts`, `follow_up_threads`, `knowhow_provenance`,
`consent_records`.

Indexes: `(tenant_id, kind, confidence DESC)` on artifacts;
`(tenant_id, employee_id, mode)` on sessions;
`(tenant_id, employee_id, status)` on consent.

RLS: artifacts visible to (a) contributor, (b) same role family,
(c) owner / tenant admins.

---

## 11. Cross-Spec Integration Map

- **Omnidata:** `FollowUpSignal`s often originate in omnidata.
- **Capability catalogue:** missing artifacts surface as gaps.
- **Self-improving loops:** corroboration signals identify which
  know-how is converging vs contested.
- **Cognitive engine:** Discipline 4 reuses question-generation
  primitives in lower-stakes contexts.
- **Data onboarding:** artifacts mentioning new tables / columns
  trigger schema-evolution proposals.

This is how Mr. Mwikila becomes a real anthropologist. Real
Central Estate Managers do not invent property logic from data —
they sit with the caretakers, accounts clerks, and tenant-relations
people, ask, listen, follow up, and write down what they hear. The
tacit-knowledge engine is what gives Mr. Mwikila that hand.
