/**
 * Retention worker core.
 *
 * Wires all entity adapters into a single sweep runner. The cron module
 * and any on-demand CLI invocation both funnel through runSweep so the
 * behaviour, metrics, and logging stay identical regardless of trigger.
 */

import {
  createAuditEventsAdapter,
  createChatMessagesAdapter,
  createCommunicationLogsAdapter,
  createAiInteractionsAdapter,
  createDeletedUserPiiAdapter,
  type RetentionAdapter,
  type AdapterResult,
} from './adapters/index.js';
import { loadConfig, type RetentionConfig } from './config.js';
import { createLogger } from './logger.js';

const logger = createLogger('retention.worker');

export interface SweepSummary {
  startedAt: string;
  completedAt: string;
  durationMs: number;
  totalCandidates: number;
  totalAffected: number;
  totalSkippedLegalHold: number;
  adapters: AdapterResult[];
  ok: boolean;
}

/**
 * Build the default adapter list from config. Each adapter gets its own
 * retention window in days; the runner computes the cutoff per adapter.
 *
 * Callers can provide their own adapter list (useful for tests).
 */
export function createDefaultAdapters(config: RetentionConfig): RetentionAdapter[] {
  return [
    createAuditEventsAdapter({
      retentionDays: config.retention.auditEventsDays,
      databaseUrl: config.databaseUrl,
    }),
    createChatMessagesAdapter({
      retentionDays: config.retention.chatMessagesDays,
      databaseUrl: config.databaseUrl,
    }),
    createCommunicationLogsAdapter({
      retentionDays: config.retention.communicationLogsDays,
      databaseUrl: config.databaseUrl,
    }),
    createAiInteractionsAdapter({
      retentionDays: config.retention.aiInteractionsDays,
      databaseUrl: config.databaseUrl,
    }),
    createDeletedUserPiiAdapter({
      retentionDays: config.retention.deletedUserPiiHardDeleteDays,
      databaseUrl: config.databaseUrl,
    }),
  ];
}

function cutoffFor(retentionDays: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - retentionDays);
  return d;
}

/**
 * Run all adapters sequentially. Returns a full summary even if individual
 * adapters fail; the overall ok flag is true only when every adapter
 * succeeded.
 */
export async function runSweep(
  config: RetentionConfig = loadConfig(),
  adapters?: RetentionAdapter[]
): Promise<SweepSummary> {
  const startedAt = new Date();
  const resolved = adapters ?? createDefaultAdapters(config);

  logger.info('retention sweep starting', {
    adapters: resolved.map((a) => a.name),
    dryRun: config.dryRun,
    batchLimit: config.batchLimit,
  });

  const results: AdapterResult[] = [];
  for (const adapter of resolved) {
    const cutoff = cutoffFor(adapter.retentionDays);
    const res = await adapter.run({
      cutoff,
      dryRun: config.dryRun,
      batchLimit: config.batchLimit,
    });
    results.push(res);
  }

  const completedAt = new Date();
  const summary: SweepSummary = {
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    durationMs: completedAt.getTime() - startedAt.getTime(),
    totalCandidates: results.reduce((s, r) => s + r.candidates, 0),
    totalAffected: results.reduce((s, r) => s + r.affected, 0),
    totalSkippedLegalHold: results.reduce((s, r) => s + r.skippedLegalHold, 0),
    adapters: results,
    ok: results.every((r) => r.ok),
  };

  logger.info('retention sweep complete', {
    durationMs: summary.durationMs,
    totalCandidates: summary.totalCandidates,
    totalAffected: summary.totalAffected,
    totalSkippedLegalHold: summary.totalSkippedLegalHold,
    ok: summary.ok,
    perAdapter: results.map((r) => ({
      name: r.entity,
      affected: r.affected,
      candidates: r.candidates,
      skippedLegalHold: r.skippedLegalHold,
      ok: r.ok,
      durationMs: r.durationMs,
      warnings: r.warnings,
    })),
  });

  return summary;
}
