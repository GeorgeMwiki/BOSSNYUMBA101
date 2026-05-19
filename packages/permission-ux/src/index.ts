/**
 * @bossnyumba/permission-ux — Phase K-B substrate.
 *
 * Closes five gaps from the R1/R2 audits:
 *
 *   - R1 #3 — auto-mode classifier + boundary detection         (auto-mode/)
 *   - R1 #5 — AskUserQuestion tool                              (ask-user-question/)
 *   - R1 #6 — canUseTool callback + PermissionUpdate persistence (permission-callback/)
 *   - R2 #1 — Action Receipts with Rollback                      (action-receipts/)
 *   - R2 #14 — Safe-Mode Fallback                                (safe-mode/)
 *
 * The package is wire-agnostic. Every side-effect goes through a port
 * the caller binds. Ports the caller MUST bind:
 *
 *   - `ClassifierPort`           — auto-mode LLM call (Haiku-class)
 *   - `VerdictCachePort`         — auto-mode cache (in-memory shipped)
 *   - `PermissionRuleStorePort`  — J1 entity-store
 *   - `ReceiptStorePort`         — J1 entity-store
 *   - `SovereignLedgerPort`      — sovereign-action ledger
 *   - `InverseExecutorPort`      — kernel's inverse-tool dispatcher
 */

export * from './types.js';

// Auto-mode
export {
  classifyAction,
  verdictToAction,
  deriveCacheKey,
  InMemoryVerdictCache,
  CLASSIFIER_SYSTEM_PROMPT,
  buildClassifierPrompt,
  ClassifierVerdictSchema,
  advanceBoundaryState,
  resetBoundaryState,
  INITIAL_BOUNDARY_STATE,
  type ClassifierInput,
  type ClassifierVerdict,
  type ClassifierPort,
  type VerdictCachePort,
  type ClassifyActionDeps,
  type AutoModeAction,
  type InMemoryVerdictCacheOptions,
  type BoundaryDetectorState,
  type BoundaryDetectorOptions,
} from './auto-mode/index.js';

// AskUserQuestion
export {
  AskUserQuestionInputSchema,
  AnswerEnvelopeSchema,
  QuestionSchema,
  QuestionOptionSchema,
  AnswerEntrySchema,
  PreviewFormatSchema,
  marshalAnswer,
  ASK_USER_QUESTION_TOOL_NAME,
  ASK_USER_QUESTION_TIER,
  ASK_USER_QUESTION_TOOL_SPEC,
  type AskUserQuestionInput,
  type Question,
  type QuestionOption,
  type AnswerEntry,
  type AnswerEnvelope,
  type AskUserQuestionToolInput,
  type MarshalResult,
  type MarshalError,
} from './ask-user-question/index.js';

// Permission callback
export {
  createCanUseTool,
  persistPermissionUpdate,
  evaluatePredicate,
  InMemoryPermissionRuleStore,
  type CanUseToolContext,
  type CanUseToolFn,
  type CanUseToolDeps,
  type NewPermissionRule,
  type PermissionRuleQuery,
  type PermissionRuleStorePort,
  type InMemoryPermissionRuleStoreOptions,
} from './permission-callback/index.js';

// Action receipts
export {
  emitReceipt,
  emitTerminalReceipt,
  executeRollback,
  renderReceiptCard,
  InMemoryReceiptStore,
  InMemorySovereignLedger,
  ReceiptCardPartSchema,
  ReceiptCardArgsSummarySchema,
  ReceiptCardAffectedEntitySchema,
  DEFAULT_ROLLBACK_WINDOW_MIN,
  type ReceiptEntity,
  type ReceiptStatus,
  type ReceiptArgsSummary,
  type AffectedEntityRef,
  type ReceiptStorePort,
  type NewReceiptInput,
  type RollbackPayload,
  type RollbackLedgerEvent,
  type SovereignLedgerPort,
  type InverseExecutorPort,
  type InverseResult,
  type EmitReceiptDeps,
  type ExecuteRollbackDeps,
  type ExecuteRollbackInput,
  type ExecuteRollbackResult,
  type ReceiptCardPart,
  type RenderReceiptCardOptions,
  type InMemoryReceiptStoreOptions,
} from './action-receipts/index.js';

// Safe mode
export {
  advanceSafeModeState,
  resetSafeModeState,
  buildSafeModeMessage,
  resolveSafeModeChoice,
  DEFAULT_THRESHOLDS,
  INITIAL_SAFE_MODE_STATE,
  type ConfidenceSample,
  type SafeModeChoice,
  type SafeModeState,
  type SafeModeThresholds,
  type SafeModeEntryMessage,
  type AdvanceSafeModeInput,
  type SafeModeAdvanceResult,
  type BuildSafeModeMessageInput,
  type SafeModeNextStep,
} from './safe-mode/index.js';
