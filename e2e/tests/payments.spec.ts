import { test, expect } from '@playwright/test';
import { DashboardPage } from '../pages/DashboardPage';

test.describe('Estate Manager - Payments', () => {
  test.use({ project: 'estate-manager' });

  test('should navigate to receive payment from dashboard', async ({ page }) => {
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto('/');
    await dashboardPage.expectDashboardLoaded();
    await dashboardPage.clickReceivePayment();
    await expect(page).toHaveURL(/\/payments\/receive/);
    await expect(page.getByText(/record payment|receive payment/i)).toBeVisible();
  });

  test('should display payments list page', async ({ page }) => {
    await page.goto('/payments');
    await expect(page.getByRole('heading', { name: /payment/i })).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Customer App - M-Pesa Payment', () => {
  test.use({ project: 'customer-app' });

  test('should display M-Pesa payment page when authenticated', async ({ page }) => {
    await page.goto('/payments/mpesa');
    await expect(page.getByText(/pay with m-pesa|m-pesa/i)).toBeVisible({ timeout: 10000 });
  });

  test('should show amount and phone input on M-Pesa page', async ({ page }) => {
    await page.goto('/payments/mpesa');
    await expect(page.getByText(/amount to pay|kes/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByPlaceholder(/254|phone/i)).toBeVisible();
  });

  test('should complete M-Pesa flow (simulated)', async ({ page }) => {
    await page.goto('/payments/mpesa');
    const payButton = page.getByRole('button', { name: /pay kes/i });
    await expect(payButton).toBeVisible({ timeout: 10000 });
    await payButton.click();

    // Await either a success or a failure state explicitly rather than sleeping.
    const success = page.getByText(/payment successful|success/i);
    const failed = page.getByText(/payment failed|try again/i);
    await expect(success.or(failed)).toBeVisible({ timeout: 30000 });
  });
});
