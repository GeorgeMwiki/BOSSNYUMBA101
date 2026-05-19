/**
 * Tests for Module 1 — Immutable Golden Eval integrity.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  verifyGoldenSetIntegrity,
  sha256Hex,
  computeManifestHash,
  loadGoldenSet,
  GoldenSetIntegrityError,
} from '../immutable-golden-eval/index.js';

function buildFixture(): { root: string; scenarioPath: string } {
  const root = mkdtempSync(join(tmpdir(), 'golden-'));
  mkdirSync(join(root, 'cat1'), { recursive: true });
  const scenario = {
    id: 'cat1-001', category: 'cat1', severity: 'high',
    input: 'test', expected_action: 'refuse', forbidden_actions: ['leak'],
    tags: ['t'], created_by: 'test', created_at: '2026-01-01T00:00:00Z',
  };
  const rel = 'cat1/cat1-001.json';
  const abs = join(root, rel);
  const buf = Buffer.from(JSON.stringify(scenario, null, 2) + '\n', 'utf8');
  writeFileSync(abs, buf);
  const entries = [{ id: scenario.id, path: rel, sha256: sha256Hex(buf), bytes: buf.length }];
  const manifest = {
    version: '1.0.0', generated_at: new Date().toISOString(), key_id: 'k',
    entries, manifest_hash: computeManifestHash(entries), signature: 'sig',
  };
  writeFileSync(join(root, 'MANIFEST.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  return { root, scenarioPath: abs };
}

describe('golden-eval integrity', () => {
  let root = '';
  let scenarioPath = '';

  beforeAll(() => {
    const f = buildFixture();
    root = f.root;
    scenarioPath = f.scenarioPath;
  });
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it('passes on an untampered golden set', () => {
    const r = verifyGoldenSetIntegrity(root);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.entries_count).toBe(1);
  });

  it('loadGoldenSet returns frozen readonly scenarios', () => {
    const scenarios = loadGoldenSet(root);
    expect(scenarios.length).toBe(1);
    expect(Object.isFrozen(scenarios[0])).toBe(true);
    expect(() => {
      (scenarios as unknown as { length: number }).length = 0;
    }).toThrow();
  });

  it('detects tampered file content (single-byte flip)', () => {
    const original = readFileSync(scenarioPath);
    const tampered = Buffer.from(original);
    tampered[0] = original[0] === 32 ? 9 : 32; // flip a whitespace byte
    writeFileSync(scenarioPath, tampered);
    const r = verifyGoldenSetIntegrity(root);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('file-hash-mismatch');
    writeFileSync(scenarioPath, original); // restore
  });

  it('detects missing manifest', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'g2-'));
    const r = verifyGoldenSetIntegrity(tmp);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('manifest-missing');
    rmSync(tmp, { recursive: true, force: true });
  });

  it('detects malformed manifest', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'g3-'));
    writeFileSync(join(tmp, 'MANIFEST.json'), '{not valid', 'utf8');
    const r = verifyGoldenSetIntegrity(tmp);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('manifest-missing'); // parse fail returns null
    rmSync(tmp, { recursive: true, force: true });
  });

  it('detects manifest-hash forgery', () => {
    const fx = buildFixture();
    const manifestPath = join(fx.root, 'MANIFEST.json');
    const m = JSON.parse(readFileSync(manifestPath, 'utf8'));
    m.manifest_hash = 'a'.repeat(64);
    writeFileSync(manifestPath, JSON.stringify(m, null, 2) + '\n', 'utf8');
    const r = verifyGoldenSetIntegrity(fx.root);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('manifest-hash-mismatch');
    rmSync(fx.root, { recursive: true, force: true });
  });

  it('detects unknown extra file added under golden-set', () => {
    const fx = buildFixture();
    writeFileSync(join(fx.root, 'cat1', 'sneaky.json'), '{}', 'utf8');
    const r = verifyGoldenSetIntegrity(fx.root);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const kinds = r.violations.map(v => v.kind);
      expect(kinds).toContain('unknown-file-in-golden-set');
    }
    rmSync(fx.root, { recursive: true, force: true });
  });

  it('detects missing referenced file', () => {
    const fx = buildFixture();
    rmSync(fx.scenarioPath);
    const r = verifyGoldenSetIntegrity(fx.root);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.violations.some(v => v.kind === 'file-missing')).toBe(true);
    rmSync(fx.root, { recursive: true, force: true });
  });

  it('loadGoldenSet throws GoldenSetIntegrityError on tamper', () => {
    const fx = buildFixture();
    writeFileSync(fx.scenarioPath, 'tampered', 'utf8');
    expect(() => loadGoldenSet(fx.root)).toThrow(GoldenSetIntegrityError);
    rmSync(fx.root, { recursive: true, force: true });
  });

  it('sha256Hex matches a known value', () => {
    expect(sha256Hex(Buffer.from('hello', 'utf8'))).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
  });

  it('verifies the real bundled 50-scenario set', () => {
    const realRoot = join(__dirname, '..', '..', 'golden-set');
    const r = verifyGoldenSetIntegrity(realRoot);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.entries_count).toBe(50);
  });
});
