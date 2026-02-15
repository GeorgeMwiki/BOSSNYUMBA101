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
} from './whatsapp/client';

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
} from './whatsapp/index';

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
} from './sms/africas-talking';

// ============================================================================
// Email Providers
// ============================================================================
export { SendGridProvider, sendGridProvider, type SendGridConfig } from './providers/email/sendgrid';
export { SmtpProvider, smtpProvider, type SmtpConfig } from './providers/email/smtp';
export { SesProvider, sesProvider, type SesConfig } from './providers/email/ses';

// ============================================================================
// Core Notification Service
// ============================================================================
export { notificationService, notificationProcessor } from './services/notification.service';

// ============================================================================
// In-App Notification Service
// ============================================================================
export {
  inAppNotificationService,
  type InAppNotification,
  type CreateInAppNotificationInput,
  type CreateFromTemplateInput,
  type NotificationFilters,
  type NotificationStats,
  type NotificationPriority,
  type NotificationCategory,
  type WebSocketConnection,
} from './services/in-app-notification.service';

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
} from './services/template-management.service';

// ============================================================================
// Preferences Service
// ============================================================================
export { preferencesService } from './preferences/service';
export type {
  NotificationPreferences,
  ChannelPreference,
  QuietHours,
} from './preferences/types';

// ============================================================================
// Providers
// ============================================================================
export { providerRegistry } from './providers/index';
export type { INotificationProvider, SendParams } from './providers/provider.interface';

// ============================================================================
// Templates
// ============================================================================
export { resolveTemplate } from './templates/index';
export type { TemplateData, RenderedTemplate as ResolvedTemplate } from './templates/manager';

// ============================================================================
// Queue
// ============================================================================
export { enqueueNotification, enqueueBulkNotifications } from './queue/producer';
export { startNotificationConsumer, stopNotificationConsumer } from './queue/consumer';

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
} from './types/index';
