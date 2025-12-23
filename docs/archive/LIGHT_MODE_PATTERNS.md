# Light Mode Styling Patterns

This document outlines the consistent light/dark mode styling patterns applied across feature components.

## Core Principles

1. **Glassmorphism**: Use semi-transparent backgrounds with backdrop blur
2. **Border Consistency**: Visible borders in both modes with appropriate contrast
3. **Text Hierarchy**: Clear color hierarchy for different text elements
4. **Interactive States**: Proper hover and focus states for all interactive elements
5. **Icon Colors**: Theme-aware icon coloring

## Pattern Reference

### Card/Container Backgrounds
```tsx
// Before (dark only)
className="bg-slate-900/50 backdrop-blur-sm border-slate-700/50"

// After (light + dark)
className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50"
```

### Text Colors

#### Primary Text (Headings, Main Content)
```tsx
// Before
className="text-white"

// After
className="text-slate-900 dark:text-white"
```

#### Secondary Text (Descriptions, Meta Info)
```tsx
// Before
className="text-slate-400"

// After
className="text-slate-600 dark:text-slate-400"
```

#### Tertiary Text (Muted, Timestamps)
```tsx
// Before
className="text-slate-500"

// After
className="text-slate-500 dark:text-slate-500"
```

### Interactive Elements

#### Buttons (Ghost Variant)
```tsx
// Before
className="text-slate-400 hover:text-white"

// After
className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
```

#### Buttons (Primary Actions)
```tsx
// Consistent across themes - keep existing colored buttons
className="bg-green-600 hover:bg-green-700 text-white border-green-600"
```

### Form Elements

#### Input Fields
```tsx
// Before
className="bg-slate-800/50 border-slate-700/50 text-white placeholder:text-slate-400 focus:border-blue-500/50"

// After
className="bg-white dark:bg-slate-800/50 border-slate-300 dark:border-slate-700/50 text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:border-blue-500/50 dark:focus:border-blue-500/50"
```

#### Select Triggers
```tsx
// Before
className="bg-slate-800/50 border-slate-700/50 text-white"

// After
className="bg-white dark:bg-slate-800/50 border-slate-300 dark:border-slate-700/50 text-slate-900 dark:text-white"
```

#### Select Content
```tsx
// Before
className="bg-slate-800 border-slate-700"

// After
className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700"
```

### Icons

#### Icon Containers
```tsx
// Before
className="p-2 bg-blue-500/20 rounded-lg"

// After
className="p-2 bg-blue-500/20 dark:bg-blue-500/20 rounded-lg border border-blue-500/30"
```

#### Icon Colors
```tsx
// Before
className="h-5 w-5 text-blue-400"

// After
className="h-5 w-5 text-blue-600 dark:text-blue-400"
```

### Dropdown Menus

#### Menu Content
```tsx
// Before
className="bg-slate-800 border-slate-700"

// After
className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700"
```

#### Menu Items
```tsx
// Before
className="text-slate-300"

// After
className="text-slate-700 dark:text-slate-300"
```

#### Menu Separators
```tsx
// Before
className="bg-slate-700"

// After
className="bg-slate-300 dark:bg-slate-700"
```

### Badges

#### Status Badges
```tsx
// Keep existing badge logic, but adjust text colors:
// Light mode: Darker variant of the color
// Dark mode: Current lighter variant

// Example - Success badge
className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20"
```

### Dialog/Modal

#### Dialog Container
```tsx
// Before
className="bg-slate-900/95 backdrop-blur-xl border border-slate-700/50"

// After
className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-300 dark:border-slate-700/50"
```

#### Dialog Title
```tsx
// Before
className="text-white"

// After
className="text-slate-900 dark:text-white"
```

#### Dialog Description
```tsx
// Before
className="text-slate-400"

// After
className="text-slate-600 dark:text-slate-400"
```

### Card Items (Lists, Grids)

#### Card Border & Background
```tsx
// Before
className="border border-slate-700/50 bg-slate-800/30 hover:border-slate-600/50 hover:bg-slate-800/50"

// After
className="border border-slate-300 dark:border-slate-700/50 bg-slate-100/30 dark:bg-slate-800/30 hover:border-slate-400 dark:hover:border-slate-600/50 hover:bg-slate-100/50 dark:hover:bg-slate-800/50"
```

### Skeletons

#### Skeleton Loading States
```tsx
// Before
className="bg-slate-800"

// After
className="bg-slate-200 dark:bg-slate-800"
```

## Implementation Checklist

For each component, update the following elements:

- [ ] Card/Container backgrounds
- [ ] Text colors (primary, secondary, tertiary)
- [ ] Button states (ghost, primary, danger)
- [ ] Form elements (inputs, selects, textareas)
- [ ] Icon colors and containers
- [ ] Dropdown menus and items
- [ ] Badges and status indicators
- [ ] Dialog/Modal styling
- [ ] Card items in lists/grids
- [ ] Loading states (skeletons)
- [ ] Empty states
- [ ] Hover and focus states

## Testing Notes

After applying changes:

1. Toggle between light and dark modes
2. Check text readability in both modes
3. Verify hover/focus states work correctly
4. Ensure all interactive elements are accessible
5. Check border visibility
6. Validate color contrast ratios (WCAG AA minimum)

## Components Updated

- [x] ContactDocuments.tsx
- [ ] ContactEmailHistory.tsx
- [ ] EmailComposerModal.tsx
- [ ] EmailSyncStatus.tsx
- [ ] SendEmailButton.tsx
- [ ] ActivityUploadModal.tsx
- [ ] AuditLogViewer.tsx
- [ ] AIProviderSettings.tsx
