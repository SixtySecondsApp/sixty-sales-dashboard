# Universal Design System
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

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install tailwindcss class-variance-authority clsx tailwind-merge
```

### 2. Configure Tailwind

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Add your brand colors here
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
```

### 3. Add Global Styles

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

:root {
  color-scheme: light dark;
}

* {
  @apply transition-colors duration-200 ease-in-out;
}

[data-theme="light"] {
  background-color: #ffffff;
}

[data-theme="dark"] {
  background-color: #030712;
}

body {
  @apply font-sans antialiased;
}

*:focus {
  outline: none;
}

/* Custom scrollbar for dark mode */
[data-theme="dark"] ::-webkit-scrollbar {
  width: 8px;
}

[data-theme="dark"] ::-webkit-scrollbar-track {
  @apply bg-gray-900;
}

[data-theme="dark"] ::-webkit-scrollbar-thumb {
  @apply bg-gray-700 rounded-full;
}

[data-theme="dark"] ::-webkit-scrollbar-thumb:hover {
  @apply bg-gray-600;
}
```

### 4. Create Utility Helper

```typescript
// lib/utils.ts
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

---

## 🎨 Theme System

### Theme Toggle Component

```tsx
'use client' // Remove if not using Next.js App Router

import { Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'

export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches 
      ? 'dark' 
      : 'light'
    
    const initialTheme = savedTheme || systemTheme
    setTheme(initialTheme)
    document.documentElement.setAttribute('data-theme', initialTheme)
  }, [])

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
    document.documentElement.setAttribute('data-theme', newTheme)
    localStorage.setItem('theme', newTheme)
  }

  if (!mounted) return <div className="w-10 h-10" />

  return (
    <button
      onClick={toggleTheme}
      className="inline-flex items-center justify-center rounded-lg w-10 h-10
                 bg-transparent text-gray-700 dark:text-gray-300 
                 hover:bg-gray-100 dark:hover:bg-gray-800/30 
                 transition-colors"
      aria-label="Toggle theme"
    >
      {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
    </button>
  )
}
```

### Prevent Flash of Unstyled Content

Add to `<head>`:

```html
<script>
  (function() {
    const theme = localStorage.getItem('theme') || 
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
  })();
</script>
```

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

## 📝 Typography

### Text Hierarchy

```tsx
/* Page title */
<h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
  Main Title
</h1>

/* Section heading */
<h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
  Section Title
</h2>

/* Subsection heading */
<h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
  Subsection
</h3>

/* Body text */
<p className="text-base text-gray-700 dark:text-gray-300">
  Regular paragraph text with good readability
</p>

/* Secondary text */
<p className="text-sm text-gray-500 dark:text-gray-400">
  Helper text, captions, metadata
</p>

/* Tiny text */
<span className="text-xs text-gray-400 dark:text-gray-500">
  Labels, timestamps
</span>
```

### Font Weights

```tsx
<span className="font-light">Light (300)</span>
<span className="font-normal">Regular (400)</span>
<span className="font-medium">Medium (500)</span>
<span className="font-semibold">Semibold (600)</span>
<span className="font-bold">Bold (700)</span>
```

---

## 🔘 Button System

### Button Component

