import { describe, test, expect as vitestExpect, beforeAll, afterAll, beforeEach } from 'vitest';
import { expect as playwrightExpect } from '../fixtures/playwright-assertions';
import { setupPlaywriter, teardownPlaywriter } from '../fixtures/playwriter-setup';
import type { Page } from 'playwright-core';

const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || process.env.VITE_BASE_URL || 'http://localhost:5175';

describe('Navigation Tests - Payments and Clients Pages', () => {
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
    
    // Handle any auth or initial loading
    await page.waitForLoadState('networkidle');
  });

  test('should navigate to /payments route correctly', async () => {
    // Navigate to payments page
    await page.goto(`${BASE_URL}/payments`);
    await page.waitForLoadState('networkidle');

    // Check that we're on the correct page
    vitestExpect(page.url()).toBe(`${BASE_URL}/payments`);
    
    // Check for page heading
    await playwrightExpect(page.locator('h1')).toHaveText(/Payment Management/i);
    
    // Check for page description
    await playwrightExpect(page.locator('p')).toHaveText(/Track all subscription payments/i);
    
    // Check for Revenue Overview section
    await playwrightExpect(page.locator('h2')).toHaveText(/Revenue Overview/i);
  });

  test('should navigate to /clients route correctly', async () => {
    // Navigate to clients page
    await page.goto(`${BASE_URL}/clients`);
    await page.waitForLoadState('networkidle');

    // Check that we're on the correct page
    vitestExpect(page.url()).toBe(`${BASE_URL}/clients`);
    
    // Check for page heading
    await playwrightExpect(page.locator('h1')).toHaveText(/Client Management/i);
    
    // Check for view mode toggle buttons
    await playwrightExpect(page.locator('button')).toHaveText(/Client Overview/i);
    await playwrightExpect(page.locator('button')).toHaveText(/Deal Details/i);
  });

  test('should maintain backward compatibility with /subscriptions route', async () => {
    // Navigate to old subscriptions route
    await page.goto(`${BASE_URL}/subscriptions`);
    await page.waitForLoadState('networkidle');

    // Should redirect to payments content but keep /subscriptions URL for backward compatibility
    vitestExpect(page.url()).toBe(`${BASE_URL}/subscriptions`);
    
    // Should show the same content as payments page
    await playwrightExpect(page.locator('h1')).toHaveText(/Payment Management/i);
    await playwrightExpect(page.locator('p')).toHaveText(/Track all subscription payments/i);
  });

  test('should navigate between pages using navigation menu', async () => {
    // Start at payments
    await page.goto(`${BASE_URL}/payments`);
    await page.waitForLoadState('networkidle');
    
    // Navigate to clients through nav (assuming nav menu exists)
    const clientsNavLink = page.locator('nav a[href="/clients"]').first();
    if (await clientsNavLink.isVisible()) {
      await clientsNavLink.click();
      await page.waitForLoadState('networkidle');
      
      vitestExpect(page.url()).toBe(`${BASE_URL}/clients`);
      await playwrightExpect(page.locator('h1')).toHaveText(/Client Management/i);
    }
  });

  test('should handle direct URL access to nested routes', async () => {
    // Test direct access to payments
    await page.goto(`${BASE_URL}/payments`);
    await page.waitForLoadState('networkidle');
    vitestExpect(page.url()).toBe(`${BASE_URL}/payments`);
    
    // Test direct access to clients
    await page.goto(`${BASE_URL}/clients`);
    await page.waitForLoadState('networkidle');
    vitestExpect(page.url()).toBe(`${BASE_URL}/clients`);
    
    // Test direct access to subscriptions (backward compatibility)
    await page.goto(`${BASE_URL}/subscriptions`);
    await page.waitForLoadState('networkidle');
    vitestExpect(page.url()).toBe(`${BASE_URL}/subscriptions`);
  });

  test('should display correct page titles and meta information', async () => {
    // Test payments page
    await page.goto(`${BASE_URL}/payments`);
    await page.waitForLoadState('networkidle');
    
    // Check for proper page title (if set)
    const paymentsTitle = await page.title();
    vitestExpect(paymentsTitle).toBeTruthy();
    
    // Test clients page
    await page.goto(`${BASE_URL}/clients`);
    await page.waitForLoadState('networkidle');
    
    const clientsTitle = await page.title();
    vitestExpect(clientsTitle).toBeTruthy();
  });

  test('should handle page refresh correctly', async () => {
    // Navigate to payments and refresh
    await page.goto(`${BASE_URL}/payments`);
    await page.waitForLoadState('networkidle');
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    vitestExpect(page.url()).toBe(`${BASE_URL}/payments`);
    await playwrightExpect(page.locator('h1')).toHaveText(/Payment Management/i);
    
    // Navigate to clients and refresh
    await page.goto(`${BASE_URL}/clients`);
    await page.waitForLoadState('networkidle');
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    vitestExpect(page.url()).toBe(`${BASE_URL}/clients`);
    await playwrightExpect(page.locator('h1')).toHaveText(/Client Management/i);
  });

  test('should handle browser back/forward navigation', async () => {
    // Start at home
    await page.goto(`${BASE_URL}/`);
    await page.waitForLoadState('networkidle');
    
    // Go to payments
    await page.goto(`${BASE_URL}/payments`);
    await page.waitForLoadState('networkidle');
    
    // Go to clients
    await page.goto(`${BASE_URL}/clients`);
    await page.waitForLoadState('networkidle');
    
    // Use browser back button
    await page.goBack();
    await page.waitForLoadState('networkidle');
    vitestExpect(page.url()).toBe(`${BASE_URL}/payments`);
    
    // Use browser forward button
    await page.goForward();
    await page.waitForLoadState('networkidle');
    vitestExpect(page.url()).toBe(`${BASE_URL}/clients`);
  });
});
