import { motion } from 'framer-motion';
import { Search, CheckCircle2, FileText, ArrowRight } from 'lucide-react';

const features = [
  {
    icon: Search,
    title: 'Step 1: Connect your Call Recorder',
    description: 'Our AI analyses each call and gives your team feedback. You can even ask questions about your entire call history to gain deeper insights.',
    benefits: [
      '• Fathom',
      '• Fireflies',
      '• Teams',
    ],
    gradient: 'from-blue-500 to-cyan-500',
    bgGradient: 'from-blue-500/10 to-cyan-500/10',
  },
  {
    icon: CheckCircle2,
    title: 'Step 2: Connect your existing CRM',
    description: "Don't waste time manually updating your CRM when our AI does this for you. Lead stages, deal stages and notes always up to date.",
    benefits: [
      '• Hubspot',
      '• Pipedrive',
      '• Zoho',
    ],
    gradient: 'from-emerald-500 to-green-500',
    bgGradient: 'from-emerald-500/10 to-green-500/10',
  },
  {
    icon: FileText,
    title: 'Step 3: Connect your Task Manager',
    description: "Automate more of the admin. Tasks and objectives are auto-generated from each call and sync'd directly into your task manager for action.",
    benefits: [
      '• Monday',
      '• Jira',
      '• Trello',
    ],
    gradient: 'from-purple-500 to-pink-500',
    bgGradient: 'from-purple-500/10 to-pink-500/10',
  },
];

export function FeatureShowcaseV3() {
  return (
    <section id="features" className="relative pt-32 lg:pt-40 pb-24 bg-gray-50 dark:bg-gray-900/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
            <span className="text-gray-900 dark:text-white">
              Connect Existing Tools
            </span>
            <br />
            <span className="text-gray-900 dark:text-white">
              to
            </span>{' '}
            <span className="bg-gradient-to-r from-blue-600 to-emerald-600 dark:from-blue-400 dark:to-emerald-400 bg-clip-text text-transparent">
              Turbocharge your Sales
            </span>
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
            Our platform brings together tools you're already using and wraps them in market-leading AI for analysis and automation.
          </p>
        </motion.div>

        {/* Feature Cards */}
        <div className="grid lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className="group relative"
            >
              {/* Hover glow effect */}
              <div className={`absolute inset-0 bg-gradient-to-r ${feature.bgGradient} rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />

              {/* Card */}
              <div className="relative h-full p-8 rounded-2xl bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700/50 shadow-sm dark:shadow-none hover:shadow-xl dark:hover:shadow-none hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-300">
                {/* Icon */}
                <div className={`inline-flex items-center justify-center w-12 h-12 rounded-none bg-gradient-to-r ${feature.bgGradient} mb-6`}>
                  {index === 0 ? (
                    <span className={`text-2xl font-bold bg-gradient-to-r ${feature.gradient} bg-clip-text text-transparent`}>1</span>
                  ) : index === 1 ? (
                    <span className={`text-2xl font-bold bg-gradient-to-r ${feature.gradient} bg-clip-text text-transparent`}>2</span>
                  ) : (
                    <span className={`text-2xl font-bold bg-gradient-to-r ${feature.gradient} bg-clip-text text-transparent`}>3</span>
                  )}
                </div>

                {/* Title */}
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 leading-tight">
                  {feature.title}
                </h3>

                {/* Description */}
                <p className="text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
                  {feature.description}
                </p>

                {/* Benefits */}
                <ul className="space-y-3 mb-6">
                  {feature.benefits.map((benefit, idx) => (
                    <li key={idx} className="flex items-start gap-3 text-sm text-gray-700 dark:text-gray-300">
                      <CheckCircle2 className={`w-5 h-5 flex-shrink-0 mt-0.5 bg-gradient-to-r ${feature.gradient} bg-clip-text text-transparent`} />
                      <span>{benefit}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA Link */}
                <button className={`group/btn flex items-center gap-2 text-sm font-medium bg-gradient-to-r ${feature.gradient} bg-clip-text text-transparent hover:opacity-80 transition-opacity`}>
                  See it in action
                  <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="text-center mt-16"
        >
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-6">
            Combining and automating these tools saves sales teams <span className="font-bold text-emerald-600 dark:text-emerald-400">15+ hours every week</span>.
          </p>
          <motion.a
            href="/waitlist"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-semibold shadow-xl shadow-blue-500/25 transition-all hover:shadow-2xl hover:shadow-blue-500/40"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Use For Free
            <ArrowRight className="w-5 h-5" />
          </motion.a>
        </motion.div>
      </div>
    </section>
  );
}
