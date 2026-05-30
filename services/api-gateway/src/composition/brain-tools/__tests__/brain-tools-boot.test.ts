/**
 * Brain-tools boot integrity — verifies the persona-aware tool catalog
 * registers without errors, contains the expected ids, and refuses
 * fail-closed when the kill-switch is open.
 *
 * Ported from Borjie's audit-walker pattern.
 */

import { describe, expect, it } from 'vitest';
import {
  buildPersonaToolHandlers,
  listPersonaToolDescriptors,
  type PersonaToolGate,
} from '../index.js';

const closedGate: PersonaToolGate = {
  killSwitchOpen: false,
  resolvePersonaSlug: () => 'T1_owner_strategist',
};

describe('brain-tools — boot integrity', () => {
  it('builds a non-empty descriptor list', () => {
    const descriptors = listPersonaToolDescriptors();
    expect(descriptors.length).toBeGreaterThan(0);
  });

  it('every descriptor has a unique id', () => {
    const descriptors = listPersonaToolDescriptors();
    const ids = descriptors.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('registers the four canonical generic tools', () => {
    const ids = new Set(listPersonaToolDescriptors().map((d) => d.id));
    expect(ids.has('bossnyumba.capabilities.what_can_you_do')).toBe(true);
    expect(ids.has('bossnyumba.about')).toBe(true);
    expect(ids.has('bossnyumba.jurisdiction.show_current')).toBe(true);
    expect(ids.has('bossnyumba.jurisdiction.discover')).toBe(true);
    expect(ids.has('bossnyumba.jurisdiction.switch')).toBe(true);
    expect(ids.has('bossnyumba.reason.strategize')).toBe(true);
  });

  it('registers the six entity-legibility tools', () => {
    const ids = new Set(listPersonaToolDescriptors().map((d) => d.id));
    expect(ids.has('entity.resolve')).toBe(true);
    expect(ids.has('entity.full_picture')).toBe(true);
    expect(ids.has('entity.recent')).toBe(true);
    expect(ids.has('entity.search')).toBe(true);
    expect(ids.has('entity.trace')).toBe(true);
    expect(ids.has('entity.deduplicate')).toBe(true);
  });

  it('registers the six decision-journal tools', () => {
    const ids = new Set(listPersonaToolDescriptors().map((d) => d.id));
    expect(ids.has('decisions.recent')).toBe(true);
    expect(ids.has('decisions.explain')).toBe(true);
    expect(ids.has('decisions.search')).toBe(true);
    expect(ids.has('decisions.replay')).toBe(true);
    expect(ids.has('decisions.what_did_i_decide')).toBe(true);
    expect(ids.has('decisions.success_rate')).toBe(true);
  });

  it('registers the four scanner brain tools (opportunity + risk)', () => {
    const ids = new Set(listPersonaToolDescriptors().map((d) => d.id));
    expect(ids.has('property.opportunities.scan')).toBe(true);
    expect(ids.has('property.opportunities.list_rules')).toBe(true);
    expect(ids.has('property.risks.scan')).toBe(true);
    expect(ids.has('property.risks.list_rules')).toBe(true);
  });

  it('scanner tools are persona-scoped to owner + admin only', () => {
    const scannerIds = new Set([
      'property.opportunities.scan',
      'property.opportunities.list_rules',
      'property.risks.scan',
      'property.risks.list_rules',
    ]);
    const descriptors = listPersonaToolDescriptors().filter((d) =>
      scannerIds.has(d.id),
    );
    expect(descriptors.length).toBe(4);
    for (const d of descriptors) {
      expect([...d.personaSlugs].sort()).toEqual([
        'T1_owner_strategist',
        'T2_admin_strategist',
      ]);
      expect(d.isWrite).toBe(false);
      expect(d.requiresPolicyRuleLiteral).toBe(false);
    }
  });

  it('every descriptor is persona-scoped to a known persona slug', () => {
    const known = new Set([
      'T1_owner_strategist',
      'T2_admin_strategist',
      'T3_module_manager',
      'T4_field_employee',
      'T5_customer_concierge',
      'T_auditor',
      'T_vendor',
    ]);
    for (const d of listPersonaToolDescriptors()) {
      for (const slug of d.personaSlugs) {
        expect(known.has(slug)).toBe(true);
      }
    }
  });

  it('wraps every descriptor to ToolHandler when kill-switch closed', () => {
    const handlers = buildPersonaToolHandlers(closedGate);
    expect(handlers.length).toBeGreaterThan(0);
    for (const h of handlers) {
      expect(typeof h.execute).toBe('function');
      expect(typeof h.name).toBe('string');
      expect(typeof h.description).toBe('string');
      expect(typeof h.parameters).toBe('object');
    }
  });

  it('returns an empty handler list when the kill-switch is open', () => {
    const openGate: PersonaToolGate = {
      killSwitchOpen: true,
      resolvePersonaSlug: () => 'T1_owner_strategist',
    };
    const handlers = buildPersonaToolHandlers(openGate);
    expect(handlers.length).toBe(0);
  });

  it('detects duplicate ids via the onDuplicate callback', () => {
    const duplicates: string[] = [];
    buildPersonaToolHandlers(closedGate, {
      onDuplicate: (id) => duplicates.push(id),
    });
    // No duplicates expected on a clean boot — this is a regression guard.
    expect(duplicates).toEqual([]);
  });
});
