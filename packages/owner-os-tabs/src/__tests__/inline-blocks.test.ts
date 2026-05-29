/**
 * inline-blocks tests — BossNyumba real-estate edition.
 *
 * Covers:
 *   - 16 block types are listed in INLINE_BLOCK_TYPES
 *   - parseInlineBlocks extracts every valid block in order
 *   - malformed JSON / unknown types are dropped silently
 *   - 8-block parser cap holds
 *   - extractAutoAuthorized strips + parses the companion tag
 *   - schemas validate canonical real-estate payloads
 */

import { describe, expect, it } from 'vitest';

import {
  INLINE_BLOCK_TYPES,
  dataCaptureCardSchema,
  confirmationCardSchema,
  microActionCardSchema,
  miniMetricSchema,
  tabPromotionChipSchema,
  inlineTableSchema,
  inlineChartSchema,
  parseInlineBlocks,
  extractAutoAuthorized,
} from '../inline-blocks.js';

describe('INLINE_BLOCK_TYPES', () => {
  it('contains exactly 16 block types', () => {
    expect(INLINE_BLOCK_TYPES.length).toBe(16);
  });

  it('includes the canonical real-estate-supporting blocks', () => {
    expect(INLINE_BLOCK_TYPES).toContain('data_capture_card');
    expect(INLINE_BLOCK_TYPES).toContain('confirmation_card');
    expect(INLINE_BLOCK_TYPES).toContain('file_request_card');
    expect(INLINE_BLOCK_TYPES).toContain('mini_metric');
    expect(INLINE_BLOCK_TYPES).toContain('inline_table');
    expect(INLINE_BLOCK_TYPES).toContain('inline_chart');
    expect(INLINE_BLOCK_TYPES).toContain('inline_wizard');
    expect(INLINE_BLOCK_TYPES).toContain('inline_workflow');
    expect(INLINE_BLOCK_TYPES).toContain('inline_comparison');
    expect(INLINE_BLOCK_TYPES).toContain('citations_block');
  });
});

