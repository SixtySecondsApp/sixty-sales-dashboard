/**
 * Copilot Empty State Component
 * Displays when no conversation has started
 */

import React from 'react';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CopilotEmptyProps {
  onPromptClick: (prompt: string) => void;
}

const suggestedPrompts = [
  'What should I prioritize today?',
  'Show me deals that need attention',
  'Draft a follow-up email for Alexander Wolf'
];

export const CopilotEmpty: React.FC<CopilotEmptyProps> = ({ onPromptClick }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] max-w-2xl mx-auto px-6">
      <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-blue-500/20">
        <Sparkles className="w-8 h-8 text-white" />
      </div>
      <h2 className="text-2xl font-semibold text-gray-100 mb-2">AI Copilot</h2>
      <p className="text-sm text-gray-400 mb-8">Your intelligent sales assistant</p>
      <div className="w-full mb-6">
        <div className="bg-gray-900/80 backdrop-blur-sm border border-gray-800/50 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Ask Copilot anything about your pipeline, contacts, or next actions..."
                className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700/50 rounded-lg text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                    onPromptClick(e.currentTarget.value);
                  }
                }}
              />
            </div>
          </div>
        </div>
      </div>
      <div className="w-full">
        <p className="text-xs font-semibold text-gray-500 uppercase mb-3 text-center">Try asking:</p>
        <div className="flex flex-col gap-2">
          {suggestedPrompts.map((prompt, index) => (
            <button
              key={index}
              onClick={() => onPromptClick(prompt)}
              className={cn(
                'px-4 py-3 bg-gray-900/60 backdrop-blur-sm border border-gray-800/50 rounded-lg',
                'text-sm text-gray-300 text-left',
                'hover:bg-gray-800/60 hover:border-gray-700/50',
                'transition-all duration-200',
                'focus:outline-none focus:ring-2 focus:ring-blue-500/50'
              )}
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CopilotEmpty;
