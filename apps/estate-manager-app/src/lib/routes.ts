/**
 * Estate-manager-app routes registry.
 *
 * Canonical lookup for every Next.js page path in the estate-manager
 * app. Pages MUST resolve URLs through this table — never hard-code
 * `'/announcements/create'` or `'/ask'` inline.
 *
 * Adding a new route → register it here. The scanner
 * `audit-hardcoded-routes.mjs` allow-lists this file by path because
 * it IS the route registry.
 */

export const ROUTES = {
  home: '/',

  announcements: {
    root: '/announcements',
    create: '/announcements/create',
    detail: (id: string): string => `/announcements/${id}`,
  },

  ask: {
    root: '/ask',
    thread: (threadId: string): string => `/ask/${threadId}`,
  },

  customers: {
    root: '/customers',
    detail: (id: string): string => `/customers/${id}`,
  },

  payments: {
    root: '/payments',
    detail: (id: string): string => `/payments/${id}`,
  },

  workOrders: {
    root: '/work-orders',
    detail: (id: string): string => `/work-orders/${id}`,
  },

  utilities: {
    root: '/utilities',
    bills: '/utilities/bills',
  },
} as const;

export type RoutePath = string;
