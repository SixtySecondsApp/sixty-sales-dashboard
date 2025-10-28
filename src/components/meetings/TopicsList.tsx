/**
 * TopicsList Component
 *
 * Step 1 of Content Generation workflow: Extract and select topics
 *
 * Features:
 * - "Extract Topics" button with loading state
 * - Responsive grid layout (1/2/3 columns)
 * - Multi-select checkboxes on topic cards
 * - Timestamp chips with Fathom video links
 * - Select all / Deselect all functionality
 * - "Continue to Generate" button
 * - Skeleton loaders during extraction
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Sparkles,
  CheckSquare,
  Square,
  AlertCircle,
  ExternalLink,
  ArrowRight,
} from 'lucide-react';
import { useExtractTopics, useCachedTopics } from '@/lib/services/contentService.examples';
import type { Topic } from '@/lib/services/contentService';
import { ContentServiceError } from '@/lib/services/contentService';
import { cn } from '@/lib/utils';

/**
 * Props for TopicsList component
 */
interface TopicsListProps {
  meetingId: string;
  shareUrl: string;
  onTopicsSelected: (indices: number[], topics: Topic[]) => void;
}

/**
 * Format seconds to MM:SS or HH:MM:SS
 */
function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * TopicsList Component
 * Displays extracted topics in a selectable grid
 */
