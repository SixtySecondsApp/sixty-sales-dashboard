/**
 * Meeting Intelligence Demo Page
 *
 * Admin demo page for testing and configuring all Meeting Intelligence Phase 2 features:
 * - Call Type Workflow Configuration
 * - Pipeline Automation Rules
 * - Scorecard Generation Testing
 * - Workflow Results Inspection
 */

import React, { useState, useEffect, useCallback } from 'react';
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
  Eye,
  TestTube,
  Workflow,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

import { supabase } from '@/lib/supabase/clientV2';
import { useOrg } from '@/lib/contexts/OrgContext';
import { useAuth } from '@/lib/contexts/AuthContext';
import { CallTypeService, OrgCallType } from '@/lib/services/callTypeService';
import { useWorkflowResults, WorkflowConfig, WorkflowChecklistItem } from '@/lib/hooks/useWorkflowResults';
import CallTypeWorkflowEditor from '@/components/admin/CallTypeWorkflowEditor';

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
  const orgId = org?.id;

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

  // Load data
  const loadData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);

    try {
      // Load call types
      const types = await CallTypeService.getCallTypes(orgId);
      setCallTypes(types);

      // Load recent meetings with transcripts
      const { data: meetingsData } = await (supabase
        .from('meetings') as any)
        .select('id, title, start_time, call_type_id, transcript')
        .eq('org_id', orgId)
        .not('transcript', 'is', null)
        .order('start_time', { ascending: false })
        .limit(20);

      setMeetings((meetingsData || []).map((m: any) => ({
        ...m,
        has_transcript: !!m.transcript,
      })));

      // Load pipeline automation rules
      const { data: rulesData } = await (supabase
        .from('pipeline_automation_rules') as any)
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false });

      setPipelineRules(rulesData || []);

      // Load recent workflow results
      const { data: resultsData } = await (supabase
        .from('meeting_workflow_results') as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      setWorkflowResults(resultsData || []);

    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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

  if (!orgId) {
    return (
      <div className="p-6">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Organization Required</AlertTitle>
          <AlertDescription>Please select an organization to view this demo.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
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
                <p className="text-2xl font-bold">{meetings.length}</p>
                <p className="text-sm text-muted-foreground">Meetings w/ Transcripts</p>
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
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="call-types" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Call Types
          </TabsTrigger>
          <TabsTrigger value="automation" className="flex items-center gap-2">
            <Workflow className="h-4 w-4" />
            Automation
          </TabsTrigger>
          <TabsTrigger value="testing" className="flex items-center gap-2">
            <TestTube className="h-4 w-4" />
            Testing
          </TabsTrigger>
          <TabsTrigger value="results" className="flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4" />
            Results
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Feature Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Phase 2 Features
                </CardTitle>
                <CardDescription>
                  Meeting Intelligence enhancements for call type integration
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                    <div>
                      <p className="font-medium">Call Type Workflows</p>
                      <p className="text-sm text-muted-foreground">
                        Configure checklists and coaching settings per call type
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                    <div>
                      <p className="font-medium">Pipeline Automation</p>
                      <p className="text-sm text-muted-foreground">
                        Auto-advance stages based on forward movement signals
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                    <div>
                      <p className="font-medium">Workflow Notifications</p>
                      <p className="text-sm text-muted-foreground">
                        Multi-channel alerts for missing checklist items
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                    <div>
                      <p className="font-medium">AI Coaching Scorecards</p>
                      <p className="text-sm text-muted-foreground">
                        Enhanced scorecards with call-type-specific templates
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Quick Actions
                </CardTitle>
                <CardDescription>
                  Common tasks and navigation shortcuts
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full justify-between"
                  onClick={() => setActiveTab('call-types')}
                >
                  <span className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Configure Call Type Workflows
                  </span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-between"
                  onClick={() => setActiveTab('automation')}
                >
                  <span className="flex items-center gap-2">
                    <Workflow className="h-4 w-4" />
                    Manage Automation Rules
                  </span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-between"
                  onClick={() => setActiveTab('testing')}
                >
                  <span className="flex items-center gap-2">
                    <TestTube className="h-4 w-4" />
                    Test with Real Meeting
                  </span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-between"
                  onClick={() => window.open('/settings/call-types', '_blank')}
                >
                  <span className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Open Call Type Settings
                  </span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
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
                  <CallTypeWorkflowEditor
                    callType={selectedCallType}
                    onSave={async (config) => {
                      try {
                        await (supabase
                          .from('org_call_types') as any)
                          .update({ workflow_config: config })
                          .eq('id', selectedCallType.id);

                        toast.success('Workflow configuration saved');
                        loadData();
                      } catch (error) {
                        toast.error('Failed to save configuration');
                      }
                    }}
                    onCoachingToggle={async (enabled) => {
                      try {
                        await (supabase
                          .from('org_call_types') as any)
                          .update({ enable_coaching: enabled })
                          .eq('id', selectedCallType.id);

                        toast.success(`Coaching ${enabled ? 'enabled' : 'disabled'}`);
                        loadData();
                      } catch (error) {
                        toast.error('Failed to update coaching setting');
                      }
                    }}
                  />
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
                        <span className="flex items-center gap-2">
                          {m.title}
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(m.start_time), 'MMM d, yyyy')}
                          </span>
                        </span>
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
