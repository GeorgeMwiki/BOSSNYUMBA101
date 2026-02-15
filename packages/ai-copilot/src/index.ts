/**
 * @bossnyumba/ai-copilot
 * 
 * AI copilots, predictive workflows, and governed automation
 * for the BOSSNYUMBA property management platform.
 * 
 * Features:
 * - Maintenance triage copilot
 * - Owner reporting copilot
 * - Communication drafting copilot
 * - Risk alerting copilot
 * - Arrears risk prediction
 * - Churn risk prediction
 * - Maintenance recurrence prediction
 * - Occupancy health scoring
 * - Governed prompt library
 * - Human-in-the-loop review workflows
 * - AI governance and audit logging
 * 
 * @example
 * ```typescript
 * import { createAICopilot } from '@bossnyumba/ai-copilot';
 * 
 * const copilot = createAICopilot({
 *   openai: { apiKey: process.env.OPENAI_API_KEY },
 * });
 * 
 * // Triage a maintenance request
 * const result = await copilot.triageMaintenance(input, tenant, actor, context);
 * 
 * // Predict arrears risk
 * const risk = await copilot.predictArrearsRisk(input, tenant);
 * ```
 */

// Main orchestrator
export {
  AICopilot,
  createAICopilot,
  createMockAICopilot,
  type AICopilotConfig,
  type CopilotHealthStatus,
} from './ai-copilot.js';

// Types
export * from './types/index.js';

// Prompts
export {
  PromptRegistry,
  createPromptRegistry,
  InMemoryPromptStorage,
} from './prompts/prompt-registry.js';

export type {
  PromptStorageBackend,
  PromptNotFoundError,
  PromptValidationError,
  PromptCompilationError,
  PromptRegistryError,
} from './prompts/prompt-registry.js';

export {
  DEFAULT_PROMPTS,
  MAINTENANCE_TRIAGE_PROMPT,
  OWNER_REPORTING_PROMPT,
  COMMUNICATION_DRAFTING_PROMPT,
  RISK_ALERTING_PROMPT,
  MAINTENANCE_TRIAGE_SYSTEM_PROMPT,
  OWNER_REPORTING_SYSTEM_PROMPT,
  COMMUNICATION_DRAFTING_SYSTEM_PROMPT,
  RISK_ALERTING_SYSTEM_PROMPT,
} from './prompts/default-prompts.js';

// Providers
export {
  AIProviderRegistry,
  OpenAIProvider,
  MockAIProvider,
} from './providers/ai-provider.js';

export type {
  AIProvider,
  OpenAIProviderConfig,
  AICompletionRequest,
  AICompletionResponse,
  AIProviderError,
  ModelInfo,
} from './providers/ai-provider.js';

// Services
export {
  BaseCopilot,
  type CopilotError,
  type CopilotInvocationOptions,
  type CopilotInvocationResult,
  type CopilotEventListener,
  type CopilotFactory,
} from './services/base-copilot.js';

export {
  ReviewService,
  createReviewService,
  InMemoryReviewStorage,
  type ReviewStorageBackend,
  type ReviewRequirement,
  type ReviewDecisionInput,
  type PendingReviewItem,
  type ReviewPolicyConfig,
  type ReviewMetrics,
  type ReviewNotFoundError,
  type ReviewNotRequiredError,
  type ReviewServiceError,
} from './services/review-service.js';

// Copilots
export {
  MaintenanceTriageCopilot,
  createMaintenanceTriageCopilot,
} from './copilots/maintenance-triage.copilot.js';

// Predictions
export {
  PredictionEngine,
  createPredictionEngine,
  type PredictionError,
  type ModelConfig,
  type PredictionEventListener,
} from './predictions/prediction-engine.js';

// Governance
export {
  AIGovernanceService,
  createAIGovernanceService,
  InMemoryGovernanceStorage,
  AIOperationType,
  type AIAuditEvent,
  type UsageMetrics,
  type CostTracking,
  type QualityFeedback,
  type AuditQueryOptions,
  type AIGovernanceStorageBackend,
} from './governance/ai-governance.js';

// ============================================
// AI Copilot Services
// ============================================

// Maintenance Triage
export {
  MaintenanceTriageService,
  createMaintenanceTriageService,
  classifyMaintenanceRequest,
  MaintenanceCategory as TriageMaintenanceCategory,
  MaintenanceSeverity,
  MaintenanceUrgencyLevel,
  type MaintenanceTriageConfig,
  type MaintenanceImage,
  type ClassifyMaintenanceResult,
} from './services/maintenance-triage.js';

// Churn Predictor
export {
  ChurnPredictorService,
  createChurnPredictorService,
  predictChurnRisk,
  ChurnRiskLevel,
  type ChurnPredictorConfig,
  type CustomerData,
  type ChurnDriver,
  type RetentionRecommendation,
  type ChurnPredictionResult,
} from './services/churn-predictor.js';

// Payment Risk
export {
  PaymentRiskService,
  createPaymentRiskService,
  predictPaymentRisk,
  PaymentRiskLevel,
  PaymentPattern,
  type PaymentRiskConfig,
  type PaymentCustomerData,
  type PaymentRiskFactor,
  type PaymentIntervention,
  type PaymentRiskResult,
} from './services/payment-risk.js';

// Next Best Action
export {
  NextBestActionService,
  createNextBestActionService,
  getNextBestAction,
  ActionCategory,
  ActionUrgency,
  type NextBestActionConfig,
  type NBACustomerContext,
  type RecommendedAction,
  type NextBestActionResult,
} from './services/next-best-action.js';

