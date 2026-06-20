/**
 * Final-sweep detectors for the OperationsPage header / tab actions.
 *
 * Locks in three wirings that were previously dead (no onClick):
 *   1. "Refresh" re-runs the loader and surfaces a confirmation notice.
 *   2. "View all workflows" navigates to the real `/workflows` route.
 *   3. "Export log" performs an honest export: with zero AI decisions in
 *      view it surfaces an explicit "nothing to export" notice rather
 *      than emitting an empty file or silently doing nothing.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';

const navigateSpy = vi.fn();

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigateSpy };
});

import { OperationsPage } from '../OperationsPage';

beforeEach(() => {
  navigateSpy.mockReset();
});

afterEach(() => {
  cleanup();
});

describe('OperationsPage — no dead buttons', () => {
  it('"Refresh" is wired and shows a confirmation notice', () => {
    render(<OperationsPage />);
    fireEvent.click(screen.getByText('refresh'));
    expect(screen.getByText('refreshed')).toBeInTheDocument();
  });

  it('"View all workflows" navigates to the workflows route', () => {
    render(<OperationsPage />);
    // Switch to the Stuck Workflows tab where the action lives.
    fireEvent.click(screen.getByText('tabStuckWorkflows'));
    fireEvent.click(screen.getByText('viewAllWorkflows'));
    expect(navigateSpy).toHaveBeenCalledWith('/workflows');
  });

  it('"Export log" gives an honest empty notice when there are no decisions', () => {
    render(<OperationsPage />);
    fireEvent.click(screen.getByText('tabAiDecisions'));
    fireEvent.click(screen.getByText('exportLog'));
    // Honest: no rows in view -> explicit empty notice, not a silent no-op.
    expect(screen.getByText('exportLogEmpty')).toBeInTheDocument();
  });

  it('every header action button is wired (carries an onClick handler)', () => {
    const { container } = render(<OperationsPage />);
    const header = container.querySelector('.flex.items-center.justify-between');
    expect(header).not.toBeNull();
    const buttons = header!.querySelectorAll('button');
    // The "Enhanced Control Tower" entry is an <a>, so the only header
    // <button> is Refresh — and it must be wired.
    buttons.forEach((btn) => {
      // A wired button toggles observable state on click without throwing.
      expect(() => fireEvent.click(btn)).not.toThrow();
    });
    expect(screen.getByText('refreshed')).toBeInTheDocument();
  });
});
