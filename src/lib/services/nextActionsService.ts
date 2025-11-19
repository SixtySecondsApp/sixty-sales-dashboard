/**
 * Next Actions Service
 *
 * Service layer for interacting with AI-generated next-action suggestions.
 * Provides functions to fetch, accept, dismiss, and manage suggestions.
 */

import { supabase } from '../supabase/clientV2'

export interface NextActionSuggestion {
  id: string
  activity_id: string
  activity_type: 'meeting' | 'activity' | 'email' | 'proposal' | 'call'
  deal_id: string | null
  company_id: string | null
  contact_id: string | null
  user_id: string
  action_type: string
  title: string
  reasoning: string
  urgency: 'low' | 'medium' | 'high'
  recommended_deadline: string | null
  confidence_score: number
  status: 'pending' | 'accepted' | 'dismissed' | 'completed'
  user_feedback: string | null
  created_task_id: string | null
  created_at: string
  dismissed_at: string | null
  accepted_at: string | null
  completed_at: string | null
  ai_model: string
  context_quality: number
  // Joined data
  companies?: {
    id: string
    name: string
    domain: string | null
  }
  deals?: {
    id: string
    title: string
    stage: string
  }
  tasks?: {
    id: string
    title: string
    status: string
  }
}

export interface SuggestionsFilters {
  userId?: string
  status?: 'pending' | 'accepted' | 'dismissed' | 'completed' | 'all'
  urgency?: 'low' | 'medium' | 'high'
  activityId?: string
  activityType?: string
  dealId?: string
  companyId?: string
  contactId?: string
  limit?: number
  includeCompleted?: boolean
}

export interface CreateTaskOptions {
  title?: string
  description?: string
  due_date?: string
  priority?: 'low' | 'medium' | 'high' | 'urgent'
}

/**
 * Next Actions Service
 */
