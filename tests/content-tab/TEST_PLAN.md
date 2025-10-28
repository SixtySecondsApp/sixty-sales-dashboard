# Content Tab Feature - Comprehensive Test Plan

## Executive Summary

This document outlines the complete testing strategy for the Content Tab feature, which enables AI-powered content generation from meeting transcripts. The testing approach follows industry best practices with comprehensive coverage across unit, integration, E2E, accessibility, and performance testing.

**Feature Overview**: Two-step workflow for extracting topics from meeting transcripts and generating marketing content (social posts, blog articles, video scripts, email newsletters).

**Testing Goals**:
- ✅ Ensure 85%+ code coverage across all components
- ✅ Validate complete user workflows with E2E tests
- ✅ Guarantee WCAG 2.1 AA accessibility compliance
- ✅ Verify performance benchmarks (topic extraction <5s, content generation <10s)
- ✅ Test error handling and recovery mechanisms
- ✅ Validate cache behavior and state management

---

## 1. Testing Strategy Overview

### 1.1 Testing Pyramid

```
                    E2E Tests (5%)
                  /              \
            Integration (15%)
          /                      \
    Unit Tests (80%)
```

**Distribution**:
- **Unit Tests (80%)**: Focus on individual component logic, service methods, error handling
- **Integration Tests (15%)**: Test component interactions, API mocking, state management
- **E2E Tests (5%)**: Critical user workflows, cross-browser compatibility

### 1.2 Test Types by Layer

| Layer | Test Type | Framework | Coverage Target |
|-------|-----------|-----------|-----------------|
| Service | Unit | Vitest | 90%+ |
| Components | Unit | Vitest + RTL | 85%+ |
| Workflows | Integration | Vitest + RTL | 80%+ |
| User Scenarios | E2E | Playwright | Critical paths |
| Accessibility | E2E | Playwright + axe | WCAG AA |
| Performance | E2E | Playwright | Benchmarks |

---

## 2. Unit Testing Strategy

### 2.1 contentService.ts Tests

**File**: `/src/lib/services/__tests__/contentService.test.ts`

**Coverage Target**: 90%+

**Test Categories**:

#### Authentication & Setup
- ✅ Constructor initializes URLs correctly
- ✅ getAuthToken() retrieves valid JWT
- ✅ getAuthToken() throws error when not authenticated (401)

#### extractTopics() Method
- ✅ Valid meeting ID returns topics array
- ✅ Cached topics return without API call (metadata.cached = true)
- ✅ Force refresh bypasses cache
- ✅ Invalid meeting ID throws 400 error
- ✅ Missing transcript throws 422 error
- ✅ Network timeout throws 408 error
- ✅ Rate limit returns 429 with retry-after
- ✅ Validates response structure
- ✅ Empty string meeting ID throws error

#### generateContent() Method
- ✅ Valid params return generated content
- ✅ Invalid meeting ID throws 400 error
- ✅ Missing content_type throws 400 error
- ✅ Invalid content_type throws 400 error
- ✅ Empty topic indices throws 400 error
- ✅ Negative topic indices throws 400 error
- ✅ Non-numeric topic indices throws 400 error
- ✅ Regenerate flag creates new version
- ✅ Network timeout throws 408 error
- ✅ Validates response structure

#### Cache Methods
- ✅ getCachedTopics() returns empty array when no cache
- ✅ getCachedTopics() returns topics when cached
- ✅ getCachedTopics() handles invalid meeting ID gracefully
- ✅ getCachedContent() returns null when not found
- ✅ getCachedContent() returns content when exists
- ✅ getCachedContent() handles RLS correctly
- ✅ getCachedContent() validates content_type

#### Cost Calculation
- ✅ calculateCosts() returns correct totals
- ✅ calculateCosts() breaks down by operation type
- ✅ calculateCosts() returns zero for no operations
- ✅ formatCost() formats cents to dollars correctly

#### Utility Methods
- ✅ hasTranscript() returns true when transcript exists
- ✅ hasTranscript() returns false when transcript missing
- ✅ mapErrorToUserMessage() maps common errors
- ✅ fetchWithTimeout() aborts on timeout

### 2.2 MeetingContent Component Tests

**File**: `/src/components/meetings/__tests__/MeetingContent.test.tsx`

**Coverage Target**: 85%+

**Test Categories**:

#### Rendering
- ✅ Renders empty state when no transcript
- ✅ Shows TopicsList initially when transcript exists
- ✅ Displays transcript unavailable message with icon
- ✅ Shows timing estimate (5-10 minutes)

#### Workflow Navigation
- ✅ Switches to ContentGenerator after topic selection
- ✅ handleTopicsSelected() updates state correctly
- ✅ handleBack() returns to extract step
- ✅ State persists during navigation

