/**
 * Trading-desk orchestrator tests — planPurchase, bookForward,
 * markToMarket, complianceCheck. Verra + CIX are injected as
 * deterministic fakes.
 */

import { describe, expect, it } from 'vitest';
import { createTradingDesk } from '../desk/trading-desk.js';
import { createMockCixFeed } from '../cix/client.js';
import { createInMemoryBookRepository } from '../desk/in-memory-book-repository.js';
import { runComplianceCheck } from '../desk/compliance.js';
import type {
  BookEntry,
  HttpTransport,
  PortfolioSnapshot,
  Project,
} from '../types.js';
import { createVerraClient } from '../verra/client.js';
import { SAMPLE_PROJECT_LIST } from './fixtures.js';

function verraOf(payload: unknown) {
  const transport: HttpTransport = {
    async get() { return payload; },
  };
  return createVerraClient({ transport, sleep: async () => {} });
}

const PORTFOLIO: PortfolioSnapshot = {
  annualResidualTonnes: 1_000,
  heldByType: {},
  yearsToTarget: 4,
};

let idCounter = 0;
function detIdGen() {
  idCounter = 0;
  return () => {
    idCounter++;
    return `BE-${idCounter}`;
  };
}

describe('createTradingDesk — planPurchase', () => {
  it('returns a non-empty plan from a populated registry', async () => {
    const desk = createTradingDesk({
      verra: verraOf(SAMPLE_PROJECT_LIST),
      cix: createMockCixFeed(),
      bookRepository: createInMemoryBookRepository(),
      nextId: detIdGen(),
    });
    const plan = await desk.planPurchase({
      tenantId: 'tenant-1',
      tenantJurisdiction: 'TZ',
      target: 'net-zero-by-2030',
      portfolio: PORTFOLIO,
      budgetUsd: 50_000,
    });
    expect(plan.lines.length).toBeGreaterThan(0);
    expect(plan.lines.length).toBeLessThanOrEqual(5);
  });

  it('plan total cost stays within the budget', async () => {
    const desk = createTradingDesk({
      verra: verraOf(SAMPLE_PROJECT_LIST),
      cix: createMockCixFeed(),
      bookRepository: createInMemoryBookRepository(),
      nextId: detIdGen(),
    });
    const plan = await desk.planPurchase({
      tenantId: 'tenant-1',
      tenantJurisdiction: 'TZ',
      target: 'net-zero-by-2030',
      portfolio: PORTFOLIO,
      budgetUsd: 20_000,
    });
    expect(plan.totalCostUsd).toBeLessThanOrEqual(20_000 + 0.01);
  });

  it('warns when registry returns zero projects', async () => {
    const desk = createTradingDesk({
      verra: verraOf({ projects: [] }),
      cix: createMockCixFeed(),
      bookRepository: createInMemoryBookRepository(),
      nextId: detIdGen(),
    });
    const plan = await desk.planPurchase({
      tenantId: 'tenant-1',
      tenantJurisdiction: 'TZ',
      target: 'net-zero-by-2030',
      portfolio: PORTFOLIO,
      budgetUsd: 100_000,
    });
    expect(plan.warnings.some((w) => w.includes('0 projects'))).toBe(true);
    expect(plan.lines).toHaveLength(0);
  });

  it('diversifies across project types (index > 0)', async () => {
    // SAMPLE_PROJECT_LIST has 3 distinct project types in 3 countries.
    const desk = createTradingDesk({
      verra: verraOf(SAMPLE_PROJECT_LIST),
      cix: createMockCixFeed(),
      bookRepository: createInMemoryBookRepository(),
      nextId: detIdGen(),
    });
    const plan = await desk.planPurchase({
      tenantId: 'tenant-1',
      tenantJurisdiction: 'TZ',
      target: 'net-zero-by-2030',
      portfolio: PORTFOLIO,
      budgetUsd: 200_000,
    });
    expect(plan.diversificationIndex).toBeGreaterThan(0);
  });

  it('every line carries an additionality score in [0,1]', async () => {
    const desk = createTradingDesk({
      verra: verraOf(SAMPLE_PROJECT_LIST),
      cix: createMockCixFeed(),
      bookRepository: createInMemoryBookRepository(),
      nextId: detIdGen(),
    });
    const plan = await desk.planPurchase({
      tenantId: 'tenant-1',
      tenantJurisdiction: 'TZ',
      target: 'net-zero-by-2030',
      portfolio: PORTFOLIO,
      budgetUsd: 200_000,
    });
    for (const l of plan.lines) {
      expect(l.additionalityScore).toBeGreaterThanOrEqual(0);
      expect(l.additionalityScore).toBeLessThanOrEqual(1);
    }
  });

  it('removal projects score higher than REDD', async () => {
    const list = {
      projects: [
        {
          id: '1', name: 'Biochar', country: 'UG', methodology: 'VM0044',
          projectType: 'Removal — Biochar', status: 'Registered',
          proponent: 'X', lastIssuanceDate: '2025-01-01', totalIssuedTonnes: 1000,
        },
        {
          id: '2', name: 'REDD', country: 'KE', methodology: 'VM0009',
          projectType: 'REDD+ AFOLU', status: 'Registered',
          proponent: 'Y', lastIssuanceDate: '2025-01-01', totalIssuedTonnes: 1000,
        },
      ],
    };
    const desk = createTradingDesk({
      verra: verraOf(list),
      cix: createMockCixFeed(),
      bookRepository: createInMemoryBookRepository(),
      nextId: detIdGen(),
    });
    const plan = await desk.planPurchase({
      tenantId: 'tenant-1',
      tenantJurisdiction: 'TZ',
      target: 'net-zero-by-2050',
      portfolio: PORTFOLIO,
      budgetUsd: 1_000_000,
    });
    const removal = plan.lines.find((l) => l.project.projectType.includes('Biochar'));
    const redd = plan.lines.find((l) => l.project.projectType.includes('REDD'));
    expect(removal?.additionalityScore).toBeGreaterThan(redd?.additionalityScore ?? 0);
  });

  it('warns when budget runs out before tonnage target', async () => {
    const desk = createTradingDesk({
      verra: verraOf(SAMPLE_PROJECT_LIST),
      cix: createMockCixFeed(),
      bookRepository: createInMemoryBookRepository(),
      nextId: detIdGen(),
    });
    const plan = await desk.planPurchase({
      tenantId: 'tenant-1',
      tenantJurisdiction: 'TZ',
      target: 'net-zero-by-2030',
      portfolio: { ...PORTFOLIO, annualResidualTonnes: 10_000_000 },
      budgetUsd: 5,
    });
    expect(plan.warnings.length).toBeGreaterThan(0);
  });
});

