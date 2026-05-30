/**
 * Seed section components — real-estate adaptive surfaces.
 *
 * Each component is a thin shell that:
 *   1. Renders an adaptive card with a copy block + a deferred GenUI
 *      mount point that the host portal swaps in (data table, kanban,
 *      timeline, etc.). The card already paints with no data so the
 *      visual regression baseline for the host portals is stable.
 *   2. Carries `data-testid` + `data-section-key` so the portal-side
 *      tests can target a section without coupling to its label copy.
 *
 * Why shells (not full implementations): the dynamic-sections package
 * ships the FRAMEWORK + the contract. The host portals (owner-portal,
 * admin-platform-portal) drop in real implementations via React Query
 * loaders and route navigation. The shells guarantee the same prop
 * shape + the same testid surface so the wiring can evolve without
 * churn.
 */

import type { ReactElement } from 'react';
import type { SectionComponentProps } from '../contracts/section.js';

interface ShellProps extends SectionComponentProps {
  readonly title: string;
  readonly description: string;
  readonly genUiPartKind: string;
  readonly sectionKey: string;
}

function SectionShell({
  title,
  description,
  genUiPartKind,
  sectionKey,
  entityType,
  tenantId,
  scope,
  localisedTitle,
  localisedDescription,
}: ShellProps): ReactElement {
  return (
    <article
      data-testid={`section-shell-${sectionKey}`}
      data-section-key={sectionKey}
      data-genui-kind={genUiPartKind}
      data-scope={scope}
      data-tenant-id={tenantId}
      data-entity-type={entityType}
      className="w-full p-4 md:p-6 space-y-3 rounded-lg border border-gray-200 bg-white"
    >
      <header className="space-y-1">
        <h2 className="text-lg md:text-xl font-semibold text-slate-900">
          {localisedTitle ?? title}
        </h2>
        <p className="text-sm text-slate-600 max-w-prose">
          {localisedDescription ?? description}
        </p>
      </header>
      <div
        data-testid={`section-shell-${sectionKey}-genui-frame`}
        className="rounded-md border border-slate-200 bg-slate-50 p-4 text-xs font-mono text-slate-500"
      >
        {`<${genUiPartKind} tenantId="${tenantId}" entityType="${entityType}" scope="${scope}" />`}
      </div>
    </article>
  );
}

export function ActiveLeasesSection(
  props: SectionComponentProps,
): ReactElement {
  return (
    <SectionShell
      {...props}
      sectionKey="active-leases"
      title="Active Leases"
      description="Currently in-effect tenancy agreements across your portfolio."
      genUiPartKind="lease-table"
    />
  );
}

export function RentDueSoonSection(
  props: SectionComponentProps,
): ReactElement {
  return (
    <SectionShell
      {...props}
      sectionKey="rent-due-soon"
      title="Rent Due Soon"
      description="Invoices falling due in the next 7 days — chase before they become arrears."
      genUiPartKind="invoice-stream"
    />
  );
}

export function MaintenanceOpenSection(
  props: SectionComponentProps,
): ReactElement {
  return (
    <SectionShell
      {...props}
      sectionKey="maintenance-open"
      title="Open Maintenance"
      description="Active maintenance tickets — what your estate manager is closing this week."
      genUiPartKind="ticket-kanban"
    />
  );
}

export function LeaseRenewalWindowSection(
  props: SectionComponentProps,
): ReactElement {
  return (
    <SectionShell
      {...props}
      sectionKey="lease-renewal-window"
      title="Renewals (next 90 days)"
      description="Leases expiring within 90 days — start renegotiation now to avoid vacancy."
      genUiPartKind="renewal-timeline"
    />
  );
}

export function KraVatFilingSection(
  props: SectionComponentProps,
): ReactElement {
  return (
    <SectionShell
      {...props}
      sectionKey="kra-vat-filing"
      title="KRA VAT Filing"
      description="Kenya Revenue Authority VAT return — submit before the 20th of the month."
      genUiPartKind="filing-checklist"
    />
  );
}

export function TraVatFilingSection(
  props: SectionComponentProps,
): ReactElement {
  return (
    <SectionShell
      {...props}
      sectionKey="tra-vat-filing"
      title="TRA VAT Filing"
      description="Tanzania Revenue Authority VAT return — submit before the 20th of the month."
      genUiPartKind="filing-checklist"
    />
  );
}

export function VacancyListingsSection(
  props: SectionComponentProps,
): ReactElement {
  return (
    <SectionShell
      {...props}
      sectionKey="vacancy-listings"
      title="Vacancy Listings"
      description="Vacant units across your portfolio — list, market, fill."
      genUiPartKind="vacancy-grid"
    />
  );
}

export function AccountantMonthEndSection(
  props: SectionComponentProps,
): ReactElement {
  return (
    <SectionShell
      {...props}
      sectionKey="accountant-month-end"
      title="Month-End Close"
      description="Reconciliation, statements, and accruals due before month-end cutoff."
      genUiPartKind="close-checklist"
    />
  );
}

export function InternalStaffSection(
  props: SectionComponentProps,
): ReactElement {
  return (
    <SectionShell
      {...props}
      sectionKey="internal-staff"
      title="Internal Staff"
      description="Platform-side operators — visible only to the internal-admin scope."
      genUiPartKind="staff-table"
    />
  );
}
