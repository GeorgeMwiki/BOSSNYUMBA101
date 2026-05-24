/**
 * Verra registry client — mocked HTTP, no network.
 *
 * Asserts parsing, retry policy, timeout surfacing, and the typed error
 * hierarchy. All transports are hand-rolled so the suite stays
 * deterministic and offline.
 */

import { describe, expect, it } from 'vitest';
import {
  createVerraClient,
  VERRA_REGISTRY_BASE_URL,
} from '../verra/client.js';
import {
  VerraHttpError,
  VerraParseError,
  VerraTimeoutError,
} from '../verra/errors.js';
import type { HttpTransport } from '../types.js';
import {
  MALFORMED_PROJECT_LIST,
  SAMPLE_ISSUANCE_LIST,
  SAMPLE_PROJECT_LIST,
  SAMPLE_SINGLE_PROJECT,
} from './fixtures.js';

interface RecordedCall {
  readonly url: string;
  readonly timeoutMs: number | undefined;
}

function fakeTransport(
  responses: Iterable<unknown | Error>,
): { transport: HttpTransport; calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  const iter = responses[Symbol.iterator]();
  const transport: HttpTransport = {
    async get(url, opts) {
      calls.push({ url, timeoutMs: opts?.timeoutMs });
      const next = iter.next();
      if (next.done) {
        throw new Error('transport: no more queued responses');
      }
      if (next.value instanceof Error) {
        throw next.value;
      }
      return next.value;
    },
  };
  return { transport, calls };
}

describe('createVerraClient — searchProjects', () => {
  it('parses a well-formed project list', async () => {
    const { transport, calls } = fakeTransport([SAMPLE_PROJECT_LIST]);
    const client = createVerraClient({ transport, sleep: async () => {} });
    const projects = await client.searchProjects({ country: 'KE' });
    expect(projects).toHaveLength(3);
    expect(projects[0]?.id).toBe('1234');                    // numeric coerced to string
    expect(projects[0]?.country).toBe('KE');
    expect(projects[1]?.country).toBe('TZ');
    expect(calls[0]?.url.startsWith(VERRA_REGISTRY_BASE_URL)).toBe(true);
    expect(calls[0]?.url).toContain('country=KE');
  });

  it('passes status + methodology + vintage as query params', async () => {
    const { transport, calls } = fakeTransport([SAMPLE_PROJECT_LIST]);
    const client = createVerraClient({ transport, sleep: async () => {} });
    await client.searchProjects({
      status: 'Registered',
      methodology: 'VM0007',
      vintage: 2024,
    });
    const url = calls[0]!.url;
    expect(url).toContain('status=Registered');
    expect(url).toContain('methodology=VM0007');
    expect(url).toContain('vintage=2024');
  });

  it('throws VerraParseError on schema mismatch', async () => {
    const { transport } = fakeTransport([MALFORMED_PROJECT_LIST]);
    const client = createVerraClient({ transport, sleep: async () => {} });
    await expect(client.searchProjects({})).rejects.toBeInstanceOf(VerraParseError);
  });

  it('VerraParseError surfaces zod issue paths', async () => {
    const { transport } = fakeTransport([MALFORMED_PROJECT_LIST]);
    const client = createVerraClient({ transport, sleep: async () => {} });
    try {
      await client.searchProjects({});
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(VerraParseError);
      const err = e as VerraParseError;
      expect(err.issues.length).toBeGreaterThan(0);
      expect(err.issues.some((i) => i.includes('country'))).toBe(true);
    }
  });

  it('passes 30s timeout to the transport by default', async () => {
    const { transport, calls } = fakeTransport([SAMPLE_PROJECT_LIST]);
    const client = createVerraClient({ transport, sleep: async () => {} });
    await client.searchProjects({});
    expect(calls[0]?.timeoutMs).toBe(30_000);
  });

  it('honours a custom timeoutMs option', async () => {
    const { transport, calls } = fakeTransport([SAMPLE_PROJECT_LIST]);
    const client = createVerraClient({ transport, timeoutMs: 5_000, sleep: async () => {} });
    await client.searchProjects({});
    expect(calls[0]?.timeoutMs).toBe(5_000);
  });
});

describe('createVerraClient — getProject', () => {
  it('parses a single project record', async () => {
    const { transport, calls } = fakeTransport([SAMPLE_SINGLE_PROJECT]);
    const client = createVerraClient({ transport, sleep: async () => {} });
    const project = await client.getProject('9012');
    expect(project.id).toBe('9012');
    expect(project.country).toBe('UG');
    expect(project.projectType).toContain('Biochar');
    expect(calls[0]?.url).toContain('/getProject/9012');
  });

  it('rejects empty ids with VerraParseError', async () => {
    const { transport } = fakeTransport([]);
    const client = createVerraClient({ transport, sleep: async () => {} });
    await expect(client.getProject('')).rejects.toBeInstanceOf(VerraParseError);
  });

  it('surfaces VerraHttpError when transport raises 4xx', async () => {
    const { transport } = fakeTransport([
      new VerraHttpError('not found', 404, 'https://x'),
    ]);
    const client = createVerraClient({ transport, sleep: async () => {} });
    await expect(client.getProject('does-not-exist')).rejects.toBeInstanceOf(VerraHttpError);
  });
});

