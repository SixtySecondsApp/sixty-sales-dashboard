import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Sparkles,
  CheckCircle2,
  X,
  AlertCircle,
  TrendingUp,
  Clock,
  Zap,
  Loader2,
  Phone,
  Mail,
  Calendar,
  MessageSquare,
  FileText,
  Presentation,
  ListTodo,
  Play,
  ChevronDown,
  ChevronUp,
  RefreshCw
} from 'lucide-react';
import { supabase } from '@/lib/supabase/clientV2';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface NextActionSuggestion {
  id: string;
  activity_id: string;
  activity_type: string;
  title: string;
  reasoning: string;
  action_type: string;
  urgency: 'low' | 'medium' | 'high';
  confidence_score: number;
  status: 'pending' | 'accepted' | 'dismissed' | 'completed';
  recommended_deadline: string | null;
  timestamp_seconds: number | null;
  created_at: string;
  deal_id: string | null;
  company_id: string | null;
  contact_id: string | null;
  created_task_id: string | null;
  task_status?: string | null;
}

interface NextActionSuggestionsProps {
  meetingId: string;
  suggestions: NextActionSuggestion[];
  onSuggestionUpdate: () => void;
  onTimestampClick?: (seconds: number) => void;
  showPendingCount?: boolean;
}

// Helper function to format timestamp (seconds) to MM:SS or HH:MM:SS
function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function NextActionSuggestions({
  meetingId,
  suggestions: initialSuggestions,
  onSuggestionUpdate,
  onTimestampClick,
  showPendingCount = false
}: NextActionSuggestionsProps) {
  const [suggestions, setSuggestions] = useState(initialSuggestions);
  const [loading, setLoading] = useState<string | null>(null);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [extractingMore, setExtractingMore] = useState(false);

  // Task category icon mapping
  const categoryIcons: Record<string, any> = {
    call: Phone,
    email: Mail,
    meeting: Calendar,
    follow_up: MessageSquare,
    proposal: FileText,
    demo: Presentation,
    general: ListTodo
  };

  // Task category labels
  const categoryLabels: Record<string, string> = {
    call: 'Call',
    email: 'Email',
    meeting: 'Meeting',
    follow_up: 'Follow-up',
    proposal: 'Proposal',
    demo: 'Demo',
    general: 'Task'
  };

  const urgencyConfig = {
    high: {
      icon: Zap,
      color: 'text-purple-600 dark:text-purple-400',
      iconColor: 'text-purple-500',
      label: 'High',
      sortOrder: 1
    },
    medium: {
      icon: TrendingUp,
      color: 'text-blue-600 dark:text-blue-400',
      iconColor: 'text-blue-500',
      label: 'Medium',
      sortOrder: 2
    },
    low: {
      icon: Clock,
      color: 'text-gray-600 dark:text-gray-400',
      iconColor: 'text-gray-500',
      label: 'Low',
      sortOrder: 3
    }
  };

  const handleAccept = async (suggestionId: string) => {
    setLoading(suggestionId);
    try {
      // Call the accept_next_action_suggestion function
      const { data, error } = await supabase.rpc('accept_next_action_suggestion', {
        p_suggestion_id: suggestionId,
        p_task_data: null
      });

      if (error) throw error;

      toast.success('Task created from suggestion!', {
        description: 'The suggestion has been converted into a task.'
      });

      // Update local state
      setSuggestions(prev =>
        prev.map(s =>
          s.id === suggestionId
            ? { ...s, status: 'accepted' as const }
            : s
        )
      );

      onSuggestionUpdate();
    } catch (error: any) {
      toast.error('Failed to create task', {
        description: error.message
      });
    } finally {
      setLoading(null);
    }
  };

  const handleDismiss = async (suggestionId: string) => {
    setLoading(suggestionId);
    try {
      const { error } = await supabase.rpc('dismiss_next_action_suggestion', {
        p_suggestion_id: suggestionId,
        p_feedback: null
      });

      if (error) throw error;

      toast.success('Suggestion dismissed');

      // Update local state
      setSuggestions(prev =>
        prev.map(s =>
          s.id === suggestionId
            ? { ...s, status: 'dismissed' as const }
            : s
        )
      );

      onSuggestionUpdate();
    } catch (error: any) {
      toast.error('Failed to dismiss suggestion', {
        description: error.message
      });
    } finally {
      setLoading(null);
    }
  };

  const handleExtractMoreTasks = async () => {
    setExtractingMore(true);
    try {
      // Get all existing suggestions and tasks for context
      const { data: existingData, error: fetchError } = await supabase
        .from('next_action_suggestions')
        .select('title, action_type, status')
        .eq('activity_id', meetingId)
        .eq('activity_type', 'meeting');

      if (fetchError) throw fetchError;

      // Also get tasks created from this meeting
      const { data: existingTasks } = await supabase
        .from('tasks')
        .select('title, task_type, status')
        .eq('meeting_id', meetingId);

      // Prepare context for duplicate prevention
      const existingContext = {
        suggestions: existingData || [],
        tasks: existingTasks || []
      };

      // Call the Edge Function with forceRegenerate and context
      const { data, error } = await supabase.functions.invoke('suggest-next-actions', {
        body: {
          activityId: meetingId,
          activityType: 'meeting',
          forceRegenerate: true,
          existingContext: existingContext
        }
      });

      if (error) throw error;

      const newTasksCount = data?.tasks?.length || 0;

      toast.success(`Extracted ${newTasksCount} additional tasks!`, {
        description: 'New tasks have been added based on the meeting context.'
      });

      onSuggestionUpdate();
    } catch (error: any) {
      toast.error('Failed to extract additional tasks', {
        description: error.message
      });
    } finally {
      setExtractingMore(false);
    }
  };

  const toggleCard = (id: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Sort suggestions by priority (high -> medium -> low)
  const pendingSuggestions = suggestions
    .filter(s => s.status === 'pending')
    .sort((a, b) => {
      const urgencyA = urgencyConfig[a.urgency].sortOrder;
      const urgencyB = urgencyConfig[b.urgency].sortOrder;
      return urgencyA - urgencyB;
    });

  const processedSuggestions = suggestions.filter(s => s.status !== 'pending');

  if (suggestions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="rounded-full bg-blue-50 dark:bg-blue-900/20 p-4 mb-4">
          <Sparkles className="w-8 h-8 text-blue-600 dark:text-blue-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          No AI suggestions yet
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 text-center max-w-md">
          AI suggestions will appear here automatically after the meeting transcript is analyzed.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header with Extract More Tasks Button */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            AI Suggestions
          </h3>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleExtractMoreTasks}
          disabled={extractingMore}
          className="text-xs h-8 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border-purple-200 dark:border-purple-800/50 hover:from-purple-100 hover:to-blue-100 dark:hover:from-purple-900/30 dark:hover:to-blue-900/30"
        >
          {extractingMore ? (
            <>
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              <span>Extracting...</span>
            </>
          ) : (
            <>
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              <span>Extract More Tasks</span>
            </>
          )}
        </Button>
      </div>

      {/* Pending Suggestions */}
      {pendingSuggestions.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                Recommended Next Actions
              </h4>
            </div>
            {showPendingCount && (
              <Badge variant="destructive" className="text-xs">
                {pendingSuggestions.length} pending
              </Badge>
            )}
          </div>

          {pendingSuggestions.map((suggestion) => {
            const urgency = urgencyConfig[suggestion.urgency];
            const UrgencyIcon = urgency.icon;
            const confidence = Math.round(parseFloat(suggestion.confidence_score.toString()) * 100);
            const isExpanded = expandedCards.has(suggestion.id);

            // Get task category icon and label
            const CategoryIcon = categoryIcons[suggestion.action_type] || ListTodo;
            const categoryLabel = categoryLabels[suggestion.action_type] || 'Task';

            // Format deadline if available
            const deadline = suggestion.recommended_deadline
              ? new Date(suggestion.recommended_deadline).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: new Date(suggestion.recommended_deadline).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
                })
              : null;

            return (
              <Card
                key={suggestion.id}
                className="relative overflow-hidden backdrop-blur-xl bg-white dark:bg-gradient-to-br dark:from-gray-900/60 dark:to-gray-800/30 border border-gray-200 dark:border-gray-800/50 shadow-lg hover:shadow-xl transition-all duration-300"
              >
                {/* Glass effect overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-gray-900/20 dark:to-transparent pointer-events-none" />

                {/* Collapsed Header - Always Visible */}
                <div
                  className="relative p-3 cursor-pointer"
                  onClick={() => toggleCard(suggestion.id)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      {/* Priority Icon */}
                      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800/50 backdrop-blur-sm flex items-center justify-center shadow-sm border border-gray-200 dark:border-gray-700/30">
                        <UrgencyIcon className={cn("w-4 h-4", urgency.iconColor)} />
                      </div>

                      {/* Title and Category */}
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                          {suggestion.title}
                        </h4>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <CategoryIcon className="w-3 h-3 text-gray-400 dark:text-gray-500" />
                          <span className="text-xs text-gray-600 dark:text-gray-400">
                            {categoryLabel}
                          </span>
                          {deadline && (
                            <>
                              <span className="text-gray-300 dark:text-gray-600">•</span>
                              <span className="text-xs text-gray-600 dark:text-gray-400">
                                {deadline}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expand/Collapse Button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-shrink-0 h-7 w-7 p-0 hover:bg-gray-100 dark:hover:bg-gray-800/50"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleCard(suggestion.id);
                      }}
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="relative px-3 pb-3 space-y-3 border-t border-gray-100 dark:border-gray-800/50 pt-3">
                    {/* Metadata */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge
                        variant="outline"
                        className={cn("text-xs bg-gray-50 dark:bg-gray-800/50 backdrop-blur-sm border-gray-200 dark:border-gray-700/50", urgency.color)}
                      >
                        {urgency.label} Priority
                      </Badge>
                      <Badge variant="secondary" className="text-xs bg-gray-50 dark:bg-gray-800/50 backdrop-blur-sm">
                        {confidence}% confidence
                      </Badge>
                      {suggestion.timestamp_seconds && onTimestampClick && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onTimestampClick(suggestion.timestamp_seconds!)}
                          className="text-xs h-6 bg-gray-50 dark:bg-gray-800/50 backdrop-blur-sm border-gray-200 dark:border-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-800"
                        >
                          <Play className="w-3 h-3 mr-1" />
                          {formatTimestamp(suggestion.timestamp_seconds)}
                        </Button>
                      )}
                    </div>

                    {/* Reasoning */}
                    <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                      {suggestion.reasoning}
                    </p>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleAccept(suggestion.id)}
                        disabled={loading === suggestion.id}
                        className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white hover:text-white shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/30 transition-all"
                      >
                        {loading === suggestion.id ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin text-white" />
                            <span className="text-white">Creating...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-white" />
                            <span className="text-white">Create Task</span>
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDismiss(suggestion.id)}
                        disabled={loading === suggestion.id}
                        className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/50"
                      >
                        <X className="w-3.5 h-3.5 mr-1.5" />
                        Dismiss
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Accepted Actions - Only show accepted suggestions */}
      {processedSuggestions.filter(s => s.status === 'accepted').length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
            <h4 className="text-base font-semibold text-gray-900 dark:text-white">
              Accepted Actions
            </h4>
            <Badge variant="secondary" className="ml-auto text-xs">
              {processedSuggestions.filter(s => s.status === 'accepted').length}
            </Badge>
          </div>

          {processedSuggestions.filter(s => s.status === 'accepted').map((suggestion) => {
            const CategoryIcon = categoryIcons[suggestion.action_type] || ListTodo;
            const categoryLabel = categoryLabels[suggestion.action_type] || 'Task';

            return (
              <div
                key={suggestion.id}
                className="p-2.5 bg-gray-50/50 dark:bg-gray-800/30 rounded-lg border border-gray-200/50 dark:border-gray-700/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {suggestion.title}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <Badge variant="outline" className="text-xs bg-white/50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700/50">
                        <CategoryIcon className="w-3 h-3 mr-1" />
                        {categoryLabel}
                      </Badge>
                      {suggestion.task_status && (
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs",
                            suggestion.task_status === 'completed'
                              ? 'bg-green-50/50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800/50'
                              : 'bg-blue-50/50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800/50'
                          )}
                        >
                          {suggestion.task_status === 'completed' ? '✓ Complete' : '○ Pending'}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
