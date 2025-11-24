import { test, expect } from '@playwright/test';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * E2E Tests for Calendar Export/Import Functionality
 *
 * Tests the complete user workflow for:
 * - Exporting calendar events to .ics files
 * - Importing events from .ics files
 * - Bulk operations (select, delete, reschedule, categorize)
 * - Sales template integration with calendar
 */

test.describe('Calendar Export/Import', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to calendar page
    await page.goto('/calendar');

    // Wait for calendar to load
    await page.waitForSelector('[data-testid="calendar-view"]', { timeout: 10000 });
  });

  test('should export all calendar events to .ics file', async ({ page }) => {
    // Click Export/Import button
    await page.click('button:has-text("Export/Import")');

    // Wait for modal to open
    await expect(page.locator('text=Export / Import Calendar')).toBeVisible();

    // Verify we're on the Export tab
    await expect(page.locator('button:has-text("Export")').locator('..')).toHaveClass(/bg-\[#37bd7e\]/);

    // Verify event count is displayed
    const totalEventsText = await page.locator('text=Total Events:').textContent();
    expect(totalEventsText).toContain('Total Events:');

    // Set up download listener
    const downloadPromise = page.waitForEvent('download');

    // Click Export All button
    await page.click('button:has-text("Export All")');

    // Wait for download to complete
    const download = await downloadPromise;

    // Verify filename matches pattern: sixty-sales-calendar-YYYY-MM-DD.ics
    expect(download.suggestedFilename()).toMatch(/sixty-sales-calendar-\d{4}-\d{2}-\d{2}\.ics/);

    // Save file to temp directory
    const filePath = path.join(__dirname, 'temp', download.suggestedFilename());
    await download.saveAs(filePath);

    // Verify file exists and has content
    const fileContent = await fs.readFile(filePath, 'utf-8');
    expect(fileContent).toContain('BEGIN:VCALENDAR');
    expect(fileContent).toContain('VERSION:2.0');
    expect(fileContent).toContain('PRODID:-//Sixty Sales//Calendar//EN');
    expect(fileContent).toContain('BEGIN:VEVENT');
    expect(fileContent).toContain('END:VCALENDAR');

    // Cleanup
    await fs.unlink(filePath);

    // Verify success toast
    await expect(page.locator('text=Exported')).toBeVisible({ timeout: 5000 });
  });

  test('should export only selected events', async ({ page }) => {
    // Enter selection mode
    await page.click('button:has-text("Select")');

    // Wait for SelectableEventsList to appear
    await expect(page.locator('[data-testid="selectable-events-list"]')).toBeVisible();

    // Select first 3 events
    const checkboxes = await page.locator('input[type="checkbox"]').all();
    await checkboxes[1]?.check(); // Skip "select all" checkbox
    await checkboxes[2]?.check();
    await checkboxes[3]?.check();

    // Verify selection count
    await expect(page.locator('text=3 selected')).toBeVisible();

    // Open Export/Import modal
    await page.click('button:has-text("Export/Import")');

    // Verify selected count is shown
    await expect(page.locator('text=Selected:').locator('..')).toContainText('3');

    // Set up download listener
    const downloadPromise = page.waitForEvent('download');

    // Click Export Selected button
    await page.click('button:has-text("Export Selected")');

    // Wait for download
    const download = await downloadPromise;

    // Verify file was downloaded
    expect(download.suggestedFilename()).toMatch(/\.ics$/);

    // Verify only 3 events in file
    const filePath = path.join(__dirname, 'temp', download.suggestedFilename());
    await download.saveAs(filePath);
    const fileContent = await fs.readFile(filePath, 'utf-8');

    const eventCount = (fileContent.match(/BEGIN:VEVENT/g) || []).length;
    expect(eventCount).toBe(3);

    // Cleanup
    await fs.unlink(filePath);
  });

  test('should import events from .ics file with preview', async ({ page }) => {
    // Create a test .ics file
    const testICalContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Calendar//EN
X-WR-CALNAME:Test Import
BEGIN:VEVENT
UID:test-import-1@test.com
SUMMARY:Imported Meeting
DESCRIPTION:Test imported event
LOCATION:Virtual
DTSTART:20250120T140000Z
DTEND:20250120T150000Z
CATEGORIES:MEETING
PRIORITY:1
ATTENDEE:mailto:test@example.com
END:VEVENT
BEGIN:VEVENT
UID:test-import-2@test.com
SUMMARY:Imported Phone Call
DTSTART:20250121T100000Z
DTEND:20250121T103000Z
CATEGORIES:CALL
END:VEVENT
BEGIN:VEVENT
UID:test-import-3@test.com
SUMMARY:Imported Task
DTSTART;VALUE=DATE:20250122
CATEGORIES:TASK
END:VEVENT
END:VCALENDAR`;

    // Save test file
    const testFilePath = path.join(__dirname, 'temp', 'test-import.ics');
    await fs.writeFile(testFilePath, testICalContent);

    // Open Export/Import modal
    await page.click('button:has-text("Export/Import")');

    // Switch to Import tab
    await page.click('button:has-text("Import")');

    // Verify Import tab is active
    await expect(page.locator('button:has-text("Import")').locator('..')).toHaveClass(/bg-\[#37bd7e\]/);

    // Upload file
    const fileInput = await page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFilePath);

    // Wait for file to be processed
    await expect(page.locator('text=Found 3 events in file')).toBeVisible({ timeout: 5000 });

    // Verify preview shows file name
    await expect(page.locator('text=test-import.ics')).toBeVisible();

    // Verify statistics are displayed
    await expect(page.locator('text=Total Events:')).toBeVisible();
    await expect(page.locator('text=3').first()).toBeVisible();
    await expect(page.locator('text=Meetings:')).toBeVisible();
    await expect(page.locator('text=1').nth(1)).toBeVisible();
    await expect(page.locator('text=Calls:')).toBeVisible();
    await expect(page.locator('text=1').nth(2)).toBeVisible();

    // Verify first few events are shown in preview
    await expect(page.locator('text=Imported Meeting')).toBeVisible();
    await expect(page.locator('text=Imported Phone Call')).toBeVisible();
    await expect(page.locator('text=Imported Task')).toBeVisible();

    // Click Import button
    await page.click('button:has-text("Import 3 Events")');

    // Verify success message
    await expect(page.locator('text=Imported 3 events successfully')).toBeVisible({ timeout: 5000 });

    // Verify modal is closed
    await expect(page.locator('text=Export / Import Calendar')).not.toBeVisible();

    // Cleanup
    await fs.unlink(testFilePath);
  });

  test('should validate file type and show error for non-.ics files', async ({ page }) => {
    // Create a non-.ics file
    const testFilePath = path.join(__dirname, 'temp', 'invalid.txt');
    await fs.writeFile(testFilePath, 'This is not an iCal file');

    // Open Export/Import modal
    await page.click('button:has-text("Export/Import")');

    // Switch to Import tab
    await page.click('button:has-text("Import")');

    // Upload invalid file
    const fileInput = await page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFilePath);

    // Verify error message
    await expect(page.locator('text=Please select a valid .ics calendar file')).toBeVisible({ timeout: 5000 });

    // Cleanup
    await fs.unlink(testFilePath);
  });

  test('should handle canceling import', async ({ page }) => {
    // Create test file
    const testICalContent = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:cancel-test@test.com
SUMMARY:Test Event
DTSTART:20250120T100000Z
END:VEVENT
END:VCALENDAR`;

    const testFilePath = path.join(__dirname, 'temp', 'cancel-test.ics');
    await fs.writeFile(testFilePath, testICalContent);

    // Open modal and upload file
    await page.click('button:has-text("Export/Import")');
    await page.click('button:has-text("Import")');
    const fileInput = await page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFilePath);

    // Wait for preview
    await expect(page.locator('text=Found 1 events in file')).toBeVisible();

    // Click Cancel button
    await page.click('button:has-text("Cancel")');

    // Verify preview is cleared
    await expect(page.locator('text=cancel-test.ics')).not.toBeVisible();
    await expect(page.locator('text=Choose File')).toBeVisible();

    // Cleanup
    await fs.unlink(testFilePath);
  });
});

