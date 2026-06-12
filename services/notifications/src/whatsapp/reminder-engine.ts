/**
 * Reminder Engine for BOSSNYUMBA
 * Handles Module D - Communication Automation workflows via WhatsApp
 * Rent reminders (T-5, T-1, T+3, T+7), maintenance appointments, document expiry, lease renewal
 */

import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../logger.js';
import { MetaWhatsAppClient } from './meta-client.js';
import {
  REMINDER_TEMPLATES,
  renderTemplate,
  getTemplate,
} from './templates.js';
import type {
  ReminderSchedule,
  ReminderType,
  ReminderData,
  SupportedLanguage,
} from './types.js';

const logger = createLogger('ReminderEngine');

// ============================================================================
// Reminder Queue Interface
// ============================================================================

export interface ReminderQueue {
  schedule(reminder: ReminderSchedule): Promise<void>;
  cancel(reminderId: string): Promise<void>;
  getScheduled(tenantId: string): Promise<ReminderSchedule[]>;
  getPending(): Promise<ReminderSchedule[]>;
  markSent(reminderId: string): Promise<void>;
}

// ============================================================================
// Failure sinks (Round-3 audit #medium reminder-engine.ts:466)
// ============================================================================
//
// A failed WhatsApp reminder was previously dropped log-only: no DLQ/retry,
// no staff visibility. These optional sinks let the composition wire a
// dead-letter/retry marker AND a staff in-app alert. Both default to no-ops
// (see DEFAULT_*) so the existing public constructor signature keeps working
// for callers that haven't wired them yet.

/**
 * Dead-letter / retry marker for a reminder whose send failed. The
 * composition wires this to the shared notifications DLQ so the reminder
 * is re-attempted rather than silently lost.
 */
export interface ReminderDeadLetterSink {
  markFailed(args: {
    readonly reminderId: string;
    readonly tenantId: string;
    readonly type: ReminderType;
    readonly error: string;
  }): Promise<void>;
}

/**
 * Staff in-app alert sink. Carries COUNTS + IDS only — never recipient PII
 * (phone numbers, names) — so the alert is safe to render in an operator
 * inbox without leaking customer identifiers.
 */
export interface ReminderStaffAlertSink {
  raise(args: {
    readonly tenantId: string;
    readonly failedCount: number;
    readonly reminderIds: readonly string[];
  }): Promise<void>;
}

const NOOP_DEAD_LETTER_SINK: ReminderDeadLetterSink = {
  async markFailed() {
    /* no-op until a DLQ is wired */
  },
};

const NOOP_STAFF_ALERT_SINK: ReminderStaffAlertSink = {
  async raise() {
    /* no-op until a staff-alert sink is wired */
  },
};

// ============================================================================
// In-Memory Reminder Queue (for development)
// ============================================================================

export class InMemoryReminderQueue implements ReminderQueue {
  private reminders = new Map<string, ReminderSchedule>();

  async schedule(reminder: ReminderSchedule): Promise<void> {
    this.reminders.set(reminder.id, reminder);
  }

  async cancel(reminderId: string): Promise<void> {
    const reminder = this.reminders.get(reminderId);
    if (reminder) {
      reminder.status = 'cancelled';
    }
  }

  async getScheduled(tenantId: string): Promise<ReminderSchedule[]> {
    return Array.from(this.reminders.values())
      .filter(r => r.tenantId === tenantId && r.status === 'pending');
  }

  async getPending(): Promise<ReminderSchedule[]> {
    const now = new Date();
    return Array.from(this.reminders.values())
      .filter(r => r.status === 'pending' && r.scheduledFor <= now);
  }

  async markSent(reminderId: string): Promise<void> {
    const reminder = this.reminders.get(reminderId);
    if (reminder) {
      reminder.status = 'sent';
      reminder.sentAt = new Date();
    }
  }
}

// ============================================================================
// Tenant Data Provider Interface
// ============================================================================

