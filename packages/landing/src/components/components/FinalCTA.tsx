import { motion } from 'framer-motion';
import { ArrowRight, Play, Shield, Clock, Zap } from 'lucide-react';

export function FinalCTA() {
  return (
    <section className="relative py-24 lg:py-32 bg-white dark:bg-[#0a0d14] overflow-hidden transition-colors duration-300">
      {/* Background Effects */}
      <div className="absolute inset-0">
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1200px] h-[600px] opacity-30 dark:opacity-100"
          style={{
            background: 'radial-gradient(ellipse, rgba(59, 130, 246, 0.15) 0%, transparent 60%)',
            filter: 'blur(100px)',
          }}
        />
        <motion.div
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.2, 0.3, 0.2],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="absolute top-0 right-1/4 w-[400px] h-[400px] rounded-full opacity-20 dark:opacity-100"
          style={{
            background: 'radial-gradient(circle, rgba(168, 85, 247, 0.1) 0%, transparent 60%)',
          }}
        />
        <motion.div
          animate={{
            scale: [1, 1.15, 1],
            opacity: [0.2, 0.3, 0.2],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="absolute bottom-0 left-1/4 w-[400px] h-[400px] rounded-full opacity-20 dark:opacity-100"
          style={{
            background: 'radial-gradient(circle, rgba(16, 185, 129, 0.1) 0%, transparent 60%)',
          }}
        />
      </div>

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main CTA Card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="relative rounded-3xl overflow-hidden"
        >
          {/* Card Background */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-100/50 via-purple-100/30 to-emerald-100/50 dark:from-blue-600/20 dark:via-purple-600/10 dark:to-emerald-600/20 backdrop-blur-xl" />
          <div className="absolute inset-0 border border-gray-200 dark:border-white/10 rounded-3xl" />
          
          {/* Content */}
          <div className="relative p-8 lg:p-12 text-center">
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-100 dark:bg-blue-500/20 border border-blue-200 dark:border-blue-500/30 mb-8"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-500 dark:bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600 dark:bg-blue-500"></span>
              </span>
              <span className="text-blue-700 dark:text-blue-300 text-sm font-medium">Limited Time: Extended 14-Day Trial</span>
            </motion.div>

            {/* Headline */}
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-6"
            >
              Ready to Close More Deals{' '}
              <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-emerald-600 dark:from-blue-400 dark:via-purple-400 dark:to-emerald-400 bg-clip-text text-transparent">
                with AI?
              </span>
            </motion.h2>

            {/* Subheadline */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4 }}
              className="text-lg sm:text-xl text-gray-700 dark:text-gray-300 mb-8 max-w-2xl mx-auto"
            >
              Join sales teams using Sixty to automate meeting intelligence, 
              coach their reps, and close deals faster.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.5 }}
              className="flex flex-col sm:flex-row gap-4 justify-center mb-10"
            >
              <a href="/product/meetings/waitlist" className="group px-8 py-4 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 text-white font-semibold text-lg hover:from-blue-500 hover:to-blue-400 transition-all duration-300 shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40">
                <span className="flex items-center justify-center gap-2">
                  Start Free 14-Day Trial
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </span>
              </a>
              <a href="/product/meetings/waitlist" className="group px-8 py-4 rounded-xl bg-gray-100 dark:bg-white/10 border border-gray-300 dark:border-white/20 text-gray-900 dark:text-white font-semibold text-lg hover:bg-gray-200 dark:hover:bg-white/15 transition-all duration-300">
                <span className="flex items-center justify-center gap-2">
                  <Play className="w-5 h-5" />
                  Schedule Demo
                </span>
              </a>
            </motion.div>

            {/* Trust Elements */}
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.6 }}
              className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-600 dark:text-gray-400"
            >
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-500" />
                <span>SOC 2 Compliant</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>Setup in 60 seconds</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span>No credit card required</span>
              </div>
            </motion.div>
          </div>
        </motion.div>

        {/* Secondary CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.7 }}
          className="mt-12 grid md:grid-cols-2 gap-6"
        >
          <div className="p-6 rounded-2xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20 transition-all duration-300">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">For Sales Teams</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
              Perfect for teams of 5-50 reps looking to scale coaching and close more deals.
            </p>
            <a href="#" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm font-medium inline-flex items-center gap-1">
              Learn more <ArrowRight className="w-4 h-4" />
            </a>
          </div>
          <div className="p-6 rounded-2xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20 transition-all duration-300">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Enterprise Solutions</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
              Custom integrations, dedicated support, and advanced security for large organizations.
            </p>
            <a href="#" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm font-medium inline-flex items-center gap-1">
              Contact sales <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