#### Props Passing
- ✅ meetingId passed to TopicsList
- ✅ shareUrl passed to TopicsList
- ✅ onTopicsSelected callback works
- ✅ selectedTopics passed to ContentGenerator
- ✅ onBack callback works

#### Error Boundary
- ✅ Catches component errors
- ✅ Displays error message
- ✅ "Try again" button resets error state
- ✅ Logs errors to console

### 2.3 TopicsList Component Tests

**File**: `/src/components/meetings/__tests__/TopicsList.test.tsx`

**Coverage Target**: 85%+

**Test Categories**:

#### Initial State
- ✅ Shows "Extract Topics" button initially
- ✅ Displays header with Sparkles icon
- ✅ Shows empty state message

#### Topic Extraction
- ✅ "Extract Topics" button triggers API call
- ✅ Shows loading skeletons during extraction (6 cards)
- ✅ Skeleton cards have proper structure
- ✅ Loading button shows "Extracting..." text
- ✅ Loading button disabled during extraction

#### Topic Display
- ✅ Renders topic cards in grid (1/2/3 columns)
- ✅ Each card shows title, description, timestamp
- ✅ Timestamp formatted as MM:SS or HH:MM:SS
- ✅ Timestamp badge links to Fathom URL
- ✅ External link icon appears on timestamps
- ✅ Shows selection count (X of Y selected)

#### Topic Selection
- ✅ Checkbox toggles on click
- ✅ Card border changes when selected
- ✅ Multiple topics can be selected
- ✅ "Select All" button selects all topics
- ✅ "Select All" disabled when all selected
- ✅ "Deselect All" clears all selections
- ✅ "Deselect All" disabled when none selected
- ✅ Keyboard navigation works (Enter/Space)
- ✅ ARIA attributes set correctly

#### Continue Button
- ✅ "Continue" button appears when topics selected
- ✅ "Continue" button disabled when none selected
- ✅ Shows count of selected topics in message
- ✅ Clicking "Continue" calls onTopicsSelected
- ✅ Passes correct indices and topics

#### Re-extraction
- ✅ "Re-extract" button appears after extraction
- ✅ "Re-extract" triggers new API call
- ✅ Previous selections cleared on re-extract

#### Error Handling
- ✅ Network error shows error alert
- ✅ 422 error shows transcript message
- ✅ "Try Again" button appears on error
- ✅ ContentServiceError message displayed
- ✅ Generic error shows fallback message

### 2.4 ContentGenerator Component Tests

**File**: `/src/components/meetings/__tests__/ContentGenerator.test.tsx`

**Coverage Target**: 85%+

**Test Categories**:

#### Initial Rendering
- ✅ Shows "Back to Topics" button
- ✅ Displays selected topics summary
- ✅ Selected topics rendered as badges
- ✅ Shows content type selector grid (1/2/4 columns)

#### Content Type Selection
- ✅ All 4 content types render correctly
- ✅ Icons display for each type
- ✅ Word count shown for each type
- ✅ Description shown for each type
- ✅ Clicking type updates selected state
- ✅ Selected type has border highlight
- ✅ ARIA pressed attribute updates
- ✅ Only one type can be selected at a time

#### Content Generation
- ✅ "Generate" button disabled when no type selected
- ✅ "Generate" button enabled when type selected
- ✅ Clicking "Generate" triggers API call
- ✅ Shows loading state during generation
- ✅ Loading button shows "Generating..." text
- ✅ Success toast appears on completion

#### Generated Content Display
- ✅ Content card renders after generation
- ✅ Title displayed correctly
- ✅ Content type badge shown
- ✅ Version badge shown
- ✅ Markdown content rendered
- ✅ Headings (h1, h2, h3) styled correctly
- ✅ Bold and italic text formatted
- ✅ Links clickable with proper styling
- ✅ Bullet points rendered as list items
- ✅ Inline Fathom links open new tab

#### Copy Functionality
- ✅ Copy button copies content to clipboard
- ✅ Success toast appears on copy
- ✅ Button shows "Copied!" temporarily
- ✅ Check icon appears when copied
- ✅ Button reverts after 2 seconds
- ✅ Error toast on clipboard failure

#### Download Functionality
- ✅ Download button triggers file download
- ✅ File has correct .md extension
- ✅ Filename based on content title
- ✅ Success toast appears on download
- ✅ Blob created with markdown content

#### Regenerate Functionality
- ✅ Regenerate button calls API with regenerate=true
- ✅ Version number increments
- ✅ Previous content replaced
- ✅ Loading state during regeneration

