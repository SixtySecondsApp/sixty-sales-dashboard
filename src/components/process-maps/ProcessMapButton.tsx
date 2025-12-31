import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { GitBranch, Loader2, ExternalLink, RefreshCw, ArrowRight, ArrowDown } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase/clientV2';
import { MermaidRenderer } from './MermaidRenderer';

export type ProcessType = 'integration' | 'workflow';
export type ProcessName =
  | 'hubspot'
  | 'google'
  | 'fathom'
  | 'slack'
  | 'justcall'
  | 'savvycal'
  | 'meeting_intelligence'
  | 'task_extraction'
  | 'vsl_analytics'
  | 'sentry_bridge'
  | 'api_optimization'
  | 'onboarding_v2';

interface ProcessMapButtonProps {
  processType: ProcessType;
  processName: ProcessName;
  variant?: 'default' | 'ghost' | 'outline' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  showLabel?: boolean;
  label?: string;
  onGenerated?: () => void;
}

interface ProcessMap {
  id: string;
  title: string;
  description: string | null;
  mermaid_code: string;
  mermaid_code_horizontal: string | null;
  mermaid_code_vertical: string | null;
  generation_status: 'pending' | 'partial' | 'complete';
  updated_at: string;
  version: number;
}

/**
 * ProcessMapButton component that triggers process map generation
 * and displays it in a modal or navigates to the Process Maps page.
 * Now generates BOTH horizontal and vertical views automatically.
 */
export function ProcessMapButton({
  processType,
  processName,
  variant = 'outline',
  size = 'sm',
  className,
  showLabel = true,
  label = 'Process Map',
  onGenerated,
}: ProcessMapButtonProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [processMap, setProcessMap] = useState<ProcessMap | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  // View direction in modal - defaults to vertical
  const [activeDirection, setActiveDirection] = useState<'horizontal' | 'vertical'>('vertical');

  const formatProcessTitle = useCallback(() => {
    const formattedName = processName
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    return formattedName;
  }, [processName]);

  // Get the active mermaid code based on selected direction
  const getActiveMermaidCode = useCallback(() => {
    if (!processMap) return '';
    if (activeDirection === 'vertical') {
      return processMap.mermaid_code_vertical || processMap.mermaid_code;
    }
    return processMap.mermaid_code_horizontal || processMap.mermaid_code;
  }, [processMap, activeDirection]);

  const generateProcessMap = useCallback(
    async (regenerate = false) => {
      if (regenerate) {
        setRegenerating(true);
      } else if (!dialogOpen) {
        setLoading(true);
      }

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
            // No direction - edge function generates both
          },
        });

        if (response.error) {
          throw new Error(response.error.message || 'Failed to generate process map');
        }

        const data = response.data;
        if (data?.processMap) {
          setProcessMap(data.processMap);
          setDialogOpen(true);

          if (data.generated) {
            const status = data.generationStatus === 'complete'
              ? 'Process map generated (both views)'
              : 'Process map generated (partial - one view)';
            toast.success(status);
          }
          onGenerated?.();
        } else {
          throw new Error('No process map returned');
        }
      } catch (error) {
        console.error('Error generating process map:', error);
        toast.error(
          error instanceof Error ? error.message : 'Failed to generate process map'
        );
      } finally {
        setLoading(false);
        setRegenerating(false);
      }
    },
    [processType, processName, dialogOpen, onGenerated]
  );

  const handleClick = useCallback(() => {
    // If we already have a map, open the dialog directly
    if (processMap) {
      setDialogOpen(true);
    } else {
      // Generate both views
      generateProcessMap(false);
    }
  }, [processMap, generateProcessMap]);

  const handleRegenerate = useCallback(() => {
    generateProcessMap(true);
  }, [generateProcessMap]);

  const handleViewAll = useCallback(() => {
    setDialogOpen(false);
    navigate('/platform/process-maps');
  }, [navigate]);

  // Check if views are available
  const hasHorizontalView = processMap?.mermaid_code_horizontal != null;
  const hasVerticalView = processMap?.mermaid_code_vertical != null;

  return (
    <>
      {/* Simple button - no direction picker, generates both views */}
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={handleClick}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <GitBranch className="h-4 w-4" />
        )}
        {showLabel && <span className="ml-1.5">{label}</span>}
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitBranch className="h-5 w-5 text-emerald-500" />
              {formatProcessTitle()} Process Map
            </DialogTitle>
            <DialogDescription>
              Visual representation of the {formatProcessTitle().toLowerCase()}{' '}
              {processType} workflow
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-auto relative">
            {processMap && (
              <MermaidRenderer
                code={getActiveMermaidCode()}
                title={processMap.title}
                description={processMap.description || undefined}
                showControls={true}
                showCode={false}
              />
            )}
          </div>

          <div className="flex items-center justify-between pt-4 border-t">
            <div className="text-xs text-muted-foreground">
              {processMap && (
                <>
                  Version {processMap.version} &middot; Last updated{' '}
                  {new Date(processMap.updated_at).toLocaleDateString()}
                  {' '}&middot; {activeDirection === 'horizontal' ? 'Horizontal' : 'Vertical'} flow
                  {processMap.generation_status === 'partial' && (
                    <span className="ml-2 text-amber-500">(Processing...)</span>
                  )}
                </>
              )}
            </div>
            <div className="flex items-center gap-3">
              {/* Direction Toggle - switches between views */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">View:</span>
                <div className="flex items-center border rounded-md">
                  <Button
                    variant={activeDirection === 'horizontal' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setActiveDirection('horizontal')}
                    disabled={!hasHorizontalView}
                    className="rounded-r-none gap-1 px-2 h-7"
                    title={hasHorizontalView ? 'View horizontal flow' : 'Horizontal view not available'}
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
                    title={hasVerticalView ? 'View vertical flow' : 'Vertical view not available'}
                  >
                    <ArrowDown className="h-3 w-3" />
                    <span className="text-xs">V</span>
                    {hasVerticalView && <span className="w-1.5 h-1.5 rounded-full bg-green-500 ml-0.5" />}
                  </Button>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRegenerate}
                disabled={regenerating}
              >
                {regenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-1.5" />
                )}
                Regenerate
              </Button>
              <Button variant="outline" size="sm" onClick={handleViewAll}>
                <ExternalLink className="h-4 w-4 mr-1.5" />
                View All Maps
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default ProcessMapButton;
