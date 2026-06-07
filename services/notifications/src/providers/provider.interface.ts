/**
 * Notification provider interface
 * Defines the contract for pluggable notification channels
 */

import type { TenantId } from '../types/index.js';
import type { NotificationChannel, SendResult } from '../types/index.js';

export interface SendParams {
  tenantId: TenantId;
  to: string;
  subject?: string;
  body: string;
  title?: string;
  data?: Record<string, string>;
  /**
   * Internal user id of the recipient. Required by the in-app provider
   * (which keys its inbox rows by user, not by an external address) and
   * carried through so the cross-channel fallback can reach the in-app
   * terminal even when `to` is an external address (phone/email/token).
   */
  userId?: string;
}

/**
 * Base interface for all notification providers
 */
export interface INotificationProvider {
  readonly channel: NotificationChannel;
  readonly name: string;

  /**
   * Send a notification
   * @param params - Send parameters
   * @returns Send result with external ID or error
   */
  send(params: SendParams): Promise<SendResult>;

  /**
   * Check if provider is configured for tenant
   */
  isConfigured(tenantId: TenantId): boolean;
}
