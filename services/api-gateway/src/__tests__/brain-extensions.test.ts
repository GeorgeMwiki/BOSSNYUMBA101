/**
 * Brain-extensions smoke test.
 *
 * Verifies the Wave-15 wiring-audit fix: the org-awareness
 * `query_organization` skill is reachable from the Brain's tool
 * dispatcher after boot-time registration. Previously this skill was
 * defined in `packages/ai-copilot/src/skills/org/index.ts` but never
 * hooked into the skill registry, making it unreachable from chat.
 *
 * Also asserts the persona-aware tool catalog plumbing
 * (`appendBossNyumbaPersonaSkills` / `registerPersonaToolHandlers`) is
 * idempotent and kill-switch-safe.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  setBrainExtraSkills,
  getBrainExtraSkills,
  appendBrainExtraSkills,
  appendBossNyumbaPersonaSkills,
  registerPersonaToolHandlers,
  type PersonaToolGate,
} from '../composition/brain-extensions';
import {
  buildQueryOrganizationTool,
  createBrainForTesting,
} from '@bossnyumba/ai-copilot';

describe('brain-extensions wiring', () => {
  beforeEach(() => {
    setBrainExtraSkills([]);
  });

  it('starts empty (no skills wired)', () => {
    expect(getBrainExtraSkills()).toEqual([]);
  });

  it('accepts an injected skill and returns it back', () => {
    const tool = buildQueryOrganizationTool({
      async answer() {
        return {
          headline: 'stub',
          detail: 'stub',
          blackboard: { kind: 'status_summary' as const, rows: [] },
        } as never;
      },
    });
    setBrainExtraSkills([tool]);
    const extras = getBrainExtraSkills();
    expect(extras).toHaveLength(1);
    expect(extras[0].name).toBe('skill.org.query_organization');
  });

  it('makes the extra skill reachable via the Brain ToolDispatcher', async () => {
    const tool = buildQueryOrganizationTool({
      async answer(req) {
        return {
          headline: `answered for ${req.tenantId}: ${req.question}`,
          detail: 'deterministic stub',
          blackboard: { kind: 'status_summary' as const, rows: [] },
        } as never;
      },
    });
    const brain = createBrainForTesting({ extraSkills: [tool] });
    const registered = brain.tools.list().map((t) => t.name);
    expect(registered).toContain('skill.org.query_organization');
  });

  describe('appendBossNyumbaPersonaSkills + registerPersonaToolHandlers', () => {
    it('appendBrainExtraSkills concatenates immutably', () => {
      const tool1 = buildQueryOrganizationTool({
        async answer() {
          return {} as never;
        },
      });
      setBrainExtraSkills([tool1]);
      const before = getBrainExtraSkills();
      appendBrainExtraSkills([]);
      const after = getBrainExtraSkills();
      // Immutability: new frozen array, identity changes when items added.
      expect(after).not.toBe(before);
      expect(after).toHaveLength(1);
    });

    it('appendBossNyumbaPersonaSkills is an alias of appendBrainExtraSkills', () => {
      setBrainExtraSkills([]);
      const tool = buildQueryOrganizationTool({
        async answer() {
          return {} as never;
        },
      });
      appendBossNyumbaPersonaSkills([tool]);
      expect(getBrainExtraSkills()).toHaveLength(1);
    });

    it('registerPersonaToolHandlers wires the persona catalog (append mode)', () => {
      setBrainExtraSkills([]);
      const gate: PersonaToolGate = {
        killSwitchOpen: false,
        resolvePersonaSlug: () => 'T1_owner_strategist',
      };
      const registered = registerPersonaToolHandlers({ gate });
      // Should have wired the four persona catalogs plus the generic
      // ones (capability, jurisdiction, jurisdiction-discovery,
      // reason-strategize). Total > 100.
      expect(registered.length).toBeGreaterThan(100);
      expect(getBrainExtraSkills().length).toBe(registered.length);
    });

    it('registerPersonaToolHandlers fails closed on kill-switch open', () => {
      const orgSkill = buildQueryOrganizationTool({
        async answer() {
          return {} as never;
        },
      });
      setBrainExtraSkills([orgSkill]);
      const gate: PersonaToolGate = {
        killSwitchOpen: true,
        resolvePersonaSlug: () => 'T1_owner_strategist',
      };
      const registered = registerPersonaToolHandlers({ gate });
      expect(registered).toEqual([]);
      // Kill-switch wipes the extras list — the brain has nothing to call.
      expect(getBrainExtraSkills()).toEqual([]);
    });

    it('replace mode clears prior extras before wiring', () => {
      const orgSkill = buildQueryOrganizationTool({
        async answer() {
          return {} as never;
        },
      });
      setBrainExtraSkills([orgSkill]);
      const gate: PersonaToolGate = {
        killSwitchOpen: false,
        resolvePersonaSlug: () => 'T1_owner_strategist',
      };
      const registered = registerPersonaToolHandlers({ gate, mode: 'replace' });
      // After replace the extras list is JUST the persona catalog —
      // orgSkill is gone.
      expect(getBrainExtraSkills().length).toBe(registered.length);
    });
  });
});
