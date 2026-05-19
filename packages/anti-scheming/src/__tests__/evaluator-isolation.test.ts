/**
 * Tests for Module 7 — Evaluator Isolation Gate.
 */
import { describe, it, expect } from 'vitest';
import type { BrainContext, EvaluatorContext } from '../evaluator-isolation-gate/index.js';
import {
  decideRead,
  decideWrite,
  PROTECTED_PATHS,
  FORBIDDEN_WRITE_PREFIXES,
  unsafeClaimEvaluatorContext,
  evaluatorIsolationPreToolUse,
  renderViolation,
} from '../evaluator-isolation-gate/index.js';

const brain: BrainContext = {
  // brand symbol satisfied at runtime by isEvaluatorContext check
  trace_id: 'brain-trace',
  tenant_id: 't',
  autonomy_level: 'full',
} as unknown as BrainContext;

const evaluator: EvaluatorContext = unsafeClaimEvaluatorContext({
  trace_id: 'evaluator-trace',
  invoked_by: 'external-nightly-auditor',
  key_id: 'offline-2026',
});

describe('evaluator isolation — runtime decisions', () => {
  it('denies brain read of golden-set', () => {
    const d = decideRead('packages/anti-scheming/golden-set/MANIFEST.json', brain);
    expect(d.allowed).toBe(false);
    expect(d.violation?.kind).toBe('brain-attempted-golden-read');
  });

  it('allows evaluator read of golden-set', () => {
    const d = decideRead('packages/anti-scheming/golden-set/MANIFEST.json', evaluator);
    expect(d.allowed).toBe(true);
    expect(d.reason).toContain('evaluator-bypass');
  });

  it('denies brain write to constitution', () => {
    const d = decideWrite('Docs/BOSSNYUMBA_CONSTITUTION.md', brain);
    expect(d.allowed).toBe(false);
  });

  it('denies evaluator runtime write to golden-set (sign offline only)', () => {
    const d = decideWrite('packages/anti-scheming/golden-set/MANIFEST.json', evaluator);
    expect(d.allowed).toBe(false);
  });

  it('allows brain read of unrelated paths', () => {
    const d = decideRead('packages/agent-platform/src/index.ts', brain);
    expect(d.allowed).toBe(true);
  });

  it('PROTECTED_PATHS includes golden-set and constitution', () => {
    const prefixes = PROTECTED_PATHS.map(p => p.prefix);
    expect(prefixes).toContain('packages/anti-scheming/golden-set/');
    expect(prefixes.some(p => p.startsWith('Docs/BOSSNYUMBA_CONSTITUTION'))).toBe(true);
  });

  it('renderViolation produces a one-line audit string', () => {
    const v = decideRead('packages/anti-scheming/golden-set/x.json', brain).violation!;
    const s = renderViolation(v);
    expect(s).toContain('brain-attempted-golden-read');
    expect(s).toContain('packages/anti-scheming/golden-set/x.json');
  });
});

describe('evaluator isolation — PreToolUse hook', () => {
  it('denies direct Write to protected prefix', () => {
    const d = evaluatorIsolationPreToolUse({ tool: 'Write', path: 'packages/anti-scheming/src/whatever.ts', invoked_by_trace_id: 't' });
    expect(d.allow).toBe(false);
    expect(d.matched_prefix).toBe('packages/anti-scheming/');
  });

  it('denies Edit to .claude/golden-set/', () => {
    const d = evaluatorIsolationPreToolUse({ tool: 'Edit', path: '.claude/golden-set/foo.json', invoked_by_trace_id: 't' });
    expect(d.allow).toBe(false);
  });

  it('allows writes outside protected prefixes', () => {
    const d = evaluatorIsolationPreToolUse({ tool: 'Write', path: 'packages/agent-platform/foo.ts', invoked_by_trace_id: 't' });
    expect(d.allow).toBe(true);
  });

  it('catches Bash rm against protected prefix', () => {
    const d = evaluatorIsolationPreToolUse({ tool: 'Bash', command: 'rm -rf packages/anti-scheming/golden-set/foo', invoked_by_trace_id: 't' });
    expect(d.allow).toBe(false);
  });

  it('catches Bash redirect to protected prefix', () => {
    const d = evaluatorIsolationPreToolUse({ tool: 'Bash', command: 'echo evil > packages/anti-scheming/x.json', invoked_by_trace_id: 't' });
    expect(d.allow).toBe(false);
  });

  it('catches Bash sed -i on protected prefix', () => {
    const d = evaluatorIsolationPreToolUse({ tool: 'Bash', command: 'sed -i s/a/b/g packages/anti-scheming/foo.ts', invoked_by_trace_id: 't' });
    expect(d.allow).toBe(false);
  });

  it('allows unrelated Bash commands', () => {
    const d = evaluatorIsolationPreToolUse({ tool: 'Bash', command: 'ls packages', invoked_by_trace_id: 't' });
    expect(d.allow).toBe(true);
  });

  it('FORBIDDEN_WRITE_PREFIXES includes both expected entries', () => {
    expect(FORBIDDEN_WRITE_PREFIXES).toContain('packages/anti-scheming/');
    expect(FORBIDDEN_WRITE_PREFIXES).toContain('.claude/golden-set/');
  });

  it('normalises ./ prefix', () => {
    const d = evaluatorIsolationPreToolUse({ tool: 'Write', path: './packages/anti-scheming/x.ts', invoked_by_trace_id: 't' });
    expect(d.allow).toBe(false);
  });
});
