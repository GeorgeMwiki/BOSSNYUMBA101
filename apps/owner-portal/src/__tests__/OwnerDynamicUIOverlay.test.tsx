/**
 * OwnerDynamicUIOverlay tests — verifies the three Dynamic-UI surfaces
 * mount together with the BossNyumba bilingual catalogue.
 *
 * Renders in jsdom; the chat-ui components are dependency-free so no
 * SSE / network mocking is required.
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { OwnerDynamicUIOverlay } from '../components/OwnerDynamicUIOverlay';
import type { AffectiveProfile } from '@bossnyumba/chat-ui';

function makeProfile(
  overrides: Partial<AffectiveProfile> = {},
): AffectiveProfile {
  return {
    frustration: 0,
    comprehension: 1,
    anxiety: 0,
    confidence: 1,
    trust: 1,
    urgency: 0,
    ...overrides,
  } as AffectiveProfile;
}

describe('OwnerDynamicUIOverlay', () => {
  it('renders the overlay container with the canonical testid', () => {
    render(<OwnerDynamicUIOverlay language="sw" />);
    expect(screen.getByTestId('owner-dynamic-ui-overlay')).toBeInTheDocument();
  });

  it('fires a Swahili frustration hint when profile crosses the threshold', () => {
    render(
      <OwnerDynamicUIOverlay
        language="sw"
        profile={makeProfile({ frustration: 0.9 })}
      />,
    );
    expect(screen.getByTestId('proactive-hint')).toBeInTheDocument();
    expect(screen.getByText(/Inaonekana/)).toBeInTheDocument();
  });

  it('fires an English frustration hint when language=en', () => {
    render(
      <OwnerDynamicUIOverlay
        language="en"
        profile={makeProfile({ frustration: 0.9 })}
      />,
    );
    expect(screen.getByText(/Looks like/)).toBeInTheDocument();
  });

  it('invokes onHintDismiss when a hint is dismissed', () => {
    const onHintDismiss = vi.fn();
    render(
      <OwnerDynamicUIOverlay
        language="en"
        profile={makeProfile({ frustration: 0.9 })}
        onHintDismiss={onHintDismiss}
      />,
    );
    const dismissBtn = screen.getByTestId('proactive-hint-dismiss');
    fireEvent.click(dismissBtn);
    expect(onHintDismiss).toHaveBeenCalledOnce();
    expect(onHintDismiss).toHaveBeenCalledWith(
      'bossnyumba.frustration.handoff',
    );
  });

  it('renders the learned-shortcuts panel headline when shortcuts are provided', () => {
    // LearnedShortcut.label is a plain string ("Localised upstream" per
    // its type doc) — the caller resolves the active locale before
    // handing the entry to the panel. With language="sw" that's the
    // Swahili label. (The previous fixture passed a {sw,en} object cast
    // `as never`, which violated the contract and made ShortcutItem throw
    // "Objects are not valid as a React child".)
    render(
      <OwnerDynamicUIOverlay
        language="sw"
        shortcuts={[
          {
            id: 's1',
            label: 'Kusanya kodi',
            confidence: 0.9,
          },
        ]}
      />,
    );
    expect(screen.getByText('Njia zako za mkato')).toBeInTheDocument();
  });

  it('does not render shortcuts headline when shortcuts is empty', () => {
    render(<OwnerDynamicUIOverlay language="sw" shortcuts={[]} />);
    expect(screen.queryByText('Njia zako za mkato')).not.toBeInTheDocument();
  });
});
