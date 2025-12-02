/**
 * Calendar Search Hook
 *
 * Provides server-side full-text search for calendar events using the
 * calendar-search Edge Function with PostgreSQL full-text indexes.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/clientV2';

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start: Date;
  end: Date;
  allDay: boolean;
  location?: string;
  category?: string;
  calendarId?: string;
  attendees?: string[];
  status?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SearchFilters {
  startDate?: Date;
  endDate?: Date;
  calendarId?: string;
  category?: string;
}

export interface SearchParams {
  query: string;
  filters?: SearchFilters;
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  events: CalendarEvent[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  query: {
    searchTerm: string;
    filters: SearchFilters;
  };
}

/**
 * Search calendar events using server-side full-text search
 *
 * @param params - Search parameters
 * @param enabled - Whether the query should run (default: true)
 * @returns React Query result with search results
 */
export function useCalendarSearch(
  params: SearchParams,
  enabled: boolean = true
) {
  const { query, filters = {}, limit = 50, offset = 0 } = params;

  return useQuery({
    queryKey: ['calendar-search', query, filters, limit, offset],
    queryFn: async (): Promise<SearchResult> => {
      // Get the current session
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('No active session');
      }

      // Call the Edge Function
      const { data, error } = await supabase.functions.invoke('calendar-search', {
        body: {
          query,
          filters: {
            startDate: filters.startDate?.toISOString(),
            endDate: filters.endDate?.toISOString(),
            calendarId: filters.calendarId,
            category: filters.category,
          },
          limit,
          offset,
        },
      });

      if (error) {
        throw new Error(`Search failed: ${error.message}`);
      }

      // Transform API response to typed result
      const result: SearchResult = {
        events: data.events.map((event: any) => ({
          ...event,
          start: new Date(event.start),
          end: new Date(event.end),
          createdAt: new Date(event.createdAt),
          updatedAt: new Date(event.updatedAt),
        })),
        pagination: data.pagination,
        query: data.query,
      };

      return result;
    },
    enabled: enabled && query.trim().length > 0,
    staleTime: 30000, // Consider data fresh for 30 seconds
    gcTime: 300000, // Keep in cache for 5 minutes
  });
}

/**
 * Prefetch calendar search results
 *
 * Useful for preloading search results before user actually executes the search
 *
 * @param params - Search parameters
 */
export async function prefetchCalendarSearch(params: SearchParams) {
  const { query, filters = {}, limit = 50, offset = 0 } = params;

  if (!query || query.trim().length === 0) {
    return;
  }

  // This would need access to the queryClient
  // Implementation would depend on your React Query setup
  console.log('Prefetch:', { query, filters, limit, offset });
}

/**
 * Search suggestions hook (optional - for autocomplete)
 *
 * Provides quick search suggestions based on recent searches and popular terms
 */
export function useSearchSuggestions(query: string) {
  return useQuery({
    queryKey: ['search-suggestions', query],
    queryFn: async (): Promise<string[]> => {
      // This could query a suggestions table or return recent searches
      // For now, return empty array
      return [];
    },
    enabled: query.length >= 2,
    staleTime: 60000, // 1 minute
  });
}
