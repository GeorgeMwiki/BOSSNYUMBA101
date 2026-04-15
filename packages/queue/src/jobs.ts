/**
 * Shared job payload types used across services.
 *
 * Having these in a single package lets producers (e.g. the API gateway
 * enqueueing a PDF render) and consumers (e.g. a reports worker) share a
 * compile-time contract instead of drifting string literals.
 */

import type { JobsOptions } from 'bullmq';

/**
 * Canonical queue names. Keep this list small and explicit - one entry per
 * logical workload. Workers MUST reference these constants (not string
 * literals) so renames surface as type errors.
 */
export const QueueNames = {
  Notifications: 'notifications',
  EtimsRetries: 'etims-retries',
  PdfGeneration: 'pdf-generation',
  RetentionSweep: 'retention-sweep',
} as const;

export type QueueName = (typeof QueueNames)[keyof typeof QueueNames];

/**
 * Send a notification via the notifications service. This mirrors the
 * existing NotificationJobData shape in services/notifications so cross-
 * service producers can stay schema-compatible without a direct import.
 */
export interface SendNotificationJob {
  recipient: {
    id?: string;
    email?: string;
    phone?: string;
    deviceToken?: string;
    locale?: string;
  };
  channel: 'whatsapp' | 'sms' | 'email' | 'push' | 'in_app' | 'voice_call';
  templateId: string;
  data: Record<string, string>;
  notificationId?: string;
  tenantId?: string;
}

/**
 * Retry a failed eTIMS (Kenya Revenue Authority) invoice submission. The
 * worker picks up submission state from the ledger and re-attempts with
 * exponential backoff handled by BullMQ.
 */
export interface RetryEtimsSubmissionJob {
  tenantId: string;
  invoiceId: string;
  submissionId: string;
  attempt: number;
  lastError?: string;
  /** ISO timestamp of the original submission for audit trail. */
  originalSubmittedAt: string;
}

/**
 * Generate a PDF from a template. Used for statements, receipts, lease
 * documents, and morning briefings.
 */
export interface GeneratePdfJob {
  tenantId: string;
  templateId: string;
  outputKey: string;
  variables: Record<string, unknown>;
  /** S3-style destination - bucket/prefix resolved by the worker. */
  storageHint?: {
    bucket?: string;
    prefix?: string;
  };
  /** Optional callback webhook or in-app notification trigger. */
  notifyOnComplete?: {
    userId?: string;
    channel?: 'in_app' | 'email';
  };
}

/** Convenience union for code that handles any shared job. */
export type KnownJobPayload =
  | SendNotificationJob
  | RetryEtimsSubmissionJob
  | GeneratePdfJob;

/**
 * Default job options applied when callers do not supply their own. Chosen
 * to be conservative: 3 attempts with exponential backoff, keep last 1k
 * completions for observability, keep 5k failures for debugging.
 */
export const DefaultJobOptions: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 1000 },
  removeOnComplete: { count: 1000 },
  removeOnFail: { count: 5000 },
};
