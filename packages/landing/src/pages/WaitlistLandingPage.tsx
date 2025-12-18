import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import {
  HeroSectionV4,
  IntegrationsSectionV4,
  HowItWorksV4,
  FAQSectionV4,
  FinalCTA,
  LandingFooter
} from '../components/components-v4';
import { usePublicBrandingSettings } from '../lib/hooks/useBrandingSettings';
import { useForceDarkMode } from '../lib/hooks/useForceDarkMode';
import { getLoginUrl } from '../lib/utils/siteUrl';

/**
 * Waitlist Landing Page
 *
 * Same as MeetingsLandingV4 but WITHOUT the pricing section.
 * Used during waitlist launch phase to hide pricing.
 * All CTAs link to /waitlist
 */
export function WaitlistLandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Force dark mode for landing pages
  useForceDarkMode();

  // Branding settings for logos
  const { logoDark } = usePublicBrandingSettings();

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
    <div className="min-h-screen bg-gray-950 text-gray-100 transition-colors duration-300">
      {/* Navigation - Fixed at top */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-gray-950/90 border-b border-gray-800 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <motion.a
              href="/"
              className="flex items-center gap-3"
              whileHover={{ scale: 1.02 }}
            >
              <img
                src={logoDark}
                alt="60"
                className="h-10 w-auto transition-all duration-300"
              />
            </motion.a>

            {/* Desktop Navigation - No Pricing link */}
            <div className="hidden md:flex items-center gap-8">
              <a href="#how-it-works" className="text-sm font-medium text-gray-400 hover:text-white transition-colors duration-200">How It Works</a>
              <a href="#features" className="text-sm font-medium text-gray-400 hover:text-white transition-colors duration-200">Features</a>
              <a href="#faq" className="text-sm font-medium text-gray-400 hover:text-white transition-colors duration-200">FAQ</a>
            </div>

            <div className="flex items-center gap-3 sm:gap-4">
              <a
                href={getLoginUrl()}
                className="text-sm font-medium text-gray-400 hover:text-white transition-colors duration-200 hidden sm:block"
              >
                Log In
              </a>
              <motion.a
                href="#hero"
                className="hidden sm:block px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-blue to-brand-violet text-white text-sm font-semibold hover:opacity-90 transition-all duration-200 shadow-lg shadow-brand-violet/25"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Join Waitlist
              </motion.a>
              {/* Mobile Menu Button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-lg text-gray-400 hover:bg-gray-800 transition-colors"
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

        {/* Mobile Menu Dropdown - No Pricing link */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="md:hidden border-t border-gray-800 bg-gray-950/95 backdrop-blur-xl"
            >
              <div className="px-4 py-4 space-y-3">
                <a
                  href="#how-it-works"
                  onClick={handleNavClick}
                  className="block py-2 px-3 rounded-lg text-base font-medium text-gray-300 hover:bg-gray-800 transition-colors"
                >
                  How It Works
                </a>
                <a
                  href="#features"
                  onClick={handleNavClick}
                  className="block py-2 px-3 rounded-lg text-base font-medium text-gray-300 hover:bg-gray-800 transition-colors"
                >
                  Features
                </a>
                <a
                  href="#faq"
                  onClick={handleNavClick}
                  className="block py-2 px-3 rounded-lg text-base font-medium text-gray-300 hover:bg-gray-800 transition-colors"
                >
                  FAQ
                </a>
                <div className="pt-3 border-t border-gray-800 space-y-3">
                  <a
                    href={getLoginUrl()}
                    onClick={handleNavClick}
                    className="block py-2 px-3 rounded-lg text-base font-medium text-gray-300 hover:bg-gray-800 transition-colors"
                  >
                    Log In
                  </a>
                  <a
                    href="#hero"
                    onClick={handleNavClick}
                    className="block py-3 px-4 rounded-xl bg-gradient-to-r from-brand-blue to-brand-violet text-white text-center text-base font-semibold hover:opacity-90 transition-all"
                  >
                    Join Waitlist
                  </a>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Main Content - No Pricing Section */}
      <main className="relative overflow-x-hidden">
        <HeroSectionV4 />
        <HowItWorksV4 />
        <IntegrationsSectionV4 />
        {/* PricingSectionV4 intentionally omitted */}
        <FAQSectionV4 />
        <FinalCTA />
      </main>

      <LandingFooter />
    </div>
  );
}

export default WaitlistLandingPage;
