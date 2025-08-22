import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration specifically for Foreign Key Constraint Fix tests
 * This configuration optimizes for database interaction testing and race condition simulation
 */
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/foreign-key-constraint-fix.spec.ts',
  
  /* Run tests in files in parallel */
  fullyParallel: false, // Disable for database consistency
  
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  
  /* Single worker for database tests to avoid conflicts */
  workers: 1,
  
  /* Reporter configuration */
  reporter: [
    ['html', { outputFolder: 'playwright-report-foreign-key-fix' }],
    ['json', { outputFile: 'test-results-foreign-key-fix.json' }],
    ['line']
  ],
  
  /* Shared settings for all the projects below */
  use: {
    /* Base URL for the application */
    baseURL: 'http://localhost:5173',
    
    /* Collect trace when retrying the failed test */
    trace: 'on-first-retry',
    
    /* Take screenshot on failure */
    screenshot: 'only-on-failure',
    
    /* Record video for failed tests */
    video: 'retain-on-failure',
    
    /* Timeout for each action */
    actionTimeout: 15000,
    
    /* Global timeout for each test */
    timeout: 60000,
  },

  /* Test-specific timeouts */
  timeout: 120000, // 2 minutes for database operations
  expect: {
    timeout: 15000 // 15 seconds for assertions
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium-foreign-key-tests',
      use: { 
        ...devices['Desktop Chrome'],
        // Slower navigation for database timing tests
        navigationTimeout: 20000,
      },
    },
    
    {
      name: 'firefox-foreign-key-tests',
      use: { 
        ...devices['Desktop Firefox'],
        navigationTimeout: 20000,
      },
    },
    
    // Mobile testing for touch interactions
    {
      name: 'mobile-chrome-foreign-key-tests',
      use: { 
        ...devices['Pixel 5'],
        navigationTimeout: 25000, // Slower mobile performance
      },
    },
  ],

  /* Global setup and teardown */
  globalSetup: require.resolve('./tests/e2e/global-setup.ts'),
  globalTeardown: require.resolve('./tests/e2e/global-teardown.ts'),

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
  
  /* Test file patterns */
  testIgnore: [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
  ],
});