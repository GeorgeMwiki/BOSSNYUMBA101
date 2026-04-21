/**
 * Personas subsystem - unified persona abstraction + default catalog.
 *
 * This module exports TWO public APIs:
 *
 *  1. Legacy (backward-compat): the 12-persona flat catalog exposed as
 *     DEFAULT_PERSONAE, consumed today by brain.ts, orchestrator.ts, and
 *     persona-snapshot.test.ts. Do not remove until every consumer
 *     migrates.
 *
 *  2. LitFin-style portal-bound primary personae + differential
 *     sub-persona prompt layers, exposed as PRIMARY_PERSONAE,
 *     SUB_PERSONA_LAYERS, resolvePersona, routeToSubPersona,
 *     composePersonaPrompt. This is the cleaner model.
 */

// ----- Legacy catalog (backward compat) -----
export * from './persona.js';
export * from './system-prompts.js';
export * from './personas.catalog.js';

// ----- New portal-bound primary persona API -----
export type {
  BossnyumbaPersona,
  BossnyumbaPersonaId,
  PortalId,
  PersonaCommunicationStyle,
} from './persona-types.js';
export { PORTAL_PERSONA_MAP } from './persona-types.js';

export {
  resolvePersona,
  resolvePersonaById,
  getRegisteredPersonas,
  getAllPrimaryPersonae,
} from './persona-router.js';

// Primary persona factories (individually addressable for tests/DI).
export { createManagerChat } from './manager-chat.js';
export { createCoworker } from './coworker.js';
export { createTenantAssistant } from './tenant-assistant.js';
export { createOwnerAdvisor } from './owner-advisor.js';
export { createBossnyumbaStudio } from './bossnyumba-studio.js';
export { createPublicGuide } from './public-guide.js';

// ----- New sub-persona differential layer API -----
export type {
  SubPersonaId,
  SubPersonaConfig,
  SubPersonaSignal,
  SubPersonaDetectionResult,
  SubPersonaToneOverrides,
  SubPersonaMetadata,
} from './sub-persona-types.js';
export {
  SUB_PERSONA_REGISTRY,
  SUB_PERSONA_METADATA_REGISTRY,
  getSubPersona,
  getSubPersonaMetadata,
  getSubPersonasForRoute,
  estimateSubPersonaTokensForRoute,
  getSubPersonaVersions,
} from './sub-persona-types.js';

export type {
  SubPersonaRoutingContext,
  SubPersonaRoutingResult,
} from './sub-persona-router.js';
export {
  routeToSubPersona,
  getSubPersonaPromptLayer,
  composePersonaPrompt,
  composeAvailableTools,
  getSubPersonaConfig,
} from './sub-persona-router.js';

// ----- Convenience aggregate exports -----
import { getAllPrimaryPersonae } from './persona-router.js';
import { SUB_PERSONA_REGISTRY } from './sub-persona-types.js';

/**
 * All 6 portal-bound primary personae, frozen.
 */
export const PRIMARY_PERSONAE = Object.freeze(getAllPrimaryPersonae());

/**
 * All 7 differential sub-persona prompt layers, keyed by id.
 */
export const SUB_PERSONA_LAYERS = SUB_PERSONA_REGISTRY;

// ----- Wave-13 amplification: pedagogy standards + teaching style -----
export {
  BLOOM_LEVELS,
  SCAFFOLDING_RUNGS,
  DELIVERY_MODES,
  PEDAGOGY_CONSTANTS,
  PEDAGOGY_STANDARDS_RUBRIC,
  PEDAGOGY_STANDARDS_METADATA,
  type BloomLevel,
  type ScaffoldingRung,
  type DeliveryMode,
} from './sub-personas/pedagogy-standards.js';

export {
  TeachingStyleSchema,
  VerbosityLevelSchema,
  ExamplesDensitySchema,
  SocraticQuestionRateSchema,
  CultureContextSchema,
  DEFAULT_TEACHING_STYLE,
  resolveTeachingStyle,
  verbosityWordBudget,
  examplesPerConcept,
  socraticRatioFloor,
  renderTeachingStyleAddendum,
  safeParseTeachingStyle,
  type TeachingStyle,
  type VerbosityLevel,
  type ExamplesDensity,
  type SocraticQuestionRate,
  type CultureContext,
} from './sub-personas/teaching-style.js';
