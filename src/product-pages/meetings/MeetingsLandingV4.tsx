import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import {
  HeroSectionV4,
  FeatureShowcaseV3,
  HowItWorksV4,
  PricingSectionV4,
  FAQSectionV4,
  IntegrationSection,
  FinalCTA,
  LandingFooter
} from './components-v4';

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile menu when clicking a nav link
  const handleNavClick = () => {
    setMobileMenuOpen(false);
  };

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
    <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors duration-300">
      {/* V4 Navigation - Fixed at top */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-sm bg-white/95 dark:bg-gray-900/95 border-b border-gray-200 dark:border-gray-700/50 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <motion.a
              href="/"
              className="flex items-center gap-3"
              whileHover={{ scale: 1.02 }}
            >
              <img
                src="https://www.sixtyseconds.ai/images/logo.png"
                alt="Sixty Seconds"
                className="h-10 w-auto"
              />
            </motion.a>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">Features</a>
              <a href="#how-it-works" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">How It Works</a>
              <a href="#pricing" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">Pricing</a>
              <a href="#faq" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">FAQ</a>
            </div>

            <div className="flex items-center gap-3 sm:gap-4">
              <a
                href="/auth/login"
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors hidden sm:block"
              >
                Log In
              </a>
              <motion.a
                href="/product/meetings/waitlist"
                className="hidden sm:block px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 text-white font-medium hover:from-blue-500 hover:to-blue-400 transition-all shadow-lg shadow-blue-500/25"
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
                  href="#features"
                  onClick={handleNavClick}
                  className="block py-2 px-3 rounded-lg text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  Features
                </a>
                <a
                  href="#how-it-works"
                  onClick={handleNavClick}
                  className="block py-2 px-3 rounded-lg text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  How It Works
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
                    href="/auth/login"
                    onClick={handleNavClick}
                    className="block py-2 px-3 rounded-lg text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    Log In
                  </a>
                  <a
                    href="/product/meetings/waitlist"
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

      {/* Main Content - Add top padding to account for fixed nav */}
      <main className="relative pt-16 overflow-x-hidden">
        <HeroSectionV4 />
        <FeatureShowcaseV3 />
        <HowItWorksV4 />
        <PricingSectionV4 />
        <FAQSectionV4 />
        <IntegrationSection />
        <FinalCTA />
      </main>

      <LandingFooter />
    </div>
  );
}
