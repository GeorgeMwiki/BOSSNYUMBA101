/**
 * Authentication fixtures and helpers for BOSSNYUMBA E2E tests.
 * Provides reusable authentication flows for all portals.
 */

import { test as base, type Page, type BrowserContext } from '@playwright/test';
import { testUsers } from './test-data';

// ============================================================================
// TYPES
// ============================================================================

export interface AuthState {
  cookies: { name: string; value: string; domain: string; path: string }[];
  localStorage: { name: string; value: string }[];
}

export type UserRole = 'superAdmin' | 'admin' | 'owner' | 'manager' | 'customer' | 'technician';

export interface AuthFixtures {
  ownerPage: Page;
  authenticatedContext: BrowserContext;
}

// ============================================================================
// AUTHENTICATION HELPERS
// ============================================================================

/**
 * Login to Owner Portal with email/password.
 */
export async function loginAsOwner(page: Page): Promise<void> {
  await page.goto('/login');
  await page.waitForLoadState('domcontentloaded');
  
  await page.getByLabel(/email/i).fill(testUsers.owner.email);
  await page.getByLabel(/password/i).fill(testUsers.owner.password);
  await page.getByRole('button', { name: /sign in|login/i }).click();
  
  // Wait for redirect to dashboard
  await page.waitForURL(/\/(dashboard|home|overview)/i, { timeout: 15000 });
}

/**
 * Complete MFA setup flow.
 */
export async function completeMfaSetup(page: Page): Promise<void> {
  // Check if MFA setup is required
  const mfaSetup = page.getByText(/set up.*mfa|two-factor|2fa/i);
  if (await mfaSetup.isVisible({ timeout: 2000 })) {
    // Click setup button
    await page.getByRole('button', { name: /set up|enable|continue/i }).click();
    
    // Wait for QR code or setup instructions
    await page.getByText(/scan.*qr|authenticator/i).waitFor({ timeout: 5000 });
    
    // Enter verification code (test environment should have a mock)
    const codeInput = page.getByLabel(/code|verification/i);
    await codeInput.fill('123456');
    await page.getByRole('button', { name: /verify|confirm/i }).click();
    
    // Wait for success
    await page.getByText(/mfa.*enabled|setup complete/i).waitFor({ timeout: 5000 });
  }
}

/**
 * Logout from any portal.
 */
export async function logout(page: Page): Promise<void> {
  // Try user menu first
  const userMenu = page.getByRole('button', { name: /profile|account|menu/i });
  if (await userMenu.isVisible({ timeout: 1000 })) {
    await userMenu.click();
    await page.getByRole('menuitem', { name: /logout|sign out/i }).click();
  } else {
    // Try direct logout link/button
    await page.getByRole('link', { name: /logout|sign out/i }).or(
      page.getByRole('button', { name: /logout|sign out/i })
    ).click();
  }
  
  await page.waitForURL(/\/login/i, { timeout: 10000 });
}

/**
 * Check if user is currently authenticated.
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  // Check for common authenticated indicators
  const dashboardLink = page.getByRole('link', { name: /dashboard/i });
  const profileButton = page.getByRole('button', { name: /profile|account/i });
  const logoutButton = page.getByRole('button', { name: /logout|sign out/i });
  
  return (
    await dashboardLink.isVisible({ timeout: 1000 }) ||
    await profileButton.isVisible({ timeout: 1000 }) ||
    await logoutButton.isVisible({ timeout: 1000 })
  );
}

/**
 * Wait for session to be established after login.
 */
export async function waitForSession(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  
  // Wait for auth token to be set
  await page.waitForFunction(() => {
    return (
      localStorage.getItem('token') !== null ||
      localStorage.getItem('auth') !== null ||
      document.cookie.includes('session') ||
      document.cookie.includes('token')
    );
  }, { timeout: 10000 });
}

/**
 * Get current user session info.
 */
export async function getSessionInfo(page: Page): Promise<Record<string, unknown> | null> {
  return await page.evaluate(() => {
    const token = localStorage.getItem('token');
    const auth = localStorage.getItem('auth');
    const user = localStorage.getItem('user');
    
    if (auth) {
      try {
        return JSON.parse(auth);
      } catch {
        return null;
      }
    }
    
    if (user) {
      try {
        return JSON.parse(user);
      } catch {
        return null;
      }
    }
    
    return token ? { token } : null;
  });
}

// ============================================================================
// TEST FIXTURES
// ============================================================================

/**
 * Extended test fixture with pre-authenticated pages for each role.
 */
export const test = base.extend<AuthFixtures>({
  ownerPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    
    // Set base URL for owner portal
    await page.goto(process.env.OWNER_PORTAL_URL ?? 'http://localhost:3000');
    await loginAsOwner(page);
    
    await use(page);

    await context.close();
  },

  authenticatedContext: async ({ browser }, use) => {
    const context = await browser.newContext();
    await use(context);
    await context.close();
  },
});

export { expect } from '@playwright/test';
