/**
 * SLA Management API routes
 *
 * Endpoints:
 * GET    /sla/config    - Get SLA configuration for tenant
 * PUT    /sla/config    - Update SLA configuration
 * GET    /sla/metrics   - Get SLA metrics for a period
 * GET    /sla/breaches  - Get SLA breach report
 * GET    /sla/health    - Real-time SLA health check
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { authMiddleware, requireRole } from '../middleware/hono-auth';
import { databaseMiddleware } from '../middleware/database';
import { validationErrorHook } from './validators';

const app = new Hono();

app.use('*', authMiddleware);
app.use('*', databaseMiddleware);

// ─── Schemas ────────────────────────────────────────────────

const metricsQuerySchema = z.object({
  period: z.enum(['day', 'week', 'month', 'quarter']).optional().default('week'),
  propertyId: z.string().optional(),
});

const breachQuerySchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
  propertyId: z.string().optional(),
});

const healthQuerySchema = z.object({
  propertyId: z.string().optional(),
});

const slaConfigSchema = z.object({
  configs: z.array(
    z.object({
      priority: z.enum(['EMERGENCY', 'URGENT', 'HIGH', 'MEDIUM', 'LOW']),
      responseTimeMinutes: z.number().positive(),
      resolutionTimeMinutes: z.number().positive(),
      escalationAfterMinutes: z.number().positive(),
    })
  ),
});

// ─── Mock Data ──────────────────────────────────────────────

const DEMO_SLA_CONFIG = [
  { priority: 'EMERGENCY', responseTimeMinutes: 30, resolutionTimeMinutes: 240, escalationAfterMinutes: 15 },
  { priority: 'URGENT', responseTimeMinutes: 60, resolutionTimeMinutes: 480, escalationAfterMinutes: 30 },
  { priority: 'HIGH', responseTimeMinutes: 240, resolutionTimeMinutes: 1440, escalationAfterMinutes: 120 },
  { priority: 'MEDIUM', responseTimeMinutes: 480, resolutionTimeMinutes: 2880, escalationAfterMinutes: 240 },
  { priority: 'LOW', responseTimeMinutes: 1440, resolutionTimeMinutes: 10080, escalationAfterMinutes: 720 },
];

// ─── Routes ─────────────────────────────────────────────────

// GET /sla/config
app.get('/config', async (c) => {
  return c.json({ success: true, data: DEMO_SLA_CONFIG });
});

// PUT /sla/config
app.put(
  '/config',
  zValidator('json', slaConfigSchema, validationErrorHook),
  async (c) => {
    const { configs } = c.req.valid('json');
    return c.json({ success: true, data: configs });
  }
);

// GET /sla/metrics
app.get(
  '/metrics',
  zValidator('query', metricsQuerySchema),
  async (c) => {
    const { period } = c.req.valid('query');

    const metrics = {
      period: {
        start: new Date(Date.now() - (period === 'day' ? 86400000 : period === 'week' ? 604800000 : period === 'month' ? 2592000000 : 7776000000)).toISOString(),
        end: new Date().toISOString(),
      },
      overall: {
        responseComplianceRate: 94.2,
        resolutionComplianceRate: 88.7,
        averageResponseTimeMinutes: 45,
        averageResolutionTimeMinutes: 380,
        totalWorkOrders: 156,
        completedWorkOrders: 142,
      },
      byPriority: {
        EMERGENCY: { count: 8, responseComplianceRate: 100, resolutionComplianceRate: 87.5, averageResponseTimeMinutes: 12, averageResolutionTimeMinutes: 180 },
        URGENT: { count: 22, responseComplianceRate: 95.5, resolutionComplianceRate: 90.9, averageResponseTimeMinutes: 28, averageResolutionTimeMinutes: 320 },
        HIGH: { count: 35, responseComplianceRate: 94.3, resolutionComplianceRate: 88.6, averageResponseTimeMinutes: 65, averageResolutionTimeMinutes: 540 },
        MEDIUM: { count: 58, responseComplianceRate: 93.1, resolutionComplianceRate: 89.7, averageResponseTimeMinutes: 120, averageResolutionTimeMinutes: 1200 },
        LOW: { count: 33, responseComplianceRate: 93.9, resolutionComplianceRate: 87.9, averageResponseTimeMinutes: 360, averageResolutionTimeMinutes: 4800 },
      },
      breaches: {
        responseBreaches: 9,
        resolutionBreaches: 18,
        escalations: 5,
      },
      trends: Array.from({ length: 7 }, (_, i) => ({
        date: new Date(Date.now() - (6 - i) * 86400000).toISOString().split('T')[0],
        responseComplianceRate: 90 + Math.random() * 8,
        resolutionComplianceRate: 85 + Math.random() * 10,
      })),
    };

    return c.json({ success: true, data: metrics });
  }
);

// GET /sla/breaches
app.get(
  '/breaches',
  zValidator('query', breachQuerySchema),
  async (c) => {
    const breaches = [
      { workOrderId: 'wo-001', workOrderNumber: 'WO-2026-0145', title: 'Burst pipe in Unit 3A', unit: 'Unit 3A - Block B', priority: 'EMERGENCY', breachType: 'resolution', breachTime: 45, assignedTo: 'PlumberPro Ltd', createdAt: '2026-02-18T08:00:00Z' },
      { workOrderId: 'wo-002', workOrderNumber: 'WO-2026-0148', title: 'Elevator malfunction', unit: 'Common Area - Block A', priority: 'URGENT', breachType: 'response', breachTime: 15, assignedTo: null, createdAt: '2026-02-19T14:30:00Z' },
      { workOrderId: 'wo-003', workOrderNumber: 'WO-2026-0151', title: 'AC not cooling', unit: 'Unit 5C - Block A', priority: 'HIGH', breachType: 'resolution', breachTime: 120, assignedTo: 'CoolAir Services', createdAt: '2026-02-17T10:00:00Z' },
    ];

    return c.json({ success: true, data: breaches });
  }
);

// GET /sla/health
app.get(
  '/health',
  zValidator('query', healthQuerySchema),
  async (c) => {
    const health = {
      atRisk: [
        { workOrderId: 'wo-010', workOrderNumber: 'WO-2026-0160', title: 'Security gate jammed', priority: 'URGENT', type: 'response', remainingMinutes: 18 },
        { workOrderId: 'wo-011', workOrderNumber: 'WO-2026-0158', title: 'Parking lot light out', priority: 'MEDIUM', type: 'resolution', remainingMinutes: 95 },
      ],
      breached: [
        { workOrderId: 'wo-012', workOrderNumber: 'WO-2026-0155', title: 'Water heater replacement', priority: 'HIGH', type: 'resolution', breachMinutes: 30 },
      ],
    };

    return c.json({ success: true, data: health });
  }
);

export const slaRouter = app;
