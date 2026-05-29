# Persona Mode-Switching Proposal — Mr. Mwikila Master Brain

Status: PROPOSAL (not implemented)
Audience: Product + AI-copilot owners
Inspiration: Borjie `mining-ceo-persona.ts` + `mining-ceo-modes.ts` architecture

---

## Summary

Today `packages/ai-copilot/src/personas/manager-chat.ts` ships a single
flat `MANAGER_CHAT_PROMPT` system prompt — one persona, one mandate, one
tool allow-list. Every conversation a user has on the admin portal —
whether they are bootstrapping a new portfolio, paying a vendor,
triaging a tenant complaint, or briefing the board — uses the same
prompt.

Borjie's `mining-ceo-persona.ts` upgrades this pattern to a
**mode-switched persona**: ONE persona ("Mr. Mwikila") inhabits one of
N **operating modes** per turn. Each mode carries its own:

- mandate (one sentence — what the persona is doing right now)
- sample prompts (router seeds + documentation)
- `tools_allowed` (narrow allow-list — out-of-scope calls short-circuit)
- mode-specific system prompt body (composed from a universal preamble
  + mandate slot + evidence requirements + hard rules)

The kernel picks one mode per turn from the user intent (Build for
onboarding, Operations for shift-time chatter, Compliance for audits,
etc.). The owner gets the same warm Tanzanian advisor across every
flow — but the prompt the model sees is hyper-specific to the task in
front of it.

This proposal sketches the upgrade path for BossNyumba.

---

## Why mode-switch?

A flat prompt is forced to be a JACK-OF-ALL-TRADES. It carries every
constraint the persona has ever needed:

- finance hard-rules (no domestic USD quotes),
- safety hard-rules (no unsafe operational instructions),
- compliance evidence-discipline (cite source or stay silent),
- board-pack stylistic rules (no internal codenames),
- onboarding sequencing rules,
- ...

…even when the conversation is "what's my open work-order count?"
This wastes context-window tokens, dilutes the assistant's focus, and
makes prompt-engineering hard (a tweak for finance bleeds into board
prompts).

Mode-switching solves this with **prompt locality**: each mode loads
only its own rules. Universal hard rules (the cross-cutting safety +
evidence rules) ride a shared preamble and stay in every envelope.

Secondary wins:

- **Tool safety** — the allow-list per mode short-circuits out-of-
  scope tool calls before the executor sees them. A "Tenant
  Relations" turn cannot accidentally fire `treasury.payout()`.
- **Eval seeding** — `sample_prompts` per mode doubles as the seed
  corpus for the intent-router eval.
- **Observability** — every turn carries a `mode` label, so you can
  measure tool-success per mode, latency per mode, hallucination per
  mode.

---

## Proposed BossNyumba modes

Mining-domain modes from Borjie:
`build` · `strategy` · `operations` · `document` · `finance` · `risk` ·
`board-investor` · `compliance`.

Property-management-domain equivalents (suggested — needs product
input before implementation):

| Mode id            | Mandate                                                                 |
|--------------------|-------------------------------------------------------------------------|
| `build`            | Onboard a new portfolio: tenant org, properties, units, leases, KYC.   |
| `daily-ops`        | Day-to-day rent collection, arrears triage, vacancy management.        |
| `tenant-relations` | Tenant complaints, communication, dispute resolution, retention.       |
| `maintenance`      | Work-order intake, vendor dispatch, SLA tracking, preventive cycles.   |
| `finance`          | DSR, NOI, AR/AP, runway, invoicing, payment chasing, FX.               |
| `compliance`       | Regulatory checklists, audit packs, tax exposure, lease-law citations. |
| `expansion`        | New-acquisition modelling, market intel, capex allocation.             |
| `exit`             | Disposal modelling, transition packs, investor exit narrative.         |

The **8-mode** count is not load-bearing — pick the right granularity
for the product. Some product teams will find 5 modes sufficient.

---

## File layout (mirrors Borjie)

```
packages/ai-copilot/src/personas/
  manager-chat.ts            # contract boundary (types + frozen value)
  manager-chat-modes.ts      # mode bodies live next to each other
```

`manager-chat.ts` exposes the persona contract:

