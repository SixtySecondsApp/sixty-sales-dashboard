# Universal Design System v3.0
## Super Clean Light Mode + Glassmorphic Dark Mode

> A production-ready design system featuring super clean light mode and modern glassmorphic dark mode. Framework-agnostic, easy to implement, zero gradients.

---

## 📋 Table of Contents

1. [Quick Start](#quick-start)
2. [Installation](#installation)
3. [Theme System](#theme-system)
4. [Color Tokens](#color-tokens)
5. [Button System](#button-system)
6. [Typography](#typography)
7. [Components](#components)
8. [Layout Patterns](#layout-patterns)
9. [Framework Integration](#framework-integration)
10. [Troubleshooting](#troubleshooting)

---

## 🚀 Quick Start

### Core Principles

**Light Mode:**
- ✨ Pure white backgrounds (#ffffff)
- 🎯 High contrast text (gray-900)
- 💪 Solid button colors
- 🎨 Minimal gray usage
- 🚫 No gradients

**Dark Mode:**
- 🌑 Deep dark backgrounds (gray-950)
- ✨ Glassmorphic cards with blur
- 💎 Translucent surfaces
- 🔮 Subtle borders with opacity

---

## 📦 Installation

### Step 1: Install Dependencies

```bash
# Using npm
npm install tailwindcss class-variance-authority clsx tailwind-merge

# Using pnpm
pnpm add tailwindcss class-variance-authority clsx tailwind-merge

# Using yarn
yarn add tailwindcss class-variance-authority clsx tailwind-merge
```

### Step 2: Tailwind Configuration

Create or update `tailwind.config.js`:

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
        // You can add custom colors here if needed
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
```

### Step 3: Global CSS

Create or update your global CSS file (e.g., `globals.css`):

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Import Inter font */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

/* Root theme variables */
:root {
  color-scheme: light dark;
}

/* Smooth theme transitions */
* {
  @apply transition-colors duration-200 ease-in-out;
}

/* Prevent transition on page load */
.no-transition * {
  transition: none !important;
}

/* Ensure proper backgrounds */
[data-theme="light"] {
  background-color: #ffffff;
}

[data-theme="dark"] {
  background-color: #030712;
}

/* Typography defaults */
body {
  @apply font-sans antialiased;
}

/* Remove default focus outline, we'll use ring instead */
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

### Step 4: Utility Function (optional but recommended)

Create `lib/utils.ts`:

```typescript
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

---

## 🎨 Theme System

### Theme Toggle Component

Create `components/theme-toggle.tsx`:

```tsx
'use client' // Remove if not using Next.js App Router

import { Moon, Sun } from 'lucide-react' // or your icon library
import { useEffect, useState } from 'react'

export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    
    // Check localStorage first, then system preference
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

  // Prevent hydration mismatch
  if (!mounted) {
    return <div className="w-10 h-10" />
  }

  return (
    <button
      onClick={toggleTheme}
      className="inline-flex items-center justify-center rounded-lg w-10 h-10
                 bg-transparent text-gray-700 dark:text-gray-300 
                 hover:bg-gray-100 dark:hover:bg-gray-800/30 
                 transition-colors"
      aria-label="Toggle theme"
    >
      {theme === 'light' ? (
        <Moon className="w-5 h-5" />
      ) : (
        <Sun className="w-5 h-5" />
      )}
    </button>
  )
}
```

### Root Layout Setup

For Next.js App Router (`app/layout.tsx`):

```tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-white dark:bg-gray-950 
                       text-gray-900 dark:text-gray-100
                       min-h-screen">
        {children}
      </body>
    </html>
  )
}
```

For Next.js Pages Router (`pages/_app.tsx`):

```tsx
import type { AppProps } from 'next/app'
import '@/styles/globals.css'

export default function App({ Component, pageProps }: AppProps) {
  return (
    <div className="bg-white dark:bg-gray-950 
                    text-gray-900 dark:text-gray-100
                    min-h-screen">
      <Component {...pageProps} />
    </div>
  )
}
```

For React/Vite (`App.tsx`):

```tsx
function App() {
  return (
    <div className="bg-white dark:bg-gray-950 
                    text-gray-900 dark:text-gray-100
                    min-h-screen">
      {/* Your app */}
    </div>
  )
}
```

---

## 🎯 Color Tokens

### Light Mode Colors

```css
/* Backgrounds */
--white: #ffffff          /* Primary background */
--gray-50: #f9fafb       /* Subtle backgrounds */
--gray-100: #f3f4f6      /* Hover states */

/* Borders */
--gray-200: #e5e7eb      /* Primary borders */
--gray-300: #d1d5db      /* Emphasized borders */

/* Text */
--gray-900: #111827      /* Primary text */
--gray-700: #374151      /* Secondary text */
--gray-500: #6b7280      /* Tertiary text */
--gray-400: #9ca3af      /* Muted text */

/* Semantic Colors */
--blue-600: #2563eb      /* Primary actions */
--emerald-600: #059669   /* Success actions */
--red-600: #dc2626       /* Destructive actions */
```

### Dark Mode Colors

```css
/* Backgrounds */
--gray-950: #030712      /* Primary background */
--gray-900: #111827      /* Card backgrounds */
--gray-800: #1f2937      /* Elevated surfaces */

/* Borders */
--gray-700: #374151      /* Primary borders */
--gray-600: #4b5563      /* Emphasized borders */

/* Text */
--gray-100: #f3f4f6      /* Primary text */
--gray-300: #d1d5db      /* Secondary text */
--gray-400: #9ca3af      /* Tertiary text */

/* Semantic Colors */
--blue-400: #60a5fa      /* Primary actions */
--emerald-400: #34d399   /* Success actions */
--red-400: #f87171       /* Destructive actions */
```

---

## 🔘 Button System

### Button Component

Create `components/ui/button.tsx`:

```tsx
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils" // or your utils path

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed",
  {
    variants: {
      variant: {
        // PRIMARY - Solid blue (light) / Blue glow (dark)
        default:
          "bg-blue-600 dark:bg-blue-500/10 text-white dark:text-blue-400 border border-blue-600 dark:border-blue-500/20 hover:bg-blue-700 dark:hover:bg-blue-500/20 hover:border-blue-700 dark:hover:border-blue-500/30 shadow-sm dark:shadow-none focus-visible:ring-blue-500",
        
        // SUCCESS - Solid emerald (light) / Emerald glow (dark)
        success:
          "bg-emerald-600 dark:bg-emerald-500/10 text-white dark:text-emerald-400 border border-emerald-600 dark:border-emerald-500/20 hover:bg-emerald-700 dark:hover:bg-emerald-500/20 hover:border-emerald-700 dark:hover:border-emerald-500/30 shadow-sm dark:shadow-none focus-visible:ring-emerald-500",
        
        // DESTRUCTIVE - Solid red (light) / Red glow (dark)
        destructive:
          "bg-red-600 dark:bg-red-600/10 text-white dark:text-red-400 border border-red-600 dark:border-red-600/20 hover:bg-red-700 dark:hover:bg-red-600/20 hover:border-red-700 dark:hover:border-red-600/30 shadow-sm dark:shadow-none focus-visible:ring-red-500",
        
        // DANGER - Same as destructive
        danger:
          "bg-red-600 dark:bg-red-500/10 text-white dark:text-red-400 border border-red-600 dark:border-red-500/20 hover:bg-red-700 dark:hover:bg-red-500/20 hover:border-red-700 dark:hover:border-red-500/30 shadow-sm dark:shadow-none focus-visible:ring-red-500",
        
        // SECONDARY - Clean bordered
        secondary:
          "bg-white dark:bg-gray-600/10 text-gray-900 dark:text-gray-400 border border-gray-300 dark:border-gray-500/20 hover:bg-gray-50 dark:hover:bg-gray-600/20 hover:border-gray-400 dark:hover:border-gray-500/30 shadow-sm dark:shadow-none focus-visible:ring-gray-500",
        
        // TERTIARY - Subtle gray
        tertiary:
          "bg-gray-50 dark:bg-gray-800/50 text-gray-700 dark:text-gray-400 border border-gray-200 dark:border-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:border-gray-300 dark:hover:border-gray-600/50 focus-visible:ring-gray-500",
        
        // GHOST - Minimal
        ghost:
          "bg-transparent text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/30 hover:text-gray-900 dark:hover:text-white focus-visible:ring-gray-500",
        
        // OUTLINE - Alternative
        outline:
          "bg-white dark:bg-gray-700/10 text-gray-900 dark:text-gray-300 border border-gray-300 dark:border-gray-600/20 hover:bg-gray-50 dark:hover:bg-gray-700/20 hover:border-gray-400 dark:hover:border-gray-500/30 focus-visible:ring-gray-500",
        
        // LINK - Text only
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
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

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

### Button Usage

```tsx
import { Button } from '@/components/ui/button'
import { Plus, Trash2, Download } from 'lucide-react'

// Primary action
<Button variant="default">
  <Download className="w-4 h-4 mr-2" />
  Export Data
</Button>

// Success action
<Button variant="success">
  <Plus className="w-4 h-4 mr-2" />
  Add Item
</Button>

// Destructive action
<Button variant="destructive">
  <Trash2 className="w-4 h-4 mr-2" />
  Delete Selected
</Button>

// Secondary action
<Button variant="secondary">
  Cancel
</Button>

// Icon only
<Button variant="ghost" size="icon">
  <Trash2 className="w-4 h-4" />
</Button>
```

---

## 📝 Typography

### Text Color Classes

**Always use these combinations:**

```tsx
/* Primary heading/text */
<h1 className="text-gray-900 dark:text-gray-100">
  Main Heading
</h1>

/* Secondary text */
<p className="text-gray-700 dark:text-gray-300">
  Body text with good readability
</p>

/* Tertiary/muted text */
<span className="text-gray-500 dark:text-gray-400">
  Helper text or captions
</span>

/* Very muted */
<span className="text-gray-400 dark:text-gray-500">
  Disabled or very subtle text
</span>
```

### Font Sizes

```tsx
/* Page title */
<h1 className="text-3xl font-bold">Title</h1>

/* Section heading */
<h2 className="text-2xl font-semibold">Section</h2>

/* Card title */
<h3 className="text-xl font-semibold">Card Title</h3>

/* Body text */
<p className="text-base">Body text</p>

/* Small text */
<p className="text-sm">Secondary information</p>

/* Tiny text */
<p className="text-xs">Captions or labels</p>
```

---

## 🎨 Components

### Card Component

```tsx
// Basic card
<div className="bg-white dark:bg-gray-900/80 
                backdrop-blur-sm 
                border border-gray-200 dark:border-gray-700/50 
                rounded-xl p-6
                shadow-sm dark:shadow-none">
  <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
    Card Title
  </h3>
  <p className="text-gray-700 dark:text-gray-300">
    Card content goes here
  </p>
</div>

// Interactive card
<div className="bg-white dark:bg-gray-900/80 
                backdrop-blur-sm 
                border border-gray-200 dark:border-gray-700/50 
                rounded-xl p-6
                shadow-sm dark:shadow-none
                transition-all duration-300 
                hover:border-blue-400 dark:hover:border-blue-500/30 
                hover:shadow-md dark:hover:shadow-none
                hover:-translate-y-1
                cursor-pointer">
  <!-- Card content -->
</div>
```

### Input Fields

```tsx
// Label
<label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
  Email Address
</label>

// Input
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

// Textarea
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

// Select
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
</select>
```

### Tables

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
      </tr>
    </thead>
    <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
      <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
        <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-gray-100">
          John Doe
        </td>
        <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
          Active
        </td>
      </tr>
    </tbody>
  </table>
</div>
```

### Badges

```tsx
// Success
<span className="px-2.5 py-1 
                 bg-emerald-50 dark:bg-emerald-500/10 
                 text-emerald-700 dark:text-emerald-400 
                 border border-emerald-200 dark:border-emerald-500/20
                 rounded-full text-xs font-semibold">
  Active
</span>

// Warning
<span className="px-2.5 py-1 
                 bg-yellow-50 dark:bg-yellow-500/10 
                 text-yellow-700 dark:text-yellow-400 
                 border border-yellow-200 dark:border-yellow-500/20
                 rounded-full text-xs font-semibold">
  Pending
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
```

### Modals/Dialogs

```tsx
// Overlay
<div className="fixed inset-0 bg-gray-900/50 dark:bg-black/60 
                backdrop-blur-sm z-40" 
     onClick={onClose} />

// Modal container
<div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
                bg-white dark:bg-gray-900/95 
                backdrop-blur-sm 
                border border-gray-200 dark:border-gray-700/50 
                rounded-xl p-6 max-w-md w-full 
                shadow-2xl z-50">
  
  {/* Header */}
  <div className="flex items-center justify-between mb-4">
    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
      Modal Title
    </h2>
    <button 
      onClick={onClose}
      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 
                 transition-colors">
      <X className="w-5 h-5" />
    </button>
  </div>

  {/* Content */}
  <p className="text-gray-700 dark:text-gray-300 mb-6">
    Modal content goes here
  </p>

  {/* Actions */}
  <div className="flex justify-end gap-3">
    <Button variant="secondary" onClick={onClose}>
      Cancel
    </Button>
    <Button variant="default" onClick={onConfirm}>
      Confirm
    </Button>
  </div>
</div>
```

### Navigation Sidebar

```tsx
<aside className="w-64 h-full 
                  bg-white dark:bg-gray-900 
                  border-r border-gray-200 dark:border-gray-800">
  
  {/* Navigation item - INACTIVE */}
  <button className="w-full flex items-center gap-3 px-4 py-2.5 
                     text-gray-700 dark:text-gray-400
                     hover:bg-gray-50 dark:hover:bg-gray-800/50
                     transition-colors rounded-lg">
    <Icon className="w-5 h-5" />
    <span className="text-sm font-medium">Dashboard</span>
  </button>
  
  {/* Navigation item - ACTIVE */}
  <button className="w-full flex items-center gap-3 px-4 py-2.5 
                     bg-blue-50 dark:bg-blue-500/10
                     text-blue-600 dark:text-blue-400
                     border border-blue-200 dark:border-blue-500/20
                     transition-colors rounded-lg">
    <Icon className="w-5 h-5" />
    <span className="text-sm font-semibold">Activity</span>
  </button>
</aside>
```

---

## 📐 Layout Patterns

### Page Container

```tsx
<div className="min-h-screen bg-white dark:bg-gray-950">
  <div className="p-8 max-w-7xl mx-auto">
    {/* Page content */}
  </div>
</div>
```

### Split Layout (Sidebar + Main)

```tsx
<div className="flex h-screen bg-white dark:bg-gray-950">
  {/* Sidebar */}
  <aside className="w-64 border-r border-gray-200 dark:border-gray-800 
                    bg-white dark:bg-gray-900">
    {/* Navigation */}
  </aside>
  
  {/* Main content */}
  <main className="flex-1 overflow-y-auto bg-white dark:bg-gray-950 p-8">
    {/* Content */}
  </main>
</div>
```

### Grid Layouts

```tsx
// Responsive grid
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
  {/* Grid items */}
</div>

// Auto-fit grid
<div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-6">
  {/* Grid items */}
</div>
```

---

## 🔧 Framework Integration

### Next.js Setup

1. Install dependencies
2. Add theme toggle to your layout
3. Use `suppressHydrationWarning` on `<html>` tag

```tsx
// app/layout.tsx
import { ThemeToggle } from '@/components/theme-toggle'

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <nav className="border-b border-gray-200 dark:border-gray-800">
          <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between">
            <div>Logo</div>
            <ThemeToggle />
          </div>
        </nav>
        {children}
      </body>
    </html>
  )
}
```

### Vite + React Setup

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

// App.tsx
import { ThemeToggle } from './components/theme-toggle'

function App() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <nav className="border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between">
          <div>Logo</div>
          <ThemeToggle />
        </div>
      </nav>
      {/* Your app */}
    </div>
  )
}
```

### Vue Setup

```vue
<!-- ThemeToggle.vue -->
<script setup lang="ts">
import { ref, onMounted } from 'vue'

const theme = ref<'light' | 'dark'>('light')

onMounted(() => {
  const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null
  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches 
    ? 'dark' 
    : 'light'
  
  const initialTheme = savedTheme || systemTheme
  theme.value = initialTheme
  document.documentElement.setAttribute('data-theme', initialTheme)
})

const toggleTheme = () => {
  const newTheme = theme.value === 'light' ? 'dark' : 'light'
  theme.value = newTheme
  document.documentElement.setAttribute('data-theme', newTheme)
  localStorage.setItem('theme', newTheme)
}
</script>

<template>
  <button
    @click="toggleTheme"
    class="inline-flex items-center justify-center rounded-lg w-10 h-10
           bg-transparent text-gray-700 dark:text-gray-300 
           hover:bg-gray-100 dark:hover:bg-gray-800/30"
  >
    <component :is="theme === 'light' ? 'MoonIcon' : 'SunIcon'" class="w-5 h-5" />
  </button>
</template>
```

---

## 🐛 Troubleshooting

### Issue: Theme flashes on page load

**Solution:** Add this script to your `<head>`:

```html
<script>
  (function() {
    const theme = localStorage.getItem('theme') || 
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
  })();
</script>
```

### Issue: Buttons look faint in light mode

**Fix:** Ensure you're using the correct button variants from v3.0. Buttons should have solid backgrounds in light mode:
- `default` → `bg-blue-600` (solid blue)
- `success` → `bg-emerald-600` (solid emerald)
- `destructive` → `bg-red-600` (solid red)

### Issue: Text is white-on-white

**Fix:** Always use theme-aware text colors:
```tsx
className="text-gray-900 dark:text-gray-100"
```

### Issue: Transitions are too slow

**Fix:** Adjust the transition duration in your global CSS:
```css
* {
  @apply transition-colors duration-150; /* Faster */
}
```

### Issue: Active navigation isn't visible

**Fix:** Use the correct active state colors:
```tsx
className="bg-blue-50 dark:bg-blue-500/10 
           text-blue-600 dark:text-blue-400
           border border-blue-200 dark:border-blue-500/20"
```

---

## ✅ Implementation Checklist

### Pre-Launch Checklist

- [ ] Tailwind CSS installed and configured
- [ ] Global CSS file created with theme styles
- [ ] Theme toggle component added
- [ ] Button component created with all variants
- [ ] Root layout has proper background colors
- [ ] All text uses theme-aware color classes
- [ ] Forms have proper styling in both themes
- [ ] Tables have proper styling in both themes
- [ ] Navigation active states are visible
- [ ] Modals/dialogs are styled correctly
- [ ] Theme persistence works (localStorage)
- [ ] System preference detection works
- [ ] No hydration mismatches (SSR apps)
- [ ] Tested in both light and dark mode
- [ ] All interactive states work (hover, focus, disabled)

---

## 📖 Reference

### Quick Copy-Paste Classes

```tsx
/* Page background */
"bg-white dark:bg-gray-950"

/* Card */
"bg-white dark:bg-gray-900/80 backdrop-blur-sm border border-gray-200 dark:border-gray-700/50 rounded-xl p-6 shadow-sm dark:shadow-none"

/* Primary text */
"text-gray-900 dark:text-gray-100"

/* Secondary text */
"text-gray-700 dark:text-gray-300"

/* Border */
"border-gray-200 dark:border-gray-700/50"

/* Hover background */
"hover:bg-gray-50 dark:hover:bg-gray-800/30"

/* Active nav item */
"bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20"

/* Input */
"bg-white dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700/50 text-gray-900 dark:text-gray-100"
```

---

## 🎯 Design Tokens Summary

| Element | Light Mode | Dark Mode |
|---------|-----------|-----------|
| **Page BG** | `white` | `gray-950` |
| **Card BG** | `white/85` blur | `gray-900/80` blur |
| **Border** | `gray-200` | `gray-700/50` |
| **Text Primary** | `gray-900` | `gray-100` |
| **Text Secondary** | `gray-700` | `gray-300` |
| **Button Primary** | Solid `blue-600` | Glow `blue-500/10` |
| **Button Success** | Solid `emerald-600` | Glow `emerald-500/10` |
| **Button Destructive** | Solid `red-600` | Glow `red-600/10` |
| **Nav Active** | `blue-50` bg, `blue-600` text | `blue-500/10` bg, `blue-400` text |
| **Table Header** | `gray-50` | `gray-800/50` |
| **Table Hover** | `gray-50` | `gray-800/30` |

---

## 📚 Additional Resources

### Recommended Icons
- [Lucide React](https://lucide.dev/) - Clean, consistent icons
- [Heroicons](https://heroicons.com/) - Beautiful hand-crafted SVG icons

### Recommended Fonts
- [Inter](https://fonts.google.com/specimen/Inter) - Clean, readable (default)
- [Plus Jakarta Sans](https://fonts.google.com/specimen/Plus+Jakarta+Sans) - Modern alternative

### Design Inspiration
- [Linear](https://linear.app/) - Clean light mode inspiration
- [Raycast](https://www.raycast.com/) - Beautiful dark mode reference
- [Vercel](https://vercel.com/) - Minimal design patterns

---

## 📄 License

This design system is free to use in any project, commercial or personal.

---

## 🔄 Version History

**v3.0.0** - 2025-10-29
- Universal design system for any project
- Framework-agnostic implementation
- Complete setup instructions
- Troubleshooting guide
- Production-ready components

**v2.1.0** - 2025-10-29
- Super clean light mode
- Pure white backgrounds
- Solid button colors
- High contrast throughout

**v2.0.0** - 2025-10-29
- Added light mode support
- Dual theme system

**v1.0.0** - 2025-10-29
- Initial dark mode design system

---

**Last Updated:** 2025-10-29  
**Version:** 3.0.0  
**Status:** Production Ready ✅