describe('schema validation — real-estate payloads', () => {
  it('data_capture_card accepts a property-picker field', () => {
    const result = dataCaptureCardSchema.safeParse({
      type: 'data_capture_card',
      purpose: 'collect_property',
      submitAction: 'rent.collect',
      fields: [
        {
          key: 'propertyId',
          label: { en: 'Property', sw: 'Mali' },
          kind: 'property-picker',
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('confirmation_card with auto-authorize requires rationale', () => {
    const ok = confirmationCardSchema.safeParse({
      type: 'confirmation_card',
      question: 'Send rent reminder to Mwenge T-23?',
      summary: 'Reminder for 25 May 2026',
      primaryAction: { label: 'Send', kind: 'primary' },
      secondaryAction: { label: 'Cancel', kind: 'ghost' },
      autoAuthorized: true,
      rationale: 'Low-risk reminder; lease auto-renews.',
    });
    expect(ok.success).toBe(true);

    const bad = confirmationCardSchema.safeParse({
      type: 'confirmation_card',
      question: 'Send rent reminder?',
      summary: 'Reminder',
      primaryAction: { label: 'Send', kind: 'primary' },
      secondaryAction: { label: 'Cancel', kind: 'ghost' },
      autoAuthorized: true,
      // rationale missing
    });
    expect(bad.success).toBe(false);
  });

  it('micro_action_card is bilingual', () => {
    const result = microActionCardSchema.safeParse({
      type: 'micro_action_card',
      label: { en: 'Mark renewed', sw: 'Andika imefanyiwa' },
      action: 'lease.renew.mark',
    });
    expect(result.success).toBe(true);
  });

  it('mini_metric supports sparkline', () => {
    const result = miniMetricSchema.safeParse({
      type: 'mini_metric',
      name: 'Rent collected',
      value: 'TZS 4.2M',
      delta: '+12%',
      tone: 'positive',
      sparkline: [3.1, 3.4, 3.8, 4.0, 4.2],
    });
    expect(result.success).toBe(true);
  });

  it('tab_promotion_chip references a known tab type', () => {
    const result = tabPromotionChipSchema.safeParse({
      type: 'tab_promotion_chip',
      tabType: 'maintenance',
      context: { propertyId: 'prop-23' },
      label: { en: 'See full maintenance queue', sw: 'Ona ukarabati wote' },
    });
    expect(result.success).toBe(true);
  });

  it('inline_table validates real-estate columns', () => {
    const result = inlineTableSchema.safeParse({
      type: 'inline_table',
      title: { en: 'Open work orders', sw: 'Kazi za ukarabati' },
      columns: [
        { key: 'ref', label: { en: 'Ref', sw: 'Kumb.' }, kind: 'text' },
        {
          key: 'property',
          label: { en: 'Property', sw: 'Mali' },
          kind: 'text',
        },
        {
          key: 'status',
          label: { en: 'Status', sw: 'Hali' },
          kind: 'status_pill',
        },
      ],
      rows: [],
    });
    expect(result.success).toBe(true);
  });

  it('inline_chart accepts a rent-collection line chart', () => {
    const result = inlineChartSchema.safeParse({
      type: 'inline_chart',
      kind: 'line',
      title: { en: 'Rent collection — Q1 2026', sw: 'Ukusanyaji wa kodi' },
      series: [
        {
          name: 'Collected',
          color: 'green',
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
});

describe('parseInlineBlocks', () => {
  it('extracts a single valid block + cleans the body', () => {
    const text = [
      'Here is the next reminder:',
      '<ui_block>{"type":"mini_metric","name":"Rent due","value":"TZS 1.2M","tone":"warning"}</ui_block>',
      'Tap to act.',
    ].join(' ');
    const result = parseInlineBlocks(text);
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0]?.type).toBe('mini_metric');
    expect(result.body).not.toContain('<ui_block>');
  });

  it('drops malformed JSON silently', () => {
    const text =
      '<ui_block>{"type":"mini_metric","name":"Bad"</ui_block> <ui_block>{"type":"mini_metric","name":"Good","value":"1"}</ui_block>';
    const result = parseInlineBlocks(text);
    expect(result.blocks).toHaveLength(1);
    expect((result.blocks[0] as { name: string }).name).toBe('Good');
  });

  it('drops unknown block types silently', () => {
    const text =
      '<ui_block>{"type":"unknown_block","value":"x"}</ui_block> <ui_block>{"type":"mini_metric","name":"M","value":"1"}</ui_block>';
    const result = parseInlineBlocks(text);
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0]?.type).toBe('mini_metric');
  });

  it('extracts multiple blocks in emission order', () => {
    const text = [
      '<ui_block>{"type":"mini_metric","name":"A","value":"1"}</ui_block>',
      '<ui_block>{"type":"mini_metric","name":"B","value":"2"}</ui_block>',
      '<ui_block>{"type":"mini_metric","name":"C","value":"3"}</ui_block>',
    ].join(' ');
    const result = parseInlineBlocks(text);
    expect(result.blocks).toHaveLength(3);
    expect(result.blocks.map((b) => (b as { name: string }).name)).toEqual([
      'A',
      'B',
      'C',
    ]);
  });

  it('caps at 8 blocks per response', () => {
    const blocks = Array.from(
      { length: 12 },
      (_, i) =>
        `<ui_block>{"type":"mini_metric","name":"M${i}","value":"${i}"}</ui_block>`,
    ).join(' ');
    const result = parseInlineBlocks(blocks);
    expect(result.blocks).toHaveLength(8);
  });
});

describe('extractAutoAuthorized', () => {
  it('parses + strips the auto_authorized tag', () => {
    const text =
      'Action taken. <auto_authorized>{"action":"rent.remind","rationale":"low-risk","payload":{"propertyId":"p1"}}</auto_authorized> Anything else?';
    const result = extractAutoAuthorized(text);
    expect(result.autoAuthorized?.action).toBe('rent.remind');
    expect(result.autoAuthorized?.payload).toEqual({ propertyId: 'p1' });
    expect(result.body).not.toContain('<auto_authorized>');
  });

  it('returns null when no tag is present', () => {
    const result = extractAutoAuthorized('plain text');
    expect(result.autoAuthorized).toBeNull();
    expect(result.body).toBe('plain text');
  });
});