```ts
export type ManagerChatModeId =
  | 'build'
  | 'daily-ops'
  | 'tenant-relations'
  | 'maintenance'
  | 'finance'
  | 'compliance'
  | 'expansion'
  | 'exit';

export interface ManagerChatMode {
  readonly id: ManagerChatModeId;
  readonly name: string;
  readonly mandate: string;
  readonly sample_prompts: ReadonlyArray<string>;
  readonly tools_allowed: ReadonlyArray<string>;
  readonly system_prompt: string;
}

export interface ManagerChatPersona {
  readonly name: string;
  readonly title?: string;
  readonly mandate: string;
  readonly default_language: 'sw' | 'en' | 'fr';
  readonly modes: ReadonlyArray<ManagerChatMode>;
}

export const managerChatPersona: ManagerChatPersona = Object.freeze({
  name: 'Mr. Mwikila',
  title: "BossNyumba's AI Estate Operations Manager",
  mandate: "I am Mr. Mwikila — BossNyumba's AI Estate Operations Manager...",
  default_language: 'en',
  modes: MANAGER_CHAT_MODES,
});
```

`manager-chat-modes.ts` composes each mode via a shared helper:

```ts
const UNIVERSAL_HARD_RULES = [
  '- Never publish a tenant-facing artefact without explicit owner sign-off.',
  '- Never claim a tool result you did not obtain.',
  '- Never mark a recommendation "high confidence" without >= 2 independent evidence sources.',
  '- Never assume the owner intent — ask a specific question.',
].join('\n');

const EVIDENCE_RULES = [
  'YOUR EVIDENCE REQUIREMENTS:',
  '- Every recommendation must cite >= 1 evidence_id from the Canonical Property Graph (CPG) or the intelligence corpus.',
  '- If evidence is missing, ASK A SPECIFIC QUESTION or CREATE A TASK to collect it — never invent.',
  ...
].join('\n');

function composeModePrompt(args: { mode, mandate, specialised }): string { ... }

export const BUILD_MODE: ManagerChatMode = { ... composeModePrompt(...) };
export const DAILY_OPS_MODE: ManagerChatMode = { ... };
// ...

export const MANAGER_CHAT_MODES: ReadonlyArray<ManagerChatMode> = Object.freeze([
  BUILD_MODE,
  DAILY_OPS_MODE,
  TENANT_RELATIONS_MODE,
  MAINTENANCE_MODE,
  FINANCE_MODE,
  COMPLIANCE_MODE,
  EXPANSION_MODE,
  EXIT_MODE,
]);
```

---

## Routing (where modes plug in)

Today the persona is selected by `persona-router.ts`. After the
upgrade, an additional cheap classifier picks the **mode** per turn:

1. Persona router resolves `persona = managerChatPersona` (admin portal).
2. Mode router classifies the user query against the per-mode
   `sample_prompts` + a Haiku one-shot.
3. Kernel composition renders the final SYSTEM envelope =
   `universal preamble` + `mode.system_prompt`.
4. Executor enforces `mode.tools_allowed` — out-of-scope tool calls
   return a structured error before reaching the tool.

Costs: one extra Haiku call per turn (~$0.0002). Saves Opus tokens
in the main prompt because each mode body is ~1/8 the size of a
combined-everything prompt.

---

## Migration plan (incremental, not a big-bang rewrite)

1. **Ship the contract** — add `manager-chat-modes.ts` with the
   8 modes, all bodies identical for now (copy of current flat prompt).
   Wire the mode router behind a feature flag, default off.
2. **Specialise one mode at a time** — start with `daily-ops` (the
   most frequent turn type), measure with the LLM-as-judge eval, ship
   when it beats the flat-prompt baseline.
3. **Walk through the remaining modes** over a few waves.
4. **Tighten tool allow-lists** once mode-routing accuracy is >95%.
5. **Drop the flat prompt** once the last mode is specialised and the
   feature flag has been on in production for two release cycles
   without regression.

---

## Non-goals / open product questions

- **Do we expose the mode in the UI?** Borjie surfaces it as a chip
  ("Mr. Mwikila — Operations Mode"). BossNyumba may prefer fully
  invisible mode-switching. Decide per product preference.
- **Do owners override the mode?** If a user explicitly types "talk
  to me as my CFO", do we honour and pin the mode? Borjie does.
- **Per-mode language defaults** — does `tenant-relations` default to
  Swahili more aggressively than `finance`?
- **Cross-portal modes** — does owner-portal want the same 8 modes,
  or a subset (no `compliance` for owners)? Owner-advisor already
  has its own persona — confirm whether modes belong there too.

These are not engineering decisions. Surface them in the next
ai-copilot product review.

---

## References

- Borjie source (do not modify): `packages/ai-copilot/src/personas/
  mining-ceo-persona.ts` + `mining-ceo-modes.ts`.
- BossNyumba source today: `packages/ai-copilot/src/personas/
  manager-chat.ts`.
- The mode-switching pattern is domain-neutral; modes themselves are
  domain-specific and require product input.
