/**
 * MeetingContent Component
 *
 * Main container for the Content Tab feature. Coordinates topic extraction
 * and content generation workflows.
 *
 * Features:
 * - Two-step workflow (extract topics → generate content)
 * - State management for selected topics
 * - Empty state when no transcript available
 * - Error boundary for graceful error handling
 */

import React, { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { TopicsList } from './TopicsList';
import { ContentGenerator } from './ContentGenerator';
import type { Topic } from '@/lib/services/contentService';

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
 * Current workflow step
 */
type WorkflowStep = 'extract' | 'generate';

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
  const [currentStep, setCurrentStep] = useState<WorkflowStep>('extract');
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
    setCurrentStep('generate');
  };

  /**
   * Handle back navigation from step 2
   */
  const handleBack = () => {
    setCurrentStep('extract');
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
        {/* Step 1: Extract Topics */}
        {currentStep === 'extract' && (
          <TopicsList
            meetingId={meeting.id}
            shareUrl={meeting.share_url || ''}
            onTopicsSelected={handleTopicsSelected}
          />
        )}

        {/* Step 2: Generate Content */}
        {currentStep === 'generate' && (
          <ContentGenerator
            meetingId={meeting.id}
            selectedTopics={selectedTopics}
            onBack={handleBack}
          />
        )}
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
