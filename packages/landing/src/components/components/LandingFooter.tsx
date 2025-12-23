import { useEffect, useState } from 'react';
import { usePublicBrandingSettings } from '../../lib/hooks/useBrandingSettings';

export function Footer() {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      const html = document.documentElement;
      return html.classList.contains('dark') || html.getAttribute('data-theme') === 'dark';
    }
    return false;
  });

  const { logoDark } = usePublicBrandingSettings();
  const LIGHT_MODE_LOGO = 'https://user-upload.s3.eu-west-2.amazonaws.com/erg%20logos/lightLogo/lightLogo-global-1764287988029.png';

  useEffect(() => {
    const checkTheme = () => {
      const html = document.documentElement;
      const hasDarkClass = html.classList.contains('dark');
      const dataTheme = html.getAttribute('data-theme');
      setIsDark(hasDarkClass || dataTheme === 'dark');
    };

    checkTheme();

    const handleThemeChange = () => checkTheme();
    window.addEventListener('theme-changed', handleThemeChange);

    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme']
    });

    return () => {
      window.removeEventListener('theme-changed', handleThemeChange);
      observer.disconnect();
    };
  }, []);

  return (
    <footer className="relative bg-white dark:bg-gray-950 transition-colors duration-300">
      {/* Divider Line */}
      <div className="border-t border-gray-200 dark:border-gray-700/50" />

      {/* Footer Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col items-center gap-4">
          {/* Logo */}
          <img
            key={isDark ? 'dark' : 'light'}
            src={isDark ? logoDark : LIGHT_MODE_LOGO}
            alt="60"
            className="h-8 w-auto"
          />

          {/* Copyright */}
          <p className="font-body text-gray-500 dark:text-gray-400 text-sm text-center">
            © 2025 Sixty Seconds Ltd. All rights reserved. All systems operational.
          </p>
        </div>
      </div>
    </footer>
  );
}

// Also export as LandingFooter for compatibility
export { Footer as LandingFooter };
