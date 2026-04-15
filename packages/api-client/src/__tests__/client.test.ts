/**
 * Baseline tests for @bossnyumba/api-client.
 *
 * Covers:
 *  - Public surface exported from index
 *  - Singleton lifecycle (initializeApiClient / getApiClient / hasApiClient)
 *  - buildQueryParams utility
 *  - Representative services (properties, payments) exposing expected methods
 */

import { describe, it, expect } from 'vitest';
import * as api from '../index';
import { propertiesService } from '../services/properties';
import { paymentsService, paymentMethodsService, statementsService } from '../services/payments';
import { buildQueryParams } from '../types';
import {
  ApiClient,
  ApiClientError,
  createApiClient,
  initializeApiClient,
  getApiClient,
  hasApiClient,
} from '../client';

describe('api-client package surface', () => {
  it('re-exports core client symbols from index', () => {
    expect(typeof api.ApiClient).toBe('function');
    expect(typeof api.ApiClientError).toBe('function');
    expect(typeof api.createApiClient).toBe('function');
    expect(typeof api.initializeApiClient).toBe('function');
    expect(typeof api.getApiClient).toBe('function');
    expect(typeof api.hasApiClient).toBe('function');
  });

  it('re-exports at least one React hook', () => {
    expect(typeof (api as Record<string, unknown>).useQuery).toBe('function');
    expect(typeof (api as Record<string, unknown>).useMutation).toBe('function');
  });

  it('re-exports service modules', () => {
    expect(typeof (api as Record<string, unknown>).propertiesService).toBe('object');
    expect(typeof (api as Record<string, unknown>).paymentsService).toBe('object');
  });
});

describe('ApiClient construction and singleton', () => {
  it('createApiClient returns an ApiClient instance without affecting the singleton', () => {
    // Singleton may already be initialised from another test file; capture current state.
    const preExisting = hasApiClient();
    const client = createApiClient({ baseUrl: 'https://example.test' });
    expect(client).toBeInstanceOf(ApiClient);
    // createApiClient does not mutate the default singleton.
    expect(hasApiClient()).toBe(preExisting);
  });

  it('initializeApiClient installs the default singleton and getApiClient returns it', () => {
    const client = initializeApiClient({ baseUrl: 'https://example.test' });
    expect(client).toBeInstanceOf(ApiClient);
    expect(hasApiClient()).toBe(true);
    expect(getApiClient()).toBe(client);
  });

  it('ApiClientError carries status, code and retry flags', () => {
    const err = new ApiClientError('ERR_CODE', 'boom', {
      status: 503,
      isNetworkError: false,
      isTimeout: true,
    });
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe('ERR_CODE');
    expect(err.status).toBe(503);
    expect(err.isTimeout).toBe(true);
    // Any >=500 or timeout/network error is retryable.
    expect(err.isRetryable).toBe(true);
    expect(err.toJSON()).toMatchObject({ code: 'ERR_CODE', message: 'boom' });
  });
});

describe('buildQueryParams', () => {
  it('omits undefined/null and stringifies primitives', () => {
    const out = buildQueryParams({
      page: 1,
      pageSize: 20,
      active: true,
      status: undefined,
      search: null,
      tags: ['a', 'b'],
    });
    expect(out).toEqual({
      page: '1',
      pageSize: '20',
      active: 'true',
      tags: 'a,b',
    });
  });

  it('drops empty arrays entirely', () => {
    const out = buildQueryParams({ tags: [] as string[] });
    expect(out).toEqual({});
  });
});

describe('service method surface', () => {
  it('propertiesService exposes the expected CRUD methods', () => {
    const methods = ['list', 'get', 'create', 'update', 'delete', 'getUnits'] as const;
    for (const m of methods) {
      expect(typeof (propertiesService as Record<string, unknown>)[m]).toBe('function');
    }
  });

  it('paymentsService and siblings expose expected methods', () => {
    expect(typeof paymentsService.list).toBe('function');
    expect(typeof paymentsService.process).toBe('function');
    expect(typeof paymentsService.getPendingPayments).toBe('function');
    expect(typeof paymentsService.getBalance).toBe('function');

    expect(typeof paymentMethodsService.addMpesa).toBe('function');
    expect(typeof paymentMethodsService.setDefault).toBe('function');

    expect(typeof statementsService.list).toBe('function');
    expect(typeof statementsService.downloadPdf).toBe('function');
  });
});
