# Sixty Sales Dashboard Design System v4.0
## Clean Light Mode + Premium Glassmorphic Dark Mode

> Production-ready design system with clean, minimal light mode and premium glassmorphic dark mode. Optimized for enterprise SaaS applications with Inter font family and consistent backdrop blur effects.

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
- ✨ Pure white (#FFFFFF) and off-white (#FCFCFC) backgrounds
- 🎯 High contrast text (gray-900 primary, gray-700 secondary)
- 💪 Clean borders with gray-200 and gray-300
- 🎨 Minimal shadows, clean aesthetic
- 📱 Mobile-first responsive design

**Dark Mode (Glassmorphism):**
- 🌑 Deep dark backgrounds (gray-950: #030712)
- ✨ Glassmorphic cards: `bg-gray-900/80 backdrop-blur-sm`
- 💎 Premium glass surfaces: `rgba(20, 28, 36, 0.6)` with `backdrop-filter: blur(16px)`
- 🔮 Subtle borders: `border-gray-700/50` with opacity
- ⚡ Smooth transitions and hover effects
- 🎭 Inset highlights: `inset 0 1px 0 rgba(255, 255, 255, 0.05)`

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
/* Backgrounds - Cleaner, more professional greys */
--bg-primary: 255 255 255;           /* Pure white (#FFFFFF) */
--bg-secondary: 250 250 250;         /* Clean off-white (#FAFAFA) */
--bg-tertiary: 249 250 251;          /* Cleaner gray-50 (#F9FAFB) */
--bg-elevated: 255 255 255;          /* White */

/* Surfaces (Glassmorphism) */
--surface-glass: 255 255 255;        /* White base for glass */
--surface-opacity: 0.85;             /* Glass opacity for light mode */

/* Borders - Cleaner, lighter borders */
--border-primary: 229 231 235;       /* Gray-200 (#E5E7EB) */
--border-secondary: 243 244 246;     /* Lighter Gray-100 for subtle borders */

/* Text */
--text-primary: 17 24 39;            /* Gray-900 (#111827) */
--text-secondary: 55 65 81;          /* Gray-700 (#374151) */
--text-tertiary: 107 114 128;        /* Gray-500 (#6B7280) */
--text-muted: 156 163 175;           /* Gray-400 (#9CA3AF) */

/* Semantic Colors */
--color-primary: #2563eb;            /* Blue-600 - Primary actions */
--color-primary-hover: #1d4ed8;      /* Blue-700 - Primary hover */
--color-bg-dark: #ffffff;            /* White background */
--color-bg-secondary: #fcfcfc;       /* Off-white secondary */
--color-card-bg: rgba(255, 255, 255, 0.85);  /* Card background */
--color-border: rgba(229, 231, 235, 1);      /* Border color */
--color-text-white: #111827;         /* Primary text (dark on light) */
--color-text-light: #374151;         /* Secondary text */
--color-text-muted: #6b7280;         /* Muted text */
--color-accent-green: #059669;       /* Emerald-600 - Success */
--color-accent-red: #dc2626;         /* Red-600 - Destructive */
--color-accent-yellow: #d97706;      /* Amber-600 - Warning */
--color-accent-purple: #7c3aed;      /* Violet-600 - Info */
--color-accent-orange: #ea580c;      /* Orange-600 - Alert */
```

### Dark Mode Colors (Glassmorphism)

```css
/* Backgrounds */
--bg-primary: #030712           /* Gray-950 - rgb(3 7 18) */
--bg-secondary: #111827         /* Gray-900 - rgb(17 24 39) */
--bg-tertiary: #1F2937          /* Gray-800 - rgb(31 41 55) */
--bg-elevated: #1F2937          /* Gray-800 for elevated surfaces */

/* Surfaces (Glassmorphism) */
--surface-glass: rgba(17, 24, 39, 0.8)      /* Gray-900 glass base */
--surface-glass-premium: rgba(20, 28, 36, 0.6)  /* Premium glass effect */
--surface-opacity: 0.8                       /* Glass opacity for dark mode */

/* Borders */
--border-primary: rgba(55, 65, 81, 0.5)     /* Gray-700/50 */
--border-secondary: rgba(75, 85, 99, 0.5)   /* Gray-600/50 */

/* Text */
--text-primary: #F3F4F6         /* Gray-100 - rgb(243 244 246) */
--text-secondary: #D1D5DB       /* Gray-300 - rgb(209 213 219) */
--text-tertiary: #9CA3AF        /* Gray-400 - rgb(156 163 175) */
--text-muted: #6B7280           /* Gray-500 - rgb(107 114 128) */

/* Semantic Colors */
--color-primary: #3DA8F4        /* Blue-400 - Primary actions */
--color-accent-green: #10B981   /* Emerald-500 - Success */
--color-accent-red: #EF4444     /* Red-500 - Destructive */
--color-accent-yellow: #F59E0B  /* Amber-500 - Warning */
--color-accent-purple: #8B5CF6  /* Violet-500 - Info */
--color-accent-orange: #F97316  /* Orange-500 - Alert */
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

### Card Component (Glassmorphism)

```tsx
// Standard Glassmorphic Card
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

// Premium Glassmorphic Card (Dark Mode)
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

// Interactive Clickable Card
<div className="bg-white dark:bg-gray-900/80
                backdrop-blur-sm
                border border-gray-200 dark:border-gray-700/50
                rounded-xl p-6
                shadow-sm dark:shadow-none
                transition-all duration-300
                hover:scale-[1.02] hover:shadow-lg
                dark:hover:shadow-black/20
                cursor-pointer">
  <!-- Card content -->
</div>

// Section Card (Custom Glassmorphism Class)
<div className="section-card">
  <!-- Automatically applies glassmorphism in dark mode -->
  <!-- Clean white background in light mode -->
</div>

// Dashboard Card with Gradient Overlays (Advanced)
<div className="relative backdrop-blur-xl bg-gray-900/40 rounded-3xl p-6 md:p-8
                border border-gray-800/50
                hover:border-[#37bd7e]/50 transition-all duration-300 group
                hover:shadow-2xl hover:shadow-[#37bd7e]/20 overflow-hidden cursor-pointer">
  {/* Background gradient layers */}
  <div className="absolute inset-0 bg-gradient-to-br from-gray-900/95 via-gray-900/75 to-gray-900/40 rounded-3xl" />
  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(74,74,117,0.25),transparent)] rounded-3xl" />
  {/* Glow effect on hover */}
  <div className="absolute -right-20 -top-20 w-40 h-40 blur-3xl rounded-full transition-all duration-500
                  bg-emerald-500/10 group-hover:bg-emerald-500/20" />
  {/* Content */}
</div>

// Contact/Deal Card with Selection State
<div className={`bg-white dark:bg-gray-900/80 backdrop-blur-sm rounded-xl p-4
                 border transition-all duration-300 group
                 shadow-sm dark:shadow-none cursor-pointer ${
  isSelected
    ? 'border-emerald-500 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/5'
    : 'border-gray-200 dark:border-gray-700/50 hover:border-emerald-500 dark:hover:border-emerald-500/30'
}`}>
  <!-- Card content -->
</div>

// Rank Card with Position-Based Colors
const getRankColor = (rank: number) => {
  switch (rank) {
    case 1: // Gold
      return 'bg-white dark:from-gray-800/60 dark:to-gray-800/40 dark:bg-gradient-to-br border-[#E2E8F0] dark:border-yellow-500/30 shadow-[0_4px_6px_-1px_rgba(234,179,8,0.1)] ring-1 ring-yellow-200/50 dark:ring-0';
    case 2: // Silver
      return 'bg-white dark:from-gray-800/50 dark:to-gray-800/30 dark:bg-gradient-to-br border-[#E2E8F0] dark:border-gray-600/30 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.05)]';
    case 3: // Bronze
      return 'bg-white dark:from-gray-800/50 dark:to-gray-800/30 dark:bg-gradient-to-br border-[#E2E8F0] dark:border-amber-500/30 shadow-[0_4px_6px_-1px_rgba(217,119,6,0.08)] ring-1 ring-amber-200/50 dark:ring-0';
    default:
      return 'bg-white dark:bg-gray-800/40 border-[#E2E8F0] dark:border-gray-700/30 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.05)]';
  }
};
```

### Glassmorphism CSS Classes

```css
/* Premium Glassmorphism - Dark Mode Only */
.glassmorphism {
  background: rgba(20, 28, 36, 0.6);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(45, 62, 78, 0.4);
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

/* Light Glassmorphism - Dark Mode Only */
.glassmorphism-light {
  background: rgba(30, 40, 52, 0.5);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(55, 75, 95, 0.3);
  box-shadow:
    0 4px 24px rgba(0, 0, 0, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.03);
}

/* Section Card - Theme-Aware */
[data-theme="dark"] .section-card {
  background: rgba(20, 28, 36, 0.6);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(45, 62, 78, 0.4);
  border-radius: 1rem;
  padding: 1.5rem;
  transition: all 0.3s ease;
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

[data-theme="dark"] .section-card:hover {
  transform: translateY(-2px);
  box-shadow:
    0 12px 40px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

/* Tailwind-based glassmorphism utility classes */
.section-card {
  @apply bg-white dark:bg-gradient-to-br dark:from-gray-900/60 dark:to-gray-800/30
         backdrop-blur-xl rounded-xl p-6 border border-gray-200 dark:border-gray-800/50
         transition-all duration-300 hover:shadow-lg hover:shadow-black/20;
}

.glassmorphism {
  @apply bg-white dark:bg-gray-900/50 backdrop-blur-xl border border-gray-200 dark:border-gray-800/50;
}

.glassmorphism-light {
  @apply bg-white dark:bg-gray-800/40 backdrop-blur-sm border border-gray-200 dark:border-gray-700/30;
}

.glassmorphism-card {
  @apply bg-white dark:bg-gray-900/60 backdrop-blur-xl rounded-2xl border border-gray-200 dark:border-gray-700/30 shadow-lg;
}

.lead-owner-card {
  @apply bg-gradient-to-br from-blue-900/20 to-blue-800/10 backdrop-blur-xl rounded-xl p-6 border border-blue-500/20;
}

.activity-metric {
  @apply bg-gradient-to-br from-blue-500/10 to-purple-500/10 backdrop-blur-sm rounded-lg p-4 border border-blue-500/20;
}

.ai-insights-card {
  @apply bg-gradient-to-br from-blue-900/20 to-purple-900/20 backdrop-blur-xl rounded-xl border border-blue-500/20;
}

/* Strong backdrop blur effect */
.backdrop-blur-strong {
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

/* Floating action button with glass effect */
.floating-action-button {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 3.5rem;
  height: 3.5rem;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--color-primary) 0%, #2563eb 100%);
  color: white;
  box-shadow:
    0 8px 32px rgba(61, 168, 244, 0.4),
    0 4px 16px rgba(0, 0, 0, 0.3);
  transition: all 0.3s ease;
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: none;
  cursor: pointer;
}

/* Activity metric card with gradient */
.activity-metric {
  background: linear-gradient(135deg, rgba(61, 168, 244, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(61, 168, 244, 0.2);
  border-radius: 0.75rem;
  padding: 1rem;
}
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

### Modals/Dialogs (Glassmorphism)

```tsx
// Dialog Overlay (with stronger backdrop blur)
<div className="fixed inset-0 z-50
                bg-gray-900/40 dark:bg-black/80
                backdrop-blur-sm
                data-[state=open]:animate-in
                data-[state=closed]:animate-out
                data-[state=closed]:fade-out-0
                data-[state=open]:fade-in-0" />

// Dialog Content (Premium Glassmorphism)
<div className="fixed left-[50%] top-[50%] z-50
                grid w-full max-w-lg
                translate-x-[-50%] translate-y-[-50%]
                gap-4
                border bg-white/95 dark:bg-gray-900/95
                backdrop-blur-sm
                border-gray-200 dark:border-gray-700/50
                text-gray-900 dark:text-gray-100
                p-6
                shadow-lg dark:shadow-none
                duration-200
                sm:rounded-lg">

  {/* Header */}
  <div className="flex items-center justify-between">
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
  <p className="text-gray-700 dark:text-gray-300">
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

// Alert Dialog Content (Shadcn UI Compatible)
<AlertDialogContent className="bg-white/95 dark:bg-gray-900/95
                                backdrop-blur-sm
                                border-gray-200 dark:border-gray-700/50
                                sm:rounded-xl">
  <AlertDialogHeader>
    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
    <AlertDialogDescription>
      This action cannot be undone.
    </AlertDialogDescription>
  </AlertDialogHeader>
  <AlertDialogFooter>
    <AlertDialogCancel>Cancel</AlertDialogCancel>
    <AlertDialogAction>Continue</AlertDialogAction>
  </AlertDialogFooter>
</AlertDialogContent>

// Popover (with Glassmorphism)
<PopoverContent className="z-50 w-72 rounded-md
                          border bg-white/95 dark:bg-gray-900/95
                          border-gray-200 dark:border-gray-700/50
                          backdrop-blur-sm
                          p-4
                          text-gray-900 dark:text-gray-100
                          shadow-md dark:shadow-none">
  <div className="space-y-2">
    <h4 className="font-medium">Popover Title</h4>
    <p className="text-sm text-gray-700 dark:text-gray-300">
      Popover content goes here
    </p>
  </div>
</PopoverContent>
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

### Skeleton Loaders

```tsx
// Base Skeleton Component
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-muted', className)}
      {...props}
    />
  );
}

// Theme-Aware Skeleton Card
const SkeletonCard = ({ isDark }: { isDark: boolean }) => {
  const skeletonColors = {
    bg: isDark ? 'bg-gray-900/80' : 'bg-white',
    border: isDark ? 'border-gray-700/50' : 'border-gray-200',
    element: isDark ? 'bg-gray-800' : 'bg-gray-200',
  };

  return (
    <div className={`backdrop-blur-sm rounded-xl p-6 border animate-pulse
                     shadow-sm ${isDark ? 'shadow-none' : ''}
                     ${skeletonColors.bg} ${skeletonColors.border}`}>
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-lg ${skeletonColors.element}`} />
        <div className="flex-1">
          <div className={`h-4 w-20 rounded-lg mb-2 ${skeletonColors.element}`} />
          <div className={`h-6 w-16 rounded-lg mb-1 ${skeletonColors.element}`} />
          <div className={`h-3 w-12 rounded-lg ${skeletonColors.element}`} />
        </div>
      </div>
    </div>
  );
};