export function TopicsList({
  meetingId,
  shareUrl,
  onTopicsSelected,
}: TopicsListProps) {
  // Local state for selected topic indices and topics
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);

  // Load cached topics on mount
  const { data: cachedTopics } = useCachedTopics(meetingId);

  // Fetch topics using React Query
  const {
    data: topicsData,
    isLoading,
    error,
    refetch,
  } = useExtractTopics(meetingId, false);

  // Initialize topics from cache or extraction
  useEffect(() => {
    if (topicsData?.topics && topicsData.topics.length > 0) {
      // Use freshly extracted topics
      setTopics(topicsData.topics);
    } else if (cachedTopics && cachedTopics.length > 0 && topics.length === 0) {
      // Use cached topics if no topics have been loaded yet
      setTopics(cachedTopics);
    }
  }, [topicsData?.topics, cachedTopics]);

  const hasTopics = topics.length > 0;

  /**
   * Toggle selection of a topic by index
   */
  const toggleTopic = useCallback((index: number) => {
    setSelectedIndices((prev) =>
      prev.includes(index)
        ? prev.filter((i) => i !== index)
        : [...prev, index]
    );
  }, []);

  /**
   * Select all topics
   */
  const selectAll = useCallback(() => {
    setSelectedIndices(topics.map((_, idx) => idx));
  }, [topics]);

  /**
   * Deselect all topics
   */
  const deselectAll = useCallback(() => {
    setSelectedIndices([]);
  }, []);

  /**
   * Handle extract topics button click
   */
  const handleExtract = useCallback(async () => {
    await refetch();
  }, [refetch]);

  /**
   * Handle continue to generate button click
   */
  const handleContinue = useCallback(() => {
    if (selectedIndices.length === 0) return;
    onTopicsSelected(selectedIndices, topics);
  }, [selectedIndices, topics, onTopicsSelected]);

  // Error state
  if (error) {
    const errorMessage =
      error instanceof ContentServiceError
        ? error.message
        : 'Failed to extract topics. Please try again.';

    return (
      <div className="section-card">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <p className="font-semibold">Error Extracting Topics</p>
              <p className="text-sm">{errorMessage}</p>
            </div>
          </AlertDescription>
        </Alert>
        <div className="mt-4">
          <Button onClick={handleExtract} variant="outline">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="section-card">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-blue-400" />
              Extract Content Topics
            </h2>
            <p className="text-sm text-muted-foreground">
              AI will analyze the meeting transcript and identify key discussion points
            </p>
          </div>
          {!hasTopics && (
            <Button
              onClick={handleExtract}
              disabled={isLoading}
              size="lg"
              className="shrink-0"
            >
              {isLoading ? (
                <>
                  <Sparkles className="h-4 w-4 mr-2 animate-pulse" />
                  Extracting...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Extract Topics
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Loading State: Skeleton Cards */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, idx) => (
            <div
              key={idx}
              className="glassmorphism-card p-4 space-y-3"
            >
              <Skeleton className="h-4 w-3/4 bg-gray-700" />
              <Skeleton className="h-3 w-full bg-gray-700" />
              <Skeleton className="h-3 w-5/6 bg-gray-700" />
              <Skeleton className="h-6 w-20 bg-gray-700" />
            </div>
          ))}
        </div>
      )}

      {/* Topics Grid */}
      {hasTopics && !isLoading && (
        <>
          {/* Selection Controls */}
          <div className="section-card">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {selectedIndices.length} of {topics.length} selected
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={selectAll}
                  variant="outline"
                  size="sm"
                  disabled={selectedIndices.length === topics.length}
                >
                  <CheckSquare className="h-4 w-4 mr-2" />
                  Select All
                </Button>
                <Button
                  onClick={deselectAll}
                  variant="outline"
                  size="sm"
                  disabled={selectedIndices.length === 0}
                >
                  <Square className="h-4 w-4 mr-2" />
                  Deselect All
                </Button>
                <Button
                  onClick={handleExtract}
                  variant="ghost"
                  size="sm"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Re-extract
                </Button>
              </div>
            </div>
          </div>

          {/* Topics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {topics.map((topic, idx) => {
              const isSelected = selectedIndices.includes(idx);

              return (
                <TopicCard
                  key={idx}
                  topic={topic}
                  index={idx}
                  isSelected={isSelected}
                  onToggle={() => toggleTopic(idx)}
                  shareUrl={shareUrl}
                />
              );
            })}
          </div>

          {/* Continue Button */}
          {selectedIndices.length > 0 && (
            <div className="section-card">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <p className="text-sm text-muted-foreground">
                  Ready to generate content from {selectedIndices.length} topic
                  {selectedIndices.length === 1 ? '' : 's'}
                </p>
                <Button onClick={handleContinue} size="lg">
                  Continue to Generate
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Empty State: No Topics Extracted */}
      {!hasTopics && !isLoading && !error && (
        <div className="section-card">
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Topics Yet</h3>
            <p className="text-sm text-muted-foreground max-w-md mb-6">
              Click "Extract Topics" to analyze the meeting transcript and identify
              key discussion points for content generation.
            </p>
            <Button onClick={handleExtract} disabled={isLoading}>
              <Sparkles className="h-4 w-4 mr-2" />
              Extract Topics
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Individual Topic Card Component
 */
interface TopicCardProps {
  topic: Topic;
  index: number;
  isSelected: boolean;
  onToggle: () => void;
  shareUrl: string;
}

function TopicCard({
  topic,
  index,
  isSelected,
  onToggle,
  shareUrl,
}: TopicCardProps) {
  return (
    <div
      className={cn(
        'glassmorphism-card p-4 cursor-pointer transition-all duration-200',
        'hover:scale-[1.02] hover:border-blue-500/50',
        isSelected && 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-500/5'
      )}
      onClick={onToggle}
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      aria-label={`${isSelected ? 'Deselect' : 'Select'} topic: ${topic.title}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggle();
        }
      }}
    >
      <div className="flex items-start justify-between mb-3">
        {/* Checkbox */}
        <div
          className={cn(
            'h-5 w-5 rounded border-2 flex items-center justify-center shrink-0',
            isSelected
              ? 'bg-blue-600 border-blue-600'
              : 'border-gray-600 bg-transparent'
          )}
          aria-hidden="true"
        >
          {isSelected && (
            <svg
              className="h-3 w-3 text-white"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>

        {/* Timestamp Badge */}
        <a
          href={topic.fathom_url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 ml-2"
          onClick={(e) => e.stopPropagation()}
        >
          <Badge
            variant="outline"
            className="text-xs bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border-blue-500/30 cursor-pointer transition-colors"
          >
            {formatTimestamp(topic.timestamp_seconds)}
            <ExternalLink className="h-3 w-3 ml-1" />
          </Badge>
        </a>
      </div>

      {/* Topic Content */}
      <div className="space-y-2">
        <h3 className="text-base font-semibold leading-tight">
          {topic.title}
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {topic.description}
        </p>
      </div>
    </div>
  );
}