describe('createVerraClient — retries on 5xx', () => {
  it('retries 3x then succeeds on the third attempt', async () => {
    const { transport, calls } = fakeTransport([
      new VerraHttpError('boom', 502, 'u'),
      new VerraHttpError('boom', 503, 'u'),
      SAMPLE_PROJECT_LIST,
    ]);
    const sleeps: number[] = [];
    const client = createVerraClient({
      transport,
      sleep: async (ms) => { sleeps.push(ms); },
    });
    const projects = await client.searchProjects({});
    expect(projects).toHaveLength(3);
    expect(calls).toHaveLength(3);
    // Backoff schedule applies before retries (between attempts).
    expect(sleeps).toEqual([250, 500]);
  });

  it('honours a custom retry schedule', async () => {
    const { transport } = fakeTransport([
      new VerraHttpError('boom', 503, 'u'),
      SAMPLE_PROJECT_LIST,
    ]);
    const sleeps: number[] = [];
    const client = createVerraClient({
      transport,
      retryDelaysMs: [10, 20],
      sleep: async (ms) => { sleeps.push(ms); },
    });
    await client.searchProjects({});
    expect(sleeps).toEqual([10]);
  });

  it('does NOT retry on 4xx', async () => {
    const { transport, calls } = fakeTransport([
      new VerraHttpError('bad req', 400, 'u'),
    ]);
    const client = createVerraClient({ transport, sleep: async () => {} });
    await expect(client.searchProjects({})).rejects.toBeInstanceOf(VerraHttpError);
    expect(calls).toHaveLength(1);
  });

  it('surfaces the last error when retries are exhausted', async () => {
    const { transport, calls } = fakeTransport([
      new VerraHttpError('boom', 500, 'u'),
      new VerraHttpError('boom', 500, 'u'),
      new VerraHttpError('boom', 500, 'u'),
    ]);
    const client = createVerraClient({ transport, sleep: async () => {} });
    await expect(client.searchProjects({})).rejects.toBeInstanceOf(VerraHttpError);
    expect(calls).toHaveLength(3);
  });

  it('does NOT retry on parse errors', async () => {
    const { transport, calls } = fakeTransport([MALFORMED_PROJECT_LIST]);
    const client = createVerraClient({ transport, sleep: async () => {} });
    await expect(client.searchProjects({})).rejects.toBeInstanceOf(VerraParseError);
    expect(calls).toHaveLength(1);
  });

  it('does NOT retry on timeout', async () => {
    const { transport, calls } = fakeTransport([
      new VerraTimeoutError('slow', 'https://x', 30_000),
    ]);
    const client = createVerraClient({ transport, sleep: async () => {} });
    await expect(client.searchProjects({})).rejects.toBeInstanceOf(VerraTimeoutError);
    expect(calls).toHaveLength(1);
  });
});

describe('createVerraClient — searchIssuances + verifyCredit', () => {
  it('parses an issuance list', async () => {
    const { transport } = fakeTransport([SAMPLE_ISSUANCE_LIST]);
    const client = createVerraClient({ transport, sleep: async () => {} });
    const issuances = await client.searchIssuances({ projectId: '1234' });
    expect(issuances).toHaveLength(2);
    expect(issuances[0]?.vintage).toBe(2024);
    expect(issuances[0]?.tonnes).toBe(10_000);
  });

  it('verifyCredit returns null when serial is unknown', async () => {
    const { transport } = fakeTransport([{ issuances: [] }]);
    const client = createVerraClient({ transport, sleep: async () => {} });
    const result = await client.verifyCredit('NOPE');
    expect(result).toBeNull();
  });

  it('verifyCredit returns the issuance + retired flag when found', async () => {
    const { transport } = fakeTransport([SAMPLE_ISSUANCE_LIST]);
    const client = createVerraClient({ transport, sleep: async () => {} });
    const result = await client.verifyCredit('5678-VCS-2024-CD-0001-0000005000');
    expect(result).not.toBeNull();
    expect(result!.retired).toBe(true);
    expect(result!.issuance.tonnes).toBe(5_000);
  });

  it('verifyCredit reports unretired serials correctly', async () => {
    const { transport } = fakeTransport([SAMPLE_ISSUANCE_LIST]);
    const client = createVerraClient({ transport, sleep: async () => {} });
    const result = await client.verifyCredit('1234-VCS-2024-AB-0001-0000010000');
    expect(result!.retired).toBe(false);
  });
});
