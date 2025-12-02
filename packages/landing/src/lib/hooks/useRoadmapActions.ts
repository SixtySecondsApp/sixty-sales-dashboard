// Standalone roadmap actions hook - only provides create/update functions
// Does NOT load roadmap data, preventing performance issues on homepage

import { supabase } from '@/lib/supabase/clientV2';
import { useUser } from './useUser';

interface CreateSuggestionInput {
  title: string;
  description: string;
  type: 'feature' | 'bug' | 'improvement' | 'other';
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export function useRoadmapActions() {
  const { userData } = useUser();

  const createSuggestion = async (suggestionData: CreateSuggestionInput) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      throw new Error('Not authenticated');
    }

    const { data: suggestion, error } = await supabase
      .from('roadmap_suggestions')
      .insert({
        ...suggestionData,
        submitted_by: session.user.id,
        status: 'submitted' as const,
        votes_count: 0,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create suggestion: ${error.message}`);
    }

    // Get submitter profile for return data
    const { data: submitterProfile } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email')
      .eq('id', session.user.id)
      .single();

    return {
      ...suggestion,
      hasUserVoted: false,
      submitted_by_profile: submitterProfile ? {
        id: submitterProfile.id,
        full_name: `${submitterProfile.first_name || ''} ${submitterProfile.last_name || ''}`.trim() || 'Unknown User',
        email: submitterProfile.email
      } : null
    };
  };

  return {
    createSuggestion,
  };
}