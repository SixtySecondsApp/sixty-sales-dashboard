/**
 * SourceMeetingsPanel Component
 *
 * Side panel showing source meetings for a selected global topic
 * Features:
 * - List of source meetings with details
 * - Fathom video links with timestamps
 * - Company and contact info
 * - Content generation button
 * - Close button
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  X,
  ExternalLink,
  Calendar,
  Building2,
  User,
  Play,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import { useTopicSources } from '@/lib/hooks/useGlobalTopics';
import type { GlobalTopic, TopicSourceMeeting } from '@/lib/services/globalTopicsService';
import { formatDistanceToNow, format } from 'date-fns';
import { cn } from '@/lib/utils';

interface SourceMeetingsPanelProps {
  topic: GlobalTopic;
  onClose: () => void;
}

export function SourceMeetingsPanel({ topic, onClose }: SourceMeetingsPanelProps) {
  const { data: sources, isLoading } = useTopicSources(topic.id, 20, 0);

  return (
    <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm sticky top-4 border-emerald-200 dark:border-emerald-800">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg leading-tight">
              {topic.canonical_title}
            </CardTitle>
            {topic.canonical_description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {topic.canonical_description}
              </p>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="shrink-0">
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Topic stats */}
        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <Badge variant="secondary">
            {topic.source_count} sources
          </Badge>
          <Badge variant="outline">
            {topic.meeting_count} meetings
          </Badge>
          <span className="text-xs text-muted-foreground ml-auto">
            {Math.round(topic.relevance_score * 100)}% relevance
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Generate content button */}
        <Button className="w-full" size="sm">
          <Sparkles className="w-4 h-4 mr-2" />
          Generate Content from Topic
          <ChevronRight className="w-4 h-4 ml-auto" />
        </Button>

        {/* Source meetings list */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-muted-foreground">
            Source Meetings
          </h4>

          {isLoading ? (
            <SourceMeetingsSkeleton />
          ) : sources && sources.length > 0 ? (
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
              {sources.map((source, idx) => (
                <SourceMeetingItem key={idx} source={source} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No source meetings found
            </p>
          )}
        </div>

        {/* Companies mentioned */}
        {topic.companies.length > 0 && (
          <div className="space-y-2 pt-3 border-t border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-semibold text-muted-foreground">
              Companies
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {topic.companies.map((company, idx) => (
                <Badge
                  key={idx}
                  variant="outline"
                  className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800"
                >
                  <Building2 className="w-2.5 h-2.5 mr-1" />
                  {company}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface SourceMeetingItemProps {
  source: TopicSourceMeeting;
}

function SourceMeetingItem({ source }: SourceMeetingItemProps) {
  const meetingDate = new Date(source.meeting_date);
  const timeAgo = formatDistanceToNow(meetingDate, { addSuffix: true });

  return (
    <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900/50 space-y-2">
      {/* Meeting title and link */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h5 className="text-sm font-medium truncate">
            {source.meeting_title}
          </h5>
          <p className="text-xs text-muted-foreground">
            {format(meetingDate, 'MMM d, yyyy')} ({timeAgo})
          </p>
        </div>
        {source.fathom_url && (
          <a
            href={source.fathom_url}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <Badge
              variant="outline"
              className="cursor-pointer hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors"
            >
              <Play className="w-3 h-3 mr-1" />
              {formatTimestamp(source.timestamp_seconds || 0)}
              <ExternalLink className="w-3 h-3 ml-1" />
            </Badge>
          </a>
        )}
      </div>

      {/* Topic title from this meeting */}
      <p className="text-xs text-muted-foreground italic">
        "{source.topic_title}"
      </p>

      {/* Company and contact */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        {source.company_name && (
          <div className="flex items-center gap-1">
            <Building2 className="w-3 h-3" />
            <span>{source.company_name}</span>
          </div>
        )}
        {source.contact_name && (
          <div className="flex items-center gap-1">
            <User className="w-3 h-3" />
            <span>{source.contact_name}</span>
          </div>
        )}
      </div>

      {/* Similarity score */}
      {source.similarity_score > 0 && (
        <div className="flex items-center justify-end">
          <span className="text-xs text-muted-foreground">
            {Math.round(source.similarity_score * 100)}% match
          </span>
        </div>
      )}
    </div>
  );
}

// Format seconds to timestamp
function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Skeleton loaders
function SourceMeetingsSkeleton() {
  return (
    <div className="space-y-2">
      {[...Array(3)].map((_, idx) => (
        <div key={idx} className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900/50 space-y-2">
          <div className="flex items-start justify-between">
            <div className="space-y-1 flex-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-6 w-16" />
          </div>
          <Skeleton className="h-3 w-full" />
          <div className="flex gap-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}
