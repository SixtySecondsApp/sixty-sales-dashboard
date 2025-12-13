/**
 * React hooks for Meeting Workflow Results
 * Provides checklist coverage data, forward movement signals, and notification status
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/clientV2';
import { toast } from 'sonner';

// =====================================================
// Types
// =====================================================

export interface WorkflowChecklistItem {
  item_id: string;
  label: string;
  category: string;
  required: boolean;
  covered: boolean;
  timestamp?: string;
  evidence_quote?: string;
}

export interface ForwardMovementSignal {
  type: string;
  confidence: number;
  evidence: string;
}

export interface MeetingWorkflowResult {
  id: string;
  meeting_id: string;
  call_type_id: string | null;
  org_id: string | null;
  checklist_results: WorkflowChecklistItem[];
  coverage_score: number | null;
  required_coverage_score: number | null;
  missing_required_items: string[] | null;
  notifications_sent: Record<string, string>;
  notifications_scheduled_at: string | null;
  notifications_sent_at: string | null;
  pipeline_action_taken: string | null;
  pipeline_action_details: Record<string, any> | null;
  forward_movement_signals: ForwardMovementSignal[];
  created_at: string;
  updated_at: string;
}

// =====================================================
// useWorkflowResults Hook
// =====================================================

/**
 * Hook to get workflow results for a specific meeting
 */
