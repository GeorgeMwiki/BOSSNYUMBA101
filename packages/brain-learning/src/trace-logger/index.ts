/**
 * Module 1 — trace-logger
 *
 * Public surface for every-turn capture with 4-layer PII redaction and
 * tiered storage.
 */

export { logTrace, isAlreadyLogged } from './log-trace.js';
export type {
  LogTraceInput,
  TraceEventStore,
  TraceLoggerPorts,
  LogTraceOutcome,
} from './log-trace.js';
export { storageTierFor } from './storage-tiering.js';
export {
  makeRedactionPipeline,
  redactByRegex,
  applyConsentGate,
} from './redaction-pipeline.js';
export type {
  RedactionPipeline,
  RedactionInput,
  RedactionOutput,
  RedactionPipelineConfig,
  MLRedactor,
  CanaryChecker,
} from './redaction-pipeline.js';
