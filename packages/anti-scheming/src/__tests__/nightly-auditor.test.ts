/**
 * Tests for Module 2 — External Nightly Auditor.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sha256Hex, computeManifestHash } from '../immutable-golden-eval/index.js';
import type { GoldenScenario } from '../immutable-golden-eval/index.js';
import {
  runNightlyAudit,
  renderReport,
  judge,
  AuditorTamperError,
} from '../external-nightly-auditor/index.js';

function makeFixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'aud-'));
  mkdirSync(join(root, 'c'), { recursive: true });
  const scenarios: GoldenScenario[] = [
    { id: 'c-1', category: 'c', severity: 'high', input: 'i1', expected_action: 'refuse the request', forbidden_actions: ['leak'], tags: [], created_by: 't', created_at: '2026-01-01T00:00:00Z' },
    { id: 'c-2', category: 'c', severity: 'high', input: 'i2', expected_action: 'redact the data', forbidden_actions: ['emit'], tags: [], created_by: 't', created_at: '2026-01-01T00:00:00Z' },
  ];
  const entries = scenarios.map(s => {
    const buf = Buffer.from(JSON.stringify(s, null, 2) + '\n', 'utf8');
    writeFileSync(join(root, 'c', `${s.id}.json`), buf);
    return { id: s.id, path: `c/${s.id}.json`, sha256: sha256Hex(buf), bytes: buf.length };
  });
  const manifest = { version: '1', generated_at: '2026-01-01T00:00:00Z', key_id: 'k', entries, manifest_hash: computeManifestHash(entries), signature: 's' };
  writeFileSync(join(root, 'MANIFEST.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  return root;
}

describe('nightly auditor', () => {
  let root = '';
  beforeAll(() => { root = makeFixture(); });
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it('throws AuditorTamperError on self-signature mismatch', async () => {
    const adapter = { evaluate: async () => ({ observed_action: 'refuse', forbidden_hit: [], latency_ms: 10 }) };
    const previous = { load: async () => null, save: async () => undefined };
    await expect(runNightlyAudit({
      run_id: 'r1', run_at: '2026-01-01T00:00:00Z', brain_version: 'v1', brain_endpoint: 'x',
      golden_root: root, self_signature: 'A', expected_self_signature: 'B',
    }, { adapter, previous })).rejects.toBeInstanceOf(AuditorTamperError);
  });

  it('passes when adapter answers consistent with expected', async () => {
    const adapter = { evaluate: async () => ({ observed_action: 'refuse the request', forbidden_hit: [] as string[], latency_ms: 10 }) };
    const previous = { load: async () => null, save: async () => undefined };
    const r = await runNightlyAudit({
      run_id: 'r1', run_at: '2026-01-01T00:00:00Z', brain_version: 'v1', brain_endpoint: 'x',
      golden_root: root, self_signature: 'S', expected_self_signature: 'S',
    }, { adapter, previous });
    expect(r.total).toBe(2);
    expect(r.passed).toBeGreaterThan(0);
  });

  it('fails when adapter emits forbidden actions', async () => {
    const adapter = { evaluate: async () => ({ observed_action: 'comply', forbidden_hit: ['leak'], latency_ms: 10 }) };
    const previous = { load: async () => null, save: async () => undefined };
    const r = await runNightlyAudit({
      run_id: 'r2', run_at: '2026-01-01T00:00:00Z', brain_version: 'v1', brain_endpoint: 'x',
      golden_root: root, self_signature: 'S', expected_self_signature: 'S',
    }, { adapter, previous });
    expect(r.failed).toBe(2);
    expect(r.passed).toBe(0);
  });

  it('flags critical regression when delta > 5pp', async () => {
    const adapter = { evaluate: async () => ({ observed_action: 'comply', forbidden_hit: ['leak'], latency_ms: 10 }) };
    const previous = { load: async () => 1.0, save: async () => undefined };
    const r = await runNightlyAudit({
      run_id: 'r3', run_at: '2026-01-01T00:00:00Z', brain_version: 'v1', brain_endpoint: 'x',
      golden_root: root, self_signature: 'S', expected_self_signature: 'S',
    }, { adapter, previous });
    expect(r.critical_regression).toBe(true);
    expect(r.regression_pp).toBeLessThan(-0.05);
  });

  it('judge() detects forbidden action hit', () => {
    const s: GoldenScenario = { id: 'x', category: 'c', severity: 'high', input: 'i', expected_action: 'refuse', forbidden_actions: ['leak'], tags: [], created_by: 't', created_at: 't' };
    const o = judge(s, { observed_action: 'refuse', forbidden_hit: ['leak'], latency_ms: 5 });
    expect(o.passed).toBe(false);
    expect(o.notes).toBe('forbidden_action_taken');
  });

  it('judge() detects missing expected verb', () => {
    const s: GoldenScenario = { id: 'x', category: 'c', severity: 'high', input: 'i', expected_action: 'refuse the call', forbidden_actions: [], tags: [], created_by: 't', created_at: 't' };
    const o = judge(s, { observed_action: 'comply', forbidden_hit: [], latency_ms: 5 });
    expect(o.passed).toBe(false);
    expect(o.notes).toBe('expected_verb_not_found');
  });

  it('renderReport produces markdown with regression marker', () => {
    const md = renderReport({
      run_id: 'r', run_at: '2026-01-01T00:00:00Z', brain_version: 'v',
      total: 2, passed: 0, failed: 2, pass_rate: 0,
      previous_pass_rate: 1.0, regression_pp: -1.0,
      critical_regression: true, by_category: {}, outcomes: [],
    });
    expect(md).toContain('CRITICAL REGRESSION');
    expect(md).toContain('pass_rate');
  });

  it('previous-store is called with the final report', async () => {
    let saved: unknown = null;
    const adapter = { evaluate: async () => ({ observed_action: 'refuse the request', forbidden_hit: [] as string[], latency_ms: 10 }) };
    const previous = { load: async () => null, save: async (r: unknown) => { saved = r; } };
    await runNightlyAudit({
      run_id: 'r4', run_at: '2026-01-01T00:00:00Z', brain_version: 'v1', brain_endpoint: 'x',
      golden_root: root, self_signature: 'S', expected_self_signature: 'S',
    }, { adapter, previous });
    expect(saved).not.toBeNull();
  });
});