#### Back Navigation
- ✅ "Back to Topics" calls onBack callback
- ✅ State preserved during navigation

#### Error Handling
- ✅ ContentServiceError displayed in alert
- ✅ Generic error shows fallback message
- ✅ Error toast on generation failure
- ✅ Retry possible after error

---

## 3. Integration Testing Strategy

### 3.1 Full Workflow Integration Test

**File**: `/tests/integration/contentTab.integration.test.tsx`

**Coverage Target**: 80%+

**Test Scenarios**:

#### Scenario 1: Complete Happy Path
```
User Flow:
1. Navigate to meeting with transcript
2. Click Content tab
3. Click "Extract Topics"
4. Wait for topics to load (verify 6+ topics)
5. Select 3 topics via checkboxes
6. Click "Continue to Generate"
7. Verify ContentGenerator displays
8. Select "Blog Article" content type
9. Click "Generate Content"
10. Wait for content to appear
11. Verify markdown rendering
12. Click "Copy" button
13. Verify success toast
14. Verify clipboard contains content
```

**Assertions**:
- ✅ Each step completes successfully
- ✅ State transitions correctly
- ✅ Data flows between components
- ✅ No console errors
- ✅ Loading states appear appropriately

#### Scenario 2: Cache Behavior
```
Test Flow:
1. First extraction fetches from API (metadata.cached = false)
2. Second extraction uses cache (metadata.cached = true)
3. Force refresh bypasses cache
4. Generated content cached by type
5. Regenerate creates new version
```

**Assertions**:
- ✅ Cache metadata correct
- ✅ API called only when necessary
- ✅ Cache respects RLS (user-specific)
- ✅ Version numbers increment

#### Scenario 3: Error Recovery
```
Error Scenarios:
1. Network error → Shows retry button → Retry succeeds
2. 422 error (no transcript) → Shows helpful message
3. 429 error (rate limit) → Shows wait time
4. 503 error (AI service down) → Suggests retry
```

**Assertions**:
- ✅ Error messages user-friendly
- ✅ Retry mechanism works
- ✅ State recovers correctly
- ✅ No stale error states

#### Scenario 4: State Management
```
State Tests:
1. Topic selection persists during navigation
2. Back button restores previous state
3. Component unmount cleans up properly
4. Multiple navigations maintain consistency
```

**Assertions**:
- ✅ State isolation correct
- ✅ No memory leaks
- ✅ State resets on meeting change

---

## 4. E2E Testing Strategy (Playwright)

### 4.1 User Scenario Tests

**File**: `/tests/e2e/contentTab.spec.ts`

**Browsers**: Chromium (primary), Firefox, Safari

#### Test 1: Complete Content Generation Flow
```typescript
test('user can generate marketing content from meeting', async ({ page }) => {
  // Setup: Login and navigate
  await loginAsTestUser(page);
  await page.goto('/meetings/test-meeting-id');

  // Step 1: Navigate to Content tab
  await page.click('[data-testid="content-tab"]');
  await expect(page.locator('text=Extract Content Topics')).toBeVisible();

  // Step 2: Extract topics
  await page.click('button:has-text("Extract Topics")');
  await expect(page.locator('[data-testid="topic-skeleton"]').first()).toBeVisible();
  await expect(page.locator('[data-testid="topic-card"]').first()).toBeVisible({ timeout: 10000 });

  // Step 3: Select topics
  const topicCards = page.locator('[data-testid="topic-card"]');
  await topicCards.nth(0).click();
  await topicCards.nth(1).click();
  await topicCards.nth(2).click();

  // Verify selection count
  await expect(page.locator('text=3 of')).toBeVisible();

  // Step 4: Continue to generate
  await page.click('button:has-text("Continue to Generate")');
  await expect(page.locator('text=Selected Topics')).toBeVisible();

  // Step 5: Select content type
  await page.click('[data-testid="content-type-social"]');

  // Step 6: Generate content
  await page.click('button:has-text("Generate Content")');
  await expect(page.locator('text=Generating...')).toBeVisible();
  await expect(page.locator('[data-testid="generated-content"]')).toBeVisible({ timeout: 15000 });

  // Step 7: Verify content displayed
  await expect(page.locator('h3').filter({ hasText: /.+/ }).first()).toBeVisible();

  // Step 8: Copy to clipboard
  await page.click('button:has-text("Copy")');
  await expect(page.locator('text=Copied!')).toBeVisible();

  // Verify success toast
  await expect(page.locator('[data-sonner-toast]')).toContainText('Copied to clipboard');
});
```

