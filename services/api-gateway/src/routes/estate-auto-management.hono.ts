/**
 * Estate auto-management router.
 *
 *   POST /estate-auto-management/predictive-maintenance
 *
 * Wraps the pure `forecastFailure` + `maybeTriggerDispatch` pair
 * from `@bossnyumba/estate-auto-management`. Given an asset
 * telemetry sample, returns the failure forecast AND (if the 30-day
 * probability crosses the policy threshold) a vendor-dispatch
 * trigger ready to hand to a WorkOrderPort.
 *
 * Tenant-scoped + audit-logged.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import {
  forecastFailure,
  maybeTriggerDispatch,
  escalationPlan,
} from '@bossnyumba/estate-auto-management';
import { withSecurityEvents } from '@bossnyumba/observability';
import { authMiddleware } from '../middleware/hono-auth.js';
import { safeInternalError } from '../utils/safe-error.js';

type AnyCtx = any;

const FamilyEnum = z.enum([
  'hvac',
  'elevator',
  'pump',
  'generator',
  'gate-motor',
]);

const VerdictEnum = z.enum(['healthy', 'monitor', 'service', 'urgent']);

const TelemetrySchema = z.object({
  assetId: z.string().min(1),
  family: FamilyEnum,
  vibrationMm: z.number().nonnegative(),
  tempC: z.number(),
  runHours: z.number().nonnegative(),
  lastServiceAgeDays: z.number().nonnegative(),
  spikeCount30d: z.number().int().nonnegative(),
});

const PolicySchema = z.object({
  dispatchAtProb30d: z.number().min(0).max(1),
  slaHoursByVerdict: z
    .record(VerdictEnum, z.number().int().positive())
    .optional(),
});

const PredictiveInputSchema = z.object({
  telemetry: TelemetrySchema,
  policy: PolicySchema,
});

const router = new Hono();
router.use('*', authMiddleware);

router.post(
  '/predictive-maintenance',
  withSecurityEvents(
    {
      action: 'estate-auto-management.run',
      resource: 'estate-auto-management',
      severity: 'info',
    },
    async (c: AnyCtx) => {
      const tenantId = c.get('tenantId');
      if (!tenantId) {
        return c.json(
          {
            success: false,
            error: { code: 'MISSING_TENANT', message: 'tenantId required' },
          },
          400,
        );
      }
      let body;
      try {
        body = await c.req.json();
      } catch {
        return c.json(
          {
            success: false,
            error: { code: 'INVALID_JSON', message: 'invalid JSON body' },
          },
          400,
        );
      }
      const parsed = PredictiveInputSchema.safeParse(body);
      if (!parsed.success) {
        return c.json(
          {
            success: false,
            error: { code: 'BAD_REQUEST', message: parsed.error.message },
          },
          400,
        );
      }
      try {
        const forecast = forecastFailure(parsed.data.telemetry as never);
        const dispatch = maybeTriggerDispatch(
          forecast,
          parsed.data.policy as never,
        );
        return c.json({ success: true, data: { forecast, dispatch } });
      } catch (e) {
        return safeInternalError(c, e, {
          code: 'ADVISOR_ERROR',
          fallback: 'estate-auto-management failed',
        });
      }
    },
  ),
);

// GET /estate-auto-management/dashboard — the aggregated tenant view the admin
// estate-auto advisor panel renders (forecasts · collection cadence · vendor
// scorecard). Returns the data that is REAL today; the rest is honestly empty
// (no fabricated rows) until its source is wired:
//   - collectionCadence: the canonical escalation ladder (deterministic policy
//     engine) — always populated; tenant-level default = the non-cure-cohort
//     full ladder.
//   - forecasts: forecastFailure() needs live asset telemetry (vibration / temp
//     / run-hours / spike-count) which is not yet ingested into the asset
//     register, so this is [] until a telemetry feed exists. On-demand per-asset
//     forecasts are served by POST /estate-auto-management/predictive-maintenance.
//   - vendorScorecard: scoreVendor() needs vendor bid/quality inputs; no vendor
//     marketplace table is wired yet, so this is [] until vendor data lands.
router.get(
  '/dashboard',
  withSecurityEvents(
    {
      action: 'estate-auto-management.dashboard',
      resource: 'estate-auto-management',
      severity: 'info',
    },
    async (c: AnyCtx) => {
      const tenantId = c.get('tenantId');
      if (!tenantId) {
        return c.json(
          {
            success: false,
            error: { code: 'MISSING_TENANT', message: 'tenantId required' },
          },
          400,
        );
      }
      try {
        const collectionCadence = escalationPlan(
          { fullPayCountLast6m: 0, currentBalanceMonths: 2 } as never,
        );
        const forecasts: ReadonlyArray<never> = [];
        const vendorScorecard: ReadonlyArray<never> = [];
        return c.json({
          success: true,
          data: { forecasts, collectionCadence, vendorScorecard },
        });
      } catch (e) {
        return safeInternalError(c, e, {
          code: 'ADVISOR_ERROR',
          fallback: 'estate-auto-management dashboard failed',
        });
      }
    },
  ),
);

export default router;
