import { describe, test, expect as vitestExpect, beforeAll, afterAll, beforeEach } from 'vitest';
import { expect as playwrightExpect } from '../fixtures/playwright-assertions';
import { setupPlaywriter, teardownPlaywriter } from '../fixtures/playwriter-setup';
import { promises as fs } from 'fs';
import path from 'path';
import type { Page } from 'playwright-core';

const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || process.env.VITE_BASE_URL || 'http://localhost:5175';

/**
 * E2E Tests for Calendar Export/Import Functionality
 *
 * Tests the complete user workflow for:
 * - Exporting calendar events to .ics files
 * - Importing events from .ics files
 * - Bulk operations (select, delete, reschedule, categorize)
 * - Sales template integration with calendar
 */

describe('Calendar Export/Import', () => {
  let page: Page;

  beforeAll(async () => {
    const setup = await setupPlaywriter();
    page = setup.page;
  });

  afterAll(async () => {
    await teardownPlaywriter();
  });

  beforeEach(async () => {
    // Navigate to calendar page
    await page.goto(`${BASE_URL}/calendar`);

    // Wait for calendar to load
    await page.waitForSelector('[data-testid="calendar-view"]', { timeout: 10000 });
  });

  test('should export all calendar events to .ics file', async () => {
    // Click Export/Import button
    await page.click('button:has-text("Export/Import")');

    // Wait for modal to open
    await playwrightExpect(page.locator('text=Export / Import Calendar')).toBeVisible();

    // Verify we're on the Export tab
    const exportButton = page.locator('button:has-text("Export")');
    const parentClass = await exportButton.locator('..').getAttribute('class');
    vitestExpect(parentClass).toMatch(/bg-\[#37bd7e\]/);

    // Verify event count is displayed
    const totalEventsText = await page.locator('text=Total Events:').textContent();
    vitestExpect(totalEventsText).toContain('Total Events:');

    // Set up download listener
    const downloadPromise = page.waitForEvent('download');

    // Click Export All button
    await page.click('button:has-text("Export All")');

    // Wait for download to complete
    const download = await downloadPromise;

    // Verify filename matches pattern: sixty-sales-calendar-YYYY-MM-DD.ics
    vitestExpect(download.suggestedFilename()).toMatch(/sixty-sales-calendar-\d{4}-\d{2}-\d{2}\.ics/);

    // Save file to temp directory
    const filePath = path.join(__dirname, 'temp', download.suggestedFilename());
    await download.saveAs(filePath);

    // Verify file exists and has content
    const fileContent = await fs.readFile(filePath, 'utf-8');
    vitestExpect(fileContent).toContain('BEGIN:VCALENDAR');
    vitestExpect(fileContent).toContain('VERSION:2.0');
    vitestExpect(fileContent).toContain('PRODID:-//Sixty Sales//Calendar//EN');
    vitestExpect(fileContent).toContain('BEGIN:VEVENT');
    vitestExpect(fileContent).toContain('END:VCALENDAR');

    // Cleanup
    await fs.unlink(filePath);

    // Verify success toast
    await playwrightExpect(page.locator('text=Exported')).toBeVisible({ timeout: 5000 });
  });

  test('should export only selected events', async () => {
    // Enter selection mode
    await page.click('button:has-text("Select")');

    // Wait for SelectableEventsList to appear
    await playwrightExpect(page.locator('[data-testid="selectable-events-list"]')).toBeVisible();

    // Select first 3 events
    const checkboxes = await page.locator('input[type="checkbox"]').all();
    await checkboxes[1]?.check(); // Skip "select all" checkbox
    await checkboxes[2]?.check();
    await checkboxes[3]?.check();

    // Verify selection count
    await playwrightExpect(page.locator('text=3 selected')).toBeVisible();

    // Open Export/Import modal
    await page.click('button:has-text("Export/Import")');

    // Verify selected count is shown
    await playwrightExpect(page.locator('text=Selected:').locator('..')).toHaveText(/3/);

    // Set up download listener
    const downloadPromise = page.waitForEvent('download');

    // Click Export Selected button
    await page.click('button:has-text("Export Selected")');

    // Wait for download
    const download = await downloadPromise;

    // Verify file was downloaded
    vitestExpect(download.suggestedFilename()).toMatch(/\.ics$/);

    // Verify only 3 events in file
    const filePath = path.join(__dirname, 'temp', download.suggestedFilename());
    await download.saveAs(filePath);
    const fileContent = await fs.readFile(filePath, 'utf-8');

    const eventCount = (fileContent.match(/BEGIN:VEVENT/g) || []).length;
    vitestExpect(eventCount).toBe(3);

    // Cleanup
    await fs.unlink(filePath);
  });

  test('should import events from .ics file with preview', async () => {
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
    const importButton = page.locator('button:has-text("Import")');
    const importParentClass = await importButton.locator('..').getAttribute('class');
    vitestExpect(importParentClass).toMatch(/bg-\[#37bd7e\]/);

    // Upload file
    const fileInput = await page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFilePath);

    // Wait for file to be processed
    await playwrightExpect(page.locator('text=Found 3 events in file')).toBeVisible({ timeout: 5000 });

    // Verify preview shows file name
    await playwrightExpect(page.locator('text=test-import.ics')).toBeVisible();

    // Verify statistics are displayed
    await playwrightExpect(page.locator('text=Total Events:')).toBeVisible();
    await playwrightExpect(page.locator('text=3').first()).toBeVisible();
    await playwrightExpect(page.locator('text=Meetings:')).toBeVisible();
    await playwrightExpect(page.locator('text=1').nth(1)).toBeVisible();
    await playwrightExpect(page.locator('text=Calls:')).toBeVisible();
    await playwrightExpect(page.locator('text=1').nth(2)).toBeVisible();

    // Verify first few events are shown in preview
    await playwrightExpect(page.locator('text=Imported Meeting')).toBeVisible();
    await playwrightExpect(page.locator('text=Imported Phone Call')).toBeVisible();
    await playwrightExpect(page.locator('text=Imported Task')).toBeVisible();

    // Click Import button
    await page.click('button:has-text("Import 3 Events")');

    // Verify success message
    await playwrightExpect(page.locator('text=Imported 3 events successfully')).toBeVisible({ timeout: 5000 });

    // Verify modal is closed
    await playwrightExpect(page.locator('text=Export / Import Calendar')).toBeHidden();

    // Cleanup
    await fs.unlink(testFilePath);
  });

  test('should validate file type and show error for non-.ics files', async () => {
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
    await playwrightExpect(page.locator('text=Please select a valid .ics calendar file')).toBeVisible({ timeout: 5000 });

    // Cleanup
    await fs.unlink(testFilePath);
  });

  test('should handle canceling import', async () => {
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
    await playwrightExpect(page.locator('text=Found 1 events in file')).toBeVisible();

    // Click Cancel button
    await page.click('button:has-text("Cancel")');

    // Verify preview is cleared
    await playwrightExpect(page.locator('text=cancel-test.ics')).toBeHidden();
    await playwrightExpect(page.locator('text=Choose File')).toBeVisible();

    // Cleanup
    await fs.unlink(testFilePath);
  });
});

describe('Bulk Operations', () => {
  beforeEach(async () => {
    await page.goto(`${BASE_URL}/calendar`);
    await page.waitForSelector('[data-testid="calendar-view"]', { timeout: 10000 });
  });

  test('should enter and exit selection mode', async () => {
    // Click Select button
    await page.click('button:has-text("Select")');

    // Verify selection mode is active
    await playwrightExpect(page.locator('button:has-text("Exit Selection")')).toBeVisible();
    await playwrightExpect(page.locator('[data-testid="selectable-events-list"]')).toBeVisible();

    // Click Exit Selection
    await page.click('button:has-text("Exit Selection")');

    // Verify normal view is restored
    await playwrightExpect(page.locator('button:has-text("Select")')).toBeVisible();
    await playwrightExpect(page.locator('[data-testid="calendar-view"]')).toBeVisible();
  });

  test('should select and deselect individual events', async () => {
    // Enter selection mode
    await page.click('button:has-text("Select")');

    // Select first event
    const checkboxes = await page.locator('input[type="checkbox"]').all();
    await checkboxes[1]?.check();

    // Verify selection count
    await playwrightExpect(page.locator('text=1 selected')).toBeVisible();

    // Deselect the event
    await checkboxes[1]?.uncheck();

    // Verify count is 0
    await playwrightExpect(page.locator('text=1 selected')).toBeHidden();
  });

  test('should select all events', async () => {
    // Enter selection mode
    await page.click('button:has-text("Select")');

    // Click "Select all" checkbox
    const selectAllCheckbox = await page.locator('input[type="checkbox"]').first();
    await selectAllCheckbox.check();

    // Verify all events selected message
    await playwrightExpect(page.locator('text=All events selected')).toBeVisible();

    // Verify bulk actions toolbar appears
    await playwrightExpect(page.locator('[data-testid="bulk-actions-toolbar"]')).toBeVisible();
  });

  test('should bulk delete events with confirmation', async () => {
    // Enter selection mode and select events
    await page.click('button:has-text("Select")');
    const checkboxes = await page.locator('input[type="checkbox"]').all();
    await checkboxes[1]?.check();
    await checkboxes[2]?.check();

    // Verify selection count
    await playwrightExpect(page.locator('text=2 selected')).toBeVisible();

    // Click Delete button in bulk actions toolbar
    await page.click('button:has-text("Delete")');

    // Verify confirmation dialog appears
    await playwrightExpect(page.locator('text=Delete 2 Events?')).toBeVisible();
    await playwrightExpect(page.locator('text=This action cannot be undone')).toBeVisible();

    // Click Delete button in dialog
    await page.click('button:has-text("Delete 2 Events")');

    // Verify success message
    await playwrightExpect(page.locator('text=2 events deleted successfully')).toBeVisible({ timeout: 5000 });

    // Verify selection is cleared
    await playwrightExpect(page.locator('text=2 selected')).toBeHidden();
  });

  test('should bulk reschedule events', async () => {
    // Enter selection mode and select events
    await page.click('button:has-text("Select")');
    const checkboxes = await page.locator('input[type="checkbox"]').all();
    await checkboxes[1]?.check();
    await checkboxes[2]?.check();

    // Click Reschedule button
    await page.click('button:has-text("Reschedule")');

    // Verify reschedule dialog appears
    await playwrightExpect(page.locator('text=Reschedule 2 Events')).toBeVisible();

    // Select "1 week forward"
    await page.click('[role="combobox"]');
    await page.click('text=1 week forward');

    // Click Reschedule button
    await page.click('button:has-text("Reschedule Events")');

    // Verify success message
    await playwrightExpect(page.locator('text=2 events rescheduled successfully')).toBeVisible({ timeout: 5000 });
  });

  test('should bulk categorize events', async () => {
    // Enter selection mode and select events
    await page.click('button:has-text("Select")');
    const checkboxes = await page.locator('input[type="checkbox"]').all();
    await checkboxes[1]?.check();
    await checkboxes[2]?.check();

    // Click Categorize button
    await page.click('button:has-text("Categorize")');

    // Verify categorize dialog appears
    await playwrightExpect(page.locator('text=Categorize 2 Events')).toBeVisible();

    // Select "Phone Call" category
    await page.click('[role="combobox"]');
    await page.click('text=Phone Call');

    // Click Categorize button
    await page.click('button:has-text("Categorize Events")');

    // Verify success message
    await playwrightExpect(page.locator('text=2 events categorized successfully')).toBeVisible({ timeout: 5000 });
  });
});

describe('Sales Templates Integration', () => {
  beforeEach(async () => {
    await page.goto(`${BASE_URL}/calendar`);
    await page.waitForSelector('[data-testid="calendar-view"]', { timeout: 10000 });
  });

  test('should send follow-up email from calendar event', async () => {
    // Click on a meeting event
    await page.click('[data-event-type="meeting"]').first();

    // Verify event modal opens
    await playwrightExpect(page.locator('[data-testid="event-editor"]')).toBeVisible();

    // Click "Send Follow-up Email" button (only visible for meetings)
    await page.click('button:has-text("Send Follow-up Email")');

    // Verify email composer opens
    await playwrightExpect(page.locator('text=Compose Email')).toBeVisible();

    // Verify subject is pre-filled with "Follow-up: {event title}"
    const subjectInput = await page.locator('input[name="subject"]');
    const subjectValue = await subjectInput.inputValue();
    vitestExpect(subjectValue).toContain('Follow-up:');

    // Click AI Templates button
    await page.click('button:has-text("AI Templates")');

    // Verify template selector modal opens
    await playwrightExpect(page.locator('text=Select Email Template')).toBeVisible();

    // Select "Meeting Follow-up" template
    await page.click('text=Meeting Follow-up');

    // Verify personalized email is generated
    await playwrightExpect(page.locator('text=Generating personalized email')).toBeVisible();

    // Wait for AI to complete
    await playwrightExpect(page.locator('text=AI-personalized template applied successfully')).toBeVisible({ timeout: 10000 });

    // Verify email body is populated
    const bodyContent = await page.locator('[data-testid="email-body"]').textContent();
    vitestExpect(bodyContent).toBeTruthy();
    vitestExpect(bodyContent.length).toBeGreaterThan(50);
  });

  test('should use sales template with calendar context', async () => {
    // Open email composer from anywhere
    await page.click('button:has-text("New Email")');

    // Click AI Templates button
    await page.click('button:has-text("AI Templates")');

    // Verify templates are categorized
    await playwrightExpect(page.locator('text=Meeting Follow-up')).toBeVisible();
    await playwrightExpect(page.locator('text=Initial Outreach')).toBeVisible();
    await playwrightExpect(page.locator('text=Nurture Sequence')).toBeVisible();

    // Select a template
    await page.click('text=Initial Outreach');

    // Verify template preview is shown
    await playwrightExpect(page.locator('[data-testid="template-preview"]')).toBeVisible();

    // Click Use Template button
    await page.click('button:has-text("Use Template")');

    // Verify AI personalization starts
    await playwrightExpect(page.locator('text=Personalizing email')).toBeVisible();

    // Wait for completion
    await playwrightExpect(page.locator('text=template applied successfully')).toBeVisible({ timeout: 10000 });
  });
});

describe('Accessibility', () => {
  test('should support keyboard navigation', async () => {
    await page.goto(`${BASE_URL}/calendar`);

    // Tab to Export/Import button
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Press Enter to open modal
    await page.keyboard.press('Enter');

    // Verify modal is accessible via keyboard
    const modal = await page.locator('[role="dialog"]');
    await playwrightExpect(modal).toBeVisible();

    // Tab through modal elements
    await page.keyboard.press('Tab'); // Focus on Export tab
    await page.keyboard.press('Tab'); // Focus on Import tab
    await page.keyboard.press('Tab'); // Focus on Export All button

    // Press Escape to close modal
    await page.keyboard.press('Escape');

    // Verify modal is closed
    await playwrightExpect(modal).toBeHidden();
  });

  test('should have proper ARIA labels', async () => {
    await page.goto(`${BASE_URL}/calendar`);

    // Verify buttons have aria-labels
    const exportButton = await page.locator('button:has-text("Export/Import")');
    const ariaLabel = await exportButton.getAttribute('aria-label');
    vitestExpect(ariaLabel).toBeTruthy();
    vitestExpect(ariaLabel).toContain('Export');

    // Open modal and verify dialog role
    await exportButton.click();
    const dialog = await page.locator('[role="dialog"]');
    await playwrightExpect(dialog).toBeVisible();

    // Verify dialog has accessible name
    const dialogTitle = await dialog.locator('[data-dialog-title]').textContent();
    vitestExpect(dialogTitle).toContain('Export / Import Calendar');
  });

  test('should announce actions to screen readers', async () => {
    await page.goto(`${BASE_URL}/calendar`);

    // Check for screen reader announcements
    const announcement = await page.locator('[role="status"]');

    // Perform an action
    await page.click('button:has-text("Export/Import")');

    // Verify announcement is present (implementation-dependent)
    // This is a placeholder - actual implementation depends on your announcement system
  });
});