```tsx
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed",
  {
    variants: {
      variant: {
        default:
          "bg-blue-600 dark:bg-blue-500/10 text-white dark:text-blue-400 border border-blue-600 dark:border-blue-500/20 hover:bg-blue-700 dark:hover:bg-blue-500/20 hover:border-blue-700 dark:hover:border-blue-500/30 shadow-sm dark:shadow-none focus-visible:ring-blue-500",
        
        success:
          "bg-emerald-600 dark:bg-emerald-500/10 text-white dark:text-emerald-400 border border-emerald-600 dark:border-emerald-500/20 hover:bg-emerald-700 dark:hover:bg-emerald-500/20 hover:border-emerald-700 dark:hover:border-emerald-500/30 shadow-sm dark:shadow-none focus-visible:ring-emerald-500",
        
        destructive:
          "bg-red-600 dark:bg-red-600/10 text-white dark:text-red-400 border border-red-600 dark:border-red-600/20 hover:bg-red-700 dark:hover:bg-red-600/20 hover:border-red-700 dark:hover:border-red-600/30 shadow-sm dark:shadow-none focus-visible:ring-red-500",
        
        secondary:
          "bg-white dark:bg-gray-600/10 text-gray-900 dark:text-gray-400 border border-gray-300 dark:border-gray-500/20 hover:bg-gray-50 dark:hover:bg-gray-600/20 hover:border-gray-400 dark:hover:border-gray-500/30 shadow-sm dark:shadow-none focus-visible:ring-gray-500",
        
        tertiary:
          "bg-gray-50 dark:bg-gray-800/50 text-gray-700 dark:text-gray-400 border border-gray-200 dark:border-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:border-gray-300 dark:hover:border-gray-600/50 focus-visible:ring-gray-500",
        
        ghost:
          "bg-transparent text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/30 hover:text-gray-900 dark:hover:text-white focus-visible:ring-gray-500",
        
        outline:
          "bg-white dark:bg-gray-700/10 text-gray-900 dark:text-gray-300 border border-gray-300 dark:border-gray-600/20 hover:bg-gray-50 dark:hover:bg-gray-700/20 hover:border-gray-400 dark:hover:border-gray-500/30 focus-visible:ring-gray-500",
        
        link: 
          "text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline underline-offset-4",
      },
      size: {
        default: "h-10 px-4 py-2.5",
        sm: "h-9 px-3 py-2 text-xs",
        lg: "h-11 px-6 py-3 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
```

### Button Examples

```tsx
// Primary action
<Button variant="default">
  <Download className="w-4 h-4 mr-2" />
  Download
</Button>

// Success action
<Button variant="success">
  <Check className="w-4 h-4 mr-2" />
  Save Changes
</Button>

// Destructive action
<Button variant="destructive">
  <Trash className="w-4 h-4 mr-2" />
  Delete
</Button>

// Secondary
<Button variant="secondary">
  Cancel
</Button>

// Ghost
<Button variant="ghost">
  Learn More
</Button>

// Icon only
<Button variant="ghost" size="icon">
  <Settings className="w-4 h-4" />
</Button>
```

---

## 📋 Form Components

### Input Field

```tsx
<div className="space-y-2">
  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
    Email Address
  </label>
  <input
    type="email"
    className="w-full px-4 py-2.5 
               bg-white dark:bg-gray-800/50 
               border border-gray-300 dark:border-gray-700/50 
               rounded-lg
               text-gray-900 dark:text-gray-100 
               placeholder-gray-400 dark:placeholder-gray-500
               focus:outline-none 
               focus:ring-2 focus:ring-blue-500 
               focus:border-transparent
               transition-all"
    placeholder="you@example.com"
  />
</div>
```

### Textarea

```tsx
<textarea
  rows={4}
  className="w-full px-4 py-2.5 
             bg-white dark:bg-gray-800/50 
             border border-gray-300 dark:border-gray-700/50 
             rounded-lg
             text-gray-900 dark:text-gray-100 
             placeholder-gray-400 dark:placeholder-gray-500
             focus:outline-none 
             focus:ring-2 focus:ring-blue-500 
             focus:border-transparent
             transition-all resize-none"
  placeholder="Enter your message..."
/>
```

### Select Dropdown

```tsx
<select
  className="w-full px-4 py-2.5 
             bg-white dark:bg-gray-800/50 
             border border-gray-300 dark:border-gray-700/50 
             rounded-lg
             text-gray-900 dark:text-gray-100
             focus:outline-none 
             focus:ring-2 focus:ring-blue-500 
             focus:border-transparent
             transition-all">
  <option>Choose an option</option>
  <option>Option 1</option>
  <option>Option 2</option>
  <option>Option 3</option>
</select>
```

### Checkbox

```tsx
<label className="flex items-center gap-2 cursor-pointer">
  <input
    type="checkbox"
    className="w-4 h-4
               rounded
               border-gray-300 dark:border-gray-700
               text-blue-600
               focus:ring-2 focus:ring-blue-500 focus:ring-offset-0
               bg-white dark:bg-gray-800
               transition-colors"
  />
  <span className="text-sm text-gray-700 dark:text-gray-300">
    Remember me
  </span>
</label>
```

### Radio Button

