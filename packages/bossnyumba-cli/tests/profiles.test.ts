import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  deleteProfile,
  listProfiles,
  loadProfile,
  saveProfile,
  type BossNyumbaProfile,
} from '../src/profiles.js';
import { profileFilePath } from '../src/paths.js';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'bossnyumba-cli-prof-'));
  process.env['BOSSNYUMBA_HOME'] = dir;
  process.env['BOSSNYUMBA_CREDENTIALS_FILE'] = join(dir, 'credentials.json');
});

afterEach(() => {
  delete process.env['BOSSNYUMBA_HOME'];
  delete process.env['BOSSNYUMBA_CREDENTIALS_FILE'];
  rmSync(dir, { recursive: true, force: true });
});

const sample: BossNyumbaProfile = {
  version: 1,
  name: 'staging',
  apiUrl: 'https://api-staging.bossnyumba.app',
  accessToken: 'tok_staging_123',
  clientId: 'bossnyumba-cli',
  clientLabel: 'Staging',
  scopes: ['owner:read'],
  issuedAt: '2026-05-29T00:00:00.000Z',
};

describe('profiles store', () => {
  it('saves and loads a profile', () => {
    saveProfile(sample);
    const loaded = loadProfile('staging');
    expect(loaded?.accessToken).toBe('tok_staging_123');
    expect(loaded?.apiUrl).toBe('https://api-staging.bossnyumba.app');
  });

  it('writes the file with mode 0600', () => {
    saveProfile(sample);
    const mode = statSync(profileFilePath('staging')).mode & 0o777;
    expect(mode).toBe(0o600);
  });

  it('lists multiple profiles', () => {
    saveProfile(sample);
    saveProfile({ ...sample, name: 'production', apiUrl: 'https://api.bossnyumba.app' });
    const list = listProfiles();
    expect(list.map((p) => p.name).sort()).toEqual(['production', 'staging']);
  });

  it('deletes a profile', () => {
    saveProfile(sample);
    expect(loadProfile('staging')).not.toBeNull();
    expect(deleteProfile('staging')).toBe(true);
    expect(loadProfile('staging')).toBeNull();
  });

  it('returns null for unknown profile', () => {
    expect(loadProfile('nope')).toBeNull();
  });
});
