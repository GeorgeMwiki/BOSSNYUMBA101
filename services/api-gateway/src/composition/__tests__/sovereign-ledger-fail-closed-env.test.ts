/**
 * Wave-B SOVEREIGN-LEDGER-FAIL-CLOSED env-reader contract.
 *
 * `readSovereignLedgerFailClosedFromEnv` is the single canonical
 * composition-time read of the sovereign-tier audit-write policy. The
 * Wave-B owner-approved inversion makes fail-CLOSED the SAFE DEFAULT:
 * an unset env yields `true`. The legacy fail-OPEN behaviour is reachable
 * ONLY via an explicit opt-out (`SOVEREIGN_LEDGER_FAIL_OPEN=1`, or the
 * inverse spelling `SOVEREIGN_LEDGER_FAIL_CLOSED=false`).
 *
 * These are the live detectors for the inverted default — they MUST
 * fail if a future change reverts the env reader to defaulting `false`.
 */
import { describe, it, expect } from 'vitest';
import { readSovereignLedgerFailClosedFromEnv } from '../service-registry.js';

describe('readSovereignLedgerFailClosedFromEnv — Wave-B fail-closed default', () => {
  it('unset env → fail-CLOSED (true) [the safe Wave-B default]', () => {
    expect(readSovereignLedgerFailClosedFromEnv({})).toBe(true);
  });

  it('empty / whitespace SOVEREIGN_LEDGER_FAIL_CLOSED → fail-CLOSED (true)', () => {
    expect(
      readSovereignLedgerFailClosedFromEnv({ SOVEREIGN_LEDGER_FAIL_CLOSED: '' }),
    ).toBe(true);
    expect(
      readSovereignLedgerFailClosedFromEnv({ SOVEREIGN_LEDGER_FAIL_CLOSED: '   ' }),
    ).toBe(true);
  });

  it.each(['true', '1', 'yes', 'on', 'TRUE', 'On', ' 1 '])(
    'SOVEREIGN_LEDGER_FAIL_CLOSED=%s → fail-CLOSED (true)',
    (value) => {
      expect(
        readSovereignLedgerFailClosedFromEnv({
          SOVEREIGN_LEDGER_FAIL_CLOSED: value,
        }),
      ).toBe(true);
    },
  );

  it.each(['false', '0', 'no', 'off', 'FALSE', 'Off', ' 0 '])(
    'SOVEREIGN_LEDGER_FAIL_CLOSED=%s → explicit fail-OPEN opt-out (false)',
    (value) => {
      expect(
        readSovereignLedgerFailClosedFromEnv({
          SOVEREIGN_LEDGER_FAIL_CLOSED: value,
        }),
      ).toBe(false);
    },
  );

  it.each(['1', 'true', 'yes', 'on'])(
    'SOVEREIGN_LEDGER_FAIL_OPEN=%s → explicit legacy back-compat opt-out (false)',
    (value) => {
      expect(
        readSovereignLedgerFailClosedFromEnv({
          SOVEREIGN_LEDGER_FAIL_OPEN: value,
        }),
      ).toBe(false);
    },
  );

  it('SOVEREIGN_LEDGER_FAIL_OPEN wins over SOVEREIGN_LEDGER_FAIL_CLOSED=true', () => {
    // The explicit opt-out flag takes precedence even when the
    // fail-closed flag is also truthy.
    expect(
      readSovereignLedgerFailClosedFromEnv({
        SOVEREIGN_LEDGER_FAIL_OPEN: '1',
        SOVEREIGN_LEDGER_FAIL_CLOSED: 'true',
      }),
    ).toBe(false);
  });

  it('SOVEREIGN_LEDGER_FAIL_OPEN=0 (falsy) does NOT force open → fail-CLOSED', () => {
    // Only a TRUTHY fail-open flag opts out; a falsy one is ignored and
    // the safe default applies.
    expect(
      readSovereignLedgerFailClosedFromEnv({ SOVEREIGN_LEDGER_FAIL_OPEN: '0' }),
    ).toBe(true);
  });

  it('unrecognised value → fail-CLOSED (true) [safe default]', () => {
    expect(
      readSovereignLedgerFailClosedFromEnv({
        SOVEREIGN_LEDGER_FAIL_CLOSED: 'maybe',
      }),
    ).toBe(true);
  });
});
