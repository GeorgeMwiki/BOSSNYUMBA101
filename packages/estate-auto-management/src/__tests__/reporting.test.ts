import { describe, expect, it } from 'vitest';
import { nextRunDates } from '../reporting/cadence-engine.js';
import {
  withDefaults,
  validate,
} from '../reporting/stakeholder-prefs.js';

describe('cadence-engine', () => {
  const ref = new Date('2026-05-15T00:00:00Z');

  it('monthly cadence next-run is 1st of next month', () => {
    const r = nextRunDates(
      [withDefaults({ stakeholderId: 'o1', kind: 'owner' })],
      ref,
    );
    expect(r[0].nextRun).toBe('2026-06-01');
  });

  it('quarterly cadence next-run is start of next quarter', () => {
    const r = nextRunDates(
      [withDefaults({ stakeholderId: 'b1', kind: 'board' })],
      ref,
    );
    expect(r[0].nextRun).toBe('2026-07-01');
  });

  it('yearly cadence next-run is January 1 of next year', () => {
    const r = nextRunDates(
      [withDefaults({ stakeholderId: 'r1', kind: 'regulator' })],
      ref,
    );
    expect(r[0].nextRun).toBe('2027-01-01');
  });

  it('preserves stakeholder identity in output', () => {
    const r = nextRunDates(
      [
        withDefaults({ stakeholderId: 'o1', kind: 'owner' }),
        withDefaults({ stakeholderId: 'r1', kind: 'regulator' }),
      ],
      ref,
    );
    expect(r.map((e) => e.stakeholderId)).toEqual(['o1', 'r1']);
  });
});

describe('stakeholder-prefs.withDefaults', () => {
  it('uses canonical defaults per kind', () => {
    const p = withDefaults({ stakeholderId: 'o1', kind: 'owner' });
    expect(p.cadence).toBe('monthly');
    expect(p.delivery).toBe('email');
    expect(p.format).toBe('pdf');
  });

  it('honours overrides', () => {
    const p = withDefaults({
      stakeholderId: 'o1',
      kind: 'owner',
      delivery: 'whatsapp',
    });
    expect(p.delivery).toBe('whatsapp');
  });
});

describe('stakeholder-prefs.validate', () => {
  it('passes for valid preference', () => {
    expect(() =>
      validate(withDefaults({ stakeholderId: 'o1', kind: 'owner' })),
    ).not.toThrow();
  });

  it('throws on missing stakeholderId', () => {
    expect(() =>
      validate({
        stakeholderId: '',
        kind: 'owner',
        cadence: 'monthly',
        delivery: 'email',
        format: 'pdf',
      }),
    ).toThrow(/stakeholderId/);
  });

  it('throws on bad kind', () => {
    expect(() =>
      validate({
        stakeholderId: 'x',
        // @ts-expect-error testing bad runtime value
        kind: 'investor',
        cadence: 'monthly',
        delivery: 'email',
        format: 'pdf',
      }),
    ).toThrow(/kind/);
  });

  it('throws on bad cadence', () => {
    expect(() =>
      validate({
        stakeholderId: 'x',
        kind: 'owner',
        // @ts-expect-error testing bad runtime value
        cadence: 'weekly',
        delivery: 'email',
        format: 'pdf',
      }),
    ).toThrow(/cadence/);
  });
});
