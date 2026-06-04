/**
 * Self-contained wiring for the ledger attestor — default OFF.
 *
 * The composition root computes the flag value from the environment
 * (this package NEVER reads `process.env`) and passes `enabled` as a
 * boolean. {@link wireLedgerAttestor} returns `null` when disabled —
 * the single signal the composition root uses to skip mounting the
 * attestation worker. When enabled it binds the ports once and returns
 * a thin {@link LedgerAttestor} facade whose `handle` validates input
 * with zod at the boundary, then delegates to {@link runAttestation}.
 *
 * @module @bossnyumba/ledger-attestor/wire
 */

import { runAttestation, type AttestorDeps } from './attestor';
import {
  attestationRequestSchema,
  type AttestationRunResult,
} from './types';

/**
 * Feature-flag NAME only. The package never reads it — the caller
 * resolves `process.env[LEDGER_ATTESTOR_FLAG] === 'on'` and passes the
 * resulting boolean as `enabled`.
 */
export const LEDGER_ATTESTOR_FLAG = 'BOSSNYUMBA_FEATURE_LEDGER_ATTESTOR' as const;

/** Wiring deps: the orchestrator deps plus the caller-computed flag. */
export interface WireLedgerAttestorDeps extends AttestorDeps {
  readonly enabled: boolean;
}

/** Unvalidated handle input (validated by the zod boundary in `handle`). */
export interface LedgerAttestorInput {
  readonly dryRun?: boolean;
}

/** Thin dependency-bound facade the composition root mounts. */
export interface LedgerAttestor {
  /**
   * Run one attestation tick. Validates `input` at the boundary; an
   * invalid input rejects cleanly (no port is touched). A per-chain
   * failure is surfaced in the result, not thrown.
   */
  handle(input?: LedgerAttestorInput): Promise<AttestationRunResult>;
}

/**
 * Bind the attestor behind its feature flag. Returns `null` when
 * `enabled` is false (composition root skips mounting). Otherwise binds
 * the ports once and returns the facade. Default = OFF.
 */
export function wireLedgerAttestor(
  deps: WireLedgerAttestorDeps,
): LedgerAttestor | null {
  if (!deps.enabled) return null;

  // Bind the orchestrator deps once. `enabled` is dropped — it is a
  // wiring concern, not an attestor concern.
  const { enabled: _enabled, ...attestorDeps } = deps;
  void _enabled;

  return {
    async handle(input?: LedgerAttestorInput): Promise<AttestationRunResult> {
      // Boundary guard: reject a malformed request without throwing a
      // raw zod error to the caller's hot path.
      const parsed = attestationRequestSchema.safeParse(input ?? {});
      if (!parsed.success) {
        throw new Error(
          `invalid_attestation_request: ${parsed.error.issues
            .map((i) => i.message)
            .join(', ')}`,
        );
      }

      // exactOptionalPropertyTypes: spread `dryRun` only when present so
      // we never pass an explicit `undefined` into the exact-optional
      // AttestorDeps field.
      const runDeps: AttestorDeps = {
        ...attestorDeps,
        ...(parsed.data.dryRun !== undefined
          ? { dryRun: parsed.data.dryRun }
          : {}),
      };
      return runAttestation(runDeps);
    },
  };
}
