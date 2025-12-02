/// <reference path="../deno.d.ts" />

/**
 * Suggest Next Actions Edge Function
 *
 * Analyzes activities (meetings, calls, emails, proposals) using Claude Haiku 4.5
 * to generate intelligent next-action suggestions with reasoning.
 *
 * Features:
 * - Full transcript analysis for meetings
 * - Context-aware recommendations based on deal stage, company data
 * - Confidence scoring and urgency classification
 * - Generates 2-4 prioritized actionable suggestions
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RequestBody {
  activityId: string
  activityType: 'meeting' | 'activity' | 'email' | 'proposal' | 'call'
  userId?: string
  forceRegenerate?: boolean
  existingContext?: {
    suggestions?: Array<{ title: string; action_type: string; status: string }>
    tasks?: Array<{ title: string; task_type: string; status: string }>
  }
}

interface ActivityContext {
  id: string
  type: string
  title?: string
  transcript?: string
  summary?: string
  notes?: string
  created_at: string
  deal?: {
    id: string
    title: string
    stage: string
    value: number
  }
  company?: {
    id: string
    name: string
    domain: string
    size: string
  }
  contact?: {
    id: string
    first_name?: string
    last_name?: string
    full_name?: string
    email?: string
    title?: string
  }
  recent_activities?: Array<{
    type: string
    created_at: string
    notes: string
    details?: string
  }>
}

interface NextActionSuggestion {
  action_type: string
  title: string
  reasoning: string
  urgency: 'low' | 'medium' | 'high'
  recommended_deadline: string
  confidence_score: number
  quick_actions?: {
    create_task: boolean
    schedule_meeting: boolean
    send_email: boolean
  }
  source?: 'custom_rule' | 'ai_analysis'
  matchedRuleId?: string
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { activityId, activityType, userId, forceRegenerate, existingContext }: RequestBody = await req.json()

    if (!activityId || !activityType) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: activityId, activityType' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get authorization token
    const authHeader = req.headers.get('Authorization')

    // ALWAYS use service role for database operations to bypass RLS
    // Edge Functions need elevated permissions to insert AI suggestions
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        },
        db: {
          schema: 'public'
        }
      }
    )
    // Check if suggestions already exist (unless force regenerate)
    if (!forceRegenerate) {
      const { data: existingSuggestions } = await supabaseClient
        .from('next_action_suggestions')
        .select('id')
        .eq('activity_id', activityId)
        .eq('activity_type', activityType)
        .eq('status', 'pending')
        .limit(1)

      if (existingSuggestions && existingSuggestions.length > 0) {
        return new Response(
          JSON.stringify({ message: 'Suggestions already exist', skipped: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Fetch activity context based on type
    const context = await fetchActivityContext(supabaseClient, activityId, activityType)

    if (!context) {
      return new Response(
        JSON.stringify({ error: 'Activity not found or insufficient context' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get user ID for extraction rules (from meeting owner or context)
    let userId: string | null = null
    if (context.type === 'meeting') {
      const { data: meeting } = await supabaseClient
        .from('meetings')
        .select('owner_user_id')
        .eq('id', context.id)
        .single()
      userId = meeting?.owner_user_id || null
    }

    // Apply custom extraction rules first (Phase 6.3)
    const ruleBasedSuggestions = userId && context.transcript
      ? await applyExtractionRules(supabaseClient, userId, context.transcript, context)
      : []

    // Generate AI suggestions using Claude Haiku 4.5
    const aiSuggestions = await generateSuggestionsWithClaude(context, existingContext)

    // Merge rule-based suggestions with AI suggestions (prioritize custom rules)
    const suggestions = mergeSuggestions(ruleBasedSuggestions, aiSuggestions)

    if (!suggestions || suggestions.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No suggestions generated', suggestions: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Store suggestions in database
    const storedSuggestions = await storeSuggestions(
      supabaseClient,
      activityId,
      activityType,
      context,
      suggestions
    )
    // AUTO-CREATE TASKS from suggestions (NEW UNIFIED SYSTEM)
    const createdTasks = await autoCreateTasksFromSuggestions(
      supabaseClient,
      storedSuggestions,
      context
    )
    // Create notification for user if tasks were created
    if (createdTasks.length > 0 && context.type === 'meeting') {
      try {
        const taskIds = createdTasks.map(t => t.id);
        const { data: meeting } = await supabaseClient
          .from('meetings')
          .select('owner_user_id, title')
          .eq('id', context.id)
          .single();

        if (meeting?.owner_user_id) {
          await supabaseClient.rpc('create_task_creation_notification', {
            p_user_id: meeting.owner_user_id,
            p_meeting_id: context.id,
            p_meeting_title: context.title || meeting.title || 'Meeting',
            p_task_count: createdTasks.length,
            p_task_ids: taskIds
          });
        }
      } catch (notifError) {
        // Don't fail the whole request if notification fails
      }
    }

    return new Response(
      JSON.stringify({
        suggestions: storedSuggestions,
        tasks: createdTasks,
        count: storedSuggestions.length,
        activity_type: activityType
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

/**
 * Fetch comprehensive activity context for AI analysis
 */