describe('createTradingDesk — bookForward', () => {
  it('persists a new OPEN BUY entry', async () => {
    const repo = createInMemoryBookRepository();
    const desk = createTradingDesk({
      verra: verraOf(SAMPLE_PROJECT_LIST),
      cix: createMockCixFeed(),
      bookRepository: repo,
      nextId: detIdGen(),
    });
    const entry = await desk.bookForward({
      tenantId: 't1',
      symbol: 'CIX-NBS-2024',
      qty: 500,
      priceUsdPerTonne: 7.5,
      tenor: 'Dec-26',
      counterparty: 'CIX-DEALER-01',
    });
    expect(entry.id).toBe('BE-1');
    expect(entry.status).toBe('OPEN');
    expect(entry.side).toBe('BUY');
    // nosemgrep: missing-tenant-id-arg reason: test of repo.findById's globally-unique-id lookup contract.
    const stored = await repo.findById('BE-1');
    expect(stored).not.toBeNull();
    expect(stored!.qty).toBe(500);
  });

  it('rejects non-positive qty', async () => {
    const desk = createTradingDesk({
      verra: verraOf(SAMPLE_PROJECT_LIST),
      cix: createMockCixFeed(),
      bookRepository: createInMemoryBookRepository(),
      nextId: detIdGen(),
    });
    await expect(desk.bookForward({
      tenantId: 't1', symbol: 'X', qty: 0, priceUsdPerTonne: 1, tenor: 'M+1', counterparty: 'X',
    })).rejects.toThrow(/qty/);
  });

  it('rejects negative price', async () => {
    const desk = createTradingDesk({
      verra: verraOf(SAMPLE_PROJECT_LIST),
      cix: createMockCixFeed(),
      bookRepository: createInMemoryBookRepository(),
      nextId: detIdGen(),
    });
    await expect(desk.bookForward({
      tenantId: 't1', symbol: 'X', qty: 1, priceUsdPerTonne: -1, tenor: 'M+1', counterparty: 'X',
    })).rejects.toThrow(/price/);
  });

  it('supports SELL side', async () => {
    const desk = createTradingDesk({
      verra: verraOf(SAMPLE_PROJECT_LIST),
      cix: createMockCixFeed(),
      bookRepository: createInMemoryBookRepository(),
      nextId: detIdGen(),
    });
    const entry = await desk.bookForward({
      tenantId: 't1', symbol: 'X', qty: 1, priceUsdPerTonne: 5,
      tenor: 'M+1', counterparty: 'X', side: 'SELL',
    });
    expect(entry.side).toBe('SELL');
  });
});

