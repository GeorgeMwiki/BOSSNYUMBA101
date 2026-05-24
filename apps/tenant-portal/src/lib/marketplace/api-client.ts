/**
 * Typed fetch wrappers around `/api/v1/marketplace-universal/*`.
 *
 * Mirrors `apps/tenant-portal/src/lib/ask-client.ts` — session cookie
 * is sent by the browser. When the cookie is missing the api-gateway
 * returns 401 and the UI surfaces a sign-in nudge.
 */

import type {
  ApplicationRecord,
  InquiryRecord,
  JoinCodeRedemption,
  JoinErrorCode,
  ListingsFilters,
  ListingsPage,
  MarketplaceListingDetail,
  OrgMembership,
  OrgProfile,
  OrgSummary,
  TenderSummary,
} from './types.js';

const API_BASE =
  (typeof process !== 'undefined'
    ? process.env.NEXT_PUBLIC_API_BASE
    : undefined) ?? '/api/v1';

interface ApiEnvelope<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: { readonly code: string; readonly message: string };
  readonly meta?: { readonly total: number; readonly page: number; readonly pageSize: number };
}

async function unwrap<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!res.ok) {
    const code = body?.error?.code ?? 'HTTP_ERROR';
    const message = body?.error?.message ?? `Request failed (${res.status})`;
    const err = new Error(message) as Error & { code: string };
    err.code = code;
    throw err;
  }
  if (!body || !body.success || body.data === undefined) {
    throw new Error('Malformed API response');
  }
  return body.data;
}

async function unwrapPage<T>(
  res: Response,
): Promise<{ readonly items: ReadonlyArray<T>; readonly total: number; readonly page: number; readonly pageSize: number }> {
  const body = (await res.json().catch(() => null)) as
    | (ApiEnvelope<ReadonlyArray<T>> & {
        readonly meta?: { total: number; page: number; pageSize: number };
      })
    | null;
  if (!res.ok || !body || !body.success || !body.data) {
    const code = body?.error?.code ?? 'HTTP_ERROR';
    const message = body?.error?.message ?? `Request failed (${res.status})`;
    const err = new Error(message) as Error & { code: string };
    err.code = code;
    throw err;
  }
  return {
    items: body.data,
    total: body.meta?.total ?? body.data.length,
    page: body.meta?.page ?? 1,
    pageSize: body.meta?.pageSize ?? body.data.length,
  };
}

/**
 * Optional fetch impl for tests. Browser code passes nothing — Node
 * tests inject a stub. The shape is just `fetch`.
 */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface MarketplaceClient {
  listOrgs(): Promise<ReadonlyArray<OrgSummary>>;
  getOrg(orgId: string): Promise<OrgProfile>;
  searchListings(filters: ListingsFilters): Promise<ListingsPage>;
  getListing(listingId: string): Promise<MarketplaceListingDetail>;
  listTenders(orgId?: string): Promise<ReadonlyArray<TenderSummary>>;
  postInquiry(
    listingId: string,
    input: { message: string; proposedPrice?: number },
  ): Promise<InquiryRecord>;
  postApplication(
    listingId: string,
    input: { letterBody: string },
  ): Promise<ApplicationRecord>;
  joinOrg(orgCode: string): Promise<JoinCodeRedemption>;
  listMyOrgs(): Promise<ReadonlyArray<OrgMembership>>;
}

export function createMarketplaceClient(
  fetchImpl: FetchLike = (typeof fetch === 'function' ? fetch.bind(globalThis) : null) as FetchLike,
): MarketplaceClient {
  if (!fetchImpl) {
    throw new Error('No fetch implementation available — pass one explicitly.');
  }

  function url(path: string, params?: Record<string, string | number | undefined>): string {
    if (!params) return `${API_BASE}/marketplace-universal${path}`;
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') qs.append(k, String(v));
    }
    const q = qs.toString();
    return `${API_BASE}/marketplace-universal${path}${q ? `?${q}` : ''}`;
  }

  return {
    async listOrgs() {
      const res = await fetchImpl(url('/orgs'), { credentials: 'include' });
      return unwrap<ReadonlyArray<OrgSummary>>(res);
    },
    async getOrg(orgId) {
      const res = await fetchImpl(url(`/orgs/${encodeURIComponent(orgId)}`), {
        credentials: 'include',
      });
      return unwrap<OrgProfile>(res);
    },
    async searchListings(filters) {
      const res = await fetchImpl(url('/listings', filters as Record<string, string | number | undefined>), {
        credentials: 'include',
      });
      return unwrapPage(res);
    },
    async getListing(listingId) {
      const res = await fetchImpl(url(`/listings/${encodeURIComponent(listingId)}`), {
        credentials: 'include',
      });
      return unwrap<MarketplaceListingDetail>(res);
    },
    async listTenders(orgId) {
      const res = await fetchImpl(url('/tenders', { orgId }), {
        credentials: 'include',
      });
      return unwrap<ReadonlyArray<TenderSummary>>(res);
    },
    async postInquiry(listingId, input) {
      const res = await fetchImpl(
        url(`/listings/${encodeURIComponent(listingId)}/inquiries`),
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(input),
        },
      );
      return unwrap<InquiryRecord>(res);
    },
    async postApplication(listingId, input) {
      const res = await fetchImpl(
        url(`/listings/${encodeURIComponent(listingId)}/applications`),
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(input),
        },
      );
      return unwrap<ApplicationRecord>(res);
    },
    async joinOrg(orgCode) {
      const res = await fetchImpl(url('/join-org'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orgCode }),
      });
      return unwrap<JoinCodeRedemption>(res);
    },
    async listMyOrgs() {
      const res = await fetchImpl(url('/me/orgs'), { credentials: 'include' });
      return unwrap<ReadonlyArray<OrgMembership>>(res);
    },
  };
}

/** Singleton convenience — UI components import this when not testing. */
export const marketplaceClient: MarketplaceClient = createMarketplaceClient();

/** Map an error code from the API into a human-friendly message. */
export function joinErrorMessage(code: JoinErrorCode | string): string {
  switch (code) {
    case 'CODE_NOT_FOUND':
      return 'We could not find an organisation matching that code.';
    case 'CODE_EXPIRED':
      return 'This code has expired. Ask the organisation for a new one.';
    case 'CODE_EXHAUSTED':
      return 'This code has reached its use limit.';
    case 'CODE_REVOKED':
      return 'This code has been revoked.';
    case 'ALREADY_MEMBER':
      return 'You already have a membership for this organisation.';
    case 'UNAUTHORIZED':
      return 'Sign in to join an organisation.';
    default:
      return 'Could not join the organisation. Please try again.';
  }
}

/** Format a price range for display in the listing cards. */
export function formatPriceRange(
  min: number,
  max: number,
  currency: string,
  locale = 'en-KE',
): string {
  try {
    const fmt = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    });
    if (min === max) return fmt.format(min);
    return `${fmt.format(min)} – ${fmt.format(max)}`;
  } catch {
    return `${currency} ${min.toLocaleString()} – ${max.toLocaleString()}`;
  }
}
