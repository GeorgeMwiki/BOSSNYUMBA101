/**
 * Integration tests for Work Order endpoints
 *
 * POST /work-orders - create
 * POST /work-orders/:id/assign - assign (API uses POST)
 * POST /work-orders/:id/complete - complete (API uses POST)
 */

import { describe, it, expect } from 'vitest';
import {
  createTestAgent,
  BASE_PATH,
  getAuthToken,
  authHeader,
} from './setup';
import {
  DEMO_WORK_ORDERS,
  DEMO_UNITS,
  DEMO_PROPERTIES,
  DEMO_CUSTOMERS,
  DEMO_VENDORS,
} from '../data/mock-data';

const agent = createTestAgent();

// wo-001: IN_PROGRESS (PLUMBING) - can complete
// wo-002: SUBMITTED (ELECTRICAL) - can assign to vendor-002
const woInProgress = DEMO_WORK_ORDERS.find((w) => w.status === 'IN_PROGRESS');
const woSubmitted = DEMO_WORK_ORDERS.find((w) => w.status === 'SUBMITTED');
const vendorForElectrical = DEMO_VENDORS.find((v) =>
  v.categories.includes('ELECTRICAL')
);

describe('Work Orders API', () => {
  describe('POST /work-orders', () => {
    it('should create work order', async () => {
      const token = getAuthToken();
      const unit = DEMO_UNITS[0];
      const property = DEMO_PROPERTIES[0];

      const res = await agent
        .post(`${BASE_PATH}/work-orders`)
        .set(authHeader(token))
        .send({
          unitId: unit.id,
          propertyId: property.id,
          customerId: DEMO_CUSTOMERS[0].id,
          category: 'PLUMBING',
          priority: 'MEDIUM',
          title: `Test work order ${Date.now()}`,
          description: 'Integration test work order description',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.title).toContain('Test work order');
      expect(res.body.data.category).toBe('PLUMBING');
      expect(res.body.data.status).toBe('SUBMITTED');
    });

    it('should return 404 for non-existent unit', async () => {
      const token = getAuthToken();
      const property = DEMO_PROPERTIES[0];

      const res = await agent
        .post(`${BASE_PATH}/work-orders`)
        .set(authHeader(token))
        .send({
          unitId: 'unit-nonexistent',
          propertyId: property.id,
          category: 'GENERAL',
          priority: 'LOW',
          title: 'Test',
          description: 'Test description',
        });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('should return 400 for missing required fields', async () => {
      const token = getAuthToken();

      const res = await agent
        .post(`${BASE_PATH}/work-orders`)
        .set(authHeader(token))
        .send({
          title: 'Incomplete',
          // missing unitId, propertyId, category, description
        });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /work-orders/:id/assign', () => {
    it('should assign work order to vendor', async () => {
      const token = getAuthToken();
      const workOrder = woSubmitted ?? DEMO_WORK_ORDERS[1];
      const vendor = vendorForElectrical ?? DEMO_VENDORS[1];

      const res = await agent
        .post(`${BASE_PATH}/work-orders/${workOrder.id}/assign`)
        .set(authHeader(token))
        .send({
          vendorId: vendor.id,
          scheduledAt: new Date(Date.now() + 86400000).toISOString(),
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.vendorId).toBe(vendor.id);
      expect(res.body.data.assignedTo).toBe(vendor.id);
      expect(res.body.data.status).toBe('ASSIGNED');
    });

    it('should return 404 for non-existent work order', async () => {
      const token = getAuthToken();
      const vendor = DEMO_VENDORS[0];

      const res = await agent
        .post(`${BASE_PATH}/work-orders/wo-nonexistent/assign`)
        .set(authHeader(token))
        .send({ vendorId: vendor.id });

      expect(res.status).toBe(404);
    });

    it('should return 404 for non-existent vendor', async () => {
      const token = getAuthToken();
      const workOrder = woSubmitted ?? DEMO_WORK_ORDERS[1];

      const res = await agent
        .post(`${BASE_PATH}/work-orders/${workOrder.id}/assign`)
        .set(authHeader(token))
        .send({ vendorId: 'vendor-nonexistent' });

      expect(res.status).toBe(404);
    });
  });

  describe('POST /work-orders/:id/complete', () => {
    it('should complete work order in IN_PROGRESS status', async () => {
      const token = getAuthToken();
      const workOrder = woInProgress ?? DEMO_WORK_ORDERS[0];

      const res = await agent
        .post(`${BASE_PATH}/work-orders/${workOrder.id}/complete`)
        .set(authHeader(token))
        .send({
          actualCost: 75000,
          notes: 'Integration test completion',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('COMPLETED');
      expect(res.body.data.completedAt).toBeDefined();
    });

    it('should return 409 when completing non-IN_PROGRESS work order', async () => {
      const token = getAuthToken();
      // wo-003 is always COMPLETED in demo data
      const completedWo = DEMO_WORK_ORDERS.find((w) => w.id === 'wo-003');

      const res = await agent
        .post(`${BASE_PATH}/work-orders/${completedWo!.id}/complete`)
        .set(authHeader(token))
        .send({ notes: 'Should fail' });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toContain('IN_PROGRESS');
    });

    it('should return 404 for non-existent work order', async () => {
      const token = getAuthToken();

      const res = await agent
        .post(`${BASE_PATH}/work-orders/wo-nonexistent/complete`)
        .set(authHeader(token))
        .send({ notes: 'Test' });

      expect(res.status).toBe(404);
    });
  });
});
