import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, ArrowRight, Sparkles, FileText, CheckCircle2 } from 'lucide-react';

// Keyframe animations for WorkflowVisual component
const heroStyles = `
  @keyframes hero-scan-text {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  @keyframes hero-pulse-ring {
    0% { transform: scale(0.8); opacity: 0.5; }
    100% { transform: scale(2); opacity: 0; }
  }

  @keyframes hero-slide-up-fade {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes hero-highlight-trigger {
    0% { background-color: transparent; color: inherit; }
    100% { background-color: rgba(3, 173, 156, 0.2); color: #03AD9C; }
  }

  @keyframes hero-grow-line {
    from { height: 0; opacity: 0; }
    to { height: 24px; opacity: 1; }
  }

  @keyframes hero-float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-10px); }
  }

  .hero-animate-scan {
    background: linear-gradient(90deg, transparent, rgba(42, 94, 219, 0.3), transparent);
    background-size: 200% 100%;
    animation: hero-scan-text 2s infinite linear;
  }

  .hero-pulse-dot::before {
    content: '';
    position: absolute;
    left: 0; top: 0;
    width: 100%; height: 100%;
    background-color: #ef4444;
    border-radius: 50%;
    z-index: -1;
    animation: hero-pulse-ring 2s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
  }

  .hero-animate-step-1 {
    animation: hero-slide-up-fade 0.7s cubic-bezier(0.22, 1, 0.36, 1) forwards;
    animation-delay: 0.4s;
    opacity: 0;
  }

  .hero-animate-step-2 {
    animation: hero-slide-up-fade 0.7s cubic-bezier(0.22, 1, 0.36, 1) forwards;
    animation-delay: 2.0s;
    opacity: 0;
  }

  .hero-animate-step-3 {
    animation: hero-slide-up-fade 0.7s cubic-bezier(0.22, 1, 0.36, 1) forwards;
    animation-delay: 3.6s;
    opacity: 0;
  }

  .hero-trigger-phrase {
    animation: hero-highlight-trigger 0.8s cubic-bezier(0.22, 1, 0.36, 1) forwards;
    animation-delay: 1.2s;
    padding: 0 4px;
    border-radius: 4px;
  }

  .hero-connector-line {
    animation: hero-grow-line 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards;
    animation-delay: 1.4s;
    opacity: 0;
    height: 0;
  }

  .hero-connector-line-2 {
    animation: hero-grow-line 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards;
    animation-delay: 3.0s;
    opacity: 0;
    height: 0;
  }

  .hero-animate-float {
    animation: hero-float 3s ease-in-out infinite;
  }

  .hero-animate-float-delay {
    animation: hero-float 4s ease-in-out infinite 1s;
  }

  @keyframes hero-alt-scan {
    0% { top: 0%; opacity: 0; }
    10% { opacity: 1; }
    90% { opacity: 1; }
    100% { top: 100%; opacity: 0; }
  }

  .hero-alt-animate-scan {
    animation: hero-alt-scan 3s linear infinite;
  }

  .dark .hero-trigger-phrase {
    animation-name: hero-highlight-trigger-dark;
  }

  @keyframes hero-highlight-trigger-dark {
    0% { background-color: transparent; color: inherit; }
    100% { background-color: rgba(3, 173, 156, 0.3); color: #03AD9C; }
  }
`;

// Animation timing constants
const WORKFLOW_ANIMATION_DURATION = 4500; // step3 delay (3.6s) + step3 duration (0.7s)
const DASHBOARD_DISPLAY_TIME = 5000; // 5 seconds on dashboard
const WORKFLOW_WAIT_AFTER = 4000; // 4 seconds after workflow completes

import {
  IntegrationsSectionV4,
  HowItWorksV4,
  FAQSectionV4,
  FinalCTA,
  LandingFooter
} from '../components/components-v4';
import { usePublicBrandingSettings } from '../lib/hooks/useBrandingSettings';
import { useForceDarkMode } from '../lib/hooks/useForceDarkMode';
import { WaitlistModal } from '../components/WaitlistModal';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { getLoginUrl } from '../lib/utils/siteUrl';

/**
 * Waitlist Landing Page with Popup Modal
 *
 * Same as WaitlistLandingPage but with a custom hero that has an email input.
 * When email is submitted, opens a modal with the full waitlist form.
 * signup_source: 'join-popup'
 */
