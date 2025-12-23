# Theme Testing Checklist

## 🧪 Comprehensive Theme Testing Guide

This checklist ensures all components properly support light/dark mode theme switching.

---

## 🎯 Testing Strategy

### Quick Test (5 minutes)
Test the most critical user-facing pages in both themes.

### Full Test (30 minutes)
Systematically test every page and interaction.

### Automated Test (Future)
Playwright tests for theme switching validation.

---

## 📋 Page-by-Page Testing Checklist

### ✅ Dashboard & Analytics

**Dashboard (`/`)**
- [ ] Page background: White (light) / Gray-950 (dark)
- [ ] Metric cards: White background (light) / Glassmorphic (dark)
- [ ] Chart labels readable in both themes
- [ ] Recent deals section properly styled
- [ ] Month selector visible and functional
- [ ] All text has sufficient contrast

**Insights (`/insights`)**
- [ ] Page background solid (no gradients)
- [ ] Tab navigation visible in both themes
- [ ] Charts render correctly
- [ ] Stats cards properly themed
- [ ] Filter controls accessible

**Activity Log (`/activity`)**
- [ ] Timeline items visible
- [ ] Activity icons properly colored
- [ ] Filters work in both themes
- [ ] Hover states smooth

**Heatmap (redirects to `/insights`)**
- [ ] Redirect works
- [ ] Heatmap colors visible in both themes
- [ ] Legend readable

---

### ✅ CRM Core

**CRM Hub (`/crm`)**
- [ ] Navigation tabs visible
- [ ] Contact cards properly themed
- [ ] Company cards no gradients
- [ ] Search bar functional
- [ ] Filters accessible
- [ ] Add buttons visible

**Contact Profile (`/contacts/:id`)**
- [ ] Header section properly styled
- [ ] Avatar/initials visible
- [ ] All tabs accessible
- [ ] Activity timeline readable
- [ ] Deal cards properly themed
- [ ] Task cards visible
- [ ] Documents section accessible
- [ ] Sidebar information clear
- [ ] Edit modals properly styled

**Company Profile (`/companies/:id`)**
- [ ] Same checks as Contact Profile
- [ ] Company logo/initials visible
- [ ] Related contacts visible
- [ ] Deal pipeline accessible

---

### ✅ Pipeline & Deals

**Pipeline (`/pipeline`)**
- [ ] Kanban columns properly styled
- [ ] Deal cards visible with good contrast
- [ ] Status badges readable
- [ ] Drag-and-drop visual feedback works
- [ ] Column headers clear
- [ ] Deal count badges visible
- [ ] Add deal buttons functional
- [ ] Deal details modal properly themed

**Deal Wizard**
- [ ] Modal overlay correct opacity
- [ ] Step indicators visible
- [ ] Form inputs accessible
- [ ] Type selection cards properly styled
- [ ] Contact picker functional
- [ ] Revenue split section clear
- [ ] Success screen properly themed

---

### ✅ Tasks & Calendar

**Tasks (`/tasks`)**
- [ ] View toggle (list/kanban) visible
- [ ] Task cards properly themed
- [ ] Priority colors correct (green=low, yellow=medium, red=high)
- [ ] Kanban columns properly styled
- [ ] Task details readable
- [ ] Add task modal functional

**Calendar (`/calendar`)**
- [ ] Calendar grid visible
- [ ] Event colors distinguishable
- [ ] Today indicator visible
- [ ] Time grid readable
- [ ] Event details modal properly themed
- [ ] Add event functional
- [ ] Google sync status visible

---

### ✅ Meetings & Video

**Meetings (`/meetings`)**
- [ ] Meeting cards visible (no gradients)
- [ ] Stat cards properly themed
- [ ] Search/filter functional
- [ ] Grid/list views both work
- [ ] Meeting thumbnails visible

**Meeting Detail (`/meetings/:id`)**
- [ ] Video player (stays dark)
- [ ] Controls overlay visible
- [ ] Transcript readable in both themes
- [ ] Topics list accessible
- [ ] AI chat properly styled
- [ ] Content library functional
- [ ] Sentiment indicators visible
- [ ] Action items clear

---

### ✅ Quick Actions & Forms

**QuickAdd Modal (FAB button)**
- [ ] Modal backdrop correct
- [ ] Action grid buttons visible
- [ ] All form types accessible:
  - [ ] Task form
  - [ ] Deal form
  - [ ] Outbound activity
  - [ ] Meeting
  - [ ] Proposal
