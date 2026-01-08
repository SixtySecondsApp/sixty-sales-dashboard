import { test, expect } from '@playwright/test';
import { testContacts, testActivities, testDeals, testTasks } from '../fixtures/test-data';

test.describe('Critical User Flows', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('/');
    
    // Wait for the page to load completely
    await page.waitForLoadState('networkidle');
  });

  test('Page loads without 404 errors for static resources', async ({ page }) => {
    const responses: any[] = [];
    
    // Listen for all network responses
    page.on('response', response => {
      responses.push({
        url: response.url(),
        status: response.status(),
        statusText: response.statusText()
      });
    });

    // Navigate and wait for load
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check for 404 errors on static resources
    const staticResourceErrors = responses.filter(response => 
      response.status === 404 && 
      (response.url.includes('.css') || 
       response.url.includes('.js') || 
       response.url.includes('.svg') || 
       response.url.includes('.png') || 
       response.url.includes('.ico'))
    );

    if (staticResourceErrors.length > 0) {
    }

    expect(staticResourceErrors).toHaveLength(0);
  });

  test('No console errors on page load', async ({ page }) => {
    const errors: string[] = [];
    
    // Listen for console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Wait a bit to catch any delayed errors
    await page.waitForTimeout(2000);

    // Filter out known acceptable errors (if any)
    const criticalErrors = errors.filter(error => 
      !error.includes('favicon.ico') && 
      !error.includes('ResizeObserver loop limit exceeded') &&
      !error.includes('Non-passive event listener') // Common non-critical warnings
    );

    if (criticalErrors.length > 0) {
    }

    expect(criticalErrors).toHaveLength(0);
  });

  test('Authentication flow works correctly', async ({ page }) => {
    // Start at login page
    await page.goto('/auth');

    // Check if login form is present
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    const submitButton = page.locator('button[type="submit"]');

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(submitButton).toBeVisible();

    // Test with invalid credentials first
    await emailInput.fill('invalid@example.com');
    await passwordInput.fill('wrongpassword');
    await submitButton.click();

    // Should show error message
    await expect(page.locator('text=/Invalid|Error|Failed/i')).toBeVisible({ timeout: 10000 });

    // Clear and try with valid test credentials (if available)
    if (process.env.TEST_USER_EMAIL && process.env.TEST_USER_PASSWORD) {
      await emailInput.fill(process.env.TEST_USER_EMAIL);
      await passwordInput.fill(process.env.TEST_USER_PASSWORD);
      await submitButton.click();

      // Should redirect to dashboard
      await expect(page).toHaveURL('/dashboard', { timeout: 30000 });
    }
  });

  test('QuickAdd modal opens and closes correctly', async ({ page }) => {
    // Assuming user is logged in or on a page where QuickAdd is available
    await page.goto('/dashboard');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Look for QuickAdd trigger (adjust selector based on your implementation)
    const quickAddTrigger = page.locator('[data-testid="quick-add-button"], button:has-text("Quick Add"), .quick-add-btn');
    
    if (await quickAddTrigger.count() > 0) {
      await quickAddTrigger.click();

      // Modal should be visible
      const modal = page.locator('[role="dialog"], .modal, .quick-add-modal');
      await expect(modal).toBeVisible();

      // Should have action buttons
      await expect(page.locator('text=/Add Task|Add Deal|Add Sale|Add Meeting/i')).toBeVisible();

      // Close modal with X button
      const closeButton = page.locator('[aria-label="close"], button:has-text("×"), .close-btn');
      await closeButton.click();

      // Modal should be hidden
      await expect(modal).toBeHidden();
    } else {
    }
  });

  test('Task creation through QuickAdd works', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Open QuickAdd
    const quickAddTrigger = page.locator('[data-testid="quick-add-button"], button:has-text("Quick Add"), .quick-add-btn');
    
    if (await quickAddTrigger.count() > 0) {
      await quickAddTrigger.click();
      
      // Click on Add Task
      await page.locator('text=/Add Task|Task/i').click();

      // Fill in task details
      const titleInput = page.locator('input[name="title"], input[placeholder*="title"], input[placeholder*="task"]');
      await titleInput.fill(testTasks.validTask.title);

      // Select task type if available
      const taskTypeSelector = page.locator('select[name="task_type"], select[name="taskType"]');
      if (await taskTypeSelector.count() > 0) {
        await taskTypeSelector.selectOption(testTasks.validTask.taskType);
      }

      // Set priority if available
      const prioritySelector = page.locator('select[name="priority"]');
      if (await prioritySelector.count() > 0) {
        await prioritySelector.selectOption(testTasks.validTask.priority);
      }

      // Submit the form
      const submitButton = page.locator('button[type="submit"], button:has-text("Create")');
      await submitButton.click();

      // Should show success message
      await expect(page.locator('text=/Task created|Success|Added successfully/i')).toBeVisible({ timeout: 10000 });
    } else {
    }
  });

  test('Contact creation works without 403 errors', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Monitor network requests for 403 errors
    const forbiddenRequests: any[] = [];
    page.on('response', response => {
      if (response.status() === 403) {
        forbiddenRequests.push({
          url: response.url(),
          status: response.status(),
          headers: response.headers()
        });
      }
    });

    // Try to create a contact (adjust based on your UI)
    const contactsLink = page.locator('a[href*="contact"]').or(page.getByText(/Contacts/i));
    if (await contactsLink.count() > 0) {
      await contactsLink.click();
      
      // Look for add contact button
      const addContactBtn = page.locator('button:has-text("Add Contact"), [data-testid="add-contact"]');
      if (await addContactBtn.count() > 0) {
        await addContactBtn.click();

        // Fill in contact form
        const firstNameInput = page.locator('input[name="firstName"], input[name="first_name"]');
        if (await firstNameInput.count() > 0) {
          await firstNameInput.fill(testContacts.validContact.firstName);
        }

        const lastNameInput = page.locator('input[name="lastName"], input[name="last_name"]');
        if (await lastNameInput.count() > 0) {
          await lastNameInput.fill(testContacts.validContact.lastName);
        }

        const emailInput = page.locator('input[name="email"]');
        if (await emailInput.count() > 0) {
          await emailInput.fill(testContacts.validContact.email);
        }

        // Submit the form
        const submitBtn = page.locator('button[type="submit"], button:has-text("Save")');
        if (await submitBtn.count() > 0) {
          await submitBtn.click();
          
          // Wait for response
          await page.waitForTimeout(3000);
        }
      }
    }

    // Check for 403 errors
    if (forbiddenRequests.length > 0) {
    }

    expect(forbiddenRequests).toHaveLength(0);
  });

  test('Web vitals and performance metrics load correctly', async ({ page }) => {
    // Navigate to page
    await page.goto('/dashboard');
    
    // Check that performance monitoring is working
    const webVitalsScript = await page.locator('script').evaluateAll(scripts => {
      return scripts.some(script => 
        script.src?.includes('web-vitals') || 
        script.textContent?.includes('getCLS') ||
        script.textContent?.includes('getFID') ||
        script.textContent?.includes('getLCP')
      );
    });

    // Check that no errors occurred while loading web vitals
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error' && msg.text().toLowerCase().includes('vitals')) {
        errors.push(msg.text());
      }
    });

    // Wait for vitals to load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Should not have vitals-related errors
    expect(errors).toHaveLength(0);
  });

  test('Forms show proper validation errors', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Try QuickAdd with invalid data
    const quickAddTrigger = page.locator('[data-testid="quick-add-button"], button:has-text("Quick Add"), .quick-add-btn');
    
    if (await quickAddTrigger.count() > 0) {
      await quickAddTrigger.click();
      
      // Click on Add Task
      const taskButton = page.locator('text=/Add Task|Task/i');
      if (await taskButton.count() > 0) {
        await taskButton.click();

        // Try to submit empty form
        const submitButton = page.locator('button[type="submit"], button:has-text("Create")');
        await submitButton.click();

        // Should show validation error
        await expect(page.locator('text=/required|Required|Please fill|Please enter/i')).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test('User can navigate between main sections without errors', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Navigation sections to test
    const navigationTests = [
      { name: 'Dashboard', href: 'dashboard' },
      { name: 'Contacts', href: 'contact' },
      { name: 'Deals', href: 'deal' },
      { name: 'Activities', href: 'activit' },
      { name: 'Tasks', href: 'task' }
    ];

    for (const nav of navigationTests) {
      // Use .or() to combine CSS and text selectors properly
      const element = page.locator(`a[href*="${nav.href}"]`).or(page.getByText(new RegExp(nav.name, 'i'))).first();
      if (await element.count() > 0) {
        await element.click();
        await page.waitForLoadState('networkidle');

        // Check for any errors
        const errorMessages = page.getByText(/Error|Failed|Something went wrong/i);
        const errorCount = await errorMessages.count();

        if (errorCount > 0) {
        }

        expect(errorCount).toBe(0);
      }
    }
  });
});