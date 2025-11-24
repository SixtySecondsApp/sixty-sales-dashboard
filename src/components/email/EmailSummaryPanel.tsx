/**
 * Email Summary Panel Component
 * AI-powered summarization for long email threads
 */

import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, FileText, CheckCircle2, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { useEmailAnalysis } from '@/lib/hooks/useEmailAnalysis';
import type { GmailMessage } from '@/lib/types/gmail';

interface EmailSummaryPanelProps {
  email: GmailMessage | GmailMessage[];
  className?: string;
}

export function EmailSummaryPanel({ email, className = '' }: EmailSummaryPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const emails = Array.isArray(email) ? email : [email];
  const isThread = emails.length > 1;

  const { summarize, summary, isSummarizing } = useEmailAnalysis(emails[0]);

  const handleGenerateSummary = () => {
    summarize(emails);
  };

  return (
    <div className={`bg-gray-900/30 border border-gray-800/50 rounded-lg overflow-hidden ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-800/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            <h3 className="text-sm font-medium text-gray-200">
              {isThread ? 'Thread Summary' : 'Email Summary'}
            </h3>
            {isThread && (
              <span className="text-xs text-gray-500">
                {emails.length} messages
              </span>
            )}
          </div>

          {summary && !isSummarizing && (
            <button
              onClick={handleGenerateSummary}
              className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30 transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              Refresh
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {!summary && !isSummarizing ? (
          <div className="text-center py-6">
            <Sparkles className="w-12 h-12 text-purple-400/50 mx-auto mb-4" />
            <p className="text-sm text-gray-400 mb-4">
              {isThread
                ? 'Generate an AI summary of this conversation thread'
                : 'Generate an AI summary of this email'}
            </p>
            <button
              onClick={handleGenerateSummary}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-300 border border-purple-500/30 hover:from-purple-500/30 hover:to-pink-500/30 transition-all"
            >
              Generate Summary
            </button>
          </div>
        ) : isSummarizing ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 text-purple-400 animate-spin" />
            <span className="ml-3 text-sm text-gray-400">Analyzing {isThread ? 'thread' : 'email'}...</span>
          </div>
        ) : summary ? (
          <AnimatePresence mode="wait">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {/* Short Summary */}
              <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
                <div className="flex items-start gap-3">
                  <FileText className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="text-sm font-medium text-gray-200 mb-2">Summary</h4>
                    <p className="text-sm text-gray-300 leading-relaxed">
                      {summary.shortSummary}
                    </p>
                  </div>
                </div>
              </div>

              {/* Key Points */}
              {summary.keyPoints && summary.keyPoints.length > 0 && (
                <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
                  <h4 className="text-sm font-medium text-gray-200 mb-3 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                    Key Points
                  </h4>
                  <ul className="space-y-2">
                    {summary.keyPoints.map((point, index) => (
                      <motion.li
                        key={index}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="flex items-start gap-2 text-sm text-gray-300"
                      >
                        <span className="w-1.5 h-1.5 bg-purple-400 rounded-full mt-2 flex-shrink-0" />
                        <span>{point}</span>
                      </motion.li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Action Items */}
              {summary.actionItems && summary.actionItems.length > 0 && (
                <div className="bg-amber-500/10 rounded-lg p-4 border border-amber-500/30">
                  <h4 className="text-sm font-medium text-amber-300 mb-3 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    Action Items
                  </h4>
                  <ul className="space-y-2">
                    {summary.actionItems.map((action, index) => (
                      <motion.li
                        key={index}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: (summary.keyPoints?.length || 0) * 0.1 + index * 0.1 }}
                        className="flex items-start gap-2 text-sm text-amber-200"
                      >
                        <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span>{action}</span>
                      </motion.li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Long Summary (Expandable) */}
              {summary.longSummary && (
                <div className="bg-gray-800/50 rounded-lg border border-gray-700/50 overflow-hidden">
                  <button
                    onClick={() => setExpanded(!expanded)}
                    className="w-full flex items-center justify-between p-4 text-sm font-medium text-gray-200 hover:bg-gray-800/30 transition-colors"
                  >
                    <span>Detailed Summary</span>
                    {expanded ? (
                      <ChevronUp className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                  <AnimatePresence>
                    {expanded && (
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: 'auto' }}
                        exit={{ height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="p-4 pt-0 text-sm text-gray-300 leading-relaxed">
                          {summary.longSummary}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        ) : null}
      </div>
    </div>
  );
}
