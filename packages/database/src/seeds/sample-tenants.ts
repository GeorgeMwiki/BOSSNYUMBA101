/**
 * Sample tenant identities + leases + ledger entries + maintenance cases
 * used by trc-seed.ts.
 *
 * All data is FAKE. Names are plausible Swahili/Tanzanian placeholders,
 * phone numbers use TZ dialing code 255 with fictitious subscriber numbers,
 * and emails use the reserved @example.com domain (RFC 2606).
 *
 * Amounts are denominated in TZS minor units (cents). Tanzanian Shilling
 * has 2 minor units in the BOSSNYUMBA region config — see
 * packages/domain-models/src/common/region-config.ts.
 */

export interface SampleTenantIdentity {
  readonly externalRef: string; // stable natural key used for idempotence
  readonly firstName: string;
  readonly lastName: string;
  readonly phone: string; // normalized E.164 without '+'
  readonly email: string;
  readonly occupation: string;
  readonly monthlyIncomeTzsMinor: number;
}

export interface SampleLease {
  readonly externalRef: string;
  readonly tenantRef: string;
  readonly propertyRef: string;
  readonly unitRef: string;
  readonly monthlyRentTzsMinor: number;
  readonly startOffsetMonths: number; // negative = in the past
  readonly termMonths: number;
  readonly depositMultiplier: number;
}

export interface SamplePayment {
  readonly externalRef: string;
  readonly leaseRef: string;
  readonly tenantRef: string;
  readonly amountTzsMinor: number;
  readonly periodOffsetMonths: number; // relative to lease start
  readonly daysLate: number; // 0 = on-time, > 0 = late
}

export interface SampleMaintenanceCase {
  readonly externalRef: string;
  readonly propertyRef: string;
  readonly tenantRef: string | null;
  readonly title: string;
  readonly description: string;
  readonly category:
    | 'plumbing'
    | 'electrical'
    | 'structural'
    | 'hvac'
    | 'general';
  readonly priority: 'low' | 'medium' | 'high' | 'urgent';
  readonly estimatedCostTzsMinor: number;
  readonly submittedDaysAgo: number;
}

