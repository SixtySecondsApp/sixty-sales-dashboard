/**
 * useNextActions Hook
 *
 * React hook for managing AI-generated next-action suggestions.
 * Provides real-time updates, filtering, and action methods.
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../supabase/clientV2'
import { useAuth } from '../contexts/AuthContext'
import nextActionsService, {
  NextActionSuggestion,
  SuggestionsFilters,
  CreateTaskOptions,
} from '../services/nextActionsService'

interface UseNextActionsOptions extends SuggestionsFilters {
  enableRealtime?: boolean
  refetchInterval?: number | false
}

interface UseNextActionsReturn {
  suggestions: NextActionSuggestion[]
  isLoading: boolean
  error: Error | null
  pendingCount: number
  highUrgencyCount: number
  groupedByUrgency: Record<string, NextActionSuggestion[]>
  topPriority: NextActionSuggestion[]

  // Actions
  acceptSuggestion: (suggestionId: string, taskOptions?: CreateTaskOptions) => Promise<string>
  dismissSuggestion: (suggestionId: string, feedback?: string) => Promise<boolean>
  acceptAll: () => Promise<string[]>
  dismissAll: (feedback?: string) => Promise<number>
  regenerate: () => Promise<void>
  refetch: () => Promise<void>
}

/**
 * useNextActions Hook
 *
 * Fetch and manage next-action suggestions with real-time updates
 */
export function useNextActions(options: UseNextActionsOptions = {}): UseNextActionsReturn {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const {
    enableRealtime = true,
    refetchInterval = false,
    ...filters
  } = options

  // Include user_id in filters if authenticated
  const finalFilters: SuggestionsFilters = useMemo(
    () => ({
      ...filters,
      userId: filters.userId || user?.id,
    }),
    [filters, user?.id]
  )

  // Query key for React Query
  const queryKey = useMemo(
    () => ['nextActions', finalFilters],
    [finalFilters]
  )

  // Fetch suggestions
  const {
    data: suggestions = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: () => nextActionsService.getSuggestions(finalFilters),
    enabled: !!user,
    refetchInterval,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes (increased from 30 seconds)
    cacheTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    retry: 1, // Only retry once on failure
    retryOnMount: false, // Don't retry if data exists in cache
    onError: (error) => {
      // Silently handle errors to prevent console spam
      console.warn('Failed to fetch next actions:', error)
    },
  })

  // Real-time subscription
  useEffect(() => {
    if (!enableRealtime || !user) return
    const channel = supabase
      .channel('next_action_suggestions_changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'next_action_suggestions',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          // Invalidate and refetch on any change
          queryClient.invalidateQueries({ queryKey: ['nextActions'] })
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [enableRealtime, user, queryClient])

  // Computed values
  const pendingCount = useMemo(
    () => suggestions.filter((s) => s.status === 'pending').length,
    [suggestions]
  )

  const highUrgencyCount = useMemo(
    () => suggestions.filter((s) => s.urgency === 'high' && s.status === 'pending').length,
    [suggestions]
  )

  const groupedByUrgency = useMemo(() => {
    const grouped: Record<string, NextActionSuggestion[]> = {
      high: [],
      medium: [],
      low: [],
    }

    suggestions
      .filter((s) => s.status === 'pending')
      .forEach((suggestion) => {
        grouped[suggestion.urgency].push(suggestion)
      })

    return grouped
  }, [suggestions])

  const topPriority = useMemo(() => {
    const urgencyOrder = { high: 3, medium: 2, low: 1 }

    return [...suggestions]
      .filter((s) => s.status === 'pending')
      .sort((a, b) => {
        const urgencyDiff = urgencyOrder[b.urgency] - urgencyOrder[a.urgency]
        if (urgencyDiff !== 0) return urgencyDiff
        return b.confidence_score - a.confidence_score
      })
      .slice(0, 5)
  }, [suggestions])

  // Mutations
  const acceptMutation = useMutation({
    mutationFn: ({
      suggestionId,
      taskOptions,
    }: {
      suggestionId: string
      taskOptions?: CreateTaskOptions
    }) => nextActionsService.acceptSuggestion(suggestionId, taskOptions),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nextActions'] })
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })

  const dismissMutation = useMutation({
    mutationFn: ({ suggestionId, feedback }: { suggestionId: string; feedback?: string }) =>
      nextActionsService.dismissSuggestion(suggestionId, feedback),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nextActions'] })
    },
  })

  // Actions
  const acceptSuggestion = useCallback(
    async (suggestionId: string, taskOptions?: CreateTaskOptions): Promise<string> => {
      return acceptMutation.mutateAsync({ suggestionId, taskOptions })
    },
    [acceptMutation]
  )

  const dismissSuggestion = useCallback(
    async (suggestionId: string, feedback?: string): Promise<boolean> => {
      return dismissMutation.mutateAsync({ suggestionId, feedback })
    },
    [dismissMutation]
  )

  const acceptAll = useCallback(async (): Promise<string[]> => {
    if (!finalFilters.activityId || !finalFilters.activityType) {
      throw new Error('activityId and activityType required for acceptAll')
    }

    const taskIds = await nextActionsService.acceptAllForActivity(
      finalFilters.activityId,
      finalFilters.activityType
    )

    queryClient.invalidateQueries({ queryKey: ['nextActions'] })
    queryClient.invalidateQueries({ queryKey: ['tasks'] })

    return taskIds
  }, [finalFilters, queryClient])

  const dismissAll = useCallback(
    async (feedback?: string): Promise<number> => {
      if (!finalFilters.activityId || !finalFilters.activityType) {
        throw new Error('activityId and activityType required for dismissAll')
      }

      const dismissedCount = await nextActionsService.dismissAllForActivity(
        finalFilters.activityId,
        finalFilters.activityType,
        feedback
      )

      queryClient.invalidateQueries({ queryKey: ['nextActions'] })

      return dismissedCount
    },
    [finalFilters, queryClient]
  )

  const regenerate = useCallback(async (): Promise<void> => {
    if (!finalFilters.activityId || !finalFilters.activityType) {
      throw new Error('activityId and activityType required for regenerate')
    }

    await nextActionsService.regenerateSuggestions(
      finalFilters.activityId,
      finalFilters.activityType as any
    )

    queryClient.invalidateQueries({ queryKey: ['nextActions'] })
  }, [finalFilters, queryClient])

  return {
    suggestions,
    isLoading,
    error: error as Error | null,
    pendingCount,
    highUrgencyCount,
    groupedByUrgency,
    topPriority,
    acceptSuggestion,
    dismissSuggestion,
    acceptAll,
    dismissAll,
    regenerate,
    refetch: async () => {
      await refetch()
    },
  }
}

/**
 * usePendingSuggestionsCount Hook
 *
 * Lightweight hook to get pending suggestions count with real-time updates
 */
export function usePendingSuggestionsCount() {
  const { user } = useAuth()
  const [count, setCount] = useState(0)

  const { data } = useQuery({
    queryKey: ['pendingSuggestionsCount', user?.id],
    queryFn: () => nextActionsService.getPendingSuggestionsCount(user?.id),
    enabled: !!user,
    refetchInterval: 60000, // Refresh every minute
  })

  useEffect(() => {
    if (data !== undefined) {
      setCount(data)
    }
  }, [data])

  // Real-time subscription for count updates
  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel('pending_suggestions_count')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'next_action_suggestions',
          filter: `user_id=eq.${user.id}`,
        },
        async () => {
          // Refetch count on any change
          const newCount = await nextActionsService.getPendingSuggestionsCount(user.id)
          setCount(newCount)
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [user])

  return count
}

export default useNextActions
