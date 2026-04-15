/**
 * Admin portal typed API clients.
 *
 * Thin feature-scoped fetchers that build on the shared request helper in
 * `../api`. Each module exports react-query hooks that pages consume directly.
 */

export * from './operations';
export * from './roles';
export * from './approvals';
export * from './support';
export * from './audit';
export * from './configuration';
export * from './webhooks';
export * from './api-keys';
export * from './communications';
export * from './tenants';
