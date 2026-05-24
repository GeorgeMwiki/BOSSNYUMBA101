import type { OrgMembership } from '@/lib/marketplace/types';

/**
 * Per-org tenancy summary card.
 *
 * Renders a compact widget per org membership: role, joined date,
 * active lease count, and (when data is available) rent-due /
 * maintenance-open / lease-end pointers.
 *
 * The right-hand-rail data (`rentDue`, `maintenanceOpen`,
 * `leaseEndDate`, `renewalStatus`) is optional — the multi-org tenancy
 * router only ships the join shape today; downstream services attach
 * the rest when they're wired.
 */
export interface TenancyWidgetProps {
  readonly membership: OrgMembership;
  readonly rentDue?: { readonly amount: number; readonly currency: string; readonly dueAt: string };
  readonly maintenanceOpen?: number;
  readonly leaseEndDate?: string;
  readonly renewalStatus?: 'auto_renew' | 'pending_renewal' | 'expiring' | 'expired';
}

export function TenancyWidget({
  membership,
  rentDue,
  maintenanceOpen,
  leaseEndDate,
  renewalStatus,
}: TenancyWidgetProps): JSX.Element {
  return (
    <article className="flex flex-col gap-3 rounded-chat border border-ink-muted/10 bg-surface p-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-ink">{membership.orgName}</h3>
          <p className="text-xs text-ink-muted">
            {membership.role} · joined{' '}
            {new Date(membership.joinedAt).toLocaleDateString()}
          </p>
        </div>
        <span className="rounded-chip bg-brand-light px-2 py-0.5 text-xs font-medium text-brand-dark">
          {membership.activeLeaseCount} active lease
          {membership.activeLeaseCount === 1 ? '' : 's'}
        </span>
      </header>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-ink-muted">Rent due</dt>
          <dd className="font-medium text-ink">
            {rentDue
              ? `${rentDue.currency} ${rentDue.amount.toLocaleString()} · ${new Date(rentDue.dueAt).toLocaleDateString()}`
              : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-ink-muted">Maintenance</dt>
          <dd className="font-medium text-ink">
            {maintenanceOpen !== undefined
              ? `${maintenanceOpen} open`
              : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-ink-muted">Lease ends</dt>
          <dd className="font-medium text-ink">
            {leaseEndDate ? new Date(leaseEndDate).toLocaleDateString() : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-ink-muted">Renewal</dt>
          <dd className="font-medium text-ink">{renewalStatus ?? '—'}</dd>
        </div>
      </dl>
    </article>
  );
}
