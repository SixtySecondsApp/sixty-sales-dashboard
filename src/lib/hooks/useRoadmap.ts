import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/clientV2';
import { useUser } from './useUser';

export interface RoadmapSuggestion {
  id: string;
  title: string;
  description: string;
  type: 'feature' | 'bug' | 'improvement' | 'other';
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'submitted' | 'under_review' | 'in_progress' | 'testing' | 'completed' | 'rejected';
  submitted_by: string;
  submitted_at: string;
  assigned_to?: string;
  votes_count: number;
  estimated_effort?: 'small' | 'medium' | 'large' | 'extra_large';
  target_version?: string;
  completion_date?: string;
  admin_notes?: string;
  created_at: string;
  updated_at: string;
  submitted_by_profile?: {
    id: string;
    full_name: string;
    email: string;
  };
  assigned_to_profile?: {
    id: string;
    full_name: string;
    email: string;
  };
  hasUserVoted: boolean;
}

export function useRoadmap() {
  const [suggestions, setSuggestions] = useState<RoadmapSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<any>(null);
  const { userData } = useUser();

  // Get session directly from Supabase
  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
    };
    
    getSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const fetchSuggestions = async () => {
    if (!session?.user?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Get all roadmap suggestions
      const { data: suggestions, error } = await supabase
        .from('roadmap_suggestions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      if (!suggestions || suggestions.length === 0) {
        setSuggestions([]);
        return;
      }

      // Get profile information for submitters and assignees
      const submitterIds = [...new Set(suggestions.map(s => s.submitted_by).filter(Boolean))];
      const assigneeIds = [...new Set(suggestions.map(s => s.assigned_to).filter(Boolean))];
      const allUserIds = [...new Set([...submitterIds, ...assigneeIds])];

      let profiles: any[] = [];
      if (allUserIds.length > 0) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email')
          .in('id', allUserIds);
        profiles = profileData || [];
      }

      // Get user's votes
      const { data: userVotes } = await supabase
        .from('roadmap_votes')
        .select('suggestion_id')
        .eq('user_id', session.user.id);
      
      const userVoteIds = new Set((userVotes || []).map(v => v.suggestion_id));

      // Transform the data to include user's vote status and profile information
      const transformedSuggestions = suggestions.map(suggestion => {
        const submitterProfile = profiles.find(p => p.id === suggestion.submitted_by);
        const assigneeProfile = profiles.find(p => p.id === suggestion.assigned_to);
        
        return {
          ...suggestion,
          hasUserVoted: userVoteIds.has(suggestion.id),
          submitted_by_profile: submitterProfile ? {
            id: submitterProfile.id,
            full_name: `${submitterProfile.first_name || ''} ${submitterProfile.last_name || ''}`.trim() || 'Unknown User',
            email: submitterProfile.email
          } : null,
          assigned_to_profile: assigneeProfile ? {
            id: assigneeProfile.id,
            full_name: `${assigneeProfile.first_name || ''} ${assigneeProfile.last_name || ''}`.trim() || 'Unknown User',
            email: assigneeProfile.email
          } : null
        };
      });

      setSuggestions(transformedSuggestions);
    } catch (err) {
      console.error('Error fetching suggestions:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch suggestions');
    } finally {
      setLoading(false);
    }
  };

  const createSuggestion = async (suggestionData: {
    title: string;
    description: string;
    type: RoadmapSuggestion['type'];
    priority?: RoadmapSuggestion['priority'];
  }) => {
    if (!session?.user?.id) {
      throw new Error('No authentication token');
    }

    const { title, description, type, priority } = suggestionData;

    if (!title || !description || !type) {
      throw new Error('Title, description, and type are required');
    }

    const { data: suggestion, error } = await supabase
      .from('roadmap_suggestions')
      .insert({
        title,
        description,
        type,
        priority: priority || 'medium',
        submitted_by: session.user.id
      })
      .select('*')
      .single();

    if (error) {
      throw new Error(error.message);
    }

    // Get submitter profile
    const { data: submitterProfile } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email')
      .eq('id', session.user.id)
      .single();

    const newSuggestion = {
      ...suggestion,
      hasUserVoted: false,
      votes_count: 0,
      submitted_by_profile: submitterProfile ? {
        id: submitterProfile.id,
        full_name: `${submitterProfile.first_name || ''} ${submitterProfile.last_name || ''}`.trim() || 'Unknown User',
        email: submitterProfile.email
      } : null
    };

    setSuggestions(prev => [newSuggestion, ...prev]);
    return newSuggestion;
  };

  const updateSuggestion = async (id: string, updates: Partial<RoadmapSuggestion>) => {
    if (!session?.user?.id) {
      throw new Error('No authentication token');
    }

    // Check permissions
    const { data: existingSuggestion } = await supabase
      .from('roadmap_suggestions')
      .select('submitted_by')
      .eq('id', id)
      .single();

    if (!existingSuggestion) {
      throw new Error('Suggestion not found');
    }

    // Check if user is admin
    const isAdmin = userData?.is_admin || false;

    // Users can only update their own suggestions, admins can update any
    if (!isAdmin && existingSuggestion.submitted_by !== session.user.id) {
      throw new Error('Unauthorized to update this suggestion');
    }

    // Restrict fields that regular users can update
    let allowedUpdates: any = {};
    if (isAdmin) {
      // Admins can update any field
      allowedUpdates = updates;
      if (updates.status === 'completed' && !updates.completion_date) {
        allowedUpdates.completion_date = new Date().toISOString();
      }
    } else {
      // Regular users can only update title, description, type, priority
      const { title, description, type, priority } = updates;
      allowedUpdates = { title, description, type, priority };
    }

    const { data: suggestion, error } = await supabase
      .from('roadmap_suggestions')
      .update(allowedUpdates)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      throw new Error(error.message);
    }

    // Refresh the suggestions to get updated profile info
    await fetchSuggestions();
    return suggestion;
  };

  const deleteSuggestion = async (id: string) => {
    if (!session?.user?.id) {
      throw new Error('No authentication token');
    }

    // Check if user is admin
    const isAdmin = userData?.is_admin || false;

    // Only admins can delete suggestions
    if (!isAdmin) {
      throw new Error('Only admins can delete suggestions');
    }

    const { error } = await supabase
      .from('roadmap_suggestions')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(error.message);
    }

    setSuggestions(prev => prev.filter(s => s.id !== id));
  };

  const voteForSuggestion = async (suggestionId: string) => {
    if (!session?.user?.id) {
      throw new Error('No authentication token');
    }

    // Optimistically update UI first
    setSuggestions(prev =>
      prev.map(s =>
        s.id === suggestionId
          ? { ...s, votes_count: s.votes_count + 1, hasUserVoted: true }
          : s
      )
    );

    try {
      const { error } = await supabase
        .from('roadmap_votes')
        .insert({
          suggestion_id: suggestionId,
          user_id: session.user.id
        });

      if (error) {
        // Revert optimistic update on error
        setSuggestions(prev =>
          prev.map(s =>
            s.id === suggestionId
              ? { ...s, votes_count: s.votes_count - 1, hasUserVoted: false }
              : s
          )
        );
        throw new Error(error.message);
      }
    } catch (error) {
      throw error;
    }
  };

  const removeVote = async (suggestionId: string) => {
    if (!session?.user?.id) {
      throw new Error('No authentication token');
    }

    // Optimistically update UI first
    setSuggestions(prev =>
      prev.map(s =>
        s.id === suggestionId
          ? { ...s, votes_count: s.votes_count - 1, hasUserVoted: false }
          : s
      )
    );

    try {
      const { error } = await supabase
        .from('roadmap_votes')
        .delete()
        .eq('suggestion_id', suggestionId)
        .eq('user_id', session.user.id);

      if (error) {
        // Revert optimistic update on error
        setSuggestions(prev =>
          prev.map(s =>
            s.id === suggestionId
              ? { ...s, votes_count: s.votes_count + 1, hasUserVoted: true }
              : s
          )
        );
        throw new Error(error.message);
      }
    } catch (error) {
      throw error;
    }
  };

  useEffect(() => {
    fetchSuggestions();
  }, [session?.user?.id]);

  // Set up real-time subscription for suggestions
  useEffect(() => {
    if (!session?.user?.id) return;

    const channel = supabase
      .channel('roadmap_suggestions_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'roadmap_suggestions',
        },
        () => {
          // Refetch suggestions when there are changes
          fetchSuggestions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id]);

  return {
    suggestions,
    loading,
    error,
    createSuggestion,
    updateSuggestion,
    deleteSuggestion,
    voteForSuggestion,
    removeVote,
    refetch: fetchSuggestions,
  };
}