import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/clientV2';
import { useUser } from './useUser';
import logger from '@/lib/utils/logger';

export interface RoadmapSuggestion {
  id: string;
  ticket_id: number;
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
  const [isInitialLoad, setIsInitialLoad] = useState(true);
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

  const fetchSuggestions = async (skipLoadingState = false) => {
    // TICKET #42: Allow development mode with mock user when no session exists
    const isDevelopment = process.env.NODE_ENV === 'development';
    const hasMockUser = userData?.id && !session?.user?.id;
    
    if (!session?.user?.id && !(isDevelopment && hasMockUser)) {
      setLoading(false);
      return;
    }

    try {
      // Only show loading skeleton on initial load
      if (!skipLoadingState && isInitialLoad) {
        setLoading(true);
      }
      setError(null);

      let suggestions: any[] = [];
      let error: any = null;
      
      // TICKET #42: Use mock data in development when no session but mock user exists
      if (isDevelopment && hasMockUser && !session?.user?.id) {
        // Mock roadmap suggestions for development
        suggestions = [
          {
            id: '42-mock-id',
            ticket_id: 42,
            title: 'Development Mode Authentication Fix',
            description: 'Fix roadmap data fetching in development mode when using mock users',
            type: 'bug',
            priority: 'high',
            status: 'in_progress',
            submitted_by: userData.id,
            submitted_at: new Date().toISOString(),
            assigned_to: null,
            votes_count: 3,
            estimated_effort: 'medium',
            target_version: 'v1.2.0',
            completion_date: null,
            admin_notes: 'Critical for development workflow',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          {
            id: '36-mock-id',
            ticket_id: 36,
            title: 'Performance Optimization',
            description: 'Optimize component rendering and reduce bundle size for better LCP scores',
            type: 'improvement',
            priority: 'medium',
            status: 'testing',
            submitted_by: userData.id,
            submitted_at: new Date().toISOString(),
            assigned_to: null,
            votes_count: 5,
            estimated_effort: 'large',
            target_version: 'v1.2.0',
            completion_date: null,
            admin_notes: 'Focus on Largest Contentful Paint improvements',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          {
            id: '26-mock-id',
            ticket_id: 26,
            title: 'Enhanced Error Handling',
            description: 'Improve error states and user feedback when data loading fails',
            type: 'improvement',
            priority: 'medium',
            status: 'testing',
            submitted_by: userData.id,
            submitted_at: new Date().toISOString(),
            assigned_to: null,
            votes_count: 2,
            estimated_effort: 'medium',
            target_version: 'v1.2.0',
            completion_date: null,
            admin_notes: 'Better UX for error scenarios',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          {
            id: '23-mock-id',
            ticket_id: 23,
            title: 'UI/UX Improvements',
            description: 'Enhance roadmap interface with better loading states and mobile responsiveness',
            type: 'feature',
            priority: 'low',
            status: 'testing',
            submitted_by: userData.id,
            submitted_at: new Date().toISOString(),
            assigned_to: null,
            votes_count: 4,
            estimated_effort: 'medium',
            target_version: 'v1.2.0',
            completion_date: null,
            admin_notes: 'Polish UI for better user experience',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          {
            id: '12-mock-id',
            ticket_id: 12,
            title: 'Mock Data Support',
            description: 'Add development-friendly mock data system for easier testing',
            type: 'feature',
            priority: 'low',
            status: 'completed',
            submitted_by: userData.id,
            submitted_at: new Date().toISOString(),
            assigned_to: null,
            votes_count: 1,
            estimated_effort: 'small',
            target_version: 'v1.2.0',
            completion_date: new Date().toISOString(),
            admin_notes: 'Enables better development workflow',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ];
        logger.log('Using mock roadmap data for development');
      } else {
        // Get all roadmap suggestions from database
        const response = await supabase
          .from('roadmap_suggestions')
          .select('*')
          .order('created_at', { ascending: false });
        
        suggestions = response.data || [];
        error = response.error;
        
        if (error) {
          logger.error('Supabase error details:', {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code
          });
          throw new Error(`Database error: ${error.message}${error.details ? ` - ${error.details}` : ''}`);
        }
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
      if (isDevelopment && hasMockUser) {
        // Mock profile data for development
        profiles = [{
          id: userData.id,
          first_name: userData.first_name,
          last_name: userData.last_name,
          email: userData.email
        }];
      } else if (allUserIds.length > 0) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email')
          .in('id', allUserIds);
        profiles = profileData || [];
      }

      // Get user's votes
      let userVoteIds = new Set<string>();
      
      if (isDevelopment && hasMockUser) {
        // Mock user votes for development - assume user voted on some tickets
        userVoteIds = new Set(['42-mock-id', '36-mock-id']);
      } else if (session?.user?.id) {
        const { data: userVotes } = await supabase
          .from('roadmap_votes')
          .select('suggestion_id')
          .eq('user_id', session.user.id);
        
        userVoteIds = new Set((userVotes || []).map(v => v.suggestion_id));
      }

      // Transform the data to include user's vote status and profile information
      const transformedSuggestions = suggestions
        .filter(suggestion => {
          // Filter out suggestions with invalid IDs
          if (!suggestion.id || typeof suggestion.id !== 'string' || suggestion.id.trim() === '') {
            logger.warn('Filtering out suggestion with invalid ID:', suggestion);
            return false;
          }
          return true;
        })
        .map(suggestion => {
          // Debug log to see if ticket_id is present
          logger.log('Processing suggestion:', { id: suggestion.id, ticket_id: suggestion.ticket_id, title: suggestion.title });
          
          const submitterProfile = profiles.find(p => p.id === suggestion.submitted_by);
          const assigneeProfile = profiles.find(p => p.id === suggestion.assigned_to);
          
          return {
            ...suggestion,
            // Fallback ticket_id if not present in database
            ticket_id: suggestion.ticket_id || (suggestions.length - suggestions.indexOf(suggestion)),
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
      logger.error('Error fetching suggestions:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch suggestions');
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
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
      logger.error('Create suggestion error:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      throw new Error(`Failed to create suggestion: ${error.message}${error.details ? ` - ${error.details}` : ''}`);
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

  const updateSuggestion = async (id: string, updates: Partial<RoadmapSuggestion>, skipRefetch = false) => {
    if (!session?.user?.id) {
      throw new Error('No authentication token');
    }

    if (!id || id.trim() === '') {
      throw new Error('Invalid suggestion ID provided');
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
      // Admins can update any field, but clean up empty UUID fields
      allowedUpdates = { ...updates };
      
      // Remove empty assigned_to field which expects a UUID
      if (allowedUpdates.assigned_to === '' || allowedUpdates.assigned_to === null) {
        delete allowedUpdates.assigned_to;
      }
      
      if (updates.status === 'completed' && !updates.completion_date) {
        allowedUpdates.completion_date = new Date().toISOString();
      }
    } else {
      // Regular users can only update title, description, type, priority
      const { title, description, type, priority } = updates;
      allowedUpdates = { title, description, type, priority };
    }
    
    logger.log('Updating suggestion with allowedUpdates:', allowedUpdates);

    const { data: suggestion, error } = await supabase
      .from('roadmap_suggestions')
      .update(allowedUpdates)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      throw new Error(error.message);
    }

    // Only refresh if not skipping (e.g., during drag operations)
    if (!skipRefetch) {
      await fetchSuggestions();
    }
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
  }, [session?.user?.id, userData?.id]);

  // Set up real-time subscription for suggestions
  useEffect(() => {
    if (!session?.user?.id) return;

    // Real-time subscription with debouncing to prevent excessive updates
    let timeoutId: NodeJS.Timeout;
    const debouncedRefresh = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        fetchSuggestions(true);
      }, 500); // 500ms debounce
    };
    
    const channel = supabase
      .channel('roadmap_suggestions_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'roadmap_suggestions',
        },
        debouncedRefresh
      )
      .subscribe();

    return () => {
      clearTimeout(timeoutId);
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