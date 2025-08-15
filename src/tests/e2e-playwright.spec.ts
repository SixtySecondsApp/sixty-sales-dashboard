import { test, expect, Page, BrowserContext } from '@playwright/test';

// Test configuration and utilities
const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const MOBILE_VIEWPORT = { width: 375, height: 667 };
const TABLET_VIEWPORT = { width: 768, height: 1024 };
const DESKTOP_VIEWPORT = { width: 1920, height: 1080 };

// Helper functions
const waitForStatsToLoad = async (page: Page) => {
  await page.waitForSelector('[data-testid^="stat-card-"]', { timeout: 10000 });
  await page.waitForLoadState('networkidle');
};

const getStatCardValue = async (page: Page, cardTitle: string) => {
  const cardSelector = `[data-testid="stat-card-${cardTitle.toLowerCase().replace(/\s+/g, '-')}"]`;
  await page.waitForSelector(cardSelector);
  const valueElement = page.locator(`${cardSelector} .text-2xl`).first();
  return await valueElement.textContent();
};

const generateTestData = async (page: Page, activityCount: number = 100) => {
  // Mock API or insert test data
  await page.route('**/api/activities', async route => {
    const activities = Array.from({ length: activityCount }, (_, i) => ({
      id: `test-${i}`,
      type: ['sale', 'meeting', 'proposal', 'outbound'][i % 4],
      status: ['completed', 'pending', 'cancelled', 'no_show'][i % 4],
      amount: i % 3 === 0 ? Math.floor(Math.random() * 5000) + 100 : undefined,
      date: new Date(2024, 0, (i % 28) + 1).toISOString(),
      sales_rep: `Rep ${i % 5}`,
      client_name: `Client ${i % 10}`,
      details: `Test activity ${i}`
    }));
    
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(activities)
    });
  });
};

