/**
 * Unit tests for SQLKPIDataProvider
 *
 * Uses a hand-rolled fluent stub for the drizzle `DatabaseClient.select` chain
 * so that the tests exercise the provider's query composition, aggregation, and
 * bucket-building logic without needing a real Postgres instance.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  SQLKPIDataProvider,
  buildMonthBuckets,
  lastNMonthsPeriod,
  toMajor,
  monthKey,
  type KPIPeriod,
} from './sql-kpi-data-provider';

// ============================================================================
// Fluent drizzle stub
// ============================================================================

/**
 * Queue-based stub: the test pushes fixture row arrays in the order the
 * provider will execute selects. Each call to .select().from().where() returns
 * a thenable that resolves to the next fixture in the queue.
 */
class DbStub {
  private queue: unknown[][] = [];
  public calls: Array<{ table: unknown }> = [];

  enqueue(rows: unknown[]): this {
    this.queue.push(rows);
    return this;
  }

  reset(): void {
    this.queue = [];
    this.calls = [];
  }

  select(_projection?: unknown): this {
    return this;
  }

  from(table: unknown): this {
    this.calls.push({ table });
    return this;
  }

  where(_predicate: unknown): Promise<unknown[]> {
    const next = this.queue.shift();
    if (next === undefined) {
      return Promise.reject(new Error('DbStub queue exhausted'));
    }
    return Promise.resolve(next);
  }
}

/**
 * Stub schema tables. Each field is a Proxy so any property access returns a
 * harmless token - drizzle builders like `eq(units.status, 'occupied')` will
 * compose objects from these tokens that we never inspect because the DbStub
 * short-circuits .where() to resolve a fixture queue instead of executing SQL.
 */
const makeTableStub = (name: string): any =>
  new Proxy(
    { __tableName: name },
    {
      get(target, prop) {
        if (prop in target) return (target as any)[prop];
        return { __column: String(prop), __table: name };
      },
    }
  );

const STUB_TABLES = {
  units: makeTableStub('units'),
  invoices: makeTableStub('invoices'),
  payments: makeTableStub('payments'),
  workOrders: makeTableStub('work_orders'),
};

function makePeriod(startYear: number, startMonth: number, endYear: number, endMonth: number): KPIPeriod {
  return {
    start: new Date(startYear, startMonth, 1),
    end: new Date(endYear, endMonth, 28),
    label: `${startYear}-${startMonth}..${endYear}-${endMonth}`,
  };
}

const TENANT = 'tenant-test';

describe('SQLKPIDataProvider helpers', () => {
  it('toMajor converts minor units to major currency', () => {
    expect(toMajor(0)).toBe(0);
    expect(toMajor(null)).toBe(0);
    expect(toMajor(undefined)).toBe(0);
    expect(toMajor(12345)).toBe(123.45);
    expect(toMajor(100)).toBe(1);
  });

  it('monthKey produces YYYY-MM keys', () => {
    expect(monthKey(new Date(2026, 0, 15))).toBe('2026-01');
    expect(monthKey(new Date(2026, 11, 1))).toBe('2026-12');
  });

  it('buildMonthBuckets covers start..end inclusive', () => {
    const period = makePeriod(2026, 0, 2026, 2); // Jan..Mar
    const buckets = buildMonthBuckets(period);
    expect(buckets).toHaveLength(3);
    expect(buckets[0].key).toBe('2026-01');
    expect(buckets[2].key).toBe('2026-03');
  });

  it('lastNMonthsPeriod returns N months ending today', () => {
    const p = lastNMonthsPeriod(6);
    const diffMonths =
      (p.end.getFullYear() - p.start.getFullYear()) * 12 +
      (p.end.getMonth() - p.start.getMonth()) +
      1;
    expect(diffMonths).toBe(6);
  });
});

describe('SQLKPIDataProvider.getOccupancyRate', () => {
  let db: DbStub;
  let provider: SQLKPIDataProvider;

  beforeEach(() => {
    db = new DbStub();
    provider = new SQLKPIDataProvider(db as unknown as any, STUB_TABLES);
  });

  it('computes rate from occupied/total and returns trend of length = month count', async () => {
    db.enqueue([
      { status: 'occupied' },
      { status: 'occupied' },
      { status: 'occupied' },
      { status: 'vacant' },
      { status: 'under_maintenance' },
    ]);

    const period = makePeriod(2026, 0, 2026, 2);
    const result = await provider.getOccupancyRate(TENANT, period);

    expect(result.totalUnits).toBe(5);
    expect(result.occupiedUnits).toBe(3);
    expect(result.vacantUnits).toBe(2);
    expect(result.rate).toBe(60);
    expect(result.trend).toHaveLength(3);
    expect(result.trend.every((t) => t.rate === 60)).toBe(true);
  });

  it('returns 0 rate on an empty unit set without throwing', async () => {
    db.enqueue([]);
    const result = await provider.getOccupancyRate(TENANT, makePeriod(2026, 0, 2026, 0));
    expect(result.rate).toBe(0);
    expect(result.totalUnits).toBe(0);
  });
});

