import { calculateMRI } from '../engine/tax-calculator.js';
import {
  GavaConnectTokenSchema,
  KraEritsConfig,
  KraEritsConfigSchema,
  KraEritsMriParams,
  KraEritsMriParamsSchema,
  KraEritsMriResult,
  KraEritsSubmitResponseSchema,
} from './types.js';

/**
 * Minimal fetch shape (see KraEtimsClient). Kept local to avoid cross-
 * client imports so either client can be tree-shaken independently.
 */
export type FetchLike = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    signal?: AbortSignal;
  },
) => Promise<{
  ok: boolean;
  status: number;
  statusText: string;
  text(): Promise<string>;
}>;

export interface KraEritsClientDeps {
  fetchImpl?: FetchLike;
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
}

const DEFAULT_SLEEP = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const ENV_KEYS = {
  apiUrl: 'KRA_ERITS_API_URL',
  username: 'KRA_ERITS_USERNAME',
  password: 'KRA_ERITS_PASSWORD',
  clientId: 'KRA_ERITS_CLIENT_ID',
} as const;

export class KraEritsError extends Error {
  public readonly status: number | undefined;
  public readonly body: string | undefined;
  constructor(message: string, opts: { status?: number; body?: string } = {}) {
    super(message);
    this.name = 'KraEritsError';
    this.status = opts.status;
    this.body = opts.body;
  }
}

/**
 * KRA eRITS client for Monthly Rental Income (MRI) filings via Gava Connect.
 *
 * Responsibilities:
 *  - Authenticate against Gava Connect using username/password (sandbox)
 *    and cache the bearer token until it expires.
 *  - Compute the MRI amount using the shared tax calculator engine so that
 *    the same rates are applied consistently across the service.
 *  - Submit the return and surface the acknowledgement number returned by
 *    Gava Connect to the caller.
 */
export class KraEritsClient {
  private readonly config: KraEritsConfig;
  private readonly fetchImpl: FetchLike;
  private readonly now: () => Date;
  private readonly sleep: (ms: number) => Promise<void>;

  private token: string | null = null;
  private tokenExpiresAt = 0;

  constructor(
    config: Partial<KraEritsConfig> = {},
    deps: KraEritsClientDeps = {},
  ) {
    const merged = {
      apiUrl: config.apiUrl ?? process.env[ENV_KEYS.apiUrl] ?? '',
      username: config.username ?? process.env[ENV_KEYS.username] ?? '',
      password: config.password ?? process.env[ENV_KEYS.password] ?? '',
      clientId: config.clientId ?? process.env[ENV_KEYS.clientId],
      timeoutMs: config.timeoutMs ?? 15_000,
      maxRetries: config.maxRetries ?? 3,
    };
    this.config = KraEritsConfigSchema.parse(merged);

    const injected = deps.fetchImpl;
    const globalFetch = (globalThis as { fetch?: FetchLike }).fetch;
    if (!injected && !globalFetch) {
      throw new Error(
        'KraEritsClient: no fetch implementation available. Provide deps.fetchImpl or run on Node 18+.',
      );
    }
    this.fetchImpl = injected ?? (globalFetch as FetchLike);
    this.now = deps.now ?? ((): Date => new Date());
    this.sleep = deps.sleep ?? DEFAULT_SLEEP;
  }

  /** Expose effective config (without the password) for diagnostics. */
  getPublicConfig(): Omit<KraEritsConfig, 'password'> {
    const { password: _password, ...rest } = this.config;
    void _password;
    return rest;
  }