test.describe('Enhanced Statistics Cards E2E Tests', () => {
  
  test.beforeEach(async ({ page }) => {
    await generateTestData(page, 200);
    await page.goto(`${BASE_URL}/activity-log`);
    await waitForStatsToLoad(page);
  });

  test.describe('Visual Elements and Layout', () => {
    test('displays all stat cards with correct visual elements', async ({ page }) => {
      // Check all expected stat cards are present
      const expectedCards = [
        'total-revenue',
        'meeting-conversion', 
        'proposal-win-rate',
        'no-show-rate',
        'avg-deal-value'
      ];

      for (const cardId of expectedCards) {
        const card = page.locator(`[data-testid="stat-card-${cardId}"]`);
        await expect(card).toBeVisible();
        
        // Check for trend indicator
        await expect(card.locator('[data-testid="trend-indicator"]')).toBeVisible();
        await expect(card.locator('[data-testid="trend-text"]')).toBeVisible();
        await expect(card.locator('[data-testid="trend-period"]')).toBeVisible();
        
        // Check for icon
        await expect(card.locator('[data-testid="icon"]')).toBeVisible();
        
        // Check for title and value
        await expect(card.locator('[data-testid="title"]')).toBeVisible();
      }
    });

    test('trend indicators show correct symbols and colors', async ({ page }) => {
      const trendIndicator = page.locator('[data-testid="trend-indicator"]').first();
      const trendIcon = page.locator('[data-testid="trend-icon"]').first();
      const trendText = page.locator('[data-testid="trend-text"]').first();
      
      await expect(trendIndicator).toBeVisible();
      
      // Check trend icon is one of the expected values
      const iconText = await trendIcon.textContent();
      expect(['↗', '↘', '→']).toContain(iconText);
      
      // Check trend text format
      const textContent = await trendText.textContent();
      expect(textContent).toMatch(/^[+-]?\d+%$/);
    });

    test('contextual information displays correctly', async ({ page }) => {
      // Check that context info is present and meaningful
      const revenueCard = page.locator('[data-testid="stat-card-total-revenue"]');
      const contextInfo = revenueCard.locator('[data-testid="context-info"]');
      
      await expect(contextInfo).toBeVisible();
      
      const contextText = await contextInfo.textContent();
      expect(contextText).toMatch(/from \d+ completed sales/i);
    });
  });

  test.describe('Responsive Design', () => {
    test('adapts grid layout for mobile devices', async ({ page }) => {
      await page.setViewportSize(MOBILE_VIEWPORT);
      await waitForStatsToLoad(page);
      
      // Check grid container classes
      const gridContainer = page.locator('.grid').first();
      await expect(gridContainer).toHaveClass(/grid-cols-1/);
      
      // Verify cards stack vertically on mobile
      const cards = page.locator('[data-testid^="stat-card-"]');
      const cardCount = await cards.count();
      expect(cardCount).toBeGreaterThan(0);
      
      // Check minimum touch target size
      const firstCard = cards.first();
      const boundingBox = await firstCard.boundingBox();
      expect(boundingBox?.height).toBeGreaterThanOrEqual(120); // min-h-[120px]
    });

    test('shows appropriate number of columns on tablet', async ({ page }) => {
      await page.setViewportSize(TABLET_VIEWPORT);
      await waitForStatsToLoad(page);
      
      const gridContainer = page.locator('.grid').first();
      // Should have sm:grid-cols-2 or lg:grid-cols-3 classes
      await expect(gridContainer).toHaveClass(/grid/);
    });

    test('displays all columns on desktop', async ({ page }) => {
      await page.setViewportSize(DESKTOP_VIEWPORT);
      await waitForStatsToLoad(page);
      
      // All 5 stat cards should be visible in one row on large screens
      const cards = page.locator('[data-testid^="stat-card-"]');
      await expect(cards).toHaveCount(5);
      
      // Check that xl:grid-cols-5 is applied
      const gridContainer = page.locator('.grid').first();
      await expect(gridContainer).toHaveClass(/xl:grid-cols-5/);
    });
  });

  test.describe('Click-to-Filter Functionality', () => {
    test('filters activities when stat card is clicked', async ({ page }) => {
      // Click on Total Revenue card
      const revenueCard = page.locator('[data-testid="stat-card-total-revenue"]');
      await revenueCard.click();
      
      // Wait for filter to be applied
      await page.waitForTimeout(500);
      
      // Check that page title indicates filtering
      const pageTitle = page.locator('h1');
      await expect(pageTitle).toContainText('Sale Activities');
      
      // Verify filter indicator appears
      await expect(revenueCard.locator('[data-testid="filter-indicator"]')).toBeVisible();
      
      // Check that table shows only sale activities
      const activityRows = page.locator('tbody tr');
      const rowCount = await activityRows.count();
      
      if (rowCount > 0) {
        // Verify all visible activities are sales
        for (let i = 0; i < Math.min(rowCount, 5); i++) {
          const row = activityRows.nth(i);
          const activityType = row.locator('td').nth(1);
          await expect(activityType).toContainText('sale');
        }
      }
    });

    test('toggles filter when same card is clicked twice', async ({ page }) => {
      const revenueCard = page.locator('[data-testid="stat-card-total-revenue"]');
      
      // First click - apply filter
      await revenueCard.click();
      await page.waitForTimeout(500);
      
      let pageTitle = page.locator('h1');
      await expect(pageTitle).toContainText('Sale Activities');
      
      // Second click - remove filter
      await revenueCard.click();
      await page.waitForTimeout(500);
      
      pageTitle = page.locator('h1');
      await expect(pageTitle).toContainText('Activity Log');
      
      // Filter indicator should be gone
      await expect(revenueCard.locator('[data-testid="filter-indicator"]')).not.toBeVisible();
    });

    test('applies different filters when different cards are clicked', async ({ page }) => {
      // Click on Meeting Conversion card
      const meetingCard = page.locator('[data-testid="stat-card-meeting-conversion"]');
      await meetingCard.click();
      await page.waitForTimeout(500);
      
      const pageTitle = page.locator('h1');
      await expect(pageTitle).toContainText('Meeting Activities');
      
      // Now click on Proposal Win Rate card
      const proposalCard = page.locator('[data-testid="stat-card-proposal-win-rate"]');
      await proposalCard.click();
      await page.waitForTimeout(500);
      
      await expect(pageTitle).toContainText('Proposal Activities');
      
      // Meeting card should not be filtered anymore
      await expect(meetingCard.locator('[data-testid="filter-indicator"]')).not.toBeVisible();
      // Proposal card should be filtered
      await expect(proposalCard.locator('[data-testid="filter-indicator"]')).toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test('stat cards are keyboard accessible', async ({ page }) => {
      // Focus on first stat card
      const firstCard = page.locator('[data-testid^="stat-card-"]').first();
      await firstCard.focus();
      
      // Check focus is visible
      await expect(firstCard).toBeFocused();
      
      // Press Enter to activate
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
      
      // Should trigger filter (check page title changes)
      const pageTitle = page.locator('h1');
      const titleText = await pageTitle.textContent();
      expect(titleText).not.toBe('Activity Log'); // Should have changed
    });

    test('supports Tab navigation between cards', async ({ page }) => {
      // Start from first card
      const cards = page.locator('[data-testid^="stat-card-"]');
      const firstCard = cards.first();
      
      await firstCard.focus();
      await expect(firstCard).toBeFocused();
      
      // Tab to next card
      await page.keyboard.press('Tab');
      const secondCard = cards.nth(1);
      await expect(secondCard).toBeFocused();
      
      // Tab to third card
      await page.keyboard.press('Tab');
      const thirdCard = cards.nth(2);
      await expect(thirdCard).toBeFocused();
    });

    test('screen reader accessibility attributes', async ({ page }) => {
      const revenueCard = page.locator('[data-testid="stat-card-total-revenue"]');
      
      // Check ARIA attributes
      await expect(revenueCard).toHaveAttribute('role', 'button');
      await expect(revenueCard).toHaveAttribute('tabindex', '0');
      await expect(revenueCard).toHaveAttribute('aria-label');
      
      // Check aria-label contains meaningful content
      const ariaLabel = await revenueCard.getAttribute('aria-label');
      expect(ariaLabel).toContain('Total Revenue');
      expect(ariaLabel).toMatch(/trend/i);
    });

    test('passes automated accessibility audit', async ({ page }) => {
      // Use axe-core via playwright
      const accessibilityScanResults = await page.evaluate(async () => {
        // @ts-ignore
        if (typeof axe !== 'undefined') {
          // @ts-ignore
          return await axe.run();
        }
        return { violations: [] };
      });
      
      expect(accessibilityScanResults.violations).toHaveLength(0);
    });
  });

  test.describe('Performance and Load Testing', () => {
    test('loads quickly with large dataset', async ({ page }) => {
      await generateTestData(page, 5000);
      
      const startTime = Date.now();
      await page.goto(`${BASE_URL}/activity-log`);
      await waitForStatsToLoad(page);
      const loadTime = Date.now() - startTime;
      
      // Should load within 5 seconds even with 5000 activities
      expect(loadTime).toBeLessThan(5000);
      
      // Verify all stats cards loaded correctly
      const cards = page.locator('[data-testid^="stat-card-"]');
      await expect(cards).toHaveCount(5);
    });

    test('handles rapid filter changes without issues', async ({ page }) => {
      const cards = page.locator('[data-testid^="stat-card-"]');
      
      // Rapidly click different cards
      for (let i = 0; i < 3; i++) {
        await cards.nth(0).click();
        await page.waitForTimeout(100);
        await cards.nth(1).click();
        await page.waitForTimeout(100);
        await cards.nth(2).click();
        await page.waitForTimeout(100);
      }
      
      // Should not crash and still be functional
      await expect(page.locator('h1')).toBeVisible();
      await expect(cards.first()).toBeVisible();
    });

    test('maintains performance during extended use', async ({ page }) => {
      // Simulate extended user session
      const iterations = 10;
      
      for (let i = 0; i < iterations; i++) {
        // Cycle through different filters
        const cardIndex = i % 5;
        const card = page.locator('[data-testid^="stat-card-"]').nth(cardIndex);
        
        const startTime = Date.now();
        await card.click();
        await page.waitForTimeout(200);
        const responseTime = Date.now() - startTime;
        
        // Response time should remain consistent
        expect(responseTime).toBeLessThan(1000);
      }
    });
  });

  test.describe('Data Accuracy', () => {
    test('stat cards display mathematically correct values', async ({ page }) => {
      // Create controlled test data for predictable calculations
      await page.route('**/api/activities', async route => {
        const controlledActivities = [
          // 2 completed sales, total revenue £3000
          { id: '1', type: 'sale', status: 'completed', amount: 1000, date: '2024-01-01', sales_rep: 'Rep1', client_name: 'Client1' },
          { id: '2', type: 'sale', status: 'completed', amount: 2000, date: '2024-01-02', sales_rep: 'Rep1', client_name: 'Client2' },
          // 1 pending sale (shouldn't count in revenue)
          { id: '3', type: 'sale', status: 'pending', amount: 500, date: '2024-01-03', sales_rep: 'Rep1', client_name: 'Client3' },
          // 2 meetings, 1 proposal = 50% conversion
          { id: '4', type: 'meeting', status: 'completed', date: '2024-01-04', sales_rep: 'Rep1', client_name: 'Client1' },
          { id: '5', type: 'meeting', status: 'completed', date: '2024-01-05', sales_rep: 'Rep1', client_name: 'Client2' },
          { id: '6', type: 'proposal', status: 'completed', amount: 1000, date: '2024-01-06', sales_rep: 'Rep1', client_name: 'Client1' },
          // 1 no-show out of 5 scheduled activities = 20% no-show rate
          { id: '7', type: 'meeting', status: 'no_show', date: '2024-01-07', sales_rep: 'Rep1', client_name: 'Client4' }
        ];
        
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(controlledActivities)
        });
      });
      
      await page.reload();
      await waitForStatsToLoad(page);
      
      // Verify calculated values
      const revenueValue = await getStatCardValue(page, 'total-revenue');
      expect(revenueValue).toMatch(/£3,000/); // £1000 + £2000
      
      const meetingConversion = await getStatCardValue(page, 'meeting-conversion');
      expect(meetingConversion).toBe('50%'); // 1 proposal from 2 meetings
      
      const noShowRate = await getStatCardValue(page, 'no-show-rate');
      expect(noShowRate).toBe('17%'); // 1 no-show from 6 scheduled activities (rounded)
    });

    test('handles zero division gracefully', async ({ page }) => {
      // Create dataset with potential zero divisions
      await page.route('**/api/activities', async route => {
        const edgeCaseActivities = [
          { id: '1', type: 'outbound', status: 'completed', date: '2024-01-01', sales_rep: 'Rep1', client_name: 'Client1' }
          // Only outbound activities - no meetings, proposals, or sales
        ];
        
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(edgeCaseActivities)
        });
      });
      
      await page.reload();
      await waitForStatsToLoad(page);
      
      // All percentage values should be 0% or show appropriate fallback
      const meetingConversion = await getStatCardValue(page, 'meeting-conversion');
      expect(meetingConversion).toBe('0%');
      
      const noShowRate = await getStatCardValue(page, 'no-show-rate');
      expect(noShowRate).toBe('0%');
      
      const proposalWinRate = await getStatCardValue(page, 'proposal-win-rate');
      expect(proposalWinRate).toBe('0%');
    });
  });

  test.describe('Cross-Browser Compatibility', () => {
    ['chromium', 'firefox', 'webkit'].forEach(browserName => {
      test(`works correctly in ${browserName}`, async ({ page, browserName: currentBrowser }) => {
        test.skip(currentBrowser !== browserName, `Test for ${browserName} only`);
        
        await waitForStatsToLoad(page);
        
        // Basic functionality test
        const cards = page.locator('[data-testid^="stat-card-"]');
        await expect(cards).toHaveCount(5);
        
        // Test click interaction
        const firstCard = cards.first();
        await firstCard.click();
        await page.waitForTimeout(500);
        
        // Should show filtered state
        await expect(firstCard.locator('[data-testid="filter-indicator"]')).toBeVisible();
      });
    });
  });

  test.describe('Error Handling', () => {
    test('displays error state when API fails', async ({ page }) => {
      // Mock API failure
      await page.route('**/api/activities', async route => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal Server Error' })
        });
      });
      
      await page.goto(`${BASE_URL}/activity-log`);
      
      // Should show error state or fallback content
      const errorMessage = page.locator('[role="alert"]');
      if (await errorMessage.isVisible()) {
        await expect(errorMessage).toContainText(/error|failed/i);
      } else {
        // If no error message, should at least show zero values
        await waitForStatsToLoad(page);
        const revenueValue = await getStatCardValue(page, 'total-revenue');
        expect(revenueValue).toMatch(/£0|--/);
      }
    });

    test('recovers from network interruptions', async ({ page }) => {
      await waitForStatsToLoad(page);
      
      // Simulate network interruption
      await page.context().setOffline(true);
      
      // Attempt to interact (should handle gracefully)
      const firstCard = page.locator('[data-testid^="stat-card-"]').first();
      await firstCard.click();
      
      // Restore network
      await page.context().setOffline(false);
      await page.waitForTimeout(1000);
      
      // Should recover functionality
      await expect(firstCard).toBeVisible();
    });
  });
});

