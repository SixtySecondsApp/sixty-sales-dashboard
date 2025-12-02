import { useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  HeroSection,
  SocialProofBanner,
  ProblemSection,
  HowItWorks,
  FeatureShowcase,
  IntegrationSection,
  TestimonialSection,
  FAQSection,
  FinalCTA,
  LandingFooter,
  PricingSection,
} from './components';

/**
 * MeetingsLanding - Public landing page for the Meetings feature
 *
 * This is a standalone marketing page showcasing the AI-powered meeting
 * intelligence features. It's designed to convert visitors into trial users.
 *
 * Route: /features/meetings (public, no auth required)
 */
export default function MeetingsLanding() {
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
    <div className="min-h-screen bg-[#0f1419] text-gray-100 overflow-x-hidden">
      {/* Gradient background overlay */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(59,130,246,0.15),transparent_50%)] pointer-events-none" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(139,92,246,0.1),transparent_50%)] pointer-events-none" />

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-[#0f1419]/80 border-b border-gray-800/50">
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
              <a href="#features" className="text-gray-400 hover:text-white transition-colors">Features</a>
              <a href="#how-it-works" className="text-gray-400 hover:text-white transition-colors">How It Works</a>
              <a href="#testimonials" className="text-gray-400 hover:text-white transition-colors">Testimonials</a>
              <a href="#pricing" className="text-gray-400 hover:text-white transition-colors">Pricing</a>
              <a href="#faq" className="text-gray-400 hover:text-white transition-colors">FAQ</a>
            </div>

            <div className="flex items-center gap-4">
              <a
                href="/auth/login"
                className="text-gray-400 hover:text-white transition-colors hidden sm:block"
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
        <HeroSection />
        <SocialProofBanner />
        <ProblemSection />
        <HowItWorks />
        <FeatureShowcase />
        <IntegrationSection />
        <TestimonialSection />
        <PricingSection />
        <FAQSection />
        <FinalCTA />
      </main>

      <LandingFooter />
    </div>
  );
}
