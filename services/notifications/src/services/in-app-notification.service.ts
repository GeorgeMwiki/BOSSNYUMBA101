/**
 * In-App Notification Service
 * 
 * Handles in-app notifications for the BOSSNYUMBA platform.
 * Supports real-time delivery, notification management, and user preferences.
 */

import { v4 as uuidv4 } from 'uuid';
import type { TenantId, NotificationTemplateId, SupportedLocale } from '../types/index.js';
import { resolveTemplate } from '../templates/index.js';
import { createLogger } from '../logger.js';

const logger = createLogger('in-app-notification-service');

// ============================================================================
// Types
// ============================================================================

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';
export type NotificationCategory = 
  | 'payment' 
  | 'maintenance' 
  | 'lease' 
  | 'announcement' 
  | 'system' 
  | 'reminder'
  | 'alert'
  | 'communication';

export interface InAppNotification {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly userId: string;
  readonly title: string;
  readonly message: string;
  readonly category: NotificationCategory;
  readonly priority: NotificationPriority;
  readonly actionUrl?: string;
  readonly actionLabel?: string;
  readonly metadata?: Record<string, unknown>;
  readonly templateId?: NotificationTemplateId;
  readonly isRead: boolean;
  readonly readAt?: string;
  readonly isArchived: boolean;
  readonly archivedAt?: string;
  readonly expiresAt?: string;
  readonly createdAt: string;
}

export interface CreateInAppNotificationInput {
  tenantId: TenantId;
  userId: string;
  title: string;
  message: string;
  category: NotificationCategory;
  priority?: NotificationPriority;
  actionUrl?: string;
  actionLabel?: string;
  metadata?: Record<string, unknown>;
  templateId?: NotificationTemplateId;
  expiresAt?: Date;
}

export interface CreateFromTemplateInput {
  tenantId: TenantId;
  userId: string;
  templateId: NotificationTemplateId;
  data: Record<string, string>;
  category: NotificationCategory;
  priority?: NotificationPriority;
  actionUrl?: string;
  actionLabel?: string;
  metadata?: Record<string, unknown>;
  locale?: SupportedLocale;
  expiresAt?: Date;
}

export interface NotificationFilters {
  category?: NotificationCategory;
  priority?: NotificationPriority;
  isRead?: boolean;
  isArchived?: boolean;
  fromDate?: Date;
  toDate?: Date;
}

export interface NotificationStats {
  total: number;
  unread: number;
  byCategory: Record<NotificationCategory, number>;
  byPriority: Record<NotificationPriority, number>;
}

export interface WebSocketConnection {
  userId: string;
  tenantId: TenantId;
  connectionId: string;
  send: (data: unknown) => void;
  isAlive: boolean;
}

// ============================================================================
// In-Memory Storage (Replace with database in production)
// ============================================================================

const notifications = new Map<string, InAppNotification>();
const userNotifications = new Map<string, Set<string>>(); // userId -> Set<notificationId>
const tenantNotifications = new Map<string, Set<string>>(); // tenantId -> Set<notificationId>
const activeConnections = new Map<string, WebSocketConnection>(); // connectionId -> connection

// ============================================================================
// Service Implementation
// ============================================================================