  /**
   * Submit a Monthly Rental Income return. Calculates the tax amount via
   * the shared engine (`calculateMRI`) and posts the filing JSON to Gava
   * Connect. On success, returns the acknowledgement number and the
   * computed MRI amount.
   */
  async submitMRI(params: KraEritsMriParams): Promise<KraEritsMriResult> {
    const parsed = KraEritsMriParamsSchema.parse(params);
    const raw: unknown = await Promise.resolve(
      calculateMRI({
        grossRent: parsed.grossRent,
        period: parsed.period,
        landlordPin: parsed.landlordPin,
      }),
    );
    // `calculateMRI` from the shared engine may return either a plain
    // number (legacy) or a `{ amount, ... }` object (richer breakdown).
    // Handle both without assuming a specific shape.
    let amount: number;
    if (typeof raw === 'number') {
      amount = raw;
    } else if (
      raw &&
      typeof raw === 'object' &&
      typeof (raw as { amount?: unknown }).amount === 'number'
    ) {
      amount = (raw as { amount: number }).amount;
    } else {
      throw new KraEritsError(
        `calculateMRI returned an unexpected shape: ${JSON.stringify(raw)}`,
      );
    }

    const token = await this.ensureToken();
    const body = {
      taxpayerPin: parsed.landlordPin,
      propertyRef: parsed.propertyId,
      returnPeriod: `${parsed.period.year.toString().padStart(4, '0')}-${parsed.period
        .month.toString()
        .padStart(2, '0')}`,
      grossRentalIncome: parsed.grossRent,
      taxPayable: amount,
      currency: 'KES',
      source: 'BOSSNYUMBA',
    };

    const raw = await this.request('/mri/returns', 'POST', body, token);
    const parsedResponse = KraEritsSubmitResponseSchema.parse(raw);
    const ack =
      parsedResponse.ackNumber ??
      parsedResponse.acknowledgementNumber ??
      (parsedResponse.data as Record<string, unknown> | undefined)?.[
        'ackNumber'
      ];
    if (typeof ack !== 'string' || !ack) {
      throw new KraEritsError('Gava Connect did not return an ackNumber', {
        body: JSON.stringify(parsedResponse),
      });
    }
    return { ackNumber: ack, mriAmount: amount };
  }

  /**
   * Ensure a valid bearer token is available. Caches tokens until 60s
   * before expiry to avoid races against the Gava Connect clock.
   */
  private async ensureToken(): Promise<string> {
    const skewMs = 60_000;
    if (this.token && this.now().getTime() < this.tokenExpiresAt - skewMs) {
      return this.token;
    }
    const raw = await this.request('/oauth/token', 'POST', {
      grant_type: 'password',
      username: this.config.username,
      password: this.config.password,
      client_id: this.config.clientId ?? this.config.username,
    });
    const token = GavaConnectTokenSchema.parse(raw);
    this.token = token.access_token;
    this.tokenExpiresAt = this.now().getTime() + token.expires_in * 1000;
    return this.token;
  }

  /**
   * Perform an HTTP request with retry-on-5xx / network-failure and JSON
   * body handling. Authenticated requests must pass a bearer token.
   */
  private async request(
    path: string,
    method: 'GET' | 'POST',
    body: unknown,
    bearer?: string,
  ): Promise<unknown> {
    const url = `${this.config.apiUrl.replace(/\/+$/, '')}${path}`;
    const bodyJson = body === undefined ? undefined : JSON.stringify(body);
    let attempt = 0;
    let lastErr: unknown;

    while (attempt <= this.config.maxRetries) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        };
        if (bearer) headers.Authorization = `Bearer ${bearer}`;

        const res = await this.fetchImpl(url, {
          method,
          headers,
          ...(bodyJson !== undefined ? { body: bodyJson } : {}),
          signal: controller.signal,
        });

        if (!res.ok) {
          const text = await res.text().catch(() => '');
          if (res.status >= 500 && attempt < this.config.maxRetries) {
            lastErr = new Error(
              `eRITS ${res.status} ${res.statusText} @ ${path}`,
            );
            attempt++;
            await this.backoff(attempt);
            continue;
          }
          throw new KraEritsError(
            `eRITS HTTP ${res.status} ${res.statusText}`,
            { status: res.status, body: text },
          );
        }

        const text = await res.text();
        return text ? JSON.parse(text) : {};
      } catch (err) {
        if (err instanceof KraEritsError) throw err;
        lastErr = err;
        if (attempt >= this.config.maxRetries) break;
        attempt++;
        await this.backoff(attempt);
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastErr instanceof Error
      ? lastErr
      : new Error(`eRITS request to ${path} failed after retries`);
  }

  /** Exponential backoff: 200ms, 400ms, 800ms, ... capped at 5s. */
  private async backoff(attempt: number): Promise<void> {
    const base = 200;
    const delay = Math.min(base * 2 ** (attempt - 1), 5_000);
    await this.sleep(delay);
  }
}
