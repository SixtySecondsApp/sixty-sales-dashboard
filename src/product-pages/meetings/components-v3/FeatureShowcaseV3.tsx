import { motion } from 'framer-motion';
import { Search, CheckCircle2, FileText, ArrowRight } from 'lucide-react';

const features = [
  {
    icon: Search,
    title: 'Find Any Deal Detail in 3 Seconds—Not 30 Minutes',
    description: 'Stop scrolling through endless meeting notes. Our AI semantic search finds exactly what you need instantly—pricing discussions, objections, next steps, anything.',
    benefits: [
      'Search across all meetings in natural language',
      'Find specific quotes, commitments, or concerns',
      'No manual tagging or organization required',
    ],
    gradient: 'from-blue-500 to-cyan-500',
    bgGradient: 'from-blue-500/10 to-cyan-500/10',
  },
  {
    icon: CheckCircle2,
    title: 'Never Miss a Follow-Up—AI Handles Everything',
    description: 'AI automatically extracts action items, assigns priorities, and creates tasks. No more "I forgot to send that proposal" moments. Ever.',
    benefits: [
      'Auto-create tasks with due dates and priorities',
      'Smart reminders based on deal urgency',
      'Sync to your CRM and task manager automatically',
    ],
    gradient: 'from-emerald-500 to-green-500',
    bgGradient: 'from-emerald-500/10 to-green-500/10',
  },
  {
    icon: FileText,
    title: 'Generate Proposals in 5 Minutes, Not 30',
    description: 'AI writes customized proposals based on your meeting discussions. Just review, tweak if needed, and send. Close deals faster.',
    benefits: [
      'Pull context directly from meeting transcripts',
      'Customize tone and structure to your style',
      'Include pricing, timelines, and next steps',
    ],
    gradient: 'from-purple-500 to-pink-500',
    bgGradient: 'from-purple-500/10 to-pink-500/10',
  },
];

export function FeatureShowcaseV3() {
  return (
    <section id="features" className="relative pt-6 pb-9 lg:pt-9 lg:pb-12 bg-[#0a0d14]">
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
            <span className="bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
              Three Features That
            </span>
            <br />
            <span className="bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
              Actually Close Deals
            </span>
          </h2>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto">
            Forget feature lists with 20+ bullet points. These three capabilities do the heavy lifting—everything else is just noise.
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
              <div className="relative h-full p-8 rounded-2xl bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 hover:border-gray-600 transition-all duration-300">
                {/* Icon */}
                <div className={`inline-flex p-3 rounded-xl bg-gradient-to-r ${feature.bgGradient} mb-6`}>
                  <feature.icon className={`w-6 h-6 bg-gradient-to-r ${feature.gradient} bg-clip-text text-transparent`} strokeWidth={2} />
                </div>

                {/* Title */}
                <h3 className="text-xl font-bold text-white mb-4 leading-tight">
                  {feature.title}
                </h3>

                {/* Description */}
                <p className="text-gray-400 mb-6 leading-relaxed">
                  {feature.description}
                </p>

                {/* Benefits */}
                <ul className="space-y-3 mb-6">
                  {feature.benefits.map((benefit, idx) => (
                    <li key={idx} className="flex items-start gap-3 text-sm text-gray-300">
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
          <p className="text-lg text-gray-400 mb-6">
            These three features save sales teams <span className="font-bold text-emerald-400">10+ hours every week</span>.
          </p>
          <motion.a
            href="/auth/signup"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-semibold shadow-xl shadow-blue-500/25 transition-all hover:shadow-2xl hover:shadow-blue-500/40"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Start Your Free Trial
            <ArrowRight className="w-5 h-5" />
          </motion.a>
        </motion.div>
      </div>
    </section>
  );
}
