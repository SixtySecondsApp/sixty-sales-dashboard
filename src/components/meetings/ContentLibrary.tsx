/**
 * ContentLibrary Component
 *
 * Displays all previously generated content for a meeting in an organized list.
 * Features:
 * - View all generated content (social, blog, video, email)
 * - Download content as markdown or text
 * - Copy content to clipboard
 * - Regenerate content
 * - Filter by content type
 */

import React, { useState } from 'react';
import { Download, Copy, RefreshCw, FileText, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { contentService, type GeneratedContent, type ContentType } from '@/lib/services/contentService';

interface ContentLibraryProps {
  meetingId: string;
  onRegenerateClick?: (contentType: ContentType) => void;
}

const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  social: 'Social Media',
  blog: 'Blog Post',
  video: 'Video Script',
  email: 'Email Newsletter',
};

const CONTENT_TYPE_COLORS: Record<ContentType, string> = {
  social: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  blog: 'bg-purple-500/10 text-purple-700 dark:text-purple-400',
  video: 'bg-orange-500/10 text-orange-700 dark:text-orange-400',
  email: 'bg-green-500/10 text-green-700 dark:text-green-400',
};

export function ContentLibrary({ meetingId, onRegenerateClick }: ContentLibraryProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<ContentType | 'all'>('all');

  // Fetch all generated content
  const { data: allContent, isLoading, error, refetch } = useQuery({
    queryKey: ['generated-content-library', meetingId],
    queryFn: () => contentService.getAllGeneratedContent(meetingId),
    enabled: !!meetingId,
    staleTime: 30 * 1000, // 30 seconds
  });

  /**
   * Download content as a file
   */
  const handleDownload = (content: GeneratedContent, format: 'md' | 'txt') => {
    const blob = new Blob([content.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${content.title || `${content.content_type}-content`}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  /**
   * Copy content to clipboard
   */
  const handleCopy = async (content: GeneratedContent) => {
    try {
      await navigator.clipboard.writeText(content.content);
      setCopiedId(content.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  /**
   * Filter content by type
   */
  const filteredContent = allContent?.filter((item) =>
    filterType === 'all' ? true : item.content_type === filterType
  );

  // Loading state
  if (isLoading) {
    return (
      <div className="section-card">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-3 text-muted-foreground">Loading content library...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="section-card">
        <div className="text-center py-12 px-4">
          <p className="text-destructive mb-2">Failed to load content library</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  // Empty state
  if (!allContent || allContent.length === 0) {
    return (
      <div className="section-card">
        <div className="text-center py-12 px-4">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Content Yet</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Generated content will appear here. Extract topics and generate your first piece of
            content to get started.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with filters */}
      <div className="section-card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold">Content Library</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {filteredContent?.length || 0} {filteredContent?.length === 1 ? 'item' : 'items'}{' '}
              {filterType !== 'all' && `(${CONTENT_TYPE_LABELS[filterType]})`}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Content type filters */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant={filterType === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterType('all')}
          >
            All ({allContent.length})
          </Button>
          {(['social', 'blog', 'video', 'email'] as ContentType[]).map((type) => {
            const count = allContent.filter((item) => item.content_type === type).length;
            if (count === 0) return null;
            return (
              <Button
                key={type}
                variant={filterType === type ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterType(type)}
              >
                {CONTENT_TYPE_LABELS[type]} ({count})
              </Button>
            );
          })}
        </div>
      </div>

      {/* Content list */}
      <div className="space-y-4">
        {filteredContent?.map((content) => (
          <Card key={content.id} className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Badge className={CONTENT_TYPE_COLORS[content.content_type]}>
                    {CONTENT_TYPE_LABELS[content.content_type]}
                  </Badge>
                  <span className="text-xs text-muted-foreground">v{content.version}</span>
                </div>
                <h3 className="text-lg font-semibold">{content.title || 'Untitled Content'}</h3>
              </div>
            </div>

            {/* Content preview */}
            <div className="bg-muted/30 rounded-lg p-4 mb-4 max-h-48 overflow-y-auto">
              <pre className="text-sm whitespace-pre-wrap font-mono">
                {content.content.length > 500
                  ? content.content.substring(0, 500) + '...'
                  : content.content}
              </pre>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopy(content)}
                disabled={copiedId === content.id}
              >
                {copiedId === content.id ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDownload(content, 'md')}
              >
                <Download className="h-4 w-4 mr-2" />
                Download MD
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDownload(content, 'txt')}
              >
                <Download className="h-4 w-4 mr-2" />
                Download TXT
              </Button>
              {onRegenerateClick && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onRegenerateClick(content.content_type)}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Regenerate
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
