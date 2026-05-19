/**
 * Specification Self-Correction (Roberts 2025).
 *
 * Before any destructive action, the brain reads the CURRENT,
 * tamper-checked version of `BOSSNYUMBA_CONSTITUTION.md` (signed via
 * the same SHA-256 manifest scheme as the golden eval) and
 * self-critiques: "Does my proposed action follow the spec as
 * currently written?"
 *
 * Per Roberts et al. 2025, this cuts in-context reward-hacking ~90%.
 */

export interface ConstitutionFile {
  readonly path: string;
  readonly sha256: string;
  readonly bytes: number;
}

export interface ConstitutionManifest {
  readonly version: string;
  readonly key_id: string;
  readonly files: readonly ConstitutionFile[];
  readonly manifest_hash: string;
  readonly signature: string;
}

export interface LoadedConstitution {
  readonly version: string;
  readonly loaded_at: string;
  readonly content: string; // The combined constitution text
  readonly sha256: string;
}

export interface ProposedAction {
  readonly tool: string;
  readonly args: Readonly<Record<string, unknown>>;
  readonly destructive: boolean;
  readonly justification: string;
  readonly tenant_id: string;
  readonly actor_id: string;
}

export type SelfCorrectionVerdict =
  | { readonly status: 'aligned'; readonly evidence: string }
  | { readonly status: 'conflict'; readonly clause: string; readonly recommendation: 'defer' | 'escalate' | 'refuse' }
  | { readonly status: 'unsafe-to-proceed'; readonly reason: string };

export interface SelfCritique {
  readonly action: ProposedAction;
  readonly constitution_version: string;
  readonly constitution_sha256: string;
  readonly verdict: SelfCorrectionVerdict;
  readonly evaluated_at: string;
}

export class ConstitutionTamperError extends Error {
  constructor(public readonly path: string, public readonly expected: string, public readonly actual: string) {
    super(`constitution tampered: ${path}; expected sha256=${expected.slice(0, 12)}…, got ${actual.slice(0, 12)}…`);
    this.name = 'ConstitutionTamperError';
  }
}
