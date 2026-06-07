/**
 * BOSSNYUMBA Notifications Service
 * 
 * Multi-channel notification service supporting:
 * - WhatsApp Business API
 * - SMS (Africa's Talking)
 * - Email (SendGrid, SES, SMTP)
 * - Push Notifications (Firebase)
 * - In-App Notifications
 */

// ============================================================================
// WhatsApp Client (Legacy)
// ============================================================================
export {
  WhatsAppClient,
  whatsAppClient,
  type WhatsAppConfig,
  type TextMessage,
  type TemplateMessage,
  type TemplateComponent,
  type TemplateParameter,
  type MediaMessage,
  type InteractiveMessage,
  type SendMessageResponse,
  type WebhookMessage,
} from './whatsapp/client.js';

// ============================================================================
// WhatsApp Business API (Meta Cloud API)
// ============================================================================
export {
  // Meta Client
  MetaWhatsAppClient,
  metaWhatsAppClient,
  WhatsAppAPIError,
  WhatsAppRateLimitError,

  // Conversation Orchestrator (Module A - Onboarding)
  ConversationOrchestrator,
  createConversationOrchestrator,
  InMemorySessionStore,
  type SessionStore,
  type TenantLookup,
  type TenantInfo,
  type OnboardingStatus,

  // Maintenance Handler (Module F)
  MaintenanceRequestHandler,
  createMaintenanceHandler,
  type WorkOrderService,
  type TranscriptionService,

  // Feedback Collector (Module B)
  FeedbackCollector,
  createFeedbackCollector,
  type FeedbackService,

  // Reminder Engine (Module D)
  ReminderEngine,
  createReminderEngine,
  InMemoryReminderQueue,
  type ReminderQueue,
  type TenantDataProvider,

  // Emergency Handler
  EmergencyProtocolHandler,
  createEmergencyHandler,
  type EmergencyService,

  // Webhook Router
  createWebhookRouter,
  rawBodyMiddleware,
  type WebhookRouterOptions,
  type MessageStatusHandler,

  // Templates
  ONBOARDING_TEMPLATES,
  MAINTENANCE_TEMPLATES,
  FEEDBACK_TEMPLATES,
  REMINDER_TEMPLATES,
  EMERGENCY_TEMPLATES,
  GENERAL_TEMPLATES,
  getTemplate,
  renderTemplate as renderWhatsAppTemplate,
  getEmergencyKeywords,
  detectLanguage,

  // Types
  type SupportedLanguage,
  type ConversationState,
  type ConversationSession,
  type ConversationContext,
  type OnboardingContext,
  type MaintenanceContext,
  type FeedbackContext,
  type EmergencyContext,
  type WhatsAppBusinessConfig,
  type EmergencyContact,
  type ReminderSchedule,
  type ReminderType,
  type ReminderData,
  type WorkOrderFromChat,
  type FeedbackFromChat,
  type EmergencyIncident,
  type IncomingMessage,
  type MessageStatusUpdate,
  type OutgoingTextMessage,
  type OutgoingTemplateMessage,
  type OutgoingInteractiveMessage,
  type MessageTemplate,
  type InteractiveTemplate,
} from './whatsapp/index.js';

// ============================================================================
// Africa's Talking SMS
// ============================================================================
export {
  AfricasTalkingSms,
  africasTalkingSms,
  type AfricasTalkingConfig,
  type SmsRequest,
  type SmsRecipient,
  type SmsResponse,
  type DeliveryReport,
  type BulkSmsRequest,
} from './sms/africas-talking.js';

// ============================================================================
// Email Providers
// ============================================================================
export { SendGridProvider, sendGridProvider, type SendGridConfig } from './providers/email/sendgrid.js';
export { SmtpProvider, smtpProvider, type SmtpConfig } from './providers/email/smtp.js';
export { SesProvider, sesProvider, type SesConfig } from './providers/email/ses.js';

// ============================================================================
// Core Notification Service
// ============================================================================
export { notificationService, notificationProcessor } from './services/notification.service.js';

// ============================================================================
// In-App Notification Service
// ============================================================================
export {
  inAppNotificationService,
  createInAppNotificationService,
  type InAppNotificationService,
  type InAppNotificationServiceDeps,
  type InAppNotification,
  type CreateInAppNotificationInput,
  type CreateFromTemplateInput,
  type NotificationFilters,
  type NotificationStats,
  type NotificationPriority,
  type NotificationCategory,
  type WebSocketConnection,
} from './services/in-app-notification.service.js';