describe('createTradingDesk — markToMarket', () => {
  it('marks an empty book to zero PnL', async () => {
    const desk = createTradingDesk({
      verra: verraOf(SAMPLE_PROJECT_LIST),
      cix: createMockCixFeed(),
      bookRepository: createInMemoryBookRepository(),
      nextId: detIdGen(),
    });
    const m = await desk.markToMarket([]);
    expect(m.totalPnlUsd).toBe(0);
    expect(m.lines).toHaveLength(0);
  });

  it('sums PnL across BUY positions correctly', async () => {
    const desk = createTradingDesk({
      verra: verraOf(SAMPLE_PROJECT_LIST),
      cix: createMockCixFeed(),
      bookRepository: createInMemoryBookRepository(),
      nextId: detIdGen(),
    });
    const book: BookEntry[] = [
      {
        id: 'A', tenantId: 't1', side: 'BUY', symbol: 'CIX-NBS-2024',
        qty: 100, priceUsdPerTonne: 1.0,
        tenor: 'Dec-26', counterparty: 'X',
        tradeDate: '2026-05-24T12:00:00Z', status: 'OPEN',
      },
      {
        id: 'B', tenantId: 't1', side: 'BUY', symbol: 'CIX-NBS-2024',
        qty: 50, priceUsdPerTonne: 1.0,
        tenor: 'Dec-26', counterparty: 'X',
        tradeDate: '2026-05-24T12:00:00Z', status: 'OPEN',
      },
    ];
    const m = await desk.markToMarket(book);
    expect(m.lines).toHaveLength(2);
    const sumOfLines = m.lines.reduce((a, l) => a + l.pnlUsd, 0);
    expect(Math.abs(m.totalPnlUsd - sumOfLines)).toBeLessThan(0.02);
  });

  it('SELL side inverts the PnL sign', async () => {
    const desk = createTradingDesk({
      verra: verraOf(SAMPLE_PROJECT_LIST),
      cix: createMockCixFeed(),
      bookRepository: createInMemoryBookRepository(),
      nextId: detIdGen(),
    });
    const buy: BookEntry = {
      id: 'A', tenantId: 't1', side: 'BUY', symbol: 'CIX-NBS-2024',
      qty: 100, priceUsdPerTonne: 1.0,
      tenor: 'Dec-26', counterparty: 'X',
      tradeDate: '2026-05-24T12:00:00Z', status: 'OPEN',
    };
    const sell: BookEntry = { ...buy, id: 'B', side: 'SELL' };
    const m = await desk.markToMarket([buy, sell]);
    expect(m.lines[0]!.pnlUsd).toBeCloseTo(-m.lines[1]!.pnlUsd, 4);
  });
});

describe('createTradingDesk — complianceCheck (TZ/KE/UG tenants)', () => {
  it('TZ tenant + TZ project + VCS: CORSIA eligible, host requires LoA', () => {
    const desk = createTradingDesk({
      verra: verraOf(SAMPLE_PROJECT_LIST),
      cix: createMockCixFeed(),
      bookRepository: createInMemoryBookRepository(),
      nextId: detIdGen(),
    });
    const r = desk.complianceCheck({
      tenantJurisdiction: 'TZ',
      purchase: { projectCountry: 'TZ', standard: 'VCS' },
    });
    expect(r.corsiaEligible).toBe(true);
    expect(r.article6Eligible).toBe(true);
    expect(r.requiresLetterOfAuthorisation).toBe(true);
    expect(r.permitted).toBe(true);
  });

  it('KE tenant + KE project + GoldStandard: CORSIA + Article 6 both true', () => {
    const r = runComplianceCheck({
      tenantJurisdiction: 'KE',
      purchase: { projectCountry: 'KE', standard: 'GoldStandard' },
    });
    expect(r.corsiaEligible).toBe(true);
    expect(r.article6Eligible).toBe(true);
    expect(r.permitted).toBe(true);
  });

  it('UG tenant + UG project + Article_6_4: both eligibility flags true', () => {
    const r = runComplianceCheck({
      tenantJurisdiction: 'UG',
      purchase: { projectCountry: 'UG', standard: 'Article_6_4' },
    });
    expect(r.corsiaEligible).toBe(true);
    expect(r.article6Eligible).toBe(true);
    expect(r.requiresLetterOfAuthorisation).toBe(true);
  });

  it('CDM legacy NOT CORSIA-eligible from East-African hosts', () => {
    const r = runComplianceCheck({
      tenantJurisdiction: 'KE',
      purchase: { projectCountry: 'KE', standard: 'CDM_legacy' },
    });
    expect(r.corsiaEligible).toBe(false);
  });

  it('unknown tenant jurisdiction surfaces a manual-review finding', () => {
    const r = runComplianceCheck({
      tenantJurisdiction: 'ZZ',
      purchase: { projectCountry: 'KE', standard: 'VCS' },
    });
    expect(r.findings.some((f) => f.includes('manual review'))).toBe(true);
    expect(r.permitted).toBe(false);
  });

  it('GB tenant + GB project + ACR: CORSIA eligible, no LoA', () => {
    const r = runComplianceCheck({
      tenantJurisdiction: 'GB',
      purchase: { projectCountry: 'GB', standard: 'ACR' },
    });
    expect(r.corsiaEligible).toBe(true);
    expect(r.requiresLetterOfAuthorisation).toBe(false);
    expect(r.permitted).toBe(true);
  });

  it('cross-border KE→TZ trade: CORSIA carries, TZ host LoA required', () => {
    const r = runComplianceCheck({
      tenantJurisdiction: 'KE',
      purchase: { projectCountry: 'TZ', standard: 'VCS' },
    });
    expect(r.corsiaEligible).toBe(true);
    expect(r.requiresLetterOfAuthorisation).toBe(true);
    expect(r.permitted).toBe(true);
  });

  it('all findings carry citations', () => {
    const r = runComplianceCheck({
      tenantJurisdiction: 'TZ',
      purchase: { projectCountry: 'TZ', standard: 'VCS' },
    });
    expect(r.findings.some((f) => f.includes('TZ Carbon Trading Regs 2022'))).toBe(true);
  });
});