describe('SQLKPIDataProvider.getRentCollectionRate', () => {
  let db: DbStub;
  let provider: SQLKPIDataProvider;

  beforeEach(() => {
    db = new DbStub();
    provider = new SQLKPIDataProvider(db as unknown as any, STUB_TABLES);
  });

  it('sums amounts (in major units) and computes the collection rate percentage', async () => {
    // Minor units: cents. 100_000 cents = KES 1000.
    db.enqueue([
      { totalAmount: 100_000, paidAmount: 80_000, balanceAmount: 20_000, propertyId: 'p1', invoiceType: 'rent' },
      { totalAmount: 100_000, paidAmount: 100_000, balanceAmount: 0, propertyId: 'p2', invoiceType: 'rent' },
    ]);

    const period = lastNMonthsPeriod(1);
    const result = await provider.getRentCollectionRate(TENANT, period);

    expect(result.totalBilled).toBe(2000);
    expect(result.totalCollected).toBe(1800);
    expect(result.totalOutstanding).toBe(200);
    expect(result.rate).toBe(90);
  });

  it('filters by propertyIds when provided', async () => {
    db.enqueue([
      { totalAmount: 100_000, paidAmount: 50_000, balanceAmount: 50_000, propertyId: 'p1', invoiceType: 'rent' },
      { totalAmount: 100_000, paidAmount: 100_000, balanceAmount: 0, propertyId: 'p2', invoiceType: 'rent' },
    ]);

    const result = await provider.getRentCollectionRate(TENANT, lastNMonthsPeriod(1), ['p2']);
    expect(result.totalBilled).toBe(1000);
    expect(result.totalCollected).toBe(1000);
    expect(result.rate).toBe(100);
  });
});

describe('SQLKPIDataProvider.getArrearsAging', () => {
  let db: DbStub;
  let provider: SQLKPIDataProvider;

  beforeEach(() => {
    db = new DbStub();
    provider = new SQLKPIDataProvider(db as unknown as any, STUB_TABLES);
  });

  it('buckets invoices by days overdue', async () => {
    const now = new Date();
    const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

    db.enqueue([
      // current (not yet due)
      { balanceAmount: 100_000, dueDate: new Date(now.getTime() + 86400000), propertyId: 'p1' },
      // 1-30
      { balanceAmount: 50_000, dueDate: daysAgo(15), propertyId: 'p1' },
      // 31-60
      { balanceAmount: 40_000, dueDate: daysAgo(45), propertyId: 'p1' },
      // 61-90
      { balanceAmount: 30_000, dueDate: daysAgo(75), propertyId: 'p1' },
      // 90+
      { balanceAmount: 20_000, dueDate: daysAgo(120), propertyId: 'p1' },
      // balance <= 0 skipped
      { balanceAmount: 0, dueDate: daysAgo(10), propertyId: 'p1' },
    ]);

    const result = await provider.getArrearsAging(TENANT);

    expect(result.buckets).toHaveLength(5);
    const byKey = Object.fromEntries(result.buckets.map((b) => [b.bucket, b]));
    expect(byKey.current.amount).toBe(1000);
    expect(byKey['1-30'].amount).toBe(500);
    expect(byKey['31-60'].amount).toBe(400);
    expect(byKey['61-90'].amount).toBe(300);
    expect(byKey['90+'].amount).toBe(200);
    expect(result.totalOutstanding).toBe(2400);
  });
});

