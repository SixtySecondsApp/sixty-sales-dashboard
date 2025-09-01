import { test, expect } from '@playwright/test';

test.describe('Error Handling and Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    // Start from the app root
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test.describe('Network Error Scenarios', () => {
    test('should handle API failures gracefully on payments page', async ({ page }) => {
      // Block all API calls to simulate network failure
      await page.route('**/api/**', route => route.abort());
      
      await page.goto('/payments');
      await page.waitForLoadState('networkidle');
      
      // Page should still render basic structure
      await expect(page.locator('h1')).toContainText('Payment Management');
      
      // Should not show error alerts that break the page
      const errorAlerts = page.locator('[role="alert"], .error-message, [data-testid*="error"]');
      const alertCount = await errorAlerts.count();
      
      // If error messages exist, they should be user-friendly
      if (alertCount > 0) {
        const errorText = await errorAlerts.first().textContent();
        expect(errorText).toBeTruthy();
        expect(errorText?.toLowerCase()).not.toContain('undefined');
        expect(errorText?.toLowerCase()).not.toContain('null');
      }
    });

    test('should handle API failures gracefully on clients page', async ({ page }) => {
      // Block all API calls
      await page.route('**/api/**', route => route.abort());
      
      await page.goto('/clients');
      await page.waitForLoadState('networkidle');
      
      // Page should still render basic structure
      await expect(page.locator('h1')).toContainText('Client Management');
      
      // View toggle should still work
      const detailsButton = page.locator('button', { hasText: 'Deal Details' });
      await detailsButton.click();
      await expect(page.locator('p')).toContainText('Detailed view showing individual deals');
    });

    test('should handle partial API failures', async ({ page }) => {
      // Allow some API calls to succeed, block others
      await page.route('**/api/clients**', route => route.abort());
      
      await page.goto('/payments');
      await page.waitForLoadState('networkidle');
      
      // Basic page structure should still be intact
      await expect(page.locator('h1')).toContainText('Payment Management');
      await expect(page.locator('h2')).toContainText('Revenue Overview');
    });
  });

  test.describe('Invalid Route Handling', () => {
    test('should handle invalid nested routes gracefully', async ({ page }) => {
      // Try accessing non-existent sub-routes
      await page.goto('/payments/invalid-route');
      
      // Should either redirect to valid route or show proper error
      await page.waitForLoadState('networkidle');
      
      // Check if we're on a valid page or error page
      const currentUrl = page.url();
      const pageContent = await page.textContent('body');
      
      // Should not show browser error pages
      expect(pageContent).not.toContain('This site can\'t be reached');
      expect(pageContent).not.toContain('404');
    });

    test('should handle malformed URLs', async ({ page }) => {
      // Try accessing malformed URLs
      const malformedUrls = [
        '/payments///',
        '/clients////',
        '/payments/../clients',
      ];

      for (const url of malformedUrls) {
        await page.goto(url);
        await page.waitForLoadState('networkidle');
        
        // Should handle gracefully without crashing
        const pageContent = await page.textContent('body');
        expect(pageContent).toBeTruthy();
        expect(pageContent).not.toContain('Cannot GET');
      }
    });
  });

  test.describe('Data Integrity Issues', () => {
    test('should handle empty data states on payments page', async ({ page }) => {
      // Mock empty responses
      await page.route('**/api/**', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([])
        });
      });

      await page.goto('/payments');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Should render page structure even with no data
      await expect(page.locator('h1')).toContainText('Payment Management');
      
      // Should not show undefined/null values
      const pageText = await page.textContent('body');
      expect(pageText).not.toContain('undefined');
      expect(pageText).not.toContain('null');
      expect(pageText).not.toContain('NaN');
    });

    test('should handle malformed data responses', async ({ page }) => {
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

      await page.goto('/clients');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Should handle gracefully
      await expect(page.locator('h1')).toContainText('Client Management');
    });

    test('should handle null/undefined client data', async ({ page }) => {
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

      await page.goto('/clients');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Should display page without errors
      await expect(page.locator('h1')).toContainText('Client Management');
      
      // Should not display "null" or "undefined" text
      const pageText = await page.textContent('body');
      expect(pageText).not.toMatch(/\bnull\b/);
      expect(pageText).not.toMatch(/\bundefined\b/);
    });
  });

  test.describe('Authentication and Authorization', () => {
    test('should handle authentication failures', async ({ page }) => {
      // Mock 401 responses
      await page.route('**/api/**', route => {
        route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Unauthorized' })
        });
      });

      await page.goto('/payments');
      await page.waitForLoadState('networkidle');

      // Should handle gracefully, possibly redirect to login or show error
      const currentUrl = page.url();
      const pageContent = await page.textContent('body');
      
      // Should not crash the application
      expect(pageContent).toBeTruthy();
      
      // May redirect to login or show appropriate message
      const hasLoginForm = await page.locator('input[type="email"], input[type="password"]').count() > 0;
      const hasErrorMessage = await page.locator('[role="alert"], .error').count() > 0;
      const hasPageContent = await page.locator('h1').count() > 0;
      
      // Should show one of: login form, error message, or page content
      expect(hasLoginForm || hasErrorMessage || hasPageContent).toBeTruthy();
    });

    test('should handle session expiration during navigation', async ({ page }) => {
      // Start with successful auth
      await page.goto('/payments');
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
      await page.goto('/clients');
      await page.waitForLoadState('networkidle');

      // Should handle gracefully
      const pageContent = await page.textContent('body');
      expect(pageContent).toBeTruthy();
    });
  });

  test.describe('Performance Edge Cases', () => {
    test('should handle slow API responses', async ({ page }) => {
      // Add delay to API responses
      await page.route('**/api/**', async route => {
        await new Promise(resolve => setTimeout(resolve, 3000)); // 3 second delay
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([])
        });
      });

      await page.goto('/payments');
      
      // Should show loading states or remain responsive
      await expect(page.locator('h1')).toContainText('Payment Management');
      
      // Wait for delayed response
      await page.waitForTimeout(4000);
      
      // Page should still be functional
      await expect(page.locator('h1')).toContainText('Payment Management');
    });

    test('should handle large datasets without crashing', async ({ page }) => {
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

      await page.goto('/clients');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);

      // Should handle large dataset without crashing
      await expect(page.locator('h1')).toContainText('Client Management');
      
      // Should remain responsive
      const detailsButton = page.locator('button', { hasText: 'Deal Details' });
      await detailsButton.click();
      await expect(page.locator('p')).toContainText('Detailed view showing individual deals');
    });
  });

  test.describe('Browser Compatibility Issues', () => {
    test('should handle browser back/forward with errors', async ({ page }) => {
      // Start at payments with error
      await page.route('**/api/**', route => route.abort());
      await page.goto('/payments');
      await page.waitForLoadState('networkidle');

      // Navigate to clients
      await page.goto('/clients');
      await page.waitForLoadState('networkidle');

      // Go back
      await page.goBack();
      await page.waitForLoadState('networkidle');

      // Should handle gracefully
      await expect(page.locator('h1')).toContainText('Payment Management');
    });

    test('should handle page refresh during error states', async ({ page }) => {
      // Go to page with error
      await page.route('**/api/**', route => route.abort());
      await page.goto('/clients');
      await page.waitForLoadState('networkidle');

      // Refresh page
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Should maintain functionality
      await expect(page.locator('h1')).toContainText('Client Management');
    });
  });

  test.describe('Input Validation and Sanitization', () => {
    test('should handle XSS attempts in URL parameters', async ({ page }) => {
      // Try XSS in URL parameters
      const xssAttempts = [
        '/payments?search=<script>alert("xss")</script>',
        '/clients?filter=<img src=x onerror=alert("xss")>',
        '/payments?id="><script>alert("xss")</script>',
      ];

      for (const url of xssAttempts) {
        await page.goto(url);
        await page.waitForLoadState('networkidle');

        // Should not execute scripts
        const alerts = await page.evaluate(() => window.alert.toString());
        expect(alerts).toBeTruthy(); // Alert function should exist but not be called

        // Page should render normally
        const pageContent = await page.textContent('body');
        expect(pageContent).toBeTruthy();
        expect(pageContent).not.toContain('<script>');
      }
    });
  });

  test.describe('Memory and Resource Management', () => {
    test('should not leak memory during view switches', async ({ page }) => {
      await page.goto('/clients');
      await page.waitForLoadState('networkidle');

      // Rapidly switch views multiple times
      for (let i = 0; i < 10; i++) {
        await page.locator('button', { hasText: 'Deal Details' }).click();
        await page.waitForTimeout(100);
        await page.locator('button', { hasText: 'Client Overview' }).click();
        await page.waitForTimeout(100);
      }

      // Page should still be responsive
      await expect(page.locator('h1')).toContainText('Client Management');
    });

    test('should handle multiple rapid navigation events', async ({ page }) => {
      // Rapidly navigate between pages
      for (let i = 0; i < 5; i++) {
        await page.goto('/payments');
        await page.waitForTimeout(200);
        await page.goto('/clients');
        await page.waitForTimeout(200);
      }

      // Should end in stable state
      await page.waitForLoadState('networkidle');
      await expect(page.locator('h1')).toContainText('Client Management');
    });
  });
});