import { motion } from 'framer-motion';
import { Mic, Brain, Zap, TrendingUp } from 'lucide-react';
import { useTheme } from '../../lib/hooks/useTheme';

export function HowItWorks() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  // Ensure Tailwind generates these classes: bg-cyan-100 dark:bg-cyan-500/10 border-cyan-200 dark:border-cyan-500/20 text-cyan-600 dark:text-cyan-400
  const steps = [
    {
      number: '01',
      icon: Mic,
      title: 'Call Recordings',
      description: 'Connect your Fathom account with one click. All your recordings sync to Sixty automatically and securely.',
      color: 'blue',
      gradient: 'from-blue-600 to-blue-400',
    },
    {
      number: '02',
      icon: Brain,
      title: 'AI Analysis',
      description: 'Our AI carefully analyses each call to calculate sentiment scores, coaching insights, next steps and action items in seconds.',
      color: 'purple',
      gradient: 'from-purple-600 to-purple-400',
    },
    {
      number: '03',
      icon: Zap,
      title: 'Propose',
      description: 'Proposals are auto-generated using meeting context, sentiment analysis and deal frameworks. Ready to send.',
      color: 'emerald',
      gradient: 'from-emerald-600 to-emerald-400',
    },
    {
      number: '04',
      icon: TrendingUp,
      title: 'Action',
      description: 'Sixty extracts tasks and to-do items from every call, prioritises them, writes them and syncs them directly into your task manager.',
      color: 'cyan',
      gradient: 'from-cyan-600 to-cyan-400',
      iconBg: 'bg-cyan-100 dark:bg-cyan-500/10',
      iconBorder: 'border-cyan-200 dark:border-cyan-500/20',
      iconText: 'text-cyan-600 dark:text-cyan-400',
    },
  ];

  return (
    <section id="how-it-works" className="relative py-24 lg:py-32 bg-gradient-to-b from-gray-50 to-white dark:from-[#0a0d14] dark:to-[#0d1117] overflow-hidden transition-colors duration-300">
      {/* Tailwind safelist - ensure cyan classes are generated */}
      <div className="hidden bg-cyan-100 dark:bg-cyan-500/10 border-cyan-200 dark:border-cyan-500/20 text-cyan-600 dark:text-cyan-400" aria-hidden="true" />
      {/* Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] rounded-full opacity-10 dark:opacity-30"
          style={{
            background: 'radial-gradient(circle, rgba(59, 130, 246, 0.1) 0%, transparent 60%)',
          }}
        />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto mb-20"
        >
          <motion.span
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="inline-block px-4 py-1.5 rounded-full bg-blue-100 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-blue-700 dark:text-blue-400 text-sm font-medium mb-4"
          >
            How It Works
          </motion.span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-6">
            <span className="text-gray-900 dark:text-white">Post Meeting Admin</span>
            <br />
            <span className="bg-gradient-to-r from-blue-600 to-emerald-600 dark:from-blue-400 dark:to-emerald-400 bg-clip-text text-transparent">
              Handled For You
            </span>
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Four simple steps to automate admin and ensure simple sales meetings get the intelligent aftercare they need.
          </p>
        </motion.div>

        {/* Timeline */}
        <div className="relative">
          {/* Connection Line */}
          <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-0.5 -translate-y-1/2">
            <motion.div
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.5, ease: 'easeOut' }}
              className="h-full bg-gradient-to-r from-blue-500/50 via-purple-500/50 to-emerald-500/50 origin-left"
            />
          </div>

          {/* Steps */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6">
            {steps.map((step, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.15, duration: 0.6 }}
                className="relative group"
              >
                {/* Card */}
                <div className="relative p-6 lg:p-8 rounded-2xl bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20 transition-all duration-300 backdrop-blur-sm">
                  {/* Step Number */}
                  <div className={`absolute -top-4 left-6 px-3 py-1 rounded-full bg-gradient-to-r ${step.gradient} text-white text-sm font-bold`}>
                    {step.number}
                  </div>

                  {/* Icon */}
                  {step.color === 'cyan' ? (
                    <div
                      className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-6 mt-4 group-hover:scale-110 transition-all duration-300 border border-cyan-200"
                      style={{
                        backgroundColor: isDark ? 'rgba(6, 182, 212, 0.1)' : '#cffafe', // cyan-500/10 in dark, cyan-100 in light
                        borderColor: isDark ? 'rgba(6, 182, 212, 0.2)' : '#a5f3fc', // cyan-500/20 in dark, cyan-200 in light
                      }}
                    >
                      <step.icon
                        className="w-8 h-8 transition-colors duration-300"
                        style={{
                          color: isDark ? '#22d3ee' : '#0891b2', // cyan-400 in dark, cyan-600 in light
                        }}
                      />
                    </div>
                  ) : (
                    <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-6 mt-4 group-hover:scale-110 transition-transform duration-300 border ${
                      step.color === 'blue' ? 'bg-blue-100 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20' :
                      step.color === 'purple' ? 'bg-purple-100 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/20' :
                      'bg-emerald-100 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20'
                    }`}>
                      <step.icon className={`w-8 h-8 ${
                        step.color === 'blue' ? 'text-blue-600 dark:text-blue-400' :
                        step.color === 'purple' ? 'text-purple-600 dark:text-purple-400' :
                        'text-emerald-600 dark:text-emerald-400'
                      }`} />
                    </div>
                  )}

                  {/* Title */}
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                    {step.title}
                  </h3>

                  {/* Description */}
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                    {step.description}
                  </p>

                  {/* Hover Glow */}
                  <div className={`absolute inset-0 rounded-2xl bg-${step.color}-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                </div>

              </motion.div>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.8, duration: 0.6 }}
          className="text-center mt-16"
        >
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Ready to see it in action?
          </p>
          <div className="flex justify-center">
            <button className="px-8 py-4 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 text-white font-semibold hover:from-blue-500 hover:to-blue-400 transition-all duration-300 shadow-lg shadow-blue-500/25">
              Create Account
            </button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
