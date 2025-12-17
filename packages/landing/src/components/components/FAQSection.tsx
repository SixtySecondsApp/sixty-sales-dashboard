import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

interface FAQItemProps {
  question: string;
  answer: string;
  isOpen: boolean;
  onClick: () => void;
  index: number;
}

function FAQItem({ question, answer, isOpen, onClick, index }: FAQItemProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.1, duration: 0.5 }}
      className="border-b border-white/10 last:border-b-0"
    >
      <button
        onClick={onClick}
        className="w-full py-6 flex items-center justify-between text-left group"
      >
        <span className="font-heading text-lg font-bold text-white group-hover:text-blue-400 transition-colors pr-4">
          {question}
        </span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.3 }}
          className="flex-shrink-0"
        >
          <ChevronDown className={`w-5 h-5 ${isOpen ? 'text-blue-400' : 'text-gray-500'}`} />
        </motion.div>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <p className="pb-6 text-gray-400 leading-relaxed">
              {answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      question: 'How does the waitlist work?',
      answer: 'Sign up with your email, company, and the tools you use (dialer, meeting recorder, CRM). You\'ll get a unique referral link to share. For every person who joins using your link, you move up 5 spots in line. The higher your position, the sooner you get early access.',
    },
    {
      question: 'What do I get as an early access member?',
      answer: 'Priority onboarding with a dedicated success manager, exclusive product updates before public release, direct input on features and integrations we build, and a permanent 50% lifetime discount locked in as our thank you for being an early supporter.',
    },
    {
      question: 'Do you really integrate with all those tools?',
      answer: 'Yes! We already integrate with 100+ dialers (JustCall, CloudTalk, Aircall, etc.), meeting recorders (Fathom, Fireflies, Otter.ai, etc.), and CRMs (Salesforce, HubSpot, Pipedrive, etc.). If you use something else, just select "Other" and let us know—we\'ll prioritize it based on demand.',
    },
    {
      question: 'How long will I be on the waitlist?',
      answer: 'Your position determines when you get access. We\'re releasing in batches to ensure quality onboarding for every team. The more you refer, the faster you move up. Most waitlist members with 3+ referrals get access within 2-4 weeks.',
    },
    {
      question: 'Will this actually save me 10+ hours per week?',
      answer: 'Yes. Our beta users report spending 90+ minutes per day on manual CRM updates, meeting notes, and follow-up tasks. With Meeting Intelligence, that drops to under 10 minutes. The AI handles summaries, CRM syncing, action items, and follow-up reminders automatically.',
    },
    {
      question: 'What happens to my data and privacy?',
      answer: 'Your data is encrypted at rest and in transit, stored securely and never shared with third parties. You maintain full control with easy export and deletion options. We take security seriously.',
    },
  ];

  return (
    <section id="faq" className="relative py-24 lg:py-32 bg-gradient-to-b from-[#0d1117] to-[#0a0d14] overflow-hidden">
      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <motion.span
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="inline-block px-4 py-1.5 rounded-full bg-gray-500/10 border border-gray-500/20 text-gray-400 text-sm font-medium mb-4"
          >
            FAQ
          </motion.span>
          <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6">
            Frequently Asked{' '}
            <span className="bg-gradient-to-r from-gray-200 to-gray-500 bg-clip-text text-transparent">
              Questions
            </span>
          </h2>
        </motion.div>

        {/* FAQ Items */}
        <div className="rounded-2xl bg-gray-900/30 border border-white/10 px-6 lg:px-8">
          {faqs.map((faq, idx) => (
            <FAQItem
              key={idx}
              question={faq.question}
              answer={faq.answer}
              isOpen={openIndex === idx}
              onClick={() => setOpenIndex(openIndex === idx ? null : idx)}
              index={idx}
            />
          ))}
        </div>

        {/* Still have questions? */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.6, duration: 0.6 }}
          className="mt-12 text-center"
        >
          <p className="text-gray-400 mb-4">Still have questions?</p>
          <a
            href="mailto:support@sixty.ai"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all duration-300"
          >
            Contact Support
          </a>
        </motion.div>
      </div>
    </section>
  );
}

