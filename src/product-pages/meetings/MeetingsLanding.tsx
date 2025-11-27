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
              className="flex items-center gap-2"
              whileHover={{ scale: 1.02 }}
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <span className="text-white font-bold text-sm">S</span>
              </div>
              <span className="text-xl font-semibold text-white">Sixty</span>
            </motion.a>

            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-gray-400 hover:text-white transition-colors">Features</a>
              <a href="#how-it-works" className="text-gray-400 hover:text-white transition-colors">How It Works</a>
              <a href="#testimonials" className="text-gray-400 hover:text-white transition-colors">Testimonials</a>
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
        <FAQSection />
        <FinalCTA />
      </main>

      <LandingFooter />
    </div>
  );
}
