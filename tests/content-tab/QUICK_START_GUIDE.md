# Content Tab Test Suite - Quick Start Guide

## 🚀 Get Started in 5 Minutes

This guide will help you quickly implement and run the Content Tab test suite.

---

## Step 1: Install Dependencies (1 minute)

```bash
# Core testing dependencies (if not already installed)
npm install --save-dev \
  vitest \
  @testing-library/react \
  @testing-library/user-event \
  @testing-library/jest-dom \
  @playwright/test \
  @axe-core/playwright \
  msw \
  happy-dom

# Verify installation
npx vitest --version
npx playwright --version
```

---

## Step 2: Run Existing Tests (1 minute)

```bash
# Run the contentService tests (already implemented)
npm run test -- contentService.test.ts

# Expected output:
# ✓ ContentService (70 tests)
#   ✓ constructor (3 tests)
#   ✓ extractTopics (14 tests)
#   ✓ generateContent (13 tests)
#   ... and more
#
# Test Coverage: 90%+ ✅
```

**If tests pass**: You're ready to implement more tests!

**If tests fail**: Check that:
- Supabase environment variables are set
- Mock implementations are correct
- Dependencies are properly installed

---

## Step 3: Implement Component Tests (30 minutes)

### Option A: Copy Templates from COMPLETE_TEST_SUITE.md

1. Open `/tests/content-tab/COMPLETE_TEST_SUITE.md`
2. Copy test file templates
3. Create files in `/tests/unit/content-tab/`
4. Run tests: `npm run test -- MeetingContent.test.tsx`

### Option B: Create Tests from Scratch Using Patterns

Use the **contentService.test.ts** as your reference pattern:

```typescript
// Template structure for component tests
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

describe('YourComponent', () => {
  // Setup
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Test categories
  describe('rendering', () => {
    it('renders correctly', () => {
      render(<YourComponent />);
      expect(screen.getByText('Expected Text')).toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('handles user interaction', async () => {
      const user = userEvent.setup();
      render(<YourComponent />);

      await user.click(screen.getByRole('button'));

      expect(/* assertion */);
    });
  });

  describe('error handling', () => {
    it('displays error message', () => {
      // Test error scenarios
    });
  });
});
```

---

## Step 4: Run Integration Tests (10 minutes)

### Create MSW Handlers

```typescript
// tests/mocks/contentApiHandlers.ts
import { rest } from 'msw';

export const handlers = [
  rest.post('*/extract-content-topics', (req, res, ctx) => {
    return res(
      ctx.json({
        success: true,
        topics: [/* mock data */],
        metadata: { /* ... */ }
      })
    );
  })
];
```

### Run Integration Tests

```bash
npm run test:integration
```

---

## Step 5: Set Up E2E Tests (15 minutes)

### Install Playwright Browsers

```bash
npx playwright install
```

### Create First E2E Test

```typescript
// tests/e2e/contentTab.spec.ts
import { test, expect } from '@playwright/test';

test('user can extract topics', async ({ page }) => {
  await page.goto('http://localhost:5173/meetings/test-meeting-id');
  await page.click('[data-testid="content-tab"]');
  await page.click('button:has-text("Extract Topics")');

  await expect(page.locator('[data-testid="topic-card"]').first())
    .toBeVisible({ timeout: 10000 });
});
```

### Run E2E Tests

```bash
# Start dev server in one terminal
npm run dev

# Run tests in another terminal
npm run test:e2e
```

---

## Step 6: Check Coverage (2 minutes)

```bash
# Generate coverage report
npm run test:coverage

# Open HTML report
open coverage/index.html
```

**Target Coverage**:
- contentService.ts: 90%+ ✅
- MeetingContent.tsx: 85%+ (after implementation)
- TopicsList.tsx: 85%+ (after implementation)
- ContentGenerator.tsx: 85%+ (after implementation)

---

## Common Issues & Solutions

### Issue: "Cannot find module '@/components/...'"

**Solution**: Check your vitest.config.ts has path alias:

```typescript
resolve: {
  alias: {
    '@': path.resolve(__dirname, './src')
  }
}
```

### Issue: "ReferenceError: fetch is not defined"

**Solution**: Mock fetch globally in your test:

```typescript
global.fetch = vi.fn();
```

### Issue: "Supabase client not found"

**Solution**: Mock Supabase in your test:

