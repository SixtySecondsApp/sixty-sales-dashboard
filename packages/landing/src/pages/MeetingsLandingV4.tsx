import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import {
  HeroSectionV4,
  IntegrationsSectionV4,
  HowItWorksV4,
  PricingSectionV4,
  FAQSectionV4,
  FinalCTA,
  LandingFooter
} from '../components/components-v4';
import { usePublicBrandingSettings } from '../lib/hooks/useBrandingSettings';

// Build version for deployment verification - remove after confirming deploy works
const BUILD_VERSION = '2025-12-10-v2';

/**
 * Meetings Landing Page V4
 *
 * Combines the best elements from V1 and V3:
 * - V3 Hero Title: "Close More Deals Without Taking a Single Note"
 * - V1 Hero Background: Dark theme with animated gradient orbs
 * - V1 Hero Visual: Meeting cards with sentiment analysis
 * - V3 Top Cards: Metric cards (12 Deals, 8h, 24 Proposals)
 * - V3 Pricing: ROI calculator
 * - V1 Pricing: Functional navigation buttons
 * - V3 FAQ: Early adopter objection handling
 * - V3 Header: Navigation with early adopter banner
 */
export function MeetingsLandingV4() {
  const [isDark, setIsDark] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Log build version to console for deployment verification
  useEffect(() => {
    console.log(`[Landing] Build version: ${BUILD_VERSION}`);
  }, []);

  // Branding settings for logos
  const { logoDark } = usePublicBrandingSettings();

  // Light mode logo (dark text for light backgrounds)
  const LIGHT_MODE_LOGO = 'https://user-upload.s3.eu-west-2.amazonaws.com/erg%20logos/lightLogo/lightLogo-global-1764287988029.png';

  // Close mobile menu when clicking a nav link
  const handleNavClick = () => {
    setMobileMenuOpen(false);
  };

  // Theme detection
  useEffect(() => {
    const checkTheme = () => {
      const html = document.documentElement;
      const hasDarkClass = html.classList.contains('dark');
      const dataTheme = html.getAttribute('data-theme');
      setIsDark(hasDarkClass || dataTheme === 'dark');
    };

    checkTheme();

    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme']
    });

    return () => observer.disconnect();
  }, []);

  // Handle smooth scrolling for anchor links
  useEffect(() => {
    const handleAnchorClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a[href^="#"]');

      if (anchor) {
        const href = anchor.getAttribute('href');
        if (href && href.startsWith('#')) {
          e.preventDefault();
          const targetId = href.substring(1);
          const targetElement = document.getElementById(targetId);

          if (targetElement) {
            // Use native scrollIntoView with block: 'start' to respect CSS scroll-margin-top
            targetElement.scrollIntoView({
              behavior: 'smooth',
              block: 'start',
            });
          }
        }
      }
    };

    document.addEventListener('click', handleAnchorClick);
    return () => document.removeEventListener('click', handleAnchorClick);
  }, []);

  return (
    <div className="min-h-screen text-gray-900 dark:text-gray-100 transition-colors duration-300" style={{ backgroundColor: 'transparent' }}>
      {/* V4 Navigation - Fixed at top */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-white/90 dark:bg-gray-900/95 border-b border-gray-200 dark:border-gray-800 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <motion.a
              href="/"
              className="flex items-center gap-3"
              whileHover={{ scale: 1.02 }}
            >
              <img
                src={isDark ? logoDark : LIGHT_MODE_LOGO}
                alt="60"
                className="h-10 w-auto transition-all duration-300"
              />
            </motion.a>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-8">
              <a href="#how-it-works" className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors duration-200">How It Works</a>
              <a href="#features" className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors duration-200">Features</a>
              <a href="#pricing" className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors duration-200">Pricing</a>
              <a href="#faq" className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors duration-200">FAQ</a>
            </div>

            <div className="flex items-center gap-3 sm:gap-4">
              <a
                href="https://app.use60.com/auth/login"
                className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors duration-200 hidden sm:block"
              >
                Log In
              </a>
              <motion.a
                href="/waitlist"
                className="hidden sm:block px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-all duration-200 shadow-lg shadow-blue-500/25 dark:shadow-blue-900/30"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Sign Up
              </motion.a>
              {/* Mobile Menu Button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? (
                  <X className="w-6 h-6" />
                ) : (
                  <Menu className="w-6 h-6" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="md:hidden border-t border-gray-200 dark:border-gray-800 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl"
            >
              <div className="px-4 py-4 space-y-3">
                <a
                  href="#how-it-works"
                  onClick={handleNavClick}
                  className="block py-2 px-3 rounded-lg text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  How It Works
                </a>
                <a
                  href="#features"
                  onClick={handleNavClick}
                  className="block py-2 px-3 rounded-lg text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  Features
                </a>
                <a
                  href="#pricing"
                  onClick={handleNavClick}
                  className="block py-2 px-3 rounded-lg text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  Pricing
                </a>
                <a
                  href="#faq"
                  onClick={handleNavClick}
                  className="block py-2 px-3 rounded-lg text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  FAQ
                </a>
                <div className="pt-3 border-t border-gray-200 dark:border-gray-800 space-y-3">
                  <a
                    href="https://app.use60.com/auth/login"
                    onClick={handleNavClick}
                    className="block py-2 px-3 rounded-lg text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    Log In
                  </a>
                  <a
                    href="/waitlist"
                    onClick={handleNavClick}
                    className="block py-3 px-4 rounded-xl bg-blue-600 text-white text-center text-base font-semibold hover:bg-blue-700 transition-all"
                  >
                    Sign Up
                  </a>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Main Content */}
      <main className="relative overflow-x-hidden bg-transparent">
        <HeroSectionV4 />
        <HowItWorksV4 />
        <IntegrationsSectionV4 />
        <PricingSectionV4 />
        <FAQSectionV4 />
        <FinalCTA />
      </main>

      <LandingFooter />
    </div>
  );
}
