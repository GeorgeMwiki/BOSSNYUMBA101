/**
 * Integration tests for Tenant endpoints
 *
 * GET /tenants/:id
 * PUT /tenants/:id (API uses PATCH)
 * GET /tenants/:id/settings (API uses GET /tenants/current/settings)
 */

import { describe, it, expect } from 'vitest';
import {
  createTestAgent,
  BASE_PATH,
  getAuthToken,
  getSuperAdminToken,
  authHeader,
} from './setup';
import { DEMO_TENANT } from '../data/mock-data';

const agent = createTestAgent();

describe('Tenants API', () => {
  describe('GET /tenants/:id', () => {
    it('should return tenant when user has access (own tenant)', async () => {
      const token = getAuthToken('user-001', 'tenant-001');

      const res = await agent
        .get(`${BASE_PATH}/tenants/${DEMO_TENANT.id}`)
        .set(authHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.id).toBe(DEMO_TENANT.id);
      expect(res.body.data.name).toBe(DEMO_TENANT.name);
      expect(res.body.data.slug).toBe(DEMO_TENANT.slug);
    });

    it('should return tenant when SUPER_ADMIN accesses any tenant', async () => {
      const token = getSuperAdminToken();

      const res = await agent
        .get(`${BASE_PATH}/tenants/${DEMO_TENANT.id}`)
        .set(authHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(DEMO_TENANT.id);
    });

    it('should return 403 when user tries to access another tenant', async () => {
      const token = getAuthToken('user-001', 'tenant-001');

      const res = await agent
        .get(`${BASE_PATH}/tenants/tenant-other`)
        .set(authHeader(token));

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should return 404 for non-existent tenant', async () => {
      const token = getSuperAdminToken();

      const res = await agent
        .get(`${BASE_PATH}/tenants/tenant-nonexistent`)
        .set(authHeader(token));

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('should return 401 without token', async () => {
      const res = await agent.get(`${BASE_PATH}/tenants/${DEMO_TENANT.id}`);

      expect(res.status).toBe(401);
    });
  });

  describe('PATCH /tenants/:id', () => {
    it('should update tenant when SUPER_ADMIN', async () => {
      const token = getSuperAdminToken();
      const newName = `Mwanga Properties Updated ${Date.now()}`;

      const res = await agent
        .patch(`${BASE_PATH}/tenants/${DEMO_TENANT.id}`)
        .set(authHeader(token))
        .send({ name: newName });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe(newName);

      // Restore original name for other tests
      await agent
        .patch(`${BASE_PATH}/tenants/${DEMO_TENANT.id}`)
        .set(authHeader(token))
        .send({ name: DEMO_TENANT.name });
    });

    it('should return 403 when non-admin tries to update', async () => {
      const token = getAuthToken('user-002', 'tenant-001'); // PROPERTY_MANAGER

      const res = await agent
        .patch(`${BASE_PATH}/tenants/${DEMO_TENANT.id}`)
        .set(authHeader(token))
        .send({ name: 'New Name' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('GET /tenants/current/settings', () => {
    it('should return tenant settings for authenticated user', async () => {
      const token = getAuthToken('user-001', 'tenant-001');

      const res = await agent
        .get(`${BASE_PATH}/tenants/current/settings`)
        .set(authHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.timezone).toBeDefined();
      expect(res.body.data.currency).toBeDefined();
      expect(res.body.data.locale).toBeDefined();
    });

    it('should return 404 for platform admin (no tenant context)', async () => {
      const token = getSuperAdminToken();

      const res = await agent
        .get(`${BASE_PATH}/tenants/current/settings`)
        .set(authHeader(token));

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
      expect(res.body.error.message).toContain('No tenant context');
    });

    it('should return 401 without token', async () => {
      const res = await agent.get(`${BASE_PATH}/tenants/current/settings`);

      expect(res.status).toBe(401);
    });
  });
});
