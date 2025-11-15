/**
 * AI Copilot Component
 * Main component for ChatGPT-style conversational interface
 */

import React, { useState, useRef, useEffect } from 'react';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCopilot } from '@/lib/contexts/CopilotContext';
import { CopilotEmpty } from './copilot/CopilotEmpty';
import { ChatMessage } from './copilot/ChatMessage';
import { ChatInput } from './copilot/ChatInput';
import { CopilotService } from '@/lib/services/copilotService';
import logger from '@/lib/utils/logger';

interface CopilotProps {
  onGenerateEmail?: (contactId?: string) => void;
  onDraftEmail?: (contactId?: string) => void;
  initialQuery?: string;
}

export const Copilot: React.FC<CopilotProps> = ({
  onGenerateEmail,
  onDraftEmail,
  initialQuery
}) => {
  const { messages, isLoading, sendMessage, context } = useCopilot();
  const [inputValue, setInputValue] = useState(initialQuery || '');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [suggestedPrompts] = useState([
    'What should I prioritize today?',
    'Show me deals that need attention',
    'Draft a follow-up email for Alexander Wolf'
  ]);

  // Auto-send initial query if provided
  useEffect(() => {
    if (initialQuery && messages.length === 0) {
      sendMessage(initialQuery);
      setInputValue('');
    }
  }, [initialQuery]);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = () => {
    if (!inputValue.trim() || isLoading) return;
    sendMessage(inputValue);
    setInputValue('');
  };

  const handlePromptClick = (prompt: string) => {
    setInputValue(prompt);
    // Auto-send when clicking a prompt
    setTimeout(() => {
      sendMessage(prompt);
      setInputValue('');
    }, 100);
  };

  const handleActionClick = async (action: any) => {
    // Handle API callbacks
    if (action.callback && action.callback.startsWith('/api/')) {
      try {
        const response = await fetch(action.callback, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(action.params || {})
        });
        
        if (response.ok) {
          const result = await response.json();
          logger.log('Action completed:', result);
          // Optionally refresh data or show success message
        } else {
          logger.error('Action failed:', response.statusText);
        }
      } catch (error) {
        logger.error('Error executing action:', error);
      }
      return;
    }

    // Handle action types
    switch (action.type) {
      case 'draft_email':
        if (action.contactId || context.contactId) {
          try {
            const emailDraft = await CopilotService.draftEmail(
              action.contactId || context.contactId!,
              'Follow-up email based on recent activity',
              'professional'
            );
            onDraftEmail?.(action.contactId || context.contactId);
          } catch (error) {
            logger.error('Error drafting email:', error);
          }
        } else {
          onDraftEmail?.();
        }
        break;
      case 'view_deal':
        if (action.href || action.dealId) {
          const url = action.href || `/crm/deals/${action.dealId}`;
          window.location.href = url;
        }
        break;
      case 'view_contact':
        if (action.href || action.contactId) {
          const url = action.href || `/crm/contacts/${action.contactId}`;
          window.location.href = url;
        }
        break;
      case 'schedule_call':
        // Handle schedule call action
        logger.log('Schedule call action');
        break;
      default:
        // Handle callback function if provided
        if (typeof action.callback === 'function') {
          action.callback();
        } else if (action.callback && action.callback.startsWith('/')) {
          window.location.href = action.callback;
        }
    }
  };

  const isEmpty = messages.length === 0 && !isLoading;

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 min-h-screen flex flex-col">
      {/* Empty State or Active Conversation */}
      {isEmpty ? (
        <CopilotEmpty onPromptClick={handlePromptClick} />
      ) : (
        <>
          {/* Chat Messages Area */}
          <div className="flex-1 space-y-6 mb-6 overflow-y-auto">
            {messages.map(message => {
              // Stable key based on message ID only - prevents unnecessary re-renders
              return (
                <ChatMessage
                  key={message.id}
                  message={message}
                  onActionClick={handleActionClick}
                />
              );
            })}

            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input */}
          <ChatInput
            value={inputValue}
            onChange={setInputValue}
            onSend={handleSend}
            disabled={isLoading}
            suggestedPrompts={suggestedPrompts}
            onPromptClick={handlePromptClick}
          />
        </>
      )}
    </div>
  );
};

