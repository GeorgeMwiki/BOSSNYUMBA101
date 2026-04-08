import { createHmac } from 'node:crypto';
import {
  KraEtimsConfig,
  KraEtimsConfigSchema,
  KraEtimsEnvelope,
  KraEtimsEnvelopeSchema,
  KraInvoiceInput,
  KraInvoiceInputSchema,
  KraInvoiceResult,
  KraItemClass,
  KraItemClassSchema,
} from './types.js';

/**
 * Minimal structural type for the fetch function so the client can accept
 * the global `fetch` or an injected mock in tests without pulling in
 * `@types/node-fetch` or similar.
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

export interface KraEtimsClientDeps {
  /** Optional fetch override, primarily for tests. Defaults to global fetch. */
  fetchImpl?: FetchLike;
  /** Clock override for deterministic timestamps in tests. */
  now?: () => Date;
  /** Sleep helper override (used to fast-forward retry backoff in tests). */
  sleep?: (ms: number) => Promise<void>;
}

const DEFAULT_SLEEP = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Environment variable keys read when config values are not provided
 * explicitly via the constructor.
 */
const ENV_KEYS = {
  apiUrl: 'KRA_ETIMS_API_URL',
  tin: 'KRA_ETIMS_PIN',
  bhfId: 'KRA_ETIMS_BHFID',
  cmcKey: 'KRA_ETIMS_CMCKEY',
  dvcSrlNo: 'KRA_ETIMS_DVCSRLNO',
} as const;

/** Raised when KRA rejects a request with a non-`000` resultCd. */
export class KraEtimsError extends Error {
  public readonly resultCd: string;
  public readonly status: number | undefined;
  public readonly body: string | undefined;
  constructor(
    message: string,
    opts: { resultCd: string; status?: number; body?: string },
  ) {
    super(message);
    this.name = 'KraEtimsError';
    this.resultCd = opts.resultCd;
    this.status = opts.status;
    this.body = opts.body;
  }
}

/**
 * KRA eTIMS Online Sales Control Unit (OSCU) client.
 *
 * This client wraps the subset of OSCU endpoints needed to (a) initialise
 * a device against a branch, (b) post a live sales invoice and obtain the
 * signed QR invoice URL, and (c) resolve KRA item classification codes.
 *
 * The wire format follows the JSON envelope `{ resultCd, resultMsg, data }`
 * used by the eTIMS sandbox/production gateways. Endpoints and payload
 * field names mirror the OSCU integration guide.
 */
export class KraEtimsClient {
  private readonly config: KraEtimsConfig;
  private readonly fetchImpl: FetchLike;
  private readonly now: () => Date;
  private readonly sleep: (ms: number) => Promise<void>;
  private deviceRegistered = false;

  constructor(
    config: Partial<KraEtimsConfig> = {},
    deps: KraEtimsClientDeps = {},
  ) {
    const merged = {
      apiUrl: config.apiUrl ?? process.env[ENV_KEYS.apiUrl] ?? '',
      tin: config.tin ?? process.env[ENV_KEYS.tin] ?? '',
      bhfId: config.bhfId ?? process.env[ENV_KEYS.bhfId] ?? '',
      cmcKey: config.cmcKey ?? process.env[ENV_KEYS.cmcKey] ?? '',
      dvcSrlNo: config.dvcSrlNo ?? process.env[ENV_KEYS.dvcSrlNo],
      timeoutMs: config.timeoutMs ?? 15_000,
      maxRetries: config.maxRetries ?? 3,
    };
    this.config = KraEtimsConfigSchema.parse(merged);

    const injected = deps.fetchImpl;
    const globalFetch = (globalThis as { fetch?: FetchLike }).fetch;
    if (!injected && !globalFetch) {
      throw new Error(
        'KraEtimsClient: no fetch implementation available. Provide deps.fetchImpl or run on Node 18+.',
      );
    }
    this.fetchImpl = injected ?? (globalFetch as FetchLike);
    this.now = deps.now ?? ((): Date => new Date());
    this.sleep = deps.sleep ?? DEFAULT_SLEEP;
  }

  /** Expose effective config (without the CMC key) for diagnostics. */
  getPublicConfig(): Omit<KraEtimsConfig, 'cmcKey'> {
    const { cmcKey: _cmcKey, ...rest } = this.config;
    void _cmcKey;
    return rest;
  }

