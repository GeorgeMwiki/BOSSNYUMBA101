/**
 * Hono ContextVariableMap augmentation — consolidates every `c.set/c.get` key
 * used across the gateway so route/middleware files don't need per-file
 * overrides (or `@ts-nocheck` blankets).
 *
 * Keep keys loose (`unknown` / broad types). Strict typing is enforced at the
 * service-registry level where the instances are actually constructed.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare module 'hono' {
  interface ContextVariableMap {
    // Request context
    requestId: string;
    actorId: string;
    tenantId: string;
    userId: string;
    user: unknown;
    auth: unknown;
    tenant: unknown;
    countryPlugin: unknown;
    db: unknown;
    services: unknown;
    repos: unknown;

    // Arrears subsystem
    arrearsEntryLoader: unknown;
    arrearsLedgerPort: unknown;
    arrearsRepo: unknown;
    arrearsService: unknown;

    // Autonomy
    autonomousActionAudit: unknown;
    exceptionInbox: unknown;

    // Cashback / gamification
    cashbackQueue: unknown;
    gamificationRepo: unknown;
    gamificationService: unknown;

    // Compliance
    complianceExportService: unknown;

    // Financial
    financialProfileService: unknown;

    // GePG
    gepgProvider: unknown;
    gepgRawBody: string;
    gepgSignature: string;

    // Reporting
    interactiveReportService: unknown;
    occupancyTimelineService: unknown;
    riskReportService: unknown;

    // Renewal + approval
    renewalService: unknown;
    approvalDetails: unknown;
    requiresApproval: boolean;

    // Station master
    stationMasterCoverageRepo: unknown;
    stationMasterRouter: unknown;
  }
}

export {};
