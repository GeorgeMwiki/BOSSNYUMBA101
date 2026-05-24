/**
 * `@bossnyumba/carbon-market` — public surface.
 *
 * Trading-desk layer that complements `@bossnyumba/sustainability-advisor`:
 *   - Verra (VCS) registry read client with retries + timeout
 *   - Climate Impact X (CIX) spot/forward feed adapter contract +
 *     deterministic mock implementation
 *   - On-chain tokenized-credit verifier (Toucan/KlimaDAO/Moss/C3)
 *   - Trading desk that plans purchases, books forwards, marks-to-market,
 *     and enforces jurisdictional compliance (CORSIA, Article 6.x,
 *     domestic-only)
 */

// Types
export * from './types.js';

// Verra
export {
  createVerraClient,
  createFetchTransport,
  DEFAULT_TIMEOUT_MS,
  RETRY_DELAYS_MS,
  VERRA_REGISTRY_BASE_URL,
  type CreateVerraClientOptions,
  type VerraClient,
  type VerraSearchIssuancesArgs,
  type VerraSearchProjectsArgs,
} from './verra/client.js';
export {
  VerraError,
  VerraHttpError,
  VerraParseError,
  VerraTimeoutError,
} from './verra/errors.js';
export {
  IssuanceListSchema,
  ProjectListSchema,
  RawIssuanceSchema,
  RawProjectSchema,
  VerraStatusSchema,
  type RawIssuance,
  type RawProject,
} from './verra/schemas.js';

// CIX
export {
  createMockCixFeed,
  CIX_PUBLIC_SITE_URL,
  type CixFeed,
  type MockCixFeedOptions,
} from './cix/client.js';

// Tokenization
export {
  createTokenizedCreditVerifier,
  type CreateTokenizedVerifierOptions,
  type TokenizedVerifier,
} from './tokenization/verifier.js';

// Trading desk
export {
  createTradingDesk,
  type BookForwardArgs,
  type CreateTradingDeskOptions,
  type PlanPurchaseArgs,
  type TradingDesk,
} from './desk/trading-desk.js';
export {
  runComplianceCheck,
  PROJECT_HOST_RULES,
  TENANT_JURISDICTION_RULES,
  type ComplianceCheckArgs,
} from './desk/compliance.js';
export {
  createInMemoryBookRepository,
} from './desk/in-memory-book-repository.js';