// Skeleton Grid for Stats
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
  {[1, 2, 3, 4].map((i) => (
    <SkeletonCard key={i} isDark={isDark} />
  ))}
</div>
```

### Shimmer Animation

```css
/* Add to tailwind.config.js keyframes */
keyframes: {
  shimmer: {
    '0%': { backgroundPosition: '-200% 0' },
    '100%': { backgroundPosition: '200% 0' }
  }
}

animation: {
  'shimmer': 'shimmer 2s infinite linear'
}
```

```tsx
// Progress bar with shimmer effect
<div className="h-2 bg-gray-100 dark:bg-gray-800/50 rounded-full overflow-hidden">
  <div
    className="h-full rounded-full transition-all duration-700 relative overflow-hidden
               bg-gradient-to-r from-[#37bd7e] to-[#2da76c]
               after:absolute after:inset-0
               after:bg-gradient-to-r after:from-transparent after:via-white/30 after:to-transparent
               after:animate-shimmer"
    style={{ width: `${progress}%` }}
  />
</div>
```

### Theme Transition Effects

```css
/* Smooth theme switching - add to globals.css */
.theme-transition,
.theme-transition *,
.theme-transition *::before,
.theme-transition *::after {
  transition: background-color 300ms ease-in-out,
              border-color 300ms ease-in-out,
              color 300ms ease-in-out,
              fill 300ms ease-in-out,
              stroke 300ms ease-in-out !important;
}
```

```tsx
// Theme toggle with transition class
<button
  onClick={toggleTheme}
  className={cn(
    "relative p-2 rounded-lg transition-all duration-300",
    "hover:bg-gray-50 dark:hover:bg-gray-800/30 hover:scale-110",
    "theme-transition"
  )}
>
  {/* icon */}
</button>
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
- [ ] Theme toggle component added with `.theme-transition` class
- [ ] Button component created with all variants
- [ ] Root layout has proper background colors (`#FFFFFF` / `#030712`)
- [ ] All text uses theme-aware color classes
- [ ] Forms have proper styling in both themes
- [ ] Tables have proper styling in both themes
- [ ] Navigation active states are visible
- [ ] Modals/dialogs are styled correctly with glassmorphism
- [ ] Theme persistence works (localStorage)
- [ ] System preference detection works
- [ ] No hydration mismatches (SSR apps)
- [ ] Tested in both light and dark mode
- [ ] All interactive states work (hover, focus, disabled)
- [ ] Skeleton loaders use theme-aware colors
- [ ] Shimmer animation configured in tailwind.config.js
- [ ] Cards have proper selection state styles
- [ ] Dashboard cards use gradient overlay patterns
- [ ] Theme transitions are smooth (300ms)

---

## 📖 Reference

### Quick Copy-Paste Classes

```tsx
/* Page background */
"bg-white dark:bg-gray-950"

/* Secondary page background */
"bg-[#FAFAFA] dark:bg-gray-900"

/* Standard Glassmorphic Card */
"bg-white dark:bg-gray-900/80 backdrop-blur-sm border border-gray-200 dark:border-gray-700/50 rounded-xl p-6 shadow-sm dark:shadow-none transition-all duration-300"

/* Premium Glassmorphic Card */
"bg-white dark:bg-gray-900/80 backdrop-blur-xl border border-gray-200 dark:border-gray-800/50 rounded-2xl p-6 shadow-sm dark:shadow-none transition-all duration-300"

/* Interactive Clickable Card */
"bg-white dark:bg-gray-900/80 backdrop-blur-sm border border-gray-200 dark:border-gray-700/50 rounded-xl p-6 shadow-sm dark:shadow-none transition-all duration-300 hover:scale-[1.02] hover:shadow-lg dark:hover:shadow-black/20 cursor-pointer"

/* Dashboard Card with Gradient Overlay */
"relative backdrop-blur-xl bg-gray-900/40 rounded-3xl p-6 md:p-8 border border-gray-800/50 hover:border-[#37bd7e]/50 transition-all duration-300 group hover:shadow-2xl hover:shadow-[#37bd7e]/20 overflow-hidden cursor-pointer"

/* Contact/Deal Card with Selection State */
"bg-white dark:bg-gray-900/80 backdrop-blur-sm rounded-xl p-4 border transition-all duration-300 group shadow-sm dark:shadow-none cursor-pointer border-gray-200 dark:border-gray-700/50 hover:border-emerald-500 dark:hover:border-emerald-500/30"

/* Selected Card State */
"border-emerald-500 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/5"

/* Section Card (uses custom class) */
"section-card"

/* Theme-Aware Skeleton Card */
"backdrop-blur-sm rounded-xl p-6 border animate-pulse shadow-sm dark:shadow-none bg-white dark:bg-gray-900/80 border-gray-200 dark:border-gray-700/50"

/* Skeleton Element (Light) */
"bg-gray-200 rounded-lg"

/* Skeleton Element (Dark) */
"bg-gray-800 rounded-lg"

/* Shimmer Progress Bar */
"h-full rounded-full transition-all duration-700 relative overflow-hidden bg-gradient-to-r from-[#37bd7e] to-[#2da76c] after:absolute after:inset-0 after:bg-gradient-to-r after:from-transparent after:via-white/30 after:to-transparent after:animate-shimmer"

/* Primary text */
"text-gray-900 dark:text-gray-100"

/* Secondary text */
"text-gray-700 dark:text-gray-300"

/* Tertiary text */
"text-gray-500 dark:text-gray-400"

/* Muted text */
"text-gray-400 dark:text-gray-500"

/* Border */
"border-gray-200 dark:border-gray-700/50"

/* Emphasized border */
"border-gray-300 dark:border-gray-800/50"

/* Hover background */
"hover:bg-gray-50 dark:hover:bg-gray-800/30"

/* Active nav item */
"bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20"

/* Input field */
"bg-white dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700/50 text-gray-900 dark:text-gray-100 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"

/* Select dropdown */
"bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border border-gray-200 dark:border-gray-700/50 text-gray-900 dark:text-gray-100 rounded-md"

/* Dialog/Modal overlay */
"fixed inset-0 z-50 bg-gray-900/40 dark:bg-black/80 backdrop-blur-sm"

/* Dialog/Modal content */
"bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border border-gray-200 dark:border-gray-700/50 text-gray-900 dark:text-gray-100 rounded-xl p-6 shadow-lg dark:shadow-none"

/* Popover content */
"bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border border-gray-200 dark:border-gray-700/50 text-gray-900 dark:text-gray-100 rounded-md p-4 shadow-md dark:shadow-none"

/* Toast/Notification */
"bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border border-gray-200 dark:border-gray-700/50 text-gray-900 dark:text-gray-100 shadow-lg"
```

### Theme-Aware Utility Classes

```tsx
/* Universal theme-aware backgrounds */
.theme-bg-primary       /* bg-white dark:bg-gray-950 */
.theme-bg-secondary     /* bg-[#FCFCFC] dark:bg-gray-900 */
.theme-bg-card          /* bg-white dark:bg-gray-900/80 backdrop-blur-sm */
.theme-bg-elevated      /* bg-white dark:bg-gray-800 */

/* Universal theme-aware borders */
.theme-border           /* border-gray-200 dark:border-gray-800/50 */
.theme-border-subtle    /* border-gray-300 dark:border-gray-700/50 */

/* Universal theme-aware text */
.theme-text-primary     /* text-gray-900 dark:text-gray-100 */
.theme-text-secondary   /* text-gray-700 dark:text-gray-300 */
.theme-text-tertiary    /* text-gray-500 dark:text-gray-400 */
.theme-text-muted       /* text-gray-400 dark:text-gray-500 */
```

---

## 🎯 Design Tokens Summary

| Element | Light Mode | Dark Mode (Glassmorphism) |
|---------|-----------|---------------------------|
| **Page BG** | `#FFFFFF` | `#030712` (gray-950) |
| **Secondary BG** | `#FAFAFA` (cleaner gray) | `#111827` (gray-900) |
| **Tertiary BG** | `#F9FAFB` (gray-50) | `#1F2937` (gray-800) |
| **Card BG** | `white` + `shadow-sm` | `gray-900/80` + `backdrop-blur-sm` |
| **Premium Card** | `white` + `shadow-sm` | `rgba(20, 28, 36, 0.6)` + `blur(16px)` |
| **Dashboard Card** | `white` + gradient overlay | `gray-900/40` + `backdrop-blur-xl` + gradient layers |
| **Border** | `gray-200` (#E5E7EB) | `gray-700/50` opacity |
| **Border Secondary** | `gray-100` (#F3F4F6) | `gray-800/50` opacity |
| **Text Primary** | `gray-900` (#111827) | `gray-100` (#F3F4F6) |
| **Text Secondary** | `gray-700` (#374151) | `gray-300` (#D1D5DB) |
| **Text Tertiary** | `gray-500` (#6B7280) | `gray-400` (#9CA3AF) |
| **Modal Overlay** | `gray-900/40` + `blur` | `black/80` + `backdrop-blur-sm` |
| **Modal Content** | `white/95` + `blur` | `gray-900/95` + `backdrop-blur-sm` |
| **Popover** | `white/95` + `shadow-md` | `gray-900/95` + `backdrop-blur-sm` |
| **Select Dropdown** | `white/95` + `blur` | `gray-900/95` + `backdrop-blur-sm` |
| **Skeleton BG** | `gray-200` | `gray-800` |
| **Selected State** | `emerald-50` + border | `emerald-500/5` + border |

## 🔄 Skeleton Loader Specifications

| Element | Light Mode | Dark Mode |
|---------|-----------|-----------|
| **Container BG** | `bg-white` | `bg-gray-900/80` |
| **Container Border** | `border-gray-200` | `border-gray-700/50` |
| **Element Color** | `bg-gray-200` | `bg-gray-800` |
| **Animation** | `animate-pulse` | `animate-pulse` |
| **Shadow** | `shadow-sm` | `shadow-none` |

## ✨ Shimmer Animation

| Property | Value |
|----------|-------|
| **Animation Name** | `shimmer` |
| **Duration** | `2s` |
| **Timing** | `linear` |
| **Iteration** | `infinite` |
| **Keyframes** | `backgroundPosition: -200% 0 → 200% 0` |
| **Gradient** | `from-transparent via-white/30 to-transparent` |

## 🎭 Theme Transition

| Property | Value |
|----------|-------|
| **Duration** | `300ms` |
| **Easing** | `ease-in-out` |
| **Properties** | `background-color, border-color, color, fill, stroke` |
| **Class** | `.theme-transition` |

## 🌟 Glassmorphism Specifications

### Backdrop Blur Levels

| Level | CSS | Usage |
|-------|-----|-------|
| **Standard** | `backdrop-blur-sm` (4px) | Cards, dialogs, popovers |
| **Medium** | `backdrop-blur` (8px) | Not commonly used |
| **Enhanced** | `backdrop-blur-xl` (24px) | Premium cards, hero sections |
| **Strong** | `blur(16px)` | Custom glassmorphism class |
| **Maximum** | `blur(20px)` | Rarely used, special effects |

### Glass Surface Opacity

| Theme | Base Opacity | Usage |
|-------|-------------|--------|
| **Light Mode** | `0.85` (85%) | Glass surfaces: `rgba(255, 255, 255, 0.85)` |
| **Light Mode** | `0.95` (95%) | Modals/Dialogs: `bg-white/95` |
| **Dark Mode** | `0.6` (60%) | Premium glass: `rgba(20, 28, 36, 0.6)` |
| **Dark Mode** | `0.8` (80%) | Standard glass: `bg-gray-900/80` |
| **Dark Mode** | `0.95` (95%) | Modals/Dialogs: `bg-gray-900/95` |

### Shadow Specifications

| Theme | Shadow | Usage |
|-------|--------|--------|
| **Light Mode** | `shadow-sm` | Standard cards and surfaces |
| **Light Mode** | `shadow-md` | Hover states |
| **Light Mode** | `shadow-lg` | Popovers and elevated elements |
| **Dark Mode** | `shadow-none` | Most surfaces (glass effect instead) |
| **Dark Mode** | `shadow-black/20` | Hover effects on interactive cards |
| **Dark Mode Custom** | `0 8px 32px rgba(0,0,0,0.3)` | Premium glassmorphism |
| **Dark Mode Inset** | `inset 0 1px 0 rgba(255,255,255,0.05)` | Glass highlight edge |

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

## 🎯 Implementation Best Practices

### Glassmorphism Do's and Don'ts

✅ **DO:**
- Use `backdrop-blur-sm` (4px) for most cards and modals
- Use `backdrop-blur-xl` (24px) for hero sections and premium cards
- Apply opacity levels: `0.8` for cards, `0.95` for modals/popovers
- Use custom `blur(16px)` for premium glassmorphism effects
- Add subtle inset highlights: `inset 0 1px 0 rgba(255,255,255,0.05)`
- Include webkit prefixes: `-webkit-backdrop-filter`
- Combine with semi-transparent backgrounds: `bg-gray-900/80`
- Use `shadow-none` in dark mode (glass effect replaces shadows)
- Add smooth transitions: `transition-all duration-300`

❌ **DON'T:**
- Don't use backdrop blur without semi-transparent backgrounds
- Don't stack too many glassmorphic layers (max 2-3 levels)
- Don't use heavy shadows in dark mode with glass effects
- Don't forget webkit prefix for Safari support
- Don't use glassmorphism in light mode (clean backgrounds instead)
- Don't exceed blur(24px) - degrades performance
- Don't use glassmorphism on small elements (< 100px)

### Performance Considerations

- **Backdrop Blur Impact**: Moderate GPU usage, optimize for 60fps
- **Layer Limit**: Maximum 2-3 overlapping glass layers
- **Mobile Optimization**: Test on older devices, may need fallbacks
- **Browser Support**: Use webkit prefix, test in Safari
- **Transition Performance**: Use `transform` over position changes

### Accessibility Guidelines

- **Contrast Ratios**: Maintain WCAG AA (4.5:1 for text)
- **Border Visibility**: Use subtle borders even with glass effects
- **Text Readability**: Ensure text is readable over glass backgrounds
- **Focus States**: Clear focus indicators on interactive elements
- **Reduced Motion**: Respect `prefers-reduced-motion` for animations

## 🔄 Version History

**v5.0.0** - 2025-11-28
- Enhanced light mode styling with cleaner professional grays
- Improved skeleton loader system with theme-aware colors
- New shimmer animation for loading states
- Dashboard card glassmorphism with gradient overlays
- Contact and Deal card light/dark mode patterns
- Theme transition effects with smooth 300ms animations
- Updated CSS custom properties for light mode
- New utility classes: theme-bg-*, theme-text-*, theme-border
- Subscription stats skeleton with adaptive colors
- Rank color system for sentiment rankings

**v4.0.0** - 2025-01-03
- Complete audit of Sixty Sales Dashboard implementation
- Exact glassmorphism specifications and opacity levels
- Comprehensive backdrop blur reference (sm, xl, 16px, 20px)
- Theme-aware utility classes documented
- Shadow specifications for light and dark modes
- Quick copy-paste classes for all common patterns
- Implementation best practices and performance guidelines
- Accessibility considerations for glass effects

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

**Last Updated:** 2025-11-28
**Version:** 5.0.0
**Status:** Production Ready ✅
**Source:** Sixty Sales Dashboard - Complete Implementation Audit