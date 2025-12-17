import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

const faqs = [
  {
    question: 'How is this different from Gong or Chorus?',
    answer: 'Tools like Gong have unclear pricing structures and focus on simple analysis only. 60 is built for action—generating proposals, creating tasks, and updating your CRM automatically. Think of it this way: Gong shows you what happened. 60 does that and the hard work that comes next.',
  },
  {
    question: 'What if I\'m not a \'tech person\'? Is this complicated?',
    answer: 'If you can use Zoom, you can use 60. One-click Fathom sync means nearly zero setup. No training required. Your first meeting is automatically analysed and proposals, action items and insights appear instantly. Most users are up and running in under 60 seconds.',
  },
  {
    question: 'Why should I trust a new product without testimonials?',
    answer: 'Fair question. 60 offers early access to a product that solves a real problem experienced by sales leaders. As an early user, you get: 1: Direct input on features built, 2: Priority support from the team, 3: Early adopter pricing locked in for life, and 4: No risk. Cancel anytime, no questions asked. Plus, being first means you shape the product to fit YOUR workflow.',
  },
  {
    question: 'My team already uses a complex CRM tool, will this mess up our workflows?',
    answer: 'Nope. 60 enhances your existing tools without replacing them. It syncs with the sales tools you already use. Think of it as the AI layer that makes everything else work better. Your team keeps using the tools they love with automated superpowers.',
  },
  {
    question: 'What makes 60 different from just using ChatGPT?',
    answer: 'ChatGPT is amazing for one-off tasks, but it doesn\'t integrate with your workflow. 60 automatically syncs with your tech-stack, understands your entire meeting history, knows your CRM context and prepares powerful action without you needing to prompt it. Plus, the AI is trained specifically for sales workflows so it knows what a good proposal looks like, how to prioritise follow-ups and how to extract deal-critical information.',
  },
  {
    question: 'Do you integrate with Fathom?',
    answer: 'Yes! Fathom is one of the top data source integrations. One-click sync means your meeting transcripts, summaries and recordings flow directly into 60. If you use Fathom, setup takes literally 60 seconds.',
  },
  {
    question: 'What if I don\'t use Fathom?',
    answer: 'No problem! You can sync meeting transcripts from many sources (Fathom, Fireflies, Teams, etc). Manual transcript uploads are also supported if you have meetings recorded elsewhere.',
  },
];

export function FAQSectionV3() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="relative py-24 bg-white dark:bg-gray-950 scroll-mt-24 transition-colors duration-300">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
            <span className="bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
              Questions?
            </span>
            <br />
            <span className="bg-gradient-to-r from-brand-blue to-brand-teal bg-clip-text text-transparent">
              We've Got Answers
            </span>
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-400">
            Everything you need to know about 60 and how it works.
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
              className="border border-gray-200 dark:border-gray-700/50 rounded-xl overflow-hidden bg-white dark:bg-gray-900/80 backdrop-blur-sm shadow-sm dark:shadow-none"
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full px-6 py-5 text-left flex items-center justify-between gap-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors duration-200"
              >
                <span className="text-lg font-heading font-bold text-gray-900 dark:text-white pr-8">
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
            className="inline-flex items-center gap-2 text-brand-blue hover:opacity-80 font-medium transition-colors"
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