```tsx
<label className="flex items-center gap-2 cursor-pointer">
  <input
    type="radio"
    name="option"
    className="w-4 h-4
               border-gray-300 dark:border-gray-700
               text-blue-600
               focus:ring-2 focus:ring-blue-500 focus:ring-offset-0
               bg-white dark:bg-gray-800
               transition-colors"
  />
  <span className="text-sm text-gray-700 dark:text-gray-300">
    Option 1
  </span>
</label>
```

### Toggle Switch

```tsx
<button
  role="switch"
  aria-checked={enabled}
  onClick={() => setEnabled(!enabled)}
  className={cn(
    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
    enabled 
      ? "bg-blue-600 dark:bg-blue-500" 
      : "bg-gray-200 dark:bg-gray-700"
  )}
>
  <span
    className={cn(
      "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
      enabled ? "translate-x-6" : "translate-x-1"
    )}
  />
</button>
```

---

## 📐 Layout Components

### Card (Standard)

```tsx
<div className="bg-white dark:bg-gray-900/80
                backdrop-blur-sm
                border border-gray-200 dark:border-gray-700/50
                rounded-xl p-6
                shadow-sm dark:shadow-none
                transition-all duration-300">
  <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
    Card Title
  </h3>
  <p className="text-gray-700 dark:text-gray-300">
    Card content goes here
  </p>
</div>
```

### Card (Premium Glassmorphic)

```tsx
<div className="bg-white dark:bg-gray-900/80
                backdrop-blur-xl
                border border-gray-200 dark:border-gray-800/50
                rounded-2xl p-6
                shadow-sm dark:shadow-none
                transition-all duration-300
                hover:shadow-lg dark:hover:shadow-black/20">
  <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
    Premium Card
  </h3>
  <p className="text-gray-700 dark:text-gray-300">
    Enhanced glass effect with stronger blur
  </p>
</div>
```

### Card (Interactive)

```tsx
<div className="bg-white dark:bg-gray-900/80
                backdrop-blur-sm
                border border-gray-200 dark:border-gray-700/50
                rounded-xl p-6
                shadow-sm dark:shadow-none
                transition-all duration-300
                hover:scale-[1.02] hover:shadow-lg
                dark:hover:shadow-black/20
                cursor-pointer">
  <!-- Interactive card content -->
</div>
```

### Container

```tsx
<div className="min-h-screen bg-white dark:bg-gray-950">
  <div className="max-w-7xl mx-auto p-8">
    {/* Your content */}
  </div>
</div>
```

### Grid Layout

```tsx
// Responsive grid
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
  {items.map(item => (
    <div key={item.id}>{/* Grid item */}</div>
  ))}
</div>

// Auto-fit grid
<div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-6">
  {/* Grid items */}
</div>
```

### Split Layout

```tsx
<div className="flex h-screen bg-white dark:bg-gray-950">
  {/* Sidebar */}
  <aside className="w-64 border-r border-gray-200 dark:border-gray-800 
                    bg-white dark:bg-gray-900">
    {/* Navigation */}
  </aside>
  
  {/* Main content */}
  <main className="flex-1 overflow-y-auto p-8">
    {/* Content */}
  </main>
</div>
```

---

## 📊 Data Display

### Table

```tsx
<div className="bg-white dark:bg-gray-900/80 
                backdrop-blur-sm 
                border border-gray-200 dark:border-gray-700/50 
                rounded-xl overflow-hidden
                shadow-sm dark:shadow-none">
  <table className="w-full">
    <thead>
      <tr className="border-b border-gray-200 dark:border-gray-800 
                     bg-gray-50 dark:bg-gray-800/50">
        <th className="px-6 py-3 text-left text-xs font-semibold 
                       text-gray-700 dark:text-gray-300 uppercase tracking-wider">
          Name
        </th>
        <th className="px-6 py-3 text-left text-xs font-semibold 
                       text-gray-700 dark:text-gray-300 uppercase tracking-wider">
          Status
        </th>
        <th className="px-6 py-3 text-left text-xs font-semibold 
                       text-gray-700 dark:text-gray-300 uppercase tracking-wider">
          Actions
        </th>
      </tr>
    </thead>
    <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
      <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
        <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-gray-100">
          John Doe
        </td>
        <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
          <span className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-500/10 
                           text-emerald-700 dark:text-emerald-400 
                           border border-emerald-200 dark:border-emerald-500/20
                           rounded-full text-xs font-semibold">
            Active
          </span>
        </td>
        <td className="px-6 py-4 text-sm">
          <Button variant="ghost" size="sm">Edit</Button>
        </td>
      </tr>
    </tbody>
  </table>
</div>
```

