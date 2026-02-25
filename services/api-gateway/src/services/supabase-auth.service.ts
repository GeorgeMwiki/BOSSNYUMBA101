/**
 * Supabase Auth Service - BOSSNYUMBA
 *
 * Production-ready authentication using Supabase Auth.
 * Supports:
 *  - Phone OTP (primary for Tanzania - mobile-first)
 *  - Email/password (for owner portal, admin portal)
 *  - Context switching (same user can be owner AND tenant)
 *
 * Falls back to demo mode when Supabase is not configured (development only).
 */

import { createClient, type SupabaseClient, type User as SupabaseUser } from '@supabase/supabase-js';

// ============================================================================
// Types
// ============================================================================

export interface AuthProfile {
  id: string;
  authUid: string;
  email: string | null;
  phone: string | null;
  firstName: string;
  lastName: string;
  displayName: string | null;
  avatarUrl: string | null;
  activeContextId: string | null;
  preferredLocale: string;
  preferredTimezone: string;
  preferredCurrency: string;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface UserContext {
  id: string;
  authUid: string;
  contextType: 'owner' | 'tenant' | 'technician' | 'manager' | 'admin';
  tenantId: string | null;
  isActive: boolean;
  isPrimary: boolean;
  displayName: string | null;
  entityType: 'individual' | 'company';
  companyName: string | null;
  enabledFeatures: string[];
  featureUsage: Record<string, unknown>;
  onboardingCompleted: boolean;
  onboardingStep: string | null;
  metadata: Record<string, unknown>;
}

export interface LoginResult {
  success: boolean;
  token?: string;
  refreshToken?: string;
  profile?: AuthProfile;
  contexts?: UserContext[];
  activeContext?: UserContext;
  error?: { code: string; message: string };
}

export interface SignupResult {
  success: boolean;
  profile?: AuthProfile;
  error?: { code: string; message: string };
}

// ============================================================================
// Service
// ============================================================================

export class SupabaseAuthService {
  private client: SupabaseClient;
  private serviceClient: SupabaseClient;
  private isConfigured: boolean;

  constructor() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    this.isConfigured = !!(url && anonKey && !url.includes('your-project'));

    if (this.isConfigured) {
      this.client = createClient(url, anonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      this.serviceClient = createClient(url, serviceKey || anonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
    } else {
      // Dummy clients for dev mode
      this.client = null as unknown as SupabaseClient;
      this.serviceClient = null as unknown as SupabaseClient;
    }
  }

  // =========================================================================
  // Phone OTP Login (Primary for mobile-first Tanzania market)
  // =========================================================================

  async sendPhoneOtp(phone: string): Promise<{ success: boolean; error?: string }> {
    if (!this.isConfigured) {
      // Dev mode: pretend OTP sent
      console.warn('[auth] Supabase not configured - demo OTP mode');
      return { success: true };
    }

    const { error } = await this.client.auth.signInWithOtp({
      phone: this.normalizePhone(phone),
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  }

  async verifyPhoneOtp(phone: string, otp: string): Promise<LoginResult> {
    const normalizedPhone = this.normalizePhone(phone);

    if (!this.isConfigured) {
      return this.demoPhoneLogin(normalizedPhone, otp);
    }

    const { data, error } = await this.client.auth.verifyOtp({
      phone: normalizedPhone,
      token: otp,
      type: 'sms',
    });

    if (error || !data.user) {
      return {
        success: false,
        error: { code: 'INVALID_OTP', message: error?.message || 'Invalid OTP' },
      };
    }

    return this.buildLoginResult(data.user, data.session?.access_token, data.session?.refresh_token);
  }

  // =========================================================================
  // Email/Password Login
  // =========================================================================

  async loginWithEmail(email: string, password: string): Promise<LoginResult> {
    if (!this.isConfigured) {
      return this.demoEmailLogin(email, password);
    }

    const { data, error } = await this.client.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      return {
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: error?.message || 'Invalid credentials' },
      };
    }

    return this.buildLoginResult(data.user, data.session?.access_token, data.session?.refresh_token);
  }

  // =========================================================================
  // Registration
  // =========================================================================

  async signupWithEmail(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
  }): Promise<SignupResult> {
    if (!this.isConfigured) {
      return this.demoSignup(data);
    }

    const { data: authData, error } = await this.client.auth.signUp({
      email: data.email,
      password: data.password,
      phone: data.phone ? this.normalizePhone(data.phone) : undefined,
      options: {
        data: {
          first_name: data.firstName,
          last_name: data.lastName,
        },
      },
    });

    if (error || !authData.user) {
      return {
        success: false,
        error: { code: 'SIGNUP_FAILED', message: error?.message || 'Signup failed' },
      };
    }

    // Create auth profile
    const profile = await this.ensureProfile(authData.user);

    return { success: true, profile };
  }