async function fetchActivityContext(
  supabase: any,
  activityId: string,
  activityType: string
): Promise<ActivityContext | null> {
  let context: ActivityContext | null = null

  if (activityType === 'meeting') {
    // Fetch meeting with related data
    const { data: meeting, error } = await supabase
      .from('meetings')
      .select(`
        id,
        title,
        transcript_text,
        summary,
        meeting_start,
        company_id,
        primary_contact_id,
        owner_user_id,
        companies:companies!fk_meetings_company_id(id, name, domain, size),
        contacts:contacts!primary_contact_id(id, first_name, last_name, full_name, email, title)
      `)
      .eq('id', activityId)
      .single()

    if (error || !meeting) {
      return null
    }

    // Fetch related deal if exists
    let deal: { id: string; title: string | null; stage: string | null; value: number | null } | null = null
    if (meeting.company_id) {
      const { data: dealData } = await supabase
        .from('deals')
        .select('id, title, stage, value')
        .eq('company_id', meeting.company_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      deal = dealData as { id: string; title: string | null; stage: string | null; value: number | null } | null
    }

    // Fetch recent activities for context (last 30 days)
    let recentActivities: Array<{
      type: string
      created_at: string
      notes: string
      details?: string
    }> = []
    if (meeting.company_id) {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const { data: activities } = await supabase
        .from('activities')
        .select('type, created_at, details')
        .eq('company_id', meeting.company_id)
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(10)

      recentActivities = (activities || []).map((a: any) => ({
        type: a.type,
        created_at: a.created_at,
        notes: a.details || '',
        details: a.details
      }))
    }

    context = {
      id: meeting.id,
      type: 'meeting',
      title: meeting.title,
      transcript: meeting.transcript_text,
      summary: meeting.summary,
      created_at: meeting.meeting_start,
      deal: deal ? {
        id: deal.id,
        title: deal.title || '',
        stage: deal.stage || '',
        value: deal.value || 0
      } : undefined,
      company: meeting.companies,
      contact: meeting.contacts ? {
        id: meeting.contacts.id,
        first_name: meeting.contacts.first_name,
        last_name: meeting.contacts.last_name,
        full_name: meeting.contacts.full_name,
        email: meeting.contacts.email,
        title: meeting.contacts.title
      } : undefined,
      recent_activities: recentActivities
    }

  } else if (activityType === 'activity') {
    // Fetch general activity
    const { data: activity, error } = await supabase
      .from('activities')
      .select(`
        id,
        type,
        details,
        created_at,
        company_id,
        deal_id,
        companies:companies!fk_activities_company_id(id, name, domain, size),
        deals:deals!fk_activities_deal_id(id, title, stage, value)
      `)
      .eq('id', activityId)
      .single()

    if (error || !activity) {
      return null
    }

    context = {
      id: activity.id,
      type: activity.type,
      notes: activity.details, // Use 'details' field from activities table
      created_at: activity.created_at,
      deal: activity.deals ? {
        id: activity.deals.id,
        title: activity.deals.title || '',
        stage: activity.deals.stage || '',
        value: activity.deals.value || 0
      } : undefined,
      company: activity.companies,
      contact: undefined,
      recent_activities: []
    }
  }

  return context
}

/**
 * Generate next-action suggestions using Claude Haiku 4.5
 */
async function generateSuggestionsWithClaude(
  context: ActivityContext,
  existingContext?: {
    suggestions?: Array<{ title: string; action_type: string; status: string }>
    tasks?: Array<{ title: string; task_type: string; status: string }>
  }
): Promise<NextActionSuggestion[]> {
  const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!anthropicApiKey) {
    throw new Error('AI service not configured')
  }

  // Build context for AI
  const contextSummary = buildContextSummary(context)

  // System prompt
  const systemPrompt = `You are an expert sales AI assistant analyzing customer interactions to suggest the most effective next actions for sales representatives.

Your goal is to analyze the activity context and recommend 2-4 specific, actionable next steps that will move the deal forward.

Consider:
- Buying signals and concerns mentioned
- Current deal stage and momentum
- Time-sensitive opportunities
- Relationship building needs
- Objection handling requirements

For each suggestion, provide:
1. Task category - MUST be one of: call, email, meeting, follow_up, proposal, demo, general
2. Clear, actionable title (what to do)
3. Detailed reasoning (why this action matters based on the context)
4. Urgency level (low, medium, high)
5. Recommended deadline (realistic ISO 8601 date based on urgency and context)
6. Confidence score (0.0 to 1.0)
7. Timestamp (optional) - If you can identify roughly when this topic was discussed in the transcript, estimate the time in seconds from the start of the meeting

**Task Category Guidelines**:
- "call" - Phone calls to prospect/customer
- "email" - Email communications (proposals, ROI docs, follow-ups)
- "meeting" - Schedule demos, strategy sessions, reviews
- "follow_up" - General follow-up on previous discussions
- "proposal" - Create and send formal proposals
- "demo" - Product demonstrations or technical deep-dives
- "general" - Other tasks not fitting above categories

**Deadline Guidelines**:
- High urgency: 1-2 days
- Medium urgency: 3-5 days
- Low urgency: 1-2 weeks
- Consider mentioned timeframes (e.g., "budget meeting Friday" = set deadline before Friday)

**Timestamp Guidelines**:
- If the transcript shows when a topic was discussed, estimate the seconds from start
- This helps users jump to the relevant part of the recording
- If unsure, omit the timestamp field (better to have no timestamp than wrong timestamp)

Return ONLY a valid JSON array with no additional text.`

  // Build existing context summary for duplicate prevention
  let existingContextSummary = '';
  if (existingContext && (existingContext.suggestions?.length || existingContext.tasks?.length)) {
    existingContextSummary = '\n\n**IMPORTANT - EXISTING TASKS AND SUGGESTIONS TO AVOID DUPLICATES:**\n\n';

    if (existingContext.suggestions && existingContext.suggestions.length > 0) {
      existingContextSummary += 'Previously Suggested Actions:\n';
      existingContext.suggestions.forEach((s, i) => {
        existingContextSummary += `${i + 1}. [${s.action_type}] ${s.title} (Status: ${s.status})\n`;
      });
      existingContextSummary += '\n';
    }

    if (existingContext.tasks && existingContext.tasks.length > 0) {
      existingContextSummary += 'Already Created Tasks:\n';
      existingContext.tasks.forEach((t, i) => {
        existingContextSummary += `${i + 1}. [${t.task_type}] ${t.title} (Status: ${t.status})\n`;
      });
      existingContextSummary += '\n';
    }

    existingContextSummary += 'DO NOT suggest tasks that are similar to or duplicate the ones listed above. Focus on NEW, DIFFERENT action items that haven\'t been covered yet.\n';
  }

  const userPrompt = `Analyze this sales activity and suggest 2-4 next actions:

${contextSummary}${existingContextSummary}

Return suggestions as a JSON array following this exact structure:
[
  {
    "task_category": "email",
    "title": "Send ROI calculator within 24 hours",
    "reasoning": "Customer expressed concerns about ROI during the call. Specifically mentioned wanting to see numbers before next budget meeting on Friday. Providing calculator now addresses their primary objection and keeps momentum.",
    "urgency": "high",
    "recommended_deadline": "${getRecommendedDeadline(1)}",
    "confidence_score": 0.85,
    "timestamp_seconds": 450
  }
]

IMPORTANT:
- Use "task_category" not "action_type". Valid categories: call, email, meeting, follow_up, proposal, demo, general
- Include "timestamp_seconds" if you can identify when this was discussed (omit if unsure)
- timestamp_seconds should be the approximate seconds from start of meeting`
  const model = Deno.env.get('CLAUDE_MODEL') || 'claude-haiku-4-5-20251001'
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicApiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      temperature: 0.7,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt
        }
      ]
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error('AI service error')
  }

  const responseData = await response.json()
  let aiResponse = responseData.content[0]?.text || '[]'
  // Strip markdown code blocks if present (```json ... ```)
  const codeBlockMatch = aiResponse.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (codeBlockMatch) {
    aiResponse = codeBlockMatch[1].trim()
  }

  // Parse JSON response
  try {
    const suggestions = JSON.parse(aiResponse)
    return Array.isArray(suggestions) ? suggestions : []
  } catch (parseError) {
    return []
  }
}