// ---------------------------------------------------------------------------
// 20 sample tenant identities
// ---------------------------------------------------------------------------
export const SAMPLE_TENANTS: readonly SampleTenantIdentity[] = [
  { externalRef: 'trc-t-001', firstName: 'Amani',  lastName: 'Mwakalinga', phone: '255712000001', email: 'amani.mwakalinga@example.com',  occupation: 'Warehouse manager',   monthlyIncomeTzsMinor: 180_000_00 },
  { externalRef: 'trc-t-002', firstName: 'Baraka', lastName: 'Kileo',      phone: '255712000002', email: 'baraka.kileo@example.com',       occupation: 'Logistics agent',      monthlyIncomeTzsMinor: 140_000_00 },
  { externalRef: 'trc-t-003', firstName: 'Chausiku', lastName: 'Mrema',    phone: '255712000003', email: 'chausiku.mrema@example.com',     occupation: 'Freight broker',       monthlyIncomeTzsMinor: 220_000_00 },
  { externalRef: 'trc-t-004', firstName: 'Daudi',  lastName: 'Shayo',      phone: '255712000004', email: 'daudi.shayo@example.com',        occupation: 'Small trader',         monthlyIncomeTzsMinor:  95_000_00 },
  { externalRef: 'trc-t-005', firstName: 'Esther', lastName: 'Mushi',      phone: '255712000005', email: 'esther.mushi@example.com',       occupation: 'Grain wholesaler',     monthlyIncomeTzsMinor: 310_000_00 },
  { externalRef: 'trc-t-006', firstName: 'Faraja', lastName: 'Kimaro',     phone: '255712000006', email: 'faraja.kimaro@example.com',      occupation: 'Hardware retailer',    monthlyIncomeTzsMinor: 175_000_00 },
  { externalRef: 'trc-t-007', firstName: 'Goodluck', lastName: 'Mwanga',   phone: '255712000007', email: 'goodluck.mwanga@example.com',    occupation: 'Cement distributor',   monthlyIncomeTzsMinor: 420_000_00 },
  { externalRef: 'trc-t-008', firstName: 'Halima', lastName: 'Juma',       phone: '255712000008', email: 'halima.juma@example.com',        occupation: 'Spice exporter',       monthlyIncomeTzsMinor: 260_000_00 },
  { externalRef: 'trc-t-009', firstName: 'Ibrahim', lastName: 'Ndege',     phone: '255712000009', email: 'ibrahim.ndege@example.com',      occupation: 'Fuel reseller',        monthlyIncomeTzsMinor: 500_000_00 },
  { externalRef: 'trc-t-010', firstName: 'Jamila', lastName: 'Kisanji',    phone: '255712000010', email: 'jamila.kisanji@example.com',     occupation: 'Cooperative agent',    monthlyIncomeTzsMinor: 130_000_00 },
  { externalRef: 'trc-t-011', firstName: 'Kassim', lastName: 'Magige',     phone: '255712000011', email: 'kassim.magige@example.com',      occupation: 'Vegetable trader',     monthlyIncomeTzsMinor: 110_000_00 },
  { externalRef: 'trc-t-012', firstName: 'Lilian', lastName: 'Mlowezi',    phone: '255712000012', email: 'lilian.mlowezi@example.com',     occupation: 'Textile importer',     monthlyIncomeTzsMinor: 285_000_00 },
  { externalRef: 'trc-t-013', firstName: 'Musa',   lastName: 'Kitunda',    phone: '255712000013', email: 'musa.kitunda@example.com',       occupation: 'Construction foreman', monthlyIncomeTzsMinor: 165_000_00 },
  { externalRef: 'trc-t-014', firstName: 'Neema',  lastName: 'Masawe',     phone: '255712000014', email: 'neema.masawe@example.com',       occupation: 'Event organizer',      monthlyIncomeTzsMinor: 200_000_00 },
  { externalRef: 'trc-t-015', firstName: 'Omari',  lastName: 'Suleiman',   phone: '255712000015', email: 'omari.suleiman@example.com',     occupation: 'Fish processor',       monthlyIncomeTzsMinor: 240_000_00 },
  { externalRef: 'trc-t-016', firstName: 'Pendo',  lastName: 'Nyerere',    phone: '255712000016', email: 'pendo.nyerere@example.com',      occupation: 'Cooperative clerk',    monthlyIncomeTzsMinor: 120_000_00 },
  { externalRef: 'trc-t-017', firstName: 'Rajabu', lastName: 'Chuma',      phone: '255712000017', email: 'rajabu.chuma@example.com',       occupation: 'Metal fabricator',     monthlyIncomeTzsMinor: 190_000_00 },
  { externalRef: 'trc-t-018', firstName: 'Saida',  lastName: 'Mtui',       phone: '255712000018', email: 'saida.mtui@example.com',         occupation: 'Farmer cooperative',   monthlyIncomeTzsMinor: 100_000_00 },
  { externalRef: 'trc-t-019', firstName: 'Tumaini', lastName: 'Kalinga',   phone: '255712000019', email: 'tumaini.kalinga@example.com',    occupation: 'Trucking operator',    monthlyIncomeTzsMinor: 370_000_00 },
  { externalRef: 'trc-t-020', firstName: 'Upendo', lastName: 'Sawe',       phone: '255712000020', email: 'upendo.sawe@example.com',        occupation: 'Pharmacy owner',       monthlyIncomeTzsMinor: 330_000_00 },
];

