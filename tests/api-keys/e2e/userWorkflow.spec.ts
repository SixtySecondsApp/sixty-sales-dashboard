import { test, expect, Page, BrowserContext } from '@playwright/test';

// Test configuration for API Key E2E tests
test.describe('API Key Manager E2E Tests', () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    // Create a new context for isolation
    context = await browser.newContext({
      // Mock user authentication
      storageState: {
        cookies: [],
        origins: [{
          origin: 'http://localhost:5173',
          localStorage: [{
            name: 'supabase.auth.token',
            value: JSON.stringify({
              access_token: 'mock-access-token',
              refresh_token: 'mock-refresh-token',
              user: {
                id: 'test-user-id',
                email: 'test@example.com'
              }
            })
          }]
        }]
      }
    });
  });

  test.afterAll(async () => {
    await context.close();
  });

  test.beforeEach(async () => {
    page = await context.newPage();
    
    // Mock network requests
    await page.route('**/auth/v1/user', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'test-user-id',
            email: 'test@example.com'
          }
        })
      });
    });

    await page.route('**/rest/v1/api_keys*', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 'key-1',
              name: 'Test API Key 1',
              key_preview: 'ak_test_1234...5678',
              permissions: ['deals:read', 'contacts:read'],
              rate_limit: 500,
              usage_count: 15,
              last_used: '2024-08-25T10:00:00Z',
              created_at: '2024-08-20T10:00:00Z',
              expires_at: '2024-11-20T10:00:00Z',
              is_active: true
            },
            {
              id: 'key-2',
              name: 'Production API Key',
              key_preview: 'ak_prod_abcd...efgh',
              permissions: ['deals:read', 'deals:write', 'contacts:read'],
              rate_limit: 1000,
              usage_count: 450,
              last_used: '2024-08-26T09:30:00Z',
              created_at: '2024-08-15T10:00:00Z',
              expires_at: null,
              is_active: true
            }
          ])
        });
      }
    });

    await page.route('**/functions/v1/create-api-key', async route => {
      const body = route.request().postDataJSON();
      
      // Simulate different responses based on input
      if (!body.name || body.name.trim().length < 3) {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Validation failed',
            details: 'name must be at least 3 characters long'
          })
        });
      } else if (body.name === 'Rate Limited Key') {
        await route.fulfill({
          status: 429,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Rate limit exceeded',
            details: 'Too many requests. Please try again later.'
          })
        });
      } else if (body.name === 'Server Error Key') {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Internal server error',
            details: 'Database connection failed'
          })
        });
      } else {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            message: 'API key created successfully',
            api_key: 'ak_test_new_key_1234567890abcdef',
            key_data: {
              id: 'new-key-id',
              name: body.name,
              key_preview: 'ak_test_new...cdef',
              permissions: body.permissions,
              rate_limit: body.rate_limit,
              expires_at: body.expires_in_days ? '2024-11-26T10:00:00Z' : null,
              created_at: '2024-08-26T10:00:00Z'
            }
          })
        });
      }
    });

    // Navigate to API Key manager (assuming it's part of a settings page)
    await page.goto('/api-testing'); // Assuming this page contains the ApiKeyManager component
  });

  test.afterEach(async () => {
    await page.close();
  });

  describe('API Key Display and Management', () => {
    test('should display existing API keys correctly', async () => {
      // Wait for the component to load
      await page.waitForSelector('[data-testid="api-key-manager"]', { timeout: 10000 });
      
      // Check if API keys are displayed
      const keyCards = page.locator('[data-testid="api-key-card"]');
      await expect(keyCards).toHaveCount(2);
      
      // Verify first key details
      const firstKey = keyCards.first();
      await expect(firstKey.locator('text=Test API Key 1')).toBeVisible();
      await expect(firstKey.locator('text=ak_test_1234...5678')).toBeVisible();
      await expect(firstKey.locator('text=Active')).toBeVisible();
      
      // Check permissions badges
      await expect(firstKey.locator('text=deals:read')).toBeVisible();
      await expect(firstKey.locator('text=contacts:read')).toBeVisible();
      
      // Check usage information
      await expect(firstKey.locator('text=15/500')).toBeVisible();
      await expect(firstKey.locator('text=Last used Aug 25, 2024')).toBeVisible();
    });

    test('should show key preview by default and allow toggling visibility', async () => {
      await page.waitForSelector('[data-testid="api-key-card"]');
      
      const firstKey = page.locator('[data-testid="api-key-card"]').first();
      
      // Initially should show preview
      await expect(firstKey.locator('code')).toContainText('ak_test_1234...5678');
      
      // Click eye icon to toggle visibility
      await firstKey.locator('[data-testid="toggle-key-visibility"]').click();
      
      // Should now show full key (in mock mode)
      await expect(firstKey.locator('code')).toContainText('ak_test_1234567890abcdef');
      
      // Click again to hide
      await firstKey.locator('[data-testid="toggle-key-visibility"]').click();
      
      // Should be back to preview
      await expect(firstKey.locator('code')).toContainText('ak_test_1234...5678');
    });

    test('should copy API key to clipboard', async () => {
      await page.waitForSelector('[data-testid="api-key-card"]');
      
      const firstKey = page.locator('[data-testid="api-key-card"]').first();
      
      // Mock clipboard API
      await page.evaluate(() => {
        Object.assign(navigator, {
          clipboard: {
            writeText: (text: string) => Promise.resolve(text)
          }
        });
      });
      
      // Click copy button
      await firstKey.locator('[data-testid="copy-key"]').click();
      
      // Should show success toast
      await expect(page.locator('text=API key copied to clipboard')).toBeVisible();
    });
  });

  describe('Create New API Key', () => {
    test('should open create key dialog and display form fields', async () => {
      await page.waitForSelector('[data-testid="create-key-button"]');
      
      // Click create key button
      await page.click('[data-testid="create-key-button"]');
      
      // Dialog should open
      await expect(page.locator('[data-testid="create-key-dialog"]')).toBeVisible();
      
      // Check form fields
      await expect(page.locator('input[placeholder*="Mobile App Key"]')).toBeVisible();
      await expect(page.locator('text=Permissions')).toBeVisible();
      await expect(page.locator('text=Rate Limit')).toBeVisible();
      await expect(page.locator('text=Expires In')).toBeVisible();
      
      // Check default values
      const rateLimitSelect = page.locator('select').filter({ hasText: '500/hour' });
      await expect(rateLimitSelect).toHaveValue('500');
      
      const expirationSelect = page.locator('select').filter({ hasText: '90 days' });
      await expect(expirationSelect).toHaveValue('90');
    });

    test('should successfully create a new API key with valid input', async () => {
      await page.click('[data-testid="create-key-button"]');
      await page.waitForSelector('[data-testid="create-key-dialog"]');
      
      // Fill in form
      await page.fill('input[placeholder*="Mobile App Key"]', 'New Integration Key');
      
      // Select permissions
      await page.check('input[type="checkbox"][value="deals:read"]');
      await page.check('input[type="checkbox"][value="contacts:write"]');
      
      // Change rate limit
      await page.selectOption('select:near(text="Rate Limit")', '1000');
      
      // Set expiration
      await page.selectOption('select:near(text="Expires In")', '30');
      
      // Submit form
      await page.click('button:has-text("Create Key")');
      
      // Should show success dialog with new key
      await expect(page.locator('text=API Key Created Successfully')).toBeVisible();
      await expect(page.locator('text=ak_test_new_key_1234567890abcdef')).toBeVisible();
      
      // Should show warning about copying key
      await expect(page.locator('text=This is the only time you\'ll be able to see this key')).toBeVisible();
      
      // Copy button should be available
      await expect(page.locator('button:has-text("Copy")').last()).toBeVisible();
      
      // Close success dialog
      await page.click('button:has-text("I\'ve Copied the Key")');
      
      // Success dialog should close
      await expect(page.locator('text=API Key Created Successfully')).not.toBeVisible();
    });

    test('should validate required fields and show error messages', async () => {
      await page.click('[data-testid="create-key-button"]');
      await page.waitForSelector('[data-testid="create-key-dialog"]');
      
      // Try to submit without name
      await page.click('button:has-text("Create Key")');
      
      // Create button should be disabled or form should not submit
      const createButton = page.locator('button:has-text("Create Key")');
      await expect(createButton).toBeDisabled();
      
      // Add name but clear permissions
      await page.fill('input[placeholder*="Mobile App Key"]', 'Test');
      
      // Uncheck all permissions
      const checkboxes = page.locator('input[type="checkbox"]');
      const count = await checkboxes.count();
      for (let i = 0; i < count; i++) {
        await checkboxes.nth(i).uncheck();
      }
      
      // Create button should still be disabled
      await expect(createButton).toBeDisabled();
      
      // Check one permission
      await page.check('input[type="checkbox"]', { force: true });
      
      // Now button should be enabled
      await expect(createButton).toBeEnabled();
    });

    test('should handle server validation errors gracefully', async () => {
      await page.click('[data-testid="create-key-button"]');
      await page.waitForSelector('[data-testid="create-key-dialog"]');
      
      // Fill form with name that will trigger server validation error
      await page.fill('input[placeholder*="Mobile App Key"]', 'ab'); // Too short
      await page.check('input[type="checkbox"]', { force: true });
      
      // Submit form
      await page.click('button:has-text("Create Key")');
      
      // Should show error toast
      await expect(page.locator('text=name must be at least 3 characters long')).toBeVisible();
      
      // Dialog should remain open
      await expect(page.locator('[data-testid="create-key-dialog"]')).toBeVisible();
    });

    test('should handle rate limiting errors', async () => {
      await page.click('[data-testid="create-key-button"]');
      await page.waitForSelector('[data-testid="create-key-dialog"]');
      
      // Use name that triggers rate limit response
      await page.fill('input[placeholder*="Mobile App Key"]', 'Rate Limited Key');
      await page.check('input[type="checkbox"]', { force: true });
      
      await page.click('button:has-text("Create Key")');
      
      // Should show rate limit error
      await expect(page.locator('text=Rate limit exceeded')).toBeVisible();
      await expect(page.locator('text=Too many requests')).toBeVisible();
    });

    test('should handle server errors gracefully', async () => {
      await page.click('[data-testid="create-key-button"]');
      await page.waitForSelector('[data-testid="create-key-dialog"]');
      
      // Use name that triggers server error
      await page.fill('input[placeholder*="Mobile App Key"]', 'Server Error Key');
      await page.check('input[type="checkbox"]', { force: true });
      
      await page.click('button:has-text("Create Key")');
      
      // Should show server error message
      await expect(page.locator('text=Server error')).toBeVisible();
    });

    test('should use permission presets correctly', async () => {
      await page.click('[data-testid="create-key-button"]');
      await page.waitForSelector('[data-testid="create-key-dialog"]');
      
      // Test "Read Only" preset
      await page.selectOption('select:near(text="Quick Presets")', 'read-only');
      
      // Check that only read permissions are selected
      await expect(page.locator('input[value="deals:read"]')).toBeChecked();
      await expect(page.locator('input[value="contacts:read"]')).toBeChecked();
      await expect(page.locator('input[value="activities:read"]')).toBeChecked();
      
      // Write permissions should not be selected
      const writeCheckbox = page.locator('input[value="deals:write"]');
      if (await writeCheckbox.count() > 0) {
        await expect(writeCheckbox).not.toBeChecked();
      }
      
      // Test "All Permissions" preset
      await page.selectOption('select:near(text="Quick Presets")', 'all');
      
      // All checkboxes should be selected
      const allCheckboxes = page.locator('input[type="checkbox"]');
      const checkboxCount = await allCheckboxes.count();
      
      for (let i = 0; i < checkboxCount; i++) {
        await expect(allCheckboxes.nth(i)).toBeChecked();
      }
      
      // Test "Clear All" preset
      await page.selectOption('select:near(text="Quick Presets")', 'clear');
      
      // All checkboxes should be unchecked
      for (let i = 0; i < checkboxCount; i++) {
        await expect(allCheckboxes.nth(i)).not.toBeChecked();
      }
    });
  });

  describe('Key Management Actions', () => {
    test('should revoke an API key', async () => {
      await page.waitForSelector('[data-testid="api-key-card"]');
      
      const firstKey = page.locator('[data-testid="api-key-card"]').first();
      
      // Click actions menu
      await firstKey.locator('[data-testid="key-actions-menu"]').click();
      
      // Click revoke option
      await page.click('text=Revoke Key');
      
      // Mock the revoke API call
      await page.route('**/rest/v1/api_keys*', async route => {
        if (route.request().method() === 'PATCH') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true })
          });
        }
      });
      
      // Should show success message
      await expect(page.locator('text=API key revoked')).toBeVisible();
    });

    test('should display usage statistics correctly', async () => {
      await page.waitForSelector('[data-testid="api-key-card"]');
      
      const firstKey = page.locator('[data-testid="api-key-card"]').first();
      
      // Check usage display with color coding
      const usageText = firstKey.locator('text=15/500');
      await expect(usageText).toBeVisible();
      
      // Should show as green (under 70% usage)
      await expect(usageText).toHaveClass(/text-emerald-400/);
      
      // Check the second key with higher usage
      const secondKey = page.locator('[data-testid="api-key-card"]').nth(1);
      const highUsageText = secondKey.locator('text=450/1000');
      await expect(highUsageText).toBeVisible();
      
      // Should show as yellow (over 70% but under 90%)
      await expect(highUsageText).toHaveClass(/text-yellow-400/);
    });

    test('should show expiration information correctly', async () => {
      await page.waitForSelector('[data-testid="api-key-card"]');
      
      const firstKey = page.locator('[data-testid="api-key-card"]').first();
      
      // Should show expiration date
      await expect(firstKey.locator('text=Expires Nov 20, 2024')).toBeVisible();
      
      // Second key should show no expiration
      const secondKey = page.locator('[data-testid="api-key-card"]').nth(1);
      await expect(secondKey.locator('text=Expires')).not.toBeVisible();
    });
  });

  describe('Mock Mode Fallback', () => {
    test('should show mock mode indicator when database is unavailable', async () => {
      // Create new page with failing API calls
      const mockPage = await context.newPage();
      
      await mockPage.route('**/rest/v1/api_keys*', async route => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'relation "api_keys" does not exist'
          })
        });
      });
      
      await mockPage.goto('/api-testing');
      
      // Should show mock mode indicator
      await expect(mockPage.locator('text=Using mock API keys for testing')).toBeVisible();
      
      await mockPage.close();
    });

    test('should work in mock mode for key creation', async () => {
      // Create page that uses mock mode
      const mockPage = await context.newPage();
      
      await mockPage.route('**/rest/v1/api_keys*', async route => {
        await route.fulfill({ status: 500 });
      });
      
      await mockPage.route('**/functions/v1/create-api-key', async route => {
        await route.fulfill({ status: 500 });
      });
      
      await mockPage.goto('/api-testing');
      
      // Wait for mock mode
      await expect(mockPage.locator('text=Using mock API keys for testing')).toBeVisible();
      
      // Try to create key in mock mode
      await mockPage.click('[data-testid="create-key-button"]');
      await mockPage.waitForSelector('[data-testid="create-key-dialog"]');
      
      await mockPage.fill('input[placeholder*="Mobile App Key"]', 'Mock Mode Key');
      await mockPage.check('input[type="checkbox"]', { force: true });
      
      await mockPage.click('button:has-text("Create Key")');
      
      // Should show mock success message
      await expect(mockPage.locator('text=Mock API key created for testing')).toBeVisible();
      
      await mockPage.close();
    });
  });

  describe('Responsive Design', () => {
    test('should work correctly on mobile viewport', async () => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      
      await page.waitForSelector('[data-testid="api-key-manager"]');
      
      // Check that content is still accessible
      await expect(page.locator('text=API Keys Management')).toBeVisible();
      await expect(page.locator('[data-testid="create-key-button"]')).toBeVisible();
      
      // Key cards should stack vertically
      const keyCards = page.locator('[data-testid="api-key-card"]');
      await expect(keyCards.first()).toBeVisible();
      
      // Create dialog should be responsive
      await page.click('[data-testid="create-key-button"]');
      const dialog = page.locator('[data-testid="create-key-dialog"]');
      await expect(dialog).toBeVisible();
      
      // Form fields should still be usable
      await expect(page.locator('input[placeholder*="Mobile App Key"]')).toBeVisible();
    });

    test('should handle tablet viewport correctly', async () => {
      // Set tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 });
      
      await page.waitForSelector('[data-testid="api-key-manager"]');
      
      // Content should be well-organized
      await expect(page.locator('text=API Keys Management')).toBeVisible();
      
      const keyCards = page.locator('[data-testid="api-key-card"]');
      await expect(keyCards).toHaveCount(2);
      
      // All key information should be visible
      await expect(keyCards.first().locator('text=Test API Key 1')).toBeVisible();
      await expect(keyCards.first().locator('text=15/500')).toBeVisible();
    });
  });

  describe('Accessibility', () => {
    test('should be keyboard navigable', async () => {
      await page.waitForSelector('[data-testid="api-key-manager"]');
      
      // Tab to create button
      await page.keyboard.press('Tab');
      
      // Create button should be focused
      const createButton = page.locator('[data-testid="create-key-button"]');
      await expect(createButton).toBeFocused();
      
      // Press Enter to open dialog
      await page.keyboard.press('Enter');
      await expect(page.locator('[data-testid="create-key-dialog"]')).toBeVisible();
      
      // Tab through form fields
      await page.keyboard.press('Tab');
      const nameInput = page.locator('input[placeholder*="Mobile App Key"]');
      await expect(nameInput).toBeFocused();
      
      // Should be able to close dialog with Escape
      await page.keyboard.press('Escape');
      await expect(page.locator('[data-testid="create-key-dialog"]')).not.toBeVisible();
    });

    test('should have proper ARIA labels and roles', async () => {
      await page.waitForSelector('[data-testid="api-key-manager"]');
      
      // Check for proper headings
      const mainHeading = page.locator('h3:has-text("API Keys Management")');
      await expect(mainHeading).toBeVisible();
      
      // Create button should have proper labeling
      const createButton = page.locator('[data-testid="create-key-button"]');
      await expect(createButton).toHaveAttribute('type', 'button');
      
      // Key cards should have proper structure
      const keyCards = page.locator('[data-testid="api-key-card"]');
      await expect(keyCards.first().locator('h4')).toBeVisible(); // Key name as heading
    });

    test('should announce status changes to screen readers', async () => {
      await page.waitForSelector('[data-testid="api-key-manager"]');
      
      // Click copy button
      const firstKey = page.locator('[data-testid="api-key-card"]').first();
      await firstKey.locator('[data-testid="copy-key"]').click();
      
      // Toast message should be announced
      const toast = page.locator('text=API key copied to clipboard');
      await expect(toast).toBeVisible();
      
      // Toast should have appropriate role for screen readers
      await expect(toast.locator('xpath=ancestor::*[@role="status" or @aria-live]')).toHaveCount(1);
    });
  });

  describe('Error Recovery', () => {
    test('should recover from network errors gracefully', async () => {
      // Start with working API
      await page.waitForSelector('[data-testid="api-key-manager"]');
      
      // Simulate network failure
      await page.route('**/functions/v1/create-api-key', async route => {
        await route.abort('failed');
      });
      
      await page.click('[data-testid="create-key-button"]');
      await page.fill('input[placeholder*="Mobile App Key"]', 'Network Test Key');
      await page.check('input[type="checkbox"]', { force: true });
      
      await page.click('button:has-text("Create Key")');
      
      // Should show appropriate error message
      await expect(page.locator('text=Failed to create')).toBeVisible();
      
      // Dialog should remain open for retry
      await expect(page.locator('[data-testid="create-key-dialog"]')).toBeVisible();
      
      // Restore network and try again
      await page.route('**/functions/v1/create-api-key', async route => {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            message: 'API key created successfully',
            api_key: 'ak_network_recovery_test',
            key_data: { id: 'recovery-test', name: 'Network Test Key' }
          })
        });
      });
      
      await page.click('button:has-text("Create Key")');
      
      // Should now succeed
      await expect(page.locator('text=API Key Created Successfully')).toBeVisible();
    });

    test('should handle authentication failures appropriately', async () => {
      // Mock auth failure
      await page.route('**/functions/v1/create-api-key', async route => {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Authentication failed',
            details: 'Invalid or expired token'
          })
        });
      });
      
      await page.click('[data-testid="create-key-button"]');
      await page.fill('input[placeholder*="Mobile App Key"]', 'Auth Test Key');
      await page.check('input[type="checkbox"]', { force: true });
      
      await page.click('button:has-text("Create Key")');
      
      // Should show auth error and suggest re-login
      await expect(page.locator('text=Authentication error')).toBeVisible();
    });
  });
});