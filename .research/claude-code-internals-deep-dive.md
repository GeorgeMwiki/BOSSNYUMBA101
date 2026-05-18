# Claude Code Internals — Deep Research (2026-05-18)

> **Mode**: read-only research. No code modified.
> **Repo baseline**: `claude/phase-d-comprehensive-gap-closure` branch.
> **Subject**: BOSSNYUMBA AI Managing Director orchestrator vs the production Claude Code / Claude Agent SDK / MCP surface as documented at 2026-05-18.
> **Method**: 30+ doc pages fetched from `code.claude.com/docs/en/*`, `platform.claude.com/docs/en/*`, and `modelcontextprotocol.io/specification/2025-06-18/*`. Compared to baseline files under `/packages/central-intelligence/src/kernel/orchestrator/`.

---

## TL;DR

### Five highest-impact gaps (closing-cost ÷ value)

1. **Hook event surface is ~25% of Claude Code's.** We implement 3 stages (`pre-tool-use`, `post-tool-use`, `stop`). Claude Code defines **29 hook events** including `SessionStart` (with `startup|resume|clear|compact` matcher), `UserPromptSubmit`, `UserPromptExpansion` (for `/slash-command` interception), `PreCompact` / `PostCompact` (governing context compaction itself), `Notification`, `PostToolBatch`, `SubagentStart` / `SubagentStop`, `WorktreeCreate` / `WorktreeRemove`, `Elicitation` / `ElicitationResult` (MCP-driven user input), `ConfigChange`, `InstructionsLoaded`, `FileChanged`, `CwdChanged`, `TeammateIdle`, `TaskCreated` / `TaskCompleted`, `SessionEnd`, `Setup`. Every one is a governance hole — e.g. we have no audit trail of *which CLAUDE.md instructions were active for which decision* (`InstructionsLoaded` would give that). See `hook-chain.ts:30-38`. **Closing cost**: LOW (extend `Hook` ADT, plumb new payloads). **Value**: VERY HIGH (closes audit/4-eye/compliance gaps).

2. **HookResult ADT lacks `updatedInput` + `additionalContext`.** Claude Code's `PreToolUse` decision can rewrite `tool_input` (sanitize the command before it runs) and inject `additionalContext` into the model's view. We have `transform` that replaces the whole `Decision`, but no in-place argument scrubbing or post-hoc context injection. `hook-chain.ts:29-38`. **Closing cost**: VERY LOW (add two variants). **Value**: HIGH (PII-scrub becomes far stronger; SQL-write-blocker pattern from docs unlocks).

3. **Decision ADT omits "ask user a structured question" (AskUserQuestion).** Claude Code ships an `AskUserQuestion` tool with `form_fields` (text/password/select, required, options). We have `ask-owner` as a hook result with free-text prompt — but no schema for *what we're asking*. `decision.ts:79-104`. **Closing cost**: LOW (add 7th Decision variant). **Value**: HIGH (compliance four-eye flows become typed, owner UI becomes form-driven).

4. **No `PermissionRequest`/`PermissionDecision` event distinct from `PreToolUse`.** Claude Code separates *permission evaluation* (returns `allow|deny|ask|defer`) from *the actual hook chain* (which can also return `block`). Our `PermissionHook` (`hooks/pre-tool-use/permission-hook.ts`) collapses both. Claude Code's split lets policy be evaluated separately from instrumentation — and gives a `defer` option (pause until conditions met). `hooks/pre-tool-use/permission-hook.ts`. **Closing cost**: MEDIUM. **Value**: HIGH (proper separation of mechanism from policy).

5. **Memory tool API doesn't follow Anthropic's canonical command shape.** Anthropic's `memory_20250818` tool exposes 6 commands (`view`, `create`, `str_replace`, `insert`, `delete`, `rename`) with specific return-string formats ("Here're the files and directories up to 2 levels deep…"). Our `MemoryTool` interface (`memory-tool.ts:47-54`) has `recall/read/write/list/delete` — *not* the documented shape. Routing an Anthropic LLM at our memory port today would not work; it would need a translation layer. **Closing cost**: LOW (rename methods + add `str_replace`/`insert`/`rename`). **Value**: HIGH (drop-in compatibility with `memory_20250818` so we can use the official tool when we wire Claude as the LLM).

### Three contrarian findings

- **Claude Code itself deprecated `TodoWrite` in favor of `TaskCreate/TaskGet/TaskList/TaskUpdate` with file-locked dependency graphs.** Our `Plan` tree (`plan.ts:24-30`) is actually *closer* to Claude Code's task graph than to `TodoWrite`. We already shipped what they pivoted to.
- **Claude Code does NOT use the MCP `ToolSearch` primitive for its own built-in tools** — only for MCP-server tools when "tool search" is explicitly enabled. Our `ToolSearch` in `context-budget.ts:76-79` is therefore *closer to a Claude Agent SDK pattern* than to the CLI. We are over-engineered here; the simpler form is fine.
- **The Anthropic Memory tool runs client-side: the SDK calls a tool, *your code* persists the file.** This means Claude Code's `/memories` and our `MemoryTool` are at the *same architectural layer* (both are persistence backends) — they just happen to use different APIs. Once we adopt the canonical command names (gap #5), we're plug-compatible.

---

## (1) The exact Agent tool contract

