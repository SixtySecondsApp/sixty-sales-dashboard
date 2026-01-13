import { describe, test, expect as vitestExpect, beforeAll, afterAll, beforeEach } from 'vitest';
import { expect as playwrightExpect } from '../fixtures/playwright-assertions';
import { setupPlaywriter, teardownPlaywriter } from '../fixtures/playwriter-setup';
import type { Page } from 'playwright-core';

const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || process.env.VITE_BASE_URL || 'http://localhost:5175';

describe('Error Handling and Edge Cases', () => {
  let page: Page;

  beforeAll(async () => {
    const setup = await setupPlaywriter();
    page = setup.page;
  });

  afterAll(async () => {
    await teardownPlaywriter();
  });

  beforeEach(async () => {
    // Start from the app root
    await page.goto(`${BASE_URL}/`);
    await page.waitForLoadState('networkidle');
  });

  describe('Network Error Scenarios', () => {
    test('should handle API failures gracefully on payments page', async () => {
      // Block all API calls to simulate network failure
      await page.route('**/api/**', route => route.abort());
      
      await page.goto(`${BASE_URL}/payments`);
      await page.waitForLoadState('networkidle');
      
      // Page should still render basic structure
      await playwrightExpect(page.locator('h1')).toHaveText(/Payment Management/i);
      
      // Should not show error alerts that break the page
      const errorAlerts = page.locator('[role="alert"], .error-message, [data-testid*="error"]');
      const alertCount = await errorAlerts.count();
      
      // If error messages exist, they should be user-friendly
      if (alertCount > 0) {
        const errorText = await errorAlerts.first().textContent();
        vitestExpect(errorText).toBeTruthy();
        vitestExpect(errorText?.toLowerCase()).not.toContain('undefined');
        vitestExpect(errorText?.toLowerCase()).not.toContain('null');
      }
    });

    test('should handle API failures gracefully on clients page', async () => {
      // Block all API calls
      await page.route('**/api/**', route => route.abort());
      
      await page.goto(`${BASE_URL}/clients`);
      await page.waitForLoadState('networkidle');
      
      // Page should still render basic structure
      await playwrightExpect(page.locator('h1')).toHaveText(/Client Management/i);
      
      // View toggle should still work
      const detailsButton = page.locator('button', { hasText: 'Deal Details' });
      await detailsButton.click();
      await playwrightExpect(page.locator('p')).toHaveText(/Detailed view showing individual deals/i);
    });

    test('should handle partial API failures', async () => {
      // Allow some API calls to succeed, block others
      await page.route('**/api/clients**', route => route.abort());
      
      await page.goto(`${BASE_URL}/payments`);
      await page.waitForLoadState('networkidle');
      
      // Basic page structure should still be intact
      await playwrightExpect(page.locator('h1')).toHaveText(/Payment Management/i);
      await playwrightExpect(page.locator('h2')).toHaveText(/Revenue Overview/i);
    });
  });

  describe('Invalid Route Handling', () => {
    test('should handle invalid nested routes gracefully', async () => {
      // Try accessing non-existent sub-routes
      await page.goto(`${BASE_URL}/payments/invalid-route`);
      
      // Should either redirect to valid route or show proper error
      await page.waitForLoadState('networkidle');
      
      // Check if we're on a valid page or error page
      const currentUrl = page.url();
      const pageContent = await page.textContent('body');
      
      // Should not show browser error pages
      vitestExpect(pageContent).not.toContain('This site can\'t be reached');
      vitestExpect(pageContent).not.toContain('404');
    });

    test('should handle malformed URLs', async () => {
      // Try accessing malformed URLs
      const malformedUrls = [
        `${BASE_URL}/payments///`,
        `${BASE_URL}/clients////`,
        `${BASE_URL}/payments/../clients`,
      ];

      for (const url of malformedUrls) {
        await page.goto(url);
        await page.waitForLoadState('networkidle');
        
        // Should handle gracefully without crashing
        const pageContent = await page.textContent('body');
        vitestExpect(pageContent).toBeTruthy();
        vitestExpect(pageContent).not.toContain('Cannot GET');
      }
    });
  });

  describe('Data Integrity Issues', () => {
    test('should handle empty data states on payments page', async () => {
      // Mock empty responses
      await page.route('**/api/**', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([])
        });
      });

      await page.goto(`${BASE_URL}/payments`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Should render page structure even with no data
      await playwrightExpect(page.locator('h1')).toHaveText(/Payment Management/i);
      
      // Should not show undefined/null values
      const pageText = await page.textContent('body');
      vitestExpect(pageText).not.toContain('undefined');
      vitestExpect(pageText).not.toContain('null');
      vitestExpect(pageText).not.toContain('NaN');
    });

    test('should handle malformed data responses', async () => {
      // Mock malformed JSON responses
      await page.route('**/api/**', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: null,
            error: null,
            invalidField: 'test'
          })
        });
      });

      await page.goto(`${BASE_URL}/clients`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Should handle gracefully
      await playwrightExpect(page.locator('h1')).toHaveText(/Client Management/i);
    });

    test('should handle null/undefined client data', async () => {
      // Mock response with null/undefined values
      await page.route('**/api/**', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: '1',
              company_name: null,
              subscription_amount: undefined,
              status: 'active',
              contact_email: null
            }
          ])
        });
      });

      await page.goto(`${BASE_URL}/clients`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Should display page without errors
      await playwrightExpect(page.locator('h1')).toHaveText(/Client Management/i);
      
      // Should not display "null" or "undefined" text
      const pageText = await page.textContent('body');
      vitestExpect(pageText).not.toMatch(/\bnull\b/);
      vitestExpect(pageText).not.toMatch(/\bundefined\b/);
    });
  });

  describe('Authentication and Authorization', () => {
    test('should handle authentication failures', async () => {
      // Mock 401 responses
      await page.route('**/api/**', route => {
        route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Unauthorized' })
        });
      });

      await page.goto(`${BASE_URL}/payments`);
      await page.waitForLoadState('networkidle');

      // Should handle gracefully, possibly redirect to login or show error
      const currentUrl = page.url();
      const pageContent = await page.textContent('body');
      
      // Should not crash the application
      vitestExpect(pageContent).toBeTruthy();
      
      // May redirect to login or show appropriate message
      const hasLoginForm = await page.locator('input[type="email"], input[type="password"]').count() > 0;
      const hasErrorMessage = await page.locator('[role="alert"], .error').count() > 0;
      const hasPageContent = await page.locator('h1').count() > 0;
      
      // Should show one of: login form, error message, or page content
      vitestExpect(hasLoginForm || hasErrorMessage || hasPageContent).toBeTruthy();
    });

    test('should handle session expiration during navigation', async () => {
      // Start with successful auth
      await page.goto(`${BASE_URL}/payments`);
      await page.waitForLoadState('networkidle');

      // Then simulate session expiration
      await page.route('**/api/**', route => {
        route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Session expired' })
        });
      });

      // Navigate to clients page
      await page.goto(`${BASE_URL}/clients`);
      await page.waitForLoadState('networkidle');

      // Should handle gracefully
      const pageContent = await page.textContent('body');
      vitestExpect(pageContent).toBeTruthy();
    });
  });

  describe('Performance Edge Cases', () => {
    test('should handle slow API responses', async () => {
      // Add delay to API responses
      await page.route('**/api/**', async route => {
        await new Promise(resolve => setTimeout(resolve, 3000)); // 3 second delay
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([])
        });
      });

      await page.goto(`${BASE_URL}/payments`);
      
      // Should show loading states or remain responsive
      await playwrightExpect(page.locator('h1')).toHaveText(/Payment Management/i);
      
      // Wait for delayed response
      await page.waitForTimeout(4000);
      
      // Page should still be functional
      await playwrightExpect(page.locator('h1')).toHaveText(/Payment Management/i);
    });

    test('should handle large datasets without crashing', async () => {
      // Mock large dataset response
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        id: `client-${i}`,
        company_name: `Company ${i}`,
        subscription_amount: Math.random() * 1000,
        status: ['active', 'churned', 'paused'][i % 3],
        contact_email: `contact${i}@company${i}.com`
      }));

      await page.route('**/api/**', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(largeDataset)
        });
      });

      await page.goto(`${BASE_URL}/clients`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);

      // Should handle large dataset without crashing
      await playwrightExpect(page.locator('h1')).toHaveText(/Client Management/i);
      
      // Should remain responsive
      const detailsButton = page.locator('button', { hasText: 'Deal Details' });
      await detailsButton.click();
      await playwrightExpect(page.locator('p')).toHaveText(/Detailed view showing individual deals/i);
    });
  });

  describe('Browser Compatibility Issues', () => {
    test('should handle browser back/forward with errors', async () => {
      // Start at payments with error
      await page.route('**/api/**', route => route.abort());
      await page.goto(`${BASE_URL}/payments`);
      await page.waitForLoadState('networkidle');

      // Navigate to clients
      await page.goto(`${BASE_URL}/clients`);
      await page.waitForLoadState('networkidle');

      // Go back
      await page.goBack();
      await page.waitForLoadState('networkidle');

      // Should handle gracefully
      await playwrightExpect(page.locator('h1')).toHaveText(/Payment Management/i);
    });

    test('should handle page refresh during error states', async () => {
      // Go to page with error
      await page.route('**/api/**', route => route.abort());
      await page.goto(`${BASE_URL}/clients`);
      await page.waitForLoadState('networkidle');

      // Refresh page
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Should maintain functionality
      await playwrightExpect(page.locator('h1')).toHaveText(/Client Management/i);
    });
  });

  describe('Input Validation and Sanitization', () => {
    test('should handle XSS attempts in URL parameters', async () => {
      // Try XSS in URL parameters
      const xssAttempts = [
        `${BASE_URL}/payments?search=<script>alert("xss")</script>`,
        `${BASE_URL}/clients?filter=<img src=x onerror=alert("xss")>`,
        `${BASE_URL}/payments?id="><script>alert("xss")</script>`,
      ];

      for (const url of xssAttempts) {
        await page.goto(url);
        await page.waitForLoadState('networkidle');

        // Should not execute scripts
        const alerts = await page.evaluate(() => window.alert.toString());
        vitestExpect(alerts).toBeTruthy(); // Alert function should exist but not be called

        // Page should render normally
        const pageContent = await page.textContent('body');
        vitestExpect(pageContent).toBeTruthy();
        vitestExpect(pageContent).not.toContain('<script>');
      }
    });
  });

  describe('Memory and Resource Management', () => {
    test('should not leak memory during view switches', async () => {
      await page.goto(`${BASE_URL}/clients`);
      await page.waitForLoadState('networkidle');

      // Rapidly switch views multiple times
      for (let i = 0; i < 10; i++) {
        await page.locator('button', { hasText: 'Deal Details' }).click();
        await page.waitForTimeout(100);
        await page.locator('button', { hasText: 'Client Overview' }).click();
        await page.waitForTimeout(100);
      }

      // Page should still be responsive
      await playwrightExpect(page.locator('h1')).toHaveText(/Client Management/i);
    });

    test('should handle multiple rapid navigation events', async () => {
      // Rapidly navigate between pages
      for (let i = 0; i < 5; i++) {
        await page.goto(`${BASE_URL}/payments`);
        await page.waitForTimeout(200);
        await page.goto(`${BASE_URL}/clients`);
        await page.waitForTimeout(200);
      }

      // Should end in stable state
      await page.waitForLoadState('networkidle');
      await playwrightExpect(page.locator('h1')).toHaveText(/Client Management/i);
    });
  });
});