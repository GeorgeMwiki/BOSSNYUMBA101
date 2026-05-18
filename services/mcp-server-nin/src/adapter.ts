/**
 * Deterministic mock adapter for `@bossnyumba/mcp-server-nin`. The
 * production NIMC NIVS adapter ships in Phase F; this scaffold
 * implements just enough behaviour for cross-service composition
 * tests + the kernel's NotYetWired contract.
 *
 * Mock policy (deterministic, no IO):
 *   - If `nin` matches `^\d{11}$` (NIMC shape) AND last digit is even,
 *     return `verified: true` with matchScore 0.96.
 *   - If shape matches but last digit is odd, return verified=false
 *     with a 0.42 score and reason 'biometric_mismatch'.
 *   - If shape fails, return verified=false with reason 'invalid_shape'.
 *
 * Real adapter will replace this file behind the same `NinAdapter`
 * interface (see types.ts).
 */

import type {
  NinAdapter,
  VerifyNinArgs,
  VerifyNinResult,
} from './types.js';

const NIN_SHAPE = /^\d{11}$/;

export class MockNinAdapter implements NinAdapter {
  async verifyNin(args: VerifyNinArgs): Promise<VerifyNinResult> {
    if (!NIN_SHAPE.test(args.nin)) {
      return Object.freeze({
        verified: false,
        referenceId: `nimc-mock-${Date.now()}`,
        matchScore: 0,
        reason: 'invalid_shape',
      });
    }
    const lastDigit = Number.parseInt(args.nin.slice(-1), 10);
    const isEven = lastDigit % 2 === 0;
    return Object.freeze({
      verified: isEven,
      referenceId: `nimc-mock-${args.tenantId}-${args.nin.slice(-4)}`,
      matchScore: isEven ? 0.96 : 0.42,
      ...(isEven ? {} : { reason: 'biometric_mismatch' }),
    });
  }
}

/**
 * Production adapter stub — wires to NIMC NIVS REST API once Phase F
 * ships. Tracked as `NotYetWired`: the kernel falls back to graceful
 * NOT_IMPLEMENTED when this is selected without the env credentials.
 */
export class NimcNivsAdapter implements NinAdapter {
  async verifyNin(_args: VerifyNinArgs): Promise<VerifyNinResult> {
    throw new Error(
      'NimcNivsAdapter.verifyNin not yet wired — Phase F. Use MockNinAdapter for tests.',
    );
  }
}
