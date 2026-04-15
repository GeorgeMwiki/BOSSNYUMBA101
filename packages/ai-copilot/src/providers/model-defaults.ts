/**
 * Default model selection per task class.
 *
 * Use the most cost-effective model that meets quality bar:
 *  - Haiku (claude-haiku-4-5): cheap classification/sentiment/triage lookups.
 *  - Sonnet (claude-sonnet-4-6): predictions, matching, routine drafting.
 *  - Opus   (claude-opus-4-6): complex review, legal clause analysis, risk alerting.
 */

export const ModelTask = {
  CLASSIFICATION: 'CLASSIFICATION',
  SENTIMENT: 'SENTIMENT',
  LIGHT_DRAFT: 'LIGHT_DRAFT',
  PREDICTION: 'PREDICTION',
  MATCHING: 'MATCHING',
  DRAFT: 'DRAFT',
  REVIEW: 'REVIEW',
  COMPLEX_REASONING: 'COMPLEX_REASONING',
  RISK_ALERT: 'RISK_ALERT',
  LEASE_ANALYSIS: 'LEASE_ANALYSIS',
} as const;

export type ModelTask = (typeof ModelTask)[keyof typeof ModelTask];

export interface ModelDefaults {
  haiku: string;
  sonnet: string;
  opus: string;
  /** Per-task routing */
  taskRouting: Record<ModelTask, string>;
}

export const DEFAULT_MODEL_DEFAULTS: ModelDefaults = {
  haiku: 'claude-haiku-4-5',
  sonnet: 'claude-sonnet-4-6',
  opus: 'claude-opus-4-6',
  taskRouting: {
    [ModelTask.CLASSIFICATION]: 'claude-haiku-4-5',
    [ModelTask.SENTIMENT]: 'claude-haiku-4-5',
    [ModelTask.LIGHT_DRAFT]: 'claude-haiku-4-5',
    [ModelTask.PREDICTION]: 'claude-sonnet-4-6',
    [ModelTask.MATCHING]: 'claude-sonnet-4-6',
    [ModelTask.DRAFT]: 'claude-sonnet-4-6',
    [ModelTask.REVIEW]: 'claude-opus-4-6',
    [ModelTask.COMPLEX_REASONING]: 'claude-opus-4-6',
    [ModelTask.RISK_ALERT]: 'claude-opus-4-6',
    [ModelTask.LEASE_ANALYSIS]: 'claude-opus-4-6',
  },
};

export function modelForTask(
  task: ModelTask,
  overrides?: Partial<ModelDefaults>
): string {
  const defaults: ModelDefaults = {
    ...DEFAULT_MODEL_DEFAULTS,
    ...overrides,
    taskRouting: {
      ...DEFAULT_MODEL_DEFAULTS.taskRouting,
      ...(overrides?.taskRouting ?? {}),
    },
  };
  return defaults.taskRouting[task];
}
