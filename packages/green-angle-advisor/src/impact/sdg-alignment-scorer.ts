/**
 * SDG alignment scorer — 17-SDG vector from the opportunity set.
 *
 * Returns a 17-element array where index i (0-based) corresponds to
 * SDG (i+1). Value = count of opportunities that touch that SDG.
 *
 * Pure. No I/O.
 */

import type { GreenOpportunity } from '../types.js';

export interface SdgAlignment {
  readonly vector: readonly number[];
  readonly count: number;
  readonly alignment: number; // 0-1: count/17
}

export function scoreSdgAlignment(
  opportunities: readonly GreenOpportunity[],
): SdgAlignment {
  const vector = new Array<number>(17).fill(0);
  for (const opp of opportunities) {
    for (const sdg of opp.sdgTargets) {
      if (sdg >= 1 && sdg <= 17) {
        vector[sdg - 1] = (vector[sdg - 1] ?? 0) + 1;
      }
    }
  }
  const count = vector.filter((v) => v > 0).length;
  return {
    vector,
    count,
    alignment: count / 17,
  };
}
