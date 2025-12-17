import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, Zap, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function HeroSectionV3() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-b from-blue-50 via-white to-white dark:from-gray-900 dark:via-gray-950 dark:to-gray-950" />

      {/* Subtle grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.015] dark:opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px'
        }}
      />

      {/* Animated gradient orbs */}
      <motion.div
        className="absolute top-1/4 -left-32 w-[600px] h-[600px] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(59, 130, 246, 0.12) 0%, transparent 70%)',
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

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-8 lg:pb-12">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left Column - Text */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="text-center lg:text-left"
          >
            {/* Early Adopter Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-emerald-500/10 to-blue-500/10 dark:from-emerald-500/20 dark:to-blue-500/20 border border-emerald-500/20 dark:border-emerald-500/30 mb-6"
            >
              <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Revolutionary AI for Sales Teams</span>
            </motion.div>

            {/* Headline A: "Close More Deals Without Taking a Single Note" */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.8 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-heading font-bold mb-6 leading-tight"
            >
              <span className="bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
                Close More Deals
              </span>
              <br />
              <span className="bg-gradient-to-r from-blue-600 to-emerald-600 dark:from-blue-400 dark:to-emerald-400 bg-clip-text text-transparent">
                Without Taking a Single Note
              </span>
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.8 }}
              className="text-xl sm:text-2xl text-gray-600 dark:text-gray-400 mb-8 leading-relaxed"
            >
              Revolutionary AI that works while you sleep. No notes. No data entry. Just wins.
              <span className="block mt-2 text-emerald-600 dark:text-emerald-400 font-medium">
                Be among the first to transform how you sell.
              </span>
            </motion.p>

            {/* Enhanced CTA */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.8 }}
              className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-8"
            >
              <Button
                size="lg"
                className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-semibold px-8 py-6 rounded-xl shadow-xl shadow-blue-500/25 transition-all hover:shadow-2xl hover:shadow-blue-500/40 group"
              >
                <span className="flex flex-col items-start">
                  <span className="text-lg">Start Free Trial—Be a Founder</span>
                  <span className="text-xs opacity-90 font-normal">Help Shape the Product—No Credit Card</span>
                </span>
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </motion.div>

            {/* Trust Signals (NO fake customer counts) */}
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
                <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Free Fathom integration</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="font-medium text-emerald-600 dark:text-emerald-400">Early adopter perks</span>
              </div>
            </motion.div>
          </motion.div>

          {/* Right Column - Product Mockup */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4, duration: 1, ease: 'easeOut' }}
            className="relative"
          >
            {/* Glow effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-emerald-500/20 dark:from-blue-500/30 dark:to-emerald-500/30 rounded-3xl blur-3xl" />

            {/* Dashboard mockup */}
            <div className="relative rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700/50 bg-white dark:bg-gray-900/80 backdrop-blur-xl shadow-2xl dark:shadow-none">
              {/* Browser chrome */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-800/50 bg-gray-50 dark:bg-black/30">
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500/80" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                  <div className="w-3 h-3 rounded-full bg-green-500/80" />
                </div>
                <div className="flex-1 mx-4">
                  <div className="h-6 bg-gray-200/50 dark:bg-gray-800/50 rounded-md flex items-center px-3">
                    <span className="text-xs text-gray-500 dark:text-gray-500">app.sixtyseconds.ai</span>
                  </div>
                </div>
              </div>

              {/* Dashboard content */}
              <div className="p-6 space-y-4 bg-gradient-to-br from-gray-50 to-white dark:from-gray-900/50 dark:to-gray-950/50">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-heading text-lg font-bold text-gray-900 dark:text-white">Meeting Intelligence</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">AI-powered insights from your calls</p>
                  </div>
                  <div className="px-3 py-1 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-sm font-medium">
                    Live
                  </div>
                </div>

                {/* Metrics cards */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Deals Closed', value: '12', change: '+40%' },
                    { label: 'Time Saved', value: '8h', change: '+60%' },
                    { label: 'Proposals', value: '24', change: '+2x' },
                  ].map((metric, idx) => (
                    <motion.div
                      key={metric.label}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.6 + idx * 0.1 }}
                      className="p-3 rounded-lg bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/50"
                    >
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">{metric.value}</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">{metric.label}</div>
                      <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-1">{metric.change}</div>
                    </motion.div>
                  ))}
                </div>

                {/* Activity list */}
                <div className="space-y-2">
                  {[
                    { icon: '📝', text: 'Proposal generated for Acme Corp', time: '2m ago' },
                    { icon: '✅', text: '3 action items created', time: '5m ago' },
                    { icon: '🎯', text: 'Deal moved to Verbal stage', time: '12m ago' },
                  ].map((activity, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.8 + idx * 0.1 }}
                      className="flex items-center gap-3 p-3 rounded-lg bg-white dark:bg-gray-800/30 border border-gray-200 dark:border-gray-700/30"
                    >
                      <span className="text-xl">{activity.icon}</span>
                      <div className="flex-1">
                        <p className="text-sm text-gray-900 dark:text-white">{activity.text}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-500">{activity.time}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
