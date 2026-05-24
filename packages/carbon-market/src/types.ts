/**
 * Public types for `@bossnyumba/carbon-market`.
 *
 * Pure type module — no runtime. Every type is `readonly` end-to-end so
 * consumers cannot mutate market data, book entries, or compliance
 * results after they are produced.
 *
 * Pricing convention: all monetary values are USD/tCO2e unless the
 * field name carries an explicit currency suffix (none yet exposed —
 * the desk normalises to USD before mark-to-market). One credit = one
 * tonne of CO2 equivalent, per VCS / Gold Standard / Article 6 rules.
 */

// ─────────────────────────────────────────────────────────────────────
// Reused identifiers
// ─────────────────────────────────────────────────────────────────────

/** ISO-3166-1 alpha-2 country code (e.g. 'TZ', 'KE', 'UG'). */
export type CountryCode = string;

/** Verra project status — a small, finite enum lifted from their UI. */
export type VerraStatus =
  | 'Registered'
  | 'Under Validation'
  | 'Under Development'
  | 'Withdrawn'
  | 'Rejected'
  | 'On Hold';

/** Carbon-credit standard family. */
export type CreditStandard =
  | 'VCS'           // Verra
  | 'GoldStandard'
  | 'ACR'           // American Carbon Registry
  | 'CAR'           // Climate Action Reserve
  | 'Article_6_4'   // UN PACM
  | 'CDM_legacy';

// ─────────────────────────────────────────────────────────────────────
// Verra registry shapes
// ─────────────────────────────────────────────────────────────────────

export interface Project {
  readonly id: string;                  // Verra project ID, e.g. '1234'
  readonly name: string;
  readonly country: CountryCode;
  /** Methodology code, e.g. 'VM0007', 'AMS-III.AV'. */
  readonly methodology: string;
  readonly projectType: string;         // e.g. 'AFOLU', 'Energy efficiency'
  readonly status: VerraStatus;
  readonly registryUrl: string;
  readonly proponent: string;
  /** Date of latest issuance, ISO; null if never issued. */
  readonly lastIssuanceDate: string | null;
  /** Cumulative issued credits in tCO2e. */
  readonly totalIssuedTonnes: number;
}

export interface Issuance {
  readonly projectId: string;
  readonly serialNumber: string;
  readonly vintage: number;             // e.g. 2024
  readonly tonnes: number;
  readonly issuanceDate: string;        // ISO
  readonly retired: boolean;
}

export interface Credit {
  readonly serialNumber: string;
  readonly projectId: string;
  readonly standard: CreditStandard;
  readonly vintage: number;
  readonly tonnes: number;
  readonly retired: boolean;
}

// ─────────────────────────────────────────────────────────────────────
// CIX feed shapes
// ─────────────────────────────────────────────────────────────────────

export interface SpotPrice {
  readonly symbol: string;              // e.g. 'CIX-NBS-2024' or 'EUA-DEC26'
  readonly bid: number;                 // USD/tCO2e
  readonly ask: number;
  readonly ts: string;                  // ISO timestamp
}

export interface ForwardPoint {
  readonly tenor: string;               // e.g. 'Dec-26', '2027', 'M+6'
  readonly price: number;               // USD/tCO2e
}

export interface QuoteRequest {
  readonly projectId: string;
  readonly vintage: number;
  readonly qty: number;                 // tCO2e
}

export interface Quote {
  readonly projectId: string;
  readonly vintage: number;
  readonly qty: number;
  readonly priceUsdPerTonne: number;
  readonly validUntil: string;          // ISO
  readonly counterparty: string;        // CIX desk name / pseudonym
}

// ─────────────────────────────────────────────────────────────────────
// Tokenization shapes
// ─────────────────────────────────────────────────────────────────────

export type EvmChain = 'polygon' | 'celo' | 'ethereum' | 'base';

export interface TokenizedCreditRef {
  readonly chain: EvmChain;
  readonly contractAddress: string;
  readonly tokenId: string;
}

export interface TokenMetadata {
  /** ERC721/1155 metadata. Toucan exposes `{ projectVintageTokenId, serialNumber }`. */
  readonly underlyingSerial: string;
  readonly projectId: string;
  readonly vintage: number;
  readonly issuer: 'Toucan' | 'KlimaDAO' | 'Moss' | 'C3' | 'Unknown';
}

