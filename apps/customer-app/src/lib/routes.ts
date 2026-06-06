/**
 * Customer-app routes registry.
 *
 * Canonical lookup table for every Next.js page path in the customer
 * app. Pages MUST resolve URLs through this table — never hard-code
 * `'/auth/login'` or `'/onboarding/welcome'` inline.
 *
 * Two access patterns are supported:
 *
 *   1. STATIC paths:        `ROUTES.auth.login`              → '/auth/login'
 *   2. PARAMETERISED paths: `ROUTES.payments.detail(id)`     → '/payments/abc'
 *
 * Adding a new route → register it here. The scanner
 * `audit-hardcoded-routes.mjs` allow-lists this file by path because
 * it IS the route registry.
 */

export const ROUTES = {
  home: '/',

  auth: {
    login: '/auth/login',
    register: '/auth/register',
    otp: '/auth/otp',
    otpWithPhone: (phone: string, mode?: string): string => {
      const q = new URLSearchParams({ phone });
      if (mode) q.set('mode', mode);
      return `/auth/otp?${q.toString()}`;
    },
  },

  onboarding: {
    root: '/onboarding',
    welcome: '/onboarding/welcome',
    documents: '/onboarding/documents',
    inspection: '/onboarding/inspection',
    orientation: '/onboarding/orientation',
    utilities: '/onboarding/utilities',
    eSign: '/onboarding/e-sign',
    complete: '/onboarding/complete',
    redeem: '/onboarding/redeem',
    redeemCode: '/onboarding/redeem-code',
  },

  emergencies: {
    root: '/emergencies',
    report: '/emergencies/report',
    reported: '/emergencies?reported=true',
  },

  feedback: {
    root: '/feedback',
    history: '/feedback/history',
  },

  lease: {
    root: '/lease',
    renewal: '/lease/renewal',
    moveOut: '/lease/move-out',
  },

  payments: {
    root: '/payments',
    history: '/payments/history',
    mpesa: '/payments/mpesa',
    bankTransfer: '/payments/bank-transfer',
    pay: '/payments/pay',
    /**
     * Method picker, optionally pre-bound to an existing pending payment
     * intent (`id`) and its amount. When `id` is omitted the picker
     * creates a fresh intent from the entered amount before settlement.
     */
    payWith: (params: { id?: string; amount?: number | string; currency?: string }): string => {
      const q = new URLSearchParams();
      if (params.id) q.set('id', params.id);
      if (params.amount != null) q.set('amount', String(params.amount));
      if (params.currency) q.set('currency', params.currency);
      const qs = q.toString();
      return qs ? `/payments/pay?${qs}` : '/payments/pay';
    },
    /**
     * STK push screen. `amount` is shown to the user; `id`, when present,
     * is the existing intent to settle (otherwise the screen creates one
     * using `currency`).
     */
    mpesaWith: (params: { id?: string; amount?: number | string; currency?: string }): string => {
      const q = new URLSearchParams();
      if (params.id) q.set('id', params.id);
      if (params.amount != null) q.set('amount', String(params.amount));
      if (params.currency) q.set('currency', params.currency);
      const qs = q.toString();
      return qs ? `/payments/mpesa?${qs}` : '/payments/mpesa';
    },
    mpesaWithAmount: (amount: number | string): string =>
      `/payments/mpesa?amount=${amount}`,
    bankTransferWithAmount: (amount: number | string): string =>
      `/payments/bank-transfer?amount=${amount}`,
  },

  requests: {
    root: '/requests',
    new: '/requests/new',
    submitted: '/requests?submitted=true',
  },

  utilities: {
    root: '/utilities',
    submitReading: '/utilities/submit-reading',
    submitted: '/utilities?submitted=true',
  },

  profile: '/profile',
  assistant: '/assistant',
  assistantWithQuery: (q: string): string =>
    `/assistant?q=${encodeURIComponent(q)}`,
} as const;

export type RoutePath = string;
