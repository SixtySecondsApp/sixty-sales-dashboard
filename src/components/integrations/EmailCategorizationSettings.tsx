/**
 * Email Categorization Settings Component
 * 
 * Provides UI for configuring Fyxer-style email categorization:
 * - Enable/disable categorization
 * - Choose label mode (A/B/C)
 * - Map Gmail labels to categories
 * - View category counts
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Mail, Tag, RefreshCw, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { toast } from 'sonner';
import {
  emailCategorizationService,
  type EmailCategory,
  type LabelMode,
  type OrgCategorizationSettings,
  type LabelMapping,
  type GmailLabel,
  CATEGORY_DEFINITIONS,
} from '@/lib/services/emailCategorizationService';
import { supabase } from '@/lib/supabase/clientV2';

interface EmailCategorizationSettingsProps {
  orgId: string | null;
}

export function EmailCategorizationSettings({ orgId }: EmailCategorizationSettingsProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSettingUpLabels, setIsSettingUpLabels] = useState(false);
  
  // Settings state
  const [settings, setSettings] = useState<OrgCategorizationSettings | null>(null);
  const [labelMappings, setLabelMappings] = useState<LabelMapping[]>([]);
  const [gmailLabels, setGmailLabels] = useState<GmailLabel[]>([]);
  const [categoryCounts, setCategoryCounts] = useState<Record<EmailCategory, number> | null>(null);

  // Load data
  useEffect(() => {
    loadData();
  }, [orgId]);

  async function loadData() {
    setIsLoading(true);
    try {
      // Load settings, mappings, counts in parallel
      const [settingsResult, mappingsResult, countsResult] = await Promise.allSettled([
        orgId ? emailCategorizationService.getOrgCategorizationSettings(orgId) : Promise.resolve(null),
        emailCategorizationService.getLabelMappings(),
        emailCategorizationService.getCategoryCounts({ sinceProcessedAt: getLastWeekDate() }),
      ]);

      if (settingsResult.status === 'fulfilled') {
        setSettings(settingsResult.value);
      }
      if (mappingsResult.status === 'fulfilled') {
        setLabelMappings(mappingsResult.value);
      }
      if (countsResult.status === 'fulfilled') {
        setCategoryCounts(countsResult.value);
      }

    } catch (error: any) {
      console.error('Failed to load categorization settings:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleToggleEnabled(enabled: boolean) {
    if (!orgId) return;
    
    setIsSaving(true);
    try {
      await emailCategorizationService.updateOrgCategorizationSettings(orgId, {
        isEnabled: enabled,
      });
      setSettings(prev => prev ? { ...prev, isEnabled: enabled } : null);
      toast.success(enabled ? 'Email categorization enabled' : 'Email categorization disabled');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update settings');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleModeChange(mode: LabelMode) {
    if (!orgId) return;
    
    setIsSaving(true);
    try {
      await emailCategorizationService.updateOrgCategorizationSettings(orgId, {
        labelMode: mode,
      });
      setSettings(prev => prev ? { ...prev, labelMode: mode } : null);
      toast.success('Label mode updated');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update mode');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSetupGmailLabels() {
    setIsSettingUpLabels(true);
    try {
      const { data, error } = await supabase.functions.invoke('gmail-apply-labels', {
        body: { action: 'setup-labels' },
      });

      if (error) throw error;

      if (data.success) {
        toast.success(`Created ${data.labels?.filter((l: any) => l.isSixtyManaged).length || 0} new labels in Gmail`);
        await loadData(); // Reload mappings
      } else {
        toast.error('Failed to setup labels: ' + (data.errors?.join(', ') || 'Unknown error'));
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to setup Gmail labels');
    } finally {
      setIsSettingUpLabels(false);
    }
  }

  async function handleLoadGmailLabels() {
    try {
      const labels = await emailCategorizationService.fetchGmailLabels();
      setGmailLabels(labels.filter((l: GmailLabel) => l.type === 'user'));
      toast.success(`Loaded ${labels.length} Gmail labels`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load Gmail labels');
    }
  }

  function getLastWeekDate(): string {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    return date.toISOString();
  }

  function getModeDescription(mode: LabelMode): string {
    switch (mode) {
      case 'mode_a_internal_only':
        return 'Categories are stored in Sixty only. Gmail is not modified.';
      case 'mode_b_use_existing':
        return 'Use your existing Gmail labels as inputs for categorization.';
      case 'mode_c_sync_labels':
        return 'Create and apply Sixty category labels in Gmail.';
      default:
        return '';
    }
  }

  function getModeLabel(mode: LabelMode): string {
    switch (mode) {
      case 'mode_a_internal_only':
        return 'Internal Only (Recommended)';
      case 'mode_b_use_existing':
        return 'Use Existing Gmail Labels';
      case 'mode_c_sync_labels':
        return 'Sync Labels to Gmail';
      default:
        return mode;
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Main Settings Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Email Categorization
              </CardTitle>
              <CardDescription>
                Automatically categorize emails to help prioritize follow-ups
              </CardDescription>
            </div>
            <Switch
              checked={settings?.isEnabled ?? true}
              onCheckedChange={handleToggleEnabled}
              disabled={isSaving || !orgId}
            />
          </div>
        </CardHeader>

        {settings?.isEnabled && (
          <CardContent className="space-y-6">
            {/* Mode Selection */}
            <div className="space-y-3">
              <Label>Label Mode</Label>
              <Select
                value={settings?.labelMode || 'mode_a_internal_only'}
                onValueChange={(value) => handleModeChange(value as LabelMode)}
                disabled={isSaving}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mode_a_internal_only">
                    {getModeLabel('mode_a_internal_only')}
                  </SelectItem>
                  <SelectItem value="mode_b_use_existing">
                    {getModeLabel('mode_b_use_existing')}
                  </SelectItem>
                  <SelectItem value="mode_c_sync_labels">
                    {getModeLabel('mode_c_sync_labels')}
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                {getModeDescription(settings?.labelMode || 'mode_a_internal_only')}
              </p>
            </div>

            {/* Mode C: Setup Labels Button */}
            {settings?.labelMode === 'mode_c_sync_labels' && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      Gmail Label Sync
                    </p>
                    <p className="text-sm text-amber-700 dark:text-amber-300">
                      This will create labels in your Gmail inbox for each category.
                      Existing labels with the same name will be reused (not overwritten).
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSetupGmailLabels}
                  disabled={isSettingUpLabels}
                >
                  {isSettingUpLabels ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Setting up...
                    </>
                  ) : (
                    <>
                      <Tag className="mr-2 h-4 w-4" />
                      Create Gmail Labels
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Mode B: Load Existing Labels */}
            {settings?.labelMode === 'mode_b_use_existing' && (
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Gmail Labels</p>
                  <Button variant="ghost" size="sm" onClick={handleLoadGmailLabels}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Load Labels
                  </Button>
                </div>
                {gmailLabels.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {gmailLabels.map((label) => (
                      <Badge key={label.id} variant="secondary">
                        {label.name}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* AI Settings */}
            <div className="space-y-3">
              <Label>Categorization Methods</Label>
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium">AI Categorization</p>
                  <p className="text-xs text-muted-foreground">Use Claude AI for intelligent categorization</p>
                </div>
                <Switch
                  checked={settings?.useAiCategorization ?? true}
                  onCheckedChange={async (checked) => {
                    if (!orgId) return;
                    try {
                      await emailCategorizationService.updateOrgCategorizationSettings(orgId, {
                        useAiCategorization: checked,
                      });
                      setSettings(prev => prev ? { ...prev, useAiCategorization: checked } : null);
                    } catch (e) {
                      toast.error('Failed to update setting');
                    }
                  }}
                  disabled={isSaving}
                />
              </div>
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium">Rules-Based Categorization</p>
                  <p className="text-xs text-muted-foreground">Use pattern matching for fast categorization</p>
                </div>
                <Switch
                  checked={settings?.useRulesCategorization ?? true}
                  onCheckedChange={async (checked) => {
                    if (!orgId) return;
                    try {
                      await emailCategorizationService.updateOrgCategorizationSettings(orgId, {
                        useRulesCategorization: checked,
                      });
                      setSettings(prev => prev ? { ...prev, useRulesCategorization: checked } : null);
                    } catch (e) {
                      toast.error('Failed to update setting');
                    }
                  }}
                  disabled={isSaving}
                />
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Category Preview Card */}
      {settings?.isEnabled && categoryCounts && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Category Counts (Last 7 Days)</CardTitle>
            <CardDescription>
              Emails categorized in the last week
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {CATEGORY_DEFINITIONS.map((cat) => {
                const count = categoryCounts[cat.key] || 0;
                const mapping = labelMappings.find(m => m.categoryKey === cat.key);
                
                return (
                  <div
                    key={cat.key}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: cat.color.bg }}
                      />
                      <span className="text-sm font-medium">{cat.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{count}</Badge>
                      {mapping?.gmailLabelId && (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      <Card className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30">
        <CardContent className="flex items-start gap-3 pt-4">
          <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
              How it works
            </p>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Emails are automatically categorized every 15 minutes. Categories like "To Respond" 
              feed into your Slack Sales Assistant to help you prioritize follow-ups.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

