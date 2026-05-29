# Writing a `bossnyumba` CLI plugin

A `bossnyumba` plugin is just an npm package whose name matches one of:

- `@bossnyumba-plugin/<name>` (scoped — preferred)
- `bossnyumba-plugin-<name>` (unscoped — also accepted)

On every CLI invocation the bin walks every `node_modules` directory
up the resolution chain, plus any path on `NODE_PATH`, and
dynamic-imports each matching package. Your default export (or named
`register`) is called with the commander program + a small context
object.

## Minimum viable plugin

`package.json`:

```json
{
  "name": "@bossnyumba-plugin/hello",
  "version": "0.1.0",
  "main": "index.js",
  "type": "commonjs",
  "files": ["index.js"]
}
```

`index.js`:

```js
/**
 * Adds a `bossnyumba hello [--name <n>]` verb that prints a friendly greeting.
 *
 * @param {import('commander').Command} program - the bossnyumba program tree
 * @param {{ logger, cliVersion }} ctx          - injected by the host
 */
function register(program, ctx) {
  program
    .command('hello')
    .description('Friendly greeting from the @bossnyumba-plugin/hello plugin')
    .option('--name <n>', 'who to greet', 'world')
    .action((opts) => {
      ctx.logger.success(`Hello, ${opts.name}! (CLI v${ctx.cliVersion})`);
    });
}

module.exports = { register };
```

Install + test:

```sh
cd /tmp && npm init -y && npm i -g @bossnyumba-plugin/hello   # or `npm link`
bossnyumba plugin ls
bossnyumba hello --name Mwikila
```

## ES-module plugin

```js
// package.json: "type": "module", "main": "./index.js"
import { Command } from 'commander';

export function register(program, ctx) {
  program
    .command('hello')
    .description('Friendly greeting (ESM plugin)')
    .action(() => {
      ctx.logger.success(`Hello from ESM, CLI v${ctx.cliVersion}!`);
    });
}

// Optional: default export with .register also works.
export default { register };
```

## TypeScript plugin

The CLI imports the compiled `.js` — your TypeScript source should be
built (e.g. via `tsup`) to plain JavaScript before publishing.

```ts
import type { Command } from 'commander';
import type { PluginContext } from '@bossnyumba/cli';

export function register(program: Command, ctx: PluginContext): void {
  program
    .command('hello')
    .description('Friendly greeting (TS plugin)')
    .action(() => ctx.logger.success(`Hi from TS — v${ctx.cliVersion}`));
}
```

## PluginContext

```ts
interface PluginContext {
  readonly logger: BossNyumbaLogger;   // honors --json / --no-color / --quiet / --verbose
  readonly cliVersion: string;      // e.g. "0.2.0"
}
```

The logger lets you write to stdout/stderr without bypassing the host
output mode. Use it instead of `console.*` so users running with
`--json` see your output as a proper envelope, not a stray line.

## Calling the host SDK from a plugin

If your plugin needs to talk to the BossNyumba API, import the SDK and
the session helper from `@bossnyumba/cli` (peer-dep it):

```js
const { loadProfile } = require('@bossnyumba/cli');
const { createBossNyumbaClient } = require('@bossnyumba/api-sdk');

function register(program, ctx) {
  program
    .command('mineral-report')
    .description('Custom mineral-grade report')
    .action(async () => {
      const profile = loadProfile('default');
      if (!profile) {
        ctx.logger.error('Run: bossnyumba login');
        process.exitCode = 1;
        return;
      }
      const sdk = createBossNyumbaClient({
        baseUrl: profile.apiUrl,
        accessToken: profile.accessToken,
      });
      const report = await sdk.GET('/api/v1/minerals/report');
      ctx.logger.envelope({ ok: true, data: report });
    });
}

module.exports = { register };
```

## Conflict handling

- The first registration of a given command name wins. Subsequent
  plugins (or the host) trying to register the same name are silently
  ignored (logged at debug).
- Plugins are loaded in `Map.set` order (filesystem order) — do not
  depend on order between plugins.
- Plugins that throw during `register()` log a `warn:` line but never
  block the rest of the CLI.

## Distribution

Publish under the `@bossnyumba-plugin/*` scope (or with the
`bossnyumba-plugin-` prefix). Pin a peer-dep on `@bossnyumba/cli >=0.2.0`.
Document your verb in your README and on the
[BossNyumba plugin registry](https://bossnyumba.app/plugins).

## Local development

```sh
cd my-plugin
npm link                # makes it available globally
bossnyumba plugin ls        # confirms discovery
bossnyumba <your-verb>      # runs it
```

To unload, `npm unlink -g @bossnyumba-plugin/my-plugin` or
`bossnyumba plugin remove @bossnyumba-plugin/my-plugin`.

## Anti-patterns

- Do **not** mutate `process.env` from a plugin.
- Do **not** call `console.*` — use `ctx.logger`.
- Do **not** call `process.exit()` outside a fatal error path; throw
  instead and let the host catch + format with the standard pretty
  error printer.
- Do **not** depend on global state from another plugin — assume
  parallel load order.
- Do **not** ship secrets, telemetry beacons, or auto-update hooks in
  a plugin. The host's update notifier is the single source of truth.

## Reference plugins

- `@bossnyumba-plugin/sample-hello` — minimal CommonJS example (this doc).
- `@bossnyumba-plugin/mining-reports` — wired into the brain for
  mineral-grade roll-ups (community).
- `bossnyumba-plugin-osquery` — exposes osquery via `bossnyumba host …`
  (community).
