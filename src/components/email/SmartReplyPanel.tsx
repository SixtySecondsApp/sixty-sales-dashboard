/**
 * Smart Reply Panel Component
 * AI-powered reply suggestions for email composition
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Check, Copy, RefreshCw } from 'lucide-react';
import { useEmailAnalysis } from '@/lib/hooks/useEmailAnalysis';
import type { GmailMessage } from '@/lib/types/gmail';
import type { SmartReply } from '@/lib/services/emailAnalysisService';
import { toast } from 'sonner';
import logger from '@/lib/utils/logger';

interface SmartReplyPanelProps {
  replyToEmail: GmailMessage;
  onSelectReply: (content: string) => void;
}

export function SmartReplyPanel({ replyToEmail, onSelectReply }: SmartReplyPanelProps) {
  const [selectedTone, setSelectedTone] = useState<'professional' | 'friendly' | 'casual' | 'formal'>('professional');
  const { generateSmartReplies, smartRepliesData, isGeneratingReplies } = useEmailAnalysis(replyToEmail);

  const tones = [
    { value: 'professional', label: 'Professional', emoji: '💼' },
    { value: 'friendly', label: 'Friendly', emoji: '😊' },
    { value: 'casual', label: 'Casual', emoji: '👋' },
    { value: 'formal', label: 'Formal', emoji: '🎩' },
  ] as const;

  const handleGenerateReplies = () => {
    logger.log('🤖 Generating smart replies with tone:', selectedTone);
    generateSmartReplies(selectedTone);
  };

  const handleCopyReply = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success('Reply copied to clipboard');
  };

  const handleUseReply = (content: string) => {
    onSelectReply(content);
    toast.success('Reply inserted into composer');
  };

  return (
    <div className="border-t border-gray-800/50 bg-gray-900/30 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-400" />
          <h3 className="text-sm font-medium text-gray-200">AI Reply Suggestions</h3>
        </div>

        {smartRepliesData && smartRepliesData.length > 0 && (
          <button
            onClick={handleGenerateReplies}
            disabled={isGeneratingReplies}
            className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-3 h-3 ${isGeneratingReplies ? 'animate-spin' : ''}`} />
            Regenerate
          </button>
        )}
      </div>

      {/* Tone Selection */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400">Tone:</span>
        <div className="flex gap-2">
          {tones.map((tone) => (
            <button
              key={tone.value}
              onClick={() => setSelectedTone(tone.value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                selectedTone === tone.value
                  ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                  : 'bg-gray-800/50 text-gray-400 border-gray-700/50 hover:bg-gray-800 hover:text-gray-300'
              }`}
            >
              <span>{tone.emoji}</span>
              <span>{tone.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Generate Button or Replies */}
      {!smartRepliesData || smartRepliesData.length === 0 ? (
        <button
          onClick={handleGenerateReplies}
          disabled={isGeneratingReplies}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-300 border border-purple-500/30 hover:from-purple-500/30 hover:to-pink-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isGeneratingReplies ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Generating replies...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>Generate AI Reply Suggestions</span>
            </>
          )}
        </button>
      ) : (
        <AnimatePresence mode="popLayout">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-3"
          >
            {smartRepliesData.map((reply: SmartReply, index: number) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="group relative bg-gray-800/50 rounded-lg p-4 border border-gray-700/50 hover:border-purple-500/30 transition-colors"
              >
                {/* Reply Content */}
                <p className="text-sm text-gray-300 mb-3 leading-relaxed">
                  {reply.content}
                </p>

                {/* Metadata and Actions */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 capitalize">
                      {reply.tone} tone
                    </span>
                    {reply.confidence && (
                      <span className="text-xs text-gray-600">
                        • {Math.round(reply.confidence * 100)}% confidence
                      </span>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleCopyReply(reply.content)}
                      className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-gray-700/50 text-gray-300 hover:bg-gray-700 transition-colors"
                    >
                      <Copy className="w-3 h-3" />
                      Copy
                    </button>
                    <button
                      onClick={() => handleUseReply(reply.content)}
                      className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30 transition-colors"
                    >
                      <Check className="w-3 h-3" />
                      Use Reply
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>
      )}

      {/* Helper Text */}
      {!smartRepliesData && !isGeneratingReplies && (
        <p className="text-xs text-gray-500 text-center">
          AI will generate contextual reply suggestions based on the email content
        </p>
      )}
    </div>
  );
}
