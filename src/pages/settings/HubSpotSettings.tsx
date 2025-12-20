/**
 * HubSpotSettings Page
 *
 * Team admin page for configuring HubSpot integration settings.
 * Allows configuration of sync features, pipeline mapping, and field mapping.
 */

import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  GitBranch,
  Users,
  Briefcase,
  FileText,
  Brain,
  RefreshCw,
  Settings2,
  Zap,
  ExternalLink,
  AlertTriangle,
  Clock,
  ArrowRightLeft,
  CheckSquare,
  Play,
  Download,
  Calendar,
} from 'lucide-react';

import { PageContainer } from '@/components/layout/PageContainer';
import { useHubSpotIntegration } from '@/lib/hooks/useHubSpotIntegration';
import { useOrg } from '@/lib/contexts/OrgContext';
import { useIsOrgAdmin } from '@/contexts/UserPermissionsContext';
import { toast } from 'sonner';

// Sixty's 4-stage pipeline
const SIXTY_STAGES = [
  { value: 'sql', label: 'SQL (Sales Qualified Lead)' },
  { value: 'opportunity', label: 'Opportunity' },
  { value: 'verbal', label: 'Verbal' },
  { value: 'signed', label: 'Signed' },
];

// Default HubSpot deal stages (fallback if we can't fetch from HubSpot)
const DEFAULT_HUBSPOT_STAGES = [
  { value: 'appointmentscheduled', label: 'Appointment Scheduled' },
  { value: 'qualifiedtobuy', label: 'Qualified to Buy' },
  { value: 'presentationscheduled', label: 'Presentation Scheduled' },
  { value: 'decisionmakerboughtin', label: 'Decision Maker Bought-In' },
  { value: 'contractsent', label: 'Contract Sent' },
  { value: 'closedwon', label: 'Closed Won' },
  { value: 'closedlost', label: 'Closed Lost' },
];

// Time period options for initial sync
const SYNC_TIME_PERIODS = [
  { value: 'last_7_days', label: 'Last 7 Days', description: 'Quick test sync' },
  { value: 'last_30_days', label: 'Last 30 Days', description: 'Recent records' },
  { value: 'last_90_days', label: 'Last 90 Days', description: 'Quarter of data' },
  { value: 'last_year', label: 'Last Year', description: 'Full year' },
  { value: 'all_time', label: 'All Time', description: 'Complete history' },
];

// Sync direction options
const SYNC_DIRECTIONS = [
  { value: 'hubspot_to_sixty', label: 'HubSpot → Sixty', description: 'Import from HubSpot' },
  { value: 'sixty_to_hubspot', label: 'Sixty → HubSpot', description: 'Export to HubSpot' },
  { value: 'bidirectional', label: 'Bidirectional', description: 'Two-way sync' },
];

// Contact field mappings
const CONTACT_FIELDS = [
  { sixty: 'name', label: 'Name', hubspot: 'firstname,lastname' },
  { sixty: 'email', label: 'Email', hubspot: 'email' },
  { sixty: 'phone', label: 'Phone', hubspot: 'phone' },
  { sixty: 'company', label: 'Company', hubspot: 'company' },
  { sixty: 'title', label: 'Job Title', hubspot: 'jobtitle' },
];

// Deal field mappings
const DEAL_FIELDS = [
  { sixty: 'deal_value', label: 'Deal Value', hubspot: 'amount' },
  { sixty: 'mrr', label: 'Monthly Recurring Revenue', hubspot: 'hs_mrr' },
  { sixty: 'close_date', label: 'Close Date', hubspot: 'closedate' },
  { sixty: 'stage', label: 'Stage', hubspot: 'dealstage' },
];

// Task field mappings
const TASK_FIELDS = [
  { sixty: 'title', label: 'Title', hubspot: 'hs_task_subject' },
  { sixty: 'description', label: 'Description', hubspot: 'hs_task_body' },
  { sixty: 'due_date', label: 'Due Date', hubspot: 'hs_timestamp' },
  { sixty: 'status', label: 'Status', hubspot: 'hs_task_status' },
  { sixty: 'priority', label: 'Priority', hubspot: 'hs_task_priority' },
];

interface FeatureSettings {
  enabled: boolean;
  sync_direction?: string;
  create_missing?: boolean;
  field_mappings?: Record<string, string>;
  [key: string]: any;
}