- [ ] Date picker functional
- [ ] Validation messages visible
- [ ] Submit buttons properly styled

---

### ✅ Admin & Settings

**Admin Hub (`/admin`)**
- [ ] Navigation tabs visible
- [ ] All admin sections accessible
- [ ] Stat cards properly themed

**Admin Pages:**
- [ ] Users - Table readable, forms functional
- [ ] Audit Logs - Filters work, table visible
- [ ] Pipeline Settings - Forms accessible
- [ ] Smart Tasks - Settings visible
- [ ] System Health - Status indicators clear
- [ ] Database - Navigation functional
- [ ] Reports - Report builder accessible

---

### ✅ Workflows & Integrations

**Workflows (`/workflows`)**
- [ ] Canvas background appropriate (gray-50/gray-900)
- [ ] Nodes visible and distinct
- [ ] Node connections visible
- [ ] Selected node highlighted
- [ ] Testing interface functional
- [ ] Execution monitor readable

**Workflow Nodes:**
- [ ] All node types visible
- [ ] Node icons clear
- [ ] Node colors appropriate (no gradients in light)
- [ ] Status indicators visible

**Integrations (`/integrations`)**
- [ ] Integration cards properly themed
- [ ] Connection status clear
- [ ] Setup buttons visible
- [ ] Settings accessible

**Email (`/email`)**
- [ ] Inbox list readable
- [ ] Email content visible
- [ ] Composer functional
- [ ] Attachments visible

**Roadmap (`/roadmap`)**
- [ ] Roadmap items visible
- [ ] Status colors appropriate
- [ ] Timeline readable

**Releases (`/releases`)**
- [ ] Release cards properly themed
- [ ] Version indicators visible
- [ ] Feature descriptions readable
- [ ] Update notifications clear

---

## 🎨 Visual Quality Checks

### Light Mode
- [ ] All backgrounds pure white (no gradients)
- [ ] Text uses gray-900 for primary content
- [ ] Shadows present but subtle
- [ ] Borders visible but not harsh
- [ ] Colors vibrant and clear
- [ ] Professional, clean appearance

### Dark Mode
- [ ] Deep dark backgrounds (gray-950)
- [ ] Glassmorphic cards with blur effect
- [ ] Borders subtle with opacity
- [ ] No shadows (or minimal)
- [ ] Text high contrast (gray-100)
- [ ] Modern, premium appearance

---

## 🔄 Interaction Testing

### Theme Toggle
- [ ] Toggle button accessible in:
  - [ ] Desktop sidebar
  - [ ] Mobile menu
  - [ ] Preferences page
- [ ] Toggle switches instantly (no delay)
- [ ] No flash or flicker
- [ ] Preference persists after refresh
- [ ] Works across all pages

### Hover States
- [ ] Cards show subtle hover effect
- [ ] Buttons change on hover
- [ ] Links show hover state
- [ ] Interactive elements have feedback
- [ ] Hover colors appropriate for theme

### Focus States
- [ ] Form inputs show focus ring
- [ ] Buttons show focus state
- [ ] Links show focus indicator
- [ ] Focus rings visible in both themes
- [ ] Tab navigation works

### Active States
- [ ] Navigation shows active page
- [ ] Tabs show active tab
- [ ] Selected items highlighted
- [ ] Active colors appropriate (blue variants)

---

## 📱 Responsive Testing

### Desktop (>1024px)
- [ ] Sidebar always visible
- [ ] Content properly spaced
- [ ] Cards in grid layout
- [ ] All features accessible

### Tablet (768px-1024px)
- [ ] Sidebar collapsible
- [ ] Content adapts to width
- [ ] Cards reflow appropriately
- [ ] Touch targets adequate

### Mobile (<768px)
- [ ] Hamburger menu works
- [ ] Mobile sidebar slides in
- [ ] Content stacks vertically
- [ ] Touch targets large enough
- [ ] FAB button accessible
- [ ] Forms mobile-friendly

---

## ♿ Accessibility Testing

### Contrast Ratios (WCAG AA)
- [ ] Primary text: 4.5:1 minimum
- [ ] Large text: 3:1 minimum
- [ ] Interactive elements: 3:1 minimum
- [ ] Status indicators distinguishable

### Keyboard Navigation
- [ ] All pages keyboard accessible
- [ ] Tab order logical
- [ ] Dropdowns keyboard accessible
- [ ] Modals can be closed with Escape
- [ ] Forms submittable with Enter

### Screen Reader
- [ ] Page titles announced
- [ ] Buttons have labels
- [ ] Images have alt text
- [ ] Form fields have labels
- [ ] Status changes announced

