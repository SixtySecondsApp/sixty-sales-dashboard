import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import { cn } from '@/lib/utils'

/**
 * Quick Theme Toggle Component
 *
 * Simple light/dark toggle button for quick theme switching.
 * Shows current effective theme (system-resolved).
 * Placed in sidebar/header for convenient access.
 */
export function ThemeToggle() {
  const { themeMode, resolvedTheme, setThemeMode } = useTheme()

  const toggleTheme = () => {
    // Toggle between light and dark (ignoring system mode for quick toggle)
    const newTheme = resolvedTheme === 'light' ? 'dark' : 'light'
    setThemeMode(newTheme)
  }

  return (
    <button
      onClick={toggleTheme}
      className={cn(
        "relative p-2 rounded-lg transition-all duration-300",
        "hover:bg-gray-50 dark:hover:bg-gray-800/30 hover:scale-110",
        "theme-transition" // Add theme transition class for smooth color changes
      )}
      aria-label={`Switch to ${resolvedTheme === 'light' ? 'dark' : 'light'} mode`}
      title={`Current theme: ${themeMode}${themeMode === 'system' ? ` (${resolvedTheme})` : ''}`}
    >
      {resolvedTheme === 'light' ? (
        <Moon className="w-5 h-5 text-gray-700 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors duration-300" />
      ) : (
        <Sun className="w-5 h-5 text-gray-700 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors duration-300" />
      )}
    </button>
  )
}
