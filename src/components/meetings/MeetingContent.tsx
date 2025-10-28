/**
 * MeetingContent Component
 *
 * Main container for the Content Tab feature. Coordinates topic extraction
 * and content generation workflows.
 *
 * Features:
 * - Three-tab layout: Topics, Generate, Library
 * - Persistent topic extraction (stored in database)
 * - Content library showing all generated content
 * - State management for selected topics
 * - Empty state when no transcript available
 * - Error boundary for graceful error handling
 */

import React, { useState } from 'react';
import { AlertCircle, FileText, Sparkles, Library } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TopicsList } from './TopicsList';
import { ContentGenerator } from './ContentGenerator';
import { ContentLibrary } from './ContentLibrary';
import { type Topic, type ContentType } from '@/lib/services/contentService';

/**
 * Props for MeetingContent component
 */
interface MeetingContentProps {
  meeting: {
    id: string;
    title: string;
    transcript_text?: string | null;
    share_url?: string;
  };
}

/**
 * Current active tab
 */
type ActiveTab = 'topics' | 'generate' | 'library';

/**
 * Selected topic with index for API communication
 */
interface SelectedTopic {
  index: number;
  topic: Topic;
}

/**
 * Main Content Tab component
 *
 * @example
 * ```tsx
 * <MeetingContent meeting={meetingData} />
 * ```
 */
export function MeetingContent({ meeting }: MeetingContentProps) {
  // State management
  const [activeTab, setActiveTab] = useState<ActiveTab>('topics');
  const [selectedTopics, setSelectedTopics] = useState<SelectedTopic[]>([]);

  /**
   * Handle topics selected in step 1
   */
  const handleTopicsSelected = (indices: number[], topics: Topic[]) => {
    const selected: SelectedTopic[] = indices.map((index) => ({
      index,
      topic: topics[index],
    }));
    setSelectedTopics(selected);
    setActiveTab('generate');
  };

  /**
   * Handle regenerate from library
   */
  const handleRegenerateFromLibrary = (contentType: ContentType) => {
    // Switch to generate tab with the content type pre-selected
    setActiveTab('generate');
  };

  // Empty state: No transcript available
  if (!meeting.transcript_text) {
    return (
      <div className="section-card">
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Transcript Not Available</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            This meeting doesn't have a transcript yet. Content generation requires
            a transcript to extract topics and create marketing materials.
          </p>
          <p className="text-xs text-muted-foreground mt-3">
            Transcripts are typically available 5-10 minutes after the meeting ends.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Error boundary wrapper */}
      <ErrorBoundary>
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ActiveTab)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="topics">
              <FileText className="h-4 w-4 mr-2" />
              Topics
            </TabsTrigger>
            <TabsTrigger value="generate" disabled={selectedTopics.length === 0}>
              <Sparkles className="h-4 w-4 mr-2" />
              Generate
            </TabsTrigger>
            <TabsTrigger value="library">
              <Library className="h-4 w-4 mr-2" />
              Library
            </TabsTrigger>
          </TabsList>

          {/* Topics Tab */}
          <TabsContent value="topics" className="mt-6">
            <TopicsList
              meetingId={meeting.id}
              shareUrl={meeting.share_url || ''}
              onTopicsSelected={handleTopicsSelected}
            />
          </TabsContent>

          {/* Generate Tab */}
          <TabsContent value="generate" className="mt-6">
            {selectedTopics.length > 0 ? (
              <ContentGenerator
                meetingId={meeting.id}
                selectedTopics={selectedTopics}
                onBack={() => setActiveTab('topics')}
              />
            ) : (
              <div className="section-card text-center py-12">
                <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Select Topics First</h3>
                <p className="text-sm text-muted-foreground">
                  Go to the Topics tab, extract topics, and select the ones you want to use for
                  content generation.
                </p>
              </div>
            )}
          </TabsContent>

          {/* Library Tab */}
          <TabsContent value="library" className="mt-6">
            <ContentLibrary
              meetingId={meeting.id}
              onRegenerateClick={handleRegenerateFromLibrary}
            />
          </TabsContent>
        </Tabs>
      </ErrorBoundary>
    </div>
  );
}

/**
 * Error Boundary Component
 * Catches and displays errors gracefully
 */
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Content Tab Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="section-card">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-semibold">Something went wrong</p>
                <p className="text-sm">
                  {this.state.error?.message || 'An unexpected error occurred'}
                </p>
                <button
                  onClick={() => this.setState({ hasError: false, error: null })}
                  className="text-sm underline hover:no-underline"
                >
                  Try again
                </button>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      );
    }

    return this.props.children;
  }
}
