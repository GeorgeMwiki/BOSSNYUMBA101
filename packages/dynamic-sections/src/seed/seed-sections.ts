/**
 * Seed sections — BossNyumba real-estate adaptive layout.
 *
 * The dynamic-sections engine drives the OWNER PORTAL home shell and the
 * ADMIN PLATFORM PORTAL home shell so cards / tabs only render when the
 * underlying real-estate signal is meaningful. A landlord with zero
 * active leases never sees a "Rent due soon" card; the moment a lease
 * is signed the section materialises.
 *
 * Eight real-estate sections cover the Mr. Mwikila persona's day-to-day
 * surfaces:
 *   - active-leases            : visible when the tenant has >=1 active lease
 *   - rent-due-soon            : visible when >=1 invoice is due within 7 days
 *   - maintenance-open         : visible when >=1 maintenance ticket is open
 *   - lease-renewal-window     : visible when >=1 lease expires within 90 days
 *   - kra-vat-filing           : visible during the KE VAT filing window
 *   - tra-vat-filing           : visible during the TZ VAT filing window
 *   - vacancy-listings         : visible when >=1 unit is vacant
 *   - accountant-month-end     : visible during the last 5 days of the month
 *
 * Plus one platform-staff section for the admin-platform-portal:
 *   - internal-staff           : visible only to platform_ops/platform_admin
 *
 * Visibility rules:
 *   - All customer sections gate behind `has-entities` of a real-estate
 *     SIGNAL key. The host-app loader translates calendar windows and
 *     query results into the boolean signals consumed here, so the
 *     predicate sum-type stays simple + serialisable.
 *   - Platform-ops operators see the customer sections regardless (for
 *     triage), via the `customerSectionPredicate` OR.
 *
 * The signal keys (e.g. `active_leases_count`, `rent_due_soon_count`)
 * are CONTRACT — the loader implementation in the owner-portal
 * (`apps/owner-portal/src/lib/section-context-loader.ts`) and the
 * admin-platform-portal (`apps/admin-platform-portal/src/lib/section-
 * context-loader.ts`) must populate exactly these keys.
 */

import type { Section } from '../contracts/section.js';
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
} from './section-components.js';

/**
 * Build a predicate that is true when EITHER the tenant has signals of
 * the given key OR the viewer is a platform support operator. Captures
 * the "internal admins can navigate to empty cards for triage" rule
 * once instead of duplicating the OR in every section.
 */
function customerSectionPredicate(signalKey: string) {
  return {
    kind: 'or' as const,
    preds: [
      { kind: 'has-entities' as const, entity_type: signalKey },
      { kind: 'role-allowed' as const, roles: ['platform_ops'] },
    ],
  };
}

/**
 * Signal keys — exported for the loader implementations so the
 * contract is type-checked at the producer side rather than only at
 * the consumer side. Adding a new section means adding a key here AND
 * populating it in every loader.
 */
export const sectionSignalKeys = {
  activeLeases: 'active_leases_count',
  rentDueSoon: 'rent_due_soon_count',
  maintenanceOpen: 'maintenance_open_count',
  leaseRenewalWindow: 'lease_renewal_window_count',
  kraVatFilingWindow: 'kra_vat_filing_window_open',
  traVatFilingWindow: 'tra_vat_filing_window_open',
  vacancyListings: 'vacancy_listings_count',
  accountantMonthEnd: 'accountant_month_end_window_open',
  internalStaff: 'internal_staff_count',
} as const;

export type SectionSignalKey =
  (typeof sectionSignalKeys)[keyof typeof sectionSignalKeys];

