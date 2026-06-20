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

  login: '/login',

  dashboard: '/dashboard',

  portfolio: {
    root: '/portfolio',
    ask: '/portfolio/ask',
    askWithQuery: (q: string): string =>
      `/portfolio/ask?q=${encodeURIComponent(q)}`,
  },

  financial: {
    root: '/financial',
    overview: '/financial?tab=overview',
    statements: '/financial?tab=statements',
    invoicesOverdue: '/financial?tab=invoices&filter=overdue',
  },

  managerChat: {
    root: '/manager-chat',
    withQuery: (params: string): string => `/manager-chat?${params}`,
  },

  jarvis: '/jarvis',

  analytics: {
    occupancy: '/analytics/occupancy',
  },

  properties: {
    root: '/properties',
    detail: (id: string): string => `/properties/${id}`,
  },

  documents: {
    root: '/documents',
    compliance: '/documents/compliance',
    eSignature: '/documents/e-signature',
  },

  settings: {
    root: '/settings',
    connectedAgents: '/settings/connected-agents',
  },
  configuration: '/configuration',
} as const;

export type RoutePath = string;