  /**
   * One-time device registration ("selectInitOsdcInfo" in OSCU docs).
   * Posts the tin/bhfId/dvcSrlNo tuple and caches that the device is
   * initialised for subsequent calls. Idempotent.
   */
  async registerDevice(): Promise<void> {
    if (this.deviceRegistered) return;
    const payload = {
      tin: this.config.tin,
      bhfId: this.config.bhfId,
      dvcSrlNo: this.config.dvcSrlNo ?? `${this.config.tin}-${this.config.bhfId}`,
    };
    await this.post('/selectInitOsdcInfo', payload);
    this.deviceRegistered = true;
  }

  /**
   * Submit a sale to the OSCU endpoint and return the signed invoice
   * metadata (QR URL, KRA receipt number, signing timestamp).
   *
   * Validates the input with the Zod schema before sending so that
   * obviously malformed invoices fail fast at the boundary.
   */
  async submitInvoice(input: KraInvoiceInput): Promise<KraInvoiceResult> {
    const parsed = KraInvoiceInputSchema.parse(input);
    if (!this.deviceRegistered) {
      await this.registerDevice();
    }

    const body = {
      tin: this.config.tin,
      bhfId: this.config.bhfId,
      invcNo: parsed.invcNo,
      orgInvcNo: 0,
      custTin: parsed.custTin ?? null,
      custNm: parsed.custNm ?? null,
      salesTyCd: parsed.salesTyCd,
      rcptTyCd: parsed.rcptTyCd,
      pmtTyCd: parsed.pmtTyCd,
      salesSttsCd: parsed.salesSttsCd,
      cfmDt: parsed.cfmDt,
      salesDt: parsed.cfmDt.slice(0, 10).replace(/-/g, ''),
      totItemCnt: parsed.items.length,
      totTaxblAmt: parsed.totTaxblAmt,
      totTaxAmt: parsed.totTaxAmt,
      totAmt: parsed.totAmt,
      prchrAcptcYn: 'N',
      remark: null,
      regrId: 'BOSSNYUMBA',
      regrNm: 'BOSSNYUMBA',
      modrId: 'BOSSNYUMBA',
      modrNm: 'BOSSNYUMBA',
      receipt: {
        custTin: parsed.custTin ?? null,
        custMblNo: null,
        rptNo: parsed.invcNo,
        trdeNm: parsed.custNm ?? null,
        adrs: null,
        topMsg: 'BOSSNYUMBA',
        btmMsg: 'Thank you',
        prchrAcptcYn: 'N',
      },
      itemList: parsed.items.map((it) => ({
        itemSeq: it.itemSeq,
        itemCd: it.itemCd,
        itemClsCd: it.itemClsCd,
        itemNm: it.itemNm,
        pkgUnitCd: it.pkgUnitCd,
        qtyUnitCd: it.qtyUnitCd,
        qty: it.qty,
        prc: it.prc,
        splyAmt: it.splyAmt,
        dcRt: it.dcRt,
        dcAmt: it.dcAmt,
        taxTyCd: it.taxTyCd,
        taxblAmt: it.taxblAmt,
        taxAmt: it.taxAmt,
        totAmt: it.totAmt,
      })),
    };

    const envelope = await this.post('/trnsSalesSaveWr', body);
    const data = (envelope.data ?? {}) as Record<string, unknown>;

    const rcptNo = String(
      data['rcptNo'] ?? data['curRcptNo'] ?? data['receiptNo'] ?? '',
    );
    const intrlData = data['intrlData'] as string | undefined;
    const rcptSign = data['rcptSign'] as string | undefined;
    const sdcDateTime = String(
      data['sdcDateTime'] ?? data['vsdcRcptPbctDate'] ?? envelope.resultDt ?? this.now().toISOString(),
    );
    const mrcNo = data['mrcNo'] as string | undefined;

    // Canonical KRA QR URL format used on signed tax invoices.
    // e.g. https://etims-api.kra.go.ke/etims-api/qr?<params>
    const qrBase = this.config.apiUrl.replace(/\/+$/, '');
    const qrParams = new URLSearchParams({
      tin: this.config.tin,
      bhfId: this.config.bhfId,
      rcptNo,
      ...(intrlData ? { intrlData } : {}),
      ...(rcptSign ? { rcptSign } : {}),
    });
    const qrUrl = `${qrBase}/qr?${qrParams.toString()}`;

    const result: KraInvoiceResult = {
      invoiceNumber: String(parsed.invcNo),
      qrUrl,
      signedAt: sdcDateTime,
      kraReceiptNo: rcptNo,
      ...(intrlData ? { internalData: intrlData } : {}),
      ...(rcptSign ? { receiptSignature: rcptSign } : {}),
      ...(mrcNo ? { mrcNo } : {}),
    };
    return result;
  }

