/**
 * Storybook deck — every real-estate seed section in three states:
 *   - Empty (no signal; section is hidden from a real DynamicTabBar)
 *   - Loading (skeleton fallback)
 *   - Populated (the shell component rendered)
 *
 * Each section gets a story rather than a parameterised one so the
 * design QA pass can flip through them quickly + reviewers can link
 * to a specific section's story in PR comments.
 */

import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  ActiveLeasesSection,
  RentDueSoonSection,
  MaintenanceOpenSection,
  LeaseRenewalWindowSection,
  KraVatFilingSection,
  TraVatFilingSection,
  VacancyListingsSection,
  AccountantMonthEndSection,
  InternalStaffSection,
} from '../seed/section-components.js';
import { sectionSignalKeys } from '../seed/seed-sections.js';
import { SectionSkeleton } from '../components/SectionSkeleton.js';

type Story = StoryObj;

const meta: Meta = {
  title: 'DynamicSections/Real-Estate Seed Sections',
  tags: ['autodocs'],
};
export default meta;

const baseProps = {
  tenantId: 'demo-tenant-tz-01',
  orgId: 'demo-org-cbd',
  scope: 'owner-customer' as const,
};

/* ---------------- Active Leases ---------------- */

export const ActiveLeasesEmpty: Story = {
  name: 'Active Leases · Empty (no signal)',
  render: () => (
    <div className="rounded-lg border border-slate-200 p-6 text-sm text-slate-500">
      Hidden when the tenant has zero active leases. The section appears
      the moment the first lease activates.
    </div>
  ),
};

export const ActiveLeasesLoading: Story = {
  name: 'Active Leases · Loading',
  render: () => <SectionSkeleton sectionLabel="Active Leases" />,
};

export const ActiveLeasesPopulated: Story = {
  name: 'Active Leases · Populated',
  render: () => (
    <ActiveLeasesSection
      {...baseProps}
      entityType={sectionSignalKeys.activeLeases}
    />
  ),
};

/* ---------------- Rent Due Soon ---------------- */

export const RentDueSoonEmpty: Story = {
  name: 'Rent Due Soon · Empty',
  render: () => (
    <div className="rounded-lg border border-slate-200 p-6 text-sm text-slate-500">
      Hidden when no invoice is due in the next 7 days.
    </div>
  ),
};

export const RentDueSoonLoading: Story = {
  name: 'Rent Due Soon · Loading',
  render: () => <SectionSkeleton sectionLabel="Rent Due Soon" />,
};

export const RentDueSoonPopulated: Story = {
  name: 'Rent Due Soon · Populated',
  render: () => (
    <RentDueSoonSection
      {...baseProps}
      entityType={sectionSignalKeys.rentDueSoon}
    />
  ),
};

/* ---------------- Maintenance Open ---------------- */

export const MaintenanceOpenEmpty: Story = {
  name: 'Maintenance · Empty',
  render: () => (
    <div className="rounded-lg border border-slate-200 p-6 text-sm text-slate-500">
      Hidden when every maintenance ticket is closed.
    </div>
  ),
};

export const MaintenanceOpenLoading: Story = {
  name: 'Maintenance · Loading',
  render: () => <SectionSkeleton sectionLabel="Open Maintenance" />,
};

export const MaintenanceOpenPopulated: Story = {
  name: 'Maintenance · Populated',
  render: () => (
    <MaintenanceOpenSection
      {...baseProps}
      entityType={sectionSignalKeys.maintenanceOpen}
    />
  ),
};

/* ---------------- Lease Renewal Window ---------------- */

export const LeaseRenewalWindowEmpty: Story = {
  name: 'Renewals · Empty',
  render: () => (
    <div className="rounded-lg border border-slate-200 p-6 text-sm text-slate-500">
      Hidden when no lease is within 90 days of expiry.
    </div>
  ),
};

export const LeaseRenewalWindowLoading: Story = {
  name: 'Renewals · Loading',
  render: () => <SectionSkeleton sectionLabel="Renewals" />,
};

