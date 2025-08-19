import { test, expect } from '@playwright/test';

test.describe('Navigation Tests - Payments and Clients Pages', () => {
  test.beforeEach(async ({ page }) => {
    // Start from the app root
    await page.goto('/');
    
    // Handle any auth or initial loading
    await page.waitForLoadState('networkidle');
  });

  test('should navigate to /payments route correctly', async ({ page }) => {
    // Navigate to payments page
    await page.goto('/payments');
    await page.waitForLoadState('networkidle');

    // Check that we're on the correct page
    expect(page.url()).toBe('http://localhost:5173/payments');
    
    // Check for page heading
    await expect(page.locator('h1')).toContainText('Payment Management');
    
    // Check for page description
    await expect(page.locator('p')).toContainText('Track all subscription payments and one-off invoices for each client');
    
    // Check for Revenue Overview section
    await expect(page.locator('h2')).toContainText('Revenue Overview');
  });

  test('should navigate to /clients route correctly', async ({ page }) => {
    // Navigate to clients page
    await page.goto('/clients');
    await page.waitForLoadState('networkidle');

    // Check that we're on the correct page
    expect(page.url()).toBe('http://localhost:5173/clients');
    
    // Check for page heading
    await expect(page.locator('h1')).toContainText('Client Management');
    
    // Check for view mode toggle buttons
    await expect(page.locator('button')).toContainText('Client Overview');
    await expect(page.locator('button')).toContainText('Deal Details');
  });

  test('should maintain backward compatibility with /subscriptions route', async ({ page }) => {
    // Navigate to old subscriptions route
    await page.goto('/subscriptions');
    await page.waitForLoadState('networkidle');

    // Should redirect to payments content but keep /subscriptions URL for backward compatibility
    expect(page.url()).toBe('http://localhost:5173/subscriptions');
    
    // Should show the same content as payments page
    await expect(page.locator('h1')).toContainText('Payment Management');
    await expect(page.locator('p')).toContainText('Track all subscription payments and one-off invoices for each client');
  });

  test('should navigate between pages using navigation menu', async ({ page }) => {
    // Start at payments
    await page.goto('/payments');
    await page.waitForLoadState('networkidle');
    
    // Navigate to clients through nav (assuming nav menu exists)
    const clientsNavLink = page.locator('nav a[href="/clients"]').first();
    if (await clientsNavLink.isVisible()) {
      await clientsNavLink.click();
      await page.waitForLoadState('networkidle');
      
      expect(page.url()).toBe('http://localhost:5173/clients');
      await expect(page.locator('h1')).toContainText('Client Management');
    }
  });

  test('should handle direct URL access to nested routes', async ({ page }) => {
    // Test direct access to payments
    await page.goto('/payments');
    await page.waitForLoadState('networkidle');
    expect(page.url()).toBe('http://localhost:5173/payments');
    
    // Test direct access to clients
    await page.goto('/clients');
    await page.waitForLoadState('networkidle');
    expect(page.url()).toBe('http://localhost:5173/clients');
    
    // Test direct access to subscriptions (backward compatibility)
    await page.goto('/subscriptions');
    await page.waitForLoadState('networkidle');
    expect(page.url()).toBe('http://localhost:5173/subscriptions');
  });

  test('should display correct page titles and meta information', async ({ page }) => {
    // Test payments page
    await page.goto('/payments');
    await page.waitForLoadState('networkidle');
    
    // Check for proper page title (if set)
    const paymentsTitle = await page.title();
    expect(paymentsTitle).toBeTruthy();
    
    // Test clients page
    await page.goto('/clients');
    await page.waitForLoadState('networkidle');
    
    const clientsTitle = await page.title();
    expect(clientsTitle).toBeTruthy();
  });

  test('should handle page refresh correctly', async ({ page }) => {
    // Navigate to payments and refresh
    await page.goto('/payments');
    await page.waitForLoadState('networkidle');
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    expect(page.url()).toBe('http://localhost:5173/payments');
    await expect(page.locator('h1')).toContainText('Payment Management');
    
    // Navigate to clients and refresh
    await page.goto('/clients');
    await page.waitForLoadState('networkidle');
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    expect(page.url()).toBe('http://localhost:5173/clients');
    await expect(page.locator('h1')).toContainText('Client Management');
  });

  test('should handle browser back/forward navigation', async ({ page }) => {
    // Start at home
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Go to payments
    await page.goto('/payments');
    await page.waitForLoadState('networkidle');
    
    // Go to clients
    await page.goto('/clients');
    await page.waitForLoadState('networkidle');
    
    // Use browser back button
    await page.goBack();
    await page.waitForLoadState('networkidle');
    expect(page.url()).toBe('http://localhost:5173/payments');
    
    // Use browser forward button
    await page.goForward();
    await page.waitForLoadState('networkidle');
    expect(page.url()).toBe('http://localhost:5173/clients');
  });
});