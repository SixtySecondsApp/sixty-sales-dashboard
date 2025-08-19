/**
 * E2E Testing with Playwright - Sales Activities and Pipeline Deals Reconciliation
 * 
 * Tests complete reconciliation workflows, user interactions, and data flow validation
 * using Playwright for end-to-end browser automation testing.
 */

import { test, expect, Page } from '@playwright/test';
import { chromium, Browser, BrowserContext } from '@playwright/test';

// Test data generators
class E2ETestData {
  static generateMockActivities(count: number = 10) {
    return Array.from({ length: count }, (_, i) => ({
      id: `act-${i + 1}`,
      client_name: `Test Client ${i + 1}`,
      amount: (i + 1) * 1000,
      date: new Date(2024, 0, i + 1).toISOString().split('T')[0],
      owner_id: 'test-user-1',
      status: 'active'
    }));
  }

  static generateMockDeals(count: number = 8) {
    return Array.from({ length: count }, (_, i) => ({
      id: `deal-${i + 1}`,
      name: `Test Deal ${i + 1}`,
      company: `Test Company ${i + 1}`,
      value: (i + 1) * 1500,
      stage: 'won',
      owner_id: 'test-user-1',
      close_date: new Date(2024, 0, i + 2).toISOString().split('T')[0]
    }));
  }

  static generateOrphanData() {
    return {
      orphan_activities: [
        {
          id: 'orphan-act-1',
          client_name: 'Orphan Client 1',
          amount: 5000,
          date: '2024-01-15',
          issue_type: 'orphan_activity',
          priority_level: 'revenue_risk'
        },
        {
          id: 'orphan-act-2',
          client_name: 'Orphan Client 2',
          amount: 3000,
          date: '2024-01-20',
          issue_type: 'orphan_activity',
          priority_level: 'data_quality'
        }
      ],
      orphan_deals: [
        {
          id: 'orphan-deal-1',
          name: 'Orphan Deal 1',
          company: 'Orphan Company 1',
          value: 7500,
          issue_type: 'orphan_deal',
          priority_level: 'revenue_tracking'
        }
      ],
      summary: {
        total_orphan_activities: 2,
        total_orphan_deals: 1,
        total_orphan_activity_revenue: 8000,
        total_orphan_deal_revenue: 7500
      }
    };
  }

  static generateMatchingData() {
    return {
      matches: {
        high_confidence: [
          {
            activity_id: 'act-1',
            deal_id: 'deal-1',
            total_confidence_score: 92,
            confidence_level: 'high_confidence',
            name_similarity: 0.95,
            date_proximity: 0.9,
            amount_similarity: 0.91
          },
          {
            activity_id: 'act-3',
            deal_id: 'deal-2',
            total_confidence_score: 88,
            confidence_level: 'high_confidence',
            name_similarity: 0.9,
            date_proximity: 0.85,
            amount_similarity: 0.89
          }
        ],
        medium_confidence: [
          {
            activity_id: 'act-5',
            deal_id: 'deal-4',
            total_confidence_score: 72,
            confidence_level: 'medium_confidence',
            name_similarity: 0.8,
            date_proximity: 0.7,
            amount_similarity: 0.65
          }
        ],
        low_confidence: []
      },
      summary: {
        total_matches: 3,
        high_confidence_matches: 2,
        medium_confidence_matches: 1,
        low_confidence_matches: 0
      }
    };
  }
}

// Page object model for reconciliation interface
class ReconciliationPage {
  constructor(private page: Page) {}

  // Navigation
  async navigateToReconciliation() {
    await this.page.goto('/reconciliation');
    await this.page.waitForLoadState('networkidle');
  }

  // Analysis section
  async clickAnalysisTab() {
    await this.page.click('[data-testid="analysis-tab"]');
    await this.page.waitForSelector('[data-testid="analysis-content"]');
  }

