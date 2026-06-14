/**
 * Final-sweep honest-degrade detector for SurveyApprovalsQueue.
 *
 * SurveyApprovalsQueue was wired to `/owner/conditional-surveys*` routes
 * that are NOT mounted. The real `/api/v1/conditional-surveys` router has
 * no pending-approvals list and uses plan-level approval verbs only, so it
 * cannot back this owner approvals queue. Until that surface lands, the
 * component MUST:
 *   1. render the MissingBackendNotice (surfacing the concrete endpoint),
 *   2. NEVER issue a network call to a dead route, and
 *   3. NEVER render fabricated approve/reject action buttons.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

// next-intl passthrough: translator returns the key so assertions are stable.
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

import { SurveyApprovalsQueue } from '../SurveyApprovalsQueue';

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('SurveyApprovalsQueue — honest degrade (no dead routes)', () => {
  it('renders the missing-backend notice with the concrete endpoint', () => {
    render(<SurveyApprovalsQueue />);
    expect(
      screen.getByText('GET /api/v1/owner/conditional-surveys?status=pending'),
    ).toBeInTheDocument();
  });

  it('issues NO network call (the route does not exist)', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    render(<SurveyApprovalsQueue />);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('renders NO fabricated approve/reject action buttons', () => {
    render(<SurveyApprovalsQueue />);
    expect(screen.queryByRole('button', { name: /approve/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /reject/i })).toBeNull();
  });
});
