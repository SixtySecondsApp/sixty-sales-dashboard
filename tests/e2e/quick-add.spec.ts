import { test, expect, Page } from '@playwright/test';

// Test utilities
async function openQuickAdd(page: Page) {
  // Look for the Quick Add button/trigger (assumes there's a + button or similar)
  await page.click('[data-testid="quick-add-trigger"], .quick-add-trigger, button:has-text("Quick Add")');
  await expect(page.locator('text=Quick Add')).toBeVisible();
}

async function waitForToast(page: Page, message?: string) {
  if (message) {
    await expect(page.locator('.sonner-toast, [data-sonner-toast]').filter({ hasText: message })).toBeVisible();
  } else {
    await expect(page.locator('.sonner-toast, [data-sonner-toast]')).toBeVisible();
  }
}

async function navigateToDashboard(page: Page) {
  // Navigate to dashboard - adjust selector based on actual implementation
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');
}

test.describe('Quick Add E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('/');
    
    // Wait for app to load
    await page.waitForLoadState('networkidle');
    
    // Assume user is logged in or handle authentication here
    // You may need to add authentication steps
  });

  test.describe('Task Creation Workflow', () => {
    test('should create a task and verify it appears on dashboard', async ({ page }) => {
      // Open Quick Add modal
      await openQuickAdd(page);
      
      // Click Add Task
      await page.click('text=Add Task');
      
      // Fill out task form
      await page.fill('input[placeholder*="Call John"]', 'Follow up with new prospect');
      
      // Select task type - Email
      await page.click('button:has-text("Email")');
      
      // Select priority - High
      await page.click('button:has-text("High")');
      
      // Add due date using quick button
      await page.click('button:has-text("Tomorrow 9AM")');
      
      // Add description
      await page.fill('textarea[placeholder*="additional context"]', 'Need to send proposal details');
      
      // Add contact info
      await page.fill('input[placeholder="John Smith"]', 'Alice Johnson');
      await page.fill('input[placeholder="Acme Corp"]', 'Johnson Enterprises');
      
      // Submit task
      await page.click('button:has-text("Create Task")');
      
      // Verify success message
      await waitForToast(page, 'Task created successfully');
      
      // Navigate to tasks/dashboard view
      await navigateToDashboard(page);
      
      // Verify task appears in the list
      await expect(page.locator('text=Follow up with new prospect')).toBeVisible();
      await expect(page.locator('text=Alice Johnson')).toBeVisible();
      await expect(page.locator('text=Johnson Enterprises')).toBeVisible();
    });

    test('should create urgent task with custom due date', async ({ page }) => {
      await openQuickAdd(page);
      await page.click('text=Add Task');
      
      // Fill task details
      await page.fill('input[placeholder*="Call John"]', 'Urgent: Contract review needed');
      
      // Select Demo task type
      await page.click('button:has-text("Demo")');
      
      // Select Urgent priority
      await page.click('button:has-text("Urgent")');
      
      // Set custom due date
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowString = tomorrow.toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM format
      
      await page.fill('input[type="datetime-local"]', tomorrowString);
      
      // Submit task
      await page.click('button:has-text("Create Task")');
      
      await waitForToast(page, 'Task created successfully');
      
      // Verify on dashboard
      await navigateToDashboard(page);
      await expect(page.locator('text=Urgent: Contract review needed')).toBeVisible();
    });
  });

  test.describe('Meeting Creation Workflow', () => {
    test('should create a discovery meeting and verify activity', async ({ page }) => {
      await openQuickAdd(page);
      await page.click('text=Add Meeting');
      
      // Fill prospect name
      await page.fill('input:near(label:text("Prospect Name"))', 'Sarah Wilson');
      
      // Select meeting type
      await page.selectOption('select:near(label:text("Meeting Type"))', 'Discovery');
      
      // Enter email identifier
      await page.fill('[data-testid="identifier-field"], input[placeholder*="email"]', 'sarah@wilsontech.com');
      
      // Select deal (if deal selector is present)
      const dealSelector = page.locator('text=Select Deal');
      if (await dealSelector.isVisible()) {
        await dealSelector.click();
      }
      
      // Submit meeting
      await page.click('button:has-text("Add Meeting")');
      
      await waitForToast(page, 'Activity added successfully');
      
      // Verify on dashboard - should appear in activities feed
      await navigateToDashboard(page);
      await expect(page.locator('text=Sarah Wilson')).toBeVisible();
      await expect(page.locator('text=Discovery')).toBeVisible();
    });

    test('should create scheduled demo meeting', async ({ page }) => {
      await openQuickAdd(page);
      await page.click('text=Add Meeting');
      
      await page.fill('input:near(label:text("Prospect Name"))', 'Tech Startup Inc');
      await page.selectOption('select:near(label:text("Meeting Type"))', 'Demo');
      
      // Change status to scheduled
      await page.selectOption('select:near(label:text("Status"))', 'pending');
      
      await page.fill('[data-testid="identifier-field"]', 'demo@techstartup.com');
      
      await page.click('button:has-text("Add Meeting")');
      await waitForToast(page, 'Activity added successfully');
      
      await navigateToDashboard(page);
      await expect(page.locator('text=Tech Startup Inc')).toBeVisible();
      await expect(page.locator('text=Demo')).toBeVisible();
    });
  });

  test.describe('Proposal Creation Workflow', () => {
    test('should create proposal with deal and verify LTV calculation', async ({ page }) => {
      await openQuickAdd(page);
      await page.click('text=Add Proposal');
      
      // Deal Wizard should open
      await expect(page.locator('[data-testid="deal-wizard"], text=DealWizard')).toBeVisible();
      
      // Create deal through wizard (simplified - may need more steps)
      await page.click('button:has-text("Create Deal")');
      
      // Should return to proposal form with deal selected
      await expect(page.locator('input:near(label:text("Prospect Name"))')).toBeVisible();
      
      await page.fill('input:near(label:text("Prospect Name"))', 'Big Enterprise Corp');
      await page.fill('[data-testid="identifier-field"]', 'procurement@bigenterprise.com');
      
      // Enter revenue amounts
      await page.fill('input:near(label:text("One-off Revenue"))', '10000');
      await page.fill('input:near(label:text("Monthly Recurring Revenue"))', '2000');
      
      // Verify LTV calculation display (2000 * 3 + 10000 = 16000)
      await expect(page.locator('text=£16,000')).toBeVisible();
      
      // Submit proposal
      await page.click('button:has-text("Add Proposal")');
      await waitForToast(page, 'Activity added successfully');
      
      // Verify on dashboard
      await navigateToDashboard(page);
      await expect(page.locator('text=Big Enterprise Corp')).toBeVisible();
      await expect(page.locator('text=£16,000')).toBeVisible();
    });

    test('should require deal for proposal creation', async ({ page }) => {
      await openQuickAdd(page);
      await page.click('text=Add Proposal');
      
      // Deal Wizard opens
      await expect(page.locator('[data-testid="deal-wizard"]')).toBeVisible();
      
      // Cancel deal creation
      await page.click('button:has-text("Cancel")');
      
      // Should return to main action selection
      await expect(page.locator('text=Create Deal')).toBeVisible();
      await expect(page.locator('text=Add Task')).toBeVisible();
    });
  });

  test.describe('Sales Creation Workflow', () => {
    test('should create subscription sale and auto-create deal', async ({ page }) => {
      await openQuickAdd(page);
      await page.click('text=Add Sale');
      
      // Deal Wizard opens
      await page.click('button:has-text("Create Deal")');
      
      // Fill sale details
      await page.fill('input:near(label:text("Client Name"))', 'Happy Customer Ltd');
      await page.selectOption('select:near(label:text("Sale Type"))', 'subscription');
      await page.fill('[data-testid="identifier-field"]', 'accounts@happycustomer.com');
      
      // Add monthly MRR
      await page.fill('input:near(label:text("Monthly Recurring Revenue"))', '1500');
      
      // Verify calculation (1500 * 3 = 4500)
      await expect(page.locator('text=£4,500')).toBeVisible();
      
      // Submit sale
      await page.click('button:has-text("Add Sale")');
      await waitForToast(page, 'Sale added successfully! 🎉');
      
      // Verify on dashboard
      await navigateToDashboard(page);
      await expect(page.locator('text=Happy Customer Ltd')).toBeVisible();
      await expect(page.locator('text=£4,500')).toBeVisible();
      
      // Should also create pipeline deal
      // Navigate to pipeline view if available
      const pipelineLink = page.locator('a:has-text("Pipeline"), button:has-text("Pipeline")');
      if (await pipelineLink.isVisible()) {
        await pipelineLink.click();
        await expect(page.locator('text=Happy Customer Ltd')).toBeVisible();
      }
    });

    test('should create one-off sale with proper calculation', async ({ page }) => {
      await openQuickAdd(page);
      await page.click('text=Add Sale');
      
      await page.click('button:has-text("Create Deal")');
      
      await page.fill('input:near(label:text("Client Name"))', 'One Time Project');
      await page.selectOption('select:near(label:text("Sale Type"))', 'one-off');
      await page.fill('[data-testid="identifier-field"]', 'project@onetime.com');
      
      // Add one-off revenue
      await page.fill('input:near(label:text("One-off Revenue"))', '8500');
      
      // Total should just be the one-off amount
      await expect(page.locator('text=£8,500')).toBeVisible();
      
      await page.click('button:has-text("Add Sale")');
      await waitForToast(page, 'Sale added successfully! 🎉');
      
      await navigateToDashboard(page);
      await expect(page.locator('text=One Time Project')).toBeVisible();
    });
  });

  test.describe('Outbound Activities Workflow', () => {
    test('should create LinkedIn outbound with quantity', async ({ page }) => {
      await openQuickAdd(page);
      await page.click('text=Add Outbound');
      
      await page.fill('input:near(label:text("Contact Name"))', 'Multiple LinkedIn Prospects');
      await page.selectOption('select:near(label:text("Outreach Type"))', 'LinkedIn');
      
      // Set quantity to 5
      await page.fill('input:near(label:text("Quantity"))', '5');
      
      // Add optional identifier
      await page.fill('[data-testid="identifier-field"]', 'batch@linkedin.com');
      
      await page.click('button:has-text("Add Outbound")');
      await waitForToast(page, 'Activity added successfully');
      
      await navigateToDashboard(page);
      await expect(page.locator('text=Multiple LinkedIn Prospects')).toBeVisible();
      await expect(page.locator('text=LinkedIn')).toBeVisible();
    });

    test('should create email outbound without identifier', async ({ page }) => {
      await openQuickAdd(page);
      await page.click('text=Add Outbound');
      
      await page.fill('input:near(label:text("Contact Name"))', 'Cold Email Prospect');
      await page.selectOption('select:near(label:text("Outreach Type"))', 'Email');
      
      // Don't add identifier - should still work for outbound
      
      await page.click('button:has-text("Add Outbound")');
      await waitForToast(page, 'Activity added successfully');
      
      await navigateToDashboard(page);
      await expect(page.locator('text=Cold Email Prospect')).toBeVisible();
    });
  });

  test.describe('Deal Creation Through Wizard', () => {
    test('should create deal directly via wizard', async ({ page }) => {
      await openQuickAdd(page);
      await page.click('text=Create Deal');
      
      // Deal Wizard opens
      await expect(page.locator('[data-testid="deal-wizard"]')).toBeVisible();
      
      // Create deal
      await page.click('button:has-text("Create Deal")');
      
      await waitForToast(page, 'Deal created successfully!');
      
      // Should close modal and return to main view
      await expect(page.locator('text=Quick Add')).not.toBeVisible();
      
      // Navigate to pipeline to verify deal creation
      const pipelineLink = page.locator('a:has-text("Pipeline"), button:has-text("Pipeline")');
      if (await pipelineLink.isVisible()) {
        await pipelineLink.click();
        await expect(page.locator('text=Test Company')).toBeVisible(); // From mocked deal
      }
    });
  });

  test.describe('Validation and Error Handling', () => {
    test('should show validation error for empty task title', async ({ page }) => {
      await openQuickAdd(page);
      await page.click('text=Add Task');
      
      // Try to submit without title
      await page.click('button:has-text("Create Task")');
      
      // Should show validation message or stay on form
      // Task should not be created
      await expect(page.locator('text=Please enter a task title')).toBeVisible();
    });

    test('should show validation error for meeting without type', async ({ page }) => {
      await openQuickAdd(page);
      await page.click('text=Add Meeting');
      
      await page.fill('input:near(label:text("Prospect Name"))', 'Test Prospect');
      await page.fill('[data-testid="identifier-field"]', 'test@example.com');
      
      // Don't select meeting type
      await page.click('button:has-text("Add Meeting")');
      
      // Should show validation error
      await expect(page.locator('text=Please select a meeting type')).toBeVisible();
    });

    test('should require contact identifier for non-outbound activities', async ({ page }) => {
      await openQuickAdd(page);
      await page.click('text=Add Meeting');
      
      await page.fill('input:near(label:text("Prospect Name"))', 'No Email Prospect');
      await page.selectOption('select:near(label:text("Meeting Type"))', 'Discovery');
      
      // Don't provide identifier
      await page.click('button:has-text("Add Meeting")');
      
      // Should show validation error
      await expect(page.locator('text=Please provide a contact identifier')).toBeVisible();
    });
  });

  test.describe('Integration Between Activities and Pipeline', () => {
    test('should link meeting to existing deal', async ({ page }) => {
      // First create a deal
      await openQuickAdd(page);
      await page.click('text=Create Deal');
      await page.click('button:has-text("Create Deal")');
      await waitForToast(page, 'Deal created successfully!');
      
      // Then create meeting linked to deal
      await openQuickAdd(page);
      await page.click('text=Add Meeting');
      
      await page.fill('input:near(label:text("Prospect Name"))', 'Linked Meeting Client');
      await page.selectOption('select:near(label:text("Meeting Type"))', 'Follow-up');
      await page.fill('[data-testid="identifier-field"]', 'linked@client.com');
      
      // Select the deal we just created
      const dealSelector = page.locator('button:has-text("Select Deal")');
      if (await dealSelector.isVisible()) {
        await dealSelector.click();
      }
      
      await page.click('button:has-text("Add Meeting")');
      await waitForToast(page, 'Activity added successfully');
      
      // Verify both activity and deal linkage exist
      await navigateToDashboard(page);
      await expect(page.locator('text=Linked Meeting Client')).toBeVisible();
      await expect(page.locator('text=Follow-up')).toBeVisible();
    });
  });

  test.describe('Modal State Management', () => {
    test('should reset form when modal is closed and reopened', async ({ page }) => {
      await openQuickAdd(page);
      await page.click('text=Add Task');
      
      // Fill some data
      await page.fill('input[placeholder*="Call John"]', 'Test task data');
      
      // Close modal
      await page.click('button[aria-label="Close"], .close-button, button:has([data-testid="x"])');
      
      // Reopen modal
      await openQuickAdd(page);
      await page.click('text=Add Task');
      
      // Form should be reset
      const titleInput = page.locator('input[placeholder*="Call John"]');
      await expect(titleInput).toHaveValue('');
    });

    test('should navigate back to action selection from task form', async ({ page }) => {
      await openQuickAdd(page);
      await page.click('text=Add Task');
      
      // Should see task form
      await expect(page.locator('text=Create New Task')).toBeVisible();
      
      // Click back/cancel
      await page.click('button:has-text("Cancel")');
      
      // Should see action selection again
      await expect(page.locator('text=Create Deal')).toBeVisible();
      await expect(page.locator('text=Add Task')).toBeVisible();
    });
  });
});