/**
 * COMPANY PROFILE PAGE E2E TESTS
 * 
 * Comprehensive testing for Company Profile functionality including:
 * - Navigation to company profiles
 * - Data loading and display
 * - Tab functionality
 * - Error handling for missing companies
 * - Responsive design
 */

import { test, expect, Page } from '@playwright/test';

// Test data constants
const TEST_COMPANY = {
  id: '1',
  name: 'Test Company Ltd',
  industry: 'Technology',
  size: '50-100 employees',
  website: 'https://testcompany.com'
};

const MALICIOUS_INPUTS = [
  "'; DROP TABLE companies; --",
  '<script>alert("XSS")</script>',
  '../../../etc/passwd',
  '999999999999999999999',
  'null',
  'undefined',
  ''
];

class CompanyProfilePage {
  constructor(private page: Page) {}

  async navigateToCompany(companyId: string) {
    await this.page.goto(`/companies/${companyId}`);
  }

  async waitForPageLoad() {
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForSelector('[data-testid="company-profile"], .company-profile, h1', { 
      timeout: 10000 
    });
  }

  async getCompanyName() {
    const nameSelectors = [
      '[data-testid="company-name"]',
      'h1',
      '.company-name',
      '.company-header h1'
    ];

    for (const selector of nameSelectors) {
      try {
        const element = await this.page.waitForSelector(selector, { timeout: 5000 });
        if (element) {
          return await element.textContent();
        }
      } catch (e) {
        continue;
      }
    }
    
    return null;
  }

  async checkTabExists(tabName: string) {
    const tabSelectors = [
      `[data-testid="tab-${tabName}"]`,
      `button:has-text("${tabName}")`,
      `[role="tab"]:has-text("${tabName}")`,
      `.tab:has-text("${tabName}")`
    ];

    for (const selector of tabSelectors) {
      try {
        await this.page.waitForSelector(selector, { timeout: 3000 });
        return true;
      } catch (e) {
        continue;
      }
    }
    
    return false;
  }

  async clickTab(tabName: string) {
    const tabSelectors = [
      `[data-testid="tab-${tabName}"]`,
      `button:has-text("${tabName}")`,
      `[role="tab"]:has-text("${tabName}")`,
      `.tab:has-text("${tabName}")`
    ];

    for (const selector of tabSelectors) {
      try {
        const element = await this.page.waitForSelector(selector, { timeout: 3000 });
        if (element) {
          await element.click();
          return true;
        }
      } catch (e) {
        continue;
      }
    }
    
    return false;
  }

  async getErrorMessage() {
    const errorSelectors = [
      '[data-testid="error-message"]',
      '.error-message',
      '.alert-error',
      '.error',
      'div:has-text("not found")',
      'div:has-text("error")'
    ];

    for (const selector of errorSelectors) {
      try {
        const element = await this.page.waitForSelector(selector, { timeout: 3000 });
        if (element) {
          return await element.textContent();
        }
      } catch (e) {
        continue;
      }
    }
    
    return null;
  }

  async checkBackButton() {
    const backSelectors = [
      '[data-testid="back-button"]',
      'button:has-text("Back")',
      'a:has-text("Back")',
      '.back-button'
    ];

    for (const selector of backSelectors) {
      try {
        await this.page.waitForSelector(selector, { timeout: 3000 });
        return true;
      } catch (e) {
        continue;
      }
    }
    
    return false;
  }

  async clickBackButton() {
    const backSelectors = [
      '[data-testid="back-button"]',
      'button:has-text("Back")',
      'a:has-text("Back")',
      '.back-button'
    ];

    for (const selector of backSelectors) {
      try {
        const element = await this.page.waitForSelector(selector, { timeout: 3000 });
        if (element) {
          await element.click();
          return true;
        }
      } catch (e) {
        continue;
      }
    }
    
    return false;
  }

  async getLoadingState() {
    const loadingSelectors = [
      '[data-testid="loading"]',
      '.loading',
      '.spinner',
      '.skeleton',
      '.animate-pulse'
    ];

    for (const selector of loadingSelectors) {
      try {
        await this.page.waitForSelector(selector, { timeout: 1000 });
        return true;
      } catch (e) {
        continue;
      }
    }
    
    return false;
  }
}