#### Test 2: Mobile Responsive
```typescript
test('content tab works on mobile devices', async ({ page }) => {
  // Set mobile viewport (iPhone 13)
  await page.setViewportSize({ width: 390, height: 844 });

  // Navigate
  await loginAsTestUser(page);
  await page.goto('/meetings/test-meeting-id');

  // Verify tabs scrollable
  await page.click('[data-testid="content-tab"]');

  // Extract topics
  await page.click('button:has-text("Extract Topics")');
  await expect(page.locator('[data-testid="topic-card"]').first()).toBeVisible({ timeout: 10000 });

  // Verify single-column grid on mobile
  const topicCards = page.locator('[data-testid="topic-card"]');
  const firstCardBox = await topicCards.first().boundingBox();
  const secondCardBox = await topicCards.nth(1).boundingBox();

  // Cards should stack vertically (same x position)
  expect(firstCardBox?.x).toBe(secondCardBox?.x);

  // Select topics (larger touch targets)
  await topicCards.first().tap();
  await topicCards.nth(1).tap();

  // Continue and generate
  await page.click('button:has-text("Continue to Generate")');
  await page.click('[data-testid="content-type-blog"]');
  await page.click('button:has-text("Generate Content")');

  // Verify content readable on mobile
  await expect(page.locator('[data-testid="generated-content"]')).toBeVisible({ timeout: 15000 });

  // Test copy on mobile
  await page.click('button:has-text("Copy")');
  await expect(page.locator('text=Copied!')).toBeVisible();
});
```

#### Test 3: Error Handling
```typescript
test('shows appropriate errors and recovery options', async ({ page }) => {
  // Setup: Mock API to return errors
  await page.route('**/extract-content-topics', route => {
    route.fulfill({
      status: 422,
      body: JSON.stringify({ error: "This meeting doesn't have a transcript yet" })
    });
  });

  await loginAsTestUser(page);
  await page.goto('/meetings/test-meeting-id');
  await page.click('[data-testid="content-tab"]');

  // Verify empty state shows transcript message
  await expect(page.locator('text=Transcript Not Available')).toBeVisible();

  // Test rate limit error
  await page.route('**/extract-content-topics', route => {
    route.fulfill({
      status: 429,
      headers: { 'Retry-After': '60' },
      body: JSON.stringify({ error: 'Rate limit exceeded' })
    });
  });

  // Remove mock to allow extraction
  await page.unroute('**/extract-content-topics');

  // Navigate to meeting with transcript
  await page.goto('/meetings/test-meeting-with-transcript');
  await page.click('[data-testid="content-tab"]');
  await page.click('button:has-text("Extract Topics")');

  // Apply rate limit mock
  await page.route('**/extract-content-topics', route => {
    route.fulfill({
      status: 429,
      body: JSON.stringify({ error: 'Rate limit exceeded' })
    });
  });

  // Try to extract again
  await page.click('button:has-text("Re-extract")');

  // Verify rate limit message
  await expect(page.locator('text=Rate limit exceeded')).toBeVisible();
  await expect(page.locator('button:has-text("Try Again")')).toBeVisible();
});
```

#### Test 4: Timestamp Links
```typescript
test('timestamp links open Fathom video', async ({ page, context }) => {
  await loginAsTestUser(page);
  await page.goto('/meetings/test-meeting-id');
  await page.click('[data-testid="content-tab"]');

  // Extract topics
  await page.click('button:has-text("Extract Topics")');
  await expect(page.locator('[data-testid="topic-card"]').first()).toBeVisible({ timeout: 10000 });

  // Click timestamp badge
  const [newPage] = await Promise.all([
    context.waitForEvent('page'),
    page.locator('[data-testid="timestamp-badge"]').first().click()
  ]);

  // Verify new tab opened with Fathom URL
  await newPage.waitForLoadState();
  expect(newPage.url()).toContain('fathom.video');
  expect(newPage.url()).toContain('t='); // Timestamp parameter

  await newPage.close();

  // Generate content with inline timestamps
  // ... (content generation steps)

  // Click inline timestamp link in generated content
  const inlineLink = page.locator('[data-testid="generated-content"] a[href*="fathom"]').first();
  const [newPage2] = await Promise.all([
    context.waitForEvent('page'),
    inlineLink.click()
  ]);

  // Verify timestamp in URL
  expect(newPage2.url()).toContain('t=');
  await newPage2.close();
});
```

### 4.2 Cross-Browser Testing

**Browsers to Test**:
- ✅ Chromium (Desktop Chrome) - Primary
- ✅ Firefox - Secondary
- ✅ WebKit (Safari) - Mac only

**Key Differences to Verify**:
- Clipboard API support
- File download behavior
- Markdown rendering
- Flexbox/Grid layout

---

## 5. Accessibility Testing Strategy

### 5.1 Accessibility E2E Tests

