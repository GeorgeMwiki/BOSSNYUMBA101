/**
 * Blackboard parser + 9 primitives tests — real-estate retailored.
 */

import { describe, expect, it } from 'vitest';

import {
  BOARD_ELEMENT_TYPES,
  boardElementSchema,
} from '../board-element-types.js';
import { parseBoardElements } from '../parse-board-elements.js';

describe('BOARD_ELEMENT_TYPES', () => {
  it('lists exactly 9 primitives', () => {
    expect(BOARD_ELEMENT_TYPES.length).toBe(9);
  });

  it('includes formula / diagram / chart / comparison / image / text / highlight / arrow / sketch', () => {
    expect(BOARD_ELEMENT_TYPES).toEqual([
      'formula',
      'diagram',
      'chart',
      'comparison',
      'image',
      'text',
      'highlight',
      'arrow',
      'sketch',
    ]);
  });
});

describe('boardElementSchema', () => {
  it('validates a real-estate chart payload (rent collection)', () => {
    const result = boardElementSchema.safeParse({
      type: 'chart',
      id: 'chart-rent-q1',
      kind: 'line',
      title: { en: 'Rent Collection Q1', sw: 'Ukusanyaji wa kodi Q1' },
      series: [
        {
          name: 'Collected',
          color: 'success',
          points: [
            { x: 'Jan', y: 4.2 },
            { x: 'Feb', y: 4.5 },
            { x: 'Mar', y: 4.8 },
          ],
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('validates a comparison primitive (Tier A vs Tier B leases)', () => {
    const result = boardElementSchema.safeParse({
      type: 'comparison',
      id: 'cmp-lease-tiers',
      headline: { en: 'Lease comparison', sw: 'Linganisha mikataba' },
      cardA: {
        label: { en: 'Standard 12-month', sw: 'Kawaida miezi 12' },
        bullets: [
          { en: 'Lower deposit', sw: 'Amana ndogo' },
          { en: 'Flexible renewal', sw: 'Kufanya upya rahisi' },
        ],
        metric: {
          label: { en: 'Monthly rent', sw: 'Kodi ya kila mwezi' },
          value: 'TZS 1.2M',
          tone: 'positive',
        },
      },
      cardB: {
        label: { en: 'Premium 24-month', sw: 'Premium miezi 24' },
        bullets: [{ en: 'Locked rate', sw: 'Bei iliyofungwa' }],
      },
    });
    expect(result.success).toBe(true);
  });

  it('rejects an unknown element type', () => {
    const result = boardElementSchema.safeParse({
      type: 'whiteboard',
      id: 'x',
    });
    expect(result.success).toBe(false);
  });

  it('validates a formula primitive with bilingual variable meanings', () => {
    const result = boardElementSchema.safeParse({
      type: 'formula',
      id: 'fml-yield',
      latex: 'yield = \\frac{rent_{annual}}{price_{purchase}}',
      variables: [
        {
          symbol: 'rent_{annual}',
          meaning: { en: 'Annual rent', sw: 'Kodi ya mwaka' },
        },
        {
          symbol: 'price_{purchase}',
          meaning: { en: 'Purchase price', sw: 'Bei ya kununua' },
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('validates a diagram primitive (tree of properties)', () => {
    const result = boardElementSchema.safeParse({
      type: 'diagram',
      id: 'diag-prop-tree',
      kind: 'tree',
      nodes: [
        { id: 'root', label: { en: 'Portfolio', sw: 'Mkusanyiko' } },
        {
          id: 'r1',
          parentId: 'root',
          label: { en: 'Mwenge', sw: 'Mwenge' },
        },
      ],
    });
    expect(result.success).toBe(true);
  });
});

describe('parseBoardElements', () => {
  it('extracts a single board_add element + cleans the body', () => {
    const text = [
      'Let me sketch this out.',
      '<board_add>{"type":"text","id":"t1","body":{"en":"Hello","sw":"Habari"}}</board_add>',
      'Done.',
    ].join(' ');
    const result = parseBoardElements(text);
    expect(result.elements).toHaveLength(1);
    expect(result.elements[0]?.type).toBe('text');
    expect(result.body).not.toContain('<board_add>');
    expect(result.dropped).toBe(0);
  });

  it('drops payloads that fail schema validation', () => {
    const text =
      '<board_add>{"type":"text","id":"t1"}</board_add> <board_add>{"type":"text","id":"t2","body":{"en":"Good","sw":"Sawa"}}</board_add>';
    const result = parseBoardElements(text);
    expect(result.elements).toHaveLength(1);
    expect(result.dropped).toBe(1);
  });

  it('skips duplicate ids in the same reply', () => {
    const text = [
      '<board_add>{"type":"text","id":"dup","body":{"en":"A","sw":"A"}}</board_add>',
      '<board_add>{"type":"text","id":"dup","body":{"en":"B","sw":"B"}}</board_add>',
    ].join(' ');
    const result = parseBoardElements(text);
    expect(result.elements).toHaveLength(1);
    expect((result.elements[0] as { body: { en: string } }).body.en).toBe(
      'A',
    );
  });

  it('caps at 12 elements per turn', () => {
    const blocks = Array.from(
      { length: 15 },
      (_, i) =>
        `<board_add>{"type":"text","id":"e${i}","body":{"en":"e${i}","sw":"e${i}"}}</board_add>`,
    ).join(' ');
    const result = parseBoardElements(blocks);
    expect(result.elements).toHaveLength(12);
    expect(result.dropped).toBeGreaterThanOrEqual(3);
  });

  it('strips orphan tags even when payload is missing', () => {
    const text = '<board_add>nonsense</board_add>';
    const result = parseBoardElements(text);
    expect(result.elements).toHaveLength(0);
    expect(result.body).not.toContain('<board_add>');
  });
});