// ---------------------------------------------------------------------------
// 15 sample leases referencing the sample properties in trc-seed.ts
// propertyRef / unitRef stable IDs are materialized by the seed runner.
// ---------------------------------------------------------------------------
export const SAMPLE_LEASES: readonly SampleLease[] = [
  { externalRef: 'trc-l-001', tenantRef: 'trc-t-001', propertyRef: 'trc-prop-wh-01', unitRef: 'trc-unit-wh-01-a', monthlyRentTzsMinor: 250_000_00, startOffsetMonths: -8,  termMonths: 24, depositMultiplier: 2 },
  { externalRef: 'trc-l-002', tenantRef: 'trc-t-002', propertyRef: 'trc-prop-wh-02', unitRef: 'trc-unit-wh-02-a', monthlyRentTzsMinor: 180_000_00, startOffsetMonths: -5,  termMonths: 12, depositMultiplier: 2 },
  { externalRef: 'trc-l-003', tenantRef: 'trc-t-003', propertyRef: 'trc-prop-wh-03', unitRef: 'trc-unit-wh-03-a', monthlyRentTzsMinor: 320_000_00, startOffsetMonths: -11, termMonths: 24, depositMultiplier: 2 },
  { externalRef: 'trc-l-004', tenantRef: 'trc-t-004', propertyRef: 'trc-prop-gd-01', unitRef: 'trc-unit-gd-01-a', monthlyRentTzsMinor:  95_000_00, startOffsetMonths: -3,  termMonths: 12, depositMultiplier: 1 },
  { externalRef: 'trc-l-005', tenantRef: 'trc-t-005', propertyRef: 'trc-prop-gd-02', unitRef: 'trc-unit-gd-02-a', monthlyRentTzsMinor: 410_000_00, startOffsetMonths: -6,  termMonths: 36, depositMultiplier: 3 },
  { externalRef: 'trc-l-006', tenantRef: 'trc-t-006', propertyRef: 'trc-prop-wh-04', unitRef: 'trc-unit-wh-04-a', monthlyRentTzsMinor: 220_000_00, startOffsetMonths: -10, termMonths: 24, depositMultiplier: 2 },
  { externalRef: 'trc-l-007', tenantRef: 'trc-t-007', propertyRef: 'trc-prop-wh-05', unitRef: 'trc-unit-wh-05-a', monthlyRentTzsMinor: 560_000_00, startOffsetMonths: -2,  termMonths: 24, depositMultiplier: 3 },
  { externalRef: 'trc-l-008', tenantRef: 'trc-t-008', propertyRef: 'trc-prop-gd-03', unitRef: 'trc-unit-gd-03-a', monthlyRentTzsMinor: 180_000_00, startOffsetMonths: -4,  termMonths: 12, depositMultiplier: 2 },
  { externalRef: 'trc-l-009', tenantRef: 'trc-t-009', propertyRef: 'trc-prop-bl-01', unitRef: 'trc-unit-bl-01-a', monthlyRentTzsMinor: 650_000_00, startOffsetMonths: -7,  termMonths: 36, depositMultiplier: 3 },
  { externalRef: 'trc-l-010', tenantRef: 'trc-t-010', propertyRef: 'trc-prop-wh-06', unitRef: 'trc-unit-wh-06-a', monthlyRentTzsMinor: 165_000_00, startOffsetMonths: -9,  termMonths: 12, depositMultiplier: 2 },
  { externalRef: 'trc-l-011', tenantRef: 'trc-t-011', propertyRef: 'trc-prop-gd-04', unitRef: 'trc-unit-gd-04-a', monthlyRentTzsMinor: 140_000_00, startOffsetMonths: -4,  termMonths: 12, depositMultiplier: 1 },
  { externalRef: 'trc-l-012', tenantRef: 'trc-t-012', propertyRef: 'trc-prop-wh-07', unitRef: 'trc-unit-wh-07-a', monthlyRentTzsMinor: 370_000_00, startOffsetMonths: -6,  termMonths: 24, depositMultiplier: 2 },
  { externalRef: 'trc-l-013', tenantRef: 'trc-t-013', propertyRef: 'trc-prop-wh-08', unitRef: 'trc-unit-wh-08-a', monthlyRentTzsMinor: 210_000_00, startOffsetMonths: -3,  termMonths: 12, depositMultiplier: 2 },
  { externalRef: 'trc-l-014', tenantRef: 'trc-t-014', propertyRef: 'trc-prop-bl-02', unitRef: 'trc-unit-bl-02-a', monthlyRentTzsMinor: 480_000_00, startOffsetMonths: -5,  termMonths: 24, depositMultiplier: 3 },
  { externalRef: 'trc-l-015', tenantRef: 'trc-t-015', propertyRef: 'trc-prop-gd-05', unitRef: 'trc-unit-gd-05-a', monthlyRentTzsMinor: 260_000_00, startOffsetMonths: -8,  termMonths: 24, depositMultiplier: 2 },
];

