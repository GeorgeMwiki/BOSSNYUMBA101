# @bossnyumba/cli

The `bossnyumba` command-line interface — drive your entire BossNyumba estate
from the terminal as fluently as `gh` drives GitHub or `aider` drives a
codebase. Built for agents (Claude Code, Cursor, Windsurf, custom MCP
clients) **and** humans, with an interactive REPL, autonomous agent
loop, watch daemon, multi-profile credentials, plugin system, shell
completions, and a polished TUI.

## Install

```sh
npm install -g @bossnyumba/cli
```

Requires Node 20+. Also runs on Bun and Deno without modification (the
CLI uses `globalThis.fetch` only).

## Quick start

```sh
bossnyumba                        # interactive REPL (no args)
bossnyumba login                  # OAuth2 device-flow sign-in
bossnyumba whoami                 # show identity + scopes + api base
bossnyumba chat "Nichambulie hali ya leseni yangu" --language sw
bossnyumba chat - < prompt.txt    # read prompt from stdin
bossnyumba agent run "renew all licenses expiring in <30d" --auto-approve
bossnyumba watch --filter opportunities,risks
bossnyumba diff --since 7d --until now
bossnyumba use staging            # switch profile
bossnyumba sessions ls            # list active brain sessions
bossnyumba completion zsh > "${fpath[1]}/_bossnyumba"
```

## The 14 SOTA upgrades

| #  | Upgrade                  | Verb / Behavior                                                                   |
| -- | ------------------------ | --------------------------------------------------------------------------------- |
| 1  | Interactive REPL         | `bossnyumba` (no args) — slash commands `/help /exit /login /whoami /lang /json …`    |
| 2  | Streaming chat           | typing indicator → dim in-progress tokens → normal color on `done`                |
| 3  | Shell completions        | `bossnyumba completion bash\|zsh\|fish` — dynamic entity-id completion via `__complete` |
| 4  | Update notifier          | one-line banner if newer version on npm; 24h cache; `BOSSNYUMBA_DISABLE_UPDATE_CHECK` |
| 5  | Config file              | `~/.config/bossnyumba/config.toml` — `bossnyumba config show/get/set/path`               |
| 6  | Profile switching        | `bossnyumba use <name>`, `bossnyumba profiles ls/rm` — per-environment apiUrl + token     |
| 7  | Plugin system            | `@bossnyumba-plugin/*` / `bossnyumba-plugin-*` packages auto-discovered; see `PLUGIN_DEV` |
| 8  | Autonomous agent loop    | `bossnyumba agent run <task>` — plan → tool → result → loop, full trace recorded      |
| 9  | Watch daemon             | `bossnyumba watch` — SSE notifications, `--filter`, `--exec`, long-poll fallback     |
| 10 | Estate diff              | `bossnyumba diff <since> [until]` — colorised human or `--json` envelope             |
| 11 | Stdin pipe support       | every command accepts `-` for stdin args (`echo q \| bossnyumba chat -`)              |
| 12 | Output modes             | `--json` envelopes, `--verbose` HTTP traces, `--quiet`, `--no-color`, `NO_COLOR` |
| 13 | Pretty error messages    | summary / why / next-step / request_id, per-class hints (auth / 429 / network)    |
| 14 | Multi-session            | `bossnyumba sessions ls/show/resume/archive/new` — local persistence + server-pass    |

## Interactive REPL (§1)

```sh
$ bossnyumba
BossNyumba REPL — type a question, /help for commands, /exit to leave.
[default sw]> nichambulie hali ya leseni
…streamed response from Mr. Mwikila…
[default sw]> /lang en
Language switched to en.
[default en]> /json
JSON mode on.
```

Built-in slash commands: `/help /exit /clear /login /whoami /tabs
/scope /lang sw|en /json`. History (one prompt per line) is appended
to `~/.config/bossnyumba/history` and reachable via the up-arrow.

## Streaming chat with typing indicator (§2)

`bossnyumba chat "…"` shows a gray `…` until the first SSE `message_chunk`
arrives, then renders in-progress tokens dimmed; on the `done` event
the cursor moves to a fresh line. JSON mode bypasses cosmetic state
and prints one JSON object per event.

## Shell completions (§3)

```sh
bossnyumba completion bash  > /etc/bash_completion.d/bossnyumba
bossnyumba completion zsh   > "${fpath[1]}/_bossnyumba"
bossnyumba completion fish  > ~/.config/fish/completions/bossnyumba.fish
```

Dynamic completion (e.g. `bossnyumba drafts show <TAB>` → recent draft
ids; `bossnyumba use <TAB>` → profile names) is provided by the hidden
`__complete` subcommand that every shell script calls.

## Update notifier (§4)

