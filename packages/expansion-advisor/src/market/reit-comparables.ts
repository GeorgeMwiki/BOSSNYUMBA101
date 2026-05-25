/**
 * REIT-style comparables — FFO, AFFO, NAV, NOI multiples.
 *
 * Used for bench-marking implied trade value of a stabilised
 * asset against listed REIT comps for the same asset class.
 */

import type { AssetClass } from '../types.js';

export interface ReitFinancials {
  readonly netIncome: number;
  readonly depreciation: number;
  readonly amortisation: number;
  readonly gainsOnSale: number;
  readonly recurringCapex: number;
  readonly straightLineRentAdj: number;
  readonly noi: number;
  readonly capRate: number;
  readonly cash: number;
  readonly debt: number;
  readonly preferredEquity: number;
}

export interface ReitMultiples {
  readonly ffo: number;
  readonly affo: number;
  readonly nav: number;
  readonly impliedValueViaAffo: number;
  readonly impliedValueViaNav: number;
  readonly impliedValueViaNoi: number;
}

export const SECTOR_AFFO_MULTIPLE: Readonly<Record<AssetClass, number>> = {
  multifamily: 22,
  office: 14,
  retail: 16,
  industrial: 28,
  'mixed-use': 19,
  land: 0,
};

export const SECTOR_NOI_MULTIPLE: Readonly<Record<AssetClass, number>> = {
  multifamily: 18,
  office: 11,
  retail: 13,
  industrial: 22,
  'mixed-use': 15,
  land: 0,
};

export function reitMultiples(
  fin: ReitFinancials,
  assetClass: AssetClass,
): ReitMultiples {
  const ffo = fin.netIncome + fin.depreciation + fin.amortisation - fin.gainsOnSale;
  const affo = ffo - fin.recurringCapex - fin.straightLineRentAdj;
  const nav = (fin.noi / fin.capRate) + fin.cash - fin.debt - fin.preferredEquity;

  return {
    ffo,
    affo,
    nav,
    impliedValueViaAffo: Math.max(0, affo) * SECTOR_AFFO_MULTIPLE[assetClass],
    impliedValueViaNav: Math.max(0, nav),
    impliedValueViaNoi: Math.max(0, fin.noi) * SECTOR_NOI_MULTIPLE[assetClass],
  };
}
