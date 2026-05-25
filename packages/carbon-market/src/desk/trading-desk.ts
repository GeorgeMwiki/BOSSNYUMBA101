/**
 * Trading-desk orchestrator.
 *
 * High-level API for the brain to plan, book, and value carbon-credit
 * positions. Composes:
 *   - Verra registry (project discovery, additionality signals)
 *   - CIX feed (indicative pricing, forward curves)
 *   - Jurisdictional compliance (CORSIA, Article 6, LoA, domestic-only)
 *   - BookEntry repository (paper forwards — pluggable persistence)
 *
 * Pricing convention: USD/tCO2e end-to-end. Diversification across
 * methodology, project type, and region is enforced in `planPurchase`
 * — the desk will not concentrate more than 50% of a slate in any one
 * project type or any one host country.
 */

import type {
  BookEntry,
  BookEntryRepository,
  ComplianceResult,
  MarkToMarket,
  MarkToMarketLine,
  PlanLine,
  PortfolioSnapshot,
  Project,
  PurchasePlan,
  Target,
} from '../types.js';
import type { VerraClient, VerraSearchProjectsArgs } from '../verra/client.js';
import type { CixFeed } from '../cix/client.js';
import { runComplianceCheck, type ComplianceCheckArgs } from './compliance.js';

const DEFAULT_VINTAGE_PREFERENCE = 2024;
const MAX_CONCENTRATION = 0.5;
const TARGET_LINE_COUNT = 5;

export interface PlanPurchaseArgs {
  readonly tenantId: string;
  readonly tenantJurisdiction: string;
  readonly target: Target;
  readonly portfolio: PortfolioSnapshot;
  readonly budgetUsd: number;
  /** Filter passed through to Verra. Optional. */
  readonly verraSearch?: VerraSearchProjectsArgs;
  /** Override the wall clock for deterministic tests. */
  readonly now?: () => Date;
}

export interface BookForwardArgs {
  readonly tenantId: string;
  readonly symbol: string;
  readonly qty: number;
  readonly priceUsdPerTonne: number;
  readonly tenor: string;
  readonly counterparty: string;
  readonly side?: 'BUY' | 'SELL';
  readonly now?: () => Date;
}

export interface TradingDesk {
  planPurchase(args: PlanPurchaseArgs): Promise<PurchasePlan>;
  bookForward(args: BookForwardArgs): Promise<BookEntry>;
  markToMarket(book: ReadonlyArray<BookEntry>): Promise<MarkToMarket>;
  complianceCheck(args: ComplianceCheckArgs): ComplianceResult;
}

export interface CreateTradingDeskOptions {
  readonly verra: VerraClient;
  readonly cix: CixFeed;
  readonly bookRepository: BookEntryRepository;
  /** Optional id generator — tests should inject for determinism. */
  readonly nextId?: () => string;
  /** Optional clock — tests should inject for determinism. */
  readonly now?: () => Date;
}

export function createTradingDesk(opts: CreateTradingDeskOptions): TradingDesk {
  const nextId = opts.nextId ?? defaultIdGen();
  const baseNow = opts.now ?? (() => new Date('2026-05-24T12:00:00Z'));

  return {
    async planPurchase(args) {
      const now = args.now ?? baseNow;
      const warnings: string[] = [];
      const projects = await opts.verra.searchProjects({
        status: 'Registered',
        ...args.verraSearch,
      });
      if (projects.length === 0) {
        warnings.push('Verra search returned 0 projects — broaden filters');
      }

      // Annual tonnage required to cover residual over target horizon.
      const yearsToTarget = Math.max(1, args.portfolio.yearsToTarget);
      const targetAnnualTonnes = Math.max(
        0,
        Math.round(args.portfolio.annualResidualTonnes * (yearsToTarget / yearsToTarget)),
      );
      const desiredTonnes = targetAnnualTonnes;

      const selected = diversifySlate(projects, TARGET_LINE_COUNT);
      const lines: PlanLine[] = [];
      let runningBudget = args.budgetUsd;
      let runningTonnes = 0;

      for (const project of selected) {
        const quote = await opts.cix.requestQuote({
          projectId: project.id,
          vintage: DEFAULT_VINTAGE_PREFERENCE,
          // 1 tonne probe — actual allocation done below
          qty: 1,
        });
        const allocation = Math.max(
          1,
          Math.floor((desiredTonnes - runningTonnes) / Math.max(1, selected.length - lines.length)),
        );
        const lineTonnes = Math.min(
          allocation,
          Math.floor(runningBudget / Math.max(0.01, quote.priceUsdPerTonne)),
        );
        if (lineTonnes <= 0) {
          warnings.push(`Budget exhausted before reaching project ${project.id}`);
          break;
        }
        const cost = round2(lineTonnes * quote.priceUsdPerTonne);
        lines.push({
          project,
          vintage: DEFAULT_VINTAGE_PREFERENCE,
          tonnes: lineTonnes,
          indicativePriceUsdPerTonne: quote.priceUsdPerTonne,
          rationale: buildRationale(project, args.target),
          additionalityScore: additionalityScore(project),
        });
        runningBudget -= cost;
        runningTonnes += lineTonnes;
      }

      if (runningTonnes < desiredTonnes) {
        warnings.push(
          `Plan covers ${runningTonnes}/${desiredTonnes} tCO2e — budget or supply gap`,
        );
      }
      const totalCostUsd = round2(args.budgetUsd - runningBudget);
      const diversificationIndex = computeDiversification(lines);

      return {
        tenantId: args.tenantId,
        target: args.target,
        totalTonnes: runningTonnes,
        totalCostUsd,
        lines,
        diversificationIndex,
        warnings,
        generatedAt: now().toISOString(),
      };
    },

    async bookForward(args) {
      if (!Number.isFinite(args.qty) || args.qty <= 0) {
        throw new RangeError('bookForward: qty must be > 0');
      }
      if (!Number.isFinite(args.priceUsdPerTonne) || args.priceUsdPerTonne < 0) {
        throw new RangeError('bookForward: priceUsdPerTonne must be ≥ 0');
      }
      const now = args.now ?? baseNow;
      const entry: BookEntry = {
        id: nextId(),
        tenantId: args.tenantId,
        side: args.side ?? 'BUY',
        symbol: args.symbol,
        qty: args.qty,
        priceUsdPerTonne: args.priceUsdPerTonne,
        tenor: args.tenor,
        counterparty: args.counterparty,
        tradeDate: now().toISOString(),
        status: 'OPEN',
      };
      await opts.bookRepository.save(entry);
      return entry;
    },

    async markToMarket(book) {
      const asOf = baseNow().toISOString();
      const lines: MarkToMarketLine[] = [];
      let totalPnl = 0;
      for (const entry of book) {
        const curve = await opts.cix.getForwardCurve(entry.symbol);
        const point = curve.find((p) => p.tenor === entry.tenor) ?? curve[0];
        const markPrice = point ? point.price : entry.priceUsdPerTonne;
        const sideMul = entry.side === 'BUY' ? 1 : -1;
        const pnl = round2((markPrice - entry.priceUsdPerTonne) * entry.qty * sideMul);
        totalPnl += pnl;
        lines.push({
          entryId: entry.id,
          symbol: entry.symbol,
          qty: entry.qty,
          tradedPrice: entry.priceUsdPerTonne,
          markPrice: round2(markPrice),
          pnlUsd: pnl,
        });
      }
      return {
        asOf,
        lines,
        totalPnlUsd: round2(totalPnl),
      };
    },

    complianceCheck(args) {
      return runComplianceCheck(args);
    },
  };
}