  async signupWithPhone(data: {
    phone: string;
    firstName: string;
    lastName: string;
    email?: string;
  }): Promise<{ success: boolean; error?: string }> {
    if (!this.isConfigured) {
      console.warn('[auth] Supabase not configured - demo signup mode');
      return { success: true };
    }

    // Phone signup uses OTP - we send OTP, then on verify we create the profile
    const { error } = await this.client.auth.signInWithOtp({
      phone: this.normalizePhone(data.phone),
      options: {
        data: {
          first_name: data.firstName,
          last_name: data.lastName,
          email: data.email,
        },
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  }

  // =========================================================================
  // Context Management (Dynamic Roles)
  // =========================================================================

  async getUserContexts(authUid: string): Promise<UserContext[]> {
    if (!this.isConfigured) {
      return this.demoContexts(authUid);
    }

    const { data, error } = await this.serviceClient
      .from('user_contexts')
      .select('*')
      .eq('auth_uid', authUid)
      .eq('is_active', true)
      .order('is_primary', { ascending: false });

    if (error || !data) return [];

    return data.map(this.mapContext);
  }

  async createContext(authUid: string, contextData: {
    contextType: UserContext['contextType'];
    tenantId?: string;
    displayName?: string;
    entityType?: 'individual' | 'company';
    companyName?: string;
    isPrimary?: boolean;
  }): Promise<UserContext | null> {
    if (!this.isConfigured) {
      return this.demoCreateContext(authUid, contextData);
    }

    // If setting as primary, unset other primary contexts
    if (contextData.isPrimary) {
      await this.serviceClient
        .from('user_contexts')
        .update({ is_primary: false })
        .eq('auth_uid', authUid);
    }

    const { data, error } = await this.serviceClient
      .from('user_contexts')
      .insert({
        auth_uid: authUid,
        context_type: contextData.contextType,
        tenant_id: contextData.tenantId || null,
        display_name: contextData.displayName || null,
        entity_type: contextData.entityType || 'individual',
        company_name: contextData.companyName || null,
        is_primary: contextData.isPrimary || false,
        enabled_features: this.getDefaultFeatures(contextData.contextType),
      })
      .select()
      .single();

    if (error || !data) return null;
    return this.mapContext(data);
  }

  async switchContext(authUid: string, contextId: string): Promise<UserContext | null> {
    if (!this.isConfigured) {
      return null;
    }

    // Verify ownership
    const { data: context } = await this.serviceClient
      .from('user_contexts')
      .select('*')
      .eq('id', contextId)
      .eq('auth_uid', authUid)
      .eq('is_active', true)
      .single();

    if (!context) return null;

    // Update active context in profile
    await this.serviceClient
      .from('auth_profiles')
      .update({ active_context_id: contextId })
      .eq('auth_uid', authUid);

    return this.mapContext(context);
  }

  // =========================================================================
  // Feature Discovery (Progressive UI)
  // =========================================================================

  async discoverFeature(contextId: string, featureKey: string): Promise<void> {
    if (!this.isConfigured) return;

    await this.serviceClient
      .from('feature_discovery')
      .upsert({
        user_context_id: contextId,
        feature_key: featureKey,
        enabled: true,
        usage_count: 1,
        last_used_at: new Date().toISOString(),
      }, {
        onConflict: 'user_context_id,feature_key',
      });

    // Also update the context's enabled_features array
    const { data: context } = await this.serviceClient
      .from('user_contexts')
      .select('enabled_features')
      .eq('id', contextId)
      .single();

    if (context && !context.enabled_features.includes(featureKey)) {
      await this.serviceClient
        .from('user_contexts')
        .update({
          enabled_features: [...context.enabled_features, featureKey],
        })
        .eq('id', contextId);
    }
  }

  async trackFeatureUsage(contextId: string, featureKey: string): Promise<void> {
    if (!this.isConfigured) return;

    // Increment usage count
    const { data: existing } = await this.serviceClient
      .from('feature_discovery')
      .select('usage_count')
      .eq('user_context_id', contextId)
      .eq('feature_key', featureKey)
      .single();

    if (existing) {
      await this.serviceClient
        .from('feature_discovery')
        .update({
          usage_count: existing.usage_count + 1,
          last_used_at: new Date().toISOString(),
        })
        .eq('user_context_id', contextId)
        .eq('feature_key', featureKey);
    } else {
      await this.discoverFeature(contextId, featureKey);
    }
  }

  async getDiscoveredFeatures(contextId: string): Promise<string[]> {
    if (!this.isConfigured) {
      return this.getDefaultFeatures('tenant');
    }

    const { data } = await this.serviceClient
      .from('feature_discovery')
      .select('feature_key')
      .eq('user_context_id', contextId)
      .eq('enabled', true);

    return data?.map((d) => d.feature_key) || [];
  }

  // =========================================================================
  // Profile Management
  // =========================================================================

  async getProfile(authUid: string): Promise<AuthProfile | null> {
    if (!this.isConfigured) {
      return this.demoProfile(authUid);
    }

    const { data } = await this.serviceClient
      .from('auth_profiles')
      .select('*')
      .eq('auth_uid', authUid)
      .single();

    if (!data) return null;
    return this.mapProfile(data);
  }

  async ensureProfile(user: SupabaseUser): Promise<AuthProfile> {
    const existing = await this.getProfile(user.id);
    if (existing) return existing;

    const meta = user.user_metadata || {};
    const { data } = await this.serviceClient
      .from('auth_profiles')
      .insert({
        auth_uid: user.id,
        email: user.email || null,
        phone: user.phone || null,
        first_name: meta.first_name || user.email?.split('@')[0] || 'User',
        last_name: meta.last_name || '',
        preferred_locale: 'en',
        preferred_timezone: 'Africa/Dar_es_Salaam',
        preferred_currency: 'TZS',
      })
      .select()
      .single();

    return data ? this.mapProfile(data) : this.demoProfile(user.id);
  }

  async updateProfile(authUid: string, updates: Partial<{
    firstName: string;
    lastName: string;
    displayName: string;
    avatarUrl: string;
    preferredLocale: string;
    preferredTimezone: string;
    preferredCurrency: string;
  }>): Promise<AuthProfile | null> {
    if (!this.isConfigured) return this.demoProfile(authUid);

    const dbUpdates: Record<string, unknown> = {};
    if (updates.firstName !== undefined) dbUpdates.first_name = updates.firstName;
    if (updates.lastName !== undefined) dbUpdates.last_name = updates.lastName;
    if (updates.displayName !== undefined) dbUpdates.display_name = updates.displayName;
    if (updates.avatarUrl !== undefined) dbUpdates.avatar_url = updates.avatarUrl;
    if (updates.preferredLocale !== undefined) dbUpdates.preferred_locale = updates.preferredLocale;
    if (updates.preferredTimezone !== undefined) dbUpdates.preferred_timezone = updates.preferredTimezone;
    if (updates.preferredCurrency !== undefined) dbUpdates.preferred_currency = updates.preferredCurrency;

    const { data } = await this.serviceClient
      .from('auth_profiles')
      .update(dbUpdates)
      .eq('auth_uid', authUid)
      .select()
      .single();

    return data ? this.mapProfile(data) : null;
  }

  // =========================================================================
  // Token Verification
  // =========================================================================

  async verifyToken(token: string): Promise<{ user: SupabaseUser; authUid: string } | null> {
    if (!this.isConfigured) return null;

    const { data, error } = await this.client.auth.getUser(token);
    if (error || !data.user) return null;

    return { user: data.user, authUid: data.user.id };
  }

  // =========================================================================
  // Logout
  // =========================================================================

  async logout(token?: string): Promise<void> {
    if (!this.isConfigured) return;
    // Server-side logout by invalidating the session
    if (token) {
      await this.client.auth.admin.signOut(token);
    }
  }

  // =========================================================================
  // Private Helpers
  // =========================================================================

  private normalizePhone(phone: string): string {
    let cleaned = phone.replace(/[\s\-\(\)]/g, '');
    // Handle Tanzania numbers
    if (cleaned.startsWith('0') && cleaned.length >= 10) {
      cleaned = '+255' + cleaned.slice(1);
    }
    if (cleaned.startsWith('255') && !cleaned.startsWith('+')) {
      cleaned = '+' + cleaned;
    }
    // Handle Kenya numbers
    if (cleaned.startsWith('07') && cleaned.length === 10) {
      cleaned = '+254' + cleaned.slice(1);
    }
    if (!cleaned.startsWith('+')) {
      cleaned = '+' + cleaned;
    }
    return cleaned;
  }

  private async buildLoginResult(
    user: SupabaseUser,
    accessToken?: string,
    refreshToken?: string
  ): Promise<LoginResult> {
    const profile = await this.ensureProfile(user);
    const contexts = await this.getUserContexts(user.id);

    // If no contexts exist, create a default tenant context
    let activeContext = contexts.find((c) => c.isPrimary) || contexts[0];
    if (!activeContext) {
      activeContext = await this.createContext(user.id, {
        contextType: 'tenant',
        isPrimary: true,
        displayName: `${profile.firstName} ${profile.lastName}`,
      }) || undefined as unknown as UserContext;
    }

    // Update last login
    if (this.isConfigured) {
      await this.serviceClient
        .from('auth_profiles')
        .update({
          last_login_at: new Date().toISOString(),
          active_context_id: activeContext?.id,
        })
        .eq('auth_uid', user.id);
    }

    return {
      success: true,
      token: accessToken,
      refreshToken,
      profile,
      contexts,
      activeContext,
    };
  }

  private getDefaultFeatures(contextType: string): string[] {
    const defaults: Record<string, string[]> = {
      tenant: ['payments', 'maintenance', 'lease', 'profile', 'notifications'],
      owner: ['portfolio', 'analytics', 'tenants', 'financial', 'reports'],
      technician: ['work_orders', 'schedule', 'profile'],
      manager: ['properties', 'units', 'customers', 'work_orders', 'payments', 'leases', 'inspections'],
      admin: ['tenants_mgmt', 'users', 'roles', 'billing', 'analytics', 'communications'],
    };
    return defaults[contextType] || ['profile', 'notifications'];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapContext(row: any): UserContext {
    return {
      id: row.id,
      authUid: row.auth_uid,
      contextType: row.context_type,
      tenantId: row.tenant_id,
      isActive: row.is_active,
      isPrimary: row.is_primary,
      displayName: row.display_name,
      entityType: row.entity_type,
      companyName: row.company_name,
      enabledFeatures: row.enabled_features || [],
      featureUsage: row.feature_usage || {},
      onboardingCompleted: row.onboarding_completed,
      onboardingStep: row.onboarding_step,
      metadata: row.metadata || {},
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapProfile(row: any): AuthProfile {
    return {
      id: row.id,
      authUid: row.auth_uid,
      email: row.email,
      phone: row.phone,
      firstName: row.first_name,
      lastName: row.last_name,
      displayName: row.display_name,
      avatarUrl: row.avatar_url,
      activeContextId: row.active_context_id,
      preferredLocale: row.preferred_locale,
      preferredTimezone: row.preferred_timezone,
      preferredCurrency: row.preferred_currency,
      createdAt: row.created_at,
      lastLoginAt: row.last_login_at,
    };
  }

  // =========================================================================
  // Demo Mode Fallbacks (development only)
  // =========================================================================

  private demoPhoneLogin(phone: string, otp: string): LoginResult {
    if (process.env.NODE_ENV === 'production') {
      return {
        success: false,
        error: { code: 'NOT_CONFIGURED', message: 'Supabase is required in production' },
      };
    }

    // Demo: accept "123456" as OTP
    if (otp !== '123456') {
      return { success: false, error: { code: 'INVALID_OTP', message: 'Invalid OTP' } };
    }

    const demoUid = `demo-${phone.replace(/\D/g, '')}`;
    const profile: AuthProfile = {
      id: demoUid,
      authUid: demoUid,
      email: null,
      phone,
      firstName: 'Demo',
      lastName: 'User',
      displayName: null,
      avatarUrl: null,
      activeContextId: `ctx-${demoUid}-tenant`,
      preferredLocale: 'en',
      preferredTimezone: 'Africa/Dar_es_Salaam',
      preferredCurrency: 'TZS',
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };

    const contexts = this.demoContexts(demoUid);

    return {
      success: true,
      token: `demo-token-${Date.now()}`,
      refreshToken: `demo-refresh-${Date.now()}`,
      profile,
      contexts,
      activeContext: contexts[0],
    };
  }

  private demoEmailLogin(email: string, password: string): LoginResult {
    if (process.env.NODE_ENV === 'production') {
      return {
        success: false,
        error: { code: 'NOT_CONFIGURED', message: 'Supabase is required in production' },
      };
    }

    // Demo: accept any password in dev
    const demoUid = `demo-${email.replace(/[^a-z0-9]/gi, '')}`;
    const profile: AuthProfile = {
      id: demoUid,
      authUid: demoUid,
      email,
      phone: null,
      firstName: email.split('@')[0],
      lastName: 'Demo',
      displayName: null,
      avatarUrl: null,
      activeContextId: `ctx-${demoUid}`,
      preferredLocale: 'en',
      preferredTimezone: 'Africa/Dar_es_Salaam',
      preferredCurrency: 'TZS',
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };

    // Determine role based on email pattern
    let contextType: UserContext['contextType'] = 'tenant';
    if (email.includes('owner')) contextType = 'owner';
    if (email.includes('admin')) contextType = 'admin';
    if (email.includes('manager')) contextType = 'manager';
    if (email.includes('tech')) contextType = 'technician';

    const contexts: UserContext[] = [{
      id: `ctx-${demoUid}`,
      authUid: demoUid,
      contextType,
      tenantId: 'tenant-001',
      isActive: true,
      isPrimary: true,
      displayName: profile.firstName,
      entityType: 'individual',
      companyName: null,
      enabledFeatures: this.getDefaultFeatures(contextType),
      featureUsage: {},
      onboardingCompleted: true,
      onboardingStep: null,
      metadata: {},
    }];

    return {
      success: true,
      token: `demo-token-${Date.now()}`,
      refreshToken: `demo-refresh-${Date.now()}`,
      profile,
      contexts,
      activeContext: contexts[0],
    };
  }

  private demoSignup(data: {
    email: string;
    firstName: string;
    lastName: string;
  }): SignupResult {
    return {
      success: true,
      profile: {
        id: `demo-${Date.now()}`,
        authUid: `demo-${Date.now()}`,
        email: data.email,
        phone: null,
        firstName: data.firstName,
        lastName: data.lastName,
        displayName: null,
        avatarUrl: null,
        activeContextId: null,
        preferredLocale: 'en',
        preferredTimezone: 'Africa/Dar_es_Salaam',
        preferredCurrency: 'TZS',
        createdAt: new Date().toISOString(),
        lastLoginAt: null,
      },
    };
  }

  private demoContexts(authUid: string): UserContext[] {
    return [{
      id: `ctx-${authUid}-tenant`,
      authUid,
      contextType: 'tenant',
      tenantId: 'tenant-001',
      isActive: true,
      isPrimary: true,
      displayName: 'My Rental',
      entityType: 'individual',
      companyName: null,
      enabledFeatures: this.getDefaultFeatures('tenant'),
      featureUsage: {},
      onboardingCompleted: true,
      onboardingStep: null,
      metadata: {},
    }];
  }

  private demoProfile(authUid: string): AuthProfile {
    return {
      id: authUid,
      authUid,
      email: 'demo@bossnyumba.com',
      phone: null,
      firstName: 'Demo',
      lastName: 'User',
      displayName: null,
      avatarUrl: null,
      activeContextId: null,
      preferredLocale: 'en',
      preferredTimezone: 'Africa/Dar_es_Salaam',
      preferredCurrency: 'TZS',
      createdAt: new Date().toISOString(),
      lastLoginAt: null,
    };
  }

  private demoCreateContext(authUid: string, contextData: {
    contextType: UserContext['contextType'];
    displayName?: string;
    entityType?: 'individual' | 'company';
    companyName?: string;
    isPrimary?: boolean;
  }): UserContext {
    return {
      id: `ctx-${authUid}-${contextData.contextType}-${Date.now()}`,
      authUid,
      contextType: contextData.contextType,
      tenantId: null,
      isActive: true,
      isPrimary: contextData.isPrimary || false,
      displayName: contextData.displayName || null,
      entityType: contextData.entityType || 'individual',
      companyName: contextData.companyName || null,
      enabledFeatures: this.getDefaultFeatures(contextData.contextType),
      featureUsage: {},
      onboardingCompleted: false,
      onboardingStep: 'welcome',
      metadata: {},
    };
  }
}

// Singleton
let _authService: SupabaseAuthService | null = null;

export function getAuthService(): SupabaseAuthService {
  if (!_authService) {
    _authService = new SupabaseAuthService();
  }
  return _authService;
}
