/**
 * SuperpowerChips — schema integrity tests.
 *
 * The schemas are the JSON contract between the SSE chip parser
 * (services/api-gateway/src/routes/ui-navigate-parser.ts) and the
 * frontend renderer. A schema regression here would silently break
 * brain → owner UI actions.
 */

import { describe, expect, it } from 'vitest';
import {
  uiNavigateChipSchema,
  uiPrefillChipSchema,
  uiHighlightChipSchema,
  uiShareChipSchema,
  uiBulkChipSchema,
  uiUndoChipSchema,
  uiCmdkChipSchema,
  uiBookmarkChipSchema,
} from '../SuperpowerChips';

describe('uiNavigateChipSchema', () => {
  it('accepts a minimal chip', () => {
    const r = uiNavigateChipSchema.safeParse({
      route: '/maintenance',
      reason: 'Open maintenance for Westlands',
    });
    expect(r.success).toBe(true);
  });

  it('rejects route missing leading slash', () => {
    const r = uiNavigateChipSchema.safeParse({
      route: 'maintenance',
      reason: 'x',
    });
    expect(r.success).toBe(false);
  });
});

describe('uiPrefillChipSchema', () => {
  it('accepts form values of mixed primitive types', () => {
    const r = uiPrefillChipSchema.safeParse({
      formId: 'rent-increase-form',
      values: {
        leaseId: 'lease-1',
        increasePct: 7,
        applyNow: true,
        note: null,
      },
    });
    expect(r.success).toBe(true);
  });
});

describe('uiHighlightChipSchema', () => {
  it('requires bilingual message', () => {
    const r = uiHighlightChipSchema.safeParse({
      selector: '#rent-card',
      message: { en: 'Rent up 7%', sw: 'Kodi imepanda 7%' },
      tone: 'success',
    });
    expect(r.success).toBe(true);
  });

  it('rejects when sw missing', () => {
    const r = uiHighlightChipSchema.safeParse({
      selector: '#x',
      message: { en: 'Only English' },
    });
    expect(r.success).toBe(false);
  });
});

describe('uiShareChipSchema', () => {
  it('accepts share with email recipients + permission', () => {
    const r = uiShareChipSchema.safeParse({
      entityType: 'lease',
      entityId: 'lease-1',
      recipients: ['owner@example.com'],
      expiresInHours: 72,
      permission: 'read',
    });
    expect(r.success).toBe(true);
  });
});

describe('uiBulkChipSchema', () => {
  it('requires at least one id + reason', () => {
    const r = uiBulkChipSchema.safeParse({
      entityType: 'rent_invoice',
      ids: ['inv-1', 'inv-2'],
      action: 'send_reminder',
      reason: 'Reminders for May',
    });
    expect(r.success).toBe(true);
  });

  it('rejects empty ids list', () => {
    const r = uiBulkChipSchema.safeParse({
      entityType: 'rent_invoice',
      ids: [],
      action: 'send_reminder',
      reason: 'x',
    });
    expect(r.success).toBe(false);
  });
});

describe('uiUndoChipSchema — direction + bilingual description', () => {
  it('accepts undo with bilingual description', () => {
    const r = uiUndoChipSchema.safeParse({
      direction: 'undo',
      description: { en: 'Reversed rent increase', sw: 'Imeghairi panda kodi' },
      windowSeconds: 300,
    });
    expect(r.success).toBe(true);
  });

  it('accepts redo direction', () => {
    const r = uiUndoChipSchema.safeParse({ direction: 'redo' });
    expect(r.success).toBe(true);
  });

  it('rejects bad direction', () => {
    const r = uiUndoChipSchema.safeParse({ direction: 'rewind' });
    expect(r.success).toBe(false);
  });
});

describe('uiCmdkChipSchema — recents + intent', () => {
  it('accepts cmdk with preset recents', () => {
    const r = uiCmdkChipSchema.safeParse({
      intent: 'search-tenants',
      presetRecents: ['Mary Wanjiku', 'James Otieno'],
      scopeIds: ['prop-1'],
    });
    expect(r.success).toBe(true);
  });
});

describe('uiBookmarkChipSchema — folder + tags', () => {
  it('accepts bookmark with folder + tags', () => {
    const r = uiBookmarkChipSchema.safeParse({
      entityType: 'property',
      entityId: 'prop-1',
      label: 'Westlands Greenfield',
      folder: 'High-Performers',
      tags: ['mary-w', 'high-yield'],
    });
    expect(r.success).toBe(true);
  });
});
