/**
 * Reports Service - Main exports
 *
 * Report generation, scheduling, storage, and delivery
 *
 * Quick start:
 * ```ts
 * import {
 *   createReportService,
 *   InMemoryReportStorage,
 *   MockReportDataProvider,
 * } from '@bossnyumba/reports-service';
 *
 * const service = createReportService({
 *   dataProvider: new MockReportDataProvider(),
 * });
 *
 * const { reportId, content } = await service.generateReport(
 *   'financial',
 *   { tenantId: 'tenant-1' },
 *   'pdf'
 * );
 * const reports = await service.listReports({ tenantId: 'tenant-1' });
 * ```
 */

// ============================================================================
// Platform observability + authz wiring
// ============================================================================
import { Logger as ObsLogger } from '@bossnyumba/observability';
import { rbacEngine } from '@bossnyumba/authz-policy';

export const reportsLogger = new ObsLogger({
  service: {
    name: 'reports',
    version: process.env.SERVICE_VERSION || '1.0.0',
    environment: (process.env.NODE_ENV as 'development' | 'staging' | 'production') || 'development',
  },
  level: (process.env.LOG_LEVEL as 'info' | 'debug' | 'warn' | 'error') || 'info',
  pretty: process.env.NODE_ENV !== 'production',
});

reportsLogger.info('Observability initialized for reports service', {
  env: process.env.NODE_ENV || 'development',
});

export { rbacEngine as reportsRbacEngine };
export type { User as ReportsAuthUser } from '@bossnyumba/authz-policy';

/**
 * Authorize a report-generation request. Throws a FORBIDDEN error when denied.
 * Background schedulers without an auth context should skip this gate — they
 * are trusted by construction (the scheduler itself is configured by an admin).
 */
export function authorizeReportGeneration(
  user: import('@bossnyumba/authz-policy').User,
  reportType: string
): void {
  const decision = rbacEngine.checkPermission(user, 'read', 'report', { reportType });
  if (!decision.allowed) {
    reportsLogger.warn('Report generation denied by rbac', {
      userId: user.id,
      reportType,
      reason: decision.reason,
    });
    const err = new Error(decision.reason ?? `Forbidden: cannot generate ${reportType} report`);
    (err as Error & { code?: string }).code = 'FORBIDDEN';
    throw err;
  }
}

// Main service
import { ReportGenerationService as RGS } from './report-generation-service.js';
import { InMemoryReportStorage } from './storage/storage.js';
import type { IReportDataProvider } from './data-provider.interface.js';
import type { IReportStorage } from './storage/storage.js';
import type { ReportScheduler } from './scheduler/scheduler.js';

export {
  ReportGenerationService,
  ReportGenerationError,
  type ReportGenerationServiceOptions,
  type ReportGenerationErrorCode,
} from './report-generation-service.js';

/**
 * Create a report service with default storage (in-memory) and optional scheduler.
 * For production, inject your own IReportStorage (e.g. S3) and IReportDataProvider.
 */
export function createReportService(options: {
  dataProvider: IReportDataProvider;
  storage?: IReportStorage;
  scheduler?: ReportScheduler;
  persistReports?: boolean;
}): RGS {
  return new RGS({
    dataProvider: options.dataProvider,
    storage: options.storage ?? new InMemoryReportStorage(),
    scheduler: options.scheduler,
    persistReports: options.persistReports ?? true,
  });
}

// Generators
export {
  PdfGenerator,
  ExcelGenerator,
  CsvGenerator,
  type IReportGenerator,
  type ReportFormat,
  type ReportData,
  type ReportGeneratorOptions,
  type TableData,
  ReportGeneratorError,
} from './generators/index.js';

// Report types and data transformers
export * from './reports/index.js';

// Storage
export {
  InMemoryReportStorage,
  type IReportStorage,
  type StoredReport,
  type ReportListFilters,
} from './storage/storage.js';
export {
  EmailDeliveryService,
  getReportSubject,
  type IDeliveryService,
  type DeliveryOptions,
} from './storage/delivery.js';

// Scheduler
export { ReportScheduler, type ScheduleConfig, type ScheduledReport } from './scheduler/scheduler.js';
export { createReportJobProcessor } from './scheduler/job-processor.js';

// Data provider
export {
  type IReportDataProvider,
  MockReportDataProvider,
} from './data-provider.interface.js';

// ============================================================================
// KPI Engine
// ============================================================================
export {
  KPIEngine,
  type KPIPeriod,
  type KPIValue,
  type FinancialKPIs,
  type CollectionKPIs,
  type OccupancyKPIs,
  type MaintenanceKPIs,
  type TenantSatisfactionKPIs,
  type VendorPerformanceKPIs,
  type PortfolioSummaryKPIs,
  type PropertyKPIsDetail,
  type KPIBenchmark,
  type KPIAlert,
  type IKPIDataProvider,
} from './services/kpi-engine.service.js';

// ============================================================================
// Morning Briefing Service
// ============================================================================
export {
  MorningBriefingService,
  type MorningBriefing,
  type BriefingRecipient,
  type UrgentItem,
  type ScheduledItem,
  type AIInsight,
  type ExpiringItem,
  type QuickMetric,
  type WeatherInfo,
  type IMorningBriefingDataProvider,
} from './services/morning-briefing.service.js';

// ============================================================================
// Audit Pack Builder
// ============================================================================
export {
  AuditPackBuilderService,
  type AuditPack,
  type AuditPackType,
  type AuditPackPeriod,
  type AuditPackSection,
  type AuditDocument,
  type AuditPackConfig,
  type AuditPackTemplate,
  type IAuditPackDataProvider,
} from './services/audit-pack-builder.service.js';

// ============================================================================
// Analytics Service
// ============================================================================
export {
  AnalyticsService,
  type PortfolioKPIs,
  type PropertyKPIs,
  type RevenueAnalytics,
  type MaintenanceAnalytics,
  type TenantChurnAnalytics,
  type ArrearsAgingReport,
  type IAnalyticsDataProvider,
} from './services/analytics.service.js';
