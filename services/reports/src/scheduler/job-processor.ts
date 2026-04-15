/**
 * Job processor - Process scheduled report jobs
 */

import { Worker } from 'bullmq';
import type { ReportType } from '../reports/report-types.js';
import type { ReportFormat } from '../reports/report-types.js';
import type { IReportStorage } from '../storage/storage.js';
import type { IDeliveryService } from '../storage/delivery.js';
import { getReportSubject } from '../storage/delivery.js';
import { Logger as ObsLogger } from '@bossnyumba/observability';

const jobLogger = new ObsLogger({
  service: {
    name: 'reports-scheduler',
    version: process.env.SERVICE_VERSION || '1.0.0',
    environment: (process.env.NODE_ENV as 'development' | 'staging' | 'production') || 'development',
  },
  level: (process.env.LOG_LEVEL as 'info' | 'debug' | 'warn' | 'error') || 'info',
  pretty: process.env.NODE_ENV !== 'production',
});

export interface ScheduledJobData {
  scheduleId: string;
  tenantId: string;
  reportType: ReportType;
  params: Record<string, unknown>;
  recipients: string[];
  format: ReportFormat;
}

export interface JobProcessorOptions {
  redis?: {
    host?: string;
    port?: number;
    password?: string;
  };
}

function getRedisConfig(): { host: string; port: number; password?: string } {
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
      // invalid URL, fall through
    }
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('REDIS_URL is required in production for report job processor');
  }
  return {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    password: process.env.REDIS_PASSWORD,
  };
}

const DEFAULT_REDIS = getRedisConfig();

export interface ReportGenerateFn {
  (
    tenantId: string,
    reportType: ReportType,
    params: Record<string, unknown>,
    format: ReportFormat
  ): Promise<Buffer | string>;
}

export function createReportJobProcessor(
  generateReport: ReportGenerateFn,
  storage: IReportStorage,
  delivery: IDeliveryService,
  options: JobProcessorOptions = {}
): Worker {
  const redis = { ...DEFAULT_REDIS, ...options.redis };

  const worker = new Worker<ScheduledJobData>(
    'scheduled-reports',
    async (job) => {
      const { tenantId, reportType, params, recipients, format } = job.data;

      const content = await generateReport(
        tenantId,
        reportType,
        params,
        format
      );
      const buffer =
        typeof content === 'string' ? Buffer.from(content, 'utf-8') : content;

      const stored = await storage.save(
        tenantId,
        reportType,
        format,
        buffer,
        params
      );

      if (recipients.length > 0) {
        await delivery.deliverReport({
          to: recipients,
          subject: getReportSubject(reportType, format),
          body: `Please find attached your ${reportType} report.`,
          report: stored,
          content: buffer,
        });
      }

      return { reportId: stored.id };
    },
    { connection: redis }
  );

  worker.on('failed', (job, err) => {
    jobLogger.error(`Report job ${job?.id} failed`, err instanceof Error ? err : undefined, {
      jobId: job?.id,
    });
  });

  return worker;
}
