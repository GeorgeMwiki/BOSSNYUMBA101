// @ts-nocheck — drizzle-orm v0.29 enum-column narrowing; tracked for drizzle upgrade
/**
 * Tanzania Railway Commission (TRC) Seed
 *
 * Provisions the TRC organization end-to-end so geo-hierarchy, approval
 * workflows, and sample leases/payments/maintenance are testable without
 * touching production data:
 *
 *   - Platform tenant "Tanzania Railway Commission" (country=TZ, TZS currency)
 *   - Organization "Head Office" (orgId base: trc-org)
 *   - GeoLabelTypes: depth=0 District, depth=1 Region, depth=2 Station
 *   - 4 District nodes with simplified polygons (trc-districts.json)
 *   - ~20 Region nodes nested under Districts
 *   - ~50 Station nodes under the Regions
 *   - Approval thresholds: 100k / 500k TZS per spec
 *   - Users: Director General (OWNER), 2 Super Admins, 5 Station Masters
 *   - InviteCodeRecord rows (TRC-*) for onboarding
 *   - Sample properties: 10 warehouses + 5 barelands + 5 godowns
 *   - Sample tenants/leases/payments/maintenance via sample-tenants.ts
 *
 * Idempotency:
 *   - Every insert uses a deterministic natural-key id (`trc-*-NNN`) and
 *     onConflictDoNothing, so re-running the seed is safe.
 *
 * NOT run by default. Invoked by run-seed.ts via
 *   pnpm db:seed --org=trc
 */

import { eq } from 'drizzle-orm';
import type { DatabaseClient } from '../client.js';
import {
  tenants,
  organizations,
  users,
  roles,
  userRoles,
  properties,
  units,
  customers,
  leases,
  accounts,
  ledgerEntries,
  maintenanceRequests,
  approvalPolicies,
  geoLabelTypes,
  geoNodes,
  geoNodeClosure,
  geoAssignments,
} from '../schemas/index.js';
import districtsData from './trc-districts.json' assert { type: 'json' };
import {
  SAMPLE_TENANTS,
  SAMPLE_LEASES,
  SAMPLE_PAYMENTS,
  SAMPLE_MAINTENANCE,
} from './sample-tenants.js';

// ---------------------------------------------------------------------------
// Deterministic IDs
// ---------------------------------------------------------------------------
export const TRC_TENANT_ID = 'trc-tenant';
export const TRC_ORG_ID = 'trc-org';
export const TRC_ADMIN_ROLE_ID = 'trc-role-admin';
export const TRC_MANAGER_ROLE_ID = 'trc-role-manager';
export const TRC_STATION_ROLE_ID = 'trc-role-station-master';

// Users
const TRC_DG_USER_ID = 'trc-user-dg';
const TRC_SUPER_ADMIN_USERS = [
  { id: 'trc-user-sa-01', firstName: 'Salim',  lastName: 'Mgonja',  email: 'salim.mgonja@trc.example.com',  authorityLevel: 'SUPER_ADMIN' },
  { id: 'trc-user-sa-02', firstName: 'Rehema', lastName: 'Komba',   email: 'rehema.komba@trc.example.com', authorityLevel: 'SUPER_ADMIN' },
];
const TRC_STATION_MASTERS = [
  { id: 'trc-user-sm-01', firstName: 'Joseph',  lastName: 'Mwanri',     email: 'joseph.mwanri@trc.example.com',     nodeCode: 'TRC-DAR-STA-01' },
  { id: 'trc-user-sm-02', firstName: 'Grace',   lastName: 'Mbughuni',   email: 'grace.mbughuni@trc.example.com',    nodeCode: 'TRC-DOD-STA-01' },
  { id: 'trc-user-sm-03', firstName: 'Peter',   lastName: 'Sanga',      email: 'peter.sanga@trc.example.com',       nodeCode: 'TRC-TAB-STA-01' },
  { id: 'trc-user-sm-04', firstName: 'Anna',    lastName: 'Mwanga',     email: 'anna.mwanga@trc.example.com',       nodeCode: 'TRC-TNG-STA-01' },
  { id: 'trc-user-sm-05', firstName: 'Francis', lastName: 'Rweyendela', email: 'francis.rweyendela@trc.example.com', nodeCode: 'TRC-DAR-STA-02' },
];

