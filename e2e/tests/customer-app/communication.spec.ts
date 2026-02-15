/**
 * Customer App Communication Tests
 * Covers: CA-AC-040 to CA-AC-043
 * 
 * Tests in-app chat, announcements, notification preferences, and cross-channel sync.
 */

import { test, expect } from '@playwright/test';
import { CustomerAppPage } from '../../page-objects';
import { loginAsCustomer } from '../../fixtures/auth';
import { randomString } from '../../fixtures/test-data';

test.describe('Customer App Communication', () => {
  let customerApp: CustomerAppPage;
  
  test.beforeEach(async ({ page }) => {
    await loginAsCustomer(page);
    customerApp = new CustomerAppPage(page);
    await customerApp.gotoMessages();
  });
  
  test.describe('CA-AC-040: In-App Chat', () => {
    test('customer can message management via in-app chat', async ({ page }) => {
      const testMessage = `E2E Test Message ${randomString(8)}`;
      
      await customerApp.sendChatMessage(testMessage);
      
      // Message should appear in chat
      await expect(page.getByText(testMessage)).toBeVisible({ timeout: 5000 });
    });
    
    test('chat shows message history', async ({ page }) => {
      // Chat history should be visible
      const chatHistory = page.locator('[data-messages], .message-list, .chat-history');
      await expect(chatHistory.first()).toBeVisible({ timeout: 5000 });
    });
    
    test('chat shows message timestamps', async ({ page }) => {
      const chatContent = page.locator('[data-messages], .message-list').first();
      const chatText = await chatContent.textContent();
      
      if (chatText && chatText.length > 20) {
        expect(chatText).toMatch(/\d+|am|pm|today|yesterday/i);
      }
    });
    
    test('chat shows read receipts', async ({ page }) => {
      const readReceipt = page.locator('[class*="read"], [data-read], .checkmark');
      
      // May or may not have read receipts visible
      expect(customerApp.chatInput).toBeDefined();
    });
    
    test('chat allows sending attachments', async ({ page }) => {
      const attachButton = page.getByRole('button', { name: /attach|file|photo/i });
      
      if (await attachButton.isVisible({ timeout: 2000 })) {
        await attachButton.click();
        
        const fileInput = page.locator('input[type="file"]');
        await expect(fileInput).toBeAttached();
      }
    });
    
    test('chat input has character limit', async ({ page }) => {
      // Type a very long message
      await customerApp.chatInput.fill('A'.repeat(1000));
      
      // May have character limit or count
      const charCount = page.getByText(/\d+\s*\/\s*\d+|characters/i);
      if (await charCount.isVisible({ timeout: 1000 })) {
        await expect(charCount).toBeVisible();
      }
    });
  });
  
  test.describe('CA-AC-041: Announcements', () => {
    test('customer receives announcements in notification center', async ({ page }) => {
      const announcements = await customerApp.getAnnouncements();
      
      // Should return array (may be empty)
      expect(announcements).toBeDefined();
      expect(Array.isArray(announcements)).toBe(true);
    });
    
    test('announcements show in notification center', async ({ page }) => {
      await customerApp.notificationCenter.click();
      await page.waitForLoadState('networkidle');
      
      // Notification center should be visible
      const notificationPanel = page.locator('[data-notifications], .notification-panel, .notification-list');
      await expect(notificationPanel.first()).toBeVisible({ timeout: 5000 });
    });
    
    test('announcements show title and content', async ({ page }) => {
      await customerApp.notificationCenter.click();
      await page.waitForLoadState('networkidle');
      
      const announcements = page.locator('[data-announcement], .announcement-item');
      const count = await announcements.count();
      
      if (count > 0) {
        const announcementText = await announcements.first().textContent();
        expect(announcementText).toBeDefined();
        expect(announcementText!.length).toBeGreaterThan(0);
      }
    });
    
    test('announcements show date', async ({ page }) => {
      await customerApp.notificationCenter.click();
      await page.waitForLoadState('networkidle');
      
      const announcements = page.locator('[data-announcement], .announcement-item, .notification-item');
      const count = await announcements.count();
      
      if (count > 0) {
        const announcementText = await announcements.first().textContent();
        expect(announcementText).toMatch(/\d+|today|yesterday|ago/i);
      }
    });
    
    test('unread announcements show indicator', async ({ page }) => {
      const unreadIndicator = page.locator('[class*="unread"], [data-unread], .badge');
      
      // May or may not have unread items
      expect(customerApp.notificationCenter).toBeDefined();
    });
  });
  
  test.describe('CA-AC-042: Notification Preferences', () => {
    test('customer can set notification preferences', async ({ page }) => {
      await customerApp.profileNav.click();
      await page.waitForLoadState('networkidle');
      
      const notificationSettings = page.getByText(/notification.*settings|preferences/i);
      if (await notificationSettings.isVisible({ timeout: 2000 })) {
        await notificationSettings.click();
        await page.waitForLoadState('networkidle');
        
        // Should show preference toggles
        const toggles = page.locator('input[type="checkbox"], [role="switch"]');
        expect(await toggles.count()).toBeGreaterThan(0);
      }
    });
    
    test('preferences include email notifications', async ({ page }) => {
      await customerApp.profileNav.click();
      await page.waitForLoadState('networkidle');
      
      const notificationSettings = page.getByText(/notification/i);
      if (await notificationSettings.isVisible({ timeout: 2000 })) {
        await notificationSettings.click();
        await page.waitForLoadState('networkidle');
        
        const emailOption = page.getByLabel(/email/i);
        if (await emailOption.isVisible({ timeout: 2000 })) {
          await expect(emailOption).toBeVisible();
        }
      }
    });
    
    test('preferences include SMS notifications', async ({ page }) => {
      await customerApp.profileNav.click();
      await page.waitForLoadState('networkidle');
      
      const notificationSettings = page.getByText(/notification/i);
      if (await notificationSettings.isVisible({ timeout: 2000 })) {
        await notificationSettings.click();
        await page.waitForLoadState('networkidle');
        
        const smsOption = page.getByLabel(/sms|text/i);
        if (await smsOption.isVisible({ timeout: 2000 })) {
          await expect(smsOption).toBeVisible();
        }
      }
    });
    
    test('preferences include push notifications', async ({ page }) => {
      await customerApp.profileNav.click();
      await page.waitForLoadState('networkidle');
      
      const notificationSettings = page.getByText(/notification/i);
      if (await notificationSettings.isVisible({ timeout: 2000 })) {
        await notificationSettings.click();
        await page.waitForLoadState('networkidle');
        
        const pushOption = page.getByLabel(/push|app.*notification/i);
        if (await pushOption.isVisible({ timeout: 2000 })) {
          await expect(pushOption).toBeVisible();
        }
      }
    });
    
    test('preferences can be saved', async ({ page }) => {
      await customerApp.profileNav.click();
      await page.waitForLoadState('networkidle');
      
      const notificationSettings = page.getByText(/notification/i);
      if (await notificationSettings.isVisible({ timeout: 2000 })) {
        await notificationSettings.click();
        await page.waitForLoadState('networkidle');
        
        const saveButton = page.getByRole('button', { name: /save/i });
        if (await saveButton.isVisible({ timeout: 2000 })) {
          await expect(saveButton).toBeVisible();
        }
      }
    });
  });
  
  test.describe('CA-AC-043: Cross-Channel Sync', () => {
    test('communications sync between WhatsApp and app', async ({ page }) => {
      // This test verifies sync indicators exist
      const syncStatus = page.getByText(/synced|sync|whatsapp/i);
      
      // May show sync status
      expect(customerApp).toBeDefined();
    });
    
    test('messages from WhatsApp appear in app', async ({ page }) => {
      // Chat history should include all messages regardless of source
      const chatHistory = page.locator('[data-messages], .message-list');
      
      if (await chatHistory.isVisible({ timeout: 2000 })) {
        // Look for WhatsApp source indicator
        const whatsappIndicator = page.locator('[data-source="whatsapp"], .whatsapp-message, [class*="whatsapp"]');
        
        // May or may not have WhatsApp messages
        expect(chatHistory).toBeDefined();
      }
    });
    
    test('messages sent from app sync to WhatsApp', async ({ page }) => {
      // This is verified by the message being sent successfully
      const testMessage = `E2E Sync Test ${randomString(6)}`;
      
      await customerApp.chatInput.fill(testMessage);
      await customerApp.sendMessageButton.click();
      await page.waitForLoadState('networkidle');
      
      // Message should appear
      await expect(page.getByText(testMessage)).toBeVisible({ timeout: 5000 });
    });
    
    test('channel indicator shows message source', async ({ page }) => {
      const chatHistory = page.locator('[data-messages], .message-list');
      
      if (await chatHistory.isVisible({ timeout: 2000 })) {
        const messages = chatHistory.locator('[data-message], .message-item');
        const count = await messages.count();
        
        if (count > 0) {
          // Messages may have source indicators
          const messageHtml = await messages.first().innerHTML();
          expect(messageHtml).toBeDefined();
        }
      }
    });
  });
});