```typescript
vi.mock('@/lib/supabase/clientV2', () => ({
  supabase: {
    auth: { getSession: vi.fn() },
    from: vi.fn()
  }
}));
```

### Issue: Playwright tests timeout

**Solution**: Increase timeout in playwright.config.ts:

```typescript
use: {
  actionTimeout: 10000,
  navigationTimeout: 30000,
}
```

---

## Test Execution Checklist

### Before Committing Code

- [ ] All unit tests pass: `npm run test`
- [ ] No console errors or warnings
- [ ] Coverage meets targets: `npm run test:coverage`
- [ ] Integration tests pass: `npm run test:integration`
- [ ] E2E tests pass: `npm run test:e2e`
- [ ] No flaky tests (run tests 3x to verify)
- [ ] Test code follows patterns from contentService.test.ts

### Before Creating PR

- [ ] All tests documented
- [ ] Coverage report shows 85%+
- [ ] No skipped or .only tests
- [ ] Test failures investigated and fixed
- [ ] Performance tests meet benchmarks
- [ ] Accessibility tests pass

---

## Quick Reference: Test Commands

```bash
# Unit tests
npm run test                          # Run all unit tests
npm run test:watch                    # Watch mode
npm run test -- MeetingContent.test   # Specific file
npm run test:coverage                 # With coverage

# Integration tests
npm run test:integration              # Run integration suite

# E2E tests
npm run test:e2e                      # All E2E tests
npm run test:e2e -- contentTab.spec   # Specific file
npm run test:e2e:headed               # With visible browser
npm run test:e2e:debug                # Debug mode

# Accessibility tests
npm run test:a11y                     # WCAG compliance

# Performance tests
npm run test:perf                     # Performance benchmarks

# All tests
npm run test:all                      # Run everything
```

---

## File Structure Quick Reference

```
tests/
├── content-tab/
│   ├── TEST_PLAN.md              ✅ Comprehensive strategy
│   ├── COMPLETE_TEST_SUITE.md    ✅ All test templates
│   ├── IMPLEMENTATION_SUMMARY.md ✅ Status and metrics
│   └── QUICK_START_GUIDE.md      ✅ This file
├── unit/
│   └── content-tab/
│       ├── MeetingContent.test.tsx       📝 To implement
│       ├── TopicsList.test.tsx           📝 To implement
│       └── ContentGenerator.test.tsx     📝 To implement
├── integration/
│   └── contentTab.integration.test.tsx   📝 To implement
├── e2e/
│   ├── contentTab.spec.ts                📝 To implement
│   ├── contentTab.a11y.spec.ts           📝 To implement
│   └── contentTab.performance.spec.ts    📝 To implement
└── mocks/
    └── contentApiHandlers.ts              📝 To create

src/lib/services/__tests__/
└── contentService.test.ts                 ✅ Implemented (90%+)
```

---

## Next Steps

1. **Read TEST_PLAN.md**: Understand the complete testing strategy
2. **Review contentService.test.ts**: See the implemented patterns
3. **Copy templates from COMPLETE_TEST_SUITE.md**: Use as starting point
4. **Implement component tests**: Follow the patterns
5. **Run tests frequently**: Get fast feedback
6. **Check coverage**: Ensure you meet targets

---

## Getting Help

### Documentation Resources
- `/tests/content-tab/TEST_PLAN.md` - Full strategy
- `/tests/content-tab/COMPLETE_TEST_SUITE.md` - All templates
- `/src/lib/services/__tests__/contentService.test.ts` - Working example

### External Resources
- [Vitest Docs](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Playwright Docs](https://playwright.dev/)

### Common Patterns
- Mock API calls: See contentService.test.ts
- Mock React components: See COMPLETE_TEST_SUITE.md
- User interactions: Use `@testing-library/user-event`
- Async operations: Use `waitFor()` from React Testing Library

---

## Success! 🎉

Once all tests are implemented and passing, you'll have:

- ✅ 150+ test cases covering all scenarios
- ✅ 85%+ code coverage
- ✅ WCAG 2.1 AA accessibility compliance
- ✅ Performance benchmarks met
- ✅ Production-ready test suite

**Time to implement**: 2-4 hours for experienced developers

**Value delivered**: Comprehensive quality assurance for Content Tab feature

---

**Quick Start Guide Version**: 1.0
**Last Updated**: 2025-01-28
**Estimated Completion Time**: 3-4 hours total