  /**
   * Look up a KRA item classification code. Returns `null` if the code
   * is not found in the KRA taxonomy.
   */
  async queryItemClass(code: string): Promise<KraItemClass | null> {
    if (!code) throw new Error('queryItemClass: code is required');
    const envelope = await this.post('/selectItemClsList', {
      tin: this.config.tin,
      bhfId: this.config.bhfId,
      lastReqDt: '20200101000000',
      itemClsCd: code,
    });
    const data = (envelope.data ?? {}) as Record<string, unknown>;
    const list = (data['itemClsList'] ?? data['items'] ?? []) as unknown[];
    const hit = list.find(
      (row) =>
        typeof row === 'object' &&
        row !== null &&
        (row as Record<string, unknown>)['itemClsCd'] === code,
    );
    if (!hit) return null;
    return KraItemClassSchema.parse(hit);
  }

  /**
   * Compute the HMAC-SHA256 signature that KRA expects on every request.
   * Signature = hex( HMAC_SHA256( cmcKey, `${tin}|${bhfId}|${timestamp}|${bodyJson}` ) ).
   */
  private sign(timestamp: string, bodyJson: string): string {
    const mac = createHmac('sha256', this.config.cmcKey);
    mac.update(`${this.config.tin}|${this.config.bhfId}|${timestamp}|${bodyJson}`);
    return mac.digest('hex');
  }

  /**
   * POST to an OSCU endpoint, validate the envelope, and surface
   * `KraEtimsError` on non-success resultCd. Automatically retries on
   * transient failures (network, timeout, 5xx) with exponential backoff.
   */
  private async post(
    path: string,
    body: unknown,
  ): Promise<KraEtimsEnvelope> {
    const url = `${this.config.apiUrl.replace(/\/+$/, '')}${path}`;
    const bodyJson = JSON.stringify(body);
    const timestamp = this.now().toISOString();

    let attempt = 0;
    let lastErr: unknown;
    while (attempt <= this.config.maxRetries) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
      try {
        const res = await this.fetchImpl(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-KRA-TIN': this.config.tin,
            'X-KRA-BHFID': this.config.bhfId,
            'X-KRA-TIMESTAMP': timestamp,
            'X-KRA-SIGNATURE': this.sign(timestamp, bodyJson),
          },
          body: bodyJson,
          signal: controller.signal,
        });

        if (!res.ok) {
          const text = await res.text().catch(() => '');
          if (res.status >= 500 && attempt < this.config.maxRetries) {
            lastErr = new Error(
              `KRA eTIMS ${res.status} ${res.statusText} @ ${path}`,
            );
            attempt++;
            await this.backoff(attempt);
            continue;
          }
          throw new KraEtimsError(
            `KRA eTIMS HTTP ${res.status} ${res.statusText}`,
            { resultCd: String(res.status), status: res.status, body: text },
          );
        }

        const text = await res.text();
        const parsedJson = JSON.parse(text) as unknown;
        const envelope = KraEtimsEnvelopeSchema.parse(parsedJson);
        if (envelope.resultCd !== '000') {
          throw new KraEtimsError(
            `KRA eTIMS ${envelope.resultCd}: ${envelope.resultMsg}`,
            { resultCd: envelope.resultCd, body: text },
          );
        }
        return envelope;
      } catch (err) {
        // Abort / network errors are retryable until we exhaust retries.
        if (err instanceof KraEtimsError) throw err;
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
      : new Error(`KRA eTIMS request to ${path} failed after retries`);
  }

  /** Exponential backoff: 200ms, 400ms, 800ms, ... capped at 5s. */
  private async backoff(attempt: number): Promise<void> {
    const base = 200;
    const delay = Math.min(base * 2 ** (attempt - 1), 5_000);
    await this.sleep(delay);
  }
}
