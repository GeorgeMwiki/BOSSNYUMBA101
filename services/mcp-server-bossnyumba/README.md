# @bossnyumba/mcp-server-bossnyumba

Public-facing **Model Context Protocol (MCP)** server for BossNyumba — the
property management, leasing, maintenance, and intelligence OS for
Tanzanian and pan-African real estate landlords, agents, and tenants.

Lets any MCP-aware client (Claude Code, Cursor, Windsurf, custom agents,
your in-house tooling) discover, authenticate, and operate Mr. Mwikila's
brain tools end-to-end. Tenant-isolated by Postgres RLS, scope-narrowed
by OAuth, hash-chain audited on every call.

## Why this exists

External LLM agents need a stable, documented, scope-gated way into the
BossNyumba brain. This server is that contract: a strict subset of MCP
2024-11-05 over stdio (local subprocess) or HTTP/JSON-RPC (remote
endpoint at `https://api.bossnyumba.app/mcp`).

## Install

```bash
# Run on-the-fly (recommended for Claude Code / Cursor)
npx -y @bossnyumba/mcp-server-bossnyumba

# Or install globally
npm install -g @bossnyumba/mcp-server-bossnyumba
bossnyumba-mcp-server
```

## Wire it into Claude Code

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`
(macOS) or `%APPDATA%/Claude/claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "bossnyumba": {
      "command": "npx",
      "args": ["-y", "@bossnyumba/mcp-server-bossnyumba"],
      "env": {
        "BOSSNYUMBA_API_BASE_URL": "https://api.bossnyumba.app",
        "BOSSNYUMBA_MCP_TOKEN": "<your access token from `bossnyumba login`>"
      }
    }
  }
}
```

For Cursor or Windsurf — same envelope, different config path.

## Authentication

Two modes:

1. **OAuth2 device flow (recommended).** Run `bossnyumba login` from the
   `@bossnyumba/cli` package to fetch a scoped access token written to
   `~/.config/bossnyumba/credentials.json`. The MCP server reads it from
   the `BOSSNYUMBA_MCP_TOKEN` env var.
2. **Bypass token for local development.** Set `BOSSNYUMBA_MCP_TOKEN` to a
   dev token issued from the BossNyumba owner-web admin panel.

## Environment variables

| Var | Default | Meaning |
| --- | --- | --- |
| `BOSSNYUMBA_API_BASE_URL` | `https://api.bossnyumba.co.tz` | Gateway base URL |
| `BOSSNYUMBA_MCP_TOKEN` | _(empty)_ | Bearer access token |
| `BOSSNYUMBA_MCP_AGENT_NAME` | `unknown-agent` | Audit attribution string |

## Tool surface

29 tools across the BossNyumba brain catalog:

- `property_drafts_*` — compose, list, view, lock free-form drafts
- `property_media_generate` — generate charts / images / infographics
- `property_opportunities_scan` / `property_risks_scan` — strategic scans
- `property_calibration_status` — over- / under-confidence per persona
- `decisions_list` / `decisions_create` — decision journal
- `entity_index_summary` / `scope_nodes_*` — estate structure
- `md_daily_brief` — Mr. Mwikila's daily brief
- `property_listings` — buyer-facing offers
- `property_maintenance_list` — active workers + certifications
- `property_inspections_samples` / `property_occupancy_today` — occupancy data
- `property_landlords_list` / `property_insurance_policies`
- `owner_messaging_threads` / `compliance_status`
- `estate_net_worth` / `estate_share_link_create`
- `reminders_list` / `reminders_create` / `property_ui_tabs_*`
- `owner_undo_last` — undo last action within window

Call `tools/list` for the full schema (bilingual sw/en descriptions).

## Resources

Read-only side-data exposed via `resources/list`:

- `bossnyumba://capabilities` — capability manifest
- `bossnyumba://estate/entities` — repomap-equivalent
- `bossnyumba://decisions/recent` — last 50 decisions
- `bossnyumba://calibration/current` — calibration posture
- `bossnyumba://corpus/property/index` — property corpus index
- `bossnyumba://compliance/posture` — PCCB / PDPA / FAR posture
- `bossnyumba://memory/advisor` — advisor memory snapshot

## Scopes

Six scopes; owner can grant any of the first five via the device-flow
consent screen. `admin:read` is BossNyumba-internal only.

| Scope | Allows |
| --- | --- |
| `owner:read` | Read estate snapshot |
| `owner:write` | Create / update / delete entities, run scans |
| `owner:draft` | Compose, edit, lock drafts |
| `owner:reminders` | Manage reminders + cockpit tabs |
| `owner:share` | Generate time-boxed share links |
| `admin:read` | BossNyumba-internal cross-tenant reads |

## Security posture

- Every call hits api-gateway with `Authorization: Bearer <token>` plus
  `X-BossNyumba-MCP-Tool` and `X-BossNyumba-Agent-Token-Id` headers.
- Gateway binds `app.current_tenant_id` GUC before any downstream
  database call — RLS enforces tenant isolation.
- Hash-chain audit on every tool invocation via the gateway's
  `audit-trail` service. Provenance returned in the response.
