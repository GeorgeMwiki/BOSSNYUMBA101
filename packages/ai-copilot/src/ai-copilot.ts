/**
 * BOSSNYUMBA AI Copilot Orchestrator
 * 
 * Main entry point for all AI copilot functionality.
 * Provides a unified interface for:
 * - Copilot invocations (maintenance triage, owner reporting, etc.)
 * - Predictive analytics (arrears risk, churn risk, etc.)
 * - Human-in-the-loop review workflows
 * - AI governance and audit
 */

import {
  CopilotDomain,
  CopilotRequestId,
  AITenantContext,
  AIActor,
  AIRequestContext,
  AIResult,
  RiskLevel,
} from './types/core.types.js';
import {
  MaintenanceTriageInput,
  MaintenanceTriageOutput,
  OwnerReportingInput,
  OwnerReportingOutput,
  CommunicationDraftingInput,
  CommunicationDraftingOutput,
  RiskAlertInput,
  RiskAlertOutput,
} from './types/copilot.types.js';
import {
  ArrearsRiskInput,
  ArrearsRiskPrediction,
  ChurnRiskInput,
  ChurnRiskPrediction,
  OccupancyHealthInput,
  OccupancyHealthScore,
  PredictionHorizon,
} from './types/prediction.types.js';
import {
  PromptRegistry,
  createPromptRegistry,
  InMemoryPromptStorage,
} from './prompts/prompt-registry.js';
import { DEFAULT_PROMPTS } from './prompts/default-prompts.js';
import {
  AIProviderRegistry,
  OpenAIProvider,
  OpenAIProviderConfig,
  MockAIProvider,
} from './providers/ai-provider.js';
import {
  ReviewService,
  createReviewService,
  ReviewDecisionInput,
  ReviewPolicyConfig,
} from './services/review-service.js';
import {
  MaintenanceTriageCopilot,
  createMaintenanceTriageCopilot,
} from './copilots/maintenance-triage.copilot.js';
import {
  CopilotInvocationOptions,
  CopilotInvocationResult,
  CopilotError,
  CopilotEventListener,
} from './services/base-copilot.js';
import {
  PredictionEngine,
  createPredictionEngine,
  PredictionError,
  PredictionEventListener,
} from './predictions/prediction-engine.js';
import {
  AIGovernanceService,
  createAIGovernanceService,
  UsageMetrics,
  CostTracking,
} from './governance/ai-governance.js';
import { HumanReview } from './types/core.types.js';

/**
 * AI Copilot configuration
 */
export interface AICopilotConfig {
  /** OpenAI configuration (required for production) */
  openai?: OpenAIProviderConfig;
  /** Use mock provider for testing */
  useMockProvider?: boolean;
  /** Review policy overrides */
  reviewPolicy?: Partial<ReviewPolicyConfig>;
  /** Register default prompts on init */
  registerDefaultPrompts?: boolean;
}

/**
 * Copilot health status
 */
export interface CopilotHealthStatus {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  components: {
    promptRegistry: 'healthy' | 'unhealthy';
    aiProvider: 'healthy' | 'unhealthy';
    reviewService: 'healthy' | 'unhealthy';
    predictionEngine: 'healthy' | 'unhealthy';
  };
  lastChecked: string;
}

/**
 * Main AI Copilot orchestrator class
 */
export class AICopilot {
  private promptRegistry: PromptRegistry;
  private providerRegistry: AIProviderRegistry;
  private reviewService: ReviewService;
  private predictionEngine: PredictionEngine;
  private governanceService: AIGovernanceService;
  
  // Domain copilots
  private maintenanceTriageCopilot: MaintenanceTriageCopilot;
  
  // Event listeners
  private copilotListeners: CopilotEventListener[] = [];
  private predictionListeners: PredictionEventListener[] = [];