/**
 * Build comprehensive context summary for AI analysis
 */
function buildContextSummary(context: ActivityContext): string {
  let summary = `Activity Type: ${context.type}\n`

  if (context.title) {
    summary += `Title: ${context.title}\n`
  }

  if (context.company) {
    summary += `\nCompany Information:\n`
    summary += `- Name: ${context.company.name}\n`
    summary += `- Domain: ${context.company.domain || 'N/A'}\n`
    summary += `- Size: ${context.company.size || 'N/A'}\n`
  }

  if (context.deal) {
    summary += `\nDeal Information:\n`
    summary += `- Title: ${context.deal.title}\n`
    summary += `- Stage: ${context.deal.stage}\n`
    summary += `- Value: $${context.deal.value.toLocaleString()}\n`
  }

  if (context.contact) {
    summary += `\nPrimary Contact:\n`
    const contactName = context.contact.full_name || `${context.contact.first_name || ''} ${context.contact.last_name || ''}`.trim() || 'N/A'
    summary += `- Name: ${contactName}\n`
    summary += `- Title: ${context.contact.title || 'N/A'}\n`
  }

  if (context.transcript && context.transcript.length > 100) {
    summary += `\nFull Meeting Transcript:\n${context.transcript}\n`
  } else if (context.summary) {
    summary += `\nMeeting Summary:\n${context.summary}\n`
  } else if (context.notes) {
    summary += `\nActivity Notes:\n${context.notes}\n`
  }

  if (context.recent_activities && context.recent_activities.length > 0) {
    summary += `\nRecent Activity History (last 30 days):\n`
    context.recent_activities.forEach((activity, index) => {
      summary += `${index + 1}. [${activity.type}] ${new Date(activity.created_at).toLocaleDateString()}: ${activity.notes || activity.details || 'No details'}\n`
    })
  }

  return summary
}

