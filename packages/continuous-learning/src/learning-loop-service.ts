/**
 * Learning Loop Service
 *
 * Central orchestrator for the continuous learning loop.
 * The more data gathered, the better the questions, insights, and templates become.
 *
 * Ported verbatim from LitFin src/core/continuous-learning/learning-loop-service.ts.
 * Domain-neutralised for BossNyumba real-estate vocabulary: trigger field-names
 * reference property / lease / tenant / unit concepts rather than lending fields.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface LearnerProfile {
  readonly educationLevel?: "BASIC" | "INTERMEDIATE" | "ADVANCED";
  readonly preferredLanguage?: string;
  readonly experienceYears?: number;
}

export interface LearningEvent {
  id: string;
  contextId: string;
  type:
    | "EXTRACTION"
    | "STEP_COMPLETE"
    | "RESEARCH_COMPLETE"
    | "TEMPLATE_GENERATED";
  data: Record<string, unknown>;
  timestamp: string;
}

export interface FieldExtraction {
  fieldPath: string;
  value: unknown;
  confidence: number;
  source: "conversation" | "document" | "form";
}

export interface ApplicationLearningState {
  contextId: string;
  knownFields: Set<string>;
  lastUpdated: string;
  researchTriggered: Set<string>;
  templatesGenerated: Set<string>;
  learnerProfile?: LearnerProfile;
}

export interface PrioritizedQuestion {
  fieldPath: string;
  priority: number;
  reason: string;
}

// ============================================================================
// LEARNING STATE CACHE
// ============================================================================

const learningStateCache = new Map<string, ApplicationLearningState>();
const learningEventLog: LearningEvent[] = [];

// ============================================================================
// LEARNING LOOP SERVICE
// ============================================================================

export const LearningLoopService = {
  /**
   * Process a new field extraction
   */
  async onNewExtraction(
    contextId: string,
    extraction: FieldExtraction,
  ): Promise<void> {
    const state = this.getOrCreateState(contextId);

    // Track the new field
    state.knownFields.add(extraction.fieldPath);
    state.lastUpdated = new Date().toISOString();

    // Log the event
    this.logEvent({
      id: `evt_${Date.now()}`,
      contextId,
      type: "EXTRACTION",
      data: extraction as unknown as Record<string, unknown>,
      timestamp: new Date().toISOString(),
    });

    // Check if this extraction should trigger research
    const shouldTriggerResearch = await this.checkResearchTriggers(
      contextId,
      extraction,
    );

    if (shouldTriggerResearch) {
      state.researchTriggered.add(extraction.fieldPath);
    }

    // Check if we should regenerate templates
    const shouldRegenerate = this.shouldRegenerateTemplates(state, extraction);
    if (shouldRegenerate.length > 0) {
      for (const template of shouldRegenerate) {
        await this.triggerTemplateRegeneration(
          contextId,
          template,
          extraction.fieldPath,
        );
      }
    }

    learningStateCache.set(contextId, state);
  },

  /**
   * Process step completion
   */
  async onStepComplete(
    contextId: string,
    stepId: string,
    stepData?: Record<string, unknown>,
  ): Promise<void> {
    const state = this.getOrCreateState(contextId);

    this.logEvent({
      id: `evt_${Date.now()}`,
      contextId,
      type: "STEP_COMPLETE",
      data: { stepId, ...stepData },
      timestamp: new Date().toISOString(),
    });

    state.lastUpdated = new Date().toISOString();
    learningStateCache.set(contextId, state);
  },

  /**
   * Get the next best question based on what we know
   */
  getNextBestQuestion(
    contextId: string,
    context: {
      currentStep: string;
      missingFields: string[];
      learnerProfile?: LearnerProfile;
    },
  ): PrioritizedQuestion[] {
    const state = this.getOrCreateState(contextId);

    const unknownFields = context.missingFields.filter(
      (field) => !state.knownFields.has(field),
    );

    return unknownFields
      .map((field) => ({
        fieldPath: field,
        priority: this.calculateQuestionPriority(field, state, context),
        reason: this.getQuestionReason(field, state),
      }))
      .sort((a, b) => b.priority - a.priority);
  },

  /**
   * Trigger template regeneration
   */
  async triggerTemplateRegeneration(
    contextId: string,
    templateType: "property_profile" | "financials",
    trigger: string,
  ): Promise<void> {
    const state = this.getOrCreateState(contextId);

    this.logEvent({
      id: `evt_${Date.now()}`,
      contextId,
      type: "TEMPLATE_GENERATED",
      data: { templateType, trigger },
      timestamp: new Date().toISOString(),
    });

    state.templatesGenerated.add(templateType);
    state.lastUpdated = new Date().toISOString();
    learningStateCache.set(contextId, state);
  },

  /**
   * Check if research should be triggered.
   * Triggers on field types that benefit from outside context — neighbourhood
   * comparables, market rent ranges, regulatory filings, etc.
   */
  async checkResearchTriggers(
    _contextId: string,
    extraction: FieldExtraction,
  ): Promise<boolean> {
    const researchTriggerFields = [
      "property_type",
      "neighbourhood",
      "ward",
      "city",
      "asking_rent",
      "occupancy_rate",
      "unit_count",
      "asset_class",
    ];
    return researchTriggerFields.includes(extraction.fieldPath);
  },

  /**
   * Check if templates should be regenerated based on the extracted field.
   */
  shouldRegenerateTemplates(
    _state: ApplicationLearningState,
    extraction: FieldExtraction,
  ): Array<"property_profile" | "financials"> {
    const templates: Array<"property_profile" | "financials"> = [];

    const profileTriggers = [
      "property_type",
      "asset_class",
      "neighbourhood",
      "amenities",
    ];
    if (profileTriggers.includes(extraction.fieldPath)) {
      templates.push("property_profile");
    }

    const finTriggers = [
      "asking_rent",
      "monthly_expenses",
      "occupancy_rate",
      "operating_margin",
    ];
    if (finTriggers.includes(extraction.fieldPath)) {
      templates.push("financials");
    }

    return templates;
  },

  /**
   * Calculate question priority score
   */
  calculateQuestionPriority(
    fieldPath: string,
    state: ApplicationLearningState,
    context: { currentStep: string; learnerProfile?: LearnerProfile },
  ): number {
    let priority = 50;

    const highPriorityFields = [
      "property_type",
      "asking_rent",
      "unit_count",
      "occupancy_rate",
      "monthly_expenses",
      "asset_class",
      "neighbourhood",
    ];
    if (highPriorityFields.includes(fieldPath)) {
      priority += 30;
    }

    const researchUnlockFields = ["property_type", "asset_class", "city"];
    if (
      researchUnlockFields.includes(fieldPath) &&
      !state.researchTriggered.has(fieldPath)
    ) {
      priority += 20;
    }

    const complexFields = [
      "operating_margin",
      "comparable_set",
      "market_analysis",
    ];
    if (
      complexFields.includes(fieldPath) &&
      context.learnerProfile?.educationLevel === "BASIC"
    ) {
      priority -= 15;
    }

    return Math.max(0, Math.min(100, priority));
  },

  /**
   * Get reason why a question is being asked
   */
  getQuestionReason(
    fieldPath: string,
    state: ApplicationLearningState,
  ): string {
    if (
      fieldPath === "property_type" &&
      !state.researchTriggered.has(fieldPath)
    ) {
      return "This helps Mr. Mwikila research the asset class and pull relevant comparables.";
    }
    if (fieldPath === "asking_rent") {
      return "This sets the baseline for projections and benchmarks against the neighbourhood.";
    }
    if (fieldPath === "occupancy_rate") {
      return "This anchors revenue projections and capacity planning.";
    }
    return "This information is needed for your portfolio brief.";
  },

  /**
   * Get or create learning state for a context.
   */
  getOrCreateState(contextId: string): ApplicationLearningState {
    let state = learningStateCache.get(contextId);
    if (!state) {
      state = {
        contextId,
        knownFields: new Set(),
        lastUpdated: new Date().toISOString(),
        researchTriggered: new Set(),
        templatesGenerated: new Set(),
      };
      learningStateCache.set(contextId, state);
    }
    return state;
  },

  /**
   * Log a learning event
   */
  logEvent(event: LearningEvent): void {
    learningEventLog.push(event);
    if (learningEventLog.length > 1000) {
      learningEventLog.shift();
    }
  },

  /**
   * Get recent events for a context
   */
  getRecentEvents(contextId: string, limit = 20): LearningEvent[] {
    return learningEventLog
      .filter((e) => e.contextId === contextId)
      .slice(-limit);
  },

  /**
   * Get learning state (for debugging/analytics)
   */
  getState(contextId: string): ApplicationLearningState | undefined {
    return learningStateCache.get(contextId);
  },

  /**
   * Clear cache (for testing)
   */
  clearCache(): void {
    learningStateCache.clear();
    learningEventLog.length = 0;
  },
};

export default LearningLoopService;
