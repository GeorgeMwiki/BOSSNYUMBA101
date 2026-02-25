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
  JWT_REFRESH_SECRET: z.string().optional().describe('Refresh token signing secret'),
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
// AI Schema (multi-provider: OpenAI, Anthropic, DeepSeek from env)
// -----------------------------------------------------------------------------
export const aiSchema = z.object({
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  DEEPSEEK_API_KEY: z.string().optional(),
  AI_PROVIDER: z.enum(['openai', 'anthropic', 'deepseek']).optional(),
});

// -----------------------------------------------------------------------------
// URLs Schema (no hardcoded defaults; dev defaults applied in loadEnv)
// -----------------------------------------------------------------------------
export const urlsSchema = z.object({
  API_URL: z.string().url().optional().describe('API gateway base URL'),
  FRONTEND_URL: z.string().url().optional().describe('Frontend app URL'),
});

// -----------------------------------------------------------------------------
// Supabase Schema (BOSSNYUMBA's own Supabase project - never mix with others)
// -----------------------------------------------------------------------------
export const supabaseSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url()
    .optional()
    .describe('Supabase project URL (BOSSNYUMBA-specific, never shared)'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(20)
    .optional()
    .describe('Supabase anon/public key'),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(20)
    .optional()
    .describe('Supabase service role key (server-side only)'),
});

// -----------------------------------------------------------------------------
// Neo4j Graph Database Schema
// -----------------------------------------------------------------------------
export const neo4jSchema = z.object({
  NEO4J_URI: z.string().optional().describe('Neo4j bolt URI'),
  NEO4J_USER: z.string().optional().describe('Neo4j username'),
  NEO4J_PASSWORD: z.string().optional().describe('Neo4j password'),
});

// -----------------------------------------------------------------------------
// Combined Environment Schema
// -----------------------------------------------------------------------------
export const envSchema = databaseSchema
  .merge(redisSchema)
  .merge(authSchema)
  .merge(supabaseSchema)
  .merge(neo4jSchema)
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
  .merge(supabaseSchema)
  .merge(neo4jSchema)
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
