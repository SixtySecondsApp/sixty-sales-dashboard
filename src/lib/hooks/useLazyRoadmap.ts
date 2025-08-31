// Lazy loading hook for roadmap data to improve performance
// Only loads roadmap suggestions when explicitly enabled

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
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

async function fetchRoadmapSuggestions(enabled: boolean, limit?: number): Promise<RoadmapSuggestion[]> {
  if (!enabled) {
    return [];
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    return [];
  }

  // Build the main query for roadmap suggestions
  let query = supabase
    .from('roadmap_suggestions')
    .select(`
      *,
      submitted_by_profile:profiles!roadmap_suggestions_submitted_by_fkey(id, full_name, email),
      assigned_to_profile:profiles!roadmap_suggestions_assigned_to_fkey(id, full_name, email)
    `);

  // Apply limit if provided
  if (limit) {
    query = query.limit(limit);
  }

  query = query.order('created_at', { ascending: false });

  const { data: suggestionsData, error } = await query;

  if (error) {
    logger.error('Error fetching roadmap suggestions:', error);
    throw error;
  }

  if (!suggestionsData) {
    return [];
  }

  // Get user votes in a separate query for performance
  const suggestionIds = suggestionsData.map(s => s.id);
  let votesData = [];
  
  if (suggestionIds.length > 0) {
    const { data: votesQuery, error: votesError } = await supabase
      .from('roadmap_votes')
      .select('suggestion_id')
      .eq('user_id', session.user.id)
      .in('suggestion_id', suggestionIds);

    if (!votesError && votesQuery) {
      votesData = votesQuery;
    }
  }

  // Create a Set of voted suggestion IDs for quick lookup
  const votedSuggestionIds = new Set(votesData.map(v => v.suggestion_id));

  // Map the data with vote information
  const suggestions: RoadmapSuggestion[] = suggestionsData.map(suggestion => ({
    ...suggestion,
    submitted_by_profile: suggestion.submitted_by_profile || undefined,
    assigned_to_profile: suggestion.assigned_to_profile || undefined,
    hasUserVoted: votedSuggestionIds.has(suggestion.id)
  }));

  logger.log(`[fetchRoadmapSuggestions] Loaded ${suggestions.length} roadmap suggestions`);
  return suggestions;
}

export function useLazyRoadmap(enabled: boolean = false, limit?: number) {
  const queryResult = useQuery({
    queryKey: ['roadmap-lazy', enabled, limit],
    queryFn: () => fetchRoadmapSuggestions(enabled, limit),
    enabled: enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  });

  return {
    ...queryResult,
    suggestions: queryResult.data || [],
    loading: queryResult.isLoading,
    error: queryResult.error?.message || null,
  };
}

// Hook for dashboard roadmap preview (limited suggestions)
export function useRoadmapPreview(enabled: boolean = false) {
  return useLazyRoadmap(enabled, 5); // Only load 5 most recent for preview
}