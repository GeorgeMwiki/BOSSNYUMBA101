/**
 * 1031-scanner — US §1031 like-kind exchange + EA jurisdictional notes.
 *
 * US: IRC §1031 (45-day ID, 180-day close).
 * EA stubs:
 *   - Tanzania Land Act 1999 §134: 24-mo rollover for development sites
 *   - Kenya Land Registration Act 2012: subdivision-rollover only
 *   - UG, NG, RW, ZA: no direct equivalent; case-by-case
 */

import type { PropertySnapshot, TaxOpportunity } from '../types.js';

export interface ExchangeInput {
  readonly property: PropertySnapshot;
  readonly soldOnMs?: number;
  readonly nowMs: number;
  readonly capitalGainUsd: number;
  readonly marginalCapGainsRate: number; // 0..1
}

const MS_45_DAYS = 45 * 24 * 60 * 60 * 1000;
const MS_180_DAYS = 180 * 24 * 60 * 60 * 1000;
const MS_24_MONTHS = 730 * 24 * 60 * 60 * 1000;

export function scan1031Opportunity(input: ExchangeInput): TaxOpportunity {
  const { property, capitalGainUsd, marginalCapGainsRate, soldOnMs, nowMs } = input;
  const taxDeferred = Math.round(capitalGainUsd * marginalCapGainsRate);

  if (property.jurisdiction === 'US') {
    let windowEndsAtMs: number | undefined;
    let rationale: string;
    if (soldOnMs) {
      const daysSince = (nowMs - soldOnMs) / (24 * 60 * 60 * 1000);
      if (daysSince <= 45) {
        windowEndsAtMs = soldOnMs + MS_45_DAYS;
        rationale = `Within 45-day ID window — must identify replacement properties by ${new Date(windowEndsAtMs).toISOString().slice(0, 10)}.`;
      } else if (daysSince <= 180) {
        windowEndsAtMs = soldOnMs + MS_180_DAYS;
        rationale = `Past 45-day ID window; 180-day close deadline ${new Date(windowEndsAtMs).toISOString().slice(0, 10)}.`;
      } else {
        rationale = 'Past 180-day close window; consider §1033 involuntary-conversion or reverse-exchange structures.';
      }
    } else {
      rationale = `Pre-sale planning: $${taxDeferred.toLocaleString('en-US')} federal cap-gains tax deferrable via §1031.`;
    }
    const result: TaxOpportunity = {
      id: `1031.${property.propertyId}`,
      kind: '1031',
      headline: `1031 exchange: defer $${taxDeferred.toLocaleString('en-US')} on ${property.name}`,
      estimatedSavingsUsd: taxDeferred,
      rationale,
      citation: 'IRC §1031 + IRS Rev. Proc. 2000-37',
      jurisdiction: 'US',
    };
    return windowEndsAtMs !== undefined ? { ...result, windowEndsAtMs } : result;
  }

  if (property.jurisdiction === 'TZ') {
    return {
      id: `rollover.${property.propertyId}`,
      kind: '1031',
      headline: `TZ Land Act §134 rollover: ~24-month development reinvestment window`,
      estimatedSavingsUsd: taxDeferred,
      rationale: 'Tanzania Land Act 1999 §134 allows 24-mo rollover for development sites — narrower than §1031 but credible deferral.',
      citation: 'Tanzania Land Act 1999 §134',
      jurisdiction: 'TZ',
      ...(soldOnMs ? { windowEndsAtMs: soldOnMs + MS_24_MONTHS } : {}),
    };
  }

  return {
    id: `rollover.${property.propertyId}`,
    kind: '1031',
    headline: `${property.jurisdiction}: no direct §1031 equivalent`,
    estimatedSavingsUsd: 0,
    rationale: `${property.jurisdiction} lacks a §1031-style like-kind deferral; explore subdivision-rollover (KE) or holding-company restructure.`,
    citation: 'Jurisdictional tax statutes — case-by-case',
    jurisdiction: property.jurisdiction,
  };
}

export const __test__ = { MS_45_DAYS, MS_180_DAYS, MS_24_MONTHS };