- Kill-switch fail-closed — when open, every JSON-RPC call returns
  error `-32003`.
- No `console.log` — all server output flows through Pino-shaped
  stderr.

## Integration snippets

Drop into the right config file for each client. Replace
`<your access token>` with the bearer BossNyumba hands you after
`bossnyumba login` (see `@bossnyumba/cli`).

### Claude Code

`~/.config/claude-code/claude_mcp_settings.json`:

```json
{
  "mcpServers": {
    "bossnyumba": {
      "command": "npx",
      "args": ["-y", "@bossnyumba/mcp-server-bossnyumba"],
      "env": {
        "BOSSNYUMBA_API_BASE_URL": "https://api.bossnyumba.app",
        "BOSSNYUMBA_MCP_TOKEN": "<your access token>",
        "BOSSNYUMBA_MCP_AGENT_NAME": "claude-code"
      }
    }
  }
}
```

### Cursor

`~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "bossnyumba": {
      "command": "npx",
      "args": ["-y", "@bossnyumba/mcp-server-bossnyumba"],
      "env": {
        "BOSSNYUMBA_API_BASE_URL": "https://api.bossnyumba.app",
        "BOSSNYUMBA_MCP_TOKEN": "<your access token>",
        "BOSSNYUMBA_MCP_AGENT_NAME": "cursor"
      }
    }
  }
}
```

### Windsurf

`~/.windsurf/mcp_servers.json`:

```json
{
  "mcpServers": {
    "bossnyumba": {
      "command": "npx",
      "args": ["-y", "@bossnyumba/mcp-server-bossnyumba"],
      "env": {
        "BOSSNYUMBA_API_BASE_URL": "https://api.bossnyumba.app",
        "BOSSNYUMBA_MCP_TOKEN": "<your access token>",
        "BOSSNYUMBA_MCP_AGENT_NAME": "windsurf"
      }
    }
  }
}
```

### Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json` (macOS)
or `%APPDATA%/Claude/claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "bossnyumba": {
      "command": "npx",
      "args": ["-y", "@bossnyumba/mcp-server-bossnyumba"],
      "env": {
        "BOSSNYUMBA_API_BASE_URL": "https://api.bossnyumba.app",
        "BOSSNYUMBA_MCP_TOKEN": "<your access token>",
        "BOSSNYUMBA_MCP_AGENT_NAME": "claude-desktop"
      }
    }
  }
}
```

### Continue.dev

`~/.continue/config.json` (under `experimental.modelContextProtocolServer`):

```json
{
  "experimental": {
    "modelContextProtocolServer": {
      "transport": {
        "type": "stdio",
        "command": "npx",
        "args": ["-y", "@bossnyumba/mcp-server-bossnyumba"]
      }
    }
  }
}
```

Set `BOSSNYUMBA_API_BASE_URL` and `BOSSNYUMBA_MCP_TOKEN` in your shell.

### Plain `mcp-cli` (smoke test)

```bash
BOSSNYUMBA_API_BASE_URL=https://api.bossnyumba.app \
BOSSNYUMBA_MCP_TOKEN=<your access token> \
npx -y @anthropic-ai/mcp-cli --command 'npx -y @bossnyumba/mcp-server-bossnyumba' tools/list
```

### HTTP transport (no stdio subprocess)

```bash
curl -sS -X POST https://api.bossnyumba.app/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your access token>" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

### SSE transport (long-lived stream)

```bash
curl -sS -N https://api.bossnyumba.app/mcp/sse \
  -H "Authorization: Bearer <your access token>"
```

## SOTA primitives

This server ships **all 12** MCP 2024-11-05 primitives plus four
computer-use-style semantic actions:

| # | Primitive | Implementation |
| - | --- | --- |
| 1 | SSE transport | `transports/sse.ts` + api-gateway `mcp-public.hono.ts` |
| 2 | sampling/createMessage | `sampling.ts` |
| 3 | roots/list + roots/list_changed | `roots.ts` |
| 4 | logging/setLevel + logging/message | `logging.ts` |
| 5 | $/progress notifications | `progress.ts` |
| 6 | resources/subscribe + resources/updated | `subscriptions.ts` |
| 7 | $/result_partial streaming | `progress.ts` |
| 8 | session checkpoint/resume | `sessions.ts` + migration 0120 |
| 9 | computer-use actions (navigate/prefill/share/undo) | `actions.ts` |
| 10 | per-scope rate limit (-32099) | `rate-limit.ts` |
| 11 | four-eye approval (-32011) for sovereign tools | `four-eye.ts` + migration 0121 |
| 12 | discovery filters + workspace mirror | dispatcher + `workspace.ts` |

## Development

```bash
pnpm --filter @bossnyumba/mcp-server-bossnyumba typecheck
pnpm --filter @bossnyumba/mcp-server-bossnyumba test
pnpm --filter @bossnyumba/mcp-server-bossnyumba build
```

## Smoke test

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize"}' \
  | node dist/cli.js
```

Should emit one JSON-RPC response with `protocolVersion: 2024-11-05`.

## License

MIT.
