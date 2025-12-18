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
 * Always returns dark theme
 */
function getAppliedTheme(): ResolvedTheme {
  return 'dark'
}

/**
 * Gets the stored theme preference from localStorage
 * Always returns 'dark' - light theme not allowed
 */
function getStoredTheme(): ThemeMode {
  return 'dark'
}

/**
 * Resolves the theme mode to an actual theme (light or dark)
 * Always returns dark theme - light theme not allowed
 */
function resolveTheme(mode: ThemeMode): ResolvedTheme {
  return 'dark'
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
  // Always use dark theme
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => 'dark')
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => 'dark')

  // Set theme mode - always forces to dark
  const setThemeMode = (mode: ThemeMode) => {
    // Always set to dark regardless of input
    const darkMode: ThemeMode = 'dark'
    setThemeModeState(darkMode)

    try {
      localStorage.setItem(STORAGE_KEY, darkMode)
    } catch {
    }

    const resolved: ResolvedTheme = 'dark'
    setResolvedTheme(resolved)
    applyTheme(resolved)

    // Dispatch custom event so other components using useTheme can sync
    window.dispatchEvent(new CustomEvent('theme-changed', { detail: { mode: darkMode, resolved } }))
  }

  // Initialize theme on mount - always dark
  useEffect(() => {
    setResolvedTheme('dark')
    applyTheme('dark')
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

  // System theme listener disabled - dark theme only
  // No need to listen for system theme changes

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
  // Always initialize to dark theme
  applyTheme('dark')
}
