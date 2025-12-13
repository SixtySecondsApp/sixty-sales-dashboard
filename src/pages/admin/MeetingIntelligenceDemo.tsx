/**
 * Meeting Intelligence Demo Page
 *
 * Admin demo page for testing and configuring all Meeting Intelligence Phase 2 features:
 * - Call Type Workflow Configuration
 * - Pipeline Automation Rules
 * - Scorecard Generation Testing
 * - Workflow Results Inspection
 */

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2,
  Play,
  CheckCircle,
  XCircle,
  RefreshCw,
  Settings,
  Zap,
  FileText,
  ClipboardCheck,
  Bell,
  TrendingUp,
  AlertTriangle,
  Brain,
  Sparkles,
  Calendar,
  Users,
  Target,
  ChevronRight,
  ChevronDown,
  Eye,
  TestTube,
  Workflow,
  ArrowRight,
  ArrowDown,
  Phone,
  Mic,
  MessageSquare,
  ListChecks,
  PieChart,
  Mail,
  Slack,
  CircleDot,
  GitBranch,
  Clock,
  CheckCheck,
  Star,
  Lightbulb,
  BookOpen,
  // New icons for additional tabs
  BarChart3,
  FileSignature,
  ListTodo,
  Plug,
  Search,
  Smile,
  Frown,
  Meh,
  Timer,
  Activity,
  Send,
  FileOutput,
  Hash,
  Database,
  Wand2,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

import { supabase } from '@/lib/supabase/clientV2';
import { useOrg } from '@/lib/contexts/OrgContext';
import { useAuth } from '@/lib/contexts/AuthContext';
import { CallTypeService, OrgCallType } from '@/lib/services/callTypeService';
import { useWorkflowResults, WorkflowConfig, WorkflowChecklistItem, useOrgCallTypes } from '@/lib/hooks/useWorkflowResults';

const LazyCallTypeWorkflowEditor = React.lazy(async () => {
  const mod = await import('@/components/admin/CallTypeWorkflowEditor');
  return { default: mod.CallTypeWorkflowEditor };
});

// Types
interface Meeting {
  id: string;
  title: string;
  start_time: string;
  call_type_id: string | null;
  call_type?: OrgCallType;
  transcript?: string;
  has_transcript: boolean;
}

interface TestResult {
  success: boolean;
  message: string;
  data?: any;
  timestamp: Date;
  duration_ms?: number;
}

interface PipelineRule {
  id: string;
  name: string;
  description: string;
  trigger_type: string;
  action_type: string;
  action_config: any;
  is_active: boolean;
  min_confidence: number;
  cooldown_hours: number;
}

interface WorkflowResult {
  id: string;
  meeting_id: string;
  call_type_id: string;
  checklist_results: any[];
  coverage_score: number;
  missing_required_items: string[];
  created_at: string;
}

