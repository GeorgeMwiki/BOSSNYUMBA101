import { describe, expect, it } from 'vitest';
import { scoreFloodRisk } from '../geo-risk/flood-zone-risk.js';
import { scoreSeismicRisk } from '../geo-risk/seismic-risk.js';
import { scoreSlopeStability } from '../geo-risk/slope-stability.js';

describe('flood zone risk', () => {
  it('FEMA X is minimal risk; no insurance required', () => {
    const r = scoreFloodRisk({ femaZone: 'X' });
    expect(r.band).toBe('minimal');
    expect(r.insuranceRequired).toBe(false);
  });

  it('FEMA AE requires insurance', () => {
    const r = scoreFloodRisk({ femaZone: 'AE' });
    expect(r.insuranceRequired).toBe(true);
    expect(r.band).toBe('high');
  });

  it('FEMA VE = very-high', () => {
    const r = scoreFloodRisk({ femaZone: 'VE' });
    expect(r.band).toBe('very-high');
    expect(r.annualPremiumPerSqmUsd).toBeGreaterThan(10);
  });

  it('EA risk band high requires insurance', () => {
    const r = scoreFloodRisk({ eaRiskBand: 'high' });
    expect(r.insuranceRequired).toBe(true);
  });

  it('derives from raw distance + elevation', () => {
    const r = scoreFloodRisk({
      distanceToWatercourseMetres: 50,
      elevationMetres: 100,
      base100YrFloodElevationMetres: 102,
    });
    expect(r.band).toBe('very-high');
  });

  it('throws without enough inputs', () => {
    expect(() => scoreFloodRisk({})).toThrow();
  });
});

describe('seismic risk', () => {
  it('Dar es Salaam-style PGA 0.04g with site class D is low band', () => {
    const r = scoreSeismicRisk({ pga: 0.04, siteClass: 'D' });
    expect(r.band).toMatch(/very-low|low/);
  });

  it('Nairobi PGA 0.10g with site class D is moderate', () => {
    const r = scoreSeismicRisk({ pga: 0.10, siteClass: 'D' });
    expect(r.band).toBe('moderate');
  });

  it('PGA 0.50g, site class E is very-high', () => {
    const r = scoreSeismicRisk({ pga: 0.50, siteClass: 'E' });
    expect(r.band).toBe('very-high');
    expect(r.designUpliftPct).toBeGreaterThanOrEqual(0.15);
  });

  it('rejects negative PGA', () => {
    expect(() => scoreSeismicRisk({ pga: -0.05, siteClass: 'D' })).toThrow();
  });

  it('rock site class amplification < 1', () => {
    const r = scoreSeismicRisk({ pga: 0.10, siteClass: 'A' });
    expect(r.amplificationFactor).toBeLessThan(1);
  });
});

describe('slope stability', () => {
  it('flat slope no uplift', () => {
    const r = scoreSlopeStability({ slopePct: 2 });
    expect(r.band).toBe('flat');
    expect(r.designUpliftPct).toBe(0);
  });

  it('very steep slope requires engineered retaining', () => {
    const r = scoreSlopeStability({ slopePct: 45 });
    expect(r.band).toBe('very-steep');
    expect(r.engineeredRetainingRequired).toBe(true);
  });

  it('moderate slope = 20%', () => {
    const r = scoreSlopeStability({ slopePct: 20 });
    expect(r.band).toBe('moderate');
  });

  it('rejects negative slope', () => {
    expect(() => scoreSlopeStability({ slopePct: -3 })).toThrow();
  });
});