export interface TenantDataProvider {
  getRentInfo(tenantId: string): Promise<{
    tenantName: string;
    phoneNumber: string;
    language: SupportedLanguage;
    amount: number;
    currency: string;
    dueDate: Date;
    propertyName: string;
    unitNumber: string;
  } | null>;

  getDocumentExpirations(tenantId: string): Promise<Array<{
    documentType: string;
    expiryDate: Date;
  }>>;

  getLeaseInfo(tenantId: string): Promise<{
    leaseEndDate: Date;
    propertyName: string;
  } | null>;
}

// ============================================================================
// Reminder Engine
// ============================================================================

export class ReminderEngine {
  private whatsappClient: MetaWhatsAppClient;
  private reminderQueue: ReminderQueue;
  private tenantDataProvider: TenantDataProvider;
  private defaultCurrency: string;
  private deadLetterSink: ReminderDeadLetterSink;
  private staffAlertSink: ReminderStaffAlertSink;

  constructor(options: {
    whatsappClient: MetaWhatsAppClient;
    reminderQueue?: ReminderQueue;
    tenantDataProvider: TenantDataProvider;
    /**
     * Tenant's currency (resolved from region-config at call site).
     * REQUIRED — no hardcoded default so the reminder never ships the
     * wrong currency when the tenant country was misconfigured.
     */
    defaultCurrency: string;
    /** #medium — DLQ/retry marker for failed reminders (default: no-op). */
    deadLetterSink?: ReminderDeadLetterSink;
    /** #medium — staff in-app alert sink, counts/ids only (default: no-op). */
    staffAlertSink?: ReminderStaffAlertSink;
  }) {
    this.whatsappClient = options.whatsappClient;
    this.reminderQueue = options.reminderQueue || new InMemoryReminderQueue();
    this.tenantDataProvider = options.tenantDataProvider;
    if (!options.defaultCurrency) {
      throw new Error(
        'ReminderEngine: defaultCurrency is required — pass the tenant currency from region-config.'
      );
    }
    this.defaultCurrency = options.defaultCurrency;
    this.deadLetterSink = options.deadLetterSink ?? NOOP_DEAD_LETTER_SINK;
    this.staffAlertSink = options.staffAlertSink ?? NOOP_STAFF_ALERT_SINK;
  }

  // ============================================================================
  // Rent Reminder Ladder
  // ============================================================================

  /**
   * Schedule the complete rent reminder ladder for a tenant
   * T-5, T-1, Due Day, T+3 (overdue), T+7 (final)
   */
  async scheduleRentReminderLadder(
    tenantId: string,
    dueDate: Date
  ): Promise<ReminderSchedule[]> {
    const rentInfo = await this.tenantDataProvider.getRentInfo(tenantId);
    if (!rentInfo) {
      logger.warn('Could not get rent info for tenant', { tenantId });
      return [];
    }

    const schedules: ReminderSchedule[] = [];
    const baseData: ReminderData = {
      tenantName: rentInfo.tenantName,
      amount: rentInfo.amount,
      dueDate: this.formatDate(dueDate, rentInfo.language),
      propertyName: rentInfo.propertyName,
      unitNumber: rentInfo.unitNumber,
    };

    // T-5: Friendly reminder
    const t5 = new Date(dueDate);
    t5.setDate(t5.getDate() - 5);
    t5.setHours(9, 0, 0, 0);
    schedules.push(await this.createReminder(
      tenantId,
      rentInfo.phoneNumber,
      'rent_due_t_minus_5',
      t5,
      baseData
    ));

    // T-1: Urgent reminder
    const t1 = new Date(dueDate);
    t1.setDate(t1.getDate() - 1);
    t1.setHours(9, 0, 0, 0);
    schedules.push(await this.createReminder(
      tenantId,
      rentInfo.phoneNumber,
      'rent_due_t_minus_1',
      t1,
      baseData
    ));

    // Due day
    const tDue = new Date(dueDate);
    tDue.setHours(10, 0, 0, 0);
    schedules.push(await this.createReminder(
      tenantId,
      rentInfo.phoneNumber,
      'rent_due_today',
      tDue,
      baseData
    ));

    // T+3: Overdue
    const t3 = new Date(dueDate);
    t3.setDate(t3.getDate() + 3);
    t3.setHours(9, 0, 0, 0);
    schedules.push(await this.createReminder(
      tenantId,
      rentInfo.phoneNumber,
      'rent_overdue_t_plus_3',
      t3,
      baseData
    ));

    // T+7: Final warning
    const t7 = new Date(dueDate);
    t7.setDate(t7.getDate() + 7);
    t7.setHours(9, 0, 0, 0);
    schedules.push(await this.createReminder(
      tenantId,
      rentInfo.phoneNumber,
      'rent_overdue_t_plus_7',
      t7,
      baseData
    ));

    logger.info('Scheduled rent reminder ladder', {
      tenantId,
      dueDate: dueDate.toISOString(),
      reminders: schedules.length,
    });

    return schedules;
  }

