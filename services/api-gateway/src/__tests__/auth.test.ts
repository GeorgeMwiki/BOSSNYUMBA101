/**
 * Integration tests for Auth endpoints
 *
 * POST /auth/login - valid/invalid credentials
 * POST /auth/register - new user
 * POST /auth/logout - logout flow
 */

import { describe, it, expect } from 'vitest';
import {
  createTestAgent,
  BASE_PATH,
  DEMO_CREDENTIALS,
  registerPayload,
} from './setup';

const agent = createTestAgent();

describe('Auth API', () => {
  describe('POST /auth/login', () => {
    it('should return 200 and token for valid tenant user credentials', async () => {
      const res = await agent
        .post(`${BASE_PATH}/auth/login`)
        .send({
          email: DEMO_CREDENTIALS.tenantAdmin.email,
          password: DEMO_CREDENTIALS.tenantAdmin.password,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.token).toBeDefined();
      expect(typeof res.body.data.token).toBe('string');
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.email).toBe(DEMO_CREDENTIALS.tenantAdmin.email);
      expect(res.body.data.tenant).toBeDefined();
      expect(res.body.data.permissions).toBeDefined();
      expect(Array.isArray(res.body.data.permissions)).toBe(true);
    });

    it('should return 200 and token for valid platform admin credentials', async () => {
      const res = await agent
        .post(`${BASE_PATH}/auth/login`)
        .send({
          email: DEMO_CREDENTIALS.platformAdmin.email,
          password: DEMO_CREDENTIALS.platformAdmin.password,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.tenantId).toBe('platform');
    });

    it('should return 401 for invalid credentials', async () => {
      const res = await agent
        .post(`${BASE_PATH}/auth/login`)
        .send({
          email: DEMO_CREDENTIALS.invalid.email,
          password: DEMO_CREDENTIALS.invalid.password,
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should return 400 for invalid request body (missing email)', async () => {
      const res = await agent
        .post(`${BASE_PATH}/auth/login`)
        .send({ password: 'demo123' });

      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid email format', async () => {
      const res = await agent
        .post(`${BASE_PATH}/auth/login`)
        .send({ email: 'not-an-email', password: 'demo123' });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /auth/register', () => {
    it('should create new user and return 201 with token', async () => {
      const payload = registerPayload();

      const res = await agent
        .post(`${BASE_PATH}/auth/register`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.email).toBe(payload.email);
      expect(res.body.data.user.firstName).toBe(payload.firstName);
      expect(res.body.data.user.lastName).toBe(payload.lastName);
      expect(res.body.data.user.role).toBe('RESIDENT');
      expect(res.body.data.tenant).toBeDefined();
    });

    it('should return 409 when email already exists', async () => {
      const res = await agent
        .post(`${BASE_PATH}/auth/register`)
        .send({
          email: DEMO_CREDENTIALS.tenantAdmin.email,
          password: 'NewPassword123!',
          firstName: 'Duplicate',
          lastName: 'User',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('should return 400 for password too short', async () => {
      const res = await agent
        .post(`${BASE_PATH}/auth/register`)
        .send({
          email: 'short@example.com',
          password: 'short',
          firstName: 'Test',
          lastName: 'User',
        });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /auth/logout', () => {
    it('should return 200 with success message', async () => {
      const res = await agent.post(`${BASE_PATH}/auth/logout`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toContain('Logged out');
    });
  });
});
