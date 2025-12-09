import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../lib/hooks/useTheme'
import { cn } from '../lib/utils'

/**
 * Theme Toggle Component
 *
 * Simple light/dark toggle button for theme switching.
 * Shows current theme and allows toggling between light and dark modes.
 */
export function ThemeToggle() {
  const { resolvedTheme, setThemeMode } = useTheme()

  const toggleTheme = () => {
    // Toggle between light and dark
    const newTheme = resolvedTheme === 'light' ? 'dark' : 'light'
    setThemeMode(newTheme)
  }

  return (
    <button
      onClick={toggleTheme}
      className={cn(
        "relative p-2 rounded-lg transition-all duration-300",
        "hover:bg-gray-100 dark:hover:bg-gray-800/50 hover:scale-110",
        "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white",
        "theme-transition" // Add theme transition class for smooth color changes
      )}
      aria-label={`Switch to ${resolvedTheme === 'light' ? 'dark' : 'light'} mode`}
      title={`Current theme: ${resolvedTheme}`}
    >
      {resolvedTheme === 'light' ? (
        <Moon className="w-5 h-5 transition-colors duration-300" />
      ) : (
        <Sun className="w-5 h-5 transition-colors duration-300" />
      )}
    </button>
  )
}