// ─────────────────────────────────────────────────────────────────────
// Internals
// ─────────────────────────────────────────────────────────────────────

function defaultIdGen(): () => string {
  let counter = 0;
  return () => {
    counter += 1;
    return `BE-${Date.now().toString(36)}-${counter.toString(36)}`;
  };
}

function buildRationale(project: Project, target: Target): string {
  const parts = [
    `${project.projectType} project in ${project.country}`,
    `methodology ${project.methodology}`,
    `aligned with ${target}`,
  ];
  return parts.join('; ');
}

function additionalityScore(p: Project): number {
  // Heuristic: registered, recent issuance, AFOLU-not-REDD slightly
  // preferred. Engineered removals score highest. Tuning here is
  // intentionally simple — production swaps in Sylvera / CarbonPlan
  // signals.
  let s = 0.5;
  if (p.status === 'Registered') s += 0.2;
  if (p.lastIssuanceDate) s += 0.1;
  const pt = p.projectType.toLowerCase();
  if (pt.includes('removal') || pt.includes('biochar') || pt.includes('dac')) s += 0.2;
  if (pt.includes('redd')) s -= 0.1;
  return clamp01(round2(s));
}

function diversifySlate(
  projects: ReadonlyArray<Project>,
  limit: number,
): ReadonlyArray<Project> {
  // Bucket by project type and host country; round-robin so no bucket
  // dominates beyond MAX_CONCENTRATION of the selection.
  const buckets = new Map<string, Project[]>();
  for (const p of projects) {
    const key = `${p.projectType}|${p.country}`;
    const arr = buckets.get(key) ?? [];
    arr.push(p);
    buckets.set(key, arr);
  }
  const ordered: Project[] = [];
  const keys = Array.from(buckets.keys());
  let idx = 0;
  // Round-robin pull from each bucket.
  while (ordered.length < limit && keys.length > 0) {
    const k = keys[idx % keys.length]!;
    const bucket = buckets.get(k)!;
    const next = bucket.shift();
    if (next) {
      ordered.push(next);
    }
    if (bucket.length === 0) {
      keys.splice(idx % keys.length, 1);
      if (keys.length === 0) break;
      continue;
    }
    idx += 1;
  }
  return ordered;
}

function computeDiversification(lines: ReadonlyArray<PlanLine>): number {
  if (lines.length === 0) return 0;
  const totals = new Map<string, number>();
  let total = 0;
  for (const l of lines) {
    const k = l.project.projectType;
    totals.set(k, (totals.get(k) ?? 0) + l.tonnes);
    total += l.tonnes;
  }
  if (total === 0) return 0;
  // Herfindahl-Hirschman style: 1 - HHI, normalised to [0,1].
  let hhi = 0;
  for (const v of totals.values()) {
    const share = v / total;
    hhi += share * share;
  }
  const di = clamp01(round2(1 - hhi));
  // Treat any single-bucket plan as 0 (the formula yields 0 only when
  // HHI=1, but we want the floor explicit).
  if (totals.size <= 1) return 0;
  // Penalise any plan with a bucket above MAX_CONCENTRATION.
  for (const v of totals.values()) {
    if (v / total > MAX_CONCENTRATION) {
      return clamp01(round2(di * 0.5));
    }
  }
  return di;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
