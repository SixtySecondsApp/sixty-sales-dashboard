import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

// Load staging test environment variables
dotenv.config({ path: '.env.test.staging' });

/**
 * Playwright configuration for STAGING environment
 * Run with: npx playwright test --config=playwright.staging.config.ts
 * Or: npm run test:e2e:staging
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'playwright-report-staging' }],
    ['json', { outputFile: 'test-results-staging.json' }],
    ['junit', { outputFile: 'test-results-staging.xml' }]
  ],
  use: {
    // Use staging URL
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || 'https://staging.use60.com',

    // Collect trace when retrying the failed test
    trace: 'on-first-retry',

    // Take screenshot on failure
    screenshot: 'only-on-failure',

    // Video recording on failure
    video: 'retain-on-failure',

    // Global timeout for all tests
    actionTimeout: 15000,
    navigationTimeout: 45000,
  },

  projects: [
    {
      name: 'chromium-staging',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // No webServer for staging - we test against the deployed staging URL
  // webServer: undefined,
});
