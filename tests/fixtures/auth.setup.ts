import { test as setup, expect } from '@playwright/test';

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  // Navigate to the login page
  await page.goto('/auth');

  // Use Playwright test user credentials that mirror andrew.bryce's access
  const testEmail = process.env.TEST_USER_EMAIL || 'playwright@test.com';
  const testPassword = process.env.TEST_USER_PASSWORD || 'TestPassword123!';
  
  console.log(`Authenticating as Playwright test user: ${testEmail}`);

  // Fill login form with test credentials
  await page.fill('input[type="email"]', testEmail);
  await page.fill('input[type="password"]', testPassword);
  
  // Click login button
  await page.click('button[type="submit"]');

  // Wait for successful login (adjust selector based on your app)
  await page.waitForURL('/dashboard', { timeout: 30000 });
  
  // Verify we're logged in
  await expect(page.locator('[data-testid="user-menu"], .user-avatar, text=Dashboard')).toBeVisible();

  // Save authentication state
  await page.context().storageState({ path: authFile });
  
  console.log('✅ Playwright test user authenticated successfully');
});