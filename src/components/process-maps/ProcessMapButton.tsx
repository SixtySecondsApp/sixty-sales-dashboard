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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { GitBranch, Loader2, ExternalLink, RefreshCw, ArrowRight, ArrowDown, Sparkles } from 'lucide-react';
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
  | 'vsl_analytics';

export type FlowDirection = 'horizontal' | 'vertical';

interface ProcessMapButtonProps {
  processType: ProcessType;
  processName: ProcessName;
  variant?: 'default' | 'ghost' | 'outline' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  showLabel?: boolean;
  label?: string;
  direction?: FlowDirection;
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
  direction = 'horizontal',
  onGenerated,
}: ProcessMapButtonProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [directionPickerOpen, setDirectionPickerOpen] = useState(false);
  // Store both horizontal and vertical versions
  const [horizontalMap, setHorizontalMap] = useState<ProcessMap | null>(null);
  const [verticalMap, setVerticalMap] = useState<ProcessMap | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [generatingDirection, setGeneratingDirection] = useState<FlowDirection | null>(null);
  const [activeDirection, setActiveDirection] = useState<FlowDirection>(direction);

  // Get the currently active process map based on selected direction
  const activeMap = activeDirection === 'horizontal' ? horizontalMap : verticalMap;

  const formatProcessTitle = useCallback(() => {
    const formattedName = processName
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    return formattedName;
  }, [processName]);

  const generateProcessMap = useCallback(
    async (targetDirection: FlowDirection, regenerate = false) => {
      // Check if we already have this direction (and not forcing regenerate)
      const existingMap = targetDirection === 'horizontal' ? horizontalMap : verticalMap;
      if (existingMap && !regenerate) {
        setActiveDirection(targetDirection);
        return;
      }

      if (regenerate) {
        setRegenerating(true);
      } else if (!dialogOpen) {
        setLoading(true);
      }
      setGeneratingDirection(targetDirection);

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
            direction: targetDirection,
          },
        });

        if (response.error) {
          throw new Error(response.error.message || 'Failed to generate process map');
        }

        const data = response.data;
        if (data?.processMap) {
          // Store in the appropriate state based on direction
          if (targetDirection === 'horizontal') {
            setHorizontalMap(data.processMap);
          } else {
            setVerticalMap(data.processMap);
          }
          setActiveDirection(targetDirection);
          setDialogOpen(true);

          if (data.generated) {
            toast.success(`${targetDirection === 'horizontal' ? 'Horizontal' : 'Vertical'} process map generated`);
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
        setGeneratingDirection(null);
      }
    },
    [processType, processName, horizontalMap, verticalMap, dialogOpen, onGenerated]
  );

  const handleClick = useCallback(() => {
    // If we already have maps, open the dialog directly
    if (horizontalMap || verticalMap) {
      setDialogOpen(true);
    } else {
      // Show direction picker for first generation
      setDirectionPickerOpen(true);
    }
  }, [horizontalMap, verticalMap]);

  const handleDirectionSelect = useCallback((selectedDirection: FlowDirection) => {
    setDirectionPickerOpen(false);
    generateProcessMap(selectedDirection, false);
  }, [generateProcessMap]);

  const handleDirectionChange = useCallback((newDirection: FlowDirection) => {
    // If we have this version, just switch to it
    const existingMap = newDirection === 'horizontal' ? horizontalMap : verticalMap;
    if (existingMap) {
      setActiveDirection(newDirection);
    } else {
      // Generate the new direction
      generateProcessMap(newDirection, false);
    }
  }, [horizontalMap, verticalMap, generateProcessMap]);

  const handleRegenerate = useCallback(() => {
    generateProcessMap(activeDirection, true);
  }, [generateProcessMap, activeDirection]);

  const handleViewAll = useCallback(() => {
    setDialogOpen(false);
    navigate('/platform/process-maps');
  }, [navigate]);

  return (
    <>
      <Popover open={directionPickerOpen} onOpenChange={setDirectionPickerOpen}>
        <PopoverTrigger asChild>
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
        </PopoverTrigger>
        <PopoverContent className="w-64 p-4" align="start">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="h-4 w-4 text-primary" />
              Generate Process Map
            </div>
            <p className="text-xs text-muted-foreground">
              Choose a flow direction to start:
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDirectionSelect('horizontal')}
                className="flex flex-col items-center gap-1 h-auto py-3"
              >
                <ArrowRight className="h-5 w-5" />
                <span className="text-xs">Horizontal</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDirectionSelect('vertical')}
                className="flex flex-col items-center gap-1 h-auto py-3"
              >
                <ArrowDown className="h-5 w-5" />
                <span className="text-xs">Vertical</span>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              You can generate the other view later
            </p>
          </div>
        </PopoverContent>
      </Popover>

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
            {/* Loading overlay when switching directions */}
            {generatingDirection && (
              <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10">
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">
                    Generating {generatingDirection} view...
                  </span>
                </div>
              </div>
            )}
            {activeMap && (
              <MermaidRenderer
                code={activeMap.mermaid_code}
                title={activeMap.title}
                description={activeMap.description || undefined}
                showControls={true}
                showCode={false}
              />
            )}
          </div>

          <div className="flex items-center justify-between pt-4 border-t">
            <div className="text-xs text-muted-foreground">
              {activeMap && (
                <>
                  Version {activeMap.version} &middot; Last updated{' '}
                  {new Date(activeMap.updated_at).toLocaleDateString()}
                  {' '}&middot; {activeDirection === 'horizontal' ? 'Horizontal' : 'Vertical'} flow
                </>
              )}
            </div>
            <div className="flex items-center gap-3">
              {/* Direction Toggle - switches between cached versions or generates new */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">View:</span>
                <div className="flex items-center border rounded-md">
                  <Button
                    variant={activeDirection === 'horizontal' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => handleDirectionChange('horizontal')}
                    disabled={generatingDirection === 'horizontal'}
                    className="rounded-r-none gap-1 px-2 h-7"
                    title={horizontalMap ? 'View horizontal flow' : 'Generate horizontal flow'}
                  >
                    {generatingDirection === 'horizontal' ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <ArrowRight className="h-3 w-3" />
                    )}
                    <span className="text-xs">H</span>
                    {horizontalMap && <span className="w-1.5 h-1.5 rounded-full bg-green-500 ml-0.5" />}
                  </Button>
                  <Button
                    variant={activeDirection === 'vertical' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => handleDirectionChange('vertical')}
                    disabled={generatingDirection === 'vertical'}
                    className="rounded-l-none gap-1 px-2 h-7"
                    title={verticalMap ? 'View vertical flow' : 'Generate vertical flow'}
                  >
                    {generatingDirection === 'vertical' ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <ArrowDown className="h-3 w-3" />
                    )}
                    <span className="text-xs">V</span>
                    {verticalMap && <span className="w-1.5 h-1.5 rounded-full bg-green-500 ml-0.5" />}
                  </Button>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRegenerate}
                disabled={regenerating || !!generatingDirection}
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
