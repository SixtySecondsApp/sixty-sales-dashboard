/**
 * Email Response Component
 * Displays email drafts with context and suggestions
 */

import React from 'react';
import { Lightbulb, Clock } from 'lucide-react';
import { ActionButtons } from '../ActionButtons';
import type { EmailResponse as EmailResponseData } from '../types';

interface EmailResponseProps {
  data: EmailResponseData;
  onActionClick?: (action: any) => void;
}

const formatTime = (timeString: string): string => {
  const date = new Date(timeString);
  return date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const EmailResponse: React.FC<EmailResponseProps> = ({ data, onActionClick }) => {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-300">{data.summary}</p>

      {/* Context Banner */}
      <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-800/40 rounded-lg p-3 text-xs">
        <div className="flex items-center gap-2 mb-2">
          <Lightbulb className="w-4 h-4 text-blue-400" />
          <span className="font-semibold text-gray-300">Context Used</span>
        </div>
        <ul className="space-y-1 text-gray-400">
          {data.data.context.keyPoints.map((point, i) => (
            <li key={i}>• {point}</li>
          ))}
        </ul>
        {data.data.context.warnings && data.data.context.warnings.length > 0 && (
          <div className="mt-2 pt-2 border-t border-gray-800/50">
            <div className="text-amber-400 font-semibold mb-1">Warnings:</div>
            <ul className="space-y-1 text-amber-400/80">
              {data.data.context.warnings.map((warning, i) => (
                <li key={i}>⚠ {warning}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Email Preview */}
      <div className="bg-gray-900/80 backdrop-blur-sm border border-gray-800/50 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-gray-800/50 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">To:</span>
            <span className="text-sm text-gray-300">{data.data.email.to.join(', ')}</span>
          </div>
          {data.data.email.cc && data.data.email.cc.length > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">CC:</span>
              <span className="text-sm text-gray-300">{data.data.email.cc.join(', ')}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Subject:</span>
            <span className="text-sm text-gray-300">{data.data.email.subject}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Tone:</span>
            <span className="text-sm text-gray-300 capitalize">{data.data.email.tone}</span>
          </div>
        </div>
        <div className="p-4">
          <pre className="text-sm text-gray-300 whitespace-pre-wrap font-sans leading-relaxed">
            {data.data.email.body}
          </pre>
        </div>
      </div>

      {/* Suggestions */}
      {data.data.suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {data.data.suggestions.map((suggestion, i) => (
            <button
              key={i}
              className="px-3 py-1.5 bg-gray-900/60 backdrop-blur-sm border border-gray-800/40 rounded-lg text-xs text-gray-300 hover:bg-gray-900/50 transition-colors"
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

