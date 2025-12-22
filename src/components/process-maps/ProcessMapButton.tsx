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
import { GitBranch, Loader2, ExternalLink, RefreshCw } from 'lucide-react';
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
  | 'task_extraction';

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
  updated_at: string;
  version: number;
}

/**
 * ProcessMapButton component that triggers process map generation
 * and displays it in a modal or navigates to the Process Maps page.
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

  const formatProcessTitle = useCallback(() => {
    const formattedName = processName
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    return formattedName;
  }, [processName]);

  const generateProcessMap = useCallback(
    async (regenerate = false) => {
      const isRegenerate = regenerate;
      if (isRegenerate) {
        setRegenerating(true);
      } else {
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
            regenerate: isRegenerate,
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
            toast.success('Process map generated successfully');
            onGenerated?.();
          } else if (data.cached) {
            // Cached version, no toast needed
          }
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
    [processType, processName, onGenerated]
  );

  const handleClick = useCallback(() => {
    generateProcessMap(false);
  }, [generateProcessMap]);

  const handleRegenerate = useCallback(() => {
    generateProcessMap(true);
  }, [generateProcessMap]);

  const handleViewAll = useCallback(() => {
    setDialogOpen(false);
    navigate('/platform/process-maps');
  }, [navigate]);

  return (
    <>
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

          <div className="flex-1 overflow-auto">
            {processMap && (
              <MermaidRenderer
                code={processMap.mermaid_code}
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
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
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
