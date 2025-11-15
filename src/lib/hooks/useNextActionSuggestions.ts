import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/clientV2';

interface NextActionSuggestion {
  id: string;
  activity_id: string;
  activity_type: string;
  title: string;
  reasoning: string;
  action_type: string;
  urgency: 'low' | 'medium' | 'high';
  confidence_score: number;
  status: 'pending' | 'accepted' | 'dismissed' | 'completed';
  recommended_deadline: string | null;
  timestamp_seconds: number | null;
  created_at: string;
  deal_id: string | null;
  company_id: string | null;
  contact_id: string | null;
  created_task_id: string | null;
  task_status?: string | null;
}

export function useNextActionSuggestions(activityId: string, activityType: string = 'meeting') {
  const [suggestions, setSuggestions] = useState<NextActionSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSuggestions = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('next_action_suggestions')
        .select(`
          *,
          tasks!created_task_id(status)
        `)
        .eq('activity_id', activityId)
        .eq('activity_type', activityType)
        .order('urgency', { ascending: false })
        .order('confidence_score', { ascending: false })
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      // Map the task status to suggestions
      const suggestionsWithTaskStatus = (data || []).map(suggestion => ({
        ...suggestion,
        task_status: (suggestion.tasks as any)?.status || null
      }));

      setSuggestions(suggestionsWithTaskStatus);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activityId) {
      fetchSuggestions();

      // Subscribe to real-time updates
      const channel = supabase
        .channel(`suggestions:${activityId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'next_action_suggestions',
            filter: `activity_id=eq.${activityId}`
          },
          () => {
            fetchSuggestions();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [activityId, activityType]);

  const pendingCount = suggestions.filter(s => s.status === 'pending').length;

  return {
    suggestions,
    loading,
    error,
    refetch: fetchSuggestions,
    pendingCount
  };
}
