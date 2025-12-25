import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import {
  GitBranch,
  RefreshCw,
  Loader2,
  Search,
  Link2,
  Workflow,
  Calendar,
  Trash2,
  Eye,
  Clock,
  LayoutGrid,
  List,
  ArrowRight,
  ArrowDown,
  BarChart3,
  Zap,
  FlaskConical,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase/clientV2';
import { useOrgId } from '@/lib/contexts/OrgContext';
import { MermaidRenderer } from '@/components/process-maps/MermaidRenderer';
import type { StepStatus, ProcessStructure } from '@/lib/types/processMapTesting';
import { ProcessMapButton, ProcessType, ProcessName } from '@/components/process-maps/ProcessMapButton';
import { WorkflowTestPanel } from '@/components/process-maps/WorkflowTestPanel';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface ProcessMap {
  id: string;
  org_id: string;
  process_type: 'integration' | 'workflow';
  process_name: string;
  title: string;
  description: string | null;
  /** Structured JSON - source of truth for content (Phase 1 output) */
  process_structure: ProcessStructure | null;
  mermaid_code: string;
  mermaid_code_horizontal: string | null;
  mermaid_code_vertical: string | null;
  /** Generation status: structure_ready means Phase 1 complete, Phase 2 pending */
  generation_status: 'pending' | 'structure_ready' | 'partial' | 'complete';
  generated_by: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

// Available processes for quick generation
const AVAILABLE_PROCESSES: Array<{
  type: ProcessType;
  name: ProcessName;
  label: string;
  icon: React.ReactNode;
  description: string;
}> = [
  {
    type: 'integration',
    name: 'hubspot',
    label: 'HubSpot',
    icon: <Link2 className="h-4 w-4 text-orange-500" />,
    description: 'Two-way CRM sync for contacts, deals and tasks',
  },
  {
    type: 'integration',
    name: 'google',
    label: 'Google Workspace',
    icon: <Calendar className="h-4 w-4 text-blue-500" />,
    description: 'Sync Gmail, Calendar and Drive',
  },
  {
    type: 'integration',
    name: 'fathom',
    label: 'Fathom',
    icon: <Workflow className="h-4 w-4 text-purple-500" />,
    description: 'Import meeting recordings and transcripts',
  },
  {
    type: 'integration',
    name: 'slack',
    label: 'Slack',
    icon: <Link2 className="h-4 w-4 text-pink-500" />,
    description: 'Send alerts and manage deal rooms',
  },
  {
    type: 'integration',
    name: 'justcall',
    label: 'JustCall',
    icon: <Link2 className="h-4 w-4 text-green-500" />,
    description: 'Sync call recordings and transcripts',
  },
  {
    type: 'integration',
    name: 'savvycal',
    label: 'SavvyCal',
    icon: <Calendar className="h-4 w-4 text-indigo-500" />,
    description: 'Sync bookings and create leads',
  },
  {
    type: 'workflow',
    name: 'meeting_intelligence',
    label: 'Meeting Intelligence',
    icon: <Workflow className="h-4 w-4 text-emerald-500" />,
    description: 'Extract insights and action items from meetings',
  },
  {
    type: 'workflow',
    name: 'task_extraction',
    label: 'Task Extraction',
    icon: <Workflow className="h-4 w-4 text-cyan-500" />,
    description: 'Auto-create tasks from meetings and calls',
  },
  {
    type: 'workflow',
    name: 'vsl_analytics',
    label: 'VSL Analytics',
    icon: <BarChart3 className="h-4 w-4 text-rose-500" />,
    description: 'Track video engagement for A/B testing',
  },
  {
    type: 'workflow',
    name: 'sentry_bridge',
    label: 'Sentry Bridge',
    icon: <Workflow className="h-4 w-4 text-red-500" />,
    description: 'Turn errors into dev tasks automatically',
  },
  {
    type: 'workflow',
    name: 'api_optimization',
    label: 'API Call Optimization',
    icon: <Zap className="h-4 w-4 text-amber-500" />,
    description: 'Reduce API calls with smart batching',
  },
];

export default function ProcessMaps() {
  const orgId = useOrgId();
  const [processMaps, setProcessMaps] = useState<ProcessMap[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'integration' | 'workflow'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedMap, setSelectedMap] = useState<ProcessMap | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  // View direction state for modal and test panel (default to vertical)
  const [modalViewDirection, setModalViewDirection] = useState<'horizontal' | 'vertical'>('vertical');

  // Test panel state
  const [testingMap, setTestingMap] = useState<ProcessMap | null>(null);
  const [testPanelOpen, setTestPanelOpen] = useState(false);
  const [stepStatuses, setStepStatuses] = useState<Map<string, StepStatus>>(new Map());
  const [currentStepId, setCurrentStepId] = useState<string | undefined>(undefined);
  const [testViewDirection, setTestViewDirection] = useState<'horizontal' | 'vertical'>('vertical');

  // Fetch process maps via edge function (bypasses RLS)
  const fetchProcessMaps = useCallback(async () => {
    if (!orgId) {
      console.warn('ProcessMaps: No orgId available');
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Verify we have an authenticated session before calling edge function
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        console.error('ProcessMaps: No authenticated session', { sessionError });
        toast.error('Please sign in to view process maps');
        setLoading(false);
        return;
      }

      console.log('ProcessMaps: Fetching maps via edge function for org:', orgId, 'user:', sessionData.session.user.email);

      // Use edge function with 'list' action to bypass RLS
      const response = await supabase.functions.invoke('generate-process-map', {
        body: { action: 'list' },
      });

      if (response.error) {
        const errorMessage = response.error.message || 'Unknown error';
        const errorName = response.error.name || 'UnknownError';
        const errorContext = response.error.context || {};

        // Log detailed error info for debugging
        console.error('ProcessMaps: Edge function error details:', {
          name: errorName,
          message: errorMessage,
          context: errorContext,
          fullError: response.error,
        });

        // Handle specific error cases
        if (errorMessage.includes('Platform admin') || errorMessage.includes('Internal user')) {
          console.error('ProcessMaps: Access denied - not a platform admin');
          toast.error('Access denied. Platform admin privileges required.', {
            description: 'Only internal users with admin status can view process maps.'
          });
        } else if (errorName === 'FunctionsFetchError' || errorMessage.includes('Failed to send')) {
          // Network-level error - the request didn't reach the server
          console.error('ProcessMaps: Network error - request did not reach edge function');
          toast.error('Network error', {
            description: 'Could not connect to edge function. Check your network connection.'
          });
        } else {
          console.error('ProcessMaps: Edge function error:', errorMessage);
          toast.error('Failed to load process maps', {
            description: errorMessage
          });
        }
        setProcessMaps([]);
        return;
      }

      const data = response.data;
      console.log(`ProcessMaps: Loaded ${data?.processMaps?.length || 0} maps (count: ${data?.count})`);
      setProcessMaps(data?.processMaps || []);
    } catch (error) {
      console.error('Error fetching process maps:', error);
      toast.error('Failed to load process maps');
      setProcessMaps([]);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchProcessMaps();
  }, [fetchProcessMaps]);

  // Filter process maps
  const filteredMaps = useMemo(() => {
    let maps = processMaps;

    // Filter by tab
    if (activeTab !== 'all') {
      maps = maps.filter((m) => m.process_type === activeTab);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      maps = maps.filter(
        (m) =>
          m.title.toLowerCase().includes(query) ||
          m.process_name.toLowerCase().includes(query) ||
          m.description?.toLowerCase().includes(query)
      );
    }

    return maps;
  }, [processMaps, activeTab, searchQuery]);

  // Get processes that don't have maps yet
  const missingProcesses = useMemo(() => {
    const existingKeys = new Set(
      processMaps.map((m) => `${m.process_type}:${m.process_name}`)
    );
    return AVAILABLE_PROCESSES.filter(
      (p) => !existingKeys.has(`${p.type}:${p.name}`)
    );
  }, [processMaps]);

  const handleViewMap = useCallback((map: ProcessMap) => {
    setSelectedMap(map);
    setDialogOpen(true);
  }, []);

  const handleDeleteMap = useCallback(
    async (mapId: string) => {
      setDeleting(mapId);
      try {
        const { error } = await supabase
          .from('process_maps')
          .delete()
          .eq('id', mapId);

        if (error) {
          throw error;
        }

        setProcessMaps((prev) => prev.filter((m) => m.id !== mapId));
        toast.success('Process map deleted');
      } catch (error) {
        console.error('Error deleting process map:', error);
        toast.error('Failed to delete process map');
      } finally {
        setDeleting(null);
      }
    },
    []
  );

  const handleMapGenerated = useCallback(() => {
    fetchProcessMaps();
  }, [fetchProcessMaps]);

  const handleTestMap = useCallback((map: ProcessMap) => {
    setTestingMap(map);
    setStepStatuses(new Map());
    setCurrentStepId(undefined);
    setTestPanelOpen(true);
  }, []);

  const handleStepStatusChange = useCallback((statuses: Map<string, StepStatus>) => {
    setStepStatuses(statuses);
  }, []);

  const handleCurrentStepChange = useCallback((stepId: string | null) => {
    setCurrentStepId(stepId ?? undefined);
  }, []);

  const handleTestPanelClose = useCallback(() => {
    setTestPanelOpen(false);
    // Keep testingMap for a moment to allow animation, then clear
    setTimeout(() => {
      setTestingMap(null);
      setStepStatuses(new Map());
      setCurrentStepId(undefined);
    }, 300);
  }, []);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <GitBranch className="h-6 w-6 text-emerald-500" />
            Process Maps
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Visualize integration and workflow processes with AI-generated diagrams
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchProcessMaps}>
          <RefreshCw className="h-4 w-4 mr-1.5" />
          Refresh
        </Button>
      </div>

      {/* Quick Generate Cards */}
      {missingProcesses.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Generate Process Maps</CardTitle>
            <CardDescription>
              Click to generate AI-powered visualization for each process
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {missingProcesses.map((process) => (
                <div
                  key={`${process.type}:${process.name}`}
                  className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {process.icon}
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{process.label}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {process.type}
                      </p>
                    </div>
                  </div>
                  <ProcessMapButton
                    processType={process.type}
                    processName={process.name}
                    variant="ghost"
                    size="sm"
                    showLabel={false}
                    onGenerated={handleMapGenerated}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList>
            <TabsTrigger value="all">
              All
              <Badge variant="secondary" className="ml-1.5">
                {processMaps.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="integration">
              Integrations
              <Badge variant="secondary" className="ml-1.5">
                {processMaps.filter((m) => m.process_type === 'integration').length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="workflow">
              Workflows
              <Badge variant="secondary" className="ml-1.5">
                {processMaps.filter((m) => m.process_type === 'workflow').length}
              </Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search process maps..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center border rounded-md">
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
              className="rounded-r-none"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="rounded-l-none"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Process Maps Grid/List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredMaps.length === 0 ? (
        <Card className="py-12">
          <CardContent className="flex flex-col items-center justify-center text-center">
            <GitBranch className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No process maps found</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {searchQuery
                ? 'Try a different search term'
                : 'Generate your first process map using the cards above'}
            </p>
          </CardContent>
        </Card>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMaps.map((map) => (
            <Card key={map.id} className="group hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="text-base truncate">{map.title}</CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {map.process_type}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        v{map.version}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleTestMap(map)}
                      title="Test workflow"
                    >
                      <FlaskConical className="h-4 w-4 text-purple-500" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewMap(map)}
                      title="View diagram"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete process map?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete "{map.title}". This action
                            cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteMap(map.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div
                  className="aspect-video bg-gray-50 dark:bg-gray-800/50 rounded-md overflow-hidden cursor-pointer border relative"
                  onClick={() => handleViewMap(map)}
                >
                  {/* Show horizontal view in card thumbnail (or fallback to mermaid_code) */}
                  <MermaidRenderer
                    code={map.mermaid_code_horizontal || map.mermaid_code}
                    showControls={false}
                    showCode={false}
                    className="border-0 shadow-none"
                  />
                  {/* Show processing indicator if only partial/structure_ready generation */}
                  {(map.generation_status === 'partial' || map.generation_status === 'structure_ready') && (
                    <div className="absolute top-2 right-2">
                      <Badge variant="outline" className="bg-background/80 backdrop-blur-sm text-xs gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        {map.generation_status === 'structure_ready' ? 'Rendering...' : 'Processing'}
                      </Badge>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>Updated {formatDate(map.updated_at)}</span>
                  </div>
                  {/* Show which views are available */}
                  <div className="flex items-center gap-1">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${map.mermaid_code_horizontal ? 'bg-green-500' : 'bg-gray-300'}`}
                      title={map.mermaid_code_horizontal ? 'Horizontal view ready' : 'Horizontal view not generated'}
                    />
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${map.mermaid_code_vertical ? 'bg-green-500' : 'bg-gray-300'}`}
                      title={map.mermaid_code_vertical ? 'Vertical view ready' : 'Vertical view not generated'}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredMaps.map((map) => (
            <Card key={map.id} className="group">
              <CardContent className="py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="p-2 rounded-md bg-gray-100 dark:bg-gray-800">
                    <GitBranch className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{map.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="outline" className="text-xs">
                        {map.process_type}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        v{map.version}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        &middot; {formatDate(map.updated_at)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <ProcessMapButton
                    processType={map.process_type}
                    processName={map.process_name as ProcessName}
                    variant="ghost"
                    size="sm"
                    label="Regenerate"
                    onGenerated={handleMapGenerated}
                  />
                  <Button variant="outline" size="sm" onClick={() => handleTestMap(map)}>
                    <FlaskConical className="h-4 w-4 mr-1.5 text-purple-500" />
                    Test
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleViewMap(map)}>
                    <Eye className="h-4 w-4 mr-1.5" />
                    View
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete process map?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete "{map.title}". This action
                          cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDeleteMap(map.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* View Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="flex items-center gap-2">
                  <GitBranch className="h-5 w-5 text-emerald-500" />
                  {selectedMap?.title}
                </DialogTitle>
                <DialogDescription>
                  {selectedMap?.description || 'Process visualization diagram'}
                </DialogDescription>
              </div>
              {/* View Direction Toggle */}
              {selectedMap && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">View:</span>
                  <div className="flex items-center border rounded-md">
                    <Button
                      variant={modalViewDirection === 'horizontal' ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => setModalViewDirection('horizontal')}
                      disabled={!selectedMap.mermaid_code_horizontal}
                      className="rounded-r-none gap-1 px-2 h-7"
                      title={selectedMap.mermaid_code_horizontal ? 'Horizontal view' : 'Horizontal view not available'}
                    >
                      <ArrowRight className="h-3 w-3" />
                      <span className="text-xs">H</span>
                      {selectedMap.mermaid_code_horizontal && (
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 ml-0.5" />
                      )}
                    </Button>
                    <Button
                      variant={modalViewDirection === 'vertical' ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => setModalViewDirection('vertical')}
                      disabled={!selectedMap.mermaid_code_vertical}
                      className="rounded-l-none gap-1 px-2 h-7"
                      title={selectedMap.mermaid_code_vertical ? 'Vertical view' : 'Vertical view not available'}
                    >
                      <ArrowDown className="h-3 w-3" />
                      <span className="text-xs">V</span>
                      {selectedMap.mermaid_code_vertical && (
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 ml-0.5" />
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-auto">
            {selectedMap && (
              <MermaidRenderer
                code={
                  modalViewDirection === 'vertical'
                    ? (selectedMap.mermaid_code_vertical || selectedMap.mermaid_code)
                    : (selectedMap.mermaid_code_horizontal || selectedMap.mermaid_code)
                }
                showControls={true}
                showCode={true}
              />
            )}
          </div>

          <div className="flex items-center justify-between pt-4 border-t">
            <div className="text-xs text-muted-foreground">
              {selectedMap && (
                <>
                  Version {selectedMap.version} &middot; Updated{' '}
                  {formatDate(selectedMap.updated_at)}
                  {(selectedMap.generation_status === 'partial' || selectedMap.generation_status === 'structure_ready') && (
                    <span className="ml-2 text-amber-500">
                      <AlertCircle className="h-3 w-3 inline mr-1" />
                      {selectedMap.generation_status === 'structure_ready' ? 'Rendering views...' : 'Partial generation'}
                    </span>
                  )}
                </>
              )}
            </div>
            <div className="flex items-center gap-3">
              {/* Regenerate button */}
              {selectedMap && (
                <ProcessMapButton
                  processType={selectedMap.process_type}
                  processName={selectedMap.process_name as ProcessName}
                  variant="outline"
                  size="sm"
                  label="Regenerate Both"
                  onGenerated={() => {
                    handleMapGenerated();
                    setDialogOpen(false);
                  }}
                />
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Workflow Test Panel - Side by Side Layout */}
      <Sheet open={testPanelOpen} onOpenChange={(open) => !open && handleTestPanelClose()}>
        <SheetContent side="right" className="w-full sm:max-w-[90vw] lg:max-w-[1200px] overflow-hidden flex flex-col p-0 pt-16">
          {testingMap && (
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="border-b p-4 bg-gray-50 dark:bg-gray-900 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold flex items-center gap-2">
                      <FlaskConical className="h-4 w-4 text-purple-500" />
                      Test: {testingMap.title}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Watch steps highlight as test runs
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* View Direction Toggle */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">View:</span>
                      <div className="flex items-center border rounded-md">
                        <Button
                          variant={testViewDirection === 'horizontal' ? 'secondary' : 'ghost'}
                          size="sm"
                          onClick={() => setTestViewDirection('horizontal')}
                          disabled={!testingMap.mermaid_code_horizontal}
                          className="rounded-r-none gap-1 px-2 h-7"
                          title={testingMap.mermaid_code_horizontal ? 'Horizontal view' : 'Horizontal view not available'}
                        >
                          <ArrowRight className="h-3 w-3" />
                          <span className="text-xs">H</span>
                        </Button>
                        <Button
                          variant={testViewDirection === 'vertical' ? 'secondary' : 'ghost'}
                          size="sm"
                          onClick={() => setTestViewDirection('vertical')}
                          disabled={!testingMap.mermaid_code_vertical}
                          className="rounded-l-none gap-1 px-2 h-7"
                          title={testingMap.mermaid_code_vertical ? 'Vertical view' : 'Vertical view not available'}
                        >
                          <ArrowDown className="h-3 w-3" />
                          <span className="text-xs">V</span>
                        </Button>
                      </div>
                    </div>
                    <Badge variant="outline">{testingMap.process_type}</Badge>
                  </div>
                </div>
              </div>

              {/* Side-by-Side Layout: Diagram (60%) | Controls (40%) */}
              <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
                {/* Left: Mermaid Diagram with Step Highlighting */}
                <div className="lg:w-[60%] h-[40vh] lg:h-full border-b lg:border-b-0 lg:border-r bg-white dark:bg-gray-950 overflow-auto">
                  <MermaidRenderer
                    code={
                      testViewDirection === 'vertical'
                        ? (testingMap.mermaid_code_vertical || testingMap.mermaid_code)
                        : (testingMap.mermaid_code_horizontal || testingMap.mermaid_code)
                    }
                    showControls={true}
                    showCode={false}
                    highlightedStepId={currentStepId}
                    stepStatuses={stepStatuses}
                    testMode={true}
                    className="border-0 shadow-none h-full"
                  />
                </div>

                {/* Right: Test Panel Controls */}
                <div className="lg:w-[40%] flex-1 lg:flex-initial overflow-hidden">
                  <WorkflowTestPanel
                    isOpen={true}
                    processMapTitle={testingMap.title}
                    processMapId={testingMap.id}
                    mermaidCode={
                      testViewDirection === 'vertical'
                        ? (testingMap.mermaid_code_vertical || testingMap.mermaid_code)
                        : (testingMap.mermaid_code_horizontal || testingMap.mermaid_code)
                    }
                    processStructure={testingMap.process_structure}
                    onStepStatusChange={handleStepStatusChange}
                    onCurrentStepChange={handleCurrentStepChange}
                    onClose={handleTestPanelClose}
                    embedded={true}
                  />
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