  /**
   * Cancel remaining rent reminders (e.g., after payment)
   */
  async cancelRentReminders(tenantId: string): Promise<void> {
    const scheduled = await this.reminderQueue.getScheduled(tenantId);
    const rentReminders = scheduled.filter(r => 
      r.type.startsWith('rent_due') || r.type.startsWith('rent_overdue')
    );

    for (const reminder of rentReminders) {
      await this.reminderQueue.cancel(reminder.id);
    }

    logger.info('Cancelled rent reminders', {
      tenantId,
      cancelled: rentReminders.length,
    });
  }

  // ============================================================================
  // Payment Confirmation
  // ============================================================================

  /**
   * Send payment received confirmation
   */
  async sendPaymentConfirmation(
    phoneNumber: string,
    language: SupportedLanguage,
    data: {
      tenantName: string;
      amount: number;
      currency?: string;
      receiptNumber: string;
      balance: number;
    }
  ): Promise<void> {
    const message = renderTemplate(
      getTemplate(REMINDER_TEMPLATES.paymentReceived, language) as string,
      {
        tenantName: data.tenantName,
        amount: data.amount.toLocaleString(),
        currency: data.currency || this.defaultCurrency,
        receiptNumber: data.receiptNumber,
        balance: data.balance.toLocaleString(),
      }
    );

    await this.whatsappClient.sendText({ to: phoneNumber, text: message });
    logger.info('Sent payment confirmation', { phoneNumber, receiptNumber: data.receiptNumber });
  }

  // ============================================================================
  // Maintenance Reminders
  // ============================================================================

  /**
   * Schedule maintenance appointment reminder (1 day before)
   */
  async scheduleMaintenanceReminder(
    tenantId: string,
    phoneNumber: string,
    appointmentDate: Date,
    data: {
      tenantName: string;
      appointmentTime: string;
      technicianName: string;
      issueType: string;
    }
  ): Promise<ReminderSchedule> {
    // Reminder 1 day before at 6 PM
    const reminderDate = new Date(appointmentDate);
    reminderDate.setDate(reminderDate.getDate() - 1);
    reminderDate.setHours(18, 0, 0, 0);

    const schedule = await this.createReminder(
      tenantId,
      phoneNumber,
      'maintenance_appointment',
      reminderDate,
      {
        tenantName: data.tenantName,
        appointmentDate: this.formatDate(appointmentDate, 'en'),
        appointmentTime: data.appointmentTime,
        technicianName: data.technicianName,
        issueType: data.issueType,
      }
    );

    logger.info('Scheduled maintenance reminder', {
      tenantId,
      appointmentDate: appointmentDate.toISOString(),
    });

    return schedule;
  }

  // ============================================================================
  // Document Expiry Reminders
  // ============================================================================

