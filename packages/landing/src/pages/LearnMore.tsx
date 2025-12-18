import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, ArrowRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { WaitlistModal } from '../components/WaitlistModal';
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
 * Learn More Landing Page
 *
 * Default landing page for the application.
 * Provides information about the product and features.
 */
export function LearnMore() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [showModal, setShowModal] = useState(false);

  // Force dark mode for landing pages
  useForceDarkMode();

  // Branding settings for logos
  const { logoDark } = usePublicBrandingSettings();

  // Close mobile menu when clicking a nav link
  const handleNavClick = () => {
    setMobileMenuOpen(false);
  };

  // Handle email form submission
  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email && email.includes('@')) {
      setShowModal(true);
    }
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
              {logoDark ? (
                <img
                  src={logoDark}
                  alt="60"
                  className="h-10 w-auto transition-all duration-300"
                />
              ) : (
                <span className="text-xl font-bold text-[#37bd7e]">Sixty</span>
              )}
            </motion.a>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-8">
              <a href="#how-it-works" className="text-sm font-medium text-gray-400 hover:text-white transition-colors duration-200">How It Works</a>
              <a href="#features" className="text-sm font-medium text-gray-400 hover:text-white transition-colors duration-200">Features</a>
              <a href="#integrations" className="text-sm font-medium text-gray-400 hover:text-white transition-colors duration-200">Integrations</a>
              <a href="#faq" className="text-sm font-medium text-gray-400 hover:text-white transition-colors duration-200">FAQ</a>
            </div>

            <div className="flex items-center gap-3 sm:gap-4">
              <a
                href={getLoginUrl()}
                className="text-sm font-medium text-gray-400 hover:text-white transition-colors duration-200 hidden sm:block"
              >
                Log In
              </a>
              <motion.button
                onClick={() => setShowModal(true)}
                className="hidden sm:block px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-blue to-brand-violet text-white text-sm font-semibold hover:opacity-90 transition-all duration-200 shadow-lg shadow-brand-violet/25 cursor-pointer"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Get Started
              </motion.button>
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

        {/* Mobile Menu Dropdown */}
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
                  href="#integrations"
                  onClick={handleNavClick}
                  className="block py-2 px-3 rounded-lg text-base font-medium text-gray-300 hover:bg-gray-800 transition-colors"
                >
                  Integrations
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
                  <button
                    onClick={() => {
                      handleNavClick();
                      setShowModal(true);
                    }}
                    className="block w-full py-3 px-4 rounded-xl bg-gradient-to-r from-brand-blue to-brand-violet text-white text-center text-base font-semibold hover:opacity-90 transition-all cursor-pointer"
                  >
                    Get Started
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Main Content */}
      <main className="relative overflow-x-hidden">
        <div id="hero">
          <HeroSectionV4 onCTAClick={() => setShowModal(true)} />
        </div>
        <div id="how-it-works">
          <HowItWorksV4 />
        </div>
        <div id="integrations">
          <IntegrationsSectionV4 />
        </div>
        <div id="faq">
          <FAQSectionV4 />
        </div>
        <FinalCTA onOpenModal={() => setShowModal(true)} email={email} setEmail={setEmail} onEmailSubmit={handleEmailSubmit} />
      </main>

      <LandingFooter />

      {/* Waitlist Modal */}
      <WaitlistModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        initialEmail={email}
        signupSource="learnmore"
      />
    </div>
  );
}
