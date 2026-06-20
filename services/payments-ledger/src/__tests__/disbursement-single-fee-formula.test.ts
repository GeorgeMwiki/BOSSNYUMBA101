/**
 * Finding 5 (MED) — exactly ONE platform-fee formula.
 *
 * `DisbursementService.calculatePlatformFee` used percent × amount / 100 with
 * Math.ROUND; the canonical engine `calculatePlatformFeeMinor(amountMinor, bps)`
 * uses basis points with Math.FLOOR. Two formulas on the money path meant the
 * fee a disbursement computed could differ by a minor unit from what the payment
 * path charged. The divergent method was DELETED and `calculateNetAmount` now
 * routes through the canonical engine (bps + floor).
 *
 * These tests pin:
 *   1. `calculateNetAmount` floors (canonical), not rounds, at a value where the
 *      two disagree — proving the old round-based formula is gone.
 *   2. The divergent `calculatePlatformFee` method no longer exists on the
 *      service (there is exactly one formula).
 *   3. `calculateNetAmount` matches the canonical `calculatePlatformFeeMinor`
 *      for arbitrary inputs (single source of truth).
 */
import { describe, it, expect } from 'vitest';
import {
  Money,
  type CurrencyCode,
} from '@bossnyumba/domain-models';
import { DisbursementService } from '../services/disbursement.service';
import { calculatePlatformFeeMinor } from '../lib/platform-fee';
import { InMemoryAccountRepository } from '../repositories/account.repository';
import { InMemoryDisbursementRepository } from '../repositories/disbursement.repository';
import { InMemoryLedgerRepository } from '../repositories/ledger.repository';
import { InMemoryEventPublisher } from '../events/event-publisher';
import { LedgerService } from '../services/ledger.service';

const CUR = 'TZS' as CurrencyCode;
const silentLogger = { info: () => undefined, warn: () => undefined, error: () => undefined };

function makeService(): DisbursementService {
  const accountRepository = new InMemoryAccountRepository();
  const ledgerService = new LedgerService({
    ledgerRepository: new InMemoryLedgerRepository(),
    accountRepository,
    eventPublisher: new InMemoryEventPublisher(),
    logger: silentLogger,
  });
  return new DisbursementService({
    accountRepository,
    disbursementRepository: new InMemoryDisbursementRepository(),
    ledgerService,
    eventPublisher: new InMemoryEventPublisher(),
    logger: silentLogger,
  });
}

describe('DisbursementService uses the single canonical fee formula (Finding 5)', () => {
  it('FLOORS (canonical bps), not rounds — at a value where floor !== round', () => {
    const service = makeService();
    // 100_020 minor at 250 bps (2.5%) → (100020 * 250) / 10000 = 2500.5.
    //   canonical floor → 2500.  old percent/round → round(2500.5) = 2501.
    const gross = Money.fromMinorUnits(100_020, CUR);
    const { platformFee, net } = service.calculateNetAmount(gross, 250);

    expect(platformFee.amountMinorUnits).toBe(2500); // floor, NOT 2501
    expect(net.amountMinorUnits).toBe(100_020 - 2500);
  });

  it('no longer exposes the divergent calculatePlatformFee method', () => {
    const service = makeService();
    expect(
      (service as unknown as { calculatePlatformFee?: unknown }).calculatePlatformFee,
    ).toBeUndefined();
  });

  it('matches the canonical engine across arbitrary inputs (one source of truth)', () => {
    const service = makeService();
    const cases: Array<[number, number]> = [
      [1, 500],
      [99, 1],
      [123_456, 250],
      [1_000_000, 9999],
      [7, 10000],
    ];
    for (const [amountMinor, bps] of cases) {
      const gross = Money.fromMinorUnits(amountMinor, CUR);
      const { platformFee } = service.calculateNetAmount(gross, bps);
      expect(platformFee.amountMinorUnits).toBe(
        calculatePlatformFeeMinor(amountMinor, bps),
      );
    }
  });
});
