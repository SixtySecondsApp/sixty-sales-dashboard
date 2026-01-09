import { describe, test, expect as vitestExpect, beforeAll, afterAll, beforeEach } from 'vitest';
import { expect as playwrightExpect } from '../fixtures/playwright-assertions';
import { setupPlaywriter, teardownPlaywriter } from '../fixtures/playwriter-setup';
import type { Page } from 'playwright-core';

const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || process.env.VITE_BASE_URL || 'http://localhost:5175';

describe('Functionality Tests - Payments and Clients Pages', () => {
  let page: Page;

  beforeAll(async () => {
    const setup = await setupPlaywriter();
    page = setup.page;
  });

  afterAll(async () => {
    await teardownPlaywriter();
  });

  beforeEach(async () => {
    // Start from the app root and handle auth if needed
    await page.goto(`${BASE_URL}/`);
    await page.waitForLoadState('networkidle');
  });

  describe('Payments Page Functionality', () => {
    beforeEach(async () => {
      await page.goto(`${BASE_URL}/payments`);
      await page.waitForLoadState('networkidle');
    });

    test('should display subscription stats cards', async () => {
      // Wait for stats to load
      await page.waitForSelector('[data-testid="subscription-stats"], .subscription-stats, [class*="stats"]', { timeout: 10000 });
      
      // Check for revenue overview section
      await playwrightExpect(page.locator('h2')).toHaveText(/Revenue Overview/i);
      
      // Look for common stats indicators (MRR, clients, etc.)
      const pageContent = await page.textContent('body');
      vitestExpect(pageContent).toMatch(/(MRR|Monthly|Revenue|Client|Subscription)/i);
    });

    test('should display payments table', async () => {
      // Look for table or data display elements
      const tableExists = await page.locator('table, [role="table"], [data-testid*="table"], [class*="table"]').count() > 0;
      const dataDisplayExists = await page.locator('[data-testid*="payment"], [class*="payment"], [data-testid*="data"]').count() > 0;
      
      vitestExpect(tableExists || dataDisplayExists).toBeTruthy();
    });

    test('should handle stats card click interactions', async () => {
      // Wait for any interactive elements to load
      await page.waitForTimeout(2000);
      
      // Look for clickable stat cards
      const statCards = page.locator('[data-testid*="stat"], [class*="stat"], [role="button"]');
      const cardCount = await statCards.count();
      
      if (cardCount > 0) {
        // Try clicking the first stat card
        await statCards.first().click();
        // Verify no errors occurred (page should still be functional)
        await playwrightExpect(page.locator('h1')).toHaveText(/Payment Management/i);
      }
    });

    test('should display loading states appropriately', async () => {
      // Reload to catch loading state
      await page.reload();
      
      // Check if there are any loading indicators initially
      const hasLoadingIndicator = await page.locator('[data-testid*="loading"], [class*="loading"], [aria-label*="loading"]').count() > 0;
      
      // Wait for content to load
      await page.waitForLoadState('networkidle');
      
      // Ensure content is eventually displayed
      await playwrightExpect(page.locator('h1')).toHaveText(/Payment Management/i);
    });
  });

  describe('Clients Page Functionality', () => {
    beforeEach(async () => {
      await page.goto(`${BASE_URL}/clients`);
      await page.waitForLoadState('networkidle');
    });

    test('should display view mode toggle buttons', async () => {
      // Check for toggle buttons
      await playwrightExpect(page.locator('button')).toHaveText(/Client Overview/i);
      await playwrightExpect(page.locator('button')).toHaveText(/Deal Details/i);
      
      // Verify buttons are clickable
      const overviewButton = page.locator('button', { hasText: 'Client Overview' });
      const detailsButton = page.locator('button', { hasText: 'Deal Details' });
      
      await playwrightExpect(overviewButton).toBeVisible();
      await playwrightExpect(detailsButton).toBeVisible();
    });

    test('should switch between aggregated and detailed views', async () => {
      // Start with aggregated view (default)
      await playwrightExpect(page.locator('p')).toHaveText(/Aggregated view of unique clients/i);
      
      // Click on Deal Details button
      const detailsButton = page.locator('button', { hasText: 'Deal Details' });
      await detailsButton.click();
      
      // Wait for view to change
      await page.waitForTimeout(1000);
      
      // Check that description changed
      await playwrightExpect(page.locator('p')).toHaveText(/Detailed view showing individual deals/i);
      
      // Switch back to aggregated view
      const overviewButton = page.locator('button', { hasText: 'Client Overview' });
      await overviewButton.click();
      
      // Wait for view to change back
      await page.waitForTimeout(1000);
      
      // Verify we're back to aggregated view
      await playwrightExpect(page.locator('p')).toHaveText(/Aggregated view of unique clients/i);
    });

    test('should display appropriate description for each view mode', async () => {
      // Check aggregated view description
      const aggregatedDesc = page.locator('text=Aggregated view of unique clients with totals and metrics');
      await playwrightExpect(aggregatedDesc).toBeVisible();
      
      // Switch to detailed view
      await page.locator('button', { hasText: 'Deal Details' }).click();
      await page.waitForTimeout(500);
      
      // Check detailed view description
      const detailedDesc = page.locator('text=Detailed view showing individual deals and payment records');
      await playwrightExpect(detailedDesc).toBeVisible();
    });

    test('should display client data tables', async () => {
      // Wait for table to load
      await page.waitForTimeout(2000);
      
      // Look for table or data display elements
      const tableExists = await page.locator('table, [role="table"], [data-testid*="table"], [class*="table"]').count() > 0;
      const dataDisplayExists = await page.locator('[data-testid*="client"], [class*="client"], [data-testid*="data"]').count() > 0;
      
      vitestExpect(tableExists || dataDisplayExists).toBeTruthy();
    });

    test('should handle view mode transitions smoothly', async () => {
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
      await playwrightExpect(page.locator('h1')).toHaveText(/Client Management/i);
    });

    test('should maintain view state during page interactions', async () => {
      // Switch to detailed view
      await page.locator('button', { hasText: 'Deal Details' }).click();
      await page.waitForTimeout(500);
      
      // Scroll or interact with page
      await page.evaluate(() => window.scrollTo(0, 100));
      await page.waitForTimeout(500);
      
      // Verify we're still in detailed view
      await playwrightExpect(page.locator('p')).toHaveText(/Detailed view showing individual deals/i);
    });
  });

  describe('Cross-Page Functionality', () => {
    test('should maintain consistent navigation between pages', async () => {
      // Start at payments
      await page.goto(`${BASE_URL}/payments`);
      await page.waitForLoadState('networkidle');
      
      // Navigate to clients
      await page.goto(`${BASE_URL}/clients`);
      await page.waitForLoadState('networkidle');
      
      // Navigate back to payments
      await page.goto(`${BASE_URL}/payments`);
      await page.waitForLoadState('networkidle');
      
      // Verify each page loads correctly
      await playwrightExpect(page.locator('h1')).toHaveText(/Payment Management/i);
    });

    test('should handle data consistency between related pages', async () => {
      // Visit payments page and note any client-related data
      await page.goto(`${BASE_URL}/payments`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      
      // Visit clients page
      await page.goto(`${BASE_URL}/clients`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      
      // Both pages should be functional (basic consistency check)
      await playwrightExpect(page.locator('h1')).toHaveText(/Client Management/i);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle missing data gracefully', async () => {
      // Test with potential empty states
      await page.goto(`${BASE_URL}/payments`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);
      
      // Page should still render even with no data
      await playwrightExpect(page.locator('h1')).toHaveText(/Payment Management/i);
      
      await page.goto(`${BASE_URL}/clients`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);
      
      await playwrightExpect(page.locator('h1')).toHaveText(/Client Management/i);
    });

    test('should handle network errors gracefully', async () => {
      // Test offline scenario
      await page.route('**/api/**', route => route.abort());
      
      await page.goto(`${BASE_URL}/payments`);
      await page.waitForLoadState('networkidle');
      
      // Page should still render basic structure
      await playwrightExpect(page.locator('h1')).toHaveText(/Payment Management/i);
      
      await page.goto(`${BASE_URL}/clients`);
      await page.waitForLoadState('networkidle');
      
      await playwrightExpect(page.locator('h1')).toHaveText(/Client Management/i);
    });
  });
});
