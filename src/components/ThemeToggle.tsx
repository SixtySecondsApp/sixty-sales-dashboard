import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import { Button } from '@/components/ui/button'

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
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className="transition-all duration-200"
      aria-label={`Switch to ${resolvedTheme === 'light' ? 'dark' : 'light'} mode`}
      title={`Current theme: ${themeMode}${themeMode === 'system' ? ` (${resolvedTheme})` : ''}`}
    >
      {resolvedTheme === 'light' ? (
        <Moon className="w-4 h-4 text-gray-700 dark:text-gray-300" />
      ) : (
        <Sun className="w-4 h-4 text-gray-300 dark:text-gray-300" />
      )}
    </Button>
  )
}
