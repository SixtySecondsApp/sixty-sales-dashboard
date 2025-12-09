import { useEffect, useState } from 'react'

export type ThemeMode = 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

const STORAGE_KEY = 'theme-preference'

/**
 * Gets the system color scheme preference
 * Returns 'light' as fallback if not available
 */
function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light'

  try {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    return mediaQuery.matches ? 'dark' : 'light'
  } catch {
    // Fallback to light if matchMedia not available
    return 'light'
  }
}

/**
 * Gets the currently applied theme from the DOM
 * This is useful for initial render to avoid flash
 */
function getAppliedTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light'

  try {
    // Check if dark class is on document element (set by initializeTheme)
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

/**
 * Gets the stored theme preference from localStorage
 * Returns system preference as default
 */
function getStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') return getSystemTheme()

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark') {
      return stored
    }
  } catch {
    // Handle localStorage access errors
  }

  return getSystemTheme()
}

/**
 * Applies the theme to the document with smooth transition
 */
function applyTheme(theme: ResolvedTheme) {
  const root = document.documentElement

  // Add transition class for smooth theme changes
  root.classList.add('theme-transition')

  // Set data-theme attribute
  root.setAttribute('data-theme', theme)

  // Also set class for Tailwind dark mode
  if (theme === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }

  // Remove transition class after animation completes
  setTimeout(() => {
    root.classList.remove('theme-transition')
  }, 300)
}

/**
 * Custom hook for managing theme state
 *
 * Priority order:
 * 1. User preference from localStorage (if set)
 * 2. System preference (default)
 * 3. Light fallback (if system preference unavailable)
 *
 * @returns {Object} Theme state and controls
 * @property {ResolvedTheme} resolvedTheme - Actual theme applied (light/dark)
 * @property {Function} setThemeMode - Function to change theme preference
 */
export function useTheme() {
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    getAppliedTheme()
  )

  // Set theme mode and persist to localStorage
  const setThemeMode = (mode: ThemeMode) => {
    setResolvedTheme(mode)
    applyTheme(mode)

    try {
      localStorage.setItem(STORAGE_KEY, mode)
    } catch {
      // Handle localStorage errors silently
    }

    // Dispatch custom event so other components using useTheme can sync
    window.dispatchEvent(new CustomEvent('theme-changed', { detail: { resolved: mode } }))
  }

  // Initialize theme on mount
  useEffect(() => {
    const stored = getStoredTheme()
    setResolvedTheme(stored)
    applyTheme(stored)
  }, [])

  // Listen for theme changes from other components
  useEffect(() => {
    const handleThemeChange = (event: CustomEvent<{ resolved: ResolvedTheme }>) => {
      setResolvedTheme(event.detail.resolved)
    }

    window.addEventListener('theme-changed', handleThemeChange as EventListener)
    return () => window.removeEventListener('theme-changed', handleThemeChange as EventListener)
  }, [])

  // Listen for system theme changes
  useEffect(() => {
    try {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

      const handleChange = (e: MediaQueryListEvent) => {
        // Only update if user hasn't set a preference
        const stored = getStoredTheme()
        const systemTheme = e.matches ? 'dark' : 'light'

        // If stored theme matches system theme, update
        if (stored === systemTheme || !localStorage.getItem(STORAGE_KEY)) {
          const resolved = systemTheme
          setResolvedTheme(resolved)
          applyTheme(resolved)
        }
      }

      // Modern browsers
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', handleChange)
        return () => mediaQuery.removeEventListener('change', handleChange)
      }

      // Legacy browsers
      if (mediaQuery.addListener) {
        mediaQuery.addListener(handleChange)
        return () => mediaQuery.removeListener(handleChange)
      }
    } catch {
      // Handle errors silently
    }
  }, [])

  return {
    resolvedTheme,
    setThemeMode,
  }
}

/**
 * Initialize theme before React renders (call in main.tsx)
 * This prevents flash of wrong theme
 */
export function initializeTheme() {
  const stored = getStoredTheme()
  applyTheme(stored)
}
