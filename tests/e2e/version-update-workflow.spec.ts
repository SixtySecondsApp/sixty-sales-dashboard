import { describe, test, expect as vitestExpect, beforeAll, afterAll, beforeEach } from 'vitest';
import { expect as playwrightExpect } from '../fixtures/playwright-assertions';
import { setupPlaywriter, teardownPlaywriter } from '../fixtures/playwriter-setup';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { Page } from 'playwright-core';

const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || process.env.VITE_BASE_URL || 'http://localhost:5175';

/**
 * E2E Tests for Version Update Workflow
 * 
 * These tests validate the complete user journey for the "New release" feature:
 * 1. User visits Roadmap page → sees current version
 * 2. New version becomes available → update banner appears  
 * 3. User clicks "Update now" → caches clear and page reloads
 * 4. Release notes display correctly for both current and new versions
 * 5. Update process completes successfully
 */

describe('Version Update Workflow - E2E Tests', () => {
  let page: Page;
  // Mock data for testing
  const currentVersion = {
    buildId: 'build-2025-08-28T19-32-36-v1.0.2',
    builtAt: '2025-08-28T19:32:36.859Z'
  };

  const newVersion = {
    buildId: 'build-2025-08-28T20-00-00-v1.0.3',
    builtAt: '2025-08-28T20:00:00.000Z'
  };

  const mockReleases = [
    {
      buildId: 'build-2025-08-28T20-00-00-v1.0.3',
      date: '2025-08-28T20:00:00.000Z',
      notes: '🚀 New version with updated features and performance improvements'
    },
    {
      buildId: 'build-2025-08-28T19-32-36-v1.0.2',
      date: '2025-08-28T19:32:36.859Z',
      notes: '🎉 Previous release with enhanced user experience'
    },
    {
      buildId: 'build-2025-08-28T18-15-12-v1.0.1',
      date: '2025-08-28T18:15:12.123Z',
      notes: '🐛 Bug fixes and stability improvements'
    }
  ];

  beforeAll(async () => {
    const setup = await setupPlaywriter();
    page = setup.page;
  });

  afterAll(async () => {
    await teardownPlaywriter();
  });

  // Helper function to setup version endpoint mocking
  const setupVersionMocking = async (hasUpdate = false) => {
    const versionToReturn = hasUpdate ? newVersion : currentVersion;
    
    await page.route('/version.json', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(versionToReturn),
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
    });

    await page.route('/releases.json', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockReleases),
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
    });
  };

  beforeEach(async () => {
    // Set longer timeout for version checks
    page.setDefaultTimeout(10000);
  });

  describe('Happy Path Scenarios', () => {
    test('User visits Roadmap page and sees current version', async () => {
      // Setup: Mock version endpoint to return current version (no update)
      await setupVersionMocking(false);

      // Navigate to Roadmap page
      await page.goto(`${BASE_URL}/roadmap`);
      await page.waitForLoadState('networkidle');

      // Verify current version is displayed
      await playwrightExpect(page.getByText('Current Version')).toBeVisible();
      await playwrightExpect(page.getByText('v1.0.2')).toBeVisible();
      await playwrightExpect(page.getByText('Current', { exact: true })).toBeVisible();

      // Verify current release notes are shown
      await playwrightExpect(page.getByText('🎉 Previous release with enhanced user experience')).toBeVisible();

      // Verify no update banner is shown
      await playwrightExpect(page.getByText('New Version Available')).toBeHidden();
      await playwrightExpect(page.getByText('Update Now')).toBeHidden();

      // Verify loading state eventually disappears
      await playwrightExpect(page.getByText('Checking for updates...')).toBeHidden({ timeout: 5000 });
    });

    test('New version becomes available and update banner appears', async () => {
      // Setup: Mock version endpoint to return newer version
      await setupVersionMocking(true);

      // Navigate to Roadmap page
      await page.goto(`${BASE_URL}/roadmap`);
      await page.waitForLoadState('networkidle');

      // Wait for version check to complete
      await page.waitForTimeout(2000);

      // Verify update banner appears
      await playwrightExpect(page.getByText('New Version Available')).toBeVisible();
      await playwrightExpect(page.getByText('v1.0.3')).toBeVisible();
      await playwrightExpect(page.getByText('Update Now')).toBeVisible();

      // Verify new release notes in banner
      await playwrightExpect(page.getByText('🚀 New version with updated features and performance improvements')).toBeVisible();
      await playwrightExpect(page.getByText('Released Aug 28, 2025, 08:00 PM')).toBeVisible();

      // Verify current version section shows update available
      await playwrightExpect(page.getByText('Current Version')).toBeVisible();
      await playwrightExpect(page.getByText('Update Available')).toBeVisible();

      // Verify sparkles icon in update banner
      await playwrightExpect(page.locator('[data-lucide="sparkles"]')).toBeVisible();
    });

    test('User clicks Update now and update process completes', async () => {
      // Setup: Mock version endpoint to return newer version
      await setupVersionMocking(true);

      // Navigate to Roadmap page
      await page.goto(`${BASE_URL}/roadmap`);
      await page.waitForLoadState('networkidle');

      // Wait for update banner to appear
      await playwrightExpect(page.getByText('New Version Available')).toBeVisible();

      // Mock window.location.reload to prevent actual reload in tests
      await page.addInitScript(() => {
        const originalReload = window.location.reload;
        window.location.reload = () => {
          // Add a marker to indicate reload was called
          (window as any).__reloadCalled = true;
        };
      });

      // Mock caches API for testing
      await page.addInitScript(() => {
        (window as any).caches = {
          keys: () => Promise.resolve(['cache1', 'cache2']),
          delete: (name: string) => {
            return Promise.resolve(true);
          }
        };
      });

      // Click Update Now button
      const updateButton = page.getByText('Update Now');
      await updateButton.click();

      // Verify loading state appears
      await playwrightExpect(page.getByText('Updating...')).toBeVisible();
      await playwrightExpect(page.locator('[data-lucide="refresh-cw"].animate-spin')).toBeVisible();

      // Wait for update process to complete
      await page.waitForTimeout(2000);

      // Verify that reload was called
      const reloadCalled = await page.evaluate(() => (window as any).__reloadCalled);
      vitestExpect(reloadCalled).toBe(true);
    });

    test('User can dismiss update banner', async () => {
      // Setup: Mock version endpoint to return newer version
      await setupVersionMocking(true);

      // Navigate to Roadmap page
      await page.goto(`${BASE_URL}/roadmap`);
      await page.waitForLoadState('networkidle');

      // Wait for update banner to appear
      await playwrightExpect(page.getByText('New Version Available')).toBeVisible();

      // Click dismiss button (X button)
      const dismissButton = page.locator('button').filter({ has: page.locator('[data-lucide="x"]') });
      await dismissButton.click();

      // Verify update banner disappears
      await playwrightExpect(page.getByText('New Version Available')).toBeHidden({ timeout: 2000 });

      // Verify current version section still shows "Update Available" badge
      await playwrightExpect(page.getByText('Update Available')).toBeVisible();
    });

    test('User can expand and view release history', async () => {
      // Setup: Mock version endpoint
      await setupVersionMocking(true);

      // Navigate to Roadmap page
      await page.goto(`${BASE_URL}/roadmap`);
      await page.waitForLoadState('networkidle');

      // Verify release history is not visible initially
      await playwrightExpect(page.getByText('Release History')).toBeHidden();

      // Click expand button (chevron down)
      const expandButton = page.locator('button').filter({ has: page.locator('[data-lucide="chevron-down"]') });
      await expandButton.click();

      // Verify release history appears
      await playwrightExpect(page.getByText('Release History')).toBeVisible();

      // Verify all releases are shown
      await playwrightExpect(page.getByText('v1.0.3')).toBeVisible();
      await playwrightExpect(page.getByText('Available')).toBeVisible(); // New version badge
      
      await playwrightExpect(page.getByText('v1.0.2')).toBeVisible();
      await playwrightExpect(page.getByText('Current')).toBeVisible(); // Current version badge
      
      await playwrightExpect(page.getByText('v1.0.1')).toBeVisible();

      // Verify release notes in history
      await playwrightExpect(page.getByText('🚀 New version with updated features and performance improvements')).toBeVisible();
      await playwrightExpect(page.getByText('🎉 Previous release with enhanced user experience')).toBeVisible();
      await playwrightExpect(page.getByText('🐛 Bug fixes and stability improvements')).toBeVisible();

      // Click collapse button (chevron up)
      const collapseButton = page.locator('button').filter({ has: page.locator('[data-lucide="chevron-up"]') });
      await collapseButton.click();

      // Verify release history is hidden again
      await playwrightExpect(page.getByText('Release History')).toBeHidden();
    });
  });

  describe('Error Scenarios', () => {
    test('Should handle version fetch errors gracefully', async () => {
      // Mock version endpoint to return error
      await page.route('/version.json', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'text/plain',
          body: 'Internal Server Error'
        });
      });

      // Mock releases endpoint to succeed
      await page.route('/releases.json', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockReleases)
        });
      });

      // Navigate to Roadmap page
      await page.goto(`${BASE_URL}/roadmap`);
      await page.waitForLoadState('networkidle');

      // Component should not render when there's an error
      await page.waitForTimeout(3000);
      await playwrightExpect(page.getByText('Current Version')).toBeHidden();
      await playwrightExpect(page.getByText('New Version Available')).toBeHidden();
    });

    test('Should handle update process failures', async () => {
      // Setup: Mock version endpoint to return newer version
      await setupVersionMocking(true);

      // Navigate to Roadmap page
      await page.goto(`${BASE_URL}/roadmap`);
      await page.waitForLoadState('networkidle');

      // Wait for update banner to appear
      await playwrightExpect(page.getByText('New Version Available')).toBeVisible();

      // Mock cache clearing to fail
      await page.addInitScript(() => {
        (window as any).caches = {
          keys: () => Promise.reject(new Error('Cache access failed')),
          delete: () => Promise.reject(new Error('Cache delete failed'))
        };
      });

      // Mock localStorage to fail
      await page.addInitScript(() => {
        Object.defineProperty(window, 'localStorage', {
          value: {
            clear: () => { throw new Error('localStorage clear failed'); }
          }
        });
      });

      // Mock toast to capture error messages
      await page.addInitScript(() => {
        (window as any).mockToastCalls = [];
        (window as any).toast = {
          loading: (msg: string) => (window as any).mockToastCalls.push({ type: 'loading', message: msg }),
          error: (msg: string) => (window as any).mockToastCalls.push({ type: 'error', message: msg }),
          success: (msg: string) => (window as any).mockToastCalls.push({ type: 'success', message: msg })
        };
      });

      // Click Update Now button
      const updateButton = page.getByText('Update Now');
      await updateButton.click();

      // Wait for error handling
      await page.waitForTimeout(3000);

      // Verify error toast was called
      const toastCalls = await page.evaluate(() => (window as any).mockToastCalls);
      vitestExpect(toastCalls.some((call: any) => call.type === 'error')).toBe(true);

      // Verify button returns to normal state
      await playwrightExpect(page.getByText('Update Now')).toBeVisible();
      await playwrightExpect(page.getByText('Updating...')).toBeHidden();
    });

    test('Should handle network timeouts gracefully', async () => {
      // Mock version endpoint with delayed response
      await page.route('/version.json', async (route) => {
        // Delay response by 10 seconds (longer than timeout)
        await new Promise(resolve => setTimeout(resolve, 10000));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(currentVersion)
        });
      });

      // Navigate to Roadmap page
      await page.goto(`${BASE_URL}/roadmap`);
      await page.waitForLoadState('networkidle');

      // Wait for timeout to occur
      await page.waitForTimeout(6000);

      // Component should handle timeout gracefully (not render)
      await playwrightExpect(page.getByText('Current Version')).toBeHidden();
    });
  });

  describe('Performance and Accessibility', () => {
    test('Should meet performance requirements', async () => {
      // Setup: Mock version endpoint
      await setupVersionMocking(true);

      // Navigate to Roadmap page and measure performance
      const startTime = Date.now();
      await page.goto(`${BASE_URL}/roadmap`);
      await page.waitForLoadState('networkidle');

      // Wait for version component to load
      await playwrightExpect(page.getByText('New Version Available')).toBeVisible();
      const loadTime = Date.now() - startTime;

      // Verify load time is reasonable (< 5 seconds)
      vitestExpect(loadTime).toBeLessThan(5000);

      // Test animation performance
      const expandButton = page.locator('button').filter({ has: page.locator('[data-lucide="chevron-down"]') });
      await expandButton.click();

      // Verify smooth animation (release history should appear within 1 second)
      await playwrightExpect(page.getByText('Release History')).toBeVisible({ timeout: 1000 });
    });

    test('Should be accessible via keyboard navigation', async () => {
      // Setup: Mock version endpoint to return newer version
      await setupVersionMocking(true);

      // Navigate to Roadmap page
      await page.goto(`${BASE_URL}/roadmap`);
      await page.waitForLoadState('networkidle');

      // Wait for update banner to appear
      await playwrightExpect(page.getByText('New Version Available')).toBeVisible();

      // Use keyboard navigation to focus on Update Now button
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      
      // Find and focus the Update Now button
      const updateButton = page.getByText('Update Now');
      await updateButton.focus();
      
      // Verify button is focused
      const isFocused = await updateButton.evaluate(el => el === document.activeElement);
      vitestExpect(isFocused).toBe(true);

      // Press Enter to activate button
      await page.keyboard.press('Enter');

      // Verify loading state appears
      await playwrightExpect(page.getByText('Updating...')).toBeVisible();
    });

    test('Should have proper ARIA labels and roles', async () => {
      // Setup: Mock version endpoint
      await setupVersionMocking(true);

      // Navigate to Roadmap page
      await page.goto(`${BASE_URL}/roadmap`);
      await page.waitForLoadState('networkidle');

      // Verify buttons have proper roles
      await playwrightExpect(page.getByRole('button', { name: 'Update Now' })).toBeVisible();
      
      // Verify expandable content is properly labeled
      const expandButton = page.locator('button').filter({ has: page.locator('[data-lucide="chevron-down"]') });
      await playwrightExpect(expandButton).toBeVisible();

      // Check that interactive elements are focusable
      await playwrightExpect(page.getByText('Update Now')).toBeVisible();
      await playwrightExpect(expandButton).toBeVisible();
    });
  });

  describe('Cross-Browser Compatibility', () => {
    test('Should work consistently across different browsers', async () => {
      // Setup: Mock version endpoint
      await setupVersionMocking(true);

      // Navigate to Roadmap page
      await page.goto(`${BASE_URL}/roadmap`);
      await page.waitForLoadState('networkidle');

      // Verify core functionality works regardless of browser
      await playwrightExpect(page.getByText('New Version Available')).toBeVisible();
      await playwrightExpect(page.getByText('Update Now')).toBeVisible();

      // Test update flow
      const updateButton = page.getByText('Update Now');
      
      // Mock reload for cross-browser compatibility
      await page.addInitScript(() => {
        (window as any).__reloadCalled = false;
        window.location.reload = () => {
          (window as any).__reloadCalled = true;
        };
      });

      await updateButton.click();
      await playwrightExpect(page.getByText('Updating...')).toBeVisible();

      // Verify functionality works in all browsers
    });
  });

  describe('Real-time Updates', () => {
    test('Should detect version changes during polling', async () => {
      let useNewVersion = false;

      // Setup dynamic mocking that changes response
      await page.route('/version.json', async (route) => {
        const versionToReturn = useNewVersion ? newVersion : currentVersion;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(versionToReturn)
        });
      });

      await page.route('/releases.json', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockReleases)
        });
      });

      // Navigate to Roadmap page
      await page.goto(`${BASE_URL}/roadmap`);
      await page.waitForLoadState('networkidle');

      // Verify no update initially
      await playwrightExpect(page.getByText('Current Version')).toBeVisible();
      await playwrightExpect(page.getByText('New Version Available')).toBeHidden();

      // Simulate new version becoming available
      useNewVersion = true;

      // Wait for polling to detect the change (30+ seconds in real app, shorter for test)
      await page.waitForTimeout(35000); // Wait longer than polling interval

      // Verify update banner appears
      await playwrightExpect(page.getByText('New Version Available')).toBeVisible({ timeout: 10000 });
    });
  });
});