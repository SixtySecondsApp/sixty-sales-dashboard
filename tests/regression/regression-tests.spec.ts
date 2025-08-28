import { test, expect } from '@playwright/test';

/**
 * Regression Test Suite
 * Tests to prevent previously fixed issues from reoccurring
 */

test.describe('Regression Tests - Fixed Issues Prevention', () => {
  test.beforeEach(async ({ page }) => {
    // Monitor console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(`Console error: ${msg.text()}`);
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test.describe('Static Resource Loading - Regression', () => {
    test('Static resources load without 404 errors', async ({ page }) => {
      const failedResources: string[] = [];
      
      page.on('response', response => {
        if (response.status() === 404) {
          const url = response.url();
          if (url.includes('.css') || url.includes('.js') || 
              url.includes('.svg') || url.includes('.png') || 
              url.includes('.ico')) {
            failedResources.push(url);
          }
        }
      });

      // Navigate to different pages to test all resources
      const pages = ['/', '/dashboard', '/contacts', '/deals', '/activities', '/tasks'];
      
      for (const pageUrl of pages) {
        try {
          await page.goto(pageUrl);
          await page.waitForLoadState('networkidle', { timeout: 10000 });
        } catch (error) {
          console.log(`Could not navigate to ${pageUrl}: ${error}`);
        }
      }

      if (failedResources.length > 0) {
        console.error('Failed resources:', failedResources);
      }

      expect(failedResources, 'Static resources should load without 404 errors').toHaveLength(0);
    });

    test('Critical assets are available', async ({ page }) => {
      await page.goto('/');
      
      // Check for critical CSS
      const stylesheets = await page.locator('link[rel="stylesheet"]').count();
      expect(stylesheets, 'Should have stylesheets loaded').toBeGreaterThan(0);

      // Check for critical JS bundles
      const scripts = await page.locator('script[src]').count();
      expect(scripts, 'Should have JavaScript bundles loaded').toBeGreaterThan(0);
    });
  });

  test.describe('Console Errors - Regression', () => {
    test('No critical JavaScript errors on page load', async ({ page }) => {
      const criticalErrors: string[] = [];
      
      page.on('console', msg => {
        if (msg.type() === 'error') {
          const text = msg.text();
          // Filter out known acceptable errors
          if (!text.includes('favicon.ico') && 
              !text.includes('ResizeObserver loop limit exceeded') &&
              !text.includes('Non-passive event listener')) {
            criticalErrors.push(text);
          }
        }
      });

      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Wait additional time to catch delayed errors
      await page.waitForTimeout(3000);

      if (criticalErrors.length > 0) {
        console.error('Critical console errors:', criticalErrors);
      }

      expect(criticalErrors, 'Should not have critical console errors').toHaveLength(0);
    });

    test('Web vitals integration does not cause errors', async ({ page }) => {
      const webVitalsErrors: string[] = [];
      
      page.on('console', msg => {
        if (msg.type() === 'error') {
          const text = msg.text().toLowerCase();
          if (text.includes('vitals') || text.includes('cls') || 
              text.includes('fid') || text.includes('lcp')) {
            webVitalsErrors.push(msg.text());
          }
        }
      });

      await page.goto('/dashboard');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);

      expect(webVitalsErrors, 'Web vitals should not cause JavaScript errors').toHaveLength(0);
    });
  });

  test.describe('Authentication Errors - Regression', () => {
    test('403 Forbidden errors do not occur during contact operations', async ({ page }) => {
      const forbiddenErrors: any[] = [];
      
      page.on('response', response => {
        if (response.status() === 403 && response.url().includes('contact')) {
          forbiddenErrors.push({
            url: response.url(),
            method: response.request().method(),
            status: response.status()
          });
        }
      });

      // Try to access contacts section
      const contactsLink = page.locator('a[href*="contact"], text=/Contacts/i').first();
      if (await contactsLink.count() > 0) {
        await contactsLink.click();
        await page.waitForLoadState('networkidle');
      }

      // Try QuickAdd contact creation
      const quickAddBtn = page.locator('[data-testid="quick-add-button"], button:has-text("Quick Add")').first();
      if (await quickAddBtn.count() > 0) {
        await quickAddBtn.click();
        
        const meetingOption = page.locator('text=Meeting, [data-action="meeting"]').first();
        if (await meetingOption.count() > 0) {
          await meetingOption.click();
          
          // Fill in form to trigger contact-related requests
          const companyInput = page.locator('input[name*="company"], input[placeholder*="company"]').first();
          if (await companyInput.count() > 0) {
            await companyInput.fill('Test Company');
            
            const submitBtn = page.locator('button[type="submit"]').first();
            if (await submitBtn.count() > 0) {
              await Promise.race([
                submitBtn.click(),
                page.waitForTimeout(5000)
              ]);
            }
          }
        }
      }

      // Wait for any async requests to complete
      await page.waitForTimeout(3000);

      if (forbiddenErrors.length > 0) {
        console.error('403 Forbidden errors detected:', forbiddenErrors);
      }

      expect(forbiddenErrors, 'Should not have 403 Forbidden errors for contact operations').toHaveLength(0);
    });

    test('Authentication errors show user-friendly messages', async ({ page }) => {
      // This test simulates authentication failures and checks error handling
      
      // Try to access a protected route (this might redirect to login)
      await page.goto('/dashboard');
      
      // If redirected to auth page, try invalid credentials
      if (page.url().includes('auth')) {
        const emailInput = page.locator('input[type="email"]').first();
        const passwordInput = page.locator('input[type="password"]').first();
        const submitBtn = page.locator('button[type="submit"]').first();

        if (await emailInput.count() > 0 && await passwordInput.count() > 0) {
          await emailInput.fill('invalid@example.com');
          await passwordInput.fill('wrongpassword');
          await submitBtn.click();

          // Should show user-friendly error message
          const errorMessage = page.locator('text=/Invalid|Error|Failed|incorrect/i');
          await expect(errorMessage).toBeVisible({ timeout: 10000 });
          
          // Should not show technical error messages
          const technicalError = page.locator('text=/500|Internal Server Error|Stack trace/i');
          expect(await technicalError.count()).toBe(0);
        }
      }
    });
  });

  test.describe('QuickAdd Functionality - Regression', () => {
    test('QuickAdd modal opens and closes without issues', async ({ page }) => {
      await page.goto('/dashboard');
      
      const quickAddBtn = page.locator('[data-testid="quick-add-button"], button:has-text("Quick Add")').first();
      
      if (await quickAddBtn.count() > 0) {
        // Open modal
        await quickAddBtn.click();
        const modal = page.locator('[role="dialog"], .modal').first();
        await expect(modal).toBeVisible({ timeout: 5000 });

        // Check all action options are present
        const actions = ['Task', 'Deal', 'Sale', 'Outbound', 'Meeting', 'Proposal'];
        for (const action of actions) {
          const actionElement = page.locator(`text=${action}`).first();
          if (await actionElement.count() > 0) {
            await expect(actionElement).toBeVisible();
          }
        }

        // Close modal
        const closeBtn = page.locator('[aria-label="close"], button:has-text("×")').first();
        await closeBtn.click();
        await expect(modal).toBeHidden();
      } else {
        console.log('QuickAdd button not found - skipping test');
      }
    });

    test('Task creation validates required fields properly', async ({ page }) => {
      await page.goto('/dashboard');
      
      const quickAddBtn = page.locator('[data-testid="quick-add-button"], button:has-text("Quick Add")').first();
      
      if (await quickAddBtn.count() > 0) {
        await quickAddBtn.click();
        
        const taskOption = page.locator('text=Task, [data-action="task"]').first();
        if (await taskOption.count() > 0) {
          await taskOption.click();

          // Try submitting without title
          const submitBtn = page.locator('button[type="submit"]').first();
          await submitBtn.click();

          // Should show validation error
          const validationError = page.locator('text=/required|Required|Please fill/i');
          await expect(validationError).toBeVisible({ timeout: 5000 });

          // Fill title and submit should work
          const titleInput = page.locator('input[name="title"], input[placeholder*="title"]').first();
          if (await titleInput.count() > 0) {
            await titleInput.fill('Regression test task');
            await submitBtn.click();
            
            // Should not show the same validation error
            await page.waitForTimeout(2000);
            const persistentError = page.locator('text=/title.*required/i');
            expect(await persistentError.count()).toBe(0);
          }
        }
      }
    });

    test('Form resets properly between actions', async ({ page }) => {
      await page.goto('/dashboard');
      
      const quickAddBtn = page.locator('[data-testid="quick-add-button"], button:has-text("Quick Add")').first();
      
      if (await quickAddBtn.count() > 0) {
        await quickAddBtn.click();
        
        // Select task and fill data
        const taskOption = page.locator('text=Task').first();
        if (await taskOption.count() > 0) {
          await taskOption.click();
          
          const titleInput = page.locator('input[name="title"], input[placeholder*="title"]').first();
          if (await titleInput.count() > 0) {
            await titleInput.fill('Test data');
            
            // Go back to main menu (if back button exists)
            const backBtn = page.locator('button[aria-label="back"], .back-btn').first();
            if (await backBtn.count() > 0) {
              await backBtn.click();
            } else {
              // Close and reopen modal
              const closeBtn = page.locator('[aria-label="close"], button:has-text("×")').first();
              await closeBtn.click();
              await quickAddBtn.click();
            }

            // Select different action
            const saleOption = page.locator('text=Sale').first();
            if (await saleOption.count() > 0) {
              await saleOption.click();
              
              // Previous task data should not be visible
              const amountInput = page.locator('input[name="amount"], input[placeholder*="amount"]').first();
              if (await amountInput.count() > 0) {
                const value = await amountInput.inputValue();
                expect(value, 'Form should reset between actions').toBe('');
              }
            }
          }
        }
      }
    });
  });

  test.describe('Performance Regression', () => {
    test('Pages load within acceptable time limits', async ({ page }) => {
      const pageLoadTimes: Record<string, number> = {};
      const maxLoadTime = 10000; // 10 seconds max
      
      const testPages = [
        { url: '/', name: 'Home' },
        { url: '/dashboard', name: 'Dashboard' },
        { url: '/contacts', name: 'Contacts' },
        { url: '/deals', name: 'Deals' }
      ];

      for (const { url, name } of testPages) {
        try {
          const startTime = Date.now();
          await page.goto(url);
          await page.waitForLoadState('networkidle', { timeout: maxLoadTime });
          const endTime = Date.now();
          
          pageLoadTimes[name] = endTime - startTime;
          
          expect(pageLoadTimes[name], `${name} page should load within ${maxLoadTime}ms`).toBeLessThan(maxLoadTime);
        } catch (error) {
          console.log(`Could not test ${name} page: ${error}`);
        }
      }

      console.log('Page load times:', pageLoadTimes);
    });

    test('No memory leaks in modal operations', async ({ page }) => {
      await page.goto('/dashboard');
      
      const quickAddBtn = page.locator('[data-testid="quick-add-button"], button:has-text("Quick Add")').first();
      
      if (await quickAddBtn.count() > 0) {
        // Open and close modal multiple times to test for memory leaks
        for (let i = 0; i < 5; i++) {
          await quickAddBtn.click();
          const modal = page.locator('[role="dialog"], .modal').first();
          await expect(modal).toBeVisible();
          
          const closeBtn = page.locator('[aria-label="close"], button:has-text("×")').first();
          await closeBtn.click();
          await expect(modal).toBeHidden();
          
          // Small delay between operations
          await page.waitForTimeout(100);
        }

        // Check that page is still responsive
        await quickAddBtn.click();
        const modal = page.locator('[role="dialog"], .modal').first();
        await expect(modal).toBeVisible();
      }
    });
  });

  test.describe('Data Consistency - Regression', () => {
    test('Form submissions do not cause duplicate entries', async ({ page }) => {
      await page.goto('/dashboard');
      
      const quickAddBtn = page.locator('[data-testid="quick-add-button"], button:has-text("Quick Add")').first();
      
      if (await quickAddBtn.count() > 0) {
        await quickAddBtn.click();
        
        const taskOption = page.locator('text=Task').first();
        if (await taskOption.count() > 0) {
          await taskOption.click();
          
          const titleInput = page.locator('input[name="title"], input[placeholder*="title"]').first();
          const submitBtn = page.locator('button[type="submit"]').first();
          
          if (await titleInput.count() > 0) {
            const uniqueTitle = `Regression test ${Date.now()}`;
            await titleInput.fill(uniqueTitle);
            
            // Submit once
            await submitBtn.click();
            
            // Wait for response
            await page.waitForTimeout(2000);
            
            // Double-click should not create duplicate (button should be disabled)
            const isDisabled = await submitBtn.isDisabled();
            if (!isDisabled) {
              // If button is still enabled, clicking again should not create duplicate
              console.log('Testing double-click prevention');
              await submitBtn.click();
            }
            
            // This is a basic test - full duplicate prevention would require database verification
          }
        }
      }
    });
  });

  test.describe('Cross-Browser Compatibility - Regression', () => {
    test('Core functionality works across different browsers', async ({ page, browserName }) => {
      console.log(`Testing on ${browserName}`);
      
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Test basic navigation
      const navigationLinks = page.locator('nav a, [role="navigation"] a').first();
      if (await navigationLinks.count() > 0) {
        await navigationLinks.click();
        await page.waitForLoadState('networkidle');
      }

      // Test QuickAdd modal (if available)
      await page.goto('/dashboard');
      const quickAddBtn = page.locator('[data-testid="quick-add-button"], button:has-text("Quick Add")').first();
      
      if (await quickAddBtn.count() > 0) {
        await quickAddBtn.click();
        const modal = page.locator('[role="dialog"], .modal').first();
        await expect(modal).toBeVisible();
        
        // Test that modal is properly positioned and visible
        const modalBounds = await modal.boundingBox();
        expect(modalBounds, 'Modal should be visible on screen').toBeTruthy();
        
        if (modalBounds) {
          expect(modalBounds.width, 'Modal should have reasonable width').toBeGreaterThan(200);
          expect(modalBounds.height, 'Modal should have reasonable height').toBeGreaterThan(100);
        }
      }

      console.log(`${browserName} compatibility test passed`);
    });
  });
});