export function useWorkflowResults(meetingId: string | null) {
  const [workflowResult, setWorkflowResult] = useState<MeetingWorkflowResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch workflow result
  const fetchWorkflowResult = useCallback(async () => {
    if (!meetingId) {
      setWorkflowResult(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: queryError } = await supabase
        .from('meeting_workflow_results')
        .select('*')
        .eq('meeting_id', meetingId)
        .maybeSingle();

      if (queryError) throw queryError;

      setWorkflowResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch workflow results');
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!meetingId) return;

    fetchWorkflowResult();

    const channel = supabase
      .channel(`workflow_results:${meetingId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'meeting_workflow_results',
          filter: `meeting_id=eq.${meetingId}`,
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setWorkflowResult(null);
          } else {
            setWorkflowResult(payload.new as MeetingWorkflowResult);
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [meetingId, fetchWorkflowResult]);

  // Group checklist items by category
  const groupedChecklist = workflowResult?.checklist_results?.reduce(
    (acc, item) => {
      const category = item.category || 'other';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(item);
      return acc;
    },
    {} as Record<string, WorkflowChecklistItem[]>
  ) || {};

  // Calculate stats
  const totalItems = workflowResult?.checklist_results?.length || 0;
  const coveredItems = workflowResult?.checklist_results?.filter(i => i.covered).length || 0;
  const requiredItems = workflowResult?.checklist_results?.filter(i => i.required).length || 0;
  const requiredCoveredItems = workflowResult?.checklist_results?.filter(i => i.required && i.covered).length || 0;

  return {
    workflowResult,
    loading,
    error,
    refresh: fetchWorkflowResult,
    // Checklist data
    checklistItems: workflowResult?.checklist_results || [],
    groupedChecklist,
    coverageScore: workflowResult?.coverage_score || 0,
    requiredCoverageScore: workflowResult?.required_coverage_score || 100,
    missingRequiredItems: workflowResult?.missing_required_items || [],
    // Stats
    totalItems,
    coveredItems,
    requiredItems,
    requiredCoveredItems,
    // Forward movement
    forwardMovementSignals: workflowResult?.forward_movement_signals || [],
    hasForwardMovement: (workflowResult?.forward_movement_signals?.length || 0) > 0,
    // Pipeline automation
    pipelineActionTaken: workflowResult?.pipeline_action_taken,
    pipelineActionDetails: workflowResult?.pipeline_action_details,
    // Notification status
    notificationsSent: workflowResult?.notifications_sent || {},
    notificationsSentAt: workflowResult?.notifications_sent_at,
    notificationsScheduledAt: workflowResult?.notifications_scheduled_at,
  };
}

// =====================================================
// useWorkflowConfig Hook
// =====================================================

export interface WorkflowChecklistConfig {
  id: string;
  label: string;
  required: boolean;
  category: string;
  keywords: string[];
}

export interface CoachingFocusArea {
  id: string;
  name: string;
  description: string;
  weight: number; // 0-100, how much this area affects overall score
  enabled: boolean;
}

export interface CoachingConfig {
  focus_areas: CoachingFocusArea[];
  scoring_thresholds: {
    excellent: number; // e.g., 90
    good: number;      // e.g., 75
    needs_improvement: number; // e.g., 50
  };
  custom_prompt?: string; // Additional context for AI coaching
  include_transcript_quotes: boolean;
  include_improvement_tips: boolean;
  compare_to_team_average: boolean;
}

export interface WorkflowConfig {
  checklist_items: WorkflowChecklistConfig[];
  notifications: {
    on_missing_required?: {
      enabled: boolean;
      channels: ('in_app' | 'email' | 'slack')[];
      delay_minutes: number;
    };
  };
  automations: {
    update_pipeline_on_forward_movement?: boolean;
    create_follow_up_task?: boolean;
  };
  coaching?: CoachingConfig;
}

export interface CallTypeWithWorkflow {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  enable_coaching: boolean;
  workflow_config: WorkflowConfig;
}

/**
 * Hook to get workflow configuration for a call type
 */
export function useWorkflowConfig(callTypeId: string | null) {
  const [callType, setCallType] = useState<CallTypeWithWorkflow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCallType = useCallback(async () => {
    if (!callTypeId) {
      setCallType(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: queryError } = await supabase
        .from('org_call_types')
        .select('id, name, color, icon, enable_coaching, workflow_config')
        .eq('id', callTypeId)
        .single();

      if (queryError) throw queryError;

      setCallType(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch call type');
    } finally {
      setLoading(false);
    }
  }, [callTypeId]);

  useEffect(() => {
    fetchCallType();
  }, [fetchCallType]);

  return {
    callType,
    loading,
    error,
    refresh: fetchCallType,
    workflowConfig: callType?.workflow_config || null,
    enableCoaching: callType?.enable_coaching ?? true,
    checklistItems: callType?.workflow_config?.checklist_items || [],
    notificationConfig: callType?.workflow_config?.notifications?.on_missing_required || null,
    automationConfig: callType?.workflow_config?.automations || null,
  };
}

// =====================================================
// useOrgCallTypes Hook
// =====================================================

/**
 * Hook to get all call types for an organization
 */
export function useOrgCallTypes() {
  const [callTypes, setCallTypes] = useState<CallTypeWithWorkflow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCallTypes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: queryError } = await supabase
        .from('org_call_types')
        .select('id, name, color, icon, enable_coaching, workflow_config')
        .order('name');

      if (queryError) throw queryError;

      setCallTypes(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch call types');
    } finally {
      setLoading(false);
    }
  }, []);

  // Update call type workflow config
  const updateWorkflowConfig = useCallback(async (
    callTypeId: string,
    workflowConfig: Partial<WorkflowConfig>
  ) => {
    try {
      // Get current config first
      const { data: current, error: fetchError } = await supabase
        .from('org_call_types')
        .select('workflow_config')
        .eq('id', callTypeId)
        .single();

      if (fetchError) throw fetchError;

      // Merge configs - handle case where current might be null
      const currentConfig = (current as any)?.workflow_config as WorkflowConfig | null;
      const mergedConfig = {
        ...(currentConfig || {}),
        ...workflowConfig,
      };

      const { error: updateError } = await (supabase
        .from('org_call_types') as any)
        .update({ workflow_config: mergedConfig })
        .eq('id', callTypeId);

      if (updateError) throw updateError;

      await fetchCallTypes();
      toast.success('Workflow configuration updated');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update workflow config';
      toast.error(message);
      throw err;
    }
  }, [fetchCallTypes]);

  // Update coaching enabled status
  const updateCoachingEnabled = useCallback(async (
    callTypeId: string,
    enableCoaching: boolean
  ) => {
    try {
      const { error: updateError } = await (supabase
        .from('org_call_types') as any)
        .update({ enable_coaching: enableCoaching })
        .eq('id', callTypeId);

      if (updateError) throw updateError;

      await fetchCallTypes();
      toast.success(`Coaching ${enableCoaching ? 'enabled' : 'disabled'}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update coaching setting';
      toast.error(message);
      throw err;
    }
  }, [fetchCallTypes]);

  useEffect(() => {
    fetchCallTypes();
  }, [fetchCallTypes]);

  return {
    callTypes,
    loading,
    error,
    refresh: fetchCallTypes,
    updateWorkflowConfig,
    updateCoachingEnabled,
  };
}