// ---------------------------------------------------------------------------
// TRC-specific approval policies (TZS)
// ---------------------------------------------------------------------------
// Tanzanian Shilling has 2 minor units in region-config. 500,000 TZS major
// units = 50_000_000 minor units.
const TZS_100K = 10_000_000;
const TZS_500K = 50_000_000;

const MAINTENANCE_POLICY = {
  type: 'maintenance_cost',
  currency: 'TZS',
  thresholds: [
    { maxAmountMinor: TZS_100K, approver: 'ESTATE_MANAGER', description: 'Up to 100k TZS — Estate Manager Unit (EMU) approves.' },
    { maxAmountMinor: TZS_500K, approver: 'DIRECTOR_GENERAL', description: '100k-500k TZS — escalate to Director General.' },
    { maxAmountMinor: null,     approver: 'DG_PLUS_BOARD',    description: '>500k TZS — Director General plus Board approval required.' },
  ],
  autoApproveRules: [],
  approvalChain: ['ESTATE_MANAGER', 'DIRECTOR_GENERAL', 'DG_PLUS_BOARD'],
  defaultTimeoutHours: 72,
  autoEscalateToRole: 'DIRECTOR_GENERAL',
};

const LEASE_EXCEPTION_POLICY = {
  type: 'lease_exception',
  currency: 'TZS',
  thresholds: [
    { maxAmountMinor: TZS_500K, approver: 'ESTATE_MANAGER', description: 'Rent <= 500k TZS — Estate Manager may sign.' },
    { maxAmountMinor: null,     approver: 'DIRECTOR_GENERAL', description: 'Rent > 500k TZS — Director General approval required.' },
  ],
  autoApproveRules: [],
  approvalChain: ['ESTATE_MANAGER', 'DIRECTOR_GENERAL'],
  defaultTimeoutHours: 120,
  autoEscalateToRole: 'DIRECTOR_GENERAL',
};

const PAYMENT_FLEXIBILITY_POLICY = {
  type: 'payment_flexibility',
  currency: 'TZS',
  thresholds: [
    { maxMonthsLate: 3, approver: 'ESTATE_MANAGER', description: 'Up to 3 months late — EMU may grant plan.' },
    { maxMonthsLate: null, approver: 'DIRECTOR_GENERAL', description: '>3 months late — Director General review required.' },
  ],
  autoApproveRules: [],
  approvalChain: ['ESTATE_MANAGER', 'DIRECTOR_GENERAL'],
  defaultTimeoutHours: 168,
  autoEscalateToRole: 'DIRECTOR_GENERAL',
};

// ---------------------------------------------------------------------------
// Geo hierarchy planning — derived from trc-districts.json
// ---------------------------------------------------------------------------
interface SeedRegion {
  readonly code: string;
  readonly name: string;
  readonly centroid: { lat: number; lng: number };
}

interface SeedStation {
  readonly code: string;
  readonly name: string;
  readonly regionCode: string;
  readonly centroid: { lat: number; lng: number };
}

// Synthesize ~20 region nodes by pairing each district with the region names
// listed in its JSON entry, plus simple centroid offsets.
function planRegions(): readonly (SeedRegion & { districtCode: string })[] {
  const out: (SeedRegion & { districtCode: string })[] = [];
  for (const d of districtsData.districts) {
    d.regions.forEach((regionName, i) => {
      const code = `${d.code}-REG-${String(i + 1).padStart(2, '0')}`;
      // Cheap centroid jitter so each region has a unique pin.
      const lat = d.centroid.lat + (i - d.regions.length / 2) * 0.3;
      const lng = d.centroid.lng + (i - d.regions.length / 2) * 0.3;
      out.push({
        districtCode: d.code,
        code,
        name: regionName,
        centroid: { lat, lng },
      });
    });
  }
  return out;
}