export const seedSections: readonly Section[] = [
  {
    key: 'active-leases',
    label: 'Active Leases',
    icon: 'file-signature',
    entity_type: sectionSignalKeys.activeLeases,
    sort_order: 10,
    visibility_predicate: customerSectionPredicate(sectionSignalKeys.activeLeases),
    component_loader: () =>
      Promise.resolve({ default: ActiveLeasesSection }),
  },
  {
    key: 'rent-due-soon',
    label: 'Rent Due Soon',
    icon: 'alarm-clock',
    entity_type: sectionSignalKeys.rentDueSoon,
    sort_order: 20,
    visibility_predicate: customerSectionPredicate(sectionSignalKeys.rentDueSoon),
    component_loader: () =>
      Promise.resolve({ default: RentDueSoonSection }),
  },
  {
    key: 'maintenance-open',
    label: 'Open Maintenance',
    icon: 'wrench',
    entity_type: sectionSignalKeys.maintenanceOpen,
    sort_order: 30,
    visibility_predicate: customerSectionPredicate(
      sectionSignalKeys.maintenanceOpen,
    ),
    component_loader: () =>
      Promise.resolve({ default: MaintenanceOpenSection }),
  },
  {
    key: 'lease-renewal-window',
    label: 'Renewals',
    icon: 'refresh-cw',
    entity_type: sectionSignalKeys.leaseRenewalWindow,
    sort_order: 40,
    visibility_predicate: customerSectionPredicate(
      sectionSignalKeys.leaseRenewalWindow,
    ),
    component_loader: () =>
      Promise.resolve({ default: LeaseRenewalWindowSection }),
  },
  {
    key: 'kra-vat-filing',
    label: 'KRA VAT Filing',
    icon: 'file-text',
    entity_type: sectionSignalKeys.kraVatFilingWindow,
    sort_order: 50,
    visibility_predicate: customerSectionPredicate(
      sectionSignalKeys.kraVatFilingWindow,
    ),
    component_loader: () =>
      Promise.resolve({ default: KraVatFilingSection }),
  },
  {
    key: 'tra-vat-filing',
    label: 'TRA VAT Filing',
    icon: 'file-text',
    entity_type: sectionSignalKeys.traVatFilingWindow,
    sort_order: 60,
    visibility_predicate: customerSectionPredicate(
      sectionSignalKeys.traVatFilingWindow,
    ),
    component_loader: () =>
      Promise.resolve({ default: TraVatFilingSection }),
  },
  {
    key: 'vacancy-listings',
    label: 'Vacancies',
    icon: 'home',
    entity_type: sectionSignalKeys.vacancyListings,
    sort_order: 70,
    visibility_predicate: customerSectionPredicate(
      sectionSignalKeys.vacancyListings,
    ),
    component_loader: () =>
      Promise.resolve({ default: VacancyListingsSection }),
  },
  {
    key: 'accountant-month-end',
    label: 'Month-End Close',
    icon: 'calendar-check',
    entity_type: sectionSignalKeys.accountantMonthEnd,
    sort_order: 80,
    visibility_predicate: customerSectionPredicate(
      sectionSignalKeys.accountantMonthEnd,
    ),
    component_loader: () =>
      Promise.resolve({ default: AccountantMonthEndSection }),
  },
  {
    key: 'internal-staff',
    label: 'Internal Staff',
    icon: 'shield',
    entity_type: sectionSignalKeys.internalStaff,
    sort_order: 90,
    scopes: ['internal-admin'],
    // Internal staff: visible only to internal-admin scope, and only
    // when the viewer holds the platform_ops or platform_admin role.
    // Belt-and-braces in case the section ever leaks into another
    // scope by configuration error.
    visibility_predicate: {
      kind: 'and',
      preds: [
        { kind: 'has-entities', entity_type: sectionSignalKeys.internalStaff },
        { kind: 'role-allowed', roles: ['platform_ops', 'platform_admin'] },
      ],
    },
    component_loader: () =>
      Promise.resolve({ default: InternalStaffSection }),
  },
];

/**
 * Sorted keys for the seed registry — exported for tests +
 * documentation. Stable order matters because portal URL slugs derive
 * from these keys.
 */
export const seedSectionKeys: readonly string[] = seedSections.map(
  (s) => s.key,
);
