/**
 * Smoke test for the operator "Org & Invites" surface (#12).
 *
 * Renders the dashboard with the real EN catalogue and mocked identity-api so
 * no network is touched. Asserts the three live sections mount, the empty
 * states render honestly (no invites yet / search-for-a-member), and the
 * generate action is wired to the api.
 */

import type { ReactElement } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import enMessages from '../../../../messages/en.json';

// PageHeader pulls notifications + router + feature flags; stub it so the
// smoke test stays focused on the identity sections.
vi.mock('@/components/layout/PageHeader', () => ({
  PageHeader: ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <header>
      <h1>{title}</h1>
      {subtitle ? <p>{subtitle}</p> : null}
    </header>
  ),
}));

// Mock the gateway client at the lib boundary — every call resolves locally.
const listInvites = vi.fn();
const generateInvite = vi.fn();
const revokeInvite = vi.fn();
const redeemInvite = vi.fn();
const listMemberships = vi.fn();
const leaveMembership = vi.fn();
const blockMembership = vi.fn();

vi.mock('@/lib/identity-api', () => ({
  listInvites: () => listInvites(),
  generateInvite: (input: unknown) => generateInvite(input),
  revokeInvite: (code: string) => revokeInvite(code),
  redeemInvite: (input: unknown) => redeemInvite(input),
  listMemberships: (id: string) => listMemberships(id),
  leaveMembership: (id: string) => leaveMembership(id),
  blockMembership: (id: string, reason: string) => blockMembership(id, reason),
}));

import OrgInvitesDashboard from '../OrgInvitesDashboard';

function renderDashboard(): ReturnType<typeof render> {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <QueryClientProvider client={qc}>
        <OrgInvitesDashboard />
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

describe('OrgInvitesDashboard (smoke)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listInvites.mockResolvedValue([]);
    listMemberships.mockResolvedValue([]);
  });

  it('renders the page header and all three section headings', async () => {
    renderDashboard();
    expect(screen.getByRole('heading', { name: 'Org & Invites' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Invite codes' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Redeem an invite' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Memberships' })).toBeInTheDocument();
    // Invites list resolves to the honest empty state.
    await waitFor(() =>
      expect(screen.getByText('No invite codes yet')).toBeInTheDocument(),
    );
  });

  it('shows the idle empty state for memberships before a lookup', () => {
    renderDashboard();
    expect(screen.getByText('Search for a member')).toBeInTheDocument();
    // No membership query runs until an identity is entered + submitted.
    expect(listMemberships).not.toHaveBeenCalled();
  });

  it('generate is wired: submitting a role calls the api', async () => {
    generateInvite.mockResolvedValue({
      code: 'ACME-AB12',
      organizationId: 'org_1',
      platformTenantId: 'tnt_1',
      issuedBy: 'usr_1',
      issuedAt: '2026-06-07T00:00:00.000Z',
      expiresAt: null,
      maxRedemptions: null,
      redemptionsUsed: 0,
      defaultRoleId: 'role_tenant',
    });
    renderDashboard();

    const roleInput = screen.getByPlaceholderText('e.g. role_tenant');
    fireEvent.change(roleInput, { target: { value: 'role_tenant' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
    });
    await waitFor(() => expect(generateInvite).toHaveBeenCalledTimes(1));
    expect(generateInvite).toHaveBeenCalledWith(
      expect.objectContaining({ defaultRoleId: 'role_tenant' }),
    );
  });

  it('membership lookup triggers a tenant-scoped fetch by identity id', async () => {
    listMemberships.mockResolvedValue([]);
    renderDashboard();
    // The memberships lookup field has a distinct placeholder from the redeem
    // form's identity field, so this targets exactly one input.
    const idInput = screen.getByPlaceholderText('e.g. tid_… (member to look up)');
    const lookupButton = screen.getByRole('button', { name: 'Look up' });
    fireEvent.change(idInput, { target: { value: 'tid_42' } });
    await act(async () => {
      fireEvent.click(lookupButton);
    });
    await waitFor(() => expect(listMemberships).toHaveBeenCalledWith('tid_42'));
  });
});
