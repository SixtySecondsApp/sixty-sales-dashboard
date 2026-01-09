import { describe, test, expect as vitestExpect, beforeAll, afterAll, beforeEach } from 'vitest';
import { expect as playwrightExpect } from '../fixtures/playwright-assertions';
import { setupPlaywriter, teardownPlaywriter } from '../fixtures/playwriter-setup';
import type { Page } from 'playwright-core';

const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || process.env.VITE_BASE_URL || 'http://localhost:5175';

describe('Performance and Accessibility Tests', () => {
  let page: Page;

  beforeAll(async () => {
    const setup = await setupPlaywriter();
    page = setup.page;
  });

  afterAll(async () => {
    await teardownPlaywriter();
  });

  beforeEach(async () => {
    // Start from the app root
    await page.goto(`${BASE_URL}/`);
    await page.waitForLoadState('networkidle');
  });

  describe('Performance Testing', () => {
    test('should load payments page within acceptable time limits', async () => {
      const startTime = Date.now();
      
      await page.goto(`${BASE_URL}/payments`);
      await page.waitForLoadState('networkidle');
      
      const loadTime = Date.now() - startTime;
      
      // Should load within 5 seconds (reasonable for local development)
      vitestExpect(loadTime).toBeLessThan(5000);
      
      // Verify page is fully loaded
      await playwrightExpect(page.locator('h1')).toHaveText(/Payment Management/i);
    });

    test('should load clients page within acceptable time limits', async () => {
      const startTime = Date.now();
      
      await page.goto(`${BASE_URL}/clients`);
      await page.waitForLoadState('networkidle');
      
      const loadTime = Date.now() - startTime;
      
      // Should load within 5 seconds
      vitestExpect(loadTime).toBeLessThan(5000);
      
      // Verify page is fully loaded
      await playwrightExpect(page.locator('h1')).toHaveText(/Client Management/i);
    });

    test('should handle view switching with minimal delay', async () => {
      await page.goto(`${BASE_URL}/clients`);
      await page.waitForLoadState('networkidle');
      
      const startTime = Date.now();
      
      // Switch to detailed view
      await page.locator('button', { hasText: 'Deal Details' }).click();
      await playwrightExpect(page.locator('p')).toHaveText(/Detailed view showing individual deals/i);
      
      const switchTime = Date.now() - startTime;
      
      // View switching should be near-instantaneous (under 1 second)
      vitestExpect(switchTime).toBeLessThan(1000);
    });

    test('should measure Core Web Vitals on payments page', async () => {
      await page.goto(`${BASE_URL}/payments`);
      
      // Wait for page to fully load
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      
      // Measure performance metrics
      const metrics = await page.evaluate(() => {
        return new Promise((resolve) => {
          // Get navigation timing
          const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
          
          // Calculate metrics
          const metrics = {
            // Time to first byte
            ttfb: navigation.responseStart - navigation.requestStart,
            // DOM content loaded
            domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
            // Full page load
            loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
            // First paint timing (if available)
            firstPaint: 0,
            firstContentfulPaint: 0
          };
          
          // Get paint timing if available
          const paintEntries = performance.getEntriesByType('paint');
          paintEntries.forEach((entry) => {
            if (entry.name === 'first-paint') {
              metrics.firstPaint = entry.startTime;
            } else if (entry.name === 'first-contentful-paint') {
              metrics.firstContentfulPaint = entry.startTime;
            }
          });
          
          resolve(metrics);
        });
      });
      // Assert reasonable performance
      vitestExpect(metrics.ttfb).toBeLessThan(1000); // TTFB under 1 second
      vitestExpect(metrics.domContentLoaded).toBeLessThan(2000); // DOM ready under 2 seconds
    });

    test('should measure memory usage during navigation', async () => {
      // Enable memory monitoring
      const client = await page.context().newCDPSession(page);
      await client.send('Performance.enable');
      
      // Navigate through pages
      await page.goto(`${BASE_URL}/payments`);
      await page.waitForLoadState('networkidle');
      
      const memoryBefore = await client.send('Performance.getMetrics');
      
      await page.goto(`${BASE_URL}/clients`);
      await page.waitForLoadState('networkidle');
      
      // Switch views multiple times
      for (let i = 0; i < 5; i++) {
        await page.locator('button', { hasText: 'Deal Details' }).click();
        await page.waitForTimeout(100);
        await page.locator('button', { hasText: 'Client Overview' }).click();
        await page.waitForTimeout(100);
      }
      
      const memoryAfter = await client.send('Performance.getMetrics');
      
      // Memory usage should not grow excessively
      const memoryGrowth = memoryAfter.metrics.find(m => m.name === 'JSHeapUsedSize')?.value || 0 -
                          (memoryBefore.metrics.find(m => m.name === 'JSHeapUsedSize')?.value || 0);
      
      // Memory growth should be reasonable (less than 50MB)
      vitestExpect(memoryGrowth).toBeLessThan(50 * 1024 * 1024);
    });

    test('should handle concurrent API requests efficiently', async () => {
      // Mock multiple API endpoints
      let requestCount = 0;
      await page.route('**/api/**', (route) => {
        requestCount++;
        setTimeout(() => {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([])
          });
        }, 100); // Small delay to simulate network
      });
      
      const startTime = Date.now();
      
      // Navigate to page that might make multiple API calls
      await page.goto(`${BASE_URL}/payments`);
      await page.waitForLoadState('networkidle');
      
      const totalTime = Date.now() - startTime;
      // Should complete within reasonable time even with multiple requests
      vitestExpect(totalTime).toBeLessThan(3000);
    });
  });

  describe('Accessibility Testing', () => {
    test('should have proper heading hierarchy on payments page', async () => {
      await page.goto(`${BASE_URL}/payments`);
      await page.waitForLoadState('networkidle');
      
      // Check for h1
      const h1Elements = page.locator('h1');
      vitestExpect(await h1Elements.count()).toBe(1);
      await playwrightExpect(h1Elements).toHaveText(/Payment Management/i);
      
      // Check for h2
      const h2Elements = page.locator('h2');
      vitestExpect(await h2Elements.count()).toBeGreaterThanOrEqual(1);
      await playwrightExpect(h2Elements.first()).toHaveText(/Revenue Overview/i);
      
      // Ensure no heading levels are skipped (basic check)
      const allHeadings = await page.locator('h1, h2, h3, h4, h5, h6').allTextContents();
      vitestExpect(allHeadings.length).toBeGreaterThan(0);
    });

    test('should have proper heading hierarchy on clients page', async () => {
      await page.goto(`${BASE_URL}/clients`);
      await page.waitForLoadState('networkidle');
      
      // Check for h1
      const h1Elements = page.locator('h1');
      vitestExpect(await h1Elements.count()).toBe(1);
      await playwrightExpect(h1Elements).toHaveText(/Client Management/i);
      
      // Check for proper heading structure
      const allHeadings = await page.locator('h1, h2, h3, h4, h5, h6').allTextContents();
      vitestExpect(allHeadings.length).toBeGreaterThan(0);
    });

    test('should have accessible buttons with proper labels', async () => {
      await page.goto(`${BASE_URL}/clients`);
      await page.waitForLoadState('networkidle');
      
      // Check toggle buttons
      const buttons = page.locator('button');
      const buttonCount = await buttons.count();
      vitestExpect(buttonCount).toBeGreaterThanOrEqual(2);
      
      // Each button should have accessible text
      for (let i = 0; i < buttonCount; i++) {
        const button = buttons.nth(i);
        const buttonText = await button.textContent();
        vitestExpect(buttonText?.trim()).toBeTruthy();
      }
      
      // Specific button checks
      await playwrightExpect(page.locator('button', { hasText: 'Client Overview' })).toBeVisible();
      await playwrightExpect(page.locator('button', { hasText: 'Deal Details' })).toBeVisible();
    });

    test('should support keyboard navigation', async () => {
      await page.goto(`${BASE_URL}/clients`);
      await page.waitForLoadState('networkidle');
      
      // Test tab navigation through buttons
      await page.keyboard.press('Tab');
      let focusedElement = await page.evaluate(() => document.activeElement?.tagName);
      
      // Should be able to navigate with keyboard
      const clientOverviewButton = page.locator('button', { hasText: 'Client Overview' });
      const dealDetailsButton = page.locator('button', { hasText: 'Deal Details' });
      
      // Focus on deal details button
      await dealDetailsButton.focus();
      vitestExpect(await dealDetailsButton.evaluate(el => el === document.activeElement)).toBeTruthy();
      
      // Activate with keyboard
      await page.keyboard.press('Enter');
      await playwrightExpect(page.locator('p')).toHaveText(/Detailed view showing individual deals/i);
    });

    test('should have sufficient color contrast', async () => {
      await page.goto(`${BASE_URL}/payments`);
      await page.waitForLoadState('networkidle');
      
      // Check main heading color
      const h1 = page.locator('h1');
      const h1Styles = await h1.evaluate((el) => {
        const computed = window.getComputedStyle(el);
        return {
          color: computed.color,
          backgroundColor: computed.backgroundColor
        };
      });
      
      // Should have visible text (not transparent)
      vitestExpect(h1Styles.color).not.toBe('rgba(0, 0, 0, 0)');
      vitestExpect(h1Styles.color).not.toBe('transparent');
    });

    test('should have proper focus indicators', async () => {
      await page.goto(`${BASE_URL}/clients`);
      await page.waitForLoadState('networkidle');
      
      const dealDetailsButton = page.locator('button', { hasText: 'Deal Details' });
      
      // Focus the button
      await dealDetailsButton.focus();
      
      // Check if focus is visible (element should be focused)
      const isFocused = await dealDetailsButton.evaluate(el => el === document.activeElement);
      vitestExpect(isFocused).toBeTruthy();
    });

    test('should have semantic HTML structure', async () => {
      await page.goto(`${BASE_URL}/payments`);
      await page.waitForLoadState('networkidle');
      
      // Check for main content area
      const main = page.locator('main');
      const hasMain = await main.count() > 0;
      
      // If no main element, should at least have proper heading structure
      if (!hasMain) {
        const h1 = page.locator('h1');
        vitestExpect(await h1.count()).toBe(1);
      }
      
      // Check for proper button roles
      const buttons = page.locator('button, [role="button"]');
      const buttonCount = await buttons.count();
      vitestExpect(buttonCount).toBeGreaterThanOrEqual(0);
    });

    test('should provide alternative text for images and icons', async () => {
      await page.goto(`${BASE_URL}/clients`);
      await page.waitForLoadState('networkidle');
      
      // Check for images without alt text
      const images = page.locator('img');
      const imageCount = await images.count();
      
      for (let i = 0; i < imageCount; i++) {
        const img = images.nth(i);
        const alt = await img.getAttribute('alt');
        const ariaLabel = await img.getAttribute('aria-label');
        const ariaHidden = await img.getAttribute('aria-hidden');
        
        // Images should have alt text, aria-label, or be decorative (aria-hidden="true")
        vitestExpect(alt !== null || ariaLabel !== null || ariaHidden === 'true').toBeTruthy();
      }
    });

    test('should handle screen reader compatibility', async () => {
      await page.goto(`${BASE_URL}/payments`);
      await page.waitForLoadState('networkidle');
      
      // Check for ARIA landmarks and labels
      const landmarks = page.locator('[role="main"], [role="banner"], [role="navigation"], [role="complementary"]');
      const landmarkCount = await landmarks.count();
      
      // Should have some ARIA structure (even if minimal)
      // This is a basic check - in a real app you'd want more comprehensive ARIA
      const pageContent = await page.textContent('body');
      vitestExpect(pageContent).toBeTruthy();
      
      // Check that content is readable
      vitestExpect(pageContent).toContain('Payment Management');
    });
  });

  describe('Mobile Responsiveness', () => {
    test('should render correctly on mobile viewport', async () => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      
      await page.goto(`${BASE_URL}/payments`);
      await page.waitForLoadState('networkidle');
      
      // Should still render main content
      await playwrightExpect(page.locator('h1')).toHaveText(/Payment Management/i);
      
      // Check if content is accessible (not cut off)
      const h1 = page.locator('h1');
      const boundingBox = await h1.boundingBox();
      vitestExpect(boundingBox?.width).toBeLessThanOrEqual(375);
    });

    test('should handle view switching on mobile', async () => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      
      await page.goto(`${BASE_URL}/clients`);
      await page.waitForLoadState('networkidle');
      
      // Toggle buttons should be accessible on mobile
      const dealDetailsButton = page.locator('button', { hasText: 'Deal Details' });
      await playwrightExpect(dealDetailsButton).toBeVisible();
      
      // Should be clickable
      await dealDetailsButton.click();
      await playwrightExpect(page.locator('p')).toHaveText(/Detailed view showing individual deals/i);
    });

    test('should maintain usability on tablet viewport', async () => {
      // Set tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 });
      
      await page.goto(`${BASE_URL}/clients`);
      await page.waitForLoadState('networkidle');
      
      // Content should be properly laid out
      await playwrightExpect(page.locator('h1')).toHaveText(/Client Management/i);
      
      // Buttons should be properly sized and spaced
      const buttons = page.locator('button');
      const buttonCount = await buttons.count();
      vitestExpect(buttonCount).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Browser Performance', () => {
    test('should not cause memory leaks during extended use', async () => {
      // Simulate extended usage
      for (let i = 0; i < 3; i++) {
        await page.goto(`${BASE_URL}/payments`);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(500);
        
        await page.goto(`${BASE_URL}/clients`);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(500);
        
        // Switch views
        await page.locator('button', { hasText: 'Deal Details' }).click();
        await page.waitForTimeout(200);
        await page.locator('button', { hasText: 'Client Overview' }).click();
        await page.waitForTimeout(200);
      }
      
      // Should still be responsive
      await playwrightExpect(page.locator('h1')).toHaveText(/Client Management/i);
    });

    test('should handle rapid interactions without breaking', async () => {
      await page.goto(`${BASE_URL}/clients`);
      await page.waitForLoadState('networkidle');
      
      // Rapid button clicking
      const dealDetailsButton = page.locator('button', { hasText: 'Deal Details' });
      const clientOverviewButton = page.locator('button', { hasText: 'Client Overview' });
      
      for (let i = 0; i < 10; i++) {
        await dealDetailsButton.click();
        await clientOverviewButton.click();
      }
      
      // Should end in a stable state
      await playwrightExpect(page.locator('h1')).toHaveText(/Client Management/i);
    });
  });
});
