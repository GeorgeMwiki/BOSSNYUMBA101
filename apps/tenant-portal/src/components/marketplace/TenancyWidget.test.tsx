/**
 * TenancyWidget — renders org membership + optional rent/maintenance
 * data. Confirms the "—" placeholders show when optional fields are
 * omitted (multi-org tenancy data may arrive piece-by-piece).
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TenancyWidget } from './TenancyWidget';

describe('TenancyWidget', () => {
  it('renders the org name + role + lease count', () => {
    render(
      <TenancyWidget
        membership={{
          orgId: 'org_a',
          orgName: 'Asha Properties',
          role: 'tenant',
          joinedAt: '2026-01-01T00:00:00.000Z',
          activeLeaseCount: 2,
        }}
      />,
    );
    expect(screen.getByText('Asha Properties')).toBeInTheDocument();
    expect(screen.getByText(/tenant/)).toBeInTheDocument();
    expect(screen.getByText(/2 active leases/)).toBeInTheDocument();
  });

  it('shows em-dash placeholders when optional data is missing', () => {
    render(
      <TenancyWidget
        membership={{
          orgId: 'org_a',
          orgName: 'Asha',
          role: 'tenant',
          joinedAt: '2026-01-01T00:00:00.000Z',
          activeLeaseCount: 1,
        }}
      />,
    );
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(4);
  });

  it('shows rent due and renewal status when supplied', () => {
    render(
      <TenancyWidget
        membership={{
          orgId: 'org_a',
          orgName: 'Asha',
          role: 'tenant',
          joinedAt: '2026-01-01T00:00:00.000Z',
          activeLeaseCount: 1,
        }}
        rentDue={{ amount: 45000, currency: 'KES', dueAt: '2026-02-01T00:00:00.000Z' }}
        maintenanceOpen={2}
        renewalStatus="pending_renewal"
      />,
    );
    expect(screen.getByText(/KES 45,000/)).toBeInTheDocument();
    expect(screen.getByText('2 open')).toBeInTheDocument();
    expect(screen.getByText('pending_renewal')).toBeInTheDocument();
  });
});
