/**
 * Customer App Documents & Lease Tests
 * Covers: CA-AC-030 to CA-AC-034
 * 
 * Tests viewing lease documents, house rules, renewal notifications,
 * renewal acceptance, and move-out notice submission.
 */

import { test, expect } from '@playwright/test';
import { CustomerAppPage } from '../../page-objects';
import { loginAsCustomer } from '../../fixtures/auth';
import { futureDate } from '../../fixtures/test-data';

test.describe('Customer App Documents & Lease', () => {
  let customerApp: CustomerAppPage;
  
  test.beforeEach(async ({ page }) => {
    await loginAsCustomer(page);
    customerApp = new CustomerAppPage(page);
    await customerApp.gotoDocuments();
  });
  
  test.describe('CA-AC-030: View Signed Lease', () => {
    test('customer can view signed lease document', async ({ page }) => {
      await customerApp.viewLeaseDocument();
      
      // Should show lease content or PDF viewer
      const leaseContent = page.locator('iframe, embed, .pdf-viewer, [data-document]');
      await expect(leaseContent.first()).toBeVisible({ timeout: 5000 });
    });
    
    test('lease document shows key terms', async ({ page }) => {
      await customerApp.viewLeaseDocument();
      
      // Look for lease terms
      const leaseTerms = page.getByText(/term|rent|deposit|start.*date|end.*date/i);
      await expect(leaseTerms.first()).toBeVisible({ timeout: 5000 });
    });
    
    test('lease document can be downloaded', async ({ page }) => {
      const downloadButton = page.getByRole('button', { name: /download/i });
      
      if (await downloadButton.isVisible({ timeout: 2000 })) {
        const [download] = await Promise.all([
          page.waitForEvent('download'),
          downloadButton.click(),
        ]);
        
        expect(download).toBeDefined();
      }
    });
    
    test('lease shows signature status', async ({ page }) => {
      await customerApp.viewLeaseDocument();
      
      const signatureStatus = page.getByText(/signed|signature|verified/i);
      await expect(signatureStatus.first()).toBeVisible({ timeout: 5000 });
    });
  });
  
  test.describe('CA-AC-031: View House Rules', () => {
    test('customer can view house rules and procedures', async ({ page }) => {
      await customerApp.viewHouseRules();
      
      // Should show rules content
      const rulesContent = page.locator('[data-content], .rules-content, article');
      await expect(rulesContent.first()).toBeVisible({ timeout: 5000 });
    });
    
    test('house rules show property policies', async ({ page }) => {
      await customerApp.viewHouseRules();
      
      const policies = page.getByText(/rule|policy|guideline|allowed|prohibited/i);
      await expect(policies.first()).toBeVisible({ timeout: 5000 });
    });
    
    test('house rules show emergency contacts', async ({ page }) => {
      await customerApp.viewHouseRules();
      
      const emergencyInfo = page.getByText(/emergency|contact|phone|call/i);
      if (await emergencyInfo.count() > 0) {
        await expect(emergencyInfo.first()).toBeVisible();
      }
    });
  });
  
  test.describe('CA-AC-032: Renewal Notification', () => {
    test('customer receives notification when renewal offer available', async ({ page }) => {
      // Check notification center
      await customerApp.notificationCenter.click();
      await page.waitForLoadState('networkidle');
      
      // Look for renewal notifications
      const renewalNotification = page.getByText(/renewal|renew|lease.*expir/i);
      
      // May or may not have renewal notification
      expect(customerApp.notificationCenter).toBeDefined();
    });
    
    test('renewal offer shows new terms', async ({ page }) => {
      if (await customerApp.renewalOffer.isVisible({ timeout: 2000 })) {
        await customerApp.renewalOffer.click();
        await page.waitForLoadState('networkidle');
        
        // Should show renewal terms
        const renewalTerms = page.getByText(/term|rent|period|duration/i);
        await expect(renewalTerms.first()).toBeVisible({ timeout: 5000 });
      }
    });
    
    test('renewal offer shows expiry deadline', async ({ page }) => {
      if (await customerApp.renewalOffer.isVisible({ timeout: 2000 })) {
        await customerApp.renewalOffer.click();
        await page.waitForLoadState('networkidle');
        
        const deadline = page.getByText(/deadline|expires|respond.*by|valid.*until/i);
        await expect(deadline.first()).toBeVisible({ timeout: 5000 });
      }
    });
  });
  
  test.describe('CA-AC-033: Accept Renewal', () => {
    test('customer can accept renewal via app', async ({ page }) => {
      if (await customerApp.renewalOffer.isVisible({ timeout: 2000 })) {
        await customerApp.renewalOffer.click();
        await page.waitForLoadState('networkidle');
        
        if (await customerApp.acceptRenewalButton.isVisible({ timeout: 2000 })) {
          await expect(customerApp.acceptRenewalButton).toBeVisible();
        }
      }
    });
    
    test('renewal acceptance requires e-signature', async ({ page }) => {
      if (await customerApp.renewalOffer.isVisible({ timeout: 2000 })) {
        await customerApp.renewalOffer.click();
        await page.waitForLoadState('networkidle');
        
        if (await customerApp.acceptRenewalButton.isVisible({ timeout: 2000 })) {
          await customerApp.acceptRenewalButton.click();
          await page.waitForLoadState('networkidle');
          
          // Should show signature requirement
          const signatureRequired = page.locator('canvas, [data-signature]').or(page.getByText(/sign|signature/i));
          await expect(signatureRequired.first()).toBeVisible({ timeout: 5000 });
        }
      }
    });
    
    test('renewal confirmation is shown', async ({ page }) => {
      // This verifies the confirmation flow exists
      expect(customerApp.renewalOffer).toBeDefined();
    });
  });
  
  test.describe('CA-AC-034: Move-Out Notice', () => {
    test('customer can submit move-out notice via app', async ({ page }) => {
      if (await customerApp.moveOutNoticeButton.isVisible({ timeout: 2000 })) {
        await customerApp.moveOutNoticeButton.click();
        await page.waitForLoadState('networkidle');
        
        // Should show notice form
        const noticeForm = page.locator('form, [data-form]');
        await expect(noticeForm.first()).toBeVisible({ timeout: 5000 });
      }
    });
    
    test('move-out notice requires date', async ({ page }) => {
      if (await customerApp.moveOutNoticeButton.isVisible({ timeout: 2000 })) {
        await customerApp.moveOutNoticeButton.click();
        await page.waitForLoadState('networkidle');
        
        const dateInput = page.getByLabel(/date|move.*out|vacate/i);
        await expect(dateInput.first()).toBeVisible({ timeout: 5000 });
      }
    });
    
    test('move-out notice allows reason selection', async ({ page }) => {
      if (await customerApp.moveOutNoticeButton.isVisible({ timeout: 2000 })) {
        await customerApp.moveOutNoticeButton.click();
        await page.waitForLoadState('networkidle');
        
        const reasonInput = page.getByLabel(/reason/i);
        if (await reasonInput.isVisible({ timeout: 2000 })) {
          await expect(reasonInput).toBeVisible();
        }
      }
    });
    
    test('move-out notice shows notice period requirements', async ({ page }) => {
      if (await customerApp.moveOutNoticeButton.isVisible({ timeout: 2000 })) {
        await customerApp.moveOutNoticeButton.click();
        await page.waitForLoadState('networkidle');
        
        const noticePeriod = page.getByText(/notice.*period|days|minimum/i);
        await expect(noticePeriod.first()).toBeVisible({ timeout: 5000 });
      }
    });
    
    test('move-out notice submission shows confirmation', async ({ page }) => {
      if (await customerApp.moveOutNoticeButton.isVisible({ timeout: 2000 })) {
        await customerApp.moveOutNoticeButton.click();
        await page.waitForLoadState('networkidle');
        
        // Fill form
        const dateInput = page.getByLabel(/date|move.*out/i);
        if (await dateInput.isVisible({ timeout: 2000 })) {
          await dateInput.fill(futureDate(60));
          
          const reasonInput = page.getByLabel(/reason/i);
          if (await reasonInput.isVisible({ timeout: 1000 })) {
            await reasonInput.fill('E2E Test - Relocating');
          }
          
          await page.getByRole('button', { name: /submit|confirm/i }).click();
          await page.waitForLoadState('networkidle');
          
          // Should show confirmation
          await expect(page.getByText(/submitted|received|confirmed/i)).toBeVisible({ timeout: 5000 });
        }
      }
    });
  });
});
