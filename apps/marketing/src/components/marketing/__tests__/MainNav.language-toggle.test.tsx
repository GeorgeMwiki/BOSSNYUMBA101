/**
 * MainNav — LanguageToggle mount (Wave D live detector).
 *
 * Before this fix, `LanguageToggle` existed but had ZERO importers, so
 * the Swahili experience was unreachable from the marketing chrome. The
 * fix mounts it in the nav. These tests are the detector that the toggle
 * is actually wired into the header (desktop actions) and exposes both
 * the SW and EN switch controls.
 *
 * We mock the design-system Wordmark and next/navigation so the nav can
 * mount in jsdom without pulling the full workspace package graph.
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';

vi.mock('@bossnyumba/design-system', () => ({
  Wordmark: () => <div data-testid="wordmark" />,
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

import { MainNav } from '../MainNav';

describe('MainNav — LanguageToggle is mounted (Wave D)', () => {
  it('renders the language switcher group in the marketing header', () => {
    render(<MainNav locale="en" />);
    const group = screen.getByRole('group', { name: /language switcher/i });
    expect(group).toBeInTheDocument();
  });

  it('exposes both SW and EN switch buttons', () => {
    render(<MainNav locale="en" />);
    const group = screen.getByRole('group', { name: /language switcher/i });
    expect(within(group).getByRole('button', { name: 'SW' })).toBeInTheDocument();
    expect(within(group).getByRole('button', { name: 'EN' })).toBeInTheDocument();
  });

  it('marks the active locale as pressed (EN active → EN pressed, SW not)', () => {
    render(<MainNav locale="en" />);
    const group = screen.getByRole('group', { name: /language switcher/i });
    expect(within(group).getByRole('button', { name: 'EN' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(group).getByRole('button', { name: 'SW' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });
});
