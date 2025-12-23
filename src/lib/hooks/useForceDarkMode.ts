import { useEffect } from 'react';

/**
 * Force dark mode for landing pages
 *
 * This hook forces dark mode when the component mounts,
 * ignoring system preferences. Used for landing pages that
 * should always display in dark mode.
 */
export function useForceDarkMode() {
  useEffect(() => {
    const root = document.documentElement;

    // Force dark mode
    root.classList.add('dark');
    root.setAttribute('data-theme', 'dark');

    // Store preference to prevent flash on navigation
    try {
      localStorage.setItem('theme-preference', 'dark');
    } catch {
      // Handle localStorage errors silently
    }

    // Dispatch event so other components using useTheme can sync
    window.dispatchEvent(new CustomEvent('theme-changed', { detail: { resolved: 'dark' } }));
  }, []);
}
