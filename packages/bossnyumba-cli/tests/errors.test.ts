import { describe, expect, it } from 'vitest';
import { HttpError } from '../src/http.js';
import { normaliseError } from '../src/errors.js';

describe('normaliseError', () => {
  it('maps 401 to auth + login next-step', () => {
    const err = new HttpError({
      status: 401,
      url: 'https://api.bossnyumba.app/api/v1/owner/leases',
      message: 'HTTP 401 on /leases',
      bodyText: '{"message":"token expired","request_id":"req_abc"}',
    });
    const n = normaliseError(err);
    expect(n.kind).toBe('auth');
    expect(n.next).toMatch(/bossnyumba login/);
    expect(n.requestId).toBe('req_abc');
  });

  it('maps 403 to forbidden + scope hint', () => {
    const err = new HttpError({
      status: 403,
      url: 'https://api.bossnyumba.app/x',
      message: 'forbidden',
      bodyText: '',
    });
    const n = normaliseError(err);
    expect(n.kind).toBe('forbidden');
    expect(n.next).toMatch(/--scope/);
  });

  it('maps 429 to rate_limit + extracts retry-after', () => {
    const err = new HttpError({
      status: 429,
      url: 'https://api.bossnyumba.app/chat',
      message: 'too many',
      bodyText: '{"retry_after": 12}',
    });
    const n = normaliseError(err);
    expect(n.kind).toBe('rate_limit');
    expect(n.retryAfterSec).toBe(12);
    expect(n.next).toMatch(/12s/);
  });

  it('maps 500 to server + retry hint', () => {
    const err = new HttpError({
      status: 502,
      url: 'https://api.bossnyumba.app/x',
      message: 'bad gateway',
      bodyText: '',
    });
    const n = normaliseError(err);
    expect(n.kind).toBe('server');
    expect(n.next).toMatch(/Retry/);
  });

  it('maps fetch failures to network', () => {
    const err = new Error('fetch failed: ECONNREFUSED');
    const n = normaliseError(err);
    expect(n.kind).toBe('network');
    expect(n.next).toMatch(/connection/);
  });
});
