/**
 * useRecordingSetupStatus Hook
 *
 * Manages the recording setup wizard completion status.
 * Tracks whether a user has completed the first-time setup wizard
 * or should be shown the wizard on next visit.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/clientV2';
import { useAuth } from '@/lib/contexts/AuthContext';

// =============================================================================
// Types
// =============================================================================

export interface RecordingSetupStatus {
  hasCompletedSetup: boolean;
  completedAt?: string;
}

// =============================================================================
// Query Keys
// =============================================================================

const setupStatusKeys = {
  all: ['recording-setup-status'] as const,
  user: (userId: string) => [...setupStatusKeys.all, userId] as const,
};

// =============================================================================
// Hook
// =============================================================================

export function useRecordingSetupStatus() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;

  // Check if user has completed setup wizard
  const {
    data: status,
    isLoading,
    refetch,
  } = useQuery<RecordingSetupStatus>({
    queryKey: setupStatusKeys.user(userId || ''),
    queryFn: async () => {
      if (!userId) return { hasCompletedSetup: false };

      // Check user_preferences for wizard completion flag
      const { data, error } = await supabase
        .from('user_preferences')
        .select('recording_setup_completed_at')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('[useRecordingSetupStatus] Error fetching setup status:', error);
        return { hasCompletedSetup: false };
      }

      return {
        hasCompletedSetup: !!data?.recording_setup_completed_at,
        completedAt: data?.recording_setup_completed_at || undefined,
      };
    },
    enabled: !!userId,
    staleTime: 300000, // 5 minutes
  });

  // Mark setup as complete
  const markSetupCompleteMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('Not authenticated');

      const now = new Date().toISOString();

      // Upsert user preference
      const { error } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: userId,
          recording_setup_completed_at: now,
          updated_at: now,
        }, {
          onConflict: 'user_id',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: setupStatusKeys.user(userId || '') });
    },
  });

  // Reset setup status (for testing or re-onboarding)
  const resetSetupMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('user_preferences')
        .update({
          recording_setup_completed_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: setupStatusKeys.user(userId || '') });
    },
  });

  return {
    // Status
    hasCompletedSetup: status?.hasCompletedSetup ?? false,
    completedAt: status?.completedAt,
    isLoading,

    // Actions
    markSetupComplete: markSetupCompleteMutation.mutateAsync,
    resetSetup: resetSetupMutation.mutateAsync,
    refetch,

    // Mutation states
    isMarkingComplete: markSetupCompleteMutation.isPending,
    isResetting: resetSetupMutation.isPending,
  };
}