// ---------------------------------------------------------------------------
// 50 payment ledger entries — mix of on-time and late
// periodOffsetMonths is from the lease's startOffsetMonths (so 0 is first
// rent period, 1 is second month, etc.). daysLate of 0 means on time.
// ---------------------------------------------------------------------------
export const SAMPLE_PAYMENTS: readonly SamplePayment[] = [
  { externalRef: 'trc-p-001', leaseRef: 'trc-l-001', tenantRef: 'trc-t-001', amountTzsMinor: 250_000_00, periodOffsetMonths: 0,  daysLate: 0   },
  { externalRef: 'trc-p-002', leaseRef: 'trc-l-001', tenantRef: 'trc-t-001', amountTzsMinor: 250_000_00, periodOffsetMonths: 1,  daysLate: 2   },
  { externalRef: 'trc-p-003', leaseRef: 'trc-l-001', tenantRef: 'trc-t-001', amountTzsMinor: 250_000_00, periodOffsetMonths: 2,  daysLate: 0   },
  { externalRef: 'trc-p-004', leaseRef: 'trc-l-001', tenantRef: 'trc-t-001', amountTzsMinor: 250_000_00, periodOffsetMonths: 3,  daysLate: 0   },
  { externalRef: 'trc-p-005', leaseRef: 'trc-l-001', tenantRef: 'trc-t-001', amountTzsMinor: 250_000_00, periodOffsetMonths: 4,  daysLate: 15  },
  { externalRef: 'trc-p-006', leaseRef: 'trc-l-002', tenantRef: 'trc-t-002', amountTzsMinor: 180_000_00, periodOffsetMonths: 0,  daysLate: 0   },
  { externalRef: 'trc-p-007', leaseRef: 'trc-l-002', tenantRef: 'trc-t-002', amountTzsMinor: 180_000_00, periodOffsetMonths: 1,  daysLate: 0   },
  { externalRef: 'trc-p-008', leaseRef: 'trc-l-002', tenantRef: 'trc-t-002', amountTzsMinor: 180_000_00, periodOffsetMonths: 2,  daysLate: 5   },
  { externalRef: 'trc-p-009', leaseRef: 'trc-l-003', tenantRef: 'trc-t-003', amountTzsMinor: 320_000_00, periodOffsetMonths: 0,  daysLate: 0   },
  { externalRef: 'trc-p-010', leaseRef: 'trc-l-003', tenantRef: 'trc-t-003', amountTzsMinor: 320_000_00, periodOffsetMonths: 1,  daysLate: 0   },
  { externalRef: 'trc-p-011', leaseRef: 'trc-l-003', tenantRef: 'trc-t-003', amountTzsMinor: 320_000_00, periodOffsetMonths: 2,  daysLate: 0   },
  { externalRef: 'trc-p-012', leaseRef: 'trc-l-003', tenantRef: 'trc-t-003', amountTzsMinor: 320_000_00, periodOffsetMonths: 3,  daysLate: 0   },
  { externalRef: 'trc-p-013', leaseRef: 'trc-l-003', tenantRef: 'trc-t-003', amountTzsMinor: 320_000_00, periodOffsetMonths: 4,  daysLate: 0   },
  { externalRef: 'trc-p-014', leaseRef: 'trc-l-003', tenantRef: 'trc-t-003', amountTzsMinor: 320_000_00, periodOffsetMonths: 5,  daysLate: 30  },
  { externalRef: 'trc-p-015', leaseRef: 'trc-l-003', tenantRef: 'trc-t-003', amountTzsMinor: 320_000_00, periodOffsetMonths: 6,  daysLate: 45  },
  { externalRef: 'trc-p-016', leaseRef: 'trc-l-004', tenantRef: 'trc-t-004', amountTzsMinor:  95_000_00, periodOffsetMonths: 0,  daysLate: 0   },
  { externalRef: 'trc-p-017', leaseRef: 'trc-l-004', tenantRef: 'trc-t-004', amountTzsMinor:  95_000_00, periodOffsetMonths: 1,  daysLate: 10  },
  { externalRef: 'trc-p-018', leaseRef: 'trc-l-004', tenantRef: 'trc-t-004', amountTzsMinor:  95_000_00, periodOffsetMonths: 2,  daysLate: 20  },
  { externalRef: 'trc-p-019', leaseRef: 'trc-l-005', tenantRef: 'trc-t-005', amountTzsMinor: 410_000_00, periodOffsetMonths: 0,  daysLate: 0   },
  { externalRef: 'trc-p-020', leaseRef: 'trc-l-005', tenantRef: 'trc-t-005', amountTzsMinor: 410_000_00, periodOffsetMonths: 1,  daysLate: 0   },
  { externalRef: 'trc-p-021', leaseRef: 'trc-l-005', tenantRef: 'trc-t-005', amountTzsMinor: 410_000_00, periodOffsetMonths: 2,  daysLate: 0   },
  { externalRef: 'trc-p-022', leaseRef: 'trc-l-005', tenantRef: 'trc-t-005', amountTzsMinor: 410_000_00, periodOffsetMonths: 3,  daysLate: 7   },
  { externalRef: 'trc-p-023', leaseRef: 'trc-l-006', tenantRef: 'trc-t-006', amountTzsMinor: 220_000_00, periodOffsetMonths: 0,  daysLate: 0   },
  { externalRef: 'trc-p-024', leaseRef: 'trc-l-006', tenantRef: 'trc-t-006', amountTzsMinor: 220_000_00, periodOffsetMonths: 1,  daysLate: 0   },
  { externalRef: 'trc-p-025', leaseRef: 'trc-l-006', tenantRef: 'trc-t-006', amountTzsMinor: 220_000_00, periodOffsetMonths: 2,  daysLate: 0   },
  { externalRef: 'trc-p-026', leaseRef: 'trc-l-006', tenantRef: 'trc-t-006', amountTzsMinor: 220_000_00, periodOffsetMonths: 3,  daysLate: 12  },
  { externalRef: 'trc-p-027', leaseRef: 'trc-l-006', tenantRef: 'trc-t-006', amountTzsMinor: 220_000_00, periodOffsetMonths: 4,  daysLate: 95  },
  { externalRef: 'trc-p-028', leaseRef: 'trc-l-007', tenantRef: 'trc-t-007', amountTzsMinor: 560_000_00, periodOffsetMonths: 0,  daysLate: 0   },
  { externalRef: 'trc-p-029', leaseRef: 'trc-l-007', tenantRef: 'trc-t-007', amountTzsMinor: 560_000_00, periodOffsetMonths: 1,  daysLate: 0   },
  { externalRef: 'trc-p-030', leaseRef: 'trc-l-008', tenantRef: 'trc-t-008', amountTzsMinor: 180_000_00, periodOffsetMonths: 0,  daysLate: 0   },
  { externalRef: 'trc-p-031', leaseRef: 'trc-l-008', tenantRef: 'trc-t-008', amountTzsMinor: 180_000_00, periodOffsetMonths: 1,  daysLate: 3   },
  { externalRef: 'trc-p-032', leaseRef: 'trc-l-008', tenantRef: 'trc-t-008', amountTzsMinor: 180_000_00, periodOffsetMonths: 2,  daysLate: 0   },
  { externalRef: 'trc-p-033', leaseRef: 'trc-l-009', tenantRef: 'trc-t-009', amountTzsMinor: 650_000_00, periodOffsetMonths: 0,  daysLate: 0   },
  { externalRef: 'trc-p-034', leaseRef: 'trc-l-009', tenantRef: 'trc-t-009', amountTzsMinor: 650_000_00, periodOffsetMonths: 1,  daysLate: 0   },
  { externalRef: 'trc-p-035', leaseRef: 'trc-l-009', tenantRef: 'trc-t-009', amountTzsMinor: 650_000_00, periodOffsetMonths: 2,  daysLate: 0   },
  { externalRef: 'trc-p-036', leaseRef: 'trc-l-009', tenantRef: 'trc-t-009', amountTzsMinor: 650_000_00, periodOffsetMonths: 3,  daysLate: 0   },
  { externalRef: 'trc-p-037', leaseRef: 'trc-l-009', tenantRef: 'trc-t-009', amountTzsMinor: 650_000_00, periodOffsetMonths: 4,  daysLate: 0   },
  { externalRef: 'trc-p-038', leaseRef: 'trc-l-010', tenantRef: 'trc-t-010', amountTzsMinor: 165_000_00, periodOffsetMonths: 0,  daysLate: 0   },
  { externalRef: 'trc-p-039', leaseRef: 'trc-l-010', tenantRef: 'trc-t-010', amountTzsMinor: 165_000_00, periodOffsetMonths: 1,  daysLate: 0   },
  { externalRef: 'trc-p-040', leaseRef: 'trc-l-010', tenantRef: 'trc-t-010', amountTzsMinor: 165_000_00, periodOffsetMonths: 2,  daysLate: 0   },
  { externalRef: 'trc-p-041', leaseRef: 'trc-l-010', tenantRef: 'trc-t-010', amountTzsMinor: 165_000_00, periodOffsetMonths: 3,  daysLate: 120 },
  { externalRef: 'trc-p-042', leaseRef: 'trc-l-011', tenantRef: 'trc-t-011', amountTzsMinor: 140_000_00, periodOffsetMonths: 0,  daysLate: 0   },
  { externalRef: 'trc-p-043', leaseRef: 'trc-l-011', tenantRef: 'trc-t-011', amountTzsMinor: 140_000_00, periodOffsetMonths: 1,  daysLate: 4   },
  { externalRef: 'trc-p-044', leaseRef: 'trc-l-012', tenantRef: 'trc-t-012', amountTzsMinor: 370_000_00, periodOffsetMonths: 0,  daysLate: 0   },
  { externalRef: 'trc-p-045', leaseRef: 'trc-l-012', tenantRef: 'trc-t-012', amountTzsMinor: 370_000_00, periodOffsetMonths: 1,  daysLate: 0   },
  { externalRef: 'trc-p-046', leaseRef: 'trc-l-013', tenantRef: 'trc-t-013', amountTzsMinor: 210_000_00, periodOffsetMonths: 0,  daysLate: 0   },
  { externalRef: 'trc-p-047', leaseRef: 'trc-l-014', tenantRef: 'trc-t-014', amountTzsMinor: 480_000_00, periodOffsetMonths: 0,  daysLate: 0   },
  { externalRef: 'trc-p-048', leaseRef: 'trc-l-014', tenantRef: 'trc-t-014', amountTzsMinor: 480_000_00, periodOffsetMonths: 1,  daysLate: 0   },
  { externalRef: 'trc-p-049', leaseRef: 'trc-l-015', tenantRef: 'trc-t-015', amountTzsMinor: 260_000_00, periodOffsetMonths: 0,  daysLate: 0   },
  { externalRef: 'trc-p-050', leaseRef: 'trc-l-015', tenantRef: 'trc-t-015', amountTzsMinor: 260_000_00, periodOffsetMonths: 1,  daysLate: 8   },
];