  /**
   * Schedule document expiry reminder (45 days before)
   */
  async scheduleDocumentExpiryReminder(
    tenantId: string,
    phoneNumber: string,
    documentType: string,
    expiryDate: Date,
    tenantName: string
  ): Promise<ReminderSchedule> {
    // Reminder 45 days before at 10 AM
    const reminderDate = new Date(expiryDate);
    reminderDate.setDate(reminderDate.getDate() - 45);
    reminderDate.setHours(10, 0, 0, 0);

    const schedule = await this.createReminder(
      tenantId,
      phoneNumber,
      'document_expiry',
      reminderDate,
      {
        tenantName,
        documentType,
        expiryDate: this.formatDate(expiryDate, 'en'),
      }
    );

    logger.info('Scheduled document expiry reminder', {
      tenantId,
      documentType,
      expiryDate: expiryDate.toISOString(),
    });

    return schedule;
  }

  /**
   * Check and schedule all document expiry reminders for a tenant
   */
  async scheduleAllDocumentReminders(
    tenantId: string,
    phoneNumber: string,
    tenantName: string
  ): Promise<ReminderSchedule[]> {
    const expirations = await this.tenantDataProvider.getDocumentExpirations(tenantId);
    const schedules: ReminderSchedule[] = [];

    for (const doc of expirations) {
      const schedule = await this.scheduleDocumentExpiryReminder(
        tenantId,
        phoneNumber,
        doc.documentType,
        doc.expiryDate,
        tenantName
      );
      schedules.push(schedule);
    }

    return schedules;
  }

  // ============================================================================
  // Lease Renewal Reminders
  // ============================================================================

  /**
   * Schedule lease renewal reminder ladder (90, 60, 30 days before)
   */
  async scheduleLeaseRenewalReminders(
    tenantId: string,
    phoneNumber: string,
    leaseEndDate: Date,
    data: {
      tenantName: string;
      propertyName: string;
    }
  ): Promise<ReminderSchedule[]> {
    const schedules: ReminderSchedule[] = [];
    const baseData: ReminderData = {
      tenantName: data.tenantName,
      propertyName: data.propertyName,
      leaseEndDate: this.formatDate(leaseEndDate, 'en'),
    };

    // 90 days before (optional, for enterprise)
    // const t90 = new Date(leaseEndDate);
    // t90.setDate(t90.getDate() - 90);

    // 60 days before
    const t60 = new Date(leaseEndDate);
    t60.setDate(t60.getDate() - 60);
    t60.setHours(10, 0, 0, 0);
    schedules.push(await this.createReminder(
      tenantId,
      phoneNumber,
      'lease_renewal',
      t60,
      baseData
    ));

    // 30 days before
    const t30 = new Date(leaseEndDate);
    t30.setDate(t30.getDate() - 30);
    t30.setHours(10, 0, 0, 0);
    schedules.push(await this.createReminder(
      tenantId,
      phoneNumber,
      'lease_renewal',
      t30,
      baseData
    ));

    logger.info('Scheduled lease renewal reminders', {
      tenantId,
      leaseEndDate: leaseEndDate.toISOString(),
      reminders: schedules.length,
    });

    return schedules;
  }

  // ============================================================================
  // Reminder Execution
  // ============================================================================

  /**
   * Process pending reminders (called by scheduler/cron)
   */
  async processPendingReminders(): Promise<number> {
    const pending = await this.reminderQueue.getPending();
    let processed = 0;
    // #medium — collect failed reminder ids per tenant so a single staff
    // alert (counts/ids only) surfaces them, instead of each failure being
    // dropped log-only.
    const failedIdsByTenant = new Map<string, string[]>();

    for (const reminder of pending) {
      try {
        await this.sendReminder(reminder);
        await this.reminderQueue.markSent(reminder.id);
        processed++;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error('Failed to send reminder', {
          reminderId: reminder.id,
          error: message,
        });
        const ids = failedIdsByTenant.get(reminder.tenantId) ?? [];
        failedIdsByTenant.set(reminder.tenantId, [...ids, reminder.id]);
        // #medium — DLQ/retry marker so the reminder is re-attempted
        // rather than silently lost. The sink owns retry policy.
        await this.markReminderDeadLettered(reminder, message);
      }
    }

    if (failedIdsByTenant.size > 0) {
      // #medium — staff in-app alert per tenant: counts + ids only, never
      // recipient PII.
      await this.raiseStaffAlerts(failedIdsByTenant);
    }

    if (processed > 0) {
      logger.info('Processed pending reminders', { processed, total: pending.length });
    }

    return processed;
  }

