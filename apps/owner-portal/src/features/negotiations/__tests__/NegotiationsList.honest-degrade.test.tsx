/**
 * Final-sweep honest-degrade detector for NegotiationsList.
 *
 * NegotiationsList was wired to `/owner/negotiations*` routes that are NOT
 * mounted in the api-gateway (the real negotiation router is turn-based at
 * `/api/v1/negotiations` with no owner list and no `override` action).
 * Until that owner aggregation surface lands, the component MUST:
 *   1. render the MissingBackendNotice (surfacing the concrete endpoint),
 *   2. NEVER issue a network call to a dead route, and
 *   3. NEVER render fabricated accept/override/reject action buttons.
 *
 * If any of these regress, born-dark UI has leaked back in.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

// next-intl passthrough: translator returns the key so assertions are stable.
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

import { NegotiationsList } from '../NegotiationsList';

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('NegotiationsList — honest degrade (no dead routes)', () => {
  it('renders the missing-backend notice with the concrete endpoint', () => {
    render(<NegotiationsList />);
    expect(
      screen.getByText('GET /api/v1/owner/negotiations'),
    ).toBeInTheDocument();
  });

  it('issues NO network call (the route does not exist)', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    render(<NegotiationsList />);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('renders NO fabricated accept/override/reject action buttons', () => {
    render(<NegotiationsList />);
    expect(screen.queryByRole('button', { name: /accept/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /override/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /reject/i })).toBeNull();
  });
});
