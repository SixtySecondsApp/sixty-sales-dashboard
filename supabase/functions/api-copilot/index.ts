/// <reference path="../deno.d.ts" />

/**
 * Copilot API Edge Function
 * 
 * Provides AI Copilot functionality with Claude Sonnet 4:
 * - POST /api-copilot/chat - Main chat endpoint
 * - POST /api-copilot/actions/draft-email - Email draft endpoint
 * - GET /api-copilot/conversations/:id - Fetch conversation history
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { 
  createSuccessResponse,
  createErrorResponse,
  extractIdFromPath,
  isValidUUID
} from '../_shared/api-utils.ts'
import { 
  rateLimitMiddleware,
  RATE_LIMIT_CONFIGS
} from '../_shared/rateLimiter.ts'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
const ANTHROPIC_VERSION = '2023-06-01' // API version for tool calling

interface ChatRequest {
  message: string
  conversationId?: string
  targetUserId?: string // Optional: for admins to query other users' performance
  context?: {
    userId: string
    currentView?: 'dashboard' | 'contact' | 'pipeline'
    contactId?: string
    dealIds?: string[]
    taskId?: string
  }
}

interface DraftEmailRequest {
  contactId: string
  context: string
  tone: 'professional' | 'friendly' | 'concise'
}

interface CopilotMessage {
  role: 'user' | 'assistant'
  content: string
  recommendations?: any[]
}

interface ToolResult {
  type: 'tool_result'
  tool_use_id: string
  content: string
  is_error?: boolean
}

interface StructuredResponse {
  type: string
  summary?: string
  data?: any
  actions?: Array<{
    id: string
    label: string
    type: string
    icon: string
    callback: string
    params?: any
  }>
  metadata?: any
}

interface ContactData {
  id: string
  full_name?: string
  first_name?: string
  last_name?: string
  email?: string
  phone?: string
  title?: string
  company_id?: string
  companies?: {
    name?: string
  }
}

interface TaskData {
  id: string
  ticket_id?: string
  title: string
  description?: string
  type?: string
  priority?: string
  status?: string
  submitted_by?: string
  created_at?: string
  updated_at?: string
}

interface UserData {
  id: string
  email?: string
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Authenticate request using JWT token (not API key)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return createErrorResponse('Authorization header with Bearer token required', 401, 'UNAUTHORIZED')
    }

    const jwt = authHeader.replace('Bearer ', '')
    
    // Create Supabase client with anon key for JWT validation
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
    
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader }
      },
      auth: {
        persistSession: false
      }
    })

    // Get user from JWT token
    const { data: { user }, error: authError } = await authClient.auth.getUser(jwt)
    
    if (authError || !user) {
      return createErrorResponse('Invalid or expired authentication token', 401, 'UNAUTHORIZED')
    }

    // Create service role client for database operations (bypasses RLS)
    const client = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    )

    const user_id = user.id
    
    const url = new URL(req.url)
    // Filter out 'functions', 'v1', and function name from pathname (Supabase includes these)
    // The pathname will be like: /functions/v1/api-copilot/actions/generate-deal-email
    const pathParts = url.pathname
      .split('/')
      .filter(segment => segment && segment !== 'functions' && segment !== 'v1' && segment !== 'api-copilot')
    const endpoint = pathParts[0] || '' // 'chat', 'actions', 'conversations'
    const resourceId = pathParts[1] || '' // conversation ID, 'generate-deal-email', etc.
    
    // Debug logging for path parsing
    console.log('[API-COPILOT] Path parsing:', {
      fullPath: url.pathname,
      pathParts,
      endpoint,
      resourceId,
      method: req.method,
      allPathParts: url.pathname.split('/')
    })

    // Apply rate limiting (100 requests/hour for Copilot)
    // Create a client with anon key for rate limiting (it needs to check user auth)
    const rateLimitClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader }
      }
    })
    
    const rateLimitConfig = {
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 100, // 100 requests per hour
      message: 'Rate limit exceeded. Please try again later.'
    }
    
    const rateLimitResponse = await rateLimitMiddleware(
      rateLimitClient,
      req,
      `api-copilot-${endpoint}`,
      rateLimitConfig
    )
    
    if (rateLimitResponse) {
      return rateLimitResponse
    }

    // Route to appropriate handler
    console.log('[API-COPILOT] Attempting to route:', { 
      endpoint, 
      resourceId, 
      method: req.method,
      matchesChat: req.method === 'POST' && endpoint === 'chat',
      matchesDraftEmail: req.method === 'POST' && endpoint === 'actions' && resourceId === 'draft-email',
      matchesGenerateEmail: req.method === 'POST' && endpoint === 'actions' && resourceId === 'generate-deal-email',
      matchesConversations: req.method === 'GET' && endpoint === 'conversations' && resourceId
    })
    
    if (req.method === 'POST' && endpoint === 'chat') {
      return await handleChat(client, req, user_id)
    } else if (req.method === 'POST' && endpoint === 'actions' && resourceId === 'draft-email') {
      return await handleDraftEmail(client, req, user_id)
    } else if (req.method === 'POST' && endpoint === 'actions' && resourceId === 'generate-deal-email') {
      console.log('[API-COPILOT] ✅ Routing to handleGenerateDealEmail')
      return await handleGenerateDealEmail(client, req, user_id)
    } else if (req.method === 'GET' && endpoint === 'conversations' && resourceId) {
      return await handleGetConversation(client, resourceId, user_id)
    } else {
      console.log('[API-COPILOT] ❌ No route matched:', { 
        endpoint, 
        resourceId, 
        method: req.method,
        fullPath: url.pathname,
        pathParts
      })
      return createErrorResponse(
        `Endpoint not found. Received: ${req.method} ${endpoint || '(empty)'}/${resourceId || '(empty)'}. Full path: ${url.pathname}`,
        404,
        'NOT_FOUND'
      )
    }

  } catch (error) {
    return createErrorResponse(
      error.message || 'Internal server error',
      error.status || 500,
      'INTERNAL_ERROR'
    )
  }
})

/**
 * Handle chat requests
 */
