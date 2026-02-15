import { z } from 'zod';

// =============================================================================
// BOSSNYUMBA - Environment Variable Schemas
// =============================================================================
// Centralized validation for all environment variables
// =============================================================================

// -----------------------------------------------------------------------------
// Database Schema
// -----------------------------------------------------------------------------
export const databaseSchema = z.object({
  DATABASE_URL: z
    .string()
    .url()
    .describe('PostgreSQL connection string'),
});

// -----------------------------------------------------------------------------
// Redis Schema
// -----------------------------------------------------------------------------
export const redisSchema = z.object({
  REDIS_URL: z
    .string()
    .url()
    .optional()
    .describe('Redis connection string'),
});

// -----------------------------------------------------------------------------
// Authentication Schema
// -----------------------------------------------------------------------------
export const authSchema = z.object({
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters')
    .optional()
    .describe('Secret key for JWT signing'),
  JWT_EXPIRES_IN: z
    .string()
    .default('7d')
    .describe('JWT token expiration time'),
  CLERK_SECRET_KEY: z
    .string()
    .optional()
    .describe('Clerk authentication secret key'),
});

// -----------------------------------------------------------------------------
// Payments Schema
// -----------------------------------------------------------------------------
export const paymentsSchema = z.object({
  // M-Pesa
  MPESA_CONSUMER_KEY: z.string().optional(),
  MPESA_CONSUMER_SECRET: z.string().optional(),
  MPESA_PASSKEY: z.string().optional(),
  MPESA_SHORTCODE: z.string().optional(),
  // Stripe
  STRIPE_SECRET_KEY: z.string().optional(),
  // Flutterwave
  FLUTTERWAVE_SECRET_KEY: z.string().optional(),
});

// -----------------------------------------------------------------------------
// Notifications Schema
// -----------------------------------------------------------------------------
export const notificationsSchema = z.object({
  AFRICAS_TALKING_API_KEY: z.string().optional(),
  AFRICAS_TALKING_USERNAME: z.string().default('sandbox'),
  SENDGRID_API_KEY: z.string().optional(),
  FIREBASE_PROJECT_ID: z.string().optional(),
});

// -----------------------------------------------------------------------------
// Storage Schema
// -----------------------------------------------------------------------------
export const storageSchema = z.object({
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_S3_BUCKET: z.string().optional(),
  AWS_REGION: z.string().default('eu-west-1'),
});

// -----------------------------------------------------------------------------
// AI Schema
// -----------------------------------------------------------------------------
export const aiSchema = z.object({
  OPENAI_API_KEY: z.string().optional(),
});

// -----------------------------------------------------------------------------
// URLs Schema
// -----------------------------------------------------------------------------
export const urlsSchema = z.object({
  API_URL: z.string().url().optional().default('http://localhost:4000'),
  FRONTEND_URL: z.string().url().optional().default('http://localhost:3000'),
});

// -----------------------------------------------------------------------------
// Combined Environment Schema
// -----------------------------------------------------------------------------
export const envSchema = databaseSchema
  .merge(redisSchema)
  .merge(authSchema)
  .merge(paymentsSchema)
  .merge(notificationsSchema)
  .merge(storageSchema)
  .merge(aiSchema)
  .merge(urlsSchema);

export type EnvSchema = z.infer<typeof envSchema>;

// -----------------------------------------------------------------------------
// Partial schemas for service-specific configs
// -----------------------------------------------------------------------------
export const apiGatewayEnvSchema = databaseSchema
  .merge(redisSchema)
  .merge(authSchema)
  .merge(urlsSchema);

export const paymentsEnvSchema = databaseSchema
  .merge(redisSchema)
  .merge(paymentsSchema);

export const notificationsEnvSchema = databaseSchema
  .merge(redisSchema)
  .merge(notificationsSchema);

export const reportsEnvSchema = databaseSchema
  .merge(redisSchema)
  .merge(storageSchema)
  .merge(aiSchema);

export type ApiGatewayEnv = z.infer<typeof apiGatewayEnvSchema>;
export type PaymentsEnv = z.infer<typeof paymentsEnvSchema>;
export type NotificationsEnv = z.infer<typeof notificationsEnvSchema>;
export type ReportsEnv = z.infer<typeof reportsEnvSchema>;