test.describe('Bulk Operations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/calendar');
    await page.waitForSelector('[data-testid="calendar-view"]', { timeout: 10000 });
  });

  test('should enter and exit selection mode', async ({ page }) => {
    // Click Select button
    await page.click('button:has-text("Select")');

    // Verify selection mode is active
    await expect(page.locator('button:has-text("Exit Selection")')).toBeVisible();
    await expect(page.locator('[data-testid="selectable-events-list"]')).toBeVisible();

    // Click Exit Selection
    await page.click('button:has-text("Exit Selection")');

    // Verify normal view is restored
    await expect(page.locator('button:has-text("Select")')).toBeVisible();
    await expect(page.locator('[data-testid="calendar-view"]')).toBeVisible();
  });

  test('should select and deselect individual events', async ({ page }) => {
    // Enter selection mode
    await page.click('button:has-text("Select")');

    // Select first event
    const checkboxes = await page.locator('input[type="checkbox"]').all();
    await checkboxes[1]?.check();

    // Verify selection count
    await expect(page.locator('text=1 selected')).toBeVisible();

    // Deselect the event
    await checkboxes[1]?.uncheck();

    // Verify count is 0
    await expect(page.locator('text=1 selected')).not.toBeVisible();
  });

  test('should select all events', async ({ page }) => {
    // Enter selection mode
    await page.click('button:has-text("Select")');

    // Click "Select all" checkbox
    const selectAllCheckbox = await page.locator('input[type="checkbox"]').first();
    await selectAllCheckbox.check();

    // Verify all events selected message
    await expect(page.locator('text=All events selected')).toBeVisible();

    // Verify bulk actions toolbar appears
    await expect(page.locator('[data-testid="bulk-actions-toolbar"]')).toBeVisible();
  });

  test('should bulk delete events with confirmation', async ({ page }) => {
    // Enter selection mode and select events
    await page.click('button:has-text("Select")');
    const checkboxes = await page.locator('input[type="checkbox"]').all();
    await checkboxes[1]?.check();
    await checkboxes[2]?.check();

    // Verify selection count
    await expect(page.locator('text=2 selected')).toBeVisible();

    // Click Delete button in bulk actions toolbar
    await page.click('button:has-text("Delete")');

    // Verify confirmation dialog appears
    await expect(page.locator('text=Delete 2 Events?')).toBeVisible();
    await expect(page.locator('text=This action cannot be undone')).toBeVisible();

    // Click Delete button in dialog
    await page.click('button:has-text("Delete 2 Events")');

    // Verify success message
    await expect(page.locator('text=2 events deleted successfully')).toBeVisible({ timeout: 5000 });

    // Verify selection is cleared
    await expect(page.locator('text=2 selected')).not.toBeVisible();
  });

  test('should bulk reschedule events', async ({ page }) => {
    // Enter selection mode and select events
    await page.click('button:has-text("Select")');
    const checkboxes = await page.locator('input[type="checkbox"]').all();
    await checkboxes[1]?.check();
    await checkboxes[2]?.check();

    // Click Reschedule button
    await page.click('button:has-text("Reschedule")');

    // Verify reschedule dialog appears
    await expect(page.locator('text=Reschedule 2 Events')).toBeVisible();

    // Select "1 week forward"
    await page.click('[role="combobox"]');
    await page.click('text=1 week forward');

    // Click Reschedule button
    await page.click('button:has-text("Reschedule Events")');

    // Verify success message
    await expect(page.locator('text=2 events rescheduled successfully')).toBeVisible({ timeout: 5000 });
  });

  test('should bulk categorize events', async ({ page }) => {
    // Enter selection mode and select events
    await page.click('button:has-text("Select")');
    const checkboxes = await page.locator('input[type="checkbox"]').all();
    await checkboxes[1]?.check();
    await checkboxes[2]?.check();

    // Click Categorize button
    await page.click('button:has-text("Categorize")');

    // Verify categorize dialog appears
    await expect(page.locator('text=Categorize 2 Events')).toBeVisible();

    // Select "Phone Call" category
    await page.click('[role="combobox"]');
    await page.click('text=Phone Call');

    // Click Categorize button
    await page.click('button:has-text("Categorize Events")');

    // Verify success message
    await expect(page.locator('text=2 events categorized successfully')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Sales Templates Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/calendar');
    await page.waitForSelector('[data-testid="calendar-view"]', { timeout: 10000 });
  });

  test('should send follow-up email from calendar event', async ({ page }) => {
    // Click on a meeting event
    await page.click('[data-event-type="meeting"]').first();

    // Verify event modal opens
    await expect(page.locator('[data-testid="event-editor"]')).toBeVisible();

    // Click "Send Follow-up Email" button (only visible for meetings)
    await page.click('button:has-text("Send Follow-up Email")');

    // Verify email composer opens
    await expect(page.locator('text=Compose Email')).toBeVisible();

    // Verify subject is pre-filled with "Follow-up: {event title}"
    const subjectInput = await page.locator('input[name="subject"]');
    const subjectValue = await subjectInput.inputValue();
    expect(subjectValue).toContain('Follow-up:');

    // Click AI Templates button
    await page.click('button:has-text("AI Templates")');

    // Verify template selector modal opens
    await expect(page.locator('text=Select Email Template')).toBeVisible();

    // Select "Meeting Follow-up" template
    await page.click('text=Meeting Follow-up');

    // Verify personalized email is generated
    await expect(page.locator('text=Generating personalized email')).toBeVisible();

    // Wait for AI to complete
    await expect(page.locator('text=AI-personalized template applied successfully')).toBeVisible({ timeout: 10000 });

    // Verify email body is populated
    const bodyContent = await page.locator('[data-testid="email-body"]').textContent();
    expect(bodyContent).toBeTruthy();
    expect(bodyContent.length).toBeGreaterThan(50);
  });

  test('should use sales template with calendar context', async ({ page }) => {
    // Open email composer from anywhere
    await page.click('button:has-text("New Email")');

    // Click AI Templates button
    await page.click('button:has-text("AI Templates")');

    // Verify templates are categorized
    await expect(page.locator('text=Meeting Follow-up')).toBeVisible();
    await expect(page.locator('text=Initial Outreach')).toBeVisible();
    await expect(page.locator('text=Nurture Sequence')).toBeVisible();

    // Select a template
    await page.click('text=Initial Outreach');

    // Verify template preview is shown
    await expect(page.locator('[data-testid="template-preview"]')).toBeVisible();

    // Click Use Template button
    await page.click('button:has-text("Use Template")');

    // Verify AI personalization starts
    await expect(page.locator('text=Personalizing email')).toBeVisible();

    // Wait for completion
    await expect(page.locator('text=template applied successfully')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Accessibility', () => {
  test('should support keyboard navigation', async ({ page }) => {
    await page.goto('/calendar');

    // Tab to Export/Import button
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Press Enter to open modal
    await page.keyboard.press('Enter');

    // Verify modal is accessible via keyboard
    const modal = await page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();

    // Tab through modal elements
    await page.keyboard.press('Tab'); // Focus on Export tab
    await page.keyboard.press('Tab'); // Focus on Import tab
    await page.keyboard.press('Tab'); // Focus on Export All button

    // Press Escape to close modal
    await page.keyboard.press('Escape');

    // Verify modal is closed
    await expect(modal).not.toBeVisible();
  });

  test('should have proper ARIA labels', async ({ page }) => {
    await page.goto('/calendar');

    // Verify buttons have aria-labels
    const exportButton = await page.locator('button:has-text("Export/Import")');
    const ariaLabel = await exportButton.getAttribute('aria-label');
    expect(ariaLabel).toBeTruthy();
    expect(ariaLabel).toContain('Export');

    // Open modal and verify dialog role
    await exportButton.click();
    const dialog = await page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Verify dialog has accessible name
    const dialogTitle = await dialog.locator('[data-dialog-title]').textContent();
    expect(dialogTitle).toContain('Export / Import Calendar');
  });

  test('should announce actions to screen readers', async ({ page }) => {
    await page.goto('/calendar');

    // Check for screen reader announcements
    const announcement = await page.locator('[role="status"]');

    // Perform an action
    await page.click('button:has-text("Export/Import")');

    // Verify announcement is present (implementation-dependent)
    // This is a placeholder - actual implementation depends on your announcement system
  });
});