async function handleChat(
  client: any,
  req: Request,
  userId: string
): Promise<Response> {
  const requestStartTime = Date.now()
  let analyticsData: any = {
    user_id: userId,
    request_type: 'chat',
    message_length: 0,
    response_length: 0,
    response_time_ms: 0,
    claude_api_time_ms: 0,
    tool_execution_time_ms: 0,
    tool_iterations: 0,
    tools_used: [],
    tools_success_count: 0,
    tools_error_count: 0,
    input_tokens: 0,
    output_tokens: 0,
    estimated_cost_cents: 0,
    status: 'success',
    has_context: false,
    context_type: null
  }

  try {
    const body: ChatRequest = await req.json()
    
    if (!body.message || !body.message.trim()) {
      return createErrorResponse('Message is required', 400, 'MISSING_MESSAGE')
    }

    analyticsData.message_length = body.message.length
    analyticsData.has_context = !!(body.context?.contactId || body.context?.dealIds || body.context?.currentView)
    if (body.context?.contactId) analyticsData.context_type = 'contact'
    else if (body.context?.dealIds?.length) analyticsData.context_type = 'deal'
    else if (body.context?.currentView) analyticsData.context_type = body.context.currentView
    
    // Ensure context exists with userId
    if (!body.context) {
      body.context = { userId }
    } else if (!body.context.userId) {
      body.context.userId = userId
    }
    
    // Check if user is admin and validate targetUserId if provided
    const { data: currentUser } = await client
      .from('profiles')
      .select('is_admin')
      .eq('id', userId)
      .single()
    
    const isAdmin = currentUser?.is_admin === true
    let targetUserId = userId // Default to current user
    
    // Try to extract user name from message for admin queries
    if (isAdmin) {
      console.log('[USER-EXTRACT] Admin detected, attempting to extract user from message...', {
        message: body.message.substring(0, 100),
        currentUserId: userId
      })
      const extractedUserId = await extractUserIdFromMessage(body.message, client, userId)
      if (extractedUserId && extractedUserId !== userId) {
        targetUserId = extractedUserId
        console.log('[USER-EXTRACT] ✅ Extracted target user ID:', extractedUserId)
      } else {
        console.log('[USER-EXTRACT] ⚠️ No user extracted or same as requesting user:', extractedUserId)
      }
    } else {
      console.log('[USER-EXTRACT] Not an admin, using own user ID:', userId)
    }
    
    console.log('[USER-EXTRACT] Final targetUserId:', targetUserId)
    
    // If targetUserId is explicitly provided, validate admin access
    if (body.targetUserId && body.targetUserId !== userId) {
      if (!isAdmin) {
        return createErrorResponse('Only admins can query other users\' performance', 403, 'PERMISSION_DENIED')
      }
      targetUserId = body.targetUserId
    }

    // Get or create conversation
    let conversationId = body.conversationId
    
    if (!conversationId || !isValidUUID(conversationId)) {
      // Create new conversation
      const { data: newConversation, error: convError } = await client
        .from('copilot_conversations')
        .insert({
          user_id: userId,
          title: body.message.substring(0, 100) // Use first 100 chars as title
        })
        .select()
        .single()

      if (convError) {
        return createErrorResponse('Failed to create conversation', 500, 'CONVERSATION_ERROR')
      }

      conversationId = newConversation.id
    } else {
      // Verify conversation belongs to user
      const { data: conversation, error: convError } = await client
        .from('copilot_conversations')
        .select('id')
        .eq('id', conversationId)
        .eq('user_id', userId)
        .single()

      if (convError || !conversation) {
        return createErrorResponse('Conversation not found', 404, 'CONVERSATION_NOT_FOUND')
      }
    }

    // Save user message
    const { error: msgError } = await client
      .from('copilot_messages')
      .insert({
        conversation_id: conversationId,
        role: 'user',
        content: body.message,
        metadata: body.context || {}
      })

    if (msgError) {
    }

    // Fetch conversation history for context
    const { data: messages, error: historyError } = await client
      .from('copilot_messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(20) // Last 20 messages for context

    if (historyError) {
    }

    // Ensure messages is an array and format correctly
    const formattedMessages: CopilotMessage[] = (messages || []).map((msg: any) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content || '',
      recommendations: msg.metadata?.recommendations || []
    }))

    // Check if this is a performance query BEFORE calling Claude
    // This allows us to skip AI and go straight to structured response
    const messageLower = body.message.toLowerCase()
    const originalMessage = body.message
    
    // ULTRA SIMPLE detection: If message contains "performance" anywhere, it's a performance query
    // This catches ALL variations: "Phil's performance", "show performance", "performance this week", etc.
    const hasPerformance = messageLower.includes('performance')
    const hasSalesCoach = messageLower.includes('sales coach')
    const hasHowAmIDoing = messageLower.includes('how am i doing')
    const hasHowIsMyPerformance = messageLower.includes('how is my performance')
    
    const isPerformanceQuery = hasPerformance || hasSalesCoach || hasHowAmIDoing || hasHowIsMyPerformance
    
    console.log('[PERF-DETECT] Performance query detection:', {
      message: body.message.substring(0, 100),
      messageLower: messageLower.substring(0, 100),
      hasPerformance,
      hasSalesCoach,
      hasHowAmIDoing,
      hasHowIsMyPerformance,
      isPerformanceQuery,
      userId,
      isAdmin: currentUser?.is_admin
    })
    
    // If it's a performance query, skip Claude and go straight to structured response
    let aiResponse: any = null
    let shouldSkipClaude = false
    
    if (isPerformanceQuery) {
      shouldSkipClaude = true
      console.log('[PERF-DETECT] ✅ Performance query detected - skipping Claude API call')
      // Create a mock AI response for structured response processing
      aiResponse = {
        content: '', // Empty content since we'll use structured response
        recommendations: [],
        tools_used: [],
        usage: { input_tokens: 0, output_tokens: 0 }
      }
    } else {
      console.log('[PERF-DETECT] ❌ Not a performance query - will call Claude')
    }

    // Build context from user's CRM data
    let context = ''
    try {
      context = await buildContext(client, userId, body.context)
    } catch (contextError) {
      // Continue with empty context if buildContext fails
    }

    // Call Claude API with tool support (skip if performance query)
    const claudeStartTime = Date.now()
    if (!shouldSkipClaude) {
      console.log('[CLAUDE] Calling Claude API (not a performance query)')
      try {
        aiResponse = await callClaudeAPI(
          body.message,
          formattedMessages,
          context,
          client,
          userId,
          analyticsData // Pass analytics data to track tool usage
        )
        analyticsData.claude_api_time_ms = Date.now() - claudeStartTime
        console.log('[CLAUDE] Claude API response received:', {
          contentLength: aiResponse.content?.length || 0,
          hasRecommendations: !!aiResponse.recommendations?.length,
          toolsUsed: aiResponse.tools_used || []
        })
      
      // Extract token counts and tool usage from response if available
      if (aiResponse.usage) {
        analyticsData.input_tokens = aiResponse.usage.input_tokens || 0
        analyticsData.output_tokens = aiResponse.usage.output_tokens || 0
        // Estimate cost: Haiku 4.5 pricing (approximate)
        // Input: $0.25 per 1M tokens, Output: $1.25 per 1M tokens
        const inputCost = (analyticsData.input_tokens / 1_000_000) * 0.25
        const outputCost = (analyticsData.output_tokens / 1_000_000) * 1.25
        analyticsData.estimated_cost_cents = (inputCost + outputCost) * 100
      }
      if (aiResponse.tools_used) {
        analyticsData.tools_used = aiResponse.tools_used
        analyticsData.tool_iterations = aiResponse.tool_iterations || 0
        analyticsData.tools_success_count = aiResponse.tools_success_count || 0
        analyticsData.tools_error_count = aiResponse.tools_error_count || 0
        analyticsData.tool_execution_time_ms = aiResponse.tool_execution_time_ms || 0
      }
    } catch (claudeError) {
      analyticsData.status = 'error'
      analyticsData.error_type = 'claude_api_error'
      analyticsData.error_message = claudeError.message || String(claudeError)
      analyticsData.claude_api_time_ms = Date.now() - claudeStartTime
      throw new Error(`Claude API call failed: ${claudeError.message || String(claudeError)}`)
    }
    } else {
      // Skip Claude for performance queries - structured response will handle it
      analyticsData.claude_api_time_ms = 0
      console.log('[CLAUDE] ⏭️ Skipped Claude API call (performance query detected)')
    }

    // Save assistant message (skip if we're using structured response)
    if (!shouldSkipClaude) {
      const { error: assistantMsgError } = await client
        .from('copilot_messages')
        .insert({
          conversation_id: conversationId,
          role: 'assistant',
          content: aiResponse.content,
          metadata: {
            recommendations: aiResponse.recommendations || []
          }
        })

      if (assistantMsgError) {
      }
    }

    // Update conversation updated_at
    await client
      .from('copilot_conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId)

    // Calculate final metrics
    analyticsData.response_time_ms = Date.now() - requestStartTime
    analyticsData.response_length = aiResponse.content?.length || 0
    analyticsData.conversation_id = conversationId

    // Log analytics (non-blocking)
    logCopilotAnalytics(client, analyticsData).catch(err => {
      // Don't fail the request if analytics logging fails
    })

    // Detect intent and structure response if appropriate
    // If we skipped Claude for performance query, we MUST generate structured response
    let structuredResponse: StructuredResponse | null = null
    if (shouldSkipClaude) {
      console.log('[STRUCTURED] Generating structured response for performance query...', {
        targetUserId,
        requestingUserId: userId,
        message: body.message.substring(0, 50)
      })
      // For performance queries, directly call structureSalesCoachResponse
      try {
        structuredResponse = await structureSalesCoachResponse(
          client,
          targetUserId,
          '', // No AI content since we skipped Claude
          body.message,
          userId // Pass requesting user ID for permission checks
        )
        console.log('[STRUCTURED] ✅ Structured response generated:', {
          type: structuredResponse?.type,
          hasData: !!structuredResponse?.data,
          summary: structuredResponse?.summary?.substring(0, 100)
        })
      } catch (error) {
        console.error('[STRUCTURED] ❌ Error generating structured response:', error)
        structuredResponse = null
      }
    } else {
      console.log('[STRUCTURED] Using normal detection (not a performance query)')
      // For other queries, use normal detection
      structuredResponse = await detectAndStructureResponse(
        body.message, // Pass original message for limit extraction
        aiResponse.content,
        client,
        targetUserId, // Use targetUserId (may be different user if admin querying)
        aiResponse.tools_used || [],
        userId // Pass requesting user ID for permission checks
      )
      if (structuredResponse) {
        console.log('[STRUCTURED] ✅ Structured response generated via detection:', structuredResponse.type)
      } else {
        console.log('[STRUCTURED] ⚠️ No structured response generated via detection')
      }
    }

    // Return response in the format expected by the frontend
    // If we have a structured response, prioritize it over text content
    // IMPORTANT: If we skipped Claude and have no structured response, something went wrong
    if (shouldSkipClaude && !structuredResponse) {
      console.error('[RESPONSE] ❌ ERROR: Skipped Claude for performance query but no structured response generated!', {
        targetUserId,
        userId,
        message: body.message
      })
      // Fallback: return error message
      return new Response(JSON.stringify({
        response: {
          type: 'text',
          content: 'I encountered an error generating the performance report. Please try again.',
          recommendations: [],
          structuredResponse: undefined
        },
        conversationId,
        timestamp: new Date().toISOString()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      })
    }
    
    const responseType = structuredResponse 
      ? structuredResponse.type 
      : (aiResponse?.recommendations?.length > 0 ? 'recommendations' : 'text')
    
    const responseContent = structuredResponse 
      ? (structuredResponse.summary || `I've analyzed ${targetUserId !== userId ? 'their' : 'your'} performance data.`)
      : (aiResponse?.content || '')
    
    const responsePayload = {
      response: {
        type: responseType,
        content: responseContent,
        recommendations: aiResponse?.recommendations || [],
        structuredResponse: structuredResponse || undefined
      },
      conversationId,
      timestamp: new Date().toISOString()
    }
    
    // Debug logging
    console.log('[RESPONSE] 📤 Returning response payload:', {
      type: responseType,
      hasStructuredResponse: !!structuredResponse,
      structuredResponseType: structuredResponse?.type,
      contentLength: responseContent.length,
      hasData: !!structuredResponse?.data,
      summary: structuredResponse?.summary?.substring(0, 100)
    })

    // Log final response payload
    return new Response(JSON.stringify(responsePayload), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    // Update analytics with error info
    analyticsData.status = 'error'
    analyticsData.error_type = error.name || 'UnknownError'
    analyticsData.error_message = error.message || 'Unknown error'
    analyticsData.response_time_ms = Date.now() - requestStartTime

    // Log error analytics (non-blocking)
    logCopilotAnalytics(client, analyticsData).catch(err => {
    })

    const errorMessage = error.message || 'Unknown error'
    return createErrorResponse(
      `Failed to process chat request: ${errorMessage}`,
      500,
      'CHAT_ERROR',
      { stack: error.stack, name: error.name }
    )
  }
}

/**
 * Log Copilot analytics to database
 */
async function logCopilotAnalytics(client: any, analytics: any): Promise<void> {
  try {
    await client
      .from('copilot_analytics')
      .insert({
        user_id: analytics.user_id,
        conversation_id: analytics.conversation_id || null,
        request_type: analytics.request_type,
        message_length: analytics.message_length,
        response_length: analytics.response_length,
        response_time_ms: analytics.response_time_ms,
        claude_api_time_ms: analytics.claude_api_time_ms,
        tool_execution_time_ms: analytics.tool_execution_time_ms,
        tool_iterations: analytics.tool_iterations,
        tools_used: analytics.tools_used || [],
        tools_success_count: analytics.tools_success_count,
        tools_error_count: analytics.tools_error_count,
        estimated_cost_cents: analytics.estimated_cost_cents,
        input_tokens: analytics.input_tokens,
        output_tokens: analytics.output_tokens,
        status: analytics.status,
        error_type: analytics.error_type || null,
        error_message: analytics.error_message || null,
        has_context: analytics.has_context,
        context_type: analytics.context_type || null
      })
  } catch (error) {
    // Don't throw - analytics logging should never break the request
  }
}

/**
 * Handle email draft requests
 */
async function handleDraftEmail(
  client: any,
  req: Request,
  userId: string
): Promise<Response> {
  try {
    const body: DraftEmailRequest = await req.json()
    
    if (!body.contactId || !isValidUUID(body.contactId)) {
      return createErrorResponse('Valid contactId is required', 400, 'INVALID_CONTACT_ID')
    }

    // Verify contact belongs to user
    const { data: contact, error: contactError } = await client
      .from('contacts')
      .select('id, first_name, last_name, email, company_id, companies:company_id(name)')
      .eq('id', body.contactId)
      .eq('owner_id', userId)
      .single()

    if (contactError || !contact) {
      return createErrorResponse('Contact not found', 404, 'CONTACT_NOT_FOUND')
    }

    // Fetch recent activities for context
    const { data: activities } = await client
      .from('activities')
      .select('type, details, date')
      .eq('contact_id', body.contactId)
      .order('date', { ascending: false })
      .limit(5)

    // Fetch related deals
    const { data: deals } = await client
      .from('deals')
      .select('id, name, value, stage_id, deal_stages(name)')
      .eq('primary_contact_id', body.contactId)
      .order('created_at', { ascending: false })
      .limit(3)

    // Build email context
    const emailContext = {
      contact: {
        name: `${contact.first_name || ''} ${contact.last_name || ''}`.trim(),
        email: contact.email,
        company: contact.companies?.name || 'their company'
      },
      recentActivities: activities || [],
      deals: deals || [],
      context: body.context || 'Follow-up email'
    }

    // Generate email with Claude
    const emailDraft = await generateEmailDraft(emailContext, body.tone)

    return new Response(JSON.stringify({
      subject: emailDraft.subject,
      body: emailDraft.body,
      suggestedSendTime: emailDraft.suggestedSendTime
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return createErrorResponse('Failed to draft email', 500, 'EMAIL_DRAFT_ERROR')
  }
}

/**
 * Handle generate deal email from meeting context
 */
async function handleGenerateDealEmail(
  client: any,
  req: Request,
  userId: string
): Promise<Response> {
  console.log('[GENERATE-DEAL-EMAIL] Starting email generation', { userId })
  try {
    const body = await req.json()
    console.log('[GENERATE-DEAL-EMAIL] Request body received', { dealId: body.dealId, hasContactId: !!body.contactId, hasCompanyId: !!body.companyId })
    
    if (!body.dealId || !isValidUUID(body.dealId)) {
      console.log('[GENERATE-DEAL-EMAIL] ❌ Invalid dealId', { dealId: body.dealId })
      return createErrorResponse('Valid dealId is required', 400, 'INVALID_DEAL_ID')
    }

    // Verify deal belongs to user
    console.log('[GENERATE-DEAL-EMAIL] Fetching deal', { dealId: body.dealId, userId })
    const { data: deal, error: dealError } = await client
      .from('deals')
      .select(`
        id,
        name,
        value,
        stage_id,
        company_id,
        primary_contact_id,
        companies:company_id(id, name),
        contacts:primary_contact_id(id, first_name, last_name, email)
      `)
      .eq('id', body.dealId)
      .eq('owner_id', userId)
      .single()

    if (dealError || !deal) {
      console.log('[GENERATE-DEAL-EMAIL] ❌ Deal not found', { dealError, hasDeal: !!deal })
      return createErrorResponse('Deal not found', 404, 'DEAL_NOT_FOUND')
    }

    console.log('[GENERATE-DEAL-EMAIL] Deal found', { dealName: deal.name, hasContact: !!deal.contacts, hasCompany: !!deal.companies })

    if (!deal.contacts) {
      console.log('[GENERATE-DEAL-EMAIL] ❌ No contact associated with deal')
      return createErrorResponse('No contact associated with this deal', 400, 'NO_CONTACT')
    }

    const contactEmail = deal.contacts.email
    console.log('[GENERATE-DEAL-EMAIL] Contact email', { contactEmail, companyId: deal.company_id, contactId: deal.primary_contact_id })

    // First, try to find meeting directly linked to company or contact
    // Check for meetings with either transcript_text OR summary
    console.log('[GENERATE-DEAL-EMAIL] Searching for meetings...', { 
      companyId: deal.company_id, 
      contactId: deal.primary_contact_id,
      userId 
    })
    let { data: meetings, error: meetingsError } = await client
      .from('meetings')
      .select(`
        id,
        title,
        summary,
        transcript_text,
        meeting_start,
        meeting_action_items(id, title, completed)
      `)
      .or(`company_id.eq.${deal.company_id},primary_contact_id.eq.${deal.primary_contact_id}`)
      .or('transcript_text.not.is.null,summary.not.is.null')
      .eq('owner_user_id', userId) // Add RLS filter
      .order('meeting_start', { ascending: false })
      .limit(10)
    
    if (meetingsError) {
      console.log('[GENERATE-DEAL-EMAIL] ❌ Error fetching meetings', { error: meetingsError })
    } else {
      console.log('[GENERATE-DEAL-EMAIL] Meetings found', { count: meetings?.length || 0 })
    }
    
    // Filter to find first meeting with transcript_text or summary
    let lastMeeting = meetings?.find(m => m.transcript_text || m.summary) || null
    console.log('[GENERATE-DEAL-EMAIL] Last meeting', { hasMeeting: !!lastMeeting, hasTranscript: !!lastMeeting?.transcript_text, hasSummary: !!lastMeeting?.summary })

    // If no meeting found, search by contact email via meeting_attendees
    if (!lastMeeting && contactEmail) {
      console.log('[GENERATE-DEAL-EMAIL] Searching via meeting_attendees...', { contactEmail })
      const { data: attendeesData, error: attendeesError } = await client
        .from('meeting_attendees')
        .select(`
          meeting_id,
          meetings!inner(
            id,
            title,
            summary,
            transcript_text,
            meeting_start,
            owner_user_id,
            meeting_action_items(id, title, completed)
          )
        `)
        .eq('email', contactEmail)
        .eq('meetings.owner_user_id', userId) // Add RLS filter
        .or('meetings.transcript_text.not.is.null,meetings.summary.not.is.null')
        .order('meetings.meeting_start', { ascending: false })
        .limit(10)
      
      if (attendeesError) {
        console.log('[GENERATE-DEAL-EMAIL] ❌ Error fetching attendees', { error: attendeesError })
      } else {
        console.log('[GENERATE-DEAL-EMAIL] Attendees found', { count: attendeesData?.length || 0 })
      }
      
      // Filter to find first meeting with transcript_text or summary
      if (attendeesData && attendeesData.length > 0) {
        const meetingWithContent = attendeesData.find(a => 
          a.meetings && (a.meetings.transcript_text || a.meetings.summary)
        )
        if (meetingWithContent?.meetings) {
          lastMeeting = meetingWithContent.meetings
        }
      }
    }

    // If still no meeting, try via meeting_contacts junction table
    if (!lastMeeting && deal.primary_contact_id) {
      console.log('[GENERATE-DEAL-EMAIL] Searching via meeting_contacts...', { contactId: deal.primary_contact_id })
      const { data: meetingContactsData, error: meetingContactsError } = await client
        .from('meeting_contacts')
        .select(`
          meeting_id,
          meetings!inner(
            id,
            title,
            summary,
            transcript_text,
            meeting_start,
            owner_user_id,
            meeting_action_items(id, title, completed)
          )
        `)
        .eq('contact_id', deal.primary_contact_id)
        .eq('meetings.owner_user_id', userId) // Add RLS filter
        .or('meetings.transcript_text.not.is.null,meetings.summary.not.is.null')
        .order('meetings.meeting_start', { ascending: false })
        .limit(10)
      
      if (meetingContactsError) {
        console.log('[GENERATE-DEAL-EMAIL] ❌ Error fetching meeting_contacts', { error: meetingContactsError })
      } else {
        console.log('[GENERATE-DEAL-EMAIL] Meeting contacts found', { count: meetingContactsData?.length || 0 })
      }
      
      // Filter to find first meeting with transcript_text or summary
      if (meetingContactsData && meetingContactsData.length > 0) {
        const meetingWithContent = meetingContactsData.find(mc =>
          mc.meetings && (mc.meetings.transcript_text || mc.meetings.summary)
        )
        if (meetingWithContent?.meetings) {
          lastMeeting = meetingWithContent.meetings
        }
      }
    }

    // If still no meeting found, try a broader search - all user meetings with transcript/summary
    // This is a fallback in case the meeting isn't properly linked to company/contact
    if (!lastMeeting || (!lastMeeting.transcript_text && !lastMeeting.summary)) {
      console.log('[GENERATE-DEAL-EMAIL] Trying broader search - all user meetings...')
      const { data: allMeetings, error: allMeetingsError } = await client
        .from('meetings')
        .select(`
          id,
          title,
          summary,
          transcript_text,
          meeting_start,
          meeting_action_items(id, title, completed)
        `)
        .eq('owner_user_id', userId)
        .or('transcript_text.not.is.null,summary.not.is.null')
        .order('meeting_start', { ascending: false })
        .limit(20)
      
      if (allMeetingsError) {
        console.log('[GENERATE-DEAL-EMAIL] ❌ Error in broader search', { error: allMeetingsError })
      } else {
        console.log('[GENERATE-DEAL-EMAIL] Broader search found', { count: allMeetings?.length || 0 })
        // Try to find a meeting that might be related (by checking if any attendees match)
        if (allMeetings && contactEmail) {
          // Check if any of these meetings have the contact as an attendee
          for (const meeting of allMeetings) {
            const { data: attendees } = await client
              .from('meeting_attendees')
              .select('email')
              .eq('meeting_id', meeting.id)
              .eq('email', contactEmail)
              .limit(1)
            
            if (attendees && attendees.length > 0) {
              console.log('[GENERATE-DEAL-EMAIL] ✅ Found meeting via attendee match', { meetingId: meeting.id })
              lastMeeting = meeting
              break
            }
          }
        }
        // If still no match, just use the most recent meeting with content
        if (!lastMeeting && allMeetings && allMeetings.length > 0) {
          lastMeeting = allMeetings[0]
          console.log('[GENERATE-DEAL-EMAIL] Using most recent meeting as fallback', { meetingId: lastMeeting.id })
        }
      }
    }

    // If no meeting with transcript or summary found, return error
    if (!lastMeeting || (!lastMeeting.transcript_text && !lastMeeting.summary)) {
      console.log('[GENERATE-DEAL-EMAIL] ❌ No meeting with transcript or summary found after all searches')
      return createErrorResponse(
        'No meeting with transcript or summary found for this deal. Please ensure a meeting with transcript or summary is linked to the contact or company.',
        404,
        'NO_MEETING_TRANSCRIPT'
      )
    }

    console.log('[GENERATE-DEAL-EMAIL] ✅ Meeting found, fetching activities...')
    // Fetch recent activities for the deal
    const { data: activities, error: activitiesError } = await client
      .from('activities')
      .select('id, type, details, date')
      .eq('deal_id', body.dealId)
      .eq('user_id', userId) // Add user_id filter for RLS
      .order('date', { ascending: false })
      .limit(5)
    
    if (activitiesError) {
      console.log('[GENERATE-DEAL-EMAIL] ⚠️ Error fetching activities', { error: activitiesError })
    } else {
      console.log('[GENERATE-DEAL-EMAIL] Activities found', { count: activities?.length || 0 })
    }

    // Build context for email generation
    const emailContext = {
      deal: {
        name: deal.name,
        value: deal.value,
        stage: deal.stage_id
      },
      contact: {
        name: `${deal.contacts.first_name || ''} ${deal.contacts.last_name || ''}`.trim(),
        email: deal.contacts.email,
        company: deal.companies?.name || 'their company'
      },
      lastMeeting: lastMeeting ? {
        title: lastMeeting.title,
        date: lastMeeting.meeting_start,
        summary: lastMeeting.summary,
        transcript: lastMeeting.transcript_text || lastMeeting.summary, // Use summary as fallback
        actionItems: lastMeeting.meeting_action_items?.filter((ai: any) => !ai.completed) || []
      } : null,
      recentActivities: activities || []
    }

    // Generate email using Claude with meeting context
    console.log('[GENERATE-DEAL-EMAIL] Generating email with Claude...')
    const emailDraft = await generateDealEmailFromContext(emailContext)
    console.log('[GENERATE-DEAL-EMAIL] ✅ Email generated successfully', { 
      hasSubject: !!emailDraft.subject, 
      hasBody: !!emailDraft.body,
      bodyLength: emailDraft.body?.length || 0
    })

    return new Response(JSON.stringify({
      subject: emailDraft.subject,
      body: emailDraft.body,
      suggestedSendTime: emailDraft.suggestedSendTime
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.log('[GENERATE-DEAL-EMAIL] ❌ Error in handleGenerateDealEmail', { 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    return createErrorResponse('Failed to generate deal email', 500, 'DEAL_EMAIL_ERROR')
  }
}

/**
 * Generate email from deal context including meeting transcripts
 */
async function generateDealEmailFromContext(
  context: any
): Promise<{ subject: string; body: string; suggestedSendTime: string }> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not configured')
  }

  // Build comprehensive prompt with meeting transcript
  let meetingContext = ''
  if (context.lastMeeting) {
    meetingContext = `Last Meeting Context:
- Title: ${context.lastMeeting.title}
- Date: ${new Date(context.lastMeeting.date).toLocaleDateString()}
${context.lastMeeting.summary ? `- Summary: ${context.lastMeeting.summary}` : ''}
${context.lastMeeting.transcript ? `- Full Transcript:\n${context.lastMeeting.transcript}` : ''}
${context.lastMeeting.actionItems?.length > 0 ? `- Pending Action Items:\n${context.lastMeeting.actionItems.map((ai: any) => `  • ${ai.title}`).join('\n')}` : ''}
`
  }

  const recentActivityContext = context.recentActivities.length > 0
    ? `Recent Activity:\n${context.recentActivities.map((a: any) => `- ${a.type}: ${a.notes || 'N/A'} on ${new Date(a.date).toLocaleDateString()}`).join('\n')}\n`
    : ''

  const prompt = `You are drafting a professional follow-up email to progress a sales deal.

Deal: ${context.deal.name} (${context.deal.value ? `$${context.deal.value}` : 'Value TBD'})
Contact: ${context.contact.name} at ${context.contact.company}
Email: ${context.contact.email}

${meetingContext}

${recentActivityContext}

IMPORTANT INSTRUCTIONS:
1. Use the meeting transcript and action items to understand what was discussed
2. Reference specific points from the conversation to show you were listening
3. Address any pending action items from the meeting
4. Propose next steps to move the deal forward
5. Be professional but warm and personable
6. Keep it concise (2-3 paragraphs max)
7. Focus on value and next steps, not just checking in

Generate a professional email with:
1. A clear, compelling subject line that references the meeting or next steps
2. A well-structured email body that references the conversation and proposes concrete next steps
3. A suggested send time

Return your response as JSON in this exact format:
{
  "subject": "Email subject here",
  "body": "Email body here with proper formatting",
  "suggestedSendTime": "Suggested send time"
}`

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': ANTHROPIC_VERSION
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500, // More tokens for transcript analysis
      messages: [{
        role: 'user',
        content: prompt
      }]
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Claude API error: ${response.status}`)
  }

  const data = await response.json()
  const content = data.content[0]?.text || ''

  // Parse JSON from response
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const emailData = JSON.parse(jsonMatch[0])
      return {
        subject: emailData.subject || 'Follow-up on our conversation',
        body: emailData.body || content,
        suggestedSendTime: emailData.suggestedSendTime || 'Tomorrow 9 AM EST'
      }
    }
  } catch (e) {
  }

  // Fallback if JSON parsing fails
  return {
    subject: 'Follow-up on our conversation',
    body: content,
    suggestedSendTime: 'Tomorrow 9 AM EST'
  }
}

/**
 * Handle get conversation requests
 */
async function handleGetConversation(
  client: any,
  conversationId: string,
  userId: string
): Promise<Response> {
  try {
    if (!isValidUUID(conversationId)) {
      return createErrorResponse('Invalid conversation ID', 400, 'INVALID_ID')
    }

    // Verify conversation belongs to user
    const { data: conversation, error: convError } = await client
      .from('copilot_conversations')
      .select('id, title, created_at, updated_at')
      .eq('id', conversationId)
      .eq('user_id', userId)
      .single()

    if (convError || !conversation) {
      return createErrorResponse('Conversation not found', 404, 'CONVERSATION_NOT_FOUND')
    }

    // Fetch messages
    const { data: messages, error: msgError } = await client
      .from('copilot_messages')
      .select('id, role, content, metadata, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })

    if (msgError) {
    }

    return new Response(JSON.stringify({
      conversation,
      messages: messages || []
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return createErrorResponse('Failed to fetch conversation', 500, 'FETCH_ERROR')
  }
}

/**
 * Build context from user's CRM data
 */
async function buildContext(client: any, userId: string, context?: ChatRequest['context']): Promise<string> {
  const contextParts: string[] = []

  if (context?.contactId) {
    const { data: contact } = await client
      .from('contacts')
      .select('first_name, last_name, email, title, companies:company_id(name)')
      .eq('id', context.contactId)
      .eq('owner_id', userId)
      .single()

    if (contact) {
      contextParts.push(`Current contact: ${contact.first_name} ${contact.last_name} (${contact.email}) at ${contact.companies?.name || 'Unknown Company'}`)
    }
  }

  if (context?.dealIds && context.dealIds.length > 0) {
    const { data: deals } = await client
      .from('deals')
      .select('name, value, stage_id, deal_stages(name)')
      .in('id', context.dealIds)
      .eq('owner_id', userId)

    if (deals && deals.length > 0) {
      contextParts.push(`Related deals: ${deals.map(d => `${d.name} (${d.deal_stages?.name || 'Unknown Stage'}, $${d.value})`).join(', ')}`)
    }
  }

  // Add task context - this is critical for task-related email generation
  if (context?.taskId) {
    const { data: task } = await client
      .from('tasks')
      .select(`
        id,
        title,
        description,
        status,
        priority,
        due_date,
        task_type,
        contact_id,
        deal_id,
        company_id,
        contacts:contact_id(id, first_name, last_name, email),
        deals:deal_id(id, name),
        companies:company_id(id, name)
      `)
      .or(`assigned_to.eq.${userId},created_by.eq.${userId}`)
      .eq('id', context.taskId)
      .single()

    if (task) {
      const contactName = task.contacts ? `${task.contacts.first_name || ''} ${task.contacts.last_name || ''}`.trim() : null
      const contactEmail = task.contacts?.email || null
      const companyName = task.companies?.name || null
      const dealName = task.deals?.name || null
      
      contextParts.push(`Current task: "${task.title}"`)
      if (task.description) {
        contextParts.push(`Task description: ${task.description}`)
      }
      if (task.priority) {
        contextParts.push(`Priority: ${task.priority}`)
      }
      if (task.due_date) {
        const dueDate = new Date(task.due_date)
        contextParts.push(`Due date: ${dueDate.toLocaleDateString()}`)
      }
      if (contactName) {
        contextParts.push(`Related contact: ${contactName}${contactEmail ? ` (${contactEmail})` : ''}`)
      }
      if (companyName) {
        contextParts.push(`Related company: ${companyName}`)
      }
      if (dealName) {
        contextParts.push(`Related deal: ${dealName}`)
      }
      if (task.task_type) {
        contextParts.push(`Task type: ${task.task_type}`)
      }
    }
  }

  // Add current view context
  if (context?.currentView) {
    contextParts.push(`Current view: ${context.currentView}`)
  }

  return contextParts.join('\n')
}

/**
 * Available CRUD tools for Claude to use
 * Generic CRUD operations for all major entities
 */
const AVAILABLE_TOOLS = [
  // Meetings CRUD
  {
    name: 'meetings_create',
    description: 'Create a new meeting record. Can include transcript_text, summary, action items, and related data.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Meeting title' },
        meeting_start: { type: 'string', description: 'Start time (ISO format)' },
        meeting_end: { type: 'string', description: 'End time (ISO format)' },
        summary: { type: 'string', description: 'Meeting summary' },
        transcript_text: { type: 'string', description: 'Full transcript text' },
        company_id: { type: 'string', description: 'Company ID' },
        primary_contact_id: { type: 'string', description: 'Primary contact ID' },
        actionItems: { type: 'array', items: { type: 'object' }, description: 'Array of action items' }
      },
      required: ['title', 'meeting_start']
    }
  },
  {
    name: 'meetings_read',
    description: 'Read meeting records with all connected data (transcripts, summaries, action items, attendees). Supports filtering by date range, company, contact, etc. Large transcripts are automatically optimized.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Meeting ID (for single meeting)' },
        startDate: { type: 'string', description: 'Filter by start date (ISO format)' },
        endDate: { type: 'string', description: 'Filter by end date (ISO format)' },
        company_id: { type: 'string', description: 'Filter by company ID' },
        contact_id: { type: 'string', description: 'Filter by contact ID' },
        includeTranscripts: { type: 'boolean', default: true, description: 'Include transcript text' },
        includeActionItems: { type: 'boolean', default: true, description: 'Include action items' },
        includeAttendees: { type: 'boolean', default: true, description: 'Include attendees' },
        maxTranscriptLength: { type: 'number', default: 50000, description: 'Maximum transcript length in characters (default: 50000). Longer transcripts are truncated intelligently at sentence boundaries.' },
        transcriptMode: { type: 'string', enum: ['full', 'summary', 'truncated'], default: 'truncated', description: 'Transcript handling mode: "full" (no optimization), "summary" (return summary only), "truncated" (intelligent truncation at sentence boundaries)' },
        limit: { type: 'number', default: 50, description: 'Maximum results' }
      }
    }
  },
  {
    name: 'meetings_update',
    description: 'Update a meeting record. Can update summary, transcript, action items, and other fields.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Meeting ID' },
        title: { type: 'string', description: 'Meeting title' },
        summary: { type: 'string', description: 'Meeting summary' },
        transcript_text: { type: 'string', description: 'Transcript text' },
        sentiment_score: { type: 'number', description: 'Sentiment score (-1 to 1)' }
      },
      required: ['id']
    }
  },
  {
    name: 'meetings_delete',
    description: 'Delete a meeting record and its related data (action items, attendees).',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Meeting ID' }
      },
      required: ['id']
    }
  },
  // Activities CRUD
  {
    name: 'activities_create',
    description: 'Create a new activity record (sale, outbound, meeting, proposal).',
    input_schema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['sale', 'outbound', 'meeting', 'proposal'], description: 'Activity type' },
        client_name: { type: 'string', description: 'Client/company name' },
        details: { type: 'string', description: 'Activity details' },
        amount: { type: 'number', description: 'Amount (for sales)' },
        date: { type: 'string', description: 'Activity date (ISO format)' },
        status: { type: 'string', enum: ['pending', 'completed', 'cancelled'], default: 'completed' },
        priority: { type: 'string', enum: ['low', 'medium', 'high'], default: 'medium' }
      },
      required: ['type', 'client_name', 'date']
    }
  },
  {
    name: 'activities_read',
    description: 'Read activity records with filtering options.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Activity ID (for single activity)' },
        type: { type: 'string', enum: ['sale', 'outbound', 'meeting', 'proposal'], description: 'Filter by type' },
        startDate: { type: 'string', description: 'Filter by start date' },
        endDate: { type: 'string', description: 'Filter by end date' },
        client_name: { type: 'string', description: 'Filter by client name' },
        limit: { type: 'number', default: 50 }
      }
    }
  },
  {
    name: 'activities_update',
    description: 'Update an activity record.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Activity ID' },
        details: { type: 'string', description: 'Activity details' },
        status: { type: 'string', enum: ['pending', 'completed', 'cancelled'] },
        amount: { type: 'number', description: 'Amount' }
      },
      required: ['id']
    }
  },
  {
    name: 'activities_delete',
    description: 'Delete an activity record.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Activity ID' }
      },
      required: ['id']
    }
  },
  // Pipeline (Deals) CRUD
  {
    name: 'pipeline_create',
    description: 'Create a new deal in the pipeline.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Deal name' },
        company: { type: 'string', description: 'Company name' },
        value: { type: 'number', description: 'Deal value' },
        stage_id: { type: 'string', description: 'Stage ID' },
        contact_name: { type: 'string', description: 'Contact name' },
        contact_email: { type: 'string', description: 'Contact email' },
        expected_close_date: { type: 'string', description: 'Expected close date (ISO format)' },
        probability: { type: 'number', description: 'Close probability (0-100)' },
        description: { type: 'string', description: 'Deal description' }
      },
      required: ['name', 'company', 'value', 'stage_id']
    }
  },
  {
    name: 'pipeline_read',
    description: 'Read deals from the pipeline with filtering and sorting options.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Deal ID (for single deal)' },
        stage_id: { type: 'string', description: 'Filter by stage' },
        status: { type: 'string', enum: ['active', 'won', 'lost', 'cancelled'], description: 'Filter by status' },
        minValue: { type: 'number', description: 'Minimum deal value' },
        maxValue: { type: 'number', description: 'Maximum deal value' },
        sortBy: { type: 'string', enum: ['value', 'created_at', 'updated_at'], default: 'updated_at' },
        sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
        limit: { type: 'number', default: 50 }
      }
    }
  },
  {
    name: 'pipeline_update',
    description: 'Update a deal in the pipeline (stage, value, status, etc.).',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Deal ID' },
        name: { type: 'string', description: 'Deal name' },
        value: { type: 'number', description: 'Deal value' },
        stage_id: { type: 'string', description: 'Stage ID' },
        status: { type: 'string', enum: ['active', 'won', 'lost', 'cancelled'] },
        expected_close_date: { type: 'string', description: 'Expected close date' },
        probability: { type: 'number', description: 'Close probability' }
      },
      required: ['id']
    }
  },
  {
    name: 'pipeline_delete',
    description: 'Delete a deal from the pipeline.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Deal ID' }
      },
      required: ['id']
    }
  },
  // Leads (Contacts) CRUD
  {
    name: 'leads_create',
    description: 'Create a new lead/contact record.',
    input_schema: {
      type: 'object',
      properties: {
        first_name: { type: 'string', description: 'First name' },
        last_name: { type: 'string', description: 'Last name' },
        email: { type: 'string', description: 'Email address' },
        phone: { type: 'string', description: 'Phone number' },
        company: { type: 'string', description: 'Company name' },
        title: { type: 'string', description: 'Job title' },
        company_id: { type: 'string', description: 'Company ID (if exists)' }
      },
      required: ['email']
    }
  },
  {
    name: 'leads_read',
    description: 'Read lead/contact records with filtering options.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Contact ID (for single contact)' },
        email: { type: 'string', description: 'Filter by email' },
        company: { type: 'string', description: 'Filter by company name' },
        company_id: { type: 'string', description: 'Filter by company ID' },
        search: { type: 'string', description: 'Search in name, email, company' },
        limit: { type: 'number', default: 50 }
      }
    }
  },
  {
    name: 'leads_update',
    description: 'Update a lead/contact record.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Contact ID' },
        first_name: { type: 'string', description: 'First name' },
        last_name: { type: 'string', description: 'Last name' },
        email: { type: 'string', description: 'Email' },
        phone: { type: 'string', description: 'Phone' },
        title: { type: 'string', description: 'Job title' },
        company_id: { type: 'string', description: 'Company ID' }
      },
      required: ['id']
    }
  },
  {
    name: 'leads_delete',
    description: 'Delete a lead/contact record.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Contact ID' }
      },
      required: ['id']
    }
  },
  // Roadmap CRUD
  {
    name: 'roadmap_create',
    description: 'Create a new roadmap item (feature, bug, improvement, other).',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Roadmap item title' },
        description: { type: 'string', description: 'Detailed description' },
        type: { type: 'string', enum: ['feature', 'bug', 'improvement', 'other'], default: 'feature' },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'], default: 'medium' }
      },
      required: ['title', 'description']
    }
  },
  {
    name: 'roadmap_read',
    description: 'Read roadmap items with filtering options.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Roadmap item ID (for single item)' },
        type: { type: 'string', enum: ['feature', 'bug', 'improvement', 'other'], description: 'Filter by type' },
        status: { type: 'string', enum: ['submitted', 'under_review', 'in_progress', 'testing', 'completed', 'rejected'], description: 'Filter by status' },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'], description: 'Filter by priority' },
        limit: { type: 'number', default: 50 }
      }
    }
  },
  {
    name: 'roadmap_update',
    description: 'Update a roadmap item (users can only update their own items).',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Roadmap item ID' },
        title: { type: 'string', description: 'Title' },
        description: { type: 'string', description: 'Description' },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] }
      },
      required: ['id']
    }
  },
  {
    name: 'roadmap_delete',
    description: 'Delete a roadmap item (admins only).',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Roadmap item ID' }
      },
      required: ['id']
    }
  },
  // Calendar CRUD
  {
    name: 'calendar_create',
    description: 'Create a new calendar event.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Event title' },
        start_time: { type: 'string', description: 'Start time (ISO format)' },
        end_time: { type: 'string', description: 'End time (ISO format)' },
        description: { type: 'string', description: 'Event description' },
        location: { type: 'string', description: 'Event location' },
        calendar_id: { type: 'string', description: 'Calendar ID' },
        deal_id: { type: 'string', description: 'Link to deal' }
      },
      required: ['title', 'start_time', 'end_time', 'calendar_id']
    }
  },
  {
    name: 'calendar_read',
    description: 'Read calendar events with filtering options.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Event ID (for single event)' },
        startDate: { type: 'string', description: 'Filter by start date (ISO format)' },
        endDate: { type: 'string', description: 'Filter by end date (ISO format)' },
        calendar_id: { type: 'string', description: 'Filter by calendar ID' },
        deal_id: { type: 'string', description: 'Filter by deal ID' },
        limit: { type: 'number', default: 50 }
      }
    }
  },
  {
    name: 'calendar_update',
    description: 'Update a calendar event.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Event ID' },
        title: { type: 'string', description: 'Event title' },
        start_time: { type: 'string', description: 'Start time' },
        end_time: { type: 'string', description: 'End time' },
        description: { type: 'string', description: 'Description' }
      },
      required: ['id']
    }
  },
  {
    name: 'calendar_delete',
    description: 'Delete a calendar event.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Event ID' }
      },
      required: ['id']
    }
  },
  // Tasks CRUD (for task management)
  {
    name: 'tasks_create',
    description: 'Create a new task.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Task title' },
        description: { type: 'string', description: 'Task description' },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
        task_type: { type: 'string', enum: ['call', 'email', 'meeting', 'follow_up', 'demo', 'proposal', 'general'], default: 'general' },
        due_date: { type: 'string', description: 'Due date (ISO format)' },
        contact_id: { type: 'string', description: 'Link to contact' },
        deal_id: { type: 'string', description: 'Link to deal' },
        company_id: { type: 'string', description: 'Link to company' }
      },
      required: ['title']
    }
  },
  {
    name: 'tasks_read',
    description: 'Read tasks assigned to or created by the user. Use this to view tasks, check task status, find tasks by contact or deal, or list tasks with specific filters like status or priority.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Task ID (for single task)' },
        status: { type: 'string', enum: ['todo', 'in_progress', 'completed', 'cancelled'], description: 'Filter by status' },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'], description: 'Filter by priority' },
        contact_id: { type: 'string', description: 'Filter by contact ID' },
        deal_id: { type: 'string', description: 'Filter by deal ID' },
        limit: { type: 'number', default: 50, description: 'Maximum number of tasks to return' }
      }
    }
  },
  {
    name: 'tasks_update',
    description: 'Update a task.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Task ID' },
        title: { type: 'string', description: 'Task title' },
        status: { type: 'string', enum: ['todo', 'in_progress', 'completed', 'cancelled'] },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
        due_date: { type: 'string', description: 'Due date' }
      },
      required: ['id']
    }
  },
  {
    name: 'tasks_delete',
    description: 'Delete a task.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Task ID' }
      },
      required: ['id']
    }
  }
]

/**
 * Call Claude API for chat response with tool support
 */
async function callClaudeAPI(
  message: string,
  history: CopilotMessage[],
  context: string,
  client: any,
  userId: string,
  analyticsData?: any
): Promise<{ 
  content: string; 
  recommendations?: any[];
  usage?: { input_tokens: number; output_tokens: number };
  tools_used?: string[];
  tool_iterations?: number;
  tools_success_count?: number;
  tools_error_count?: number;
  tool_execution_time_ms?: number;
}> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not configured')
  }

  // Build messages array for Claude
  const messages: any[] = [
    {
      role: 'user',
      content: `You are an AI sales assistant helping a sales professional manage their pipeline, contacts, and deals.

${context ? `Context:\n${context}\n` : ''}

IMPORTANT: If the context includes a "Current task", use ALL the task information (title, description, related contact, company, deal, due date, priority) when helping the user. For example:
- If the user asks to "write an email" and there's a task context, use the task's contact information, description, and details to craft a relevant email
- If the task mentions a specific person (like "Jean Marc" or "Jean-Marc"), use the contact information from the task
- Use the task description and context to understand what the email should be about
- Reference the task's due date and priority when relevant
- If the task has a description that mentions scheduling a meeting or review, use that information to draft the email

You have access to CRUD (Create, Read, Update, Delete) operations for all major entities in the sales dashboard:

**Meetings**: Full CRUD access including transcripts, summaries, action items, and attendees
**Activities**: Create and manage sales activities (sales, outbound, meetings, proposals)
**Pipeline (Deals)**: Manage deals with stages, values, probabilities, and status
**Leads (Contacts)**: Manage contacts with companies, emails, and relationships
**Roadmap**: Create and manage roadmap items (features, bugs, improvements)
**Calendar**: Manage calendar events and scheduling
**Tasks**: Create and manage tasks linked to contacts, deals, or companies

**Key Capabilities**:
- When reading meetings, you get full Fathom transcripts (transcript_text), AI summaries, action items, and sentiment analysis
- All operations respect user ownership and permissions
- You can filter, sort, and search across all entities
- Related data is automatically included (e.g., meeting action items, deal stages)

**Examples of what you can do**:
- "Show me all meetings from last week with their transcripts and action items"
- "Create a new deal for Acme Corp worth $50,000 in the Opportunity stage"
- "Update the status of deal XYZ to 'won'"
- "Create a task to follow up with John Smith tomorrow"
- "Find all contacts at TechCorp"
- "Create a roadmap item for adding email templates"

Use the appropriate CRUD operations to complete user requests. Be intelligent about which operations to use and provide helpful summaries of what you did.

Be helpful, proactive, and action-oriented.`
    }
  ]

  // Add conversation history (last 10 messages for context)
  const recentHistory = history.slice(-10)
  recentHistory.forEach(msg => {
    messages.push({
      role: msg.role,
      content: msg.content
    })
  })

  // Add current message
  messages.push({
    role: 'user',
    content: message
  })

  // Log request for debugging (without sensitive data)
  // Call Claude Haiku 4.5 with tools (faster and cheaper for MCP requests)
  // Full API ID: claude-haiku-4-5@20251001
  // API Alias: claude-haiku-4-5
  let response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': ANTHROPIC_VERSION
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5', // Claude Haiku 4.5 for fast, cost-effective MCP tool execution
      max_tokens: 4096,
      tools: AVAILABLE_TOOLS,
      messages
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    let errorDetails = errorText
    try {
      const errorJson = JSON.parse(errorText)
      errorDetails = JSON.stringify(errorJson, null, 2)
    } catch (e) {
      // Not JSON, use text as-is
    }
    throw new Error(`Claude API error: ${response.status} - ${errorDetails}`)
  }

  let data = await response.json()
  let finalContent = ''
  const recommendations: any[] = []
  let accumulatedTextContent = '' // Accumulate text content from all iterations
  
  // Tool usage tracking
  const toolsUsed: string[] = []
  let toolIterations = 0
  let toolsSuccessCount = 0
  let toolsErrorCount = 0
  const toolExecutionStartTime = Date.now()

  // Handle tool use - Claude may request to use tools
  let maxToolIterations = 5 // Prevent infinite loops
  let iteration = 0
  const startTime = Date.now()
  const MAX_EXECUTION_TIME = 30000 // 30 seconds max execution time

  while (data.stop_reason === 'tool_use' && data.content && iteration < maxToolIterations) {
    // Check timeout
    if (Date.now() - startTime > MAX_EXECUTION_TIME) {
      break
    }

    iteration++
    const toolCalls: any[] = []
    let textContent = ''

    // Process tool calls
    for (const contentItem of data.content) {
      if (contentItem.type === 'text') {
        textContent += contentItem.text + '\n\n'
      } else if (contentItem.type === 'tool_use') {
        toolCalls.push(contentItem)
      }
    }

    // Accumulate text content from this iteration
    if (textContent) {
      accumulatedTextContent += textContent
    }

    // Execute all tool calls
    if (toolCalls.length > 0) {
      // Add assistant message with tool calls
      messages.push({
        role: 'assistant',
        content: data.content
      })

      // Execute tools and collect results with timeout protection
      const toolResults: ToolResult[] = []
      for (const toolCall of toolCalls) {
        const toolStartTime = Date.now()
        try {
          // Track tool usage
          if (!toolsUsed.includes(toolCall.name)) {
            toolsUsed.push(toolCall.name)
          }
          
          // Add timeout wrapper for tool execution
          const toolPromise = executeToolCall(toolCall.name, toolCall.input, client, userId)
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Tool execution timeout')), 10000)
          )
          
          const toolResult = await Promise.race([toolPromise, timeoutPromise])
          toolsSuccessCount++
          
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolCall.id,
            content: JSON.stringify(toolResult)
          })
        } catch (error: any) {
          toolsErrorCount++
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolCall.id,
            is_error: true,
            content: JSON.stringify({ error: error.message || String(error) })
          })
        }
      }
      
      toolIterations++

      // Add tool results to messages
      messages.push({
        role: 'user',
        content: toolResults
      })

      // Call Claude Haiku 4.5 again with tool results
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': ANTHROPIC_VERSION
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5', // Claude Haiku 4.5 for fast, cost-effective MCP tool execution
          max_tokens: 4096,
          tools: AVAILABLE_TOOLS,
          messages
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        break
      }

      data = await response.json()
    } else {
      break
    }
  }

  // Add any accumulated text content from tool use iterations
  if (accumulatedTextContent) {
    finalContent += accumulatedTextContent
  }

  // Extract final text response
  if (data.content) {
    for (const contentItem of data.content) {
      if (contentItem.type === 'text') {
        finalContent += contentItem.text
      }
    }
  }

  if (!finalContent) {
    finalContent = 'I apologize, but I could not generate a response.'
  }

  // Extract usage information from Claude API response
  const usage = data.usage ? {
    input_tokens: data.usage.input_tokens || 0,
    output_tokens: data.usage.output_tokens || 0
  } : undefined

  const toolExecutionTimeMs = Date.now() - toolExecutionStartTime

  return { 
    content: finalContent.trim(), 
    recommendations,
    usage,
    tools_used: toolsUsed,
    tool_iterations: toolIterations,
    tools_success_count: toolsSuccessCount,
    tools_error_count: toolsErrorCount,
    tool_execution_time_ms: toolExecutionTimeMs
  }
}

/**
 * Execute a tool call - routes to appropriate CRUD handler
 */
async function executeToolCall(
  toolName: string,
  args: any,
  client: any,
  userId: string
): Promise<any> {
  // Parse entity and operation from tool name (e.g., "meetings_create" -> entity: "meetings", operation: "create")
  const parts = toolName.split('_')
  if (parts.length < 2) {
    throw new Error(`Invalid tool name format: ${toolName}`)
  }

  const operation = parts.pop()! // Last part is the operation (create, read, update, delete)
  const entity = parts.join('_') // Everything else is the entity name

  // Route to appropriate handler
  switch (entity) {
    case 'meetings':
      return await handleMeetingsCRUD(operation, args, client, userId)
    
    case 'activities':
      return await handleActivitiesCRUD(operation, args, client, userId)
    
    case 'pipeline':
      return await handlePipelineCRUD(operation, args, client, userId)
    
    case 'leads':
      return await handleLeadsCRUD(operation, args, client, userId)
    
    case 'roadmap':
      return await handleRoadmapCRUD(operation, args, client, userId)
    
    case 'calendar':
      return await handleCalendarCRUD(operation, args, client, userId)
    
    case 'tasks':
      return await handleTasksCRUD(operation, args, client, userId)
    
    default:
      throw new Error(`Unknown entity: ${entity}`)
  }
}

/**
 * Generic CRUD Handlers
 */

// Meetings CRUD
async function handleMeetingsCRUD(operation: string, args: any, client: any, userId: string): Promise<any> {
  switch (operation) {
    case 'create': {
      const { title, meeting_start, meeting_end, summary, transcript_text, company_id, primary_contact_id, actionItems } = args
      
      const meetingData: any = {
        title,
        meeting_start,
        meeting_end,
        owner_user_id: userId,
        summary,
        transcript_text
      }
      
      if (company_id) meetingData.company_id = company_id
      if (primary_contact_id) meetingData.primary_contact_id = primary_contact_id
      if (meeting_end && meeting_start) {
        const start = new Date(meeting_start)
        const end = new Date(meeting_end)
        meetingData.duration_minutes = Math.round((end.getTime() - start.getTime()) / (1000 * 60))
      }

      const { data: meeting, error } = await client
        .from('meetings')
        .insert(meetingData)
        .select()
        .single()

      if (error) throw new Error(`Failed to create meeting: ${error.message}`)

      // Create action items if provided
      if (actionItems && Array.isArray(actionItems) && meeting) {
        for (const item of actionItems) {
          await client
            .from('meeting_action_items')
            .insert({
              meeting_id: meeting.id,
              title: item.title,
              description: item.description,
              assignee_name: item.assignee_name,
              assignee_email: item.assignee_email,
              priority: item.priority || 'medium',
              deadline_at: item.deadline_at,
              completed: item.completed || false
            })
        }
      }

      return { success: true, meeting, message: `Meeting "${title}" created successfully` }
    }

    case 'read': {
      const { 
        id, 
        startDate, 
        endDate, 
        company_id, 
        contact_id, 
        includeTranscripts = true, 
        includeActionItems = true, 
        includeAttendees = true, 
        limit = 50,
        maxTranscriptLength = 50000, // Default: 50KB max transcript length
        transcriptMode = 'full' // 'full', 'summary', or 'truncated'
      } = args

      let query = client
        .from('meetings')
        .select(`
          id,
          title,
          meeting_start,
          meeting_end,
          duration_minutes,
          summary,
          ${includeTranscripts ? 'transcript_text,' : ''}
          transcript_doc_url,
          sentiment_score,
          sentiment_reasoning,
          talk_time_rep_pct,
          talk_time_customer_pct,
          talk_time_judgement,
          fathom_recording_id,
          share_url,
          company_id,
          primary_contact_id
        `)
        .eq('owner_user_id', userId)

      if (id) {
        query = query.eq('id', id).single()
      } else {
        if (startDate) query = query.gte('meeting_start', startDate)
        if (endDate) query = query.lte('meeting_start', endDate)
        if (company_id) query = query.eq('company_id', company_id)
        if (contact_id) query = query.eq('primary_contact_id', contact_id)
        query = query.order('meeting_start', { ascending: false }).limit(limit)
      }

      const { data: meetings, error } = await query

      if (error) throw new Error(`Failed to read meetings: ${error.message}`)

      const result = Array.isArray(meetings) ? meetings : [meetings]
      const meetingIds = result.map((m: any) => m.id).filter(Boolean)

      // Fetch related data
      let actionItems: any[] = []
      let attendees: any[] = []

      if (includeActionItems && meetingIds.length > 0) {
        const { data: items } = await client
          .from('meeting_action_items')
          .select('*')
          .in('meeting_id', meetingIds)

        actionItems = items || []
      }

      if (includeAttendees && meetingIds.length > 0) {
        const { data: atts } = await client
          .from('meeting_attendees')
          .select('*')
          .in('meeting_id', meetingIds)

        attendees = atts || []
      }

      // Combine data and optimize transcripts
      const enrichedMeetings = result.map((m: any) => {
        const meeting = {
          ...m,
          actionItems: actionItems.filter((ai: any) => ai.meeting_id === m.id),
          attendees: attendees.filter((att: any) => att.meeting_id === m.id)
        }

        // Optimize transcript text if present
        if (includeTranscripts && meeting.transcript_text) {
          meeting.transcript_text = optimizeTranscriptText(
            meeting.transcript_text,
            maxTranscriptLength,
            transcriptMode,
            meeting.summary
          )
          meeting.transcript_optimized = meeting.transcript_text.length < (m.transcript_text?.length || 0)
        }

        return meeting
      })

      return {
        success: true,
        meetings: id ? enrichedMeetings[0] : enrichedMeetings,
        count: enrichedMeetings.length
      }
    }

    case 'update': {
      const { id, ...updates } = args
      
      const { data, error } = await client
        .from('meetings')
        .update(updates)
        .eq('id', id)
        .eq('owner_user_id', userId)
        .select()
        .single()

      if (error) throw new Error(`Failed to update meeting: ${error.message}`)

      return { success: true, meeting: data, message: 'Meeting updated successfully' }
    }

    case 'delete': {
      const { id } = args
      
      const { error } = await client
        .from('meetings')
        .delete()
        .eq('id', id)
        .eq('owner_user_id', userId)

      if (error) throw new Error(`Failed to delete meeting: ${error.message}`)

      return { success: true, message: 'Meeting deleted successfully' }
    }

    default:
      throw new Error(`Unknown operation: ${operation}`)
  }
}

// Activities CRUD
async function handleActivitiesCRUD(operation: string, args: any, client: any, userId: string): Promise<any> {
  switch (operation) {
    case 'create': {
      const { type, client_name, details, amount, date, status = 'completed', priority = 'medium' } = args
      
      const { data, error } = await client
        .from('activities')
        .insert({
          user_id: userId,
          type,
          client_name,
          details,
          amount,
          date: date || new Date().toISOString(),
          status,
          priority
        })
        .select()
        .single()

      if (error) throw new Error(`Failed to create activity: ${error.message}`)

      return { success: true, activity: data, message: 'Activity created successfully' }
    }

    case 'read': {
      const { id, type, startDate, endDate, client_name, limit = 50 } = args

      let query = client
        .from('activities')
        .select('*')
        .eq('user_id', userId)

      if (id) {
        query = query.eq('id', id).single()
      } else {
        if (type) query = query.eq('type', type)
        if (startDate) query = query.gte('date', startDate)
        if (endDate) query = query.lte('date', endDate)
        if (client_name) query = query.ilike('client_name', `%${client_name}%`)
        query = query.order('date', { ascending: false }).limit(limit)
      }

      const { data, error } = await query

      if (error) throw new Error(`Failed to read activities: ${error.message}`)

      return { success: true, activities: Array.isArray(data) ? data : [data], count: Array.isArray(data) ? data.length : 1 }
    }

    case 'update': {
      const { id, ...updates } = args
      
      const { data, error } = await client
        .from('activities')
        .update(updates)
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single()

      if (error) throw new Error(`Failed to update activity: ${error.message}`)

      return { success: true, activity: data, message: 'Activity updated successfully' }
    }

    case 'delete': {
      const { id } = args
      
      const { error } = await client
        .from('activities')
        .delete()
        .eq('id', id)
        .eq('user_id', userId)

      if (error) throw new Error(`Failed to delete activity: ${error.message}`)

      return { success: true, message: 'Activity deleted successfully' }
    }

    default:
      throw new Error(`Unknown operation: ${operation}`)
  }
}

// Pipeline (Deals) CRUD
async function handlePipelineCRUD(operation: string, args: any, client: any, userId: string): Promise<any> {
  switch (operation) {
    case 'create': {
      const { name, company, value, stage_id, contact_name, contact_email, expected_close_date, probability, description } = args
      
      const { data, error } = await client
        .from('deals')
        .insert({
          name,
          company,
          value,
          stage_id,
          owner_id: userId,
          contact_name,
          contact_email,
          expected_close_date,
          probability,
          description,
          status: 'active'
        })
        .select()
        .single()

      if (error) throw new Error(`Failed to create deal: ${error.message}`)

      return { success: true, deal: data, message: `Deal "${name}" created successfully` }
    }

    case 'read': {
      const { id, stage_id, status, minValue, maxValue, sortBy = 'updated_at', sortOrder = 'desc', limit = 50 } = args

      let query = client
        .from('deals')
        .select(`
          id,
          name,
          company,
          value,
          stage_id,
          status,
          expected_close_date,
          probability,
          created_at,
          updated_at,
          deal_stages(name)
        `)
        .eq('owner_id', userId)

      if (id) {
        query = query.eq('id', id).single()
      } else {
        if (stage_id) query = query.eq('stage_id', stage_id)
        if (status) query = query.eq('status', status)
        if (minValue) query = query.gte('value', minValue)
        if (maxValue) query = query.lte('value', maxValue)
        query = query.order(sortBy, { ascending: sortOrder === 'asc' }).limit(limit)
      }

      const { data, error } = await query

      if (error) throw new Error(`Failed to read deals: ${error.message}`)

      return { success: true, deals: Array.isArray(data) ? data : [data], count: Array.isArray(data) ? data.length : 1 }
    }

    case 'update': {
      const { id, ...updates } = args
      
      const { data, error } = await client
        .from('deals')
        .update(updates)
        .eq('id', id)
        .eq('owner_id', userId)
        .select()
        .single()

      if (error) throw new Error(`Failed to update deal: ${error.message}`)

      return { success: true, deal: data, message: 'Deal updated successfully' }
    }

    case 'delete': {
      const { id } = args
      
      const { error } = await client
        .from('deals')
        .delete()
        .eq('id', id)
        .eq('owner_id', userId)

      if (error) throw new Error(`Failed to delete deal: ${error.message}`)

      return { success: true, message: 'Deal deleted successfully' }
    }

    default:
      throw new Error(`Unknown operation: ${operation}`)
  }
}

// Leads (Contacts) CRUD
async function handleLeadsCRUD(operation: string, args: any, client: any, userId: string): Promise<any> {
  switch (operation) {
    case 'create': {
      const { first_name, last_name, email, phone, company, title, company_id } = args
      
      const { data, error } = await client
        .from('contacts')
        .insert({
          first_name,
          last_name,
          email,
          phone,
          title,
          company_id,
          owner_id: userId
        })
        .select()
        .single()

      if (error) throw new Error(`Failed to create contact: ${error.message}`)

      return { success: true, contact: data, message: 'Contact created successfully' }
    }

    case 'read': {
      const { id, email, company, company_id, search, limit = 50 } = args

      let query = client
        .from('contacts')
        .select('*')
        .eq('owner_id', userId)

      if (id) {
        query = query.eq('id', id).single()
      } else {
        if (email) query = query.eq('email', email)
        if (company_id) query = query.eq('company_id', company_id)
        if (search) {
          query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`)
        }
        query = query.limit(limit)
      }

      const { data, error } = await query

      if (error) throw new Error(`Failed to read contacts: ${error.message}`)

      return { success: true, contacts: Array.isArray(data) ? data : [data], count: Array.isArray(data) ? data.length : 1 }
    }

    case 'update': {
      const { id, ...updates } = args
      
      const { data, error } = await client
        .from('contacts')
        .update(updates)
        .eq('id', id)
        .eq('owner_id', userId)
        .select()
        .single()

      if (error) throw new Error(`Failed to update contact: ${error.message}`)

      return { success: true, contact: data, message: 'Contact updated successfully' }
    }

    case 'delete': {
      const { id } = args
      
      const { error } = await client
        .from('contacts')
        .delete()
        .eq('id', id)
        .eq('owner_id', userId)

      if (error) throw new Error(`Failed to delete contact: ${error.message}`)

      return { success: true, message: 'Contact deleted successfully' }
    }

    default:
      throw new Error(`Unknown operation: ${operation}`)
  }
}

// Roadmap CRUD
async function handleRoadmapCRUD(operation: string, args: any, client: any, userId: string): Promise<any> {
  switch (operation) {
    case 'create': {
      const { title, description, type = 'feature', priority = 'medium' } = args
      
      const { data, error } = await client
        .from('roadmap_suggestions')
        .insert({
          title,
          description,
          type,
          priority,
          submitted_by: userId,
          status: 'submitted'
        })
        .select()
        .single()

      if (error) throw new Error(`Failed to create roadmap item: ${error.message}`)

      return { success: true, roadmapItem: data, message: `Roadmap item "${title}" created successfully` }
    }

    case 'read': {
      const { id, type, status, priority, limit = 50 } = args

      let query = client
        .from('roadmap_suggestions')
        .select('*')

      if (id) {
        query = query.eq('id', id).single()
      } else {
        if (type) query = query.eq('type', type)
        if (status) query = query.eq('status', status)
        if (priority) query = query.eq('priority', priority)
        query = query.order('created_at', { ascending: false }).limit(limit)
      }

      const { data, error } = await query

      if (error) throw new Error(`Failed to read roadmap items: ${error.message}`)

      return { success: true, roadmapItems: Array.isArray(data) ? data : [data], count: Array.isArray(data) ? data.length : 1 }
    }

    case 'update': {
      const { id, ...updates } = args
      
      // Users can only update their own items
      const { data, error } = await client
        .from('roadmap_suggestions')
        .update(updates)
        .eq('id', id)
        .eq('submitted_by', userId)
        .select()
        .single()

      if (error) throw new Error(`Failed to update roadmap item: ${error.message}`)

      return { success: true, roadmapItem: data, message: 'Roadmap item updated successfully' }
    }

    case 'delete': {
      const { id } = args
      
      // Only admins can delete (or users can delete their own)
      const { error } = await client
        .from('roadmap_suggestions')
        .delete()
        .eq('id', id)
        .eq('submitted_by', userId)

      if (error) throw new Error(`Failed to delete roadmap item: ${error.message}`)

      return { success: true, message: 'Roadmap item deleted successfully' }
    }

    default:
      throw new Error(`Unknown operation: ${operation}`)
  }
}

// Calendar CRUD
async function handleCalendarCRUD(operation: string, args: any, client: any, userId: string): Promise<any> {
  switch (operation) {
    case 'create': {
      const { title, start_time, end_time, description, location, calendar_id, deal_id } = args
      
      const { data, error } = await client
        .from('calendar_events')
        .insert({
          title,
          start_time,
          end_time,
          description,
          location,
          calendar_id,
          user_id: userId,
          deal_id,
          status: 'confirmed'
        })
        .select()
        .single()

      if (error) throw new Error(`Failed to create calendar event: ${error.message}`)

      return { success: true, event: data, message: 'Calendar event created successfully' }
    }

    case 'read': {
      const { id, startDate, endDate, calendar_id, deal_id, limit = 50 } = args

      let query = client
        .from('calendar_events')
        .select('*')
        .eq('user_id', userId)

      if (id) {
        query = query.eq('id', id).single()
      } else {
        if (startDate) query = query.gte('start_time', startDate)
        if (endDate) query = query.lte('end_time', endDate)
        if (calendar_id) query = query.eq('calendar_id', calendar_id)
        if (deal_id) query = query.eq('deal_id', deal_id)
        query = query.order('start_time', { ascending: true }).limit(limit)
      }

      const { data, error } = await query

      if (error) throw new Error(`Failed to read calendar events: ${error.message}`)

      return { success: true, events: Array.isArray(data) ? data : [data], count: Array.isArray(data) ? data.length : 1 }
    }

    case 'update': {
      const { id, ...updates } = args
      
      const { data, error } = await client
        .from('calendar_events')
        .update(updates)
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single()

      if (error) throw new Error(`Failed to update calendar event: ${error.message}`)

      return { success: true, event: data, message: 'Calendar event updated successfully' }
    }

    case 'delete': {
      const { id } = args
      
      const { error } = await client
        .from('calendar_events')
        .delete()
        .eq('id', id)
        .eq('user_id', userId)

      if (error) throw new Error(`Failed to delete calendar event: ${error.message}`)

      return { success: true, message: 'Calendar event deleted successfully' }
    }

    default:
      throw new Error(`Unknown operation: ${operation}`)
  }
}

// Tasks CRUD
async function handleTasksCRUD(operation: string, args: any, client: any, userId: string): Promise<any> {
  switch (operation) {
    case 'create': {
      const { title, description, priority = 'medium', task_type = 'general', due_date, contact_id, deal_id, company_id } = args
      
      const taskData: any = {
        title,
        description,
        priority,
        task_type,
        created_by: userId,
        assigned_to: userId,
        status: 'todo'
      }

      if (due_date) taskData.due_date = due_date
      if (contact_id) taskData.contact_id = contact_id
      if (deal_id) taskData.deal_id = deal_id
      if (company_id) taskData.company_id = company_id

      const { data, error } = await client
        .from('tasks')
        .insert(taskData)
        .select()
        .single()

      if (error) throw new Error(`Failed to create task: ${error.message}`)

      return { success: true, task: data, message: `Task "${title}" created successfully` }
    }

    case 'read': {
      const { id, status, priority, contact_id, deal_id, limit = 50 } = args

      let query = client
        .from('tasks')
        .select('*')
        // Include tasks assigned to user OR created by user
        .or(`assigned_to.eq.${userId},created_by.eq.${userId}`)

      if (id) {
        query = query.eq('id', id).single()
      } else {
        if (status) query = query.eq('status', status)
        if (priority) query = query.eq('priority', priority)
        if (contact_id) query = query.eq('contact_id', contact_id)
        if (deal_id) query = query.eq('deal_id', deal_id)
        query = query.order('created_at', { ascending: false }).limit(limit)
      }

      const { data, error } = await query

      if (error) throw new Error(`Failed to read tasks: ${error.message}`)

      return { success: true, tasks: Array.isArray(data) ? data : [data], count: Array.isArray(data) ? data.length : 1 }
    }

    case 'update': {
      const { id, ...updates } = args
      
      // First check if task exists and user has permission (assigned to or created by)
      const { data: existingTask, error: checkError } = await client
        .from('tasks')
        .select('id, assigned_to, created_by')
        .eq('id', id)
        .single()

      if (checkError || !existingTask) {
        throw new Error(`Task not found: ${id}`)
      }

      if (existingTask.assigned_to !== userId && existingTask.created_by !== userId) {
        throw new Error('You do not have permission to update this task')
      }
      
      const { data, error } = await client
        .from('tasks')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw new Error(`Failed to update task: ${error.message}`)

      return { success: true, task: data, message: 'Task updated successfully' }
    }

    case 'delete': {
      const { id } = args
      
      // First check if task exists and user has permission (assigned to or created by)
      const { data: existingTask, error: checkError } = await client
        .from('tasks')
        .select('id, assigned_to, created_by')
        .eq('id', id)
        .single()

      if (checkError || !existingTask) {
        throw new Error(`Task not found: ${id}`)
      }

      if (existingTask.assigned_to !== userId && existingTask.created_by !== userId) {
        throw new Error('You do not have permission to delete this task')
      }
      
      const { error } = await client
        .from('tasks')
        .delete()
        .eq('id', id)

      if (error) throw new Error(`Failed to delete task: ${error.message}`)

      return { success: true, message: 'Task deleted successfully' }
    }

    default:
      throw new Error(`Unknown operation: ${operation}`)
  }
}

/**
 * Optimize transcript text for large transcripts
 * Handles truncation intelligently at sentence boundaries
 */
function optimizeTranscriptText(
  transcript: string,
  maxLength: number = 50000,
  mode: 'full' | 'summary' | 'truncated' = 'truncated',
  summary?: string
): string {
  if (!transcript) return transcript

  // If transcript is within limits, return as-is
  if (transcript.length <= maxLength) {
    return transcript
  }

  // If mode is 'summary' and summary exists, return summary instead
  if (mode === 'summary' && summary) {
    return `[Summary Mode] ${summary}\n\n[Full transcript available but not included due to length]`
  }

  // Truncate intelligently at sentence boundaries
  const truncated = transcript.substring(0, maxLength)
  
  // Try to find a sentence boundary near the end
  const sentenceEndRegex = /[.!?]\s+/g
  let lastSentenceEnd = -1
  let match
  
  // Look for sentence endings in the last 20% of the truncated text
  const searchStart = Math.floor(maxLength * 0.8)
  const searchText = truncated.substring(searchStart)
  
  while ((match = sentenceEndRegex.exec(searchText)) !== null) {
    lastSentenceEnd = searchStart + match.index + match[0].length
  }
  
  // If we found a good sentence boundary (within last 10% of limit), use it
  if (lastSentenceEnd > maxLength * 0.9) {
    return truncated.substring(0, lastSentenceEnd) + 
           `\n\n[... transcript truncated: ${transcript.length - lastSentenceEnd} characters remaining ...]`
  }
  
  // Otherwise, find the last word boundary
  const lastSpace = truncated.lastIndexOf(' ')
  const lastNewline = truncated.lastIndexOf('\n')
  const cutPoint = Math.max(lastSpace, lastNewline)
  
  if (cutPoint > maxLength * 0.9) {
    return truncated.substring(0, cutPoint) + 
           `\n\n[... transcript truncated: ${transcript.length - cutPoint} characters remaining ...]`
  }
  
  // Fallback: hard truncate with warning
  return truncated + `\n\n[... transcript truncated: ${transcript.length - maxLength} characters remaining ...]`
}

// Note: Legacy functions removed - all operations now use CRUD handlers above
// The CRUD handlers provide full access to meetings with transcripts, action items, etc.

/**
 * Generate email draft using Claude (utility function for email generation)
 */
async function generateEmailDraft(
  context: any,
  tone: 'professional' | 'friendly' | 'concise'
): Promise<{ subject: string; body: string; suggestedSendTime: string }> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not configured')
  }

  const toneInstructions = {
    professional: 'Use a professional, business-appropriate tone. Be respectful and formal.',
    friendly: 'Use a warm, friendly tone. Be personable and conversational.',
    concise: 'Be brief and to the point. Get straight to the value proposition.'
  }

  const prompt = `You are drafting a ${tone} follow-up email for ${context.contact.name} at ${context.contact.company}.

Context: ${context.context}

${context.recentActivities.length > 0 ? `Recent activities:\n${context.recentActivities.map((a: any) => `- ${a.type}: ${a.details || 'N/A'} on ${a.date}`).join('\n')}\n` : ''}

${context.deals.length > 0 ? `Related deals:\n${context.deals.map((d: any) => `- ${d.name}: $${d.value} (${d.deal_stages?.name || 'Unknown'})`).join('\n')}\n` : ''}

${toneInstructions[tone]}

Generate a professional email with:
1. A clear, compelling subject line
2. A well-structured email body (3-5 paragraphs)
3. A suggested send time (e.g., "Tomorrow 9 AM EST" or "Monday morning")

Return your response as JSON in this exact format:
{
  "subject": "Email subject here",
  "body": "Email body here with proper formatting",
  "suggestedSendTime": "Suggested send time"
}`

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': ANTHROPIC_VERSION
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: prompt
      }]
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Claude API error: ${response.status}`)
  }

  const data = await response.json()
  const content = data.content[0]?.text || ''

  // Parse JSON from response
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const emailData = JSON.parse(jsonMatch[0])
      return {
        subject: emailData.subject || 'Follow-up',
        body: emailData.body || content,
        suggestedSendTime: emailData.suggestedSendTime || 'Tomorrow 9 AM EST'
      }
    }
  } catch (e) {
  }

  // Fallback if JSON parsing fails
  return {
    subject: 'Follow-up',
    body: content,
    suggestedSendTime: 'Tomorrow 9 AM EST'
  }
}

/**
 * Extract user ID from message by matching names
 * Looks for patterns like "Phil's performance", "show me John's", etc.
 */
async function extractUserIdFromMessage(
  message: string,
  client: any,
  requestingUserId: string
): Promise<string | null> {
  try {
    console.log('[EXTRACT-USER] Starting user extraction from message:', message.substring(0, 100))
    
    // Patterns to match: "Phil's performance", "show me John's", "how is Mike doing", etc.
    // More flexible patterns to catch various phrasings
    const namePatterns = [
      /(?:can you show|show me|how is|what is|tell me about|view|see|i'd like to see)\s+([A-Z][a-z]+)(?:'s|'|s)?\s+(?:performance|doing|performing|stats|data|results|sales|this week|this month)/i,
      /([A-Z][a-z]+)(?:'s|'|s)?\s+(?:performance|doing|performing|stats|data|results|sales|this week|this month)/i,
      /(?:for|about)\s+([A-Z][a-z]+)(?:\s|$)/i,
      /([A-Z][a-z]+)(?:'s|'|s)?\s+(?:performance|doing|performing|sales)/i,
      // Match "Phil's sales performance" or "Phil's performance this week"
      /([A-Z][a-z]+)(?:'s|'|s)?\s+(?:sales\s+)?performance/i
    ]
    
    let extractedName: string | null = null
    
    for (let i = 0; i < namePatterns.length; i++) {
      const pattern = namePatterns[i]
      const match = message.match(pattern)
      if (match && match[1]) {
        extractedName = match[1].trim()
        console.log('[EXTRACT-USER] ✅ Name extracted via pattern', i + 1, ':', extractedName)
        break
      }
    }
    
    if (!extractedName) {
      console.log('[EXTRACT-USER] ❌ No name extracted from message')
      return null
    }
    
    // Search for user by first name or last name
    console.log('[EXTRACT-USER] Searching for user with name:', extractedName)
    const { data: users, error } = await client
      .from('profiles')
      .select('id, first_name, last_name, email')
      .or(`first_name.ilike.%${extractedName}%,last_name.ilike.%${extractedName}%`)
      .limit(10)
    
    if (error) {
      console.error('[EXTRACT-USER] ❌ Database error:', error)
      return null
    }
    
    if (!users || users.length === 0) {
      console.log('[EXTRACT-USER] ❌ No users found matching name:', extractedName)
      return null
    }
    
    console.log('[EXTRACT-USER] Found', users.length, 'potential matches:', users.map(u => ({
      id: u.id,
      name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email
    })))
    
    // Exact match preferred, then partial match
    const exactMatch = users.find(u => 
      u.first_name?.toLowerCase() === extractedName.toLowerCase() ||
      u.last_name?.toLowerCase() === extractedName.toLowerCase()
    )
    
    if (exactMatch) {
      console.log('[EXTRACT-USER] ✅ Exact match found:', exactMatch.id, `${exactMatch.first_name} ${exactMatch.last_name}`)
      return exactMatch.id
    }
    
    // Return first match if only one
    if (users.length === 1) {
      console.log('[EXTRACT-USER] ✅ Single match found:', users[0].id)
      return users[0].id
    }
    
    // If multiple matches, try to find best match by checking full name
    const bestMatch = users.find(u => {
      const fullName = `${u.first_name || ''} ${u.last_name || ''}`.trim().toLowerCase()
      return fullName.includes(extractedName.toLowerCase())
    })
    
    const selectedId = bestMatch?.id || users[0].id
    console.log('[EXTRACT-USER] ✅ Selected user ID:', selectedId, 'from', users.length, 'matches')
    return selectedId
  } catch (error) {
    console.error('[EXTRACT-USER] ❌ Exception during user extraction:', error)
    return null
  }
}

/**
 * Detect intent from user message and structure response accordingly
 */
async function detectAndStructureResponse(
  userMessage: string,
  aiContent: string,
  client: any,
  userId: string,
  toolsUsed: string[] = [],
  requestingUserId?: string // Admin user making the request
): Promise<StructuredResponse | null> {
  const messageLower = userMessage.toLowerCase()
  
  // Store original message for limit extraction
  const originalMessage = userMessage
  
  // Detect task creation requests (check before activity creation)
  const taskCreationKeywords = [
    'create a task', 'add a task', 'new task', 'create task', 'add task',
    'remind me to', 'remind me', 'remind to', 'remind',
    'schedule a task', 'set a task', 'task to',
    'todo to', 'to-do to', 'follow up with', 'follow-up with',
    'follow up', 'follow-up', 'followup'
  ]
  
  const isTaskCreationRequest = 
    taskCreationKeywords.some(keyword => messageLower.includes(keyword)) ||
    (messageLower.includes('task') && (messageLower.includes('create') || messageLower.includes('add') || messageLower.includes('for') || messageLower.includes('to'))) ||
    (messageLower.includes('remind') && (messageLower.includes('to') || messageLower.includes('me') || messageLower.includes('about'))) ||
    (messageLower.includes('follow') && (messageLower.includes('up') || messageLower.includes('with'))) ||
    (messageLower.includes('reminder') && (messageLower.includes('for') || messageLower.includes('about')))
  
  if (isTaskCreationRequest) {
    const structured = await structureTaskCreationResponse(client, userId, userMessage)
    return structured
  }
  
  // Detect proposal/activity creation requests (check before other detections)
  const proposalKeywords = ['add a proposal', 'create proposal', 'add proposal', 'proposal for', 'new proposal']
  const meetingKeywords = ['add a meeting', 'create meeting', 'add meeting', 'meeting with', 'new meeting']
  const saleKeywords = ['add a sale', 'create sale', 'add sale', 'sale for', 'new sale']
  const outboundKeywords = ['add outbound', 'create outbound', 'outbound for', 'new outbound']
  
  const isProposalRequest = proposalKeywords.some(keyword => messageLower.includes(keyword)) || 
    (messageLower.includes('proposal') && (messageLower.includes('add') || messageLower.includes('create') || messageLower.includes('for')))
  const isMeetingRequest = meetingKeywords.some(keyword => messageLower.includes(keyword)) || 
    (messageLower.includes('meeting') && (messageLower.includes('add') || messageLower.includes('create') || messageLower.includes('with')))
  const isSaleRequest = saleKeywords.some(keyword => messageLower.includes(keyword)) || 
    (messageLower.includes('sale') && (messageLower.includes('add') || messageLower.includes('create') || messageLower.includes('for')))
  const isOutboundRequest = outboundKeywords.some(keyword => messageLower.includes(keyword)) || 
    (messageLower.includes('outbound') && (messageLower.includes('add') || messageLower.includes('create') || messageLower.includes('for')))
  
  if (isProposalRequest || isMeetingRequest || isSaleRequest || isOutboundRequest) {
    const activityType = isProposalRequest ? 'proposal' : isMeetingRequest ? 'meeting' : isSaleRequest ? 'sale' : 'outbound'
    const structured = await structureActivityCreationResponse(client, userId, userMessage, activityType)
    return structured
  }
  
  // Detect pipeline-related queries
  // Note: General "prioritize" questions are handled by task detection first
  const isPipelineQuery = 
    messageLower.includes('pipeline') ||
    messageLower.includes('deal') ||
    messageLower.includes('deals') ||
    (messageLower.includes('what should i prioritize') && (messageLower.includes('pipeline') || messageLower.includes('deal'))) ||
    messageLower.includes('needs attention') ||
    messageLower.includes('at risk') ||
    messageLower.includes('pipeline health') ||
    (messageLower.includes('show me my') && (messageLower.includes('deal') || messageLower.includes('pipeline')))
  
  if (isPipelineQuery) {
    const structured = await structurePipelineResponse(client, userId, aiContent, userMessage)
    return structured
  }
  
  // Detect email-related queries
  if (
    messageLower.includes('draft') && messageLower.includes('email') ||
    messageLower.includes('write') && messageLower.includes('email') ||
    messageLower.includes('follow-up') && messageLower.includes('email') ||
    messageLower.includes('email to')
  ) {
    // Email responses would be structured here
    // For now, return null to use text format
    return null
  }
  
  // Detect calendar/meeting queries
  if (
    messageLower.includes('meeting') ||
    messageLower.includes('calendar') ||
    messageLower.includes('schedule') ||
    messageLower.includes('availability')
  ) {
    // Calendar responses would be structured here
    return null
  }
  
  // Detect task queries - more comprehensive detection
  const taskKeywords = [
    'task', 'tasks', 'todo', 'to-do', 'to do',
    'high priority task', 'priority task', 'urgent task',
    'my task', 'my tasks', 'list task', 'list tasks',
    'show task', 'show tasks', 'what task', 'what tasks',
    'due today', 'overdue', 'pending task', 'completed task',
    'task list', 'task summary', 'task overview'
  ]
  
  const hasTaskKeyword = taskKeywords.some(keyword => messageLower.includes(keyword))
  
  // Also check for task-related phrases
  // General "prioritize" questions default to tasks (more actionable day-to-day)
  const taskPhrases = [
    (messageLower.includes('list') && (messageLower.includes('task') || messageLower.includes('priority') || messageLower.includes('todo'))),
    (messageLower.includes('show') && (messageLower.includes('task') || messageLower.includes('my task') || messageLower.includes('priority'))),
    (messageLower.includes('what') && (messageLower.includes('task') || messageLower.includes('todo'))),
    (messageLower.includes('high priority') && (messageLower.includes('task') || messageLower.includes('show') || messageLower.includes('list'))),
    (messageLower.includes('urgent') && (messageLower.includes('task') || messageLower.includes('todo'))),
    messageLower.includes('due today'),
    messageLower.includes('overdue task'),
    messageLower.includes('task backlog'),
    // General prioritize questions default to tasks
    messageLower.includes('what should i prioritize'),
    messageLower.includes('prioritize today'),
    messageLower.includes('what to prioritize')
  ]
  
  const hasTaskPhrase = taskPhrases.some(phrase => phrase === true)
  
  if (hasTaskKeyword || hasTaskPhrase) {
    const structured = await structureTaskResponse(client, userId, aiContent, userMessage)
    return structured
  }
  
  // Detect activity queries (non-task activities)
  if (
    messageLower.includes('activity') ||
    messageLower.includes('activities') ||
    (messageLower.includes('follow-up') && !messageLower.includes('task'))
  ) {
    // Activity responses would be structured here
    return null
  }
  
  // Detect lead queries
  if (
    messageLower.includes('lead') ||
    messageLower.includes('new contact') ||
    messageLower.includes('qualification')
  ) {
    // Lead responses would be structured here
    return null
  }
  
  // Detect contact/email queries - check for email addresses or contact lookups
  const emailPattern = /[\w\.-]+@[\w\.-]+\.\w+/
  const hasEmail = emailPattern.test(userMessage)
  const contactKeywords = ['contact', 'person', 'about', 'info on', 'tell me about', 'show me', 'lookup', 'find']
  const hasContactKeyword = contactKeywords.some(keyword => messageLower.includes(keyword))
  
  if (hasEmail || (hasContactKeyword && (messageLower.includes('@') || messageLower.includes('email')))) {
    // Extract email from message if present
    const emailMatch = userMessage.match(emailPattern)
    const contactEmail = emailMatch ? emailMatch[0] : null
    
    const structured = await structureContactResponse(client, userId, aiContent, contactEmail, userMessage)
    return structured
  }
  
  // Detect roadmap creation queries
  if (
    messageLower.includes('roadmap') ||
    messageLower.includes('add a roadmap') ||
    messageLower.includes('create roadmap') ||
    messageLower.includes('roadmap item') ||
    toolsUsed.includes('roadmap_create')
  ) {
    const structured = await structureRoadmapResponse(client, userId, aiContent, userMessage)
    return structured
  }
  
  // Detect sales coach/performance queries
  // Check for performance-related keywords OR user name patterns with performance context
  const hasPerformanceKeyword = 
    messageLower.includes('performance') ||
    messageLower.includes('how am i doing') ||
    messageLower.includes('how is my performance') ||
    messageLower.includes('sales coach') ||
    (messageLower.includes('compare') && (messageLower.includes('month') || messageLower.includes('period'))) ||
    (messageLower.includes('this month') && messageLower.includes('last month')) ||
    (messageLower.includes('this week') && (messageLower.includes('performance') || messageLower.includes('doing') || messageLower.includes('stats') || messageLower.includes('sales')))
  
  // Check for user name + performance pattern (e.g., "Phil's performance", "show me John's stats")
  // More flexible patterns to catch "Can you show me Phil's performance this week"
  const userNamePerformancePatterns = [
    /([A-Z][a-z]+)(?:'s|'|s)?\s+(?:performance|doing|performing|stats|data|results|sales)(?:\s+this\s+(?:week|month))?/i,
    /(?:can you show|show me|how is|what is|tell me about|view|see|i'd like to see)\s+([A-Z][a-z]+)(?:'s|'|s)?\s+(?:performance|doing|performing|stats|data|results|sales)(?:\s+this\s+(?:week|month))?/i,
    /([A-Z][a-z]+)(?:'s|'|s)?\s+(?:sales\s+)?performance(?:\s+this\s+(?:week|month))?/i
  ]
  
  const hasUserNamePerformancePattern = userNamePerformancePatterns.some(pattern => pattern.test(userMessage))
  
  if (hasPerformanceKeyword || hasUserNamePerformancePattern) {
    const structured = await structureSalesCoachResponse(client, userId, aiContent, userMessage, requestingUserId)
    return structured
  }
  
  return null
}

/**
 * Structure activity creation response with contact search
 */
async function structureActivityCreationResponse(
  client: any,
  userId: string,
  userMessage: string,
  activityType: 'proposal' | 'meeting' | 'sale' | 'outbound'
): Promise<any> {
  try {
    // Extract contact name from message
    // Patterns: "add proposal for Paul Lima", "create meeting with John Smith", etc.
    const namePatterns = [
      /(?:for|with)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
      /([A-Z][a-z]+\s+[A-Z][a-z]+)/, // Full name pattern
      /(?:proposal|meeting|sale|outbound)\s+(?:for|with)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i
    ]
    
    let contactName: string | null = null
    for (const pattern of namePatterns) {
      const match = userMessage.match(pattern)
      if (match && match[1]) {
        contactName = match[1].trim()
        break
      }
    }
    
    // Extract date information
    const todayPattern = /(?:for|on)\s+(?:today|now)/i
    const tomorrowPattern = /(?:for|on)\s+tomorrow/i
    const datePattern = /(?:for|on)\s+(\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?)/i
    
    let activityDate: string | null = null
    if (todayPattern.test(userMessage)) {
      activityDate = new Date().toISOString()
    } else if (tomorrowPattern.test(userMessage)) {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      activityDate = tomorrow.toISOString()
    } else if (datePattern.test(userMessage)) {
      const dateMatch = userMessage.match(datePattern)
      if (dateMatch && dateMatch[1]) {
        // Try to parse the date
        const parsedDate = new Date(dateMatch[1])
        if (!isNaN(parsedDate.getTime())) {
          activityDate = parsedDate.toISOString()
        }
      }
    }
    
    // If no date specified, default to today
    if (!activityDate) {
      activityDate = new Date().toISOString()
    }
    
    // If no contact name found, return contact selection response
    if (!contactName) {
      return {
        type: 'contact_selection',
        summary: `I'd like to help you create a ${activityType}. Please select the contact:`,
        data: {
          activityType,
          activityDate,
          requiresContactSelection: true,
          prefilledName: '',
          prefilledEmail: ''
        },
        actions: [],
        metadata: {
          timeGenerated: new Date().toISOString(),
          dataSource: ['user_message']
        }
      }
    }
    
    // Search for contacts matching the name
    const nameParts = contactName.split(/\s+/)
    const firstName = nameParts[0] || ''
    const lastName = nameParts.slice(1).join(' ') || ''
    
    // Build search query
    let contactsQuery = client
      .from('contacts')
      .select('id, first_name, last_name, full_name, email, company_id, companies:company_id(id, name)')
      .eq('user_id', userId)
    
    // Search by first and last name
    if (firstName && lastName) {
      contactsQuery = contactsQuery.or(`first_name.ilike.%${firstName}%,last_name.ilike.%${lastName}%,full_name.ilike.%${contactName}%`)
    } else if (firstName) {
      contactsQuery = contactsQuery.or(`first_name.ilike.%${firstName}%,full_name.ilike.%${firstName}%`)
    } else {
      // If no name parts, search by full name
      contactsQuery = contactsQuery.ilike('full_name', `%${contactName}%`)
    }
    
    const { data: contacts, error: contactsError } = await contactsQuery.limit(10)
    
    if (contactsError) {
      console.error('Error searching contacts:', contactsError)
      // Return contact selection response on error
      return {
        type: 'contact_selection',
        summary: `I'd like to help you create a ${activityType} for ${contactName}. Please select the contact:`,
        data: {
          activityType,
          activityDate,
          requiresContactSelection: true,
          prefilledName: contactName,
          prefilledEmail: ''
        },
        actions: [],
        metadata: {
          timeGenerated: new Date().toISOString(),
          dataSource: ['user_message']
        }
      }
    }
    
    // If no contacts found or multiple contacts found, return contact selection response
    if (!contacts || contacts.length === 0 || contacts.length > 1) {
      return {
        type: 'contact_selection',
        summary: contacts && contacts.length > 1
          ? `I found ${contacts.length} contacts matching "${contactName}". Please select the correct one:`
          : `I couldn't find a contact matching "${contactName}". Please select or create a contact:`,
        data: {
          activityType,
          activityDate,
          requiresContactSelection: true,
          prefilledName: contactName,
          prefilledEmail: '',
          suggestedContacts: contacts || []
        },
        actions: [],
        metadata: {
          timeGenerated: new Date().toISOString(),
          dataSource: ['contacts_search'],
          matchCount: contacts?.length || 0
        }
      }
    }
    
    // Single contact found - return success response with contact info
    const contact = contacts[0]
    return {
      type: 'activity_creation',
      summary: `I found ${contact.full_name || `${contact.first_name} ${contact.last_name}`.trim()}. Ready to create the ${activityType}.`,
      data: {
        activityType,
        activityDate,
        contact: {
          id: contact.id,
          name: contact.full_name || `${contact.first_name} ${contact.last_name}`.trim(),
          email: contact.email,
          company: contact.companies?.name || null,
          companyId: contact.company_id || null
        },
        requiresContactSelection: false
      },
      actions: [
        {
          id: 'create-activity',
          label: `Create ${activityType.charAt(0).toUpperCase() + activityType.slice(1)}`,
          type: 'primary',
          callback: 'create_activity',
          params: {
            type: activityType,
            date: activityDate,
            contactId: contact.id
          }
        }
      ],
      metadata: {
        timeGenerated: new Date().toISOString(),
        dataSource: ['contacts_search'],
        matchCount: 1
      }
    }
  } catch (error) {
    console.error('Error in structureActivityCreationResponse:', error)
    // Return contact selection response on error
    return {
      type: 'contact_selection',
      summary: `I'd like to help you create a ${activityType}. Please select the contact:`,
      data: {
        activityType,
        activityDate: new Date().toISOString(),
        requiresContactSelection: true,
        prefilledName: '',
        prefilledEmail: ''
      },
      actions: [],
      metadata: {
        timeGenerated: new Date().toISOString(),
        dataSource: ['error_fallback']
      }
    }
  }
}