---

## 🐛 Known Issues to Check

### Fixed Issues
- ✅ AppLayout gradient removed
- ✅ ContactCard/CompanyCard gradients removed
- ✅ Pipeline badges themed
- ✅ Meeting cards no gradients
- ✅ QuickAdd forms properly styled
- ✅ Admin tables readable
- ✅ Workflow nodes consistent

### Potential Issues
- ⚠️ Third-party components (FullCalendar, React Flow) may need custom CSS
- ⚠️ Chart libraries may need theme configuration
- ⚠️ Video player controls (intentionally stay dark)
- ⚠️ Some legacy components may still exist

---

## 🧪 Automated Testing

### Manual Tests (Do Now)
1. **Quick Smoke Test** (5 min)
   - Toggle theme on Dashboard
   - Navigate to CRM
   - Open Pipeline
   - Check Tasks
   - View a Contact profile

2. **Full Manual Test** (30 min)
   - Go through entire checklist above
   - Test in both Chrome and Safari
   - Test on mobile device

### Future Automated Tests (Playwright)

```typescript
// Example Playwright test
test('theme toggle works across pages', async ({ page }) => {
  await page.goto('/');

  // Start in light mode
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  // Toggle to dark
  await page.click('[aria-label="Toggle theme"]');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  // Navigate to other pages
  await page.goto('/crm');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await page.goto('/pipeline');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('all pages have correct backgrounds', async ({ page }) => {
  const pages = ['/', '/crm', '/pipeline', '/tasks', '/meetings'];

  for (const route of pages) {
    await page.goto(route);

    // Light mode
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'light');
    });
    const bgLight = await page.locator('main').evaluate(el =>
      window.getComputedStyle(el).backgroundColor
    );
    expect(bgLight).toBe('rgb(255, 255, 255)'); // white

    // Dark mode
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
    });
    const bgDark = await page.locator('main').evaluate(el =>
      window.getComputedStyle(el).backgroundColor
    );
    expect(bgDark).toContain('rgb(3, 7, 18)'); // gray-950
  }
});
```

---

## 📊 Testing Report Template

Use this template to document your testing results:

```markdown
# Theme Testing Report - [Date]

## Tester: [Name]
## Browser: [Chrome/Safari/Firefox]
## Device: [Desktop/Tablet/Mobile]

### Quick Test Results
- [ ] Dashboard: PASS / FAIL
- [ ] CRM: PASS / FAIL
- [ ] Pipeline: PASS / FAIL
- [ ] Tasks: PASS / FAIL
- [ ] Meetings: PASS / FAIL

### Issues Found
1. [Description of issue]
   - Location: [Page/Component]
   - Severity: [High/Medium/Low]
   - Screenshot: [Link]

2. [Description of issue]
   - Location: [Page/Component]
   - Severity: [High/Medium/Low]
   - Screenshot: [Link]

### Overall Assessment
- Light Mode: [Excellent/Good/Needs Work]
- Dark Mode: [Excellent/Good/Needs Work]
- Theme Toggle: [Works Perfectly/Has Issues]

### Recommendations
- [Any suggested improvements]
```

---

## ✅ Sign-Off Checklist

Before marking theme implementation as complete:

- [ ] All pages tested in light mode
- [ ] All pages tested in dark mode
- [ ] Theme toggle tested on all pages
- [ ] Mobile responsive testing complete
- [ ] Accessibility validation done
- [ ] No gradients in light mode confirmed
- [ ] All text readable in both themes
- [ ] No console errors related to theme
- [ ] Performance acceptable (no lag on toggle)
- [ ] User feedback collected (if applicable)

---

## 🎯 Success Criteria

**Light Mode:**
- ✅ Pure white backgrounds throughout
- ✅ High contrast text (gray-900)
- ✅ Solid colors, no gradients
- ✅ Professional shadows
- ✅ Clean, modern appearance

**Dark Mode:**
- ✅ Deep dark backgrounds (gray-950)
- ✅ Glassmorphic cards with blur
- ✅ Subtle transparent borders
- ✅ No or minimal shadows
- ✅ Premium, modern appearance

**Both Modes:**
- ✅ Instant theme switching
- ✅ No flash or flicker
- ✅ Persistence after refresh
- ✅ Consistent patterns throughout
- ✅ WCAG AA contrast ratios
- ✅ All interactions smooth

---

*Last Updated: 2025-10-30*
*Version: 1.0*
*Status: Ready for Testing*
