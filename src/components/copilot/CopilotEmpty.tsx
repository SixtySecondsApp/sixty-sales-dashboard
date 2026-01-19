/**
 * Copilot Empty State Component
 * Displays when no conversation has started
 */

import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useDynamicPrompts } from '@/lib/hooks/useDynamicPrompts';

interface CopilotEmptyProps {
  onPromptClick: (prompt: string) => void;
}

export const CopilotEmpty: React.FC<CopilotEmptyProps> = ({ onPromptClick }) => {
  const { prompts: suggestedPrompts, isLoading: promptsLoading } = useDynamicPrompts(3);
  const [inputValue, setInputValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [inputValue]);

  const handleSend = () => {
    if (inputValue.trim()) {
      onPromptClick(inputValue);
      setInputValue('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (inputValue.trim()) {
        handleSend();
      }
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-0 w-full px-4 py-8">
      <div className="w-full max-w-3xl mx-auto flex flex-col items-center">
        {/* Welcome Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-3">
            AI Copilot
          </h1>
          <p className="text-gray-700 dark:text-gray-400 text-lg">
            Ask me anything about your pipeline, contacts, or next actions
          </p>
        </div>

        {/* Large Centered Input Box */}
        <div className="w-full max-w-2xl mb-8">
          <div className="bg-white dark:bg-gray-900/80 backdrop-blur-sm border border-gray-200 dark:border-gray-800/50 rounded-2xl p-6 shadow-lg dark:shadow-2xl">
            <div className="flex items-end gap-4">
              <div className="flex-1">
                <textarea
                  ref={textareaRef}
                  rows={3}
                  placeholder="Ask Copilot anything about your pipeline, contacts, or next actions..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyPress}
                  data-testid="copilot-input"
                  className={cn(
                    'w-full px-6 py-4 bg-white dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700/50 rounded-xl',
                    'text-base text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500',
                    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
                    'resize-none overflow-hidden',
                    'transition-all duration-200'
                  )}
                />
              </div>
              <Button
                onClick={handleSend}
                disabled={!inputValue.trim()}
                className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-blue-500/20"
              >
                <Send className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Suggested Prompts */}
        <div className="w-full max-w-2xl">
          <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-4 text-center tracking-wider">
            Try asking:
          </p>
          <div className="flex flex-col gap-3">
            {promptsLoading ? (
              // Loading skeleton for prompts
              <>
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="px-6 py-4 bg-gray-100 dark:bg-gray-800/40 rounded-xl animate-pulse"
                  >
                    <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                  </div>
                ))}
              </>
            ) : (
              suggestedPrompts.map((prompt, index) => (
                <button
                  key={index}
                  onClick={() => onPromptClick(prompt)}
                  className={cn(
                    'px-6 py-4 bg-white dark:bg-gray-900/60 backdrop-blur-sm border border-gray-200 dark:border-gray-800/50 rounded-xl',
                    'text-base text-gray-900 dark:text-gray-300 text-left',
                    'hover:bg-gray-50 dark:hover:bg-gray-800/60 hover:border-gray-300 dark:hover:border-gray-700/50 hover:scale-[1.02]',
                    'transition-all duration-200',
                    'focus:outline-none focus:ring-2 focus:ring-blue-500'
                  )}
                >
                  {prompt}
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CopilotEmpty;
