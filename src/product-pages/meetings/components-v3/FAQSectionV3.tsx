import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

const faqs = [
  {
    question: 'How is this different from Gong or Chorus?',
    answer: 'Great question! Traditional conversation intelligence tools like Gong focus on ANALYSIS—showing you data, coaching insights, and call analytics. Sixty is built for ACTION—we generate proposals, create tasks, and update your CRM automatically. Think of it this way: Gong shows you what happened. Sixty does the work that comes next.',
    note: 'Note: We focus on post-meeting automation, not conversation analytics.',
  },
  {
    question: 'What if I\'m not a "tech person"—is this complicated?',
    answer: 'If you can use Zoom, you can use Sixty. One-click Fathom sync means zero setup. No training required. Your first meeting is automatically analyzed—proposals, action items, and insights appear instantly. Most users are up and running in under 60 seconds.',
  },
  {
    question: 'Why should I trust a new product without testimonials?',
    answer: 'Fair question. We\'re offering early access to a product that solves a real problem we experienced ourselves as sales leaders. As a founding user, you get: (1) Direct input on features we build, (2) Priority support from our founders, (3) Special early adopter pricing locked in for life, and (4) Zero risk—cancel anytime, no questions asked. Plus, being first means you shape the product to fit YOUR workflow.',
  },
  {
    question: 'My team already uses [CRM/tool]—will this mess up our workflow?',
    answer: 'Nope. Sixty enhances your existing tools, we don\'t replace them. We sync with your CRM, task manager, and calendar. Think of us as the AI layer that makes everything else work better. Your team keeps using the tools they love—they just get automated superpowers.',
  },
  {
    question: 'What makes Sixty different from just using ChatGPT?',
    answer: 'ChatGPT is amazing for one-off tasks, but it doesn\'t integrate with your workflow. Sixty automatically syncs with Fathom, understands your entire meeting history, knows your CRM context, and takes action without you prompting it. Plus, our AI is trained specifically for sales workflows—it knows what a good proposal looks like, how to prioritize follow-ups, and how to extract deal-critical information.',
  },
  {
    question: 'How much does it cost?',
    answer: 'We have three plans: Solo ($29/mo) for individual reps, Team ($79/mo per user) for small teams, and Enterprise (custom pricing) for larger organizations. All plans include a 14-day free trial with no credit card required. Early adopters get lifetime discounts.',
  },
  {
    question: 'Do you integrate with Fathom?',
    answer: 'Yes! Fathom integration is our primary data source. One-click sync means your meeting transcripts, summaries, and recordings flow directly into Sixty. If you use Fathom, setup takes literally 60 seconds.',
  },
  {
    question: 'What if I don\'t use Fathom?',
    answer: 'No problem! You can upload meeting transcripts from any source (Zoom, Teams, Google Meet, Gong, etc.). We also support manual transcript uploads if you have meetings recorded elsewhere.',
  },
];

export function FAQSectionV3() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="relative py-24 bg-white dark:bg-gray-950">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
            <span className="bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
              Questions?
            </span>
            <br />
            <span className="bg-gradient-to-r from-blue-600 to-emerald-600 dark:from-blue-400 dark:to-emerald-400 bg-clip-text text-transparent">
              We've Got Answers
            </span>
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-400">
            Everything you need to know about Sixty and how it works.
          </p>
        </motion.div>

        {/* FAQ Items */}
        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.05 }}
              className="border border-gray-200 dark:border-gray-700/50 rounded-xl overflow-hidden bg-white dark:bg-gray-800/30 backdrop-blur-sm"
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full px-6 py-5 text-left flex items-center justify-between gap-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                <span className="text-lg font-semibold text-gray-900 dark:text-white pr-8">
                  {faq.question}
                </span>
                <ChevronDown
                  className={`w-5 h-5 text-gray-500 dark:text-gray-400 flex-shrink-0 transition-transform duration-300 ${
                    openIndex === index ? 'rotate-180' : ''
                  }`}
                />
              </button>

              <motion.div
                initial={false}
                animate={{
                  height: openIndex === index ? 'auto' : 0,
                  opacity: openIndex === index ? 1 : 0,
                }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <div className="px-6 pb-5 pt-2">
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                    {faq.answer}
                  </p>
                  {faq.note && (
                    <p className="mt-3 text-sm text-emerald-600 dark:text-emerald-400 italic">
                      {faq.note}
                    </p>
                  )}
                </div>
              </motion.div>
            </motion.div>
          ))}
        </div>

        {/* Still have questions CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-16 text-center"
        >
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-4">
            Still have questions?
          </p>
          <a
            href="mailto:support@sixtyseconds.ai"
            className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors"
          >
            Email us directly →
          </a>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
            We typically respond within 24 hours (usually much faster)
          </p>
        </motion.div>
      </div>
    </section>
  );
}
