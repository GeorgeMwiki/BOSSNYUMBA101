/**
 * Tests for Module 3 — Specification Self-Correction.
 */
import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sha256Hex } from '../immutable-golden-eval/index.js';
import {
  loadConstitution,
  critique,
  shouldProceed,
  ConstitutionTamperError,
} from '../specification-self-correction/index.js';

function makeConstitution(content: string): string {
  const root = mkdtempSync(join(tmpdir(), 'con-'));
  const rel = 'CONSTITUTION.md';
  const buf = Buffer.from(content, 'utf8');
  writeFileSync(join(root, rel), buf);
  const file = { path: rel, sha256: sha256Hex(buf), bytes: buf.length };
  const manifest = { version: '1', key_id: 'k', files: [file], manifest_hash: 'unused', signature: 's' };
  writeFileSync(join(root, 'CONSTITUTION-MANIFEST.json'), JSON.stringify(manifest, null, 2), 'utf8');
  return root;
}

describe('specification self-correction', () => {
  it('loads constitution and validates sha', () => {
    const root = makeConstitution('# constitution\nNo hard-coded jurisdiction allowed.\n');
    const c = loadConstitution(root);
    expect(c.content).toContain('No hard-coded jurisdiction');
    rmSync(root, { recursive: true, force: true });
  });

  it('throws ConstitutionTamperError on byte drift', () => {
    const root = makeConstitution('# c\n');
    writeFileSync(join(root, 'CONSTITUTION.md'), 'tampered', 'utf8');
    expect(() => loadConstitution(root)).toThrow(ConstitutionTamperError);
    rmSync(root, { recursive: true, force: true });
  });

  it('throws when constitution file is missing', () => {
    const root = makeConstitution('# c\n');
    rmSync(join(root, 'CONSTITUTION.md'));
    expect(() => loadConstitution(root)).toThrow(ConstitutionTamperError);
    rmSync(root, { recursive: true, force: true });
  });

  it('aligned verdict when no clause conflict', () => {
    const root = makeConstitution('# c\nfoo\n');
    const c = loadConstitution(root);
    const r = critique(c, { tool: 'send_email', args: { to: 'x' }, destructive: false, justification: 'j', tenant_id: 't', actor_id: 'a' });
    expect(r.verdict.status).toBe('aligned');
    expect(shouldProceed(r)).toBe(true);
    rmSync(root, { recursive: true, force: true });
  });

  it('catches AUDIT-IMMUTABILITY conflict', () => {
    const root = makeConstitution('# c\nThe audit log is append-only.\n');
    const c = loadConstitution(root);
    const r = critique(c, { tool: 'delete_audit_log', args: {}, destructive: true, justification: 'j', tenant_id: 't', actor_id: 'a' });
    expect(r.verdict.status).toBe('conflict');
    if (r.verdict.status === 'conflict') {
      expect(r.verdict.clause).toBe('AUDIT-IMMUTABILITY');
      expect(r.verdict.recommendation).toBe('refuse');
    }
    rmSync(root, { recursive: true, force: true });
  });

  it('catches JURISDICTION-PORTABILITY conflict', () => {
    const root = makeConstitution('# c\nNo hard-coded jurisdiction allowed.\n');
    const c = loadConstitution(root);
    const r = critique(c, { tool: 'set_jurisdiction', args: { jurisdiction: 'KE' }, destructive: true, justification: 'j', tenant_id: 't', actor_id: 'a' });
    expect(r.verdict.status).toBe('conflict');
    rmSync(root, { recursive: true, force: true });
  });

  it('catches PAYMENT-CAP conflict + recommends escalate', () => {
    const root = makeConstitution('# c\nPayments above $5000 require four-eye approval.\n');
    const c = loadConstitution(root);
    const r = critique(c, { tool: 'process_payment', args: { amount: 10000 }, destructive: true, justification: 'j', tenant_id: 't', actor_id: 'a' });
    expect(r.verdict.status).toBe('conflict');
    if (r.verdict.status === 'conflict') expect(r.verdict.recommendation).toBe('escalate');
    rmSync(root, { recursive: true, force: true });
  });

  it('catches SELF-MODIFICATION conflict', () => {
    const root = makeConstitution('# c\nThe brain MUST NOT modify its own autonomy caps.\n');
    const c = loadConstitution(root);
    const r = critique(c, { tool: 'self_modify', args: { autonomy_cap: 'full' }, destructive: true, justification: 'j', tenant_id: 't', actor_id: 'a' });
    expect(r.verdict.status).toBe('conflict');
    rmSync(root, { recursive: true, force: true });
  });

  it('flags unsafe-to-proceed when destructive pattern + destructive=false', () => {
    const root = makeConstitution('# c\n');
    const c = loadConstitution(root);
    const r = critique(c, { tool: 'drop_table', args: { name: 'tenants' }, destructive: false, justification: 'j', tenant_id: 't', actor_id: 'a' });
    expect(r.verdict.status).toBe('unsafe-to-proceed');
    expect(shouldProceed(r)).toBe(false);
    rmSync(root, { recursive: true, force: true });
  });
});
