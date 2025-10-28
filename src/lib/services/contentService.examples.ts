/**
 * Content Service - Usage Examples
 *
 * This file demonstrates how to use the contentService in React components
 * with React Query for optimal caching and state management.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { contentService, ContentServiceError } from './contentService';
import type { ContentType, GenerateContentParams } from './contentService';

// ============================================================================
// React Query Hook Examples
// ============================================================================

/**
 * Example 1: Extract Topics with React Query
 *
 * Usage in a component:
 * ```tsx
 * function TopicsPanel({ meetingId }) {
 *   const { data, isLoading, error } = useExtractTopics(meetingId);
 *
 *   if (isLoading) return <div>Loading topics...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *
 *   return (
 *     <div>
 *       {data?.topics.map((topic, idx) => (
 *         <div key={idx}>{topic.title}</div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useExtractTopics(meetingId: string, forceRefresh = false) {
  return useQuery({
    queryKey: ['content-topics', meetingId, forceRefresh],
    queryFn: () => contentService.extractTopics(meetingId, forceRefresh),
    enabled: false, // Changed to false - only run when manually triggered via refetch()
    staleTime: forceRefresh ? 0 : 5 * 60 * 1000, // 5 minutes for cached, 0 for forced
    retry: (failureCount, error) => {
      // Don't retry on client errors (4xx)
      if (error instanceof ContentServiceError && error.status >= 400 && error.status < 500) {
        return false;
      }
      return failureCount < 2;
    },
  });
}

/**
 * Example 2: Generate Content with Mutation
 *
 * Usage in a component:
 * ```tsx
 * function ContentGenerator({ meetingId }) {
 *   const generateMutation = useGenerateContent();
 *
 *   const handleGenerate = async () => {
 *     try {
 *       const result = await generateMutation.mutateAsync({
 *         meeting_id: meetingId,
 *         content_type: 'social',
 *         selected_topic_indices: [0, 1, 2],
 *       });
 *       console.log('Generated:', result.content);
 *     } catch (error) {
 *       console.error('Failed:', error.message);
 *     }
 *   };
 *
 *   return (
 *     <button
 *       onClick={handleGenerate}
 *       disabled={generateMutation.isPending}
 *     >
 *       {generateMutation.isPending ? 'Generating...' : 'Generate Content'}
 *     </button>
 *   );
 * }
 * ```
 */
export function useGenerateContent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: GenerateContentParams) =>
      contentService.generateContent(params),
    onSuccess: (data, variables) => {
      // Invalidate cached content to refetch
      queryClient.invalidateQueries({
        queryKey: ['cached-content', variables.meeting_id, variables.content_type],
      });
    },
  });
}

/**
 * Example 3: Get Cached Topics
 *
 * Usage in a component:
 * ```tsx
 * function CachedTopicsLoader({ meetingId }) {
 *   const { data: topics } = useCachedTopics(meetingId);
 *
 *   return (
 *     <div>
 *       {topics && topics.length > 0 ? (
 *         <div>Found {topics.length} cached topics</div>
 *       ) : (
 *         <div>No cached topics available</div>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useCachedTopics(meetingId: string) {
  return useQuery({
    queryKey: ['cached-topics', meetingId],
    queryFn: () => contentService.getCachedTopics(meetingId),
    enabled: !!meetingId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Example 4: Get Cached Content
 *
 * Usage in a component:
 * ```tsx
 * function ContentPreview({ meetingId, contentType }) {
 *   const { data: content, isLoading } = useCachedContent(meetingId, contentType);
 *
 *   if (isLoading) return <div>Loading...</div>;
 *
 *   return (
 *     <div>
 *       {content ? (
 *         <div>
 *           <h3>{content.title}</h3>
 *           <div dangerouslySetInnerHTML={{ __html: content.content }} />
 *         </div>
 *       ) : (
 *         <div>No cached content</div>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useCachedContent(meetingId: string, contentType: ContentType) {
  return useQuery({
    queryKey: ['cached-content', meetingId, contentType],
    queryFn: () => contentService.getCachedContent(meetingId, contentType),
    enabled: !!meetingId && !!contentType,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Example 5: Calculate Costs
 *
 * Usage in a component:
 * ```tsx
 * function CostDisplay({ meetingId }) {
 *   const { data: costs } = useCosts(meetingId);
 *
 *   if (!costs) return null;
 *
 *   return (
 *     <div>
 *       <div>Total: {contentService.formatCost(costs.total_cost_cents)}</div>
 *       <div>Operations: {costs.operations_count}</div>
 *       <div>Tokens: {costs.total_tokens}</div>
 *     </div>
 *   );
 * }
 * ```
 */