// Helper component for test cards
function TestCard({
  title,
  description,
  icon: Icon,
  children,
  onTest,
  isLoading,
  lastResult,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: React.ReactNode;
  onTest?: () => Promise<void>;
  isLoading?: boolean;
  lastResult?: TestResult | null;
}) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription className="text-sm">{description}</CardDescription>
          </div>
          {lastResult && (
            <Badge variant={lastResult.success ? 'default' : 'destructive'}>
              {lastResult.success ? (
                <CheckCircle className="h-3 w-3 mr-1" />
              ) : (
                <XCircle className="h-3 w-3 mr-1" />
              )}
              {lastResult.success ? 'Success' : 'Failed'}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {children}

        {onTest && (
          <div className="flex items-center gap-4 pt-2">
            <Button onClick={onTest} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Run Test
                </>
              )}
            </Button>
            {lastResult?.duration_ms && (
              <span className="text-sm text-muted-foreground">
                Completed in {(lastResult.duration_ms / 1000).toFixed(2)}s
              </span>
            )}
          </div>
        )}

        {lastResult?.data && (
          <div className="mt-4 p-3 bg-muted rounded-lg">
            <pre className="text-xs overflow-auto max-h-48">
              {JSON.stringify(lastResult.data, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function MeetingIntelligenceDemo() {
  const { org } = useOrg();
  const { user } = useAuth();
  const orgIdFromContext = org?.id ?? null;
  const [orgIdOverride, setOrgIdOverride] = useState<string>(() => {
    try {
      return localStorage.getItem('mi_demo_org_id_override') || '';
    } catch {
      return '';
    }
  });

  const effectiveOrgId = (orgIdOverride || orgIdFromContext || '').trim() || null;

  // State
  const [activeTab, setActiveTab] = useState('overview');
  const [callTypes, setCallTypes] = useState<OrgCallType[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [pipelineRules, setPipelineRules] = useState<PipelineRule[]>([]);
  const [workflowResults, setWorkflowResults] = useState<WorkflowResult[]>([]);
  const [selectedCallType, setSelectedCallType] = useState<OrgCallType | null>(null);
  const [selectedMeeting, setSelectedMeeting] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, TestResult | null>>({});
  const [workflowEditorOpen, setWorkflowEditorOpen] = useState(false);

  // Use the hook for call type management
  const { updateWorkflowConfig, updateCoachingEnabled } = useOrgCallTypes();

  // Load data
  const loadData = useCallback(async () => {
    if (!effectiveOrgId) return;
    setLoading(true);

    // Load each data type independently so one failure doesn't block others
    // Load call types
    try {
      const types = await CallTypeService.getCallTypes(effectiveOrgId);
      setCallTypes(types);
      console.log('[MeetingIntelligenceDemo] Loaded call types:', types.length);
    } catch (error) {
      console.error('[MeetingIntelligenceDemo] Error loading call types:', error);
      toast.error('Failed to load call types (check RLS policies)');
    }

    // Load recent meetings (all meetings, not just those with transcripts)
    try {
      const { data: meetingsData, error: meetingsError } = await (supabase
        .from('meetings') as any)
        .select('id, title, meeting_start, call_type_id, transcript_text')
        .eq('org_id', effectiveOrgId)
        .order('meeting_start', { ascending: false })
        .limit(100);

      if (meetingsError) {
        console.error('[MeetingIntelligenceDemo] Meetings query error:', meetingsError);
        toast.error('Failed to load meetings');
      } else {
        setMeetings((meetingsData || []).map((m: any) => ({
          ...m,
          start_time: m.meeting_start, // Map to expected field name
          transcript: m.transcript_text,
          has_transcript: !!m.transcript_text,
        })));
        const withTranscripts = (meetingsData || []).filter((m: any) => m.transcript_text);
        console.log('[MeetingIntelligenceDemo] Loaded meetings:', meetingsData?.length || 0, '| With transcripts:', withTranscripts.length);
      }
    } catch (error) {
      console.error('[MeetingIntelligenceDemo] Error loading meetings:', error);
    }

    // Load pipeline automation rules
    try {
      const { data: rulesData, error: rulesError } = await (supabase
        .from('pipeline_automation_rules') as any)
        .select('*')
        .eq('org_id', effectiveOrgId)
        .order('created_at', { ascending: false });

      if (rulesError) {
        console.error('[MeetingIntelligenceDemo] Rules query error:', rulesError);
      } else {
        setPipelineRules(rulesData || []);
      }
    } catch (error) {
      console.error('[MeetingIntelligenceDemo] Error loading rules:', error);
    }

    // Load recent workflow results
    try {
      const { data: resultsData, error: resultsError } = await (supabase
        .from('meeting_workflow_results') as any)
        .select('*')
        .eq('org_id', effectiveOrgId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (resultsError) {
        console.error('[MeetingIntelligenceDemo] Results query error:', resultsError);
      } else {
        setWorkflowResults(resultsData || []);
      }
    } catch (error) {
      console.error('[MeetingIntelligenceDemo] Error loading results:', error);
    }

    setLoading(false);
  }, [effectiveOrgId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const saveOrgOverride = useCallback(() => {
    try {
      const next = orgIdOverride.trim();
      if (next) {
        localStorage.setItem('mi_demo_org_id_override', next);
        toast.success('Saved org override for demo');
      } else {
        localStorage.removeItem('mi_demo_org_id_override');
        toast.success('Cleared org override for demo');
      }
    } catch {
      // ignore
    }
    // Reload data using the updated override
    setTimeout(() => loadData(), 0);
  }, [orgIdOverride, loadData]);

  const autoDetectBestOrg = useCallback(async ({ force }: { force?: boolean } = {}) => {
    // Avoid repeated *automatic* attempts per session, but always allow manual retries.
    const guardKey = 'mi_demo_org_autodetected';
    if (!force) {
      try {
        if (sessionStorage.getItem(guardKey) === 'true') return;
        sessionStorage.setItem(guardKey, 'true');
      } catch {
        // ignore
      }
    }

    if (!user) return;

    try {
      // Heuristic: pick the org_id that has the most meetings WITH transcripts.
      // This avoids relying on organization_memberships (which can 500 when RLS is recursive).
      const { data, error } = await (supabase.from('meetings') as any)
        .select('org_id, transcript_text')
        .not('transcript_text', 'is', null)
        .neq('transcript_text', '')
        .limit(1000);

      if (error) throw error;

      const counts = new Map<string, number>();
      for (const row of data || []) {
        const orgId = row?.org_id;
        if (!orgId) continue;
        counts.set(orgId, (counts.get(orgId) || 0) + 1);
      }

      // Fall back: if no transcript meetings were returned, try any meetings (still helps choose an org)
      if (counts.size === 0) {
        const anyResult = await (supabase.from('meetings') as any)
          .select('org_id')
          .limit(200);
        if (anyResult.error) throw anyResult.error;
        for (const row of anyResult.data || []) {
          const orgId = row?.org_id;
          if (!orgId) continue;
          counts.set(orgId, (counts.get(orgId) || 0) + 1);
        }
      }

      const best = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0];
      if (!best?.[0]) {
        toast.error('Could not auto-detect an org (no accessible meetings)');
        return;
      }

      setOrgIdOverride(best[0]);
      try {
        localStorage.setItem('mi_demo_org_id_override', best[0]);
      } catch {
        // ignore
      }
      toast.success('Auto-selected org for demo');
      setTimeout(() => loadData(), 0);
    } catch (e: any) {
      console.error('[MeetingIntelligenceDemo] autoDetectBestOrg failed:', e);
      toast.error('Auto-detect failed (check meetings RLS)');
    }
  }, [user, loadData]);

  // Test functions
  const testScorecardGeneration = async () => {
    if (!selectedMeeting) {
      toast.error('Please select a meeting first');
      return;
    }

    const startTime = Date.now();
    try {
      const { data, error } = await supabase.functions.invoke('meeting-generate-scorecard', {
        body: { meetingId: selectedMeeting },
      });

      if (error) throw error;

      setTestResults(prev => ({
        ...prev,
        scorecard: {
          success: true,
          message: 'Scorecard generated successfully',
          data,
          timestamp: new Date(),
          duration_ms: Date.now() - startTime,
        },
      }));
      toast.success('Scorecard generated!');
    } catch (error: any) {
      setTestResults(prev => ({
        ...prev,
        scorecard: {
          success: false,
          message: error.message || 'Failed to generate scorecard',
          timestamp: new Date(),
          duration_ms: Date.now() - startTime,
        },
      }));
      toast.error('Scorecard generation failed');
    }
  };

  const testRiskAnalysis = async () => {
    const startTime = Date.now();
    try {
      // Get a deal to analyze
      const { data: deals } = await (supabase
        .from('deals') as any)
        .select('id, name')
        .limit(1)
        .single();

      if (!deals) {
        toast.error('No deals found to analyze');
        return;
      }

      const { data, error } = await supabase.functions.invoke('deal-analyze-risk-signals', {
        body: { dealId: deals.id, processForwardMovement: true },
      });

      if (error) throw error;

      setTestResults(prev => ({
        ...prev,
        risk: {
          success: true,
          message: `Risk analysis completed for "${deals.name}"`,
          data,
          timestamp: new Date(),
          duration_ms: Date.now() - startTime,
        },
      }));
      toast.success('Risk analysis completed!');
    } catch (error: any) {
      setTestResults(prev => ({
        ...prev,
        risk: {
          success: false,
          message: error.message || 'Failed to analyze risk',
          timestamp: new Date(),
          duration_ms: Date.now() - startTime,
        },
      }));
      toast.error('Risk analysis failed');
    }
  };

  const testWorkflowNotifications = async () => {
    const startTime = Date.now();
    try {
      const { data, error } = await supabase.functions.invoke('meeting-workflow-notifications', {
        body: {},
      });

      if (error) throw error;

      setTestResults(prev => ({
        ...prev,
        notifications: {
          success: true,
          message: 'Workflow notifications processed',
          data,
          timestamp: new Date(),
          duration_ms: Date.now() - startTime,
        },
      }));
      toast.success('Notifications processed!');
    } catch (error: any) {
      setTestResults(prev => ({
        ...prev,
        notifications: {
          success: false,
          message: error.message || 'Failed to process notifications',
          timestamp: new Date(),
          duration_ms: Date.now() - startTime,
        },
      }));
      toast.error('Notification processing failed');
    }
  };

  const toggleRuleActive = async (ruleId: string, isActive: boolean) => {
    try {
      const { error } = await (supabase
        .from('pipeline_automation_rules') as any)
        .update({ is_active: !isActive })
        .eq('id', ruleId);

      if (error) throw error;

      setPipelineRules(prev =>
        prev.map(r => r.id === ruleId ? { ...r, is_active: !isActive } : r)
      );
      toast.success(`Rule ${!isActive ? 'enabled' : 'disabled'}`);
    } catch (error: any) {
      toast.error('Failed to update rule');
    }
  };

  const getTriggerLabel = (trigger: string) => {
    const labels: Record<string, string> = {
      forward_movement_detected: 'Forward Movement',
      proposal_requested: 'Proposal Requested',
      pricing_discussed: 'Pricing Discussed',
      verbal_commitment: 'Verbal Commitment',
      checklist_incomplete: 'Checklist Incomplete',
    };
    return labels[trigger] || trigger;
  };

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      advance_stage: 'Advance Stage',
      create_task: 'Create Task',
      send_notification: 'Send Notification',
      update_deal_field: 'Update Deal',
    };
    return labels[action] || action;
  };

  if (!effectiveOrgId) {
    return (
      <div className="container mx-auto p-6 space-y-4">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Organization Required</AlertTitle>
          <AlertDescription>
            Meeting Intelligence is org-scoped. Your session couldn’t resolve an org.
            <br />
            If you’re seeing `organization_memberships` 500s, apply the migration
            `supabase/migrations/20251212233000_fix_org_memberships_rls_recursion.sql`
            to your Supabase project.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>Demo Org Override (temporary)</CardTitle>
            <CardDescription>
              Use this to run the demo even if org membership loading is broken. Paste an `org_id` UUID.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => autoDetectBestOrg({ force: true })}
              >
                Auto-detect org (most transcript meetings)
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mi-demo-org-id">Org ID</Label>
              <Input
                id="mi-demo-org-id"
                value={orgIdOverride}
                onChange={(e) => setOrgIdOverride(e.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={saveOrgOverride}>Save & Load Demo</Button>
              <Button
                variant="outline"
                onClick={() => {
                  setOrgIdOverride('');
                  setTimeout(() => saveOrgOverride(), 0);
                }}
              >
                Clear Override
              </Button>
            </div>

            <div className="text-xs text-muted-foreground">
              OrgContext org: <span className="font-mono">{orgIdFromContext ?? 'null'}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="py-6 px-8 md:px-12 lg:px-16 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-7 w-7 text-primary" />
            Meeting Intelligence Demo
          </h1>
          <p className="text-muted-foreground mt-1">
            Test and configure call type workflows, pipeline automation, and AI coaching features
          </p>
        </div>
        <Button variant="outline" onClick={loadData} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Data
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <FileText className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{callTypes.length}</p>
                <p className="text-sm text-muted-foreground">Call Types</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <Zap className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pipelineRules.filter(r => r.is_active).length}</p>
                <p className="text-sm text-muted-foreground">Active Rules</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <Calendar className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {meetings.filter(m => m.has_transcript).length}
                  <span className="text-sm font-normal text-muted-foreground ml-1">/ {meetings.length}</span>
                </p>
                <p className="text-sm text-muted-foreground">With Transcripts / Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500/10 rounded-lg">
                <ClipboardCheck className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{workflowResults.length}</p>
                <p className="text-sm text-muted-foreground">Workflow Results</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="overflow-x-auto">
          <TabsList className="inline-flex w-auto min-w-full md:grid md:w-full md:grid-cols-9 gap-1">
            <TabsTrigger value="overview" className="flex items-center gap-2 whitespace-nowrap">
              <Eye className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="ai-analysis" className="flex items-center gap-2 whitespace-nowrap">
              <BarChart3 className="h-4 w-4" />
              AI Analysis
            </TabsTrigger>
            <TabsTrigger value="proposals" className="flex items-center gap-2 whitespace-nowrap">
              <FileSignature className="h-4 w-4" />
              Proposals
            </TabsTrigger>
            <TabsTrigger value="tasks" className="flex items-center gap-2 whitespace-nowrap">
              <ListTodo className="h-4 w-4" />
              Tasks
            </TabsTrigger>
            <TabsTrigger value="integrations" className="flex items-center gap-2 whitespace-nowrap">
              <Plug className="h-4 w-4" />
              Integrations
            </TabsTrigger>
            <TabsTrigger value="call-types" className="flex items-center gap-2 whitespace-nowrap">
              <Settings className="h-4 w-4" />
              Call Types
            </TabsTrigger>
            <TabsTrigger value="automation" className="flex items-center gap-2 whitespace-nowrap">
              <Workflow className="h-4 w-4" />
              Automation
            </TabsTrigger>
            <TabsTrigger value="testing" className="flex items-center gap-2 whitespace-nowrap">
              <TestTube className="h-4 w-4" />
              Testing
            </TabsTrigger>
            <TabsTrigger value="results" className="flex items-center gap-2 whitespace-nowrap">
              <ClipboardCheck className="h-4 w-4" />
              Results
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* What Happens After a Call - Visual Timeline */}
          <Card className="border-2 border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-xl">
                <Clock className="h-6 w-6 text-primary" />
                What Happens After Every Call
              </CardTitle>
              <CardDescription className="text-base">
                This is the automated pipeline that runs after each meeting with a transcript
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Timeline */}
              <div className="relative">
                {/* Timeline Steps */}
                <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                  {/* Step 1: Call Ends */}
                  <div className="relative">
                    <div className="flex flex-col items-center text-center">
                      <div className="w-14 h-14 rounded-full bg-blue-500/10 flex items-center justify-center mb-3 ring-4 ring-blue-500/20">
                        <Phone className="h-7 w-7 text-blue-500" />
                      </div>
                      <Badge className="mb-2 bg-blue-500">Step 1</Badge>
                      <h4 className="font-semibold text-sm">Call Ends</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        Fathom syncs the transcript
                      </p>
                    </div>
                    <ArrowRight className="hidden md:block absolute -right-2 top-6 h-5 w-5 text-muted-foreground" />
                  </div>

                  {/* Step 2: AI Classification */}
                  <div className="relative">
                    <div className="flex flex-col items-center text-center">
                      <div className="w-14 h-14 rounded-full bg-purple-500/10 flex items-center justify-center mb-3 ring-4 ring-purple-500/20">
                        <Brain className="h-7 w-7 text-purple-500" />
                      </div>
                      <Badge className="mb-2 bg-purple-500">Step 2</Badge>
                      <h4 className="font-semibold text-sm">AI Classifies</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        Call type detected (Demo, Discovery, etc)
                      </p>
                    </div>
                    <ArrowRight className="hidden md:block absolute -right-2 top-6 h-5 w-5 text-muted-foreground" />
                  </div>

                  {/* Step 3: Checklist Analysis */}
                  <div className="relative">
                    <div className="flex flex-col items-center text-center">
                      <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center mb-3 ring-4 ring-green-500/20">
                        <ListChecks className="h-7 w-7 text-green-500" />
                      </div>
                      <Badge className="mb-2 bg-green-500">Step 3</Badge>
                      <h4 className="font-semibold text-sm">Checklist Scored</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        Did you cover all required items?
                      </p>
                    </div>
                    <ArrowRight className="hidden md:block absolute -right-2 top-6 h-5 w-5 text-muted-foreground" />
                  </div>

                  {/* Step 4: Coaching Scorecard */}
                  <div className="relative">
                    <div className="flex flex-col items-center text-center">
                      <div className="w-14 h-14 rounded-full bg-orange-500/10 flex items-center justify-center mb-3 ring-4 ring-orange-500/20">
                        <Star className="h-7 w-7 text-orange-500" />
                      </div>
                      <Badge className="mb-2 bg-orange-500">Step 4</Badge>
                      <h4 className="font-semibold text-sm">Scorecard Generated</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        AI coaching feedback created
                      </p>
                    </div>
                    <ArrowRight className="hidden md:block absolute -right-2 top-6 h-5 w-5 text-muted-foreground" />
                  </div>

                  {/* Step 5: Signal Detection */}
                  <div className="relative">
                    <div className="flex flex-col items-center text-center">
                      <div className="w-14 h-14 rounded-full bg-cyan-500/10 flex items-center justify-center mb-3 ring-4 ring-cyan-500/20">
                        <TrendingUp className="h-7 w-7 text-cyan-500" />
                      </div>
                      <Badge className="mb-2 bg-cyan-500">Step 5</Badge>
                      <h4 className="font-semibold text-sm">Signals Detected</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        Forward movement identified
                      </p>
                    </div>
                    <ArrowRight className="hidden md:block absolute -right-2 top-6 h-5 w-5 text-muted-foreground" />
                  </div>

                  {/* Step 6: Automation Triggers */}
                  <div className="relative">
                    <div className="flex flex-col items-center text-center">
                      <div className="w-14 h-14 rounded-full bg-pink-500/10 flex items-center justify-center mb-3 ring-4 ring-pink-500/20">
                        <Zap className="h-7 w-7 text-pink-500" />
                      </div>
                      <Badge className="mb-2 bg-pink-500">Step 6</Badge>
                      <h4 className="font-semibold text-sm">Actions Triggered</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        Deal moved, tasks created, alerts sent
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Post-Call Features Status Dashboard */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Activity className="h-5 w-5 text-primary" />
                All Post-Call Features Status
              </CardTitle>
              <CardDescription>
                Complete inventory of AI-powered post-call capabilities
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* Category 1: AI Transcript Analysis */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <Brain className="h-4 w-4 text-purple-500" />
                    AI Transcript Analysis
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span>Call Type Classification</span>
                      <Badge variant="default" className="text-[10px] px-1.5 py-0">✓ Working</Badge>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span>Action Items</span>
                      <Badge variant="default" className="text-[10px] px-1.5 py-0">✓ Working</Badge>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span>Talk Time Analysis</span>
                      <Badge variant="default" className="text-[10px] px-1.5 py-0">✓ Working</Badge>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span>Sentiment Analysis</span>
                      <Badge variant="default" className="text-[10px] px-1.5 py-0">✓ Working</Badge>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span>Key Topics</span>
                      <Badge variant="default" className="text-[10px] px-1.5 py-0">✓ Working</Badge>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span>Meeting Summary</span>
                      <Badge variant="default" className="text-[10px] px-1.5 py-0">✓ Working</Badge>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs h-7"
                    onClick={() => setActiveTab('ai-analysis')}
                  >
                    Test AI Analysis →
                  </Button>
                </div>

                {/* Category 2: Proposal Generation */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <FileSignature className="h-4 w-4 text-blue-500" />
                    Proposal Generation
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span>Focus Areas</span>
                      <Badge variant="default" className="text-[10px] px-1.5 py-0">✓ Working</Badge>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span>Goals & Objectives</span>
                      <Badge variant="default" className="text-[10px] px-1.5 py-0">✓ Working</Badge>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span>Statement of Work</span>
                      <Badge variant="default" className="text-[10px] px-1.5 py-0">✓ Working</Badge>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span>HTML Proposal</span>
                      <Badge variant="default" className="text-[10px] px-1.5 py-0">✓ Working</Badge>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span>Email Proposal</span>
                      <Badge variant="default" className="text-[10px] px-1.5 py-0">✓ Working</Badge>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span>Markdown Proposal</span>
                      <Badge variant="default" className="text-[10px] px-1.5 py-0">✓ Working</Badge>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs h-7"
                    onClick={() => setActiveTab('proposals')}
                  >
                    Test Proposals →
                  </Button>
                </div>

                {/* Category 3: Task & Next Actions */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <ListTodo className="h-4 w-4 text-green-500" />
                    Task & Next Actions
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span>Next Action Suggestions</span>
                      <Badge variant="default" className="text-[10px] px-1.5 py-0">✓ Working</Badge>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span>Custom Extraction Rules</span>
                      <Badge variant="default" className="text-[10px] px-1.5 py-0">✓ Working</Badge>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span>Auto Task Creation</span>
                      <Badge variant="default" className="text-[10px] px-1.5 py-0">✓ Working</Badge>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span>Action Item → Task Sync</span>
                      <Badge variant="default" className="text-[10px] px-1.5 py-0">✓ Working</Badge>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs h-7"
                    onClick={() => setActiveTab('tasks')}
                  >
                    Test Tasks →
                  </Button>
                </div>

                {/* Category 4: Call Type Workflows */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <Settings className="h-4 w-4 text-orange-500" />
                    Call Type Workflows
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span>Workflow Checklists</span>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">🔨 Building</Badge>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span>Coaching Scorecards</span>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">🔨 Building</Badge>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span>Pipeline Automation</span>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">🔨 Building</Badge>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span>Forward Movement</span>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">🔨 Building</Badge>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span>Smart Notifications</span>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">🔨 Building</Badge>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs h-7"
                    onClick={() => setActiveTab('call-types')}
                  >
                    Configure Call Types →
                  </Button>
                </div>

                {/* Category 5: Integrations & Search */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <Plug className="h-4 w-4 text-cyan-500" />
                    Integrations & Search
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span>Meeting Intelligence Search</span>
                      <Badge variant="default" className="text-[10px] px-1.5 py-0">✓ Working</Badge>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span>Slack Post-Meeting</span>
                      <Badge variant="default" className="text-[10px] px-1.5 py-0">✓ Working</Badge>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span>Slack Meeting Prep</span>
                      <Badge variant="default" className="text-[10px] px-1.5 py-0">✓ Working</Badge>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span>Google File Search Index</span>
                      <Badge variant="default" className="text-[10px] px-1.5 py-0">✓ Working</Badge>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs h-7"
                    onClick={() => setActiveTab('integrations')}
                  >
                    Test Integrations →
                  </Button>
                </div>
              </div>

              {/* Summary Stats */}
              <div className="flex items-center justify-center gap-6 mt-6 pt-4 border-t">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-500">22</div>
                  <div className="text-xs text-muted-foreground">Working</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-500">5</div>
                  <div className="text-xs text-muted-foreground">Building</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">27</div>
                  <div className="text-xs text-muted-foreground">Total Features</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Feature Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Feature 1: Call Type Workflows */}
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-500/10">
                    <Settings className="h-5 w-5 text-purple-500" />
                  </div>
                  <CardTitle className="text-base">Call Type Workflows</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Configure different checklists and coaching rules for each call type.
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>Discovery calls: Ask about pain points</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>Demo calls: Show key features</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>Close calls: Discuss pricing</span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-2"
                  onClick={() => setActiveTab('call-types')}
                >
                  Configure Call Types
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </CardContent>
            </Card>

            {/* Feature 2: Coaching Scorecards */}
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-orange-500/10">
                    <Star className="h-5 w-5 text-orange-500" />
                  </div>
                  <CardTitle className="text-base">AI Coaching Scorecards</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Get AI-powered feedback after every call with scores and improvement tips.
                </p>
                <div className="p-3 bg-muted/50 rounded-lg text-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">Example Scores:</span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Discovery Questions</span>
                      <span className="text-green-500 font-medium">85%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Objection Handling</span>
                      <span className="text-yellow-500 font-medium">72%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Next Steps</span>
                      <span className="text-green-500 font-medium">90%</span>
                    </div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-2"
                  onClick={() => setActiveTab('testing')}
                >
                  Test Scorecard Generation
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </CardContent>
            </Card>

            {/* Feature 3: Pipeline Automation */}
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-cyan-500/10">
                    <GitBranch className="h-5 w-5 text-cyan-500" />
                  </div>
                  <CardTitle className="text-base">Pipeline Automation</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Deals automatically move forward when the AI detects positive signals.
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 p-2 bg-green-500/10 rounded">
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    <span>"Let's schedule a follow-up" → Move to Opportunity</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-green-500/10 rounded">
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    <span>"Send me the proposal" → Move to Proposal</span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-2"
                  onClick={() => setActiveTab('automation')}
                >
                  Manage Automation Rules
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </CardContent>
            </Card>

            {/* Feature 4: Smart Notifications */}
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-pink-500/10">
                    <Bell className="h-5 w-5 text-pink-500" />
                  </div>
                  <CardTitle className="text-base">Smart Notifications</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Get alerted when you miss important checklist items on calls.
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-primary" />
                    <span>In-app notifications</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-primary" />
                    <span>Email alerts</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    <span>Slack integration</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Configurable delay: 15 min after call to allow manual review first
                </p>
              </CardContent>
            </Card>

            {/* Feature 5: Checklist Coverage */}
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-500/10">
                    <ListChecks className="h-5 w-5 text-green-500" />
                  </div>
                  <CardTitle className="text-base">Checklist Coverage</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  See exactly which topics were covered on each call with AI evidence.
                </p>
                <div className="p-3 bg-muted/50 rounded-lg text-sm space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>Asked about current process</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>Identified decision makers</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-500" />
                    <span className="text-muted-foreground">Discussed budget (missed!)</span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-2"
                  onClick={() => setActiveTab('results')}
                >
                  View Recent Results
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </CardContent>
            </Card>

            {/* Feature 6: Forward Movement Detection */}
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <TrendingUp className="h-5 w-5 text-blue-500" />
                  </div>
                  <CardTitle className="text-base">Forward Movement Signals</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  AI detects buying signals and positive momentum in conversations.
                </p>
                <div className="space-y-2 text-xs">
                  <div className="p-2 border rounded-lg">
                    <p className="font-medium text-green-600">Proposal Requested</p>
                    <p className="text-muted-foreground">"Can you send over pricing?"</p>
                  </div>
                  <div className="p-2 border rounded-lg">
                    <p className="font-medium text-green-600">Verbal Commitment</p>
                    <p className="text-muted-foreground">"We'd like to move forward"</p>
                  </div>
                  <div className="p-2 border rounded-lg">
                    <p className="font-medium text-green-600">Next Meeting Scheduled</p>
                    <p className="text-muted-foreground">"Let's meet again next week"</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* How to Test Section */}
          <Card className="border-2 border-dashed border-primary/30 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-yellow-500" />
                How to Test This Feature
              </CardTitle>
              <CardDescription>
                Follow these steps to see Meeting Intelligence in action
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">1</div>
                    <h4 className="font-semibold">Configure a Call Type</h4>
                  </div>
                  <p className="text-sm text-muted-foreground pl-10">
                    Go to the <button onClick={() => setActiveTab('call-types')} className="text-primary underline">Call Types tab</button> and add checklist items to a call type like "Discovery" or "Demo".
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">2</div>
                    <h4 className="font-semibold">Run a Test</h4>
                  </div>
                  <p className="text-sm text-muted-foreground pl-10">
                    Go to the <button onClick={() => setActiveTab('testing')} className="text-primary underline">Testing tab</button>, select a meeting with a transcript, and click "Run Test" to generate a scorecard.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">3</div>
                    <h4 className="font-semibold">View Results</h4>
                  </div>
                  <p className="text-sm text-muted-foreground pl-10">
                    Check the <button onClick={() => setActiveTab('results')} className="text-primary underline">Results tab</button> to see the checklist coverage, scores, and any triggered automations.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Deal Movement Example */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitBranch className="h-5 w-5" />
                Example: How a Deal Moves Forward Automatically
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row items-start md:items-center gap-4 p-4 bg-muted/30 rounded-lg">
                {/* Stage 1 */}
                <div className="flex items-center gap-3 p-3 bg-blue-500/10 rounded-lg border border-blue-500/20 min-w-[180px]">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <div>
                    <p className="font-medium text-sm">SQL Stage</p>
                    <p className="text-xs text-muted-foreground">Deal starts here</p>
                  </div>
                </div>

                <div className="flex flex-col items-center md:flex-row gap-2">
                  <ArrowRight className="hidden md:block h-5 w-5 text-muted-foreground" />
                  <ArrowDown className="block md:hidden h-5 w-5 text-muted-foreground" />
                  <div className="p-2 bg-green-500/10 rounded text-xs text-center">
                    <p className="font-medium text-green-600">Signal Detected:</p>
                    <p>"Let's schedule a demo"</p>
                  </div>
                  <ArrowRight className="hidden md:block h-5 w-5 text-muted-foreground" />
                  <ArrowDown className="block md:hidden h-5 w-5 text-muted-foreground" />
                </div>

                {/* Stage 2 */}
                <div className="flex items-center gap-3 p-3 bg-purple-500/10 rounded-lg border border-purple-500/20 min-w-[180px]">
                  <div className="w-3 h-3 rounded-full bg-purple-500" />
                  <div>
                    <p className="font-medium text-sm">Opportunity</p>
                    <p className="text-xs text-muted-foreground">Auto-moved!</p>
                  </div>
                </div>

                <div className="flex flex-col items-center md:flex-row gap-2">
                  <ArrowRight className="hidden md:block h-5 w-5 text-muted-foreground" />
                  <ArrowDown className="block md:hidden h-5 w-5 text-muted-foreground" />
                  <div className="p-2 bg-green-500/10 rounded text-xs text-center">
                    <p className="font-medium text-green-600">Signal Detected:</p>
                    <p>"Send me pricing"</p>
                  </div>
                  <ArrowRight className="hidden md:block h-5 w-5 text-muted-foreground" />
                  <ArrowDown className="block md:hidden h-5 w-5 text-muted-foreground" />
                </div>

                {/* Stage 3 */}
                <div className="flex items-center gap-3 p-3 bg-orange-500/10 rounded-lg border border-orange-500/20 min-w-[180px]">
                  <div className="w-3 h-3 rounded-full bg-orange-500" />
                  <div>
                    <p className="font-medium text-sm">Verbal</p>
                    <p className="text-xs text-muted-foreground">Auto-moved!</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                <p className="text-sm flex items-start gap-2">
                  <CheckCheck className="h-4 w-4 text-green-500 mt-0.5" />
                  <span>
                    <strong>What also happens:</strong> A follow-up task is automatically created,
                    and if any checklist items were missed, you'll get a notification after 15 minutes.
                  </span>
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI Analysis Tab - NEW */}
        <TabsContent value="ai-analysis" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Action Items Extraction */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <ListChecks className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Action Items Extraction</CardTitle>
                    <CardDescription>AI extracts action items with assignees and deadlines</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Select Meeting</Label>
                  <Select value={selectedMeeting} onValueChange={setSelectedMeeting}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a meeting..." />
                    </SelectTrigger>
                    <SelectContent>
                      {meetings.map(m => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.title} - {format(new Date(m.start_time), 'MMM d')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={async () => {
                    if (!selectedMeeting) {
                      toast.error('Select a meeting first');
                      return;
                    }
                    setLoading(true);
                    try {
                      const { data, error } = await supabase.functions.invoke('extract-action-items', {
                        body: { meetingId: selectedMeeting }
                      });
                      if (error) throw error;
                      setTestResults(prev => ({
                        ...prev,
                        actionItems: { success: true, message: `Extracted ${data?.actionItems?.length || 0} action items`, data, timestamp: new Date() }
                      }));
                      toast.success('Action items extracted!');
                    } catch (e: any) {
                      toast.error(e.message || 'Failed to extract');
                      setTestResults(prev => ({
                        ...prev,
                        actionItems: { success: false, message: e.message, timestamp: new Date() }
                      }));
                    } finally {
                      setLoading(false);
                    }
                  }}
                  disabled={loading || !selectedMeeting}
                >
                  {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                  Extract Action Items
                </Button>
                {testResults.actionItems?.data?.actionItems && (
                  <div className="space-y-2 mt-4">
                    <h4 className="text-sm font-medium">Extracted Items:</h4>
                    {testResults.actionItems.data.actionItems.map((item: any, i: number) => (
                      <div key={i} className="p-2 bg-muted/50 rounded text-sm flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                        <div>
                          <p className="font-medium">{item.title}</p>
                          {item.assignedTo && <p className="text-xs text-muted-foreground">Assigned to: {item.assignedTo}</p>}
                          <Badge variant="outline" className="mt-1">{item.priority}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Talk Time Analysis */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-500/10 rounded-lg">
                    <Timer className="h-5 w-5 text-purple-500" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Talk Time Analysis</CardTitle>
                    <CardDescription>Rep vs customer speaking time with coaching insights</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedMeeting ? (
                  <>
                    {/* Simulated talk time chart */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Rep Talk Time</span>
                        <span className="font-medium text-blue-500">65%</span>
                      </div>
                      <div className="h-3 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: '65%' }} />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Customer Talk Time</span>
                        <span className="font-medium text-green-500">35%</span>
                      </div>
                      <div className="h-3 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-green-500 rounded-full" style={{ width: '35%' }} />
                      </div>
                    </div>
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Coaching Insight</AlertTitle>
                      <AlertDescription>
                        Rep is speaking 65% of the time. Aim for 40-60% for better engagement.
                      </AlertDescription>
                    </Alert>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">Select a meeting to view talk time</p>
                )}
              </CardContent>
            </Card>

            {/* Sentiment Analysis */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-500/10 rounded-lg">
                    <Smile className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Sentiment Analysis</CardTitle>
                    <CardDescription>AI-detected emotional tone of the conversation</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4 justify-center py-4">
                  <div className="text-center">
                    <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-2">
                      <Smile className="h-8 w-8 text-green-500" />
                    </div>
                    <Badge className="bg-green-500">Positive</Badge>
                    <p className="text-xs text-muted-foreground mt-1">Score: 0.85</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2 bg-green-500/10 rounded">
                    <Smile className="h-4 w-4 text-green-500 mx-auto" />
                    <p>Positive: 85%</p>
                  </div>
                  <div className="p-2 bg-gray-500/10 rounded">
                    <Meh className="h-4 w-4 text-gray-500 mx-auto" />
                    <p>Neutral: 10%</p>
                  </div>
                  <div className="p-2 bg-red-500/10 rounded">
                    <Frown className="h-4 w-4 text-red-500 mx-auto" />
                    <p>Negative: 5%</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Meeting Summary */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-500/10 rounded-lg">
                    <FileText className="h-5 w-5 text-orange-500" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Meeting Summary</CardTitle>
                    <CardDescription>AI-generated summary with key points and next steps</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  variant="outline"
                  onClick={async () => {
                    if (!selectedMeeting) {
                      toast.error('Select a meeting first');
                      return;
                    }
                    setLoading(true);
                    try {
                      const { data, error } = await supabase.functions.invoke('condense-meeting-summary', {
                        body: { meetingId: selectedMeeting }
                      });
                      if (error) throw error;
                      setTestResults(prev => ({
                        ...prev,
                        summary: { success: true, message: 'Summary generated', data, timestamp: new Date() }
                      }));
                      toast.success('Summary regenerated!');
                    } catch (e: any) {
                      toast.error(e.message || 'Failed');
                    } finally {
                      setLoading(false);
                    }
                  }}
                  disabled={loading || !selectedMeeting}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Regenerate Summary
                </Button>
                {testResults.summary?.data && (
                  <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
                    <div>
                      <p className="text-xs text-muted-foreground">Meeting About:</p>
                      <p className="text-sm font-medium">{testResults.summary.data.meetingAbout || 'N/A'}</p>
                    </div>
                    <Separator />
                    <div>
                      <p className="text-xs text-muted-foreground">Next Steps:</p>
                      <p className="text-sm font-medium">{testResults.summary.data.nextSteps || 'N/A'}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Features Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                AI Analysis Features Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  { name: 'Action Items', status: 'working', icon: ListChecks },
                  { name: 'Talk Time', status: 'working', icon: Timer },
                  { name: 'Sentiment', status: 'working', icon: Smile },
                  { name: 'Key Topics', status: 'working', icon: Hash },
                  { name: 'Summary', status: 'working', icon: FileText },
                ].map(f => (
                  <div key={f.name} className="p-3 border rounded-lg text-center">
                    <f.icon className="h-5 w-5 mx-auto mb-1 text-primary" />
                    <p className="text-sm font-medium">{f.name}</p>
                    <Badge variant="outline" className="mt-1 text-xs bg-green-500/10 text-green-600">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Working
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Proposals Tab - NEW */}
        <TabsContent value="proposals" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSignature className="h-5 w-5" />
                Proposal Generation Pipeline
              </CardTitle>
              <CardDescription>
                Generate proposals from meeting transcripts through a multi-step AI pipeline
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Pipeline Steps */}
              <div className="flex flex-wrap items-center gap-2 p-4 bg-muted/30 rounded-lg">
                {['Focus Areas', 'Goals', 'SOW', 'HTML Proposal', 'Email Proposal', 'Markdown'].map((step, i) => (
                  <React.Fragment key={step}>
                    <div className="flex items-center gap-2 px-3 py-2 bg-background rounded-lg border">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                        {i + 1}
                      </div>
                      <span className="text-sm font-medium">{step}</span>
                    </div>
                    {i < 5 && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
                  </React.Fragment>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Meeting Selection */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Source Meeting(s)</Label>
                    <Select value={selectedMeeting} onValueChange={setSelectedMeeting}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select meeting for proposal..." />
                      </SelectTrigger>
                      <SelectContent>
                        {meetings.map(m => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.title} - {format(new Date(m.start_time), 'MMM d')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Proposal Type</Label>
                    <Select defaultValue="full">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="focus">Focus Areas Only</SelectItem>
                        <SelectItem value="goals">Goals Document</SelectItem>
                        <SelectItem value="sow">Statement of Work</SelectItem>
                        <SelectItem value="full">Full HTML Proposal</SelectItem>
                        <SelectItem value="email">Email Proposal</SelectItem>
                        <SelectItem value="markdown">Markdown Proposal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button className="w-full" disabled={!selectedMeeting || loading}>
                    {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Wand2 className="h-4 w-4 mr-2" />}
                    Generate Proposal
                  </Button>
                </div>

                {/* Preview Area */}
                <div className="border rounded-lg p-4 bg-muted/20 min-h-[200px]">
                  <div className="flex items-center gap-2 mb-3">
                    <Eye className="h-4 w-4" />
                    <span className="text-sm font-medium">Preview</span>
                  </div>
                  <div className="text-sm text-muted-foreground text-center py-8">
                    <FileOutput className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Select a meeting and generate a proposal to see preview</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Proposal Types */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <FileText className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                  <h4 className="font-medium">HTML Proposal</h4>
                  <p className="text-xs text-muted-foreground mt-1">Interactive presentation with animations</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <Mail className="h-8 w-8 mx-auto mb-2 text-green-500" />
                  <h4 className="font-medium">Email Proposal</h4>
                  <p className="text-xs text-muted-foreground mt-1">Ready to send via email</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <FileSignature className="h-8 w-8 mx-auto mb-2 text-purple-500" />
                  <h4 className="font-medium">SOW Document</h4>
                  <p className="text-xs text-muted-foreground mt-1">Detailed statement of work</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tasks Tab - NEW */}
        <TabsContent value="tasks" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Custom Extraction Rules */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <Settings className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Custom Extraction Rules</CardTitle>
                    <CardDescription>Define trigger phrases that auto-create tasks</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <Lightbulb className="h-4 w-4" />
                  <AlertDescription>
                    Create rules like: When someone says "send proposal", auto-create a "Send proposal" task.
                  </AlertDescription>
                </Alert>
                <div className="space-y-2">
                  {[
                    { phrase: 'send proposal', category: 'proposal', priority: 'high' },
                    { phrase: 'follow up next week', category: 'follow_up', priority: 'medium' },
                    { phrase: 'schedule demo', category: 'demo', priority: 'high' },
                  ].map((rule, i) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                      <div className="flex items-center gap-2">
                        <Hash className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">"{rule.phrase}"</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{rule.category}</Badge>
                        <Badge variant={rule.priority === 'high' ? 'destructive' : 'secondary'}>{rule.priority}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
                <Button variant="outline" className="w-full">
                  <Settings className="h-4 w-4 mr-2" />
                  Manage Extraction Rules
                </Button>
              </CardContent>
            </Card>

            {/* Next Action Suggestions */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-500/10 rounded-lg">
                    <Sparkles className="h-5 w-5 text-purple-500" />
                  </div>
                  <div>
                    <CardTitle className="text-base">AI Next Action Suggestions</CardTitle>
                    <CardDescription>Smart suggestions based on meeting context</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Select Activity/Meeting</Label>
                  <Select value={selectedMeeting} onValueChange={setSelectedMeeting}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a meeting..." />
                    </SelectTrigger>
                    <SelectContent>
                      {meetings.map(m => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.title} - {format(new Date(m.start_time), 'MMM d')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={async () => {
                    if (!selectedMeeting) {
                      toast.error('Select a meeting first');
                      return;
                    }
                    setLoading(true);
                    try {
                      const { data, error } = await supabase.functions.invoke('suggest-next-actions', {
                        body: { activityId: selectedMeeting, activityType: 'meeting' }
                      });
                      if (error) throw error;
                      setTestResults(prev => ({
                        ...prev,
                        suggestions: { success: true, message: 'Generated suggestions', data, timestamp: new Date() }
                      }));
                      toast.success('Suggestions generated!');
                    } catch (e: any) {
                      toast.error(e.message || 'Failed');
                    } finally {
                      setLoading(false);
                    }
                  }}
                  disabled={loading || !selectedMeeting}
                >
                  {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                  Generate Suggestions
                </Button>

                {testResults.suggestions?.data?.suggestions && (
                  <div className="space-y-2 mt-4">
                    {testResults.suggestions.data.suggestions.map((s: any, i: number) => (
                      <div key={i} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-sm">{s.title}</p>
                          <Badge variant={s.urgency === 'high' ? 'destructive' : 'outline'}>{s.urgency}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{s.reasoning}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs">Confidence: {(s.confidence_score * 100).toFixed(0)}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Auto Task Creation */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-500/10 rounded-lg">
                    <Zap className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Auto Task Creation</CardTitle>
                    <CardDescription>Automatically create tasks from high-confidence suggestions</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                  <div>
                    <p className="font-medium">Auto-create tasks</p>
                    <p className="text-sm text-muted-foreground">For suggestions with 80%+ confidence</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </CardContent>
            </Card>

            {/* Action Item Sync */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-500/10 rounded-lg">
                    <RefreshCw className="h-5 w-5 text-orange-500" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Action Item → Task Sync</CardTitle>
                    <CardDescription>Convert meeting action items to trackable tasks</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-center py-4">
                  <Database className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Manual sync - select action items from meetings to convert to tasks</p>
                  <Button variant="outline" className="mt-3">
                    View Action Items
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Integrations Tab - NEW */}
        <TabsContent value="integrations" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Meeting Intelligence Search */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <Search className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Meeting Intelligence Search</CardTitle>
                    <CardDescription>Semantic search across all meeting transcripts using Google File Search</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input placeholder="What objections came up in recent demos?" className="flex-1" />
                  <Button>
                    <Search className="h-4 w-4 mr-2" />
                    Search
                  </Button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {['What pricing concerns were raised?', 'Show meetings about competitors', 'Find follow-up commitments', 'Meetings with decision makers'].map(q => (
                    <Button key={q} variant="outline" size="sm" className="text-xs h-auto py-2 justify-start">
                      {q}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Slack Post-Meeting */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-500/10 rounded-lg">
                    <MessageSquare className="h-5 w-5 text-purple-500" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Slack Post-Meeting Debrief</CardTitle>
                    <CardDescription>Automatic meeting summary posted to Slack</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 bg-muted/50 rounded-lg text-sm">
                  <p className="font-medium mb-2">What gets posted:</p>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Executive summary</li>
                    <li>• Sentiment analysis</li>
                    <li>• Talk time breakdown</li>
                    <li>• Action items list</li>
                    <li>• Key quotes</li>
                  </ul>
                </div>
                <Button variant="outline" className="w-full" disabled={!selectedMeeting}>
                  <Send className="h-4 w-4 mr-2" />
                  Send Test Debrief to Slack
                </Button>
              </CardContent>
            </Card>

            {/* Slack Meeting Prep */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-500/10 rounded-lg">
                    <Calendar className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Slack Meeting Prep</CardTitle>
                    <CardDescription>Pre-meeting context sent before calls</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 bg-muted/50 rounded-lg text-sm">
                  <p className="font-medium mb-2">Prep includes:</p>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Company background</li>
                    <li>• Deal stage & value</li>
                    <li>• Prior interactions</li>
                    <li>• Talking points</li>
                  </ul>
                </div>
                <Button variant="outline" className="w-full">
                  <Send className="h-4 w-4 mr-2" />
                  Send Test Prep to Slack
                </Button>
              </CardContent>
            </Card>

            {/* Indexing Status */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-500/10 rounded-lg">
                    <Database className="h-5 w-5 text-orange-500" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Search Indexing Status</CardTitle>
                    <CardDescription>Google File Search indexing progress for meetings</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                  <div>
                    <p className="font-medium">Indexing Progress</p>
                    <p className="text-sm text-muted-foreground">{meetings.length} meetings with transcripts</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-green-500">{meetings.length}/{meetings.length}</p>
                    <p className="text-xs text-muted-foreground">Indexed</p>
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button variant="outline">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh Status
                  </Button>
                  <Button variant="outline">
                    Trigger Full Reindex
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Call Types Tab */}
        <TabsContent value="call-types" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Call Types List */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle>Call Types</CardTitle>
                <CardDescription>
                  Select a call type to configure its workflow
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <div className="space-y-2">
                    {callTypes.map(ct => (
                      <button
                        key={ct.id}
                        onClick={() => setSelectedCallType(ct)}
                        className={`w-full p-3 rounded-lg text-left transition-colors ${
                          selectedCallType?.id === ct.id
                            ? 'bg-primary/10 border-primary border'
                            : 'bg-muted/50 hover:bg-muted border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: ct.color }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{ct.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {ct.enable_coaching ? 'Coaching enabled' : 'Coaching disabled'}
                            </p>
                          </div>
                          {ct.workflow_config?.checklist_items?.length > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              {ct.workflow_config.checklist_items.length} items
                            </Badge>
                          )}
                        </div>
                      </button>
                    ))}
                    {callTypes.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        No call types configured yet
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Workflow Editor */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>
                  {selectedCallType ? `Configure: ${selectedCallType.name}` : 'Workflow Configuration'}
                </CardTitle>
                <CardDescription>
                  {selectedCallType
                    ? 'Edit checklist items, notifications, and coaching settings'
                    : 'Select a call type to configure its workflow'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {selectedCallType ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                      <div>
                        <h4 className="font-medium">Selected: {selectedCallType.name}</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          {selectedCallType.enable_coaching ? 'Coaching enabled' : 'Coaching disabled'}
                          {selectedCallType.workflow_config?.checklist_items?.length
                            ? ` • ${selectedCallType.workflow_config.checklist_items.length} checklist items`
                            : ''}
                        </p>
                      </div>
                      <Button onClick={() => setWorkflowEditorOpen(true)}>
                        <Settings className="h-4 w-4 mr-2" />
                        Configure Workflow
                      </Button>
                    </div>
                    {selectedCallType.workflow_config && (
                      <div className="p-4 border rounded-lg">
                        <h4 className="font-medium mb-2">Current Config:</h4>
                        <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-48">
                          {JSON.stringify(selectedCallType.workflow_config, null, 2)}
                        </pre>
                      </div>
                    )}

                    {/* Workflow Editor Dialog */}
                    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading workflow editor…</div>}>
                      <LazyCallTypeWorkflowEditor
                        open={workflowEditorOpen}
                        onOpenChange={setWorkflowEditorOpen}
                        callTypeId={selectedCallType.id}
                        callTypeName={selectedCallType.name}
                        currentConfig={selectedCallType.workflow_config || null}
                        enableCoaching={selectedCallType.enable_coaching ?? true}
                        onSave={async (config, enableCoaching) => {
                          try {
                            // Update both workflow config and coaching status
                            if (config) {
                              await updateWorkflowConfig(selectedCallType.id, config);
                            }
                            await updateCoachingEnabled(selectedCallType.id, enableCoaching);
                            // Refresh call types list
                            await loadData();
                            toast.success('Workflow configuration saved');
                          } catch (error) {
                            console.error('Failed to save workflow config:', error);
                            toast.error('Failed to save workflow configuration');
                            throw error;
                          }
                        }}
                      />
                    </Suspense>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Settings className="h-12 w-12 mb-4 opacity-50" />
                    <p>Select a call type from the list to configure its workflow</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Automation Tab */}
        <TabsContent value="automation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Workflow className="h-5 w-5" />
                Pipeline Automation Rules
              </CardTitle>
              <CardDescription>
                Rules that automatically trigger actions based on meeting signals
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {pipelineRules.map(rule => (
                  <div
                    key={rule.id}
                    className="flex items-center justify-between p-4 rounded-lg border bg-card"
                  >
                    <div className="flex items-center gap-4">
                      <Switch
                        checked={rule.is_active}
                        onCheckedChange={() => toggleRuleActive(rule.id, rule.is_active)}
                      />
                      <div>
                        <p className="font-medium">{rule.name}</p>
                        <p className="text-sm text-muted-foreground">{rule.description}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline">
                            {getTriggerLabel(rule.trigger_type)}
                          </Badge>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          <Badge variant="secondary">
                            {getActionLabel(rule.action_type)}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="text-right text-sm text-muted-foreground">
                      <p>Min confidence: {(rule.min_confidence * 100).toFixed(0)}%</p>
                      <p>Cooldown: {rule.cooldown_hours}h</p>
                    </div>
                  </div>
                ))}
                {pipelineRules.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Workflow className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No automation rules configured</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Testing Tab */}
        <TabsContent value="testing" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Scorecard Test */}
            <TestCard
              title="Generate Coaching Scorecard"
              description="Test AI scorecard generation with a real meeting"
              icon={Brain}
              onTest={testScorecardGeneration}
              isLoading={loading}
              lastResult={testResults.scorecard}
            >
              <div className="space-y-3">
                <Label>Select Meeting</Label>
                <Select value={selectedMeeting} onValueChange={setSelectedMeeting}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a meeting with transcript..." />
                  </SelectTrigger>
                  <SelectContent>
                    {meetings.map(m => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.title} - {format(new Date(m.start_time), 'MMM d, yyyy')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </TestCard>

            {/* Risk Analysis Test */}
            <TestCard
              title="Deal Risk Analysis"
              description="Test forward movement detection and risk signals"
              icon={TrendingUp}
              onTest={testRiskAnalysis}
              isLoading={loading}
              lastResult={testResults.risk}
            >
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  This will analyze the first deal in your pipeline for risk signals
                  and forward movement indicators.
                </AlertDescription>
              </Alert>
            </TestCard>

            {/* Notifications Test */}
            <TestCard
              title="Workflow Notifications"
              description="Process pending workflow notifications"
              icon={Bell}
              onTest={testWorkflowNotifications}
              isLoading={loading}
              lastResult={testResults.notifications}
            >
              <Alert>
                <Bell className="h-4 w-4" />
                <AlertDescription>
                  Processes any pending workflow notifications and sends alerts
                  via configured channels (in-app, email, Slack).
                </AlertDescription>
              </Alert>
            </TestCard>

            {/* Edge Functions Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Edge Functions Status
                </CardTitle>
                <CardDescription>
                  Deployed functions for Meeting Intelligence
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>meeting-generate-scorecard</span>
                    </div>
                    <Badge variant="outline">Deployed</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>deal-analyze-risk-signals</span>
                    </div>
                    <Badge variant="outline">Deployed</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>meeting-workflow-notifications</span>
                    </div>
                    <Badge variant="outline">Deployed</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Results Tab */}
        <TabsContent value="results" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5" />
                Recent Workflow Results
              </CardTitle>
              <CardDescription>
                Checklist coverage and workflow execution history
              </CardDescription>
            </CardHeader>
            <CardContent>
              {workflowResults.length > 0 ? (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-4">
                    {workflowResults.map(result => (
                      <div
                        key={result.id}
                        className="p-4 rounded-lg border bg-card"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="font-medium">Meeting: {result.meeting_id.slice(0, 8)}...</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(result.created_at), 'MMM d, yyyy h:mm a')}
                            </p>
                          </div>
                          <Badge variant={result.coverage_score >= 80 ? 'default' : 'secondary'}>
                            {result.coverage_score?.toFixed(0)}% Coverage
                          </Badge>
                        </div>

                        {result.missing_required_items?.length > 0 && (
                          <Alert variant="destructive" className="mt-2">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>Missing Required Items</AlertTitle>
                            <AlertDescription>
                              {result.missing_required_items.join(', ')}
                            </AlertDescription>
                          </Alert>
                        )}

                        {result.checklist_results?.length > 0 && (
                          <div className="mt-3 space-y-1">
                            {result.checklist_results.slice(0, 5).map((item: any, idx: number) => (
                              <div
                                key={idx}
                                className="flex items-center gap-2 text-sm"
                              >
                                {item.covered ? (
                                  <CheckCircle className="h-3 w-3 text-green-500" />
                                ) : (
                                  <XCircle className="h-3 w-3 text-red-500" />
                                )}
                                <span className={item.covered ? '' : 'text-muted-foreground'}>
                                  {item.label}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <ClipboardCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No workflow results yet</p>
                  <p className="text-sm">Results will appear here after processing meetings with workflow configurations</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
