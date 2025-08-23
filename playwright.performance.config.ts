import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/dashboard-performance.spec.ts',
  fullyParallel: false, // Run tests sequentially for accurate performance measurements
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1, // Single worker for performance testing
  reporter: [
    ['html', { outputFolder: 'playwright-report/performance' }],
    ['json', { outputFile: 'test-results/performance-results.json' }],
    ['list'],
  ],
  
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    
    // Performance-specific settings
    actionTimeout: 10000,
    navigationTimeout: 30000,
    
    // Viewport for consistent testing
    viewport: { width: 1920, height: 1080 },
    
    // Network throttling options (can be adjusted)
    // Uncomment to test with slower network:
    // offline: false,
    // downloadThroughput: 1000 * 1024, // 1 Mbps
    // uploadThroughput: 500 * 1024, // 500 Kbps
    // latency: 50, // 50ms latency
  },

  projects: [
    {
      name: 'chromium-performance',
      use: { 
        ...devices['Desktop Chrome'],
        // Enable performance metrics collection
        launchOptions: {
          args: [
            '--enable-precise-memory-info',
            '--disable-dev-shm-usage',
            '--no-sandbox',
          ],
        },
      },
    },
    // Uncomment to test on other browsers
    // {
    //   name: 'firefox-performance',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit-performance',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],

  // Local dev server configuration
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});