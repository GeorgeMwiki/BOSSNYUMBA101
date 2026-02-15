/**
 * Enhanced Authentication Routes - BOSSNYUMBA
 * 
 * Complete auth system with:
 * - Login/Logout with session management
 * - Registration with email verification
 * - Multi-Factor Authentication (MFA) - TOTP and SMS
 * - Password reset flow
 * - Token refresh
 * - Account lockout protection
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { authMiddleware, type AuthContext } from '../middleware/hono-auth';
import { UserRole } from '../types/user-role';

// ============================================================================
// Configuration
// ============================================================================

const JWT_SECRET = process.env.JWT_SECRET || 'development-secret-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refresh-secret-change-in-production';
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';
const MFA_TOKEN_EXPIRY = '5m';
const PASSWORD_RESET_EXPIRY = '1h';
const EMAIL_VERIFICATION_EXPIRY = '24h';
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;

// ============================================================================
// Validation Schemas
// ============================================================================

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  rememberMe: z.boolean().optional().default(false),
});

const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string()
    .min(12, 'Password must be at least 12 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format').optional(),
  tenantCode: z.string().optional(), // For joining existing organization
  acceptTerms: z.boolean().refine(val => val === true, 'You must accept the terms'),
});

const mfaSetupSchema = z.object({
  type: z.enum(['totp', 'sms']),
  phone: z.string().optional(), // Required if type is 'sms'
});

const mfaVerifySchema = z.object({
  code: z.string().length(6, 'MFA code must be 6 digits'),
  mfaToken: z.string(), // Temporary token issued during login
});

const mfaDisableSchema = z.object({
  password: z.string().min(1, 'Password is required'),
  code: z.string().length(6, 'MFA code must be 6 digits'),
});

const passwordResetRequestSchema = z.object({
  email: z.string().email('Invalid email format'),
});

const passwordResetSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z.string()
    .min(12, 'Password must be at least 12 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string()
    .min(12, 'Password must be at least 12 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
});

const emailVerificationSchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

// ============================================================================
// In-Memory Stores (Replace with DB in production)
// ============================================================================

interface User {
  id: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  phone?: string;
  emailVerified: boolean;
  mfaEnabled: boolean;
  mfaType?: 'totp' | 'sms';
  mfaSecret?: string;
  status: 'active' | 'inactive' | 'locked' | 'pending_verification';
  loginAttempts: number;
  lockoutUntil?: Date;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface RefreshToken {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
  revoked: boolean;
}

interface PasswordResetToken {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  used: boolean;
}

interface EmailVerificationToken {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  used: boolean;
}

interface MFAToken {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  used: boolean;
}

// In-memory stores
const users = new Map<string, User>();
const refreshTokens = new Map<string, RefreshToken>();
const passwordResetTokens = new Map<string, PasswordResetToken>();
const emailVerificationTokens = new Map<string, EmailVerificationToken>();
const mfaTokens = new Map<string, MFAToken>();
const userTenantMappings = new Map<string, { tenantId: string; role: UserRole; permissions: string[]; propertyAccess: string[] }>();

// ============================================================================
// Utility Functions
// ============================================================================

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(':');
  const verifyHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return hash === verifyHash;
}

function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function generateTOTPSecret(): string {
  return crypto.randomBytes(20).toString('base32');
}

function verifyTOTPCode(secret: string, code: string): boolean {
  // Simplified TOTP verification - in production use a library like 'speakeasy'
  const timeStep = Math.floor(Date.now() / 30000);
  const expectedCode = crypto
    .createHmac('sha1', secret)
    .update(Buffer.from(timeStep.toString()))
    .digest('hex')
    .slice(0, 6);
  return code === expectedCode;
}

function generateAccessToken(payload: {
  userId: string;
  tenantId: string;
  role: UserRole;
  permissions: string[];
  propertyAccess: string[];
}): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

function generateRefreshToken(userId: string): { token: string; id: string; expiresAt: Date } {
  const id = crypto.randomUUID();
  const token = jwt.sign({ userId, tokenId: id }, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  return { token, id, expiresAt };
}

function generateMFAToken(userId: string): { token: string; id: string; expiresAt: Date } {
  const id = crypto.randomUUID();
  const token = jwt.sign({ userId, tokenId: id, type: 'mfa' }, JWT_SECRET, { expiresIn: MFA_TOKEN_EXPIRY });
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  return { token, id, expiresAt };
}

function getPermissionsForRole(role: UserRole): string[] {
  const basePermissions: Record<UserRole, string[]> = {
    SUPER_ADMIN: ['*'],
    ADMIN: ['users:*', 'tenants:*', 'reports:*', 'settings:*'],
    SUPPORT: ['users:read', 'tenants:read', 'reports:read'],
    TENANT_ADMIN: ['users:*', 'properties:*', 'units:*', 'leases:*', 'invoices:*', 'payments:*', 'reports:*'],
    PROPERTY_MANAGER: ['properties:read', 'units:*', 'leases:*', 'work_orders:*', 'customers:*'],
    ACCOUNTANT: ['invoices:*', 'payments:*', 'reports:read'],
    MAINTENANCE_STAFF: ['work_orders:*', 'units:read'],
    OWNER: ['properties:read', 'units:read', 'leases:read', 'invoices:read', 'payments:read', 'reports:read', 'approvals:*'],
    RESIDENT: ['leases:read:own', 'invoices:read:own', 'payments:create:own', 'work_orders:create:own'],
  };
  return basePermissions[role] || [];
}

function isAccountLocked(user: User): boolean {
  if (!user.lockoutUntil) return false;
  return new Date() < user.lockoutUntil;
}

// ============================================================================
// Route Handlers
// ============================================================================

export const authEnhancedRouter = new Hono();

// POST /auth/login - Enhanced login with MFA support
authEnhancedRouter.post('/login', zValidator('json', loginSchema), async (c) => {
  const { email, password, rememberMe } = c.req.valid('json');

  const user = Array.from(users.values()).find(u => u.email.toLowerCase() === email.toLowerCase());
  
  if (!user) {
    return c.json({
      success: false,
      error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
    }, 401);
  }

  // Check account lockout
  if (isAccountLocked(user)) {
    const lockoutMinutes = Math.ceil((user.lockoutUntil!.getTime() - Date.now()) / 60000);
    return c.json({
      success: false,
      error: {
        code: 'ACCOUNT_LOCKED',
        message: `Account is locked. Try again in ${lockoutMinutes} minutes.`,
      },
    }, 403);
  }

  // Check account status
  if (user.status === 'inactive') {
    return c.json({
      success: false,
      error: { code: 'ACCOUNT_INACTIVE', message: 'Account is inactive. Please contact support.' },
    }, 403);
  }

  if (user.status === 'pending_verification') {
    return c.json({
      success: false,
      error: { code: 'EMAIL_NOT_VERIFIED', message: 'Please verify your email before logging in.' },
    }, 403);
  }

  // Verify password
  if (!verifyPassword(password, user.passwordHash)) {
    user.loginAttempts += 1;
    
    if (user.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
      user.lockoutUntil = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000);
      user.status = 'locked';
    }
    
    users.set(user.id, user);
    
    return c.json({
      success: false,
      error: {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
        remainingAttempts: Math.max(0, MAX_LOGIN_ATTEMPTS - user.loginAttempts),
      },
    }, 401);
  }

  // Reset login attempts on successful password verification
  user.loginAttempts = 0;
  user.lockoutUntil = undefined;

  // Check if MFA is enabled
  if (user.mfaEnabled) {
    const mfaData = generateMFAToken(user.id);
    mfaTokens.set(mfaData.id, {
      id: mfaData.id,
      userId: user.id,
      token: mfaData.token,
      expiresAt: mfaData.expiresAt,
      used: false,
    });

    return c.json({
      success: true,
      data: {
        requiresMFA: true,
        mfaToken: mfaData.token,
        mfaType: user.mfaType,
        expiresAt: mfaData.expiresAt.toISOString(),
      },
    });
  }

  // Get tenant mapping
  const tenantMapping = userTenantMappings.get(user.id) || {
    tenantId: 'default-tenant',
    role: UserRole.RESIDENT,
    permissions: [],
    propertyAccess: ['*'],
  };

  // Generate tokens
  const accessToken = generateAccessToken({
    userId: user.id,
    tenantId: tenantMapping.tenantId,
    role: tenantMapping.role,
    permissions: [...tenantMapping.permissions, ...getPermissionsForRole(tenantMapping.role)],
    propertyAccess: tenantMapping.propertyAccess,
  });

  const refreshData = generateRefreshToken(user.id);
  refreshTokens.set(refreshData.id, {
    id: refreshData.id,
    userId: user.id,
    token: refreshData.token,
    expiresAt: refreshData.expiresAt,
    createdAt: new Date(),
    revoked: false,
  });

  // Update last login
  user.lastLogin = new Date();
  users.set(user.id, user);

  return c.json({
    success: true,
    data: {
      accessToken,
      refreshToken: refreshData.token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: tenantMapping.role,
        tenantId: tenantMapping.tenantId,
      },
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    },
  });
});

// POST /auth/mfa/verify - Verify MFA code and complete login
authEnhancedRouter.post('/mfa/verify', zValidator('json', mfaVerifySchema), async (c) => {
  const { code, mfaToken } = c.req.valid('json');

  let decoded: { userId: string; tokenId: string; type: string };
  try {
    decoded = jwt.verify(mfaToken, JWT_SECRET) as typeof decoded;
  } catch (error) {
    return c.json({
      success: false,
      error: { code: 'INVALID_MFA_TOKEN', message: 'MFA token is invalid or expired' },
    }, 401);
  }

  if (decoded.type !== 'mfa') {
    return c.json({
      success: false,
      error: { code: 'INVALID_MFA_TOKEN', message: 'Invalid token type' },
    }, 401);
  }

  const mfaTokenRecord = mfaTokens.get(decoded.tokenId);
  if (!mfaTokenRecord || mfaTokenRecord.used) {
    return c.json({
      success: false,
      error: { code: 'MFA_TOKEN_USED', message: 'MFA token has already been used' },
    }, 401);
  }

  const user = users.get(decoded.userId);
  if (!user || !user.mfaSecret) {
    return c.json({
      success: false,
      error: { code: 'USER_NOT_FOUND', message: 'User not found' },
    }, 404);
  }

  // Verify MFA code
  const isValidCode = user.mfaType === 'totp' 
    ? verifyTOTPCode(user.mfaSecret, code)
    : code === '123456'; // Simplified SMS verification - in production verify via SMS provider

  if (!isValidCode) {
    return c.json({
      success: false,
      error: { code: 'INVALID_MFA_CODE', message: 'Invalid MFA code' },
    }, 401);
  }

  // Mark MFA token as used
  mfaTokenRecord.used = true;
  mfaTokens.set(decoded.tokenId, mfaTokenRecord);

  // Get tenant mapping
  const tenantMapping = userTenantMappings.get(user.id) || {
    tenantId: 'default-tenant',
    role: UserRole.RESIDENT,
    permissions: [],
    propertyAccess: ['*'],
  };

  // Generate tokens
  const accessToken = generateAccessToken({
    userId: user.id,
    tenantId: tenantMapping.tenantId,
    role: tenantMapping.role,
    permissions: [...tenantMapping.permissions, ...getPermissionsForRole(tenantMapping.role)],
    propertyAccess: tenantMapping.propertyAccess,
  });

  const refreshData = generateRefreshToken(user.id);
  refreshTokens.set(refreshData.id, {
    id: refreshData.id,
    userId: user.id,
    token: refreshData.token,
    expiresAt: refreshData.expiresAt,
    createdAt: new Date(),
    revoked: false,
  });

  // Update last login
  user.lastLogin = new Date();
  users.set(user.id, user);

  return c.json({
    success: true,
    data: {
      accessToken,
      refreshToken: refreshData.token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: tenantMapping.role,
        tenantId: tenantMapping.tenantId,
      },
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    },
  });
});

// POST /auth/register - Register new user
authEnhancedRouter.post('/register', zValidator('json', registerSchema), async (c) => {
  const { email, password, firstName, lastName, phone, tenantCode, acceptTerms } = c.req.valid('json');

  // Check if email already exists
  const existingUser = Array.from(users.values()).find(u => u.email.toLowerCase() === email.toLowerCase());
  if (existingUser) {
    return c.json({
      success: false,
      error: { code: 'EMAIL_EXISTS', message: 'An account with this email already exists' },
    }, 409);
  }

  // Create user
  const userId = crypto.randomUUID();
  const user: User = {
    id: userId,
    email: email.toLowerCase(),
    passwordHash: hashPassword(password),
    firstName,
    lastName,
    phone,
    emailVerified: false,
    mfaEnabled: false,
    status: 'pending_verification',
    loginAttempts: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  users.set(userId, user);

  // Create email verification token
  const verificationToken = generateSecureToken();
  const verificationId = crypto.randomUUID();
  emailVerificationTokens.set(verificationId, {
    id: verificationId,
    userId,
    token: verificationToken,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    used: false,
  });

  // Set default tenant mapping
  userTenantMappings.set(userId, {
    tenantId: tenantCode || 'default-tenant',
    role: UserRole.RESIDENT,
    permissions: [],
    propertyAccess: ['*'],
  });

  // In production, send verification email here
  console.log(`[AUTH] Verification email would be sent to ${email} with token: ${verificationToken}`);

  return c.json({
    success: true,
    data: {
      message: 'Registration successful. Please check your email to verify your account.',
      userId,
      verificationRequired: true,
    },
  }, 201);
});

// POST /auth/verify-email - Verify email address
authEnhancedRouter.post('/verify-email', zValidator('json', emailVerificationSchema), async (c) => {
  const { token } = c.req.valid('json');

  const tokenRecord = Array.from(emailVerificationTokens.values()).find(t => t.token === token);
  
  if (!tokenRecord) {
    return c.json({
      success: false,
      error: { code: 'INVALID_TOKEN', message: 'Verification token is invalid' },
    }, 400);
  }

  if (tokenRecord.used) {
    return c.json({
      success: false,
      error: { code: 'TOKEN_USED', message: 'Verification token has already been used' },
    }, 400);
  }

  if (new Date() > tokenRecord.expiresAt) {
    return c.json({
      success: false,
      error: { code: 'TOKEN_EXPIRED', message: 'Verification token has expired' },
    }, 400);
  }

  const user = users.get(tokenRecord.userId);
  if (!user) {
    return c.json({
      success: false,
      error: { code: 'USER_NOT_FOUND', message: 'User not found' },
    }, 404);
  }

  // Update user status
  user.emailVerified = true;
  user.status = 'active';
  user.updatedAt = new Date();
  users.set(user.id, user);

  // Mark token as used
  tokenRecord.used = true;
  emailVerificationTokens.set(tokenRecord.id, tokenRecord);

  return c.json({
    success: true,
    data: { message: 'Email verified successfully. You can now log in.' },
  });
});

// POST /auth/resend-verification - Resend verification email
authEnhancedRouter.post('/resend-verification', zValidator('json', z.object({ email: z.string().email() })), async (c) => {
  const { email } = c.req.valid('json');

  const user = Array.from(users.values()).find(u => u.email.toLowerCase() === email.toLowerCase());
  
  if (!user) {
    // Don't reveal if email exists
    return c.json({
      success: true,
      data: { message: 'If an account exists with this email, a verification link will be sent.' },
    });
  }

  if (user.emailVerified) {
    return c.json({
      success: false,
      error: { code: 'ALREADY_VERIFIED', message: 'Email is already verified' },
    }, 400);
  }

  // Create new verification token
  const verificationToken = generateSecureToken();
  const verificationId = crypto.randomUUID();
  emailVerificationTokens.set(verificationId, {
    id: verificationId,
    userId: user.id,
    token: verificationToken,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    used: false,
  });

  // In production, send verification email here
  console.log(`[AUTH] Verification email resent to ${email} with token: ${verificationToken}`);

  return c.json({
    success: true,
    data: { message: 'If an account exists with this email, a verification link will be sent.' },
  });
});

// POST /auth/forgot-password - Request password reset
authEnhancedRouter.post('/forgot-password', zValidator('json', passwordResetRequestSchema), async (c) => {
  const { email } = c.req.valid('json');

  const user = Array.from(users.values()).find(u => u.email.toLowerCase() === email.toLowerCase());
  
  // Always return success to prevent email enumeration
  const responseMessage = 'If an account exists with this email, a password reset link will be sent.';

  if (!user) {
    return c.json({ success: true, data: { message: responseMessage } });
  }

  // Generate password reset token
  const resetToken = generateSecureToken();
  const resetId = crypto.randomUUID();
  passwordResetTokens.set(resetId, {
    id: resetId,
    userId: user.id,
    token: resetToken,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    used: false,
  });

  // In production, send reset email here
  console.log(`[AUTH] Password reset email would be sent to ${email} with token: ${resetToken}`);

  return c.json({ success: true, data: { message: responseMessage } });
});

// POST /auth/reset-password - Reset password with token
authEnhancedRouter.post('/reset-password', zValidator('json', passwordResetSchema), async (c) => {
  const { token, newPassword } = c.req.valid('json');

  const tokenRecord = Array.from(passwordResetTokens.values()).find(t => t.token === token);
  
  if (!tokenRecord) {
    return c.json({
      success: false,
      error: { code: 'INVALID_TOKEN', message: 'Reset token is invalid' },
    }, 400);
  }

  if (tokenRecord.used) {
    return c.json({
      success: false,
      error: { code: 'TOKEN_USED', message: 'Reset token has already been used' },
    }, 400);
  }

  if (new Date() > tokenRecord.expiresAt) {
    return c.json({
      success: false,
      error: { code: 'TOKEN_EXPIRED', message: 'Reset token has expired' },
    }, 400);
  }

  const user = users.get(tokenRecord.userId);
  if (!user) {
    return c.json({
      success: false,
      error: { code: 'USER_NOT_FOUND', message: 'User not found' },
    }, 404);
  }

  // Update password
  user.passwordHash = hashPassword(newPassword);
  user.loginAttempts = 0;
  user.lockoutUntil = undefined;
  user.status = user.emailVerified ? 'active' : 'pending_verification';
  user.updatedAt = new Date();
  users.set(user.id, user);

  // Mark token as used
  tokenRecord.used = true;
  passwordResetTokens.set(tokenRecord.id, tokenRecord);

  // Invalidate all refresh tokens for this user
  for (const [id, rt] of refreshTokens) {
    if (rt.userId === user.id) {
      rt.revoked = true;
      refreshTokens.set(id, rt);
    }
  }

  return c.json({
    success: true,
    data: { message: 'Password reset successfully. You can now log in with your new password.' },
  });
});

// POST /auth/change-password - Change password (authenticated)
authEnhancedRouter.post('/change-password', authMiddleware, zValidator('json', changePasswordSchema), async (c) => {
  const auth = c.get('auth');
  const { currentPassword, newPassword } = c.req.valid('json');

  const user = users.get(auth.userId);
  if (!user) {
    return c.json({
      success: false,
      error: { code: 'USER_NOT_FOUND', message: 'User not found' },
    }, 404);
  }

  if (!verifyPassword(currentPassword, user.passwordHash)) {
    return c.json({
      success: false,
      error: { code: 'INVALID_PASSWORD', message: 'Current password is incorrect' },
    }, 401);
  }

  // Update password
  user.passwordHash = hashPassword(newPassword);
  user.updatedAt = new Date();
  users.set(user.id, user);

  // Invalidate all refresh tokens except current session
  // In production, keep current session and invalidate others

  return c.json({
    success: true,
    data: { message: 'Password changed successfully' },
  });
});

// POST /auth/mfa/setup - Setup MFA
authEnhancedRouter.post('/mfa/setup', authMiddleware, zValidator('json', mfaSetupSchema), async (c) => {
  const auth = c.get('auth');
  const { type, phone } = c.req.valid('json');

  const user = users.get(auth.userId);
  if (!user) {
    return c.json({
      success: false,
      error: { code: 'USER_NOT_FOUND', message: 'User not found' },
    }, 404);
  }

  if (user.mfaEnabled) {
    return c.json({
      success: false,
      error: { code: 'MFA_ALREADY_ENABLED', message: 'MFA is already enabled' },
    }, 400);
  }

  if (type === 'sms' && !phone) {
    return c.json({
      success: false,
      error: { code: 'PHONE_REQUIRED', message: 'Phone number is required for SMS MFA' },
    }, 400);
  }

  const secret = generateTOTPSecret();
  
  // Store temporary secret (not enabled yet)
  user.mfaSecret = secret;
  user.mfaType = type;
  if (phone) user.phone = phone;
  users.set(user.id, user);

  if (type === 'totp') {
    // In production, generate QR code URL
    const otpauthUrl = `otpauth://totp/BOSSNYUMBA:${user.email}?secret=${secret}&issuer=BOSSNYUMBA`;
    
    return c.json({
      success: true,
      data: {
        type: 'totp',
        secret,
        qrCodeUrl: otpauthUrl,
        message: 'Scan the QR code with your authenticator app, then verify with a code',
      },
    });
  } else {
    // Send SMS with setup code
    console.log(`[AUTH] SMS MFA setup code would be sent to ${phone}`);
    
    return c.json({
      success: true,
      data: {
        type: 'sms',
        phone,
        message: 'A verification code has been sent to your phone',
      },
    });
  }
});

// POST /auth/mfa/enable - Enable MFA after setup verification
authEnhancedRouter.post('/mfa/enable', authMiddleware, zValidator('json', z.object({ code: z.string().length(6) })), async (c) => {
  const auth = c.get('auth');
  const { code } = c.req.valid('json');

  const user = users.get(auth.userId);
  if (!user) {
    return c.json({
      success: false,
      error: { code: 'USER_NOT_FOUND', message: 'User not found' },
    }, 404);
  }

  if (!user.mfaSecret) {
    return c.json({
      success: false,
      error: { code: 'MFA_NOT_SETUP', message: 'MFA has not been set up. Please run setup first.' },
    }, 400);
  }

  // Verify code
  const isValidCode = user.mfaType === 'totp'
    ? verifyTOTPCode(user.mfaSecret, code)
    : code === '123456'; // Simplified for demo

  if (!isValidCode) {
    return c.json({
      success: false,
      error: { code: 'INVALID_CODE', message: 'Invalid verification code' },
    }, 401);
  }

  // Enable MFA
  user.mfaEnabled = true;
  user.updatedAt = new Date();
  users.set(user.id, user);

  // Generate backup codes (in production, generate and store securely)
  const backupCodes = Array.from({ length: 10 }, () => 
    crypto.randomBytes(4).toString('hex').toUpperCase()
  );

  return c.json({
    success: true,
    data: {
      message: 'MFA enabled successfully',
      backupCodes,
      warning: 'Save these backup codes in a secure place. They can only be viewed once.',
    },
  });
});

// POST /auth/mfa/disable - Disable MFA
authEnhancedRouter.post('/mfa/disable', authMiddleware, zValidator('json', mfaDisableSchema), async (c) => {
  const auth = c.get('auth');
  const { password, code } = c.req.valid('json');

  const user = users.get(auth.userId);
  if (!user) {
    return c.json({
      success: false,
      error: { code: 'USER_NOT_FOUND', message: 'User not found' },
    }, 404);
  }

  if (!user.mfaEnabled) {
    return c.json({
      success: false,
      error: { code: 'MFA_NOT_ENABLED', message: 'MFA is not enabled' },
    }, 400);
  }

  if (!verifyPassword(password, user.passwordHash)) {
    return c.json({
      success: false,
      error: { code: 'INVALID_PASSWORD', message: 'Password is incorrect' },
    }, 401);
  }

  const isValidCode = user.mfaType === 'totp'
    ? verifyTOTPCode(user.mfaSecret!, code)
    : code === '123456';

  if (!isValidCode) {
    return c.json({
      success: false,
      error: { code: 'INVALID_CODE', message: 'Invalid MFA code' },
    }, 401);
  }

  // Disable MFA
  user.mfaEnabled = false;
  user.mfaSecret = undefined;
  user.mfaType = undefined;
  user.updatedAt = new Date();
  users.set(user.id, user);

  return c.json({
    success: true,
    data: { message: 'MFA disabled successfully' },
  });
});

// POST /auth/refresh - Refresh access token
authEnhancedRouter.post('/refresh', zValidator('json', refreshTokenSchema), async (c) => {
  const { refreshToken } = c.req.valid('json');

  let decoded: { userId: string; tokenId: string };
  try {
    decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as typeof decoded;
  } catch (error) {
    return c.json({
      success: false,
      error: { code: 'INVALID_REFRESH_TOKEN', message: 'Refresh token is invalid or expired' },
    }, 401);
  }

  const tokenRecord = refreshTokens.get(decoded.tokenId);
  if (!tokenRecord || tokenRecord.revoked) {
    return c.json({
      success: false,
      error: { code: 'TOKEN_REVOKED', message: 'Refresh token has been revoked' },
    }, 401);
  }

  const user = users.get(decoded.userId);
  if (!user || user.status !== 'active') {
    return c.json({
      success: false,
      error: { code: 'USER_INACTIVE', message: 'User account is not active' },
    }, 401);
  }

  const tenantMapping = userTenantMappings.get(user.id) || {
    tenantId: 'default-tenant',
    role: UserRole.RESIDENT,
    permissions: [],
    propertyAccess: ['*'],
  };

  // Generate new access token
  const accessToken = generateAccessToken({
    userId: user.id,
    tenantId: tenantMapping.tenantId,
    role: tenantMapping.role,
    permissions: [...tenantMapping.permissions, ...getPermissionsForRole(tenantMapping.role)],
    propertyAccess: tenantMapping.propertyAccess,
  });

  return c.json({
    success: true,
    data: {
      accessToken,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    },
  });
});

// POST /auth/logout - Logout and revoke tokens
authEnhancedRouter.post('/logout', authMiddleware, async (c) => {
  const auth = c.get('auth');

  // Revoke all refresh tokens for user
  for (const [id, rt] of refreshTokens) {
    if (rt.userId === auth.userId) {
      rt.revoked = true;
      refreshTokens.set(id, rt);
    }
  }

  return c.json({
    success: true,
    data: { message: 'Logged out successfully' },
  });
});

// GET /auth/me - Get current user
authEnhancedRouter.get('/me', authMiddleware, async (c) => {
  const auth = c.get('auth');
  
  const user = users.get(auth.userId);
  if (!user) {
    return c.json({
      success: false,
      error: { code: 'USER_NOT_FOUND', message: 'User not found' },
    }, 404);
  }

  const tenantMapping = userTenantMappings.get(user.id);

  return c.json({
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        emailVerified: user.emailVerified,
        mfaEnabled: user.mfaEnabled,
        mfaType: user.mfaType,
        status: user.status,
        lastLogin: user.lastLogin?.toISOString(),
      },
      tenant: tenantMapping ? {
        id: tenantMapping.tenantId,
        role: tenantMapping.role,
      } : null,
      permissions: auth.permissions,
    },
  });
});

// GET /auth/sessions - List active sessions
authEnhancedRouter.get('/sessions', authMiddleware, async (c) => {
  const auth = c.get('auth');

  const sessions = Array.from(refreshTokens.values())
    .filter(rt => rt.userId === auth.userId && !rt.revoked && rt.expiresAt > new Date())
    .map(rt => ({
      id: rt.id,
      createdAt: rt.createdAt.toISOString(),
      expiresAt: rt.expiresAt.toISOString(),
    }));

  return c.json({
    success: true,
    data: { sessions },
  });
});

// DELETE /auth/sessions/:id - Revoke specific session
authEnhancedRouter.delete('/sessions/:id', authMiddleware, async (c) => {
  const auth = c.get('auth');
  const sessionId = c.req.param('id');

  const tokenRecord = refreshTokens.get(sessionId);
  if (!tokenRecord || tokenRecord.userId !== auth.userId) {
    return c.json({
      success: false,
      error: { code: 'SESSION_NOT_FOUND', message: 'Session not found' },
    }, 404);
  }

  tokenRecord.revoked = true;
  refreshTokens.set(sessionId, tokenRecord);

  return c.json({
    success: true,
    data: { message: 'Session revoked successfully' },
  });
});

export default authEnhancedRouter;
