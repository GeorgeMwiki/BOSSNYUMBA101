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
  login: '/login',

  announcements: {
    root: '/announcements',
    create: '/announcements/create',
    detail: (id: string): string => `/announcements/${id}`,
  },

  ask: {
    root: '/ask',
    thread: (threadId: string): string => `/ask/${threadId}`,
    threadWithSeed: (threadId: string, seed: string): string =>
      `/ask/${encodeURIComponent(threadId)}?seed=${encodeURIComponent(seed)}`,
  },

  brain: {
    root: '/brain',
    withQuery: (q: string): string =>
      `/brain?q=${encodeURIComponent(q)}`,
    threads: '/brain/threads',
  },

  calendar: {
    root: '/calendar',
    events: '/calendar/events',
    availability: '/calendar/availability',
  },

  coworker: {
    root: '/coworker',
    training: '/coworker/training',
    trainingScenarios: '/coworker/training/scenarios',
    trainingCheckpoint: '/coworker/training/checkpoint',
    // Wave COURSE-GEN — AI course-generation flow (migration 0309).
    createCourse: '/coworker/training/create-course',
    course: (id: string): string =>
      `/coworker/training/course/${encodeURIComponent(id)}`,
  },

  customers: {
    root: '/customers',
    new: '/customers/new',
    detail: (id: string): string => `/customers/${id}`,
  },

  inspections: {
    schedule: '/inspections/schedule',
  },

  leases: {
    root: '/leases',
    new: '/leases/new',
    detail: (leaseId: string): string => `/leases/${leaseId}`,
  },

  messaging: {
    root: '/messaging',
    new: '/messaging/new',
    detail: (id: string): string => `/messaging/${id}`,
  },

  payments: {
    root: '/payments',
    record: '/payments/record',
    receive: '/payments/receive',
    arrears: '/payments/arrears',
    invoices: '/payments/invoices',
    invoiceDetail: (id: string): string => `/payments/invoices/${id}`,
    detail: (id: string): string => `/payments/${id}`,
  },

  properties: {
    root: '/properties',
    new: '/properties/new',
    detail: (id: string): string => `/properties/${id}`,
  },

  reports: {
    root: '/reports',
    generate: '/reports/generate',
    scheduled: '/reports/scheduled',
    scheduledNew: '/reports/scheduled/new',
  },

  settings: {
    root: '/settings',
  },

  units: {
    root: '/units',
    new: '/units/new',
    detail: (id: string): string => `/units/${id}`,
  },

  utilities: {
    root: '/utilities',
    bills: '/utilities/bills',
    billsPay: '/utilities/bills/pay',
    readings: '/utilities/readings',
    readingsRecord: '/utilities/readings/record',
  },

  vendors: {
    root: '/vendors',
    new: '/vendors/new',
  },

  workOrders: {
    root: '/work-orders',
    new: '/work-orders/new',
    detail: (id: string): string => `/work-orders/${id}`,
  },
} as const;

export type RoutePath = string;
