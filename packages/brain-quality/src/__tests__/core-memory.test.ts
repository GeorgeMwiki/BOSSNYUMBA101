import { describe, expect, it } from 'vitest';

import {
  CoreMemoryOverflowError,
  UnknownCoreBlockKindError,
  appendCore,
  createCoreMemory,
  getCoreBlock,
  renderCoreBlocks,
  replaceCore,
  searchCore,
} from '../memory/core-memory.js';

describe('CoreMemory — session-scoped tier 2 (MemGPT paging)', () => {
  it('createCoreMemory starts empty', () => {
    const m = createCoreMemory();
    expect(m.blocks.size).toBe(0);
    expect(m.tokens).toBe(0);
  });

  it('appendCore creates a block when none exists', () => {
    let m = createCoreMemory();
    m = appendCore(m, { kind: 'persona', text: 'first-person voice of the agent' });
    const block = getCoreBlock(m, 'persona');
    expect(block?.text).toContain('first-person voice');
    expect(m.tokens).toBeGreaterThan(0);
  });

  it('appendCore concatenates with existing block', () => {
    let m = createCoreMemory();
    m = appendCore(m, { kind: 'human', text: 'tenant likes morning emails' });
    m = appendCore(m, { kind: 'human', text: 'tenant is right-handed' });
    const block = getCoreBlock(m, 'human');
    expect(block?.text).toContain('morning emails');
    expect(block?.text).toContain('right-handed');
  });

  it('appendCore is immutable (does not mutate input)', () => {
    const original = createCoreMemory();
    const after = appendCore(original, { kind: 'project', text: 'x' });
    expect(original.blocks.size).toBe(0);
    expect(after.blocks.size).toBe(1);
  });

  it('replaceCore overwrites prior text', () => {
    let m = createCoreMemory();
    m = appendCore(m, { kind: 'preferences', text: 'prefers KES' });
    m = replaceCore(m, { kind: 'preferences', text: 'prefers any user-chosen currency' });
    expect(getCoreBlock(m, 'preferences')?.text).toBe(
      'prefers any user-chosen currency',
    );
  });

  it('replaceCore with empty string deletes the block', () => {
    let m = createCoreMemory();
    m = appendCore(m, { kind: 'scratchpad', text: 'temp note' });
    m = replaceCore(m, { kind: 'scratchpad', text: '' });
    expect(getCoreBlock(m, 'scratchpad')).toBeUndefined();
  });

  it('searchCore returns matching blocks (case-insensitive)', () => {
    let m = createCoreMemory();
    m = appendCore(m, { kind: 'human', text: 'Tenant Mary lives in Block A' });
    m = appendCore(m, { kind: 'project', text: 'renovation plan' });
    const hits = searchCore(m, { query: 'mary' });
    expect(hits).toHaveLength(1);
    expect(hits[0]?.kind).toBe('human');
  });

  it('searchCore returns nothing for empty query', () => {
    let m = createCoreMemory();
    m = appendCore(m, { kind: 'human', text: 'x' });
    expect(searchCore(m, { query: '   ' })).toHaveLength(0);
  });

  it('searchCore respects limit', () => {
    let m = createCoreMemory();
    m = appendCore(m, { kind: 'human', text: 'apple banana' });
    m = appendCore(m, { kind: 'project', text: 'apple grape' });
    m = appendCore(m, { kind: 'preferences', text: 'apple kiwi' });
    const hits = searchCore(m, { query: 'apple', limit: 2 });
    expect(hits).toHaveLength(2);
  });

  it('throws CoreMemoryOverflowError when block exceeds per-block cap', () => {
    const m = createCoreMemory({ maxTokensPerBlock: 5, maxTokensTotal: 100 });
    expect(() =>
      appendCore(m, { kind: 'persona', text: 'x'.repeat(200) }),
    ).toThrow(CoreMemoryOverflowError);
  });

  it('throws CoreMemoryOverflowError when total cap exceeded', () => {
    let m = createCoreMemory({ maxTokensPerBlock: 50, maxTokensTotal: 30 });
    m = appendCore(m, { kind: 'persona', text: 'x'.repeat(40) }); // ~10 tokens
    expect(() =>
      appendCore(m, { kind: 'human', text: 'y'.repeat(120) }), // ~30 tokens
    ).toThrow(CoreMemoryOverflowError);
  });

  it('throws UnknownCoreBlockKindError on bad kind', () => {
    const m = createCoreMemory();
    expect(() =>
      appendCore(m, { kind: 'invalid-kind' as never, text: 'x' }),
    ).toThrow(UnknownCoreBlockKindError);
  });

  it('renderCoreBlocks emits in canonical order', () => {
    let m = createCoreMemory();
    m = appendCore(m, { kind: 'project', text: 'P' });
    m = appendCore(m, { kind: 'persona', text: 'A' });
    m = appendCore(m, { kind: 'human', text: 'H' });
    const rendered = renderCoreBlocks(m);
    const personaAt = rendered.indexOf('## persona');
    const humanAt = rendered.indexOf('## human');
    const projectAt = rendered.indexOf('## project');
    expect(personaAt).toBeGreaterThanOrEqual(0);
    expect(personaAt).toBeLessThan(humanAt);
    expect(humanAt).toBeLessThan(projectAt);
  });

  it('appendCore with empty string is a no-op', () => {
    let m = createCoreMemory();
    const before = m.tokens;
    m = appendCore(m, { kind: 'persona', text: '' });
    expect(m.tokens).toBe(before);
  });
});