interface HubSpotSettings {
  pipeline_mapping?: {
    enabled: boolean;
    hubspot_pipeline_id?: string;
    stage_mappings?: Record<string, string>;
    sync_direction?: string;
  };
  contact_sync?: FeatureSettings;
  deal_sync?: FeatureSettings;
  task_sync?: FeatureSettings;
  form_ingestion?: {
    enabled: boolean;
    enabled_forms?: string[];
    auto_create_contact?: boolean;
    default_assignee?: string;
  };
  ai_note_writeback?: {
    enabled: boolean;
    write_meeting_summaries?: boolean;
    write_action_items?: boolean;
    write_call_notes?: boolean;
    target?: 'timeline' | 'notes';
    frequency?: 'realtime' | 'batch';
  };
  user_mappings?: Record<string, string>;
}

function ConnectionStatusCard({
  integration,
  syncState,
  webhookUrl,
  onDisconnect,
  onRefresh,
  onReauthorize,
  isDisconnecting,
  isRefreshing,
}: {
  integration: any;
  syncState: any;
  webhookUrl: string | null;
  onDisconnect: () => void;
  onRefresh: () => void;
  onReauthorize: () => void;
  isDisconnecting: boolean;
  isRefreshing: boolean;
}) {
  const isConnected = Boolean(integration?.is_connected);
  const hubId = integration?.hubspot_hub_id || integration?.hubspot_portal_id;
  const accountName = integration?.hubspot_account_name;
  const connectedAt = integration?.connected_at;
  const lastSync = syncState?.last_sync_completed_at;
  const syncStatus = syncState?.sync_status || 'idle';
  const scopeCount = integration?.scopes?.length || 0;

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isConnected ? 'bg-green-500/10' : 'bg-destructive/10'}`}>
              {isConnected ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-destructive" />
              )}
            </div>
            <div>
              <CardTitle className="text-base">
                {isConnected ? 'HubSpot Connected' : 'HubSpot Not Connected'}
              </CardTitle>
              <CardDescription>
                {isConnected
                  ? `Hub ID: ${hubId}${accountName ? ` • ${accountName}` : ''}`
                  : 'Connect your HubSpot account to enable sync features'}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isConnected && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRefresh}
                  disabled={isRefreshing}
                >
                  {isRefreshing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onReauthorize}
                  className="text-amber-600 border-amber-600 hover:bg-amber-50"
                >
                  Re-authorize
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={onDisconnect}
                  disabled={isDisconnecting}
                >
                  {isDisconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Disconnect'}
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>

      {isConnected && (
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <Label className="text-muted-foreground text-xs">Status</Label>
              <div className="flex items-center gap-1.5 mt-1">
                <div
                  className={`h-2 w-2 rounded-full ${
                    syncStatus === 'syncing'
                      ? 'bg-amber-500 animate-pulse'
                      : syncStatus === 'error'
                      ? 'bg-destructive'
                      : 'bg-green-500'
                  }`}
                />
                <span className="capitalize">{syncStatus}</span>
              </div>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Scopes</Label>
              <p className="mt-1">{scopeCount} granted</p>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Connected</Label>
              <p className="mt-1">
                {connectedAt ? new Date(connectedAt).toLocaleDateString() : 'Unknown'}
              </p>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Last Sync</Label>
              <p className="mt-1">
                {lastSync ? new Date(lastSync).toLocaleString() : 'Never'}
              </p>
            </div>
          </div>

          {webhookUrl && (
            <div className="pt-2">
              <Label className="text-muted-foreground text-xs">Webhook URL</Label>
              <div className="flex items-center gap-2 mt-1">
                <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">
                  {webhookUrl}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(webhookUrl);
                    toast.success('Webhook URL copied');
                  }}
                >
                  Copy
                </Button>
              </div>
            </div>
          )}

          {syncState?.error_message && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{syncState.error_message}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
  enabled,
  onToggle,
  isUpdating,
  children,
}: {
  icon: any;
  title: string;
  description: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  isUpdating: boolean;
  children?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">{title}</CardTitle>
              <CardDescription className="text-sm">{description}</CardDescription>
            </div>
          </div>
          <Switch checked={enabled} onCheckedChange={onToggle} disabled={isUpdating} />
        </div>
      </CardHeader>
      {enabled && children && <CardContent className="space-y-4">{children}</CardContent>}
    </Card>
  );
}

function PipelineMappingCard({
  settings,
  onUpdate,
  isUpdating,
  hubspotPipelines,
  isLoadingStages,
}: {
  settings: HubSpotSettings['pipeline_mapping'];
  onUpdate: (settings: Partial<HubSpotSettings['pipeline_mapping']>) => void;
  isUpdating: boolean;
  hubspotPipelines: Array<{ id: string; label: string; stages: Array<{ id: string; label: string }> }>;
  isLoadingStages?: boolean;
}) {
  const enabled = settings?.enabled ?? false;
  const stageMappings = settings?.stage_mappings || {};
  const syncDirection = settings?.sync_direction || 'bidirectional';
  const selectedPipelineId = settings?.hubspot_pipeline_id || '';

  // Get stages for the selected pipeline
  const selectedPipeline = hubspotPipelines.find(p => p.id === selectedPipelineId) || hubspotPipelines[0];
  const hubspotStages = selectedPipeline?.stages?.map(s => ({ value: s.id, label: s.label })) || DEFAULT_HUBSPOT_STAGES;

  return (
    <FeatureCard
      icon={GitBranch}
      title="Pipeline & Stage Mapping"
      description="Map Sixty's 4-stage pipeline to your HubSpot deal stages"
      enabled={enabled}
      onToggle={(checked) => onUpdate({ enabled: checked })}
      isUpdating={isUpdating}
    >
      <div className="space-y-4">
        {/* Pipeline Selector */}
        <div className="space-y-2">
          <Label>HubSpot Pipeline</Label>
          {isLoadingStages ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading pipelines...
            </div>
          ) : hubspotPipelines.length === 0 ? (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                No pipelines found. Make sure your HubSpot account has deal pipelines configured.
              </AlertDescription>
            </Alert>
          ) : (
            <Select
              value={selectedPipelineId || hubspotPipelines[0]?.id || ''}
              onValueChange={(value) => {
                // Clear stage mappings when pipeline changes
                onUpdate({ hubspot_pipeline_id: value, stage_mappings: {} });
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a HubSpot pipeline..." />
              </SelectTrigger>
              <SelectContent>
                {hubspotPipelines.map((pipeline) => (
                  <SelectItem key={pipeline.id} value={pipeline.id}>
                    {pipeline.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <Separator />

        <div className="space-y-2">
          <Label>Sync Direction</Label>
          <RadioGroup
            value={syncDirection}
            onValueChange={(value) => onUpdate({ sync_direction: value })}
            className="grid grid-cols-3 gap-2"
          >
            {SYNC_DIRECTIONS.map((dir) => (
              <div key={dir.value}>
                <RadioGroupItem value={dir.value} id={`pipeline-${dir.value}`} className="peer sr-only" />
                <Label
                  htmlFor={`pipeline-${dir.value}`}
                  className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer text-center"
                >
                  <ArrowRightLeft className="mb-1 h-4 w-4" />
                  <span className="text-xs font-medium">{dir.label}</span>
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        <Separator />

        <div className="space-y-3">
          <Label>Stage Mappings</Label>
          {!selectedPipeline ? (
            <p className="text-sm text-muted-foreground">Select a pipeline above to configure stage mappings.</p>
          ) : (
            <div className="space-y-2">
              {SIXTY_STAGES.map((stage) => (
                <div key={stage.value} className="flex items-center gap-3">
                  <div className="w-1/3">
                    <Badge variant="outline" className="w-full justify-center">
                      {stage.label}
                    </Badge>
                  </div>
                  <ArrowRightLeft className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <Select
                    value={stageMappings[stage.value] || ''}
                    onValueChange={(value) =>
                      onUpdate({
                        stage_mappings: { ...stageMappings, [stage.value]: value },
                      })
                    }
                  >
                    <SelectTrigger className="w-2/3">
                      <SelectValue placeholder="Select HubSpot stage..." />
                    </SelectTrigger>
                    <SelectContent>
                      {hubspotStages.map((hs) => (
                        <SelectItem key={hs.value} value={hs.value}>
                          {hs.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </FeatureCard>
  );
}

function ContactSyncCard({
  settings,
  onUpdate,
  isUpdating,
}: {
  settings: HubSpotSettings['contact_sync'];
  onUpdate: (settings: Partial<FeatureSettings>) => void;
  isUpdating: boolean;
}) {
  const enabled = settings?.enabled ?? false;
  const syncDirection = settings?.sync_direction || 'bidirectional';
  const createMissing = settings?.create_missing ?? true;

  return (
    <FeatureCard
      icon={Users}
      title="Contact Sync"
      description="Synchronize contacts between Sixty and HubSpot"
      enabled={enabled}
      onToggle={(checked) => onUpdate({ enabled: checked })}
      isUpdating={isUpdating}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Sync Direction</Label>
          <RadioGroup
            value={syncDirection}
            onValueChange={(value) => onUpdate({ sync_direction: value })}
            className="grid grid-cols-3 gap-2"
          >
            {SYNC_DIRECTIONS.map((dir) => (
              <div key={dir.value}>
                <RadioGroupItem value={dir.value} id={`contact-${dir.value}`} className="peer sr-only" />
                <Label
                  htmlFor={`contact-${dir.value}`}
                  className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer text-center"
                >
                  <span className="text-xs font-medium">{dir.label}</span>
                  <span className="text-[10px] text-muted-foreground">{dir.description}</span>
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label>Create Missing Contacts</Label>
            <p className="text-xs text-muted-foreground">
              Automatically create contacts that don't exist in the target system
            </p>
          </div>
          <Switch
            checked={createMissing}
            onCheckedChange={(checked) => onUpdate({ create_missing: checked })}
            disabled={isUpdating}
          />
        </div>

        <Separator />

        <div className="space-y-2">
          <Label className="text-sm">Field Mappings</Label>
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-2 text-left font-medium">Sixty Field</th>
                  <th className="p-2 text-center font-medium">→</th>
                  <th className="p-2 text-left font-medium">HubSpot Property</th>
                </tr>
              </thead>
              <tbody>
                {CONTACT_FIELDS.map((field) => (
                  <tr key={field.sixty} className="border-b last:border-0">
                    <td className="p-2">{field.label}</td>
                    <td className="p-2 text-center text-muted-foreground">↔</td>
                    <td className="p-2">
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{field.hubspot}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </FeatureCard>
  );
}

function DealSyncCard({
  settings,
  onUpdate,
  isUpdating,
}: {
  settings: HubSpotSettings['deal_sync'];
  onUpdate: (settings: Partial<FeatureSettings>) => void;
  isUpdating: boolean;
}) {
  const enabled = settings?.enabled ?? false;
  const syncDirection = settings?.sync_direction || 'bidirectional';
  const createMissing = settings?.create_missing ?? true;

  return (
    <FeatureCard
      icon={Briefcase}
      title="Deal Sync"
      description="Synchronize deals and opportunities with HubSpot"
      enabled={enabled}
      onToggle={(checked) => onUpdate({ enabled: checked })}
      isUpdating={isUpdating}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Sync Direction</Label>
          <RadioGroup
            value={syncDirection}
            onValueChange={(value) => onUpdate({ sync_direction: value })}
            className="grid grid-cols-3 gap-2"
          >
            {SYNC_DIRECTIONS.map((dir) => (
              <div key={dir.value}>
                <RadioGroupItem value={dir.value} id={`deal-${dir.value}`} className="peer sr-only" />
                <Label
                  htmlFor={`deal-${dir.value}`}
                  className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer text-center"
                >
                  <span className="text-xs font-medium">{dir.label}</span>
                  <span className="text-[10px] text-muted-foreground">{dir.description}</span>
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label>Create Missing Deals</Label>
            <p className="text-xs text-muted-foreground">
              Automatically create deals that don't exist in the target system
            </p>
          </div>
          <Switch
            checked={createMissing}
            onCheckedChange={(checked) => onUpdate({ create_missing: checked })}
            disabled={isUpdating}
          />
        </div>

        <Separator />

        <div className="space-y-2">
          <Label className="text-sm">Field Mappings</Label>
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-2 text-left font-medium">Sixty Field</th>
                  <th className="p-2 text-center font-medium">→</th>
                  <th className="p-2 text-left font-medium">HubSpot Property</th>
                </tr>
              </thead>
              <tbody>
                {DEAL_FIELDS.map((field) => (
                  <tr key={field.sixty} className="border-b last:border-0">
                    <td className="p-2">{field.label}</td>
                    <td className="p-2 text-center text-muted-foreground">↔</td>
                    <td className="p-2">
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{field.hubspot}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Deal sync uses the Pipeline Mapping configuration above for stage synchronization.
          </AlertDescription>
        </Alert>
      </div>
    </FeatureCard>
  );
}

function TaskSyncCard({
  settings,
  onUpdate,
  isUpdating,
}: {
  settings: HubSpotSettings['task_sync'];
  onUpdate: (settings: Partial<FeatureSettings>) => void;
  isUpdating: boolean;
}) {
  const enabled = settings?.enabled ?? false;
  const syncDirection = settings?.sync_direction || 'bidirectional';
  const createMissing = settings?.create_missing ?? true;

  return (
    <FeatureCard
      icon={CheckSquare}
      title="Task Sync"
      description="Synchronize tasks between Sixty and HubSpot"
      enabled={enabled}
      onToggle={(checked) => onUpdate({ enabled: checked })}
      isUpdating={isUpdating}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Sync Direction</Label>
          <RadioGroup
            value={syncDirection}
            onValueChange={(value) => onUpdate({ sync_direction: value })}
            className="grid grid-cols-3 gap-2"
          >
            {SYNC_DIRECTIONS.map((dir) => (
              <div key={dir.value}>
                <RadioGroupItem value={dir.value} id={`task-${dir.value}`} className="peer sr-only" />
                <Label
                  htmlFor={`task-${dir.value}`}
                  className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer text-center"
                >
                  <span className="text-xs font-medium">{dir.label}</span>
                  <span className="text-[10px] text-muted-foreground">{dir.description}</span>
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label>Create Missing Tasks</Label>
            <p className="text-xs text-muted-foreground">
              Automatically create tasks that don't exist in the target system
            </p>
          </div>
          <Switch
            checked={createMissing}
            onCheckedChange={(checked) => onUpdate({ create_missing: checked })}
            disabled={isUpdating}
          />
        </div>

        <Separator />

        <div className="space-y-2">
          <Label className="text-sm">Field Mappings</Label>
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-2 text-left font-medium">Sixty Field</th>
                  <th className="p-2 text-center font-medium">→</th>
                  <th className="p-2 text-left font-medium">HubSpot Property</th>
                </tr>
              </thead>
              <tbody>
                {TASK_FIELDS.map((field) => (
                  <tr key={field.sixty} className="border-b last:border-0">
                    <td className="p-2">{field.label}</td>
                    <td className="p-2 text-center text-muted-foreground">↔</td>
                    <td className="p-2">
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{field.hubspot}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <Alert>
          <CheckSquare className="h-4 w-4" />
          <AlertDescription>
            Tasks are linked to contacts and deals based on associated records in both systems.
          </AlertDescription>
        </Alert>
      </div>
    </FeatureCard>
  );
}

function FormIngestionCard({
  settings,
  onUpdate,
  onPollForms,
  isUpdating,
  isPolling,
}: {
  settings: HubSpotSettings['form_ingestion'];
  onUpdate: (settings: Partial<HubSpotSettings['form_ingestion']>) => void;
  onPollForms: () => void;
  isUpdating: boolean;
  isPolling: boolean;
}) {
  const enabled = settings?.enabled ?? false;
  const autoCreateContact = settings?.auto_create_contact ?? true;
  const enabledForms = settings?.enabled_forms || [];

  return (
    <FeatureCard
      icon={FileText}
      title="Form Ingestion"
      description="Import form submissions from HubSpot as new leads"
      enabled={enabled}
      onToggle={(checked) => onUpdate({ enabled: checked })}
      isUpdating={isUpdating}
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label>Auto-create Contacts</Label>
            <p className="text-xs text-muted-foreground">
              Create a contact for each form submission
            </p>
          </div>
          <Switch
            checked={autoCreateContact}
            onCheckedChange={(checked) => onUpdate({ auto_create_contact: checked })}
            disabled={isUpdating}
          />
        </div>

        <Separator />

        <div className="flex items-center justify-between">
          <div>
            <Label>Poll Form Submissions</Label>
            <p className="text-xs text-muted-foreground">
              Manually trigger a poll for new form submissions
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={onPollForms} disabled={isPolling}>
            {isPolling ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Poll Now
          </Button>
        </div>

        {enabledForms.length === 0 && (
          <Alert>
            <FileText className="h-4 w-4" />
            <AlertDescription>
              No forms configured. Click "Poll Now" to fetch available forms from HubSpot.
            </AlertDescription>
          </Alert>
        )}
      </div>
    </FeatureCard>
  );
}

function AIWritebackCard({
  settings,
  onUpdate,
  isUpdating,
}: {
  settings: HubSpotSettings['ai_note_writeback'];
  onUpdate: (settings: Partial<HubSpotSettings['ai_note_writeback']>) => void;
  isUpdating: boolean;
}) {
  const enabled = settings?.enabled ?? false;
  const writeMeetingSummaries = settings?.write_meeting_summaries ?? true;
  const writeActionItems = settings?.write_action_items ?? true;
  const writeCallNotes = settings?.write_call_notes ?? false;
  const target = settings?.target || 'timeline';
  const frequency = settings?.frequency || 'realtime';

  return (
    <FeatureCard
      icon={Brain}
      title="AI Note Writeback"
      description="Automatically write AI-generated notes to HubSpot"
      enabled={enabled}
      onToggle={(checked) => onUpdate({ enabled: checked })}
      isUpdating={isUpdating}
    >
      <div className="space-y-4">
        <div className="space-y-3">
          <Label>What to Write</Label>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-blue-500" />
                <span className="text-sm">Meeting Summaries</span>
              </div>
              <Switch
                checked={writeMeetingSummaries}
                onCheckedChange={(checked) => onUpdate({ write_meeting_summaries: checked })}
                disabled={isUpdating}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <span className="text-sm">Action Items</span>
              </div>
              <Switch
                checked={writeActionItems}
                onCheckedChange={(checked) => onUpdate({ write_action_items: checked })}
                disabled={isUpdating}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-purple-500" />
                <span className="text-sm">Call Notes</span>
              </div>
              <Switch
                checked={writeCallNotes}
                onCheckedChange={(checked) => onUpdate({ write_call_notes: checked })}
                disabled={isUpdating}
              />
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          <Label>Write Target</Label>
          <RadioGroup
            value={target}
            onValueChange={(value) => onUpdate({ target: value as 'timeline' | 'notes' })}
            className="grid grid-cols-2 gap-2"
          >
            <div>
              <RadioGroupItem value="timeline" id="target-timeline" className="peer sr-only" />
              <Label
                htmlFor="target-timeline"
                className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer text-center"
              >
                <Zap className="mb-1 h-4 w-4" />
                <span className="text-xs font-medium">Timeline Activity</span>
                <span className="text-[10px] text-muted-foreground">Visible in contact timeline</span>
              </Label>
            </div>
            <div>
              <RadioGroupItem value="notes" id="target-notes" className="peer sr-only" />
              <Label
                htmlFor="target-notes"
                className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer text-center"
              >
                <FileText className="mb-1 h-4 w-4" />
                <span className="text-xs font-medium">Notes</span>
                <span className="text-[10px] text-muted-foreground">Stored as CRM notes</span>
              </Label>
            </div>
          </RadioGroup>
        </div>

        <div className="space-y-2">
          <Label>Frequency</Label>
          <RadioGroup
            value={frequency}
            onValueChange={(value) => onUpdate({ frequency: value as 'realtime' | 'batch' })}
            className="grid grid-cols-2 gap-2"
          >
            <div>
              <RadioGroupItem value="realtime" id="freq-realtime" className="peer sr-only" />
              <Label
                htmlFor="freq-realtime"
                className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer text-center"
              >
                <Zap className="mb-1 h-4 w-4" />
                <span className="text-xs font-medium">Real-time</span>
                <span className="text-[10px] text-muted-foreground">Write immediately</span>
              </Label>
            </div>
            <div>
              <RadioGroupItem value="batch" id="freq-batch" className="peer sr-only" />
              <Label
                htmlFor="freq-batch"
                className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer text-center"
              >
                <Clock className="mb-1 h-4 w-4" />
                <span className="text-xs font-medium">Daily Batch</span>
                <span className="text-[10px] text-muted-foreground">Write once per day</span>
              </Label>
            </div>
          </RadioGroup>
        </div>
      </div>
    </FeatureCard>
  );
}

function InitialSyncCard({
  onTriggerSync,
  isLoading,
}: {
  onTriggerSync: (syncType: 'deals' | 'contacts' | 'tasks', timePeriod: string) => void;
  isLoading: boolean;
}) {
  const [selectedSyncType, setSelectedSyncType] = useState<'deals' | 'contacts' | 'tasks'>('deals');
  const [selectedTimePeriod, setSelectedTimePeriod] = useState('last_30_days');

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 rounded-lg">
            <Download className="h-5 w-5 text-blue-500" />
          </div>
          <div>
            <CardTitle className="text-base">Initial Sync</CardTitle>
            <CardDescription className="text-sm">
              Import existing records from HubSpot to Sixty
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>What to Sync</Label>
            <Select value={selectedSyncType} onValueChange={(v) => setSelectedSyncType(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="deals">
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4" />
                    Deals
                  </div>
                </SelectItem>
                <SelectItem value="contacts">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Contacts
                  </div>
                </SelectItem>
                <SelectItem value="tasks">
                  <div className="flex items-center gap-2">
                    <CheckSquare className="h-4 w-4" />
                    Tasks
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Time Period</Label>
            <Select value={selectedTimePeriod} onValueChange={setSelectedTimePeriod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SYNC_TIME_PERIODS.map((period) => (
                  <SelectItem key={period.value} value={period.value}>
                    <div className="flex flex-col">
                      <span>{period.label}</span>
                      <span className="text-xs text-muted-foreground">{period.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="text-sm text-muted-foreground">
            <Calendar className="h-4 w-4 inline mr-1.5" />
            {selectedTimePeriod === 'all_time'
              ? 'Will sync all records from HubSpot'
              : `Will sync ${selectedSyncType} created in the ${SYNC_TIME_PERIODS.find((p) => p.value === selectedTimePeriod)?.label.toLowerCase()}`}
          </div>
          <Button
            onClick={() => onTriggerSync(selectedSyncType, selectedTimePeriod)}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            Run Sync
          </Button>
        </div>

        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            For large datasets (All Time), the sync will be processed in batches and may take several minutes.
            You can check progress in the sync status above.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}

export default function HubSpotSettings() {
  const navigate = useNavigate();
  const { activeOrg } = useOrg();
  const isAdmin = useIsOrgAdmin();
  const {
    status,
    integration,
    syncState,
    settings: rawSettings,
    webhookUrl,
    isConnected,
    canManage,
    loading,
    saving,
    disconnecting,
    refreshStatus,
    connectHubSpot,
    disconnect,
    saveSettings,
    triggerEnsureProperties,
    triggerPollForms,
    getProperties,
    getPipelines,
    triggerSync,
  } = useHubSpotIntegration();

  const [localSettings, setLocalSettings] = useState<HubSpotSettings>({});
  const [isPollingForms, setIsPollingForms] = useState(false);
  const [hasLocalChanges, setHasLocalChanges] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [hubspotPipelines, setHubspotPipelines] = useState<Array<{
    id: string;
    label: string;
    stages: Array<{ id: string; label: string }>;
  }>>([]);
  const [hubspotDealProperties, setHubspotDealProperties] = useState<Array<{
    name: string;
    label: string;
    type: string;
  }>>([]);
  const [loadingHubspotData, setLoadingHubspotData] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSavingRef = useRef(false);

  // Initialize local settings from server (only when no local changes pending)
  useEffect(() => {
    if (rawSettings && Object.keys(rawSettings).length > 0 && !hasLocalChanges && !isSavingRef.current) {
      setLocalSettings(rawSettings as HubSpotSettings);
    }
  }, [rawSettings, hasLocalChanges]);

  const updateSettings = useCallback(
    (section: keyof HubSpotSettings, updates: any) => {
      // Clear any pending save
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      setLocalSettings((prev) => {
        const newSettings = {
          ...prev,
          [section]: { ...(prev[section] || {}), ...updates },
        };

        // Mark as having local changes
        setHasLocalChanges(true);

        // Debounced save after 1 second of no changes
        saveTimeoutRef.current = setTimeout(async () => {
          isSavingRef.current = true;
          try {
            await saveSettings(newSettings);
            // Reset local changes flag after successful save
            setHasLocalChanges(false);
          } catch (e: any) {
            toast.error(e.message || 'Failed to save settings');
          } finally {
            isSavingRef.current = false;
          }
        }, 1000);

        return newSettings;
      });
    },
    [saveSettings]
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const handlePollForms = useCallback(async () => {
    setIsPollingForms(true);
    try {
      await triggerPollForms();
    } finally {
      setIsPollingForms(false);
    }
  }, [triggerPollForms]);

  const handleReauthorize = useCallback(async () => {
    try {
      // First disconnect, then reconnect
      await disconnect();
      await connectHubSpot();
    } catch (e: any) {
      toast.error(e.message || 'Failed to initiate re-authorization');
    }
  }, [connectHubSpot, disconnect]);

  const handleDisconnect = useCallback(async () => {
    try {
      await disconnect();
    } catch (e: any) {
      toast.error(e.message || 'Failed to disconnect HubSpot');
    }
  }, [disconnect]);

  const handleConnect = useCallback(async () => {
    try {
      await connectHubSpot();
    } catch (e: any) {
      toast.error(e.message || 'Failed to connect HubSpot');
    }
  }, [connectHubSpot]);

  const handleTriggerSync = useCallback(
    async (syncType: 'deals' | 'contacts' | 'tasks', timePeriod: string) => {
      setIsSyncing(true);
      try {
        await triggerSync({
          sync_type: syncType,
          time_period: timePeriod as any,
        });
      } catch (e: any) {
        toast.error(e.message || 'Failed to trigger sync');
      } finally {
        setIsSyncing(false);
      }
    },
    [triggerSync]
  );

  // Fetch HubSpot pipelines and properties when connected
  useEffect(() => {
    if (!isConnected) return;

    const fetchHubspotData = async () => {
      setLoadingHubspotData(true);
      try {
        // Fetch pipelines
        const pipelines = await getPipelines();
        setHubspotPipelines(pipelines);

        // Fetch deal properties
        const dealProps = await getProperties('deals');
        setHubspotDealProperties(dealProps);
      } catch (e: any) {
        console.error('Failed to fetch HubSpot data:', e);
        // Show error to user so they know what's happening
        toast.error(`Failed to load HubSpot data: ${e.message || 'Unknown error'}`);
      } finally {
        setLoadingHubspotData(false);
      }
    };

    fetchHubspotData();
  }, [isConnected, getPipelines, getProperties]);


  if (!canManage) {
    return (
      <PageContainer>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            You need to be an organization admin to configure HubSpot settings.
          </AlertDescription>
        </Alert>
      </PageContainer>
    );
  }

  if (loading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="space-y-6 pb-12">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">HubSpot Integration</h1>
            <p className="text-muted-foreground">
              Configure sync settings, pipeline mapping, and data flow between Sixty and HubSpot
            </p>
          </div>
          {isConnected && (
            <Button variant="outline" asChild>
              <a
                href={`https://app.hubspot.com/contacts/${integration?.hubspot_portal_id || integration?.hubspot_hub_id}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open HubSpot
              </a>
            </Button>
          )}
        </div>

        {/* Connection Status */}
        <ConnectionStatusCard
          integration={integration}
          syncState={syncState}
          webhookUrl={webhookUrl}
          onDisconnect={handleDisconnect}
          onRefresh={refreshStatus}
          onReauthorize={handleReauthorize}
          isDisconnecting={disconnecting}
          isRefreshing={loading}
        />

        {!isConnected ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Settings2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Connect HubSpot to Get Started</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Connect your HubSpot account to enable pipeline sync, contact sync, deal sync, form
                ingestion, and AI note writeback.
              </p>
              <Button onClick={handleConnect}>
                <Zap className="h-4 w-4 mr-2" />
                Connect HubSpot
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Ensure Properties Button */}
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={triggerEnsureProperties}>
                <Settings2 className="h-4 w-4 mr-2" />
                Ensure HubSpot Properties
              </Button>
            </div>

            {/* Feature Cards */}
            <PipelineMappingCard
              settings={localSettings.pipeline_mapping}
              onUpdate={(updates) => updateSettings('pipeline_mapping', updates)}
              isUpdating={saving}
              hubspotPipelines={hubspotPipelines}
              isLoadingStages={loadingHubspotData}
            />

            <ContactSyncCard
              settings={localSettings.contact_sync}
              onUpdate={(updates) => updateSettings('contact_sync', updates)}
              isUpdating={saving}
            />

            <DealSyncCard
              settings={localSettings.deal_sync}
              onUpdate={(updates) => updateSettings('deal_sync', updates)}
              isUpdating={saving}
            />

            <TaskSyncCard
              settings={localSettings.task_sync}
              onUpdate={(updates) => updateSettings('task_sync', updates)}
              isUpdating={saving}
            />

            <FormIngestionCard
              settings={localSettings.form_ingestion}
              onUpdate={(updates) => updateSettings('form_ingestion', updates)}
              onPollForms={handlePollForms}
              isUpdating={saving}
              isPolling={isPollingForms}
            />

            <AIWritebackCard
              settings={localSettings.ai_note_writeback}
              onUpdate={(updates) => updateSettings('ai_note_writeback', updates)}
              isUpdating={saving}
            />

            {/* Initial Sync */}
            <InitialSyncCard onTriggerSync={handleTriggerSync} isLoading={isSyncing} />
          </div>
        )}
      </div>
    </PageContainer>
  );
}
