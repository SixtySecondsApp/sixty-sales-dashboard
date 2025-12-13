/**
 * Call Type Workflow Editor Component
 *
 * Admin modal for configuring workflow settings per call type:
 * - Enable/disable coaching
 * - Configure checklist items with categories and keywords
 * - Set notification preferences (in-app, email, Slack)
 * - Configure automation triggers
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Save,
  Plus,
  Trash2,
  GripVertical,
  Loader2,
  CheckCircle2,
  Bell,
  BellOff,
  Mail,
  MessageSquare,
  Slack,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Settings,
  ListChecks,
  Sparkles,
  GraduationCap,
  Target,
  MessageCircle,
  TrendingUp,
  Users,
  Lightbulb,
  Quote,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { WorkflowConfig, WorkflowChecklistConfig, CoachingConfig, CoachingFocusArea } from '@/lib/hooks/useWorkflowResults';

interface CallTypeWorkflowEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  callTypeId: string;
  callTypeName: string;
  currentConfig: WorkflowConfig | null;
  enableCoaching: boolean;
  onSave: (config: Partial<WorkflowConfig>, enableCoaching: boolean) => Promise<void>;
}

const CATEGORY_OPTIONS = [
  { value: 'discovery', label: 'Discovery' },
  { value: 'qualification', label: 'Qualification' },
  { value: 'presentation', label: 'Presentation' },
  { value: 'objection_handling', label: 'Objection Handling' },
  { value: 'next_steps', label: 'Next Steps' },
  { value: 'closing', label: 'Closing' },
  { value: 'introduction', label: 'Introduction' },
  { value: 'technical', label: 'Technical' },
  { value: 'other', label: 'Other' },
];

const DEFAULT_CHECKLIST_ITEM: Omit<WorkflowChecklistConfig, 'id'> = {
  label: '',
  required: false,
  category: 'discovery',
  keywords: [],
};

const DEFAULT_FOCUS_AREAS: CoachingFocusArea[] = [
  { id: 'rapport', name: 'Building Rapport', description: 'Establishing trust and connection with the prospect', weight: 15, enabled: true },
  { id: 'discovery', name: 'Discovery & Questioning', description: 'Asking insightful questions to understand needs', weight: 25, enabled: true },
  { id: 'value_prop', name: 'Value Proposition', description: 'Clearly articulating product/service value', weight: 20, enabled: true },
  { id: 'objections', name: 'Objection Handling', description: 'Addressing concerns and pushback effectively', weight: 15, enabled: true },
  { id: 'next_steps', name: 'Next Steps & Close', description: 'Securing commitment and clear next actions', weight: 15, enabled: true },
  { id: 'listening', name: 'Active Listening', description: 'Demonstrating understanding and engagement', weight: 10, enabled: true },
];

const DEFAULT_COACHING_CONFIG: CoachingConfig = {
  focus_areas: DEFAULT_FOCUS_AREAS,
  scoring_thresholds: {
    excellent: 85,
    good: 70,
    needs_improvement: 50,
  },
  include_transcript_quotes: true,
  include_improvement_tips: true,
  compare_to_team_average: false,
};

export function CallTypeWorkflowEditor({
  open,
  onOpenChange,
  callTypeId,
  callTypeName,
  currentConfig,
  enableCoaching: initialEnableCoaching,
  onSave,
}: CallTypeWorkflowEditorProps) {
  const [saving, setSaving] = useState(false);
  const [enableCoaching, setEnableCoaching] = useState(initialEnableCoaching);
  const [activeTab, setActiveTab] = useState('checklist');

  // Checklist items state
  const [checklistItems, setChecklistItems] = useState<WorkflowChecklistConfig[]>(
    currentConfig?.checklist_items || []
  );

  // Notification settings state
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    currentConfig?.notifications?.on_missing_required?.enabled ?? false
  );
  const [notificationChannels, setNotificationChannels] = useState<Set<'in_app' | 'email' | 'slack'>>(
    new Set(currentConfig?.notifications?.on_missing_required?.channels || ['in_app'])
  );
  const [notificationDelay, setNotificationDelay] = useState(
    currentConfig?.notifications?.on_missing_required?.delay_minutes ?? 15
  );

  // Automation settings state
  const [updatePipelineOnMovement, setUpdatePipelineOnMovement] = useState(
    currentConfig?.automations?.update_pipeline_on_forward_movement ?? false
  );
  const [createFollowUpTask, setCreateFollowUpTask] = useState(
    currentConfig?.automations?.create_follow_up_task ?? false
  );

  // Coaching settings state
  const [coachingFocusAreas, setCoachingFocusAreas] = useState<CoachingFocusArea[]>(
    currentConfig?.coaching?.focus_areas || DEFAULT_FOCUS_AREAS
  );
  const [scoringThresholds, setScoringThresholds] = useState(
    currentConfig?.coaching?.scoring_thresholds || DEFAULT_COACHING_CONFIG.scoring_thresholds
  );
  const [customCoachingPrompt, setCustomCoachingPrompt] = useState(
    currentConfig?.coaching?.custom_prompt || ''
  );
  const [includeTranscriptQuotes, setIncludeTranscriptQuotes] = useState(
    currentConfig?.coaching?.include_transcript_quotes ?? true
  );
  const [includeImprovementTips, setIncludeImprovementTips] = useState(
    currentConfig?.coaching?.include_improvement_tips ?? true
  );
  const [compareToTeamAverage, setCompareToTeamAverage] = useState(
    currentConfig?.coaching?.compare_to_team_average ?? false
  );

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setEnableCoaching(initialEnableCoaching);
      setChecklistItems(currentConfig?.checklist_items || []);
      setNotificationsEnabled(currentConfig?.notifications?.on_missing_required?.enabled ?? false);
      setNotificationChannels(new Set(currentConfig?.notifications?.on_missing_required?.channels || ['in_app']));
      setNotificationDelay(currentConfig?.notifications?.on_missing_required?.delay_minutes ?? 15);
      setUpdatePipelineOnMovement(currentConfig?.automations?.update_pipeline_on_forward_movement ?? false);
      setCreateFollowUpTask(currentConfig?.automations?.create_follow_up_task ?? false);
      // Coaching settings
      setCoachingFocusAreas(currentConfig?.coaching?.focus_areas || DEFAULT_FOCUS_AREAS);
      setScoringThresholds(currentConfig?.coaching?.scoring_thresholds || DEFAULT_COACHING_CONFIG.scoring_thresholds);
      setCustomCoachingPrompt(currentConfig?.coaching?.custom_prompt || '');
      setIncludeTranscriptQuotes(currentConfig?.coaching?.include_transcript_quotes ?? true);
      setIncludeImprovementTips(currentConfig?.coaching?.include_improvement_tips ?? true);
      setCompareToTeamAverage(currentConfig?.coaching?.compare_to_team_average ?? false);
    }
  }, [open, currentConfig, initialEnableCoaching]);

  // Checklist item management
  const addChecklistItem = () => {
    const newItem: WorkflowChecklistConfig = {
      ...DEFAULT_CHECKLIST_ITEM,
      id: crypto.randomUUID(),
    };
    setChecklistItems([...checklistItems, newItem]);
  };

  const updateChecklistItem = (id: string, updates: Partial<WorkflowChecklistConfig>) => {
    setChecklistItems(items =>
      items.map(item => (item.id === id ? { ...item, ...updates } : item))
    );
  };

  const removeChecklistItem = (id: string) => {
    setChecklistItems(items => items.filter(item => item.id !== id));
  };

  const addKeywordToItem = (itemId: string, keyword: string) => {
    if (!keyword.trim()) return;
    setChecklistItems(items =>
      items.map(item =>
        item.id === itemId
          ? { ...item, keywords: [...item.keywords, keyword.trim().toLowerCase()] }
          : item
      )
    );
  };

  const removeKeywordFromItem = (itemId: string, keywordIndex: number) => {
    setChecklistItems(items =>
      items.map(item =>
        item.id === itemId
          ? { ...item, keywords: item.keywords.filter((_, i) => i !== keywordIndex) }
          : item
      )
    );
  };

  // Notification channel toggle
  const toggleNotificationChannel = (channel: 'in_app' | 'email' | 'slack') => {
    setNotificationChannels(prev => {
      const next = new Set(prev);
      if (next.has(channel)) {
        if (next.size > 1) {
          // Keep at least one channel
          next.delete(channel);
        }
      } else {
        next.add(channel);
      }
      return next;
    });
  };

  // Save handler
  const handleSave = async () => {
    // Validate checklist items
    const validItems = checklistItems.filter(item => item.label.trim());
    if (validItems.length > 0) {
      const hasEmptyKeywords = validItems.some(item => item.keywords.length === 0);
      if (hasEmptyKeywords) {
        toast.error('Each checklist item needs at least one keyword');
        return;
      }
    }

    setSaving(true);
    try {
      const config: Partial<WorkflowConfig> = {
        checklist_items: validItems,
        notifications: {
          on_missing_required: {
            enabled: notificationsEnabled,
            channels: Array.from(notificationChannels),
            delay_minutes: notificationDelay,
          },
        },
        automations: {
          update_pipeline_on_forward_movement: updatePipelineOnMovement,
          create_follow_up_task: createFollowUpTask,
        },
        // Only include coaching config if coaching is enabled
        ...(enableCoaching && {
          coaching: {
            focus_areas: coachingFocusAreas,
            scoring_thresholds: scoringThresholds,
            custom_prompt: customCoachingPrompt || undefined,
            include_transcript_quotes: includeTranscriptQuotes,
            include_improvement_tips: includeImprovementTips,
            compare_to_team_average: compareToTeamAverage,
          },
        }),
      };

      await onSave(config, enableCoaching);
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving workflow config:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configure Workflow: {callTypeName}
          </DialogTitle>
          <DialogDescription>
            Set up coaching, checklists, notifications, and automations for this call type
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4">
          {/* Coaching Toggle */}
          <div className="mb-6 p-4 rounded-lg border bg-muted/30">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base font-semibold">Enable Coaching</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Generate coaching scorecards for this call type
                </p>
              </div>
              <Switch
                checked={enableCoaching}
                onCheckedChange={setEnableCoaching}
              />
            </div>
            {!enableCoaching && (
              <div className="mt-3 flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4" />
                <span>Coaching analysis will be skipped for this call type</span>
              </div>
            )}
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className={cn("grid w-full", enableCoaching ? "grid-cols-4" : "grid-cols-3")}>
              <TabsTrigger value="checklist" className="flex items-center gap-2">
                <ListChecks className="h-4 w-4" />
                Checklist
              </TabsTrigger>
              {enableCoaching && (
                <TabsTrigger value="coaching" className="flex items-center gap-2">
                  <GraduationCap className="h-4 w-4" />
                  Coaching
                </TabsTrigger>
              )}
              <TabsTrigger value="notifications" className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Notifications
              </TabsTrigger>
              <TabsTrigger value="automations" className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Automations
              </TabsTrigger>
            </TabsList>

            {/* Checklist Tab */}
            <TabsContent value="checklist" className="mt-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Workflow Checklist</h3>
                  <p className="text-sm text-muted-foreground">
                    Define items that should be covered during this call type
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={addChecklistItem}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </div>

              {checklistItems.length === 0 ? (
                <div className="text-center py-8 border rounded-lg border-dashed">
                  <ListChecks className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-muted-foreground">No checklist items configured</p>
                  <Button variant="link" onClick={addChecklistItem}>
                    Add your first item
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {checklistItems.map((item, index) => (
                    <ChecklistItemEditor
                      key={item.id}
                      item={item}
                      index={index}
                      onUpdate={(updates) => updateChecklistItem(item.id, updates)}
                      onRemove={() => removeChecklistItem(item.id)}
                      onAddKeyword={(keyword) => addKeywordToItem(item.id, keyword)}
                      onRemoveKeyword={(keywordIndex) => removeKeywordFromItem(item.id, keywordIndex)}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Coaching Tab - Only shown when coaching is enabled */}
            {enableCoaching && (
              <TabsContent value="coaching" className="mt-4 space-y-4">
                {/* Focus Areas */}
                <div className="p-4 rounded-lg border">
                  <div className="flex items-center gap-2 mb-4">
                    <Target className="h-5 w-5 text-primary" />
                    <div>
                      <Label className="text-base">Focus Areas</Label>
                      <p className="text-sm text-muted-foreground">
                        Configure which areas the AI evaluates and their importance
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {coachingFocusAreas.map((area) => (
                      <div key={area.id} className="flex items-center gap-4 p-3 rounded-lg bg-muted/30">
                        <Switch
                          checked={area.enabled}
                          onCheckedChange={(checked) => {
                            setCoachingFocusAreas(prev =>
                              prev.map(a => a.id === area.id ? { ...a, enabled: checked } : a)
                            );
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">{area.name}</div>
                          <div className="text-xs text-muted-foreground truncate">{area.description}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Label className="text-xs text-muted-foreground">Weight:</Label>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            value={area.weight}
                            onChange={(e) => {
                              const newWeight = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                              setCoachingFocusAreas(prev =>
                                prev.map(a => a.id === area.id ? { ...a, weight: newWeight } : a)
                              );
                            }}
                            className="w-16 h-8 text-center"
                            disabled={!area.enabled}
                          />
                          <span className="text-xs text-muted-foreground">%</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 text-xs text-muted-foreground flex items-center gap-2">
                    <TrendingUp className="h-3 w-3" />
                    Total weight: {coachingFocusAreas.filter(a => a.enabled).reduce((sum, a) => sum + a.weight, 0)}%
                    {coachingFocusAreas.filter(a => a.enabled).reduce((sum, a) => sum + a.weight, 0) !== 100 && (
                      <span className="text-amber-500">(should equal 100%)</span>
                    )}
                  </div>
                </div>

                {/* Scoring Thresholds */}
                <div className="p-4 rounded-lg border">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    <div>
                      <Label className="text-base">Scoring Thresholds</Label>
                      <p className="text-sm text-muted-foreground">
                        Define score ranges for performance ratings
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-green-500" />
                        Excellent (≥)
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={scoringThresholds.excellent}
                        onChange={(e) => setScoringThresholds(prev => ({
                          ...prev,
                          excellent: Math.min(100, Math.max(0, parseInt(e.target.value) || 0))
                        }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-blue-500" />
                        Good (≥)
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={scoringThresholds.good}
                        onChange={(e) => setScoringThresholds(prev => ({
                          ...prev,
                          good: Math.min(100, Math.max(0, parseInt(e.target.value) || 0))
                        }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-amber-500" />
                        Needs Work (≥)
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={scoringThresholds.needs_improvement}
                        onChange={(e) => setScoringThresholds(prev => ({
                          ...prev,
                          needs_improvement: Math.min(100, Math.max(0, parseInt(e.target.value) || 0))
                        }))}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Scores below {scoringThresholds.needs_improvement} will be marked as "Critical"
                  </p>
                </div>

                {/* Scorecard Options */}
                <div className="p-4 rounded-lg border">
                  <div className="flex items-center gap-2 mb-4">
                    <MessageCircle className="h-5 w-5 text-primary" />
                    <div>
                      <Label className="text-base">Scorecard Options</Label>
                      <p className="text-sm text-muted-foreground">
                        Configure what's included in coaching scorecards
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Quote className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <Label className="text-sm">Include Transcript Quotes</Label>
                          <p className="text-xs text-muted-foreground">Show evidence from the call</p>
                        </div>
                      </div>
                      <Switch
                        checked={includeTranscriptQuotes}
                        onCheckedChange={setIncludeTranscriptQuotes}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Lightbulb className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <Label className="text-sm">Include Improvement Tips</Label>
                          <p className="text-xs text-muted-foreground">AI-generated suggestions</p>
                        </div>
                      </div>
                      <Switch
                        checked={includeImprovementTips}
                        onCheckedChange={setIncludeImprovementTips}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <Label className="text-sm">Compare to Team Average</Label>
                          <p className="text-xs text-muted-foreground">Show relative performance</p>
                        </div>
                      </div>
                      <Switch
                        checked={compareToTeamAverage}
                        onCheckedChange={setCompareToTeamAverage}
                      />
                    </div>
                  </div>
                </div>

                {/* Custom Coaching Prompt */}
                <div className="p-4 rounded-lg border">
                  <div className="flex items-center gap-2 mb-4">
                    <MessageCircle className="h-5 w-5 text-primary" />
                    <div>
                      <Label className="text-base">Custom Coaching Context</Label>
                      <p className="text-sm text-muted-foreground">
                        Additional context for the AI when generating scorecards
                      </p>
                    </div>
                  </div>

                  <Textarea
                    value={customCoachingPrompt}
                    onChange={(e) => setCustomCoachingPrompt(e.target.value)}
                    placeholder="E.g., 'Focus on consultative selling techniques. Our ideal call should establish budget within the first 10 minutes...'"
                    rows={3}
                  />
                </div>
              </TabsContent>
            )}

            {/* Notifications Tab */}
            <TabsContent value="notifications" className="mt-4 space-y-4">
              <div className="p-4 rounded-lg border">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <Label className="text-base">Missing Items Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Notify when required checklist items are missed
                    </p>
                  </div>
                  <Switch
                    checked={notificationsEnabled}
                    onCheckedChange={setNotificationsEnabled}
                  />
                </div>

                {notificationsEnabled && (
                  <div className="space-y-4 pt-4 border-t">
                    <div>
                      <Label className="text-sm">Notification Channels</Label>
                      <div className="flex gap-2 mt-2">
                        <Button
                          variant={notificationChannels.has('in_app') ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => toggleNotificationChannel('in_app')}
                        >
                          <Bell className="h-4 w-4 mr-2" />
                          In-App
                        </Button>
                        <Button
                          variant={notificationChannels.has('email') ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => toggleNotificationChannel('email')}
                        >
                          <Mail className="h-4 w-4 mr-2" />
                          Email
                        </Button>
                        <Button
                          variant={notificationChannels.has('slack') ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => toggleNotificationChannel('slack')}
                        >
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Slack
                        </Button>
                      </div>
                    </div>

                    <div>
                      <Label className="text-sm">Delay (minutes)</Label>
                      <p className="text-xs text-muted-foreground mb-2">
                        Wait before sending notification to allow for manual review
                      </p>
                      <Select
                        value={notificationDelay.toString()}
                        onValueChange={(value) => setNotificationDelay(parseInt(value))}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">Immediately</SelectItem>
                          <SelectItem value="5">5 minutes</SelectItem>
                          <SelectItem value="15">15 minutes</SelectItem>
                          <SelectItem value="30">30 minutes</SelectItem>
                          <SelectItem value="60">1 hour</SelectItem>
                          <SelectItem value="120">2 hours</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Automations Tab */}
            <TabsContent value="automations" className="mt-4 space-y-4">
              <div className="p-4 rounded-lg border">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base">Update Pipeline on Forward Movement</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically advance deal stage when forward movement signals are detected
                    </p>
                  </div>
                  <Switch
                    checked={updatePipelineOnMovement}
                    onCheckedChange={setUpdatePipelineOnMovement}
                  />
                </div>
              </div>

              <div className="p-4 rounded-lg border">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base">Create Follow-up Task</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically create follow-up tasks when key signals are detected
                    </p>
                  </div>
                  <Switch
                    checked={createFollowUpTask}
                    onCheckedChange={setCreateFollowUpTask}
                  />
                </div>
              </div>

              <div className="p-3 bg-muted/30 rounded-lg text-sm text-muted-foreground">
                <p className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  More automation rules can be configured in{' '}
                  <a href="/settings/pipeline-automation" className="text-primary hover:underline">
                    Pipeline Automation Settings
                  </a>
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Configuration
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// =====================================================
// Checklist Item Editor Sub-Component
// =====================================================

interface ChecklistItemEditorProps {
  item: WorkflowChecklistConfig;
  index: number;
  onUpdate: (updates: Partial<WorkflowChecklistConfig>) => void;
  onRemove: () => void;
  onAddKeyword: (keyword: string) => void;
  onRemoveKeyword: (keywordIndex: number) => void;
}

function ChecklistItemEditor({
  item,
  index,
  onUpdate,
  onRemove,
  onAddKeyword,
  onRemoveKeyword,
}: ChecklistItemEditorProps) {
  const [newKeyword, setNewKeyword] = useState('');
  const [expanded, setExpanded] = useState(true);

  const handleAddKeyword = () => {
    if (newKeyword.trim()) {
      onAddKeyword(newKeyword);
      setNewKeyword('');
    }
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 p-3 bg-muted/30">
        <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex-1 flex items-center gap-2 text-left"
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="font-medium text-sm">
            {item.label || `Item ${index + 1}`}
          </span>
          {item.required && (
            <Badge variant="secondary" className="text-xs">Required</Badge>
          )}
        </button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onRemove}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm">Label</Label>
                  <Input
                    value={item.label}
                    onChange={(e) => onUpdate({ label: e.target.value })}
                    placeholder="e.g., Asked about current process"
                  />
                </div>
                <div>
                  <Label className="text-sm">Category</Label>
                  <Select
                    value={item.category}
                    onValueChange={(value) => onUpdate({ category: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORY_OPTIONS.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id={`required-${item.id}`}
                  checked={item.required}
                  onCheckedChange={(checked) => onUpdate({ required: checked })}
                />
                <Label htmlFor={`required-${item.id}`} className="text-sm">
                  Required item
                </Label>
              </div>

              <div>
                <Label className="text-sm">Keywords</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  AI looks for these phrases to mark the item as covered
                </p>
                <div className="flex flex-wrap gap-2 mb-2">
                  {item.keywords.map((keyword, kIdx) => (
                    <Badge
                      key={kIdx}
                      variant="outline"
                      className="flex items-center gap-1"
                    >
                      {keyword}
                      <button
                        onClick={() => onRemoveKeyword(kIdx)}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newKeyword}
                    onChange={(e) => setNewKeyword(e.target.value)}
                    placeholder="Add keyword..."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddKeyword();
                      }
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAddKeyword}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default CallTypeWorkflowEditor;
