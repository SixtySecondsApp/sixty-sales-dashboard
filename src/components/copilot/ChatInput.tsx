/**
 * Chat Input Component
 * Input field with send button for Copilot messages
 */

import React, { useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
  placeholder?: string;
  suggestedPrompts?: string[];
  onPromptClick?: (prompt: string) => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  value,
  onChange,
  onSend,
  disabled = false,
  placeholder = 'Ask Copilot anything about your pipeline, contacts, or next actions...',
  suggestedPrompts = [],
  onPromptClick
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [value]);

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !disabled) {
        onSend();
      }
    }
  };

  return (
    <div className="bg-gray-900/80 backdrop-blur-sm border border-gray-800/50 rounded-xl p-4 sticky bottom-6">
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <textarea
            ref={textareaRef}
            rows={1}
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyPress}
            disabled={disabled}
            className={cn(
              'w-full px-4 py-3 bg-gray-800/50 border border-gray-700/50 rounded-lg',
              'text-sm text-gray-100 placeholder-gray-500',
              'focus:outline-none focus:ring-2 focus:ring-blue-500/50',
              'resize-none overflow-hidden',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          />
        </div>
        <Button
          onClick={onSend}
          disabled={!value.trim() || disabled}
          className="px-6 py-3 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/20 flex-shrink-0 disabled:opacity-50"
        >
          <Send className="w-4 h-4 mr-2" />
          <span className="text-sm font-semibold">Send</span>
        </Button>
      </div>

      {/* Suggested Prompts */}
      {suggestedPrompts.length > 0 && onPromptClick && (
        <div className="mt-3 flex flex-wrap gap-2">
          {suggestedPrompts.map((prompt, index) => (
            <button
              key={index}
              onClick={() => onPromptClick(prompt)}
              className="px-3 py-1.5 bg-gray-800/50 hover:bg-gray-800 border border-gray-700/50 rounded-lg text-xs text-gray-300 transition-all"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ChatInput;
