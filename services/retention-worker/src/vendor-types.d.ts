/**
 * Ambient type shim for `@bossnyumba/enterprise-hardening`.
 *
 * The enterprise-hardening package ships its build output separately and
 * its `package.json` points `types` at `dist/index.d.ts`. To keep the
 * retention-worker's typecheck independent of that package's build state
 * (and to avoid pulling the entire enterprise-hardening source into our
 * `rootDir`), we re-declare only the narrow slice of the public API that
 * the worker actually uses.
 *
 * The live types remain the source of truth — this file mirrors
 * `packages/enterprise-hardening/src/compliance/data-retention.ts`. If
 * that file changes shape in a way that breaks the worker, tests and
 * integration builds will catch it.
 */

declare module '@bossnyumba/enterprise-hardening' {
  export type RetentionPolicyTypeValue =
    | 'TIME_BASED'
    | 'EVENT_BASED'
    | 'LEGAL_REQUIREMENT'
    | 'INDEFINITE';

  export type RetentionClassificationValue =
    | 'OPERATIONAL'
    | 'FINANCIAL'
    | 'LEGAL'
    | 'AUDIT'
    | 'PII'
    | 'BACKUP'
    | 'ANALYTICS';

  export interface RetentionScope {
    readonly entityType: string;
    readonly tenantId?: string;
    readonly fieldPatterns?: readonly string[];
    readonly excludePatterns?: readonly string[];
  }

  export interface RetentionPolicy {
    readonly id: string;
    readonly name: string;
    readonly description: string;
    readonly classification: RetentionClassificationValue;
    readonly policyType: RetentionPolicyTypeValue;
    readonly retentionPeriodDays: number;
    readonly archiveAfterDays?: number;
    readonly triggerEvent?: string;
    readonly legalBasis?: string;
    readonly jurisdiction?: string;
    readonly enabled: boolean;
    readonly appliesTo: readonly RetentionScope[];
    readonly createdAt: string;
    readonly updatedAt: string;
  }

  export interface LegalHold {
    readonly id: string;
    readonly name: string;
    readonly matter: string;
    readonly custodianId: string;
    readonly createdAt: string;
    readonly expiresAt?: string;
    readonly status: 'active' | 'released' | 'expired';
    readonly scope: {
      readonly tenantIds?: readonly string[];
      readonly entityTypes?: readonly string[];
      readonly dateRangeStart?: string;
      readonly dateRangeEnd?: string;
      readonly customCriteria?: Record<string, unknown>;
    };
    readonly notes?: string;
  }

  export class DataRetentionManager {
    constructor();
    registerPolicy(policy: RetentionPolicy): void;
    exportPolicies(): RetentionPolicy[];
    createLegalHold(
      hold: Omit<LegalHold, 'id' | 'createdAt' | 'status'>,
    ): LegalHold;
    releaseLegalHold(holdId: string): boolean;
    isUnderLegalHold(
      entityType: string,
      tenantId: string,
      createdAt: string,
    ): { held: boolean; holdIds: string[] };
  }
}
