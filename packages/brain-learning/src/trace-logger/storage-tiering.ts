/**
 * Storage tiering — pure function mapping a trace's age to its tier.
 *
 *   hot:  age ≤ 7 days   — Redis + Postgres
 *   warm: age ≤ 90 days  — Postgres compressed
 *   cold: age >  90 days — S3 Parquet (tenant_id / yyyy / mm / dd partitions)
 *
 * The function takes two clocks (loggedAt + now) so callers can be
 * deterministic in tests.
 */

import type { StorageTier } from '../types.js';

const HOT_DAYS = 7;
const WARM_DAYS = 90;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function storageTierFor(args: {
  loggedAt: Date;
  now: Date;
}): StorageTier {
  const ageMs = args.now.getTime() - args.loggedAt.getTime();
  if (ageMs < 0) return 'hot';
  const ageDays = ageMs / MS_PER_DAY;
  if (ageDays <= HOT_DAYS) return 'hot';
  if (ageDays <= WARM_DAYS) return 'warm';
  return 'cold';
}
