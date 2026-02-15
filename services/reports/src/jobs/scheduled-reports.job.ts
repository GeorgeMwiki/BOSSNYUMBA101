/**
 * Scheduled Report Generation Job
 * Uses BullMQ for cron-based report generation
 */

import { Queue, Worker } from 'bullmq';
import type { ReportFormat, ScheduledReportConfig } from '../types/index.js';

export interface ScheduledReportJobData {
  tenantId: string;
  config: ScheduledReportConfig;
  reportData: Record<string, unknown>;
}

export interface ReportDeliveryJobData {
  reportId: string;
  format: ReportFormat;
  buffer: Buffer;
  recipients: string[];
  subject: string;
}

const REDIS_OPTS = { connection: { host: 'localhost', port: 6379 } };

export function createReportQueue(): Queue<ScheduledReportJobData> {
  return new Queue<ScheduledReportJobData>('scheduled-reports', REDIS_OPTS);
}

export function createReportWorker(
  processReport: (job: ScheduledReportJobData) => Promise<Buffer>
): Worker<ScheduledReportJobData> {
  return new Worker<ScheduledReportJobData>(
    'scheduled-reports',
    async (job) => processReport(job.data),
    REDIS_OPTS
  );
}

export function scheduleReport(
  queue: Queue<ScheduledReportJobData>,
  data: ScheduledReportJobData,
  cronExpression: string
): Promise<unknown> {
  return queue.add('generate-report', data, {
    repeat: { pattern: cronExpression },
  });
}
