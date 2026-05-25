import { describe, expect, it } from 'vitest';
import { runScheduleRisk } from '../development/schedule-risk-modeler.js';
import type { ScheduleTask } from '../types.js';

const tasks: ReadonlyArray<ScheduleTask> = [
  {
    id: 'design',
    label: 'design',
    optimisticDays: 90,
    mostLikelyDays: 120,
    pessimisticDays: 180,
    onCriticalPath: true,
  },
  {
    id: 'permit',
    label: 'permit',
    optimisticDays: 60,
    mostLikelyDays: 90,
    pessimisticDays: 150,
    onCriticalPath: true,
  },
  {
    id: 'construction',
    label: 'construction',
    optimisticDays: 360,
    mostLikelyDays: 420,
    pessimisticDays: 540,
    onCriticalPath: true,
  },
  {
    id: 'punchlist',
    label: 'punchlist',
    optimisticDays: 14,
    mostLikelyDays: 30,
    pessimisticDays: 60,
    onCriticalPath: true,
  },
];

describe('schedule-risk-modeler', () => {
  it('produces monotonic P50 ≤ P80 ≤ P90', () => {
    const r = runScheduleRisk(tasks, { iterations: 4000, seed: 42 });
    expect(r.p50TotalDays).toBeLessThanOrEqual(r.p80TotalDays);
    expect(r.p80TotalDays).toBeLessThanOrEqual(r.p90TotalDays);
  });

  it('P50 is near (but ≥) sum of most-likely durations (PERT mean ≥ mode)', () => {
    const r = runScheduleRisk(tasks, { iterations: 5000, seed: 7 });
    const sumML = 120 + 90 + 420 + 30;
    expect(r.p50TotalDays).toBeGreaterThanOrEqual(sumML * 0.95);
    expect(r.p50TotalDays).toBeLessThanOrEqual(sumML * 1.10);
  });

  it('returns contingency weeks ≥ 0', () => {
    const r = runScheduleRisk(tasks, { iterations: 2000, seed: 11 });
    expect(r.contingencyWeeks).toBeGreaterThanOrEqual(0);
  });

  it('returns criticality entries for each CP task', () => {
    const r = runScheduleRisk(tasks, { iterations: 1000, seed: 1 });
    expect(r.criticalityIndex).toHaveLength(4);
  });

  it('throws when no CP tasks', () => {
    expect(() => runScheduleRisk(
      tasks.map((t) => ({ ...t, onCriticalPath: false })),
      { iterations: 100 },
    )).toThrow();
  });

  it('throws on no tasks', () => {
    expect(() => runScheduleRisk([], { iterations: 100 })).toThrow();
  });

  it('throws on invalid a ≤ m ≤ b ordering', () => {
    expect(() => runScheduleRisk([
      { id: 'x', label: 'x', optimisticDays: 100, mostLikelyDays: 50, pessimisticDays: 200, onCriticalPath: true },
    ], { iterations: 100 })).toThrow();
  });

  it('seeded result is deterministic', () => {
    const r1 = runScheduleRisk(tasks, { iterations: 1000, seed: 999 });
    const r2 = runScheduleRisk(tasks, { iterations: 1000, seed: 999 });
    expect(r1.p50TotalDays).toBeCloseTo(r2.p50TotalDays, 6);
  });
});
