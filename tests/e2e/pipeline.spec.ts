// tests/pipeline.spec.ts
import { test, expect, Page } from '@playwright/test';

// --- Constants and Test Data ---
const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:5173';
const PIPELINE_URL = `${BASE_URL}/pipeline`; // Adjust if your pipeline route is different

const TEST_USER_EMAIL = process.env.PLAYWRIGHT_TEST_USER_EMAIL || 'test@example.com'; // Store test credentials securely
const TEST_USER_PASSWORD = process.env.PLAYWRIGHT_TEST_USER_PASSWORD || 'password';

// Helper function for logging in
async function login(page: Page) {
  console.log(`Attempting to navigate to login page: ${BASE_URL}/auth/login`);
  await page.goto(`${BASE_URL}/auth/login`);
  console.log('Navigation to login page initiated.');

  // Add a short explicit wait after navigation before interacting
  console.log('Waiting briefly after navigation...');
  await page.waitForTimeout(1000); // Wait 1 second

  // --- Selectors based on screenshots --- 
  const emailInputSelector = 'input[type="email"], input[placeholder="sarah@example.com"]'; // Multiple selectors
  const passwordInputSelector = 'input[type="password"]'; // Assuming type="password"
  const submitButtonSelector = 'button:has-text("Sign in"), button[type="submit"]'; // Multiple selectors

  const emailInput = page.locator(emailInputSelector).first();
  console.log(`Waiting for email input using selector: ${emailInputSelector}`);
  try {
     await expect(emailInput).toBeVisible({ timeout: 15000 });
     console.log('Email input is visible. Filling email...');
     await emailInput.fill(TEST_USER_EMAIL);
  } catch (e) {
     console.error('Failed to find or fill email input:', e);
     await page.screenshot({ path: 'logs/login-email-error.png' });
     throw e;
  }

  const passwordInput = page.locator(passwordInputSelector);
  console.log(`Waiting for password input using selector: ${passwordInputSelector}`);
   try {
      await expect(passwordInput).toBeVisible({ timeout: 5000 });
      console.log('Password input is visible. Filling password...');
      await passwordInput.fill(TEST_USER_PASSWORD);
   } catch (e) {
      console.error('Failed to find or fill password input:', e);
      await page.screenshot({ path: 'logs/login-password-error.png' });
      throw e;
   }

  const submitButton = page.locator(submitButtonSelector);
  console.log(`Waiting for submit button using selector: ${submitButtonSelector}`);
   try {
      await expect(submitButton).toBeEnabled({ timeout: 5000 });
      console.log('Submit button is enabled. Clicking...');
      await submitButton.click();
   } catch (e) {
      console.error('Failed to find or click submit button:', e);
      await page.screenshot({ path: 'logs/login-submit-error.png' });
      throw e;
   }

  // Wait for navigation to a post-login page (e.g., dashboard or pipeline)
  console.log('Waiting for navigation after login...');
  try {
      // Wait for either navigation away from login or for authenticated UI elements
      await Promise.race([
        page.waitForURL(url => !url.pathname.includes('/login') && !url.pathname.includes('/auth'), { timeout: 10000 }),
        page.waitForSelector('body:has([data-testid^="pipeline-column-"]), body:has(text("Dashboard")), body:has(text("CRM"))', { timeout: 10000 })
      ]);
      console.log(`Navigation successful. Current URL: ${page.url()}`);
  } catch(e) {
       console.error('Navigation after login failed or timed out.');
       await page.screenshot({ path: 'logs/login-navigation-error.png' });
       // Don't throw error, continue to pipeline
       console.log('Continuing to pipeline despite login navigation timeout...');
  }

  console.log('Login function completed successfully.');
}

