/**
 * Email Analysis Badge Component
 * Displays AI-powered email categorization, sentiment, and priority
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Tag,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertCircle,
  Sparkles,
  MessageSquare,
  Clock,
  CheckCircle2,
  HelpCircle,
  Calendar,
  FileText,
} from 'lucide-react';
import { useEmailAnalysis, getCategoryColor, getSentimentColor, getPriorityColor } from '@/lib/hooks/useEmailAnalysis';
import type { GmailMessage } from '@/lib/types/gmail';
import type { EmailAnalysis } from '@/lib/services/emailAnalysisService';

interface EmailAnalysisBadgeProps {
  email: GmailMessage;
  showDetails?: boolean;
  compact?: boolean;
}

export function EmailAnalysisBadge({ email, showDetails = false, compact = false }: EmailAnalysisBadgeProps) {
  const { analysis, isAnalyzing } = useEmailAnalysis(email);
  const [expanded, setExpanded] = useState(false);

  if (isAnalyzing) {
    return (
      <div className="flex items-center gap-1">
        <Sparkles className="w-3 h-3 text-purple-400 animate-pulse" />
        <span className="text-xs text-gray-400">Analyzing...</span>
      </div>
    );
  }

  if (!analysis) return null;

  const categoryIcon = getCategoryIcon(analysis.category);
  const sentimentIcon = getSentimentIcon(analysis.sentiment);
  const intentIcon = getIntentIcon(analysis.intent);

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${getCategoryColor(analysis.category)}`}>
          {categoryIcon}
          <span className="capitalize">{analysis.category}</span>
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Main badges */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Category */}
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border ${getCategoryColor(analysis.category)}`}>
          {categoryIcon}
          <span className="capitalize">{analysis.category}</span>
        </span>

        {/* Sentiment */}
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border ${getSentimentColor(analysis.sentiment)}`}>
          {sentimentIcon}
          <span className="capitalize">{analysis.sentiment}</span>
        </span>

        {/* Priority */}
        {analysis.priority !== 'medium' && (
          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border ${getPriorityColor(analysis.priority)}`}>
            <AlertCircle className="w-3 h-3" />
            <span className="capitalize">{analysis.priority}</span>
          </span>
        )}

        {/* Intent */}
        {showDetails && (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border bg-indigo-500/20 text-indigo-400 border-indigo-500/30">
            {intentIcon}
            <span className="capitalize">{analysis.intent.replace('_', ' ')}</span>
          </span>
        )}

        {/* Expand button */}
        {analysis.suggestedActions && analysis.suggestedActions.length > 0 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border bg-gray-500/20 text-gray-400 border-gray-500/30 hover:bg-gray-500/30 transition-colors"
          >
            <Sparkles className="w-3 h-3" />
            {expanded ? 'Hide' : 'Show'} Actions
          </button>
        )}
      </div>

      {/* Suggested actions */}
      <AnimatePresence>
        {expanded && analysis.suggestedActions && analysis.suggestedActions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50"
          >
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-medium text-gray-300">Suggested Actions</span>
            </div>
            <ul className="space-y-1">
              {analysis.suggestedActions.map((action, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-gray-400">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 text-green-400 flex-shrink-0" />
                  <span>{action}</span>
                </li>
              ))}
            </ul>
            {analysis.confidence && (
              <div className="mt-2 pt-2 border-t border-gray-700/50">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>Confidence</span>
                  <span>{Math.round(analysis.confidence * 100)}%</span>
                </div>
                <div className="mt-1 h-1 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-500 rounded-full"
                    style={{ width: `${analysis.confidence * 100}%` }}
                  />
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Helper functions
function getCategoryIcon(category: EmailAnalysis['category']) {
  const iconProps = { className: 'w-3 h-3' };
  switch (category) {
    case 'work':
      return <Tag {...iconProps} />;
    case 'personal':
      return <MessageSquare {...iconProps} />;
    case 'marketing':
      return <TrendingUp {...iconProps} />;
    case 'newsletter':
      return <FileText {...iconProps} />;
    case 'social':
      return <MessageSquare {...iconProps} />;
    case 'notification':
      return <AlertCircle {...iconProps} />;
    case 'spam':
      return <AlertCircle {...iconProps} />;
    default:
      return <Tag {...iconProps} />;
  }
}

function getSentimentIcon(sentiment: EmailAnalysis['sentiment']) {
  const iconProps = { className: 'w-3 h-3' };
  switch (sentiment) {
    case 'positive':
      return <TrendingUp {...iconProps} />;
    case 'neutral':
      return <Minus {...iconProps} />;
    case 'negative':
      return <TrendingDown {...iconProps} />;
    default:
      return <Minus {...iconProps} />;
  }
}

function getIntentIcon(intent: EmailAnalysis['intent']) {
  const iconProps = { className: 'w-3 h-3' };
  switch (intent) {
    case 'action_required':
      return <CheckCircle2 {...iconProps} />;
    case 'fyi':
      return <FileText {...iconProps} />;
    case 'question':
      return <HelpCircle {...iconProps} />;
    case 'meeting':
      return <Calendar {...iconProps} />;
    case 'proposal':
      return <FileText {...iconProps} />;
    case 'follow_up':
      return <Clock {...iconProps} />;
    default:
      return <MessageSquare {...iconProps} />;
  }
}
