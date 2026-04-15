import { describe, it, expect, vi } from 'vitest';
import {
  LoggingErrorReporter,
  createSentryReporter,
} from './error-reporter.js';
import { Logger } from '../logging/logger.js';

describe('LoggingErrorReporter', () => {
  it('captures exceptions via the logger', () => {
    const logger = new Logger({
      service: { name: 'test', version: '1', environment: 'development' },
      level: 'trace',
    });
    const spy = vi.spyOn(logger, 'error');
    const reporter = new LoggingErrorReporter(logger);
    const err = new Error('boom');
    reporter.captureException(err, { tenantId: 't1', userId: 'u1' });
    expect(spy).toHaveBeenCalled();
    expect(spy.mock.calls[0][0]).toBe('boom');
  });

  it('routes messages to the right log level', () => {
    const logger = new Logger({
      service: { name: 'test', version: '1', environment: 'development' },
      level: 'trace',
    });
    const warnSpy = vi.spyOn(logger, 'warn');
    const infoSpy = vi.spyOn(logger, 'info');
    const reporter = new LoggingErrorReporter(logger);
    reporter.captureMessage('careful', { severity: 'warning' });
    reporter.captureMessage('fyi');
    expect(warnSpy).toHaveBeenCalled();
    expect(infoSpy).toHaveBeenCalled();
  });
});

describe('createSentryReporter', () => {
  it('forwards exceptions and applies context tags', () => {
    const capture = vi.fn();
    const scope = {
      setTag: vi.fn(),
      setUser: vi.fn(),
      setExtra: vi.fn(),
      setFingerprint: vi.fn(),
      setLevel: vi.fn(),
    };
    const client = {
      captureException: capture,
      captureMessage: vi.fn(),
      withScope: (cb: (s: typeof scope) => void) => cb(scope),
    };

    const reporter = createSentryReporter(client);
    const err = new Error('oops');
    reporter.captureException(err, {
      tenantId: 't1',
      userId: 'u1',
      tags: { route: '/x' },
      fingerprint: ['same'],
      severity: 'fatal',
      extra: { extra1: 1 },
    });

    expect(capture).toHaveBeenCalledWith(err);
    expect(scope.setTag).toHaveBeenCalledWith('tenantId', 't1');
    expect(scope.setUser).toHaveBeenCalledWith({ id: 'u1' });
    expect(scope.setTag).toHaveBeenCalledWith('route', '/x');
    expect(scope.setFingerprint).toHaveBeenCalledWith(['same']);
    expect(scope.setLevel).toHaveBeenCalledWith('fatal');
    expect(scope.setExtra).toHaveBeenCalledWith('extra1', 1);
  });

  it('flushes via client.flush when available', async () => {
    const flush = vi.fn().mockResolvedValue(true);
    const reporter = createSentryReporter({
      captureException: vi.fn(),
      captureMessage: vi.fn(),
      flush,
    });
    await expect(reporter.flush(1000)).resolves.toBe(true);
    expect(flush).toHaveBeenCalledWith(1000);
  });
});
