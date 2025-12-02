/**
 * TopicsExplorer Component
 *
 * Main display for global topics with multiple view modes
 * Features:
 * - Grid view: Card-based layout
 * - List view: Compact table-like layout
 * - Cluster view: Grouped by similarity
 * - Pagination
 * - Empty state
 * - Loading skeletons
 */

import React, { useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, ChevronRight, Layers } from 'lucide-react';
import type { GlobalTopic, PaginationInfo } from '@/lib/services/globalTopicsService';
import { GlobalTopicCard } from './GlobalTopicCard';
import { SourceMeetingsPanel } from './SourceMeetingsPanel';
import { cn } from '@/lib/utils';

type ViewMode = 'grid' | 'list' | 'clusters';

interface TopicsExplorerProps {
  topics: GlobalTopic[];
  viewMode: ViewMode;
  isLoading: boolean;
  pagination?: PaginationInfo;
  onPageChange: (page: number) => void;
}

export function TopicsExplorer({
  topics,
  viewMode,
  isLoading,
  pagination,
  onPageChange,
}: TopicsExplorerProps) {
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<GlobalTopic | null>(null);

  // Handle topic selection
  const handleTopicSelect = useCallback((topic: GlobalTopic) => {
    if (selectedTopicId === topic.id) {
      setSelectedTopicId(null);
      setSelectedTopic(null);
    } else {
      setSelectedTopicId(topic.id);
      setSelectedTopic(topic);
    }
  }, [selectedTopicId]);

  // Close source panel
  const handleCloseSourcePanel = useCallback(() => {
    setSelectedTopicId(null);
    setSelectedTopic(null);
  }, []);

  // Loading state
  if (isLoading && topics.length === 0) {
    return <TopicsSkeletons viewMode={viewMode} />;
  }

  // Empty state
  if (!isLoading && topics.length === 0) {
    return (
      <Card className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm">
        <CardContent className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-4">
            <Layers className="w-8 h-8 text-emerald-500" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No Topics Found</h3>
          <p className="text-sm text-muted-foreground max-w-md mb-4">
            No global topics have been aggregated yet. Topics are automatically
            extracted from meeting transcripts and clustered by semantic similarity.
          </p>
          <p className="text-xs text-muted-foreground">
            Click "Refresh Topics" to aggregate topics from your meetings.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Group topics by similarity score ranges for cluster view
  const clusterGroups = viewMode === 'clusters' ? groupTopicsByClusters(topics) : null;

  return (
    <div className="space-y-6">
      <div className="flex gap-6">
        {/* Topics Grid/List */}
        <div className={cn('flex-1', selectedTopicId && 'lg:max-w-[60%]')}>
          {viewMode === 'grid' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {topics.map((topic) => (
                <GlobalTopicCard
                  key={topic.id}
                  topic={topic}
                  isSelected={selectedTopicId === topic.id}
                  onClick={() => handleTopicSelect(topic)}
                  viewMode="grid"
                />
              ))}
            </div>
          )}

          {viewMode === 'list' && (
            <div className="space-y-2">
              {topics.map((topic) => (
                <GlobalTopicCard
                  key={topic.id}
                  topic={topic}
                  isSelected={selectedTopicId === topic.id}
                  onClick={() => handleTopicSelect(topic)}
                  viewMode="list"
                />
              ))}
            </div>
          )}

          {viewMode === 'clusters' && clusterGroups && (
            <div className="space-y-8">
              {clusterGroups.map((cluster, idx) => (
                <div key={idx} className="space-y-4">
                  <div className="flex items-center gap-3">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      {cluster.label}
                    </h3>
                    <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                    <span className="text-xs text-muted-foreground">
                      {cluster.topics.length} topics
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {cluster.topics.map((topic) => (
                      <GlobalTopicCard
                        key={topic.id}
                        topic={topic}
                        isSelected={selectedTopicId === topic.id}
                        onClick={() => handleTopicSelect(topic)}
                        viewMode="grid"
                        compact
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Source Meetings Panel */}
        {selectedTopicId && selectedTopic && (
          <div className="hidden lg:block w-[40%]">
            <SourceMeetingsPanel
              topic={selectedTopic}
              onClose={handleCloseSourcePanel}
            />
          </div>
        )}
      </div>

      {/* Mobile Source Panel */}
      {selectedTopicId && selectedTopic && (
        <div className="lg:hidden">
          <SourceMeetingsPanel
            topic={selectedTopic}
            onClose={handleCloseSourcePanel}
          />
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.total_pages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(pagination.page - 1)}
            disabled={!pagination.has_prev}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.total_pages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(pagination.page + 1)}
            disabled={!pagination.has_next}
          >
            Next
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}

// Helper function to group topics by relevance clusters
function groupTopicsByClusters(topics: GlobalTopic[]) {
  const highRelevance = topics.filter((t) => t.relevance_score >= 0.7);
  const mediumRelevance = topics.filter(
    (t) => t.relevance_score >= 0.4 && t.relevance_score < 0.7
  );
  const lowRelevance = topics.filter((t) => t.relevance_score < 0.4);

  const clusters = [];

  if (highRelevance.length > 0) {
    clusters.push({
      label: 'High Relevance',
      topics: highRelevance,
      color: 'emerald',
    });
  }

  if (mediumRelevance.length > 0) {
    clusters.push({
      label: 'Medium Relevance',
      topics: mediumRelevance,
      color: 'blue',
    });
  }

  if (lowRelevance.length > 0) {
    clusters.push({
      label: 'Lower Relevance',
      topics: lowRelevance,
      color: 'gray',
    });
  }

  return clusters;
}

// Skeleton loaders
function TopicsSkeletons({ viewMode }: { viewMode: ViewMode }) {
  const count = viewMode === 'list' ? 8 : 6;

  if (viewMode === 'list') {
    return (
      <div className="space-y-2">
        {[...Array(count)].map((_, idx) => (
          <Card key={idx} className="bg-white/50 dark:bg-gray-800/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
                <div className="flex-1" />
                <Skeleton className="h-6 w-16" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {[...Array(count)].map((_, idx) => (
        <Card key={idx} className="bg-white/50 dark:bg-gray-800/50">
          <CardContent className="p-4 space-y-3">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <div className="flex gap-2 pt-2">
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-6 w-20" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