export const LeaseRenewalWindowPopulated: Story = {
  name: 'Renewals · Populated',
  render: () => (
    <LeaseRenewalWindowSection
      {...baseProps}
      entityType={sectionSignalKeys.leaseRenewalWindow}
    />
  ),
};

/* ---------------- KRA VAT Filing ---------------- */

export const KraVatFilingEmpty: Story = {
  name: 'KRA VAT · Outside filing window',
  render: () => (
    <div className="rounded-lg border border-slate-200 p-6 text-sm text-slate-500">
      Hidden outside the KRA VAT filing window (typically the 10th to
      20th of the month, KE-jurisdiction tenants only).
    </div>
  ),
};

export const KraVatFilingLoading: Story = {
  name: 'KRA VAT · Loading',
  render: () => <SectionSkeleton sectionLabel="KRA VAT Filing" />,
};

export const KraVatFilingPopulated: Story = {
  name: 'KRA VAT · Window open',
  render: () => (
    <KraVatFilingSection
      {...baseProps}
      entityType={sectionSignalKeys.kraVatFilingWindow}
    />
  ),
};

/* ---------------- TRA VAT Filing ---------------- */

export const TraVatFilingEmpty: Story = {
  name: 'TRA VAT · Outside filing window',
  render: () => (
    <div className="rounded-lg border border-slate-200 p-6 text-sm text-slate-500">
      Hidden outside the TRA VAT filing window (TZ-jurisdiction tenants
      only).
    </div>
  ),
};

export const TraVatFilingLoading: Story = {
  name: 'TRA VAT · Loading',
  render: () => <SectionSkeleton sectionLabel="TRA VAT Filing" />,
};

export const TraVatFilingPopulated: Story = {
  name: 'TRA VAT · Window open',
  render: () => (
    <TraVatFilingSection
      {...baseProps}
      entityType={sectionSignalKeys.traVatFilingWindow}
    />
  ),
};

/* ---------------- Vacancy Listings ---------------- */

export const VacancyListingsEmpty: Story = {
  name: 'Vacancies · Empty',
  render: () => (
    <div className="rounded-lg border border-slate-200 p-6 text-sm text-slate-500">
      Hidden when every unit is occupied.
    </div>
  ),
};

export const VacancyListingsLoading: Story = {
  name: 'Vacancies · Loading',
  render: () => <SectionSkeleton sectionLabel="Vacancies" />,
};

export const VacancyListingsPopulated: Story = {
  name: 'Vacancies · Populated',
  render: () => (
    <VacancyListingsSection
      {...baseProps}
      entityType={sectionSignalKeys.vacancyListings}
    />
  ),
};

/* ---------------- Month-End Close ---------------- */

export const AccountantMonthEndEmpty: Story = {
  name: 'Month-End · Outside window',
  render: () => (
    <div className="rounded-lg border border-slate-200 p-6 text-sm text-slate-500">
      Hidden until the last 5 calendar days of the month.
    </div>
  ),
};

export const AccountantMonthEndLoading: Story = {
  name: 'Month-End · Loading',
  render: () => <SectionSkeleton sectionLabel="Month-End Close" />,
};

export const AccountantMonthEndPopulated: Story = {
  name: 'Month-End · Window open',
  render: () => (
    <AccountantMonthEndSection
      {...baseProps}
      entityType={sectionSignalKeys.accountantMonthEnd}
    />
  ),
};

/* ---------------- Internal Staff ---------------- */

export const InternalStaffEmpty: Story = {
  name: 'Internal Staff · Empty (admin-only)',
  render: () => (
    <div className="rounded-lg border border-slate-200 p-6 text-sm text-slate-500">
      Restricted to the internal-admin scope AND requires the
      `platform_ops` or `platform_admin` role. Hidden by default.
    </div>
  ),
};

export const InternalStaffLoading: Story = {
  name: 'Internal Staff · Loading',
  render: () => <SectionSkeleton sectionLabel="Internal Staff" />,
};

export const InternalStaffPopulated: Story = {
  name: 'Internal Staff · Populated',
  render: () => (
    <InternalStaffSection
      tenantId="platform-ops-tenant"
      scope="internal-admin"
      entityType={sectionSignalKeys.internalStaff}
    />
  ),
};