After any invocation the CLI fetches `npm view @bossnyumba/cli version`
no more than once per 24h, caches it in
`~/.config/bossnyumba/update-check.json`, and prints a one-line banner if
a newer version is available. Disable with:

```sh
export BOSSNYUMBA_DISABLE_UPDATE_CHECK=1
# or persist:
bossnyumba config set updateCheckEnabled false
```

## Config file (§5)

```toml
# ~/.config/bossnyumba/config.toml
[defaults]
lang = "sw"
output_format = "text"
color = true
verbose = false
profile = "default"
api_url_override = ""

[update_check]
enabled = true
```

```sh
bossnyumba config show
bossnyumba config path
bossnyumba config get lang
bossnyumba config set lang en
bossnyumba config set outputFormat json
```

## Profiles (§6)

Each profile is a self-contained `{accessToken, apiUrl, clientId,
clientLabel, scopes}` blob under
`~/.config/bossnyumba/profiles/<name>.json` (mode 0600).

```sh
bossnyumba login --profile staging --api https://api-staging.bossnyumba.app
bossnyumba login --profile prod    --api https://api.bossnyumba.app
bossnyumba use staging
bossnyumba profiles ls
# NAME      API URL                          ISSUED AT             ACTIVE
# default   https://api.bossnyumba.app           2026-05-29T08:00:00Z
# staging   https://api-staging.bossnyumba.app   2026-05-29T08:01:00Z  *
bossnyumba --profile prod drafts ls   # one-off override (env: BOSSNYUMBA_PROFILE)
```

## Plugins (§7)

```sh
bossnyumba plugin install @bossnyumba-plugin/mining-reports
bossnyumba plugin ls
bossnyumba plugin remove @bossnyumba-plugin/mining-reports
```

Authoring guide → [`PLUGIN_DEV.md`](./PLUGIN_DEV.md).

## Autonomous agent loop (§8)

```sh
bossnyumba agent run "renew every license expiring in <30d" --max-steps 20 --auto-approve
bossnyumba agent run "draft an LOI for buyer A" --max-steps 5
# Approve MEDIUM step: drafts.new {"intent":"draft LOI for buyer A"} ? [y/N]
```

Every step (with input/output tokens, latency, result/error) is
appended to `~/.config/bossnyumba/agent-runs/<runId>.jsonl`. Low-risk
tools (read-only) auto-approve; medium / high tools prompt
interactively. `--auto-approve` waives all prompts.

## Watch daemon (§9)

```sh
bossnyumba watch
bossnyumba watch --filter opportunities,risks,reminders
bossnyumba watch --exec 'osascript -e "display notification \"$BOSSNYUMBA_EVENT_TITLE\""'
bossnyumba --json watch | jq -r '.event'
```

Subscribes to `/api/v1/agent/notifications` (SSE); falls back to
long-poll `/api/v1/agent/notifications/poll` if the SSE channel is
unavailable. Ctrl+C exits cleanly.

## Estate diff (§10)

```sh
bossnyumba diff --since 7d
bossnyumba diff --since 2026-05-01 --until 2026-05-15
bossnyumba --json diff --since 24h | jq '.data.drafts'
```

Outputs a per-bucket added/removed/modified summary in human form
(colorised) or as a JSON envelope.

## Stdin pipe support (§11)

```sh
echo "what's expiring this week?" | bossnyumba chat -
cat prompt.md | bossnyumba chat - --language en
bossnyumba drafts new --intent - < intent.txt
bossnyumba agent run - < big-task.md
```

Any argument literally equal to `-` is replaced with stdin. Honors
`BOSSNYUMBA_STDIN_TIMEOUT_MS` (default 30s).

## Output modes (§12)

| Flag         | Effect                                                                                        |
| ------------ | --------------------------------------------------------------------------------------------- |
| `--json`     | machine output — every command emits `{ok, data?, error?}` envelopes; no spinners; no banners |
| `--verbose`  | logs every HTTP request/response (method, URL, status, latency_ms, request_id) to stderr     |
| `--quiet`    | suppress informational output, only the result                                                |
| `--no-color` | disable ANSI color                                                                            |
| `NO_COLOR=1` | same as `--no-color` (standard env)                                                          |

## Pretty error messages (§13)

```text
error: Your session is invalid or has expired.
why:   The API returned 401 Unauthorized on /api/v1/owner/drafts.
next:  Run: bossnyumba login
request_id: req_abc123
```

Per-kind hints:

- `auth` (401) → run `bossnyumba login`
- `forbidden` (403) → request the right scopes
- `rate_limit` (429) → extracts `retry_after` and prints `Retry in 12s`
- `network` → check connection or `BOSSNYUMBA_API_URL`
- `validation` (400 / 422) → re-run with `--verbose` for the issues array
- `server` (5xx) → retry; share `request_id` with support

In JSON mode the same fields are emitted as `{ok:false, error:{...}}`.

