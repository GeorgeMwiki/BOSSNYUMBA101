/**
 * Scheduled Report Generation Job
 * Uses BullMQ for cron-based report generation. REDIS_URL required in production.
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

function getRedisConnection(): { host: string; port: number; password?: string } {
  const url = process.env.REDIS_URL;
  if (url) {
    try {
      const u = new URL(url);
      return {
        host: u.hostname,
        port: parseInt(u.port ?? '6379', 10),
        password: u.password || undefined,
      };
    } catch {
      // invalid URL
    }
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('REDIS_URL is required in production for scheduled reports');
  }
  return {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    password: process.env.REDIS_PASSWORD,
  };
}

const REDIS_OPTS = { connection: getRedisConnection() };

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
