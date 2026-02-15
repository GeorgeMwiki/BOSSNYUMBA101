/**
 * Integration tests for Property endpoints
 *
 * GET /properties - list with pagination
 * POST /properties - create property
 * GET /properties/:id - get detail
 * PUT /properties/:id - update
 * DELETE /properties/:id - soft delete
 */

import { describe, it, expect } from 'vitest';
import {
  createTestAgent,
  BASE_PATH,
  getAuthToken,
  authHeader,
} from './setup';
import { DEMO_PROPERTIES } from '../data/mock-data';

const agent = createTestAgent();
const existingProperty = DEMO_PROPERTIES[0];

describe('Properties API', () => {
  describe('GET /properties', () => {
    it('should return paginated list of properties', async () => {
      const token = getAuthToken();

      const res = await agent
        .get(`${BASE_PATH}/properties`)
        .set(authHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.page).toBeDefined();
      expect(res.body.pagination.pageSize).toBeDefined();
      expect(res.body.pagination.total).toBeDefined();
    });

    it('should respect pagination params', async () => {
      const token = getAuthToken();

      const res = await agent
        .get(`${BASE_PATH}/properties`)
        .query({ page: 2, pageSize: 1 })
        .set(authHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.pagination.page).toBe(2);
      expect(res.body.pagination.pageSize).toBe(1);
      expect(res.body.data.length).toBeLessThanOrEqual(1);
    });

    it('should filter by status', async () => {
      const token = getAuthToken();

      const res = await agent
        .get(`${BASE_PATH}/properties`)
        .query({ status: 'ACTIVE' })
        .set(authHeader(token));

      expect(res.status).toBe(200);
      res.body.data.forEach((p: { status: string }) => {
        expect(p.status).toBe('ACTIVE');
      });
    });

    it('should return 401 without token', async () => {
      const res = await agent.get(`${BASE_PATH}/properties`);

      expect(res.status).toBe(401);
    });
  });

  describe('POST /properties', () => {
    it('should create property and return 201', async () => {
      const token = getAuthToken();

      const res = await agent
        .post(`${BASE_PATH}/properties`)
        .set(authHeader(token))
        .send({
          name: `Test Property ${Date.now()}`,
          type: 'RESIDENTIAL',
          status: 'ACTIVE',
          address: {
            line1: '100 Test Street',
            city: 'Dar es Salaam',
            region: 'Kinondoni',
            country: 'Tanzania',
          },
          description: 'Integration test property',
          amenities: [],
          images: [],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.name).toContain('Test Property');
      expect(res.body.data.type).toBe('RESIDENTIAL');
      expect(res.body.data.id).toBeDefined();
    });

    it('should return 400 for invalid body (missing required fields)', async () => {
      const token = getAuthToken();

      const res = await agent
        .post(`${BASE_PATH}/properties`)
        .set(authHeader(token))
        .send({
          name: 'Incomplete',
          // missing type, address, etc.
        });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /properties/:id', () => {
    it('should return property detail with stats', async () => {
      const token = getAuthToken();

      const res = await agent
        .get(`${BASE_PATH}/properties/${existingProperty.id}`)
        .set(authHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(existingProperty.id);
      expect(res.body.data.name).toBe(existingProperty.name);
      expect(res.body.data.stats).toBeDefined();
      expect(res.body.data.stats.totalUnits).toBeDefined();
      expect(res.body.data.stats.occupiedUnits).toBeDefined();
    });

    it('should return 404 for non-existent property', async () => {
      const token = getAuthToken();

      const res = await agent
        .get(`${BASE_PATH}/properties/property-nonexistent`)
        .set(authHeader(token));

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('PUT /properties/:id', () => {
    it('should update property', async () => {
      const token = getAuthToken();
      const newName = `Updated ${existingProperty.name} ${Date.now()}`;

      const res = await agent
        .put(`${BASE_PATH}/properties/${existingProperty.id}`)
        .set(authHeader(token))
        .send({
          name: newName,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe(newName);

      // Restore original name
      await agent
        .put(`${BASE_PATH}/properties/${existingProperty.id}`)
        .set(authHeader(token))
        .send({ name: existingProperty.name });
    });

    it('should return 404 for non-existent property', async () => {
      const token = getAuthToken();

      const res = await agent
        .put(`${BASE_PATH}/properties/property-nonexistent`)
        .set(authHeader(token))
        .send({ name: 'New Name' });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /properties/:id', () => {
    it('should soft delete property', async () => {
      const token = getAuthToken();

      // Create a property to delete
      const createRes = await agent
        .post(`${BASE_PATH}/properties`)
        .set(authHeader(token))
        .send({
          name: `To Delete ${Date.now()}`,
          type: 'RESIDENTIAL',
          address: {
            line1: '200 Delete St',
            city: 'Dar es Salaam',
            country: 'Tanzania',
          },
        });

      expect(createRes.status).toBe(201);
      const id = createRes.body.data.id;

      const res = await agent
        .delete(`${BASE_PATH}/properties/${id}`)
        .set(authHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toContain('soft deleted');

      // Soft-deleted property should not appear in list
      const listRes = await agent
        .get(`${BASE_PATH}/properties`)
        .set(authHeader(token));

      const found = listRes.body.data.find((p: { id: string }) => p.id === id);
      expect(found).toBeUndefined();
    });

    it('should return 404 for non-existent property', async () => {
      const token = getAuthToken();

      const res = await agent
        .delete(`${BASE_PATH}/properties/property-nonexistent`)
        .set(authHeader(token));

      expect(res.status).toBe(404);
    });
  });
});