describe('SQLKPIDataProvider.getMaintenanceTicketsMetrics', () => {
  let db: DbStub;
  let provider: SQLKPIDataProvider;

  beforeEach(() => {
    db = new DbStub();
    provider = new SQLKPIDataProvider(db as unknown as any, STUB_TABLES);
  });

  it('splits work orders into status buckets and averages resolution time', async () => {
    const baseDate = new Date(2026, 2, 1);
    const plusHours = (d: Date, h: number) => new Date(d.getTime() + h * 3600000);

    db.enqueue([
      { status: 'submitted', createdAt: baseDate, completedAt: null, actualCost: null, estimatedCost: null, propertyId: 'p1' },
      { status: 'in_progress', createdAt: baseDate, completedAt: null, actualCost: null, estimatedCost: 50_000, propertyId: 'p1' },
      { status: 'completed', createdAt: baseDate, completedAt: plusHours(baseDate, 10), actualCost: 20_000, estimatedCost: null, propertyId: 'p1' },
      { status: 'verified', createdAt: baseDate, completedAt: plusHours(baseDate, 20), actualCost: 30_000, estimatedCost: null, propertyId: 'p1' },
    ]);

    const period = makePeriod(2026, 2, 2026, 2);
    const result = await provider.getMaintenanceTicketsMetrics(TENANT, period);

    expect(result.total).toBe(4);
    expect(result.open).toBe(1);
    expect(result.inProgress).toBe(1);
    expect(result.completed).toBe(2);
    expect(result.avgResolutionHours).toBe(15);
    // 50_000 + 20_000 + 30_000 = 100_000 minor -> 1000 major
    expect(result.totalCost).toBe(1000);
  });
});

describe('SQLKPIDataProvider.getRevenueBreakdown', () => {
  let db: DbStub;
  let provider: SQLKPIDataProvider;

  beforeEach(() => {
    db = new DbStub();
    provider = new SQLKPIDataProvider(db as unknown as any, STUB_TABLES);
  });

  it('bucketizes payments into months and splits rent vs other by invoice type', async () => {
    const jan = new Date(2026, 0, 15);
    const feb = new Date(2026, 1, 15);

    // First query: payments
    db.enqueue([
      { amount: 100_000, completedAt: jan, createdAt: jan, invoiceId: 'inv-1', status: 'completed' },
      { amount: 50_000, completedAt: feb, createdAt: feb, invoiceId: 'inv-2', status: 'completed' },
      { amount: 25_000, completedAt: feb, createdAt: feb, invoiceId: null, status: 'completed' },
    ]);
    // Second query: invoices for type lookup
    db.enqueue([
      { id: 'inv-1', invoiceType: 'rent', propertyId: 'p1' },
      { id: 'inv-2', invoiceType: 'utilities', propertyId: 'p1' },
    ]);

    const period = makePeriod(2026, 0, 2026, 1);
    const result = await provider.getRevenueBreakdown(TENANT, period);

    expect(result.totalRevenue).toBe(1750); // (100000 + 50000 + 25000) / 100
    expect(result.trend).toHaveLength(2);
    expect(result.trend[0].month).toBe('Jan');
    expect(result.trend[0].rent).toBe(1000);
    expect(result.trend[1].rent).toBe(0);
    expect(result.trend[1].other).toBe(750); // 500 utilities + 250 null invoice
    const rentSource = result.bySource.find((s) => s.name === 'Rent');
    expect(rentSource?.value).toBe(1000);
  });
});

describe('SQLKPIDataProvider.getPortfolioSummary', () => {
  let db: DbStub;
  let provider: SQLKPIDataProvider;

  beforeEach(() => {
    db = new DbStub();
    provider = new SQLKPIDataProvider(db as unknown as any, STUB_TABLES);
  });

  it('aggregates occupancy, revenue, and expenses into a single NOI figure', async () => {
    // Provider runs occupancy, revenue, and expenses in parallel via Promise.all.
    // The first synchronous batch of .select().from().where() calls enqueues in
    // this order: occupancy(units), revenue(payments), expenses(workOrders).
    // Then after the first awaits resolve, revenue(invoices) and expenses(invoices)
    // schedule. Fixtures must be enqueued to match that ordering.
    db.enqueue([{ status: 'occupied' }, { status: 'occupied' }, { status: 'vacant' }]); // 1. occupancy units
    db.enqueue([
      { amount: 200_000, completedAt: new Date(2026, 0, 15), createdAt: new Date(2026, 0, 15), invoiceId: 'inv-1', status: 'completed' },
    ]); // 2. revenue payments
    db.enqueue([
      { actualCost: 30_000, estimatedCost: null, createdAt: new Date(2026, 0, 10), category: 'plumbing', propertyId: 'p1' },
    ]); // 3. expense work orders
    db.enqueue([
      { id: 'inv-1', invoiceType: 'rent', propertyId: 'p1' },
    ]); // 4. revenue invoice lookup
    db.enqueue([]); // 5. expense invoices

    const period = makePeriod(2026, 0, 2026, 0);
    const result = await provider.getPortfolioSummary(TENANT, period);

    expect(result.occupancy).toBeCloseTo(66.7, 0);
    expect(result.revenue).toBe(2000);
    expect(result.expenses).toBe(300);
    expect(result.noi).toBe(1700);
  });
});