export const inAppNotificationService = {
  /**
   * Create a new in-app notification
   */
  async create(input: CreateInAppNotificationInput): Promise<InAppNotification> {
    const id = uuidv4();
    const now = new Date().toISOString();

    const notification: InAppNotification = {
      id,
      tenantId: input.tenantId,
      userId: input.userId,
      title: input.title,
      message: input.message,
      category: input.category,
      priority: input.priority ?? 'normal',
      actionUrl: input.actionUrl,
      actionLabel: input.actionLabel,
      metadata: input.metadata,
      templateId: input.templateId,
      isRead: false,
      isArchived: false,
      expiresAt: input.expiresAt?.toISOString(),
      createdAt: now,
    };

    // Store notification
    notifications.set(id, notification);

    // Index by user
    const userKey = `${input.tenantId}:${input.userId}`;
    if (!userNotifications.has(userKey)) {
      userNotifications.set(userKey, new Set());
    }
    userNotifications.get(userKey)!.add(id);

    // Index by tenant
    const tenantKey = input.tenantId as string;
    if (!tenantNotifications.has(tenantKey)) {
      tenantNotifications.set(tenantKey, new Set());
    }
    tenantNotifications.get(tenantKey)!.add(id);

    // Push to active WebSocket connections
    this.pushToUser(input.tenantId, input.userId, notification);

    logger.info('In-app notification created', { id, userId: input.userId, category: input.category });

    return notification;
  },

  /**
   * Create notification from template
   */
  async createFromTemplate(input: CreateFromTemplateInput): Promise<InAppNotification> {
    const locale = input.locale ?? 'en';
    const { subject, body } = resolveTemplate(input.templateId, locale, input.data);

    return this.create({
      tenantId: input.tenantId,
      userId: input.userId,
      title: subject,
      message: body,
      category: input.category,
      priority: input.priority,
      actionUrl: input.actionUrl,
      actionLabel: input.actionLabel,
      metadata: input.metadata,
      templateId: input.templateId,
      expiresAt: input.expiresAt,
    });
  },

  /**
   * Send notification to multiple users
   */
  async broadcast(
    tenantId: TenantId,
    userIds: string[],
    input: Omit<CreateInAppNotificationInput, 'tenantId' | 'userId'>
  ): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;

    for (const userId of userIds) {
      try {
        await this.create({
          ...input,
          tenantId,
          userId,
        });
        sent++;
      } catch (error) {
        logger.error('Failed to send broadcast notification', { userId, error: String(error) });
        failed++;
      }
    }

    logger.info('Broadcast complete', { tenantId, sent, failed });
    return { sent, failed };
  },

  /**
   * Get notification by ID
   */
  async getById(
    id: string,
    tenantId: TenantId,
    userId: string
  ): Promise<InAppNotification | null> {
    const notification = notifications.get(id);
    if (!notification) return null;
    if (notification.tenantId !== tenantId || notification.userId !== userId) {
      return null;
    }
    return notification;
  },

  /**
   * List notifications for a user
   */
  async listForUser(
    tenantId: TenantId,
    userId: string,
    filters?: NotificationFilters,
    limit = 50,
    offset = 0
  ): Promise<{ notifications: InAppNotification[]; total: number }> {
    const userKey = `${tenantId}:${userId}`;
    const notificationIds = userNotifications.get(userKey) ?? new Set();

    let userNotifs = Array.from(notificationIds)
      .map((id) => notifications.get(id))
      .filter((n): n is InAppNotification => n !== undefined);

    // Apply filters
    if (filters) {
      if (filters.category) {
        userNotifs = userNotifs.filter((n) => n.category === filters.category);
      }
      if (filters.priority) {
        userNotifs = userNotifs.filter((n) => n.priority === filters.priority);
      }
      if (filters.isRead !== undefined) {
        userNotifs = userNotifs.filter((n) => n.isRead === filters.isRead);
      }
      if (filters.isArchived !== undefined) {
        userNotifs = userNotifs.filter((n) => n.isArchived === filters.isArchived);
      }
      if (filters.fromDate) {
        userNotifs = userNotifs.filter((n) => new Date(n.createdAt) >= filters.fromDate!);
      }
      if (filters.toDate) {
        userNotifs = userNotifs.filter((n) => new Date(n.createdAt) <= filters.toDate!);
      }
    }

    // Filter out expired notifications
    const now = new Date();
    userNotifs = userNotifs.filter((n) => !n.expiresAt || new Date(n.expiresAt) > now);

    // Sort by creation date (newest first), then by priority
    const priorityOrder: Record<NotificationPriority, number> = {
      urgent: 0,
      high: 1,
      normal: 2,
      low: 3,
    };
    userNotifs.sort((a, b) => {
      // Unread first
      if (a.isRead !== b.isRead) return a.isRead ? 1 : -1;
      // Then by priority
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      // Then by date
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    const total = userNotifs.length;
    const paged = userNotifs.slice(offset, offset + limit);

    return { notifications: paged, total };
  },

  /**
   * Get notification statistics for a user
   */
  async getStats(tenantId: TenantId, userId: string): Promise<NotificationStats> {
    const { notifications: userNotifs } = await this.listForUser(tenantId, userId, { isArchived: false }, 1000, 0);

    const stats: NotificationStats = {
      total: userNotifs.length,
      unread: userNotifs.filter((n) => !n.isRead).length,
      byCategory: {
        payment: 0,
        maintenance: 0,
        lease: 0,
        announcement: 0,
        system: 0,
        reminder: 0,
        alert: 0,
        communication: 0,
      },
      byPriority: {
        low: 0,
        normal: 0,
        high: 0,
        urgent: 0,
      },
    };

    for (const notif of userNotifs) {
      stats.byCategory[notif.category]++;
      stats.byPriority[notif.priority]++;
    }

    return stats;
  },

  /**
   * Mark notification as read
   */
  async markAsRead(
    id: string,
    tenantId: TenantId,
    userId: string
  ): Promise<InAppNotification | null> {
    const notification = await this.getById(id, tenantId, userId);
    if (!notification) return null;

    const updated: InAppNotification = {
      ...notification,
      isRead: true,
      readAt: new Date().toISOString(),
    };
    notifications.set(id, updated);

    logger.debug('Notification marked as read', { id });
    return updated;
  },

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(tenantId: TenantId, userId: string): Promise<number> {
    const { notifications: userNotifs } = await this.listForUser(tenantId, userId, { isRead: false }, 1000, 0);
    let count = 0;

    for (const notif of userNotifs) {
      const updated: InAppNotification = {
        ...notif,
        isRead: true,
        readAt: new Date().toISOString(),
      };
      notifications.set(notif.id, updated);
      count++;
    }

    logger.info('All notifications marked as read', { userId, count });
    return count;
  },

  /**
   * Archive notification
   */
  async archive(
    id: string,
    tenantId: TenantId,
    userId: string
  ): Promise<InAppNotification | null> {
    const notification = await this.getById(id, tenantId, userId);
    if (!notification) return null;

    const updated: InAppNotification = {
      ...notification,
      isArchived: true,
      archivedAt: new Date().toISOString(),
    };
    notifications.set(id, updated);

    logger.debug('Notification archived', { id });
    return updated;
  },

  /**
   * Delete notification
   */
  async delete(
    id: string,
    tenantId: TenantId,
    userId: string
  ): Promise<boolean> {
    const notification = await this.getById(id, tenantId, userId);
    if (!notification) return false;

    notifications.delete(id);

    // Remove from indices
    const userKey = `${tenantId}:${userId}`;
    userNotifications.get(userKey)?.delete(id);
    tenantNotifications.get(tenantId as string)?.delete(id);

    logger.debug('Notification deleted', { id });
    return true;
  },

  /**
   * Clean up expired notifications
   */
  async cleanupExpired(): Promise<number> {
    const now = new Date();
    let cleaned = 0;

    for (const [id, notification] of notifications) {
      if (notification.expiresAt && new Date(notification.expiresAt) <= now) {
        notifications.delete(id);
        const userKey = `${notification.tenantId}:${notification.userId}`;
        userNotifications.get(userKey)?.delete(id);
        tenantNotifications.get(notification.tenantId as string)?.delete(id);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info('Cleaned up expired notifications', { count: cleaned });
    }
    return cleaned;
  },

  // ============================================================================
  // WebSocket / Real-time Support
  // ============================================================================

  /**
   * Register a WebSocket connection for real-time updates
   */
  registerConnection(connection: WebSocketConnection): void {
    activeConnections.set(connection.connectionId, connection);
    logger.debug('WebSocket connection registered', {
      connectionId: connection.connectionId,
      userId: connection.userId,
    });
  },

  /**
   * Unregister a WebSocket connection
   */
  unregisterConnection(connectionId: string): void {
    activeConnections.delete(connectionId);
    logger.debug('WebSocket connection unregistered', { connectionId });
  },

  /**
   * Push notification to user's active connections
   */
  pushToUser(tenantId: TenantId, userId: string, notification: InAppNotification): void {
    for (const connection of activeConnections.values()) {
      if (connection.tenantId === tenantId && connection.userId === userId && connection.isAlive) {
        try {
          connection.send({
            type: 'notification',
            data: notification,
          });
          logger.debug('Pushed notification to WebSocket', {
            connectionId: connection.connectionId,
            notificationId: notification.id,
          });
        } catch (error) {
          logger.warn('Failed to push notification to WebSocket', {
            connectionId: connection.connectionId,
            error: String(error),
          });
        }
      }
    }
  },

  /**
   * Get unread count (for badge display)
   */
  async getUnreadCount(tenantId: TenantId, userId: string): Promise<number> {
    const stats = await this.getStats(tenantId, userId);
    return stats.unread;
  },

  /**
   * Create system announcement (sent to all users in tenant)
   */
  async createAnnouncement(
    tenantId: TenantId,
    title: string,
    message: string,
    options: {
      priority?: NotificationPriority;
      actionUrl?: string;
      actionLabel?: string;
      expiresAt?: Date;
    } = {}
  ): Promise<{ id: string }> {
    // In production, this would fetch all user IDs from the tenant
    // For now, we create a single announcement notification
    const id = uuidv4();
    const now = new Date().toISOString();

    const announcement: InAppNotification = {
      id,
      tenantId,
      userId: '*', // Special marker for tenant-wide announcement
      title,
      message,
      category: 'announcement',
      priority: options.priority ?? 'normal',
      actionUrl: options.actionUrl,
      actionLabel: options.actionLabel,
      isRead: false,
      isArchived: false,
      expiresAt: options.expiresAt?.toISOString(),
      createdAt: now,
    };

    notifications.set(id, announcement);

    // Index by tenant
    const tenantKey = tenantId as string;
    if (!tenantNotifications.has(tenantKey)) {
      tenantNotifications.set(tenantKey, new Set());
    }
    tenantNotifications.get(tenantKey)!.add(id);

    logger.info('Announcement created', { id, tenantId, title });

    return { id };
  },
};

// ============================================================================
// Cleanup Job (run periodically)
// ============================================================================

// Run cleanup every hour
setInterval(() => {
  void inAppNotificationService.cleanupExpired();
}, 60 * 60 * 1000);
