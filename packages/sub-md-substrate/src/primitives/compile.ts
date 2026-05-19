/**
 * Compile<TInputs, TReport> — aggregate signals into a report.
 *
 * INPUT     an array of TInputs (metrics, events, transactions, signals)
 *           + a reporting window
 * OUTPUT    a TReport: aggregates, top-N, anomalies, recommended actions
 *
 * Examples:
 *   - weekly-report-compiler             Compile<TenantWeekSignals, Brief>
 *   - payroll.compile (internal)         Compile<PayrollLedger, PayRun>
 *   - customer-success.compile           Compile<OrgChurnSignals, CsBrief>
 *   - kra.filing_assistant.compile       Compile<MonthlyTxns, KraReturn>
 *
 * Compile NEVER sends — like Draft, it produces a draft report status by
 * default. The MD picks it up and may route to Dispatch.
 */

import { createCapTracker } from '../hooks/autonomy-cap.js';
import { sealLedgerEntry } from '../hooks/ledger-seal.js';
import { decidePermission } from '../hooks/permission-mode.js';
import type {
  PrimitiveContext,
  PrimitiveResult,
} from '../types.js';
import { isInScope } from '../types.js';

export interface CompileWindow {
  readonly startMs: number;
  readonly endMs: number;
}

export interface CompileReport {
  readonly title: string;
  readonly window: CompileWindow;
  readonly aggregates: Readonly<Record<string, number>>;
  readonly topN: ReadonlyArray<{ readonly label: string; readonly value: number }>;
  readonly anomalies: ReadonlyArray<{
    readonly label: string;
    readonly severity: 'low' | 'medium' | 'high' | 'critical';
    readonly rationale: string;
  }>;
  readonly recommendedActions: ReadonlyArray<string>;
  readonly inputsExamined: number;
}

export interface CompileStrategy<TInput, TReport extends CompileReport> {
  compile(args: {
    readonly inputs: ReadonlyArray<TInput>;
    readonly window: CompileWindow;
    readonly ctx: PrimitiveContext;
    readonly recordLlmCall: () => boolean;
  }): Promise<TReport>;
}

export interface CompilePrimitive<TInput, TReport extends CompileReport> {
  readonly name: string;
  run(args: {
    readonly inputs: ReadonlyArray<TInput>;
    readonly window: CompileWindow;
    readonly inputTenantId: string;
    readonly ctx: PrimitiveContext;
  }): Promise<PrimitiveResult<TReport>>;
}

export interface CompileOptions<TInput, TReport extends CompileReport> {
  readonly name: string;
  readonly strategy: CompileStrategy<TInput, TReport>;
  /** Max input count the substrate accepts. Defaults 10_000. */
  readonly maxInputs?: number;
}

export function createCompile<TInput, TReport extends CompileReport>(
  opts: CompileOptions<TInput, TReport>,
): CompilePrimitive<TInput, TReport> {
  const maxInputs = opts.maxInputs ?? 10_000;

  const primitive: CompilePrimitive<TInput, TReport> = {
    name: opts.name,
    async run({
      inputs,
      window,
      inputTenantId,
      ctx,
    }: {
      readonly inputs: ReadonlyArray<TInput>;
      readonly window: CompileWindow;
      readonly inputTenantId: string;
      readonly ctx: PrimitiveContext;
    }): Promise<PrimitiveResult<TReport>> {
      const inScope = isInScope(inputTenantId, ctx.scope);
      if (!inScope.ok) {
        return sealLedgerEntry({
          ctx,
          primitiveName: opts.name,
          primitiveKind: 'compile',
          input: { inputCount: inputs.length, window },
          output: {
            title: 'rejected',
            window,
            aggregates: {},
            topN: [],
            anomalies: [],
            recommendedActions: [],
            inputsExamined: 0,
          } as unknown as TReport,
          summary: `compile rejected: ${inScope.reason}`,
          status: 'rejected',
          sideEffectCount: 0,
        });
      }

      if (inputs.length > maxInputs) {
        return sealLedgerEntry({
          ctx,
          primitiveName: opts.name,
          primitiveKind: 'compile',
          input: { inputCount: inputs.length, window },
          output: {
            title: 'rejected',
            window,
            aggregates: {},
            topN: [],
            anomalies: [],
            recommendedActions: [],
            inputsExamined: 0,
          } as unknown as TReport,
          summary: `compile rejected: ${inputs.length} > maxInputs ${maxInputs}`,
          status: 'rejected',
          sideEffectCount: 0,
        });
      }

      const tracker = createCapTracker(ctx.autonomyCap);
      const recordLlmCall = (): boolean => tracker.consume('llm-call').ok;
      const report = await opts.strategy.compile({
        inputs,
        window,
        ctx,
        recordLlmCall,
      });

      const permission = decidePermission(ctx);
      // Compile is read-only; status 'sealed' is fine when allowed.
      const status = permission.ledgerStatus;

      return sealLedgerEntry({
        ctx,
        primitiveName: opts.name,
        primitiveKind: 'compile',
        input: { inputCount: inputs.length, window },
        output: report,
        summary: `compile "${report.title}" — ${report.inputsExamined} inputs, ${report.anomalies.length} anomalies`,
        status,
        sideEffectCount: 0,
      });
    },
  };
  return Object.freeze(primitive);
}
