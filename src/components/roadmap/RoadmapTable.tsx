import React from 'react';
import { useRoadmapContext } from '@/lib/contexts/RoadmapContext';
import { format } from 'date-fns';
import { ChevronUp, User, Calendar, Bug, Lightbulb, Settings, HelpCircle } from 'lucide-react';
import logger from '@/lib/utils/logger';

interface RoadmapTableProps {
  onSuggestionClick: (suggestion: any) => void;
  onDeleteSuggestion: (id: string) => void;
}

export function RoadmapTable({ onSuggestionClick, onDeleteSuggestion }: RoadmapTableProps) {
  const { suggestions, voteForSuggestion, removeVote } = useRoadmapContext();

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'bug':
        return <Bug className="w-4 h-4 text-red-400" />;
      case 'feature':
        return <Lightbulb className="w-4 h-4 text-blue-400" />;
      case 'improvement':
        return <Settings className="w-4 h-4 text-emerald-400" />;
      default:
        return <HelpCircle className="w-4 h-4 text-gray-400" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'text-red-400';
      case 'high':
        return 'text-orange-400';
      case 'medium':
        return 'text-yellow-400';
      default:
        return 'text-gray-400';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'submitted':
        return 'bg-gray-100 text-gray-700 dark:bg-gray-500/20 dark:text-gray-400';
      case 'under_review':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400';
      case 'in_progress':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400';
      case 'testing':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400';
      case 'completed':
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400';
      case 'rejected':
        return 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-500/20 dark:text-gray-400';
    }
  };

  const handleVoteClick = async (e: React.MouseEvent, suggestion: any) => {
    e.stopPropagation();
    try {
      if (suggestion.hasUserVoted) {
        await removeVote(suggestion.id);
      } else {
        await voteForSuggestion(suggestion.id);
      }
    } catch (error) {
      logger.error('Failed to toggle vote:', error);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-800/50 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-800/50 bg-gray-50 dark:bg-gray-900/70">
              <th className="text-left p-4 text-sm font-medium text-gray-700 dark:text-gray-400">Type</th>
              <th className="text-left p-4 text-sm font-medium text-gray-700 dark:text-gray-400">Title</th>
              <th className="text-left p-4 text-sm font-medium text-gray-700 dark:text-gray-400">Status</th>
              <th className="text-left p-4 text-sm font-medium text-gray-700 dark:text-gray-400">Priority</th>
              <th className="text-left p-4 text-sm font-medium text-gray-700 dark:text-gray-400">Votes</th>
              <th className="text-left p-4 text-sm font-medium text-gray-700 dark:text-gray-400">Submitted By</th>
              <th className="text-left p-4 text-sm font-medium text-gray-700 dark:text-gray-400">Date</th>
            </tr>
          </thead>
          <tbody>
            {suggestions.map((suggestion) => (
              <tr
                key={suggestion.id || `suggestion-${suggestions.indexOf(suggestion)}`}
                onClick={() => {
                  if (suggestion.id && suggestion.id.trim() !== '') {
                    onSuggestionClick(suggestion);
                  } else {
                    logger.error('Cannot edit suggestion with invalid ID:', suggestion);
                  }
                }}
                className="border-b border-gray-200 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30 cursor-pointer transition-colors"
              >
                <td className="p-4">
                  {getTypeIcon(suggestion.type)}
                </td>
                <td className="p-4">
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">{suggestion.title}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 line-clamp-1">{suggestion.description}</div>
                  </div>
                </td>
                <td className="p-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(suggestion.status)}`}>
                    {suggestion.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="p-4">
                  <span className={`font-medium ${getPriorityColor(suggestion.priority)}`}>
                    {suggestion.priority}
                  </span>
                </td>
                <td className="p-4">
                  <button
                    onClick={(e) => handleVoteClick(e, suggestion)}
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg transition-colors ${
                      suggestion.hasUserVoted 
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700/50 dark:text-gray-300 dark:hover:bg-gray-700'
                    }`}
                  >
                    <ChevronUp className="w-4 h-4" />
                    <span className="font-semibold text-sm">{suggestion.votes_count || 0}</span>
                  </button>
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <User className="w-3.5 h-3.5" />
                    <span>{suggestion.submitted_by_profile?.full_name || 'Unknown'}</span>
                  </div>
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{format(new Date(suggestion.submitted_at), 'MMM d, yyyy')}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}