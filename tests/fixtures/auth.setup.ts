import { test as setup, expect } from '@playwright/test';

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  // Navigate to the login page
  await page.goto('/auth');

  // Fill login form with test credentials (adjust based on your auth system)
  await page.fill('input[type="email"]', process.env.TEST_USER_EMAIL || 'test@example.com');
  await page.fill('input[type="password"]', process.env.TEST_USER_PASSWORD || 'testpassword123');
  
  // Click login button
  await page.click('button[type="submit"]');

  // Wait for successful login (adjust selector based on your app)
  await page.waitForURL('/dashboard', { timeout: 30000 });
  
  // Verify we're logged in
  await expect(page.locator('[data-testid="user-menu"], .user-avatar, text=Dashboard')).toBeVisible();

  // Save authentication state
  await page.context().storageState({ path: authFile });
});