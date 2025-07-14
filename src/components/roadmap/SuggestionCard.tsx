import React, { useMemo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Clock,
  AlertCircle,
  User,
  Calendar,
  Bug,
  Lightbulb,
  Settings,
  HelpCircle,
  ChevronUp,
  Users
} from 'lucide-react';
import { format } from 'date-fns';

interface SuggestionCardProps {
  suggestion: any;
  index?: number;
  onClick: (suggestion: any) => void;
  isDragOverlay?: boolean;
}

export function SuggestionCard({ suggestion, onClick, isDragOverlay = false }: SuggestionCardProps) {
  // Ensure ID is a string
  const suggestionId = String(suggestion.id);

  // Set up sortable drag behavior
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: suggestionId,
    data: {
      ...suggestion,
      id: suggestionId
    },
    disabled: isDragOverlay
  });

  // Apply transform styles for dragging with animations
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? '0.3' : '1',
    ...(isDragOverlay ? { zIndex: 9999 } : {}),
  };

  // Get type icon and color
  const typeInfo = useMemo(() => {
    switch (suggestion.type) {
      case 'bug':
        return { icon: Bug, color: 'text-red-400', bgColor: 'bg-red-500/20' };
      case 'feature':
        return { icon: Lightbulb, color: 'text-blue-400', bgColor: 'bg-blue-500/20' };
      case 'improvement':
        return { icon: Settings, color: 'text-emerald-400', bgColor: 'bg-emerald-500/20' };
      default:
        return { icon: HelpCircle, color: 'text-gray-400', bgColor: 'bg-gray-500/20' };
    }
  }, [suggestion.type]);

  // Get priority color and icon
  const priorityInfo = useMemo(() => {
    switch (suggestion.priority) {
      case 'critical':
        return { color: 'text-red-400', bgColor: 'bg-red-500/20', borderColor: 'border-red-500/30' };
      case 'high':
        return { color: 'text-orange-400', bgColor: 'bg-orange-500/20', borderColor: 'border-orange-500/30' };
      case 'medium':
        return { color: 'text-yellow-400', bgColor: 'bg-yellow-500/20', borderColor: 'border-yellow-500/30' };
      default:
        return { color: 'text-gray-400', bgColor: 'bg-gray-500/20', borderColor: 'border-gray-500/30' };
    }
  }, [suggestion.priority]);

  // Calculate days since submission
  const daysSinceSubmission = useMemo(() => {
    const submitted = new Date(suggestion.submitted_at);
    const now = new Date();
    const diff = now.getTime() - submitted.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }, [suggestion.submitted_at]);

  // Determine time indicator
  const timeIndicator = useMemo(() => {
    if (daysSinceSubmission > 30) {
      return {
        status: 'danger',
        text: `${daysSinceSubmission}d ago`,
        icon: AlertCircle
      };
    } else if (daysSinceSubmission > 14) {
      return {
        status: 'warning',
        text: `${daysSinceSubmission}d ago`,
        icon: Clock
      };
    } else {
      return {
        status: 'normal',
        text: daysSinceSubmission === 0 ? 'Today' : `${daysSinceSubmission}d ago`,
        icon: Clock
      };
    }
  }, [daysSinceSubmission]);

  const TypeIcon = typeInfo.icon;

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => isDragging ? null : onClick(suggestion)}
      className={`
        bg-gray-800/50 rounded-xl p-4 hover:bg-gray-800/70
        transition-all border border-gray-800/80
        hover:border-gray-700 shadow-sm hover:shadow-md group
        ${isDragging || isDragOverlay ? 'shadow-lg cursor-grabbing z-[9999]' : 'cursor-grab'}
        relative overflow-hidden
      `}
      style={style}
    >
      {/* Shine effect */}
      {!isDragging && !isDragOverlay && (
        <div className="absolute inset-0 bg-gradient-to-r from-transparent
          via-white/[0.02] to-transparent translate-x-[-200%]
          group-hover:translate-x-[200%] transition-transform duration-1000 pointer-events-none
          z-[1]"
        />
      )}

      <div className="relative z-[2]">
        {/* Header with title and votes */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <TypeIcon className={`w-4 h-4 ${typeInfo.color} flex-shrink-0`} />
              <h3 className="font-medium text-white text-base truncate"
                  title={suggestion.title}
              >
                {suggestion.title}
              </h3>
            </div>
            
            {/* Submitter info */}
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <User className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate" title={suggestion.submitted_by_profile?.full_name}>
                {suggestion.submitted_by_profile?.full_name || 'Unknown'}
              </span>
            </div>
          </div>

          {/* Votes */}
          <div className={`flex items-center gap-1 ml-3 px-2 py-1 rounded-lg ${
            suggestion.hasUserVoted ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-700/50 text-gray-300'
          }`}>
            <ChevronUp className="w-4 h-4" />
            <span className="font-semibold text-sm">{suggestion.votes_count || 0}</span>
          </div>
        </div>

        {/* Description preview */}
        <p className="text-sm text-gray-400 mb-3 line-clamp-2">
          {suggestion.description}
        </p>

        {/* Badges row */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {/* Priority badge */}
          <span className={`
            inline-flex items-center px-2 py-0.5 rounded text-xs font-medium
            ${priorityInfo.bgColor} ${priorityInfo.color} border ${priorityInfo.borderColor}
          `}>
            {suggestion.priority}
          </span>

          {/* Type badge */}
          <span className={`
            inline-flex items-center px-2 py-0.5 rounded text-xs font-medium
            ${typeInfo.bgColor} ${typeInfo.color} border ${typeInfo.color.replace('text-', 'border-')}/30
          `}>
            {suggestion.type}
          </span>

          {/* Effort badge if exists */}
          {suggestion.estimated_effort && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium
              bg-purple-500/20 text-purple-400 border border-purple-500/30">
              {suggestion.estimated_effort}
            </span>
          )}

          {/* Assigned badge if exists */}
          {suggestion.assigned_to_profile && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium
              bg-blue-500/20 text-blue-400 border border-blue-500/30">
              <Users className="w-3 h-3" />
              {suggestion.assigned_to_profile.full_name?.split(' ')[0] || 'Assigned'}
            </span>
          )}
        </div>

        {/* Bottom row - time indicator and target version */}
        <div className="flex items-center justify-between">
          {/* Time since submission */}
          <div className={`
            flex items-center gap-1.5 text-xs
            ${timeIndicator.status === 'danger' ? 'text-red-400' :
              timeIndicator.status === 'warning' ? 'text-yellow-400' : 'text-gray-400'}
          `}>
            {timeIndicator.icon && <timeIndicator.icon className="w-3.5 h-3.5" />}
            <span>{timeIndicator.text}</span>
          </div>

          {/* Target version or completion date */}
          {suggestion.target_version ? (
            <span className="text-xs font-medium text-gray-300">
              v{suggestion.target_version}
            </span>
          ) : suggestion.completion_date ? (
            <span className="text-xs text-emerald-400">
              <Calendar className="w-3 h-3 inline mr-1" />
              {format(new Date(suggestion.completion_date), 'MMM d')}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}