  constructor(config: AICopilotConfig = {}) {
    // Initialize prompt registry
    this.promptRegistry = createPromptRegistry();
    
    // Initialize AI provider registry
    this.providerRegistry = new AIProviderRegistry();
    if (config.useMockProvider) {
      this.providerRegistry.register(new MockAIProvider(), true);
    } else if (config.openai) {
      this.providerRegistry.register(new OpenAIProvider(config.openai), true);
    }
    
    // Initialize review service
    this.reviewService = createReviewService(undefined, config.reviewPolicy);
    
    // Initialize prediction engine
    this.predictionEngine = createPredictionEngine();
    
    // Initialize governance service
    this.governanceService = createAIGovernanceService();
    
    // Initialize domain copilots
    this.maintenanceTriageCopilot = createMaintenanceTriageCopilot(
      this.promptRegistry,
      this.providerRegistry,
      this.reviewService
    );
    
    // Register default prompts if requested
    if (config.registerDefaultPrompts !== false) {
      this.registerDefaultPrompts();
    }
    
    // Wire up governance listeners
    this.setupGovernanceListeners();
  }

  /**
   * Register default prompts
   */
  private async registerDefaultPrompts(): Promise<void> {
    const systemActor: AIActor = {
      type: 'system',
      id: 'ai-copilot-init',
      name: 'AI Copilot System',
    };

    for (const promptDef of DEFAULT_PROMPTS) {
      try {
        const result = await this.promptRegistry.createPrompt(promptDef, systemActor);
        if (result.success) {
          // Auto-approve default prompts
          await this.promptRegistry.submitForApproval(result.data.id, systemActor);
          await this.promptRegistry.approvePrompt(result.data.id, systemActor, 'Default prompt - auto-approved');
        }
      } catch {
        // Ignore errors during default prompt registration
      }
    }
  }

  /**
   * Setup governance event listeners
   */
  private setupGovernanceListeners(): void {
    // Copilot events
    const copilotListener: CopilotEventListener = {
      onRequestCompleted: (requestId, output, processingTimeMs) => {
        // Log to governance (fire and forget)
        const tenant = (output as unknown as { tenant?: AITenantContext }).tenant;
        if (tenant) {
          this.governanceService.logCopilotInvocation(
            output,
            tenant,
            { type: 'system', id: 'copilot' },
            'success'
          ).catch(() => {});
        }
      },
      onAutoApproved: (requestId, reason) => {
        // Will be logged via output
      },
    };
    this.maintenanceTriageCopilot.addEventListener(copilotListener);

    // Prediction events
    const predictionListener: PredictionEventListener = {
      onHighRiskDetected: (prediction) => {
        this.governanceService.logPrediction(
          prediction,
          prediction.tenant,
          { type: 'system', id: 'prediction-engine' }
        ).catch(() => {});
      },
    };
    this.predictionEngine.addEventListener(predictionListener);
  }

  // ===================================
  // COPILOT INVOCATION METHODS
  // ===================================

  /**
   * Triage a maintenance request
   */
  async triageMaintenance(
    input: MaintenanceTriageInput,
    tenant: AITenantContext,
    actor: AIActor,
    requestContext: AIRequestContext,
    options?: CopilotInvocationOptions
  ): Promise<AIResult<CopilotInvocationResult<MaintenanceTriageOutput>, CopilotError>> {
    return this.maintenanceTriageCopilot.invoke(
      input,
      tenant,
      actor,
      requestContext,
      options
    );
  }

  // ===================================
  // PREDICTION METHODS
  // ===================================

  /**
   * Predict arrears risk for a tenant
   */
  async predictArrearsRisk(
    input: ArrearsRiskInput,
    tenant: AITenantContext,
    horizon?: PredictionHorizon
  ): Promise<AIResult<ArrearsRiskPrediction, PredictionError>> {
    const result = await this.predictionEngine.predictArrearsRisk(input, tenant, horizon);
    if (result.success) {
      await this.governanceService.logPrediction(
        result.data,
        tenant,
        { type: 'system', id: 'prediction-engine' }
      );
    }
    return result;
  }

