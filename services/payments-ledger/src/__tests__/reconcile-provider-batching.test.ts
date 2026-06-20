/**
 * Scale-hardening detectors for ReconciliationService.reconcileWithProvider.
 *
 * The method used to load an UNBOUNDED set of PROCESSING payments and make
 * one external provider call EACH, serially. These tests pin the new
 * behaviour:
 *   1. A cap (`maxToProcess`) bounds how many intents are processed per run.
 *   2. The repo is asked for `cap + 1` so a "more remains" signal is cheap.
 *   3. `limited` is true exactly when the backlog exceeds the cap.
 *   4. Provider calls fan out with BOUNDED concurrency (backpressure) — the
 *      number of in-flight provider calls never exceeds `concurrency`.
 *
 * The test uses lightweight stubs implementing only the surface the method
 * touches, so it is a pure scaling/backpressure detector independent of the
 * full PaymentIntent aggregate.
 */
import { describe, it, expect, vi } from 'vitest';
import { ReconciliationService } from '../services/reconciliation.service';

// --- Stubs -----------------------------------------------------------------

const PROVIDER = 'mpesa';

interface StubPayment {
  id: string;
  status: string;
  providerName: string;
  externalId: string;
  createdAt: Date;
}

function makePayments(n: number): StubPayment[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `pi_${i}`,
    status: 'PROCESSING',
    providerName: PROVIDER,
    externalId: `ext_${i}`,
    createdAt: new Date(Date.now() - 60 * 60 * 1000),
  }));
}

function buildService(opts: {
  backlog: StubPayment[];
  onProviderCall?: () => void;
  providerDelayMs?: number;
}) {
  const captured: { requestedLimit?: number } = {};

  const paymentIntentRepository = {
    findNeedingReconciliation: vi.fn(
      async (_tenantId: string, _olderThan: Date, limit?: number) => {
        captured.requestedLimit = limit;
        const rows =
          limit !== undefined ? opts.backlog.slice(0, limit) : opts.backlog;
        return rows as unknown as never[];
      },
    ),
    update: vi.fn(async () => undefined),
  };

  // Provider returns the SAME status the payment already has, so no
  // aggregate update path is exercised — we only measure call fan-out.
  const provider = {
    name: PROVIDER,
    getPaymentIntentStatus: vi.fn(async () => {
      opts.onProviderCall?.();
      if (opts.providerDelayMs) {
        await new Promise((r) => setTimeout(r, opts.providerDelayMs));
      }
      return { status: 'PROCESSING' as never };
    }),
  };

  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };

  const service = new ReconciliationService({
    paymentIntentRepository: paymentIntentRepository as never,
    ledgerRepository: {} as never,
    accountRepository: {} as never,
    eventPublisher: {} as never,
    logger: logger as never,
  });
  service.registerProvider(provider as never);

  return { service, provider, paymentIntentRepository, captured };
}

// --- Tests -----------------------------------------------------------------

describe('reconcileWithProvider — scale + backpressure', () => {
  it('caps the number of intents processed per invocation', async () => {
    const { service, provider } = buildService({ backlog: makePayments(50) });

    const result = await service.reconcileWithProvider(
      't1' as never,
      PROVIDER,
      30,
      { maxToProcess: 10, concurrency: 5 },
    );

    expect(result.checked).toBe(10);
    expect(provider.getPaymentIntentStatus).toHaveBeenCalledTimes(10);
  });

  it('requests cap+1 from the repo and flags `limited` when backlog exceeds cap', async () => {
    const { service, captured } = buildService({ backlog: makePayments(50) });

    const result = await service.reconcileWithProvider(
      't1' as never,
      PROVIDER,
      30,
      { maxToProcess: 10 },
    );

    // cap + 1 fetch so "more remains" is known without a 2nd query.
    expect(captured.requestedLimit).toBe(11);
    expect(result.limited).toBe(true);
  });

  it('does NOT flag `limited` when the backlog fits under the cap', async () => {
    const { service } = buildService({ backlog: makePayments(3) });

    const result = await service.reconcileWithProvider(
      't1' as never,
      PROVIDER,
      30,
      { maxToProcess: 10 },
    );

    expect(result.limited).toBe(false);
    expect(result.checked).toBe(3);
  });

  it('never exceeds the concurrency ceiling of in-flight provider calls (backpressure)', async () => {
    let inFlight = 0;
    let peak = 0;

    // Provider stub that holds the call "in flight" across an await, so the
    // scheduler can overlap as many as the fan-out permits. The decrement
    // happens only after the delay resolves — giving an accurate peak.
    const provider = {
      name: PROVIDER,
      getPaymentIntentStatus: vi.fn(async () => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await new Promise((r) => setTimeout(r, 5));
        inFlight -= 1;
        return { status: 'PROCESSING' as never };
      }),
    };

    const service = new ReconciliationService({
      paymentIntentRepository: {
        findNeedingReconciliation: vi.fn(async (_t, _o, limit?: number) =>
          makePayments(40).slice(0, limit ?? 40) as unknown as never[],
        ),
        update: vi.fn(async () => undefined),
      } as never,
      ledgerRepository: {} as never,
      accountRepository: {} as never,
      eventPublisher: {} as never,
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as never,
    });
    service.registerProvider(provider as never);

    await service.reconcileWithProvider('t1' as never, PROVIDER, 30, {
      maxToProcess: 40,
      concurrency: 4,
    });

    // Peak concurrent provider calls must respect the ceiling exactly.
    expect(peak).toBeGreaterThan(1); // proves it DID parallelise within a slice
    expect(peak).toBeLessThanOrEqual(4);
    expect(provider.getPaymentIntentStatus).toHaveBeenCalledTimes(40);
  });

  it('falls back to safe defaults for non-positive / non-finite caps', async () => {
    const { service, captured } = buildService({ backlog: makePayments(5) });

    await service.reconcileWithProvider('t1' as never, PROVIDER, 30, {
      maxToProcess: 0,
      concurrency: -3,
    });

    // 0 / negative coerced to the default cap (500) -> fetch is 501.
    expect(captured.requestedLimit).toBe(501);
  });
});
