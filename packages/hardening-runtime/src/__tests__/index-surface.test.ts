/**
 * Public-surface smoke test — confirms the package exports everything
 * the L3 brief promised, and nothing more.
 */

import { describe, it, expect } from 'vitest';
import * as pkg from '../index.js';

describe('@bossnyumba/hardening-runtime — public surface', () => {
  it('exports the 8 module entry points', () => {
    // confidence
    expect(typeof pkg.extractConfidence).toBe('function');
    expect(typeof pkg.appendJustAskConfidence).toBe('function');
    expect(typeof pkg.calibrateVerbalized).toBe('function');
    expect(typeof pkg.combineCalibrated).toBe('function');
    expect(Array.isArray(pkg.VERBALIZED_CALIBRATION_CURVE)).toBe(true);

    // circuit-breakers
    expect(typeof pkg.withCircuitBreaker).toBe('function');
    expect(typeof pkg.mergeCaps).toBe('function');
    expect(typeof pkg.DEFAULT_CIRCUIT_BREAKER_CAPS).toBe('object');

    // input-shield
    expect(typeof pkg.screenInput).toBe('function');
    expect(Array.isArray(pkg.SHIELD_PATTERNS)).toBe(true);
    expect(typeof pkg.SHIELD_BLOCK_THRESHOLD).toBe('number');

    // spotlighting
    expect(typeof pkg.spotlight).toBe('function');
    expect(typeof pkg.SPOTLIGHT_OPEN).toBe('string');
    expect(typeof pkg.SPOTLIGHT_CLOSE).toBe('string');
    expect(typeof pkg.SPOTLIGHT_SYSTEM_DIRECTIVE).toBe('string');

    // pii-tokenization
    expect(typeof pkg.tokenizePII).toBe('function');
    expect(typeof pkg.deTokenize).toBe('function');
    expect(typeof pkg.detectAll).toBe('function');

    // alignment-auditor
    expect(typeof pkg.runAlignmentAudit).toBe('function');
    expect(typeof pkg.renderAuditMarkdown).toBe('function');
    expect(typeof pkg.isPassRateRegression).toBe('function');
    expect(typeof pkg.registerAuditCron).toBe('function');
    expect(Array.isArray(pkg.DEFAULT_AUDIT_FIXTURES)).toBe(true);

    // anomaly-probe
    expect(typeof pkg.probeOutput).toBe('function');

    // stack composer
    expect(typeof pkg.hardenedTurn).toBe('function');
  });

  it('default circuit-breaker caps are frozen and L3-compliant', () => {
    expect(Object.isFrozen(pkg.DEFAULT_CIRCUIT_BREAKER_CAPS)).toBe(true);
    expect(pkg.DEFAULT_CIRCUIT_BREAKER_CAPS.maxSteps).toBe(30);
    expect(pkg.DEFAULT_CIRCUIT_BREAKER_CAPS.maxCostUsdCents).toBe(500);
    expect(pkg.DEFAULT_CIRCUIT_BREAKER_CAPS.maxWallTimeMs).toBe(120_000);
    expect(pkg.DEFAULT_CIRCUIT_BREAKER_CAPS.maxToolCalls).toBe(100);
  });

  it('spotlight delimiters match the L3 scheme', () => {
    expect(pkg.SPOTLIGHT_OPEN).toBe('<<<TENANT_DOCUMENT>>>');
    expect(pkg.SPOTLIGHT_CLOSE).toBe('<<<END_DOCUMENT>>>');
  });
});
