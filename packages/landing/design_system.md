# 60 Seconds Design System

This document defines the visual language for all 60 Seconds landing pages and marketing materials.

---

## Color Palette

### Primary Colors

| Name | Hex | RGB | CSS Variable | Tailwind Class |
|------|-----|-----|--------------|----------------|
| **Blue Violet** | `#8129D7` | rgb(129, 41, 215) | `--brand-violet` | `brand-violet` |
| **Byzantine Blue** | `#2A5EDB` | rgb(42, 94, 219) | `--brand-blue` | `brand-blue` |
| **Keppel** | `#03AD9C` | rgb(3, 173, 156) | `--brand-teal` | `brand-teal` |

### Color Usage

| Color | Primary Use Cases |
|-------|-------------------|
| **Blue Violet** | Gradients, accent highlights, premium features |
| **Byzantine Blue** | Primary buttons, links, CTAs, main accent |
| **Keppel** | Success states, secondary accent, check marks |

### Opacity Variants

Use Tailwind opacity modifiers for subtle backgrounds:
- `/10` - Very subtle background
- `/20` - Light accent background
- `/30` - Medium accent background
- `/50` - Half opacity

```css
/* Examples */
bg-brand-blue/10    /* Subtle blue background */
bg-brand-violet/20  /* Light violet accent */
border-brand-teal/30 /* Medium teal border */
```

---

## Typography

### Font Families

| Font | Usage | Tailwind Class |
|------|-------|----------------|
| **Urbanist** | Headlines, short subheaders | `font-heading` |
| **Questrial** | Long subheaders, body copy | `font-body` |

### Font Hierarchy

| Element | Font | Weight | Tailwind Classes |
|---------|------|--------|-----------------|
| Main Headline | Urbanist | Bold (700) | `font-heading font-bold` |
| Short Sub-header | Urbanist | Bold (700) | `font-heading font-bold` |
| Long Sub-header | Questrial | Regular (400) | `font-body font-normal` |
| Body Copy | Questrial | Regular (400) | `font-body font-normal` |

### Typography Scale

```html
<!-- Main Headline -->
<h1 class="font-heading font-bold text-4xl sm:text-5xl lg:text-6xl">
  Main Headline
</h1>

<!-- Short Sub-header -->
<h2 class="font-heading font-bold text-2xl sm:text-3xl">
  Short Sub-header
</h2>

<!-- Long Sub-header -->
<h3 class="font-body font-normal text-xl sm:text-2xl">
  This is a long subheader with more text
</h3>

<!-- Body Copy -->
<p class="font-body font-normal text-base">
  Body text goes here...
</p>
```

---

## Gradients

### Primary Gradient (CTA Buttons, Headlines)

```css
/* Blue to Violet - Primary Brand Gradient */
bg-gradient-to-r from-brand-blue to-brand-violet

/* Tailwind with hex values */
bg-gradient-to-r from-[#2A5EDB] to-[#8129D7]
```

### Secondary Gradient (Success, Accents)

```css
/* Teal to Blue - Secondary Gradient */
bg-gradient-to-r from-brand-teal to-brand-blue

/* Tailwind with hex values */
bg-gradient-to-r from-[#03AD9C] to-[#2A5EDB]
```

### Accent Gradient (Highlights)

```css
/* Violet to Teal - Accent Gradient */
bg-gradient-to-r from-brand-violet to-brand-teal

/* Tailwind with hex values */
bg-gradient-to-r from-[#8129D7] to-[#03AD9C]
```

### Text Gradients

```html
<span class="text-transparent bg-clip-text bg-gradient-to-r from-brand-blue to-brand-violet">
  Gradient Text
</span>
```

---

## Components

### Primary Button

```html
<button class="px-6 py-3 rounded-xl bg-gradient-to-r from-brand-blue to-brand-violet
               text-white font-heading font-semibold
               hover:from-[#2351C4] hover:to-[#7024C0]
               shadow-lg shadow-brand-blue/25
               transition-all duration-300">
  Get Started
</button>
```

