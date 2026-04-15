/**
 * Retention worker configuration, loaded from environment variables.
 *
 * All numeric values are validated so a typo in RETENTION_AUDIT_DAYS does
 * not silently default to 0 and wipe the audit table.
 */

export interface RetentionConfig {
  databaseUrl: string | undefined;
  redisUrl: string | undefined;
  /** Cron schedule for the retention sweep (default: 02:15 UTC daily). */
  cronSchedule: string;
  /** IANA TZ used by node-cron. */
  cronTimezone: string;
  /** When true, log what would be deleted but do not issue DELETE/UPDATE. */
  dryRun: boolean;
  /** Max records processed per adapter per sweep (prevents runaway locks). */
  batchLimit: number;
  /** Retention windows in days, per entity. */
  retention: {
    auditEventsDays: number;
    chatMessagesDays: number;
    communicationLogsDays: number;
    aiInteractionsDays: number;
    deletedUserPiiHardDeleteDays: number;
  };
}

function parseIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  if (Number.isNaN(n) || n <= 0) {
    throw new Error(`Invalid env ${name}=${raw}: must be a positive integer`);
  }
  return n;
}

function parseBoolEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
}

export function loadConfig(): RetentionConfig {
  return {
    databaseUrl: process.env['DATABASE_URL'],
    redisUrl: process.env['REDIS_URL'],
    cronSchedule: process.env['RETENTION_CRON'] ?? '15 2 * * *',
    cronTimezone: process.env['RETENTION_CRON_TZ'] ?? 'UTC',
    dryRun: parseBoolEnv('RETENTION_DRY_RUN', false),
    batchLimit: parseIntEnv('RETENTION_BATCH_LIMIT', 1000),
    retention: {
      auditEventsDays: parseIntEnv('RETENTION_AUDIT_EVENTS_DAYS', 90),
      chatMessagesDays: parseIntEnv('RETENTION_CHAT_MESSAGES_DAYS', 365),
      communicationLogsDays: parseIntEnv('RETENTION_COMMUNICATION_LOGS_DAYS', 365),
      aiInteractionsDays: parseIntEnv('RETENTION_AI_INTERACTIONS_DAYS', 180),
      deletedUserPiiHardDeleteDays: parseIntEnv('RETENTION_DELETED_PII_DAYS', 30),
    },
  };
}
