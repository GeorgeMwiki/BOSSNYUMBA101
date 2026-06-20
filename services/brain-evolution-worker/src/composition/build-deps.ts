/**
 * Composition assembler — builds the `NightlySweepDeps` bundle the
 * cron-handler's `runNightlySweep` consumes, from a single live Drizzle
 * client.
 *
 * Every port is a real adapter over `@bossnyumba/database` /
 * `@bossnyumba/autonomy-governance`, EXCEPT `reflectionEngine`, whose
 * production wiring (the `@bossnyumba/ai-copilot` LLM jury) is injected at
 * the api-gateway composition root. The default here is the deterministic
 * heuristic engine so the sweep produces real signal standalone.
 *
 * Callers may override any port via `overrides` — the api-gateway
 * composition root passes the LLM `reflectionEngine` (and optionally an
 * LLM `extractor`) this way.
 */

import type {
  NightlySweepDeps,
  TenantDirectory,
} from '../schedule/cron-handler.js';
import type { TraceReader } from '../pipeline/stage-01-read-traces.js';
import type { ReflectionEngine } from '../pipeline/stage-02-reflect.js';
import type { DeltaExtractor } from '../pipeline/stage-03-extract-deltas.js';
import type { MemoryWriter } from '../pipeline/stage-04-write-memory.js';
import type { ReportSink } from '../pipeline/stage-05-emit-report.js';
import type { ConstitutionVerifierPort } from '../safety/review-gate.js';
import type { BrainWorkerLogger } from '../types.js';

import type { DrizzleLikeClient } from './shared.js';
import { createDirectoryAdapter } from './directory-adapter.js';
import { createTraceReaderAdapter } from './trace-reader-adapter.js';
import { createHeuristicReflectionEngine } from './reflection-engine-adapter.js';
import { createMemoryWriterAdapter } from './memory-writer-adapter.js';
import { createReportSinkAdapter } from './report-sink-adapter.js';
import { createVerifierAdapter } from './verifier-adapter.js';

export interface BuildDepsOverrides {
  readonly directory?: TenantDirectory;
  readonly traceReader?: TraceReader;
  readonly reflectionEngine?: ReflectionEngine;
  readonly memoryWriter?: MemoryWriter;
  readonly reportSink?: ReportSink;
  readonly verifier?: ConstitutionVerifierPort;
  readonly extractor?: DeltaExtractor;
  readonly concurrency?: number;
  readonly windowMs?: number;
}

export interface BuildDepsArgs {
  readonly db: DrizzleLikeClient;
  readonly logger: BrainWorkerLogger;
  readonly overrides?: BuildDepsOverrides;
}

/**
 * Build the full `NightlySweepDeps` bundle. Real adapters by default;
 * any port can be overridden (the api-gateway composition root injects
 * the LLM reflection engine here).
 */
export function buildNightlySweepDeps(args: BuildDepsArgs): NightlySweepDeps {
  const o = args.overrides ?? {};
  const directory = o.directory ?? createDirectoryAdapter({ db: args.db, logger: args.logger });
  const traceReader = o.traceReader ?? createTraceReaderAdapter({ db: args.db });
  const reflectionEngine = o.reflectionEngine ?? createHeuristicReflectionEngine();
  const memoryWriter =
    o.memoryWriter ?? createMemoryWriterAdapter({ db: args.db, logger: args.logger });
  const reportSink = o.reportSink ?? createReportSinkAdapter({ db: args.db });
  const verifier = o.verifier ?? createVerifierAdapter();

  return {
    // The raw POOLED handle. `runForTenant` reserves a single connection off
    // this pool (via `withWorkerTenantContext`) and re-binds the DB-backed
    // ports onto it through `rebindPorts` so the per-tenant SET LOCAL and the
    // episodic read + memory writes share that one reserved connection.
    db: args.db,
    directory,
    traceReader,
    reflectionEngine,
    memoryWriter,
    reportSink,
    verifier,
    // Re-bind the three DB-backed ports onto the connection-pinned handle.
    // Explicit overrides (test fakes / injected engines) are preserved as-is;
    // only the default DB-backed adapters are rebuilt against `pinned` so they
    // execute on the reserved connection the tenant GUC was set on.
    rebindPorts: (pinned: DrizzleLikeClient) => ({
      traceReader: o.traceReader ?? createTraceReaderAdapter({ db: pinned }),
      memoryWriter:
        o.memoryWriter ??
        createMemoryWriterAdapter({ db: pinned, logger: args.logger }),
      reportSink: o.reportSink ?? createReportSinkAdapter({ db: pinned }),
    }),
    logger: args.logger,
    ...(o.extractor ? { extractor: o.extractor } : {}),
    ...(typeof o.concurrency === 'number' ? { concurrency: o.concurrency } : {}),
    ...(typeof o.windowMs === 'number' ? { windowMs: o.windowMs } : {}),
  };
}
