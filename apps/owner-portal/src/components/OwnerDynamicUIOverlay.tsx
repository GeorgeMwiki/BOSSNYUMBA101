/**
 * OwnerDynamicUIOverlay — mounts the three Dynamic-UI surfaces from
 * `@bossnyumba/chat-ui`:
 *
 *   1. ProactiveHint              — TOM-driven hint banner (frustration /
 *                                   comprehension / anxiety / idle)
 *   2. MasteryGate                — progressive disclosure that hides
 *                                   advanced surfaces until the user
 *                                   has earned them
 *   3. LearnedShortcutsPanel      — per-route ranked frequent actions
 *
 * The overlay is a self-contained, pure-React component the owner-portal
 * home + chat surfaces drop in. Pulls bilingual copy from the
 * `bossnyumbaProactiveHints` / `bossnyumbaMasteryGateCopy` /
 * `bossnyumbaLearnedShortcutsHeadline` catalogue so the Mr. Mwikila
 * persona stays consistent across surfaces.
 *
 * Affective profile is OPTIONAL — when the consumer doesn't pass one
 * the hint surface only fires for idle-trigger hints (parent-driven).
 *
 * Shortcuts are OPTIONAL — pass `shortcuts={[]}` to suppress that
 * surface entirely.
 */

import { useCallback, useMemo } from 'react';

import {
  LearnedShortcutsPanel,
  MasteryGate,
  ProactiveHint,
  bossnyumbaProactiveHints,
  bossnyumbaMasteryGateCopy,
  bossnyumbaLearnedShortcutsHeadline,
  type AffectiveProfile,
  type HintCandidate,
  type LearnedShortcut,
  type MasteryGateProps,
} from '@bossnyumba/chat-ui';

export type OwnerOverlayLanguage = 'sw' | 'en';

export interface OwnerDynamicUIOverlayProps {
  /** Current locale — drives the bilingual hint catalogue. */
  readonly language: OwnerOverlayLanguage;
  /**
   * Optional TOM affective profile. Pass null while it's loading; pass
   * undefined to disable hint firing entirely.
   */
  readonly profile?: AffectiveProfile | null;
  /**
   * Surface a custom override of the hint catalogue. Defaults to the
   * shipped BossNyumba catalogue.
   */
  readonly customHints?: ReadonlyArray<HintCandidate>;
  /**
   * Optional callback fired when a hint is dismissed by the user.
   * Useful for analytics / mastery scoring.
   */
  readonly onHintDismiss?: (hintId: string) => void;
  /**
   * Optional MasteryGate props for the gated portfolio shortcuts.
   * When undefined the gate is not rendered (no shortcuts surface).
   */
  readonly mastery?: Pick<MasteryGateProps, 'level' | 'score'> & {
    readonly children?: React.ReactNode;
  };
  /** Optional pre-loaded learned shortcuts for the panel. */
  readonly shortcuts?: ReadonlyArray<LearnedShortcut>;
  /** Optional shortcut click handler. */
  readonly onShortcutClick?: (id: string) => void;
  /** Optional pin handler — wires to useLearnedShortcuts().pin */
  readonly onShortcutPin?: (id: string) => void;
}

export function OwnerDynamicUIOverlay({
  language,
  profile = null,
  customHints,
  onHintDismiss,
  mastery,
  shortcuts,
  onShortcutClick,
  onShortcutPin,
}: OwnerDynamicUIOverlayProps): JSX.Element {
  const hints = useMemo<ReadonlyArray<HintCandidate>>(
    () => customHints ?? bossnyumbaProactiveHints(language),
    [customHints, language],
  );

  const handleDismiss = useCallback(
    (id: string) => {
      onHintDismiss?.(id);
    },
    [onHintDismiss],
  );

  const masteryCopy = bossnyumbaMasteryGateCopy(language);
  const shortcutsHeadline = bossnyumbaLearnedShortcutsHeadline(language);
  const handleShortcutClick = useCallback(
    (id: string) => {
      onShortcutClick?.(id);
    },
    [onShortcutClick],
  );

  return (
    <div
      data-testid="owner-dynamic-ui-overlay"
      style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
    >
      <ProactiveHint
        profile={profile ?? null}
        hints={hints}
        onDismiss={handleDismiss}
        dismissAriaLabel={masteryCopy.dismissAriaLabel}
      />
      {mastery ? (
        <MasteryGate
          level={mastery.level}
          score={mastery.score}
          hintTemplate={masteryCopy.hintTemplate}
        >
          {mastery.children ?? <div data-testid="owner-overlay-mastery-slot" />}
        </MasteryGate>
      ) : null}
      {shortcuts && shortcuts.length > 0 ? (
        <LearnedShortcutsPanel
          shortcuts={shortcuts}
          onActionClick={handleShortcutClick}
          onPin={onShortcutPin}
          placement="inline"
          headline={shortcutsHeadline}
        />
      ) : null}
    </div>
  );
}
