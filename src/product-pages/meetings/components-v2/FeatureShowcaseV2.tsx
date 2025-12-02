import { motion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';

// Enhanced feature showcase following design system v5.0
// Uses proper glassmorphism, improved skeleton loaders, and shimmer animations

interface FeatureProps {
  badge: string;
  title: string;
  description: string;
  features: string[];
  mockup: React.ReactNode;
  reversed?: boolean;
  gradient: string;
  badgeColor: string;
}

function Feature({ badge, title, description, features, mockup, reversed, gradient, badgeColor }: FeatureProps) {
  return (
    <div className={`grid lg:grid-cols-2 gap-12 lg:gap-16 items-center ${reversed ? 'lg:flex-row-reverse' : ''}`}>
      <motion.div
        initial={{ opacity: 0, x: reversed ? 30 : -30 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className={reversed ? 'lg:order-2' : ''}
      >
        <span className={`inline-block px-4 py-1.5 rounded-full ${badgeColor} text-sm font-medium mb-4`}>
          {badge}
        </span>
        <h3 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-4">
          {title}
        </h3>
        <p className="text-lg text-gray-700 dark:text-gray-300 mb-8 leading-relaxed">
          {description}
        </p>
        <ul className="space-y-4">
          {features.map((feature, idx) => (
            <motion.li
              key={idx}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1, duration: 0.5 }}
              className="flex items-start gap-3"
            >
              <CheckCircle2 className={`w-5 h-5 mt-0.5 flex-shrink-0 ${gradient.includes('blue') ? 'text-blue-600 dark:text-blue-400' : gradient.includes('emerald') ? 'text-emerald-600 dark:text-emerald-400' : 'text-purple-600 dark:text-purple-400'}`} />
              <span className="text-gray-700 dark:text-gray-300">{feature}</span>
            </motion.li>
          ))}
        </ul>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: reversed ? -30 : 30 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className={reversed ? 'lg:order-1' : ''}
      >
        {mockup}
      </motion.div>
    </div>
  );
}

export function FeatureShowcaseV2() {
  // Simplified feature showcase - expand with more features as needed
  const features: FeatureProps[] = [
    {
      badge: 'Meeting Intelligence',
      title: 'Your Meetings, Centralized & Searchable',
      description: 'Semantic search across all your meetings. Ask natural questions and get instant answers with video clips.',
      features: [
        'Embedded video playback with timestamped transcripts',
        'Semantic search across thousands of meetings',
        'AI-powered sentiment tracking',
        'Automatic speaker identification',
      ],
      mockup: <div className="rounded-2xl bg-white dark:bg-gray-900/80 backdrop-blur-sm border border-gray-200 dark:border-gray-700/50 p-8 shadow-sm dark:shadow-none h-96 flex items-center justify-center text-gray-500 dark:text-gray-400">Feature Mockup</div>,
      gradient: 'from-blue-400 to-cyan-400',
      badgeColor: 'bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-blue-700 dark:text-blue-400',
    },
  ];

  return (
    <section id="features" className="relative py-24 lg:py-32 bg-[#FAFAFA] dark:bg-[#0a0d14] overflow-hidden">
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto mb-20"
        >
          <span className="inline-block px-4 py-1.5 rounded-full bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-blue-700 dark:text-blue-300 text-sm font-medium mb-4">
            Features
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-6">
            Everything You Need to{' '}
            <span className="bg-gradient-to-r from-blue-600 via-purple-500 to-cyan-500 bg-clip-text text-transparent">
              Close More Deals
            </span>
          </h2>
          <p className="text-lg text-gray-700 dark:text-gray-300">
            AI-powered meeting intelligence that transforms every conversation into actionable insights.
          </p>
        </motion.div>

        <div className="space-y-32">
          {features.map((feature, idx) => (
            <Feature key={idx} {...feature} />
          ))}
        </div>
      </div>
    </section>
  );
}
