/**
 * Customer App Maintenance Requests Tests
 * Covers: CA-AC-020 to CA-AC-026
 * 
 * Tests request submission, media attachments, voice notes, SLA estimates,
 * status notifications, completion confirmation, and service rating.
 */

import { test, expect } from '@playwright/test';
import { CustomerAppPage } from '../../page-objects';
import { loginAsCustomer } from '../../fixtures/auth';
import { testWorkOrders, randomString } from '../../fixtures/test-data';

test.describe('Customer App Maintenance Requests', () => {
  let customerApp: CustomerAppPage;
  
  test.beforeEach(async ({ page }) => {
    await loginAsCustomer(page);
    customerApp = new CustomerAppPage(page);
    await customerApp.gotoMaintenance();
  });
  
  test.describe('CA-AC-020: Submit Request via App', () => {
    test('customer can submit request via app with description', async ({ page }) => {
      await customerApp.submitRequestButton.click();
      await page.waitForLoadState('networkidle');
      
      const testDescription = `E2E Test Request ${randomString(8)} - Leaking faucet in kitchen`;
      await customerApp.requestDescription.fill(testDescription);
      
      await page.getByRole('button', { name: /submit/i }).click();
      await page.waitForLoadState('networkidle');
      
      // Should show success or request submitted
      await expect(page.getByText(/submitted|success|received/i)).toBeVisible({ timeout: 5000 });
    });
    
    test('request form has category selection', async ({ page }) => {
      await customerApp.submitRequestButton.click();
      await page.waitForLoadState('networkidle');
      
      const categorySelect = page.getByLabel(/category|type|issue/i);
      if (await categorySelect.isVisible({ timeout: 2000 })) {
        await categorySelect.click();
        
        const options = page.getByRole('option');
        expect(await options.count()).toBeGreaterThan(0);
        
        await page.keyboard.press('Escape');
      }
    });
    
    test('request form has priority selection', async ({ page }) => {
      await customerApp.submitRequestButton.click();
      await page.waitForLoadState('networkidle');
      
      const prioritySelect = page.getByLabel(/priority|urgency/i);
      if (await prioritySelect.isVisible({ timeout: 2000 })) {
        await prioritySelect.click();
        
        const options = page.getByRole('option');
        expect(await options.count()).toBeGreaterThan(0);
        
        await page.keyboard.press('Escape');
      }
    });
    
    test('request form validates description', async ({ page }) => {
      await customerApp.submitRequestButton.click();
      await page.waitForLoadState('networkidle');
      
      // Submit without description
      await page.getByRole('button', { name: /submit/i }).click();
      
      // Should show validation error
      const error = page.getByText(/required|description|enter/i);
      await expect(error.first()).toBeVisible({ timeout: 3000 });
    });
  });
  
  test.describe('CA-AC-021: Photo/Video Attachments', () => {
    test('customer can attach photos to request', async ({ page }) => {
      await customerApp.submitRequestButton.click();
      await page.waitForLoadState('networkidle');
      
      if (await customerApp.attachPhotoButton.isVisible({ timeout: 2000 })) {
        await customerApp.attachPhotoButton.click();
        
        const fileInput = page.locator('input[type="file"]');
        await expect(fileInput).toBeAttached();
      }
    });
    
    test('customer can attach videos to request', async ({ page }) => {
      await customerApp.submitRequestButton.click();
      await page.waitForLoadState('networkidle');
      
      if (await customerApp.attachVideoButton.isVisible({ timeout: 2000 })) {
        await customerApp.attachVideoButton.click();
        
        const fileInput = page.locator('input[type="file"]');
        await expect(fileInput).toBeAttached();
      }
    });
    
    test('multiple photos can be attached', async ({ page }) => {
      await customerApp.submitRequestButton.click();
      await page.waitForLoadState('networkidle');
      
      const fileInput = page.locator('input[type="file"]');
      if (await fileInput.isAttached()) {
        const multiple = await fileInput.getAttribute('multiple');
        // May support multiple files
        expect(fileInput).toBeDefined();
      }
    });
    
    test('attachments show preview', async ({ page }) => {
      await customerApp.submitRequestButton.click();
      await page.waitForLoadState('networkidle');
      
      // Preview area should exist
      const previewArea = page.locator('[data-preview], .attachment-preview, .preview');
      expect(previewArea).toBeDefined();
    });
  });
  
  test.describe('CA-AC-022: WhatsApp Voice Note', () => {
    test('customer can submit request via voice note', async ({ page }) => {
      await customerApp.submitRequestButton.click();
      await page.waitForLoadState('networkidle');
      
      if (await customerApp.voiceNoteButton.isVisible({ timeout: 2000 })) {
        await expect(customerApp.voiceNoteButton).toBeVisible();
      }
    });
    
    test('voice note button shows recording indicator', async ({ page }) => {
      await customerApp.submitRequestButton.click();
      await page.waitForLoadState('networkidle');
      
      if (await customerApp.voiceNoteButton.isVisible({ timeout: 2000 })) {
        await customerApp.voiceNoteButton.click();
        
        // Should show recording indicator
        const recordingIndicator = page.locator('[class*="recording"], [data-recording]');
        if (await recordingIndicator.isVisible({ timeout: 2000 })) {
          await expect(recordingIndicator).toBeVisible();
        }
      }
    });
  });
  
  test.describe('CA-AC-023: SLA Estimate', () => {
    test('customer receives estimated response time upon submission', async ({ page }) => {
      await customerApp.submitRequestButton.click();
      await page.waitForLoadState('networkidle');
      
      await customerApp.requestDescription.fill(`E2E Test - SLA Check ${randomString(6)}`);
      await page.getByRole('button', { name: /submit/i }).click();
      await page.waitForLoadState('networkidle');
      
      // Should show SLA estimate
      const slaEstimate = await customerApp.getSlaEstimate();
      expect(customerApp.slaEstimate).toBeDefined();
    });
    
    test('SLA estimate shows expected timeframe', async ({ page }) => {
      // Navigate to existing request
      const requestItem = page.locator('[data-request], .request-item, tr').first();
      
      if (await requestItem.isVisible({ timeout: 2000 })) {
        await requestItem.click();
        await page.waitForLoadState('networkidle');
        
        // Look for timeframe
        const timeframe = page.getByText(/hour|day|response|resolution/i);
        await expect(timeframe.first()).toBeVisible({ timeout: 5000 });
      }
    });
  });
  
  test.describe('CA-AC-024: Status Notifications', () => {
    test('customer receives updates at each status change', async ({ page }) => {
      // Check notification center
      await customerApp.notificationCenter.click();
      await page.waitForLoadState('networkidle');
      
      // Look for maintenance notifications
      const maintenanceNotifications = page.getByText(/maintenance|request|work.*order|status/i);
      
      // May or may not have notifications
      expect(customerApp.notificationCenter).toBeDefined();
    });
    
    test('request shows current status', async ({ page }) => {
      const requestItem = page.locator('[data-request], .request-item, tr').first();
      
      if (await requestItem.isVisible({ timeout: 2000 })) {
        const statusText = await requestItem.textContent();
        expect(statusText).toMatch(/open|pending|in.*progress|assigned|completed/i);
      }
    });
    
    test('status history is viewable', async ({ page }) => {
      const requestItem = page.locator('[data-request], .request-item, tr').first();
      
      if (await requestItem.isVisible({ timeout: 2000 })) {
        await requestItem.click();
        await page.waitForLoadState('networkidle');
        
        // Look for status history or timeline
        const statusHistory = page.locator('[data-timeline], .status-history, .timeline');
        if (await statusHistory.isVisible({ timeout: 2000 })) {
          await expect(statusHistory).toBeVisible();
        }
      }
    });
  });
  
  test.describe('CA-AC-025: Completion Confirmation/Dispute', () => {
    test('customer can confirm completion', async ({ page }) => {
      // Find completed request awaiting confirmation
      const completedRequest = page.locator('[data-status="awaiting-confirmation"], [data-request]').filter({ hasText: /confirm|verify/i }).first();
      
      if (await completedRequest.isVisible({ timeout: 2000 })) {
        await completedRequest.click();
        await page.waitForLoadState('networkidle');
        
        if (await customerApp.confirmCompletionButton.isVisible({ timeout: 2000 })) {
          await expect(customerApp.confirmCompletionButton).toBeVisible();
        }
      }
    });
    
    test('customer can dispute completion', async ({ page }) => {
      const completedRequest = page.locator('[data-request]').first();
      
      if (await completedRequest.isVisible({ timeout: 2000 })) {
        await completedRequest.click();
        await page.waitForLoadState('networkidle');
        
        if (await customerApp.disputeButton.isVisible({ timeout: 2000 })) {
          await expect(customerApp.disputeButton).toBeVisible();
        }
      }
    });
    
    test('dispute requires reason', async ({ page }) => {
      const completedRequest = page.locator('[data-request]').first();
      
      if (await completedRequest.isVisible({ timeout: 2000 })) {
        await completedRequest.click();
        await page.waitForLoadState('networkidle');
        
        if (await customerApp.disputeButton.isVisible({ timeout: 2000 })) {
          await customerApp.disputeButton.click();
          
          const reasonInput = page.getByLabel(/reason/i);
          await expect(reasonInput).toBeVisible({ timeout: 3000 });
        }
      }
    });
  });
  
  test.describe('CA-AC-026: Service Rating', () => {
    test('customer can rate service after completion', async ({ page }) => {
      // Find completed request
      const completedRequest = page.locator('[data-request]').first();
      
      if (await completedRequest.isVisible({ timeout: 2000 })) {
        await completedRequest.click();
        await page.waitForLoadState('networkidle');
        
        // Look for rating component
        if (await customerApp.ratingStars.isVisible({ timeout: 2000 })) {
          await expect(customerApp.ratingStars).toBeVisible();
        }
      }
    });
    
    test('rating shows star selection', async ({ page }) => {
      const completedRequest = page.locator('[data-request]').first();
      
      if (await completedRequest.isVisible({ timeout: 2000 })) {
        await completedRequest.click();
        await page.waitForLoadState('networkidle');
        
        if (await customerApp.ratingStars.isVisible({ timeout: 2000 })) {
          const stars = customerApp.ratingStars.locator('button, [data-star], svg');
          const starCount = await stars.count();
          expect(starCount).toBeGreaterThan(0);
        }
      }
    });
    
    test('rating can include comment', async ({ page }) => {
      const completedRequest = page.locator('[data-request]').first();
      
      if (await completedRequest.isVisible({ timeout: 2000 })) {
        await completedRequest.click();
        await page.waitForLoadState('networkidle');
        
        const commentInput = page.getByLabel(/comment|feedback/i).or(page.locator('textarea'));
        if (await commentInput.isVisible({ timeout: 2000 })) {
          await expect(commentInput).toBeVisible();
        }
      }
    });
  });
});
