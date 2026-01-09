-- Update the design_system template with the latest content
UPDATE proposal_templates
SET content = '# Universal Design System
## Clean Light Mode + Premium Glassmorphic Dark Mode

> Production-ready design system for enterprise applications. Framework-agnostic with Inter font family, consistent backdrop blur effects, and comprehensive component patterns.

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Installation](#installation)
4. [Theme System](#theme-system)
5. [Color Tokens](#color-tokens)
6. [Typography](#typography)
7. [Button System](#button-system)
8. [Form Components](#form-components)
9. [Layout Components](#layout-components)
10. [Data Display](#data-display)
11. [Feedback Components](#feedback-components)
12. [Navigation Patterns](#navigation-patterns)
13. [Customization Guide](#customization-guide)
14. [Framework Integration](#framework-integration)
15. [Best Practices](#best-practices)

---

## 🎯 Overview

### Design Philosophy

This design system provides:
- **Dual Theme Support**: Clean, minimal light mode and premium glassmorphic dark mode
- **Framework Agnostic**: Works with React, Vue, Svelte, vanilla JavaScript
- **Accessibility First**: WCAG AA compliant with proper contrast ratios
- **Performance Optimized**: Efficient backdrop blur usage and GPU acceleration
- **Developer Experience**: Clear patterns, copy-paste ready components
- **Customizable**: Easy to adapt brand colors, spacing, and styles

### Core Principles

**Light Mode Philosophy:**
- ✨ Pure white (#FFFFFF) and off-white (#FCFCFC) backgrounds
- 🎯 High contrast text (gray-900 primary, gray-700 secondary)
- 💪 Clean borders with gray-200 and gray-300
- 🎨 Minimal shadows, clean aesthetic
- 📱 Mobile-first responsive design

**Dark Mode Philosophy (Glassmorphism):**
- 🌑 Deep dark backgrounds (gray-950: #030712)
- ✨ Glassmorphic cards: `bg-gray-900/80 backdrop-blur-sm`
- 💎 Premium glass surfaces: `rgba(20, 28, 36, 0.6)` with `backdrop-filter: blur(16px)`
- 🔮 Subtle borders: `border-gray-700/50` with opacity
- ⚡ Smooth transitions and hover effects
- 🎭 Inset highlights: `inset 0 1px 0 rgba(255, 255, 255, 0.05)`

---

## 🎯 Color Tokens

### Light Mode

```css
/* Backgrounds */
--bg-primary: #FFFFFF           /* Pure white */
--bg-secondary: #FCFCFC         /* Off-white */
--bg-tertiary: #F3F4F6          /* Gray-100 */

/* Borders */
--border-primary: #E5E7EB       /* Gray-200 */
--border-secondary: #D1D5DB     /* Gray-300 */

/* Text */
--text-primary: #111827         /* Gray-900 */
--text-secondary: #374151       /* Gray-700 */
--text-tertiary: #6B7280        /* Gray-500 */
--text-muted: #9CA3AF           /* Gray-400 */

/* Semantic */
--color-primary: #2563EB        /* Blue-600 */
--color-success: #059669        /* Emerald-600 */
--color-danger: #DC2626         /* Red-600 */
--color-warning: #D97706        /* Amber-600 */
--color-info: #7C3AED           /* Violet-600 */
```

### Dark Mode (Glassmorphism)

```css
/* Backgrounds */
--bg-primary: #030712           /* Gray-950 */
--bg-secondary: #111827         /* Gray-900 */
--bg-tertiary: #1F2937          /* Gray-800 */

/* Glassmorphism */
--surface-glass: rgba(17, 24, 39, 0.8)
--surface-glass-premium: rgba(20, 28, 36, 0.6)

/* Borders */
--border-primary: rgba(55, 65, 81, 0.5)     /* Gray-700/50 */
--border-secondary: rgba(75, 85, 99, 0.5)   /* Gray-600/50 */

/* Text */
--text-primary: #F3F4F6         /* Gray-100 */
--text-secondary: #D1D5DB       /* Gray-300 */
--text-tertiary: #9CA3AF        /* Gray-400 */
--text-muted: #6B7280           /* Gray-500 */

/* Semantic */
--color-primary: #3DA8F4        /* Blue-400 */
--color-success: #10B981        /* Emerald-500 */
--color-danger: #EF4444         /* Red-500 */
--color-warning: #F59E0B        /* Amber-500 */
--color-info: #8B5CF6           /* Violet-500 */
```

---

## 🎯 Design Tokens

| Element | Light Mode | Dark Mode |
|---------|-----------|-----------|
| Page BG | `#FFFFFF` | `#030712` |
| Card BG | `white + shadow-sm` | `gray-900/80 + backdrop-blur-sm` |
| Border | `gray-200` | `gray-700/50` |
| Text Primary | `gray-900` | `gray-100` |
| Text Secondary | `gray-700` | `gray-300` |
| Text Tertiary | `gray-500` | `gray-400` |
| Primary Color | `blue-600` | `blue-400` |
| Success | `emerald-600` | `emerald-500` |
| Danger | `red-600` | `red-500` |'
WHERE type = 'design_system' AND is_default = true;

-- Insert if it doesnt exist
INSERT INTO proposal_templates (type, content, is_default, name)
SELECT 'design_system', '# Universal Design System
## Clean Light Mode + Premium Glassmorphic Dark Mode

> Production-ready design system for enterprise applications. Framework-agnostic with Inter font family, consistent backdrop blur effects, and comprehensive component patterns.

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Installation](#installation)
4. [Theme System](#theme-system)
5. [Color Tokens](#color-tokens)
6. [Typography](#typography)
7. [Button System](#button-system)
8. [Form Components](#form-components)
9. [Layout Components](#layout-components)
10. [Data Display](#data-display)
11. [Feedback Components](#feedback-components)
12. [Navigation Patterns](#navigation-patterns)
13. [Customization Guide](#customization-guide)
14. [Framework Integration](#framework-integration)
15. [Best Practices](#best-practices)

---

## 🎯 Overview

### Design Philosophy

This design system provides:
- **Dual Theme Support**: Clean, minimal light mode and premium glassmorphic dark mode
- **Framework Agnostic**: Works with React, Vue, Svelte, vanilla JavaScript
- **Accessibility First**: WCAG AA compliant with proper contrast ratios
- **Performance Optimized**: Efficient backdrop blur usage and GPU acceleration
- **Developer Experience**: Clear patterns, copy-paste ready components
- **Customizable**: Easy to adapt brand colors, spacing, and styles

### Core Principles

**Light Mode Philosophy:**
- ✨ Pure white (#FFFFFF) and off-white (#FCFCFC) backgrounds
- 🎯 High contrast text (gray-900 primary, gray-700 secondary)
- 💪 Clean borders with gray-200 and gray-300
- 🎨 Minimal shadows, clean aesthetic
- 📱 Mobile-first responsive design

**Dark Mode Philosophy (Glassmorphism):**
- 🌑 Deep dark backgrounds (gray-950: #030712)
- ✨ Glassmorphic cards: `bg-gray-900/80 backdrop-blur-sm`
- 💎 Premium glass surfaces: `rgba(20, 28, 36, 0.6)` with `backdrop-filter: blur(16px)`
- 🔮 Subtle borders: `border-gray-700/50` with opacity
- ⚡ Smooth transitions and hover effects
- 🎭 Inset highlights: `inset 0 1px 0 rgba(255, 255, 255, 0.05)`

---

## 🎯 Color Tokens

### Light Mode

```css
/* Backgrounds */
--bg-primary: #FFFFFF           /* Pure white */
--bg-secondary: #FCFCFC         /* Off-white */
--bg-tertiary: #F3F4F6          /* Gray-100 */

/* Borders */
--border-primary: #E5E7EB       /* Gray-200 */
--border-secondary: #D1D5DB     /* Gray-300 */

/* Text */
--text-primary: #111827         /* Gray-900 */
--text-secondary: #374151       /* Gray-700 */
--text-tertiary: #6B7280        /* Gray-500 */
--text-muted: #9CA3AF           /* Gray-400 */

/* Semantic */
--color-primary: #2563EB        /* Blue-600 */
--color-success: #059669        /* Emerald-600 */
--color-danger: #DC2626         /* Red-600 */
--color-warning: #D97706        /* Amber-600 */
--color-info: #7C3AED           /* Violet-600 */
```

### Dark Mode (Glassmorphism)

```css
/* Backgrounds */
--bg-primary: #030712           /* Gray-950 */
--bg-secondary: #111827         /* Gray-900 */
--bg-tertiary: #1F2937          /* Gray-800 */

/* Glassmorphism */
--surface-glass: rgba(17, 24, 39, 0.8)
--surface-glass-premium: rgba(20, 28, 36, 0.6)

/* Borders */
--border-primary: rgba(55, 65, 81, 0.5)     /* Gray-700/50 */
--border-secondary: rgba(75, 85, 99, 0.5)   /* Gray-600/50 */

/* Text */
--text-primary: #F3F4F6         /* Gray-100 */
--text-secondary: #D1D5DB       /* Gray-300 */
--text-tertiary: #9CA3AF        /* Gray-400 */
--text-muted: #6B7280           /* Gray-500 */

/* Semantic */
--color-primary: #3DA8F4        /* Blue-400 */
--color-success: #10B981        /* Emerald-500 */
--color-danger: #EF4444         /* Red-500 */
--color-warning: #F59E0B        /* Amber-500 */
--color-info: #8B5CF6           /* Violet-500 */
```

---

## 🎯 Design Tokens

| Element | Light Mode | Dark Mode |
|---------|-----------|-----------|
| Page BG | `#FFFFFF` | `#030712` |
| Card BG | `white + shadow-sm` | `gray-900/80 + backdrop-blur-sm` |
| Border | `gray-200` | `gray-700/50` |
| Text Primary | `gray-900` | `gray-100` |
| Text Secondary | `gray-700` | `gray-300` |
| Text Tertiary | `gray-500` | `gray-400` |
| Primary Color | `blue-600` | `blue-400` |
| Success | `emerald-600` | `emerald-500` |
| Danger | `red-600` | `red-500` |', true, 'Universal Design System'
WHERE NOT EXISTS (
    SELECT 1 FROM proposal_templates WHERE type = 'design_system' AND is_default = true
);

