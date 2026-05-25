import { describe, it, expect } from 'vitest';
import {
  getCrisisPlaybook,
  listCrisisIncidents,
  __test__,
} from '../crisis/crisis-playbook-registry.js';
import { firstSeventyTwoHours } from '../crisis/72hr-triage.js';
import { thirtyDayRecovery } from '../crisis/30day-recovery.js';
import { POSTMORTEM_TEMPLATE } from '../crisis/post-mortem-template.js';

describe('crisis-playbook-registry', () => {
  it('lists 8 incident types', () => {
    expect(listCrisisIncidents().length).toBe(8);
  });

  it('every incident produces a playbook with triage + first-72 + day-30 + post-mortem', () => {
    for (const inc of listCrisisIncidents()) {
      const pb = getCrisisPlaybook(inc);
      expect(pb.triageMatrix.length).toBeGreaterThan(0);
      expect(pb.first72Hours.length).toBeGreaterThan(0);
      expect(pb.day30Recovery.length).toBeGreaterThan(0);
      expect(pb.postMortemTemplate.length).toBeGreaterThan(0);
      expect(pb.citation).toBeTruthy();
    }
  });

  it('fire playbook starts with life-safety action', () => {
    const pb = getCrisisPlaybook('fire');
    const first = pb.first72Hours[0];
    expect(first?.action.toLowerCase()).toContain('life-safety');
  });

  it('ransomware first-72 includes isolation step', () => {
    const actions = firstSeventyTwoHours('ransomware').map((a) => a.action.toLowerCase());
    expect(actions.some((a) => a.includes('isolate'))).toBe(true);
  });

  it('post-mortem template includes root-cause analysis section', () => {
    expect(POSTMORTEM_TEMPLATE.some((s) => s.toLowerCase().includes('root cause'))).toBe(true);
  });

  it('day-30 recovery for fire includes restoration vendor', () => {
    const r = thirtyDayRecovery('fire').map((a) => a.action.toLowerCase());
    expect(r.some((a) => a.includes('restoration'))).toBe(true);
  });

  it('triage for fire raises critical severity within < 1h', () => {
    const triage = __test__.triageFor('fire');
    expect(triage[0]?.severity).toBe('critical');
    expect((triage[0]?.notifyWithinHours ?? Infinity)).toBeLessThanOrEqual(1);
  });

  it('citation distinct per incident family', () => {
    const fireCit = __test__.citationFor('fire');
    const fraudCit = __test__.citationFor('fraud-discovered');
    expect(fireCit).not.toEqual(fraudCit);
  });

  it('lawsuit playbook has external-counsel as immediate owner', () => {
    const triage = __test__.triageFor('lawsuit-served');
    expect(triage[0]?.immediateOwner).toBe('external-counsel');
  });

  it('all 30-day recovery actions have ordered sequence', () => {
    for (const inc of listCrisisIncidents()) {
      const recovery = thirtyDayRecovery(inc);
      for (let i = 1; i < recovery.length; i += 1) {
        const a = recovery[i]?.orderInSequence ?? 0;
        const b = recovery[i - 1]?.orderInSequence ?? 0;
        expect(a).toBeGreaterThan(b);
      }
    }
  });
});
