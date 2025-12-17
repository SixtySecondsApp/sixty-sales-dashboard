import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

const faqs = [
  {
    question: 'What makes 60 different from just using ChatGPT?',
    answer: 'ChatGPT is a great tool, but it requires a lot of effort. You have to upload transcripts, write prompts and then copy outputs manually back into your systems.\n\n60 works automatically in the background. It reads your sales call transcripts, understands the full context and turns each conversation into real outcomes. Proposal preparation, CRM updates, task creation and useful insights are all automatically delivered without prompting or copy-pasting.',
  },
  {
    question: 'My team already uses a complex CRM tool. Will this mess up our workflows?',
    answer: 'Not at all. 60 is designed to fit into your existing setup, not replace it.\n\nIt connects directly to your CRM and keeps everything updated automatically using the same fields, stages and processes your team already relies on. There is no need to retrain your team or redesign workflows.\n\n60 quietly removes the admin burden while everything else continues exactly as before.',
  },
  {
    question: 'Will this replace my CRM or sales process?',
    answer: 'No. Your CRM remains the source of truth and your sales process stays firmly in your control.\n\n60 acts as the connective layer between your calls, CRM and task tools. It ensures nothing gets missed, nothing goes stale and follow-ups happen on time.\n\n60 is the system that makes your existing process actually work the way it was always supposed to.',
  },
  {
    question: 'Who is 60 best suited for?',
    answer: '60 is built for people who sell on calls and want to spend more time selling.\n\nIt\'s ideal for founders, sales reps and sales teams who juggle multiple deals and lose momentum due to admin, slow follow-ups, or scattered tools. If post-call work is costing you time, energy, or revenue, 60 will feel like a natural extension of how you already work.',
  },
  {
    question: 'Is my call data secure?',
    answer: 'Yes. Security and data privacy are fundamental to how 60 is built.\n\nAll data is encrypted and handled securely. Your call recordings and transcripts are never shared, sold, or used to train public models. They are only used to deliver insights and outputs for you and your team.\n\nIf you delete your call or account, the encrypted data is also deleted.',
  },
  {
    question: 'How is this different from similar tools?',
    answer: 'Most sales tools focus on insights and analysis. They tell you what happened on a call, but stop there.\n\n60 goes further. It turns conversations into action. Proposals are drafted, tasks are created and CRMs are updated automatically.\n\nInstead of adding another dashboard to check, 60 removes work from your plate and helps deals move forward faster.',
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
                <div className="px-6 pb-5 pt-2 space-y-3">
                  {faq.answer.split('\n\n').map((paragraph, pIndex) => (
                    <p key={pIndex} className="text-gray-600 dark:text-gray-400 leading-relaxed">
                      {paragraph}
                    </p>
                  ))}
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
            href="mailto:app@sixtyseconds.video"
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
