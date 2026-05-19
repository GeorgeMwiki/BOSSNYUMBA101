/**
 * 4-eye approval flow tests. Covers:
 *   - state transitions: proposed → approved/rejected → executed
 *   - 4-eye rule (same actor can't propose + approve)
 *   - executor refuses unapproved plans (when not dryRun)
 *   - dry-run skips the store write entirely
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { parseCsv } from '../schema-sniff/csv-adapter.js';
import { inferSchema } from '../schema-sniff/infer.js';
import { proposeMappingHeuristic } from '../proposal/heuristic-map.js';
import { InMemoryEntityStoreService } from '../entity-store/InMemoryEntityStoreService.js';
import {
  ApprovalLedger,
  ApprovalRuleViolationError,
  IngestExecutor,
  buildIngestPlan,
} from '../approval/index.js';

const FIXTURES = join(__dirname, '..', '..', '__fixtures__');
const read = (name: string) => readFileSync(join(FIXTURES, name), 'utf8');
const TENANT = 'tenant-test';

async function buildPlanForFixture(fixture: string, dryRun = false) {
  const store = new InMemoryEntityStoreService();
  const types = await store.listEntityTypes(TENANT);
  const text = read(fixture);
  const table = parseCsv(text);
  const schema = inferSchema(table);
  const proposal = proposeMappingHeuristic({
    schema,
    availableEntityTypes: types,
  });
  const plan = buildIngestPlan({
    ingest_plan_id: 'plan-' + fixture,
    file_hash: 'filehash-' + fixture,
    conversation_id: 'conv-1',
    message_id: 'msg-1',
    table,
    schema,
    proposal,
    dryRun,
  });
  return { store, plan };
}

describe('ApprovalLedger', () => {
  it('records propose → approve → executed transitions', async () => {
    const { plan } = await buildPlanForFixture('hr-roster.csv');
    const ledger = new ApprovalLedger();
    ledger.propose(plan, 'alice');
    expect(ledger.getState(plan.ingest_plan_id)).toEqual('proposed');
    ledger.approve(plan.ingest_plan_id, 'bob');
    expect(ledger.getState(plan.ingest_plan_id)).toEqual('approved');
    ledger.markExecuted(plan.ingest_plan_id, 'bob');
    expect(ledger.getState(plan.ingest_plan_id)).toEqual('executed');
    expect(ledger.getRecords(plan.ingest_plan_id)).toHaveLength(3);
  });

  it('enforces the 4-eye rule on approve', async () => {
    const { plan } = await buildPlanForFixture('hr-roster.csv');
    const ledger = new ApprovalLedger();
    ledger.propose(plan, 'alice');
    expect(() => ledger.approve(plan.ingest_plan_id, 'alice')).toThrow(
      ApprovalRuleViolationError
    );
  });

  it('enforces the 4-eye rule on reject', async () => {
    const { plan } = await buildPlanForFixture('hr-roster.csv');
    const ledger = new ApprovalLedger();
    ledger.propose(plan, 'alice');
    expect(() => ledger.reject(plan.ingest_plan_id, 'alice', 'changed mind')).toThrow(
      ApprovalRuleViolationError
    );
  });

  it('rejects approve when plan was already rejected', async () => {
    const { plan } = await buildPlanForFixture('hr-roster.csv');
    const ledger = new ApprovalLedger();
    ledger.propose(plan, 'alice');
    ledger.reject(plan.ingest_plan_id, 'bob', 'wrong mapping');
    expect(() => ledger.approve(plan.ingest_plan_id, 'carol')).toThrow(
      ApprovalRuleViolationError
    );
  });

  it('refuses duplicate propose for the same plan id', async () => {
    const { plan } = await buildPlanForFixture('hr-roster.csv');
    const ledger = new ApprovalLedger();
    ledger.propose(plan, 'alice');
    expect(() => ledger.propose(plan, 'alice')).toThrow(ApprovalRuleViolationError);
  });
});

describe('IngestExecutor', () => {
  it('dry-run writes nothing to the store', async () => {
    const { store, plan } = await buildPlanForFixture('hr-roster.csv', true);
    const ledger = new ApprovalLedger();
    ledger.propose(plan, 'alice');
    // No approval needed for dryRun.
    const executor = new IngestExecutor(store, ledger);
    const report = await executor.execute(plan, {
      tenant_id: TENANT,
      executor_actor_id: 'bob',
    });
    expect(report.dry_run).toBe(true);
    expect(report.total_rows).toEqual(8);
    expect(store.count(TENANT, 'employee')).toEqual(0);
  });

  it('non-dryRun refuses to execute an un-approved plan', async () => {
    const { store, plan } = await buildPlanForFixture('hr-roster.csv', false);
    const ledger = new ApprovalLedger();
    ledger.propose(plan, 'alice');
    const executor = new IngestExecutor(store, ledger);
    await expect(
      executor.execute(plan, { tenant_id: TENANT, executor_actor_id: 'bob' })
    ).rejects.toBeInstanceOf(ApprovalRuleViolationError);
  });

  it('approved plan commits entities + attributes to the store', async () => {
    const { store, plan } = await buildPlanForFixture('hr-roster.csv', false);
    const ledger = new ApprovalLedger();
    ledger.propose(plan, 'alice');
    ledger.approve(plan.ingest_plan_id, 'bob');
    const executor = new IngestExecutor(store, ledger);
    const report = await executor.execute(plan, {
      tenant_id: TENANT,
      executor_actor_id: 'bob',
    });
    expect(report.dry_run).toBe(false);
    expect(report.entities_created).toEqual(8);
    expect(report.attributes_written).toBeGreaterThan(0);
    expect(store.count(TENANT, 'employee')).toEqual(8);
    expect(ledger.getState(plan.ingest_plan_id)).toEqual('executed');
    expect(report.tab_link).toEqual('app://entities/employee');
  });

  it('batches rows in chunks of 100 by default', async () => {
    // Build a 250-row synthetic CSV so we exercise the batching logic.
    const rows = ['full_name,email,phone'];
    for (let i = 1; i <= 250; i += 1) {
      rows.push(`Person ${i},person${i}@bn.co.tz,+25571000${i.toString().padStart(4, '0')}`);
    }
    const csv = rows.join('\n') + '\n';

    const store = new InMemoryEntityStoreService();
    const types = await store.listEntityTypes(TENANT);
    const table = parseCsv(csv);
    const schema = inferSchema(table);
    const proposal = proposeMappingHeuristic({ schema, availableEntityTypes: types });

    const plan = buildIngestPlan({
      ingest_plan_id: 'plan-batched',
      file_hash: 'filehash-batched',
      conversation_id: 'conv-1',
      message_id: 'msg-1',
      table,
      schema,
      proposal,
      dryRun: false,
    });

    expect(plan.batched_rows).toHaveLength(3); // 100 + 100 + 50
    expect(plan.batched_rows[0]?.rows).toHaveLength(100);
    expect(plan.batched_rows[2]?.rows).toHaveLength(50);

    const ledger = new ApprovalLedger();
    ledger.propose(plan, 'alice');
    ledger.approve(plan.ingest_plan_id, 'bob');
    const executor = new IngestExecutor(store, ledger);
    const report = await executor.execute(plan, {
      tenant_id: TENANT,
      executor_actor_id: 'bob',
    });
    expect(report.entities_created).toEqual(250);
    expect(report.batch_reports).toHaveLength(3);
  });

  it('reports the new entity tab link in the chat-ready report', async () => {
    const { store, plan } = await buildPlanForFixture('property-portfolio.csv', false);
    const ledger = new ApprovalLedger();
    ledger.propose(plan, 'alice');
    ledger.approve(plan.ingest_plan_id, 'bob');
    const executor = new IngestExecutor(store, ledger);
    const report = await executor.execute(plan, {
      tenant_id: TENANT,
      executor_actor_id: 'bob',
    });
    expect(report.tab_link).toEqual('app://entities/property');
    expect(report.conversation_id).toEqual('conv-1');
  });
});
