import { test, expect } from '@playwright/test';

test.describe('Functionality Tests - Payments and Clients Pages', () => {
  test.beforeEach(async ({ page }) => {
    // Start from the app root and handle auth if needed
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test.describe('Payments Page Functionality', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/payments');
      await page.waitForLoadState('networkidle');
    });

    test('should display subscription stats cards', async ({ page }) => {
      // Wait for stats to load
      await page.waitForSelector('[data-testid="subscription-stats"], .subscription-stats, [class*="stats"]', { timeout: 10000 });
      
      // Check for revenue overview section
      await expect(page.locator('h2')).toContainText('Revenue Overview');
      
      // Look for common stats indicators (MRR, clients, etc.)
      const pageContent = await page.textContent('body');
      expect(pageContent).toMatch(/(MRR|Monthly|Revenue|Client|Subscription)/i);
    });

    test('should display payments table', async ({ page }) => {
      // Look for table or data display elements
      const tableExists = await page.locator('table, [role="table"], [data-testid*="table"], [class*="table"]').count() > 0;
      const dataDisplayExists = await page.locator('[data-testid*="payment"], [class*="payment"], [data-testid*="data"]').count() > 0;
      
      expect(tableExists || dataDisplayExists).toBeTruthy();
    });

    test('should handle stats card click interactions', async ({ page }) => {
      // Wait for any interactive elements to load
      await page.waitForTimeout(2000);
      
      // Look for clickable stat cards
      const statCards = page.locator('[data-testid*="stat"], [class*="stat"], [role="button"]');
      const cardCount = await statCards.count();
      
      if (cardCount > 0) {
        // Try clicking the first stat card
        await statCards.first().click();
        // Verify no errors occurred (page should still be functional)
        await expect(page.locator('h1')).toContainText('Payment Management');
      }
    });

    test('should display loading states appropriately', async ({ page }) => {
      // Reload to catch loading state
      await page.reload();
      
      // Check if there are any loading indicators initially
      const hasLoadingIndicator = await page.locator('[data-testid*="loading"], [class*="loading"], [aria-label*="loading"]').count() > 0;
      
      // Wait for content to load
      await page.waitForLoadState('networkidle');
      
      // Ensure content is eventually displayed
      await expect(page.locator('h1')).toContainText('Payment Management');
    });
  });

  test.describe('Clients Page Functionality', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/clients');
      await page.waitForLoadState('networkidle');
    });

    test('should display view mode toggle buttons', async ({ page }) => {
      // Check for toggle buttons
      await expect(page.locator('button')).toContainText('Client Overview');
      await expect(page.locator('button')).toContainText('Deal Details');
      
      // Verify buttons are clickable
      const overviewButton = page.locator('button', { hasText: 'Client Overview' });
      const detailsButton = page.locator('button', { hasText: 'Deal Details' });
      
      await expect(overviewButton).toBeVisible();
      await expect(detailsButton).toBeVisible();
    });

    test('should switch between aggregated and detailed views', async ({ page }) => {
      // Start with aggregated view (default)
      await expect(page.locator('p')).toContainText('Aggregated view of unique clients');
      
      // Click on Deal Details button
      const detailsButton = page.locator('button', { hasText: 'Deal Details' });
      await detailsButton.click();
      
      // Wait for view to change
      await page.waitForTimeout(1000);
      
      // Check that description changed
      await expect(page.locator('p')).toContainText('Detailed view showing individual deals');
      
      // Switch back to aggregated view
      const overviewButton = page.locator('button', { hasText: 'Client Overview' });
      await overviewButton.click();
      
      // Wait for view to change back
      await page.waitForTimeout(1000);
      
      // Verify we're back to aggregated view
      await expect(page.locator('p')).toContainText('Aggregated view of unique clients');
    });

    test('should display appropriate description for each view mode', async ({ page }) => {
      // Check aggregated view description
      const aggregatedDesc = page.locator('text=Aggregated view of unique clients with totals and metrics');
      await expect(aggregatedDesc).toBeVisible();
      
      // Switch to detailed view
      await page.locator('button', { hasText: 'Deal Details' }).click();
      await page.waitForTimeout(500);
      
      // Check detailed view description
      const detailedDesc = page.locator('text=Detailed view showing individual deals and payment records');
      await expect(detailedDesc).toBeVisible();
    });

    test('should display client data tables', async ({ page }) => {
      // Wait for table to load
      await page.waitForTimeout(2000);
      
      // Look for table or data display elements
      const tableExists = await page.locator('table, [role="table"], [data-testid*="table"], [class*="table"]').count() > 0;
      const dataDisplayExists = await page.locator('[data-testid*="client"], [class*="client"], [data-testid*="data"]').count() > 0;
      
      expect(tableExists || dataDisplayExists).toBeTruthy();
    });

    test('should handle view mode transitions smoothly', async ({ page }) => {
      // Test multiple rapid switches
      const overviewButton = page.locator('button', { hasText: 'Client Overview' });
      const detailsButton = page.locator('button', { hasText: 'Deal Details' });
      
      // Rapid switching test
      await detailsButton.click();
      await page.waitForTimeout(200);
      await overviewButton.click();
      await page.waitForTimeout(200);
      await detailsButton.click();
      await page.waitForTimeout(200);
      await overviewButton.click();
      
      // Ensure we end up in a stable state
      await page.waitForTimeout(1000);
      await expect(page.locator('h1')).toContainText('Client Management');
    });

    test('should maintain view state during page interactions', async ({ page }) => {
      // Switch to detailed view
      await page.locator('button', { hasText: 'Deal Details' }).click();
      await page.waitForTimeout(500);
      
      // Scroll or interact with page
      await page.evaluate(() => window.scrollTo(0, 100));
      await page.waitForTimeout(500);
      
      // Verify we're still in detailed view
      await expect(page.locator('p')).toContainText('Detailed view showing individual deals');
    });
  });

  test.describe('Cross-Page Functionality', () => {
    test('should maintain consistent navigation between pages', async ({ page }) => {
      // Start at payments
      await page.goto('/payments');
      await page.waitForLoadState('networkidle');
      
      // Navigate to clients
      await page.goto('/clients');
      await page.waitForLoadState('networkidle');
      
      // Navigate back to payments
      await page.goto('/payments');
      await page.waitForLoadState('networkidle');
      
      // Verify each page loads correctly
      await expect(page.locator('h1')).toContainText('Payment Management');
    });

    test('should handle data consistency between related pages', async ({ page }) => {
      // Visit payments page and note any client-related data
      await page.goto('/payments');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      
      // Visit clients page
      await page.goto('/clients');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      
      // Both pages should be functional (basic consistency check)
      await expect(page.locator('h1')).toContainText('Client Management');
    });
  });

  test.describe('Error Handling and Edge Cases', () => {
    test('should handle missing data gracefully', async ({ page }) => {
      // Test with potential empty states
      await page.goto('/payments');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);
      
      // Page should still render even with no data
      await expect(page.locator('h1')).toContainText('Payment Management');
      
      await page.goto('/clients');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);
      
      await expect(page.locator('h1')).toContainText('Client Management');
    });

    test('should handle network errors gracefully', async ({ page }) => {
      // Test offline scenario
      await page.route('**/api/**', route => route.abort());
      
      await page.goto('/payments');
      await page.waitForLoadState('networkidle');
      
      // Page should still render basic structure
      await expect(page.locator('h1')).toContainText('Payment Management');
      
      await page.goto('/clients');
      await page.waitForLoadState('networkidle');
      
      await expect(page.locator('h1')).toContainText('Client Management');
    });
  });
});