/**
 * Self-Refine regression tests — 12 message-draft scenarios across:
 *   - tenant late-rent reminder
 *   - lease-renewal offer
 *   - complaint response
 *   - eviction-warning
 *   - KRA-filing confirmation
 *
 * Each scenario uses the heuristic critic + heuristic refiner so the
 * trail is deterministic.
 */

import { describe, expect, it } from 'vitest';
import { selfRefine } from '../self-refine.js';
import { heuristicCritic } from '../critic.js';
import { heuristicRefiner } from '../refiner.js';
import { fixedClock } from '../../ports/clock.js';

interface Scenario {
  readonly name: string;
  readonly draft: string;
  readonly actionClass: string;
  readonly tenantJurisdiction?: string;
  readonly context: string;
  readonly expectAccept: boolean;
  readonly maxIterations?: number;
  /** Whether the final draft should differ from the initial. */
  readonly expectChanged: boolean;
}

const scenarios: ReadonlyArray<Scenario> = [
  {
    name: 'rent-reminder — already polished, accepts on iter 1',
    draft:
      'Dear Mr John Otieno, your rent of KES 50,000 due on 1 May 2026 remains unpaid. Kindly arrange payment by 14 May 2026.',
    actionClass: 'rent-reminder',
    tenantJurisdiction: 'TZ-DSM',
    context: 'late rent reminder, KES 50,000 since 1 May 2026',
    expectAccept: true,
    expectChanged: false,
  },
  {
    name: 'rent-reminder — aggressive tone, refines',
    draft:
      'PAY OR ELSE! You have failed for the last time, idiot. You will be evicted in 24 hours.',
    actionClass: 'rent-reminder',
    tenantJurisdiction: 'TZ-DSM',
    context: 'late rent reminder',
    expectAccept: false,
    expectChanged: true,
  },
  {
    name: 'lease-renewal-offer — clear and short, accepts',
    draft:
      'Hi Ms Asha Said, your lease for Plot 7 Unit 12B ends on 31 May 2026. We would like to renew at KES 55,000 per month from 1 June 2026. Please confirm by 25 May 2026.',
    actionClass: 'lease-renewal-offer',
    tenantJurisdiction: 'TZ-DSM',
    context: 'lease renewal offer',
    expectAccept: true,
    expectChanged: false,
  },
  {
    name: 'lease-renewal-offer — jargon, refines',
    draft:
      'Whereas the demised premises hereinafter referred to as Unit 12B shall pursuant to the aforesaid lease be renewed notwithstanding any prior agreement.',
    actionClass: 'lease-renewal-offer',
    tenantJurisdiction: 'TZ-DSM',
    context: 'lease renewal offer',
    expectAccept: false,
    expectChanged: true,
  },
  {
    name: 'complaint-response — empathetic, accepts',
    draft:
      'Dear tenant Asha Said, we received your complaint about Unit 5A on 14 May 2026 and have dispatched a plumber to arrive on 16 May 2026.',
    actionClass: 'complaint-response',
    tenantJurisdiction: 'TZ-DSM',
    context: 'plumbing complaint',
    expectAccept: true,
    expectChanged: false,
  },
  {
    name: 'complaint-response — too long, refines and accepts',
    draft:
      'Dear tenant Asha Said, we received your complaint about Unit 5A on 14 May 2026 and have dispatched a plumber. ' +
      'The plumber will arrive on 16 May 2026. We apologise for the inconvenience. ' +
      'Please note that the plumber may need to access the unit twice. ' +
      'You will receive a follow-up message after the visit. ' +
      'We value your tenancy and apologise once more. ' +
      'Kindly confirm receipt of this message. ' +
      'If you need anything urgent, please call our 24-hour line. ' +
      'We also wanted to remind you that the building inspection is scheduled.',
    actionClass: 'complaint-response',
    tenantJurisdiction: 'TZ-DSM',
    context: 'plumbing complaint',
    // The heuristic refiner shortens to 6 sentences then critic accepts.
    expectAccept: true,
    expectChanged: true,
  },
  {
    name: 'eviction-warning — proper TZ form, accepts',
    draft:
      'Dear Mr John Otieno, this is the statutory 14-day notice for non-payment of rent of TZS 120,000 since 1 March 2026. Kindly settle by 28 May 2026 to avoid eviction proceedings.',
    actionClass: 'eviction-warning',
    tenantJurisdiction: 'TZ-DSM',
    context: 'eviction warning',
    expectAccept: true,
    expectChanged: false,
  },
  {
    name: 'eviction-warning — wrong jurisdiction (cites Kenya law), refines',
    draft:
      'Per the Kenya Rent Restriction Tribunal, you are hereby evicted. Your case will be heard in Nairobi.',
    actionClass: 'eviction-warning',
    tenantJurisdiction: 'TZ-DSM',
    context: 'eviction warning, TZ tenant',
    expectAccept: false,
    expectChanged: true,
  },
  {
    name: 'kra-filing-confirmation — clean & dated, accepts',
    draft:
      'Mr John Otieno, your KRA filing for tax year 2026 was submitted on 14 May 2026. Acknowledgement number KRA-2026-12345. Total tax paid KES 12,000.',
    actionClass: 'kra-filing-confirmation',
    tenantJurisdiction: 'KE-NRB',
    context: 'KRA filing confirmation',
    expectAccept: true,
    expectChanged: false,
  },
  {
    name: 'kra-filing-confirmation — missing date, refines',
    draft:
      'Your KRA filing was submitted. Acknowledgement number KRA-2026-12345.',
    actionClass: 'kra-filing-confirmation',
    tenantJurisdiction: 'KE-NRB',
    context: 'KRA filing confirmation',
    expectAccept: false,
    expectChanged: true,
  },
  {
    name: 'rent-reminder — exclamation overload, refines and accepts',
    draft: 'Pay now!!! You owe TZS 50,000 since 1 May 2026!!!',
    actionClass: 'rent-reminder',
    tenantJurisdiction: 'TZ-DSM',
    context: 'late rent reminder',
    // Heuristic refiner softens "!!" → "." → accepts.
    expectAccept: true,
    expectChanged: true,
  },
  {
    name: 'lease-renewal-offer — TZ tenant, no foreign-juris citations',
    draft:
      'Ms Asha Said, we propose to renew your lease at Plot 7 Unit 12B at KES 55,000 from 1 June 2026 to 31 May 2027. Reply by 25 May 2026.',
    actionClass: 'lease-renewal-offer',
    tenantJurisdiction: 'TZ-DSM',
    context: 'lease renewal',
    expectAccept: true,
    expectChanged: false,
  },
];