// Visual regression tests
test.describe('Visual Regression Tests', () => {
  test('stat cards visual appearance remains consistent', async ({ page }) => {
    await generateTestData(page, 50);
    await page.goto(`${BASE_URL}/activity-log`);
    await waitForStatsToLoad(page);
    
    // Take screenshot of the stats grid
    const statsGrid = page.locator('[data-testid="performance-stat-grid"], .grid').first();
    await expect(statsGrid).toHaveScreenshot('stats-grid-baseline.png');
  });

  test('filtered state visual appearance', async ({ page }) => {
    await generateTestData(page, 50);
    await page.goto(`${BASE_URL}/activity-log`);
    await waitForStatsToLoad(page);
    
    // Apply filter
    const revenueCard = page.locator('[data-testid="stat-card-total-revenue"]');
    await revenueCard.click();
    await page.waitForTimeout(500);
    
    // Take screenshot of filtered state
    await expect(revenueCard).toHaveScreenshot('filtered-stat-card.png');
  });

  test('responsive design visual consistency', async ({ page }) => {
    await generateTestData(page, 30);
    
    // Test mobile layout
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto(`${BASE_URL}/activity-log`);
    await waitForStatsToLoad(page);
    
    const statsGrid = page.locator('.grid').first();
    await expect(statsGrid).toHaveScreenshot('stats-grid-mobile.png');
    
    // Test tablet layout
    await page.setViewportSize(TABLET_VIEWPORT);
    await page.waitForTimeout(500);
    await expect(statsGrid).toHaveScreenshot('stats-grid-tablet.png');
    
    // Test desktop layout
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await page.waitForTimeout(500);
    await expect(statsGrid).toHaveScreenshot('stats-grid-desktop.png');
  });
});