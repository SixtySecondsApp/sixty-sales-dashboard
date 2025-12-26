import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  GitBranch,
  Loader2,
  RefreshCw,
  ExternalLink,
  ArrowRight,
  ArrowDown,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase/clientV2';
import { MermaidRenderer } from './MermaidRenderer';
import { useProcessMap } from '@/lib/hooks/useProcessMap';
import type { ProcessType, ProcessName } from './ProcessMapButton';

interface ProcessMapDisplayProps {
  processType: ProcessType;
  processName: ProcessName;
  /** Title shown in the card header */
  title?: string;
  /** Description shown below the title */
  description?: string;
  /** Show the direction toggle (H/V) */
  showDirectionToggle?: boolean;
  /** Default view direction */
  defaultDirection?: 'horizontal' | 'vertical';
  /** Show controls on the MermaidRenderer */
  showControls?: boolean;
  /** Show code toggle on the MermaidRenderer */
  showCode?: boolean;
  /** Callback when a process map is generated/regenerated */
  onGenerated?: () => void;
  /** Additional className for the card */
  className?: string;
}

/**
 * ProcessMapDisplay component that shows an existing process map from the database,
 * or provides a prompt to generate one if it doesn't exist.
 *
 * Use this on pages where you want to display the "most up-to-date" process map
 * without requiring the user to click a button to see it.
 */
export function ProcessMapDisplay({
  processType,
  processName,
  title,
  description,
  showDirectionToggle = true,
  defaultDirection = 'vertical',
  showControls = true,
  showCode = false,
  onGenerated,
  className,
}: ProcessMapDisplayProps) {
  const navigate = useNavigate();
  const { processMap, loading, error, refetch, exists, isComplete, getMermaidCode } = useProcessMap({
    processType,
    processName,
  });

  const [generating, setGenerating] = useState(false);
  const [activeDirection, setActiveDirection] = useState<'horizontal' | 'vertical'>(defaultDirection);

  const formatProcessTitle = useCallback(() => {
    const formattedName = processName
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    return title || `${formattedName} Process Map`;
  }, [processName, title]);

  const handleGenerate = useCallback(
    async (regenerate = false) => {
      setGenerating(true);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData?.session?.access_token) {
          toast.error('Please sign in to generate process maps');
          return;
        }

        const response = await supabase.functions.invoke('generate-process-map', {
          body: {
            processType,
            processName,
            regenerate,
          },
        });

        if (response.error) {
          throw new Error(response.error.message || 'Failed to generate process map');
        }

        const data = response.data;
        if (data?.processMap) {
          const status = data.generationStatus === 'complete'
            ? 'Process map generated (both views)'
            : 'Process map generated (partial - one view)';
          toast.success(regenerate ? 'Process map regenerated' : status);
          await refetch();
          onGenerated?.();
        } else {
          throw new Error('No process map returned');
        }
      } catch (err) {
        console.error('Error generating process map:', err);
        toast.error(err instanceof Error ? err.message : 'Failed to generate process map');
      } finally {
        setGenerating(false);
      }
    },
    [processType, processName, refetch, onGenerated]
  );

  const handleViewAll = useCallback(() => {
    navigate('/platform/process-maps');
  }, [navigate]);

  // Get current mermaid code based on direction
  const currentMermaidCode = getMermaidCode(activeDirection);
  const hasHorizontalView = processMap?.mermaid_code_horizontal != null;
  const hasVerticalView = processMap?.mermaid_code_vertical != null;

  // Loading state
  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Loading process map...</span>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className={className}>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle className="h-8 w-8 text-amber-500 mb-2" />
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <Button variant="outline" size="sm" onClick={refetch}>
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  // No process map exists - show generation prompt
  if (!exists) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-muted-foreground" />
            {formatProcessTitle()}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <div className="rounded-full bg-muted p-4 mb-4">
            <Sparkles className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground mb-1">
            No process map generated yet
          </p>
          <p className="text-xs text-muted-foreground mb-4">
            Generate an AI-powered visualization of the {processName.replace(/_/g, ' ')} workflow
          </p>
          <div className="flex items-center gap-2">
            <Button onClick={() => handleGenerate(false)} disabled={generating}>
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-1.5" />
                  Generate Process Map
                </>
              )}
            </Button>
            <Button variant="outline" size="sm" onClick={handleViewAll}>
              <ExternalLink className="h-4 w-4 mr-1.5" />
              View All Maps
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Process map exists - display it
  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <GitBranch className="h-5 w-5 text-emerald-500" />
              {processMap?.title || formatProcessTitle()}
            </CardTitle>
            {(description || processMap?.description) && (
              <p className="text-sm text-muted-foreground mt-1">
                {description || processMap?.description}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Status badge */}
            {processMap?.generation_status === 'partial' && (
              <Badge variant="outline" className="text-amber-600 border-amber-300">
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                Processing...
              </Badge>
            )}
            {isComplete && (
              <Badge variant="outline" className="text-emerald-600 border-emerald-300">
                Complete
              </Badge>
            )}

            {/* Direction toggle */}
            {showDirectionToggle && (
              <div className="flex items-center border rounded-md">
                <Button
                  variant={activeDirection === 'horizontal' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setActiveDirection('horizontal')}
                  disabled={!hasHorizontalView}
                  className="rounded-r-none gap-1 px-2 h-7"
                  title={hasHorizontalView ? 'Horizontal flow' : 'Not available'}
                >
                  <ArrowRight className="h-3 w-3" />
                  <span className="text-xs">H</span>
                  {hasHorizontalView && <span className="w-1.5 h-1.5 rounded-full bg-green-500 ml-0.5" />}
                </Button>
                <Button
                  variant={activeDirection === 'vertical' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setActiveDirection('vertical')}
                  disabled={!hasVerticalView}
                  className="rounded-l-none gap-1 px-2 h-7"
                  title={hasVerticalView ? 'Vertical flow' : 'Not available'}
                >
                  <ArrowDown className="h-3 w-3" />
                  <span className="text-xs">V</span>
                  {hasVerticalView && <span className="w-1.5 h-1.5 rounded-full bg-green-500 ml-0.5" />}
                </Button>
              </div>
            )}

            {/* Regenerate button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleGenerate(true)}
              disabled={generating}
            >
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>

            {/* View all maps */}
            <Button variant="outline" size="sm" onClick={handleViewAll}>
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {currentMermaidCode ? (
          <MermaidRenderer
            code={currentMermaidCode}
            title={processMap?.title || formatProcessTitle()}
            description={processMap?.description || undefined}
            showControls={showControls}
            showCode={showCode}
          />
        ) : (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <AlertCircle className="h-5 w-5 mr-2" />
            No diagram available for this view
          </div>
        )}

        {/* Footer info */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t text-xs text-muted-foreground">
          <span>
            Version {processMap?.version} &middot; Updated{' '}
            {processMap?.updated_at
              ? new Date(processMap.updated_at).toLocaleDateString()
              : '—'}
          </span>
          <span className="capitalize">
            {activeDirection} flow
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export default ProcessMapDisplay;
