# Theme-Aware Class Fix Guide

## Problem
The Company and Contact pages (and their child components) have hardcoded dark mode classes that don't respect the theme toggle.

## Solution
Replace all hardcoded dark mode classes with theme-aware classes following the design system.

## Quick Reference: Class Replacements

### Backgrounds
```
bg-gray-950          → bg-white dark:bg-gray-950
bg-gray-900/50       → bg-white/85 dark:bg-gray-900/50  OR  theme-bg-card
bg-gray-900          → bg-gray-50 dark:bg-gray-900  OR  theme-bg-secondary
bg-gray-800/50       → bg-gray-100/50 dark:bg-gray-800/50
bg-gray-800          → bg-gray-100 dark:bg-gray-800  OR  theme-bg-elevated
```

### Borders
```
border-gray-800/50   → border-gray-200 dark:border-gray-800/50  OR  theme-border
border-gray-800      → border-gray-200 dark:border-gray-800
border-gray-700/50   → border-gray-300 dark:border-gray-700/50  OR  theme-border-subtle
border-gray-700      → border-gray-300 dark:border-gray-700
```

### Text Colors
```
text-white           → text-gray-900 dark:text-white  OR  theme-text-primary
text-gray-300        → text-gray-700 dark:text-gray-300  OR  theme-text-secondary
text-gray-400        → text-gray-500 dark:text-gray-400  OR  theme-text-tertiary
text-gray-500        → text-gray-500 dark:text-gray-500  (already neutral)
```

## New Utility Classes Available

Use these classes for common patterns:

```tsx
.theme-bg-primary     // Pure white → Dark gray-950
.theme-bg-secondary   // Light gray → Dark gray-900
.theme-bg-card        // White with blur → Dark gray-900/80 with blur
.theme-bg-elevated    // Light gray-50 → Dark gray-800

.theme-border         // Light gray-200 → Dark gray-800/50
.theme-border-subtle  // Light gray-300 → Dark gray-700/50

.theme-text-primary   // Dark gray-900 → Light gray-100
.theme-text-secondary // Medium gray-700 → Light gray-300
.theme-text-tertiary  // Gray-500 → Gray-400
.theme-text-muted     // Light gray-400 → Gray-500
```

## Files That Need Updating

### Company Components
- src/pages/companies/components/CompanyHeader.tsx
- src/pages/companies/components/CompanyMainContent.tsx
- src/pages/companies/components/CompanySidebar.tsx
- src/pages/companies/components/CompanyRightPanel.tsx
- src/pages/companies/components/CompanyTabs.tsx

### Contact Components
- src/pages/contacts/components/ContactHeader.tsx
- src/pages/contacts/components/ContactMainContent.tsx
- src/pages/contacts/components/ContactSidebar.tsx
- src/pages/contacts/components/ContactRightPanel.tsx
- src/pages/contacts/components/ContactTabs.tsx

### Notification Components
- Search for notification bell components
- Update badge and dropdown backgrounds

## Pattern Examples

### Card Component
```tsx
// Before (dark only)
<div className="bg-gray-900/50 backdrop-blur-xl rounded-xl p-4 border border-gray-800/50">

// After (theme-aware)
<div className="theme-bg-card rounded-xl p-4 theme-border">
// OR manually
<div className="bg-white/85 dark:bg-gray-900/50 backdrop-blur-xl rounded-xl p-4 border border-gray-200 dark:border-gray-800/50">
```

### Text Content
```tsx
// Before (dark only)
<h1 className="text-white">Title</h1>
<p className="text-gray-400">Description</p>

// After (theme-aware)
<h1 className="theme-text-primary">Title</h1>
<p className="theme-text-tertiary">Description</p>
// OR manually
<h1 className="text-gray-900 dark:text-white">Title</h1>
<p className="text-gray-500 dark:text-gray-400">Description</p>
```

### Buttons
```tsx
// Already fixed in btn classes, but for custom buttons:
<button className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700
                   text-gray-900 dark:text-white border border-gray-300 dark:border-gray-700">
```

## Design System Reference

See `design_system.md` for complete color tokens and patterns.

### Light Mode Principles (from design_system.md)
- ✨ Pure white backgrounds (#ffffff)
- 🎯 High contrast text (gray-900)
- 💪 Solid button colors
- 🎨 Minimal gray usage
- 🚫 No gradients

### Dark Mode Principles
- 🌑 Deep dark backgrounds (gray-950)
- ✨ Glassmorphic cards with blur
- 💎 Translucent surfaces
- 🔮 Subtle borders with opacity
