// NOTE: This config file is deprecated - we now use playwriter MCP with vitest
// Kept for reference only. Tests are now run via vitest with playwriter setup.
// See tests/fixtures/playwriter-setup.ts for the new setup

import dotenv from 'dotenv';

// Load staging test environment variables
dotenv.config({ path: '.env.test.staging' });

/**
 * @deprecated - Use vitest with playwriter instead
 * @see tests/fixtures/playwriter-setup.ts for new setup
 * 
 * Playwriter configuration for STAGING environment
 *
 * Strategy: Run local Vite dev server connected to STAGING Supabase backend
 * This bypasses Vercel's SSO protection on preview deployments while still
 * testing against the staging database and edge functions.
 *
 * Run with: npm run test:e2e:staging
 */
export default {
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
    // Local dev server connected to staging backend
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:5175',

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

  // Start local dev server with staging environment variables
  // The .env.test.staging file configures Supabase to use staging backend
  webServer: {
    command: 'npm run dev -- --mode staging',
    url: 'http://localhost:5175',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    env: {
      ...process.env,
      VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
      VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY,
    },
  },
});