export interface TokenizedVerificationResult {
  readonly ref: TokenizedCreditRef;
  readonly metadata: TokenMetadata;
  /** Registry record found for the underlying serial. */
  readonly registryMatch: Project | null;
  /** True if registry shows the serial as retired (already cancelled). */
  readonly underlyingRetired: boolean;
  /** True if more than one on-chain token reports the same serial. */
  readonly doubleCountFlag: boolean;
  /** Human-readable narrative of the verification chain. */
  readonly narrative: ReadonlyArray<string>;
}

// ─────────────────────────────────────────────────────────────────────
// Trading-desk shapes
// ─────────────────────────────────────────────────────────────────────

export type Target =
  | 'net-zero-by-2030'
  | 'net-zero-by-2040'
  | 'net-zero-by-2050';

export interface PortfolioSnapshot {
  /** Annual residual emissions in tCO2e after on-site abatement. */
  readonly annualResidualTonnes: number;
  /** Distribution of credit types already held (sum need not = 1). */
  readonly heldByType: Readonly<Record<string, number>>;
  /** Years between today and the net-zero target year. */
  readonly yearsToTarget: number;
}

export interface PlanLine {
  readonly project: Project;
  readonly vintage: number;
  readonly tonnes: number;
  readonly indicativePriceUsdPerTonne: number;
  readonly rationale: string;
  /** 0..1 — higher = lower additionality risk. */
  readonly additionalityScore: number;
}

export interface PurchasePlan {
  readonly tenantId: string;
  readonly target: Target;
  readonly totalTonnes: number;
  readonly totalCostUsd: number;
  readonly lines: ReadonlyArray<PlanLine>;
  /** Methodology / type / region diversification index (0..1). */
  readonly diversificationIndex: number;
  readonly warnings: ReadonlyArray<string>;
  readonly generatedAt: string;
}

export interface BookEntry {
  readonly id: string;
  readonly tenantId: string;
  readonly side: 'BUY' | 'SELL';
  readonly symbol: string;
  readonly qty: number;
  readonly priceUsdPerTonne: number;
  readonly tenor: string;                   // e.g. 'Dec-26'
  readonly counterparty: string;
  readonly tradeDate: string;               // ISO
  readonly status: 'OPEN' | 'SETTLED' | 'CANCELLED';
}

export interface BookEntryRepository {
  save(entry: BookEntry): Promise<void>;
  findByTenant(tenantId: string): Promise<ReadonlyArray<BookEntry>>;
  findById(id: string): Promise<BookEntry | null>;
}

export interface MarkToMarketLine {
  readonly entryId: string;
  readonly symbol: string;
  readonly qty: number;
  readonly tradedPrice: number;
  readonly markPrice: number;
  readonly pnlUsd: number;                  // (mark - traded) * qty * side
}

export interface MarkToMarket {
  readonly asOf: string;
  readonly lines: ReadonlyArray<MarkToMarketLine>;
  readonly totalPnlUsd: number;
}

export interface ComplianceResult {
  readonly tenantJurisdiction: CountryCode;
  readonly purchase: { readonly projectCountry: CountryCode; readonly standard: CreditStandard };
  /** Eligible under ICAO CORSIA Phase II. */
  readonly corsiaEligible: boolean;
  /** Eligible for Article 6.2 internationally-transferred mitigation outcomes. */
  readonly article6Eligible: boolean;
  /** Whether the host country requires a Letter of Authorisation for export. */
  readonly requiresLetterOfAuthorisation: boolean;
  /** Whether the tenant jurisdiction restricts purchases to domestic credits. */
  readonly domesticOnlyRule: boolean;
  /** Whether the proposed trade is permitted overall. */
  readonly permitted: boolean;
  readonly findings: ReadonlyArray<string>;
}

// ─────────────────────────────────────────────────────────────────────
// HTTP transport port (injectable for tests)
// ─────────────────────────────────────────────────────────────────────

export interface HttpRequestOptions {
  readonly timeoutMs?: number;
  readonly headers?: Readonly<Record<string, string>>;
}

export interface HttpTransport {
  /**
   * Perform a GET request and return the parsed JSON body. Implementations
   * must surface non-2xx as an Error and propagate AbortError when the
   * timeout elapses.
   */
  get(url: string, opts?: HttpRequestOptions): Promise<unknown>;
}

// ─────────────────────────────────────────────────────────────────────
// EVM reader port (injectable for tests)
// ─────────────────────────────────────────────────────────────────────

export interface EvmReader {
  /**
   * Read an arbitrary token URI from an ERC-721 / ERC-1155 contract. The
   * return value should be the JSON body referenced by the URI (the
   * adapter is responsible for any IPFS/Arweave gateway resolution).
   */
  tokenURI(ref: TokenizedCreditRef): Promise<unknown>;
}
