import { useEffect, useState } from 'react'

export type ThemeMode = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

const STORAGE_KEY = 'theme-preference'

/**
 * Gets the system color scheme preference
 * Returns 'dark' as fallback if not available
 */
function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'dark'

  try {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    return mediaQuery.matches ? 'dark' : 'light'
  } catch {
    // Fallback to dark if matchMedia not available
    return 'dark'
  }
}

/**
 * Gets the currently applied theme from the DOM
 */
function getAppliedTheme(): ResolvedTheme {
  if (typeof document === 'undefined') return 'dark'
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

/**
 * Gets the stored theme preference from localStorage
 */
function getStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'system'

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored
    }
  } catch {
    // localStorage not available
  }

  return 'system'
}

/**
 * Resolves the theme mode to an actual theme (light or dark)
 */
function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode === 'system') {
    return getSystemTheme()
  }
  return mode
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
 * 3. Dark fallback (if system preference unavailable)
 *
 * @returns {Object} Theme state and controls
 * @property {ThemeMode} themeMode - Current theme mode preference (system/light/dark)
 * @property {ResolvedTheme} resolvedTheme - Actual theme applied (light/dark)
 * @property {Function} setThemeMode - Function to change theme preference
 */
export function useTheme() {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => getStoredTheme())
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => {
    const stored = getStoredTheme()
    return resolveTheme(stored)
  })

  // Set theme mode
  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode)

    try {
      localStorage.setItem(STORAGE_KEY, mode)
    } catch {
      // localStorage not available
    }

    const resolved = resolveTheme(mode)
    setResolvedTheme(resolved)
    applyTheme(resolved)

    // Dispatch custom event so other components using useTheme can sync
    window.dispatchEvent(new CustomEvent('theme-changed', { detail: { mode, resolved } }))
  }

  // Initialize theme on mount
  useEffect(() => {
    const stored = getStoredTheme()
    const resolved = resolveTheme(stored)
    setThemeModeState(stored)
    setResolvedTheme(resolved)
    applyTheme(resolved)
  }, [])

  // Listen for theme changes from other components
  useEffect(() => {
    const handleThemeChange = (event: CustomEvent<{ mode: ThemeMode; resolved: ResolvedTheme }>) => {
      setThemeModeState(event.detail.mode)
      setResolvedTheme(event.detail.resolved)
    }

    window.addEventListener('theme-changed', handleThemeChange as EventListener)
    return () => window.removeEventListener('theme-changed', handleThemeChange as EventListener)
  }, [])

  // Listen for system theme changes when in 'system' mode
  useEffect(() => {
    if (themeMode !== 'system') return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const handleChange = (e: MediaQueryListEvent) => {
      const newTheme: ResolvedTheme = e.matches ? 'dark' : 'light'
      setResolvedTheme(newTheme)
      applyTheme(newTheme)
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [themeMode])

  return {
    themeMode,
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
  const resolved = resolveTheme(stored)
  applyTheme(resolved)
}
