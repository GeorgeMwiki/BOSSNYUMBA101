/**
 * Mock-data-coverage allow-list.
 *
 * Production files that legitimately reference `mockData`, `MOCK_<NAME>`,
 * or import from `__mocks__/` outside of `__fixtures__/` and `__tests__/`
 * directories. Test files and fixture files are auto-allowlisted by the
 * scanner (any `*.test.ts`, `*.spec.ts`, `*.fixture.ts`, or any file under
 * `__tests__/` / `__fixtures__/` / `__mocks__/`).
 *
 * Legitimate categories:
 *   1. HTTP header constants asking an upstream API for a mock response
 *      (e.g. `X-MOCK-MARKET-DATA` sent to Airbnb / Zillow sandbox).
 *   2. Empty-array sentinels exported as bootstrap defaults (e.g.
 *      `MOCK_PAYMENTS: Payment[] = []`). Pending rename to drop the
 *      misleading `MOCK_` prefix (Docs/TODO_BACKLOG.md).
 *
 * Adding a new mock fixture to production code → register here with a
 * justification ≥ 8 characters explaining why production needs it.
 *
 * Note: identifiers like `USE_MOCK_DATA` (the env-flag NAME, not a fixture
 * body) are NOT flagged because the `\bMOCK_` regex requires a word
 * boundary BEFORE `MOCK_`, which doesn't fire after `USE_`.
 *
 * Keys are paths RELATIVE to the repo root.
 */

export const MOCK_DATA_ALLOWLIST = new Map([
  // ─── Upstream-sandbox HTTP header constants ────────────────────────
  [
    'packages/market-intelligence/src/adapters/airbnb.ts',
    'X-MOCK-MARKET-DATA HTTP header constant for Airbnb sandbox responses; not local data.',
  ],
  [
    'packages/market-intelligence/src/adapters/zillow.ts',
    'X-MOCK-MARKET-DATA HTTP header constant for Zillow sandbox responses; not local data.',
  ],

  // ─── Empty-array bootstrap sentinels ───────────────────────────────
  [
    'apps/customer-app/src/lib/payments-data.ts',
    'MOCK_PAYMENTS export is an empty Payment[] sentinel; pending rename to PAYMENTS_BOOTSTRAP.',
  ],
]);

/**
 * Fabricated-record structural-pass allow-list (J7.1).
 *
 * Genuinely-static config arrays under an `apps/* /src/app/**` surface that
 * the structural pass would otherwise inspect, and which a maintainer has
 * confirmed carry NO fabricated business identifiers/figures (option lists,
 * taxonomies, document-type checklists, i18n-driven copy). Keys are paths
 * RELATIVE to the repo root; each value is a justification ≥ 8 chars.
 *
 * In practice the structural pass is narrow enough (requires a meter/account
 * number, currency amount, named property, or concrete date) that almost no
 * legitimate config matches — keep this list empty unless a real false
 * positive appears, and prefer fixing the heuristic over allowlisting.
 */
export const FABRICATED_RECORD_ALLOWLIST = new Map([
  // (intentionally empty — the heuristic is value-signal-gated and should
  //  not fire on static config; add a justified entry only on a confirmed
  //  false positive.)
]);

/**
 * Fabricated-record TRACKED list (J7.1) — in-flight fixes owned elsewhere.
 *
 * These files DO contain fabricated-record arrays that a fresh real user
 * would hit, and they are being removed / wired-to-real-data by a parallel
 * fix. The scanner DETECTS them (proving the class is now enforced) and
 * reports them as TRACKED, but they do NOT fail the gate while the fix is
 * in flight. The moment the fabricated array is gone, the entry becomes
 * STALE and the gate fails until the tracker is deleted — so this can never
 * silently rot into a permanent exception.
 *
 * Keys are paths RELATIVE to repo root; values point at the owning fix.
 */
export const FABRICATED_RECORD_TRACKED = new Map([
  // (empty — the no-mock onboarding fix landed: UTILITY_SETUPS and
  //  INITIAL_METER_READINGS fabricated-meter arrays are gone, wired to the
  //  real meter-data path. Trackers removed per the self-cleaning contract
  //  above — a stale tracker fails the gate, so this list must stay accurate.)
]);
