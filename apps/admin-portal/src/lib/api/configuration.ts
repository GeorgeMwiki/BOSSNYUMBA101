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

export interface SystemConfiguration {
  general: GeneralConfig;
  payments: PaymentConfig;
  email: EmailConfig;
  notifications: NotificationConfig;
  security: SecurityConfig;
  database: DatabaseConfig;
  branding: BrandingConfig;
}

export type ConfigSectionKey = keyof SystemConfiguration;

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
