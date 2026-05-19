import { describe, expect, it } from 'vitest';
import { collectRefTargets, parseMarkdownParagraphs } from './markdown-tokens';

describe('parseMarkdownParagraphs', () => {
  it('returns an empty list for empty markdown', () => {
    expect(parseMarkdownParagraphs('')).toEqual([]);
  });

  it('splits paragraphs on blank lines', () => {
    const out = parseMarkdownParagraphs('one\n\ntwo\n\nthree');
    expect(out).toHaveLength(3);
  });

  it('collapses single newlines inside a paragraph', () => {
    const out = parseMarkdownParagraphs('one\nstill one');
    expect(out).toHaveLength(1);
    expect(out[0]?.segments[0]).toMatchObject({ kind: 'text', text: 'one still one' });
  });

  it('parses a `[ref:block-id]` token', () => {
    const out = parseMarkdownParagraphs('see [ref:blk-7] above');
    const segs = out[0]?.segments ?? [];
    expect(segs).toHaveLength(3);
    expect(segs[1]).toMatchObject({ kind: 'ref', refToBlockId: 'blk-7', label: 'blk-7' });
  });

  it('parses a `[ref:id|Label]` token with custom label', () => {
    const out = parseMarkdownParagraphs('as in [ref:chart-7|the chart above].');
    const segs = out[0]?.segments ?? [];
    expect(segs.some((s) => s.kind === 'ref' && s.label === 'the chart above')).toBe(true);
  });

  it('parses **strong** emphasis', () => {
    const out = parseMarkdownParagraphs('this is **bold** text');
    const segs = out[0]?.segments ?? [];
    expect(segs.some((s) => s.kind === 'emphasis' && s.strength === 'strong' && s.text === 'bold')).toBe(true);
  });

  it('parses *italic* emphasis', () => {
    const out = parseMarkdownParagraphs('this is *italic* text');
    const segs = out[0]?.segments ?? [];
    expect(segs.some((s) => s.kind === 'emphasis' && s.strength === 'em' && s.text === 'italic')).toBe(true);
  });

  it('handles multiple refs in one paragraph', () => {
    const out = parseMarkdownParagraphs('compare [ref:a] vs [ref:b]');
    const refs = (out[0]?.segments ?? []).filter((s) => s.kind === 'ref');
    expect(refs).toHaveLength(2);
  });
});

describe('collectRefTargets', () => {
  it('collects unique ref ids across paragraphs', () => {
    const paragraphs = parseMarkdownParagraphs('see [ref:a]\n\nalso [ref:b] and [ref:a]');
    const targets = [...collectRefTargets(paragraphs)].sort();
    expect(targets).toEqual(['a', 'b']);
  });

  it('returns empty when no refs', () => {
    expect(collectRefTargets(parseMarkdownParagraphs('plain text'))).toEqual([]);
  });
});
