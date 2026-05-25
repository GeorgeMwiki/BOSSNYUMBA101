/**
 * api-client unit tests — verify the wire envelope is unwrapped
 * correctly + errors carry the API `code` field through.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  createMarketplaceClient,
  formatPriceRange,
  joinErrorMessage,
} from './api-client';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('createMarketplaceClient', () => {
  it('unwraps the success envelope for listOrgs', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        data: [{ orgId: 'org_a', name: 'Test Org', listingCount: 1, tenderCount: 0, slug: 'a', description: null, city: null, country: null }],
      }),
    );
    const client = createMarketplaceClient(fetchMock);
    const orgs = await client.listOrgs();
    expect(orgs).toHaveLength(1);
    expect(orgs[0].orgId).toBe('org_a');
  });

  it('throws with the API code on a 401', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'go away' } },
        401,
      ),
    );
    const client = createMarketplaceClient(fetchMock);
    try {
      await client.listMyOrgs();
      expect.fail('expected throw');
    } catch (e) {
      expect((e as Error & { code: string }).code).toBe('UNAUTHORIZED');
    }
  });

  it('unwraps a paginated envelope into items + meta', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        data: [{ listingId: 'l1' }],
        meta: { total: 7, page: 2, pageSize: 5 },
      }),
    );
    const client = createMarketplaceClient(fetchMock);
    const page = await client.searchListings({ page: 2, pageSize: 5 });
    expect(page.items).toHaveLength(1);
    expect(page.total).toBe(7);
    expect(page.page).toBe(2);
  });

  it('serialises filters into query params', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ success: true, data: [], meta: { total: 0, page: 1, pageSize: 20 } }),
    );
    const client = createMarketplaceClient(fetchMock);
    await client.searchListings({
      city: 'Nairobi',
      minPrice: 50000,
      page: 1,
      pageSize: 20,
    });
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain('city=Nairobi');
    expect(calledUrl).toContain('minPrice=50000');
  });

  it('POSTs JSON body to inquiries', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(
        {
          success: true,
          data: {
            inquiryId: 'inq_x',
            listingId: 'lst_x',
            userId: 'u1',
            message: 'hi',
            proposedPrice: null,
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        },
        201,
      ),
    );
    const client = createMarketplaceClient(fetchMock);
    const r = await client.postInquiry('lst_x', { message: 'hi' });
    expect(r.inquiryId).toBe('inq_x');
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ message: 'hi' });
  });
});

describe('formatPriceRange', () => {
  it('renders min === max as a single price', () => {
    const s = formatPriceRange(50000, 50000, 'KES');
    expect(s).toContain('50,000');
    expect(s).not.toContain('–');
  });

  it('renders a range with an en-dash', () => {
    const s = formatPriceRange(40000, 50000, 'KES');
    expect(s).toContain('–');
  });

  it('falls back to plain numbers on a bad currency', () => {
    const s = formatPriceRange(10, 20, 'XYZ-NOT-A-CURRENCY');
    // The fallback path always shows plain numbers.
    expect(s).toMatch(/10/);
  });
});

describe('joinErrorMessage', () => {
  it('returns friendly text for every known code', () => {
    expect(joinErrorMessage('CODE_NOT_FOUND')).toContain('could not find');
    expect(joinErrorMessage('CODE_EXPIRED')).toContain('expired');
    expect(joinErrorMessage('CODE_EXHAUSTED')).toContain('use limit');
    expect(joinErrorMessage('CODE_REVOKED')).toContain('revoked');
    expect(joinErrorMessage('ALREADY_MEMBER')).toContain('already');
    expect(joinErrorMessage('UNAUTHORIZED')).toContain('Sign in');
    expect(joinErrorMessage('SOMETHING_ELSE')).toContain('try again');
  });
});
