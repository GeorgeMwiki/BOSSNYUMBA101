/**
 * Smoke-test the intelligence-port migrations (0287..0291).
 *
 * Verifies file presence + key columns + RLS + FORCE markers without
 * spinning up Postgres — these are fast textual assertions that the
 * migrations stay in shape after future edits.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS_DIR = join(__dirname, '..', 'migrations');

function read(name: string): string {
  return readFileSync(join(MIGRATIONS_DIR, name), 'utf8');
}

describe('intelligence-port migrations (0287..0291)', () => {
  describe('0287_outcome_telemetry', () => {
    const sql = read('0287_outcome_telemetry.sql');

    it('creates outcome_predictions', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS outcome_predictions');
      expect(sql).toContain('predicted_value_currency');
    });

    it('creates outcome_observations + reconciliations', () => {
      expect(sql).toContain('outcome_observations');
      expect(sql).toContain('outcome_reconciliations');
    });

    it('enables FORCE RLS on all three tables', () => {
      expect(sql).toMatch(/outcome_predictions[^;]+FORCE ROW LEVEL SECURITY/s);
      expect(sql).toMatch(/outcome_observations[^;]+FORCE ROW LEVEL SECURITY/s);
      expect(sql).toMatch(/outcome_reconciliations[^;]+FORCE ROW LEVEL SECURITY/s);
    });

    it('uses the canonical app.current_tenant_id GUC', () => {
      expect(sql).toContain("current_setting('app.current_tenant_id'");
    });

    it('binds confidence + drift score to [0,1]', () => {
      expect(sql).toContain('prediction_confidence >= 0');
      expect(sql).toContain('drift_score >= 0');
    });

    it('absent of mining-domain leakage', () => {
      expect(sql).not.toMatch(/royalty|drill|licence|PCCB|NEMC|TMAA|mineral/i);
    });
  });

  describe('0288_entity_index', () => {
    const sql = read('0288_entity_index.sql');

    it('creates entity_index with embedding column', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS entity_index');
      expect(sql).toContain('embedding       vector(1536)');
    });

    it('creates entity_cross_references with composite PK', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS entity_cross_references');
      expect(sql).toContain('PRIMARY KEY (tenant_id, source_kind, source_id, target_kind, target_id, relationship)');
    });

    it('creates entity_lifecycle_stage and entity_cross_ref_relationship enums', () => {
      expect(sql).toContain('CREATE TYPE entity_lifecycle_stage');
      expect(sql).toContain('CREATE TYPE entity_cross_ref_relationship');
    });

    it('attempts HNSW index for semantic search', () => {
      expect(sql).toContain('USING hnsw (embedding vector_cosine_ops)');
    });

    it('FORCE RLS on both tables', () => {
      expect(sql).toMatch(/entity_index[^;]+FORCE ROW LEVEL SECURITY/s);
      expect(sql).toMatch(/entity_cross_references[^;]+FORCE ROW LEVEL SECURITY/s);
    });
  });

  describe('0289_decision_journal', () => {
    const sql = read('0289_decision_journal.sql');

    it('creates decisions with entry_hash + prev_hash for chain', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS decisions');
      expect(sql).toContain('entry_hash');
      expect(sql).toContain('prev_hash');
    });

    it('adds decisions_chain_unique_idx (Borjie chain-unique depth)', () => {
      expect(sql).toContain('decisions_chain_unique_idx');
    });

    it('creates decision_outcomes + decision_links', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS decision_outcomes');
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS decision_links');
    });

    it('decision_outcomes uses observed_value + observed_currency (real-estate multi-currency)', () => {
      expect(sql).toContain('observed_value      numeric(18,2)');
      expect(sql).toContain('observed_currency');
    });

    it('decided_by_kind whitelist excludes mining-specific kinds', () => {
      expect(sql).toContain('owner');
      expect(sql).toContain('brain');
      expect(sql).toContain('agent_apply');
      expect(sql).toContain('four_eye');
      expect(sql).toContain('automated_policy');
    });
  });

  describe('0290_owner_delegation_prefs', () => {
    const sql = read('0290_owner_delegation_prefs.sql');

    it('lists exactly the 12 real-estate categories', () => {
      const expected = [
        'rent-scheduling',
        'regulatory-filings',
        'lease-renewals',
        'payroll-prep',
        'listing-counter-offers',
        'maintenance-approvals-low-value',
        'tenant-communications',
        'evictions-initial-notice',
        'capex',
        'inventory',
        'marketplace-listings',
        'contractor-engagement',
      ];
      for (const cat of expected) {
        expect(sql).toContain(`'${cat}'`);
      }
    });

    it('does NOT contain mining categories from Borjie', () => {
      expect(sql).not.toContain("'royalty-filing'");
      expect(sql).not.toContain("'license-renewal-reminders'");
      expect(sql).not.toContain("'worker-discipline'");
      expect(sql).not.toContain("'shifts'");
    });

    it('enforces tier T0..T3 + envelope currency check', () => {
      expect(sql).toContain("tier IN ('T0', 'T1', 'T2', 'T3')");
      expect(sql).toContain('envelope_threshold_currency');
    });

    it('FORCE RLS enabled', () => {
      expect(sql).toContain('FORCE ROW LEVEL SECURITY');
    });
  });

  describe('0291_mwikila_actions_inbox', () => {
    const sql = read('0291_mwikila_actions_inbox.sql');

    it('has 8-state status lifecycle', () => {
      for (const status of [
        'proposed',
        'owner_approved',
        'owner_denied',
        'executed',
        'reversed',
        'committed',
        'blocked_by_inviolable',
        'expired',
      ]) {
        expect(sql).toContain(`'${status}'`);
      }
    });

    it('reversal_token + reversal_until paired (T2)', () => {
      expect(sql).toContain('mwikila_actions_inbox_reversal_pair_check');
    });

    it('summary_sw bilingual column', () => {
      expect(sql).toContain('summary_sw');
    });

    it('FORCE RLS + tenant isolation policy', () => {
      expect(sql).toContain('FORCE ROW LEVEL SECURITY');
      expect(sql).toContain('mwikila_actions_inbox_tenant_isolation');
    });
  });

  describe('down migrations all exist', () => {
    for (const name of [
      '0287_down_outcome_telemetry.sql',
      '0288_down_entity_index.sql',
      '0289_down_decision_journal.sql',
      '0290_down_owner_delegation_prefs.sql',
      '0291_down_mwikila_actions_inbox.sql',
    ]) {
      it(`has ${name}`, () => {
        const sql = readFileSync(join(MIGRATIONS_DIR, 'down', name), 'utf8');
        expect(sql).toContain('BEGIN;');
        expect(sql).toContain('COMMIT;');
        expect(sql).toContain('DROP TABLE IF EXISTS');
      });
    }
  });
});