describe('selfRefine — 12 message-draft scenarios', () => {
  for (const scenario of scenarios) {
    it(scenario.name, async () => {
      const result = await selfRefine(
        {
          initialDraft: scenario.draft,
          actionClass: scenario.actionClass,
          originalContext: scenario.context,
          ...(scenario.tenantJurisdiction !== undefined
            ? { tenantJurisdiction: scenario.tenantJurisdiction }
            : {}),
        },
        {
          critic: heuristicCritic(),
          refiner: heuristicRefiner(),
          clock: fixedClock(new Date('2026-05-19T00:00:00Z')),
          maxIterations: scenario.maxIterations ?? 3,
        },
      );

      expect(result.accepted).toBe(scenario.expectAccept);
      expect(result.verdict).toBe(scenario.expectAccept ? 'pass' : 'flag');
      if (scenario.expectChanged) {
        expect(result.finalDraft).not.toBe(scenario.draft);
      }
      expect(result.iterations.length).toBeGreaterThanOrEqual(1);
      expect(result.iterations.length).toBeLessThanOrEqual(scenario.maxIterations ?? 3);
    });
  }
});

describe('selfRefine — edge behaviour', () => {
  it('stops at maxIterations even if not accepted', async () => {
    const result = await selfRefine(
      {
        initialDraft: 'PAY OR ELSE!!!! WHEREAS pursuant to hereinafter notwithstanding',
        actionClass: 'rent-reminder',
        originalContext: 'late rent',
        tenantJurisdiction: 'TZ-DSM',
      },
      {
        critic: heuristicCritic(),
        refiner: heuristicRefiner(),
        clock: fixedClock(new Date('2026-05-19T00:00:00Z')),
        maxIterations: 2,
      },
    );
    expect(result.iterations.length).toBeLessThanOrEqual(2);
  });

  it('records the iteration trail for auditing', async () => {
    const result = await selfRefine(
      {
        initialDraft: 'PAY OR ELSE!!! you have failed',
        actionClass: 'rent-reminder',
        originalContext: 'late rent',
        tenantJurisdiction: 'TZ-DSM',
      },
      {
        critic: heuristicCritic(),
        refiner: heuristicRefiner(),
        clock: fixedClock(new Date('2026-05-19T00:00:00Z')),
      },
    );
    expect(result.iterations.every((it) => typeof it.overall === 'number')).toBe(true);
    expect(result.iterations.every((it) => typeof it.feedback === 'string')).toBe(true);
  });
});
