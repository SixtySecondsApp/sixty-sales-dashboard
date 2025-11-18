/**
 * Chat Message Component
 * Displays individual user/AI messages in the conversation
 */

import React from 'react';
import { Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { PriorityCard } from './PriorityCard';
import { ToolCallIndicator } from './ToolCallIndicator';
import { CopilotResponse } from './CopilotResponse';
import type { CopilotMessage } from './types';
import { useUser } from '@/lib/hooks/useUser';

interface ChatMessageProps {
  message: CopilotMessage;
  onActionClick?: (action: any) => void;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, onActionClick }) => {
  const isUser = message.role === 'user';
  const { userData } = useUser();

  return (
    <div className={cn('flex gap-3', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
      )}
      <div className={cn('max-w-3xl', isUser ? '' : 'w-full')}>
        {isUser ? (
          <div className="bg-blue-500/10 backdrop-blur-sm border border-blue-500/20 rounded-xl px-4 py-3 inline-block">
            <p className="text-sm text-gray-900 dark:text-gray-100">{message.content}</p>
          </div>
        ) : (
          <div className="w-full relative">
            {/* Tool Call Indicator - Show until response is ready */}
            <AnimatePresence mode="wait">
              {message.toolCall && !message.structuredResponse && !message.content && (
                <motion.div
                  key="tool-call-loader"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  transition={{ duration: 0.4, ease: "easeInOut" }}
                  className="mb-4"
                >
                  <ToolCallIndicator toolCall={message.toolCall} />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Structured Response (New Format) - Fade in after tool call */}
            <AnimatePresence mode="wait">
              {message.structuredResponse && (
                <motion.div
                  key="structured-response"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className="bg-white dark:bg-gray-900/60 backdrop-blur-xl border border-gray-200 dark:border-gray-800/40 rounded-xl px-5 py-4 shadow-lg w-full"
                >
                  <CopilotResponse
                    response={message.structuredResponse}
                    onActionClick={onActionClick}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Text Content (Legacy Format) - Fade in after tool call */}
            <AnimatePresence mode="wait">
              {!message.structuredResponse && message.content && (
                <motion.div
                  key="text-content"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className="bg-white dark:bg-gray-900/60 backdrop-blur-xl border border-gray-200 dark:border-gray-800/40 rounded-xl px-5 py-4 shadow-lg"
                >
                  <p className="text-sm text-gray-900 dark:text-gray-100 leading-relaxed whitespace-pre-wrap">{message.content}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Recommendations */}
            {message.recommendations && message.recommendations.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
                className="space-y-3 mt-4"
              >
                {message.recommendations.map(rec => (
                  <PriorityCard key={rec.id} recommendation={rec} onActionClick={onActionClick} />
                ))}
              </motion.div>
            )}
          </div>
        )}
      </div>
      {isUser && (
        <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
          {userData?.avatar_url ? (
            <img
              src={userData.avatar_url}
              alt={userData.first_name || 'User'}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
              <span className="text-xs font-bold text-white">
                {userData?.first_name?.[0]?.toUpperCase() || 'U'}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ChatMessage;
