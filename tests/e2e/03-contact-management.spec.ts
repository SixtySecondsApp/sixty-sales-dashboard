import { test, expect } from '@playwright/test';
import { testContacts } from '../fixtures/test-data';

test.describe('Contact Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
  });

  test('Can create contact without 403 Forbidden errors', async ({ page }) => {
    const forbiddenRequests: any[] = [];
    
    // Monitor for 403 errors
    page.on('response', response => {
      if (response.status() === 403 && response.url().includes('contact')) {
        forbiddenRequests.push({
          url: response.url(),
          status: response.status(),
          method: response.request().method()
        });
      }
    });

    // Navigate to contacts section
    const contactsLink = page.locator('a[href*="contact"], text=/Contacts/i, nav a:has-text("Contacts")');
    if (await contactsLink.count() > 0) {
      await contactsLink.click();
      await page.waitForLoadState('networkidle');
    }

    // Try to add a contact
    const addContactBtn = page.locator('button:has-text("Add Contact"), [data-testid="add-contact"], button:has-text("New Contact")');
    if (await addContactBtn.count() > 0) {
      await addContactBtn.click();

      // Fill contact form
      const firstNameInput = page.locator('input[name="firstName"], input[name="first_name"], input[placeholder*="first name"]');
      if (await firstNameInput.count() > 0) {
        await firstNameInput.fill(testContacts.validContact.firstName);
      }

      const lastNameInput = page.locator('input[name="lastName"], input[name="last_name"], input[placeholder*="last name"]');
      if (await lastNameInput.count() > 0) {
        await lastNameInput.fill(testContacts.validContact.lastName);
      }

      const emailInput = page.locator('input[name="email"], input[type="email"]');
      if (await emailInput.count() > 0) {
        await emailInput.fill(testContacts.validContact.email);
      }

      // Submit form
      const submitBtn = page.locator('button[type="submit"], button:has-text("Save"), button:has-text("Create")');
      if (await submitBtn.count() > 0) {
        await submitBtn.click();
        await page.waitForTimeout(3000);
      }
    } else {
      // Try QuickAdd for contact creation
      const quickAddTrigger = page.locator('[data-testid="quick-add-button"], button:has-text("Quick Add")');
      if (await quickAddTrigger.count() > 0) {
        await quickAddTrigger.click();
        
        // Look for contact creation option in QuickAdd
        const contactOption = page.locator('text=Contact, text=Add Contact, [data-action="contact"]');
        if (await contactOption.count() > 0) {
          await contactOption.click();
          
          // Fill contact form in QuickAdd
          const emailInput = page.locator('input[type="email"], input[name="email"]');
          if (await emailInput.count() > 0) {
            await emailInput.fill(testContacts.validContact.email);
          }
          
          const submitBtn = page.locator('button[type="submit"], button:has-text("Create")');
          if (await submitBtn.count() > 0) {
            await submitBtn.click();
            await page.waitForTimeout(3000);
          }
        }
      }
    }

    // Check that no 403 errors occurred
    if (forbiddenRequests.length > 0) {
      console.log('403 Forbidden errors detected:', forbiddenRequests);
    }
    expect(forbiddenRequests).toHaveLength(0);
  });

  test('Contact search and selection works in QuickAdd', async ({ page }) => {
    const quickAddTrigger = page.locator('[data-testid="quick-add-button"], button:has-text("Quick Add")');
    if (await quickAddTrigger.count() > 0) {
      await quickAddTrigger.click();
      
      // Select an action that requires contact (meeting, proposal, sale)
      const meetingOption = page.locator('text=Meeting, [data-action="meeting"]');
      if (await meetingOption.count() > 0) {
        await meetingOption.click();

        // Should show contact search interface
        const contactSearch = page.locator('input[placeholder*="search"], input[placeholder*="contact"], button:has-text("Search Contacts")');
        await expect(contactSearch).toBeVisible({ timeout: 5000 });

        // Test search functionality
        if (await page.locator('input[placeholder*="search"], input[placeholder*="contact"]').count() > 0) {
          const searchInput = page.locator('input[placeholder*="search"], input[placeholder*="contact"]');
          await searchInput.fill('john');
          
          // Should show search results or "no results" message
          const searchResults = page.locator('[class*="search-result"], [data-testid="contact-result"], text=/No results|Found/i');
          await expect(searchResults).toBeVisible({ timeout: 5000 });
        }
      }
    }
  });

  test('Contact validation works correctly', async ({ page }) => {
    // Try to create contact with invalid data through QuickAdd
    const quickAddTrigger = page.locator('[data-testid="quick-add-button"], button:has-text("Quick Add")');
    if (await quickAddTrigger.count() > 0) {
      await quickAddTrigger.click();
      
      const meetingOption = page.locator('text=Meeting, [data-action="meeting"]');
      if (await meetingOption.count() > 0) {
        await meetingOption.click();

        // Try to proceed without selecting contact
        const companyInput = page.locator('input[name*="company"], input[name*="client"], input[placeholder*="company"]');
        if (await companyInput.count() > 0) {
          await companyInput.fill('Test Company');
        }

        const submitBtn = page.locator('button[type="submit"], button:has-text("Create")');
        if (await submitBtn.count() > 0) {
          await submitBtn.click();

          // Should show validation error about missing contact
          await expect(page.locator('text=/contact.*required|Please.*contact|Select.*contact/i')).toBeVisible();
        }
      }
    }
  });

  test('Contact information displays correctly', async ({ page }) => {
    // Navigate to contacts page if exists
    const contactsLink = page.locator('a[href*="contact"], text=/Contacts/i, nav a:has-text("Contacts")');
    if (await contactsLink.count() > 0) {
      await contactsLink.click();
      await page.waitForLoadState('networkidle');

      // Check that contact list loads without errors
      const errorMessage = page.locator('text=/Error|Failed|Something went wrong/i');
      expect(await errorMessage.count()).toBe(0);

      // Check for contact display elements
      const contactElements = page.locator('[class*="contact"], [data-testid*="contact"], tr, .card');
      if (await contactElements.count() > 0) {
        // Should show contact information
        await expect(contactElements.first()).toBeVisible();
      }
    }
  });

  test('Contact linking works in activities', async ({ page }) => {
    const quickAddTrigger = page.locator('[data-testid="quick-add-button"], button:has-text("Quick Add")');
    if (await quickAddTrigger.count() > 0) {
      await quickAddTrigger.click();
      
      const saleOption = page.locator('text=Sale, [data-action="sale"]');
      if (await saleOption.count() > 0) {
        await saleOption.click();

        // Fill in contact information
        const contactEmailInput = page.locator('input[name*="contact"], input[name="email"], input[placeholder*="email"]');
        if (await contactEmailInput.count() > 0) {
          await contactEmailInput.fill(testContacts.validContact.email);
        }

        const companyInput = page.locator('input[name*="company"], input[name*="client"]');
        if (await companyInput.count() > 0) {
          await companyInput.fill(testContacts.validContact.company);
        }

        // Should not show errors about contact linking
        const submitBtn = page.locator('button[type="submit"], button:has-text("Create")');
        if (await submitBtn.count() > 0) {
          await submitBtn.click();

          // Should either succeed or show specific validation errors (not generic errors)
          await page.waitForTimeout(3000);
          const genericError = page.locator('text=/unexpected error|unknown error|500/i');
          expect(await genericError.count()).toBe(0);
        }
      }
    }
  });

  test('Contact modal closes properly', async ({ page }) => {
    const quickAddTrigger = page.locator('[data-testid="quick-add-button"], button:has-text("Quick Add")');
    if (await quickAddTrigger.count() > 0) {
      await quickAddTrigger.click();
      
      const dealOption = page.locator('text=Deal, [data-action="deal"]');
      if (await dealOption.count() > 0) {
        await dealOption.click();

        // Should open contact search modal
        const contactModal = page.locator('[role="dialog"], .modal, [class*="contact-search"]');
        if (await contactModal.count() > 0) {
          await expect(contactModal).toBeVisible();

          // Close contact modal
          const closeBtn = page.locator('[aria-label="close"], button:has-text("×"), .close-btn').last();
          await closeBtn.click();

          // Should close and return to previous state
          await expect(contactModal).toBeHidden();
        }
      }
    }
  });
});