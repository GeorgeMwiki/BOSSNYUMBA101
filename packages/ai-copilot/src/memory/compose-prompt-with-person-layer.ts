/**
 * composePromptWithPersonLayer — brain wire-in seam for the federated
 * Personal Knowledge Base.
 *
 * Sits between the kernel's per-tenant prompt composition
 * (`renderIdentityPreamble`, `renderCoreMemoryBlocks`,
 * `semanticMemory.recall` — all tenant-scoped) and the LLM call. When
 * the request carries a `currentPersonId` (resolved by the api-gateway
 * person-context middleware from `person_links` + an affirmative
 * `persons.consent_unified_kb_at` opt-in), this helper:
 *
 *   1. Loads the person's federated memory layer via `loadPersonLayer`.
 *   2. Runs `assertChineseWall` — FAIL-LOUD if any cross-tenant numeric
 *      cell or below-k-floor aggregate is present. The thrown
 *      `PersonalKbBoundaryViolation` MUST bubble to the audit-chain
 *      emitter; never catch + ignore here.
 *   3. Renders an additive `[PERSONAL CONTEXT]` block that the brain
 *      orchestrator appends BELOW the active-tenant prompt slots —
 *      "Predictions APPEND to rule-based decisions" (CLAUDE.md).
 *
 * Returns `{ promptFragment: '', tags: null }` when:
 *   - currentPersonId is empty (no opt-in / no link present)
 *   - currentTenantId is empty (no tenant binding — refuse to label)
 *
 * The fragment is intentionally plaintext (not JSON) so the LLM's
 * token-level attention treats it as prose. The composer attaches the
 * structured `tags` separately for the audit-chain emitter.
 */

import { logger } from '../logger.js';
import {
  loadPersonLayer,
  type PersonLayerDrizzleClient,
  type PersonLayerSqlTemplate,
  type PersonLayerResult,
  type PersonalMemoryCell,
} from './person-layer.js';
import {
  assertChineseWall,
  tagBoundary,
  type BoundaryTags,
} from './boundary-tagger.js';

// ────────────────────────────────────────────────────────────────────
// Public types
// ────────────────────────────────────────────────────────────────────

export interface ComposePromptWithPersonLayerArgs {
  /**
   * Resolved by api-gateway person-context middleware. When falsy, the
   * helper short-circuits and returns an empty fragment — the brain
   * proceeds with tenant-only memory exactly as before.
   */
  readonly currentPersonId: string | null | undefined;
  /**
   * Active tenant for provenance comparison. Required when
   * `currentPersonId` is set; if absent, the helper short-circuits.
   */
  readonly currentTenantId: string;
  readonly db: PersonLayerDrizzleClient;
  readonly sqlTemplate?: PersonLayerSqlTemplate;
}

export interface ComposePromptWithPersonLayerResult {
  /**
   * The block to APPEND to the brain's tenant-composed prompt. Empty
   * string when no person layer is active.
   */
  readonly promptFragment: string;
  /**
   * Boundary tags consumed by the audit-chain emitter + reply
   * composer. `null` when no person layer was loaded.
   */
  readonly tags: BoundaryTags | null;
}

const EMPTY_RESULT: ComposePromptWithPersonLayerResult = Object.freeze({
  promptFragment: '',
  tags: null,
});

// ────────────────────────────────────────────────────────────────────
// Helper — render the additive block from the verdict
// ────────────────────────────────────────────────────────────────────

function renderFragment(layer: PersonLayerResult): string {
  const lines: string[] = ['[PERSONAL CONTEXT — federated PKB, additive]'];

  if (layer.preferences.length > 0) {
    lines.push('Preferences:');
    for (const cell of layer.preferences) {
      lines.push(`- ${cell.key}: ${jsonOneLine(cell.value)}`);
    }
  }
  if (layer.context.length > 0) {
    lines.push('Current context:');
    for (const cell of layer.context) {
      lines.push(`- ${cell.key}: ${jsonOneLine(cell.value)}`);
    }
  }
  if (layer.recurringFacts.length > 0) {
    lines.push('Recurring life facts:');
    for (const cell of layer.recurringFacts) {
      lines.push(`- ${cell.key}: ${jsonOneLine(cell.value)}`);
    }
  }
  if (layer.calibration.length > 0) {
    lines.push('Calibration:');
    for (const cell of layer.calibration) {
      lines.push(`- ${cell.key}: ${jsonOneLine(cell.value)}`);
    }
  }
  lines.push('[END PERSONAL CONTEXT]');
  return lines.join('\n');
}

function jsonOneLine(
  value: PersonalMemoryCell['value'],
): string {
  try {
    return JSON.stringify(value);
  } catch {
    return '{}';
  }
}

// ────────────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────────────

/**
 * Brain wire-in seam. Returns an additive prompt fragment + boundary
 * tags, or an empty result when no person-layer is in play.
 *
 * THROWS `PersonalKbBoundaryViolation` when the loaded layer would leak
 * cross-tenant numeric data into the active tenant context. The caller
 * MUST allow this to bubble — it represents a request the audit chain
 * has to record as a denial.
 */
export async function composePromptWithPersonLayer(
  args: ComposePromptWithPersonLayerArgs,
): Promise<ComposePromptWithPersonLayerResult> {
  const personId = args.currentPersonId?.trim() ?? '';
  if (personId.length === 0) {
    return EMPTY_RESULT;
  }
  if (!args.currentTenantId || args.currentTenantId.trim() === '') {
    logger.warn(
      'compose-prompt-with-person-layer: currentTenantId missing; skipping person overlay',
      { personId },
    );
    return EMPTY_RESULT;
  }

  const layer = await loadPersonLayer({
    personId,
    currentTenantId: args.currentTenantId,
    db: args.db,
    sqlTemplate: args.sqlTemplate,
  });

  // FAIL-LOUD on cross-tenant numeric leak. assertChineseWall throws
  // `PersonalKbBoundaryViolation`; we let it bubble so the api-gateway
  // audit-chain emitter records a structured denial.
  const verdict = assertChineseWall({
    personLayerData: layer,
    currentTenantId: args.currentTenantId,
  });

  // Build a verdict-filtered layer: only cells in `allowedFacts` may
  // reach the prompt fragment. Re-bucket per cell.cellKind.
  const allowed = verdict.allowedFacts;
  const filteredLayer: PersonLayerResult = Object.freeze({
    preferences: Object.freeze(allowed.filter((c) => c.cellKind === 'preference')),
    context: Object.freeze(
      allowed.filter(
        (c) => c.cellKind === 'context' || c.cellKind === 'sentiment',
      ),
    ),
    recurringFacts: Object.freeze(
      allowed.filter((c) => c.cellKind === 'recurring-fact'),
    ),
    calibration: Object.freeze(
      allowed.filter((c) => c.cellKind === 'calibration'),
    ),
  });

  const tags = tagBoundary({
    personLayerData: layer,
    currentTenantId: args.currentTenantId,
  });

  // If no cells survived the filter, still return tags (the audit chain
  // wants to know we tried) but skip the prompt fragment entirely.
  const totalAllowed =
    filteredLayer.preferences.length +
    filteredLayer.context.length +
    filteredLayer.recurringFacts.length +
    filteredLayer.calibration.length;
  if (totalAllowed === 0) {
    return Object.freeze({
      promptFragment: '',
      tags,
    });
  }

  return Object.freeze({
    promptFragment: renderFragment(filteredLayer),
    tags,
  });
}
