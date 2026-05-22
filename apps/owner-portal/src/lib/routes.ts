/**
 * Owner-portal routes registry.
 *
 * Canonical lookup for every Vite SPA path in the owner portal. Pages
 * MUST resolve URLs through this table — never hard-code
 * `'/properties/${id}'` or `'/documents/lease'` inline.
 *
 * Adding a new route → register it here. The scanner
 * `audit-hardcoded-routes.mjs` allow-lists this file by path because
 * it IS the route registry.
 */

export const ROUTES = {
  home: '/',

  dashboard: '/dashboard',

  properties: {
    root: '/properties',
    detail: (id: string): string => `/properties/${id}`,
  },

  documents: {
    root: '/documents',
    compliance: '/documents/compliance',
    eSignature: '/documents/e-signature',
  },

  settings: '/settings',
  configuration: '/configuration',
} as const;

export type RoutePath = string;
