/**
 * Zoning leverage — three policy levers ranked by expected uplift.
 */

import type { ZoningLeverage, ZoningLeverageInputs } from '../types.js';

export function zoningLeverageScore(input: ZoningLeverageInputs): ZoningLeverage {
  const variance = clamp01(input.varianceApprovalRate * input.varianceUpliftPct);
  const upzone = clamp01(
    input.corridorTargetFar > 0
      ? Math.max(0, (input.corridorTargetFar - input.currentFar) / input.corridorTargetFar)
      : 0,
  );
  const mixedUse = clamp01(input.mixedUsePremiumPct);

  const composite = 0.45 * upzone + 0.30 * variance + 0.25 * mixedUse;

  const bestLever: ZoningLeverage['bestLever'] =
    variance >= upzone && variance >= mixedUse
      ? 'variance'
      : upzone >= mixedUse
        ? 'upzone'
        : 'mixedUse';

  return { variance, upzone, mixedUse, composite, bestLever };
}

function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}