### Badge System

```tsx
// Success
<span className="px-2.5 py-1 
                 bg-emerald-50 dark:bg-emerald-500/10 
                 text-emerald-700 dark:text-emerald-400 
                 border border-emerald-200 dark:border-emerald-500/20
                 rounded-full text-xs font-semibold">
  Success
</span>

// Warning
<span className="px-2.5 py-1 
                 bg-yellow-50 dark:bg-yellow-500/10 
                 text-yellow-700 dark:text-yellow-400 
                 border border-yellow-200 dark:border-yellow-500/20
                 rounded-full text-xs font-semibold">
  Warning
</span>

// Error
<span className="px-2.5 py-1 
                 bg-red-50 dark:bg-red-500/10 
                 text-red-700 dark:text-red-400 
                 border border-red-200 dark:border-red-500/20
                 rounded-full text-xs font-semibold">
  Error
</span>

// Info
<span className="px-2.5 py-1 
                 bg-blue-50 dark:bg-blue-500/10 
                 text-blue-700 dark:text-blue-400 
                 border border-blue-200 dark:border-blue-500/20
                 rounded-full text-xs font-semibold">
  Info
</span>

// Neutral
<span className="px-2.5 py-1 
                 bg-gray-50 dark:bg-gray-500/10 
                 text-gray-700 dark:text-gray-400 
                 border border-gray-200 dark:border-gray-500/20
                 rounded-full text-xs font-semibold">
  Neutral
</span>
```

### Avatar

```tsx
// With image
<img 
  src="/avatar.jpg" 
  alt="User name"
  className="w-10 h-10 rounded-full 
             border-2 border-gray-200 dark:border-gray-700" 
/>

// Initials fallback
<div className="w-10 h-10 rounded-full 
                bg-blue-100 dark:bg-blue-500/20 
                border-2 border-blue-200 dark:border-blue-500/30
                flex items-center justify-center
                text-sm font-semibold text-blue-700 dark:text-blue-400">
  JD
</div>
```

### Stats Card

```tsx
<div className="bg-white dark:bg-gray-900/80
                backdrop-blur-sm
                border border-gray-200 dark:border-gray-700/50
                rounded-xl p-6
                shadow-sm dark:shadow-none">
  <div className="flex items-center justify-between">
    <div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
        Total Users
      </p>
      <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
        1,234
      </p>
    </div>
    <div className="p-3 bg-blue-50 dark:bg-blue-500/10 rounded-lg">
      <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
    </div>
  </div>
  <div className="mt-4 flex items-center gap-2">
    <span className="text-emerald-600 dark:text-emerald-400 text-sm font-semibold">
      ↑ 12%
    </span>
    <span className="text-gray-500 dark:text-gray-400 text-sm">
      from last month
    </span>
  </div>
</div>
```

---

## 💬 Feedback Components

### Modal/Dialog

```tsx
// Overlay
<div className="fixed inset-0 z-50
                bg-gray-900/40 dark:bg-black/80
                backdrop-blur-sm" />

// Content
<div className="fixed left-[50%] top-[50%] z-50
                grid w-full max-w-lg
                translate-x-[-50%] translate-y-[-50%]
                gap-4
                bg-white/95 dark:bg-gray-900/95
                backdrop-blur-sm
                border border-gray-200 dark:border-gray-700/50
                text-gray-900 dark:text-gray-100
                p-6
                shadow-lg dark:shadow-none
                rounded-xl">
  {/* Header */}
  <div className="flex items-center justify-between">
    <h2 className="text-xl font-bold">Confirm Action</h2>
    <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
      <X className="w-5 h-5" />
    </button>
  </div>

  {/* Content */}
  <p className="text-gray-700 dark:text-gray-300">
    Are you sure you want to proceed with this action?
  </p>

  {/* Actions */}
  <div className="flex justify-end gap-3">
    <Button variant="secondary">Cancel</Button>
    <Button variant="default">Confirm</Button>
  </div>
</div>
```

### Toast Notification

