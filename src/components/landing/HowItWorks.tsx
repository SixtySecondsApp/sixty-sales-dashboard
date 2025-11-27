import { motion } from 'framer-motion';
import { Mic, Brain, Zap, TrendingUp } from 'lucide-react';

export function HowItWorks() {
  const steps = [
    {
      number: '01',
      icon: Mic,
      title: 'Record',
      description: 'Connect your Fathom account with one click. All your recordings sync automatically.',
      color: 'blue',
      gradient: 'from-blue-600 to-blue-400',
    },
    {
      number: '02',
      icon: Brain,
      title: 'Analyze',
      description: 'AI extracts sentiment scores, action items, and coaching insights in seconds.',
      color: 'purple',
      gradient: 'from-purple-600 to-purple-400',
    },
    {
      number: '03',
      icon: Zap,
      title: 'Act',
      description: 'Auto-sync tasks to your workflow. Generate proposals directly from meeting context.',
      color: 'emerald',
      gradient: 'from-emerald-600 to-emerald-400',
    },
    {
      number: '04',
      icon: TrendingUp,
      title: 'Coach',
      description: 'Get talk-time analytics and personalized coaching recommendations.',
      color: 'cyan',
      gradient: 'from-cyan-600 to-cyan-400',
    },
  ];

  return (
    <section className="relative py-24 lg:py-32 bg-gradient-to-b from-[#0a0d14] to-[#0d1117] overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] rounded-full opacity-30"
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
            className="inline-block px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium mb-4"
          >
            How It Works
          </motion.span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6">
            From Meeting to Closed Deal—
            <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              Automatically
            </span>
          </h2>
          <p className="text-lg text-gray-400">
            Four simple steps to transform your sales meetings into actionable intelligence.
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
                <div className="relative p-6 lg:p-8 rounded-2xl bg-gray-900/50 border border-white/10 hover:border-white/20 transition-all duration-300 backdrop-blur-sm">
                  {/* Step Number */}
                  <div className={`absolute -top-4 left-6 px-3 py-1 rounded-full bg-gradient-to-r ${step.gradient} text-white text-sm font-bold`}>
                    {step.number}
                  </div>

                  {/* Icon */}
                  <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-${step.color}-500/10 border border-${step.color}-500/20 mb-6 mt-4 group-hover:scale-110 transition-transform duration-300`}>
                    <step.icon className={`w-8 h-8 text-${step.color}-400`} />
                  </div>

                  {/* Title */}
                  <h3 className="text-xl font-semibold text-white mb-3">
                    {step.title}
                  </h3>

                  {/* Description */}
                  <p className="text-gray-400 leading-relaxed">
                    {step.description}
                  </p>

                  {/* Hover Glow */}
                  <div className={`absolute inset-0 rounded-2xl bg-${step.color}-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                </div>

                {/* Connector Dot (Desktop) */}
                <div className="hidden lg:block absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-gray-900 border-2 border-white/30" />
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
          <p className="text-gray-400 mb-6">
            Ready to see it in action?
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="px-8 py-4 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 text-white font-semibold hover:from-blue-500 hover:to-blue-400 transition-all duration-300 shadow-lg shadow-blue-500/25">
              Start Free Trial
            </button>
            <button className="px-8 py-4 rounded-xl bg-white/5 border border-white/20 text-white font-semibold hover:bg-white/10 transition-all duration-300">
              Schedule Demo
            </button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