/**
 * Structure task creation response with contact search
 */
async function structureTaskCreationResponse(
  client: any,
  userId: string,
  userMessage: string
): Promise<any> {
  try {
    // Extract task title/description from message
    // Patterns: "create a task to follow up with Paul", "remind me to call John", etc.
    const taskTitlePatterns = [
      /(?:create|add|new|set).*task.*(?:to|for|about)\s+(.+)/i,
      /remind\s+me\s+(?:to\s+)?(?:follow\s+up\s+)?(?:with\s+)?(.+)/i,
      /remind\s+(?:me\s+)?(?:to\s+)?(?:follow\s+up\s+)?(?:with\s+)?(.+)/i,
      /task\s+to\s+(.+)/i,
      /follow\s+up\s+(?:with\s+)?(.+)/i,
      /follow-up\s+(?:with\s+)?(.+)/i,
      /(?:call|email|meet|contact|reach out to)\s+(.+)/i
    ]
    
    let taskTitle: string | null = null
    for (const pattern of taskTitlePatterns) {
      const match = userMessage.match(pattern)
      if (match && match[1]) {
        taskTitle = match[1].trim()
        // Remove date/time references and common phrases from title
        taskTitle = taskTitle
          .replace(/\s+(?:tomorrow|today|next week|in \d+ days?|on \w+day).*$/i, '')
          .replace(/\s+about\s+the\s+proposal.*$/i, '')
          .replace(/\s+regarding.*$/i, '')
          .trim()
        break
      }
    }
    
    // If no title found, try to extract from "remind me to [action]"
    if (!taskTitle) {
      const remindMatch = userMessage.match(/remind\s+me\s+(?:to\s+)?(.+?)(?:\s+tomorrow|\s+today|\s+about|$)/i)
      if (remindMatch && remindMatch[1]) {
        taskTitle = remindMatch[1].trim()
      } else {
        taskTitle = 'Follow-up task'
      }
    }
    
    // Extract contact name from message
    // Improved patterns to catch "remind me to follow up with Paul"
    const namePatterns = [
      /follow\s+up\s+with\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
      /follow-up\s+with\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
      /remind\s+me\s+(?:to\s+)?(?:follow\s+up\s+)?with\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
      /(?:with|to|for)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
      /([A-Z][a-z]+\s+[A-Z][a-z]+)/, // Full name pattern
      /([A-Z][a-z]+)(?:\s+tomorrow|\s+today|\s+next|\s+about|\s+regarding)/i // Single name before date/context
    ]
    
    let contactName: string | null = null
    for (const pattern of namePatterns) {
      const match = userMessage.match(pattern)
      if (match && match[1]) {
        contactName = match[1].trim()
        // Clean up the name - remove common words that might have been captured
        contactName = contactName
          .replace(/^(?:to|for|with|about|regarding)\s+/i, '')
          .replace(/\s+(?:tomorrow|today|next|about|the|proposal|regarding).*$/i, '')
          .trim()
        if (contactName && contactName.length > 1) {
          break
        }
      }
    }
    
    // Fallback: try to extract a capitalized name (likely a person's name)
    if (!contactName) {
      const capitalizedNameMatch = userMessage.match(/\b([A-Z][a-z]+)(?:\s+(?:tomorrow|today|about|the|proposal))?/i)
      if (capitalizedNameMatch && capitalizedNameMatch[1]) {
        const potentialName = capitalizedNameMatch[1]
        // Only use if it's not a common word
        const commonWords = ['remind', 'follow', 'create', 'add', 'task', 'tomorrow', 'today', 'about', 'the']
        if (!commonWords.includes(potentialName.toLowerCase())) {
          contactName = potentialName
        }
      }
    }
    
    // Extract date information
    const todayPattern = /(?:for|on|by)\s+(?:today|now)/i
    const tomorrowPattern = /(?:for|on|by)\s+tomorrow/i
    const nextWeekPattern = /(?:for|on|by)\s+next\s+week/i
    const daysPattern = /(?:in|for)\s+(\d+)\s+days?/i
    const datePattern = /(?:for|on|by)\s+(\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?)/i
    
    let dueDate: string | null = null
    if (todayPattern.test(userMessage)) {
      dueDate = new Date().toISOString()
    } else if (tomorrowPattern.test(userMessage)) {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      dueDate = tomorrow.toISOString()
    } else if (nextWeekPattern.test(userMessage)) {
      const nextWeek = new Date()
      nextWeek.setDate(nextWeek.getDate() + 7)
      dueDate = nextWeek.toISOString()
    } else if (daysPattern.test(userMessage)) {
      const daysMatch = userMessage.match(daysPattern)
      if (daysMatch && daysMatch[1]) {
        const days = parseInt(daysMatch[1], 10)
        const futureDate = new Date()
        futureDate.setDate(futureDate.getDate() + days)
        dueDate = futureDate.toISOString()
      }
    } else if (datePattern.test(userMessage)) {
      const dateMatch = userMessage.match(datePattern)
      if (dateMatch && dateMatch[1]) {
        const parsedDate = new Date(dateMatch[1])
        if (!isNaN(parsedDate.getTime())) {
          dueDate = parsedDate.toISOString()
        }
      }
    }
    
    // Extract priority
    let priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium'
    if (/\burgent\b/i.test(userMessage) || /\bhigh priority\b/i.test(userMessage)) {
      priority = 'urgent'
    } else if (/\bhigh\b/i.test(userMessage) && !/\bhigh priority\b/i.test(userMessage)) {
      priority = 'high'
    } else if (/\blow\b/i.test(userMessage)) {
      priority = 'low'
    }
    
    // Extract task type
    let taskType: 'call' | 'email' | 'meeting' | 'follow_up' | 'demo' | 'proposal' | 'general' = 'follow_up'
    if (/\bcall\b/i.test(userMessage)) {
      taskType = 'call'
    } else if (/\bemail\b/i.test(userMessage)) {
      taskType = 'email'
    } else if (/\bmeeting\b/i.test(userMessage)) {
      taskType = 'meeting'
    } else if (/\bdemo\b/i.test(userMessage)) {
      taskType = 'demo'
    } else if (/\bproposal\b/i.test(userMessage)) {
      taskType = 'proposal'
    }
    
    // If no contact name found, return contact selection response
    if (!contactName) {
      return {
        type: 'contact_selection',
        summary: `I'd like to help you create a task. Please select the contact:`,
        data: {
          activityType: 'task',
          activityDate: dueDate || new Date().toISOString(),
          requiresContactSelection: true,
          prefilledName: '',
          prefilledEmail: '',
          taskTitle,
          taskType,
          priority
        },
        actions: [],
        metadata: {
          timeGenerated: new Date().toISOString(),
          dataSource: ['user_message']
        }
      }
    }
    
    // Search for contacts matching the name
    const nameParts = contactName.split(/\s+/)
    const firstName = nameParts[0] || ''
    const lastName = nameParts.slice(1).join(' ') || ''
    
    // Build search query
    let contactsQuery = client
      .from('contacts')
      .select('id, first_name, last_name, full_name, email, company_id, companies:company_id(id, name)')
      .eq('user_id', userId)
    
    // Search by first and last name
    if (firstName && lastName) {
      contactsQuery = contactsQuery.or(`first_name.ilike.%${firstName}%,last_name.ilike.%${lastName}%,full_name.ilike.%${contactName}%`)
    } else if (firstName) {
      contactsQuery = contactsQuery.or(`first_name.ilike.%${firstName}%,full_name.ilike.%${firstName}%`)
    } else {
      // If no name parts, search by full name
      contactsQuery = contactsQuery.ilike('full_name', `%${contactName}%`)
    }
    
    const { data: contacts, error: contactsError } = await contactsQuery.limit(10)
    
    if (contactsError) {
      console.error('Error searching contacts:', contactsError)
      // Return contact selection response on error
      return {
        type: 'contact_selection',
        summary: `I'd like to help you create a task for ${contactName}. Please select the contact:`,
        data: {
          activityType: 'task',
          activityDate: dueDate || new Date().toISOString(),
          requiresContactSelection: true,
          prefilledName: contactName,
          prefilledEmail: '',
          taskTitle,
          taskType,
          priority
        },
        actions: [],
        metadata: {
          timeGenerated: new Date().toISOString(),
          dataSource: ['user_message']
        }
      }
    }
    
    // Format contacts for frontend
    const formattedContacts = (contacts || []).map((contact: any) => ({
      id: contact.id,
      name: contact.full_name || `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || contact.email || 'Unknown',
      email: contact.email,
      company: contact.companies?.name || null
    }))
    
    // If no contacts found or multiple contacts found, return contact selection response
    if (!contacts || contacts.length === 0 || contacts.length > 1) {
      return {
        type: 'contact_selection',
        summary: contacts && contacts.length > 1
          ? `I found ${contacts.length} contacts matching "${contactName}". Please select the correct one:`
          : `I couldn't find a contact matching "${contactName}". Please select or create a contact:`,
        data: {
          activityType: 'task',
          activityDate: dueDate || new Date().toISOString(),
          requiresContactSelection: true,
          prefilledName: contactName,
          prefilledEmail: '',
          suggestedContacts: formattedContacts,
          taskTitle,
          taskType,
          priority
        },
        actions: [],
        metadata: {
          timeGenerated: new Date().toISOString(),
          dataSource: ['contacts_search'],
          matchCount: contacts?.length || 0
        }
      }
    }
    
    // Single contact found - check if proposal is mentioned and search for proposals
    const contact = contacts[0]
    const mentionsProposal = /\bproposal\b/i.test(userMessage)
    
    // If proposal is mentioned, search for related proposals
    if (mentionsProposal) {
      // Search for proposals related to this contact
      // Try multiple search strategies: contact_id, client_name, contact_identifier
      let proposalsQuery = client
        .from('activities')
        .select(`
          id,
          type,
          client_name,
          details,
          amount,
          date,
          deal_id,
          company_id,
          contact_id,
          deals:deal_id(id, name, value, stage_id)
        `)
        .eq('user_id', userId)
        .eq('type', 'proposal')
      
      // Build OR query for multiple search criteria
      const searchConditions: string[] = []
      
      // Search by contact_id if available
      if (contact.id) {
        searchConditions.push(`contact_id.eq.${contact.id}`)
      }
      
      // Search by client_name matching contact name
      searchConditions.push(`client_name.ilike.%${contactName}%`)
      
      // Search by contact_identifier (email) if available
      if (contact.email) {
        searchConditions.push(`contact_identifier.ilike.%${contact.email}%`)
      }
      
      // Apply OR conditions
      if (searchConditions.length > 0) {
        proposalsQuery = proposalsQuery.or(searchConditions.join(','))
      }
      
      const { data: proposals, error: proposalsError } = await proposalsQuery
        .order('date', { ascending: false })
        .limit(10)
      
      if (!proposalsError && proposals && proposals.length > 0) {
        // Found proposals - return proposal selection response
        return {
          type: 'proposal_selection',
          summary: `I found ${proposals.length} proposal${proposals.length > 1 ? 's' : ''} for ${contact.full_name || `${contact.first_name} ${contact.last_name}`.trim()}. Please select the one to follow up on:`,
          data: {
            contact: {
              id: contact.id,
              name: contact.full_name || `${contact.first_name} ${contact.last_name}`.trim(),
              email: contact.email,
              company: contact.companies?.name || null,
              companyId: contact.company_id || null
            },
            proposals: proposals.map((proposal: any) => ({
              id: proposal.id,
              clientName: proposal.client_name,
              details: proposal.details,
              amount: proposal.amount,
              date: proposal.date,
              dealId: proposal.deal_id,
              dealName: proposal.deals?.name || null,
              dealValue: proposal.deals?.value || null
            })),
            taskTitle,
            taskType,
            priority,
            dueDate: dueDate || null
          },
          actions: [],
          metadata: {
            timeGenerated: new Date().toISOString(),
            dataSource: ['proposals_search'],
            proposalCount: proposals.length
          }
        }
      }
    }
    
    // No proposals found or proposal not mentioned - return task creation response
    return {
      type: 'task_creation',
      summary: `I found ${contact.full_name || `${contact.first_name} ${contact.last_name}`.trim()}. Ready to create the task.`,
      data: {
        title: taskTitle,
        description: `Task: ${taskTitle}`,
        dueDate: dueDate || null,
        priority,
        taskType,
        contact: {
          id: contact.id,
          name: contact.full_name || `${contact.first_name} ${contact.last_name}`.trim(),
          email: contact.email,
          company: contact.companies?.name || null,
          companyId: contact.company_id || null
        },
        requiresContactSelection: false
      },
      actions: [
        {
          id: 'create-task',
          label: 'Create Task',
          type: 'primary',
          callback: 'create_task',
          params: {
            title: taskTitle,
            dueDate: dueDate || null,
            contactId: contact.id,
            priority,
            taskType
          }
        }
      ],
      metadata: {
        timeGenerated: new Date().toISOString(),
        dataSource: ['contacts_search'],
        matchCount: 1
      }
    }
  } catch (error) {
    console.error('Error in structureTaskCreationResponse:', error)
    // Return contact selection response on error
    return {
      type: 'contact_selection',
      summary: `I'd like to help you create a task. Please select the contact:`,
      data: {
        activityType: 'task',
        activityDate: new Date().toISOString(),
        requiresContactSelection: true,
        prefilledName: '',
        prefilledEmail: '',
        taskTitle: 'Follow-up task',
        taskType: 'follow_up',
        priority: 'medium'
      },
      actions: [],
      metadata: {
        timeGenerated: new Date().toISOString(),
        dataSource: ['error_fallback']
      }
    }
  }
}

/**
 * Structure contact response with all connections
 */
async function structureContactResponse(
  client: any,
  userId: string,
  aiContent: string,
  contactEmail: string | null,
  userMessage: string
): Promise<StructuredResponse | null> {
  try {
    // Find contact by email or name
    let contact: ContactData | null = null
    
    if (contactEmail) {
      const { data: contactByEmail } = await client
        .from('contacts')
        .select(`
          id,
          first_name,
          last_name,
          full_name,
          email,
          phone,
          title,
          company_id,
          companies:company_id(id, name)
        `)
        .eq('email', contactEmail)
        .eq('user_id', userId)
        .maybeSingle()
      
      contact = contactByEmail as ContactData | null
    }
    
    // If no contact found by email, try searching by name
    if (!contact) {
      const nameMatch = userMessage.match(/(?:about|info on|tell me about|show me|find|lookup)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i)
      if (nameMatch) {
        const nameParts = nameMatch[1].split(' ')
        const firstName = nameParts[0]
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : null
        
        let query = client
          .from('contacts')
          .select(`
            id,
            first_name,
            last_name,
            full_name,
            email,
            phone,
            title,
            company_id,
            companies:company_id(id, name)
          `)
          .eq('first_name', firstName)
          .eq('user_id', userId)
        
        if (lastName) {
          query = query.eq('last_name', lastName)
        }
        
        const { data: contactByName } = await query.maybeSingle()
        contact = contactByName as ContactData | null
      }
    }
    
    if (!contact) {
      return null // Let AI handle it as text response
    }
    
    const contactId = contact.id
    
    // Fetch all related data in parallel
    const [
      emailsResult,
      dealsResult,
      activitiesResult,
      meetingsResult,
      tasksResult
    ] = await Promise.allSettled([
      // Fetch recent emails - try Gmail integration first, fallback to activities
      (async () => {
        // Check if Gmail integration exists
        const { data: gmailIntegration } = await client
          .from('user_integrations')
          .select('id, access_token')
          .eq('user_id', userId)
          .eq('service', 'gmail')
          .eq('status', 'active')
          .maybeSingle()
        
        if (gmailIntegration && contact?.email) {
          try {
            // Fetch emails from Gmail API
            const gmailResponse = await fetch(
              `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=from:${contact?.email || ''} OR to:${contact?.email || ''}&maxResults=10`,
              {
                headers: {
                  'Authorization': `Bearer ${gmailIntegration.access_token}`
                }
              }
            )
            
            if (gmailResponse.ok) {
              const gmailData = await gmailResponse.json()
              const messages = gmailData.messages || []
              
              // Fetch full message details for each
              const emailDetails = await Promise.all(
                messages.slice(0, 5).map(async (msg: any) => {
                  try {
                    const msgRes = await fetch(
                      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`,
                      {
                        headers: {
                          'Authorization': `Bearer ${gmailIntegration.access_token}`
                        }
                      }
                    )
                    if (!msgRes.ok) return null
                    const msgData = await msgRes.json()
                    
                    const headers = msgData.payload?.headers || []
                    const fromHeader = headers.find((h: any) => h.name === 'From')
                    const subjectHeader = headers.find((h: any) => h.name === 'Subject')
                    const dateHeader = headers.find((h: any) => h.name === 'Date')
                    
                    const snippet = msgData.snippet || ''
                    const direction = fromHeader?.value?.toLowerCase().includes(contact?.email?.toLowerCase() || '') ? 'sent' : 'received'
                    
                    return {
                      id: msg.id,
                      type: 'email',
                      notes: subjectHeader?.value || 'No subject',
                      date: dateHeader?.value ? new Date(dateHeader.value).toISOString() : new Date().toISOString(),
                      created_at: dateHeader?.value ? new Date(dateHeader.value).toISOString() : new Date().toISOString(),
                      snippet: snippet.substring(0, 200),
                      subject: subjectHeader?.value || 'No subject',
                      direction
                    }
                  } catch {
                    return null
                  }
                })
              )
              
              return { data: emailDetails.filter(Boolean), error: null }
            }
          } catch (error) {
            // Fallback to activities
          }
        }
        
        // Fallback: use activities that are emails
        return await client
          .from('activities')
          .select('id, type, details, date, created_at')
          .eq('contact_id', contactId)
          .eq('type', 'email')
          .order('date', { ascending: false })
          .limit(10)
      })(),
      
      // Fetch deals
      client
        .from('deals')
        .select(`
          id,
          name,
          value,
          stage_id,
          probability,
          expected_close_date,
          deal_stages:stage_id(name)
        `)
        .or(`primary_contact_id.eq.${contactId},contact_email.eq.${contact.email}`)
        .eq('owner_id', userId)
        .order('created_at', { ascending: false }),
      
      // Fetch activities
      client
        .from('activities')
        .select('id, type, details, date')
        .eq('contact_id', contactId)
        .order('date', { ascending: false })
        .limit(10),
      
      // Fetch meetings
      client
        .from('meetings')
        .select(`
          id,
          title,
          summary,
          meeting_start,
          transcript_text
        `)
        .or(`primary_contact_id.eq.${contactId},company_id.eq.${contact.company_id}`)
        .eq('owner_user_id', userId)
        .order('meeting_start', { ascending: false })
        .limit(10),
      
      // Fetch tasks
      client
        .from('tasks')
        .select('id, title, status, priority, due_date')
        .eq('contact_id', contactId)
        .in('status', ['todo', 'in_progress'])
        .order('due_date', { ascending: true })
        .limit(10)
    ])
    
    const emails = emailsResult.status === 'fulfilled' ? emailsResult.value.data || [] : []
    const deals = dealsResult.status === 'fulfilled' ? dealsResult.value.data || [] : []
    const activities = activitiesResult.status === 'fulfilled' ? activitiesResult.value.data || [] : []
    const meetings = meetingsResult.status === 'fulfilled' ? meetingsResult.value.data || [] : []
    const tasks = tasksResult.status === 'fulfilled' ? tasksResult.value.data || [] : []
    
    // Format emails
    const emailSummaries = emails.slice(0, 5).map((email: any) => ({
      id: email.id,
      subject: email.subject || email.notes?.substring(0, 50) || 'Email',
      summary: email.snippet || email.notes?.substring(0, 200) || '',
      date: email.date || email.created_at,
      direction: email.direction || 'sent',
      snippet: email.snippet || email.notes?.substring(0, 100)
    }))
    
    // Format deals
    const formattedDeals = deals.map((deal: any) => {
      // Calculate health score (simplified)
      const daysSinceUpdate = deal.updated_at 
        ? Math.floor((Date.now() - new Date(deal.updated_at).getTime()) / (1000 * 60 * 60 * 24))
        : 30
      const healthScore = Math.max(0, 100 - (daysSinceUpdate * 2) - (100 - deal.probability))
      
      return {
        id: deal.id,
        name: deal.name,
        value: deal.value || 0,
        stage: deal.deal_stages?.name || 'Unknown',
        probability: deal.probability || 0,
        closeDate: deal.expected_close_date,
        healthScore: Math.round(healthScore)
      }
    })
    
    // Format activities
    const formattedActivities = activities.slice(0, 10).map((activity: any) => ({
      id: activity.id,
      type: activity.type,
      notes: activity.details, // Use 'details' field from activities table
      date: activity.date
    }))
    
    // Format meetings
    const formattedMeetings = meetings.map((meeting: any) => ({
      id: meeting.id,
      title: meeting.title || 'Meeting',
      date: meeting.meeting_start,
      summary: meeting.summary,
      hasTranscript: !!meeting.transcript_text
    }))
    
    // Format tasks
    const formattedTasks = tasks.map((task: any) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      priority: task.priority,
      dueDate: task.due_date
    }))
    
    // Calculate metrics
    const activeDeals = formattedDeals.filter((d: any) => d.probability > 0 && d.probability < 100)
    const totalDealValue = formattedDeals.reduce((sum: number, d: any) => sum + (d.value || 0), 0)
    const upcomingMeetings = formattedMeetings.filter((m: any) => {
      const meetingDate = new Date(m.date)
      return meetingDate >= new Date()
    })
    
    const metrics = {
      totalDeals: formattedDeals.length,
      totalDealValue,
      activeDeals: activeDeals.length,
      recentEmails: emailSummaries.length,
      upcomingMeetings: upcomingMeetings.length,
      pendingTasks: formattedTasks.length
    }
    
    // Generate summary
    const summary = `Here's everything I found about ${contact.full_name || contact.first_name || contact.email}:`
    
    // Generate actions
    const actions: Array<{
      id: string
      label: string
      type: string
      icon: string
      callback: string
      params?: any
    }> = []
    if (formattedDeals.length > 0) {
      actions.push({
        id: 'view-deals',
        label: `View ${formattedDeals.length} Deal${formattedDeals.length > 1 ? 's' : ''}`,
        type: 'primary' as const,
        icon: 'briefcase',
        callback: `/crm/contacts/${contactId}`
      })
    }
    if (formattedTasks.length > 0) {
      actions.push({
        id: 'view-tasks',
        label: `View ${formattedTasks.length} Task${formattedTasks.length > 1 ? 's' : ''}`,
        type: 'secondary' as const,
        icon: 'check-circle',
        callback: `/crm/tasks?contact=${contactId}`
      })
    }
    
    return {
      type: 'contact',
      summary,
      data: {
        contact: {
          id: contact.id,
          name: contact.full_name || `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || contact.email,
          email: contact.email,
          phone: contact.phone,
          title: contact.title,
          company: contact.companies?.name,
          companyId: contact.company_id
        },
        emails: emailSummaries,
        deals: formattedDeals,
        activities: formattedActivities,
        meetings: formattedMeetings,
        tasks: formattedTasks,
        metrics
      },
      actions,
      metadata: {
        timeGenerated: new Date().toISOString(),
        dataSource: ['contacts', 'deals', 'activities', 'meetings', 'tasks'],
        confidence: 90
      }
    }
  } catch (error) {
    return null
  }
}

/**
 * Structure pipeline response from deals data
 */
async function structurePipelineResponse(
  client: any,
  userId: string,
  aiContent: string,
  userMessage?: string
): Promise<any> {
  try {
    // Fetch all active deals
    const { data: deals, error } = await client
      .from('deals')
      .select(`
        id,
        name,
        value,
        stage_id,
        status,
        expected_close_date,
        probability,
        created_at,
        updated_at,
        deal_stages(name)
      `)
      .eq('owner_id', userId)  // Correct column name is owner_id
      .eq('status', 'active')
      .order('value', { ascending: false })

    if (error) {
      return null
    }
    
    if (!deals || deals.length === 0) {
      return null
    }
    // Calculate health scores and categorize deals
    const now = new Date()
    const criticalDeals: any[] = []
    const highPriorityDeals: any[] = []
    const healthyDeals: any[] = []
    const dataIssues: any[] = []

    let totalValue = 0
    let dealsAtRisk = 0
    let closingThisWeek = 0
    let totalHealthScore = 0

    for (const deal of deals) {
      totalValue += deal.value || 0
      
      // Calculate health score (0-100)
      const daysSinceUpdate = Math.floor((now.getTime() - new Date(deal.updated_at).getTime()) / (1000 * 60 * 60 * 24))
      const daysUntilClose = deal.expected_close_date 
        ? Math.floor((new Date(deal.expected_close_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : null
      
      // Health score factors
      const recencyScore = Math.max(0, 100 - daysSinceUpdate * 5) // Lose 5 points per day
      const probabilityScore = deal.probability || 0
      const valueScore = Math.min(100, (deal.value || 0) / 1000) // 1 point per $1k, max 100
      
      const healthScore = Math.round((recencyScore * 0.4 + probabilityScore * 0.4 + valueScore * 0.2))
      totalHealthScore += healthScore

      // Check for data issues
      if (!deal.expected_close_date) {
        dataIssues.push({
          type: 'missing_close_date',
          dealId: deal.id,
          dealName: deal.name,
          description: 'No close date set'
        })
      }
      
      if (deal.probability < 30) {
        dataIssues.push({
          type: 'low_probability',
          dealId: deal.id,
          dealName: deal.name,
          description: `Low probability (${deal.probability}%)`
        })
      }
      
      if (daysSinceUpdate > 30) {
        dataIssues.push({
          type: 'stale_deal',
          dealId: deal.id,
          dealName: deal.name,
          description: `No updates in ${daysSinceUpdate} days`
        })
      }

      // Determine urgency
      let urgency: 'critical' | 'high' | 'medium' | 'low' = 'medium'
      let reason = ''

      // Critical: High value, closing soon, or low health
      if (daysUntilClose !== null && daysUntilClose <= 7 && daysUntilClose >= 0) {
        closingThisWeek++
        if (deal.value >= 10000 || healthScore < 50) {
          urgency = 'critical'
          reason = `Closing in ${daysUntilClose} days with ${healthScore} health score`
          criticalDeals.push({
            id: deal.id,
            name: deal.name,
            value: deal.value,
            stage: deal.deal_stages?.name || 'Unknown',
            probability: deal.probability || 0,
            closeDate: deal.expected_close_date,
            daysUntilClose,
            healthScore,
            urgency,
            reason
          })
          dealsAtRisk++
          continue
        }
      }

      // High priority: High value, no close date, or been in stage too long
      if (
        deal.value >= 10000 ||
        (!deal.expected_close_date && daysSinceUpdate > 14) ||
        healthScore < 60
      ) {
        urgency = 'high'
        if (!deal.expected_close_date) {
          reason = `No close date set, been in ${deal.deal_stages?.name || 'current'} stage ${daysSinceUpdate} days`
        } else if (daysSinceUpdate > 14) {
          reason = `No recent activity (${daysSinceUpdate} days since update)`
        } else {
          reason = `Health score of ${healthScore} needs attention`
        }
        highPriorityDeals.push({
          id: deal.id,
          name: deal.name,
          value: deal.value,
          stage: deal.deal_stages?.name || 'Unknown',
          probability: deal.probability || 0,
          closeDate: deal.expected_close_date,
          daysUntilClose,
          healthScore,
          urgency,
          reason
        })
        if (healthScore < 60) dealsAtRisk++
        continue
      }

      // Healthy deals
      healthyDeals.push({
        id: deal.id,
        name: deal.name,
        value: deal.value,
        stage: deal.deal_stages?.name || 'Unknown',
        probability: deal.probability || 0,
        closeDate: deal.expected_close_date,
        daysUntilClose,
        healthScore,
        urgency: 'low',
        reason: 'On track'
      })
    }

    const avgHealthScore = deals.length > 0 ? Math.round(totalHealthScore / deals.length) : 0

    // Generate summary
    const summary = `I've analyzed your pipeline. Here's what needs attention:`

    // Generate actions
    const actions: Array<{
      id: string
      label: string
      type: string
      icon: string
      callback: string
      params?: any
    }> = []
    if (criticalDeals.length > 0) {
      actions.push({
        id: 'focus-critical',
        label: `Focus on ${criticalDeals[0].name}`,
        type: 'primary',
        icon: 'target',
        callback: '/api/copilot/actions/focus-deal',
        params: { dealId: criticalDeals[0].id }
      })
    }
    
    const dealsWithoutCloseDate = deals.filter(d => !d.expected_close_date).length
    if (dealsWithoutCloseDate > 0) {
      actions.push({
        id: 'set-close-dates',
        label: `Set Close Dates (${dealsWithoutCloseDate} deals)`,
        type: 'secondary',
        icon: 'calendar',
        callback: '/api/copilot/actions/bulk-update-dates'
      })
    }

    // Check if user asked for a specific number - if not, show stats first
    // Extract number from user message (e.g., "show me 5 deals" -> 5)
    let requestedNumber: number | null = null;
    if (userMessage) {
      const numberPatterns = [
        /(?:show|list|get|find|display)\s+(?:me\s+)?(\d+)\s+(?:deal|deals)/i,
        /(\d+)\s+(?:deal|deals|high\s+priority)/i,
        /(?:first|top)\s+(\d+)/i
      ];
      
      for (const pattern of numberPatterns) {
        const match = userMessage.match(pattern);
        if (match && match[1]) {
          const num = parseInt(match[1], 10);
          if (num > 0 && num <= 100) {
            requestedNumber = num;
            break;
          }
        }
      }
    }
    
    // Show stats first if no specific number requested and there are many deals
    const showStatsFirst = !requestedNumber && (criticalDeals.length + highPriorityDeals.length) > 10;

    return {
      type: 'pipeline',
      summary,
      data: {
        criticalDeals: criticalDeals.slice(0, 10), // Limit to top 10
        highPriorityDeals: highPriorityDeals.slice(0, 10),
        healthyDeals: healthyDeals.slice(0, 5), // Show a few healthy ones
        dataIssues: dataIssues.slice(0, 10),
        metrics: {
          totalValue,
          totalDeals: deals.length,
          avgHealthScore,
          dealsAtRisk,
          closingThisWeek
        },
        showStatsFirst
      },
      actions,
      metadata: {
        timeGenerated: new Date().toISOString(),
        dataSource: ['deals', 'deal_stages'],
        confidence: 85
      }
    }
  } catch (error) {
    return null
  }
}

/**
 * Extract number from user message (e.g., "show me 3 tasks" -> 3)
 */
function extractTaskLimit(message: string): number | null {
  const numberPatterns = [
    /(?:show|list|get|find|display)\s+(?:me\s+)?(\d+)\s+(?:task|todo)/i,
    /(\d+)\s+(?:task|todo|high\s+priority\s+task)/i,
    /(?:first|top)\s+(\d+)/i
  ];
  
  for (const pattern of numberPatterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (num > 0 && num <= 100) { // Reasonable limit
        return num;
      }
    }
  }
  
  return null;
}

/**
 * Structure task response from tasks data
 */
async function structureTaskResponse(
  client: any,
  userId: string,
  aiContent: string,
  userMessage?: string
): Promise<StructuredResponse | null> {
  // Store original message for summary enhancement
  const originalMessage = userMessage
  try {
    // Extract requested limit from user message
    const requestedLimit = userMessage ? extractTaskLimit(userMessage) : null;
    const limitPerCategory = requestedLimit || 5; // Default to 5 if no specific number requested
    // Fetch tasks assigned to or created by user
    const { data: tasks, error } = await client
      .from('tasks')
      .select(`
        id,
        title,
        description,
        status,
        priority,
        due_date,
        task_type,
        created_at,
        updated_at,
        contact_id,
        deal_id,
        company_id,
        contacts:contact_id(id, first_name, last_name),
        deals:deal_id(id, name),
        companies:company_id(id, name)
      `)
      .or(`assigned_to.eq.${userId},created_by.eq.${userId}`)
      .order('priority', { ascending: false })
      .order('due_date', { ascending: true })

    if (error) {
      return null
    }
    
    if (!tasks || tasks.length === 0) {
      return null
    }

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    
    const urgentTasks: any[] = []
    const highPriorityTasks: any[] = []
    const dueToday: any[] = []
    const overdue: any[] = []
    const upcoming: any[] = []
    const completed: any[] = []

    let totalTasks = tasks.length
    let urgentCount = 0
    let highPriorityCount = 0
    let dueTodayCount = 0
    let overdueCount = 0
    let completedToday = 0

    for (const task of tasks) {
      // Skip completed tasks unless specifically requested
      if (task.status === 'completed') {
        const completedDate = new Date(task.updated_at)
        if (completedDate >= today) {
          completedToday++
          completed.push({
            id: task.id,
            title: task.title,
            description: task.description,
            status: task.status,
            priority: task.priority,
            dueDate: task.due_date,
            isOverdue: false,
            taskType: task.task_type || 'general',
            contactId: task.contact_id,
            contactName: task.contacts ? `${task.contacts.first_name || ''} ${task.contacts.last_name || ''}`.trim() : undefined,
            dealId: task.deal_id,
            dealName: task.deals?.name,
            companyId: task.company_id,
            companyName: task.companies?.name,
            createdAt: task.created_at,
            updatedAt: task.updated_at
          })
        }
        continue
      }

      // Calculate days until due
      let daysUntilDue: number | undefined
      let isOverdue = false
      if (task.due_date) {
        const dueDate = new Date(task.due_date)
        const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate())
        daysUntilDue = Math.floor((dueDateOnly.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        isOverdue = daysUntilDue < 0
      }

      const taskItem = {
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        dueDate: task.due_date,
        daysUntilDue,
        isOverdue,
        taskType: task.task_type || 'general',
        contactId: task.contact_id,
        contactName: task.contacts ? `${task.contacts.first_name || ''} ${task.contacts.last_name || ''}`.trim() : undefined,
        dealId: task.deal_id,
        dealName: task.deals?.name,
        companyId: task.company_id,
        companyName: task.companies?.name,
        createdAt: task.created_at,
        updatedAt: task.updated_at
      }

      // Count metrics first
      if (task.priority === 'urgent') urgentCount++
      if (task.priority === 'high') highPriorityCount++

      // Categorize tasks (overdue takes precedence)
      if (isOverdue) {
        overdue.push(taskItem)
        overdueCount++
      } else if (daysUntilDue === 0) {
        dueToday.push(taskItem)
        dueTodayCount++
      } else if (task.priority === 'urgent') {
        urgentTasks.push(taskItem)
      } else if (task.priority === 'high') {
        highPriorityTasks.push(taskItem)
      } else if (daysUntilDue !== undefined && daysUntilDue > 0 && daysUntilDue <= 7) {
        upcoming.push(taskItem)
      }
    }

    // Calculate completion rate
    const activeTasks = tasks.filter(t => t.status !== 'completed').length
    const completionRate = totalTasks > 0 ? Math.round((completedToday / totalTasks) * 100) : 0

    // Generate summary - for general prioritize questions, mention both tasks and pipeline
    let summary = `I've analyzed your tasks. Here's what needs your attention:`
    
    // If this is a general "prioritize" question, enhance the summary
    if (originalMessage && (
      originalMessage.toLowerCase().includes('what should i prioritize') ||
      originalMessage.toLowerCase().includes('prioritize today')
    )) {
      summary = `I've analyzed your tasks for today. Here's what needs your immediate attention. You may also want to check your pipeline for deals that need follow-up.`
    }

    // Generate actions
    const actions: Array<{
      id: string
      label: string
      type: string
      icon: string
      callback: string
      params?: any
    }> = []
    if (overdue.length > 0) {
      actions.push({
        id: 'focus-overdue',
        label: `Focus on ${overdue.length} Overdue Task${overdue.length > 1 ? 's' : ''}`,
        type: 'primary',
        icon: 'alert-circle',
        callback: '/crm/tasks?filter=overdue'
      })
    }
    
    if (dueToday.length > 0) {
      actions.push({
        id: 'view-due-today',
        label: `View ${dueToday.length} Due Today`,
        type: 'secondary',
        icon: 'calendar',
        callback: '/crm/tasks?filter=due_today'
      })
    }

    if (urgentTasks.length > 0) {
      actions.push({
        id: 'view-urgent',
        label: `View ${urgentTasks.length} Urgent Task${urgentTasks.length > 1 ? 's' : ''}`,
        type: 'secondary',
        icon: 'flag',
        callback: '/crm/tasks?filter=urgent'
      })
    }

    // Use the limit extracted from user message or default
    // If user asked for a specific number, prioritize showing that many total across all categories
    // Otherwise, show up to limitPerCategory per category
    
    let urgentLimit = limitPerCategory;
    let highPriorityLimit = limitPerCategory;
    let dueTodayLimit = limitPerCategory;
    let overdueLimit = limitPerCategory;
    let upcomingLimit = limitPerCategory;
    
    // If user specified a number, distribute it intelligently
    if (requestedLimit) {
      // Prioritize: overdue > due today > urgent > high priority > upcoming
      const totalRequested = requestedLimit;
      overdueLimit = Math.min(overdue.length, Math.max(1, Math.ceil(totalRequested * 0.3)));
      dueTodayLimit = Math.min(dueToday.length, Math.max(1, Math.ceil(totalRequested * 0.25)));
      urgentLimit = Math.min(urgentTasks.length, Math.max(1, Math.ceil(totalRequested * 0.2)));
      highPriorityLimit = Math.min(highPriorityTasks.length, Math.max(1, Math.ceil(totalRequested * 0.15)));
      const remaining = totalRequested - overdueLimit - dueTodayLimit - urgentLimit - highPriorityLimit;
      upcomingLimit = Math.max(0, Math.min(upcoming.length, remaining));
      
      // Ensure we don't exceed the requested total
      const currentTotal = overdueLimit + dueTodayLimit + urgentLimit + highPriorityLimit + upcomingLimit;
      if (currentTotal > totalRequested) {
        // Reduce from least priority category
        const excess = currentTotal - totalRequested;
        upcomingLimit = Math.max(0, upcomingLimit - excess);
      }
    }
    
    // Show stats first if no specific number requested and there are many tasks
    const showStatsFirst = !requestedLimit && (urgentTasks.length + highPriorityTasks.length + overdue.length + dueToday.length) > 10;

    return {
      type: 'task',
      summary,
      data: {
        urgentTasks: urgentTasks.slice(0, urgentLimit),
        highPriorityTasks: highPriorityTasks.slice(0, highPriorityLimit),
        dueToday: dueToday.slice(0, dueTodayLimit),
        overdue: overdue.slice(0, overdueLimit),
        upcoming: upcoming.slice(0, upcomingLimit),
        completed: completed.slice(0, 3), // Show fewer completed
        showStatsFirst,
        metrics: {
          totalTasks,
          urgentCount,
          highPriorityCount,
          dueTodayCount,
          overdueCount,
          completedToday,
          completionRate
        }
      },
      actions,
      metadata: {
        timeGenerated: new Date().toISOString(),
        dataSource: ['tasks', 'contacts', 'deals', 'companies'],
        confidence: 90
      }
    }
  } catch (error) {
    return null
  }
}

/**
 * Structure roadmap response from roadmap creation
 */
async function structureRoadmapResponse(
  client: any,
  userId: string,
  aiContent: string,
  userMessage: string
): Promise<any | null> {
  try {
    // Try to extract roadmap item from AI content (tool result may be in the content)
    // Look for JSON in the content that matches roadmap item structure
    let roadmapItem: TaskData | null = null
    
    // Try to parse roadmap item from AI content
    try {
      // Look for JSON objects in the content
      const jsonMatch = aiContent.match(/\{[\s\S]*"roadmapItem"[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        if (parsed.roadmapItem) {
          roadmapItem = parsed.roadmapItem
        } else if (parsed.success && parsed.roadmapItem) {
          roadmapItem = parsed.roadmapItem
        }
      }
    } catch (e) {
      // JSON parsing failed, continue to fetch from DB
    }
    
    // If not found in content, fetch the most recent roadmap item created by user
    if (!roadmapItem) {
      const { data: recentItems, error } = await client
        .from('roadmap_suggestions')
        .select('*')
        .eq('submitted_by', userId)
        .order('created_at', { ascending: false })
        .limit(1)
      
      if (error || !recentItems || recentItems.length === 0) {
        return null
      }
      
      roadmapItem = recentItems[0] as TaskData
    }
    
    if (!roadmapItem) {
      return null
    }
    
    // Extract title from user message if available
    const titleMatch = userMessage.match(/roadmap item for:\s*(.+)/i) || 
                      userMessage.match(/add.*roadmap.*for:\s*(.+)/i) ||
                      userMessage.match(/create.*roadmap.*for:\s*(.+)/i)
    
    const summary = titleMatch 
      ? `I'll create a roadmap item for: ${titleMatch[1].trim()}`
      : `I've successfully created a roadmap item.`
    
    return {
      type: 'roadmap',
      summary: summary || 'Roadmap item created successfully',
      data: {
        roadmapItem: {
          id: roadmapItem.id,
          ticket_id: roadmapItem.ticket_id || null,
          title: roadmapItem.title,
          description: roadmapItem.description || null,
          type: roadmapItem.type || 'feature',
          priority: roadmapItem.priority || 'medium',
          status: roadmapItem.status || 'submitted',
          submitted_by: roadmapItem.submitted_by,
          created_at: roadmapItem.created_at,
          updated_at: roadmapItem.updated_at
        },
        success: true,
        message: `Roadmap item "${roadmapItem.title}" created successfully`
      },
      actions: [
        {
          id: 'view-roadmap',
          label: 'View Roadmap',
          type: 'secondary' as const,
          icon: 'file-text',
          callback: '/admin/roadmap',
          params: {}
        }
      ],
      metadata: {
        timeGenerated: new Date().toISOString(),
        dataSource: ['roadmap_suggestions'],
        confidence: 95
      }
    }
  } catch (error) {
    return null
  }
}

/**
 * Structure sales coach response with performance analysis
 */
async function structureSalesCoachResponse(
  client: any,
  userId: string,
  aiContent: string,
  userMessage: string,
  requestingUserId?: string
): Promise<StructuredResponse | null> {
  try {
    console.log('[SALES-COACH] Starting structureSalesCoachResponse:', {
      userId,
      requestingUserId,
      userMessage: userMessage.substring(0, 100),
      isAdminQuery: requestingUserId && requestingUserId !== userId
    })
    
    // Check if requesting user is admin (if different from target user)
    const isAdminQuery = requestingUserId && requestingUserId !== userId
    let targetUserName = 'You'
    
    if (isAdminQuery) {
      console.log('[SALES-COACH] Admin query detected, verifying permissions...')
      // Verify requesting user is admin
      const { data: requestingUser } = await client
        .from('profiles')
        .select('is_admin')
        .eq('id', requestingUserId)
        .single()
      
      if (!requestingUser?.is_admin) {
        console.log('[SALES-COACH] ❌ Permission denied - requesting user is not admin')
        return null // Permission denied
      }
      
      console.log('[SALES-COACH] ✅ Admin permission verified')
      
      // Get target user's name for display
      const { data: targetUser } = await client
        .from('profiles')
        .select('first_name, last_name, email')
        .eq('id', userId)
        .single()
      
      if (targetUser) {
        targetUserName = targetUser.first_name && targetUser.last_name
          ? `${targetUser.first_name} ${targetUser.last_name}`
          : targetUser.email || 'User'
        console.log('[SALES-COACH] Target user name:', targetUserName)
      } else {
        console.log('[SALES-COACH] ⚠️ Target user not found:', userId)
      }
    }
    
    const now = new Date()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()
    const currentDay = now.getDate()
    
    // Previous month (same day)
    const previousMonth = currentMonth === 0 ? 11 : currentMonth - 1
    const previousYear = currentMonth === 0 ? currentYear - 1 : currentYear
    
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                       'July', 'August', 'September', 'October', 'November', 'December']
    
    // Calculate date ranges
    const currentStart = new Date(currentYear, currentMonth, 1)
    const currentEnd = new Date(currentYear, currentMonth, currentDay, 23, 59, 59)
    const previousStart = new Date(previousYear, previousMonth, 1)
    const previousEnd = new Date(previousYear, previousMonth, currentDay, 23, 59, 59)
    
    console.log('[SALES-COACH] Date ranges calculated:', {
      current: { start: currentStart.toISOString(), end: currentEnd.toISOString() },
      previous: { start: previousStart.toISOString(), end: previousEnd.toISOString() },
      targetUserId: userId
    })
    
    // Fetch deals for current month
    console.log('[SALES-COACH] Fetching current month deals for user:', userId)
    const { data: currentDeals, error: currentDealsError } = await client
      .from('deals')
      .select('id, name, value, stage, close_date, created_at')
      .eq('user_id', userId)
      .gte('created_at', currentStart.toISOString())
      .lte('created_at', currentEnd.toISOString())
      .order('close_date', { ascending: false })
    
    if (currentDealsError) {
      console.error('[SALES-COACH] ❌ Error fetching current deals:', currentDealsError)
    } else {
      console.log('[SALES-COACH] ✅ Current month deals fetched:', currentDeals?.length || 0)
    }
    
    // Fetch deals for previous month
    console.log('[SALES-COACH] Fetching previous month deals for user:', userId)
    const { data: previousDeals, error: previousDealsError } = await client
      .from('deals')
      .select('id, name, value, stage, close_date, created_at')
      .eq('user_id', userId)
      .gte('created_at', previousStart.toISOString())
      .lte('created_at', previousEnd.toISOString())
      .order('close_date', { ascending: false })
    
    if (previousDealsError) {
      console.error('[SALES-COACH] ❌ Error fetching previous deals:', previousDealsError)
    } else {
      console.log('[SALES-COACH] ✅ Previous month deals fetched:', previousDeals?.length || 0)
    }
    
    // Fetch activities for current month
    console.log('[SALES-COACH] Fetching current month activities for user:', userId)
    const { data: currentActivities, error: currentActivitiesError } = await client
      .from('activities')
      .select('id, type, created_at')
      .eq('user_id', userId)
      .gte('created_at', currentStart.toISOString())
      .lte('created_at', currentEnd.toISOString())
    
    if (currentActivitiesError) {
      console.error('[SALES-COACH] ❌ Error fetching current activities:', currentActivitiesError)
    } else {
      console.log('[SALES-COACH] ✅ Current month activities fetched:', currentActivities?.length || 0)
    }
    
    // Fetch activities for previous month
    console.log('[SALES-COACH] Fetching previous month activities for user:', userId)
    const { data: previousActivities, error: previousActivitiesError } = await client
      .from('activities')
      .select('id, type, created_at')
      .eq('user_id', userId)
      .gte('created_at', previousStart.toISOString())
      .lte('created_at', previousEnd.toISOString())
    
    if (previousActivitiesError) {
      console.error('[SALES-COACH] ❌ Error fetching previous activities:', previousActivitiesError)
    } else {
      console.log('[SALES-COACH] ✅ Previous month activities fetched:', previousActivities?.length || 0)
    }
    
    // Fetch meetings for current month
    console.log('[SALES-COACH] Fetching current month meetings for user:', userId)
    const { data: currentMeetings, error: currentMeetingsError } = await client
      .from('meetings')
      .select('id, created_at')
      .eq('owner_user_id', userId)
      .gte('created_at', currentStart.toISOString())
      .lte('created_at', currentEnd.toISOString())
    
    if (currentMeetingsError) {
      console.error('[SALES-COACH] ❌ Error fetching current meetings:', currentMeetingsError)
    } else {
      console.log('[SALES-COACH] ✅ Current month meetings fetched:', currentMeetings?.length || 0)
    }
    
    // Fetch meetings for previous month
    console.log('[SALES-COACH] Fetching previous month meetings for user:', userId)
    const { data: previousMeetings, error: previousMeetingsError } = await client
      .from('meetings')
      .select('id, created_at')
      .eq('owner_user_id', userId)
      .gte('created_at', previousStart.toISOString())
      .lte('created_at', previousEnd.toISOString())
    
    if (previousMeetingsError) {
      console.error('[SALES-COACH] ❌ Error fetching previous meetings:', previousMeetingsError)
    } else {
      console.log('[SALES-COACH] ✅ Previous month meetings fetched:', previousMeetings?.length || 0)
    }
    
    // Calculate metrics
    const currentClosed = (currentDeals || []).filter(d => d.stage === 'Signed' && d.close_date)
    const previousClosed = (previousDeals || []).filter(d => d.stage === 'Signed' && d.close_date)
    
    const currentRevenue = currentClosed.reduce((sum, d) => sum + (d.value || 0), 0)
    const previousRevenue = previousClosed.reduce((sum, d) => sum + (d.value || 0), 0)
    
    const currentMeetingsCount = (currentMeetings || []).length
    const previousMeetingsCount = (previousMeetings || []).length
    
    const currentOutbound = (currentActivities || []).filter(a => a.type === 'outbound').length
    const previousOutbound = (previousActivities || []).filter(a => a.type === 'outbound').length
    
    const currentTotalActivities = (currentActivities || []).length
    const previousTotalActivities = (previousActivities || []).length
    
    const currentAvgDealValue = currentClosed.length > 0 ? currentRevenue / currentClosed.length : 0
    const previousAvgDealValue = previousClosed.length > 0 ? previousRevenue / previousClosed.length : 0
    
    // Get active pipeline value
    const { data: activeDeals } = await client
      .from('deals')
      .select('id, name, value, stage')
      .eq('user_id', userId)
      .in('stage', ['SQL', 'Opportunity', 'Verbal'])
    
    const pipelineValue = (activeDeals || []).reduce((sum, d) => sum + (d.value || 0), 0)
    
    // Calculate comparisons
    const calculateChange = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0
      return ((current - previous) / previous) * 100
    }
    
    const salesChange = calculateChange(currentRevenue, previousRevenue)
    const activitiesChange = calculateChange(currentTotalActivities, previousTotalActivities)
    const pipelineChange = 0 // Would need previous pipeline value
    
    const salesComparison = {
      current: currentRevenue,
      previous: previousRevenue,
      change: salesChange,
      changeType: salesChange > 0 ? 'increase' : salesChange < 0 ? 'decrease' : 'neutral',
      verdict: salesChange > 0 
        ? `Significantly Better - You've closed ${formatCurrency(currentRevenue)} in ${monthNames[currentMonth]} vs ${formatCurrency(previousRevenue)} in ${monthNames[previousMonth]} at the same point.`
        : salesChange < 0
        ? `Below Pace - You closed ${formatCurrency(currentRevenue)} vs ${formatCurrency(previousRevenue)} in ${monthNames[previousMonth]}.`
        : 'Similar performance to previous month.'
    }
    
    const activitiesComparison = {
      current: currentTotalActivities,
      previous: previousTotalActivities,
      change: activitiesChange,
      changeType: activitiesChange > 0 ? 'increase' : activitiesChange < 0 ? 'decrease' : 'neutral',
      verdict: activitiesChange > 0
        ? `Higher Activity - ${currentTotalActivities} activities vs ${previousTotalActivities} in ${monthNames[previousMonth]}.`
        : activitiesChange < 0
        ? `Slightly Below Pace - ${currentTotalActivities} activities vs ${previousTotalActivities} in ${monthNames[previousMonth]}.`
        : 'Similar activity level to previous month.'
    }
    
    const pipelineComparison = {
      current: pipelineValue,
      previous: pipelineValue, // Would need to fetch previous
      change: 0,
      changeType: 'neutral' as const,
      verdict: `Strong pipeline with ${formatCurrency(pipelineValue)} in active opportunities.`
    }
    
    // Determine overall performance
    let overall: 'significantly_better' | 'better' | 'similar' | 'worse' | 'significantly_worse' = 'similar'
    if (salesChange > 50) overall = 'significantly_better'
    else if (salesChange > 0) overall = 'better'
    else if (salesChange < -50) overall = 'significantly_worse'
    else if (salesChange < 0) overall = 'worse'
    
    // Generate insights
    const insights: Array<{
      id: string
      type: 'positive' | 'warning' | 'opportunity'
      title: string
      description: string
      impact: 'high' | 'medium' | 'low'
    }> = []
    
    if (currentRevenue > previousRevenue) {
      insights.push({
        id: 'revenue-growth',
        type: 'positive' as const,
        title: 'Revenue Generation',
        description: `You're ahead on closed sales in ${monthNames[currentMonth]} (+${formatCurrency(currentRevenue - previousRevenue)} vs ${monthNames[previousMonth]}).`,
        impact: 'high' as const
      })
    }
    
    if (currentTotalActivities < previousTotalActivities) {
      insights.push({
        id: 'activity-pace',
        type: 'warning' as const,
        title: 'Activity Level',
        description: `${monthNames[previousMonth]} had higher activity volume - you may want to maintain that pace.`,
        impact: 'medium' as const
      })
    }
    
    if (activeDeals && activeDeals.length > 0) {
      const highValueDeals = activeDeals.filter(d => (d.value || 0) >= 8000)
      if (highValueDeals.length > 0) {
        insights.push({
          id: 'opportunity-quality',
          type: 'opportunity' as const,
          title: 'Opportunity Quality',
          description: `Strong pipeline with ${highValueDeals.length} $8K+ deals in Opportunity stage.`,
          impact: 'high' as const
        })
      }
    }
    
    // Generate recommendations
    const recommendations: Array<{
      id: string
      priority: 'high' | 'medium' | 'low'
      title: string
      description: string
      actionItems: string[]
    }> = []
    
    if (activeDeals && activeDeals.length > 0) {
      recommendations.push({
        id: 'focus-opportunities',
        priority: 'high' as const,
        title: 'Focus on High-Value Opportunities',
        description: 'Keep the momentum on the $8K+ opportunities in your pipeline.',
        actionItems: [
          'Review and prioritize high-value deals',
          'Schedule follow-ups for Opportunity stage deals',
          'Move deals from Opportunity to closure'
        ]
      })
    }
    
    if (currentTotalActivities < previousTotalActivities) {
      recommendations.push({
        id: 'increase-activity',
        priority: 'medium' as const,
        title: 'Maintain Activity Pace',
        description: 'Maintain or increase outbound activity to match previous month\'s pace.',
        actionItems: [
          'Schedule more outbound calls',
          'Increase email outreach',
          'Set daily activity goals'
        ]
      })
    }
    
    console.log('[SALES-COACH] Calculating metrics...', {
      currentClosed: currentClosed.length,
      previousClosed: previousClosed.length,
      currentRevenue,
      previousRevenue,
      currentMeetingsCount,
      previousMeetingsCount,
      currentTotalActivities,
      previousTotalActivities,
      pipelineValue
    })
    
    const response = {
      type: 'sales_coach',
      summary: isAdminQuery 
        ? `${targetUserName}'s performance comparison: ${monthNames[currentMonth]} ${currentYear} (through day ${currentDay}) vs ${monthNames[previousMonth]} ${previousYear} (through day ${currentDay})`
        : `Performance comparison: ${monthNames[currentMonth]} ${currentYear} (through day ${currentDay}) vs ${monthNames[previousMonth]} ${previousYear} (through day ${currentDay})`,
      data: {
        comparison: {
          sales: salesComparison,
          activities: activitiesComparison,
          pipeline: pipelineComparison,
          overall
        },
        metrics: {
          currentMonth: {
            closedDeals: currentClosed.length,
            totalRevenue: currentRevenue,
            averageDealValue: currentAvgDealValue,
            meetings: currentMeetingsCount,
            outboundActivities: currentOutbound,
            totalActivities: currentTotalActivities,
            pipelineValue,
            deals: (currentDeals || []).map(d => ({
              id: d.id,
              name: d.name,
              value: d.value || 0,
              stage: d.stage,
              closedDate: d.close_date
            }))
          },
          previousMonth: {
            closedDeals: previousClosed.length,
            totalRevenue: previousRevenue,
            averageDealValue: previousAvgDealValue,
            meetings: previousMeetingsCount,
            outboundActivities: previousOutbound,
            totalActivities: previousTotalActivities,
            pipelineValue: 0, // Would need to fetch
            deals: (previousDeals || []).map(d => ({
              id: d.id,
              name: d.name,
              value: d.value || 0,
              stage: d.stage,
              closedDate: d.close_date
            }))
          }
        },
        insights,
        recommendations,
        period: {
          current: { month: monthNames[currentMonth], year: currentYear, day: currentDay },
          previous: { month: monthNames[previousMonth], year: previousYear, day: currentDay }
        }
      },
      actions: [],
      metadata: {
        timeGenerated: new Date().toISOString(),
        dataSource: ['deals', 'activities', 'meetings'],
        confidence: 90
      }
    }
    
    console.log('[SALES-COACH] ✅ Response generated successfully:', {
      type: response.type,
      hasData: !!response.data,
      hasComparison: !!response.data?.comparison,
      hasMetrics: !!response.data?.metrics,
      hasInsights: !!response.data?.insights?.length,
      hasRecommendations: !!response.data?.recommendations?.length,
      summary: response.summary?.substring(0, 100)
    })
    
    return response
  } catch (error) {
    console.error('[SALES-COACH] ❌ Exception in structureSalesCoachResponse:', error)
    return null
  }
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value)
}

/**
 * Extract recommendations from AI response (simple implementation)
 */
function extractRecommendations(content: string): any[] {
  // Simple extraction - in production, you might want Claude to return structured JSON
  // or use a more sophisticated parsing approach
  const recommendations: any[] = []
  
  // Look for action items in the response
  const actionPatterns = [
    /(?:suggest|recommend|consider|you should|next step)[\s\S]{0,200}/gi
  ]
  
  // This is a placeholder - you'd want more sophisticated parsing
  // or have Claude return structured recommendations
  
  return recommendations
}