// ============================================================================
// Template Management Service
// ============================================================================
export {
  templateManagementService,
  type NotificationTemplate,
  type CreateTemplateInput,
  type UpdateTemplateInput,
  type RenderTemplateInput,
  type RenderedTemplate,
  type TemplatePreview,
  type TemplateCategory,
  type TemplateVariable,
  type TemplateContent,
} from './services/template-management.service.js';

// ============================================================================
// Preferences Service
// ============================================================================
export {
  preferencesService,
  createPreferencesService,
  type PreferencesService,
  type PreferencesServiceDeps,
} from './preferences/service.js';
export type {
  NotificationPreferences,
  ChannelPreferences,
  UpdatePreferencesInput,
  TemplatePreferences,
} from './preferences/types.js';

// ============================================================================
// Storage adapters (round-3 audit H6 + H7)
// ============================================================================
export {
  createPreferencesStore,
  createInAppNotificationStore,
  createConnectionRegistry,
  InMemoryPreferencesStore,
  InMemoryInAppNotificationStore,
  InMemoryConnectionRegistry,
  RedisPreferencesStore,
  RedisInAppNotificationStore,
  type PreferencesStore,
  type InAppNotificationStore,
  type ConnectionRegistry,
} from './storage/index.js';

// ============================================================================
// Providers
// ============================================================================
export { providerRegistry } from './providers/index.js';
export { InAppProvider, inAppProvider } from './providers/in-app/portal.js';
export type { INotificationProvider, SendParams } from './providers/provider.interface.js';

// ============================================================================
// Dispatcher — failover + cross-channel fallback ("without-fail" delivery)
// ============================================================================
//
// The dispatcher's `enqueueNotification` is the CANONICAL, reliability-aware
// delivery entry point: dispatch-time preference re-check, provider failover
// WITHIN a channel, cross-channel fallback terminating in the always-available
// in-app inbox, retry/backoff, idempotency, and DLQ on terminal failure. Every
// reminder/alert/message source MUST route through this (so it inherits the
// "without-fail" guarantees) rather than calling a provider directly.
//
// It is exported under BOTH names:
//   - `enqueueNotification` — the canonical name origination sources resolve
//     (e.g. identity-wiring's OTP SMS dispatch).
//   - `dispatchNotification` — an explicit alias for call sites that want the
//     intent to read unambiguously.
//
// The legacy BullMQ producer (which only enqueues a job for a separate worker
// and does NOT do failover/fallback) is exported below under the distinct
// `enqueueQueuedNotification` / `enqueueBulkQueuedNotifications` names so it can
// never be mistaken for the reliability path.
export {
  enqueueNotification,
  enqueueNotification as dispatchNotification,
  deadLetterQueueInspector,
  type EnqueueNotificationInput,
  type DispatchResult,
  type DispatcherDeps,
  type DeadLetterRecord,
  type DrainableDeadLetterSource,
  type NotificationPriority as DispatchPriority,
} from './dispatcher.js';

// ============================================================================
// Dead-letter drainer — re-delivers dead-lettered notifications with backoff
// ============================================================================
export {
  createDlqDrainer,
  type DlqDrainerDeps,
  type DlqDrainerHandle,
  type DlqDrainResult,
  type DlqDrainerLogger,
} from './dlq-drainer.js';

// ============================================================================
// Templates
// ============================================================================
export { resolveTemplate } from './templates/index.js';
export type { TemplateData, RenderedTemplate as ResolvedTemplate } from './templates/manager.js';

// ============================================================================
// Queue (LEGACY — BullMQ producer/consumer)
// ============================================================================
//
// These only enqueue/process a BullMQ job and do NOT perform the dispatcher's
// failover + cross-channel fallback. Renamed away from `enqueueNotification`
// so the canonical reliability path (the dispatcher, above) owns that name and
// no origination source accidentally bypasses failover by importing the queue.
export {
  addToQueue as enqueueQueuedNotification,
  addBulkToQueue as enqueueBulkQueuedNotifications,
} from './queue/producer.js';
export { createNotificationWorker as startNotificationConsumer, stopNotificationConsumer } from './queue/consumer.js';

// ============================================================================
// Types
// ============================================================================
export type {
  TenantId,
  NotificationChannel,
  SupportedLocale,
  NotificationTemplateId,
  NotificationRecipient,
  SendResult,
  ScheduledNotification,
  NotificationHistoryRecord,
  ProviderConfig,
  NotificationPayload,
} from './types/index.js';