export function useCosts(meetingId: string) {
  return useQuery({
    queryKey: ['content-costs', meetingId],
    queryFn: () => contentService.calculateCosts(meetingId),
    enabled: !!meetingId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Example 6: Check Transcript Availability
 *
 * Usage in a component:
 * ```tsx
 * function TranscriptChecker({ meetingId }) {
 *   const { data: hasTranscript } = useHasTranscript(meetingId);
 *
 *   return (
 *     <div>
 *       {hasTranscript ? (
 *         <button>Extract Topics</button>
 *       ) : (
 *         <div>Transcript not available yet</div>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useHasTranscript(meetingId: string) {
  return useQuery({
    queryKey: ['has-transcript', meetingId],
    queryFn: () => contentService.hasTranscript(meetingId),
    enabled: !!meetingId,
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}

// ============================================================================
// Complete Component Example
// ============================================================================

/**
 * Example 7: Full Content Tab Component
 *
 * ```tsx
 * import React, { useState } from 'react';
 * import {
 *   useExtractTopics,
 *   useGenerateContent,
 *   useCachedContent,
 *   useCosts,
 * } from '@/lib/services/contentService.examples';
 *
 * export function ContentTab({ meetingId }: { meetingId: string }) {
 *   const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
 *   const [contentType, setContentType] = useState<ContentType>('social');
 *
 *   // Fetch topics
 *   const {
 *     data: topicsData,
 *     isLoading: topicsLoading,
 *     error: topicsError,
 *     refetch: refetchTopics,
 *   } = useExtractTopics(meetingId);
 *
 *   // Generate content mutation
 *   const generateMutation = useGenerateContent();
 *
 *   // Cached content
 *   const { data: cachedContent } = useCachedContent(meetingId, contentType);
 *
 *   // Costs
 *   const { data: costs } = useCosts(meetingId);
 *
 *   const handleExtractTopics = async () => {
 *     await refetchTopics();
 *   };
 *
 *   const handleGenerateContent = async () => {
 *     if (selectedIndices.length === 0) {
 *       alert('Please select at least one topic');
 *       return;
 *     }
 *
 *     try {
 *       await generateMutation.mutateAsync({
 *         meeting_id: meetingId,
 *         content_type: contentType,
 *         selected_topic_indices: selectedIndices,
 *       });
 *       alert('Content generated successfully!');
 *     } catch (error) {
 *       if (error instanceof ContentServiceError) {
 *         alert(error.message);
 *       } else {
 *         alert('Failed to generate content');
 *       }
 *     }
 *   };
 *
 *   const toggleTopicSelection = (index: number) => {
 *     setSelectedIndices((prev) =>
 *       prev.includes(index)
 *         ? prev.filter((i) => i !== index)
 *         : [...prev, index]
 *     );
 *   };
 *
 *   return (
 *     <div className="content-tab">
 *       {/* Header * /}
 *       <div className="header">
 *         <h2>Content Generation</h2>
 *         {costs && (
 *           <div className="costs">
 *             Total Cost: {contentService.formatCost(costs.total_cost_cents)}
 *           </div>
 *         )}
 *       </div>
 *
 *       {/* Topics Section * /}
 *       <div className="topics-section">
 *         <button
 *           onClick={handleExtractTopics}
 *           disabled={topicsLoading}
 *         >
 *           {topicsLoading ? 'Extracting...' : 'Extract Topics'}
 *         </button>
 *
 *         {topicsError && (
 *           <div className="error">
 *             Error: {topicsError.message}
 *           </div>
 *         )}
 *
 *         {topicsData?.topics.map((topic, idx) => (
 *           <div
 *             key={idx}
 *             className={`topic ${selectedIndices.includes(idx) ? 'selected' : ''}`}
 *             onClick={() => toggleTopicSelection(idx)}
 *           >
 *             <h3>{topic.title}</h3>
 *             <p>{topic.description}</p>
 *             <a href={topic.fathom_url} target="_blank" rel="noopener noreferrer">
 *               View at {topic.timestamp_seconds}s
 *             </a>
 *           </div>
 *         ))}
 *       </div>
 *
 *       {/* Content Type Selection * /}
 *       <div className="content-type-selector">
 *         {(['social', 'blog', 'video', 'email'] as ContentType[]).map((type) => (
 *           <button
 *             key={type}
 *             onClick={() => setContentType(type)}
 *             className={contentType === type ? 'active' : ''}
 *           >
 *             {type.charAt(0).toUpperCase() + type.slice(1)}
 *           </button>
 *         ))}
 *       </div>
 *
 *       {/* Generate Button * /}
 *       <button
 *         onClick={handleGenerateContent}
 *         disabled={generateMutation.isPending || selectedIndices.length === 0}
 *       >
 *         {generateMutation.isPending ? 'Generating...' : 'Generate Content'}
 *       </button>
 *
 *       {/* Generated Content Preview * /}
 *       {cachedContent && (
 *         <div className="content-preview">
 *           <h3>{cachedContent.title}</h3>
 *           <div className="markdown-content">
 *             {cachedContent.content}
 *           </div>
 *         </div>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */

// ============================================================================
// Error Handling Examples
// ============================================================================

/**
 * Example 8: Advanced Error Handling
 *
 * ```tsx
 * function ContentGenerator({ meetingId }) {
 *   const generateMutation = useGenerateContent();
 *
 *   const handleGenerate = async () => {
 *     try {
 *       const result = await generateMutation.mutateAsync({
 *         meeting_id: meetingId,
 *         content_type: 'social',
 *         selected_topic_indices: [0, 1],
 *       });
 *       toast.success('Content generated successfully!');
 *     } catch (error) {
 *       if (error instanceof ContentServiceError) {
 *         // Handle specific error types
 *         switch (error.status) {
 *           case 401:
 *             toast.error('Please log in to continue');
 *             // Redirect to login
 *             break;
 *           case 422:
 *             toast.error("This meeting doesn't have a transcript yet");
 *             break;
 *           case 429:
 *             toast.error('Too many requests. Please wait a moment.');
 *             break;
 *           default:
 *             toast.error(error.message);
 *         }
 *
 *         // Log details for debugging
 *         console.error('Error details:', error.details);
 *       } else {
 *         toast.error('An unexpected error occurred');
 *       }
 *     }
 *   };
 * }
 * ```
 */

// ============================================================================
// Direct Service Usage (without React Query)
// ============================================================================

/**
 * Example 9: Direct Service Usage
 *
 * For non-React contexts or when you need more control:
 */
export async function directUsageExample(meetingId: string) {
  try {
    // Check if transcript exists first
    const hasTranscript = await contentService.hasTranscript(meetingId);
    if (!hasTranscript) {
      console.log('No transcript available');
      return;
    }

    // Extract topics
    console.log('Extracting topics...');
    const topicsResult = await contentService.extractTopics(meetingId);
    console.log('Topics extracted:', topicsResult.topics.length);
    console.log('Cached:', topicsResult.metadata.cached);
    console.log('Cost:', contentService.formatCost(topicsResult.metadata.cost_cents));

    // Check for cached content
    const cachedSocial = await contentService.getCachedContent(meetingId, 'social');
    if (cachedSocial) {
      console.log('Found cached social content:', cachedSocial.title);
    }

    // Generate new content
    console.log('Generating blog content...');
    const contentResult = await contentService.generateContent({
      meeting_id: meetingId,
      content_type: 'blog',
      selected_topic_indices: [0, 1, 2],
      regenerate: false,
    });
    console.log('Content generated:', contentResult.content.title);
    console.log('Cost:', contentService.formatCost(contentResult.metadata.cost_cents));

    // Calculate total costs
    const costs = await contentService.calculateCosts(meetingId);
    console.log('Total costs:', contentService.formatCost(costs.total_cost_cents));
    console.log('Total operations:', costs.operations_count);
    console.log('Breakdown:', costs.breakdown);

    return {
      topics: topicsResult.topics,
      content: contentResult.content,
      costs,
    };
  } catch (error) {
    if (error instanceof ContentServiceError) {
      console.error('Content service error:', {
        message: error.message,
        status: error.status,
        details: error.details,
      });
    } else {
      console.error('Unexpected error:', error);
    }
    throw error;
  }
}

// ============================================================================
// Testing Examples
// ============================================================================

/**
 * Example 10: Testing with Mock Data
 *
 * ```typescript
 * import { vi } from 'vitest';
 * import { contentService } from './contentService';
 *
 * describe('ContentService', () => {
 *   it('should extract topics successfully', async () => {
 *     const result = await contentService.extractTopics('test-meeting-id');
 *     expect(result.success).toBe(true);
 *     expect(Array.isArray(result.topics)).toBe(true);
 *   });
 *
 *   it('should handle missing transcript error', async () => {
 *     await expect(
 *       contentService.extractTopics('no-transcript-meeting')
 *     ).rejects.toThrow(ContentServiceError);
 *   });
 * });
 * ```
 */