**File**: `/tests/e2e/contentTab.a11y.spec.ts`

**Framework**: Playwright + @axe-core/playwright

**WCAG 2.1 Level AA Requirements**:

#### Test 1: Keyboard Navigation
```typescript
test('keyboard navigation works throughout workflow', async ({ page }) => {
  await loginAsTestUser(page);
  await page.goto('/meetings/test-meeting-id');

  // Tab to Content tab
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');

  // Tab to Extract Topics button
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');

  // Wait for topics
  await expect(page.locator('[data-testid="topic-card"]').first()).toBeVisible({ timeout: 10000 });

  // Tab through topic cards
  await page.keyboard.press('Tab');
  await expect(page.locator('[data-testid="topic-card"]').first()).toBeFocused();

  // Select topic with keyboard
  await page.keyboard.press('Space');
  await expect(page.locator('[data-testid="topic-card"]').first()).toHaveAttribute('aria-pressed', 'true');

  // Continue with Enter key
  await page.keyboard.press('Tab'); // Select All
  await page.keyboard.press('Tab'); // Deselect All
  await page.keyboard.press('Tab'); // Re-extract
  // ... navigate to Continue button
  await page.keyboard.press('Enter');

  // Verify focus moved to content generator
  await expect(page.locator('button:has-text("Back to Topics")')).toBeVisible();
});
```

#### Test 2: Focus Indicators
```typescript
test('focus indicators visible on all interactive elements', async ({ page }) => {
  await loginAsTestUser(page);
  await page.goto('/meetings/test-meeting-id');
  await page.click('[data-testid="content-tab"]');
  await page.click('button:has-text("Extract Topics")');
  await expect(page.locator('[data-testid="topic-card"]').first()).toBeVisible({ timeout: 10000 });

  // Test focus ring on topic card
  const topicCard = page.locator('[data-testid="topic-card"]').first();
  await topicCard.focus();

  // Verify focus visible (outline or ring-2)
  const styles = await topicCard.evaluate((el) => {
    const computed = window.getComputedStyle(el);
    return {
      outline: computed.outline,
      outlineWidth: computed.outlineWidth,
      boxShadow: computed.boxShadow
    };
  });

  expect(
    styles.outlineWidth !== '0px' || styles.boxShadow.includes('ring')
  ).toBeTruthy();
});
```

#### Test 3: ARIA Labels and Roles
```typescript
test('ARIA labels present and descriptive', async ({ page }) => {
  await loginAsTestUser(page);
  await page.goto('/meetings/test-meeting-id');
  await page.click('[data-testid="content-tab"]');
  await page.click('button:has-text("Extract Topics")');
  await expect(page.locator('[data-testid="topic-card"]').first()).toBeVisible({ timeout: 10000 });

  // Check topic card ARIA
  const topicCard = page.locator('[data-testid="topic-card"]').first();
  await expect(topicCard).toHaveAttribute('role', 'button');
  await expect(topicCard).toHaveAttribute('aria-pressed');

  const ariaLabel = await topicCard.getAttribute('aria-label');
  expect(ariaLabel).toMatch(/^(Select|Deselect) topic:/);

  // Check content type buttons
  await page.click('button:has-text("Continue to Generate")');
  const socialButton = page.locator('[data-testid="content-type-social"]');
  await expect(socialButton).toHaveAttribute('aria-pressed');

  const socialLabel = await socialButton.getAttribute('aria-label');
  expect(socialLabel).toContain('Social Posts');
});
```

#### Test 4: Screen Reader Announcements
```typescript
test('state changes announced to screen readers', async ({ page }) => {
  await loginAsTestUser(page);
  await page.goto('/meetings/test-meeting-id');
  await page.click('[data-testid="content-tab"]');

  // Check for aria-live regions
  const liveRegion = page.locator('[aria-live="polite"]').or(page.locator('[aria-live="assertive"]'));
  await expect(liveRegion).toHaveCount({ greaterThan: 0 });

  // Extract topics
  await page.click('button:has-text("Extract Topics")');

  // Loading state should be announced
  await expect(page.locator('button:has-text("Extracting...")')).toBeVisible();

  // Success state announced (via toast with role="status")
  await expect(page.locator('[data-testid="topic-card"]').first()).toBeVisible({ timeout: 10000 });
});
```