### Secondary Button

```html
<button class="px-6 py-3 rounded-xl
               bg-white/5 border border-white/10
               text-white font-body font-medium
               hover:bg-white/10 hover:border-white/20
               transition-all duration-300">
  Learn More
</button>
```

### Badge

```html
<span class="inline-flex items-center gap-2 px-4 py-2 rounded-full
             bg-brand-blue/10 border border-brand-blue/20
             text-brand-blue font-body text-sm font-medium">
  <span class="w-2 h-2 rounded-full bg-brand-blue animate-pulse"></span>
  Limited Early Access
</span>
```

### Success Badge

```html
<span class="inline-flex items-center gap-2 px-3 py-1 rounded-full
             bg-brand-teal/10 border border-brand-teal/20
             text-brand-teal font-body text-sm">
  <CheckIcon class="w-4 h-4" />
  Active
</span>
```

---

## Animated Backgrounds

### Gradient Orbs (Hero Sections)

```tsx
// Blue orb
<div style={{
  background: 'radial-gradient(circle, rgba(42, 94, 219, 0.15) 0%, transparent 70%)'
}} />

// Violet orb
<div style={{
  background: 'radial-gradient(circle, rgba(129, 41, 215, 0.12) 0%, transparent 70%)'
}} />

// Teal orb
<div style={{
  background: 'radial-gradient(circle, rgba(3, 173, 156, 0.08) 0%, transparent 60%)'
}} />
```

### Scan Line Effect

```tsx
<div style={{
  background: 'linear-gradient(90deg, transparent, rgba(42, 94, 219, 0.3), transparent)'
}} />
```

---

## Dark Mode Colors

The design system supports both light and dark modes:

| Element | Light Mode | Dark Mode |
|---------|------------|-----------|
| Background | `#FFFFFF` | `#030712` (gray-950) |
| Surface | `#FAFAFA` | `#111827` (gray-900) |
| Text Primary | `#111827` | `#F3F4F6` |
| Text Secondary | `#374151` | `#D1D5DB` |
| Border | `#E5E7EB` | `#374151` |

---

## Shadows

### Brand Shadows

```css
/* Blue shadow for primary buttons */
shadow-lg shadow-brand-blue/25

/* Violet shadow for accent elements */
shadow-lg shadow-brand-violet/20

/* Teal shadow for success elements */
shadow-lg shadow-brand-teal/20
```

---

## Quick Reference

### CSS Variables (add to index.css)

```css
:root {
  --brand-violet: #8129D7;
  --brand-blue: #2A5EDB;
  --brand-teal: #03AD9C;
}
```

### Tailwind Config (add to tailwind.config.js)

```js
theme: {
  extend: {
    colors: {
      brand: {
        violet: '#8129D7',
        blue: '#2A5EDB',
        teal: '#03AD9C',
      }
    },
    fontFamily: {
      heading: ['Urbanist', 'sans-serif'],
      body: ['Questrial', 'sans-serif'],
    }
  }
}
```

---

## Migration Cheatsheet

| Old Pattern | New Pattern |
|-------------|-------------|
| `from-blue-500 to-purple-500` | `from-brand-blue to-brand-violet` |
| `from-blue-600 to-indigo-600` | `from-brand-blue to-brand-violet` |
| `from-blue-500 to-emerald-500` | `from-brand-blue to-brand-teal` |
| `from-emerald-400 to-blue-400` | `from-brand-teal to-brand-blue` |
| `text-blue-500` | `text-brand-blue` |
| `text-emerald-500` | `text-brand-teal` |
| `text-purple-500` | `text-brand-violet` |
| `bg-blue-500/10` | `bg-brand-blue/10` |
| `border-blue-500/20` | `border-brand-blue/20` |
| `rgba(59, 130, 246, ...)` | `rgba(42, 94, 219, ...)` |
| `rgba(168, 85, 247, ...)` | `rgba(129, 41, 215, ...)` |
| `rgba(16, 185, 129, ...)` | `rgba(3, 173, 156, ...)` |
