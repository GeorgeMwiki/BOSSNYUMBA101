/**
 * Push Device Registration Service
 *
 * Manages mobile/web push notification device tokens.
 * Endpoint contract: POST /notifications/devices, DELETE /notifications/devices/:token
 * Used by the mobile app (Flutter) and web clients via the api-client package.
 */

import { v4 as uuidv4 } from 'uuid';
import type { TenantId } from '../types/index.js';
import { createLogger } from '../logger.js';

const logger = createLogger('device-registration');

// ============================================================================
// Types
// ============================================================================

export type DevicePlatform = 'ios' | 'android' | 'web';

export interface DeviceRegistration {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly userId: string;
  readonly token: string;
  readonly platform: DevicePlatform;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface RegisterDeviceInput {
  tenantId: TenantId;
  userId: string;
  token: string;
  platform: DevicePlatform;
}

// ============================================================================
// In-Memory Storage (Replace with database in production)
// ============================================================================

const devices = new Map<string, DeviceRegistration>(); // id -> registration
const tokenIndex = new Map<string, string>(); // token -> id
const userDevices = new Map<string, Set<string>>(); // tenantId:userId -> Set<id>

// ============================================================================
// Service
// ============================================================================

export const deviceRegistrationService = {
  /**
   * Register a device for push notifications.
   * If the token already exists, updates the record.
   */
  register(input: RegisterDeviceInput): DeviceRegistration {
    const now = new Date().toISOString();

    // Check if token already registered
    const existingId = tokenIndex.get(input.token);
    if (existingId) {
      const existing = devices.get(existingId);
      if (existing) {
        const updated: DeviceRegistration = {
          ...existing,
          tenantId: input.tenantId,
          userId: input.userId,
          platform: input.platform,
          updatedAt: now,
        };
        devices.set(existingId, updated);
        logger.info('Device registration updated', { id: existingId, platform: input.platform });
        return updated;
      }
    }

    const id = uuidv4();
    const registration: DeviceRegistration = {
      id,
      tenantId: input.tenantId,
      userId: input.userId,
      token: input.token,
      platform: input.platform,
      createdAt: now,
      updatedAt: now,
    };

    devices.set(id, registration);
    tokenIndex.set(input.token, id);

    const userKey = `${input.tenantId}:${input.userId}`;
    if (!userDevices.has(userKey)) {
      userDevices.set(userKey, new Set());
    }
    userDevices.get(userKey)!.add(id);

    logger.info('Device registered', { id, platform: input.platform, userId: input.userId });
    return registration;
  },

  /**
   * Unregister a device by token
   */
  unregister(token: string): boolean {
    const id = tokenIndex.get(token);
    if (!id) return false;

    const registration = devices.get(id);
    if (registration) {
      const userKey = `${registration.tenantId}:${registration.userId}`;
      userDevices.get(userKey)?.delete(id);
    }

    devices.delete(id);
    tokenIndex.delete(token);

    logger.info('Device unregistered', { token: token.slice(0, 8) + '...' });
    return true;
  },

  /**
   * Get all device tokens for a user (used when sending push notifications)
   */
  getDevicesForUser(tenantId: TenantId, userId: string): DeviceRegistration[] {
    const userKey = `${tenantId}:${userId}`;
    const deviceIds = userDevices.get(userKey);
    if (!deviceIds) return [];

    return Array.from(deviceIds)
      .map((id) => devices.get(id))
      .filter((d): d is DeviceRegistration => d !== undefined);
  },

  /**
   * Get all push tokens for a user (convenience helper)
   */
  getTokensForUser(tenantId: TenantId, userId: string): string[] {
    return this.getDevicesForUser(tenantId, userId).map((d) => d.token);
  },

  /**
   * Check if a token is registered
   */
  isRegistered(token: string): boolean {
    return tokenIndex.has(token);
  },
};
