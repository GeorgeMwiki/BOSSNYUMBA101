import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';

function unwrap<T>(res: { success: boolean; data?: T; error?: string }, feature: string): T {
  if (res.success && res.data !== undefined) return res.data;
  throw new Error(res.error || `${feature} is unavailable.`);
}

export interface GeneralConfig {
  platformName: string;
  timezone: string;
  currency: string;
  language: string;
  allowSelfSignup: boolean;
  enableTrial: boolean;
}

export interface PaymentConfig {
  mpesaConsumerKey: string;
  mpesaConsumerSecret: string;
  mpesaPaybill: string;
  mpesaCallbackUrl: string;
  mpesaConnected: boolean;
  bankTransferConfigured: boolean;
}

export interface SecurityConfig {
  passwordMinLength: number;
  requireUppercase: boolean;
  requireNumber: boolean;
  requireSpecialChar: boolean;
  sessionTimeoutMinutes: number;
  requireReauthForSensitive: boolean;
  enforce2faForAdmins: boolean;
  enforce2faForAll: boolean;
}

export interface EmailConfig {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassword: string;
  fromAddress: string;
  replyToAddress: string;
  enableTls: boolean;
}

export interface NotificationConfig {
  enablePush: boolean;
  enableSms: boolean;
  smsProvider: string;
  dailyDigestEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
}

export interface DatabaseConfig {
  primaryHost: string;
  replicaHost: string;
  backupsEnabled: boolean;
  backupRetentionDays: number;
  lastBackupAt: string | null;
}

export interface BrandingConfig {
  logoUrl: string;
  faviconUrl: string;
  primaryColor: string;
  accentColor: string;
  whitelabelEnabled: boolean;
}

export interface RatesConfig {
  lateFeePct: number;
  lateFeeGraceDays: number;
  paymentRetries: number;
  sessionTimeoutMinutes: number;
  trialDays?: number;
  paymentRetryIntervalHours?: number;
}

export interface FeatureFlag {
  key: string;
  name: string;
  description?: string;
  enabled: boolean;
  rolloutPct?: number;
  audience?: 'all' | 'beta' | 'admins';
}

export interface SystemConfiguration {
  // Section-shaped (legacy)
  general: GeneralConfig;
  payments: PaymentConfig;
  email: EmailConfig;
  notifications: NotificationConfig;
  security: SecurityConfig;
  database: DatabaseConfig;
  branding: BrandingConfig;
  // Flat surface used by ConfigurationPage
  platformName: string;
  defaultTimezone: string;
  defaultCurrency: string;
  defaultLanguage: string;
  allowTenantRegistration: boolean;
  enableTrialPeriod: boolean;
  rates: RatesConfig;
  featureFlags: FeatureFlag[];
}

export type ConfigSectionKey = keyof SystemConfiguration;

export type UpdateSystemConfigurationInput = Partial<{
  platformName: string;
  defaultTimezone: string;
  defaultCurrency: string;
  defaultLanguage: string;
  allowTenantRegistration: boolean;
  enableTrialPeriod: boolean;
  rates: Partial<RatesConfig>;
  general: Partial<GeneralConfig>;
  payments: Partial<PaymentConfig>;
  email: Partial<EmailConfig>;
  notifications: Partial<NotificationConfig>;
  security: Partial<SecurityConfig>;
  branding: Partial<BrandingConfig>;
}>;

/** Validates a configuration patch and returns a list of human-readable errors. */
export function validateSystemConfiguration(input: UpdateSystemConfigurationInput): string[] {
  const errors: string[] = [];
  if (input.platformName !== undefined && input.platformName.trim().length === 0) {
    errors.push('Platform name cannot be empty.');
  }
  if (input.rates) {
    const { lateFeePct, lateFeeGraceDays, trialDays, paymentRetries, sessionTimeoutMinutes, paymentRetryIntervalHours } = input.rates;
    if (lateFeePct !== undefined && (lateFeePct < 0 || lateFeePct > 100)) {
      errors.push('Late fee percent must be between 0 and 100.');
    }
    if (lateFeeGraceDays !== undefined && lateFeeGraceDays < 0) {
      errors.push('Late fee grace days must be non-negative.');
    }
    if (trialDays !== undefined && trialDays < 0) {
      errors.push('Trial days must be non-negative.');
    }
    if (paymentRetries !== undefined && paymentRetries < 0) {
      errors.push('Payment retries must be non-negative.');
    }
    if (sessionTimeoutMinutes !== undefined && sessionTimeoutMinutes <= 0) {
      errors.push('Session timeout must be positive.');
    }
    if (paymentRetryIntervalHours !== undefined && paymentRetryIntervalHours <= 0) {
      errors.push('Payment retry interval hours must be positive.');
    }
  }
  return errors;
}

export function useSystemConfiguration() {
  return useQuery({
    queryKey: ['system-configuration'],
    queryFn: async () => unwrap(await api.get<SystemConfiguration>('/configuration'), 'System configuration'),
    staleTime: 60_000,
  });
}

export function useSaveConfigurationSection<K extends ConfigSectionKey>(section: K) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: SystemConfiguration[K]) =>
      unwrap(await api.put<SystemConfiguration[K]>(`/configuration/${section}`, body), `${section} configuration`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['system-configuration'] }),
  });
}

export function useUpdateSystemConfiguration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateSystemConfigurationInput) =>
      unwrap(
        await api.patch<SystemConfiguration>('/configuration', input),
        'System configuration',
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['system-configuration'] }),
  });
}

export function useUpdateFeatureFlag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { key: string; enabled: boolean; rolloutPct?: number; audience?: FeatureFlag['audience'] }) =>
      unwrap(
        await api.patch<FeatureFlag>(`/configuration/feature-flags/${input.key}`, {
          enabled: input.enabled,
          rolloutPct: input.rolloutPct,
          audience: input.audience,
        }),
        'Feature flag update',
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['system-configuration'] }),
  });
}