// ---------------------------------------------------------------------------
// 5 open maintenance cases
// ---------------------------------------------------------------------------
export const SAMPLE_MAINTENANCE: readonly SampleMaintenanceCase[] = [
  {
    externalRef: 'trc-m-001',
    propertyRef: 'trc-prop-wh-01',
    tenantRef: 'trc-t-001',
    title: 'Roof leak above bay 3',
    description: 'Significant water ingress during last storm; ceiling insulation sagging.',
    category: 'structural',
    priority: 'high',
    estimatedCostTzsMinor: 420_000_00,
    submittedDaysAgo: 4,
  },
  {
    externalRef: 'trc-m-002',
    propertyRef: 'trc-prop-wh-03',
    tenantRef: 'trc-t-003',
    title: 'Loading dock hydraulic failure',
    description: 'West dock leveler stuck in raised position; blocking freight movement.',
    category: 'structural',
    priority: 'urgent',
    estimatedCostTzsMinor: 680_000_00,
    submittedDaysAgo: 1,
  },
  {
    externalRef: 'trc-m-003',
    propertyRef: 'trc-prop-gd-02',
    tenantRef: 'trc-t-005',
    title: 'Electrical panel tripping',
    description: 'Main panel breaker trips intermittently; possible overload on cold-storage compressor circuit.',
    category: 'electrical',
    priority: 'high',
    estimatedCostTzsMinor: 180_000_00,
    submittedDaysAgo: 7,
  },
  {
    externalRef: 'trc-m-004',
    propertyRef: 'trc-prop-wh-05',
    tenantRef: 'trc-t-007',
    title: 'Plumbing leak in utility room',
    description: 'Leak at main water valve; water loss approximately 50L/hour.',
    category: 'plumbing',
    priority: 'medium',
    estimatedCostTzsMinor:  85_000_00,
    submittedDaysAgo: 10,
  },
  {
    externalRef: 'trc-m-005',
    propertyRef: 'trc-prop-bl-01',
    tenantRef: null,
    title: 'Perimeter fence damage',
    description: 'Eastern fence line 30m section collapsed; security risk to stored equipment.',
    category: 'general',
    priority: 'medium',
    estimatedCostTzsMinor: 240_000_00,
    submittedDaysAgo: 14,
  },
];
