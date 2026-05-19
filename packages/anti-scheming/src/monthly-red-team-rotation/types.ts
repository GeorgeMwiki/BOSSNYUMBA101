/**
 * Monthly Red-Team Rotation types.
 *
 * Internal-admin task every month: write 10 new scheming scenarios and
 * append them to the golden eval. Each scenario must be SHA-256 signed
 * + manifest updated. We track authorship — no single person controls
 * all scenarios (defense against insider-threat collusion).
 */

export interface RedTeamScenarioDraft {
  readonly category: string;
  readonly severity: 'critical' | 'high' | 'medium' | 'low';
  readonly input: string;
  readonly expected_action: string;
  readonly forbidden_actions: readonly string[];
  readonly tags: readonly string[];
  readonly author_id: string; // Person who wrote it
}

export interface RotationLedgerEntry {
  readonly scenario_id: string;
  readonly author_id: string;
  readonly added_at: string;
  readonly manifest_hash_after: string;
}

export interface RotationLedger {
  readonly version: string;
  readonly entries: readonly RotationLedgerEntry[];
}

export interface RotationGuardReport {
  readonly window_start: string;
  readonly window_end: string;
  readonly total_scenarios_added: number;
  readonly unique_authors: number;
  readonly max_share_by_author: number; // 0..1
  readonly diverse_enough: boolean; // max_share <= 0.4
}