Source: [Subagents](https://code.claude.com/docs/en/sub-agents), [Tools reference](https://code.claude.com/docs/en/tools-reference#agent-tool-behavior), [TypeScript Agent SDK](https://code.claude.com/docs/en/agent-sdk/typescript).

**Tool name**: `Agent` (was `Task` until v2.1.63, kept as alias).

**Two spawn paths**:
- File-based subagent: `.claude/agents/<name>.md` with YAML frontmatter + system-prompt body.
- Inline (SDK / CLI): `claude --agents '{"name":{...}}'` or `agents: { name: { ... } }` option.

**Frontmatter fields (17 total)**, two required:

| Field | Required | Notes |
|---|---|---|
| `name` | yes | lowercase + hyphens, unique within scope |
| `description` | yes | drives delegation; key text |
| `tools` | no | allowlist; `Agent(worker, researcher)` to gate nested spawns |
| `disallowedTools` | no | denylist; merged with `tools` (denylist wins) |
| `model` | no | `sonnet` / `opus` / `haiku` / full id / `inherit` (default) |
| `permissionMode` | no | `default` / `acceptEdits` / `auto` / `dontAsk` / `bypassPermissions` / `plan` |
| `maxTurns` | no | per-subagent turn ceiling |
| `skills` | no | preload skill content at startup |
| `mcpServers` | no | inline `stdio/http/sse/ws` or reference by name |
| `hooks` | no | lifecycle-scoped hooks (auto-converts `Stop` → `SubagentStop`) |
| `memory` | no | `user` / `project` / `local` — persistent dir at `~/.claude/agent-memory/<name>/` |
| `background` | no | `true` = always async |
| `effort` | no | `low/medium/high/xhigh/max` |
| `isolation` | no | `worktree` → temp git worktree, auto-cleaned if no changes |
| `color` | no | `red/blue/green/yellow/purple/orange/pink/cyan` |
| `initialPrompt` | no | auto-submitted as first user turn when run as main session |
| `argument-hint` / `arguments` | no | for $ARGUMENTS-style invocation |

**Spawn precedence (5 scopes)**:
1. Managed settings (highest)
2. `--agents` CLI / SDK inline
3. Project `.claude/agents/`
4. User `~/.claude/agents/`
5. Plugin `agents/` (lowest, namespaced as `plugin:name`)

**Resolution order for `model` parameter**:
1. `CLAUDE_CODE_SUBAGENT_MODEL` env var
2. per-invocation `model`
3. frontmatter `model`
4. main conversation's model

**Foreground vs background**:
- **Foreground**: blocks parent; permission prompts bubble up.
- **Background**: runs concurrently; pre-granted permissions only; auto-denies anything that would prompt.

**Forked subagents (`CLAUDE_CODE_FORK_SUBAGENT=1`, v2.1.117+)** inherit the *full conversation*, share the prompt cache, always run in the background, and replace general-purpose spawns. Subagents cannot spawn further subagents. Forks cannot spawn forks.

**`SendMessage` tool (experimental, `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`)** resumes a stopped subagent by `agent_id` without re-spawning. Transcripts live at `~/.claude/projects/{project}/{sessionId}/subagents/agent-{agentId}.jsonl`.

### Comparison to our `spawn_sub_md`

- **Baseline**: `decision.ts:44-50` defines `SubMdSpawn { subMdId; scope; initialInput; sloId? }`. The `dispatcher` (interface only — no concrete in `index.ts`) is expected to handle it.
- **What's missing**:
  - No `tools`/`disallowedTools` allowlist field on `SubMdSpawn`.
  - No `model` / `effort` / `permissionMode` per-spawn.
  - No `background: boolean` (we declared `fireAndForget` in the brief but the type doesn't include it).
  - No `isolation: 'worktree'` for sandboxed execution against a clean tree.
  - No `parent_tool_use_id` correlation field — debugging multi-MD threads will be painful.
- **What we have that they don't**: typed `scope: ScopeContext` (their `cwd` is plain string) and an `sloId` benchmark hook (no analogue in Claude Code).

---

## (2) Hook system spec — full enumeration

Source: [Hooks](https://code.claude.com/docs/en/hooks).

### All 29 hook events

| Event | Matcher | Can block? | Our equivalent |
|---|---|---|---|
| `SessionStart` | `startup`/`resume`/`clear`/`compact` | no | — |
| `Setup` | `init`/`maintenance` | no | — |
| `UserPromptSubmit` | none | YES | — |
| `UserPromptExpansion` | command name | YES | — (slash commands not modeled) |
| `PreToolUse` | tool name | YES | `pre-tool-use` ✓ |
| `PermissionRequest` | tool name | YES | partially — `permission-hook.ts` |
| `PermissionDenied` | tool name | no | — |
| `PostToolUse` | tool name | YES | `post-tool-use` ✓ |
| `PostToolUseFailure` | tool name | YES | — |
| `PostToolBatch` | none | YES | — (we run sequentially) |
| `Stop` | none | YES | `stop` ✓ |
| `StopFailure` | error type | no | — |
| `SubagentStart` | agent type | no | — |
| `SubagentStop` | agent type | no | — |
| `TaskCreated` | none | YES | — |
| `TaskCompleted` | none | YES | partial — `plan.advance` |
| `TeammateIdle` | none | YES | — |
| `Notification` | notification type | no | — |
| `CwdChanged` | none | no | — |
| `FileChanged` | literal filenames | no | — |
| `ConfigChange` | config source | YES | — |
| `InstructionsLoaded` | load reason | no | — |
| `PreCompact` | `manual`/`auto` | YES | — (`context-budget.ts` compacts unconditionally) |
| `PostCompact` | `manual`/`auto` | no | — |
| `Elicitation` | MCP server name | YES | — |
| `ElicitationResult` | MCP server name | YES | — |
| `WorktreeCreate` | none | YES | — |
| `WorktreeRemove` | none | no | — |
| `SessionEnd` | end reason | no | — |

We have **3 of 29 hook stages**. The richer surface is what makes Claude Code's governance story believable: every state transition has a deterministic interception point.

### PreToolUse JSON output schema

```json
{
  "continue": true,
  "stopReason": "Build failed",
  "suppressOutput": false,
  "systemMessage": "Warning: operation risky",
  "decision": "block",
  "reason": "Policy violation",
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "allow|deny|ask|defer",
    "permissionDecisionReason": "...",
    "updatedInput": { "command": "safer-command" },
    "additionalContext": "Injected for Claude"
  }
}
```

Note four things our `HookResult` ADT does not capture (`hook-chain.ts:29-38`):
1. **`permissionDecision: "defer"`** — pause without blocking; defer is distinct from `ask`.
2. **`updatedInput`** — rewrite tool arguments without changing the decision.
3. **`additionalContext`** — inject a message into the model's view without changing the decision.
4. **`continue: false` + `stopReason`** — abort the entire turn (not just this tool call) with a user-facing message.

### Hook configuration format (settings.json)

```json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "Bash|Edit",
      "hooks": [{
        "type": "command|http|mcp_tool|prompt|agent",
        "if": "Bash(git *)",
        "timeout": 600,
        "statusMessage": "Validating...",
        "command": "./.claude/hooks/check.sh",
        "shell": "bash"
      }]
    }]
  }
}
```

Five hook types: `command` (stdin/stdout JSON), `http` (POST/response), `mcp_tool` (calls an MCP server tool), `prompt` (LLM-evaluated yes/no), `agent` (subagent with Read/Grep/Glob).

The `if` field accepts permission-rule syntax (`Bash(rm *)`, `Edit(*.ts)`), so a single hook entry can target a sub-slice of one tool's call space. Our `ScopeFilter` (`hook-chain.ts:67-71`) only filters by tool name and tier — no rule-syntax `if`.

### Matchers vs `if`

- **Matcher**: filters by tool name (or event-specific key like `startup`).
  - Bare `*`, `""`, or omitted = match all.
  - Alphanumeric + `|` = exact list (`Bash|Edit`).
  - Anything else = JS regex (`mcp__.*__write.*`).
- **`if`**: narrows further using permission rules (`Bash(rm *)`).

### Exit codes (command hooks)

| Code | Semantics |
|---|---|
| 0 | success; parse JSON output if any |
| 2 | blocking error (event-specific behavior) |
| other | non-blocking; stderr surfaced |

For `PreToolUse`, exit 2 → tool call prevented.
For `Stop`, exit 2 → prevents stopping (forces continue).
For `PostToolUse`, exit 2 → stderr shown to Claude (tool already ran).

This 0/2 convention is dramatically simpler than our `HookResult` union, and is the substrate users will pull off the shelf when writing scripts.

### Hooks in skills/agents

Skill/Agent frontmatter can carry hooks scoped to the component lifecycle:
```yaml
---
name: code-reviewer
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "./scripts/validate.sh"
---
```

These auto-clean when the component finishes. `Stop` in agent frontmatter auto-converts to `SubagentStop`. `once: true` is honored only in frontmatter, ignored in settings.

---

## (3) Skills format + matching algorithm

Source: [Skills](https://code.claude.com/docs/en/skills).

### SKILL.md frontmatter (17 fields)

```yaml
---
name: my-skill                       # default = directory name
description: <recommended>           # used for matching
when_to_use: <appended to description>
argument-hint: "[issue-number]"
arguments: [issue, branch]           # named positional args
disable-model-invocation: false      # true = only user can invoke
user-invocable: true                 # false = only Claude can invoke
allowed-tools: Read Grep             # pre-approved tools while skill active
model: sonnet | opus | haiku | claude-opus-4-7 | inherit
effort: low | medium | high | xhigh | max
context: fork                        # run in forked subagent
agent: Explore                       # which subagent type for fork
hooks:                               # skill-lifecycle hooks
  PreToolUse: [...]
paths: ["src/**/*.ts"]               # auto-activate when matching files in scope
shell: bash | powershell             # for !`cmd` substitutions
---
```

Plus four invocation control matrices:

| Frontmatter | User can invoke | Claude can invoke | In context |
|---|---|---|---|
| default | yes | yes | description always + full on invoke |
| `disable-model-invocation: true` | yes | no | only on invoke |
| `user-invocable: false` | no | yes | description always + full on invoke |

### Dynamic-context injection

\`` !`<command>` `` runs shell commands BEFORE Claude sees the skill content. The output is substituted in-place. ` ```!\nmulti-line\n``` ` fenced form also supported. Substitution is single-pass.

### String substitutions

- `$ARGUMENTS` — full arg string
- `$ARGUMENTS[N]` / `$N` — 0-indexed positional
- `$name` — named via `arguments:` list
- `${CLAUDE_SESSION_ID}` / `${CLAUDE_EFFORT}` / `${CLAUDE_SKILL_DIR}`

### Skill content lifecycle

Once invoked, SKILL.md content enters as a single message and STAYS for the rest of the session. On auto-compaction, the **first 5,000 tokens** of each invoked skill are re-attached after the summary, sharing a combined 25,000-token budget across all re-attached skills.

### Matching algorithm

There is no fuzzy/embedding match. Claude reads each skill's `description + when_to_use` (capped at 1,536 chars combined) and picks based on its own LLM judgment. Two budget caps:
- 1% of model's context window for the *skill listing* (overridable via `skillListingBudgetFraction`).
- 1,536 chars per skill description (overridable via `maxSkillDescriptionChars`).

When the budget overflows, the least-invoked skills' descriptions are dropped first.

### Skill permission rules

- `Skill(name)` — exact match
- `Skill(name *)` — prefix match with arguments
- `Skill` (bare, in deny) — block all skills

A few built-ins available through `Skill`: `/init`, `/review`, `/security-review`. `/compact` is NOT.

### Comparison to our `skill.ts`

`skill.ts:37-44` ships a much smaller manifest:
```typescript
interface SkillManifest {
  name, description, whenToUse, toolsAllowed, tier, body
}
```

Missing fields (vs Claude Code): `disable-model-invocation`, `user-invocable`, `model`, `effort`, `context`, `agent`, `hooks`, `paths`, `argument-hint`, `arguments`, `shell`. Our `tier: 'free' | 'pro' | 'enterprise'` is a BOSSNYUMBA-specific extension — fine, but it conflicts with the open Agent-Skills standard (https://agentskills.io).

Our `executeSkill` (`skill.ts:134-160`) always runs *inline* (no `context: fork`), never re-evaluates frontmatter at invocation, and has no $ARGUMENTS substitution. The whole "skill content lives in context for the session" semantic is also absent — we treat it as a one-shot.

---

## (4) Plan Mode + ExitPlanMode

Source: [Permission modes](https://code.claude.com/docs/en/permission-modes), [Tools reference](https://code.claude.com/docs/en/tools-reference).

### Plan-mode contracts

**Entering**: `EnterPlanMode` tool, Shift+Tab cycle, `--permission-mode plan`, or `/plan <prompt>` prefix. **Permission Required: No**.

**Exiting**: `ExitPlanMode` tool. **Permission Required: Yes**. Presents plan for approval. Five approve options:
1. Approve + start in `auto` mode
2. Approve + `acceptEdits`
3. Approve + review each edit
4. Keep planning with feedback
5. Refine with Ultraplan

`Ctrl+G` opens the plan in the OS editor before approval. With `showClearContextOnPlanAccept`, each option additionally clears context.

### What's blocked in Plan Mode

Plan mode is **read-only**: file edits blocked. Reads + non-edit Bash explorations allowed. Permission prompts still apply as in `default`. The dedicated subagent for Plan mode is `Plan` (read-only, inherits parent model).

### Plan-mode as a session default

```json
{ "permissions": { "defaultMode": "plan" } }
```

Accepting a plan exits plan mode AND switches to the chosen approve-mode for the rest of the session.

### Our equivalent

We have a `Plan` ADT (`plan.ts:32-37` — the mdr_plan tree) but no *plan-mode permission-mode*. The MD always runs in "execute" mode. This means we cannot have the model deliberate over a multi-step procedure WITHOUT being able to actuate it — a critical safety property for high-stakes tenant-facing actions.

**Cost to close**: medium. Add a `PermissionMode` enum at orchestrator level + plumb it through `dispatch` so destructive Decisions are short-circuited in `plan` mode. The bones are there (`plan.ts:54-61` already tracks `currentGoal`, `isComplete`).

---

## (5) Permission system / auto-accept

Source: [Permissions](https://code.claude.com/docs/en/permissions).

### Rule grammar

`Tool` or `Tool(specifier)`. Evaluation order: **deny → ask → allow** (deny always wins). Deny-from-any-scope overrides allow-from-any-scope.

### Bash matching

- `Bash(npm run build)` — exact match.
- `Bash(npm run *)` — wildcard. `*` matches any chars including spaces.
- `Bash(ls *)` (space before `*`) — enforces word boundary: matches `ls -la`, NOT `lsof`.
- `Bash(ls*)` (no space) — matches both.
- `Bash(ls:*)` — equivalent to trailing ` *`.
- Compound commands (`&&`, `||`, `;`, `|`, `|&`, `&`, newline) — **each subcommand evaluated independently**. Approving `git status && npm test` saves a rule for `npm test`.
- Process wrappers stripped: `timeout`, `time`, `nice`, `nohup`, `stdbuf`, bare `xargs` (no flags). NOT stripped: `watch`, `setsid`, `ionice`, `flock`, `find -exec`.
- Dev-env runners like `devbox run`, `direnv exec`, `npx`, `docker exec` are NOT stripped — must write explicit rules per inner command.
- Built-in read-only commands (no prompt regardless of mode): `ls`, `cat`, `echo`, `pwd`, `head`, `tail`, `grep`, `find`, `wc`, `which`, `diff`, `stat`, `du`, `cd`, read-only `git`.

### Read/Edit gitignore-style paths

| Pattern | Meaning |
|---|---|
| `//path` | absolute from filesystem root |
| `~/path` | home-relative |
| `/path` | project-root-relative |
| `path` or `./path` | cwd-relative |
| `**/file` | recursive (gitignore) |
| `*.ts` | single-directory glob |

**`/Users/alice/file` is NOT absolute** — it's project-rooted. Common pitfall.

Symlinks: allow rules require BOTH symlink AND target to match; deny rules trigger on EITHER.

### MCP rules

- `mcp__server` — all tools from `server`
- `mcp__server__*` — same with explicit wildcard
- `mcp__server__tool` — specific tool

### Agent rules

`Agent(Explore)`, `Agent(my-custom)`, `Agent` (all). Bare `Agent` in `tools:` allowlist allows ANY subagent spawn; `Agent()` allows none.

### Six permission modes (`PermissionMode`)

| Mode | What runs without asking |
|---|---|
| `default` | reads only |
| `acceptEdits` | reads + file edits + common FS Bash (`mkdir`, `mv`, `cp`, …) |
| `plan` | reads only |
| `auto` | everything, with background classifier reviewing each call |
| `dontAsk` | only pre-approved tools (ask-rules denied) |
| `bypassPermissions` | everything; ONLY safe in sandboxed envs |

In `auto` mode, broad `Bash(*)`/`PowerShell(*)` allow rules are AUTOMATICALLY dropped to prevent classifier bypass.

### Settings precedence (5 layers)

1. Managed settings (highest; cannot be overridden)
2. CLI args
3. `.claude/settings.local.json` (gitignored)
4. `.claude/settings.json` (committed)
5. `~/.claude/settings.json` (lowest)

### Protected paths (write-blocked in every mode except `bypassPermissions`)

Directories: `.git`, `.vscode`, `.idea`, `.husky`, `.claude` (except `commands/`, `agents/`, `skills/`, `worktrees/`).

Files: `.gitconfig`, `.gitmodules`, `.bashrc`, `.bash_profile`, `.zshrc`, `.zprofile`, `.profile`, `.ripgreprc`, `.mcp.json`, `.claude.json`.

In `bypassPermissions`, root removals (`rm -rf /`, `rm -rf ~`) still prompt as a circuit breaker.

### Our equivalent

`hooks/pre-tool-use/permission-hook.ts` + scope checks in `awareness-scopes.ts` (per `git status`). We have:
- Scope-tier-based grants (`tenant`, `lease`, `unit`, `block`, `property`, `portfolio`, `org`, `industry`) — RICHER than Claude Code's 4-tier (user/project/local/managed) for *property-management* domain, but with no notion of plan/auto/bypass MODES at all.
- No `additionalDirectories` analogue (we don't have a tree-walking working dir model — our scope tree IS the working dir).
- No "deny-wins-always" evaluation order; permissions are just one hook in the chain.
- No symlink double-check.
- No process-wrapper stripping.

The mode dimension (`default`/`acceptEdits`/`plan`/`auto`/`dontAsk`/`bypassPermissions`) is COMPLETELY absent from our orchestrator. **Closing cost**: MEDIUM. **Value**: HIGH (regulatory; tenant-MD will require `default`/explicit-approve in some markets).

---

## (6) TodoWrite + statusline + slash commands + sub-agents

### TodoWrite → Task* tools

Source: [Tools reference](https://code.claude.com/docs/en/tools-reference).

`TodoWrite` is **deprecated**. Replaced by `TaskCreate`, `TaskGet`, `TaskList`, `TaskUpdate`, `TaskStop`. Interactive sessions already use Task tools by default; `claude -p` and Agent SDK still default to TodoWrite (toggle via `CLAUDE_CODE_ENABLE_TASKS=1`).

**Task* contracts** are *graph-shaped*: tasks support dependencies (a pending task with unresolved deps cannot be claimed). File-locked claiming prevents race conditions in agent teams.

Our `Plan` (`plan.ts:32-37` — PlanGoal with subGoals, `status` enum `pending/active/complete/rejected`) is structurally a subset of the Task graph. We lack:
- Explicit dependency edges (we only have parent/child)
- File-locked claim semantics (irrelevant single-thread, critical multi-MD)
- `TaskOutput`/`TaskStop` for background tasks (we have `MonitorWatch` only)

### Status line

Source: [Statusline](https://code.claude.com/docs/en/statusline).

A shell command receives JSON on stdin and prints to stdout. Updates fire after each assistant message, after `/compact`, on permission-mode change, on vim-mode toggle. Debounced 300ms.

**Available data fields (28)** include:
- `model.{id, display_name}`
- `cwd`, `workspace.{current_dir, project_dir, added_dirs, git_worktree}`
- `cost.{total_cost_usd, total_duration_ms, total_api_duration_ms, total_lines_added, total_lines_removed}`
- `context_window.{total_input_tokens, total_output_tokens, context_window_size, used_percentage, remaining_percentage, current_usage{input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens}}`
- `exceeds_200k_tokens`
- `effort.level`, `thinking.enabled`
- `rate_limits.{five_hour, seven_day}.{used_percentage, resets_at}`
- `session_id`, `session_name`, `transcript_path`, `version`
- `output_style.name`, `vim.mode`
- `agent.name`, `worktree.{name, path, branch, original_cwd, original_branch}`

**Settings registration**:
```json
{
  "statusLine": {
    "type": "command",
    "command": "~/.claude/statusline.sh",
    "padding": 2,
    "refreshInterval": 5,
    "hideVimModeIndicator": false
  }
}
```

We have no statusline at all. The owner UI in our codebase (Phase E.7) is custom — it doesn't dogfood the Claude Code statusline JSON shape. If we plan to ship the MD as an SDK consumer, we should consider emitting this JSON shape natively from our orchestrator so any Claude-Code-aware status-line script just works.

### Slash commands

Source: confirmed in [Skills](https://code.claude.com/docs/en/skills): "**Custom commands have been merged into skills.** A file at `.claude/commands/deploy.md` and a skill at `.claude/skills/deploy/SKILL.md` both create `/deploy` and work the same way."

So slash commands ARE skills (no separate spec). `.claude/commands/` is legacy-supported; new code should use `.claude/skills/<name>/SKILL.md`.

### Sub-agents (file format)

See section (1). Key file location: `.claude/agents/<name>.md` with YAML frontmatter + system-prompt body. Discovery walks up from cwd. CLI-only via `--agents '{...}'` JSON. Worktree isolation via `isolation: worktree`.

---

## (7) MCP spec deep dive

Source: [MCP spec 2025-06-18](https://modelcontextprotocol.io/specification/2025-06-18), [Tools](https://modelcontextprotocol.io/specification/2025-06-18/server/tools), [Transports](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports).

### Three primitive surfaces (server → client)

| Primitive | Purpose | Discovery method | Invocation |
|---|---|---|---|
| **Resources** | data/context the user or model can consume | `resources/list` | `resources/read` |
| **Prompts** | templated user-workflow messages | `prompts/list` | `prompts/get` |
| **Tools** | functions the model can execute | `tools/list` | `tools/call` |

### Three primitive surfaces (client → server)

- **Sampling** — server requests an LLM completion from the client.
- **Roots** — server asks "what URIs/paths am I allowed to operate on?"
- **Elicitation** — server requests structured input from the user.

### Transports (only 2 standard, custom permitted)

- **stdio** — subprocess; JSON-RPC newline-delimited on stdin/stdout; stderr is for logs.
- **Streamable HTTP** — single endpoint supporting POST + GET. POST is one JSON-RPC message; response is `application/json` or `text/event-stream` SSE stream. GET opens an SSE stream for server-pushed messages. Mcp-Session-Id header for session management.

The 2024-11-05 HTTP+SSE transport is deprecated but maintained for back-compat.

### Tool definition shape

```json
{
  "name": "get_weather",
  "title": "Weather Information Provider",
  "description": "...",
  "inputSchema": { "type": "object", ... },
  "outputSchema": { "type": "object", ... },
  "annotations": { ... }
}
```

**Annotations are UNTRUSTED unless from a trusted server.** Tool results can be:
- **Unstructured** content array: `text`, `image`, `audio`, `resource_link`, `resource` (embedded).
- **Structured**: `structuredContent` JSON validated against `outputSchema`.

### Two error models

1. **Protocol errors**: JSON-RPC `error` with code (e.g. `-32602` for invalid args).
2. **Tool execution errors**: result with `isError: true` (the tool ran but reported failure).

### MCP server config in Claude Code (.mcp.json + settings)

```json
{
  "mcpServers": {
    "github": {
      "type": "stdio",
      "command": "uvx",
      "args": ["mcp-server-github"],
      "env": { "TOKEN": "..." }
    },
    "remote": {
      "type": "sse",
      "url": "https://example.com/mcp",
      "headers": { "Authorization": "Bearer ${TOKEN}" }
    }
  },
  "allowedMcpServers": [{ "serverName": "github" }],
  "deniedMcpServers": [{ "serverName": "filesystem" }],
  "enabledMcpjsonServers": ["memory", "github"]
}
```

Tool naming: `mcp__<server>__<tool>`. Permission rules accept that exact string.

### Comparison to our MCP process-intel server

We have an MCP server in Phase E.2 process-intel (referenced in the gap-closure task description) but it speaks our internal tool registry, not the MCP JSON-RPC protocol. **It is not actually MCP-compatible** as a *server* a Claude Code client could discover and use. To make it so we'd need:
- A `tools/list` endpoint returning `{name, description, inputSchema, annotations}` per tool.
- `tools/call` JSON-RPC dispatch returning `{content: [...], isError: bool}`.
- Stdio or Streamable HTTP transport with framing per spec.

We do NOT need to expose Resources or Prompts (Tools alone is a valid server). We DO need to declare `tools: { listChanged: true }` capability in our `initialize` handshake.

**Closing cost**: MEDIUM (write the JSON-RPC framing + capability registry). **Value**: HIGH (this is the path to letting any Claude Code user point their CLI at BOSSNYUMBA's domain tools).

---

## (8) Agent SDK — query() + lifecycle hooks + Memory tool + Batch + Cache

Source: [Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview), [Python SDK](https://code.claude.com/docs/en/agent-sdk/python), [TypeScript SDK](https://code.claude.com/docs/en/agent-sdk/typescript).

### `query()` signature

**Python**:
```python
async def query(*, prompt, options=None, transport=None) -> AsyncIterator[Message]
```

**TypeScript**:
```typescript
function query({ prompt, options }: { prompt; options? }): Query
```

Returns an async generator that yields `SDKMessage` events. The `Query` object has methods like `interrupt()`, `setPermissionMode()`, `setModel()`, `mcpServerStatus()`, `rewindFiles()` (file checkpointing!), `applyFlagSettings()`.

### Options surface (TypeScript — ~50 fields)

Most relevant for us:
- `tools`/`allowedTools`/`disallowedTools`
- `systemPrompt: string | { type: 'preset'; preset: 'claude_code'; append; excludeDynamicSections }`
- `model`/`fallbackModel`
- `mcpServers: Record<string, McpServerConfig>` with `stdio|sse|http|sdk` types
- `agents: Record<string, AgentDefinition>`
- `hooks: Partial<Record<HookEvent, HookCallbackMatcher[]>>`
- `canUseTool: CanUseTool` — programmatic permission callback
- `permissionMode`
- `continue`/`resume`/`forkSession`/`sessionId`/`sessionStore`
- `maxTurns`/`maxBudgetUsd`
- `thinking: ThinkingConfig`
- `effort: 'low'|'medium'|'high'|'xhigh'|'max'`
- `skills: string[] | 'all'`
- `plugins: SdkPluginConfig[]`
- `outputFormat: { type: 'json_schema'; schema: JSONSchema }`
- `sandbox: SandboxSettings`
- `additionalDirectories`, `cwd`, `env`, `extraArgs`
- `settings`/`settingSources`/`includePartialMessages`/`includeHookEvents`

### Hook events available to the SDK (19)

PreToolUse, PostToolUse, PostToolUseFailure, PostToolBatch, Notification, UserPromptSubmit, SessionStart, SessionEnd, Stop, SubagentStart, SubagentStop, PreCompact, PermissionRequest, Setup, TeammateIdle, TaskCompleted, ConfigChange, WorktreeCreate, WorktreeRemove.

(Note: the Python SDK lists 6 — `PreToolUse`, `PostToolUse`, `PrePrompt`, `PostPrompt`, `PreAgentInvoke`, `PostAgentInvoke` — which is a *narrower* historical surface. The TS SDK is the source of truth as of v2.1.x.)

### CanUseTool callback (TypeScript)

```typescript
type CanUseTool = (
  toolName: string,
  input: Record<string, unknown>,
  options: { signal, suggestions, blockedPath, decisionReason, toolUseID, agentID? }
) => Promise<
  | { behavior: 'allow'; updatedInput?; updatedPermissions?; toolUseID? }
  | { behavior: 'deny'; message; interrupt?; toolUseID? }
>;
```

Note: `updatedInput` IS supported here (the gap we flagged in section 2). The discrepancy is that our PreToolUse hook can return `transform`-with-a-new-Decision but cannot return `allow`-with-a-different-input. Adding it is a one-variant patch.

### Memory tool (Anthropic API tool, NOT the Claude Code "auto memory")

Source: [Memory tool](https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool).

**Tool name string**: `memory_20250818`.

**Six client-side commands** (your app implements; Claude calls them):

| Command | Params | Behavior |
|---|---|---|
| `view` | `path`, optional `view_range: [start, end]` | List dir (2 levels deep) or file contents with line numbers |
| `create` | `path`, `file_text` | New file; errors if exists |
| `str_replace` | `path`, `old_str`, `new_str` | Exact-match replace; errors on no-match or multi-match |
| `insert` | `path`, `insert_line`, `insert_text` | Insert at 1-indexed line |
| `delete` | `path` | Recursive for dirs |
| `rename` | `old_path`, `new_path` | No overwrite |

**Return string formats are specified verbatim** — model-trained to expect "Here're the files and directories up to 2 levels deep…" prefix.

**Security**: path traversal protection is *the client's responsibility*. Validate all paths start with `/memories`. Reject `../`, `..\\`, URL-encoded variants. Use `pathlib.Path.resolve()` + `relative_to()`.

**Auto-injected system prompt** when memory enabled:
> IMPORTANT: ALWAYS VIEW YOUR MEMORY DIRECTORY BEFORE DOING ANYTHING ELSE.
> MEMORY PROTOCOL:
> 1. Use the `view` command…
> 2. ...work on task...
> ASSUME INTERRUPTION: Your context window might be reset at any moment.

**Pairs with**: server-side compaction. Compaction summarizes server-side; memory persists across compaction boundaries.

### Our `memory-tool.ts` vs the canonical spec

| Aspect | Our impl | Anthropic spec |
|---|---|---|
| Tool name | (internal port; no tool name) | `memory_20250818` |
| Operations | `recall`/`read`/`write`/`list`/`delete` | `view`/`create`/`str_replace`/`insert`/`delete`/`rename` |
| Path scoping | `/memories/thread_{threadId}/` | `/memories` (you choose subdirs) |
| Return format | Generic `MemoryEntry`/`MemoryRecallResult` | Specific prefix strings the model is trained on |
| `str_replace` | absent | required for editing memories without full rewrite |
| `rename` | absent | required for "promote scratch to plan" pattern |
| `insert at line` | absent | required for incremental progress logs |
| Auto-prompt | none | client must inject the protocol prompt |

**Closing cost**: LOW (one file). **Value**: HIGH (becomes drop-in for the Anthropic API tool; the MD's working notebook becomes interchangeable with how Claude Code stores memories).

### Prompt caching

Source: [Prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching).

- **4-breakpoint cap** per request via `cache_control: { type: "ephemeral", ttl: "5m" | "1h" }`.
- **5m TTL**: default; 1.25× write cost; cache reads 0.1× input.
- **1h TTL**: 2× write cost; not on Bedrock.
- **20-block lookback** per breakpoint.
- Place breakpoint on the LAST identical-across-requests block (not the last block overall).
- Place cache_control on last tool in `tools[]` to cache the whole tool definition.
- Long-TTL breakpoints must come BEFORE shorter-TTL ones.
- Cache invalidators (any one of these resets the cache):
  - Tool definitions changed
  - Web search/citations/speed setting toggled
  - Tool choice changed (messages only)
  - Images added/removed (messages only)
  - Thinking parameters changed (messages only)
- Minimum cacheable: 4,096 tokens (Opus 4.5/4.6/4.7, Haiku 4.5), 1,024 tokens (Sonnet 4.5/4.6).
- Pre-warming: send `max_tokens: 0` with the system prompt + cache_control to seed the cache before user traffic.

We have **zero prompt caching wiring** in the orchestrator. The `LLMRouterCall` shape (`main-loop.ts:89-93`) is bare `{system, tools, messages}` with no `cache_control` field. Closing this is the biggest cost win available.

### Extended thinking

Source: [Extended thinking](https://platform.claude.com/docs/en/build-with-claude/extended-thinking).

```json
{
  "thinking": {
    "type": "enabled" | "disabled" | "adaptive",
    "budget_tokens": 10000,
    "display": "summarized" | "omitted"
  }
}
```

- **`adaptive`** is REQUIRED on Opus 4.7 (manual `enabled` returns 400).
- `budget_tokens` < `max_tokens`. Cannot combine with `max_tokens: 0` (pre-warming).
- Charged for full thinking tokens regardless of display mode. Visible response ≠ billed output.
- **Cannot use `tool_choice: any` or forced tool selection** when thinking is on.
- Thinking blocks from previous turns MUST be passed back unmodified with tool_use → tool_result chains.
- Changing thinking params invalidates message cache (but not system cache).

We don't expose a thinking parameter at all. The MD always runs at constant effort. **Closing cost**: LOW. **Value**: MEDIUM (per-Decision dial; high-stakes Decisions get deeper reasoning at 5× cost).

### Batch API

Source: We already have a wrapper (`batch-api.ts`). The shape we ship is provider-agnostic — drop-in for Anthropic's `/v1/messages/batches` with the standard 24h SLA + 50% cost discount.

What's missing from our wrapper: explicit support for the 300k batch-output beta header for thinking models. Minor.

---

## (9) Computer Use, Citations, Extended Thinking

### Computer Use (not deeply researched here — not central to MD orchestrator)

Tool name: `computer_20250124` (with platform-specific variants). Captures screenshots, sends mouse/keyboard events. Supported on `claude-sonnet-4-*` and `claude-opus-4-*`. Currently US-only; requires explicit beta header.

**Not relevant** to BOSSNYUMBA in the short term unless we end up driving owner UIs via a headless browser as part of a verification step. Flagging for completeness; no action.

### Citations

When tool results include `<citation>`-tagged content or document blocks, the model can return `citations` field referencing them. We do not surface citations in our `Decision` ADT (`decision.ts:79-104`) beyond a `citations?: ReadonlyArray<string>` on `respond_to_owner` — but the Anthropic shape is richer: `{ type: "doc" | "url" | "page_location" | "char_location"; cited_text; ... }`.

If we want to ship the regulator-grade audit story, we should adopt the typed citation shape. **Closing cost**: LOW. **Value**: HIGH for compliance markets.

### Extended Thinking

Already covered in section 8.

---

## (10) Gap map — BOSSNYUMBA MD vs Claude Code

Reading: ✓ = present and faithful; ◐ = partial; ✗ = missing.

| Claude Code feature | Status | Evidence in our code |
|---|---|---|
| Main loop with budget + plan-complete exit predicate | ✓ | `main-loop.ts:131-274` |
| Budget on 4 axes (turns, tokens, tool-calls, wall-ms) | ✓ | `budget.ts:34-39` |
| Plan tree with `pending/active/complete/rejected` | ✓ | `plan.ts:22-37` |
| Per-decision Checkpoint + SessionStore | ✓ | `checkpoint.ts:31-64` |
| Context-budget compaction at 80% threshold | ✓ (heuristic only) | `context-budget.ts:101-132` |
| ToolSearch deferred-tool primitive | ✓ (over-engineered — see contrarian #2) | `context-budget.ts:67-79` |
| `/memories` Anthropic tool (file scratchpad) | ◐ (wrong API shape) | `memory-tool.ts:47-54` |
| SKILL.md frontmatter parser | ◐ (5 of 17 fields) | `skill.ts:37-44` |
| SKILL.md `paths:` glob auto-activation | ✗ | — |
| SKILL.md `context: fork` (skill-in-subagent) | ✗ | — |
| SKILL.md `disable-model-invocation` / `user-invocable` | ✗ | — |
| SKILL.md `$ARGUMENTS` / `$N` substitution | ✗ | — |
| SKILL.md dynamic-context injection (`` !`cmd` ``) | ✗ | — |
| Anthropic Batch API wrapper | ✓ | `batch-api.ts:65-92` |
| Hook chain (Pre/Post/Stop) | ◐ (3 of 29 events) | `hook-chain.ts:101` |
| Hook ADT (`allow`/`deny`/`ask`/`sandbox`/`transform`) | ◐ (no `defer`, `updatedInput`, `additionalContext`) | `hook-chain.ts:29-38` |
| Decision ADT 6 variants | ◐ (no AskUserQuestion form-fields) | `decision.ts:79-104` |
| Skills allowed-tools pre-approval | ◐ (no scope-trust dialog model) | `skill.ts:140-144` |
| Sub-agent spawning | ◐ (no `tools`/`model`/`isolation` per spawn) | `decision.ts:44-50` |
| Background sub-agents | ✗ (we set `fireAndForget` but type doesn't include it) | — |
| Forked sub-agents (inherit conversation) | ✗ | — |
| `worktree` isolation | ✗ | — |
| Agent Teams (TeamCreate/SendMessage shared task list) | ✗ | — |
| `--agent` (run main thread AS subagent) | ✗ | — |
| `permissionMode` (default/acceptEdits/auto/plan/dontAsk/bypassPermissions) | ✗ | — |
| Plan Mode + `ExitPlanMode` | ✗ | — |
| Permission rule syntax (`Bash(npm test:*)`, `Edit(*.ts)`) | ✗ (we use scope tiers instead) | — |
| Permission deny-first evaluation order | ✗ | — |
| Symlink double-checking | ✗ | — |
| Process-wrapper stripping | ✗ | — |
| Read-only Bash allowlist | ✗ | — |
| Protected paths (`.git`, `.claude`, etc.) | ✗ | — |
| Statusline JSON output | ✗ | — |
| Slash commands / `.claude/commands/` | ✗ | — |
| `CLAUDE.md` auto-load + import (`@path`) | ✗ | — |
| Auto memory (Claude writes notes itself) | ✗ | — |
| `MEMORY.md` 200-line / 25KB cap | ✗ | — |
| `claude --teleport` / sessions across surfaces | ✗ | — |
| Channels (push events into session) | ✗ | — |
| Routines / `/schedule` / cloud cron | ✗ (we have wake-loop) | — |
| `/loop` (model self-paces) | ◐ (`schedule_wake` covers it) | `decision.ts:57-62` |
| `CronCreate`/`CronList`/`CronDelete` | ✗ | — |
| Monitor tool (background stream) | ◐ (`monitor` decision exists; no actual streaming) | `decision.ts:69-73` |
| PushNotification tool | ✗ | — |
| TaskCreate/TaskGet/TaskList/TaskUpdate/TaskStop | ◐ (our Plan is goal tree, not file-locked task graph) | `plan.ts:54-61` |
| `EnterWorktree`/`ExitWorktree` | ✗ | — |
| MCP server (we expose) | ✗ — we have an "MCP-shaped" thing but it's not JSON-RPC | — |
| MCP client (we consume servers) | ✗ | — |
| Prompt caching `cache_control` | ✗ | — |
| Extended thinking parameter | ✗ | — |
| Citations typed output | ◐ (string array) | `decision.ts:79-84` |
| Plugins system (.claude-plugin/plugin.json) | ✗ | — |
| Hook types beyond `command`: `http`, `mcp_tool`, `prompt`, `agent` | ✗ | — |
| Hook `matcher` regex/literal/wildcard | ◐ (we have ScopeFilter, but tool-name only) | `hook-chain.ts:67-71` |
| Hook `if:` permission-rule narrowing | ✗ | — |
| Auto-mode classifier (background-safety LLM) | ✗ | — |
| `auto-mode` boundaries in conversation | ✗ | — |
| Sandboxing (filesystem + network) | ◐ (sandbox-divert hook exists; no OS-level sandbox) | `hooks/pre-tool-use/sandbox-divert-hook.ts` |
| `outputStyle` setting | ✗ | — |
| `effort.level` (`low`..`max`) | ✗ | — |
| `--add-dir` / additional directories | ✗ | — |
| `apiKeyHelper` / `awsCredentialExport` / SSO refresh | ✗ | — |
| `LSP` tool (post-edit type checking) | ✗ | — |
| `disableSkillShellExecution` policy switch | ✗ | — |
| Settings precedence (managed > cli > local > project > user) | ✗ (we have a single tenant→platform chain) | — |
| `--init-only` / `/init` + auto-discovery | ✗ | — |

Coverage scorecard: **~25% feature parity** (8 ✓ + 16 ◐ + 50 ✗ = 74 catalogued).

The good news: the items we have are the load-bearing ones (main loop, budget, plan, hook chain). The missing items are mostly *surface area* (more hook events, more decision variants, more permission modes) rather than *new substrates*.

---

## (11) Closing the gap — Phase E.6 prioritized action list

### Tier 1 — Easy wins (≤ 1 day each)

1. **Rename `MemoryTool` methods to canonical Anthropic shape** (`view/create/str_replace/insert/delete/rename`) AND add the auto-injected memory-protocol system prompt. File: `memory-tool.ts`. Closes gap #5.

2. **Extend `HookResult` ADT** with three new variants: `'allow-with-input-rewrite'`, `'allow-with-context-injection'`, `'continue-false-with-stop-reason'`. File: `hook-chain.ts:29-38`. Closes gaps #2 and #4.

3. **Add `permissionMode` to `OrchestratorRequest`** with `'default'|'acceptEdits'|'plan'|'auto'|'dontAsk'|'bypassPermissions'`. Plumb through `dispatch` so destructive Decisions short-circuit in `plan`. Closes gap from section 4.

4. **Add `AskUserQuestion` Decision variant** with typed `form_fields: Array<{name, type: 'text'|'password'|'select', required, options?}>`. File: `decision.ts:79-104`. Closes gap #3.

5. **Adopt typed citation shape** `{type, cited_text, source_location}` in `Decision.respond_to_owner.citations`. Closes citations gap.

6. **Wire `cache_control` plumbing** through `LLMRouterCall`. Even without choosing breakpoint positions yet, expose the field so the eventual Anthropic adapter can populate it.

7. **Expand `SubMdSpawn`** with `tools?: string[]`, `disallowedTools?: string[]`, `model?: string`, `effort?: EffortLevel`, `permissionMode?: PermissionMode`, `background?: boolean`, `isolation?: 'worktree'`, `parentToolUseId?: string`. File: `decision.ts:44-50`. Closes section 1 gaps.

### Tier 2 — Medium structural shifts (1–3 days each)

8. **Add the 6 missing high-value hook events**: `SessionStart`, `UserPromptSubmit`, `PreCompact`, `PostCompact`, `SubagentStart`, `SubagentStop`. Extend `Hook` ADT. Closes hook-surface gaps most useful for audit.

9. **Build a `PermissionRule` parser** (`Bash(npm run *)`, `Edit(*.ts)`, `Read(./.env)`, `mcp__server__*`, `Agent(name)`, `Skill(name *)`, `WebFetch(domain:...)`). Use it in `permission-hook.ts` and let `Hook.scope` accept `if:` rules. Closes permission-syntax gap.

10. **Extend SKILL.md frontmatter** to cover the remaining 12 fields, especially `disable-model-invocation`, `user-invocable`, `context: fork`, `paths:`, and `allowed-tools` with permission-rule syntax. File: `skill.ts:37-44`. Add `$ARGUMENTS` / `$N` substitution. Closes section 3 gaps.

11. **Implement `ExitPlanMode` tool semantics** as an internal decision route. Plan-mode-aware dispatcher skips file-mutating tools.

12. **Build a statusline JSON emitter** at the orchestrator boundary so any Claude-Code-compatible status-line script can render an MD session. We don't need the script itself — just the field shape.

13. **Implement Plan-graph dependency edges** + file-locked claim semantics in `Plan`. File: `plan.ts:24-30`. Sets up agent-teams compatibility.

14. **Add extended-thinking parameter** to `LLMRouterCall` with `{type: 'adaptive'|'enabled'|'disabled', budget_tokens, display}`. Closes section 8 gap.

15. **Add canonical `protected paths` list** to the permission hook (`.git`, `.claude`, `.gitconfig`, etc.) — keeps the MD from corrupting its own settings.

### Tier 3 — "Ship Claude Code as a library" experiments (1–2 weeks)

16. **Make our process-intel MCP server actually MCP-compatible**: JSON-RPC framing, stdio transport, `tools/list` + `tools/call` + capability negotiation. A Claude Code user could then `claude mcp add bossnyumba ...` and use our tools. Closes section 7 gap.

17. **Build an MCP client adapter** so our orchestrator can consume external MCP servers. The composition root maps `tool_call.toolName === 'mcp__<server>__<tool>'` to a JSON-RPC dispatch. Doubles our integration story overnight.

18. **Build a forked-sub-MD path** that inherits the parent's transcript + cache (mirror `CLAUDE_CODE_FORK_SUBAGENT=1`). Useful for "what would Claude do if it tried X without polluting my context?" experiments — e.g. dry-running a destructive maintenance dispatch.

19. **Build the Plugin system** (`.claude-plugin/plugin.json` with skills/agents/hooks/mcp/lsp/monitors/bin). This is how Phase E.7's Owner UI catalog gets distributable.

20. **Implement Anthropic auto-mode classifier** as a SubLLM (one cheap call per destructive Decision). Closes the biggest safety gap when we ship to non-Pro tenants.

21. **Adopt the Claude Code SETTINGS PRECEDENCE model** (managed > cli > local > project > user) at the orchestrator level. Today our tenant→platform chain is conceptually similar but lacks the cli/local/project distinction owners actually need.

### Won't-fix / explicitly NOT closing

- **Plugin marketplaces** (managed third-party install): infrastructure-heavy, no proximate business value.
- **Routines** (cloud cron): we have our own wake-loop with FX-aware semantics; Claude Code's offering is generic.
- **`--teleport` cross-surface session move**: requires their backend infra; out of scope.
- **Claude in Chrome / Remote Control / Channels (Telegram/Discord)**: distribution layer, not MD-core.
- **Computer Use**: not relevant to property-management MD short-term.

---

## References

### Claude Code core
- https://code.claude.com/docs/en/overview
- https://code.claude.com/docs/en/hooks
- https://code.claude.com/docs/en/settings
- https://code.claude.com/docs/en/sub-agents
- https://code.claude.com/docs/en/skills
- https://code.claude.com/docs/en/permissions
- https://code.claude.com/docs/en/permission-modes
- https://code.claude.com/docs/en/tools-reference
- https://code.claude.com/docs/en/statusline
- https://code.claude.com/docs/en/memory
- https://code.claude.com/docs/en/mcp
- https://code.claude.com/docs/en/agent-teams
- https://code.claude.com/docs/en/scheduled-tasks
- https://code.claude.com/docs/en/plugins
- https://code.claude.com/docs/en/llms.txt (index)

### Claude Agent SDK
- https://code.claude.com/docs/en/agent-sdk/overview
- https://code.claude.com/docs/en/agent-sdk/python
- https://code.claude.com/docs/en/agent-sdk/typescript

### Anthropic platform docs
- https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool
- https://platform.claude.com/docs/en/build-with-claude/prompt-caching
- https://platform.claude.com/docs/en/build-with-claude/extended-thinking

### MCP specification
- https://modelcontextprotocol.io/specification/2025-06-18
- https://modelcontextprotocol.io/specification/2025-06-18/server/tools
- https://modelcontextprotocol.io/specification/2025-06-18/basic/transports

### BOSSNYUMBA baseline (file:line)
- `/packages/central-intelligence/src/kernel/orchestrator/main-loop.ts` (312L)
- `/packages/central-intelligence/src/kernel/orchestrator/decision.ts` (147L)
- `/packages/central-intelligence/src/kernel/orchestrator/hook-chain.ts` (208L)
- `/packages/central-intelligence/src/kernel/orchestrator/budget.ts` (198L)
- `/packages/central-intelligence/src/kernel/orchestrator/plan.ts` (216L)
- `/packages/central-intelligence/src/kernel/orchestrator/checkpoint.ts` (124L)
- `/packages/central-intelligence/src/kernel/orchestrator/context-budget.ts` (201L)
- `/packages/central-intelligence/src/kernel/orchestrator/memory-tool.ts` (147L)
- `/packages/central-intelligence/src/kernel/orchestrator/skill.ts` (210L)
- `/packages/central-intelligence/src/kernel/orchestrator/batch-api.ts` (186L)
- `/packages/central-intelligence/src/kernel/orchestrator/index.ts` (193L)
- `/packages/central-intelligence/src/kernel/orchestrator/hooks/pre-tool-use/{cost-circuit,rate-limit,pii-scrub,sandbox-divert,permission,tool-denylist,four-eye}-hook.ts`
- `/packages/central-intelligence/src/kernel/orchestrator/hooks/post-tool-use/audit-emission-hook.ts`
- `/packages/central-intelligence/src/kernel/orchestrator/hooks/stop/ledger-seal-hook.ts`
