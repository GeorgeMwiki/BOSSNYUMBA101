/**
 * Verra (VCS) registry client — read-only.
 *
 * Public-facing JSON API base (Verra Registry UI):
 *   https://registry.verra.org/uiapi/
 *
 * The registry exposes verifiable-credit search endpoints; we model
 * the four read operations the trading desk actually uses. The HTTP
 * transport is injectable so tests can mock without hitting the network,
 * and the schemas accept unknown extra keys so Verra adding fields
 * never breaks our parse.
 *
 * Retry policy: 3 attempts on 5xx with 250 / 500 / 1000 ms backoff.
 * Timeout policy: 30s per request via AbortController.
 */

import {
  IssuanceListSchema,
  ProjectListSchema,
  RawProjectSchema,
  type RawIssuance,
  type RawProject,
} from './schemas.js';
import {
  VerraHttpError,
  VerraParseError,
  VerraTimeoutError,
} from './errors.js';
import type {
  HttpRequestOptions,
  HttpTransport,
  Issuance,
  Project,
  VerraStatus,
} from '../types.js';

export const VERRA_REGISTRY_BASE_URL = 'https://registry.verra.org/uiapi/';
export const DEFAULT_TIMEOUT_MS = 30_000;
/** Backoff schedule in ms — three attempts means two retries. */
export const RETRY_DELAYS_MS: ReadonlyArray<number> = [250, 500, 1000];

export interface VerraSearchProjectsArgs {
  readonly country?: string;
  readonly methodology?: string;
  readonly status?: VerraStatus;
  readonly vintage?: number;
}

export interface VerraSearchIssuancesArgs {
  readonly projectId?: string;
  readonly vintage?: number;
}

export interface VerraClient {
  searchProjects(args: VerraSearchProjectsArgs): Promise<ReadonlyArray<Project>>;
  getProject(id: string): Promise<Project>;
  searchIssuances(args: VerraSearchIssuancesArgs): Promise<ReadonlyArray<Issuance>>;
  /** Returns the matched issuance and its retirement state. */
  verifyCredit(serialNumber: string): Promise<{ readonly issuance: Issuance; readonly retired: boolean } | null>;
}

export interface CreateVerraClientOptions {
  readonly transport: HttpTransport;
  readonly baseUrl?: string;
  readonly timeoutMs?: number;
  /** Override the retry schedule (used by tests to skip waiting). */
  readonly retryDelaysMs?: ReadonlyArray<number>;
  /** Hook for tests to skip real `setTimeout` waits. */
  readonly sleep?: (ms: number) => Promise<void>;
}

export function createVerraClient(options: CreateVerraClientOptions): VerraClient {
  const baseUrl = options.baseUrl ?? VERRA_REGISTRY_BASE_URL;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retryDelays = options.retryDelaysMs ?? RETRY_DELAYS_MS;
  const sleep = options.sleep ?? defaultSleep;

  return {
    async searchProjects(args) {
      const url = buildUrl(baseUrl, 'searchProjects', args as Record<string, unknown>);
      const payload = await getWithRetry(options.transport, url, timeoutMs, retryDelays, sleep);
      const parsed = ProjectListSchema.safeParse(payload);
      if (!parsed.success) {
        throw new VerraParseError(
          `Verra searchProjects: payload did not match schema`,
          parsed.error.issues.map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`),
        );
      }
      return parsed.data.projects.map(toProject);
    },

    async getProject(id) {
      if (!id) {
        throw new VerraParseError('Verra getProject: id is required', []);
      }
      const url = buildUrl(baseUrl, `getProject/${encodeURIComponent(id)}`, {});
      const payload = await getWithRetry(options.transport, url, timeoutMs, retryDelays, sleep);
      const parsed = RawProjectSchema.safeParse(payload);
      if (!parsed.success) {
        throw new VerraParseError(
          `Verra getProject: payload did not match schema`,
          parsed.error.issues.map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`),
        );
      }
      return toProject(parsed.data);
    },

    async searchIssuances(args) {
      const url = buildUrl(baseUrl, 'searchIssuances', args as Record<string, unknown>);
      const payload = await getWithRetry(options.transport, url, timeoutMs, retryDelays, sleep);
      const parsed = IssuanceListSchema.safeParse(payload);
      if (!parsed.success) {
        throw new VerraParseError(
          `Verra searchIssuances: payload did not match schema`,
          parsed.error.issues.map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`),
        );
      }
      return parsed.data.issuances.map(toIssuance);
    },

    async verifyCredit(serialNumber) {
      if (!serialNumber) {
        throw new VerraParseError('Verra verifyCredit: serialNumber required', []);
      }
      const url = buildUrl(baseUrl, 'searchIssuances', { serialNumber });
      const payload = await getWithRetry(options.transport, url, timeoutMs, retryDelays, sleep);
      const parsed = IssuanceListSchema.safeParse(payload);
      if (!parsed.success) {
        throw new VerraParseError(
          `Verra verifyCredit: payload did not match schema`,
          parsed.error.issues.map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`),
        );
      }
      const match = parsed.data.issuances.find((i) => i.serialNumber === serialNumber);
      if (!match) {
        return null;
      }
      const issuance = toIssuance(match);
      return { issuance, retired: issuance.retired };
    },
  };
}

