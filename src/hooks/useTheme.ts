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
 * Gets the stored theme preference from localStorage
 * Returns 'system' as default
 */
function getStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'system'

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored
    }
  } catch {
    // Handle localStorage access errors
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
 * Applies the theme to the document
 */
function applyTheme(theme: ResolvedTheme) {
  const root = document.documentElement

  // Set data-theme attribute
  root.setAttribute('data-theme', theme)

  // Also set class for Tailwind dark mode
  if (theme === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
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
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    resolveTheme(getStoredTheme())
  )

  // Set theme mode and persist to localStorage
  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode)

    try {
      localStorage.setItem(STORAGE_KEY, mode)
    } catch {
      console.warn('Failed to persist theme preference')
    }

    const resolved = resolveTheme(mode)
    setResolvedTheme(resolved)
    applyTheme(resolved)
  }

  // Initialize theme on mount
  useEffect(() => {
    const resolved = resolveTheme(themeMode)
    setResolvedTheme(resolved)
    applyTheme(resolved)
  }, [])

  // Listen for system theme changes when in system mode
  useEffect(() => {
    if (themeMode !== 'system') return

    try {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

      const handleChange = (e: MediaQueryListEvent) => {
        const resolved = e.matches ? 'dark' : 'light'
        setResolvedTheme(resolved)
        applyTheme(resolved)
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
      console.warn('Failed to listen for system theme changes')
    }
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
  const mode = getStoredTheme()
  const resolved = resolveTheme(mode)
  applyTheme(resolved)
}