```tsx
<div className="fixed bottom-4 right-4 z-50
                bg-white/95 dark:bg-gray-900/95
                backdrop-blur-sm
                border border-gray-200 dark:border-gray-700/50
                rounded-lg p-4
                shadow-lg dark:shadow-none
                min-w-[320px]
                flex items-start gap-3">
  <div className="flex-shrink-0">
    <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
  </div>
  <div className="flex-1">
    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
      Success!
    </p>
    <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
      Your changes have been saved.
    </p>
  </div>
  <button className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
    <X className="w-4 h-4" />
  </button>
</div>
```

### Alert

```tsx
// Info alert
<div className="bg-blue-50 dark:bg-blue-500/10
                border border-blue-200 dark:border-blue-500/20
                rounded-lg p-4
                flex items-start gap-3">
  <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
  <div>
    <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-300">
      Information
    </h4>
    <p className="text-sm text-blue-800 dark:text-blue-400 mt-1">
      This is an informational message.
    </p>
  </div>
</div>

// Warning alert
<div className="bg-yellow-50 dark:bg-yellow-500/10
                border border-yellow-200 dark:border-yellow-500/20
                rounded-lg p-4
                flex items-start gap-3">
  <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
  <div>
    <h4 className="text-sm font-semibold text-yellow-900 dark:text-yellow-300">
      Warning
    </h4>
    <p className="text-sm text-yellow-800 dark:text-yellow-400 mt-1">
      Please review this information carefully.
    </p>
  </div>
</div>

// Error alert
<div className="bg-red-50 dark:bg-red-500/10
                border border-red-200 dark:border-red-500/20
                rounded-lg p-4
                flex items-start gap-3">
  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
  <div>
    <h4 className="text-sm font-semibold text-red-900 dark:text-red-300">
      Error
    </h4>
    <p className="text-sm text-red-800 dark:text-red-400 mt-1">
      Something went wrong. Please try again.
    </p>
  </div>
</div>
```

### Loading Spinner

```tsx
<div className="inline-flex items-center gap-2">
  <div className="w-4 h-4 border-2 border-gray-300 dark:border-gray-600 
                  border-t-blue-600 dark:border-t-blue-400 
                  rounded-full animate-spin" />
  <span className="text-sm text-gray-700 dark:text-gray-300">
    Loading...
  </span>
</div>
```

### Empty State

```tsx
<div className="flex flex-col items-center justify-center py-12">
  <div className="w-16 h-16 mb-4 rounded-full 
                  bg-gray-100 dark:bg-gray-800 
                  flex items-center justify-center">
    <Inbox className="w-8 h-8 text-gray-400 dark:text-gray-500" />
  </div>
  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
    No items found
  </h3>
  <p className="text-gray-500 dark:text-gray-400 text-center mb-6 max-w-md">
    Get started by creating your first item.
  </p>
  <Button variant="default">
    <Plus className="w-4 h-4 mr-2" />
    Create Item
  </Button>
</div>
```

---

## 🧭 Navigation Patterns

### Header/Navbar

```tsx
<header className="sticky top-0 z-40 
                   bg-white/95 dark:bg-gray-900/95 
                   backdrop-blur-sm
                   border-b border-gray-200 dark:border-gray-800">
  <div className="max-w-7xl mx-auto px-4">
    <div className="flex items-center justify-between h-16">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <Logo className="w-8 h-8" />
        <span className="text-xl font-bold text-gray-900 dark:text-gray-100">
          Your App
        </span>
      </div>

      {/* Navigation */}
      <nav className="hidden md:flex items-center gap-6">
        <a href="#" className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">
          Features
        </a>
        <a href="#" className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">
          Pricing
        </a>
        <a href="#" className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">
          Docs
        </a>
      </nav>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <ThemeToggle />
        <Button variant="default">Sign In</Button>
      </div>
    </div>
  </div>
</header>
```

### Sidebar Navigation

```tsx
<aside className="w-64 h-full 
                  bg-white dark:bg-gray-900 
                  border-r border-gray-200 dark:border-gray-800
                  p-4">
  
  {/* Nav item - Inactive */}
  <button className="w-full flex items-center gap-3 px-4 py-2.5 
                     text-gray-700 dark:text-gray-400
                     hover:bg-gray-50 dark:hover:bg-gray-800/50
                     transition-colors rounded-lg mb-1">
    <Home className="w-5 h-5" />
    <span className="text-sm font-medium">Dashboard</span>
  </button>
  
  {/* Nav item - Active */}
  <button className="w-full flex items-center gap-3 px-4 py-2.5 
                     bg-blue-50 dark:bg-blue-500/10
                     text-blue-600 dark:text-blue-400
                     border border-blue-200 dark:border-blue-500/20
                     transition-colors rounded-lg mb-1">
    <Activity className="w-5 h-5" />
    <span className="text-sm font-semibold">Activity</span>
  </button>

  {/* Section header */}
  <div className="mt-6 mb-2 px-4">
    <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
      Settings
    </p>
  </div>

  {/* More nav items... */}
</aside>
```

