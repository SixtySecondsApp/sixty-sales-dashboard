import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
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
  Footer,
} from '@/components/landing';

export default function LandingMeetings() {
  // Force dark theme for landing page
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.documentElement.classList.add('dark');
    
    return () => {
      // Don't reset on unmount - let the app handle theme
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0d14] text-white overflow-x-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0d14]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                <span className="text-white font-bold text-sm">60</span>
              </div>
              <span className="text-xl font-bold text-white">Sixty</span>
            </Link>

            {/* Navigation Links */}
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-gray-400 hover:text-white transition-colors text-sm font-medium">
                Features
              </a>
              <a href="#integrations" className="text-gray-400 hover:text-white transition-colors text-sm font-medium">
                Integrations
              </a>
              <a href="#testimonials" className="text-gray-400 hover:text-white transition-colors text-sm font-medium">
                Testimonials
              </a>
              <Link to="/pricing" className="text-gray-400 hover:text-white transition-colors text-sm font-medium">
                Pricing
              </Link>
            </div>

            {/* Auth Buttons */}
            <div className="flex items-center gap-3">
              <Link
                to="/auth/login"
                className="hidden sm:inline-flex px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
              >
                Sign In
              </Link>
              <Link
                to="/auth/signup"
                className="group inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-all duration-300"
              >
                Start Free Trial
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main>
        {/* Hero */}
        <HeroSection />

        {/* Social Proof */}
        <SocialProofBanner />

        {/* Problem */}
        <div id="problem">
          <ProblemSection />
        </div>

        {/* How It Works */}
        <div id="how-it-works">
          <HowItWorks />
        </div>

        {/* Features */}
        <div id="features">
          <FeatureShowcase />
        </div>

        {/* Integrations */}
        <div id="integrations">
          <IntegrationSection />
        </div>

        {/* Testimonials */}
        <div id="testimonials">
          <TestimonialSection />
        </div>

        {/* FAQ */}
        <FAQSection />

        {/* Final CTA */}
        <FinalCTA />
      </main>

      {/* Footer */}
      <Footer />

      {/* Scroll to top button */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed bottom-8 right-8 w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/30 flex items-center justify-center transition-all duration-300 z-40"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
        </svg>
      </motion.button>
    </div>
  );
}

