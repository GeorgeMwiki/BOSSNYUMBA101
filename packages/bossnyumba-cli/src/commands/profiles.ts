/**
 * `bossnyumba profiles ls` / `bossnyumba use <name>` — per-environment switching.
 *
 * Each profile = one file under `~/.config/bossnyumba/profiles/<name>.json`
 * holding {accessToken, apiUrl, clientId, clientLabel, scopes}. The
 * active profile is named in `config.toml -> [defaults] profile`.
 */

import { deleteProfile, listProfiles, loadProfile } from '../profiles.js';
import { loadUserConfig, saveUserConfig } from '../user-config.js';
import { activeProfileName } from './_session.js';
import type { BossNyumbaLogger } from '../logger.js';

export async function profilesLsCommand(opts: { readonly logger: BossNyumbaLogger }): Promise<void> {
  const active = activeProfileName();
  const profiles = listProfiles();
  if (opts.logger.opts.json) {
    opts.logger.envelope({
      ok: true,
      data: {
        active,
        profiles: profiles.map((p) => ({
          name: p.name,
          apiUrl: p.apiUrl,
          clientId: p.clientId,
          clientLabel: p.clientLabel,
          issuedAt: p.issuedAt,
        })),
      },
    });
    return;
  }
  if (profiles.length === 0) {
    opts.logger.info('(no profiles) — run `bossnyumba login` to create the default profile.');
    return;
  }
  opts.logger.raw('NAME\tAPI URL\tISSUED AT\tACTIVE');
  for (const p of profiles) {
    const marker = p.name === active ? '*' : '';
    opts.logger.raw(`${p.name}\t${p.apiUrl}\t${p.issuedAt}\t${marker}`);
  }
}

export async function useProfileCommand(opts: {
  readonly logger: BossNyumbaLogger;
  readonly name: string;
}): Promise<void> {
  const profile = loadProfile(opts.name);
  if (!profile) {
    opts.logger.error(`No profile named "${opts.name}". Run: bossnyumba profiles ls`);
    process.exitCode = 1;
    return;
  }
  const cfg = loadUserConfig();
  saveUserConfig({ ...cfg, profile: opts.name });
  if (opts.logger.opts.json) {
    opts.logger.envelope({ ok: true, data: { active: opts.name } });
  } else {
    opts.logger.success(`Switched to profile "${opts.name}" (${profile.apiUrl}).`);
  }
}

export async function profilesRmCommand(opts: {
  readonly logger: BossNyumbaLogger;
  readonly name: string;
}): Promise<void> {
  const removed = deleteProfile(opts.name);
  if (opts.logger.opts.json) {
    opts.logger.envelope({ ok: removed, data: { removed, name: opts.name } });
    return;
  }
  if (removed) opts.logger.success(`Removed profile "${opts.name}".`);
  else opts.logger.warn(`No profile named "${opts.name}".`);
}
