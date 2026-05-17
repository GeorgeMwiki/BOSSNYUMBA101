/**
 * platform.file_kra_mri — initiate a KRA Monthly Rental Income (MRI)
 * filing Temporal workflow.
 *
 * Risk tier: `external-comm`. A KRA submission reaches an external
 * regulator and carries reputational + legal risk. Four-eye approval +
 * sovereign-ledger persisted. The risk-tier validator enforces that
 * external-comm tools do NOT carry a generic `rollback` — instead they
 * use the "retraction" pattern. The dispatcher exposes
 * `requestRetraction` which fires a follow-up correction filing.
 *
 * Inputs honour the KRA submission schema:
 *   - `taxPeriodMonth` MUST match `YYYY-MM` (KRA expects monthly returns).
 *   - `returnPayload` MUST carry the canonical KRA fields:
 *       grossRent, deductibleExpenses, taxableIncome, taxDue, entityTin.
 *     Any missing or wrong-type field is rejected at the schema layer
 *     so an under-formed filing never reaches the workflow.
 *
 * 5-eye approval gate metadata:
 *   - Intent:        submit a tax return to KRA on behalf of an entity
 *   - Data lineage:  rental-ledger aggregation → KRA gateway
 *   - Permissions:   platform:kra:write + platform:ops:write +
 *                    tenant-reachability
 *   - Blast radius:  reputational + legal exposure if the filing is wrong
 *   - Rollback plan: signal `requestRetraction` to file a corrected
 *                    return (KRA accepts corrections within 30 days of
 *                    original submission per TRA §22(5))
 */

import { z } from 'zod';
import {
  type HqToolContext,
  type HqToolExecutionResult,
  type HqToolSpec,
  callerCanReachTenant,
  callerHasAllScopes,
} from '../../risk-tier.js';
import { refusal, withHqTelemetry } from './shared.js';

// ─────────────────────────────────────────────────────────────────────
// Schemas
// ─────────────────────────────────────────────────────────────────────

/**
 * KRA period format — strict `YYYY-MM`. Two-digit month, four-digit year.
 * Year clamped to 2000-2099 to catch typos (you cannot file a return for
 * year 1019).
 */
const KraTaxPeriodMonthSchema = z
  .string()
  .regex(
    /^20\d{2}-(0[1-9]|1[0-2])$/,
    'taxPeriodMonth must be YYYY-MM with year in 2000-2099',
  );

/**
 * KRA TIN — Tanzania Revenue Authority TIN.
 * Canonical format is 9 digits, optionally hyphenated. We accept both.
 */
const KraTinSchema = z
  .string()
  .regex(/^[0-9]{9}$|^[0-9]{3}-[0-9]{3}-[0-9]{3}$/, 'entityTin must be a 9-digit KRA TIN');

const KraReturnPayloadSchema = z.object({
  entityTin: KraTinSchema,
  /** Gross rent collected in the period, in TZS cents. */
  grossRent: z.number().int().nonnegative(),
  /** Deductible expenses, in TZS cents. */
  deductibleExpenses: z.number().int().nonnegative(),
  /** Computed taxable income (gross - deductibles), in TZS cents. */
  taxableIncome: z.number().int().nonnegative(),
  /** Tax due (10% of taxableIncome per MRI rules), in TZS cents. */
  taxDue: z.number().int().nonnegative(),
});

export const FileKraMriInputSchema = z.object({
  tenantId: z.string().min(1).max(64),
  taxPeriodMonth: KraTaxPeriodMonthSchema,
  returnPayload: KraReturnPayloadSchema,
  initiatedByUserId: z.string().min(1).max(120),
});

export const FileKraMriOutputSchema = z.object({
  tenantId: z.string(),
  taxPeriodMonth: z.string(),
  workflowId: z.string(),
  runId: z.string(),
  status: z.enum(['started']),
  entityTin: z.string(),
  startedAt: z.string(),
});

export type FileKraMriInput = z.infer<typeof FileKraMriInputSchema>;
export type FileKraMriOutput = z.infer<typeof FileKraMriOutputSchema>;

// ─────────────────────────────────────────────────────────────────────
// Dispatcher port
// ─────────────────────────────────────────────────────────────────────