/**
 * Get recommended deadline based on days from now
 */
function getRecommendedDeadline(daysFromNow: number): string {
  const deadline = new Date()
  deadline.setDate(deadline.getDate() + daysFromNow)
  return deadline.toISOString()
}

/**
 * Store suggestions in database
 */
async function storeSuggestions(
  supabase: any,
  activityId: string,
  activityType: string,
  context: ActivityContext,
  suggestions: NextActionSuggestion[]
): Promise<any[]> {
  const storedSuggestions: any[] = []

  for (const suggestion of suggestions) {
    // Map task_category to action_type (handle both field names for compatibility)
    const taskCategory = (suggestion as any).task_category || suggestion.action_type || 'general'

    // Validate task category is one of the allowed values
    const validCategories = ['call', 'email', 'meeting', 'follow_up', 'proposal', 'demo', 'general']
    const action_type = validCategories.includes(taskCategory) ? taskCategory : 'general'
    // Extract timestamp if provided
    const timestamp_seconds = (suggestion as any).timestamp_seconds || null

    const insertData = {
      activity_id: activityId,
      activity_type: activityType,
      deal_id: context.deal?.id || null,
      company_id: context.company?.id || null,
      contact_id: context.contact?.id || null,
      user_id: context.type === 'meeting' ? null : null, // Will be set by RLS or trigger
      action_type: action_type,
      title: suggestion.title,
      reasoning: suggestion.reasoning,
      urgency: suggestion.urgency,
      recommended_deadline: suggestion.recommended_deadline,
      confidence_score: suggestion.confidence_score,
      timestamp_seconds: timestamp_seconds,
      status: 'pending',
      ai_model: Deno.env.get('CLAUDE_MODEL') || 'claude-haiku-4-5-20251001',
      context_quality: context.transcript ? 0.95 : (context.summary ? 0.75 : 0.50)
    }

    if (timestamp_seconds) {
    }

    const { data, error } = await supabase
      .from('next_action_suggestions')
      .insert(insertData)
      .select()
      .single()

    if (error) {
    } else if (data) {
      storedSuggestions.push(data as any)
    }
  }

  return storedSuggestions
}