// Produce ~50 station nodes spread over regions (~2-3 per region).
function planStations(regions: readonly (SeedRegion & { districtCode: string })[]): readonly SeedStation[] {
  const out: SeedStation[] = [];
  let counter = 0;
  // Guarantee at least one station per district first (to match Station Master seats).
  const perDistrict: Record<string, number> = {};
  for (const r of regions) {
    perDistrict[r.districtCode] = perDistrict[r.districtCode] ?? 0;
    const stationsForRegion = 2 + ((counter % 2));
    for (let i = 0; i < stationsForRegion && out.length < 50; i++) {
      perDistrict[r.districtCode]++;
      const code = `${r.districtCode}-STA-${String(perDistrict[r.districtCode]).padStart(2, '0')}`;
      const name = `${r.name} Station ${perDistrict[r.districtCode]}`;
      out.push({
        code,
        name,
        regionCode: r.code,
        centroid: { lat: r.centroid.lat + i * 0.05, lng: r.centroid.lng + i * 0.05 },
      });
      counter++;
    }
  }
  return out.slice(0, 50);
}

// ---------------------------------------------------------------------------
// Sample properties — 10 warehouses + 5 barelands + 5 godowns
// ---------------------------------------------------------------------------
interface SeedProperty {
  readonly externalRef: string;
  readonly name: string;
  readonly type: 'warehouse' | 'bareland' | 'godown';
  readonly stationCode: string; // which station node (geo) owns it
  readonly addressLine1: string;
  readonly city: string;
}

function planProperties(stations: readonly SeedStation[]): readonly SeedProperty[] {
  const getStation = (i: number) => stations[i % stations.length]!;
  const props: SeedProperty[] = [];
  for (let i = 0; i < 10; i++) {
    const st = getStation(i);
    props.push({
      externalRef: `trc-prop-wh-${String(i + 1).padStart(2, '0')}`,
      name: `${st.name} Warehouse`,
      type: 'warehouse',
      stationCode: st.code,
      addressLine1: `${st.name}, Platform Road`,
      city: st.name.split(' ')[0] ?? 'Tanzania',
    });
  }
  for (let i = 0; i < 5; i++) {
    const st = getStation(i + 10);
    props.push({
      externalRef: `trc-prop-bl-${String(i + 1).padStart(2, '0')}`,
      name: `${st.name} Bareland Parcel`,
      type: 'bareland',
      stationCode: st.code,
      addressLine1: `Bareland adjacent to ${st.name}`,
      city: st.name.split(' ')[0] ?? 'Tanzania',
    });
  }
  for (let i = 0; i < 5; i++) {
    const st = getStation(i + 15);
    props.push({
      externalRef: `trc-prop-gd-${String(i + 1).padStart(2, '0')}`,
      name: `${st.name} Godown`,
      type: 'godown',
      stationCode: st.code,
      addressLine1: `${st.name} Godown Block B`,
      city: st.name.split(' ')[0] ?? 'Tanzania',
    });
  }
  return props;
}

