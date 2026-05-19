# @bossnyumba/permission-ux

Phase K-B substrate. Closes 5 gaps from R1/R2 audits.

## What this package solves

| Gap | Module | Outcome |
|---|---|---|
| R1 #3 — `auto` mode classifier + boundary detection | `src/auto-mode/` | Lightweight Haiku-class classifier returns `safe \| borderline \| unsafe` for every next-tool-call; cached 1h per `(tool, normalised-args)`; 3 borderline turns in a row -> escalate to plan mode. |
| R1 #5 — `AskUserQuestion` tool | `src/ask-user-question/` | Typed multiple-choice + free-text fallback + HTML/Markdown previews. Owner answers marshalled back into the tool-use loop. |
| R1 #6 — `canUseTool` callback + `PermissionUpdate` persistence | `src/permission-callback/` | `(toolName, args, ctx) -> PermissionDecision`. Decision can carry `PermissionUpdate[]` with scope `session\|tenant\|forever`; persisted as `permission_rule` entity in J1 entity-store. |
| R2 #1 — Action Receipts with Rollback | `src/action-receipts/` | Every mutation tool call emits a `Receipt` entity. Rendered as `ReceiptCard` (new ag-ui kind in `@bossnyumba/genui`). `Undo` button -> `executeRollback(actionId, rollbackToken)` which replays the inverse op from the sovereign ledger's `rollback_payload`. |
| R2 #14 — Safe-Mode fallback | `src/safe-mode/` | Confidence monitor tracks perplexity + tool failure rate + borderline-classifier count. Below threshold -> emit `SafeModeEntry` chat message with three buttons. |

## Boundary

This is a **library** — no I/O, no DB, no LLM client. All side-effects go through ports the caller wires.

- `J1 entity-store` is the persistence adapter for `permission_rule` + `Receipt` entities.
- `Sovereign-ledger` is the storage for `rollback_payload`.
- `J9 chat-workspace` is the renderer for `AskUserQuestion` + `ReceiptCard` + `SafeModeEntry`.
- `Haiku-class classifier` is wired by the caller via `ClassifierPort`.

## Why this is additive (not a kernel rewrite)

The orchestrator already has six permission modes (`packages/central-intelligence/src/kernel/orchestrator/permission-mode.ts`). This package extends — does not replace — that surface:

1. The kernel calls `evaluatePermissionMode(...)` first (existing).
2. When the mode is `auto`, the kernel asks `classifyAction(...)` (this package).
3. When the verdict is `borderline`, the kernel renders an `AskUserQuestion` ag-ui card (this package).
4. After the tool runs, the kernel calls `emitReceipt(...)` (this package).
5. The confidence monitor (this package) is a sideband sampler over the same hook stream.

The 17 in-flight coordination branches do not touch these surfaces.
