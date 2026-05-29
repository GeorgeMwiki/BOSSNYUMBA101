/**
 * Auditor Agent — canonical evidence-required-output enforcer.
 *
 * Pure validator. The api-gateway composition root persists the
 * verdict to the hash-chained audit log; this module never writes.
 */

export {
  createAuditorAgent,
  AUDITOR_SYSTEM_PROMPT,
  AUDITOR_REJECTION_COPY,
  DEFAULT_CONFIDENCE_FLOOR,
  AuditorInputSchema,
  AuditorOutputSchema,
  AuditorVerdict,
  RecommendationToAudit,
  type AuditorAgent,
  type AuditorCounterModelOutcome,
  type AuditorCounterModelPort,
  type AuditorInput,
  type AuditorOutput,
  type AuditorRejectionKind,
  type CreateAuditorAgentArgs,
} from './auditor-agent.js';
