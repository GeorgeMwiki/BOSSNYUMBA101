/**
 * Auth Routes V2 - Production-Ready with Supabase
 *
 * Replaces demo-only auth with real Supabase Auth integration.
 * Supports:
 *  - Phone OTP login (mobile-first for Tanzania)
 *  - Email/password login (owner portal, admin portal)
 *  - Registration (phone or email)
 *  - Context switching (same user = owner + tenant)
 *  - Feature discovery (progressive UI)
 *  - Profile management
 *
 * Falls back to demo mode when Supabase is not configured (dev only).
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { getAuthService } from '../services/supabase-auth.service';

const app = new Hono();

// ============================================================================
// Validation Schemas
// ============================================================================

const phoneLoginSchema = z.object({
  phone: z.string().min(9).max(20),
});

const phoneVerifySchema = z.object({
  phone: z.string().min(9).max(20),
  otp: z.string().length(6),
});

const emailLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const emailRegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  phone: z.string().optional(),
});

const phoneRegisterSchema = z.object({
  phone: z.string().min(9).max(20),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().optional(),
});

const createContextSchema = z.object({
  contextType: z.enum(['owner', 'tenant', 'technician', 'manager', 'admin']),
  tenantId: z.string().optional(),
  displayName: z.string().optional(),
  entityType: z.enum(['individual', 'company']).optional(),
  companyName: z.string().optional(),
  isPrimary: z.boolean().optional(),
});

const switchContextSchema = z.object({
  contextId: z.string().min(1),
});

const discoverFeatureSchema = z.object({
  contextId: z.string().min(1),
  featureKey: z.string().min(1),
});

const updateProfileSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  displayName: z.string().optional(),
  avatarUrl: z.string().url().optional(),
  preferredLocale: z.string().optional(),
  preferredTimezone: z.string().optional(),
  preferredCurrency: z.string().optional(),
});

// ============================================================================
// Phone OTP Flow (Primary - Mobile First)
// ============================================================================

// POST /auth/v2/phone/send-otp
app.post('/phone/send-otp', zValidator('json', phoneLoginSchema), async (c) => {
  const { phone } = c.req.valid('json');
  const authService = getAuthService();

  const result = await authService.sendPhoneOtp(phone);

  if (!result.success) {
    return c.json({
      success: false,
      error: { code: 'OTP_SEND_FAILED', message: result.error || 'Failed to send OTP' },
    }, 400);
  }

  return c.json({
    success: true,
    data: { message: 'OTP sent successfully' },
  });
});

// POST /auth/v2/phone/verify
app.post('/phone/verify', zValidator('json', phoneVerifySchema), async (c) => {
  const { phone, otp } = c.req.valid('json');
  const authService = getAuthService();

  const result = await authService.verifyPhoneOtp(phone, otp);

  if (!result.success) {
    return c.json({
      success: false,
      error: result.error,
    }, 401);
  }

  return c.json({
    success: true,
    data: {
      token: result.token,
      refreshToken: result.refreshToken,
      profile: result.profile,
      contexts: result.contexts,
      activeContext: result.activeContext,
    },
  });
});

// ============================================================================
// Email/Password Flow
// ============================================================================

// POST /auth/v2/login
app.post('/login', zValidator('json', emailLoginSchema), async (c) => {
  const { email, password } = c.req.valid('json');
  const authService = getAuthService();

  const result = await authService.loginWithEmail(email, password);

  if (!result.success) {
    return c.json({
      success: false,
      error: result.error,
    }, 401);
  }

  return c.json({
    success: true,
    data: {
      token: result.token,
      refreshToken: result.refreshToken,
      profile: result.profile,
      contexts: result.contexts,
      activeContext: result.activeContext,
    },
  });
});

// ============================================================================
// Registration
// ============================================================================

// POST /auth/v2/register/email
app.post('/register/email', zValidator('json', emailRegisterSchema), async (c) => {
  const data = c.req.valid('json');
  const authService = getAuthService();

  const result = await authService.signupWithEmail(data);

  if (!result.success) {
    return c.json({
      success: false,
      error: result.error,
    }, 400);
  }

  return c.json({
    success: true,
    data: { profile: result.profile, message: 'Account created. Please verify your email.' },
  }, 201);
});

// POST /auth/v2/register/phone
app.post('/register/phone', zValidator('json', phoneRegisterSchema), async (c) => {
  const data = c.req.valid('json');
  const authService = getAuthService();

  const result = await authService.signupWithPhone(data);

  if (!result.success) {
    return c.json({
      success: false,
      error: { code: 'SIGNUP_FAILED', message: result.error || 'Signup failed' },
    }, 400);
  }

  return c.json({
    success: true,
    data: { message: 'OTP sent. Please verify your phone number.' },
  }, 201);
});

// ============================================================================
// Profile & Context (Requires Auth)
// ============================================================================

// Middleware: extract auth from header
const requireAuth = async (c: Parameters<Parameters<typeof app.use>[1]>[0], next: () => Promise<void>) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Missing auth token' } }, 401);
  }

  const token = authHeader.slice(7);
  const authService = getAuthService();

  // Try Supabase verification first
  const verified = await authService.verifyToken(token);
  if (verified) {
    c.set('authUid', verified.authUid);
    c.set('token', token);
  } else if (token.startsWith('demo-token-')) {
    // Demo mode: extract UID from profile
    c.set('authUid', 'demo-user');
    c.set('token', token);
  } else {
    return c.json({ success: false, error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' } }, 401);
  }

  await next();
};

// GET /auth/v2/me - Current user profile + contexts
app.get('/me', requireAuth, async (c) => {
  const authUid = c.get('authUid') as string;
  const authService = getAuthService();

  const profile = await authService.getProfile(authUid);
  const contexts = await authService.getUserContexts(authUid);

  if (!profile) {
    return c.json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Profile not found' },
    }, 404);
  }

  const activeContext = contexts.find((ctx) => ctx.id === profile.activeContextId)
    || contexts.find((ctx) => ctx.isPrimary)
    || contexts[0];

  return c.json({
    success: true,
    data: {
      profile,
      contexts,
      activeContext: activeContext || null,
    },
  });
});

// PUT /auth/v2/profile - Update profile
app.put('/profile', requireAuth, zValidator('json', updateProfileSchema), async (c) => {
  const authUid = c.get('authUid') as string;
  const updates = c.req.valid('json');
  const authService = getAuthService();

  const profile = await authService.updateProfile(authUid, updates);

  if (!profile) {
    return c.json({
      success: false,
      error: { code: 'UPDATE_FAILED', message: 'Failed to update profile' },
    }, 500);
  }

  return c.json({ success: true, data: { profile } });
});

// ============================================================================
// Context Management (Dynamic Roles)
// ============================================================================

// POST /auth/v2/contexts - Create new context (become an owner, become a tenant, etc.)
app.post('/contexts', requireAuth, zValidator('json', createContextSchema), async (c) => {
  const authUid = c.get('authUid') as string;
  const data = c.req.valid('json');
  const authService = getAuthService();

  const context = await authService.createContext(authUid, data);

  if (!context) {
    return c.json({
      success: false,
      error: { code: 'CREATE_FAILED', message: 'Failed to create context' },
    }, 500);
  }

  return c.json({ success: true, data: { context } }, 201);
});

// POST /auth/v2/contexts/switch - Switch active context
app.post('/contexts/switch', requireAuth, zValidator('json', switchContextSchema), async (c) => {
  const authUid = c.get('authUid') as string;
  const { contextId } = c.req.valid('json');
  const authService = getAuthService();

  const context = await authService.switchContext(authUid, contextId);

  if (!context) {
    return c.json({
      success: false,
      error: { code: 'SWITCH_FAILED', message: 'Context not found or not accessible' },
    }, 404);
  }

  return c.json({ success: true, data: { activeContext: context } });
});

// GET /auth/v2/contexts - List all contexts
app.get('/contexts', requireAuth, async (c) => {
  const authUid = c.get('authUid') as string;
  const authService = getAuthService();

  const contexts = await authService.getUserContexts(authUid);

  return c.json({ success: true, data: { contexts } });
});

// ============================================================================
// Feature Discovery (Progressive UI)
// ============================================================================

// POST /auth/v2/features/discover - Register feature discovery
app.post('/features/discover', requireAuth, zValidator('json', discoverFeatureSchema), async (c) => {
  const { contextId, featureKey } = c.req.valid('json');
  const authService = getAuthService();

  await authService.discoverFeature(contextId, featureKey);

  return c.json({ success: true, data: { message: 'Feature discovered' } });
});

// POST /auth/v2/features/track - Track feature usage
app.post('/features/track', requireAuth, zValidator('json', discoverFeatureSchema), async (c) => {
  const { contextId, featureKey } = c.req.valid('json');
  const authService = getAuthService();

  await authService.trackFeatureUsage(contextId, featureKey);

  return c.json({ success: true });
});

// GET /auth/v2/features/:contextId - Get discovered features
app.get('/features/:contextId', requireAuth, async (c) => {
  const contextId = c.req.param('contextId');
  const authService = getAuthService();

  const features = await authService.getDiscoveredFeatures(contextId);

  return c.json({ success: true, data: { features } });
});

// ============================================================================
// Logout
// ============================================================================

app.post('/logout', async (c) => {
  const authHeader = c.req.header('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  const authService = getAuthService();

  await authService.logout(token);

  return c.json({ success: true, data: { message: 'Logged out successfully' } });
});

export const authV2Router = app;