// Sentiment Analyzer
export {
  SentimentAnalyzerService,
  createSentimentAnalyzerService,
  analyzeSentiment,
  SentimentLevel,
  EmotionType,
  type SentimentAnalyzerConfig,
  type MessageContext,
  type DetectedEmotion,
  type ResponseRecommendation,
  type SentimentAnalysisResult,
} from './services/sentiment-analyzer.js';

// Vendor Matcher
export {
  VendorMatcherService,
  createVendorMatcherService,
  matchVendor,
  VendorSpecialty,
  type VendorMatcherConfig,
  type WorkOrderInput,
  type VendorProfile,
  type VendorMatch,
  type VendorMatchingResult,
} from './services/vendor-matcher.js';

// Renewal Optimizer
export {
  RenewalOptimizerService,
  createRenewalOptimizerService,
  generateRenewalOptions,
  PricingStrategy,
  type RenewalOptimizerConfig,
  type LeaseData,
  type PricingOption,
  type RenewalOptimizationResult,
} from './services/renewal-optimizer.js';

// Copilot Prompts
export {
  MAINTENANCE_TRIAGE_CLASSIFICATION_PROMPT,
  CHURN_PREDICTION_PROMPT,
  PAYMENT_RISK_PROMPT,
  NEXT_BEST_ACTION_PROMPT,
  SENTIMENT_ANALYSIS_PROMPT,
  VENDOR_MATCHING_PROMPT,
  RENEWAL_OPTIMIZATION_PROMPT,
  // Module C: AI Personalization Engine Prompts
  PREFERENCE_PROFILE_PROMPT,
  FRICTION_FINGERPRINT_PROMPT,
  NBA_MANAGER_QUEUE_PROMPT,
  DISPUTE_RISK_PROMPT,
  VENDOR_SCORE_PROMPT,
  RENEWAL_STRATEGY_PROMPT,
  CONVERSATIONAL_PERSONALIZATION_PROMPT,
  AI_COPILOT_PROMPTS,
  type PromptTemplate,
} from './prompts/copilot-prompts.js';

// ============================================
// Module C: AI Personalization Engine
// ============================================

// Workflow C.1: Tenant Preference Profile Engine
export {
  PreferenceProfileEngine,
  createPreferenceProfileEngine,
  buildPreferenceProfile,
  ChannelPreference,
  CommunicationStyle,
  LanguagePreference,
  ResponseSpeed,
  type PreferenceProfileEngineConfig,
  type OnboardingData,
  type CommunicationEvent,
  type PreferenceNode,
  type PreferenceGraph,
  type CommunicationAdaptation,
  type PreferenceProfileResult,
} from './services/preference-profile-engine.js';

// Workflow C.2: Friction Fingerprint Analyzer
export {
  FrictionFingerprintAnalyzer,
  createFrictionFingerprintAnalyzer,
  analyzeFingerprint,
  SensitivityCategory,
  EscalationSpeed,
  ResolutionPreference,
  ProactivenessLevel,
  type FrictionFingerprintAnalyzerConfig,
  type CheckInData,
  type InteractionHistory as FrictionInteractionHistory,
  type TenantContext as FrictionTenantContext,
  type SensitivityScore,
  type EscalationProfile,
  type ResolutionProfile,
  type AIProactivenessGuideline,
  type FrictionFingerprintResult,
} from './services/friction-fingerprint-analyzer.js';

// Workflow C.3: NBA Manager Queue
export {
  NBAManagerQueueService,
  createNBAManagerQueueService,
  generateManagerQueue,
  ActionType,
  ExecutionMode,
  QueuePriority,
  DEFAULT_POLICY_THRESHOLDS,
  type NBAManagerQueueConfig,
  type TenantSignals,
  type PolicyThresholds,
  type QueueConfiguration,
  type QueuedAction,
  type ManagerQueueResult,
} from './services/nba-manager-queue.js';

// Risk Scoring Models
export {
  RiskScoringService,
  createRiskScoringService,
  calculateDisputeRisk,
  calculateVendorScore,
  DisputeCategory,
  DisputeRiskLevel,
  VendorSpecialization,
  VendorTier,
  type RiskScoringConfig,
  type DisputeHistoryData,
  type DisputeRiskFactor,
  type DisputeRiskResult,
  type VendorPerformanceData,
  type VendorScoreComponent,
  type VendorScoreResult,
} from './services/risk-scoring.js';

// Enhanced Renewal Strategy Generator
export {
  RenewalStrategyGenerator,
  createRenewalStrategyGenerator,
  generateRenewalStrategy,
  RenewalStrategy,
  IncentiveType,
  DEFAULT_PROPERTY_POLICIES,
  type RenewalStrategyConfig,
  type TenantRenewalData,
  type MarketCompData,
  type PropertyPolicies,
  type RenewalOption,
  type VacancyScenario,
  type RenewalStrategyResult,
} from './services/renewal-strategy-generator.js';

// Conversational Personalization
export {
  ConversationalPersonalizationService,
  createConversationalPersonalizationService,
  generatePersonalizedMessage,
  MessageIntent,
  EmotionalTone,
  type ConversationalPersonalizationConfig,
  type TenantContext as PersonalizationTenantContext,
  type InteractionHistory as PersonalizationInteractionHistory,
  type MessageRequest,
  type PersonalizedMessage,
  type ConversationResponse,
} from './services/conversational-personalization.js';