const FALLBACK_DAYS_BY_URGENCY: Record<string, number> = {
  critical: 1,
  high: 2,
  medium: 3,
  low: 7
}

function computeSafeDueDate(
  suggestion: any
): { dueDate: string; originalDeadline?: string | null } {
  const now = new Date()
  const recommended = suggestion?.recommended_deadline
    ? new Date(suggestion.recommended_deadline)
    : null

  if (recommended && !isNaN(recommended.getTime()) && recommended.getTime() > now.getTime()) {
    return { dueDate: recommended.toISOString() }
  }

  const fallback = new Date(now)
  const urgencyKey = (suggestion?.urgency || '').toLowerCase()
  const normalizedUrgency = urgencyKey === 'urgent' ? 'critical' : urgencyKey
  const fallbackDays = FALLBACK_DAYS_BY_URGENCY[normalizedUrgency] ?? FALLBACK_DAYS_BY_URGENCY.medium
  fallback.setDate(fallback.getDate() + fallbackDays)

  return {
    dueDate: fallback.toISOString(),
    originalDeadline: suggestion?.recommended_deadline || null
  }
}

/**
 * AUTO-CREATE TASKS from AI suggestions (NEW UNIFIED SYSTEM)
 * Automatically converts accepted AI suggestions into tasks
 */
async function autoCreateTasksFromSuggestions(
  supabase: any,
  suggestions: any[],
  context: ActivityContext
): Promise<any[]> {
  const createdTasks: any[] = []

  // Get meeting owner or default user for task assignment
  let ownerId = null
  if (context.type === 'meeting') {
    const { data: meeting } = await supabase
      .from('meetings')
      .select('owner_user_id')
      .eq('id', context.id)
      .single()
    ownerId = meeting?.owner_user_id
  }

  if (!ownerId) {
    return []
  }

  for (const suggestion of suggestions) {
    try {
      // Map urgency to priority
      const priorityMap = {
        'critical': 'urgent',
        'high': 'high',
        'medium': 'medium',
        'low': 'low'
      }
      const priority = priorityMap[suggestion.urgency] || 'medium'

      const { dueDate, originalDeadline } = computeSafeDueDate(suggestion)

      const taskData = {
        title: suggestion.title,
        description: suggestion.reasoning,
        task_type: suggestion.action_type,
        priority: priority,
        due_date: dueDate,
        status: 'pending',
        assigned_to: ownerId,
        created_by: ownerId,
        meeting_id: context.type === 'meeting' ? context.id : null,
        company_id: suggestion.company_id,
        contact_id: suggestion.contact_id,
        source: 'ai_suggestion',
        metadata: {
          suggestion_id: suggestion.id,
          confidence_score: suggestion.confidence_score,
          timestamp_seconds: suggestion.timestamp_seconds,
          urgency: suggestion.urgency,
          ai_model: suggestion.ai_model,
          auto_created: true,
          created_at: new Date().toISOString(),
          ...(originalDeadline
            ? { original_recommended_deadline: originalDeadline }
            : {})
        }
      }

      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .insert(taskData)
        .select()
        .single()

      if (taskError) {
        continue
      }

      // Mark suggestion as accepted (auto-converted to task)
      await supabase
        .from('next_action_suggestions')
        .update({ status: 'accepted' })
        .eq('id', suggestion.id)

      if (task) {
        createdTasks.push(task as any)
      }
    } catch (error) {
    }
  }

  return createdTasks
}

