/**
 * Pipeline Automation Settings Page
 *
 * Admin-only page for configuring pipeline automation rules.
 * Features:
 * - List/create/edit/delete automation rules
 * - Configure trigger conditions and actions
 * - View automation execution log
 * - Filter rules by trigger type and status
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Edit2,
  Trash2,
  X,
  Save,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Sparkles,
  Info,
  Zap,
  Play,
  Pause,
  Clock,
  TrendingUp,
  Bell,
  ListTodo,
  ArrowRight,
  Calendar,
  RefreshCw,
  History,
} from 'lucide-react';
import { supabase } from '@/lib/supabase/clientV2';
import { useOrgId, useOrgPermissions } from '@/lib/contexts/OrgContext';
import { useOrgCallTypes } from '@/lib/hooks/useWorkflowResults';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

// =====================================================
// Types
// =====================================================

interface PipelineAutomationRule {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  trigger_type: TriggerType;
  call_type_filter: string[] | null;
  action_type: ActionType;
  action_config: Record<string, any>;
  min_confidence: number;
  cooldown_hours: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface PipelineAutomationLog {
  id: string;
  org_id: string;
  rule_id: string | null;
  meeting_id: string | null;
  deal_id: string | null;
  trigger_type: string;
  trigger_signal: Record<string, any> | null;
  action_type: string;
  action_result: Record<string, any> | null;
  status: 'success' | 'failed' | 'skipped';
  error_message: string | null;
  created_at: string;
  // Joined data
  rule?: { name: string } | null;
  meeting?: { title: string } | null;
  deal?: { name: string } | null;
}

type TriggerType =
  | 'forward_movement_detected'
  | 'proposal_requested'
  | 'pricing_discussed'
  | 'verbal_commitment'
  | 'next_meeting_scheduled'
  | 'decision_maker_engaged'
  | 'timeline_confirmed'
  | 'checklist_incomplete';

type ActionType = 'advance_stage' | 'create_task' | 'send_notification' | 'update_deal_field';

// =====================================================
// Constants
// =====================================================

const TRIGGER_OPTIONS: { value: TriggerType; label: string; description: string }[] = [
  { value: 'forward_movement_detected', label: 'Forward Movement Detected', description: 'Any forward movement signal from calls' },
  { value: 'proposal_requested', label: 'Proposal Requested', description: 'Prospect requests a proposal' },
  { value: 'pricing_discussed', label: 'Pricing Discussed', description: 'Pricing conversation detected' },
  { value: 'verbal_commitment', label: 'Verbal Commitment', description: 'Verbal agreement/commitment given' },
  { value: 'next_meeting_scheduled', label: 'Next Meeting Scheduled', description: 'Follow-up meeting scheduled' },
  { value: 'decision_maker_engaged', label: 'Decision Maker Engaged', description: 'Decision maker participated' },
  { value: 'timeline_confirmed', label: 'Timeline Confirmed', description: 'Implementation timeline discussed' },
  { value: 'checklist_incomplete', label: 'Checklist Incomplete', description: 'Required checklist items missing' },
];

const ACTION_OPTIONS: { value: ActionType; label: string; description: string; icon: React.ElementType }[] = [
  { value: 'advance_stage', label: 'Advance Stage', description: 'Move deal to next/specific stage', icon: ArrowRight },
  { value: 'create_task', label: 'Create Task', description: 'Create a follow-up task', icon: ListTodo },
  { value: 'send_notification', label: 'Send Notification', description: 'Send notification(s)', icon: Bell },
  { value: 'update_deal_field', label: 'Update Deal Field', description: 'Update a deal field', icon: Edit2 },
];

// =====================================================
// Main Component
// =====================================================

export default function PipelineAutomationSettings() {
  const orgId = useOrgId();
  const permissions = useOrgPermissions();
  const { callTypes } = useOrgCallTypes();

  const [rules, setRules] = useState<PipelineAutomationRule[]>([]);
  const [logs, setLogs] = useState<PipelineAutomationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('rules');

  const loadRules = useCallback(async () => {
    if (!orgId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('pipeline_automation_rules')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRules(data || []);
    } catch (error) {
      console.error('Error loading rules:', error);
      toast.error('Failed to load automation rules');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  const loadLogs = useCallback(async () => {
    if (!orgId) return;

    try {
      setLoadingLogs(true);
      const { data, error } = await supabase
        .from('pipeline_automation_log')
        .select(`
          *,
          rule:pipeline_automation_rules(name),
          meeting:meetings(title),
          deal:deals(name)
        `)
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Error loading logs:', error);
      toast.error('Failed to load automation logs');
    } finally {
      setLoadingLogs(false);
    }
  }, [orgId]);

  useEffect(() => {
    if (orgId) {
      loadRules();
    }
  }, [orgId, loadRules]);

  useEffect(() => {
    if (activeTab === 'logs' && orgId) {
      loadLogs();
    }
  }, [activeTab, orgId, loadLogs]);

  const handleCreate = async (input: Partial<PipelineAutomationRule>) => {
    if (!orgId) return;

    try {
      setSaving(true);
      const { error } = await (supabase
        .from('pipeline_automation_rules') as any)
        .insert([{ ...input, org_id: orgId }]);

      if (error) throw error;
      toast.success('Automation rule created');
      setShowNewForm(false);
      loadRules();
    } catch (error: any) {
      console.error('Error creating rule:', error);
      toast.error(error.message || 'Failed to create rule');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (ruleId: string, input: Partial<PipelineAutomationRule>) => {
    if (!orgId) return;

    try {
      setSaving(true);
      const { error } = await (supabase
        .from('pipeline_automation_rules') as any)
        .update(input)
        .eq('id', ruleId)
        .eq('org_id', orgId);

      if (error) throw error;
      toast.success('Automation rule updated');
      setEditingId(null);
      loadRules();
    } catch (error: any) {
      console.error('Error updating rule:', error);
      toast.error(error.message || 'Failed to update rule');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (ruleId: string) => {
    if (!orgId) return;

    if (!confirm('Are you sure you want to delete this automation rule?')) {
      return;
    }

    try {
      setDeletingId(ruleId);
      const { error } = await supabase
        .from('pipeline_automation_rules')
        .delete()
        .eq('id', ruleId)
        .eq('org_id', orgId);

      if (error) throw error;
      toast.success('Automation rule deleted');
      loadRules();
    } catch (error: any) {
      console.error('Error deleting rule:', error);
      toast.error(error.message || 'Failed to delete rule');
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleActive = async (rule: PipelineAutomationRule) => {
    await handleUpdate(rule.id, { is_active: !rule.is_active });
  };

  if (!permissions.canManageSettings) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
              <p className="text-gray-600 dark:text-gray-400">
                You need admin or owner permissions to manage pipeline automation.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-gray-400" />
          <p className="text-gray-500 dark:text-gray-400">Loading automation rules...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-gray-900 dark:text-gray-100">
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                Pipeline Automation
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Configure automatic actions based on call analysis signals
              </p>
            </div>
            <Button onClick={() => setShowNewForm(true)} disabled={saving}>
              <Plus className="w-4 h-4 mr-2" />
              New Rule
            </Button>
          </div>

          {/* Info Card */}
          <Card className="mt-6 bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                  <Zap className="w-6 h-6 text-gray-700 dark:text-gray-300" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                    <Info className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                    How Pipeline Automation Works
                  </h3>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                    When AI detects signals in your calls (like proposal requests, verbal commitments, or forward movement),
                    automation rules can automatically update your pipeline, create tasks, or send notifications.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium">Signal Detection</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          AI analyzes calls for forward movement signals
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium">Automatic Actions</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          Rules trigger pipeline updates, tasks, and notifications
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="rules" className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Rules ({rules.length})
            </TabsTrigger>
            <TabsTrigger value="logs" className="flex items-center gap-2">
              <History className="w-4 h-4" />
              Activity Log
            </TabsTrigger>
          </TabsList>

          {/* Rules Tab */}
          <TabsContent value="rules">
            {/* New Rule Form */}
            <AnimatePresence>
              {showNewForm && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-6"
                >
                  <RuleForm
                    callTypes={callTypes}
                    onSave={handleCreate}
                    onCancel={() => setShowNewForm(false)}
                    saving={saving}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Rules List */}
            {rules.length === 0 && !showNewForm ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Zap className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-500 dark:text-gray-400 mb-4">No automation rules configured</p>
                  <Button onClick={() => setShowNewForm(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Your First Rule
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {rules.map((rule) => (
                  <RuleCard
                    key={rule.id}
                    rule={rule}
                    callTypes={callTypes}
                    isEditing={editingId === rule.id}
                    isDeleting={deletingId === rule.id}
                    onEdit={() => setEditingId(rule.id)}
                    onCancel={() => setEditingId(null)}
                    onSave={(input) => handleUpdate(rule.id, input)}
                    onDelete={() => handleDelete(rule.id)}
                    onToggleActive={() => handleToggleActive(rule)}
                    saving={saving}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Logs Tab */}
          <TabsContent value="logs">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Automation Activity Log</CardTitle>
                    <CardDescription>Recent automation executions</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={loadLogs} disabled={loadingLogs}>
                    <RefreshCw className={cn('w-4 h-4 mr-2', loadingLogs && 'animate-spin')} />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingLogs ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                  </div>
                ) : logs.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No automation activity yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {logs.map((log) => (
                      <LogEntry key={log.id} log={log} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// =====================================================
// Rule Form Component
// =====================================================

interface RuleFormProps {
  rule?: PipelineAutomationRule;
  callTypes: Array<{ id: string; name: string }>;
  onSave: (input: Partial<PipelineAutomationRule>) => void;
  onCancel: () => void;
  saving: boolean;
}

function RuleForm({ rule, callTypes, onSave, onCancel, saving }: RuleFormProps) {
  const [name, setName] = useState(rule?.name || '');
  const [description, setDescription] = useState(rule?.description || '');
  const [triggerType, setTriggerType] = useState<TriggerType>(rule?.trigger_type || 'forward_movement_detected');
  const [callTypeFilter, setCallTypeFilter] = useState<string[]>(rule?.call_type_filter || []);
  const [actionType, setActionType] = useState<ActionType>(rule?.action_type || 'advance_stage');
  const [actionConfig, setActionConfig] = useState<Record<string, any>>(rule?.action_config || { advance_to_next: true });
  const [minConfidence, setMinConfidence] = useState(rule?.min_confidence ?? 0.7);
  const [cooldownHours, setCooldownHours] = useState(rule?.cooldown_hours ?? 24);
  const [isActive, setIsActive] = useState(rule?.is_active ?? true);

  const handleSubmit = () => {
    if (!name.trim()) {
      toast.error('Please enter a rule name');
      return;
    }

    onSave({
      name: name.trim(),
      description: description.trim() || null,
      trigger_type: triggerType,
      call_type_filter: callTypeFilter.length > 0 ? callTypeFilter : null,
      action_type: actionType,
      action_config: actionConfig,
      min_confidence: minConfidence,
      cooldown_hours: cooldownHours,
      is_active: isActive,
    });
  };

  // Update action config when action type changes
  const handleActionTypeChange = (type: ActionType) => {
    setActionType(type);
    switch (type) {
      case 'advance_stage':
        setActionConfig({ advance_to_next: true });
        break;
      case 'create_task':
        setActionConfig({ title_template: 'Follow up on {{deal_name}}', due_days: 3, priority: 'medium' });
        break;
      case 'send_notification':
        setActionConfig({ channels: ['in_app'], message_template: '{{trigger_type}} detected for {{deal_name}}' });
        break;
      case 'update_deal_field':
        setActionConfig({ field: 'next_step', value_template: '{{trigger_type}}' });
        break;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{rule ? 'Edit Rule' : 'New Automation Rule'}</CardTitle>
        <CardDescription>
          Configure when this rule triggers and what action it takes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Basic Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="name">Rule Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Advance on Forward Movement"
            />
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of what this rule does"
            />
          </div>
        </div>

        {/* Trigger Type */}
        <div>
          <Label>Trigger Type *</Label>
          <Select value={triggerType} onValueChange={(v) => setTriggerType(v as TriggerType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TRIGGER_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  <div>
                    <span className="font-medium">{opt.label}</span>
                    <span className="text-xs text-muted-foreground ml-2">- {opt.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Call Type Filter */}
        {callTypes.length > 0 && (
          <div>
            <Label>Call Type Filter (Optional)</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Only trigger for specific call types. Leave empty for all call types.
            </p>
            <div className="flex flex-wrap gap-2">
              {callTypes.map((ct) => (
                <Badge
                  key={ct.id}
                  variant={callTypeFilter.includes(ct.id) ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => {
                    setCallTypeFilter(
                      callTypeFilter.includes(ct.id)
                        ? callTypeFilter.filter((id) => id !== ct.id)
                        : [...callTypeFilter, ct.id]
                    );
                  }}
                >
                  {ct.name}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Action Type */}
        <div>
          <Label>Action Type *</Label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
            {ACTION_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleActionTypeChange(opt.value)}
                  className={cn(
                    'p-3 rounded-lg border-2 transition-all text-left',
                    actionType === opt.value
                      ? 'border-primary bg-primary/5'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                  )}
                >
                  <Icon className="w-5 h-5 mb-2" />
                  <p className="font-medium text-sm">{opt.label}</p>
                  <p className="text-xs text-muted-foreground">{opt.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Action Config */}
        <ActionConfigEditor
          actionType={actionType}
          config={actionConfig}
          onChange={setActionConfig}
        />

        {/* Conditions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="minConfidence">Minimum Confidence ({Math.round(minConfidence * 100)}%)</Label>
            <Input
              id="minConfidence"
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={minConfidence}
              onChange={(e) => setMinConfidence(parseFloat(e.target.value))}
              className="mt-2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Only trigger when AI confidence is at least this high
            </p>
          </div>
          <div>
            <Label htmlFor="cooldownHours">Cooldown Period (hours)</Label>
            <Input
              id="cooldownHours"
              type="number"
              min="0"
              max="168"
              value={cooldownHours}
              onChange={(e) => setCooldownHours(parseInt(e.target.value) || 0)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Hours before rule can trigger again for the same deal
            </p>
          </div>
        </div>

        {/* Active Toggle */}
        {rule && (
          <div className="flex items-center gap-2">
            <Switch id="is_active" checked={isActive} onCheckedChange={setIsActive} />
            <Label htmlFor="is_active">Active</Label>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// =====================================================
// Action Config Editor
// =====================================================

interface ActionConfigEditorProps {
  actionType: ActionType;
  config: Record<string, any>;
  onChange: (config: Record<string, any>) => void;
}

function ActionConfigEditor({ actionType, config, onChange }: ActionConfigEditorProps) {
  switch (actionType) {
    case 'advance_stage':
      return (
        <div className="p-4 bg-muted/50 rounded-lg">
          <Label>Stage Advancement</Label>
          <div className="flex items-center gap-4 mt-2">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={config.advance_to_next === true}
                onChange={() => onChange({ advance_to_next: true })}
              />
              <span className="text-sm">Advance to next stage</span>
            </label>
          </div>
        </div>
      );

    case 'create_task':
      return (
        <div className="p-4 bg-muted/50 rounded-lg space-y-4">
          <div>
            <Label htmlFor="taskTitle">Task Title Template</Label>
            <Input
              id="taskTitle"
              value={config.title_template || ''}
              onChange={(e) => onChange({ ...config, title_template: e.target.value })}
              placeholder="e.g., Follow up on {{deal_name}}"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Available variables: {'{{deal_name}}'}, {'{{meeting_title}}'}, {'{{trigger_type}}'}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="dueDays">Due in (days)</Label>
              <Input
                id="dueDays"
                type="number"
                min="1"
                max="30"
                value={config.due_days || 3}
                onChange={(e) => onChange({ ...config, due_days: parseInt(e.target.value) || 3 })}
              />
            </div>
            <div>
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={config.priority || 'medium'}
                onValueChange={(v) => onChange({ ...config, priority: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      );

    case 'send_notification':
      return (
        <div className="p-4 bg-muted/50 rounded-lg space-y-4">
          <div>
            <Label>Notification Channels</Label>
            <div className="flex gap-3 mt-2">
              {['in_app', 'email', 'slack'].map((channel) => (
                <label key={channel} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={(config.channels || []).includes(channel)}
                    onChange={(e) => {
                      const channels = config.channels || [];
                      onChange({
                        ...config,
                        channels: e.target.checked
                          ? [...channels, channel]
                          : channels.filter((c: string) => c !== channel),
                      });
                    }}
                  />
                  <span className="text-sm capitalize">{channel.replace('_', '-')}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="message">Message Template</Label>
            <Textarea
              id="message"
              value={config.message_template || ''}
              onChange={(e) => onChange({ ...config, message_template: e.target.value })}
              placeholder="e.g., {{trigger_type}} detected for {{deal_name}}"
              rows={3}
            />
          </div>
        </div>
      );

    case 'update_deal_field':
      return (
        <div className="p-4 bg-muted/50 rounded-lg space-y-4">
          <div>
            <Label htmlFor="field">Field to Update</Label>
            <Select
              value={config.field || 'next_step'}
              onValueChange={(v) => onChange({ ...config, field: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="next_step">Next Step</SelectItem>
                <SelectItem value="notes">Notes (append)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="value">Value Template</Label>
            <Input
              id="value"
              value={config.value_template || ''}
              onChange={(e) => onChange({ ...config, value_template: e.target.value })}
              placeholder="e.g., {{trigger_type}} detected"
            />
          </div>
        </div>
      );

    default:
      return null;
  }
}

// =====================================================
// Rule Card Component
// =====================================================

interface RuleCardProps {
  rule: PipelineAutomationRule;
  callTypes: Array<{ id: string; name: string }>;
  isEditing: boolean;
  isDeleting: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (input: Partial<PipelineAutomationRule>) => void;
  onDelete: () => void;
  onToggleActive: () => void;
  saving: boolean;
}

function RuleCard({
  rule,
  callTypes,
  isEditing,
  isDeleting,
  onEdit,
  onCancel,
  onSave,
  onDelete,
  onToggleActive,
  saving,
}: RuleCardProps) {
  if (isEditing) {
    return (
      <RuleForm
        rule={rule}
        callTypes={callTypes}
        onSave={onSave}
        onCancel={onCancel}
        saving={saving}
      />
    );
  }

  const triggerOption = TRIGGER_OPTIONS.find((t) => t.value === rule.trigger_type);
  const actionOption = ACTION_OPTIONS.find((a) => a.value === rule.action_type);
  const ActionIcon = actionOption?.icon || Zap;

  return (
    <Card className={cn(!rule.is_active && 'opacity-60')}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4 flex-1">
            <div className={cn(
              'p-3 rounded-lg',
              rule.is_active ? 'bg-green-500/10' : 'bg-gray-100 dark:bg-gray-800'
            )}>
              <ActionIcon className={cn(
                'w-6 h-6',
                rule.is_active ? 'text-green-600 dark:text-green-400' : 'text-gray-400'
              )} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-lg">{rule.name}</h3>
                {!rule.is_active && (
                  <Badge variant="outline" className="text-xs">Paused</Badge>
                )}
              </div>
              {rule.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  {rule.description}
                </p>
              )}
              <div className="flex flex-wrap gap-2 mt-2">
                <Badge variant="secondary">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  {triggerOption?.label || rule.trigger_type}
                </Badge>
                <Badge variant="outline">
                  <ActionIcon className="w-3 h-3 mr-1" />
                  {actionOption?.label || rule.action_type}
                </Badge>
                <Badge variant="outline">
                  <Clock className="w-3 h-3 mr-1" />
                  {rule.cooldown_hours}h cooldown
                </Badge>
                <Badge variant="outline">
                  {Math.round(rule.min_confidence * 100)}% min confidence
                </Badge>
              </div>
              {rule.call_type_filter && rule.call_type_filter.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  <span className="text-xs text-muted-foreground mr-1">Call types:</span>
                  {rule.call_type_filter.map((id) => {
                    const ct = callTypes.find((c) => c.id === id);
                    return ct ? (
                      <Badge key={id} variant="outline" className="text-xs">
                        {ct.name}
                      </Badge>
                    ) : null;
                  })}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={rule.is_active}
              onCheckedChange={onToggleActive}
              disabled={saving}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={onEdit}
              disabled={saving}
              title="Edit Rule"
            >
              <Edit2 className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onDelete}
              disabled={saving || isDeleting}
              title="Delete Rule"
            >
              {isDeleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// =====================================================
// Log Entry Component
// =====================================================

interface LogEntryProps {
  log: PipelineAutomationLog;
}

function LogEntry({ log }: LogEntryProps) {
  const statusColors = {
    success: 'text-green-600 dark:text-green-400 bg-green-500/10',
    failed: 'text-red-600 dark:text-red-400 bg-red-500/10',
    skipped: 'text-yellow-600 dark:text-yellow-400 bg-yellow-500/10',
  };

  const StatusIcon = log.status === 'success' ? CheckCircle2 : log.status === 'failed' ? X : Pause;

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
      <div className={cn('p-1.5 rounded', statusColors[log.status])}>
        <StatusIcon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{log.rule?.name || 'Unknown Rule'}</span>
          <Badge variant="outline" className="text-xs">
            {log.trigger_type.replace(/_/g, ' ')}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {log.deal?.name && <span>Deal: {log.deal.name}</span>}
          {log.meeting?.title && <span className="ml-2">Meeting: {log.meeting.title}</span>}
        </p>
        {log.error_message && (
          <p className="text-xs text-red-500 mt-1">{log.error_message}</p>
        )}
      </div>
      <div className="text-xs text-muted-foreground whitespace-nowrap">
        {format(new Date(log.created_at), 'MMM d, h:mm a')}
      </div>
    </div>
  );
}