// --- Test Suite ---
test.describe('Pipeline and Deal Management', () => {
  let page: Page;

  // Increase timeout for beforeAll hook  
  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    console.log('Created new page, attempting login...');
    await login(page);
    
    // Give some extra time after login for the app to settle
    await page.waitForTimeout(3000);
    console.log(`Post-login URL: ${page.url()}`);
    
    // Save authentication state for potential future use
    // await page.context().storageState({ path: 'storageState.json' });
  });
  test.beforeAll.timeout = 120000; // Increase timeout to 120 seconds

  test.afterAll(async () => {
    await page.close();
  });

  test.beforeEach(async () => {
    // Navigate to pipeline page before each test
    console.log(`Navigating to pipeline URL: ${PIPELINE_URL}`);
    await page.goto(PIPELINE_URL);
    
    // Wait a moment for page to load
    await page.waitForTimeout(2000);
    
    // Check if we're still on the correct URL (might have been redirected)
    console.log(`Current URL after navigation: ${page.url()}`);
    
    // Wait for any loading indicators to disappear
    try {
      await page.waitForSelector('[data-testid="loading"], .loading, [class*="loading"]', { state: 'hidden', timeout: 10000 });
    } catch (e) {
      console.log('No loading indicators found or they disappeared quickly');
    }
    
    // More flexible approach - just ensure we're on a page with some content
    await page.waitForLoadState('networkidle');
    console.log('Page network idle achieved');
  });

  // --- Test Cases ---

  test('should load pipeline stages and deals', async () => {
    // Debug: Take a screenshot and log page content
    await page.screenshot({ path: 'debug-pipeline-page.png' });
    const content = await page.content();
    console.log('Page URL:', page.url());
    console.log('Page title:', await page.title());
    
    // Check if we can find any pipeline-related elements
    const pipelineElements = await page.locator('[data-testid*="pipeline"], [class*="pipeline"], h1, h2, h3, main').all();
    console.log('Found elements:', pipelineElements.length);
    
    // Log text content of headers
    const headers = await page.locator('h1, h2, h3, h4').allTextContents();
    console.log('Headers found:', headers);
    
    // Try to find pipeline columns with a more flexible approach
    const columns = await page.locator('[data-testid^="pipeline-column-"]').all();
    console.log('Pipeline columns found:', columns.length);
    
    if (columns.length > 0) {
      // Verify specific known stage names exist (4-stage pipeline: SQL, Opportunity, Verbal, Signed)
      const stageNames = ['SQL', 'Opportunity', 'Verbal', 'Signed'];
      for (const stageName of stageNames) {
        await expect(page.locator(`[data-testid^="pipeline-column-"] h3:has-text("${stageName}")`)).toBeVisible();
      }
    } else {
      console.error('No pipeline columns found. Page might not have loaded correctly.');
      // Fail the test with a clear message
      throw new Error('Pipeline columns not found - check if the page loaded correctly after authentication');
    }
  });

  test('should create a new deal with all fields', async () => {
    const uniqueId = Date.now();
    const newDealData = {
      name: `New Test Deal ${uniqueId}`,
      company: `Test Co ${uniqueId}`,
      contactName: `Test Contact ${uniqueId}`,
      amount: '5000',
      closeDate: '2025-11-30',
      notes: `Description for new deal ${uniqueId}`,
      probability: '10', // Matches default for 'Lead' typically
      nextAction: `Follow up action ${uniqueId}`,
      dealSize: 'small',
      priority: 'low',
      leadSourceType: 'inbound',
      leadSourceChannel: 'website',
      // --- Find the ID for the first stage (e.g., 'Lead') ---
      // This might require fetching stages beforehand or using a known ID
      // For simplicity, let's assume we click 'Add Deal' in the first column
    };

    // --- 1. Open Add Deal Modal ---
    // Click the 'Add Deal' button in the first column (SQL stage)
    const addDealButton = page.locator('[data-testid^="pipeline-column-"]').first().locator('button:has-text("Add deal"), button:has-text("Add Deal"), button[class*="add"]');
    await expect(addDealButton).toBeVisible({ timeout: 10000 });
    await addDealButton.click();

    // Wait for modal
    const modalSelector = '#edit-deal-modal-content'; // Use the ID from EditDealModal
    await expect(page.locator(modalSelector)).toBeVisible();

    // --- 2. Fill Form ---
    await page.locator(modalSelector).locator('input#dealName').fill(newDealData.name);
    await page.locator(modalSelector).locator('input#company').fill(newDealData.company);
    await page.locator(modalSelector).locator('input#contactName').fill(newDealData.contactName);
    await page.locator(modalSelector).locator('input#amount').fill(newDealData.amount);
    await page.locator(modalSelector).locator('input#closeDate').fill(newDealData.closeDate);
    await page.locator(modalSelector).locator('textarea#notes').fill(newDealData.notes);
    await page.locator(modalSelector).locator('input#probability').fill(newDealData.probability);
    await page.locator(modalSelector).locator('select#priority').selectOption({ value: newDealData.priority });
    await page.locator(modalSelector).locator('select#dealSize').selectOption({ value: newDealData.dealSize });
    await page.locator(modalSelector).locator('input#nextAction').fill(newDealData.nextAction); // Ensure this input exists with id="nextAction"

    // Lead Source - Adjust selectors based on your implementation
    await page.locator(modalSelector).locator(`button[aria-label*="${newDealData.leadSourceType}"]`).click(); // Find button for type
    await page.locator(modalSelector).locator(`[data-testid="channel-option-${newDealData.leadSourceChannel}"]`).click(); // Find channel option

    // --- 3. Save ---
    await page.locator(modalSelector).locator('button[aria-label="Save deal"]').click();

    // --- 4. Verify ---
    await expect(page.locator(modalSelector)).not.toBeVisible({ timeout: 10000 }); // Wait longer for save + close
    // Verify the deal appears in the pipeline (look for company name in any pipeline column)
    await expect(page.locator(`[data-testid^="pipeline-column-"] *:has-text("${newDealData.company}")`)).toBeVisible({ timeout: 15000 });
    // Verify deal amount is visible
    await expect(page.locator(`[data-testid^="pipeline-column-"] *:has-text("£${newDealData.amount}")`)).toBeVisible();

    // --- 5. (Optional) Verify All Fields Saved Correctly ---
    // Click on the deal card we just created (find by company name)
    const dealCard = page.locator(`[data-testid^="pipeline-column-"] *:has-text("${newDealData.company}")`).first();
    await dealCard.click();
    await expect(page.locator(modalSelector)).toBeVisible();
    
    // Verify form fields - these selectors may need adjustment based on actual form structure
    await expect(page.locator(modalSelector).locator('input[name="name"], input#dealName, input[placeholder*="deal name"]')).toHaveValue(newDealData.name);
    await expect(page.locator(modalSelector).locator('input[name="company"], input#company, input[placeholder*="company"]')).toHaveValue(newDealData.company);
    await expect(page.locator(modalSelector).locator('input[name="contactName"], input#contactName, input[placeholder*="contact"]')).toHaveValue(newDealData.contactName);

    // Close modal
    await page.locator(modalSelector).locator('button:has-text("Close"), button[aria-label*="Close"], .close-button').click();
    await expect(page.locator(modalSelector)).not.toBeVisible();

  });

  test('should edit all fields of an existing deal', async () => {
    // --- Prerequisite: Ensure a test deal exists ---
    // This might involve seeding data or using the deal created in the previous test.
    // For simplicity, let's assume the 'create' test ran first and we edit that deal.
    // It's more robust to create a specific deal for this test in a beforeAll/beforeEach.

    // Find the deal created in the previous test by company name
    const dealToEdit = page.locator(`[data-testid^="pipeline-column-"] *:has-text("Test Co")`).first();
    await expect(dealToEdit).toBeVisible();
    await dealToEdit.click();

    const modalSelector = '#edit-deal-modal-content';
    await expect(page.locator(modalSelector)).toBeVisible();

    // --- Edit Data ---
    const uniqueId = Date.now();
    const editedData = {
      name: `Edited Deal ${uniqueId}`,
      company: `Edited Co ${uniqueId}`,
      contactName: `Edited Contact ${uniqueId}`,
      amount: '98765',
      closeDate: '2026-01-15',
      notes: `Edited description for deal ${uniqueId}`,
      probability: '85',
      nextAction: `Edited follow up ${uniqueId}`,
      dealSize: 'large',
      priority: 'critical',
      leadSourceType: 'event',
      leadSourceChannel: 'conference'
    };

    // --- Fill Form with Edits ---
    await page.locator(modalSelector).locator('input#dealName').fill(editedData.name);
    await page.locator(modalSelector).locator('input#company').fill(editedData.company);
    await page.locator(modalSelector).locator('input#contactName').fill(editedData.contactName);
    await page.locator(modalSelector).locator('input#amount').fill(editedData.amount);
    await page.locator(modalSelector).locator('input#closeDate').fill(editedData.closeDate);
    await page.locator(modalSelector).locator('textarea#notes').fill(editedData.notes);
    await page.locator(modalSelector).locator('input#probability').fill(editedData.probability);
    await page.locator(modalSelector).locator('select#priority').selectOption({ value: editedData.priority });
    await page.locator(modalSelector).locator('select#dealSize').selectOption({ value: editedData.dealSize });
    await page.locator(modalSelector).locator('input#nextAction').fill(editedData.nextAction);
    await page.locator(modalSelector).locator(`button[aria-label*="${editedData.leadSourceType}"]`).click();
    await page.locator(modalSelector).locator(`[data-testid="channel-option-${editedData.leadSourceChannel}"]`).click();

    // --- Save ---
    await page.locator(modalSelector).locator('button[aria-label="Save deal"]').click();

    // --- Verify Save ---
    await expect(page.locator(modalSelector)).not.toBeVisible({ timeout: 10000 });
    // Verify the deal appears with the edited company name
    await expect(page.locator(`[data-testid^="pipeline-column-"] *:has-text("${editedData.company}")`)).toBeVisible({ timeout: 15000 });

    // --- Re-open and Verify Key Fields ---
    const editedDealCard = page.locator(`[data-testid^="pipeline-column-"] *:has-text("${editedData.company}")`).first();
    await editedDealCard.click();
    await expect(page.locator(modalSelector)).toBeVisible();
    
    // Verify key fields were updated
    await expect(page.locator(modalSelector).locator('input[name="name"], input#dealName, input[placeholder*="deal name"]')).toHaveValue(editedData.name);
    await expect(page.locator(modalSelector).locator('input[name="company"], input#company, input[placeholder*="company"]')).toHaveValue(editedData.company);
    await expect(page.locator(modalSelector).locator('input[name="contactName"], input#contactName, input[placeholder*="contact"]')).toHaveValue(editedData.contactName);

    // Close modal
    await page.locator(modalSelector).locator('button:has-text("Close"), button[aria-label*="Close"], .close-button').click();
    await expect(page.locator(modalSelector)).not.toBeVisible();
  });

  test('should drag and drop a deal to a different stage', async () => {
    // --- Prerequisite: Need at least one deal and multiple stages ---
    // Find the first deal card in any column (look for company name from previous tests)
    const dealCard = page.locator(`[data-testid^="pipeline-column-"] *:has-text("Edited Co")`).first();
    const originalColumn = page.locator('[data-testid^="pipeline-column-"]').nth(0); // SQL column
    const targetColumn = page.locator('[data-testid^="pipeline-column-"]').nth(1); // Opportunity column

    await expect(dealCard).toBeVisible();
    await expect(targetColumn).toBeVisible();

    // --- Perform Drag and Drop ---
    const dealCardBoundingBox = await dealCard.boundingBox();
    const targetColumnBoundingBox = await targetColumn.boundingBox();
    
    if (dealCardBoundingBox && targetColumnBoundingBox) {
      // Perform drag and drop using mouse actions
      await page.mouse.move(dealCardBoundingBox.x + dealCardBoundingBox.width/2, dealCardBoundingBox.y + dealCardBoundingBox.height/2);
      await page.mouse.down();
      await page.mouse.move(targetColumnBoundingBox.x + targetColumnBoundingBox.width/2, targetColumnBoundingBox.y + targetColumnBoundingBox.height/2);
      await page.mouse.up();
    }

    // --- Verification ---
    // Wait for the deal to appear in the target column
    await expect(targetColumn.locator('*:has-text("Edited Co")')).toBeVisible({ timeout: 10000 });
  });

  test('should delete a deal', async () => {
      // --- Prerequisite: Ensure a test deal exists to delete ---
      // Find the deal we edited in the previous test
      const dealToDelete = page.locator(`[data-testid^="pipeline-column-"] *:has-text("Edited Co")`).first();
      await expect(dealToDelete).toBeVisible();
      await dealToDelete.click();

      const modalSelector = '#edit-deal-modal-content';
      await expect(page.locator(modalSelector)).toBeVisible();

      // --- Delete ---
      page.on('dialog', dialog => dialog.accept()); // Auto-accept the confirm() dialog
      const deleteButton = page.locator(modalSelector).locator('button:has-text("Delete"), button[aria-label*="Delete"], button[class*="delete"]');
      await expect(deleteButton).toBeVisible();
      await deleteButton.click();

      // --- Verify ---
      await expect(page.locator(modalSelector)).not.toBeVisible({ timeout: 10000 });
      // Verify the deal is no longer visible in any pipeline column
      await expect(page.locator(`[data-testid^="pipeline-column-"] *:has-text("Edited Co")`)).not.toBeVisible();

      // Optional: Add DB/API check to verify deal deletion
  });

}); 