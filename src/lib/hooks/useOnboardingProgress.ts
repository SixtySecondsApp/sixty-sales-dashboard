import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/clientV2';
import { useAuth } from '@/lib/contexts/AuthContext';

export type OnboardingStep = 'welcome' | 'org_setup' | 'team_invite' | 'fathom_connect' | 'sync' | 'complete';

export interface OnboardingProgress {
  id: string;
  user_id: string;
  onboarding_step: OnboardingStep;
  onboarding_completed_at: string | null;
  skipped_onboarding: boolean;
  fathom_connected: boolean;
  first_meeting_synced: boolean;
  first_proposal_generated: boolean;
  // North Star Metric
  first_summary_viewed: boolean;
  first_summary_viewed_at: string | null;
  activation_completed_at: string | null;
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
  resetOnboarding: () => Promise<void>;
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

        // Use maybeSingle() instead of single() to handle no rows gracefully
        const { data, error: fetchError } = await supabase
          .from('user_onboarding_progress')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (fetchError) {
          // Log but don't throw for RLS/permission errors - create a default progress object
          console.warn('Error fetching onboarding progress:', fetchError);

          // Create a default progress object to allow user to proceed
          const defaultProgress: OnboardingProgress = {
            id: '',
            user_id: user.id,
            onboarding_step: 'welcome',
            onboarding_completed_at: null,
            skipped_onboarding: false,
            fathom_connected: false,
            first_meeting_synced: false,
            first_proposal_generated: false,
            first_summary_viewed: false,
            first_summary_viewed_at: null,
            activation_completed_at: null,
            features_discovered: {},
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          // Try to create the record using upsert to handle conflicts
          // Note: Type assertion used here until database types are regenerated
          const { data: newProgress, error: createError } = await (supabase
            .from('user_onboarding_progress') as any)
            .upsert({
              user_id: user.id,
              onboarding_step: 'welcome',
            }, {
              onConflict: 'user_id',
            })
            .select()
            .maybeSingle();

          if (createError) {
            console.warn('Could not create onboarding progress, using default:', createError);
            setProgress(defaultProgress);
          } else {
            setProgress(newProgress || defaultProgress);
          }
        } else if (!data) {
          // No record exists, create one
          // Note: Type assertion used here until database types are regenerated
          const { data: newProgress, error: createError } = await (supabase
            .from('user_onboarding_progress') as any)
            .upsert({
              user_id: user.id,
              onboarding_step: 'welcome',
            }, {
              onConflict: 'user_id',
            })
            .select()
            .maybeSingle();

          if (createError) {
            console.warn('Could not create onboarding progress:', createError);
            // Still set a default to allow user to proceed
            setProgress({
              id: '',
              user_id: user.id,
              onboarding_step: 'welcome',
              onboarding_completed_at: null,
              skipped_onboarding: false,
              fathom_connected: false,
              first_meeting_synced: false,
              first_proposal_generated: false,
              first_summary_viewed: false,
              first_summary_viewed_at: null,
              activation_completed_at: null,
              features_discovered: {},
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
          } else {
            setProgress(newProgress);
          }
        } else {
          setProgress(data);
        }
      } catch (err) {
        console.error('Error fetching onboarding progress:', err);
        // Don't set error - allow user to proceed with defaults
        setProgress({
          id: '',
          user_id: user.id,
          onboarding_step: 'welcome',
          onboarding_completed_at: null,
          skipped_onboarding: false,
          fathom_connected: false,
          first_meeting_synced: false,
          first_proposal_generated: false,
          first_summary_viewed: false,
          first_summary_viewed_at: null,
          activation_completed_at: null,
          features_discovered: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
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
      if (!user) {
        console.warn('completeStep called without user');
        return;
      }

      try {
        setError(null);

        const updates: Partial<OnboardingProgress> & { user_id?: string } = {
          onboarding_step: step,
        };

        // Mark completion if this is the final step
        if (step === 'complete') {
          updates.onboarding_completed_at = new Date().toISOString();
        }

        // Use upsert to handle case where progress record might not exist
        // Note: Type assertion used here until database types are regenerated
        const { data, error: updateError } = await (supabase
          .from('user_onboarding_progress') as any)
          .upsert({
            user_id: user.id,
            ...updates,
          }, {
            onConflict: 'user_id',
          })
          .select()
          .single();

        if (updateError) {
          throw updateError;
        }

        setProgress(data);
      } catch (err) {
        console.error('Error completing onboarding step:', err);
        setError(err instanceof Error ? err.message : 'Failed to complete step');
        // Don't re-throw - allow the user to continue even if progress tracking fails
      }
    },
    [user]
  );

  const skipOnboarding = useCallback(async () => {
    if (!user) return;

    try {
      setError(null);

      // Use upsert to handle case where record doesn't exist yet
      // Note: Type assertion used here until database types are regenerated
      const { data, error: upsertError } = await (supabase
        .from('user_onboarding_progress') as any)
        .upsert({
          user_id: user.id,
          skipped_onboarding: true,
          onboarding_completed_at: new Date().toISOString(),
          onboarding_step: 'complete',
        }, {
          onConflict: 'user_id',
        })
        .select()
        .single();

      if (upsertError) {
        throw upsertError;
      }

      setProgress(data);
    } catch (err) {
      console.error('Error skipping onboarding:', err);
      setError(err instanceof Error ? err.message : 'Failed to skip onboarding');
      throw err;
    }
  }, [user]);

  const resetOnboarding = useCallback(async () => {
    if (!user) return;

    try {
      setError(null);

      // Note: Type assertion used here until database types are regenerated
      const { data, error: updateError } = await (supabase
        .from('user_onboarding_progress') as any)
        .update({
          onboarding_step: 'welcome',
          onboarding_completed_at: null,
          skipped_onboarding: false,
          fathom_connected: false,
          first_meeting_synced: false,
          first_proposal_generated: false,
          first_summary_viewed: false,
          first_summary_viewed_at: null,
          activation_completed_at: null,
          features_discovered: {},
        })
        .eq('user_id', user.id)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      setProgress(data);
    } catch (err) {
      console.error('Error resetting onboarding:', err);
      setError(err instanceof Error ? err.message : 'Failed to reset onboarding');
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

        // Note: Type assertion used here until database types are regenerated
        const { data, error: updateError } = await (supabase
          .from('user_onboarding_progress') as any)
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

      // Note: Type assertion used here until database types are regenerated
      const { data, error: updateError } = await (supabase
        .from('user_onboarding_progress') as any)
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

      // Note: Type assertion used here until database types are regenerated
      const { data, error: updateError } = await (supabase
        .from('user_onboarding_progress') as any)
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

      // Note: Type assertion used here until database types are regenerated
      const { data, error: updateError } = await (supabase
        .from('user_onboarding_progress') as any)
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
    resetOnboarding,
    updateFeatureDiscovery,
    markFathomConnected,
    markFirstMeetingSynced,
    markFirstProposalGenerated,
  };
}

