import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/clientV2';
import { useAuth } from '@/lib/contexts/AuthContext';

export type OnboardingStep = 'welcome' | 'fathom_connect' | 'sync' | 'complete';

export interface OnboardingProgress {
  id: string;
  user_id: string;
  onboarding_step: OnboardingStep;
  onboarding_completed_at: string | null;
  skipped_onboarding: boolean;
  fathom_connected: boolean;
  first_meeting_synced: boolean;
  first_proposal_generated: boolean;
  features_discovered: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface UseOnboardingProgressReturn {
  progress: OnboardingProgress | null;
  needsOnboarding: boolean;
  currentStep: OnboardingStep;
  loading: boolean;
  error: string | null;
  completeStep: (step: OnboardingStep) => Promise<void>;
  skipOnboarding: () => Promise<void>;
  updateFeatureDiscovery: (feature: string, discovered: boolean) => Promise<void>;
  markFathomConnected: () => Promise<void>;
  markFirstMeetingSynced: () => Promise<void>;
  markFirstProposalGenerated: () => Promise<void>;
}

export function useOnboardingProgress(): UseOnboardingProgressReturn {
  const { user } = useAuth();
  const [progress, setProgress] = useState<OnboardingProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch onboarding progress
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchProgress = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from('user_onboarding_progress')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (fetchError) {
          // If no record exists, create one
          if (fetchError.code === 'PGRST116') {
            const { data: newProgress, error: createError } = await supabase
              .from('user_onboarding_progress')
              .insert({
                user_id: user.id,
                onboarding_step: 'welcome',
              })
              .select()
              .single();

            if (createError) {
              throw createError;
            }

            setProgress(newProgress);
          } else {
            throw fetchError;
          }
        } else {
          setProgress(data);
        }
      } catch (err) {
        console.error('Error fetching onboarding progress:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch onboarding progress');
      } finally {
        setLoading(false);
      }
    };

    fetchProgress();

    // Subscribe to changes
    const subscription = supabase
      .channel('onboarding_progress_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_onboarding_progress',
          filter: `user_id=eq.${user?.id}`,
        },
        (payload) => {
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            setProgress(payload.new as OnboardingProgress);
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user]);

  const completeStep = useCallback(
    async (step: OnboardingStep) => {
      if (!user || !progress) return;

      try {
        setError(null);

        const updates: Partial<OnboardingProgress> = {
          onboarding_step: step,
        };

        // Mark completion if this is the final step
        if (step === 'complete') {
          updates.onboarding_completed_at = new Date().toISOString();
        }

        const { data, error: updateError } = await supabase
          .from('user_onboarding_progress')
          .update(updates)
          .eq('user_id', user.id)
          .select()
          .single();

        if (updateError) {
          throw updateError;
        }

        setProgress(data);
      } catch (err) {
        console.error('Error completing onboarding step:', err);
        setError(err instanceof Error ? err.message : 'Failed to complete step');
        throw err;
      }
    },
    [user, progress]
  );

  const skipOnboarding = useCallback(async () => {
    if (!user) return;

    try {
      setError(null);

      const { data, error: updateError } = await supabase
        .from('user_onboarding_progress')
        .update({
          skipped_onboarding: true,
          onboarding_completed_at: new Date().toISOString(),
          onboarding_step: 'complete',
        })
        .eq('user_id', user.id)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      setProgress(data);
    } catch (err) {
      console.error('Error skipping onboarding:', err);
      setError(err instanceof Error ? err.message : 'Failed to skip onboarding');
      throw err;
    }
  }, [user]);

  const updateFeatureDiscovery = useCallback(
    async (feature: string, discovered: boolean) => {
      if (!user || !progress) return;

      try {
        setError(null);

        const updatedFeatures = {
          ...progress.features_discovered,
          [feature]: discovered,
        };

        const { data, error: updateError } = await supabase
          .from('user_onboarding_progress')
          .update({
            features_discovered: updatedFeatures,
          })
          .eq('user_id', user.id)
          .select()
          .single();

        if (updateError) {
          throw updateError;
        }

        setProgress(data);
      } catch (err) {
        console.error('Error updating feature discovery:', err);
        setError(err instanceof Error ? err.message : 'Failed to update feature discovery');
      }
    },
    [user, progress]
  );

  const markFathomConnected = useCallback(async () => {
    if (!user) return;

    try {
      setError(null);

      const { data, error: updateError } = await supabase
        .from('user_onboarding_progress')
        .update({
          fathom_connected: true,
        })
        .eq('user_id', user.id)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      setProgress(data);
    } catch (err) {
      console.error('Error marking Fathom connected:', err);
      setError(err instanceof Error ? err.message : 'Failed to mark Fathom connected');
    }
  }, [user]);

  const markFirstMeetingSynced = useCallback(async () => {
    if (!user) return;

    try {
      setError(null);

      const { data, error: updateError } = await supabase
        .from('user_onboarding_progress')
        .update({
          first_meeting_synced: true,
        })
        .eq('user_id', user.id)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      setProgress(data);
    } catch (err) {
      console.error('Error marking first meeting synced:', err);
      setError(err instanceof Error ? err.message : 'Failed to mark first meeting synced');
    }
  }, [user]);

  const markFirstProposalGenerated = useCallback(async () => {
    if (!user) return;

    try {
      setError(null);

      const { data, error: updateError } = await supabase
        .from('user_onboarding_progress')
        .update({
          first_proposal_generated: true,
        })
        .eq('user_id', user.id)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      setProgress(data);
    } catch (err) {
      console.error('Error marking first proposal generated:', err);
      setError(err instanceof Error ? err.message : 'Failed to mark first proposal generated');
    }
  }, [user]);

  const needsOnboarding =
    progress !== null &&
    !progress.skipped_onboarding &&
    !progress.onboarding_completed_at &&
    progress.onboarding_step !== 'complete';

  const currentStep: OnboardingStep = progress?.onboarding_step || 'welcome';

  return {
    progress,
    needsOnboarding: needsOnboarding ?? false,
    currentStep,
    loading,
    error,
    completeStep,
    skipOnboarding,
    updateFeatureDiscovery,
    markFathomConnected,
    markFirstMeetingSynced,
    markFirstProposalGenerated,
  };
}

