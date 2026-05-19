/**
 * Types for the Constitutional gate adapter.
 *
 * The gate is REQUIRED for destructive actions (L3 #7). It wraps an
 * existing constitutional critic and converts its score into a
 * pass/fail/defer verdict with violation severity.
 */

import type { ConstitutionalGateResult } from '../types.js';

/** Adapter input. */
export interface ConstitutionalCheckInput {
  readonly actionId: string;
  readonly actionClass: string;
  readonly tenantId: string | null;
  readonly draft: string;
  readonly context?: Readonly<Record<string, unknown>>;
}

/** A duck-typed constitutional critic the gate adapter wraps. */
export interface CriticVerdictLike {
  readonly overall: number;
  readonly passed: boolean;
  readonly scores: ReadonlyArray<{
    readonly ruleId: string;
    readonly score: number;
    readonly rationale: string;
  }>;
}

export interface ConstitutionalCriticPort {
  score(input: ConstitutionalCheckInput): Promise<CriticVerdictLike>;
}

export interface RuleSeverityMap {
  readonly [ruleId: string]: 'low' | 'medium' | 'high' | 'critical';
}

export type { ConstitutionalGateResult };