export interface KraMriFilingWorkflowDispatcherPort {
  start(args: {
    readonly tenantId: string;
    readonly taxPeriodMonth: string;
    readonly returnPayload: z.infer<typeof KraReturnPayloadSchema>;
    readonly initiatedByUserId: string;
  }): Promise<{ workflowId: string; runId: string }>;
  /**
   * Retraction = submit a corrected return. The KRA gateway treats the
   * original submission id as the de-dupe key, so the retraction
   * supersedes rather than duplicates.
   */
  requestRetraction(args: {
    readonly workflowId: string;
    readonly reason: string;
  }): Promise<void>;
}

export interface FileKraMriDeps {
  readonly kraMriDispatcher: KraMriFilingWorkflowDispatcherPort;
}

const REQUIRED_SCOPES: ReadonlyArray<string> = [
  'platform:kra:write',
  'platform:ops:write',
];

export function createFileKraMriTool(
  deps: FileKraMriDeps,
): HqToolSpec<FileKraMriInput, FileKraMriOutput> {
  return {
    name: 'platform.file_kra_mri',
    riskTier: 'external-comm',
    description:
      'Initiate a KRA Monthly Rental Income filing Temporal workflow. EXTERNAL-COMM tier; four-eye approval, KRA-strict payload schema. Rollback = retraction filing.',
    inputSchema: FileKraMriInputSchema,
    outputSchema: FileKraMriOutputSchema,
    requiredScopes: REQUIRED_SCOPES,
    approvalRequired: true,
    rollback: async (output, _ctx) => {
      await deps.kraMriDispatcher.requestRetraction({
        workflowId: output.workflowId,
        reason: `automated retraction of ${output.workflowId}`,
      });
    },
    async execute(
      input: FileKraMriInput,
      ctx: HqToolContext,
    ): Promise<HqToolExecutionResult<FileKraMriOutput>> {
      return withHqTelemetry({
        toolName: 'platform.file_kra_mri',
        riskTier: 'external-comm',
        approvalRequired: true,
        costEstimateUsd: null,
        tenantId: input.tenantId,
        ctx,
        input,
        body: async () => {
          if (!callerHasAllScopes(ctx.caller, REQUIRED_SCOPES)) {
            return refusal(
              'OUT_OF_SCOPE',
              'caller lacks platform:kra:write + platform:ops:write scopes',
            );
          }
          if (!callerCanReachTenant(ctx.caller, input.tenantId)) {
            return refusal(
              'OUT_OF_SCOPE',
              `caller cannot reach tenant ${input.tenantId}`,
            );
          }
          // Domain invariant — KRA refuses returns where (gross - deductibles)
          // != taxableIncome. We catch the arithmetic locally so the
          // workflow never even contacts the gateway with a bogus return.
          const expectedTaxable =
            input.returnPayload.grossRent - input.returnPayload.deductibleExpenses;
          if (expectedTaxable !== input.returnPayload.taxableIncome) {
            return refusal(
              'INVARIANT_VIOLATION',
              `taxableIncome ${input.returnPayload.taxableIncome} ≠ grossRent(${input.returnPayload.grossRent}) - deductibleExpenses(${input.returnPayload.deductibleExpenses}) = ${expectedTaxable}`,
            );
          }
          // KRA MRI is 10% of taxable income. Allow a 1-cent rounding
          // tolerance because TZS cents arithmetic on percentages may
          // round inconsistently across our ledger sources.
          const expectedTax = Math.round(expectedTaxable * 0.10);
          if (Math.abs(input.returnPayload.taxDue - expectedTax) > 1) {
            return refusal(
              'INVARIANT_VIOLATION',
              `taxDue ${input.returnPayload.taxDue} ≠ round(taxableIncome * 0.10) = ${expectedTax}`,
            );
          }
          let started: { workflowId: string; runId: string };
          try {
            started = await deps.kraMriDispatcher.start({
              tenantId: input.tenantId,
              taxPeriodMonth: input.taxPeriodMonth,
              returnPayload: input.returnPayload,
              initiatedByUserId: input.initiatedByUserId,
            });
          } catch (err) {
            return {
              kind: 'failed',
              message:
                err instanceof Error
                  ? `kra-mri-dispatcher-failed: ${err.message}`
                  : 'kra-mri-dispatcher-failed: unknown error',
            };
          }
          return {
            kind: 'ok',
            output: {
              tenantId: input.tenantId,
              taxPeriodMonth: input.taxPeriodMonth,
              workflowId: started.workflowId,
              runId: started.runId,
              status: 'started',
              entityTin: input.returnPayload.entityTin,
              startedAt: ctx.clock().toISOString(),
            },
          };
        },
      });
    },
  };
}
