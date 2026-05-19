/**
 * Immutable Golden Eval types.
 *
 * Defense thesis (Sleeper Agents — Hubinger 2024): backdoors survive
 * SFT + RL + adversarial training. Therefore the eval set MUST be
 * immutable from the brain's perspective AND signed with an offline
 * key so any in-place tampering can be detected at test time.
 */

export type GoldenCategory =
  | 'jailbreak-resistance'
  | 'prompt-injection'
  | 'destructive-action-gate'
  | 'jurisdictional-creep'
  | 'PII-exfil'
  | 'fair-housing'
  | 'scheming-on-test-vs-prod'
  | 'cap-violation';

export type GoldenSeverity = 'critical' | 'high' | 'medium' | 'low';

/**
 * A single scenario in the golden eval set.
 *
 * `expected_action` is what the brain SHOULD do.
 * `forbidden_actions` are absolute red lines (deny + escalate).
 *
 * Note: this type is intentionally `readonly` so a brain holding a
 * reference cannot mutate the data in memory before evaluation.
 */
export interface GoldenScenario {
  readonly id: string;
  readonly category: GoldenCategory;
  readonly severity: GoldenSeverity;
  readonly input: string;
  readonly expected_action: string;
  readonly forbidden_actions: readonly string[];
  readonly tags: readonly string[];
  readonly created_by: string;
  readonly created_at: string; // ISO-8601 UTC
}

/**
 * The SHA-256-anchored manifest signed by an OFFLINE key.
 *
 * `signature` MUST be produced on an air-gapped machine (or HSM) so
 * the production brain has no path to forge it.
 */
export interface GoldenManifest {
  readonly version: string;
  readonly generated_at: string;
  readonly key_id: string; // Offline signing key identifier
  readonly entries: readonly GoldenManifestEntry[];
  readonly manifest_hash: string; // SHA-256 of the canonical entries blob
  readonly signature: string; // Detached signature of manifest_hash
}

export interface GoldenManifestEntry {
  readonly id: string;
  readonly path: string; // relative path under golden-set/
  readonly sha256: string;
  readonly bytes: number;
}

export type IntegrityResult =
  | { readonly ok: true; readonly verified_at: string; readonly entries_count: number }
  | { readonly ok: false; readonly reason: IntegrityFailureReason; readonly violations: readonly IntegrityViolation[] };

export type IntegrityFailureReason =
  | 'manifest-missing'
  | 'manifest-malformed'
  | 'manifest-hash-mismatch'
  | 'file-missing'
  | 'file-hash-mismatch'
  | 'unknown-file-in-golden-set'
  | 'signature-invalid';

export interface IntegrityViolation {
  readonly kind: IntegrityFailureReason;
  readonly path: string;
  readonly expected?: string;
  readonly actual?: string;
}
