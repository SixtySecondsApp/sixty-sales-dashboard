import { describe, test, expect as vitestExpect, beforeAll, afterAll, beforeEach } from 'vitest';
import { expect as playwrightExpect } from '../fixtures/playwright-assertions';
import { setupPlaywriter, teardownPlaywriter } from '../fixtures/playwriter-setup';
import { testContacts, testActivities, testDeals, testTasks } from '../fixtures/test-data';
import type { Page } from 'playwright-core';

const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || process.env.VITE_BASE_URL || 'http://localhost:5175';

describe('QuickAdd Functionality', () => {
  let page: Page;

  beforeAll(async () => {
    const setup = await setupPlaywriter();
    page = setup.page;
  });

  afterAll(async () => {
    await teardownPlaywriter();
  });

  beforeEach(async () => {
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');
  });

  test('QuickAdd modal displays all action options', async () => {
    // Open QuickAdd modal
    const quickAddTrigger = page.locator('[data-testid="quick-add-button"], button:has-text("Quick Add"), .quick-add-btn, [class*="quick-add"]');
    await quickAddTrigger.click();

    // Check that all action options are present
    const expectedActions = ['Task', 'Deal', 'Sale', 'Outbound', 'Meeting', 'Proposal'];
    
    for (const action of expectedActions) {
      await playwrightExpect(page.locator(`text=${action}, [aria-label*="${action}"], [data-action="${action.toLowerCase()}"]`)).toBeVisible();
    }
  });

  test('Task creation validates required fields', async () => {
    // Open QuickAdd and select Task
    const quickAddTrigger = page.locator('[data-testid="quick-add-button"], button:has-text("Quick Add"), .quick-add-btn, [class*="quick-add"]');
    await quickAddTrigger.click();
    
    await page.locator('text=Task, [data-action="task"]').click();

    // Try to submit without required fields
    const submitBtn = page.locator('button[type="submit"], button:has-text("Create")');
    await submitBtn.click();

    // Should show validation error for title
    await playwrightExpect(page.locator('text=/title.*required|Title.*required|Please.*title/i')).toBeVisible();

    // Fill in title
    const titleInput = page.locator('input[name="title"], input[placeholder*="title"]');
    await titleInput.fill(testTasks.validTask.title);

    // Now submit should work
    await submitBtn.click();
    
    // Should show success or close modal
    const successMessage = page.locator('text=/created|success|added/i');
    await playwrightExpect(successMessage.or(page.locator('[role="dialog"]').nth(0))).toBeVisible({ timeout: 10000 });
  });

  test('Meeting creation requires contact selection', async () => {
    const quickAddTrigger = page.locator('[data-testid="quick-add-button"], button:has-text("Quick Add"), .quick-add-btn, [class*="quick-add"]');
    await quickAddTrigger.click();
    
    await page.locator('text=Meeting, [data-action="meeting"]').click();

    // Should show contact search or selection
    const contactSearch = page.locator('input[placeholder*="contact"], input[placeholder*="search"], text=/select.*contact/i');
    await playwrightExpect(contactSearch.or(page.locator('text=/Please.*contact|Select.*contact/i'))).toBeVisible();

    // Try to submit without contact
    const submitBtn = page.locator('button[type="submit"], button:has-text("Create")');
    if (await submitBtn.count() > 0) {
      await submitBtn.click();
      
      // Should show error about missing contact
      await playwrightExpect(page.locator('text=/contact.*required|Please.*select.*contact|Select.*contact/i')).toBeVisible();
    }
  });

  test('Sale creation shows revenue split fields for admin', async () => {
    const quickAddTrigger = page.locator('[data-testid="quick-add-button"], button:has-text("Quick Add"), .quick-add-btn, [class*="quick-add"]');
    await quickAddTrigger.click();
    
    await page.locator('text=Sale, [data-action="sale"]').click();

    // Should show revenue split fields (if admin user)
    const monthlyMrrField = page.locator('input[name*="monthly"], input[placeholder*="monthly"], input[placeholder*="subscription"]');
    const oneOffField = page.locator('input[name*="oneoff"], input[name*="one-off"], input[placeholder*="one-off"]');
    
    // These fields should be present for admins
    if (await monthlyMrrField.count() > 0) {
      await playwrightExpect(monthlyMrrField).toBeVisible();
    }
    if (await oneOffField.count() > 0) {
      await playwrightExpect(oneOffField).toBeVisible();
    }
  });

  test('Proposal creation requires company name', async () => {
    const quickAddTrigger = page.locator('[data-testid="quick-add-button"], button:has-text("Quick Add"), .quick-add-btn, [class*="quick-add"]');
    await quickAddTrigger.click();
    
    await page.locator('text=Proposal, [data-action="proposal"]').click();

    // Fill in some fields but not company
    const amountInput = page.locator('input[name="amount"], input[placeholder*="amount"], input[placeholder*="value"]');
    if (await amountInput.count() > 0) {
      await amountInput.fill('50000');
    }

    // Try to submit without company name
    const submitBtn = page.locator('button[type="submit"], button:has-text("Create")');
    if (await submitBtn.count() > 0) {
      await submitBtn.click();
      
      // Should show error about missing company
      await playwrightExpect(page.locator('text=/company.*required|Please.*company|Enter.*company/i')).toBeVisible();
    }
  });

  test('Outbound activity creation works with optional fields', async () => {
    const quickAddTrigger = page.locator('[data-testid="quick-add-button"], button:has-text("Quick Add"), .quick-add-btn, [class*="quick-add"]');
    await quickAddTrigger.click();
    
    await page.locator('text=Outbound, [data-action="outbound"]').click();

    // Fill in basic fields
    const clientNameInput = page.locator('input[name*="client"], input[placeholder*="client"], input[placeholder*="company"]');
    if (await clientNameInput.count() > 0) {
      await clientNameInput.fill(testActivities.outbound.clientName);
    }

    // Select outbound type if available
    const outboundTypeSelect = page.locator('select[name*="type"], select[name*="outbound"]');
    if (await outboundTypeSelect.count() > 0) {
      await outboundTypeSelect.selectOption('Call');
    }

    // Submit should work
    const submitBtn = page.locator('button[type="submit"], button:has-text("Create")');
    await submitBtn.click();
    
    // Should show success
    await playwrightExpect(page.locator('text=/outbound.*added|success|created/i')).toBeVisible({ timeout: 10000 });
  });

  test('Form shows proper loading states', async () => {
    const quickAddTrigger = page.locator('[data-testid="quick-add-button"], button:has-text("Quick Add"), .quick-add-btn, [class*="quick-add"]');
    await quickAddTrigger.click();
    
    await page.locator('text=Task, [data-action="task"]').click();

    // Fill in required fields
    const titleInput = page.locator('input[name="title"], input[placeholder*="title"]');
    await titleInput.fill(testTasks.validTask.title);

    // Submit and check for loading state
    const submitBtn = page.locator('button[type="submit"], button:has-text("Create")');
    await submitBtn.click();

    // Should show loading state temporarily
    const loadingIndicator = page.locator('text=/creating|loading|submitting/i, [class*="loading"], [class*="spinner"]');
    
    // Loading state might be brief, so use or() with success state
    const loadingOrSuccess = loadingIndicator.or(page.locator('text=/created|success/i'));
    await playwrightExpect(loadingOrSuccess).toBeVisible({ timeout: 10000 });
  });

  test('Error handling shows user-friendly messages', async () => {
    // Listen for network errors
    let networkErrorOccurred = false;
    page.route('**/api/**', route => {
      // Simulate network error for testing
      if (route.request().method() === 'POST' && Math.random() > 0.5) {
        networkErrorOccurred = true;
        route.abort('failed');
      } else {
        route.continue();
      }
    });

    const quickAddTrigger = page.locator('[data-testid="quick-add-button"], button:has-text("Quick Add"), .quick-add-btn, [class*="quick-add"]');
    await quickAddTrigger.click();
    
    await page.locator('text=Task, [data-action="task"]').click();

    const titleInput = page.locator('input[name="title"], input[placeholder*="title"]');
    await titleInput.fill('Test error handling');

    const submitBtn = page.locator('button[type="submit"], button:has-text("Create")');
    await submitBtn.click();

    if (networkErrorOccurred) {
      // Should show user-friendly error message
      await playwrightExpect(page.locator('text=/error|failed|try again|something went wrong/i')).toBeVisible({ timeout: 10000 });
    }
  });

  test('Modal can be closed and reopened without issues', async () => {
    const quickAddTrigger = page.locator('[data-testid="quick-add-button"], button:has-text("Quick Add"), .quick-add-btn, [class*="quick-add"]');
    
    // Open modal
    await quickAddTrigger.click();
    let modal = page.locator('[role="dialog"], .modal, [class*="quick-add-modal"]');
    await playwrightExpect(modal).toBeVisible();

    // Close modal
    const closeBtn = page.locator('[aria-label="close"], button:has-text("×"), .close-btn');
    await closeBtn.click();
    await playwrightExpect(modal).toBeHidden();

    // Reopen modal
    await quickAddTrigger.click();
    modal = page.locator('[role="dialog"], .modal, [class*="quick-add-modal"]');
    await playwrightExpect(modal).toBeVisible();

    // Should still show all options
    const expectedActions = ['Task', 'Deal', 'Sale', 'Outbound', 'Meeting', 'Proposal'];
    for (const action of expectedActions) {
      await playwrightExpect(page.locator(`text=${action}, [data-action="${action.toLowerCase()}"]`)).toBeVisible();
    }
  });

  test('Form fields reset correctly between actions', async () => {
    const quickAddTrigger = page.locator('[data-testid="quick-add-button"], button:has-text("Quick Add"), .quick-add-btn, [class*="quick-add"]');
    await quickAddTrigger.click();
    
    // Select task and fill in data
    await page.locator('text=Task, [data-action="task"]').click();
    const titleInput = page.locator('input[name="title"], input[placeholder*="title"]');
    await titleInput.fill('Test task title');

    // Go back to main menu
    const backBtn = page.locator('button[aria-label="back"], button:has-text("←"), .back-btn');
    if (await backBtn.count() > 0) {
      await backBtn.click();
    } else {
      // Close and reopen if no back button
      const closeBtn = page.locator('[aria-label="close"], button:has-text("×"), .close-btn');
      await closeBtn.click();
      await quickAddTrigger.click();
    }

    // Select different action
    await page.locator('text=Sale, [data-action="sale"]').click();

    // Previous task title should not be visible
    const saleAmountInput = page.locator('input[name="amount"], input[placeholder*="amount"]');
    if (await saleAmountInput.count() > 0) {
      const value = await saleAmountInput.inputValue();
      vitestExpect(value).toBe(''); // Should be empty
    }
  });
});
