import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KraEtimsClient, KraEtimsError, type FetchLike } from '../client.js';
import type { KraInvoiceInput } from '../types.js';

/** Build a mock fetch that replies with a canned JSON envelope on every call. */
function mockFetch(envelopes: Array<Record<string, unknown>>): {
  fn: FetchLike;
  calls: Array<{ url: string; body: string | undefined }>;
} {
  const calls: Array<{ url: string; body: string | undefined }> = [];
  let idx = 0;
  const fn: FetchLike = async (url, init) => {
    calls.push({ url, body: init?.body });
    const envelope = envelopes[Math.min(idx, envelopes.length - 1)] ?? {
      resultCd: '000',
      resultMsg: 'OK',
      data: {},
    };
    idx++;
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async (): Promise<string> => JSON.stringify(envelope),
    };
  };
  return { fn, calls };
}

const baseConfig = {
  apiUrl: 'https://etims-sandbox.example.com/etims-api',
  tin: 'A123456789Z',
  bhfId: '00',
  cmcKey: 'test-cmc-key',
  dvcSrlNo: 'DEV001',
};

function sampleInvoice(): KraInvoiceInput {
  return {
    invcNo: 1001,
    salesTyCd: 'N',
    rcptTyCd: 'S',
    pmtTyCd: '05',
    salesSttsCd: '02',
    cfmDt: '2026-04-08T10:15:00',
    custTin: 'P987654321Q',
    custNm: 'Acme Tenants Ltd',
    totTaxblAmt: 10_000,
    totTaxAmt: 1_600,
    totAmt: 11_600,
    currency: 'KES',
    items: [
      {
        itemSeq: 1,
        itemCd: 'SKU-RENT',
        itemClsCd: '5022140100',
        itemNm: 'Monthly Rent - Unit 4B',
        pkgUnitCd: 'NT',
        qtyUnitCd: 'U',
        qty: 1,
        prc: 10_000,
        splyAmt: 10_000,
        dcRt: 0,
        dcAmt: 0,
        taxTyCd: 'A',
        taxblAmt: 10_000,
        taxAmt: 1_600,
        totAmt: 11_600,
      },
    ],
  };
}

describe('KraEtimsClient', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  describe('construction', () => {
    it('accepts explicit config', () => {
      const client = new KraEtimsClient(baseConfig, {
        fetchImpl: mockFetch([]).fn,
      });
      const cfg = client.getPublicConfig();
      expect(cfg.apiUrl).toBe(baseConfig.apiUrl);
      expect(cfg.tin).toBe('A123456789Z');
      expect(cfg.bhfId).toBe('00');
      expect(cfg.timeoutMs).toBe(15_000);
      expect(cfg.maxRetries).toBe(3);
      expect((cfg as Record<string, unknown>)['cmcKey']).toBeUndefined();
    });

    it('reads config from env vars when not passed explicitly', () => {
      vi.stubEnv('KRA_ETIMS_API_URL', 'https://env.example.com/etims-api');
      vi.stubEnv('KRA_ETIMS_PIN', 'B000000000X');
      vi.stubEnv('KRA_ETIMS_BHFID', '01');
      vi.stubEnv('KRA_ETIMS_CMCKEY', 'env-cmc-key');
      const client = new KraEtimsClient(
        {},
        { fetchImpl: mockFetch([]).fn },
      );
      const cfg = client.getPublicConfig();
      expect(cfg.apiUrl).toBe('https://env.example.com/etims-api');
      expect(cfg.tin).toBe('B000000000X');
      expect(cfg.bhfId).toBe('01');
    });

    it('rejects invalid config via Zod', () => {
      expect(
        () =>
          new KraEtimsClient(
            { ...baseConfig, apiUrl: 'not-a-url' },
            { fetchImpl: mockFetch([]).fn },
          ),
      ).toThrow();
    });
  });

  describe('submitInvoice (happy path)', () => {
    it('registers device then posts invoice and returns signed metadata', async () => {
      const { fn, calls } = mockFetch([
        { resultCd: '000', resultMsg: 'Init OK', data: {} },
        {
          resultCd: '000',
          resultMsg: 'OK',
          resultDt: '20260408101530',
          data: {
            rcptNo: '1001/1234',
            intrlData: 'AAAA-BBBB-CCCC-DDDD',
            rcptSign: 'XXXX-YYYY-ZZZZ',
            sdcDateTime: '2026-04-08T10:15:30Z',
            mrcNo: 'MRC001',
          },
        },
      ]);

      const client = new KraEtimsClient(baseConfig, {
        fetchImpl: fn,
        sleep: async () => undefined,
      });
      const result = await client.submitInvoice(sampleInvoice());

      expect(result.invoiceNumber).toBe('1001');
      expect(result.kraReceiptNo).toBe('1001/1234');
      expect(result.signedAt).toBe('2026-04-08T10:15:30Z');
      expect(result.qrUrl).toContain('tin=A123456789Z');
      expect(result.qrUrl).toContain('rcptNo=1001');
      expect(result.qrUrl).toContain('intrlData=AAAA-BBBB-CCCC-DDDD');
      expect(result.internalData).toBe('AAAA-BBBB-CCCC-DDDD');
      expect(result.receiptSignature).toBe('XXXX-YYYY-ZZZZ');

      expect(calls).toHaveLength(2);
      expect(calls[0]?.url).toContain('/selectInitOsdcInfo');
      expect(calls[1]?.url).toContain('/trnsSalesSaveWr');
      const postedBody = JSON.parse(calls[1]?.body ?? '{}');
      expect(postedBody.tin).toBe('A123456789Z');
      expect(postedBody.itemList).toHaveLength(1);
      expect(postedBody.totAmt).toBe(11_600);
    });

    it('throws KraEtimsError when KRA returns non-000 resultCd', async () => {
      const { fn } = mockFetch([
        { resultCd: '000', resultMsg: 'Init OK', data: {} },
        { resultCd: '894', resultMsg: 'Invalid item class', data: {} },
      ]);
      const client = new KraEtimsClient(baseConfig, {
        fetchImpl: fn,
        sleep: async () => undefined,
      });
      await expect(client.submitInvoice(sampleInvoice())).rejects.toBeInstanceOf(
        KraEtimsError,
      );
    });
  });

  describe('queryItemClass', () => {
    it('returns a matching class row', async () => {
      const { fn } = mockFetch([
        { resultCd: '000', resultMsg: 'Init OK', data: {} },
        {
          resultCd: '000',
          resultMsg: 'OK',
          data: {
            itemClsList: [
              {
                itemClsCd: '5022140100',
                itemClsNm: 'Rental of residential property',
                itemClsLvl: 4,
                taxTyCd: 'A',
                useYn: 'Y',
              },
            ],
          },
        },
      ]);
      const client = new KraEtimsClient(baseConfig, {
        fetchImpl: fn,
        sleep: async () => undefined,
      });
      await client.registerDevice();
      const cls = await client.queryItemClass('5022140100');
      expect(cls).not.toBeNull();
      expect(cls?.itemClsNm).toContain('Rental');
    });
  });
});
