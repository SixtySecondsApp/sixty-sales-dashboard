import { test, expect } from '@playwright/test';
import { performance } from 'perf_hooks';

// Performance thresholds (in milliseconds)
const PERFORMANCE_THRESHOLDS = {
  firstPaint: 800,
  interactive: 2000,
  fullyLoaded: 3000,
  apiCalls: 1500,
  mrrCards: 1500,
  activityChart: 1200,
};

// Test user credentials
const TEST_USER = {
  email: 'test@example.com',
  password: 'Test123456!',
};

test.describe('Dashboard Performance Tests', () => {
  test.beforeEach(async ({ page, context }) => {
    // Set up performance monitoring
    await context.addInitScript(() => {
      window.performanceMetrics = {
        startTime: Date.now(),
        firstPaint: 0,
        firstContentfulPaint: 0,
        domContentLoaded: 0,
        loadComplete: 0,
        apiCallsStarted: [],
        apiCallsCompleted: [],
      };

      // Monitor paint events
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === 'first-paint') {
            window.performanceMetrics.firstPaint = entry.startTime;
          }
          if (entry.name === 'first-contentful-paint') {
            window.performanceMetrics.firstContentfulPaint = entry.startTime;
          }
        }
      });
      observer.observe({ entryTypes: ['paint'] });

      // Monitor DOM events
      document.addEventListener('DOMContentLoaded', () => {
        window.performanceMetrics.domContentLoaded = Date.now() - window.performanceMetrics.startTime;
      });

      window.addEventListener('load', () => {
        window.performanceMetrics.loadComplete = Date.now() - window.performanceMetrics.startTime;
      });

      // Intercept fetch to monitor API calls
      const originalFetch = window.fetch;
      window.fetch = async (...args) => {
        const startTime = Date.now();
        const url = args[0].toString();
        
        window.performanceMetrics.apiCallsStarted.push({
          url,
          startTime: startTime - window.performanceMetrics.startTime,
        });

        try {
          const response = await originalFetch(...args);
          
          window.performanceMetrics.apiCallsCompleted.push({
            url,
            duration: Date.now() - startTime,
            status: response.status,
          });

          return response;
        } catch (error) {
          window.performanceMetrics.apiCallsCompleted.push({
            url,
            duration: Date.now() - startTime,
            error: true,
          });
          throw error;
        }
      };
    });
  });

  test('Dashboard initial load performance', async ({ page }) => {
    const startTime = Date.now();

    // TEMPORARY: Skip login in development mode
    // Navigate directly to dashboard (auth bypass enabled in dev)
    await page.goto('http://localhost:5173/');
    
    // Wait for dashboard content to appear
    await page.waitForSelector('.grid.grid-cols-1', { 
      state: 'visible',
      timeout: 10000 
    });

    // Measure time to first paint
    const firstPaintTime = await page.evaluate(() => {
      const paintEntries = performance.getEntriesByType('paint');
      const fcp = paintEntries.find(entry => entry.name === 'first-contentful-paint');
      return fcp ? fcp.startTime : 0;
    });

    console.log(`First Contentful Paint: ${firstPaintTime}ms`);
    expect(firstPaintTime).toBeLessThan(PERFORMANCE_THRESHOLDS.firstPaint);

    // Wait for dashboard to be interactive
    await page.waitForSelector('.grid.grid-cols-1', { 
      state: 'visible',
      timeout: PERFORMANCE_THRESHOLDS.interactive 
    });

    const interactiveTime = Date.now() - startTime;
    console.log(`Time to Interactive: ${interactiveTime}ms`);
    expect(interactiveTime).toBeLessThan(PERFORMANCE_THRESHOLDS.interactive);

    // Check if MRR cards are loaded with data
    const mrrCardsLoaded = await page.evaluate(() => {
      const cards = document.querySelectorAll('[class*="EnhancedStatCard"], [class*="stat-card"]');
      return cards.length > 0 && Array.from(cards).every(card => {
        const text = card.textContent || '';
        return !text.includes('Loading') && !text.includes('...');
      });
    });

    const mrrLoadTime = Date.now() - startTime;
    console.log(`MRR Cards Load Time: ${mrrLoadTime}ms`);
    expect(mrrLoadTime).toBeLessThan(PERFORMANCE_THRESHOLDS.mrrCards);
    expect(mrrCardsLoaded).toBe(true);

    // Check if activity metrics are loaded
    const metricsLoaded = await page.evaluate(() => {
      const metricCards = document.querySelectorAll('[class*="MetricCard"]');
      return metricCards.length >= 4; // Should have at least 4 metric cards
    });

    expect(metricsLoaded).toBe(true);

    // Measure total load time
    const totalLoadTime = Date.now() - startTime;
    console.log(`Total Dashboard Load Time: ${totalLoadTime}ms`);
    expect(totalLoadTime).toBeLessThan(PERFORMANCE_THRESHOLDS.fullyLoaded);

    // Get performance metrics from the page
    const metrics = await page.evaluate(() => window.performanceMetrics);
    
    console.log('Performance Metrics:', {
      firstPaint: `${metrics.firstPaint}ms`,
      firstContentfulPaint: `${metrics.firstContentfulPaint}ms`,
      domContentLoaded: `${metrics.domContentLoaded}ms`,
      loadComplete: `${metrics.loadComplete}ms`,
      apiCallsCount: metrics.apiCallsCompleted.length,
      apiCallsDuration: metrics.apiCallsCompleted.reduce((sum, call) => sum + call.duration, 0),
    });

    // Check API call performance
    const apiCallsDuration = metrics.apiCallsCompleted.reduce((sum, call) => sum + call.duration, 0);
    expect(apiCallsDuration).toBeLessThan(PERFORMANCE_THRESHOLDS.apiCalls);
  });

  test('Dashboard navigation performance', async ({ page }) => {
    // Navigate directly to dashboard (auth bypass enabled in dev)
    await page.goto('http://localhost:5173/');
    await page.waitForSelector('.grid.grid-cols-1', { state: 'visible' });

    // Test month navigation performance
    const navigationStartTime = Date.now();
    
    // Click previous month button
    await page.click('button[aria-label="Previous month"]');
    
    // Wait for data to update
    await page.waitForTimeout(500); // Small delay to ensure data updates
    
    const monthNavigationTime = Date.now() - navigationStartTime;
    console.log(`Month Navigation Time: ${monthNavigationTime}ms`);
    expect(monthNavigationTime).toBeLessThan(1000); // Should be fast with caching

    // Test navigating back to current month
    const backNavigationStartTime = Date.now();
    await page.click('button[aria-label="Next month"]');
    await page.waitForTimeout(500);
    
    const backNavigationTime = Date.now() - backNavigationStartTime;
    console.log(`Back Navigation Time (cached): ${backNavigationTime}ms`);
    expect(backNavigationTime).toBeLessThan(500); // Should be very fast when cached
  });

  test('Dashboard memory and resource usage', async ({ page }) => {
    // Navigate directly to dashboard (auth bypass enabled in dev)
    await page.goto('http://localhost:5173/');
    await page.waitForSelector('.grid.grid-cols-1', { state: 'visible' });

    // Check initial memory usage
    const initialMetrics = await page.evaluate(() => {
      if ('memory' in performance) {
        return {
          usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
          totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
        };
      }
      return null;
    });

    if (initialMetrics) {
      console.log('Initial Memory Usage:', {
        used: `${(initialMetrics.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB`,
        total: `${(initialMetrics.totalJSHeapSize / 1024 / 1024).toFixed(2)}MB`,
      });
    }

    // Navigate through several months to test memory leaks
    for (let i = 0; i < 5; i++) {
      await page.click('button[aria-label="Previous month"]');
      await page.waitForTimeout(300);
    }

    // Check memory after navigation
    const finalMetrics = await page.evaluate(() => {
      if ('memory' in performance) {
        return {
          usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
          totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
        };
      }
      return null;
    });

    if (initialMetrics && finalMetrics) {
      const memoryIncrease = finalMetrics.usedJSHeapSize - initialMetrics.usedJSHeapSize;
      console.log('Memory Increase:', `${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
      
      // Memory shouldn't increase by more than 10MB for simple navigation
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    }
  });

  test('Dashboard network efficiency', async ({ page }) => {
    // Monitor network requests
    const requests: any[] = [];
    page.on('request', request => {
      requests.push({
        url: request.url(),
        method: request.method(),
        startTime: Date.now(),
      });
    });

    page.on('response', response => {
      const request = requests.find(r => r.url === response.url());
      if (request) {
        request.status = response.status();
        request.duration = Date.now() - request.startTime;
        request.size = response.headers()['content-length'] || 0;
      }
    });

    // Navigate directly to dashboard (auth bypass enabled in dev)
    await page.goto('http://localhost:5173/');
    await page.waitForSelector('.grid.grid-cols-1', { state: 'visible' });

    // Wait for all network activity to complete
    await page.waitForLoadState('networkidle');

    // Analyze network requests
    const apiRequests = requests.filter(r => r.url.includes('/api') || r.url.includes('/functions'));
    const totalApiTime = apiRequests.reduce((sum, r) => sum + (r.duration || 0), 0);
    const totalApiSize = apiRequests.reduce((sum, r) => sum + parseInt(r.size || '0'), 0);

    console.log('Network Efficiency:', {
      totalRequests: requests.length,
      apiRequests: apiRequests.length,
      totalApiTime: `${totalApiTime}ms`,
      totalApiSize: `${(totalApiSize / 1024).toFixed(2)}KB`,
      averageApiTime: `${(totalApiTime / apiRequests.length).toFixed(2)}ms`,
    });

    // Check for duplicate requests (caching effectiveness)
    const duplicateRequests = apiRequests.filter((r, i) => 
      apiRequests.findIndex(r2 => r2.url === r.url) !== i
    );

    console.log(`Duplicate API Requests: ${duplicateRequests.length}`);
    expect(duplicateRequests.length).toBe(0); // Should have no duplicate requests with caching

    // Verify all API requests completed successfully
    const failedRequests = apiRequests.filter(r => r.status >= 400);
    expect(failedRequests.length).toBe(0);
  });

  test('Dashboard visual regression and loading states', async ({ page }) => {
    // Navigate directly to dashboard (auth bypass enabled in dev)
    await page.goto('http://localhost:5173/');

    // Screenshot: Loading state
    await page.waitForTimeout(100); // Capture loading state
    await page.screenshot({ 
      path: 'tests/screenshots/dashboard-perf-loading.png',
      fullPage: true 
    });

    // Wait for dashboard to load
    await page.waitForSelector('.grid.grid-cols-1', { state: 'visible' });

    // Screenshot: Fully loaded dashboard
    await page.screenshot({ 
      path: 'tests/screenshots/dashboard-perf-loaded.png',
      fullPage: true 
    });

    // Verify no layout shifts
    const layoutShifts = await page.evaluate(() => {
      return new Promise(resolve => {
        let shifts = 0;
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if ((entry as any).hadRecentInput) continue;
            shifts += (entry as any).value;
          }
        });
        observer.observe({ entryTypes: ['layout-shift'] });
        
        setTimeout(() => {
          observer.disconnect();
          resolve(shifts);
        }, 2000);
      });
    });

    console.log(`Cumulative Layout Shift: ${layoutShifts}`);
    expect(layoutShifts).toBeLessThan(0.1); // Good CLS score
  });
});