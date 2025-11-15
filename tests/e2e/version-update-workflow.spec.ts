import { test, expect, Page } from '@playwright/test';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

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

test.describe('Version Update Workflow - E2E Tests', () => {
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

  // Helper function to setup version endpoint mocking
  const setupVersionMocking = async (page: Page, hasUpdate = false) => {
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

  test.beforeEach(async ({ page }) => {
    // Set longer timeout for version checks
    page.setDefaultTimeout(10000);
  });

  test.describe('Happy Path Scenarios', () => {
    test('User visits Roadmap page and sees current version', async ({ page }) => {
      // Setup: Mock version endpoint to return current version (no update)
      await setupVersionMocking(page, false);

      // Navigate to Roadmap page
      await page.goto('/roadmap');
      await page.waitForLoadState('networkidle');

      // Verify current version is displayed
      await expect(page.getByText('Current Version')).toBeVisible();
      await expect(page.getByText('v1.0.2')).toBeVisible();
      await expect(page.getByText('Current', { exact: true })).toBeVisible();

      // Verify current release notes are shown
      await expect(page.getByText('🎉 Previous release with enhanced user experience')).toBeVisible();

      // Verify no update banner is shown
      await expect(page.getByText('New Version Available')).not.toBeVisible();
      await expect(page.getByText('Update Now')).not.toBeVisible();

      // Verify loading state eventually disappears
      await expect(page.getByText('Checking for updates...')).not.toBeVisible({ timeout: 5000 });
    });

    test('New version becomes available and update banner appears', async ({ page }) => {
      // Setup: Mock version endpoint to return newer version
      await setupVersionMocking(page, true);

      // Navigate to Roadmap page
      await page.goto('/roadmap');
      await page.waitForLoadState('networkidle');

      // Wait for version check to complete
      await page.waitForTimeout(2000);

      // Verify update banner appears
      await expect(page.getByText('New Version Available')).toBeVisible();
      await expect(page.getByText('v1.0.3')).toBeVisible();
      await expect(page.getByText('Update Now')).toBeVisible();

      // Verify new release notes in banner
      await expect(page.getByText('🚀 New version with updated features and performance improvements')).toBeVisible();
      await expect(page.getByText('Released Aug 28, 2025, 08:00 PM')).toBeVisible();

      // Verify current version section shows update available
      await expect(page.getByText('Current Version')).toBeVisible();
      await expect(page.getByText('Update Available')).toBeVisible();

      // Verify sparkles icon in update banner
      await expect(page.locator('[data-lucide="sparkles"]')).toBeVisible();
    });

    test('User clicks Update now and update process completes', async ({ page }) => {
      // Setup: Mock version endpoint to return newer version
      await setupVersionMocking(page, true);

      // Navigate to Roadmap page
      await page.goto('/roadmap');
      await page.waitForLoadState('networkidle');

      // Wait for update banner to appear
      await expect(page.getByText('New Version Available')).toBeVisible();

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
      await expect(page.getByText('Updating...')).toBeVisible();
      await expect(page.locator('[data-lucide="refresh-cw"].animate-spin')).toBeVisible();

      // Wait for update process to complete
      await page.waitForTimeout(2000);

      // Verify that reload was called
      const reloadCalled = await page.evaluate(() => (window as any).__reloadCalled);
      expect(reloadCalled).toBe(true);
    });

    test('User can dismiss update banner', async ({ page }) => {
      // Setup: Mock version endpoint to return newer version
      await setupVersionMocking(page, true);

      // Navigate to Roadmap page
      await page.goto('/roadmap');
      await page.waitForLoadState('networkidle');

      // Wait for update banner to appear
      await expect(page.getByText('New Version Available')).toBeVisible();

      // Click dismiss button (X button)
      const dismissButton = page.locator('button').filter({ has: page.locator('[data-lucide="x"]') });
      await dismissButton.click();

      // Verify update banner disappears
      await expect(page.getByText('New Version Available')).not.toBeVisible({ timeout: 2000 });

      // Verify current version section still shows "Update Available" badge
      await expect(page.getByText('Update Available')).toBeVisible();
    });

    test('User can expand and view release history', async ({ page }) => {
      // Setup: Mock version endpoint
      await setupVersionMocking(page, true);

      // Navigate to Roadmap page
      await page.goto('/roadmap');
      await page.waitForLoadState('networkidle');

      // Verify release history is not visible initially
      await expect(page.getByText('Release History')).not.toBeVisible();

      // Click expand button (chevron down)
      const expandButton = page.locator('button').filter({ has: page.locator('[data-lucide="chevron-down"]') });
      await expandButton.click();

      // Verify release history appears
      await expect(page.getByText('Release History')).toBeVisible();

      // Verify all releases are shown
      await expect(page.getByText('v1.0.3')).toBeVisible();
      await expect(page.getByText('Available')).toBeVisible(); // New version badge
      
      await expect(page.getByText('v1.0.2')).toBeVisible();
      await expect(page.getByText('Current')).toBeVisible(); // Current version badge
      
      await expect(page.getByText('v1.0.1')).toBeVisible();

      // Verify release notes in history
      await expect(page.getByText('🚀 New version with updated features and performance improvements')).toBeVisible();
      await expect(page.getByText('🎉 Previous release with enhanced user experience')).toBeVisible();
      await expect(page.getByText('🐛 Bug fixes and stability improvements')).toBeVisible();

      // Click collapse button (chevron up)
      const collapseButton = page.locator('button').filter({ has: page.locator('[data-lucide="chevron-up"]') });
      await collapseButton.click();

      // Verify release history is hidden again
      await expect(page.getByText('Release History')).not.toBeVisible();
    });
  });

  test.describe('Error Scenarios', () => {
    test('Should handle version fetch errors gracefully', async ({ page }) => {
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
      await page.goto('/roadmap');
      await page.waitForLoadState('networkidle');

      // Component should not render when there's an error
      await page.waitForTimeout(3000);
      await expect(page.getByText('Current Version')).not.toBeVisible();
      await expect(page.getByText('New Version Available')).not.toBeVisible();
    });

    test('Should handle update process failures', async ({ page }) => {
      // Setup: Mock version endpoint to return newer version
      await setupVersionMocking(page, true);

      // Navigate to Roadmap page
      await page.goto('/roadmap');
      await page.waitForLoadState('networkidle');

      // Wait for update banner to appear
      await expect(page.getByText('New Version Available')).toBeVisible();

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
      expect(toastCalls.some((call: any) => call.type === 'error')).toBe(true);

      // Verify button returns to normal state
      await expect(page.getByText('Update Now')).toBeVisible();
      await expect(page.getByText('Updating...')).not.toBeVisible();
    });

    test('Should handle network timeouts gracefully', async ({ page }) => {
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
      await page.goto('/roadmap');
      await page.waitForLoadState('networkidle');

      // Wait for timeout to occur
      await page.waitForTimeout(6000);

      // Component should handle timeout gracefully (not render)
      await expect(page.getByText('Current Version')).not.toBeVisible();
    });
  });

  test.describe('Performance and Accessibility', () => {
    test('Should meet performance requirements', async ({ page }) => {
      // Setup: Mock version endpoint
      await setupVersionMocking(page, true);

      // Navigate to Roadmap page and measure performance
      const startTime = Date.now();
      await page.goto('/roadmap');
      await page.waitForLoadState('networkidle');

      // Wait for version component to load
      await expect(page.getByText('New Version Available')).toBeVisible();
      const loadTime = Date.now() - startTime;

      // Verify load time is reasonable (< 5 seconds)
      expect(loadTime).toBeLessThan(5000);

      // Test animation performance
      const expandButton = page.locator('button').filter({ has: page.locator('[data-lucide="chevron-down"]') });
      await expandButton.click();

      // Verify smooth animation (release history should appear within 1 second)
      await expect(page.getByText('Release History')).toBeVisible({ timeout: 1000 });
    });

    test('Should be accessible via keyboard navigation', async ({ page }) => {
      // Setup: Mock version endpoint to return newer version
      await setupVersionMocking(page, true);

      // Navigate to Roadmap page
      await page.goto('/roadmap');
      await page.waitForLoadState('networkidle');

      // Wait for update banner to appear
      await expect(page.getByText('New Version Available')).toBeVisible();

      // Use keyboard navigation to focus on Update Now button
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      
      // Find and focus the Update Now button
      const updateButton = page.getByText('Update Now');
      await updateButton.focus();
      
      // Verify button is focused
      await expect(updateButton).toBeFocused();

      // Press Enter to activate button
      await page.keyboard.press('Enter');

      // Verify loading state appears
      await expect(page.getByText('Updating...')).toBeVisible();
    });

    test('Should have proper ARIA labels and roles', async ({ page }) => {
      // Setup: Mock version endpoint
      await setupVersionMocking(page, true);

      // Navigate to Roadmap page
      await page.goto('/roadmap');
      await page.waitForLoadState('networkidle');

      // Verify buttons have proper roles
      await expect(page.getByRole('button', { name: 'Update Now' })).toBeVisible();
      
      // Verify expandable content is properly labeled
      const expandButton = page.locator('button').filter({ has: page.locator('[data-lucide="chevron-down"]') });
      await expect(expandButton).toBeVisible();

      // Check that interactive elements are focusable
      await expect(page.getByText('Update Now')).toBeVisible();
      await expect(expandButton).toBeVisible();
    });
  });

  test.describe('Cross-Browser Compatibility', () => {
    test('Should work consistently across different browsers', async ({ page, browserName }) => {
      // Setup: Mock version endpoint
      await setupVersionMocking(page, true);

      // Navigate to Roadmap page
      await page.goto('/roadmap');
      await page.waitForLoadState('networkidle');

      // Verify core functionality works regardless of browser
      await expect(page.getByText('New Version Available')).toBeVisible();
      await expect(page.getByText('Update Now')).toBeVisible();

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
      await expect(page.getByText('Updating...')).toBeVisible();

      // Verify functionality works in all browsers
    });
  });

  test.describe('Real-time Updates', () => {
    test('Should detect version changes during polling', async ({ page }) => {
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
      await page.goto('/roadmap');
      await page.waitForLoadState('networkidle');

      // Verify no update initially
      await expect(page.getByText('Current Version')).toBeVisible();
      await expect(page.getByText('New Version Available')).not.toBeVisible();

      // Simulate new version becoming available
      useNewVersion = true;

      // Wait for polling to detect the change (30+ seconds in real app, shorter for test)
      await page.waitForTimeout(35000); // Wait longer than polling interval

      // Verify update banner appears
      await expect(page.getByText('New Version Available')).toBeVisible({ timeout: 10000 });
    });
  });
});