#### Test 5: Color Contrast (WCAG AA 4.5:1)
```typescript
test('color contrast meets WCAG AA standards', async ({ page }) => {
  await loginAsTestUser(page);
  await page.goto('/meetings/test-meeting-id');
  await page.click('[data-testid="content-tab"]');

  // Run axe accessibility scan
  const { injectAxe, checkA11y } = await import('@axe-core/playwright');
  await injectAxe(page);

  await checkA11y(page, null, {
    detailedReport: true,
    detailedReportOptions: {
      html: true
    },
    rules: {
      'color-contrast': { enabled: true }
    }
  });

  // Manually check key elements
  const button = page.locator('button:has-text("Extract Topics")');
  const { backgroundColor, color } = await button.evaluate((el) => {
    const computed = window.getComputedStyle(el);
    return {
      backgroundColor: computed.backgroundColor,
      color: computed.color
    };
  });

  // Calculate contrast ratio (helper function needed)
  // Minimum 4.5:1 for normal text, 3:1 for large text
});
```

#### Test 6: Interactive Element Size
```typescript
test('interactive elements meet minimum size (44x44px)', async ({ page }) => {
  await loginAsTestUser(page);
  await page.goto('/meetings/test-meeting-id');
  await page.click('[data-testid="content-tab"]');
  await page.click('button:has-text("Extract Topics")');
  await expect(page.locator('[data-testid="topic-card"]').first()).toBeVisible({ timeout: 10000 });

  // Check topic card checkbox size
  const checkbox = page.locator('[data-testid="topic-card"]').first().locator('div[role="checkbox"]');
  const box = await checkbox.boundingBox();

  expect(box?.width).toBeGreaterThanOrEqual(44);
  expect(box?.height).toBeGreaterThanOrEqual(44);

  // Check buttons
  const continueButton = page.locator('button:has-text("Continue to Generate")');
  const buttonBox = await continueButton.boundingBox();

  expect(buttonBox?.height).toBeGreaterThanOrEqual(44);
});
```

---

## 6. Performance Testing Strategy

### 6.1 Performance Benchmarks

**File**: `/tests/e2e/contentTab.performance.spec.ts`

**Metrics to Track**:

| Operation | Target | Measurement |
|-----------|--------|-------------|
| Component Mount | <100ms | React profiler |
| Topic Extraction | <5s | API response time |
| Content Generation | <10s | API response time |
| Topic Selection | <50ms | Click to state update |
| Markdown Render | <200ms | Content display |
| Copy to Clipboard | <50ms | Copy completion |

#### Test 1: Component Mount Performance
```typescript
test('component mounts quickly', async ({ page }) => {
  await loginAsTestUser(page);

  // Measure navigation to Content tab
  const startTime = Date.now();
  await page.goto('/meetings/test-meeting-id');
  await page.click('[data-testid="content-tab"]');
  await expect(page.locator('text=Extract Content Topics')).toBeVisible();
  const endTime = Date.now();

  const mountTime = endTime - startTime;
  expect(mountTime).toBeLessThan(100);

  console.log(`Component mount time: ${mountTime}ms`);
});
```

#### Test 2: Topic Extraction Performance
```typescript
test('topic extraction completes within 5 seconds', async ({ page }) => {
  await loginAsTestUser(page);
  await page.goto('/meetings/test-meeting-id');
  await page.click('[data-testid="content-tab"]');

  // Measure extraction time
  const startTime = Date.now();
  await page.click('button:has-text("Extract Topics")');
  await expect(page.locator('[data-testid="topic-card"]').first()).toBeVisible({ timeout: 10000 });
  const endTime = Date.now();

  const extractionTime = endTime - startTime;
  expect(extractionTime).toBeLessThan(5000);

  console.log(`Topic extraction time: ${extractionTime}ms`);
});
```

#### Test 3: Content Generation Performance
```typescript
test('content generation completes within 10 seconds', async ({ page }) => {
  await loginAsTestUser(page);
  await page.goto('/meetings/test-meeting-id');
  await page.click('[data-testid="content-tab"]');

  // Extract and select topics
  await page.click('button:has-text("Extract Topics")');
  await expect(page.locator('[data-testid="topic-card"]').first()).toBeVisible({ timeout: 10000 });
  await page.locator('[data-testid="topic-card"]').first().click();
  await page.click('button:has-text("Continue to Generate")');
  await page.click('[data-testid="content-type-social"]');

  // Measure generation time
  const startTime = Date.now();
  await page.click('button:has-text("Generate Content")');
  await expect(page.locator('[data-testid="generated-content"]')).toBeVisible({ timeout: 15000 });
  const endTime = Date.now();

  const generationTime = endTime - startTime;
  expect(generationTime).toBeLessThan(10000);

  console.log(`Content generation time: ${generationTime}ms`);
});
```

