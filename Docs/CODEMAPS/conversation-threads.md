# Conversation Threads Codemap

**Last Updated:** 2026-05-22
**Module:** `packages/conversation-threads/`
**Public entry:** `packages/conversation-threads/src/index.ts`
**Tier scope:** user surface (Piece F — MD-tier conversation threads with title-tier role hierarchy)

## Purpose

Implements the **MD-tier project / thread / message** model that
Piece F of the master plan locks. Splits the chat experience by
persona tier:

- **MD-tier personas (power_tier ≤ 3)** — projects = folders that
  group threads; many threads per persona; fork supported.
- **Customer personas (power_tier = 5)** — no project layer; ONE
  thread per (user × channel); WhatsApp 24h-window rollover is
  handled by `findOrCreateCustomerThread`.

Every message is a row in an append-only log linked by a **SHA-256
hash chain** rooted at the thread's `message_chain_root_hash`. The
chain root is registered into `ai_audit_chain` (Wave-11) so tampering
with any stored message breaks `verifyMessageChain()` end-to-end.

## Entry points

- `src/index.ts` — barrel.
- `src/types.ts` — Zod schemas + TS types for Project, Thread,
  Message, Artifact, Pin.
- `src/projects.ts` — `createProject` (with `MAX_TIER_FOR_PROJECTS = 3`
  gate), `updateProject`, `archiveProject`, in-memory repo.
- `src/threads.ts` — `createThread`, `forkThread`,
  `findOrCreateCustomerThread` (24h window), `archiveThread`.
- `src/messages.ts` — `appendMessage`, `verifyThreadChain`,
  in-memory repo.
- `src/artifacts.ts` — `createArtifact`, `bumpArtifactVersion`,
  `branchArtifact`, `listArtifactVersions`.
- `src/retrieval.ts` — `retrieveCrossThread` scoped to
  (tenant, persona, project); RRF fusion helper.
- `src/hash-chain.ts` — pure SHA-256 + canonical JSON + chain verify.

## Internal structure

- **projects** — `ProjectTierError` raised when `ownerPersonaTier > 3`.
- **threads** — chain root computed at creation; customer threads use
  `WHATSAPP_24H_WINDOW_MS` (24h) for session-id rotation.
- **messages** — `prev_hash` = previous message's `hash`, or the
  thread's `message_chain_root_hash` for the first row.
- **artifacts** — versioned by (thread_id, id, version);
  `branchArtifact` diverges from a non-latest source and bumps above
  the current head.
- **retrieval** — repository receives (tenant, persona, project_id|null)
  and must filter strictly by that triple; the test double enforces
  it.
- **hash-chain** — `canonicalJson` (key-sorted) → deterministic hashes
  regardless of upstream JSON serialisation order.

## Migrations

- `0200_conversation_projects.sql` — `conversation_projects` table.
- `0201_conversation_threads.sql` — `conversation_threads` table.
- `0202_conversation_messages.sql` — `conversation_messages` table.
- `0203_conversation_artifacts.sql` — `conversation_artifacts` table.
- `0204_conversation_pins.sql` — `conversation_pins` table.

## Dependencies

- Upstream: `zod`, Node's built-in `crypto`.
- Peer: `@bossnyumba/persona-runtime` (uses Persona tier for the
  project gate at the call site; we don't import its enum to keep this
  package leaf-y).
- Downstream:
  - `services/api-gateway` — exposes Hono routes that proxy to these
    services.
  - `packages/chat-ui` — renders thread list, message stream, artifact
    panel from these types.
  - `central-intelligence` — reads pinned + retrieved context into the
    think pipeline.

## Common workflows

- **Create a project (MD)** → `createProject({ownerPersonaTier: 2, …})`.
  The runtime throws `ProjectTierError` for tier ≥ 4.
- **Start a thread** → `createThread({…})`. The chain root hash is
  stored on the thread row.
- **Append a message** → `appendMessage` reads the latest hash and
  chains the new row. Hash is computed deterministically from
  (prev_hash, thread_id, role, canonical_jsonb(content), created_at).
- **Customer arrives on WhatsApp** →
  `findOrCreateCustomerThread({channel: 'whatsapp', externalChannelSessionId})`.
  Reuses the existing thread within 24h; rotates `external_channel_session_id`
  when outside the window so upstream billing sees a fresh conversation.
- **Branch an artifact** → `branchArtifact({fromVersion: 2})` writes a
  new version above the current latest with `parent_version_id = <id>@v2`.
- **Cross-thread retrieval** → `retrieveCrossThread({tenantId, ownerPersonaId, projectId, query})`.
  The repository must filter on every key — no leak across personas or
  projects.
- **Verify the chain** → `verifyThreadChain({tenantId, threadId, chainRootHash})`.
  Returns `{valid, brokenAt, reason}`. Run periodically by the
  consolidation-worker.

## Anti-patterns to avoid

- Never let a customer persona own a project — gate is in the
  runtime, not the database, so callers must use `createProject`.
- Never write a message with a pre-computed hash from outside this
  module — `appendMessage` is the only safe entry point.
- Never mutate an artifact row — bump the version or branch it.
- Never query messages without a tenant filter — RLS will save you
  in prod, but the in-memory repo asserts on tenant id and tests
  will fail.
- Never let the retrieval repository return rows whose `(tenant,
  persona, project)` triple doesn't match — that's the cross-namespace
  leak this module is designed to prevent.

## Related codemaps

- [persona-runtime.md](./persona-runtime.md) — Piece D — supplies
  the Persona row + tier check the project gate consumes.
- [central-intelligence.md](./central-intelligence.md) — kernel
  pipeline reads thread context + pinned assets at retrieval time.
- [ai-copilot.md](./ai-copilot.md) — legacy thread-store interface
  this module is the durable successor to.
- [chat-ui.md](./chat-ui.md) — front-end consumer.
- [database.md](./database.md) — RLS + migration discipline.
