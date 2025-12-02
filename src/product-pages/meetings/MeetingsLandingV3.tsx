import { useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  HeroSectionV3,
  FeatureShowcaseV3,
  HowItWorks,
  FAQSectionV3,
  FinalCTA,
  LandingFooter,
  PricingSectionV3,
  IntegrationSection,
} from './components-v3';
import { ProblemSection } from './components';

/**
 * MeetingsLandingV3 - Early Adopter Focused Landing Page
 *
 * This version focuses on early adopter positioning without fake social proof.
 * Key changes from v2:
 * - Headline A: "Close More Deals Without Taking a Single Note"
 * - Early adopter badge instead of urgency banner
 * - "Be a Founder" CTA messaging
 * - No customer testimonials or counts
 * - Founder credibility focus
 * - New product trust-building
 *
 * Route: /product/meetings-v3 (public, no auth required)
 */
export default function MeetingsLandingV3() {
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
            const navHeight = 64; // Height of fixed nav
            const targetPosition = targetElement.offsetTop - navHeight;

            window.scrollTo({
              top: targetPosition,
              behavior: 'smooth',
            });
          }
        }
      }
    };

    document.addEventListener('click', handleAnchorClick);
    return () => document.removeEventListener('click', handleAnchorClick);
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 overflow-x-hidden transition-colors duration-300">
      {/* Early Adopter Banner */}
      <div className="bg-gradient-to-r from-emerald-500/10 to-blue-500/10 border-b border-emerald-500/20 dark:border-emerald-500/10 py-2">
        <p className="text-center text-sm text-gray-700 dark:text-gray-300">
          ✨ <strong>Early Access:</strong> Join founding users shaping the future of sales AI ·{' '}
          <span className="text-emerald-600 dark:text-emerald-400 font-bold ml-2">Limited beta spots available</span>
        </p>
      </div>

      {/* Navigation */}
      <nav className="sticky top-0 z-50 backdrop-blur-sm bg-white/95 dark:bg-gray-900/95 border-b border-gray-200 dark:border-gray-700/50 transition-colors duration-300">
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

            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">Features</a>
              <a href="#how-it-works" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">How It Works</a>
              <a href="#pricing" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">Pricing</a>
              <a href="#faq" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">FAQ</a>
            </div>

            <div className="flex items-center gap-4">
              <a
                href="/auth/login"
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors hidden sm:block"
              >
                Log In
              </a>
              <motion.a
                href="/auth/signup"
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 text-white font-medium hover:from-blue-500 hover:to-blue-400 transition-all shadow-lg shadow-blue-500/25"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Start Free Trial
              </motion.a>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="relative">
        <HeroSectionV3 />
        <ProblemSection />
        <HowItWorks />
        <FeatureShowcaseV3 />
        <IntegrationSection />
        <PricingSectionV3 />
        <FAQSectionV3 />
        <FinalCTA />
      </main>

      <LandingFooter />
    </div>
  );
}
