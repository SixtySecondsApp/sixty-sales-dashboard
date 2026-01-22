/**
 * Email Response Component
 * Displays email drafts with context and suggestions
 * US-010: Added tone selector UI for email generation
 */

import React from 'react';
import { Lightbulb, Clock, Briefcase, Smile, Zap } from 'lucide-react';
import { ActionButtons } from '../ActionButtons';
import { cn } from '@/lib/utils';
import type { EmailResponse as EmailResponseData } from '../types';

interface EmailResponseProps {
  data: EmailResponseData;
  onActionClick?: (action: any) => void;
}

// US-010: Tone options for email generation
const toneOptions = [
  {
    value: 'professional' as const,
    label: 'Professional',
    icon: Briefcase,
    description: 'Formal and business-appropriate'
  },
  {
    value: 'friendly' as const,
    label: 'Friendly',
    icon: Smile,
    description: 'Warm and personable'
  },
  {
    value: 'concise' as const,
    label: 'Concise',
    icon: Zap,
    description: 'Brief and to the point'
  },
] as const;

type EmailTone = 'professional' | 'friendly' | 'concise';

const formatTime = (timeString: string): string => {
  const date = new Date(timeString);
  return date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const EmailResponse: React.FC<EmailResponseProps> = ({ data, onActionClick }) => {
  const currentTone = data.data.email.tone || 'professional';

  // US-010: Handle tone change - trigger regeneration with new tone
  const handleToneChange = (newTone: EmailTone) => {
    if (newTone === currentTone) return;

    if (onActionClick) {
      onActionClick({
        type: 'change_email_tone',
        tone: newTone,
        email: data.data.email,
        context: data.data.context
      });
    }
  };

  // US-010: Handle suggestion click
  const handleSuggestionClick = (suggestion: { action: string; label: string; description: string }) => {
    if (onActionClick) {
      if (suggestion.action === 'change_tone') {
        // For change_tone suggestions, cycle to the next tone
        const currentIndex = toneOptions.findIndex(t => t.value === currentTone);
        const nextIndex = (currentIndex + 1) % toneOptions.length;
        handleToneChange(toneOptions[nextIndex].value);
      } else {
        onActionClick({
          type: suggestion.action,
          email: data.data.email,
          context: data.data.context
        });
      }
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600 dark:text-gray-300">{data.summary}</p>

      {/* Context Banner */}
      <div className="bg-gray-100 dark:bg-gray-900/60 backdrop-blur-sm border border-gray-200 dark:border-gray-800/40 rounded-lg p-3 text-xs">
        <div className="flex items-center gap-2 mb-2">
          <Lightbulb className="w-4 h-4 text-blue-500 dark:text-blue-400" />
          <span className="font-semibold text-gray-700 dark:text-gray-300">Context Used</span>
        </div>
        <ul className="space-y-1 text-gray-600 dark:text-gray-400">
          {data.data.context.keyPoints.map((point, i) => (
            <li key={i}>• {point}</li>
          ))}
        </ul>
        {data.data.context.warnings && data.data.context.warnings.length > 0 && (
          <div className="mt-2 pt-2 border-t border-gray-300 dark:border-gray-800/50">
            <div className="text-amber-600 dark:text-amber-400 font-semibold mb-1">Warnings:</div>
            <ul className="space-y-1 text-amber-600/80 dark:text-amber-400/80">
              {data.data.context.warnings.map((warning, i) => (
                <li key={i}>⚠ {warning}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* US-010: Tone Selector */}
      <div className="bg-gray-100 dark:bg-gray-900/60 backdrop-blur-sm border border-gray-200 dark:border-gray-800/40 rounded-lg p-3">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Email Tone</span>
          <span className="text-xs text-gray-500 dark:text-gray-500">Click to change</span>
        </div>
        <div className="flex gap-2">
          {toneOptions.map((tone) => {
            const Icon = tone.icon;
            const isActive = currentTone === tone.value;
            return (
              <button
                key={tone.value}
                onClick={() => handleToneChange(tone.value)}
                title={tone.description}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all',
                  isActive
                    ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/25'
                    : 'bg-white dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700/50 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tone.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Email Preview */}
      <div className="bg-white dark:bg-gray-900/80 backdrop-blur-sm border border-gray-200 dark:border-gray-800/50 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800/50 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">To:</span>
            <span className="text-sm text-gray-700 dark:text-gray-300">{data.data.email.to.join(', ')}</span>
          </div>
          {data.data.email.cc && data.data.email.cc.length > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">CC:</span>
              <span className="text-sm text-gray-700 dark:text-gray-300">{data.data.email.cc.join(', ')}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Subject:</span>
            <span className="text-sm text-gray-700 dark:text-gray-300">{data.data.email.subject}</span>
          </div>
        </div>
        <div className="p-4">
          <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-sans leading-relaxed">
            {data.data.email.body}
          </pre>
        </div>
      </div>

      {/* Suggestions - Now clickable */}
      {data.data.suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {data.data.suggestions.map((suggestion, i) => (
            <button
              key={i}
              onClick={() => handleSuggestionClick(suggestion)}
              title={suggestion.description}
              className="px-3 py-1.5 bg-gray-100 dark:bg-gray-900/60 backdrop-blur-sm border border-gray-200 dark:border-gray-800/40 rounded-lg text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-900/50 hover:border-gray-300 dark:hover:border-gray-700 transition-colors"
            >
              {suggestion.label}
            </button>
          ))}
        </div>
      )}

      {/* Best Time to Send */}
      {data.data.email.sendTime && (
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Clock className="w-3 h-3" />
          <span>Best time to send: {formatTime(data.data.email.sendTime)}</span>
        </div>
      )}

      <ActionButtons actions={data.actions} onActionClick={onActionClick} />
    </div>
  );
};

export default EmailResponse;

