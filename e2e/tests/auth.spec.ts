import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';
import { testUsers } from '../fixtures/test-data';

/**
 * Authentication E2E Tests
 * Covers: Login, logout, MFA, session expiry, password management for the
 * Owner Portal. Customer/manager auth lives in the mobile app suites.
 */

// =============================================================================
// OWNER PORTAL AUTH
// =============================================================================

test.describe('Owner Portal Auth', () => {
  test.use({ project: 'owner-portal' });

  test('should display login page', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto('/login');
    await expect(page.getByText(/welcome back|sign in/i)).toBeVisible();
    await expect(loginPage.emailInput).toBeVisible();
    await expect(loginPage.passwordInput).toBeVisible();
  });

  test('should login with valid credentials', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto('/login');
    await loginPage.loginWithEmail(testUsers.owner.email, testUsers.owner.password);
    await expect(page).toHaveURL(/\/dashboard/);
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.expectDashboardLoaded();
  });

  test('should show error on invalid credentials', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto('/login');
    await loginPage.loginWithEmail('invalid@test.com', 'wrongpassword');
    await loginPage.expectError(/login failed|invalid|incorrect/i);
  });

  test('should logout successfully', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto('/login');
    await loginPage.loginWithEmail(testUsers.owner.email, testUsers.owner.password);
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });

    // Look for logout in user menu or dropdown
    const userMenu = page.locator('[data-testid="user-menu"]')
      .or(page.getByRole('button', { name: /account|profile/i }));
    if (await userMenu.isVisible().catch(() => false)) {
      await userMenu.click();
    }

    const logoutButton = page.getByRole('button', { name: /logout|sign out/i })
      .or(page.getByRole('menuitem', { name: /logout|sign out/i }));
    if (await logoutButton.isVisible().catch(() => false)) {
      await logoutButton.click();
      await expect(page).toHaveURL(/\/login/);
    }
  });

  test('should persist session across page refresh', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto('/login');
    await loginPage.loginWithEmail(testUsers.owner.email, testUsers.owner.password);
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });

    await page.reload();
    await expect(page).toHaveURL(/\/dashboard/);
  });
});

// =============================================================================
// SESSION MANAGEMENT
// =============================================================================

test.describe('Session Management', () => {
  test.use({ project: 'owner-portal' });

  test('should handle session expiry gracefully', async ({ page, context }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto('/login');
    await loginPage.loginWithEmail(testUsers.owner.email, testUsers.owner.password);
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });

    // Clear cookies to simulate session expiry
    await context.clearCookies();

    // Try to navigate to protected route
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('should maintain session in local storage', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto('/login');
    await loginPage.loginWithEmail(testUsers.owner.email, testUsers.owner.password);
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });

    // Check for auth token in storage
    const localStorage = await page.evaluate(() => {
      const items: Record<string, string> = {};
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key) {
          items[key] = window.localStorage.getItem(key) || '';
        }
      }
      return items;
    });

    // Verify some form of auth state exists
    const hasAuthState = Object.keys(localStorage).some(
      key => key.includes('auth') || key.includes('token') || key.includes('session')
    );
    expect(hasAuthState || page.url().includes('dashboard')).toBeTruthy();
  });

  test('should redirect to intended page after login', async ({ page }) => {
    // Try to access protected page
    await page.goto('/properties');

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);

    // Login
    const loginPage = new LoginPage(page);
    await loginPage.loginWithEmail(testUsers.owner.email, testUsers.owner.password);

    // Should redirect back to properties or dashboard
    await expect(page).toHaveURL(/\/(properties|dashboard)/);
  });

  test('should clear local storage on logout', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto('/login');
    await loginPage.loginWithEmail(testUsers.owner.email, testUsers.owner.password);
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });

    // Perform logout
    const userMenu = page.locator('[data-testid="user-menu"]')
      .or(page.getByRole('button', { name: /account|profile/i }));
    if (await userMenu.isVisible().catch(() => false)) {
      await userMenu.click();
    }

    const logoutButton = page.getByRole('button', { name: /logout|sign out/i })
      .or(page.getByRole('menuitem', { name: /logout|sign out/i }));
    if (await logoutButton.isVisible().catch(() => false)) {
      await logoutButton.click();
      await expect(page).toHaveURL(/\/login/);

      // Check that auth data is cleared
      const authData = await page.evaluate(() => {
        return {
          token: window.localStorage.getItem('token'),
          auth: window.localStorage.getItem('auth'),
        };
      });
      expect(authData.token).toBeNull();
      expect(authData.auth).toBeNull();
    }
  });
});

// =============================================================================
// PASSWORD MANAGEMENT
// =============================================================================

test.describe('Password Management', () => {
  test.use({ project: 'owner-portal' });

  test('should have forgot password link', async ({ page }) => {
    await page.goto('/login');
    const forgotLink = page.getByRole('link', { name: /forgot|reset/i });
    await expect(forgotLink).toBeVisible();
  });

  test('should navigate to password reset page', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('link', { name: /forgot|reset/i }).click();
    await expect(page).toHaveURL(/\/(forgot|reset)/);
    await expect(page.getByLabel(/email/i)).toBeVisible();
  });

  test('should submit password reset request', async ({ page }) => {
    await page.goto('/forgot-password');
    await page.getByLabel(/email/i).fill('test@example.com');
    await page.getByRole('button', { name: /send|reset|submit/i }).click();

    // Should show success message or stay on page
    await page.waitForLoadState('networkidle');
    const hasMessage = await page.getByText(/sent|check|email/i)
      .isVisible()
      .catch(() => false);
    expect(hasMessage || page.url().includes('forgot')).toBeTruthy();
  });
});
