/**
 * BOSSNYUMBA API Client
 * Shared API client for customer and manager apps
 */

// Core client
export {
  ApiClient,
  ApiClientError,
  initializeApiClient,
  getApiClient,
  hasApiClient,
  createApiClient,
  type HttpMethod,
  type RequestOptions,
  type RequestInterceptor,
  type ResponseInterceptor,
  type ErrorInterceptor,
} from './client';

// Types
export * from './types';

// React Hooks
export {
  // Query hooks
  useQuery,
  useMutation,
  useInfiniteQuery,
  usePrefetch,
  useInvalidateQueries,
  useIsAuthenticated,
  // Pre-built mutations
  useCreateMutation,
  useUpdateMutation,
  usePatchMutation,
  useDeleteMutation,
  // Types
  type QueryOptions,
  type QueryResult,
  type MutationOptions,
  type MutationResult,
  type InfiniteQueryOptions,
  type InfiniteQueryResult,
} from './hooks';

// Services
export * from './services/tenants';
export * from './services/properties';
export * from './services/units';
export * from './services/customers';
export * from './services/leases';
export * from './services/invoices';
export * from './services/payments';
export * from './services/work-orders';
export * from './services/vendors';
export * from './services/inspections';
export * from './services/documents';
export * from './services/notifications';
export * from './services/reports';
export * from './services/feedback';
export * from './services/messaging';
export * from './services/scheduling';
export * from './services/sla';