  /**
   * #medium — push a failed reminder to the DLQ/retry sink. Best-effort:
   * a sink error must not abort the remaining reminder batch, so it is
   * caught + logged rather than rethrown.
   */
  private async markReminderDeadLettered(
    reminder: ReminderSchedule,
    error: string
  ): Promise<void> {
    try {
      await this.deadLetterSink.markFailed({
        reminderId: reminder.id,
        tenantId: reminder.tenantId,
        type: reminder.type,
        error,
      });
    } catch (sinkError) {
      logger.error('Failed to dead-letter reminder', {
        reminderId: reminder.id,
        error: sinkError instanceof Error ? sinkError.message : String(sinkError),
      });
    }
  }

  /**
   * #medium — raise ONE staff in-app alert per tenant summarising that
   * tenant's failed reminders. Carries counts + reminder ids only (no phone
   * numbers / names), so the operator inbox never leaks recipient PII.
   * Best-effort: a sink error for one tenant must not block the others.
   */
  private async raiseStaffAlerts(
    failedIdsByTenant: ReadonlyMap<string, readonly string[]>
  ): Promise<void> {
    for (const [tenantId, reminderIds] of failedIdsByTenant) {
      try {
        await this.staffAlertSink.raise({
          tenantId,
          failedCount: reminderIds.length,
          reminderIds,
        });
      } catch (sinkError) {
        logger.error('Failed to raise staff reminder-failure alert', {
          failedCount: reminderIds.length,
          error: sinkError instanceof Error ? sinkError.message : String(sinkError),
        });
      }
    }
  }

  /**
   * Send a specific reminder
   */
  async sendReminder(reminder: ReminderSchedule): Promise<void> {
    // Determine language from tenant data
    const rentInfo = await this.tenantDataProvider.getRentInfo(reminder.tenantId);
    const language = rentInfo?.language || 'en';

    const templateMap: Record<ReminderType, keyof typeof REMINDER_TEMPLATES> = {
      'rent_due_t_minus_5': 'rentDueT5',
      'rent_due_t_minus_1': 'rentDueT1',
      'rent_due_today': 'rentDueToday',
      'rent_overdue_t_plus_3': 'rentOverdueT3',
      'rent_overdue_t_plus_7': 'rentOverdueT7',
      'maintenance_appointment': 'maintenanceAppointment',
      'document_expiry': 'documentExpiry',
      'lease_renewal': 'leaseRenewal',
    };

    const templateKey = templateMap[reminder.type];
    if (!templateKey) {
      logger.error('Unknown reminder type', { type: reminder.type });
      return;
    }

    const template = REMINDER_TEMPLATES[templateKey];
    const templateContent = getTemplate(template, language) as string;

    const message = renderTemplate(templateContent, {
      tenantName: reminder.data.tenantName || '',
      amount: reminder.data.amount?.toLocaleString() || '',
      currency: this.defaultCurrency,
      dueDate: reminder.data.dueDate || '',
      propertyName: reminder.data.propertyName || '',
      unitNumber: reminder.data.unitNumber || '',
      appointmentDate: reminder.data.maintenanceDate || reminder.data.appointmentDate || '',
      appointmentTime: reminder.data.appointmentTime || '',
      technicianName: reminder.data.technicianName || '',
      issueType: reminder.data.issueType || '',
      documentType: reminder.data.documentType || '',
      expiryDate: reminder.data.expiryDate || '',
      leaseEndDate: reminder.data.leaseEndDate || '',
    });

    await this.whatsappClient.sendText({
      to: reminder.phoneNumber,
      text: message,
    });

    logger.info('Sent reminder', {
      reminderId: reminder.id,
      type: reminder.type,
      phoneNumber: reminder.phoneNumber,
    });
  }

