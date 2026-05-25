/**
 * demographic-fit-scorer — per property type + neighborhood.
 *
 * Per HUD demographic guidelines + Zillow rent-burden study.
 *
 * Rules:
 *   - Income / rent ratio target ≥ 3.0; rent-burdened if < 2.5.
 *   - Household composition vs unit-mix.
 *   - Stage-of-life vs amenity-mix.
 *   - Commute < 30 min from likely employment.
 */

export interface DemographicInput {
  readonly medianHouseholdIncomeUsd: number;
  readonly medianRentUsd: number; // monthly
  readonly householdSizeAvg: number;
  readonly unitMixBedrooms: ReadonlyArray<{ br: number; share: number }>;
  readonly avgAge: number;
  readonly amenityFit: 'family' | 'young-professional' | 'student' | 'retiree' | 'mixed';
  readonly commuteMinAvg: number;
}

export interface DemographicFitReport {
  readonly incomeToRentMultiple: number;
  readonly rentBurden: 'comfortable' | 'stretched' | 'burdened' | 'severely-burdened';
  readonly unitMixFit: 'good' | 'mismatched' | 'over-supply-large' | 'under-supply-large';
  readonly amenityFitScore: number; // 0..1
  readonly compositeFit: number; // 0..1
  readonly notes: ReadonlyArray<string>;
  readonly citation: string;
}

export function scoreDemographicFit(input: DemographicInput): DemographicFitReport {
  const monthlyIncome = input.medianHouseholdIncomeUsd / 12;
  const ratio = input.medianRentUsd > 0 ? monthlyIncome / input.medianRentUsd : 0;
  let rentBurden: DemographicFitReport['rentBurden'];
  if (ratio >= 3) rentBurden = 'comfortable';
  else if (ratio >= 2.5) rentBurden = 'stretched';
  else if (ratio >= 2) rentBurden = 'burdened';
  else rentBurden = 'severely-burdened';

  // Unit-mix fit: 1-2 BR for small HH, 3+ BR for families.
  const familyShare = input.unitMixBedrooms
    .filter((u) => u.br >= 3)
    .reduce((s, u) => s + u.share, 0);
  let unitMixFit: DemographicFitReport['unitMixFit'];
  if (input.householdSizeAvg >= 3.5 && familyShare < 0.40) {
    unitMixFit = 'under-supply-large';
  } else if (input.householdSizeAvg < 2 && familyShare > 0.35) {
    unitMixFit = 'over-supply-large';
  } else if (Math.abs(input.householdSizeAvg - 2.5) <= 1) {
    unitMixFit = 'good';
  } else {
    unitMixFit = 'mismatched';
  }

  // Amenity fit by age.
  let amenityFitScore = 0.5;
  if (input.amenityFit === 'family' && input.avgAge >= 30 && input.avgAge <= 45) amenityFitScore = 0.9;
  else if (input.amenityFit === 'young-professional' && input.avgAge >= 22 && input.avgAge <= 35) amenityFitScore = 0.9;
  else if (input.amenityFit === 'student' && input.avgAge < 25) amenityFitScore = 0.85;
  else if (input.amenityFit === 'retiree' && input.avgAge >= 55) amenityFitScore = 0.85;
  else if (input.amenityFit === 'mixed') amenityFitScore = 0.7;
  else amenityFitScore = 0.4;

  // Commute penalty.
  const commuteScore = input.commuteMinAvg <= 30 ? 1.0 : Math.max(0, 1 - (input.commuteMinAvg - 30) / 60);

  const notes: string[] = [];
  if (rentBurden === 'burdened' || rentBurden === 'severely-burdened') {
    notes.push('Demographic is rent-burdened; arrears risk elevated.');
  }
  if (unitMixFit === 'under-supply-large') {
    notes.push('Unit mix under-supplies large units relative to local household size.');
  }
  if (input.commuteMinAvg > 30) {
    notes.push('Commute > 30 min reduces stickiness vs HUD/Zillow benchmark.');
  }

  const compositeFit = (
    (rentBurden === 'comfortable' ? 1 : rentBurden === 'stretched' ? 0.7 : rentBurden === 'burdened' ? 0.4 : 0.1) * 0.4 +
    (unitMixFit === 'good' ? 1 : unitMixFit === 'mismatched' ? 0.5 : 0.3) * 0.25 +
    amenityFitScore * 0.2 +
    commuteScore * 0.15
  );

  return {
    incomeToRentMultiple: ratio,
    rentBurden,
    unitMixFit,
    amenityFitScore,
    compositeFit,
    notes,
    citation: 'HUD demographic guidelines + Zillow Rent-Burden Study 2024',
  };
}