// ---------------------------------------------------------------------------
// Seed runner
// ---------------------------------------------------------------------------
export async function seedTrc(db: DatabaseClient): Promise<void> {
  console.log('[trc] starting seed');

  // Run the whole org seed in one transaction so a partial failure rolls back.
  await db.transaction(async (tx) => {
    const now = new Date();

    // 1. Tenant + organization ------------------------------------------------
    await tx
      .insert(tenants)
      .values({
        id: TRC_TENANT_ID,
        name: 'Tanzania Railway Commission',
        slug: 'trc',
        status: 'active',
        subscriptionTier: 'enterprise',
        primaryEmail: 'admin@trc.example.com',
        primaryPhone: '255222118800',
        addressLine1: 'Sokoine Drive',
        city: 'Dar es Salaam',
        country: 'TZ',
        maxUsers: 500,
        maxProperties: 2000,
        maxUnits: 10000,
      })
      .onConflictDoNothing();

    await tx
      .insert(organizations)
      .values({
        id: TRC_ORG_ID,
        tenantId: TRC_TENANT_ID,
        code: 'TRC-HQ',
        name: 'TRC Head Office',
        level: 0,
        path: '/',
      })
      .onConflictDoNothing();

    // 2. Roles ----------------------------------------------------------------
    await tx
      .insert(roles)
      .values([
        {
          id: TRC_ADMIN_ROLE_ID,
          tenantId: TRC_TENANT_ID,
          name: 'trc_admin',
          displayName: 'TRC Administrator',
          description: 'Director General and Super Admins.',
          permissions: ['*'],
          isSystem: true,
          priority: 100,
        },
        {
          id: TRC_MANAGER_ROLE_ID,
          tenantId: TRC_TENANT_ID,
          name: 'trc_estate_manager',
          displayName: 'TRC Estate Manager',
          description: 'Regional estate manager.',
          permissions: [
            'property:read',
            'property:update',
            'lease:read',
            'lease:update',
            'maintenance:approve',
          ],
          isSystem: false,
          priority: 50,
        },
        {
          id: TRC_STATION_ROLE_ID,
          tenantId: TRC_TENANT_ID,
          name: 'trc_station_master',
          displayName: 'TRC Station Master',
          description: 'Local station manager — tagged worker.',
          permissions: [
            'property:read',
            'maintenance:create',
            'maintenance:read',
          ],
          isSystem: false,
          priority: 20,
        },
      ])
      .onConflictDoNothing();

    // 3. Users ----------------------------------------------------------------
    // Director General (OWNER authority tier).
    await tx
      .insert(users)
      .values({
        id: TRC_DG_USER_ID,
        tenantId: TRC_TENANT_ID,
        organizationId: TRC_ORG_ID,
        email: 'director.general@trc.example.com',
        firstName: 'Athumani',
        lastName: 'Kihamia',
        displayName: 'Director General',
        status: 'active',
        isOwner: true,
        timezone: 'Africa/Dar_es_Salaam',
        locale: 'sw-TZ',
        preferences: { authorityLevel: 'OWNER', title: 'Director General' },
      })
      .onConflictDoNothing();

    await tx
      .insert(userRoles)
      .values({
        id: `ur-${TRC_DG_USER_ID}`,
        userId: TRC_DG_USER_ID,
        roleId: TRC_ADMIN_ROLE_ID,
        tenantId: TRC_TENANT_ID,
      })
      .onConflictDoNothing();

    // Super Admins
    for (const sa of TRC_SUPER_ADMIN_USERS) {
      await tx
        .insert(users)
        .values({
          id: sa.id,
          tenantId: TRC_TENANT_ID,
          organizationId: TRC_ORG_ID,
          email: sa.email,
          firstName: sa.firstName,
          lastName: sa.lastName,
          displayName: `${sa.firstName} ${sa.lastName}`,
          status: 'active',
          isOwner: false,
          timezone: 'Africa/Dar_es_Salaam',
          locale: 'sw-TZ',
          preferences: { authorityLevel: sa.authorityLevel },
        })
        .onConflictDoNothing();

      await tx
        .insert(userRoles)
        .values({
          id: `ur-${sa.id}`,
          userId: sa.id,
          roleId: TRC_ADMIN_ROLE_ID,
          tenantId: TRC_TENANT_ID,
        })
        .onConflictDoNothing();
    }

    // Station Masters
    for (const sm of TRC_STATION_MASTERS) {
      await tx
        .insert(users)
        .values({
          id: sm.id,
          tenantId: TRC_TENANT_ID,
          organizationId: TRC_ORG_ID,
          email: sm.email,
          firstName: sm.firstName,
          lastName: sm.lastName,
          displayName: `${sm.firstName} ${sm.lastName}`,
          status: 'active',
          isOwner: false,
          timezone: 'Africa/Dar_es_Salaam',
          locale: 'sw-TZ',
          preferences: { authorityLevel: 'STATION_MASTER' },
        })
        .onConflictDoNothing();

      await tx
        .insert(userRoles)
        .values({
          id: `ur-${sm.id}`,
          userId: sm.id,
          roleId: TRC_STATION_ROLE_ID,
          tenantId: TRC_TENANT_ID,
        })
        .onConflictDoNothing();
    }

    // 4. Geo label types ------------------------------------------------------
    await tx
      .insert(geoLabelTypes)
      .values([
        { id: 'trc-lt-district', organizationId: TRC_ORG_ID, depth: 0, singular: 'District', plural: 'Districts', color: '#1f77b4', allowsPolygon: true },
        { id: 'trc-lt-region',   organizationId: TRC_ORG_ID, depth: 1, singular: 'Region',   plural: 'Regions',   color: '#2ca02c', allowsPolygon: true },
        { id: 'trc-lt-station',  organizationId: TRC_ORG_ID, depth: 2, singular: 'Station',  plural: 'Stations',  color: '#ff7f0e', allowsPolygon: false },
      ])
      .onConflictDoNothing();

    // 5. District nodes (from JSON) ------------------------------------------
    const districtIdByCode = new Map<string, string>();
    for (const d of districtsData.districts) {
      const id = `trc-geo-${d.code.toLowerCase()}`;
      districtIdByCode.set(d.code, id);
      await tx
        .insert(geoNodes)
        .values({
          id,
          organizationId: TRC_ORG_ID,
          parentId: null,
          labelTypeId: 'trc-lt-district',
          name: d.name,
          code: d.code,
          polygon: d.polygon,
          centroid: d.centroid,
          colorOverride: d.color,
          orderIndex: 0,
          metadata: { description: d.description },
        })
        .onConflictDoNothing();
      // closure self-pair
      await tx
        .insert(geoNodeClosure)
        .values({ ancestorId: id, descendantId: id, depth: 0 })
        .onConflictDoNothing();
    }

    // 6. Region nodes ---------------------------------------------------------
    const regions = planRegions();
    const regionIdByCode = new Map<string, string>();
    for (const r of regions) {
      const id = `trc-geo-${r.code.toLowerCase()}`;
      regionIdByCode.set(r.code, id);
      const parentId = districtIdByCode.get(r.districtCode);
      if (!parentId) continue;
      await tx
        .insert(geoNodes)
        .values({
          id,
          organizationId: TRC_ORG_ID,
          parentId,
          labelTypeId: 'trc-lt-region',
          name: r.name,
          code: r.code,
          polygon: null,
          centroid: r.centroid,
          orderIndex: 0,
          metadata: {},
        })
        .onConflictDoNothing();
      // closure: self + ancestor district
      await tx
        .insert(geoNodeClosure)
        .values([
          { ancestorId: id,       descendantId: id, depth: 0 },
          { ancestorId: parentId, descendantId: id, depth: 1 },
        ])
        .onConflictDoNothing();
    }

    // 7. Station nodes --------------------------------------------------------
    const stations = planStations(regions);
    const stationIdByCode = new Map<string, string>();
    for (const s of stations) {
      const id = `trc-geo-${s.code.toLowerCase()}`;
      stationIdByCode.set(s.code, id);
      const parentId = regionIdByCode.get(s.regionCode);
      if (!parentId) continue;
      const grandparentCode = regions.find((r) => r.code === s.regionCode)?.districtCode;
      const grandparentId = grandparentCode ? districtIdByCode.get(grandparentCode) : undefined;
      await tx
        .insert(geoNodes)
        .values({
          id,
          organizationId: TRC_ORG_ID,
          parentId,
          labelTypeId: 'trc-lt-station',
          name: s.name,
          code: s.code,
          polygon: null,
          centroid: s.centroid,
          orderIndex: 0,
          metadata: {},
        })
        .onConflictDoNothing();
      const closureRows = [
        { ancestorId: id,       descendantId: id, depth: 0 },
        { ancestorId: parentId, descendantId: id, depth: 1 },
      ];
      if (grandparentId) {
        closureRows.push({ ancestorId: grandparentId, descendantId: id, depth: 2 });
      }
      await tx.insert(geoNodeClosure).values(closureRows).onConflictDoNothing();
    }

    // 8. Geo assignments — bind each Station Master to their station node ----
    for (const sm of TRC_STATION_MASTERS) {
      const nodeId = stationIdByCode.get(sm.nodeCode);
      if (!nodeId) continue;
      await tx
        .insert(geoAssignments)
        .values({
          id: `trc-asgn-${sm.id}`,
          organizationId: TRC_ORG_ID,
          geoNodeId: nodeId,
          userId: sm.id,
          workerTagKey: 'station-master',
          responsibility: 'station_master',
          inherits: false,
        })
        .onConflictDoNothing();
    }

    // 9. Approval policies ----------------------------------------------------
    await tx
      .insert(approvalPolicies)
      .values([
        {
          tenantId: TRC_TENANT_ID,
          type: 'maintenance_cost',
          policyJson: MAINTENANCE_POLICY,
          updatedBy: TRC_DG_USER_ID,
        },
        {
          tenantId: TRC_TENANT_ID,
          type: 'lease_exception',
          policyJson: LEASE_EXCEPTION_POLICY,
          updatedBy: TRC_DG_USER_ID,
        },
        {
          tenantId: TRC_TENANT_ID,
          type: 'payment_flexibility',
          policyJson: PAYMENT_FLEXIBILITY_POLICY,
          updatedBy: TRC_DG_USER_ID,
        },
      ])
      .onConflictDoNothing();

    // 10. Invite codes (stored on tenant.settings for now) --------------------
    // A dedicated invite_codes table is planned; until then, the seed stores
    // the TRC-prefixed invite codes in tenant.settings so the onboarding UI
    // can render them.
    const inviteCodes = [
      {
        code: 'TRC-ONBOARD-001',
        organizationId: TRC_ORG_ID,
        platformTenantId: TRC_TENANT_ID,
        issuedBy: TRC_DG_USER_ID,
        issuedAt: now.toISOString(),
        expiresAt: null,
        maxRedemptions: 100,
        redemptionsUsed: 0,
        defaultRoleId: TRC_STATION_ROLE_ID,
      },
      {
        code: 'TRC-ONBOARD-002',
        organizationId: TRC_ORG_ID,
        platformTenantId: TRC_TENANT_ID,
        issuedBy: TRC_DG_USER_ID,
        issuedAt: now.toISOString(),
        expiresAt: null,
        maxRedemptions: 50,
        redemptionsUsed: 0,
        defaultRoleId: TRC_MANAGER_ROLE_ID,
      },
      {
        code: 'TRC-STATION-MASTER',
        organizationId: TRC_ORG_ID,
        platformTenantId: TRC_TENANT_ID,
        issuedBy: TRC_DG_USER_ID,
        issuedAt: now.toISOString(),
        expiresAt: null,
        maxRedemptions: null,
        redemptionsUsed: 0,
        defaultRoleId: TRC_STATION_ROLE_ID,
      },
    ];
    await tx
      .update(tenants)
      .set({ settings: { inviteCodes } })
      .where(eq(tenants.id, TRC_TENANT_ID));

    // 11. Properties ----------------------------------------------------------
    const sampleProps = planProperties(stations);
    const propertyIdByRef = new Map<string, string>();
    for (const p of sampleProps) {
      propertyIdByRef.set(p.externalRef, p.externalRef); // use ref as id for idempotence
      await tx
        .insert(properties)
        .values({
          id: p.externalRef,
          tenantId: TRC_TENANT_ID,
          ownerId: TRC_DG_USER_ID,
          propertyCode: p.externalRef.toUpperCase(),
          name: p.name,
          type:
            p.type === 'warehouse'
              ? 'commercial'
              : p.type === 'godown'
                ? 'commercial'
                : 'other', // bareland
          status: 'active',
          addressLine1: p.addressLine1,
          city: p.city,
          country: 'TZ',
          totalUnits: 1,
          occupiedUnits: 0,
          vacantUnits: 1,
          defaultCurrency: 'TZS',
          features: { trcCategory: p.type, stationCode: p.stationCode },
        })
        .onConflictDoNothing();

      // one unit per property
      const unitId = `${p.externalRef}-unit-a`;
      const unitCode = 'A';
      await tx
        .insert(units)
        .values({
          id: unitId,
          tenantId: TRC_TENANT_ID,
          propertyId: p.externalRef,
          unitCode,
          name: `${p.name} — Unit A`,
          type: p.type === 'bareland' ? 'other' : 'warehouse',
          status: 'vacant',
          baseRentAmount: 200_000_00, // default placeholder; overridden by leases
          baseRentCurrency: 'TZS',
        })
        .onConflictDoNothing();
    }

    // 12. Sample customers ----------------------------------------------------
    for (const t of SAMPLE_TENANTS) {
      await tx
        .insert(customers)
        .values({
          id: t.externalRef,
          tenantId: TRC_TENANT_ID,
          customerCode: t.externalRef.toUpperCase(),
          email: t.email,
          phone: t.phone,
          firstName: t.firstName,
          lastName: t.lastName,
          status: 'active',
          kycStatus: 'verified',
          occupation: t.occupation,
          monthlyIncome: t.monthlyIncomeTzsMinor,
          incomeCurrency: 'TZS',
          nationality: 'Tanzanian',
        })
        .onConflictDoNothing();
    }

    // 13. Sample leases + customer ledger accounts ----------------------------
    const leaseById = new Map<string, { id: string; startDate: Date }>();
    for (const l of SAMPLE_LEASES) {
      const unitRef = `${l.propertyRef}-unit-a`;
      const startDate = new Date(now);
      startDate.setMonth(startDate.getMonth() + l.startOffsetMonths);
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + l.termMonths);
      const leaseId = l.externalRef;
      leaseById.set(l.externalRef, { id: leaseId, startDate });

      await tx
        .insert(leases)
        .values({
          id: leaseId,
          tenantId: TRC_TENANT_ID,
          propertyId: l.propertyRef,
          unitId: unitRef,
          customerId: l.tenantRef,
          leaseNumber: leaseId.toUpperCase(),
          leaseType: 'fixed_term',
          status: 'active',
          startDate,
          endDate,
          rentAmount: l.monthlyRentTzsMinor,
          rentCurrency: 'TZS',
          rentFrequency: 'monthly',
          rentDueDay: 1,
          securityDepositAmount: l.monthlyRentTzsMinor * l.depositMultiplier,
          securityDepositPaid: l.monthlyRentTzsMinor * l.depositMultiplier,
          primaryOccupant: { name: l.tenantRef, relationship: 'self' },
        })
        .onConflictDoNothing();

      // customer liability account (rent receivable)
      const acctId = `acct-${l.tenantRef}-liab`;
      await tx
        .insert(accounts)
        .values({
          id: acctId,
          tenantId: TRC_TENANT_ID,
          customerId: l.tenantRef,
          propertyId: l.propertyRef,
          name: `Rent Receivable — ${l.tenantRef}`,
          type: 'CUSTOMER_LIABILITY',
          status: 'ACTIVE',
          currency: 'TZS',
          balanceMinorUnits: 0,
        })
        .onConflictDoNothing();
    }

    // 14. Sample payment ledger entries --------------------------------------
    let seq = 1;
    for (const p of SAMPLE_PAYMENTS) {
      const lease = leaseById.get(p.leaseRef);
      if (!lease) continue;
      const acctId = `acct-${p.tenantRef}-liab`;
      const periodStart = new Date(lease.startDate);
      periodStart.setMonth(periodStart.getMonth() + p.periodOffsetMonths);
      const effective = new Date(periodStart);
      effective.setDate(effective.getDate() + p.daysLate);

      await tx
        .insert(ledgerEntries)
        .values({
          id: p.externalRef,
          tenantId: TRC_TENANT_ID,
          accountId: acctId,
          journalId: `${p.externalRef}-journal`,
          type: 'RENT_PAYMENT',
          direction: 'CREDIT',
          amountMinorUnits: p.amountTzsMinor,
          currency: 'TZS',
          balanceAfterMinorUnits: 0,
          sequenceNumber: seq++,
          effectiveDate: effective,
          leaseId: p.leaseRef,
          description:
            p.daysLate === 0
              ? 'On-time rent payment'
              : `Rent payment (${p.daysLate} days late)`,
          metadata: { daysLate: p.daysLate, periodOffsetMonths: p.periodOffsetMonths },
        })
        .onConflictDoNothing();
    }

    // 15. Sample open maintenance cases --------------------------------------
    for (const m of SAMPLE_MAINTENANCE) {
      const submittedAt = new Date(now);
      submittedAt.setDate(submittedAt.getDate() - m.submittedDaysAgo);
      await tx
        .insert(maintenanceRequests)
        .values({
          id: m.externalRef,
          tenantId: TRC_TENANT_ID,
          propertyId: m.propertyRef,
          customerId: m.tenantRef ?? undefined,
          requestNumber: m.externalRef.toUpperCase(),
          status: 'submitted',
          title: m.title,
          description: m.description,
          category: m.category,
          priority: m.priority,
          source: 'customer_request',
          createdAt: submittedAt,
          updatedAt: submittedAt,
        })
        .onConflictDoNothing();
    }
  });

  console.log('[trc] seed complete');
}