// ─────────────────────────────────────────────────────────────────────
// Internals
// ─────────────────────────────────────────────────────────────────────

function toProject(raw: RawProject): Project {
  return {
    id: raw.id,
    name: raw.name,
    country: raw.country,
    methodology: raw.methodology,
    projectType: raw.projectType,
    status: raw.status,
    registryUrl: raw.registryUrl ?? `https://registry.verra.org/app/projectDetail/VCS/${encodeURIComponent(raw.id)}`,
    proponent: raw.proponent,
    lastIssuanceDate: raw.lastIssuanceDate,
    totalIssuedTonnes: raw.totalIssuedTonnes,
  };
}

function toIssuance(raw: RawIssuance): Issuance {
  return {
    projectId: raw.projectId,
    serialNumber: raw.serialNumber,
    vintage: raw.vintage,
    tonnes: raw.tonnes,
    issuanceDate: raw.issuanceDate,
    retired: raw.retired,
  };
}

function buildUrl(base: string, path: string, params: Record<string, unknown>): string {
  const url = new URL(path, ensureTrailingSlash(base));
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    url.searchParams.set(k, String(v));
  }
  return url.toString();
}

function ensureTrailingSlash(s: string): string {
  return s.endsWith('/') ? s : `${s}/`;
}

async function getWithRetry(
  transport: HttpTransport,
  url: string,
  timeoutMs: number,
  retryDelays: ReadonlyArray<number>,
  sleep: (ms: number) => Promise<void>,
): Promise<unknown> {
  let lastError: unknown;
  const totalAttempts = retryDelays.length;
  for (let attempt = 0; attempt < totalAttempts; attempt++) {
    try {
      const opts: HttpRequestOptions = { timeoutMs };
      return await transport.get(url, opts);
    } catch (err) {
      lastError = err;
      // Only retry transient HTTP 5xx errors.
      if (err instanceof VerraHttpError && err.status >= 500 && err.status < 600) {
        const delay = retryDelays[attempt];
        if (attempt < totalAttempts - 1 && delay !== undefined) {
          await sleep(delay);
          continue;
        }
      }
      // Non-retryable: rethrow immediately.
      throw err;
    }
  }
  // Exhausted retries — surface the last error.
  throw lastError instanceof Error
    ? lastError
    : new VerraHttpError('Verra request failed after retries', 599, url);
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─────────────────────────────────────────────────────────────────────
// Default HTTP transport using global fetch (Node 22+)
// ─────────────────────────────────────────────────────────────────────

/**
 * Default `HttpTransport` built on global `fetch`. Production injects
 * this when constructing the client; tests inject mocks instead.
 *
 * Surfaces `VerraHttpError` on non-2xx, `VerraTimeoutError` on
 * AbortController firing, and lets JSON parse failures bubble as plain
 * `SyntaxError` (the client's zod step will catch them as parse issues).
 */
export function createFetchTransport(): HttpTransport {
  return {
    async get(url, opts) {
      const controller = new AbortController();
      const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(url, {
          method: 'GET',
          headers: { Accept: 'application/json', ...(opts?.headers ?? {}) },
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new VerraHttpError(`HTTP ${res.status} for ${url}`, res.status, url);
        }
        return await res.json();
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          throw new VerraTimeoutError(`Verra request timed out after ${timeoutMs}ms`, url, timeoutMs);
        }
        throw err;
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
