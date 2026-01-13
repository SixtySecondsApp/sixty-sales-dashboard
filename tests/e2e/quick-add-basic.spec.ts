import { describe, test, expect as vitestExpect, beforeAll, afterAll, beforeEach } from 'vitest';
import { expect as playwrightExpect } from '../fixtures/playwright-assertions';
import { setupPlaywriter, teardownPlaywriter } from '../fixtures/playwriter-setup';
import type { Page } from 'playwright-core';

const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || process.env.VITE_BASE_URL || 'http://localhost:5175';

describe('Quick Add Basic Functionality', () => {
  let page: Page;

  beforeAll(async () => {
    const setup = await setupPlaywriter();
    page = setup.page;
  });

  afterAll(async () => {
    await teardownPlaywriter();
  });

  beforeEach(async () => {
    // Navigate to the app
    await page.goto(BASE_URL);
    
    // Check if we need to login
    const isLoginPage = await page.locator('text=/Sign in|Login/i').isVisible().catch(() => false);
    
    if (isLoginPage) {
      // Perform login
      await page.fill('input[type="email"]', 'test@example.com');
      await page.fill('input[type="password"]', 'password123');
      await page.click('button:has-text("Sign in")');
      
      // Wait for dashboard to load
      await page.waitForURL('**/dashboard', { timeout: 10000 }).catch(() => {});
    }
  });

  test('should open Quick Add modal and display all action buttons', async () => {
    // Look for Quick Add button (Plus icon button)
    const quickAddButton = page.locator('button').filter({ has: page.locator('svg.lucide-plus') }).first();
    
    // Click Quick Add button
    await quickAddButton.click();
    
    // Wait for modal to appear
    await page.waitForSelector('[role="dialog"], .fixed.inset-0', { timeout: 5000 });
    
    // Verify all quick action buttons are visible
    await playwrightExpect(page.locator('text=Create Deal')).toBeVisible();
    await playwrightExpect(page.locator('text=Add Task')).toBeVisible();
    await playwrightExpect(page.locator('text=Add Sale')).toBeVisible();
    await playwrightExpect(page.locator('text=Add Outbound')).toBeVisible();
    await playwrightExpect(page.locator('text=Add Meeting')).toBeVisible();
    await playwrightExpect(page.locator('text=Add Proposal')).toBeVisible();
  });

  test('should create a task successfully', async () => {
    // Open Quick Add modal
    const quickAddButton = page.locator('button').filter({ has: page.locator('svg.lucide-plus') }).first();
    await quickAddButton.click();
    
    // Wait for modal
    await page.waitForSelector('[role="dialog"], .fixed.inset-0', { timeout: 5000 });
    
    // Click Add Task
    await page.click('text=Add Task');
    
    // Fill in task details
    await page.fill('input[placeholder*="task title"], input[placeholder*="Task title"]', 'Test Task from E2E');
    
    // Select priority if visible
    const priorityButton = page.locator('button:has-text("Medium")').first();
    if (await priorityButton.isVisible()) {
      await priorityButton.click();
      await page.click('text=High');
    }
    
    // Submit the form
    const submitButton = page.locator('button:has-text("Add Task"), button:has-text("Create Task")').first();
    await submitButton.click();
    
    // Wait for success message or modal to close
    await Promise.race([
      page.waitForSelector('text=/success|created/i', { timeout: 5000 }),
      page.waitForSelector('[role="dialog"], .fixed.inset-0', { state: 'hidden', timeout: 5000 })
    ]);
  });

  test('should open DealWizard and show contact search automatically', async () => {
    // Open Quick Add modal
    const quickAddButton = page.locator('button').filter({ has: page.locator('svg.lucide-plus') }).first();
    await quickAddButton.click();
    
    // Wait for modal
    await page.waitForSelector('[role="dialog"], .fixed.inset-0', { timeout: 5000 });
    
    // Click Create Deal
    await page.click('text=Create Deal');
    
    // Wait for DealWizard to open
    await page.waitForSelector('text=Create New Deal', { timeout: 5000 });
    
    // Verify contact search modal opens automatically or search button is visible
    const contactSearchIndicators = [
      'text=Select Contact',
      'text=Search Contact',
      'input[placeholder*="Search"]',
      'text=Search for existing contacts'
    ];
    
    let foundContactSearch = false;
    for (const selector of contactSearchIndicators) {
      if (await page.locator(selector).isVisible().catch(() => false)) {
        foundContactSearch = true;
        break;
      }
    }
    
    vitestExpect(foundContactSearch).toBeTruthy();
  });

  test('should create an outbound activity', async () => {
    // Open Quick Add modal
    const quickAddButton = page.locator('button').filter({ has: page.locator('svg.lucide-plus') }).first();
    await quickAddButton.click();
    
    // Wait for modal
    await page.waitForSelector('[role="dialog"], .fixed.inset-0', { timeout: 5000 });
    
    // Click Add Outbound
    await page.click('text=Add Outbound');
    
    // Fill in outbound details
    await page.fill('input[placeholder*="Client"], input[placeholder*="client"], input[placeholder*="Company"]', 'Test Client E2E');
    
    // Select outbound type if dropdown exists
    const typeSelector = page.locator('select, button:has-text("Call")').first();
    if (await typeSelector.isVisible()) {
      if (await typeSelector.evaluate(el => el.tagName === 'SELECT')) {
        await typeSelector.selectOption('LinkedIn');
      } else {
        await typeSelector.click();
        await page.click('text=LinkedIn');
      }
    }
    
    // Set quantity if field exists
    const quantityField = page.locator('input[type="number"], input[placeholder*="Quantity"]').first();
    if (await quantityField.isVisible()) {
      await quantityField.fill('3');
    }
    
    // Submit the form
    const submitButton = page.locator('button:has-text("Add Outbound"), button:has-text("Create")').last();
    await submitButton.click();
    
    // Wait for success or modal close
    await Promise.race([
      page.waitForSelector('text=/success|added/i', { timeout: 5000 }),
      page.waitForSelector('[role="dialog"], .fixed.inset-0', { state: 'hidden', timeout: 5000 })
    ]);
  });
});