  /**
   * Predict churn risk for a tenant
   */
  async predictChurnRisk(
    input: ChurnRiskInput,
    tenant: AITenantContext,
    horizon?: PredictionHorizon
  ): Promise<AIResult<ChurnRiskPrediction, PredictionError>> {
    const result = await this.predictionEngine.predictChurnRisk(input, tenant, horizon);
    if (result.success) {
      await this.governanceService.logPrediction(
        result.data,
        tenant,
        { type: 'system', id: 'prediction-engine' }
      );
    }
    return result;
  }

  /**
   * Score occupancy health for a property
   */
  async scoreOccupancyHealth(
    input: OccupancyHealthInput,
    tenant: AITenantContext
  ): Promise<AIResult<OccupancyHealthScore, PredictionError>> {
    const result = await this.predictionEngine.scoreOccupancyHealth(input, tenant);
    if (result.success) {
      await this.governanceService.logPrediction(
        result.data,
        tenant,
        { type: 'system', id: 'prediction-engine' }
      );
    }
    return result;
  }

  // ===================================
  // REVIEW WORKFLOW METHODS
  // ===================================

  /**
   * Submit a review decision
   */
  async submitReview(
    input: ReviewDecisionInput,
    reviewer: AIActor,
    reviewStartTime: Date
  ): Promise<AIResult<HumanReview, unknown>> {
    return this.reviewService.submitReview(input, reviewer, reviewStartTime);
  }

  /**
   * Get pending reviews for a tenant
   */
  async getPendingReviews(tenantId: string) {
    return this.reviewService.getPendingReviews(tenantId);
  }

  /**
   * Get review history for a request
   */
  async getReviewHistory(requestId: CopilotRequestId) {
    return this.reviewService.getReviewHistory(requestId);
  }

  // ===================================
  // GOVERNANCE & METRICS METHODS
  // ===================================

  /**
   * Get usage metrics
   */
  async getUsageMetrics(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<UsageMetrics> {
    return this.governanceService.getUsageMetrics(tenantId, startDate, endDate);
  }

  /**
   * Get cost tracking
   */
  async getCostTracking(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<CostTracking> {
    return this.governanceService.getCostTracking(tenantId, startDate, endDate);
  }

  /**
   * Check budget status
   */
  async checkBudget(tenantId: string, budgetLimit: number) {
    return this.governanceService.checkBudget(tenantId, budgetLimit);
  }

  // ===================================
  // HEALTH & DIAGNOSTICS
  // ===================================

  /**
   * Health check
   */
  async healthCheck(): Promise<CopilotHealthStatus> {
    const provider = this.providerRegistry.get();
    const providerHealthy = provider ? await provider.healthCheck() : false;

    const components = {
      promptRegistry: 'healthy' as const,
      aiProvider: providerHealthy ? 'healthy' as const : 'unhealthy' as const,
      reviewService: 'healthy' as const,
      predictionEngine: 'healthy' as const,
    };

    const unhealthyCount = Object.values(components).filter(s => s === 'unhealthy').length;
    const overall = unhealthyCount === 0 ? 'healthy' :
                   unhealthyCount <= 1 ? 'degraded' : 'unhealthy';

    return {
      overall,
      components,
      lastChecked: new Date().toISOString(),
    };
  }

  // ===================================
  // ACCESSORS
  // ===================================

  /** Get the prompt registry */
  get prompts(): PromptRegistry {
    return this.promptRegistry;
  }

  /** Get the review service */
  get reviews(): ReviewService {
    return this.reviewService;
  }

  /** Get the prediction engine */
  get predictions(): PredictionEngine {
    return this.predictionEngine;
  }

  /** Get the governance service */
  get governance(): AIGovernanceService {
    return this.governanceService;
  }
}

/**
 * Create an AI Copilot instance
 */
export function createAICopilot(config?: AICopilotConfig): AICopilot {
  return new AICopilot(config);
}

/**
 * Create a mock AI Copilot for testing
 */
export function createMockAICopilot(): AICopilot {
  return new AICopilot({
    useMockProvider: true,
    registerDefaultPrompts: true,
  });
}