test.describe('Company Profile Page', () => {
  let companyPage: CompanyProfilePage;

  test.beforeEach(async ({ page }) => {
    companyPage = new CompanyProfilePage(page);
    
    // Mock API responses to avoid external dependencies
    await page.route('**/api/companies/**', async route => {
      const url = route.request().url();
      const companyId = url.split('/').pop();
      
      if (companyId === '1') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            company: TEST_COMPANY,
            deals: [
              {
                id: 1,
                name: 'Test Deal',
                value: 50000,
                stage: 'proposal',
                monthly_mrr: 5000,
                one_off_revenue: 10000
              }
            ],
            activities: [
              {
                id: 1,
                type: 'meeting',
                description: 'Initial meeting',
                date: '2024-01-15'
              }
            ],
            clients: [
              {
                id: 1,
                name: 'Test Client',
                status: 'active'
              }
            ]
          })
        });
      } else {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Company not found'
          })
        });
      }
    });
  });

  test.describe('Valid Company Access', () => {
    test('should load company profile successfully', async () => {
      await companyPage.navigateToCompany('1');
      await companyPage.waitForPageLoad();

      const companyName = await companyPage.getCompanyName();
      expect(companyName).toContain('Test Company');
    });

    test('should display company header information', async () => {
      await companyPage.navigateToCompany('1');
      await companyPage.waitForPageLoad();

      // Check for company icon or logo
      const iconSelectors = [
        '[data-testid="company-icon"]',
        '.company-icon',
        'svg[data-lucide="building-2"]',
        '.building-icon'
      ];

      let iconFound = false;
      for (const selector of iconSelectors) {
        try {
          await companyPage.page.waitForSelector(selector, { timeout: 3000 });
          iconFound = true;
          break;
        } catch (e) {
          continue;
        }
      }

      expect(iconFound).toBe(true);
    });

    test('should show navigation tabs', async () => {
      await companyPage.navigateToCompany('1');
      await companyPage.waitForPageLoad();

      const expectedTabs = ['Overview', 'Deals', 'Contacts', 'Activities'];
      
      for (const tab of expectedTabs) {
        const tabExists = await companyPage.checkTabExists(tab);
        expect(tabExists).toBe(true);
      }
    });

    test('should handle tab navigation correctly', async () => {
      await companyPage.navigateToCompany('1');
      await companyPage.waitForPageLoad();

      // Test clicking different tabs
      const tabs = ['Deals', 'Activities', 'Overview'];
      
      for (const tab of tabs) {
        const clicked = await companyPage.clickTab(tab);
        expect(clicked).toBe(true);
        
        // Wait for tab content to load
        await companyPage.page.waitForTimeout(500);
      }
    });

    test('should display deals information', async () => {
      await companyPage.navigateToCompany('1');
      await companyPage.waitForPageLoad();

      // Click on deals tab
      await companyPage.clickTab('Deals');

      // Look for deal information
      const dealSelectors = [
        '[data-testid="deal-item"]',
        '.deal-card',
        '.deal-item',
        'table tbody tr'
      ];

      let dealFound = false;
      for (const selector of dealSelectors) {
        try {
          await companyPage.page.waitForSelector(selector, { timeout: 5000 });
          dealFound = true;
          break;
        } catch (e) {
          continue;
        }
      }

      expect(dealFound).toBe(true);
    });

    test('should display activities information', async () => {
      await companyPage.navigateToCompany('1');
      await companyPage.waitForPageLoad();

      // Click on activities tab
      await companyPage.clickTab('Activities');

      // Look for activity information
      const activitySelectors = [
        '[data-testid="activity-item"]',
        '.activity-card',
        '.activity-item',
        'table tbody tr'
      ];

      let activityFound = false;
      for (const selector of activitySelectors) {
        try {
          await companyPage.page.waitForSelector(selector, { timeout: 5000 });
          activityFound = true;
          break;
        } catch (e) {
          continue;
        }
      }

      expect(activityFound).toBe(true);
    });

    test('should show back button and navigate correctly', async () => {
      await companyPage.navigateToCompany('1');
      await companyPage.waitForPageLoad();

      const backButtonExists = await companyPage.checkBackButton();
      expect(backButtonExists).toBe(true);

      // Click back button
      await companyPage.clickBackButton();
      
      // Should navigate to companies list
      await companyPage.page.waitForTimeout(1000);
      expect(companyPage.page.url()).toContain('/companies');
    });
  });

  test.describe('Error Handling', () => {
    test('should handle non-existent company gracefully', async () => {
      await companyPage.navigateToCompany('999999');
      
      // Should show error message
      const errorMessage = await companyPage.getErrorMessage();
      expect(errorMessage).toBeTruthy();
      expect(errorMessage?.toLowerCase()).toContain('not found');
    });

    test('should handle malicious company IDs safely', async () => {
      for (const maliciousId of MALICIOUS_INPUTS) {
        await companyPage.navigateToCompany(maliciousId);
        
        // Should either show error or handle gracefully
        const errorMessage = await companyPage.getErrorMessage();
        
        if (errorMessage) {
          // Error message should not contain the malicious input
          expect(errorMessage).not.toContain('<script>');
          expect(errorMessage).not.toContain('DROP TABLE');
          expect(errorMessage).not.toContain('../');
        }
        
        // Page should not crash
        expect(companyPage.page.isClosed()).toBe(false);
      }
    });

    test('should handle API errors gracefully', async () => {
      // Mock API to return server error
      await companyPage.page.route('**/api/companies/500', async route => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Internal server error'
          })
        });
      });

      await companyPage.navigateToCompany('500');
      
      const errorMessage = await companyPage.getErrorMessage();
      expect(errorMessage).toBeTruthy();
    });

    test('should handle network timeouts', async () => {
      // Mock slow API response
      await companyPage.page.route('**/api/companies/slow', async route => {
        await new Promise(resolve => setTimeout(resolve, 30000)); // 30 second delay
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({})
        });
      });

      await companyPage.navigateToCompany('slow');
      
      // Should show loading state initially
      const loadingState = await companyPage.getLoadingState();
      expect(loadingState).toBe(true);
    });
  });

  test.describe('Responsive Design', () => {
    test('should work on mobile devices', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
      
      await companyPage.navigateToCompany('1');
      await companyPage.waitForPageLoad();

      const companyName = await companyPage.getCompanyName();
      expect(companyName).toContain('Test Company');

      // Tabs should be accessible on mobile
      const tabExists = await companyPage.checkTabExists('Overview');
      expect(tabExists).toBe(true);
    });

    test('should work on tablet devices', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 }); // iPad
      
      await companyPage.navigateToCompany('1');
      await companyPage.waitForPageLoad();

      const companyName = await companyPage.getCompanyName();
      expect(companyName).toContain('Test Company');
    });

    test('should work on desktop devices', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 }); // Desktop
      
      await companyPage.navigateToCompany('1');
      await companyPage.waitForPageLoad();

      const companyName = await companyPage.getCompanyName();
      expect(companyName).toContain('Test Company');
    });
  });

  test.describe('Performance', () => {
    test('should load within acceptable time limits', async () => {
      const startTime = Date.now();
      
      await companyPage.navigateToCompany('1');
      await companyPage.waitForPageLoad();
      
      const loadTime = Date.now() - startTime;
      
      // Should load within 5 seconds
      expect(loadTime).toBeLessThan(5000);
    });

    test('should handle tab switching efficiently', async () => {
      await companyPage.navigateToCompany('1');
      await companyPage.waitForPageLoad();

      const tabs = ['Deals', 'Activities', 'Contacts', 'Overview'];
      
      for (const tab of tabs) {
        const startTime = Date.now();
        
        await companyPage.clickTab(tab);
        await companyPage.page.waitForTimeout(100); // Brief wait for tab content
        
        const switchTime = Date.now() - startTime;
        
        // Tab switching should be quick (under 1 second)
        expect(switchTime).toBeLessThan(1000);
      }
    });
  });

  test.describe('Data Integrity', () => {
    test('should display financial data correctly', async () => {
      await companyPage.navigateToCompany('1');
      await companyPage.waitForPageLoad();
      await companyPage.clickTab('Deals');

      // Look for financial data display
      const page = companyPage.page;
      
      // Check for currency formatting
      const currencyRegex = /£[\d,]+/;
      const currencyElements = await page.locator('text=' + currencyRegex.source).count();
      expect(currencyElements).toBeGreaterThan(0);
    });

    test('should show correct LTV calculations', async () => {
      await companyPage.navigateToCompany('1');
      await companyPage.waitForPageLoad();
      await companyPage.clickTab('Deals');

      // Test deal has monthly_mrr: 5000, one_off_revenue: 10000
      // LTV should be (5000 * 3) + 10000 = 25000
      const page = companyPage.page;
      
      // Look for LTV display
      const ltvSelectors = [
        'text=/LTV.*£25,000/',
        'text=/lifetime.*£25,000/i',
        'text=/£25,000/'
      ];

      let ltvFound = false;
      for (const selector of ltvSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 3000 });
          ltvFound = true;
          break;
        } catch (e) {
          continue;
        }
      }

      // LTV should be displayed somewhere (exact format may vary)
      expect(ltvFound).toBe(true);
    });

    test('should handle missing data gracefully', async () => {
      // Mock API to return company with minimal data
      await companyPage.page.route('**/api/companies/minimal', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            company: {
              id: 'minimal',
              name: 'Minimal Company'
            },
            deals: [],
            activities: [],
            clients: []
          })
        });
      });

      await companyPage.navigateToCompany('minimal');
      await companyPage.waitForPageLoad();

      const companyName = await companyPage.getCompanyName();
      expect(companyName).toContain('Minimal Company');

      // Should handle empty data gracefully
      await companyPage.clickTab('Deals');
      
      // Should show "no deals" message or empty state
      const emptyStateSelectors = [
        'text=/no deals/i',
        'text=/no data/i',
        'text=/empty/i',
        '.empty-state'
      ];

      let emptyStateFound = false;
      for (const selector of emptyStateSelectors) {
        try {
          await companyPage.page.waitForSelector(selector, { timeout: 3000 });
          emptyStateFound = true;
          break;
        } catch (e) {
          continue;
        }
      }

      expect(emptyStateFound).toBe(true);
    });
  });

  test.describe('Security', () => {
    test('should not expose sensitive information in errors', async () => {
      await companyPage.navigateToCompany('999999');
      
      const errorMessage = await companyPage.getErrorMessage();
      
      if (errorMessage) {
        // Should not expose database details, file paths, or tokens
        expect(errorMessage).not.toMatch(/database|sql|connection/i);
        expect(errorMessage).not.toMatch(/\/etc\/|\/var\/|C:\\/);
        expect(errorMessage).not.toMatch(/token|jwt|secret/i);
        expect(errorMessage).not.toMatch(/password|admin|root/i);
      }
    });

    test('should sanitize displayed company data', async () => {
      // Mock company with potentially malicious data
      await companyPage.page.route('**/api/companies/malicious', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            company: {
              id: 'malicious',
              name: '<script>alert("XSS")</script>Evil Company',
              description: 'Company with <img src="x" onerror="alert(1)">'
            },
            deals: [],
            activities: [],
            clients: []
          })
        });
      });

      await companyPage.navigateToCompany('malicious');
      await companyPage.waitForPageLoad();

      // Check that script tags are not executed
      const alerts = [];
      companyPage.page.on('dialog', dialog => {
        alerts.push(dialog.message());
        dialog.dismiss();
      });

      // Wait a moment for any potential script execution
      await companyPage.page.waitForTimeout(1000);

      // Should not have triggered any alerts
      expect(alerts.length).toBe(0);

      // HTML should be escaped in display
      const pageContent = await companyPage.page.content();
      expect(pageContent).not.toContain('<script>alert');
      expect(pageContent).not.toContain('onerror="alert');
    });
  });
});