/**
 * H-2: identity logger must NOT emit phone / recipient / OTP-code PII.
 *
 * The OTP SMS dispatcher logs `{ recipient: phone }` on failure (and the
 * default identity logger wraps call-site meta under a `value` key), so the
 * pino `redact` config in `logger.ts` must cover both the top-level and the
 * nested `value.*` shapes.
 *
 * We exercise the EXACT same `LOG_REDACT` config the live logger is built from,
 * piped to a synchronous in-memory stream (the singleton writes to fd 1 via
 * sonic-boom, which a stdout JS-spy cannot intercept). This asserts the
 * redaction contract without depending on process file descriptors.
 */

import { describe, it, expect } from 'vitest';
import { pino } from 'pino';
import { LOG_REDACT } from '../logger.js';

const PHONE = '+255712345678';
const CODE = '482913';

/** A pino instance using the live redaction config, capturing to a string. */
function makeCapturingLogger() {
  const lines: string[] = [];
  const stream = {
    write(chunk: string) {
      lines.push(chunk);
    },
  };
  const log = pino(
    {
      level: 'info',
      base: { service: 'identity' },
      redact: { paths: [...LOG_REDACT.paths], censor: LOG_REDACT.censor },
    },
    stream as never,
  );
  return { log, output: () => lines.join('') };
}

describe('identity logger redaction (H-2)', () => {
  it('redacts a top-level recipient/phone/code', () => {
    const { log, output } = makeCapturingLogger();
    log.warn({ recipient: PHONE, phone: PHONE, code: CODE, tenantId: 'tnt_acme' }, 'otp send failed');
    const out = output();
    expect(out).not.toContain(PHONE);
    expect(out).not.toContain(CODE);
    expect(out).toContain('[REDACTED]');
    // Non-PII context still flows through for debuggability.
    expect(out).toContain('tnt_acme');
  });

  it('redacts a recipient nested under the dispatcher `value` wrapper', () => {
    // Mirrors the exact shape produced by NotificationsSmsDispatcher's default
    // logger: logger.warn(msg, { value: { recipient, ... } }).
    const { log, output } = makeCapturingLogger();
    log.warn(
      { value: { tenantId: 'tnt_acme', recipient: PHONE, lastError: 'no provider' } },
      '[identity.otp.notifications-sms-dispatcher] enqueue rejected',
    );
    const out = output();
    expect(out).not.toContain(PHONE);
    expect(out).toContain('[REDACTED]');
    expect(out).toContain('tnt_acme');
  });

  it('keeps secrets redacted (regression guard for the original paths)', () => {
    const { log, output } = makeCapturingLogger();
    log.warn({ password: 'hunter2', token: 'abc.def', value: { secret: 's3cr3t' } }, 'auth');
    const out = output();
    expect(out).not.toContain('hunter2');
    expect(out).not.toContain('abc.def');
    expect(out).not.toContain('s3cr3t');
  });
});
