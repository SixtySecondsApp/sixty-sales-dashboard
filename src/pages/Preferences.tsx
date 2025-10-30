import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme, type ThemeMode } from '@/hooks/useTheme'
import { Card } from '@/components/ui/card'

/**
 * Preferences Page
 *
 * Dedicated page for user preferences including theme controls.
 * Features:
 * - System preference (default)
 * - Light mode
 * - Dark mode
 * - Visual preview of each option
 */
export default function Preferences() {
  const { themeMode, resolvedTheme, setThemeMode } = useTheme()

  const themes: Array<{
    value: ThemeMode
    label: string
    description: string
    icon: React.ReactNode
  }> = [
    {
      value: 'system',
      label: 'System',
      description: 'Automatically match your device settings',
      icon: <Monitor className="w-5 h-5" />,
    },
    {
      value: 'light',
      label: 'Light',
      description: 'Clean white background with dark text',
      icon: <Sun className="w-5 h-5" />,
    },
    {
      value: 'dark',
      label: 'Dark',
      description: 'Dark background with light text',
      icon: <Moon className="w-5 h-5" />,
    },
  ]

  return (
    <div className="min-h-screen p-8 transition-colors duration-200">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Preferences
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Customize your experience and application settings
          </p>
        </div>

        {/* Appearance Section */}
        <Card className="bg-white/85 border border-transparent dark:bg-gray-900/50 dark:backdrop-blur-xl dark:border-gray-800/50 rounded-xl p-6 shadow-sm dark:shadow-none">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-1">
              Appearance
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Choose how the application looks to you
            </p>
          </div>

          {/* Theme Options */}
          <div className="space-y-3">
            {themes.map((theme) => {
              const isSelected = themeMode === theme.value
              const isActive = resolvedTheme === theme.value

              return (
                <button
                  key={theme.value}
                  onClick={() => setThemeMode(theme.value)}
                  className={`
                    w-full flex items-center gap-4 p-4 rounded-lg border-2 transition-all duration-200
                    ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-500/10'
                        : 'border-gray-200 dark:border-gray-700/50 hover:border-gray-300 dark:hover:border-gray-600/50'
                    }
                    ${
                      isSelected
                        ? 'hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/20'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-800/30'
                    }
                  `}
                >
                  {/* Icon */}
                  <div
                    className={`
                    flex items-center justify-center w-12 h-12 rounded-lg transition-colors
                    ${
                      isSelected
                        ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                    }
                  `}
                  >
                    {theme.icon}
                  </div>

                  {/* Content */}
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <span
                        className={`
                        font-medium transition-colors
                        ${
                          isSelected
                            ? 'text-gray-900 dark:text-gray-100'
                            : 'text-gray-700 dark:text-gray-300'
                        }
                      `}
                      >
                        {theme.label}
                      </span>
                      {theme.value === 'system' && themeMode === 'system' && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 font-medium">
                          {resolvedTheme === 'light' ? 'Light' : 'Dark'}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                      {theme.description}
                    </p>
                  </div>

                  {/* Selection Indicator */}
                  {isSelected && (
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-500 text-white">
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          {/* Info Message */}
          <div className="mt-6 p-4 rounded-lg bg-blue-50/50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20">
            <p className="text-sm text-blue-900 dark:text-blue-300">
              {themeMode === 'system' ? (
                <>
                  <strong>System mode:</strong> The theme automatically matches your device's
                  settings. Currently displaying <strong>{resolvedTheme} mode</strong>.
                </>
              ) : (
                <>
                  <strong>{themeMode === 'light' ? 'Light' : 'Dark'} mode:</strong> The theme
                  is manually set. Change to System mode to follow your device settings.
                </>
              )}
            </p>
          </div>
        </Card>

        {/* Theme Preview Section */}
        <Card className="bg-white/85 border border-transparent dark:bg-gray-900/50 dark:backdrop-blur-xl dark:border-gray-800/50 rounded-xl p-6 shadow-sm dark:shadow-none">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
              Preview
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              See how the theme looks across different components
            </p>
          </div>

          {/* Preview Components */}
          <div className="space-y-4">
            {/* Preview Card */}
            <div className="bg-white/85 dark:bg-gray-900/80 backdrop-blur-sm border border-gray-200 dark:border-gray-700/50 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Card Component
              </h4>
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                This is how cards look in the current theme with glassmorphism effects.
              </p>
              <div className="flex gap-2">
                <button className="px-3 py-1.5 text-sm font-medium bg-blue-600/10 dark:bg-blue-500/10 border border-blue-600/20 dark:border-blue-500/20 text-blue-700 dark:text-blue-400 rounded-md hover:bg-blue-600/20 dark:hover:bg-blue-500/20 transition-colors">
                  Primary
                </button>
                <button className="px-3 py-1.5 text-sm font-medium bg-gray-100/80 dark:bg-gray-600/10 border border-gray-300 dark:border-gray-500/20 text-gray-700 dark:text-gray-400 rounded-md hover:bg-gray-200/80 dark:hover:bg-gray-600/20 transition-colors">
                  Secondary
                </button>
              </div>
            </div>

            {/* Preview Text */}
            <div className="space-y-2">
              <p className="text-base text-gray-900 dark:text-gray-100">
                Primary text - main headings and important content
              </p>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Secondary text - body content and descriptions
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Muted text - subtle information and helper text
              </p>
            </div>
          </div>
        </Card>

        {/* Additional Preferences Sections (Future) */}
        <Card className="bg-white/85 border border-transparent dark:bg-gray-900/50 dark:backdrop-blur-xl dark:border-gray-800/50 rounded-xl p-6 shadow-sm dark:shadow-none">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
              Coming Soon
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              More preference options will be added in future updates
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/30 border border-gray-200 dark:border-gray-700/30">
              <span className="text-sm text-gray-600 dark:text-gray-400">Notifications</span>
              <span className="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                Soon
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/30 border border-gray-200 dark:border-gray-700/30">
              <span className="text-sm text-gray-600 dark:text-gray-400">Language</span>
              <span className="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                Soon
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/30 border border-gray-200 dark:border-gray-700/30">
              <span className="text-sm text-gray-600 dark:text-gray-400">Time Zone</span>
              <span className="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                Soon
              </span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
