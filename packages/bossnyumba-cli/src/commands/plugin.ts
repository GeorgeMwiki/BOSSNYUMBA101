/**
 * `bossnyumba plugin ls / install / remove` — manage CLI plugins.
 *
 * Install / remove shell out to npm; the actual loading happens at
 * startup via `loadPlugins` in `../plugins.ts`. We deliberately don't
 * support side-loading by file path — npm is the source of truth so
 * plugin trust + provenance can be audited via standard tools.
 */

import { spawn } from 'node:child_process';
import { discoverPlugins } from '../plugins.js';
import type { BossNyumbaLogger } from '../logger.js';

export async function pluginLsCommand(opts: { readonly logger: BossNyumbaLogger }): Promise<void> {
  const list = discoverPlugins();
  if (opts.logger.opts.json) {
    opts.logger.envelope({ ok: true, data: list });
    return;
  }
  if (list.length === 0) {
    opts.logger.info('(no plugins installed)');
    return;
  }
  opts.logger.raw('NAME\tVERSION\tENTRY');
  for (const p of list) {
    opts.logger.raw(`${p.name}\t${p.version}\t${p.entry}`);
  }
}

export async function pluginInstallCommand(opts: {
  readonly logger: BossNyumbaLogger;
  readonly name: string;
}): Promise<void> {
  if (!validPluginName(opts.name)) {
    opts.logger.error(
      `Invalid plugin name: ${opts.name}. Expected @bossnyumba-plugin/* or bossnyumba-plugin-*`,
    );
    process.exitCode = 1;
    return;
  }
  await runNpm(['install', '-g', opts.name], opts.logger);
  if (!opts.logger.opts.json) opts.logger.success(`Installed plugin ${opts.name}.`);
  else opts.logger.envelope({ ok: true, data: { installed: opts.name } });
}

export async function pluginRemoveCommand(opts: {
  readonly logger: BossNyumbaLogger;
  readonly name: string;
}): Promise<void> {
  if (!validPluginName(opts.name)) {
    opts.logger.error(
      `Invalid plugin name: ${opts.name}. Expected @bossnyumba-plugin/* or bossnyumba-plugin-*`,
    );
    process.exitCode = 1;
    return;
  }
  await runNpm(['uninstall', '-g', opts.name], opts.logger);
  if (!opts.logger.opts.json) opts.logger.success(`Removed plugin ${opts.name}.`);
  else opts.logger.envelope({ ok: true, data: { removed: opts.name } });
}

function validPluginName(name: string): boolean {
  return /^@bossnyumba-plugin\/[a-z0-9._-]+$/.test(name) || /^bossnyumba-plugin-[a-z0-9._-]+$/.test(name);
}

function runNpm(args: readonly string[], logger: BossNyumbaLogger): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('npm', [...args], {
      stdio: logger.opts.json ? 'pipe' : 'inherit',
    });
    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`npm ${args.join(' ')} exited ${code}`));
    });
  });
}