  /**
   * Send immediate reminder (bypass scheduling)
   */
  async sendImmediateReminder(
    phoneNumber: string,
    type: ReminderType,
    data: ReminderData,
    language: SupportedLanguage = 'en'
  ): Promise<void> {
    const tempReminder: ReminderSchedule = {
      id: uuidv4(),
      tenantId: '',
      phoneNumber,
      type,
      scheduledFor: new Date(),
      data,
      status: 'pending',
      createdAt: new Date(),
    };

    const templateMap: Record<ReminderType, keyof typeof REMINDER_TEMPLATES> = {
      'rent_due_t_minus_5': 'rentDueT5',
      'rent_due_t_minus_1': 'rentDueT1',
      'rent_due_today': 'rentDueToday',
      'rent_overdue_t_plus_3': 'rentOverdueT3',
      'rent_overdue_t_plus_7': 'rentOverdueT7',
      'maintenance_appointment': 'maintenanceAppointment',
      'document_expiry': 'documentExpiry',
      'lease_renewal': 'leaseRenewal',
    };

    const templateKey = templateMap[type];
    const template = REMINDER_TEMPLATES[templateKey];
    const templateContent = getTemplate(template, language) as string;

    const message = renderTemplate(templateContent, {
      tenantName: data.tenantName || '',
      amount: data.amount?.toLocaleString() || '',
      currency: this.defaultCurrency,
      dueDate: data.dueDate || '',
      propertyName: data.propertyName || '',
      unitNumber: data.unitNumber || '',
      appointmentDate: data.maintenanceDate || '',
      appointmentTime: data.appointmentTime || '',
      technicianName: data.technicianName || '',
      issueType: data.issueType || '',
      documentType: data.documentType || '',
      expiryDate: data.expiryDate || '',
      leaseEndDate: data.leaseEndDate || '',
    });

    await this.whatsappClient.sendText({ to: phoneNumber, text: message });
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private async createReminder(
    tenantId: string,
    phoneNumber: string,
    type: ReminderType,
    scheduledFor: Date,
    data: ReminderData
  ): Promise<ReminderSchedule> {
    const reminder: ReminderSchedule = {
      id: uuidv4(),
      tenantId,
      phoneNumber,
      type,
      scheduledFor,
      data,
      status: 'pending',
      createdAt: new Date(),
    };

    await this.reminderQueue.schedule(reminder);
    return reminder;
  }

  private formatDate(date: Date, language: SupportedLanguage): string {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    };

    // Follow-up KI-005 (Docs/TODO_BACKLOG.md): resolve locale from `tenant.defaultLocale` (BCP-47)
    //   once tenants-table carries defaultLocale. Bare language tags
    //   are used so the runtime falls back to a sensible default.
    //   See Docs/KNOWN_ISSUES.md#ki-005.
    const locale = language === 'sw' ? 'sw' : 'en';
    return date.toLocaleDateString(locale, options);
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Get all scheduled reminders for a tenant
   */
  async getScheduledReminders(tenantId: string): Promise<ReminderSchedule[]> {
    return this.reminderQueue.getScheduled(tenantId);
  }

  /**
   * Cancel a specific reminder
   */
  async cancelReminder(reminderId: string): Promise<void> {
    await this.reminderQueue.cancel(reminderId);
    logger.info('Cancelled reminder', { reminderId });
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createReminderEngine(options: {
  whatsappClient: MetaWhatsAppClient;
  reminderQueue?: ReminderQueue;
  tenantDataProvider: TenantDataProvider;
  /** Tenant currency from region-config; required to avoid currency drift. */
  defaultCurrency: string;
  /** #medium — DLQ/retry marker for failed reminders (default: no-op). */
  deadLetterSink?: ReminderDeadLetterSink;
  /** #medium — staff in-app alert sink, counts/ids only (default: no-op). */
  staffAlertSink?: ReminderStaffAlertSink;
}): ReminderEngine {
  return new ReminderEngine(options);
}
