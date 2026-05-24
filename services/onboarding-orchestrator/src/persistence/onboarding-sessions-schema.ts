/**
 * Drizzle schema for `onboarding_sessions` + `onboarding_session_events`.
 *
 * Mirrors migration 0164. Kept as a thin definition file (no runtime
 * imports of drizzle) so the schema is consumable both from the live
 * service AND from unit tests without dragging in a DB driver.
 *
 * NOTE: We deliberately do NOT import from `@bossnyumba/database` here
 * to keep `services/onboarding-orchestrator` decoupled. The actual
 * drizzle client is injected via SessionStore (see session-store.ts).
 * This file is the column-level contract; importers in the wider
 * monorepo can adopt the drizzle definition when wiring repositories.
 */

export const ONBOARDING_SESSIONS_TABLE = 'onboarding_sessions';
export const ONBOARDING_SESSION_EVENTS_TABLE = 'onboarding_session_events';

export const ONBOARDING_SESSION_COLUMNS = [
  'id',
  'tenant_id',
  'started_by_user_id',
  'channel',
  'locale',
  'status',
  'slots',
  'transcript',
  'blueprint',
  'interview_budget',
  'turns_used',
  'external_handle',
  'started_at',
  'last_activity_at',
  'completed_at',
  'rolled_back_at',
] as const;

export type OnboardingSessionColumn = (typeof ONBOARDING_SESSION_COLUMNS)[number];

export const ONBOARDING_SESSION_EVENT_TYPES = [
  'message_in',
  'message_out',
  'slot_filled',
  'extract_attempt',
  'confirm_proposed',
  'confirm_accepted',
  'bootstrap_step',
  'bootstrap_committed',
  'rollback',
  'error',
] as const;

export type OnboardingSessionEventType = (typeof ONBOARDING_SESSION_EVENT_TYPES)[number];

export const ONBOARDING_CHANNELS = ['web', 'whatsapp', 'voice', 'email'] as const;
export type OnboardingChannel = (typeof ONBOARDING_CHANNELS)[number];

export const ONBOARDING_STATUSES = [
  'open',
  'awaiting_user',
  'awaiting_confirm',
  'bootstrapping',
  'committed',
  'abandoned',
  'rolled_back',
] as const;

export type OnboardingStatus = (typeof ONBOARDING_STATUSES)[number];
