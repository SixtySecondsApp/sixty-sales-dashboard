import { useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  HeroSectionV2,
  SocialProofBanner,
  ProblemSectionV2,
  HowItWorksV2,
  FeatureShowcaseV2,
  IntegrationSection,
  TestimonialSectionV2,
  FAQSectionV2,
  FinalCTAV2,
  LandingFooter,
  PricingSectionV2,
} from './components-v2';

/**
 * MeetingsLandingV2 - Enhanced landing page with updated design system
 *
 * Improvements:
 * - Updated to design_system.md v5.0 specifications
 * - Enhanced glassmorphism effects with proper backdrop blur
 * - Improved shimmer animations and skeleton loaders
 * - Better responsive design with mobile-first approach
 * - Enhanced gradient overlays and theme transitions
 * - Optimized performance with React.memo where appropriate
 *
 * Route: /features/meetings-v2 (public, no auth required)
 */
export default function MeetingsLandingV2() {
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
    <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 overflow-x-hidden theme-transition">
      {/* Enhanced gradient background overlay */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(59,130,246,0.15),transparent_50%)] dark:bg-[radial-gradient(ellipse_at_top,rgba(59,130,246,0.15),transparent_50%)] pointer-events-none" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(139,92,246,0.1),transparent_50%)] dark:bg-[radial-gradient(ellipse_at_bottom_right,rgba(139,92,246,0.1),transparent_50%)] pointer-events-none" />

      {/* Navigation with enhanced glassmorphism */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-sm bg-white/95 dark:bg-gray-900/95 border-b border-gray-200 dark:border-gray-700/50">
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
              <a href="#features" className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">Features</a>
              <a href="#how-it-works" className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">How It Works</a>
              <a href="#testimonials" className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">Testimonials</a>
              <a href="#pricing" className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">Pricing</a>
              <a href="#faq" className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">FAQ</a>
            </div>

            <div className="flex items-center gap-4">
              <a
                href="/auth/login"
                className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors hidden sm:block"
              >
                Log In
              </a>
              <motion.a
                href="/auth/signup"
                className="px-4 py-2 rounded-lg bg-blue-600 dark:bg-blue-500/10 text-white dark:text-blue-400 border border-blue-600 dark:border-blue-500/20 hover:bg-blue-700 dark:hover:bg-blue-500/20 hover:border-blue-700 dark:hover:border-blue-500/30 font-semibold shadow-sm dark:shadow-none transition-all duration-200"
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
        <HeroSectionV2 />
        <SocialProofBanner />
        <ProblemSectionV2 />
        <HowItWorksV2 />
        <FeatureShowcaseV2 />
        <IntegrationSection />
        <TestimonialSectionV2 />
        <PricingSectionV2 />
        <FAQSectionV2 />
        <FinalCTAV2 />
      </main>

      <LandingFooter />
    </div>
  );
}