  async runAnalysis(analysisType: 'overview' | 'orphan' | 'matching' | 'duplicates' = 'overview') {
    await this.page.selectOption('[data-testid="analysis-type-select"]', analysisType);
    await this.page.click('[data-testid="run-analysis-button"]');
    await this.page.waitForSelector('[data-testid="analysis-results"]');
  }

  async waitForAnalysisResults() {
    await this.page.waitForSelector('[data-testid="analysis-results"]', { timeout: 10000 });
    return this.page.isVisible('[data-testid="analysis-error"]') === false;
  }

  // Filters
  async setDateFilter(startDate: string, endDate: string) {
    await this.page.fill('[data-testid="start-date-input"]', startDate);
    await this.page.fill('[data-testid="end-date-input"]', endDate);
  }

  async setConfidenceThreshold(threshold: number) {
    await this.page.fill('[data-testid="confidence-threshold-input"]', threshold.toString());
  }

  async applyFilters() {
    await this.page.click('[data-testid="apply-filters-button"]');
    await this.page.waitForSelector('[data-testid="filters-applied"]');
  }

  // Reconciliation execution
  async clickExecutionTab() {
    await this.page.click('[data-testid="execution-tab"]');
    await this.page.waitForSelector('[data-testid="execution-content"]');
  }

  async selectExecutionMode(mode: 'safe' | 'aggressive' | 'dry_run') {
    await this.page.selectOption('[data-testid="execution-mode-select"]', mode);
  }

  async setBatchSize(size: number) {
    await this.page.fill('[data-testid="batch-size-input"]', size.toString());
  }

  async executeReconciliation() {
    await this.page.click('[data-testid="execute-reconciliation-button"]');
    await this.page.waitForSelector('[data-testid="execution-progress"]');
  }

  async waitForExecutionComplete() {
    await this.page.waitForSelector('[data-testid="execution-complete"]', { timeout: 30000 });
    return this.page.isVisible('[data-testid="execution-error"]') === false;
  }

  // Manual actions
  async clickActionsTab() {
    await this.page.click('[data-testid="actions-tab"]');
    await this.page.waitForSelector('[data-testid="actions-content"]');
  }

  async linkActivityToDeal(activityId: string, dealId: string) {
    await this.page.fill('[data-testid="activity-id-input"]', activityId);
    await this.page.fill('[data-testid="deal-id-input"]', dealId);
    await this.page.click('[data-testid="link-manual-button"]');
    await this.page.waitForSelector('[data-testid="action-success"]');
  }

  async createDealFromActivity(activityId: string, dealData: any) {
    await this.page.fill('[data-testid="orphan-activity-id"]', activityId);
    await this.page.fill('[data-testid="new-deal-company"]', dealData.company);
    await this.page.fill('[data-testid="new-deal-amount"]', dealData.amount.toString());
    await this.page.click('[data-testid="create-deal-button"]');
    await this.page.waitForSelector('[data-testid="deal-created"]');
  }

  async undoLastAction() {
    await this.page.click('[data-testid="undo-last-action"]');
    await this.page.waitForSelector('[data-testid="action-undone"]');
  }

  // Results and validation
  async getAnalysisResults() {
    const resultsElement = await this.page.locator('[data-testid="analysis-results"]');
    return await resultsElement.textContent();
  }

  async getExecutionSummary() {
    const summaryElement = await this.page.locator('[data-testid="execution-summary"]');
    return await summaryElement.textContent();
  }

  async getOrphanActivitiesCount() {
    const countElement = await this.page.locator('[data-testid="orphan-activities-count"]');
    return parseInt(await countElement.textContent() || '0');
  }

  async getOrphanDealsCount() {
    const countElement = await this.page.locator('[data-testid="orphan-deals-count"]');
    return parseInt(await countElement.textContent() || '0');
  }

  async getMatchesCount() {
    const countElement = await this.page.locator('[data-testid="matches-count"]');
    return parseInt(await countElement.textContent() || '0');
  }

  // Error handling
  async getErrorMessage() {
    const errorElement = await this.page.locator('[data-testid="error-message"]');
    return await errorElement.textContent();
  }

