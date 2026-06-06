/**
 * Inspection narrative port (KI-007).
 *
 * Shared resolver that turns a set of inspection findings into a real,
 * AI-authored narrative when one is available, and a deterministic
 * narrative otherwise. Three inspection sites consume it:
 *   - conditional-survey compileReport
 *   - move-out fileDamageClaim (manifest narrative before hand-off)
 *   - FAR scheduler dispatch (narrative-style subject/body)
 *
 * Resolution order mirrors `resolveMediator` in
 * `cases/damage-deduction/damage-deduction-service.ts`:
 *   1. Injected `SurveyNarrativeGateway` (preferred — tests stub it).
 *   2. Dynamic import of `@bossnyumba/ai-copilot`'s
 *      `composeSurveyNarrative`, which itself degrades to a
 *      deterministic narrative when `ANTHROPIC_API_KEY` is unset.
 *   3. In-package deterministic narrative.
 *
 * The package is NOT a build-time dependency of domain-services: the
 * module specifier is assembled at runtime so `tsc` never resolves it.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Boundary schema (zod) — validates whatever the AI surface returns before
// we trust its strings. Kept permissive enough to accept the ai-copilot
// `SurveyNarrative` shape while only requiring the fields we consume.
// ---------------------------------------------------------------------------

export const SurveyNarrativeResultSchema = z.object({
  headline: z.string().min(1),
  narrative: z.string().min(1),
  riskFlags: z.array(z.string()).default([]),
});

export type SurveyNarrativeResult = z.infer<typeof SurveyNarrativeResultSchema>;

export interface NarrativeFinding {
  readonly component: string;
  readonly severity: string;
  readonly note?: string;
}

export interface SurveyNarrativeInput {
  readonly findings: ReadonlyArray<NarrativeFinding>;
  readonly criticalPresent: boolean;
}

/**
 * Pluggable narrative gateway. Production wires the real adapter at
 * composition time; tests inject a stub. When absent the resolver falls
 * back to the dynamic import and finally to the deterministic builder.
 */
export interface SurveyNarrativeGateway {
  compose(input: SurveyNarrativeInput): Promise<SurveyNarrativeResult>;
}

const HIGH_SEVERITIES = new Set(['critical', 'major', 'high', 'poor']);

/**
 * Deterministic narrative — no AI, no network. Pure function of the
 * findings so it is identical across runs and safe as the ultimate
 * fallback.
 */
export function deterministicSurveyNarrative(
  input: SurveyNarrativeInput
): SurveyNarrativeResult {
  const count = input.findings.length;
  const riskFlags = input.findings
    .filter((f) => HIGH_SEVERITIES.has(f.severity))
    .map((f) => `${f.component}: ${f.severity}`);
  const detail =
    count === 0
      ? 'No findings recorded.'
      : input.findings
          .map((f) =>
            f.note
              ? `${f.component} (${f.severity}) — ${f.note}`
              : `${f.component} (${f.severity})`
          )
          .join('; ');
  return {
    headline: `Inspection narrative — ${count} finding${count === 1 ? '' : 's'}`,
    narrative: `${count} finding${count === 1 ? '' : 's'} recorded. ${detail}`,
    riskFlags,
  };
}

interface AiCopilotNarrativeModule {
  composeSurveyNarrative?: (input: {
    findings: ReadonlyArray<NarrativeFinding>;
    criticalPresent: boolean;
  }) => Promise<{
    headline: string;
    narrative: string;
    riskFlags: string[];
  }>;
}

/**
 * Resolve a narrative through the injected gateway, else the dynamically
 * imported ai-copilot helper, else the deterministic builder. Never
 * throws: any failure of the AI path degrades to the deterministic
 * narrative so inspection workflows always complete.
 */
export async function resolveSurveyNarrative(
  input: SurveyNarrativeInput,
  gateway?: SurveyNarrativeGateway
): Promise<SurveyNarrativeResult> {
  if (gateway) {
    try {
      return SurveyNarrativeResultSchema.parse(await gateway.compose(input));
    } catch {
      return deterministicSurveyNarrative(input);
    }
  }

  try {
    // Hold the specifier in a runtime-computed string so tsc does not try
    // to resolve `@bossnyumba/ai-copilot` (not a declared dep here).
    const aiCopilotModuleId = '@bossnyumba/' + 'ai-copilot';
    const mod = (await import(
      /* webpackIgnore: true */ /* @vite-ignore */ aiCopilotModuleId
    )) as AiCopilotNarrativeModule;
    if (!mod.composeSurveyNarrative) {
      return deterministicSurveyNarrative(input);
    }
    const result = await mod.composeSurveyNarrative({
      findings: input.findings,
      criticalPresent: input.criticalPresent,
    });
    return SurveyNarrativeResultSchema.parse(result);
  } catch {
    return deterministicSurveyNarrative(input);
  }
}
