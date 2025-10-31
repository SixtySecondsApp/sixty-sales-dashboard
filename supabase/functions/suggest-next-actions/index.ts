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
    name: string
    email: string
    role: string
  }
  recent_activities?: Array<{
    type: string
    created_at: string
    notes: string
  }>
}

interface NextActionSuggestion {
  action_type: string
  title: string
  reasoning: string
  urgency: 'low' | 'medium' | 'high'
  recommended_deadline: string
  confidence_score: number
  quick_actions: {
    create_task: boolean
    schedule_meeting: boolean
    send_email: boolean
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { activityId, activityType, userId, forceRegenerate }: RequestBody = await req.json()

    if (!activityId || !activityType) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: activityId, activityType' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get authorization token
    const authHeader = req.headers.get('Authorization')
    const isServiceRole = authHeader?.includes(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '')

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      isServiceRole ? (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '') : (Deno.env.get('SUPABASE_ANON_KEY') ?? ''),
      {
        global: {
          headers: authHeader ? { Authorization: authHeader } : {},
        },
      }
    )

    console.log(`[suggest-next-actions] Processing ${activityType} ${activityId}`)

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
        console.log('[suggest-next-actions] Suggestions already exist, skipping')
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

    // Generate suggestions using Claude Haiku 4.5
    const suggestions = await generateSuggestionsWithClaude(context)

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

    console.log(`[suggest-next-actions] Generated ${storedSuggestions.length} suggestions`)

    return new Response(
      JSON.stringify({
        suggestions: storedSuggestions,
        count: storedSuggestions.length,
        activity_type: activityType
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[suggest-next-actions] Error:', error)
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
        contacts:contacts!fk_meetings_primary_contact_id(id, name, email, role)
      `)
      .eq('id', activityId)
      .single()

    if (error || !meeting) {
      console.error('[fetchActivityContext] Meeting fetch error:', error)
      return null
    }

    // Fetch related deal if exists
    let deal = null
    if (meeting.company_id) {
      const { data: dealData } = await supabase
        .from('deals')
        .select('id, title, stage, value')
        .eq('company_id', meeting.company_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      deal = dealData
    }

    // Fetch recent activities for context (last 30 days)
    let recentActivities = []
    if (meeting.company_id) {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const { data: activities } = await supabase
        .from('activities')
        .select('type, created_at, notes')
        .eq('company_id', meeting.company_id)
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(10)

      recentActivities = activities || []
    }

    context = {
      id: meeting.id,
      type: 'meeting',
      title: meeting.title,
      transcript: meeting.transcript_text,
      summary: meeting.summary,
      created_at: meeting.meeting_start,
      deal: deal,
      company: meeting.companies,
      contact: meeting.contacts,
      recent_activities: recentActivities
    }

  } else if (activityType === 'activity') {
    // Fetch general activity
    const { data: activity, error } = await supabase
      .from('activities')
      .select(`
        id,
        type,
        notes,
        created_at,
        company_id,
        deal_id,
        companies:companies!fk_activities_company_id(id, name, domain, size),
        deals:deals!fk_activities_deal_id(id, title, stage, value)
      `)
      .eq('id', activityId)
      .single()

    if (error || !activity) {
      console.error('[fetchActivityContext] Activity fetch error:', error)
      return null
    }

    context = {
      id: activity.id,
      type: activity.type,
      notes: activity.notes,
      created_at: activity.created_at,
      deal: activity.deals,
      company: activity.companies,
      contact: null,
      recent_activities: []
    }
  }

  return context
}

/**
 * Generate next-action suggestions using Claude Haiku 4.5
 */
async function generateSuggestionsWithClaude(
  context: ActivityContext
): Promise<NextActionSuggestion[]> {
  const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!anthropicApiKey) {
    console.error('[generateSuggestionsWithClaude] ANTHROPIC_API_KEY not configured')
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
1. Specific action type (e.g., "send_roi_calculator", "schedule_technical_demo", "follow_up_on_pricing")
2. Clear, actionable title (what to do)
3. Detailed reasoning (why this action matters based on the context)
4. Urgency level (low, medium, high)
5. Recommended deadline (specific date/time)
6. Confidence score (0.0 to 1.0)

Return ONLY a valid JSON array with no additional text.`

  const userPrompt = `Analyze this sales activity and suggest 2-4 next actions:

${contextSummary}

Return suggestions as a JSON array following this exact structure:
[
  {
    "action_type": "send_roi_calculator",
    "title": "Send ROI calculator within 24 hours",
    "reasoning": "Customer expressed concerns about ROI during the call. Specifically mentioned wanting to see numbers before next budget meeting on Friday. Providing calculator now addresses their primary objection and keeps momentum.",
    "urgency": "high",
    "recommended_deadline": "${getRecommendedDeadline(1)}",
    "confidence_score": 0.85,
    "quick_actions": {
      "create_task": true,
      "schedule_meeting": false,
      "send_email": true
    }
  }
]`

  console.log('[generateSuggestionsWithClaude] Calling Claude API')

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
    console.error('[generateSuggestionsWithClaude] Claude API error:', errorText)
    throw new Error('AI service error')
  }

  const responseData = await response.json()
  const aiResponse = responseData.content[0]?.text || '[]'

  console.log('[generateSuggestionsWithClaude] AI response length:', aiResponse.length)

  // Parse JSON response
  try {
    const suggestions = JSON.parse(aiResponse)
    return Array.isArray(suggestions) ? suggestions : []
  } catch (parseError) {
    console.error('[generateSuggestionsWithClaude] Failed to parse AI response:', parseError)
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
    summary += `- Name: ${context.contact.name}\n`
    summary += `- Role: ${context.contact.role || 'N/A'}\n`
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
      summary += `${index + 1}. [${activity.type}] ${new Date(activity.created_at).toLocaleDateString()}: ${activity.notes || 'No notes'}\n`
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
  const storedSuggestions = []

  for (const suggestion of suggestions) {
    const insertData = {
      activity_id: activityId,
      activity_type: activityType,
      deal_id: context.deal?.id || null,
      company_id: context.company?.id || null,
      contact_id: context.contact?.id || null,
      user_id: context.type === 'meeting' ? null : null, // Will be set by RLS or trigger
      action_type: suggestion.action_type,
      title: suggestion.title,
      reasoning: suggestion.reasoning,
      urgency: suggestion.urgency,
      recommended_deadline: suggestion.recommended_deadline,
      confidence_score: suggestion.confidence_score,
      status: 'pending',
      ai_model: Deno.env.get('CLAUDE_MODEL') || 'claude-haiku-4-5-20251001',
      context_quality: context.transcript ? 0.95 : (context.summary ? 0.75 : 0.50)
    }

    const { data, error } = await supabase
      .from('next_action_suggestions')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      console.error('[storeSuggestions] Insert error:', error)
    } else {
      storedSuggestions.push(data)
    }
  }

  return storedSuggestions
}