export function WaitlistLandingPopup() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [email, setEmail] = useState('');

  // Animation cycling state
  const [mounted, setMounted] = useState(false);
  const [activeView, setActiveView] = useState<'dashboard' | 'workflow'>('dashboard');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [workflowKey, setWorkflowKey] = useState(0);

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
    if (email.trim()) {
      setShowModal(true);
    }
  };

  // Transition between dashboard and workflow views
  const transitionToView = useCallback((view: 'dashboard' | 'workflow') => {
    setIsTransitioning(true);
    setTimeout(() => {
      setActiveView(view);
      if (view === 'workflow') {
        setWorkflowKey(prev => prev + 1); // Force re-render to restart animations
      }
      setIsTransitioning(false);
    }, 400); // Match exit animation duration
  }, []);

  // Inject hero animation styles and set mounted
  useEffect(() => {
    setMounted(true);
    const styleId = 'hero-animations-style-waitlist';
    if (!document.getElementById(styleId)) {
      const styleEl = document.createElement('style');
      styleEl.id = styleId;
      styleEl.textContent = heroStyles;
      document.head.appendChild(styleEl);
    }
  }, []);

  // Auto-cycle between dashboard and workflow views
  useEffect(() => {
    if (!mounted) return;

    let timer: ReturnType<typeof setTimeout>;

    if (activeView === 'dashboard' && !isTransitioning) {
      // After 5 seconds on dashboard, switch to workflow
      timer = setTimeout(() => {
        transitionToView('workflow');
      }, DASHBOARD_DISPLAY_TIME);
    } else if (activeView === 'workflow' && !isTransitioning) {
      // After workflow animation completes + wait time, switch back to dashboard
      timer = setTimeout(() => {
        transitionToView('dashboard');
      }, WORKFLOW_ANIMATION_DURATION + WORKFLOW_WAIT_AFTER);
    }

    return () => clearTimeout(timer);
  }, [activeView, isTransitioning, mounted, transitionToView]);

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
              <motion.button
                onClick={() => setShowModal(true)}
                className="hidden sm:block px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-blue to-brand-violet text-white text-sm font-semibold hover:from-[#2351C4] hover:to-[#7024C0] transition-all duration-200 shadow-lg shadow-brand-blue/25"
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
                  <button
                    onClick={() => {
                      handleNavClick();
                      setShowModal(true);
                    }}
                    className="block w-full py-3 px-4 rounded-xl bg-gradient-to-r from-brand-blue to-brand-violet text-white text-center text-base font-semibold hover:from-[#2351C4] hover:to-[#7024C0] transition-all"
                  >
                    Join Waitlist
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Custom Hero with Email Input and Dashboard Mockup */}
      <section className="relative pt-32 pb-24 lg:pt-40 lg:pb-32 overflow-hidden bg-gray-950 transition-colors duration-300">
        {/* Background Decor */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full z-0 pointer-events-none">
          <div className="absolute top-20 left-10 w-72 h-72 bg-brand-blue/15 rounded-full blur-3xl mix-blend-normal animate-pulse" />
          <div className="absolute top-20 right-10 w-72 h-72 bg-brand-violet/15 rounded-full blur-3xl mix-blend-normal animate-pulse" style={{ animationDelay: '1s' }} />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left Column - Content */}
            <div className="text-center lg:text-left">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-blue/10 border border-brand-blue/20 text-brand-blue text-sm font-semibold mb-6">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-blue opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-blue"></span>
                </span>
                Limited Early Access
              </div>

              {/* Headline */}
              <h1 className="font-heading text-4xl sm:text-5xl lg:text-5xl font-bold tracking-tight text-gray-100 leading-[1.1] mb-6">
                Turn your sales calls into{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-blue to-brand-violet">
                  instant action.
                </span>
              </h1>

              {/* Subheadline */}
              <p className="font-body text-lg sm:text-xl text-gray-300 mb-8 leading-relaxed max-w-xl mx-auto lg:mx-0">
                60 listens to your meetings, detects promises made, and automatically executes the workflow. Never miss an "I'll send you a proposal" again.
              </p>

              {/* Email Input Form */}
              <form onSubmit={handleEmailSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto lg:mx-0">
                <Input
                  type="email"
                  placeholder="Enter your work email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="flex-1 h-12 bg-gray-900 border-gray-700 text-white placeholder:text-gray-500"
                />
                <Button
                  type="submit"
                  className="h-12 px-6 bg-gradient-to-r from-brand-blue to-brand-violet hover:from-[#2351C4] hover:to-[#7024C0] text-white font-semibold flex items-center gap-2 shadow-lg shadow-brand-blue/20"
                >
                  Get Early Access
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </form>

              <p className="text-sm text-gray-400 mt-4">
                No credit card required • 50% launch discount for early adopters
              </p>
            </div>

            {/* Right Column - Cycling Animation Visual */}
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4, duration: 1, ease: 'easeOut' }}
              className="relative hidden lg:flex justify-center items-center"
            >
              {/* Glow effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-brand-blue/30 to-brand-teal/30 rounded-3xl blur-3xl" />

              {/* Cycling View Container */}
              <div className="relative w-full max-w-lg min-h-[450px] flex items-center justify-center">

                {/* Dashboard View */}
                <div
                  className={`absolute inset-0 flex items-center justify-center transition-all duration-400 ${
                    activeView === 'dashboard' && !isTransitioning
                      ? 'opacity-100 translate-y-0'
                      : 'opacity-0 translate-y-[-8px] pointer-events-none'
                  }`}
                >
                  {/* DashboardVisual */}
                  <div className="relative w-full max-w-lg">
                    <div className="relative w-full bg-gray-900/80 backdrop-blur-xl border border-gray-700/50 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden transform transition-all duration-500 hover:scale-[1.01]">
                      {/* Window Controls */}
                      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800/50 bg-gray-800/30">
                        <div className="w-3 h-3 rounded-full bg-red-400/80" />
                        <div className="w-3 h-3 rounded-full bg-yellow-400/80" />
                        <div className="w-3 h-3 rounded-full bg-green-400/80" />
                        <div className="ml-auto text-xs font-medium text-gray-400">use60.com</div>
                      </div>

                      {/* Dashboard Content */}
                      <div className="p-6 space-y-6">
                        {/* Header */}
                        <div className="flex justify-between items-center">
                          <div>
                            <h3 className="font-heading text-lg font-bold text-gray-100">Meeting Hub</h3>
                            <p className="text-xs text-gray-400">3 meetings processed today</p>
                          </div>
                          <div className="px-2 py-1 rounded text-xs font-medium bg-brand-blue/10 text-brand-blue border border-brand-blue/20 animate-pulse">
                            AI Active
                          </div>
                        </div>

                        {/* Meeting List */}
                        <div className="space-y-3 relative">
                          {/* Scanning Line Animation */}
                          <div className="absolute left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-brand-blue to-transparent z-20 hero-alt-animate-scan opacity-100" />

                          {/* Item 1 */}
                          <div className="group relative p-3 rounded-xl border border-gray-800 bg-gray-800/30 transition-all hover:border-brand-blue/30">
                            <div className="flex justify-between items-start mb-2">
                              <div className="font-medium text-sm text-gray-200">Discovery - Acme Corp</div>
                              <span className="text-xs text-gray-400">10:00 AM</span>
                            </div>
                            <div className="flex gap-2">
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-brand-teal/10 text-brand-teal">Positive</span>
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-brand-violet/10 text-brand-violet">Proposal Sent</span>
                            </div>
                          </div>

                          {/* Item 2 */}
                          <div className="group relative p-3 rounded-xl border border-gray-800 bg-gray-900/40 transition-all hover:border-brand-blue/30">
                            <div className="flex justify-between items-start mb-2">
                              <div className="font-medium text-sm text-gray-200">Demo - TechStart Inc</div>
                              <span className="text-xs text-gray-400">2:00 PM</span>
                            </div>
                            <div className="flex gap-2">
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-brand-teal/10 text-brand-teal">High Intent</span>
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-brand-blue/10 text-brand-blue">Processing...</span>
                            </div>
                          </div>

                          {/* Item 3 */}
                          <div className="group relative p-3 rounded-xl border border-gray-800 bg-gray-900/40 opacity-60">
                            <div className="flex justify-between items-start mb-2">
                              <div className="font-medium text-sm text-gray-200">Sync - Global Ltd</div>
                              <span className="text-xs text-gray-400">4:30 PM</span>
                            </div>
                            <div className="flex gap-2">
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-700 text-gray-500">Scheduled</span>
                            </div>
                          </div>
                        </div>

                        {/* Stats Row */}
                        <div className="grid grid-cols-3 gap-3 pt-2">
                          <div className="p-3 rounded-lg bg-gray-800/30 border border-gray-800">
                            <div className="text-xs text-gray-400 mb-1">Action Items</div>
                            <div className="text-lg font-bold text-gray-100">12</div>
                          </div>
                          <div className="p-3 rounded-lg bg-gray-800/30 border border-gray-800">
                            <div className="text-xs text-gray-400 mb-1">Sentiment</div>
                            <div className="text-lg font-bold text-brand-teal">0.72</div>
                          </div>
                          <div className="p-3 rounded-lg bg-gray-800/30 border border-gray-800">
                            <div className="text-xs text-gray-400 mb-1">Talk Time</div>
                            <div className="text-lg font-bold text-brand-blue">42%</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Dashboard Floating Elements */}
                    <div className="absolute right-0 top-20 lg:-right-12 lg:top-12 bg-gray-800 p-3 rounded-lg shadow-xl border border-brand-teal/20 hero-animate-float-delay z-20">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-brand-teal/10">
                          <CheckCircle2 className="w-4 h-4 text-brand-teal" />
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-gray-100">Proposal Sent</div>
                          <div className="text-[10px] text-gray-400">Acme Corp • $12k</div>
                        </div>
                      </div>
                    </div>

                    <div className="absolute left-0 bottom-32 lg:-left-12 lg:bottom-24 bg-gray-800 p-3 rounded-lg shadow-xl border border-brand-violet/20 hero-animate-float z-20">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-brand-violet/10">
                          <Sparkles className="w-4 h-4 text-brand-violet animate-pulse" />
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-gray-100">AI Analyzing</div>
                          <div className="text-[10px] text-gray-400">Extracting tasks...</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Workflow View */}
                <div
                  key={workflowKey}
                  className={`absolute inset-0 flex items-center justify-center transition-all duration-400 ${
                    activeView === 'workflow' && !isTransitioning
                      ? 'opacity-100 translate-y-0'
                      : 'opacity-0 translate-y-[8px] pointer-events-none'
                  }`}
                >
                  {/* WorkflowVisual */}
                  <div className="relative w-full max-w-md">
                    <div className="relative w-full bg-gray-900/80 backdrop-blur-sm rounded-2xl shadow-2xl shadow-black/50 border border-gray-700/50 overflow-hidden transform transition-all hover:scale-[1.01] duration-500">
                      {/* Header: Call Status */}
                      <div className="bg-gray-800/50 px-6 py-4 border-b border-gray-700/50 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 bg-red-500 rounded-full relative hero-pulse-dot"></div>
                          <span className="font-semibold text-gray-200">Completed: Discovery Call</span>
                        </div>
                        <div className="text-xs font-mono text-gray-500">32:05</div>
                      </div>

                      {/* Body: The Narrative Flow */}
                      <div className="p-6 space-y-0">
                        {/* 1. The Transcript (Context) */}
                        <div className="space-y-4 mb-2 hero-animate-step-1">
                          <div className="flex gap-3">
                            <div className="w-8 h-8 rounded-full bg-brand-violet/10 flex items-center justify-center text-xs font-bold text-brand-violet flex-shrink-0">JD</div>
                            <div className="bg-gray-800 p-3 rounded-lg rounded-tl-none text-sm text-gray-300 w-full">
                              That sounds exactly like what we need. What are the next steps to get this moving?
                            </div>
                          </div>

                          <div className="flex gap-3 flex-row-reverse">
                            <div className="w-8 h-8 rounded-full bg-brand-blue flex items-center justify-center text-xs font-bold text-white flex-shrink-0">YOU</div>
                            <div className="bg-brand-blue/10 p-3 rounded-lg rounded-tr-none text-sm text-gray-200 w-full border border-brand-blue/20">
                              Great. <span className="hero-trigger-phrase font-medium">I'll send you a proposal</span> with the pricing breakdown we discussed by EOD.
                            </div>
                          </div>
                        </div>

                        {/* Connector Line */}
                        <div className="flex justify-center my-1 hero-connector-line">
                          <div className="w-0.5 bg-gradient-to-b from-brand-teal to-brand-blue h-6 rounded-full"></div>
                        </div>

                        {/* 2. The AI Detection (The "Brain") */}
                        <div className="hero-animate-step-2 relative z-10">
                          <div className="bg-brand-teal/10 border border-brand-teal/20 rounded-lg p-3 flex items-center gap-3 shadow-sm">
                            <div className="bg-brand-teal/20 p-2 rounded-md">
                              <Sparkles className="w-4 h-4 text-brand-teal" />
                            </div>
                            <div>
                              <div className="text-xs font-bold text-brand-teal uppercase tracking-wide">Intent Detected</div>
                              <div className="text-sm text-gray-200">Action: Create & Send Proposal</div>
                            </div>
                          </div>
                        </div>

                        {/* Connector Line 2 */}
                        <div className="flex justify-center my-1 hero-connector-line-2">
                          <div className="w-0.5 bg-gray-600 h-6 rounded-full"></div>
                        </div>

                        {/* 3. The Result (The Artifact) */}
                        <div className="hero-animate-step-3">
                          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 shadow-none relative overflow-hidden group">
                            {/* Teams Badge */}
                            <div className="absolute top-0 right-0 bg-[#5B5FC7] text-white text-[10px] px-2 py-1 rounded-bl-lg font-medium flex items-center gap-1">
                              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M20.625 8.073c.574 0 1.125.224 1.531.623.407.4.637.943.637 1.51v5.139c0 .566-.23 1.11-.637 1.51a2.175 2.175 0 01-1.531.623h-.417v2.084c0 .567-.23 1.11-.637 1.51a2.175 2.175 0 01-1.531.623H5.958a2.175 2.175 0 01-1.531-.623 2.12 2.12 0 01-.637-1.51v-2.084h-.415c-.574 0-1.125-.224-1.531-.623A2.12 2.12 0 011.207 15.344V10.206c0-.567.23-1.11.637-1.51a2.175 2.175 0 011.531-.623h.415V6.422c0-.283.057-.564.168-.826a2.13 2.13 0 01.469-.701 2.18 2.18 0 01.71-.463c.265-.11.55-.165.836-.165h5.569c.287 0 .571.056.836.165.266.11.507.267.71.463.204.197.365.44.469.701.111.262.168.543.168.826v1.65h5.484zM8.542 6.422v1.65h2.916v-1.65H8.542zm9.375 7.29V10.205H6.083v6.773h-.29v2.584h12.332v-2.584h-.208v-3.266zm-7.709 0v2.083h2.084v-2.083h-2.084z"/></svg>
                              Sent to Teams
                            </div>

                            <div className="flex items-start gap-4">
                              <div className="bg-red-500/10 p-3 rounded-lg border border-red-500/20">
                                <FileText className="w-6 h-6 text-red-400" />
                              </div>
                              <div>
                                <h4 className="font-heading font-bold text-gray-100 text-sm">Acme_Proposal_v1.pdf</h4>
                                <p className="text-xs text-gray-400 mt-1 mb-3">Generated from template "Standard Enterprise"</p>

                                <div className="flex gap-2">
                                  <button className="text-xs bg-gray-700 text-white px-3 py-1.5 rounded-md hover:bg-gray-600 transition-colors">Review</button>
                                  <button className="text-xs bg-gray-800 border border-gray-600 text-gray-300 px-3 py-1.5 rounded-md hover:bg-gray-700 transition-colors">Edit</button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Progress Bar at bottom */}
                      <div className="h-1 w-full bg-gray-800">
                        <div className="h-full hero-animate-scan w-full"></div>
                      </div>
                    </div>

                    {/* Workflow Floating Elements */}
                    <div className="absolute -right-16 top-20 bg-gray-800 p-3 rounded-xl shadow-xl shadow-none border border-gray-700 hero-animate-float">
                      <img src="https://upload.wikimedia.org/wikipedia/commons/4/44/Microsoft_logo.svg" className="w-6 h-6" alt="Microsoft" />
                    </div>
                    <div className="absolute -left-20 bottom-32 bg-gray-800 p-3 rounded-xl shadow-xl shadow-none border border-gray-700 hero-animate-float-delay">
                      <img src="https://upload.wikimedia.org/wikipedia/commons/f/f9/Salesforce.com_logo.svg" className="w-8 h-6 object-contain" alt="Salesforce" />
                    </div>
                  </div>
                </div>

              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Main Content - No Pricing Section */}
      <main className="relative overflow-x-hidden bg-transparent">
        <HowItWorksV4 />
        <IntegrationsSectionV4 />
        {/* PricingSectionV4 intentionally omitted */}
        <FAQSectionV4 />
        <FinalCTA />
      </main>

      <LandingFooter />

      {/* Waitlist Modal */}
      <WaitlistModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        initialEmail={email}
        signupSource="join-popup"
      />
    </div>
  );
}

export default WaitlistLandingPopup;
