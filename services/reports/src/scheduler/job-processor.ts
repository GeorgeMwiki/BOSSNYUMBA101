/**
 * Job processor - Process scheduled report jobs
 */

import { Worker } from 'bullmq';
import type { ReportType } from '../reports/report-types.js';
import type { ReportFormat } from '../reports/report-types.js';
import type { IReportStorage } from '../storage/storage.js';
import type { IDeliveryService } from '../storage/delivery.js';
import { getReportSubject } from '../storage/delivery.js';

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

const DEFAULT_REDIS = {
  host: process.env.REDIS_HOST ?? 'localhost',
  port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  password: process.env.REDIS_PASSWORD,
};

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
    console.error(`Report job ${job?.id} failed:`, err);
  });

  return worker;
}
