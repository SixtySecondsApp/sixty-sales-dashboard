/**
 * GlobalTopicCard Component
 *
 * Display card for a single global topic
 * Features:
 * - Title and description
 * - Source count badge
 * - Company/contact chips
 * - Relevance indicator
 * - Selection state
 * - Grid and list view modes
 */

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Building2,
  Users,
  Calendar,
  TrendingUp,
  Layers,
} from 'lucide-react';
import type { GlobalTopic } from '@/lib/services/globalTopicsService';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface GlobalTopicCardProps {
  topic: GlobalTopic;
  isSelected: boolean;
  onClick: () => void;
  viewMode: 'grid' | 'list';
  compact?: boolean;
}

export function GlobalTopicCard({
  topic,
  isSelected,
  onClick,
  viewMode,
  compact = false,
}: GlobalTopicCardProps) {
  const lastSeen = formatDistanceToNow(new Date(topic.last_seen_at), {
    addSuffix: true,
  });

  // Get relevance color
  const relevanceColor = getRelevanceColor(topic.relevance_score);

  if (viewMode === 'list') {
    return (
      <Card
        className={cn(
          'bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm cursor-pointer transition-all duration-200',
          'hover:bg-white/80 dark:hover:bg-gray-800/80 hover:shadow-md',
          isSelected && 'ring-2 ring-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/20'
        )}
        onClick={onClick}
      >
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            {/* Title */}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm truncate">
                {topic.canonical_title}
              </h3>
              {topic.canonical_description && (
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {topic.canonical_description}
                </p>
              )}
            </div>

            {/* Metadata */}
            <div className="flex items-center gap-3 shrink-0">
              {/* Companies */}
              {topic.companies.length > 0 && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Building2 className="w-3 h-3" />
                  <span>{topic.companies.length}</span>
                </div>
              )}

              {/* Meetings */}
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="w-3 h-3" />
                <span>{topic.meeting_count}</span>
              </div>

              {/* Last seen */}
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {lastSeen}
              </span>

              {/* Source count */}
              <Badge variant="secondary" className="shrink-0">
                <Layers className="w-3 h-3 mr-1" />
                {topic.source_count}
              </Badge>

              {/* Relevance indicator */}
              <div
                className={cn(
                  'w-2 h-2 rounded-full shrink-0',
                  relevanceColor.bg
                )}
                title={`Relevance: ${Math.round(topic.relevance_score * 100)}%`}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Grid view
  return (
    <Card
      className={cn(
        'bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm cursor-pointer transition-all duration-200',
        'hover:bg-white/80 dark:hover:bg-gray-800/80 hover:shadow-md hover:scale-[1.02]',
        isSelected && 'ring-2 ring-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/20',
        compact && 'p-0'
      )}
      onClick={onClick}
    >
      <CardContent className={cn('space-y-3', compact ? 'p-3' : 'p-4')}>
        {/* Header with title and relevance */}
        <div className="flex items-start justify-between gap-2">
          <h3 className={cn('font-semibold leading-tight', compact ? 'text-sm' : 'text-base')}>
            {topic.canonical_title}
          </h3>
          <div
            className={cn(
              'shrink-0 w-2 h-2 rounded-full mt-1.5',
              relevanceColor.bg
            )}
            title={`Relevance: ${Math.round(topic.relevance_score * 100)}%`}
          />
        </div>

        {/* Description */}
        {topic.canonical_description && !compact && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {topic.canonical_description}
          </p>
        )}

        {/* Stats row */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Layers className="w-3 h-3" />
            <span>{topic.source_count} sources</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            <span>{topic.meeting_count} meetings</span>
          </div>
        </div>

        {/* Companies and contacts */}
        {!compact && (topic.companies.length > 0 || topic.contacts.length > 0) && (
          <div className="flex flex-wrap gap-1.5">
            {topic.companies.slice(0, 3).map((company, idx) => (
              <Badge
                key={`company-${idx}`}
                variant="outline"
                className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800"
              >
                <Building2 className="w-2.5 h-2.5 mr-1" />
                {company}
              </Badge>
            ))}
            {topic.companies.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{topic.companies.length - 3} more
              </Badge>
            )}
          </div>
        )}

        {/* Last seen */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700">
          <span className="text-xs text-muted-foreground">
            Last seen {lastSeen}
          </span>
          {topic.frequency_score > 0 && (
            <div className="flex items-center gap-1 text-xs">
              <TrendingUp
                className={cn(
                  'w-3 h-3',
                  topic.frequency_score > 0.5
                    ? 'text-emerald-500'
                    : 'text-gray-400'
                )}
              />
              <span className="text-muted-foreground">
                {Math.round(topic.frequency_score * 100)}%
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Helper function to get relevance color
function getRelevanceColor(score: number) {
  if (score >= 0.7) {
    return {
      bg: 'bg-emerald-500',
      text: 'text-emerald-500',
      label: 'High',
    };
  }
  if (score >= 0.4) {
    return {
      bg: 'bg-amber-500',
      text: 'text-amber-500',
      label: 'Medium',
    };
  }
  return {
    bg: 'bg-gray-400',
    text: 'text-gray-400',
    label: 'Low',
  };
}
