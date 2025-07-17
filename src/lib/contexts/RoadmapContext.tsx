import React, { createContext, useContext, useMemo } from 'react';
import { useRoadmap, RoadmapSuggestion } from '@/lib/hooks/useRoadmap';

// Define the status stages for the roadmap kanban
export const ROADMAP_STATUSES = [
  { id: 'submitted', name: 'Submitted', color: '#6b7280' },
  { id: 'under_review', name: 'Planned', color: '#3b82f6' },
  { id: 'in_progress', name: 'In Progress', color: '#f59e0b' },
  { id: 'testing', name: 'Testing', color: '#8b5cf6' },
  { id: 'completed', name: 'Completed', color: '#10b981' },
  { id: 'rejected', name: 'Rejected', color: '#ef4444' }
] as const;

interface RoadmapContextType {
  suggestions: RoadmapSuggestion[];
  statuses: typeof ROADMAP_STATUSES;
  isLoading: boolean;
  error: string | null;
  suggestionsByStatus: Record<string, RoadmapSuggestion[]>;
  createSuggestion: (data: any) => Promise<RoadmapSuggestion>;
  updateSuggestion: (id: string, data: any) => Promise<any>;
  deleteSuggestion: (id: string) => Promise<void>;
  moveSuggestionToStatus: (suggestionId: string, statusId: string) => Promise<void>;
  voteForSuggestion: (suggestionId: string) => Promise<void>;
  removeVote: (suggestionId: string) => Promise<void>;
  refreshSuggestions: () => Promise<void>;
}

const RoadmapContext = createContext<RoadmapContextType | undefined>(undefined);

export function RoadmapProvider({ children }: { children: React.ReactNode }) {
  const {
    suggestions,
    loading: isLoading,
    error,
    createSuggestion,
    updateSuggestion,
    deleteSuggestion,
    voteForSuggestion,
    removeVote,
    refetch: refreshSuggestions
  } = useRoadmap();

  // Group suggestions by status
  const suggestionsByStatus = useMemo(() => {
    const grouped: Record<string, RoadmapSuggestion[]> = {};
    
    // Initialize all statuses with empty arrays
    ROADMAP_STATUSES.forEach(status => {
      grouped[status.id] = [];
    });

    // Group suggestions by their status
    suggestions.forEach(suggestion => {
      if (grouped[suggestion.status]) {
        grouped[suggestion.status].push(suggestion);
      }
    });

    return grouped;
  }, [suggestions]);

  // Move suggestion to a different status
  const moveSuggestionToStatus = async (suggestionId: string, statusId: string) => {
    await updateSuggestion(suggestionId, { status: statusId });
  };

  const value: RoadmapContextType = {
    suggestions,
    statuses: ROADMAP_STATUSES,
    isLoading,
    error,
    suggestionsByStatus,
    createSuggestion,
    updateSuggestion,
    deleteSuggestion,
    moveSuggestionToStatus,
    voteForSuggestion,
    removeVote,
    refreshSuggestions
  };

  return (
    <RoadmapContext.Provider value={value}>
      {children}
    </RoadmapContext.Provider>
  );
}

export function useRoadmapContext() {
  const context = useContext(RoadmapContext);
  if (context === undefined) {
    throw new Error('useRoadmapContext must be used within a RoadmapProvider');
  }
  return context;
}