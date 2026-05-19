/**
 * auto-mode — type vocabulary.
 *
 * The classifier sits between the kernel's `permissionMode === 'auto'`
 * branch and tool execution. It returns one of three verdicts based on
 * the next tool call + recent conversation context.
 */

import type { AutoModeVerdict, RiskTier } from '../types.js';

/**
 * The minimum context a classifier needs. Kept narrow so the classifier
 * can stay cheap (Haiku-class).
 */
export interface ClassifierInput {
  /** Tool the agent wants to call. */
  readonly toolName: string;
  /**
   * Arguments to the tool. Caller is responsible for redacting any
   * secrets — the classifier sees what it receives.
   */
  readonly args: Readonly<Record<string, unknown>>;
  /**
   * Tool's declared risk-tier. The classifier is a SECOND opinion;
   * the tool's static tier is the primary signal.
   */
  readonly tier: RiskTier;
  /**
   * Last N conversation turns as plain strings. Bounded — the kernel
   * trims before calling.
   */
  readonly recentTurns: ReadonlyArray<string>;
  /**
   * Boundaries the owner has stated in conversation (e.g. "don't
   * send SMS to anyone whose lease ended"). Plain strings; the
   * classifier treats them as deny-signals.
   */
  readonly statedBoundaries: ReadonlyArray<string>;
  /** Tenant being acted on. Used for cache key only. */
  readonly tenantId: string;
}

/**
 * Classifier verdict envelope.
 */
export interface ClassifierVerdict {
  readonly verdict: AutoModeVerdict;
  /** Brief reason shown to user when the verdict triggers an ask. */
  readonly reason: string;
  /** If the classifier wants the kernel to also slow-roll, set to true. */
  readonly recommendPlanMode: boolean;
}

/**
 * Port the kernel injects — the actual LLM call lives downstream.
 */
export interface ClassifierPort {
  classify(input: ClassifierInput): Promise<ClassifierVerdict>;
}

/**
 * Lightweight LRU + TTL cache for verdicts. Same (tool,
 * normalised-args, tenant) -> reuse for `ttlMs`.
 */
export interface VerdictCachePort {
  get(key: string): ClassifierVerdict | null;
  set(key: string, value: ClassifierVerdict, ttlMs: number): void;
}
