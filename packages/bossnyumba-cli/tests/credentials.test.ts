/**
 * Credential-store round-trip tests. Uses BOSSNYUMBA_CREDENTIALS_FILE so
 * we never touch the real user directory.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  clearCredentials,
  credentialsFilePath,
  loadCredentials,
  saveCredentials,
} from '../src/credentials.js';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'bossnyumba-cli-creds-'));
  process.env['BOSSNYUMBA_CREDENTIALS_FILE'] = join(dir, 'credentials.json');
});

afterEach(() => {
  delete process.env['BOSSNYUMBA_CREDENTIALS_FILE'];
  rmSync(dir, { recursive: true, force: true });
});

describe('credentials store', () => {
  it('returns null when no file exists', () => {
    expect(loadCredentials()).toBeNull();
  });

  it('round-trips a saved credential bundle', () => {
    saveCredentials({
      version: 1,
      accessToken: 'tok_test_123',
      tokenType: 'Bearer',
      scopes: ['owner:read', 'owner:draft'],
      issuedAt: '2026-05-29T12:00:00.000Z',
      apiBaseUrl: 'https://api.example',
      clientId: 'bossnyumba-cli',
      clientLabel: 'Local',
    });
    const loaded = loadCredentials();
    expect(loaded).not.toBeNull();
    expect(loaded?.accessToken).toBe('tok_test_123');
    expect(loaded?.scopes).toEqual(['owner:read', 'owner:draft']);
    expect(loaded?.apiBaseUrl).toBe('https://api.example');
  });

  it('writes the file with mode 0600', () => {
    saveCredentials({
      version: 1,
      accessToken: 'tok',
      tokenType: 'Bearer',
      scopes: [],
      issuedAt: new Date().toISOString(),
      apiBaseUrl: 'https://api.example',
      clientId: 'bossnyumba-cli',
    });
    const mode = statSync(credentialsFilePath()).mode & 0o777;
    expect(mode).toBe(0o600);
  });

  it('clears credentials', () => {
    saveCredentials({
      version: 1,
      accessToken: 'tok',
      tokenType: 'Bearer',
      scopes: [],
      issuedAt: new Date().toISOString(),
      apiBaseUrl: 'https://api.example',
      clientId: 'bossnyumba-cli',
    });
    expect(loadCredentials()).not.toBeNull();
    expect(clearCredentials()).toBe(true);
    expect(loadCredentials()).toBeNull();
  });

  it('rejects a malformed credentials file', () => {
    saveCredentials({
      version: 1,
      accessToken: 'tok',
      tokenType: 'Bearer',
      scopes: [],
      issuedAt: new Date().toISOString(),
      apiBaseUrl: 'https://api.example',
      clientId: 'bossnyumba-cli',
    });
    // Corrupt the file
    const { writeFileSync } = require('node:fs') as typeof import('node:fs');
    writeFileSync(credentialsFilePath(), '{ not valid json', { mode: 0o600 });
    expect(loadCredentials()).toBeNull();
  });
});
