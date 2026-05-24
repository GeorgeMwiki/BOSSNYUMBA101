/**
 * OrgJoinForm — submit redirects on success, shows friendly error on
 * known error codes.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// vi.mock factories are hoisted above ALL imports — declare the mocks
// inside the factory and grab a typed handle afterwards.
vi.mock('next/navigation', () => {
  return {
    useRouter: () => ({ push: (globalThis as any).__pushSpy }),
  };
});

vi.mock('@/lib/marketplace/api-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/marketplace/api-client')>(
    '@/lib/marketplace/api-client',
  );
  return {
    ...actual,
    marketplaceClient: {
      joinOrg: (...args: unknown[]) => (globalThis as any).__joinOrgMock(...args),
    } as any,
  };
});

import { OrgJoinForm } from './OrgJoinForm';

const pushSpy = vi.fn();
const joinOrgMock = vi.fn();
(globalThis as any).__pushSpy = pushSpy;
(globalThis as any).__joinOrgMock = joinOrgMock;

beforeEach(() => {
  joinOrgMock.mockReset();
  pushSpy.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('OrgJoinForm', () => {
  it('submits the typed code', async () => {
    joinOrgMock.mockResolvedValue({
      orgId: 'org_asha',
      orgName: 'Asha Properties',
      role: 'tenant',
      userOrgId: 'uorg_x',
      joinedAt: '2026-01-01T00:00:00.000Z',
    });
    render(<OrgJoinForm />);
    fireEvent.change(screen.getByPlaceholderText(/ASHA-WELCOME/), {
      target: { value: 'asha-welcome' },
    });
    fireEvent.click(screen.getByRole('button', { name: /join/i }));
    await waitFor(() => {
      expect(joinOrgMock).toHaveBeenCalledWith('asha-welcome');
    });
    await waitFor(() => {
      expect(screen.getByText(/Joined Asha Properties/)).toBeInTheDocument();
    });
  });

  it('shows a friendly error when the code is unknown', async () => {
    const err = new Error('not found') as Error & { code: string };
    err.code = 'CODE_NOT_FOUND';
    joinOrgMock.mockRejectedValue(err);
    render(<OrgJoinForm />);
    fireEvent.change(screen.getByPlaceholderText(/ASHA-WELCOME/), {
      target: { value: 'WRONG' },
    });
    fireEvent.click(screen.getByRole('button', { name: /join/i }));
    await waitFor(() => {
      expect(
        screen.getByText(/could not find an organisation/i),
      ).toBeInTheDocument();
    });
    expect(pushSpy).not.toHaveBeenCalled();
  });

  it('disables submit when the code is too short', () => {
    render(<OrgJoinForm />);
    const submit = screen.getByRole('button', { name: /join/i });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText(/ASHA-WELCOME/), {
      target: { value: 'X' },
    });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText(/ASHA-WELCOME/), {
      target: { value: 'XY' },
    });
    expect(submit).not.toBeDisabled();
  });
});