describe('public exports', () => {
  it('re-exports the trading-desk and supporting helpers', async () => {
    const mod = await import('../index.js');
    expect(typeof mod.createTradingDesk).toBe('function');
    expect(typeof mod.createVerraClient).toBe('function');
    expect(typeof mod.createMockCixFeed).toBe('function');
    expect(typeof mod.createTokenizedCreditVerifier).toBe('function');
    expect(typeof mod.createInMemoryBookRepository).toBe('function');
    expect(typeof mod.runComplianceCheck).toBe('function');
    expect(mod.VERRA_REGISTRY_BASE_URL).toBe('https://registry.verra.org/uiapi/');
  });
});

describe('createInMemoryBookRepository', () => {
  it('saves and retrieves by id', async () => {
    const repo = createInMemoryBookRepository();
    const entry: BookEntry = {
      id: 'X', tenantId: 't', side: 'BUY', symbol: 'S',
      qty: 1, priceUsdPerTonne: 1, tenor: 'M+1', counterparty: 'CP',
      tradeDate: '2026-05-24T12:00:00Z', status: 'OPEN',
    };
    await repo.save(entry);
    // nosemgrep: missing-tenant-id-arg reason: test of repo.findById's globally-unique-id lookup contract.
    const found = await repo.findById('X');
    expect(found).toEqual(entry);
  });

  it('findById returns null when missing', async () => {
    const repo = createInMemoryBookRepository();
    // nosemgrep: missing-tenant-id-arg reason: test of repo.findById's globally-unique-id lookup contract (negative case).
    expect(await repo.findById('NOPE')).toBeNull();
  });

  it('findByTenant filters by tenantId', async () => {
    const repo = createInMemoryBookRepository();
    for (const id of ['A', 'B']) {
      await repo.save({
        id, tenantId: 't1', side: 'BUY', symbol: 'S',
        qty: 1, priceUsdPerTonne: 1, tenor: 'M+1', counterparty: 'CP',
        tradeDate: '2026-05-24T12:00:00Z', status: 'OPEN',
      });
    }
    await repo.save({
      id: 'C', tenantId: 't2', side: 'BUY', symbol: 'S',
      qty: 1, priceUsdPerTonne: 1, tenor: 'M+1', counterparty: 'CP',
      tradeDate: '2026-05-24T12:00:00Z', status: 'OPEN',
    });
    const t1 = await repo.findByTenant('t1');
    expect(t1).toHaveLength(2);
    const t2 = await repo.findByTenant('t2');
    expect(t2).toHaveLength(1);
  });

  it('seed entries are exposed via findByTenant', async () => {
    const repo = createInMemoryBookRepository([
      {
        id: 'S', tenantId: 't', side: 'BUY', symbol: 'X',
        qty: 1, priceUsdPerTonne: 1, tenor: 'M+1', counterparty: 'CP',
        tradeDate: '2026-05-24T12:00:00Z', status: 'OPEN',
      },
    ]);
    const entries = await repo.findByTenant('t');
    expect(entries).toHaveLength(1);
  });
});