  async isErrorVisible() {
    return await this.page.isVisible('[data-testid="error-message"]');
  }

  // Progress tracking
  async getProgressPercentage() {
    const progressElement = await this.page.locator('[data-testid="progress-percentage"]');
    return parseInt(await progressElement.textContent() || '0');
  }

  async waitForProgressUpdate() {
    await this.page.waitForFunction(
      () => {
        const element = document.querySelector('[data-testid="progress-percentage"]');
        return element && parseInt(element.textContent || '0') > 0;
      },
      {},
      { timeout: 5000 }
    );
  }
}

// Test setup and authentication
async function setupAuthenticatedSession(page: Page) {
  // Mock authentication
  await page.addInitScript(() => {
    window.localStorage.setItem('supabase.auth.token', JSON.stringify({
      access_token: 'mock-access-token',
      user: {
        id: 'test-user-1',
        email: 'test@example.com',
        user_metadata: {
          name: 'Test User'
        }
      }
    }));
  });

  // Mock API responses
  await page.route('/api/reconcile/**', async (route) => {
    const url = route.request().url();
    const method = route.request().method();
    const postData = route.request().postDataJSON();

    if (url.includes('/analysis')) {
      if (postData?.analysisType === 'overview') {
        await route.fulfill({
          json: {
            data: {
              total_sales_activities: 100,
              total_won_deals: 80,
              orphan_activities: 15,
              orphan_deals: 10,
              activity_deal_linkage_rate: 85.0
            }
          }
        });
      } else if (postData?.analysisType === 'orphan') {
        await route.fulfill({
          json: { data: E2ETestData.generateOrphanData() }
        });
      } else if (postData?.analysisType === 'matching') {
        await route.fulfill({
          json: { data: E2ETestData.generateMatchingData() }
        });
      }
    } else if (url.includes('/execute')) {
      await route.fulfill({
        json: {
          data: {
            success: true,
            summary: {
              totalProcessed: 10,
              highConfidenceLinks: 5,
              dealsCreated: 2,
              activitiesCreated: 1,
              errors: 0,
              successRate: 100
            }
          }
        }
      });
    } else if (url.includes('/actions')) {
      await route.fulfill({
        json: {
          data: {
            success: true,
            action: postData?.action || 'unknown',
            message: 'Action completed successfully'
          }
        }
      });
    }
  });
}

