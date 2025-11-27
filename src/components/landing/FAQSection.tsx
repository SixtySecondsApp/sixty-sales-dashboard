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
        <span className="text-lg font-medium text-white group-hover:text-blue-400 transition-colors pr-4">
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
      question: 'Does this work with my existing Fathom account?',
      answer: 'Yes! One-click integration syncs all past and future recordings. Your existing Fathom workflow stays exactly the same—we just make it 10x more powerful with AI analysis, semantic search, and automated action items.',
    },
    {
      question: 'How accurate is the AI sentiment analysis?',
      answer: 'Our AI analyzes tone, keywords, and context to score sentiment from -1 (negative) to 1 (positive). You get a score plus reasoning like "Customer expressed urgency about Q1 launch"—so you always understand the why behind the number. Accuracy improves with each conversation.',
    },
    {
      question: 'Can I turn meeting insights into tasks automatically?',
      answer: 'Absolutely. AI extracts action items with priority, category, and video timestamps. Click once to convert any item into a task that links back to the exact moment in the recording. Tasks sync to your existing workflow tools.',
    },
    {
      question: 'What if I need to search old meetings for deal context?',
      answer: 'Use semantic search to ask natural questions like "What technical objections came up with enterprise customers?" or "Show me pricing discussions from Q4." You\'ll get video clips and transcripts instantly—no digging through notes.',
    },
    {
      question: 'How does proposal generation work?',
      answer: 'AI analyzes meeting transcripts, pulls customer requirements, pricing discussions, and next steps—then generates a structured proposal draft. Add your branding, tweak as needed, and send. What used to take 30+ minutes now takes 5.',
    },
    {
      question: 'What about data security and compliance?',
      answer: 'We\'re SOC 2 compliant and GDPR ready. All data is encrypted at rest and in transit. Your recordings never leave our secure infrastructure, and you maintain full control over your data with easy export and deletion options.',
    },
  ];

  return (
    <section className="relative py-24 lg:py-32 bg-gradient-to-b from-[#0d1117] to-[#0a0d14] overflow-hidden">
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
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6">
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