### Breadcrumbs

```tsx
<nav className="flex items-center gap-2 text-sm">
  <a href="#" className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
    Home
  </a>
  <ChevronRight className="w-4 h-4 text-gray-400 dark:text-gray-500" />
  <a href="#" className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
    Projects
  </a>
  <ChevronRight className="w-4 h-4 text-gray-400 dark:text-gray-500" />
  <span className="text-gray-900 dark:text-gray-100 font-medium">
    Project Details
  </span>
</nav>
```

### Tabs

```tsx
<div className="border-b border-gray-200 dark:border-gray-800">
  <nav className="flex gap-6">
    {/* Active tab */}
    <button className="px-4 py-3 
                       text-blue-600 dark:text-blue-400 
                       border-b-2 border-blue-600 dark:border-blue-400
                       font-semibold text-sm">
      Overview
    </button>
    
    {/* Inactive tab */}
    <button className="px-4 py-3 
                       text-gray-600 dark:text-gray-400 
                       hover:text-gray-900 dark:hover:text-gray-100
                       border-b-2 border-transparent
                       font-medium text-sm
                       transition-colors">
      Analytics
    </button>
    
    <button className="px-4 py-3 
                       text-gray-600 dark:text-gray-400 
                       hover:text-gray-900 dark:hover:text-gray-100
                       border-b-2 border-transparent
                       font-medium text-sm
                       transition-colors">
      Settings
    </button>
  </nav>
</div>
```

---

## 🎨 Customization Guide

### Changing Brand Colors

Update your `tailwind.config.js`:

```js
theme: {
  extend: {
    colors: {
      brand: {
        50: '#your-color',
        100: '#your-color',
        // ... through 900
      },
    },
  },
}
```

Then replace `blue-*` classes with `brand-*`:

```tsx
// Before
className="bg-blue-600 text-blue-400"

// After
className="bg-brand-600 text-brand-400"
```

### Custom Glassmorphism Effects

```css
/* Add to globals.css */
.glass-premium {
  background: rgba(20, 28, 36, 0.6);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(45, 62, 78, 0.4);
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

.glass-light {
  background: rgba(30, 40, 52, 0.4);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(55, 75, 95, 0.2);
}
```

### Adjusting Spacing

Modify Tailwind config for project-specific spacing:

```js
theme: {
  extend: {
    spacing: {
      '18': '4.5rem',
      '88': '22rem',
    },
  },
}
```

### Custom Font

```js
// tailwind.config.js
theme: {
  extend: {
    fontFamily: {
      sans: ['Your Font', 'Inter', 'system-ui'],
    },
  },
}
```

```css
/* globals.css */
@import url('https://fonts.googleapis.com/css2?family=Your+Font:wght@300;400;500;600;700&display=swap');
```

---

## 🔧 Framework Integration

### Next.js App Router

