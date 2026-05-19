/**
 * Tenant-privacy retention cron sweep.
 *
 * One sweep per (tenant, channel) per day. The sweep:
 *   1. Reads the channel declaration (retentionDays).
 *   2. Queries the retention port for records older than `now -
 *      retentionDays`.
 *   3. Deletes those records (or flags them for review when the channel
 *      requires manual review — biometric currently does not, but the
 *      port has the option).
 *   4. Emits a RetentionSweepEvent for audit logging.
 *
 * The cron itself is wired downstream (services/notifications etc.) —
 * this module returns the event and lets the consumer persist it.
 */

import { TENANT_PRIVACY_DECLARATIONS } from './declarations.js';
import type {
  PiiChannel,
  PiiRetentionPort,
  RetentionSweepEvent,
} from '../types.js';

/**
 * Run one sweep on a single (tenant, channel) pair.
 */
export async function sweepRetention(
  args: {
    readonly tenantId: string;
    readonly channel: PiiChannel;
    readonly now: Date;
    readonly retention: PiiRetentionPort;
    readonly sweepIdFactory: () => string;
  },
): Promise<RetentionSweepEvent> {
  const { tenantId, channel, now, retention, sweepIdFactory } = args;
  const declaration = TENANT_PRIVACY_DECLARATIONS[channel];
  const olderThan = new Date(
    now.getTime() - declaration.retentionDays * 24 * 60 * 60 * 1000,
  ).toISOString();

  const overdue = await retention.findOverdue({ tenantId, channel, olderThan });
  let recordsDeleted = 0;
  let recordsFlagged = 0;

  for (const record of overdue) {
    await retention.delete({ tenantId, channel, recordId: record.recordId });
    recordsDeleted += 1;
  }

  return Object.freeze({
    sweepId: sweepIdFactory(),
    tenantId,
    channel,
    recordsExamined: overdue.length,
    recordsDeleted,
    recordsFlagged,
    sweptAt: now.toISOString(),
  });
}