test.describe('E2E Reconciliation Testing', () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;
  let reconciliationPage: ReconciliationPage;

  test.beforeAll(async () => {
    browser = await chromium.launch();
  });

  test.afterAll(async () => {
    await browser.close();
  });

  test.beforeEach(async () => {
    context = await browser.newContext();
    page = await context.newPage();
    reconciliationPage = new ReconciliationPage(page);
    await setupAuthenticatedSession(page);
  });

  test.afterEach(async () => {
    await context.close();
  });

  test.describe('Navigation and Interface', () => {
    test('should load reconciliation page successfully', async () => {
      await reconciliationPage.navigateToReconciliation();
      
      await expect(page).toHaveTitle(/Reconciliation/);
      await expect(page.locator('[data-testid="reconciliation-dashboard"]')).toBeVisible();
    });

    test('should display all main tabs', async () => {
      await reconciliationPage.navigateToReconciliation();
      
      await expect(page.locator('[data-testid="analysis-tab"]')).toBeVisible();
      await expect(page.locator('[data-testid="execution-tab"]')).toBeVisible();
      await expect(page.locator('[data-testid="actions-tab"]')).toBeVisible();
    });

    test('should switch between tabs correctly', async () => {
      await reconciliationPage.navigateToReconciliation();
      
      // Start with analysis tab
      await reconciliationPage.clickAnalysisTab();
      await expect(page.locator('[data-testid="analysis-content"]')).toBeVisible();
      
      // Switch to execution tab
      await reconciliationPage.clickExecutionTab();
      await expect(page.locator('[data-testid="execution-content"]')).toBeVisible();
      
      // Switch to actions tab
      await reconciliationPage.clickActionsTab();
      await expect(page.locator('[data-testid="actions-content"]')).toBeVisible();
    });

    test('should show loading states during operations', async () => {
      await reconciliationPage.navigateToReconciliation();
      await reconciliationPage.clickAnalysisTab();
      
      // Start analysis and check loading state
      const analysisPromise = reconciliationPage.runAnalysis('overview');
      await expect(page.locator('[data-testid="loading-spinner"]')).toBeVisible();
      
      await analysisPromise;
      await expect(page.locator('[data-testid="loading-spinner"]')).not.toBeVisible();
    });
  });

  test.describe('Analysis Workflow', () => {
    test('should run overview analysis successfully', async () => {
      await reconciliationPage.navigateToReconciliation();
      await reconciliationPage.clickAnalysisTab();
      
      await reconciliationPage.runAnalysis('overview');
      const success = await reconciliationPage.waitForAnalysisResults();
      
      expect(success).toBe(true);
      
      const results = await reconciliationPage.getAnalysisResults();
      expect(results).toContain('100'); // Total activities
      expect(results).toContain('80');  // Total deals
    });

    test('should run orphan analysis and display results', async () => {
      await reconciliationPage.navigateToReconciliation();
      await reconciliationPage.clickAnalysisTab();
      
      await reconciliationPage.runAnalysis('orphan');
      const success = await reconciliationPage.waitForAnalysisResults();
      
      expect(success).toBe(true);
      
      const orphanActivitiesCount = await reconciliationPage.getOrphanActivitiesCount();
      const orphanDealsCount = await reconciliationPage.getOrphanDealsCount();
      
      expect(orphanActivitiesCount).toBeGreaterThan(0);
      expect(orphanDealsCount).toBeGreaterThan(0);
    });

    test('should run matching analysis with confidence filtering', async () => {
      await reconciliationPage.navigateToReconciliation();
      await reconciliationPage.clickAnalysisTab();
      
      await reconciliationPage.setConfidenceThreshold(80);
      await reconciliationPage.runAnalysis('matching');
      const success = await reconciliationPage.waitForAnalysisResults();
      
      expect(success).toBe(true);
      
      const matchesCount = await reconciliationPage.getMatchesCount();
      expect(matchesCount).toBeGreaterThan(0);
    });

    test('should apply date filters correctly', async () => {
      await reconciliationPage.navigateToReconciliation();
      await reconciliationPage.clickAnalysisTab();
      
      await reconciliationPage.setDateFilter('2024-01-01', '2024-01-31');
      await reconciliationPage.applyFilters();
      await reconciliationPage.runAnalysis('overview');
      
      const success = await reconciliationPage.waitForAnalysisResults();
      expect(success).toBe(true);
    });

    test('should handle analysis errors gracefully', async () => {
      await reconciliationPage.navigateToReconciliation();
      await reconciliationPage.clickAnalysisTab();
      
      // Mock error response
      await page.route('/api/reconcile/analysis', async (route) => {
        await route.fulfill({
          status: 500,
          json: { error: 'Analysis failed' }
        });
      });
      
      await reconciliationPage.runAnalysis('overview');
      
      const errorVisible = await reconciliationPage.isErrorVisible();
      expect(errorVisible).toBe(true);
      
      const errorMessage = await reconciliationPage.getErrorMessage();
      expect(errorMessage).toContain('Analysis failed');
    });
  });

  test.describe('Reconciliation Execution Workflow', () => {
    test('should execute safe mode reconciliation', async () => {
      await reconciliationPage.navigateToReconciliation();
      await reconciliationPage.clickExecutionTab();
      
      await reconciliationPage.selectExecutionMode('safe');
      await reconciliationPage.setBatchSize(50);
      await reconciliationPage.executeReconciliation();
      
      const success = await reconciliationPage.waitForExecutionComplete();
      expect(success).toBe(true);
      
      const summary = await reconciliationPage.getExecutionSummary();
      expect(summary).toContain('10'); // Total processed
      expect(summary).toContain('5');  // High confidence links
    });

    test('should execute dry run mode', async () => {
      await reconciliationPage.navigateToReconciliation();
      await reconciliationPage.clickExecutionTab();
      
      await reconciliationPage.selectExecutionMode('dry_run');
      await reconciliationPage.executeReconciliation();
      
      const success = await reconciliationPage.waitForExecutionComplete();
      expect(success).toBe(true);
      
      // Dry run should show what would be done without making changes
      const summary = await reconciliationPage.getExecutionSummary();
      expect(summary).toContain('would be processed');
    });

    test('should track execution progress', async () => {
      await reconciliationPage.navigateToReconciliation();
      await reconciliationPage.clickExecutionTab();
      
      await reconciliationPage.selectExecutionMode('safe');
      await reconciliationPage.executeReconciliation();
      
      // Wait for progress to update
      await reconciliationPage.waitForProgressUpdate();
      
      const progress = await reconciliationPage.getProgressPercentage();
      expect(progress).toBeGreaterThan(0);
      expect(progress).toBeLessThanOrEqual(100);
    });

    test('should handle execution errors', async () => {
      await reconciliationPage.navigateToReconciliation();
      await reconciliationPage.clickExecutionTab();
      
      // Mock error response
      await page.route('/api/reconcile/execute', async (route) => {
        await route.fulfill({
          status: 500,
          json: { error: 'Execution failed' }
        });
      });
      
      await reconciliationPage.selectExecutionMode('safe');
      await reconciliationPage.executeReconciliation();
      
      const errorVisible = await reconciliationPage.isErrorVisible();
      expect(errorVisible).toBe(true);
    });

    test('should allow cancellation of execution', async () => {
      await reconciliationPage.navigateToReconciliation();
      await reconciliationPage.clickExecutionTab();
      
      await reconciliationPage.selectExecutionMode('safe');
      await reconciliationPage.executeReconciliation();
      
      // Click cancel button during execution
      await page.click('[data-testid="cancel-execution-button"]');
      
      await expect(page.locator('[data-testid="execution-cancelled"]')).toBeVisible();
    });
  });

  test.describe('Manual Actions Workflow', () => {
    test('should manually link activity to deal', async () => {
      await reconciliationPage.navigateToReconciliation();
      await reconciliationPage.clickActionsTab();
      
      await reconciliationPage.linkActivityToDeal('act-123', 'deal-456');
      
      await expect(page.locator('[data-testid="action-success"]')).toBeVisible();
      await expect(page.locator('[data-testid="action-success"]')).toContainText('linked');
    });

    test('should create deal from orphan activity', async () => {
      await reconciliationPage.navigateToReconciliation();
      await reconciliationPage.clickActionsTab();
      
      await reconciliationPage.createDealFromActivity('orphan-act-1', {
        company: 'New Company',
        amount: 5000
      });
      
      await expect(page.locator('[data-testid="deal-created"]')).toBeVisible();
      await expect(page.locator('[data-testid="deal-created"]')).toContainText('Deal created');
    });

    test('should undo last action', async () => {
      await reconciliationPage.navigateToReconciliation();
      await reconciliationPage.clickActionsTab();
      
      // First perform an action
      await reconciliationPage.linkActivityToDeal('act-123', 'deal-456');
      await expect(page.locator('[data-testid="action-success"]')).toBeVisible();
      
      // Then undo it
      await reconciliationPage.undoLastAction();
      await expect(page.locator('[data-testid="action-undone"]')).toBeVisible();
    });

    test('should validate manual action inputs', async () => {
      await reconciliationPage.navigateToReconciliation();
      await reconciliationPage.clickActionsTab();
      
      // Try to link with invalid IDs
      await page.fill('[data-testid="activity-id-input"]', 'invalid-id');
      await page.fill('[data-testid="deal-id-input"]', 'invalid-id');
      await page.click('[data-testid="link-manual-button"]');
      
      await expect(page.locator('[data-testid="validation-error"]')).toBeVisible();
    });

    test('should show action history', async () => {
      await reconciliationPage.navigateToReconciliation();
      await reconciliationPage.clickActionsTab();
      
      // Perform several actions
      await reconciliationPage.linkActivityToDeal('act-1', 'deal-1');
      await page.waitForSelector('[data-testid="action-success"]');
      
      await reconciliationPage.linkActivityToDeal('act-2', 'deal-2');
      await page.waitForSelector('[data-testid="action-success"]');
      
      // Check action history
      await page.click('[data-testid="action-history-tab"]');
      await expect(page.locator('[data-testid="action-history-list"]')).toBeVisible();
      
      const historyItems = await page.locator('[data-testid="history-item"]').count();
      expect(historyItems).toBeGreaterThanOrEqual(2);
    });
  });

  test.describe('Data Flow Integration', () => {
    test('should complete full reconciliation workflow', async () => {
      await reconciliationPage.navigateToReconciliation();
      
      // Step 1: Run analysis
      await reconciliationPage.clickAnalysisTab();
      await reconciliationPage.runAnalysis('orphan');
      const analysisSuccess = await reconciliationPage.waitForAnalysisResults();
      expect(analysisSuccess).toBe(true);
      
      const initialOrphanCount = await reconciliationPage.getOrphanActivitiesCount();
      
      // Step 2: Execute reconciliation
      await reconciliationPage.clickExecutionTab();
      await reconciliationPage.selectExecutionMode('safe');
      await reconciliationPage.executeReconciliation();
      const executionSuccess = await reconciliationPage.waitForExecutionComplete();
      expect(executionSuccess).toBe(true);
      
      // Step 3: Manual actions for remaining orphans
      await reconciliationPage.clickActionsTab();
      await reconciliationPage.createDealFromActivity('orphan-act-1', {
        company: 'Manual Company',
        amount: 3000
      });
      
      // Step 4: Verify results
      await reconciliationPage.clickAnalysisTab();
      await reconciliationPage.runAnalysis('orphan');
      await reconciliationPage.waitForAnalysisResults();
      
      const finalOrphanCount = await reconciliationPage.getOrphanActivitiesCount();
      expect(finalOrphanCount).toBeLessThan(initialOrphanCount);
    });

    test('should handle concurrent user sessions', async () => {
      // Create second context for another user
      const secondContext = await browser.newContext();
      const secondPage = await secondContext.newPage();
      await setupAuthenticatedSession(secondPage);
      
      const secondReconciliationPage = new ReconciliationPage(secondPage);
      
      // Both users navigate to reconciliation
      await reconciliationPage.navigateToReconciliation();
      await secondReconciliationPage.navigateToReconciliation();
      
      // Both users run analysis simultaneously
      const firstAnalysisPromise = reconciliationPage.runAnalysis('overview');
      const secondAnalysisPromise = secondReconciliationPage.runAnalysis('overview');
      
      await Promise.all([firstAnalysisPromise, secondAnalysisPromise]);
      
      const firstSuccess = await reconciliationPage.waitForAnalysisResults();
      const secondSuccess = await secondReconciliationPage.waitForAnalysisResults();
      
      expect(firstSuccess).toBe(true);
      expect(secondSuccess).toBe(true);
      
      await secondContext.close();
    });

    test('should maintain state across page refreshes', async () => {
      await reconciliationPage.navigateToReconciliation();
      await reconciliationPage.clickAnalysisTab();
      
      // Set filters
      await reconciliationPage.setDateFilter('2024-01-01', '2024-01-31');
      await reconciliationPage.setConfidenceThreshold(80);
      await reconciliationPage.applyFilters();
      
      // Refresh page
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      // Check if filters are maintained
      const startDateValue = await page.inputValue('[data-testid="start-date-input"]');
      const endDateValue = await page.inputValue('[data-testid="end-date-input"]');
      const thresholdValue = await page.inputValue('[data-testid="confidence-threshold-input"]');
      
      expect(startDateValue).toBe('2024-01-01');
      expect(endDateValue).toBe('2024-01-31');
      expect(thresholdValue).toBe('80');
    });

    test('should handle network interruptions gracefully', async () => {
      await reconciliationPage.navigateToReconciliation();
      await reconciliationPage.clickAnalysisTab();
      
      // Simulate network failure
      await page.route('/api/reconcile/**', async (route) => {
        await route.abort('failed');
      });
      
      await reconciliationPage.runAnalysis('overview');
      
      const errorVisible = await reconciliationPage.isErrorVisible();
      expect(errorVisible).toBe(true);
      
      // Restore network and retry
      await page.unroute('/api/reconcile/**');
      await setupAuthenticatedSession(page); // Re-setup API mocks
      
      await page.click('[data-testid="retry-button"]');
      const retrySuccess = await reconciliationPage.waitForAnalysisResults();
      expect(retrySuccess).toBe(true);
    });
  });

  test.describe('Performance and Responsiveness', () => {
    test('should handle large datasets efficiently', async () => {
      await reconciliationPage.navigateToReconciliation();
      
      // Mock large dataset response
      await page.route('/api/reconcile/analysis', async (route) => {
        await route.fulfill({
          json: {
            data: {
              orphan_activities: E2ETestData.generateMockActivities(1000),
              orphan_deals: E2ETestData.generateMockDeals(800),
              summary: {
                total_orphan_activities: 1000,
                total_orphan_deals: 800
              }
            }
          }
        });
      });
      
      await reconciliationPage.clickAnalysisTab();
      
      const startTime = Date.now();
      await reconciliationPage.runAnalysis('orphan');
      const success = await reconciliationPage.waitForAnalysisResults();
      const endTime = Date.now();
      
      expect(success).toBe(true);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    test('should remain responsive during execution', async () => {
      await reconciliationPage.navigateToReconciliation();
      await reconciliationPage.clickExecutionTab();
      
      await reconciliationPage.selectExecutionMode('safe');
      await reconciliationPage.executeReconciliation();
      
      // UI should remain interactive during execution
      await expect(page.locator('[data-testid="cancel-execution-button"]')).toBeEnabled();
      await expect(page.locator('[data-testid="analysis-tab"]')).toBeEnabled();
    });

    test('should handle memory efficiently with large result sets', async () => {
      await reconciliationPage.navigateToReconciliation();
      await reconciliationPage.clickAnalysisTab();
      
      // Run multiple analyses to test memory usage
      for (let i = 0; i < 5; i++) {
        await reconciliationPage.runAnalysis('overview');
        await reconciliationPage.waitForAnalysisResults();
        
        await reconciliationPage.runAnalysis('orphan');
        await reconciliationPage.waitForAnalysisResults();
        
        await reconciliationPage.runAnalysis('matching');
        await reconciliationPage.waitForAnalysisResults();
      }
      
      // Page should still be responsive
      await expect(page.locator('[data-testid="analysis-tab"]')).toBeEnabled();
    });
  });

  test.describe('User Experience and Accessibility', () => {
    test('should be keyboard navigable', async () => {
      await reconciliationPage.navigateToReconciliation();
      
      // Navigate using keyboard
      await page.keyboard.press('Tab'); // Focus first element
      await page.keyboard.press('Tab'); // Move to next element
      await page.keyboard.press('Enter'); // Activate element
      
      // Verify keyboard navigation works
      const focusedElement = await page.locator(':focus');
      expect(focusedElement).toBeTruthy();
    });

    test('should provide proper ARIA labels', async () => {
      await reconciliationPage.navigateToReconciliation();
      
      // Check for ARIA labels on key elements
      await expect(page.locator('[data-testid="analysis-tab"]')).toHaveAttribute('aria-label');
      await expect(page.locator('[data-testid="execution-tab"]')).toHaveAttribute('aria-label');
      await expect(page.locator('[data-testid="actions-tab"]')).toHaveAttribute('aria-label');
    });

    test('should work with screen readers', async () => {
      await reconciliationPage.navigateToReconciliation();
      
      // Check for screen reader announcements
      await expect(page.locator('[aria-live="polite"]')).toBeAttached();
      await expect(page.locator('[role="status"]')).toBeAttached();
    });

    test('should be responsive on different screen sizes', async () => {
      // Test mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      await reconciliationPage.navigateToReconciliation();
      
      await expect(page.locator('[data-testid="reconciliation-dashboard"]')).toBeVisible();
      
      // Test tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 });
      await expect(page.locator('[data-testid="reconciliation-dashboard"]')).toBeVisible();
      
      // Test desktop viewport
      await page.setViewportSize({ width: 1920, height: 1080 });
      await expect(page.locator('[data-testid="reconciliation-dashboard"]')).toBeVisible();
    });

    test('should show helpful tooltips and help text', async () => {
      await reconciliationPage.navigateToReconciliation();
      await reconciliationPage.clickAnalysisTab();
      
      // Hover over help icon
      await page.hover('[data-testid="confidence-threshold-help"]');
      await expect(page.locator('[data-testid="tooltip"]')).toBeVisible();
      
      const tooltipText = await page.locator('[data-testid="tooltip"]').textContent();
      expect(tooltipText).toContain('confidence');
    });
  });

  test.describe('Error Scenarios and Edge Cases', () => {
    test('should handle authentication expiry during session', async () => {
      await reconciliationPage.navigateToReconciliation();
      
      // Mock authentication expiry
      await page.route('/api/reconcile/**', async (route) => {
        await route.fulfill({
          status: 401,
          json: { error: 'Authentication expired' }
        });
      });
      
      await reconciliationPage.clickAnalysisTab();
      await reconciliationPage.runAnalysis('overview');
      
      // Should redirect to login or show auth error
      const errorVisible = await reconciliationPage.isErrorVisible();
      expect(errorVisible).toBe(true);
      
      const errorMessage = await reconciliationPage.getErrorMessage();
      expect(errorMessage).toContain('Authentication');
    });

    test('should handle API timeout scenarios', async () => {
      await reconciliationPage.navigateToReconciliation();
      
      // Mock slow API response
      await page.route('/api/reconcile/analysis', async (route) => {
        await new Promise(resolve => setTimeout(resolve, 10000)); // 10 second delay
        await route.fulfill({
          json: { data: { message: 'Delayed response' } }
        });
      });
      
      await reconciliationPage.clickAnalysisTab();
      await reconciliationPage.runAnalysis('overview');
      
      // Should show timeout error or loading state
      await page.waitForTimeout(3000);
      const stillLoading = await page.isVisible('[data-testid="loading-spinner"]');
      expect(stillLoading).toBe(true);
    });

    test('should handle malformed API responses', async () => {
      await reconciliationPage.navigateToReconciliation();
      
      // Mock malformed response
      await page.route('/api/reconcile/analysis', async (route) => {
        await route.fulfill({
          body: 'Invalid JSON response',
          headers: { 'Content-Type': 'application/json' }
        });
      });
      
      await reconciliationPage.clickAnalysisTab();
      await reconciliationPage.runAnalysis('overview');
      
      const errorVisible = await reconciliationPage.isErrorVisible();
      expect(errorVisible).toBe(true);
    });

    test('should recover from partial failures', async () => {
      await reconciliationPage.navigateToReconciliation();
      await reconciliationPage.clickExecutionTab();
      
      // Mock partial execution failure
      await page.route('/api/reconcile/execute', async (route) => {
        await route.fulfill({
          json: {
            data: {
              success: false,
              summary: {
                totalProcessed: 5,
                errors: 3,
                successRate: 40
              },
              partialSuccess: true
            }
          }
        });
      });
      
      await reconciliationPage.selectExecutionMode('safe');
      await reconciliationPage.executeReconciliation();
      await reconciliationPage.waitForExecutionComplete();
      
      const summary = await reconciliationPage.getExecutionSummary();
      expect(summary).toContain('40%'); // Success rate
      expect(summary).toContain('3'); // Error count
    });
  });
});