export const nextActionsService = {
  /**
   * Generate suggestions for an activity (calls Edge Function)
   */
  async generateSuggestions(
    activityId: string,
    activityType: 'meeting' | 'activity' | 'email' | 'proposal' | 'call',
    forceRegenerate = false
  ): Promise<{ suggestions: NextActionSuggestion[]; count: number }> {
    try {
      const { data, error } = await supabase.functions.invoke('suggest-next-actions', {
        body: {
          activityId,
          activityType,
          forceRegenerate,
        },
      })

      if (error) {
        throw error
      }

      return {
        suggestions: data?.suggestions || [],
        count: data?.count || 0,
      }
    } catch (error) {
      throw error
    }
  },

  /**
   * Fetch suggestions with filters
   */
  async getSuggestions(filters: SuggestionsFilters = {}): Promise<NextActionSuggestion[]> {
    try {
      let query = supabase
        .from('next_action_suggestions')
        .select(`
          *,
          companies:companies!next_action_suggestions_company_id_fkey(id, name, domain),
          deals:deals!next_action_suggestions_deal_id_fkey(id, title, stage),
          tasks:tasks!next_action_suggestions_created_task_id_fkey(id, title, status)
        `)
        .order('created_at', { ascending: false })

      // Apply filters
      if (filters.userId) {
        query = query.eq('user_id', filters.userId)
      }

      if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status)
      } else if (!filters.includeCompleted) {
        // By default, exclude completed unless explicitly requested
        query = query.in('status', ['pending', 'accepted', 'dismissed'])
      }

      if (filters.urgency) {
        query = query.eq('urgency', filters.urgency)
      }

      if (filters.activityId) {
        query = query.eq('activity_id', filters.activityId)
      }

      if (filters.activityType) {
        query = query.eq('activity_type', filters.activityType)
      }

      if (filters.dealId) {
        query = query.eq('deal_id', filters.dealId)
      }

      if (filters.companyId) {
        query = query.eq('company_id', filters.companyId)
      }

      if (filters.contactId) {
        query = query.eq('contact_id', filters.contactId)
      }

      if (filters.limit) {
        query = query.limit(filters.limit)
      }

      const { data, error } = await query

      if (error) {
        // Log error but don't throw - return empty array instead
        // This prevents console spam from failed requests
        console.warn('Failed to fetch next_action_suggestions:', error.message)
        return []
      }

      return (data || []) as NextActionSuggestion[]
    } catch (error: any) {
      // Silently handle errors to prevent console spam
      console.warn('Error in getSuggestions:', error?.message || 'Unknown error')
      return []
    }
  },

  /**
   * Get suggestions for a specific activity
   */
  async getSuggestionsForActivity(
    activityId: string,
    activityType: string
  ): Promise<NextActionSuggestion[]> {
    return this.getSuggestions({
      activityId,
      activityType,
      status: 'pending',
    })
  },

  /**
   * Get pending suggestions count for current user
   */
  async getPendingSuggestionsCount(userId?: string): Promise<number> {
    try {
      const { data, error } = await supabase.rpc('get_pending_suggestions_count', {
        p_user_id: userId || null,
      })

      if (error) {
        return 0
      }

      return data || 0
    } catch (error) {
      return 0
    }
  },

  /**
   * Accept a suggestion and create a task
   */
  async acceptSuggestion(
    suggestionId: string,
    taskOptions?: CreateTaskOptions
  ): Promise<string> {
    try {
      const { data, error } = await supabase.rpc('accept_next_action_suggestion', {
        p_suggestion_id: suggestionId,
        p_task_data: taskOptions || null,
      })

      if (error) {
        throw error
      }

      return data // Returns task_id
    } catch (error) {
      throw error
    }
  },

  /**
   * Dismiss a suggestion with optional feedback
   */
  async dismissSuggestion(suggestionId: string, feedback?: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('dismiss_next_action_suggestion', {
        p_suggestion_id: suggestionId,
        p_feedback: feedback || null,
      })

      if (error) {
        throw error
      }

      return data === true
    } catch (error) {
      throw error
    }
  },

  /**
   * Create task from suggestion with customization
   */
  async createTaskFromSuggestion(
    suggestionId: string,
    taskOverrides: CreateTaskOptions
  ): Promise<string> {
    return this.acceptSuggestion(suggestionId, taskOverrides)
  },

  /**
   * Accept all suggestions for an activity
   */
  async acceptAllForActivity(
    activityId: string,
    activityType: string
  ): Promise<string[]> {
    try {
      const suggestions = await this.getSuggestionsForActivity(activityId, activityType)

      const taskIds: string[] = []

      for (const suggestion of suggestions) {
        try {
          const taskId = await this.acceptSuggestion(suggestion.id)
          taskIds.push(taskId)
        } catch (error) {
        }
      }

      return taskIds
    } catch (error) {
      throw error
    }
  },

  /**
   * Dismiss all suggestions for an activity
   */
  async dismissAllForActivity(
    activityId: string,
    activityType: string,
    feedback?: string
  ): Promise<number> {
    try {
      const suggestions = await this.getSuggestionsForActivity(activityId, activityType)

      let dismissedCount = 0

      for (const suggestion of suggestions) {
        try {
          const success = await this.dismissSuggestion(suggestion.id, feedback)
          if (success) dismissedCount++
        } catch (error) {
        }
      }

      return dismissedCount
    } catch (error) {
      throw error
    }
  },

  /**
   * Mark suggestion as completed (when associated task is done)
   */
  async markSuggestionCompleted(suggestionId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('next_action_suggestions')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', suggestionId)

      if (error) {
        throw error
      }

      return true
    } catch (error) {
      throw error
    }
  },

  /**
   * Get suggestions grouped by urgency
   */
  async getSuggestionsGroupedByUrgency(
    userId?: string
  ): Promise<Record<string, NextActionSuggestion[]>> {
    try {
      const suggestions = await this.getSuggestions({
        userId,
        status: 'pending',
      })

      const grouped: Record<string, NextActionSuggestion[]> = {
        high: [],
        medium: [],
        low: [],
      }

      suggestions.forEach((suggestion) => {
        grouped[suggestion.urgency].push(suggestion)
      })

      return grouped
    } catch (error) {
      throw error
    }
  },

  /**
   * Get top priority suggestions (high urgency, high confidence)
   */
  async getTopPrioritySuggestions(limit: number = 5): Promise<NextActionSuggestion[]> {
    try {
      const suggestions = await this.getSuggestions({
        status: 'pending',
        limit: 100, // Fetch more to filter
      })

      // Sort by urgency (high first) and confidence score (descending)
      const urgencyOrder = { high: 3, medium: 2, low: 1 }

      const sorted = suggestions.sort((a, b) => {
        const urgencyDiff = urgencyOrder[b.urgency] - urgencyOrder[a.urgency]
        if (urgencyDiff !== 0) return urgencyDiff
        return b.confidence_score - a.confidence_score
      })

      return sorted.slice(0, limit)
    } catch (error) {
      throw error
    }
  },

  /**
   * Regenerate suggestions for an activity (manual trigger)
   */
  async regenerateSuggestions(
    activityId: string,
    activityType: 'meeting' | 'activity' | 'email' | 'proposal' | 'call'
  ): Promise<{ suggestions: NextActionSuggestion[]; count: number }> {
    return this.generateSuggestions(activityId, activityType, true)
  },
}

export default nextActionsService
