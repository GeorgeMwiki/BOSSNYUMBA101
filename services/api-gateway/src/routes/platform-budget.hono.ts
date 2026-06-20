// @ts-nocheck — Hono v4 status-code literal union widens c.json branches.

/**
 * /api/v1/platform/budget — HQ-tier privacy-budget (ε) readout.
 *
 * Backs the admin-platform-portal Home "Privacy budget" panel
 * (apps/admin-platform-portal/src/app/page.tsx + StaffNav). That panel
 * proxies GET /api/platform/budget → GET /api/v1/platform/budget and
 * reads `{ remainingEpsilon, totalEpsilon, windowLabel }` off the JSON
 * body at the top level (not wrapped in `{ data }`).
 *
 * Auth is platform-tier — identical to /platform/overview: an
 * authenticated request whose role is one of the platform-admin trio
 * (SUPER_ADMIN, ADMIN, SUPPORT). Tenant-scoped roles are rejected 403.
 *
 * The readout is sourced from the composed (ε, δ) ledger
 * (`services.privacyBudgetComposer`, the K6.2 single refusal gate). The
 * platform-wide cohort budget is the `platform` tier window; we read it
 * for the caller's HQ tenant so the number tracks the same window the
 * dp-aggregator debits. On any failure we return a 200 with the fields
 * absent so the panel's degraded card renders cleanly (it keys off
 * `typeof remainingEpsilon === 'number'`), never a 5xx that would blank
 * the whole Home screen.
 */

import { Hono } from 'hono';
import { authMiddleware } from '../middleware/hono-auth';
import { isPlatformAdmin, type UserRole } from '../types/user-role';

const platformBudgetRouter = new Hono();
platformBudgetRouter.use('*', authMiddleware);

/**
 * Derive a short, human-readable label for the 30-day rolling window
 * from its ISO start timestamp. Locale-correct formatting is the
 * panel's job; this is an ASCII-safe "30-day window from <date>" hint
 * that the panel renders verbatim. Returns null if the start is not a
 * usable ISO date so the panel simply omits the label.
 */
function deriveWindowLabel(windowStart: string | null | undefined): string | null {
  if (!windowStart || typeof windowStart !== 'string') return null;
  const parsed = new Date(windowStart);
  if (Number.isNaN(parsed.getTime())) return null;
  // YYYY-MM-DD — stable, locale-neutral; the panel concatenates it after
  // a separator. We deliberately avoid Intl here so the value is identical
  // across server locales.
  const day = parsed.toISOString().slice(0, 10);
  return `30-day window from ${day}`;
}

platformBudgetRouter.get('/', async (c) => {
  const auth = c.get('auth') ?? {};
  const role = auth.role as UserRole | undefined;
  if (!role || !isPlatformAdmin(role)) {
    return c.json(
      {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message:
            'platform-budget requires a platform-tier role (SUPER_ADMIN / ADMIN / SUPPORT)',
        },
      },
      403,
    );
  }

  const services = c.get('services') as
    | { privacyBudgetComposer?: import('@bossnyumba/database').PrivacyBudgetComposerService }
    | undefined;
  const composer = services?.privacyBudgetComposer;
  const tenantId = typeof auth.tenantId === 'string' ? auth.tenantId : null;

  if (!composer || !tenantId) {
    // Honest degrade — no composer wired or no tenant on the session.
    // 200 with no epsilon fields so the panel shows its degraded card.
    return c.json(
      {
        success: false,
        error: {
          code: 'PARTIAL',
          message:
            'privacy-budget composer not configured; panel should render the degraded card',
        },
      },
      200,
    );
  }

  try {
    // The platform-wide cohort budget is the `platform` tier window —
    // the same window the dp-aggregator debits. Reading it lazily opens
    // the window at the tier cap (ε=5.0) on first read.
    const remaining = await composer.getRemainingBudget({
      tenantId,
      tier: 'platform',
    });
    return c.json({
      success: true,
      remainingEpsilon: remaining.remainingEpsilon,
      totalEpsilon: remaining.totalEpsilon,
      windowLabel: deriveWindowLabel(remaining.windowStart),
    });
  } catch (error) {
    // Never blank the Home screen on a ledger read failure — degrade.
    return c.json(
      {
        success: false,
        error: {
          code: 'PARTIAL',
          message:
            error instanceof Error
              ? error.message
              : 'privacy-budget readout failed',
        },
      },
      200,
    );
  }
});

export default platformBudgetRouter;
