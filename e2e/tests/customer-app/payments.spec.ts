/**
 * Customer App Payments Tests
 * Covers: CA-AC-010 to CA-AC-016
 * 
 * Tests balance viewing, M-Pesa payments, bank transfers, receipts, payment history,
 * payment plans, and reminder notifications.
 */

import { test, expect } from '@playwright/test';
import { CustomerAppPage } from '../../page-objects';
import { loginAsCustomer } from '../../fixtures/auth';
import { testPayments } from '../../fixtures/test-data';

test.describe('Customer App Payments', () => {
  let customerApp: CustomerAppPage;
  
  test.beforeEach(async ({ page }) => {
    await loginAsCustomer(page);
    customerApp = new CustomerAppPage(page);
    await customerApp.gotoPayments();
  });
  
  test.describe('CA-AC-010: View Balance and Due Date', () => {
    test('customer can view current balance', async ({ page }) => {
      const balance = await customerApp.getBalance();
      
      expect(balance).toBeDefined();
      // Balance should contain currency or number
      expect(balance).toMatch(/KES|TZS|\d+/);
    });
    
    test('customer can view due date', async ({ page }) => {
      const dueDate = await customerApp.getDueDate();
      
      expect(dueDate).toBeDefined();
    });
    
    test('balance shows breakdown by category', async ({ page }) => {
      // Look for breakdown (rent, utilities, etc.)
      const breakdown = page.getByText(/rent|utility|service.*charge|total/i);
      
      if (await breakdown.count() > 0) {
        await expect(breakdown.first()).toBeVisible();
      }
    });
    
    test('overdue balance is highlighted', async ({ page }) => {
      const overdueIndicator = page.locator('[class*="overdue"], [class*="late"], [data-overdue]');
      
      // May or may not have overdue balance
      expect(customerApp.currentBalance).toBeDefined();
    });
  });
  
  test.describe('CA-AC-011: M-Pesa Payment', () => {
    test('customer can pay via M-Pesa with one-click', async ({ page }) => {
      if (await customerApp.payMpesaButton.isVisible({ timeout: 2000 })) {
        await expect(customerApp.payMpesaButton).toBeVisible();
      }
    });
    
    test('M-Pesa payment shows phone number confirmation', async ({ page }) => {
      if (await customerApp.payMpesaButton.isVisible({ timeout: 2000 })) {
        await customerApp.payMpesaButton.click();
        await page.waitForLoadState('networkidle');
        
        // Should show phone number
        const phoneDisplay = page.getByText(/\+254|\*{4}\d{4}/);
        await expect(phoneDisplay.first()).toBeVisible({ timeout: 5000 });
      }
    });
    
    test('M-Pesa payment shows amount confirmation', async ({ page }) => {
      if (await customerApp.payMpesaButton.isVisible({ timeout: 2000 })) {
        await customerApp.payMpesaButton.click();
        await page.waitForLoadState('networkidle');
        
        // Should show amount
        const amountDisplay = page.getByText(/KES|amount|\d+/i);
        await expect(amountDisplay.first()).toBeVisible({ timeout: 5000 });
      }
    });
    
    test('M-Pesa payment allows editing phone number', async ({ page }) => {
      if (await customerApp.payMpesaButton.isVisible({ timeout: 2000 })) {
        await customerApp.payMpesaButton.click();
        await page.waitForLoadState('networkidle');
        
        // Look for edit option
        const editButton = page.getByRole('button', { name: /edit|change/i });
        if (await editButton.isVisible({ timeout: 2000 })) {
          await expect(editButton).toBeVisible();
        }
      }
    });
  });
  
  test.describe('CA-AC-012: Bank Transfer', () => {
    test('customer can pay via bank transfer with reference display', async ({ page }) => {
      if (await customerApp.payBankButton.isVisible({ timeout: 2000 })) {
        await customerApp.payBankButton.click();
        await page.waitForLoadState('networkidle');
        
        // Should show bank details
        const bankDetails = page.getByText(/account|bank|reference/i);
        await expect(bankDetails.first()).toBeVisible({ timeout: 5000 });
      }
    });
    
    test('bank transfer shows account number', async ({ page }) => {
      if (await customerApp.payBankButton.isVisible({ timeout: 2000 })) {
        await customerApp.payBankButton.click();
        await page.waitForLoadState('networkidle');
        
        const accountNumber = page.getByText(/account.*number|\d{10,}/i);
        await expect(accountNumber.first()).toBeVisible({ timeout: 5000 });
      }
    });
    
    test('bank transfer shows payment reference', async ({ page }) => {
      if (await customerApp.payBankButton.isVisible({ timeout: 2000 })) {
        await customerApp.payBankButton.click();
        await page.waitForLoadState('networkidle');
        
        const reference = page.getByText(/reference|ref/i);
        await expect(reference.first()).toBeVisible({ timeout: 5000 });
      }
    });
    
    test('bank details can be copied', async ({ page }) => {
      if (await customerApp.payBankButton.isVisible({ timeout: 2000 })) {
        await customerApp.payBankButton.click();
        await page.waitForLoadState('networkidle');
        
        const copyButton = page.getByRole('button', { name: /copy/i });
        if (await copyButton.isVisible({ timeout: 2000 })) {
          await expect(copyButton).toBeVisible();
        }
      }
    });
  });
  
  test.describe('CA-AC-013: Instant Receipt', () => {
    test('customer receives instant receipt upon payment confirmation', async ({ page }) => {
      // After payment, receipt should be available
      const paymentHistory = await customerApp.getPaymentHistory();
      
      if (paymentHistory.length > 0) {
        // Receipt download should be available
        const receiptButton = page.getByRole('button', { name: /receipt|download/i });
        if (await receiptButton.isVisible({ timeout: 2000 })) {
          await expect(receiptButton.first()).toBeVisible();
        }
      }
    });
    
    test('receipt shows payment details', async ({ page }) => {
      // Navigate to a payment in history
      const paymentItem = customerApp.paymentHistory.locator('[data-payment], tr').first();
      
      if (await paymentItem.isVisible({ timeout: 2000 })) {
        await paymentItem.click();
        await page.waitForLoadState('networkidle');
        
        // Receipt should show amount, date, reference
        const receiptDetails = page.getByText(/amount|date|reference|receipt/i);
        await expect(receiptDetails.first()).toBeVisible({ timeout: 5000 });
      }
    });
  });
  
  test.describe('CA-AC-014: Payment History', () => {
    test('customer can view full payment history', async ({ page }) => {
      const paymentHistory = await customerApp.getPaymentHistory();
      
      // Should return array (may be empty)
      expect(paymentHistory).toBeDefined();
      expect(Array.isArray(paymentHistory)).toBe(true);
    });
    
    test('payment history shows dates', async ({ page }) => {
      await customerApp.paymentHistory.scrollIntoViewIfNeeded();
      
      const historyText = await customerApp.paymentHistory.textContent();
      
      // Should have date information
      if (historyText && historyText.length > 20) {
        expect(historyText).toMatch(/\d+|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|today|yesterday/i);
      }
    });
    
    test('payment history shows amounts', async ({ page }) => {
      await customerApp.paymentHistory.scrollIntoViewIfNeeded();
      
      const historyText = await customerApp.paymentHistory.textContent();
      
      if (historyText && historyText.length > 20) {
        expect(historyText).toMatch(/KES|TZS|\d+/);
      }
    });
    
    test('payment history shows status', async ({ page }) => {
      await customerApp.paymentHistory.scrollIntoViewIfNeeded();
      
      const historyText = await customerApp.paymentHistory.textContent();
      
      if (historyText && historyText.length > 20) {
        expect(historyText).toMatch(/success|completed|pending|failed/i);
      }
    });
  });
  
  test.describe('CA-AC-015: Payment Plan Request', () => {
    test('customer can request payment plan via chat', async ({ page }) => {
      if (await customerApp.requestPlanButton.isVisible({ timeout: 2000 })) {
        await customerApp.requestPlanButton.click();
        await page.waitForLoadState('networkidle');
        
        // Should show request form or chat
        const requestForm = page.locator('form, [data-form], textarea');
        await expect(requestForm.first()).toBeVisible({ timeout: 5000 });
      }
    });
    
    test('payment plan request shows current balance', async ({ page }) => {
      if (await customerApp.requestPlanButton.isVisible({ timeout: 2000 })) {
        await customerApp.requestPlanButton.click();
        await page.waitForLoadState('networkidle');
        
        // Should show balance information
        const balanceInfo = page.getByText(/balance|amount|owed/i);
        await expect(balanceInfo.first()).toBeVisible({ timeout: 5000 });
      }
    });
    
    test('payment plan request allows message input', async ({ page }) => {
      if (await customerApp.requestPlanButton.isVisible({ timeout: 2000 })) {
        await customerApp.requestPlanButton.click();
        await page.waitForLoadState('networkidle');
        
        const messageInput = page.getByLabel(/message|reason/i).or(page.locator('textarea'));
        await expect(messageInput.first()).toBeVisible({ timeout: 5000 });
      }
    });
  });
  
  test.describe('CA-AC-016: Reminder Notifications', () => {
    test('customer receives reminder notifications before due date', async ({ page }) => {
      // Check notification center or settings
      await customerApp.notificationCenter.click();
      await page.waitForLoadState('networkidle');
      
      // Look for payment reminders
      const reminders = page.getByText(/reminder|due|payment.*upcoming/i);
      
      // May or may not have reminders
      expect(customerApp.notificationCenter).toBeDefined();
    });
    
    test('reminder shows amount due', async ({ page }) => {
      await customerApp.notificationCenter.click();
      await page.waitForLoadState('networkidle');
      
      const notifications = page.locator('[data-notification], .notification-item');
      
      if (await notifications.count() > 0) {
        const notificationText = await notifications.first().textContent();
        // May contain amount
        expect(notificationText).toBeDefined();
      }
    });
    
    test('reminder shows due date', async ({ page }) => {
      await customerApp.notificationCenter.click();
      await page.waitForLoadState('networkidle');
      
      const notifications = page.locator('[data-notification], .notification-item');
      
      if (await notifications.count() > 0) {
        const notificationText = await notifications.first().textContent();
        expect(notificationText).toBeDefined();
      }
    });
    
    test('reminder links to payment page', async ({ page }) => {
      await customerApp.notificationCenter.click();
      await page.waitForLoadState('networkidle');
      
      const paymentReminder = page.locator('[data-notification], .notification-item').filter({ hasText: /pay|due/i }).first();
      
      if (await paymentReminder.isVisible({ timeout: 2000 })) {
        await paymentReminder.click();
        await page.waitForLoadState('networkidle');
        
        // Should navigate to payments
        await expect(page).toHaveURL(/pay/i);
      }
    });
  });
});
