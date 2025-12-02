/**
 * useWaitlistOnboarding Hook
 * React Query hook for waitlist user onboarding progress tracking
 * Separate from the main app onboarding system
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/clientV2';
import {
  markOnboardingStep,
  getOnboardingProgress,
  getAllOnboardingProgress,
  getOnboardingAnalytics,
  getStuckOnboardingUsers,
  getNextOnboardingStep,
  type OnboardingProgress,
  type OnboardingStep,
  type OnboardingFilters,
  type OnboardingAnalytics,
  type StuckUser,
} from '@/lib/services/onboardingService';

const QUERY_KEYS = {
  progress: (userId: string) => ['waitlist-onboarding-progress', userId] as const,
  allProgress: (filters?: OnboardingFilters) => ['waitlist-onboarding-progress', 'all', filters] as const,
  analytics: ['waitlist-onboarding-analytics'] as const,
  stuckUsers: ['waitlist-onboarding-stuck-users'] as const,
};

/**
 * Fetch onboarding progress for a specific user
 */
export function useWaitlistOnboardingProgress(userId: string | null) {
  return useQuery({
    queryKey: userId ? QUERY_KEYS.progress(userId) : ['waitlist-onboarding-progress', 'null'],
    queryFn: async () => {
      if (!userId) return null;
      const result = await getOnboardingProgress(userId);
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch onboarding progress');
      }
      return result.data || null;
    },
    enabled: !!userId,
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Fetch all onboarding progress with optional filters
 */
export function useAllWaitlistOnboardingProgress(filters?: OnboardingFilters) {
  return useQuery({
    queryKey: QUERY_KEYS.allProgress(filters),
    queryFn: async () => {
      const result = await getAllOnboardingProgress(filters);
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch onboarding progress');
      }
      return result.data || [];
    },
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Fetch onboarding analytics
 */
export function useWaitlistOnboardingAnalytics() {
  return useQuery({
    queryKey: QUERY_KEYS.analytics,
    queryFn: async () => {
      const result = await getOnboardingAnalytics();
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch onboarding analytics');
      }
      return result.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Fetch stuck users (< 50% completion after 7 days)
 */
export function useStuckWaitlistOnboardingUsers() {
  return useQuery({
    queryKey: QUERY_KEYS.stuckUsers,
    queryFn: async () => {
      const result = await getStuckOnboardingUsers();
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch stuck users');
      }
      return result.data || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Mark an onboarding step as complete
 */
export function useMarkWaitlistOnboardingStep(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (step: OnboardingStep) => {
      const result = await markOnboardingStep(userId, step);
      if (!result.success) {
        throw new Error(result.error || 'Failed to mark onboarding step');
      }
      return result;
    },
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.progress(userId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.allProgress() });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.analytics });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.stuckUsers });
    },
  });
}

/**
 * Real-time subscription to onboarding progress updates
 */
export function useWaitlistOnboardingSubscription(userId: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    // Subscribe to real-time updates for this user's progress
    const channel = supabase
      .channel(`waitlist-onboarding-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'waitlist_onboarding_progress',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log('Waitlist onboarding progress updated:', payload);
          // Invalidate the query to refetch
          queryClient.invalidateQueries({ queryKey: QUERY_KEYS.progress(userId) });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);
}

/**
 * Helper hook to get next recommended step
 */
export function useNextWaitlistOnboardingStep(userId: string | null) {
  const { data: progress } = useWaitlistOnboardingProgress(userId);

  return progress ? getNextOnboardingStep(progress) : null;
}

/**
 * Combined hook for onboarding operations
 */
export function useWaitlistOnboardingOperations(userId: string) {
  const markStepMutation = useMarkWaitlistOnboardingStep(userId);
  const { data: progress, isLoading } = useWaitlistOnboardingProgress(userId);
  const nextStep = useNextWaitlistOnboardingStep(userId);

  const markStep = useCallback(
    async (step: OnboardingStep) => {
      return markStepMutation.mutateAsync(step);
    },
    [markStepMutation]
  );

  return {
    progress,
    nextStep,
    isLoading,
    markStep,
    isMarking: markStepMutation.isPending,
    completionPercentage: progress?.completion_percentage || 0,
    completedSteps: progress?.completed_steps || 0,
    isComplete: progress?.completion_percentage === 100,
  };
}

/**
 * Hook for admin dashboard analytics
 */
export function useWaitlistOnboardingDashboard() {
  const { data: analytics, isLoading: isLoadingAnalytics } = useWaitlistOnboardingAnalytics();
  const { data: stuckUsers, isLoading: isLoadingStuck } = useStuckWaitlistOnboardingUsers();
  const { data: allProgress, isLoading: isLoadingAll } = useAllWaitlistOnboardingProgress();

  return {
    analytics,
    stuckUsers,
    allProgress,
    isLoading: isLoadingAnalytics || isLoadingStuck || isLoadingAll,
  };
}