## Multi-session (§14)

```sh
bossnyumba sessions ls
bossnyumba sessions new --title "license renewal sprint"
bossnyumba sessions show <id>
bossnyumba sessions resume <id>           # or omit id for most recent
bossnyumba sessions archive <id>
bossnyumba chat "next step?" --session <id>
bossnyumba chat "next step?" --continue   # most recent
```

Sessions are persisted locally at `~/.config/bossnyumba/sessions/` so the
CLI stays useful offline.

## Authentication

`bossnyumba login` initiates the OAuth2 device authorization grant
(RFC 8628):

1. The CLI requests a device code from `POST /api/v1/oauth/device/code`.
2. It opens a browser to `/oauth/confirm?code=...` (override with
   `--no-browser` and copy/paste).
3. You approve or deny the requested scopes in the owner cockpit.
4. The CLI polls `POST /api/v1/oauth/token` until you approve, then
   stores the access token in the active profile under
   `~/.config/bossnyumba/profiles/<name>.json` (file mode 0600).

To revoke: `bossnyumba logout`, or visit
`/settings/connected-agents` in the owner cockpit.

## Configuration env vars

| Env var                       | Default                              | Meaning                                                |
| ----------------------------- | ------------------------------------ | ------------------------------------------------------ |
| `BOSSNYUMBA_API_BASE_URL`         | `https://api.bossnyumba.app`             | Override the api-gateway base URL for `bossnyumba login`.  |
| `BOSSNYUMBA_CREDENTIALS_FILE`     | `~/.config/bossnyumba/credentials.json`  | Override the legacy credentials path (tests).          |
| `BOSSNYUMBA_HOME`                 | `~/.config/bossnyumba`                   | Override the root directory for everything (tests).    |
| `BOSSNYUMBA_CONFIG_FILE`          | `~/.config/bossnyumba/config.toml`       | Override the config.toml path.                          |
| `BOSSNYUMBA_PROFILE`              | (active profile from config.toml)    | One-shot override of the active profile.               |
| `BOSSNYUMBA_DISABLE_UPDATE_CHECK` | unset                                | Disable the npm version check.                          |
| `BOSSNYUMBA_STDIN_TIMEOUT_MS`     | `30000`                              | Cap on `chat -` / `agent run -` stdin reads.            |
| `NO_COLOR`                    | unset                                | Standard env to disable ANSI color.                     |

## Full command catalog

```
bossnyumba [options] [command]

Global options:
  --json                     machine-readable output (envelope mode)
  --no-color / NO_COLOR=1    disable ANSI color
  --verbose                  HTTP traces + stacks to stderr
  --quiet                    only the result
  --profile <name>           one-shot profile override

Auth & identity:
  login [--api <url>] [--client-id <id>] [--client-label <s>]
        [--scope <s>...] [--no-browser] [--profile <name>]
  logout
  whoami

Conversation:
  chat <prompt|-> [--language sw|en] [--session <id>] [--continue]
  sessions ls [--all]
  sessions show <id>
  sessions resume [id]
  sessions archive <id>
  sessions new [--title <s>] [--language sw|en]

Estate:
  estate sites
  estate workers
  diff [--since <ts|24h>] [--until <ts>]
  watch [--filter <list>] [--exec <cmd>]
  opportunities
  risks
  decisions ls
  decisions show <id>
  compliance check
  scope

Documents:
  drafts ls
  drafts new [--intent <text|->] [--template <slug>]
  drafts lock <id> [--reason <text>]
  drafts show <id>
  reminders ls
  reminders add <text> --when <iso>
  tabs ls
  tabs open <id>
  share <entityType> <id>

Agentic automation:
  agent run <task|-> [--max-steps N] [--auto-approve]

Profiles & config:
  profiles ls
  profiles rm <name>
  use <name>
  config show
  config path
  config get <key>
  config set <key> <value>

Plugins:
  plugin ls
  plugin install <name>
  plugin remove <name>

Shell integration:
  completion <bash|zsh|fish>
```

## Cross-runtime (Node / Bun / Deno)

The CLI imports zero Node-only HTTP libraries. It uses
`globalThis.fetch`, `node:readline/promises`, `node:fs`, `node:os`,
`node:path`, `node:child_process` (for `bossnyumba plugin install` /
`bossnyumba watch --exec`). All other modules are Web-platform.

```sh
node packages/bossnyumba-cli/dist/cli.js --help
bun  packages/bossnyumba-cli/dist/cli.js --help
deno run --allow-all packages/bossnyumba-cli/dist/cli.js --help
```

## Bilingual (sw / en)

Default user language is Swahili (`sw`) because BossNyumba is
Swahili-first. Toggle via `--language en`, `/lang en` (REPL), or
`bossnyumba config set lang en`.

## License

MIT
