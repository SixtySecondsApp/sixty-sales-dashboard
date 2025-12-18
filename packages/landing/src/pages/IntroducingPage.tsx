import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Sparkles, ArrowRight, Menu, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { WaitlistModal } from '@landing/components/WaitlistModal';
import { usePublicBrandingSettings } from '@/lib/hooks/useBrandingSettings';
import {
  HowItWorksV4,
  FAQSectionV4,
  LandingFooter
} from '../components/components-v4';
import { getLoginUrl } from '../lib/utils/siteUrl';

const VIDEO_URL = 'https://res.cloudinary.com/sixty-seconds/video/upload/v1765991844/60%20VSL%20-%20Waitlist/VSL1-descript-720p_fh7eoi.mp4';

export function IntroducingPage() {
  const [email, setEmail] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Get logo from branding settings
  const { logoDark } = usePublicBrandingSettings();

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email && email.includes('@')) {
      setShowModal(true);
    }
  };

  const handlePlayVideo = () => {
    if (videoRef.current) {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

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

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-8">
              <a href="#how-it-works" className="text-sm font-medium text-gray-400 hover:text-white transition-colors duration-200">How It Works</a>
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
                Join Waitlist
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
                    Join Waitlist
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Main Content */}
      <main className="relative overflow-x-hidden">
        {/* Hero Section */}
        <section id="hero" className="relative min-h-screen flex flex-col items-center justify-center pt-16 overflow-hidden">
          {/* Background Gradient */}
          <div className="absolute inset-0 z-0 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-brand-violet/20 rounded-full blur-[120px]" />
            <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-brand-blue/15 rounded-full blur-[100px]" />
            <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-brand-teal/10 rounded-full blur-[100px]" />
          </div>

          <div className="relative z-10 w-full max-w-4xl mx-auto flex flex-col items-center px-4 py-8 md:py-12">
            {/* Eyebrow Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-violet/10 border border-brand-violet/20 text-white text-sm font-semibold mb-6"
            >
              <Sparkles className="w-4 h-4" />
              <span>Limited Early Access</span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="font-heading text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-center text-white leading-tight mb-4"
            >
              Your Post Meeting
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-blue to-brand-violet">
                Command Center
              </span>
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="text-gray-400 text-center text-base md:text-lg max-w-2xl mb-8"
            >
              60 is your AI sales assistant looking after the admin you hate.
            </motion.p>

            {/* Video Container */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.6 }}
              className="relative w-full max-w-3xl mb-8"
            >
              <div className="relative rounded-2xl overflow-hidden backdrop-blur-2xl bg-white/5 border border-white/10 shadow-2xl shadow-brand-violet/10">
                {/* Video Element */}
                <video
                  ref={videoRef}
                  src={VIDEO_URL}
                  controls={isPlaying}
                  playsInline
                  className="w-full aspect-video bg-gray-900"
                  poster=""
                  onEnded={() => setIsPlaying(false)}
                />

                {/* Play Button Overlay */}
                {!isPlaying && (
                  <button
                    onClick={handlePlayVideo}
                    className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/20 transition-colors group cursor-pointer"
                    aria-label="Play video"
                  >
                    <div className="relative">
                      {/* Pulse Ring */}
                      <div className="absolute inset-0 rounded-full bg-white/20 animate-ping" />
                      {/* Play Icon - White circle with solid purple play */}
                      <div className="relative bg-white rounded-full p-5 md:p-7 transition-all group-hover:scale-110 shadow-xl">
                        <Play className="w-10 h-10 md:w-14 md:h-14 text-brand-violet fill-brand-violet ml-1" />
                      </div>
                    </div>
                  </button>
                )}
              </div>
            </motion.div>

            {/* Email Capture Form */}
            <motion.form
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.8 }}
              onSubmit={handleEmailSubmit}
              className="w-full max-w-md"
            >
              <div className="flex flex-col sm:flex-row gap-3 p-2 rounded-2xl backdrop-blur-xl bg-white/5 border border-white/10">
                <Input
                  type="email"
                  placeholder="Enter your work email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="flex-1 h-12 bg-transparent border-0 text-white placeholder:text-gray-500 focus-visible:ring-0 focus-visible:ring-offset-0 px-4"
                />
                <Button
                  type="submit"
                  className="h-12 px-6 bg-gradient-to-r from-brand-blue to-brand-violet hover:from-[#2351C4] hover:to-[#7024C0] text-white font-semibold rounded-xl whitespace-nowrap"
                >
                  Get Early Access
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </motion.form>

            {/* Trust Indicators */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 1 }}
              className="text-gray-500 text-sm text-center mt-4"
            >
              No credit card required &bull; 500+ sales leaders on the waitlist
            </motion.p>
          </div>
        </section>

        {/* How It Works Section */}
        <HowItWorksV4 />

        {/* FAQ Section */}
        <FAQSectionV4 />
      </main>

      {/* Footer */}
      <LandingFooter />

      {/* Waitlist Modal */}
      <WaitlistModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        initialEmail={email}
        signupSource="introducing-vsl"
      />
    </div>
  );
}

export default IntroducingPage;