/**
 * Apply custom extraction rules to transcript (Phase 6.3)
 * Returns suggestions based on user-defined trigger phrases
 */
async function applyExtractionRules(
  supabase: any,
  userId: string,
  transcript: string,
  context: ActivityContext
): Promise<NextActionSuggestion[]> {
  try {
    // Fetch active extraction rules for user
    const { data: rules, error } = await supabase
      .from('task_extraction_rules')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)

    if (error || !rules || rules.length === 0) {
      return []
    }

    const lowerTranscript = transcript.toLowerCase()
    const suggestions: NextActionSuggestion[] = []

    // Check each rule against transcript
    for (const rule of rules) {
      // Check if any trigger phrase matches
      const matchingPhrase = rule.trigger_phrases.find((phrase: string) =>
        lowerTranscript.includes(phrase.toLowerCase())
      )

      if (matchingPhrase) {
        // Find the sentence containing the trigger phrase
        const sentences = transcript.split(/[.!?]\s+/)
        const matchingSentence = sentences.find((sentence: string) =>
          sentence.toLowerCase().includes(matchingPhrase.toLowerCase())
        )

        // Create task title from sentence or phrase
        const taskTitle = matchingSentence?.trim() || `Follow up on: ${matchingPhrase}`

        // Calculate deadline based on rule's default_deadline_days
        const deadline = rule.default_deadline_days
          ? new Date(Date.now() + rule.default_deadline_days * 24 * 60 * 60 * 1000).toISOString()
          : getRecommendedDeadline(3) // Default to 3 days if not specified

        // Map priority to urgency
        const urgencyMap: Record<string, 'low' | 'medium' | 'high'> = {
          'low': 'low',
          'medium': 'medium',
          'high': 'high',
          'urgent': 'high'
        }

        suggestions.push({
          action_type: rule.task_category || 'general',
          title: taskTitle,
          reasoning: `Automatically extracted based on custom rule: "${rule.name}". Trigger phrase: "${matchingPhrase}"`,
          urgency: urgencyMap[rule.default_priority] || 'medium',
          recommended_deadline: deadline,
          confidence_score: 0.95, // High confidence for rule-based extraction
          source: 'custom_rule',
          matchedRuleId: rule.id
        })
      }
    }

    return suggestions
  } catch (error) {
    console.error('Error applying extraction rules:', error)
    return []
  }
}

/**
 * Merge rule-based suggestions with AI suggestions
 * Prioritizes custom rules over AI analysis
 */
function mergeSuggestions(
  ruleSuggestions: NextActionSuggestion[],
  aiSuggestions: NextActionSuggestion[]
): NextActionSuggestion[] {
  const merged: NextActionSuggestion[] = []
  const seenTitles = new Set<string>()

  // Add rule-based suggestions first (higher priority)
  for (const suggestion of ruleSuggestions) {
    const key = suggestion.title.toLowerCase().trim()
    if (!seenTitles.has(key)) {
      merged.push(suggestion)
      seenTitles.add(key)
    }
  }

  // Add AI suggestions that don't conflict
  for (const suggestion of aiSuggestions) {
    const key = suggestion.title.toLowerCase().trim()
    if (!seenTitles.has(key)) {
      // Ensure source is set
      if (!suggestion.source) {
        suggestion.source = 'ai_analysis'
      }
      merged.push(suggestion)
      seenTitles.add(key)
    }
  }

  return merged
}
