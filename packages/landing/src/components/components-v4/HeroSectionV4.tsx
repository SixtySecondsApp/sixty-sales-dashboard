import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, Zap, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';

export function HeroSectionV4() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Check theme on mount and when it changes
    const checkTheme = () => {
      const html = document.documentElement;
      const hasDarkClass = html.classList.contains('dark');
      const dataTheme = html.getAttribute('data-theme');
      setIsDark(hasDarkClass || dataTheme === 'dark');
    };

    // Initial check
    checkTheme();

    // Listen for theme changes
    const handleThemeChange = () => checkTheme();
    window.addEventListener('theme-changed', handleThemeChange);

    // Also watch for class/attribute changes
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme']
    });

    return () => {
      window.removeEventListener('theme-changed', handleThemeChange);
      observer.disconnect();
    };
  }, []);

  const bgColor = isDark ? '#0a0d14' : 'white';

  return (
    <section
      id="hero"
      className="hero-section relative overflow-hidden transition-colors duration-300 pt-[200px] pb-[200px]"
      style={{ backgroundColor: bgColor, background: bgColor, margin: 0, marginTop: 0, padding: 0, paddingTop: '200px', paddingBottom: '200px' }}
    >
      {/* Theme-aware Background with Animated Gradient Orbs */}
      <div
        className="absolute inset-0 transition-colors duration-300 min-h-screen"
        style={{ backgroundColor: bgColor, background: bgColor }}
      >
        {/* Grid Pattern */}
        <div
          className="absolute inset-0 opacity-[0.02] dark:opacity-[0.03]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(0,0,0,0.05) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0,0,0,0.05) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px'
          }}
        />
        {/* Dark mode grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-0 dark:opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px'
          }}
        />

        {/* Animated Gradient Orbs - Theme-aware */}
        <motion.div
          className="absolute top-1/4 -left-32 w-[600px] h-[600px] rounded-full opacity-10 dark:opacity-100"
          style={{
            background: 'radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, transparent 70%)',
            filter: 'blur(60px)',
          }}
          animate={{
            x: [0, 50, 0],
            y: [0, 30, 0],
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        <motion.div
          className="absolute bottom-1/4 -right-32 w-[500px] h-[500px] rounded-full opacity-8 dark:opacity-100"
          style={{
            background: 'radial-gradient(circle, rgba(168, 85, 247, 0.12) 0%, transparent 70%)',
            filter: 'blur(60px)',
          }}
          animate={{
            x: [0, -40, 0],
            y: [0, -40, 0],
            scale: [1, 1.15, 1],
          }}
          transition={{
            duration: 18,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full opacity-5 dark:opacity-100"
          style={{
            background: 'radial-gradient(circle, rgba(16, 185, 129, 0.08) 0%, transparent 60%)',
            filter: 'blur(80px)',
          }}
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.2, 0.3, 0.2],
          }}
          transition={{
            duration: 12,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-0">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 lg:items-center">
          {/* Left Column - V3 Text Content */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="text-center lg:text-left"
          >
            {/* V3 Early Adopter Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-emerald-500/10 to-blue-500/10 dark:from-emerald-500/20 dark:to-blue-500/20 border border-emerald-500/20 dark:border-emerald-500/30 mb-6"
            >
              <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Revolutionary AI for Sales Teams</span>
            </motion.div>

            {/* V4 Headline: "Turn Meetings Into Closed Deals" */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.8 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 leading-tight"
            >
              <span className="text-gray-900 dark:text-white">
                Turn Meetings
              </span>
              <br />
              <span className="text-gray-900 dark:text-white">
                Into
              </span>{' '}
              <span className="bg-gradient-to-r from-blue-600 to-emerald-600 dark:from-blue-400 dark:to-emerald-400 bg-clip-text text-transparent">
                Closed Deals
              </span>
            </motion.h1>

            {/* V3 Subheadline */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.8 }}
              className="text-xl sm:text-2xl text-gray-600 dark:text-gray-400 mb-8 leading-relaxed"
            >
              Seamlessly connect your Call Recorder, CRM and Task Manager. Our AI Auto-Generates Reports, Proposals and Tasks for your team.
            </motion.p>

            {/* V3 Enhanced CTA */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.8 }}
              className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-8"
            >
              <Button
                size="lg"
                asChild
                className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-semibold px-8 py-6 rounded-xl shadow-xl shadow-blue-500/25 transition-all hover:shadow-2xl hover:shadow-blue-500/40 group"
              >
                <a href="/waitlist">
                  <span className="text-lg text-white">Sign Up for Free</span>
                  <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform text-white" />
                </a>
              </Button>
            </motion.div>

            {/* V3 Trust Signals (NO fake customer counts) */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.8 }}
              className="flex flex-wrap items-center justify-center lg:justify-start gap-4 sm:gap-6 text-sm text-gray-600 dark:text-gray-400"
            >
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Setup in 60 seconds</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>No credit card</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="font-medium text-emerald-600 dark:text-emerald-400">Early adopter perks</span>
              </div>
            </motion.div>
          </motion.div>

          {/* Right Column - V1 Product Mockup */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4, duration: 0.8 }}
            className="relative"
          >
            {/* V1 Floating Mockup Container */}
            <motion.div
              animate={{
                y: [0, -15, 0],
              }}
              transition={{
                duration: 6,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              className="relative"
            >
              {/* Main Dashboard Card */}
              <div className={`relative rounded-2xl overflow-hidden border shadow-2xl ${
                isDark
                  ? 'border-white/10 bg-gradient-to-br from-gray-900/90 to-gray-900/50 backdrop-blur-xl shadow-black/50'
                  : 'border-gray-200 bg-white shadow-gray-200/50'
              }`}>
                {/* Browser Chrome */}
                <div className={`flex items-center gap-2 px-4 py-3 border-b ${
                  isDark
                    ? 'border-white/10 bg-black/30'
                    : 'border-gray-200 bg-gray-50'
                }`}>
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500/80" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                    <div className="w-3 h-3 rounded-full bg-green-500/80" />
                  </div>
                  <div className="flex-1 flex justify-center">
                    <div className={`px-4 py-1 rounded-md text-xs ${
                      isDark
                        ? 'bg-white/5 text-gray-500'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      use60.com
                    </div>
                  </div>
                </div>

                {/* Dashboard Content */}
                <div className="p-6 space-y-4">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className={isDark ? 'text-white font-semibold' : 'text-gray-900 font-semibold'}>Meeting Hub</h3>
                      <p className={isDark ? 'text-xs text-gray-500' : 'text-xs text-gray-600'}>3 meetings today</p>
                    </div>
                    <div className={`px-3 py-1.5 rounded-lg border text-xs font-medium ${
                      isDark
                        ? 'bg-blue-500/20 border-blue-500/30 text-blue-400'
                        : 'bg-blue-100 border-blue-200 text-blue-700'
                    }`}>
                      AI Active
                    </div>
                  </div>

                  {/* Meeting Cards */}
                  <div className="space-y-3">
                    {[
                      { title: 'Discovery Call - Acme Corp', sentiment: 0.8, time: '10:00 AM', type: 'discovery' },
                      { title: 'Demo - TechStart Inc', sentiment: 0.6, time: '2:00 PM', type: 'demo' },
                      { title: 'Negotiation - Global Ltd', sentiment: -0.2, time: '4:30 PM', type: 'negotiation' },
                    ].map((meeting, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.6 + idx * 0.15, duration: 0.5 }}
                        className={`p-3 rounded-xl border transition-colors ${
                          isDark
                            ? 'bg-white/5 border-white/10 hover:border-white/20'
                            : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-sm font-medium ${
                            isDark ? 'text-white' : 'text-gray-900'
                          }`}>{meeting.title}</span>
                          <span className={`text-xs ${
                            isDark ? 'text-gray-500' : 'text-gray-600'
                          }`}>{meeting.time}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className={`px-2 py-0.5 rounded text-xs font-medium ${
                            meeting.sentiment > 0.5
                              ? isDark
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-emerald-100 text-emerald-700' :
                            meeting.sentiment > 0
                              ? isDark
                                ? 'bg-amber-500/20 text-amber-400'
                                : 'bg-amber-100 text-amber-700' :
                              isDark
                                ? 'bg-rose-500/20 text-rose-400'
                                : 'bg-rose-100 text-rose-700'
                          }`}>
                            {meeting.sentiment > 0.5 ? 'Positive' : meeting.sentiment > 0 ? 'Neutral' : 'At Risk'}
                          </div>
                          <span className={`px-2 py-0.5 rounded text-xs capitalize ${
                            isDark
                              ? 'bg-purple-500/20 text-purple-400'
                              : 'bg-purple-100 text-purple-700'
                          }`}>
                            {meeting.type}
                          </span>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  {/* Stats Row */}
                  <div className="grid grid-cols-3 gap-3 pt-2">
                    {[
                      { label: 'Action Items', value: '12', trend: '+3' },
                      { label: 'Avg Sentiment', value: '0.72', trend: '+0.1' },
                      { label: 'Talk Time', value: '42%', trend: 'Optimal' },
                    ].map((stat, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.9 + idx * 0.1, duration: 0.5 }}
                        className={`p-3 rounded-lg border ${
                          isDark
                            ? 'bg-gradient-to-br from-white/5 to-white/[0.02] border-white/10'
                            : 'bg-gray-50 border-gray-200'
                        }`}
                      >
                        <div className={`text-xl font-bold ${
                          isDark ? 'text-white' : 'text-gray-900'
                        }`}>{stat.value}</div>
                        <div className={`text-xs ${
                          isDark ? 'text-gray-500' : 'text-gray-600'
                        }`}>{stat.label}</div>
                        <div className={`text-xs mt-1 ${
                          isDark ? 'text-emerald-400' : 'text-emerald-600'
                        }`}>{stat.trend}</div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Floating Elements */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 1.2, duration: 0.5 }}
                className="absolute -left-8 top-1/4 p-3 rounded-xl bg-emerald-50 dark:bg-gradient-to-br dark:from-emerald-500/20 dark:to-emerald-500/5 border border-emerald-200 dark:border-emerald-500/30 dark:backdrop-blur-sm shadow-xl"
              >
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm font-medium">Proposal Sent</span>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 1.4, duration: 0.5 }}
                className="absolute -right-6 bottom-1/3 p-3 rounded-xl bg-blue-50 dark:bg-gradient-to-br dark:from-blue-500/20 dark:to-blue-500/5 border border-blue-200 dark:border-blue-500/30 dark:backdrop-blur-sm shadow-xl"
              >
                <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
                  <Sparkles className="w-5 h-5" />
                  <span className="text-sm font-medium">AI Analyzing...</span>
                </div>
              </motion.div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
