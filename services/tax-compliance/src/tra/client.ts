import {
  TraAuthRequestSchema,
  TraAuthResponseSchema,
  TraVatSubmissionSchema,
  TraSubmissionResponseSchema,
  TraStatusQuerySchema,
  TraStatusResponseSchema,
  type TraAuthResponse,
  type TraVatSubmission,
  type TraSubmissionResponse,
  type TraStatusResponse,
} from './types.js';

/**
 * Minimal fetcher contract so tests can inject a fake without pulling in axios.
 * Matches the shape of the global `fetch` closely enough that we can pass
 * `globalThis.fetch` in production and a stub in tests.
 */
export interface TraFetcher {
  (
    input: string,
    init?: {
      method?: string;
      headers?: Record<string, string>;
      body?: string;
    },
  ): Promise<{
    ok: boolean;
    status: number;
    statusText: string;
    json: () => Promise<unknown>;
    text: () => Promise<string>;
  }>;
}

export interface TraClientConfig {
  baseUrl: string;
  username: string;
  password: string;
  tin: string;
  /**
   * Inject a fetcher (defaults to `globalThis.fetch`). Tests should pass a stub.
   */
  fetcher?: TraFetcher;
}

/**
 * HTTP client for Tanzania Revenue Authority VAT submission endpoints.
 *
 * Usage:
 *   const client = new TraClient({
 *     baseUrl: process.env.TRA_API_URL!,
 *     username: process.env.TRA_USERNAME!,
 *     password: process.env.TRA_PASSWORD!,
 *     tin: process.env.TRA_TIN!,
 *   });
 *   await client.authenticate();
 *   const receipt = await client.submitVat(submission);
 *   const status = await client.queryStatus(receipt.receiptNumber);
 */
export class TraClient {
  private readonly baseUrl: string;
  private readonly username: string;
  private readonly password: string;
  private readonly tin: string;
  private readonly fetcher: TraFetcher;
  private token: string | null = null;
  private tokenExpiresAt: Date | null = null;

  constructor(config: TraClientConfig) {
    if (!config.baseUrl) {
      throw new Error('TraClient: baseUrl is required (set TRA_API_URL)');
    }
    if (!config.username || !config.password || !config.tin) {
      throw new Error(
        'TraClient: username/password/tin are required (TRA_USERNAME/TRA_PASSWORD/TRA_TIN)',
      );
    }
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.username = config.username;
    this.password = config.password;
    this.tin = config.tin;
    this.fetcher =
      config.fetcher ??
      ((globalThis as unknown as { fetch?: TraFetcher }).fetch as TraFetcher);
    if (!this.fetcher) {
      throw new Error(
        'TraClient: no fetcher provided and globalThis.fetch is unavailable',
      );
    }
  }

  /**
   * Authenticate against the TRA partner gateway. Caches the token until its
   * expiry. Safe to call repeatedly.
   */
  async authenticate(): Promise<TraAuthResponse> {
    const body = TraAuthRequestSchema.parse({
      username: this.username,
      password: this.password,
      tin: this.tin,
    });

    const res = await this.fetcher(`${this.baseUrl}/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(
        `TRA auth failed: ${res.status} ${res.statusText}`,
      );
    }
    const parsed = TraAuthResponseSchema.parse(await res.json());
    this.token = parsed.token;
    this.tokenExpiresAt = new Date(parsed.expiresAt);
    return parsed;
  }

  private async ensureAuth(): Promise<string> {
    const now = Date.now();
    if (
      !this.token ||
      !this.tokenExpiresAt ||
      this.tokenExpiresAt.getTime() <= now + 30_000
    ) {
      await this.authenticate();
    }
    if (!this.token) {
      throw new Error('TraClient: authentication did not yield a token');
    }
    return this.token;
  }

  /**
   * Submit a VAT invoice to TRA. Returns the receipt number and initial status.
   */
  async submitVat(
    submission: TraVatSubmission,
  ): Promise<TraSubmissionResponse> {
    const validated = TraVatSubmissionSchema.parse(submission);
    const token = await this.ensureAuth();
    const res = await this.fetcher(`${this.baseUrl}/vat/submissions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(validated),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(
        `TRA VAT submission failed: ${res.status} ${res.statusText} ${text}`,
      );
    }
    return TraSubmissionResponseSchema.parse(await res.json());
  }

  /**
   * Query the current status of a previously-submitted receipt.
   */
  async queryStatus(receiptNumber: string): Promise<TraStatusResponse> {
    const { receiptNumber: rn } = TraStatusQuerySchema.parse({ receiptNumber });
    const token = await this.ensureAuth();
    const res = await this.fetcher(
      `${this.baseUrl}/vat/submissions/${encodeURIComponent(rn)}`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    if (!res.ok) {
      throw new Error(
        `TRA status query failed: ${res.status} ${res.statusText}`,
      );
    }
    return TraStatusResponseSchema.parse(await res.json());
  }
}
