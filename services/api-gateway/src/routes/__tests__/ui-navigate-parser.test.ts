import { describe, expect, it } from 'vitest';

import {
  parseSuperpowers,
  uiBulkSchema,
  uiNavigateSchema,
} from '../ui-navigate-parser.js';

describe('parseSuperpowers (real-estate)', () => {
  describe('ui_navigate', () => {
    it('extracts a single navigate chip and strips the tag', () => {
      const input = `Let me take you there. <ui_navigate>{"route":"/leases","scopeIds":["nyumba_palace"],"focus":"expiring-90d","ttl":1800,"reason":"You asked about expiring leases."}</ui_navigate> Done.`;
      const result = parseSuperpowers(input);

      expect(result.navigates).toHaveLength(1);
      expect(result.navigates[0]?.route).toBe('/leases');
      expect(result.navigates[0]?.scopeIds).toEqual(['nyumba_palace']);
      expect(result.body).not.toContain('<ui_navigate>');
      expect(result.dropped).toBe(0);
    });

    it('drops malformed JSON but still strips the tag', () => {
      const input = `Sure. <ui_navigate>{not valid json}</ui_navigate>`;
      const result = parseSuperpowers(input);

      expect(result.navigates).toHaveLength(0);
      expect(result.body).not.toContain('<ui_navigate>');
      expect(result.dropped).toBe(1);
    });

    it('rejects routes that do not start with /', () => {
      const safe = uiNavigateSchema.safeParse({
        route: 'leases',
        reason: 'missing leading slash',
      });
      expect(safe.success).toBe(false);
    });

    it('caps at 3 navigates per turn', () => {
      const chip = `<ui_navigate>{"route":"/leases","reason":"x"}</ui_navigate>`;
      const result = parseSuperpowers(chip.repeat(5));
      expect(result.navigates).toHaveLength(3);
      expect(result.dropped).toBe(2);
    });
  });

  describe('ui_prefill', () => {
    it('extracts a prefill chip with stepHints', () => {
      const input = `<ui_prefill>{"formId":"lease-renewal","values":{"leaseId":"l_42","newEndDate":"2027-04-01"},"submitOnAccept":false,"stepHints":[{"stepId":"terms","fieldIds":["rent","term"]}]}</ui_prefill>`;
      const result = parseSuperpowers(input);

      expect(result.prefills).toHaveLength(1);
      expect(result.prefills[0]?.formId).toBe('lease-renewal');
      expect(result.prefills[0]?.stepHints).toHaveLength(1);
    });
  });

  describe('ui_highlight', () => {
    it('requires bilingual sw/en message', () => {
      const input = `<ui_highlight>{"selector":"[data-tour='renew-button']","message":{"en":"Click to renew.","sw":"Bonyeza kupyaisha."},"ttl":8000,"tone":"info"}</ui_highlight>`;
      const result = parseSuperpowers(input);

      expect(result.highlights).toHaveLength(1);
      expect(result.highlights[0]?.message.sw).toBe('Bonyeza kupyaisha.');
    });

    it('rejects highlights missing the swahili half', () => {
      const input = `<ui_highlight>{"selector":"x","message":{"en":"only english"},"ttl":3000}</ui_highlight>`;
      const result = parseSuperpowers(input);
      expect(result.highlights).toHaveLength(0);
      expect(result.dropped).toBe(1);
    });

    it('supports multi-target selectors', () => {
      const input = `<ui_highlight>{"selector":"#a","selectors":["#a","#b"],"message":{"en":"x","sw":"y"}}</ui_highlight>`;
      const result = parseSuperpowers(input);
      expect(result.highlights[0]?.selectors).toEqual(['#a', '#b']);
    });
  });

  describe('ui_share', () => {
    it('extracts a share chip with real-estate entity type', () => {
      const input = `<ui_share>{"entityType":"lease","entityId":"l_42","recipients":["smith@partner.co"],"expiresInHours":24,"permission":"read","revocable":true}</ui_share>`;
      const result = parseSuperpowers(input);

      expect(result.shares).toHaveLength(1);
      expect(result.shares[0]?.entityType).toBe('lease');
      expect(result.shares[0]?.revocable).toBe(true);
    });

    it('rejects mining-domain entity types (real-estate guard)', () => {
      const input = `<ui_share>{"entityType":"royalty_filing","entityId":"r_1"}</ui_share>`;
      const result = parseSuperpowers(input);
      expect(result.shares).toHaveLength(0);
      expect(result.dropped).toBe(1);
    });
  });

  describe('ui_bulk (Borjie 24bf3d44 depth)', () => {
    it('extracts a bulk chip with preview flag + rollback token', () => {
      const input = `<ui_bulk>{"entityType":"rent_invoices","ids":["i1","i2"],"action":"send_reminder","preview":true,"rollbackToken":"tok_42","reason":"chase aging invoices"}</ui_bulk>`;
      const result = parseSuperpowers(input);

      expect(result.bulks).toHaveLength(1);
      expect(result.bulks[0]?.preview).toBe(true);
      expect(result.bulks[0]?.rollbackToken).toBe('tok_42');
    });

    it('rejects action-not-allowed-on-entity (whitelist matrix)', () => {
      const safe = uiBulkSchema.safeParse({
        entityType: 'rent_invoices',
        ids: ['i1'],
        action: 'snooze',
        reason: 'illegal',
      });
      expect(safe.success).toBe(false);
    });

    it('allows mark_paid on rent_invoices', () => {
      const safe = uiBulkSchema.safeParse({
        entityType: 'rent_invoices',
        ids: ['i1'],
        action: 'mark_paid',
        reason: 'tenant paid offline',
      });
      expect(safe.success).toBe(true);
    });
  });

  describe('ui_undo (Borjie 95b889c3 + 65a4c14e)', () => {
    it('extracts an undo chip with bilingual label + kbd hint', () => {
      const input = `<ui_undo>{"actionId":"act_42","label":{"en":"Snooze 4 reminders","sw":"Ahirisha vikumbusho 4"},"timeWindowSeconds":120,"direction":"undo","kbd":"Cmd-Shift-Z"}</ui_undo>`;
      const result = parseSuperpowers(input);

      expect(result.undos).toHaveLength(1);
      expect(result.undos[0]?.kbd).toBe('Cmd-Shift-Z');
      expect(result.undos[0]?.direction).toBe('undo');
    });

    it('supports redo direction', () => {
      const input = `<ui_undo>{"actionId":"act_43","label":{"en":"Redo","sw":"Rudia"},"direction":"redo"}</ui_undo>`;
      const result = parseSuperpowers(input);
      expect(result.undos[0]?.direction).toBe('redo');
    });
  });

  describe('ui_cmdk (Borjie 2996c92a)', () => {
    it('extracts a cmdk chip with recents + scope', () => {
      const input = `<ui_cmdk>{"query":"leases expir","scope":"leases","recents":[{"id":"l_1","label":"Nyumba 4B","kind":"lease"}],"placeholder":{"en":"Search leases","sw":"Tafuta mikataba"}}</ui_cmdk>`;
      const result = parseSuperpowers(input);

      expect(result.cmdks).toHaveLength(1);
      expect(result.cmdks[0]?.recents).toHaveLength(1);
      expect(result.cmdks[0]?.scope).toBe('leases');
    });
  });

  describe('ui_bookmark (Borjie 65a4c14e folders + tags)', () => {
    it('extracts a bookmark chip with folder + tags', () => {
      const input = `<ui_bookmark>{"entityType":"property","entityId":"p_1","label":"Nyumba Palace","folder":"top-of-mind","tags":["high-arrears","watch-list"]}</ui_bookmark>`;
      const result = parseSuperpowers(input);

      expect(result.bookmarks).toHaveLength(1);
      expect(result.bookmarks[0]?.folder).toBe('top-of-mind');
      expect(result.bookmarks[0]?.tags).toEqual(['high-arrears', 'watch-list']);
    });

    it('rejects mining-domain bookmark types (licence)', () => {
      const input = `<ui_bookmark>{"entityType":"licence","entityId":"x"}</ui_bookmark>`;
      const result = parseSuperpowers(input);
      expect(result.bookmarks).toHaveLength(0);
      expect(result.dropped).toBe(1);
    });
  });

  describe('mixed turns', () => {
    it('extracts all eight families in one body', () => {
      const input = `
        <ui_navigate>{"route":"/leases","reason":"x"}</ui_navigate>
        <ui_prefill>{"formId":"f","values":{}}</ui_prefill>
        <ui_highlight>{"selector":"#x","message":{"en":"a","sw":"b"}}</ui_highlight>
        <ui_share>{"entityType":"lease","entityId":"l_1"}</ui_share>
        <ui_bulk>{"entityType":"reminders","ids":["r1"],"action":"snooze","reason":"y"}</ui_bulk>
        <ui_undo>{"actionId":"a1","label":{"en":"x","sw":"y"}}</ui_undo>
        <ui_cmdk>{"scope":"global"}</ui_cmdk>
        <ui_bookmark>{"entityType":"unit","entityId":"u1"}</ui_bookmark>
      `;
      const result = parseSuperpowers(input);

      expect(result.navigates).toHaveLength(1);
      expect(result.prefills).toHaveLength(1);
      expect(result.highlights).toHaveLength(1);
      expect(result.shares).toHaveLength(1);
      expect(result.bulks).toHaveLength(1);
      expect(result.undos).toHaveLength(1);
      expect(result.cmdks).toHaveLength(1);
      expect(result.bookmarks).toHaveLength(1);
      expect(result.body.trim()).toBe('');
    });
  });
});
