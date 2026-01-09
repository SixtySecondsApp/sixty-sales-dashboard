import { describe, test, expect as vitestExpect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { expect as playwrightExpect } from '../fixtures/playwright-assertions';
import { setupPlaywriter, teardownPlaywriter } from '../fixtures/playwriter-setup';
import { createClient } from '@supabase/supabase-js';
import type { Page } from 'playwright-core';

// Test configuration
const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || process.env.VITE_BASE_URL || 'http://localhost:5175';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'test-key';

describe('Foreign Key Constraint Fix - E2E Tests', () => {
  let page: Page;
  let supabaseClient: any;

  beforeAll(async () => {
    const setup = await setupPlaywriter();
    page = setup.page;
    // Initialize Supabase client for test data setup
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  });

  afterAll(async () => {
    await teardownPlaywriter();
  });

  beforeEach(async () => {
    // Navigate to the application
    await page.goto(`${BASE_URL}/`);
    
    // Mock authentication if needed
    await page.evaluate(() => {
      localStorage.setItem('sb-localhost-auth-token', JSON.stringify({
        user: { id: 'test-user-id', email: 'test@example.com' }
      }));
    });

    // Ensure page is ready
    await page.waitForSelector('[data-testid="dashboard"]', { timeout: 10000 });
  });

  afterEach(async () => {
    // Clean up test data after each test
    if (supabaseClient) {
      await supabaseClient
        .from('activities')
        .delete()
        .like('details', '%E2E Test%');
      
      await supabaseClient
        .from('deals')
        .delete()
        .like('name', '%E2E Test%');
    }
  });

  describe('Successful Proposal Creation Flow', () => {
    test('should create deal and proposal activity successfully via UI', async () => {
      // Click Quick Add button
      await page.click('[data-testid="quick-add-button"]');
      await playwrightExpect(page.locator('[data-testid="quick-add-menu"]')).toBeVisible();

      // Click "Add Proposal"
      await page.click('text="Add Proposal"');
      
      // Wait for DealWizard to open
      await playwrightExpect(page.locator('[data-testid="deal-wizard"]')).toBeVisible();
      await playwrightExpect(page.locator('text="Create Deal & Proposal"')).toBeVisible();

      // Fill in deal details
      await page.fill('[data-testid="deal-name-input"]', 'E2E Test Deal - Proposal');
      await page.fill('[data-testid="company-input"]', 'E2E Test Company');
      await page.fill('[data-testid="value-input"]', '25000');
      await page.fill('[data-testid="description-input"]', 'E2E Test proposal creation');

      // Handle contact selection
      await page.click('[data-testid="select-contact-button"]');
      await playwrightExpect(page.locator('[data-testid="contact-search-modal"]')).toBeVisible();
      
      // Create or select a contact
      await page.fill('[data-testid="contact-search-input"]', 'test@e2e-company.com');
      await page.click('[data-testid="create-contact-button"]');
      
      // Fill contact details
      await page.fill('[data-testid="contact-name-input"]', 'E2E Test Contact');
      await page.fill('[data-testid="contact-company-input"]', 'E2E Test Company');
      await page.click('[data-testid="save-contact-button"]');

      // Wait for contact to be selected
      await playwrightExpect(page.locator('[data-testid="selected-contact"]')).toBeVisible();

      // Create the deal and proposal
      await page.click('text="Create Deal & Proposal"');

      // Wait for success message
      await playwrightExpect(page.locator('text="Deal and proposal created successfully!"')).toBeVisible({
        timeout: 15000 // Allow time for delays and retries
      });

      // Verify deal appears in pipeline
      await playwrightExpect(page.locator('text="E2E Test Deal - Proposal"')).toBeVisible();

      // Navigate to activities to verify proposal was created
      await page.click('[data-testid="activities-tab"]');
      await playwrightExpect(page.locator('text="Proposal sent: E2E Test Deal - Proposal"')).toBeVisible();

      // Verify the activity has the correct deal_id by checking details
      const activityRow = page.locator('[data-testid="activity-row"]').filter({ hasText: 'E2E Test Deal - Proposal' });
      await playwrightExpect(activityRow).toBeVisible();
      await playwrightExpect(activityRow.locator('text="proposal"')).toBeVisible();
    });

    test('should create only deal when using "Create Deal" action', async () => {
      // Click Quick Add button
      await page.click('[data-testid="quick-add-button"]');
      
      // Click "Create Deal" instead of "Add Proposal"
      await page.click('text="Create Deal"');
      
      // Wait for DealWizard to open
      await playwrightExpect(page.locator('[data-testid="deal-wizard"]')).toBeVisible();
      await playwrightExpect(page.locator('text="Create New Deal"')).toBeVisible();

      // Fill in deal details
      await page.fill('[data-testid="deal-name-input"]', 'E2E Test Deal - Only');
      await page.fill('[data-testid="company-input"]', 'E2E Test Company');
      await page.fill('[data-testid="value-input"]', '15000');

      // Handle contact selection
      await page.click('[data-testid="select-contact-button"]');
      await page.fill('[data-testid="contact-search-input"]', 'test2@e2e-company.com');
      await page.click('[data-testid="create-contact-button"]');
      await page.fill('[data-testid="contact-name-input"]', 'E2E Test Contact 2');
      await page.fill('[data-testid="contact-company-input"]', 'E2E Test Company');
      await page.click('[data-testid="save-contact-button"]');

      await expect(page.locator('[data-testid="selected-contact"]')).toBeVisible();

      // Create the deal
      await page.click('text="Create New Deal"');

      // Wait for success message (should not mention proposal)
      await playwrightExpect(page.locator('text="Deal created successfully!"')).toBeVisible();

      // Verify deal appears in pipeline
      await playwrightExpect(page.locator('text="E2E Test Deal - Only"')).toBeVisible();

      // Verify NO proposal activity was created
      await page.click('[data-testid="activities-tab"]');
      await playwrightExpect(page.locator('text="Proposal sent: E2E Test Deal - Only"')).toBeHidden();
    });
  });

  describe('Race Condition Simulation', () => {
    test('should handle foreign key constraint errors gracefully', async () => {
      // Intercept and delay database requests to simulate race conditions
      await page.route('**/rest/v1/deals*', async (route) => {
        // Delay deal creation to simulate slow database
        await new Promise(resolve => setTimeout(resolve, 100));
        await route.continue();
      });

      await page.route('**/rest/v1/activities*', async (route, request) => {
        if (request.method() === 'POST') {
          // Simulate potential foreign key constraint error on first attempt
          const postData = request.postData();
          if (postData && postData.includes('E2E Race Test')) {
            // First request fails with foreign key error
            await route.fulfill({
              status: 400,
              contentType: 'application/json',
              body: JSON.stringify({
                code: '23503',
                message: 'insert or update on table "activities" violates foreign key constraint'
              })
            });
          } else {
            await route.continue();
          }
        } else {
          await route.continue();
        }
      });

      // Start the creation flow
      await page.click('[data-testid="quick-add-button"]');
      await page.click('text="Add Proposal"');
      
      await playwrightExpect(page.locator('[data-testid="deal-wizard"]')).toBeVisible();

      // Fill form with race condition test data
      await page.fill('[data-testid="deal-name-input"]', 'E2E Race Test Deal');
      await page.fill('[data-testid="company-input"]', 'Race Test Company');
      await page.fill('[data-testid="value-input"]', '30000');

      // Select contact
      await page.click('[data-testid="select-contact-button"]');
      await page.fill('[data-testid="contact-search-input"]', 'race@test.com');
      await page.click('[data-testid="create-contact-button"]');
      await page.fill('[data-testid="contact-name-input"]', 'Race Test Contact');
      await page.fill('[data-testid="contact-company-input"]', 'Race Test Company');
      await page.click('[data-testid="save-contact-button"]');

      await playwrightExpect(page.locator('[data-testid="selected-contact"]')).toBeVisible();

      // Create the deal - this should trigger the retry logic
      await page.click('text="Create Deal & Proposal"');

      // The system should retry and eventually succeed or show appropriate message
      // Wait longer to account for retry delays
      await page.waitForSelector('text="Deal and proposal created successfully!" , text="Note: Proposal activity creation failed, but deal was created successfully"', {
        timeout: 20000
      });

      // Verify deal was created regardless
      await playwrightExpect(page.locator('text="E2E Race Test Deal"')).toBeVisible();
    });

    test('should handle network interruptions during proposal creation', async () => {
      // Simulate network issues during activity creation
      let activityAttempts = 0;
      
      await page.route('**/rest/v1/activities*', async (route, request) => {
        if (request.method() === 'POST') {
          activityAttempts++;
          
          if (activityAttempts === 1) {
            // First attempt: network timeout
            await new Promise(resolve => setTimeout(resolve, 100));
            await route.abort('internetdisconnected');
          } else {
            // Second attempt: success
            await route.continue();
          }
        } else {
          await route.continue();
        }
      });

      // Create proposal
      await page.click('[data-testid="quick-add-button"]');
      await page.click('text="Add Proposal"');
      
      await page.fill('[data-testid="deal-name-input"]', 'E2E Network Test Deal');
      await page.fill('[data-testid="company-input"]', 'Network Test Company');
      await page.fill('[data-testid="value-input"]', '20000');

      // Handle contact
      await page.click('[data-testid="select-contact-button"]');
      await page.fill('[data-testid="contact-search-input"]', 'network@test.com');
      await page.click('[data-testid="create-contact-button"]');
      await page.fill('[data-testid="contact-name-input"]', 'Network Test Contact');
      await page.fill('[data-testid="contact-company-input"]', 'Network Test Company');
      await page.click('[data-testid="save-contact-button"]');

      await page.click('text="Create Deal & Proposal"');

      // Should handle network error gracefully
      await page.waitForSelector('text="Deal created successfully!" , text="Note: Proposal activity creation failed, but deal was created successfully"', {
        timeout: 15000
      });

      // Deal should still be created
      await playwrightExpect(page.locator('text="E2E Network Test Deal"')).toBeVisible();
    });
  });

  describe('Performance and Reliability', () => {
    test('should handle rapid successive proposal creations', async () => {
      const dealNames = ['Rapid Test 1', 'Rapid Test 2', 'Rapid Test 3'];
      
      for (let i = 0; i < dealNames.length; i++) {
        // Create each deal rapidly
        await page.click('[data-testid="quick-add-button"]');
        await page.click('text="Add Proposal"');
        
        await page.fill('[data-testid="deal-name-input"]', dealNames[i]);
        await page.fill('[data-testid="company-input"]', `Rapid Company ${i + 1}`);
        await page.fill('[data-testid="value-input"]', `${(i + 1) * 5000}`);

        // Quick contact creation
        await page.click('[data-testid="select-contact-button"]');
        await page.fill('[data-testid="contact-search-input"]', `rapid${i}@test.com`);
        await page.click('[data-testid="create-contact-button"]');
        await page.fill('[data-testid="contact-name-input"]', `Rapid Contact ${i + 1}`);
        await page.fill('[data-testid="contact-company-input"]', `Rapid Company ${i + 1}`);
        await page.click('[data-testid="save-contact-button"]');

        await page.click('text="Create Deal & Proposal"');
        
        // Wait for completion before next iteration
        await page.waitForSelector('text="Deal and proposal created successfully!" , text="Deal created successfully!"', {
          timeout: 10000
        });
        
        // Small delay between creations
        await page.waitForTimeout(500);
      }

      // Verify all deals were created
      for (const dealName of dealNames) {
        await playwrightExpect(page.locator(`text="${dealName}"`)).toBeVisible();
      }

      // Check activities were created
      await page.click('[data-testid="activities-tab"]');
      for (const dealName of dealNames) {
        await playwrightExpect(page.locator(`text="Proposal sent: ${dealName}"`)).toBeVisible();
      }
    });

    test('should handle browser refresh during creation process', async () => {
      // Start creation process
      await page.click('[data-testid="quick-add-button"]');
      await page.click('text="Add Proposal"');
      
      await page.fill('[data-testid="deal-name-input"]', 'Refresh Test Deal');
      await page.fill('[data-testid="company-input"]', 'Refresh Test Company');
      
      // Refresh page mid-process
      await page.reload();
      
      // Should return to normal state without errors
      await page.waitForSelector('[data-testid="dashboard"]');
      await playwrightExpect(page.locator('[data-testid="deal-wizard"]')).toBeHidden();
      
      // Should be able to create normally after refresh
      await page.click('[data-testid="quick-add-button"]');
      await page.click('text="Add Proposal"');
      
      await page.fill('[data-testid="deal-name-input"]', 'Post Refresh Deal');
      await page.fill('[data-testid="company-input"]', 'Post Refresh Company');
      await page.fill('[data-testid="value-input"]', '12000');

      await page.click('[data-testid="select-contact-button"]');
      await page.fill('[data-testid="contact-search-input"]', 'postrefresh@test.com');
      await page.click('[data-testid="create-contact-button"]');
      await page.fill('[data-testid="contact-name-input"]', 'Post Refresh Contact');
      await page.fill('[data-testid="contact-company-input"]', 'Post Refresh Company');
      await page.click('[data-testid="save-contact-button"]');

      await page.click('text="Create Deal & Proposal"');
      
      await playwrightExpect(page.locator('text="Deal and proposal created successfully!"')).toBeVisible({
        timeout: 15000
      });
      
      await playwrightExpect(page.locator('text="Post Refresh Deal"')).toBeVisible();
    });
  });

  describe('Data Consistency Verification', () => {
    test('should maintain referential integrity between deals and activities', async () => {
      let createdDealId: string;
      let createdActivityId: string;

      // Intercept the deal creation to capture the ID
      await page.route('**/rest/v1/deals*', async (route, request) => {
        await route.continue();
        
        if (request.method() === 'POST') {
          const response = await route.request().response();
          const responseBody = await response?.json();
          if (responseBody && responseBody.id) {
            createdDealId = responseBody.id;
          }
        }
      });

      // Intercept the activity creation to capture the ID  
      await page.route('**/rest/v1/activities*', async (route, request) => {
        await route.continue();
        
        if (request.method() === 'POST') {
          const response = await route.request().response();
          const responseBody = await response?.json();
          if (responseBody && responseBody.id) {
            createdActivityId = responseBody.id;
          }
        }
      });

      // Create deal and proposal
      await page.click('[data-testid="quick-add-button"]');
      await page.click('text="Add Proposal"');
      
      await page.fill('[data-testid="deal-name-input"]', 'Integrity Test Deal');
      await page.fill('[data-testid="company-input"]', 'Integrity Test Company');
      await page.fill('[data-testid="value-input"]', '18000');

      await page.click('[data-testid="select-contact-button"]');
      await page.fill('[data-testid="contact-search-input"]', 'integrity@test.com');
      await page.click('[data-testid="create-contact-button"]');
      await page.fill('[data-testid="contact-name-input"]', 'Integrity Test Contact');
      await page.fill('[data-testid="contact-company-input"]', 'Integrity Test Company');
      await page.click('[data-testid="save-contact-button"]');

      await page.click('text="Create Deal & Proposal"');
      
      await playwrightExpect(page.locator('text="Deal and proposal created successfully!"')).toBeVisible({
        timeout: 15000
      });

      // Verify data consistency using direct database queries
      if (supabaseClient && createdDealId) {
        const { data: deal } = await supabaseClient
          .from('deals')
          .select('*')
          .eq('id', createdDealId)
          .single();
        
        vitestExpect(deal).toBeTruthy();
        vitestExpect(deal.name).toBe('Integrity Test Deal');

        const { data: activities } = await supabaseClient
          .from('activities')
          .select('*')
          .eq('deal_id', createdDealId);
        
        vitestExpect(activities).toHaveLength(1);
        vitestExpect(activities[0].type).toBe('proposal');
        vitestExpect(activities[0].deal_id).toBe(createdDealId);
      }
    });
  });
});