```tsx
// app/layout.tsx
import './globals.css'
import { ThemeToggle } from '@/components/theme-toggle'

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{
          __html: `
            (function() {
              const theme = localStorage.getItem('theme') || 
                (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
              document.documentElement.setAttribute('data-theme', theme);
            })();
          `
        }} />
      </head>
      <body className="bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
        {children}
      </body>
    </html>
  )
}
```

### Next.js Pages Router

```tsx
// pages/_app.tsx
import '@/styles/globals.css'
import type { AppProps } from 'next/app'
import { useEffect } from 'react'

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    const theme = localStorage.getItem('theme') || 
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    document.documentElement.setAttribute('data-theme', theme)
  }, [])

  return (
    <div className="bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 min-h-screen">
      <Component {...pageProps} />
    </div>
  )
}
```

### Vite + React

```tsx
// main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

### Vue 3

```vue
<!-- App.vue -->
<script setup lang="ts">
import { onMounted } from 'vue'

onMounted(() => {
  const theme = localStorage.getItem('theme') || 
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  document.documentElement.setAttribute('data-theme', theme)
})
</script>

<template>
  <div class="bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 min-h-screen">
    <router-view />
  </div>
</template>
```

---

## ✨ Best Practices

### Glassmorphism Do's

✅ **DO:**
- Use `backdrop-blur-sm` (4px) for most cards and modals
- Use `backdrop-blur-xl` (24px) for premium effects
- Apply appropriate opacity: `0.8` for cards, `0.95` for modals
- Include webkit prefix: `-webkit-backdrop-filter`
- Combine with semi-transparent backgrounds
- Add subtle inset highlights in dark mode
- Use smooth transitions

### Glassmorphism Don'ts

❌ **DON'T:**
- Stack more than 2-3 glassmorphic layers
- Use heavy shadows with glass effects in dark mode
- Apply glassmorphism to small elements (< 100px)
- Exceed blur(24px) - impacts performance
- Use glassmorphism in light mode (clean backgrounds instead)

### Accessibility

- Maintain WCAG AA contrast ratios (4.5:1 for text)
- Provide clear focus indicators
- Use semantic HTML elements
- Include proper ARIA labels
- Support keyboard navigation
- Respect `prefers-reduced-motion`

### Performance

- Limit backdrop blur usage (moderate GPU impact)
- Optimize images and assets
- Use CSS containment for complex layouts
- Implement virtual scrolling for long lists
- Lazy load off-screen components

### Responsive Design

```tsx
// Mobile-first approach
<div className="
  w-full               /* Mobile */
  md:w-1/2             /* Tablet */
  lg:w-1/3             /* Desktop */
  xl:w-1/4             /* Large screens */
">
  {/* Content */}
</div>

// Hide on mobile, show on desktop
<div className="hidden md:block">
  {/* Desktop only */}
</div>

// Show on mobile, hide on desktop
<div className="block md:hidden">
  {/* Mobile only */}
</div>
```

---

## 📦 Quick Copy-Paste Reference

### Common Class Combinations

```tsx
// Page background
"bg-white dark:bg-gray-950"

// Card with glassmorphism
"bg-white dark:bg-gray-900/80 backdrop-blur-sm border border-gray-200 dark:border-gray-700/50 rounded-xl p-6 shadow-sm dark:shadow-none"

// Primary heading
"text-3xl font-bold text-gray-900 dark:text-gray-100"

// Body text
"text-base text-gray-700 dark:text-gray-300"

// Secondary/helper text
"text-sm text-gray-500 dark:text-gray-400"

// Input field
"w-full px-4 py-2.5 bg-white dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700/50 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"

// Modal overlay
"fixed inset-0 z-50 bg-gray-900/40 dark:bg-black/80 backdrop-blur-sm"

// Modal content
"bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border border-gray-200 dark:border-gray-700/50 rounded-xl p-6 shadow-lg dark:shadow-none"

// Active navigation
"bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20"

// Hover background
"hover:bg-gray-50 dark:hover:bg-gray-800/30"
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
| Danger | `red-600` | `red-500` |

---

## 📚 Resources

### Recommended Tools

- **Icons**: [Lucide React](https://lucide.dev/) or [Heroicons](https://heroicons.com/)
- **Animations**: [Framer Motion](https://www.framer.com/motion/)
- **Forms**: [React Hook Form](https://react-hook-form.com/)
- **Validation**: [Zod](https://zod.dev/)

### Design Inspiration

- [Linear](https://linear.app/) - Clean interfaces
- [Raycast](https://www.raycast.com/) - Beautiful dark mode
- [Vercel](https://vercel.com/) - Minimal design patterns

---

## ✅ Implementation Checklist

- [ ] Dependencies installed
- [ ] Tailwind configured
- [ ] Global CSS added
- [ ] Theme toggle implemented
- [ ] Theme persistence working
- [ ] System preference detection active
- [ ] Button component created
- [ ] Form components styled
- [ ] Layout patterns established
- [ ] Navigation implemented
- [ ] Feedback components added
- [ ] Responsive design tested
- [ ] Accessibility verified
- [ ] Performance optimized

---

**Version:** 4.0.0 Universal
**Status:** Production Ready ✅
**Last Updated:** 2025-01-03
**License:** Free for any project (commercial or personal)