#### Test 4: Re-render Performance
```typescript
test('state changes do not cause excessive re-renders', async ({ page }) => {
  await loginAsTestUser(page);
  await page.goto('/meetings/test-meeting-id');
  await page.click('[data-testid="content-tab"]');

  // Install React DevTools hook to track renders
  await page.addInitScript(() => {
    window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
      renderers: new Map(),
      onCommitFiberRoot: () => {},
      onCommitFiberUnmount: () => {}
    };
  });

  // Extract topics
  await page.click('button:has-text("Extract Topics")');
  await expect(page.locator('[data-testid="topic-card"]').first()).toBeVisible({ timeout: 10000 });

  // Track renders during selection
  let renderCount = 0;
  page.on('console', msg => {
    if (msg.text().includes('render')) {
      renderCount++;
    }
  });

  // Select multiple topics
  for (let i = 0; i < 3; i++) {
    await page.locator('[data-testid="topic-card"]').nth(i).click();
  }

  // Verify reasonable render count (not more than 3-4 renders per selection)
  expect(renderCount).toBeLessThan(15); // 3 selections × 4 max renders

  console.log(`Total renders: ${renderCount}`);
});
```

#### Test 5: Memory Usage
```typescript
test('no memory leaks on component unmount', async ({ page, context }) => {
  await loginAsTestUser(page);

  // Create CDP session for memory profiling
  const client = await context.newCDPSession(page);
  await client.send('Performance.enable');

  // Navigate and mount component
  await page.goto('/meetings/test-meeting-id');
  await page.click('[data-testid="content-tab"]');

  // Take initial heap snapshot
  const beforeMetrics = await client.send('Performance.getMetrics');
  const beforeHeap = beforeMetrics.metrics.find(m => m.name === 'JSHeapUsedSize')?.value || 0;

  // Perform operations
  await page.click('button:has-text("Extract Topics")');
  await expect(page.locator('[data-testid="topic-card"]').first()).toBeVisible({ timeout: 10000 });

  // Navigate away (unmount component)
  await page.click('[data-testid="transcript-tab"]');

  // Force garbage collection if available
  await client.send('HeapProfiler.collectGarbage');

  // Take final heap snapshot
  const afterMetrics = await client.send('Performance.getMetrics');
  const afterHeap = afterMetrics.metrics.find(m => m.name === 'JSHeapUsedSize')?.value || 0;

  // Verify heap size didn't grow significantly (allow 10% tolerance)
  const heapGrowth = afterHeap - beforeHeap;
  const growthPercent = (heapGrowth / beforeHeap) * 100;

  expect(growthPercent).toBeLessThan(10);

  console.log(`Heap growth: ${(heapGrowth / 1024 / 1024).toFixed(2)} MB (${growthPercent.toFixed(2)}%)`);
});
```

---

## 7. Test Data Management

### 7.1 Test Fixtures

**File**: `/tests/fixtures/contentTab.fixtures.ts`

```typescript
export const mockTopics: Topic[] = [
  {
    title: "Product Launch Strategy",
    description: "Discussion about Q1 2025 product launch timeline and marketing approach",
    timestamp_seconds: 120,
    fathom_url: "https://fathom.video/share/test-meeting?t=120"
  },
  {
    title: "Budget Allocation",
    description: "Review of marketing budget allocation across channels",
    timestamp_seconds: 340,
    fathom_url: "https://fathom.video/share/test-meeting?t=340"
  },
  // ... more fixtures
];

export const mockGeneratedContent: GeneratedContent = {
  id: "content-123",
  title: "Product Launch Social Campaign",
  content: "# Product Launch Announcement\n\n**Exciting news!** We're launching...",
  content_type: "social",
  version: 1
};

export const mockMeeting = {
  id: "test-meeting-id",
  title: "Q1 Planning Meeting",
  transcript_text: "This is a test transcript...",
  share_url: "https://fathom.video/share/test-meeting"
};
```

### 7.2 API Mocking

**Framework**: MSW (Mock Service Worker)

**File**: `/tests/mocks/contentApiHandlers.ts`

```typescript
import { rest } from 'msw';

export const contentApiHandlers = [
  // Extract topics - success
  rest.post('*/extract-content-topics', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        success: true,
        topics: mockTopics,
        metadata: {
          model_used: "gpt-4-turbo",
          tokens_used: 1500,
          cost_cents: 15,
          cached: false
        }
      })
    );
  }),

  // Generate content - success
  rest.post('*/generate-marketing-content', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        success: true,
        content: mockGeneratedContent,
        metadata: {
          model_used: "gpt-4-turbo",
          tokens_used: 2500,
          cost_cents: 25,
          cached: false,
          topics_used: 3
        }
      })
    );
  }),

  // Error scenarios
  rest.post('*/extract-content-topics-error', (req, res, ctx) => {
    return res(
      ctx.status(422),
      ctx.json({ error: "This meeting doesn't have a transcript yet" })
    );
  }),
];
```

---

## 8. Test Coverage Configuration

### 8.1 Coverage Targets

| Layer | Target | Current | Status |
|-------|--------|---------|--------|
| contentService.ts | 90% | TBD | 🟡 |
| MeetingContent.tsx | 85% | TBD | 🟡 |
| TopicsList.tsx | 85% | TBD | 🟡 |
| ContentGenerator.tsx | 85% | TBD | 🟡 |
| Overall | 85% | TBD | 🟡 |

### 8.2 Coverage Reporting

**Command**: `npm run test:coverage`

**Report Formats**:
- HTML: `/coverage/index.html`
- JSON: `/coverage/coverage-final.json`
- Text: Console output

**CI/CD Integration**:
- Fail build if coverage drops below 80%
- Post coverage report to PR comments
- Track coverage trends over time

---

## 9. Test Execution Strategy

### 9.1 Local Development

```bash
# Run all unit tests
npm run test

# Run unit tests in watch mode
npm run test:watch

# Run specific test file
npm run test -- contentService.test.ts

# Run integration tests
npm run test:integration

# Run E2E tests
npm run test:e2e

# Run accessibility tests
npm run test:a11y

# Run performance tests
npm run test:perf

# Run all tests with coverage
npm run test:coverage
```

### 9.2 CI/CD Pipeline

**GitHub Actions Workflow**:

```yaml
name: Content Tab Tests

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run test:coverage
      - uses: codecov/codecov-action@v3

  integration-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run test:integration

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/

  accessibility-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run test:a11y
```

---

## 10. Maintenance and Evolution

### 10.1 Test Maintenance Schedule

| Activity | Frequency | Owner |
|----------|-----------|-------|
| Review failing tests | Daily | QA Team |
| Update test fixtures | Weekly | Dev Team |
| Refactor flaky tests | Weekly | QA Team |
| Update accessibility rules | Monthly | QA Lead |
| Performance baseline review | Monthly | Performance Team |
| Test coverage audit | Quarterly | Tech Lead |

### 10.2 Adding New Tests

**Checklist for New Features**:
- ✅ Unit tests for new service methods
- ✅ Component tests for new UI elements
- ✅ Integration test for workflow changes
- ✅ E2E test for critical user paths
- ✅ Accessibility audit with axe
- ✅ Performance benchmark if applicable
- ✅ Update test plan documentation

---

## 11. Known Issues and Limitations

### 11.1 Current Limitations

1. **Clipboard API**: Testing clipboard functionality requires browser permissions and may fail in headless mode
   - **Workaround**: Mock navigator.clipboard in unit tests

2. **AI Response Times**: Content generation can take 5-15 seconds depending on AI service load
   - **Workaround**: Use generous timeouts (15s+) in E2E tests

3. **Rate Limiting**: Frequent test runs may hit API rate limits
   - **Workaround**: Implement exponential backoff in tests

4. **Fathom Video Links**: External links cannot be fully tested without Fathom credentials
   - **Workaround**: Verify URL structure only

### 11.2 Flaky Test Prevention

**Strategies**:
- ✅ Use `waitForSelector` instead of `sleep`
- ✅ Add explicit waits for network responses
- ✅ Implement retry logic for intermittent failures
- ✅ Mock external dependencies consistently
- ✅ Clean up state between tests

---

## 12. Success Metrics

### 12.1 Quality Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Code Coverage | >85% | Vitest coverage report |
| Test Pass Rate | >98% | CI/CD pipeline |
| Flakiness Rate | <1% | Test retry analysis |
| Bug Escape Rate | <5% | Production bugs from this feature |
| E2E Test Duration | <5 min | Playwright test report |
| Accessibility Score | 100% | axe-core scan |

### 12.2 Acceptance Criteria

**Definition of Done**:
- ✅ All unit tests passing (85%+ coverage)
- ✅ All integration tests passing
- ✅ All E2E tests passing on Chromium
- ✅ Zero critical accessibility violations
- ✅ Performance benchmarks met
- ✅ Code review approved
- ✅ Test documentation complete

---

## 13. Resources and References

### 13.1 Documentation

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Playwright Documentation](https://playwright.dev/)
- [axe-core Accessibility](https://github.com/dequelabs/axe-core)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)

### 13.2 Internal Resources

- `/docs/TESTING.md` - General testing guidelines
- `/docs/ACCESSIBILITY.md` - Accessibility standards
- `/docs/PERFORMANCE.md` - Performance budgets
- `/tests/README.md` - Test suite overview

---

**Document Version**: 1.0
**Last Updated**: 2025-01-28
**Owner**: QA Team
**Reviewers**: Engineering Team, Product Team
