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
import { logAICostEvent, extractAnthropicUsage } from '../_shared/costTracking.ts'
import { executeAction } from '../_shared/copilot_adapters/executeAction.ts'
import type { ExecuteActionName } from '../_shared/copilot_adapters/types.ts'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
const ANTHROPIC_VERSION = '2023-06-01' // API version for tool calling
const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID') || ''
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET') || ''

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
    orgId?: string
    temporalContext?: TemporalContextPayload
  }
}

interface TemporalContextPayload {
  isoString?: string
  localeString?: string
  date?: string
  time?: string
  timezone?: string
  offsetMinutes?: number
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

interface ToolExecutionDetail {
  toolName: string
  args: any
  result: any
  latencyMs: number
  success: boolean
  error?: string
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

interface GmailMessageSummary {
  id: string
  threadId?: string
  subject: string
  snippet: string
  date: string
  direction: 'sent' | 'received' | 'unknown'
  from: string[]
  to: string[]
  historyId?: string
  link?: string
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
      matchesTestSkill: req.method === 'POST' && endpoint === 'actions' && resourceId === 'test-skill',
      matchesGenerateEmail: req.method === 'POST' && endpoint === 'actions' && resourceId === 'generate-deal-email',
      matchesConversations: req.method === 'GET' && endpoint === 'conversations' && resourceId
    })
    
    if (req.method === 'POST' && endpoint === 'chat') {
      return await handleChat(client, req, user_id)
    } else if (req.method === 'POST' && endpoint === 'actions' && resourceId === 'draft-email') {
      return await handleDraftEmail(client, req, user_id)
    } else if (req.method === 'POST' && endpoint === 'actions' && resourceId === 'test-skill') {
      return await handleTestSkill(client, req, user_id)
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

    // ---------------------------------------------------------------------------
    // Resolve org_id (prefer explicit orgId from client context, but validate membership)
    // ---------------------------------------------------------------------------
    try {
      const requestedOrgId = body.context?.orgId ? String(body.context.orgId) : null

      if (requestedOrgId) {
        const { data: membership, error: membershipError } = await client
          .from('organization_memberships')
          .select('org_id')
          .eq('user_id', userId)
          .eq('org_id', requestedOrgId)
          .maybeSingle()

        if (membershipError) {
          console.warn('[API-COPILOT] Failed to validate requested orgId (falling back):', membershipError)
        } else if (membership?.org_id) {
          body.context.orgId = String(membership.org_id)
        } else {
          // Requested orgId is not one of the user's orgs; fall back.
          body.context.orgId = undefined
        }
      }

      // If no valid requested orgId, pick first membership as default
      if (!body.context?.orgId) {
        const { data: membership } = await client
          .from('organization_memberships')
          .select('org_id')
          .eq('user_id', userId)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle()

        if (membership?.org_id) {
          body.context.orgId = String(membership.org_id)
        }
      }
    } catch (e) {
      // fail open: copilot should still work without org context
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
          body.context?.orgId ? String(body.context.orgId) : null,
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
        
        // Log cost event for tracking
        try {
          // Get user's org_id
          const { data: membership } = await client
            .from('organization_memberships')
            .select('org_id')
            .eq('user_id', userId)
            .order('created_at', { ascending: true })
            .limit(1)
            .single()
          
          if (membership?.org_id && aiResponse.usage.input_tokens && aiResponse.usage.output_tokens) {
            // Use the cost tracking helper function
            await logAICostEvent(
              client,
              userId,
              membership.org_id,
              'anthropic',
              'claude-haiku-4-5', // Copilot uses Haiku 4.5
              aiResponse.usage.input_tokens,
              aiResponse.usage.output_tokens,
              'copilot',
              {
                tool_iterations: aiResponse.tool_iterations || 0,
                tools_used: aiResponse.tools_used || [],
                conversation_id: conversationId,
              }
            )
          }
        } catch (err) {
          // Silently fail - cost tracking is optional
          if (err instanceof Error && !err.message.includes('relation') && !err.message.includes('does not exist')) {
            console.warn('[Copilot] Error in cost logging:', err)
          }
        }
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
        userId, // Pass requesting user ID for permission checks
        body.context,
        aiResponse.tool_executions || [] // Pass detailed tool execution metadata
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
 * Handle skill testing requests (admin/dev console)
 *
 * POST /api-copilot/actions/test-skill
 *
 * Supports optional contact context for testing skills with real contact data:
 * - contact_id: UUID of the contact to use
 * - contact_test_mode: 'good' | 'average' | 'bad' | 'custom'
 * - contact_context: { id, email, name, title, company_id, company_name, total_meetings_count, quality_tier, quality_score }
 */
async function handleTestSkill(
  client: any,
  req: Request,
  userId: string
): Promise<Response> {
  try {
    const body = await req.json()
    const skillKey = body?.skill_key ? String(body.skill_key).trim() : ''
    const testInput = body?.test_input ? String(body.test_input) : ''
    const mode = body?.mode ? String(body.mode) : 'readonly'

    // Optional contact testing context
    const contactId = body?.contact_id ? String(body.contact_id) : null
    const contactTestMode = body?.contact_test_mode ? String(body.contact_test_mode) : null
    const contactContext = body?.contact_context || null

    if (!skillKey) {
      return createErrorResponse('skill_key is required', 400, 'INVALID_SKILL_KEY')
    }

    // Build message parts
    const messageParts = [
      `Skill test mode: ${mode}.`,
      `First call get_skill({ "skill_key": "${skillKey}" }) and follow that skill's instructions.`,
    ]

    // Add contact context if provided
    if (contactId && contactContext) {
      const contactInfo = [
        `\n--- CONTACT TESTING CONTEXT ---`,
        `Test Mode: ${contactTestMode || 'custom'}`,
        `Quality Tier: ${contactContext.quality_tier || 'unknown'} (Score: ${contactContext.quality_score || 0}/100)`,
        ``,
        `Contact Details:`,
        `- ID: ${contactContext.id}`,
        `- Name: ${contactContext.name || 'Unknown'}`,
        `- Email: ${contactContext.email || 'Unknown'}`,
        contactContext.title ? `- Title: ${contactContext.title}` : null,
        contactContext.company_name ? `- Company: ${contactContext.company_name}` : null,
        contactContext.total_meetings_count != null ? `- Meeting Count: ${contactContext.total_meetings_count}` : null,
        ``,
        `Use this contact's information when testing the skill. The contact_id is: ${contactId}`,
        `--- END CONTACT CONTEXT ---\n`,
      ].filter(Boolean).join('\n')

      messageParts.push(contactInfo)
    }

    // Add user test input
    messageParts.push(
      testInput
        ? `User request to run through the skill: ${testInput}`
        : 'User request: run the skill with best-effort defaults.'
    )

    const message = messageParts.join('\n')

    const aiResponse = await callClaudeAPI(message, [], '', client, userId, null)

    return new Response(
      JSON.stringify({
        success: true,
        skill_key: skillKey,
        output: aiResponse.content,
        tools_used: aiResponse.tools_used || [],
        tool_iterations: aiResponse.tool_iterations || 0,
        tool_executions: aiResponse.tool_executions || [],
        usage: aiResponse.usage || undefined,
        // Include contact testing info in response for debugging
        contact_test_info: contactId ? {
          contact_id: contactId,
          test_mode: contactTestMode,
          quality_tier: contactContext?.quality_tier,
          quality_score: contactContext?.quality_score,
        } : null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to test skill'
    return createErrorResponse(message, 500, 'TEST_SKILL_ERROR')
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

  // ---------------------------------------------------------------------------
  // Org + personalization context (company bio, user bio, org currency)
  // ---------------------------------------------------------------------------
  let orgCurrencyCode = 'GBP'
  let orgCurrencyLocale = 'en-GB'

  const formatOrgMoney = (value: number | null | undefined): string => {
    const n = typeof value === 'number' ? value : Number(value)
    const safe = Number.isFinite(n) ? n : 0
    try {
      return new Intl.NumberFormat(orgCurrencyLocale, {
        style: 'currency',
        currency: orgCurrencyCode,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(safe)
    } catch {
      return `${safe}`
    }
  }

  try {
    const orgId = context?.orgId ? String(context.orgId) : null

    if (orgId) {
      const { data: org } = await client
        .from('organizations')
        .select('name, currency_code, currency_locale, company_bio, company_industry, company_country_code, company_timezone')
        .eq('id', orgId)
        .maybeSingle()

      if (org?.currency_code) orgCurrencyCode = String(org.currency_code).toUpperCase()
      if (org?.currency_locale) orgCurrencyLocale = String(org.currency_locale)

      // Keep this short and high-signal: this becomes prompt context.
      if (org?.name) {
        contextParts.push(`Organization: ${org.name}`)
      }
      contextParts.push(`Org currency: ${orgCurrencyCode} (${orgCurrencyLocale})`)

      const orgMeta: string[] = []
      if (org?.company_industry) orgMeta.push(`Industry: ${org.company_industry}`)
      if (org?.company_country_code) orgMeta.push(`Country: ${org.company_country_code}`)
      if (org?.company_timezone) orgMeta.push(`Timezone: ${org.company_timezone}`)
      if (orgMeta.length > 0) {
        contextParts.push(`Org info: ${orgMeta.join(' • ')}`)
      }

      if (org?.company_bio) {
        contextParts.push(`Company bio: ${org.company_bio}`)
      }
    }

    const { data: profile } = await client
      .from('profiles')
      .select('bio')
      .eq('id', userId)
      .maybeSingle()

    if (profile?.bio) {
      contextParts.push(`User bio: ${profile.bio}`)
    }
  } catch (e) {
    // fail open: copilot should still work without org context
  }

  if (context?.temporalContext) {
    const { date, time, timezone, localeString, isoString } = context.temporalContext
    const primary = (date && time) ? `${date} at ${time}` : localeString || isoString
    if (primary) {
      contextParts.push(`Current date/time: ${primary}${timezone ? ` (${timezone})` : ''}`)
    }
  }

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
      contextParts.push(`Related deals: ${deals.map(d => `${d.name} (${d.deal_stages?.name || 'Unknown Stage'}, ${formatOrgMoney(d.value)})`).join(', ')}`)
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
    description: 'Read and search calendar events. Use this to find events by title (e.g., "gym", "meeting with John") or time range. When users want to move/update an event, first use this tool to find it by searching the title.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Event ID (for single event)' },
        title: { type: 'string', description: 'Search events by title (case-insensitive partial match, e.g., "gym" will find "Gym Session")' },
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
  {
    name: 'calendar_availability',
    description: 'Check what\'s on the user\'s calendar or find free time slots. Use this tool when users ask about their calendar, meetings, availability, or free time. The tool returns both scheduled events and available time slots. Use the current date/time from context to parse relative dates like "Monday next week", "this coming Monday", "tomorrow", etc. Always use this tool instead of asking the user for dates - the context includes the current date/time.',
    input_schema: {
      type: 'object',
      properties: {
        startDate: { type: 'string', description: 'Start of the window (ISO). Use current date/time from context to calculate relative dates like "Monday next week".' },
        endDate: { type: 'string', description: 'End of the window (ISO). For single day queries like "Monday", use end of that day. Defaults to 7 days from start.' },
        durationMinutes: { type: 'number', default: 60, description: 'Required meeting duration in minutes.' },
        workingHoursStart: { type: 'string', default: '09:00', description: 'Day start in HH:mm (user timezone).' },
        workingHoursEnd: { type: 'string', default: '17:00', description: 'Day end in HH:mm (user timezone).' },
        excludeWeekends: { type: 'boolean', default: true, description: 'Exclude weekends when true.' }
      }
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
  },
  // Clients CRUD (for subscription management)
  {
    name: 'clients_create',
    description: 'Create a new client record for subscription management. Use this when converting a deal to a client or creating a new client subscription.',
    input_schema: {
      type: 'object',
      properties: {
        company_name: { type: 'string', description: 'Client company name (required)' },
        contact_name: { type: 'string', description: 'Primary contact name' },
        contact_email: { type: 'string', description: 'Primary contact email' },
        subscription_amount: { type: 'number', description: 'Monthly recurring revenue (MRR) amount' },
        status: { type: 'string', enum: ['active', 'churned', 'paused'], default: 'active', description: 'Client subscription status' },
        deal_id: { type: 'string', description: 'Optional reference to original deal that was converted' },
        subscription_start_date: { type: 'string', description: 'Date when subscription started (ISO format)' }
      },
      required: ['company_name']
    }
  },
  {
    name: 'clients_read',
    description: 'Read client records with filtering options. Use this to view client subscriptions, find clients by company name, or check subscription status.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Client ID (for single client)' },
        company_name: { type: 'string', description: 'Filter by company name' },
        status: { type: 'string', enum: ['active', 'churned', 'paused'], description: 'Filter by status' },
        deal_id: { type: 'string', description: 'Filter by deal ID' },
        limit: { type: 'number', default: 50, description: 'Maximum number of clients to return' }
      }
    }
  },
  {
    name: 'clients_update',
    description: 'Update a client record. Use this to update subscription amounts (MRR), change status, or modify client information. This is the primary tool for updating monthly subscription amounts.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Client ID' },
        company_name: { type: 'string', description: 'Company name' },
        contact_name: { type: 'string', description: 'Primary contact name' },
        contact_email: { type: 'string', description: 'Primary contact email' },
        subscription_amount: { type: 'number', description: 'Monthly recurring revenue (MRR) amount - use this to update subscription amounts' },
        status: { type: 'string', enum: ['active', 'churned', 'paused'] },
        subscription_start_date: { type: 'string', description: 'Subscription start date (ISO format)' },
        churn_date: { type: 'string', description: 'Churn date (ISO format, only when status is churned)' }
      },
      required: ['id']
    }
  },
  {
    name: 'clients_delete',
    description: 'Delete a client record. Use with caution - this permanently removes the client subscription record.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Client ID' }
      },
      required: ['id']
    }
  },
  {
    name: 'emails_search',
    description: 'Search your connected Gmail account for recent emails with a specific contact or keyword query.',
    input_schema: {
      type: 'object',
      properties: {
        contact_email: { type: 'string', description: 'Email address of the contact to filter on' },
        contact_id: { type: 'string', description: 'Contact ID to derive the email from' },
        contact_name: { type: 'string', description: 'Contact name if email is unknown' },
        query: { type: 'string', description: 'Additional Gmail query or keyword (subject, company, etc.)' },
        direction: { type: 'string', enum: ['sent', 'received', 'both'], default: 'both', description: 'Filter by direction relative to the contact' },
        start_date: { type: 'string', description: 'Start date (ISO) for filtering emails' },
        end_date: { type: 'string', description: 'End date (ISO) for filtering emails' },
        label: { type: 'string', description: 'Gmail label to filter on (e.g., "to respond")' },
        limit: { type: 'number', default: 10, description: 'Maximum number of messages to return (max 20)' }
      }
    }
  }
]

/**
 * Skills Router Tools (3-tool surface)
 *
 * Copilot is intentionally limited to:
 * - list_skills: discover skills
 * - get_skill: load a skill document (compiled per org)
 * - execute_action: fetch data / perform actions through adapters
 */
const SKILLS_ROUTER_TOOLS = [
  {
    name: 'list_skills',
    description: 'List available compiled skills for the user’s organization (optionally filtered by category).',
    input_schema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          enum: ['sales-ai', 'writing', 'enrichment', 'workflows', 'data-access', 'output-format'],
          description: 'Optional skill category filter.',
        },
        enabled_only: {
          type: 'boolean',
          default: true,
          description: 'Only return enabled skills (default true).',
        },
      },
    },
  },
  {
    name: 'get_skill',
    description: 'Retrieve a compiled skill document by skill_key for the user’s organization.',
    input_schema: {
      type: 'object',
      properties: {
        skill_key: { type: 'string', description: 'Skill identifier (e.g., lead-qualification, get-contact-context)' },
      },
      required: ['skill_key'],
    },
  },
  {
    name: 'execute_action',
    description: `Execute an action to fetch CRM data, meetings, emails, or send notifications.

ACTION PARAMETERS:
• get_contact: { email?: string, name?: string, id?: string } - Search contacts by email (preferred), name, or id
• get_deal: { name?: string, id?: string } - Search deals by name or id
• get_meetings: { contactEmail?: string, contactId?: string, limit?: number } - Get meetings with a contact. IMPORTANT: Always pass contactEmail when you have an email address!
• search_emails: { contact_email?: string, query?: string, limit?: number } - Search emails by contact email or query
• draft_email: { to: string, subject?: string, context?: string, tone?: string } - Draft an email
• update_crm: { entity: 'deal'|'contact'|'task'|'activity', id: string, updates: object, confirm: true } - Update CRM record (requires confirm=true)
• send_notification: { channel: 'slack', message: string, blocks?: object } - Send a notification

Write actions require params.confirm=true.`,
    input_schema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: [
            'get_contact',
            'get_deal',
            'get_meetings',
            'search_emails',
            'draft_email',
            'update_crm',
            'send_notification',
          ],
          description: 'The action to execute',
        },
        params: {
          type: 'object',
          description: 'Action-specific parameters (see tool description for each action)',
          properties: {
            email: { type: 'string', description: 'Contact email address (for get_contact)' },
            name: { type: 'string', description: 'Name to search (for get_contact, get_deal)' },
            id: { type: 'string', description: 'Record ID' },
            contactEmail: { type: 'string', description: 'Email of the contact (for get_meetings) - PREFERRED method' },
            contactId: { type: 'string', description: 'Contact ID (for get_meetings)' },
            contact_email: { type: 'string', description: 'Contact email (for search_emails)' },
            query: { type: 'string', description: 'Search query (for search_emails)' },
            limit: { type: 'number', description: 'Max results to return' },
            to: { type: 'string', description: 'Recipient email (for draft_email)' },
            subject: { type: 'string', description: 'Email subject (for draft_email)' },
            context: { type: 'string', description: 'Context for drafting (for draft_email)' },
            tone: { type: 'string', description: 'Email tone (for draft_email)' },
            entity: { type: 'string', enum: ['deal', 'contact', 'task', 'activity'], description: 'CRM entity type (for update_crm)' },
            updates: { type: 'object', description: 'Fields to update (for update_crm)' },
            confirm: { type: 'boolean', description: 'Set to true to confirm write operations' },
            channel: { type: 'string', description: 'Notification channel (for send_notification)' },
            message: { type: 'string', description: 'Notification message (for send_notification)' },
            blocks: { type: 'object', description: 'Slack blocks (for send_notification)' },
          },
        },
      },
      required: ['action', 'params'],
    },
  },
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
  orgId: string | null,
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
  tool_executions?: ToolExecutionDetail[];
}> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not configured')
  }

  // Build messages array for Claude
  // Resolve org + company name for minimal system prompt
  let orgId: string | null = null
  let companyName = 'your company'
  try {
    const { data: membership } = await client
      .from('organization_memberships')
      .select('org_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    orgId = membership?.org_id ? String(membership.org_id) : null

    if (orgId) {
      const { data: orgCompanyName } = await client
        .from('organization_context')
        .select('value')
        .eq('organization_id', orgId)
        .eq('context_key', 'company_name')
        .maybeSingle()

      const ctxName = orgCompanyName?.value
      if (typeof ctxName === 'string' && ctxName.trim()) {
        companyName = ctxName.trim()
      } else if (ctxName && typeof ctxName === 'object' && typeof (ctxName as any).name === 'string') {
        const nestedName = String((ctxName as any).name).trim()
        if (nestedName) companyName = nestedName
      } else {
        const { data: org } = await client
          .from('organizations')
          .select('name')
          .eq('id', orgId)
          .maybeSingle()
        if (org?.name) companyName = String(org.name)
      }
    }
  } catch {
    // fail open: keep default companyName
  }

  const systemPrompt = `You are a sales assistant for ${companyName}. You help sales reps prepare for calls, follow up after meetings, and manage their pipeline.

## How You Work
You have access to skills - documents that contain instructions, context, and best practices specific to ${companyName}. Always retrieve the relevant skill before taking action.

### Your Tools
1. list_skills - See available skills by category
2. get_skill - Retrieve a skill document for guidance
3. execute_action - Perform actions (query CRM, fetch meetings, search emails, etc.)

### Workflow Pattern
1. Understand what the user needs
2. Retrieve the relevant skill(s) with get_skill
3. Follow the skill's instructions
4. Use execute_action to gather data or perform tasks
5. Deliver results in the user's preferred channel

## Core Rules
- Confirm before any CRM updates, notifications, or sends (execute_action write actions require params.confirm=true)
- Do not make up information; prefer tool results
- If data is missing, state what you couldn't find and proceed with what you have`

  const messages: any[] = []

  // Add conversation history (last 10 messages for context)
  const recentHistory = history.slice(-10)
  recentHistory.forEach(msg => {
    messages.push({
      role: msg.role,
      content: msg.content
    })
  })

  // Add runtime context (short, high-signal) as a separate user message
  if (context && context.trim()) {
    messages.push({
      role: 'user',
      content: `Context:\n${context}`.trim(),
    })
  }

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
      system: systemPrompt,
      tools: SKILLS_ROUTER_TOOLS,
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
  const toolExecutions: ToolExecutionDetail[] = [] // Detailed execution tracking

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
          const toolPromise = executeToolCall(toolCall.name, toolCall.input, client, userId, orgId)
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Tool execution timeout')), 10000)
          )
          
          const toolResult = await Promise.race([toolPromise, timeoutPromise])
          const toolLatencyMs = Date.now() - toolStartTime
          toolsSuccessCount++
          
          // Track detailed execution metadata
          toolExecutions.push({
            toolName: toolCall.name,
            args: toolCall.input,
            result: toolResult,
            latencyMs: toolLatencyMs,
            success: true
          })
          
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolCall.id,
            content: JSON.stringify(toolResult)
          })
        } catch (error: any) {
          const toolLatencyMs = Date.now() - toolStartTime
          toolsErrorCount++
          
          // Track failed execution metadata
          toolExecutions.push({
            toolName: toolCall.name,
            args: toolCall.input,
            result: null,
            latencyMs: toolLatencyMs,
            success: false,
            error: error.message || String(error)
          })
          
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
          system: systemPrompt,
          tools: SKILLS_ROUTER_TOOLS,
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
    tool_execution_time_ms: toolExecutionTimeMs,
    tool_executions: toolExecutions
  }
}

/**
 * Execute a tool call - routes to appropriate CRUD handler
 */
async function executeToolCall(
  toolName: string,
  args: any,
  client: any,
  userId: string,
  orgId: string | null
): Promise<any> {
  // ---------------------------------------------------------------------------
  // Skills Router (3-tool surface)
  // ---------------------------------------------------------------------------
  if (toolName === 'list_skills' || toolName === 'get_skill' || toolName === 'execute_action') {
    // Resolve org_id (prefer orgId from request context; otherwise fall back to first membership)
    let resolvedOrgId = orgId
    if (!resolvedOrgId) {
      const { data: membership, error: membershipError } = await client
        .from('organization_memberships')
        .select('org_id')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (membershipError) {
        throw new Error(`Failed to resolve organization: ${membershipError.message}`)
      }

      resolvedOrgId = membership?.org_id ? String(membership.org_id) : null
    }

    if (!resolvedOrgId) {
      throw new Error('No organization found for user')
    }

    if (toolName === 'list_skills') {
      const category = args?.category ? String(args.category) : null
      const enabledOnly = args?.enabled_only !== false

      if (enabledOnly) {
        const { data: skills, error } = await client.rpc('get_organization_skills_for_agent', {
          p_org_id: resolvedOrgId,
        })
        if (error) throw new Error(`Failed to list skills: ${error.message}`)

        const filtered = (skills || []).filter((s: any) => (!category ? true : s.category === category))
        return {
          success: true,
          count: filtered.length,
          skills: filtered.map((s: any) => ({
            skill_key: s.skill_key,
            category: s.category,
            name: s.frontmatter?.name,
            description: s.frontmatter?.description,
            triggers: s.frontmatter?.triggers || [],
            is_enabled: s.is_enabled ?? true,
          })),
        }
      }

      // enabled_only=false: include disabled org skills via join on platform_skill_id
      const { data: rows, error } = await client
        .from('organization_skills')
        .select(
          `
          skill_id,
          is_enabled,
          compiled_frontmatter,
          compiled_content,
          platform_skill_version,
          platform_skills:platform_skill_id(category, frontmatter, content_template, is_active)
        `
        )
        .eq('organization_id', resolvedOrgId)
        .eq('is_active', true)

      if (error) throw new Error(`Failed to list skills: ${error.message}`)

      const all = (rows || [])
        .filter((r: any) => (r.platform_skills?.is_active ?? true) === true)
        .map((r: any) => ({
          skill_key: r.skill_id,
          category: r.platform_skills?.category || 'uncategorized',
          frontmatter: r.compiled_frontmatter || r.platform_skills?.frontmatter || {},
          content: r.compiled_content || r.platform_skills?.content_template || '',
          is_enabled: r.is_enabled ?? true,
          version: r.platform_skill_version ?? 1,
        }))
        .filter((s: any) => (!category ? true : s.category === category))

      return {
        success: true,
        count: all.length,
        skills: all.map((s: any) => ({
          skill_key: s.skill_key,
          category: s.category,
          name: s.frontmatter?.name,
          description: s.frontmatter?.description,
          triggers: s.frontmatter?.triggers || [],
          is_enabled: s.is_enabled ?? true,
        })),
      }
    }

    if (toolName === 'get_skill') {
      const skillKey = args?.skill_key ? String(args.skill_key) : null
      if (!skillKey) throw new Error('skill_key is required')

      // Prefer enabled compiled skills first
      const { data: skills, error } = await client.rpc('get_organization_skills_for_agent', {
        p_org_id: resolvedOrgId,
      })
      if (error) throw new Error(`Failed to get skill: ${error.message}`)

      const found = (skills || []).find((s: any) => s.skill_key === skillKey)
      if (found) {
        return {
          success: true,
          skill: {
            skill_key: found.skill_key,
            category: found.category,
            frontmatter: found.frontmatter || {},
            content: found.content || '',
            is_enabled: found.is_enabled ?? true,
          },
        }
      }

      // Fallback: allow fetching disabled skill by joining organization_skills -> platform_skills
      const { data: row, error: rowError } = await client
        .from('organization_skills')
        .select(
          `
          skill_id,
          is_enabled,
          compiled_frontmatter,
          compiled_content,
          platform_skill_version,
          platform_skills:platform_skill_id(category, frontmatter, content_template, is_active)
        `
        )
        .eq('organization_id', resolvedOrgId)
        .eq('skill_id', skillKey)
        .eq('is_active', true)
        .maybeSingle()

      if (rowError) throw new Error(`Failed to get skill: ${rowError.message}`)
      if (!row || (row.platform_skills?.is_active ?? true) !== true) {
        return { success: true, skill: null }
      }

      return {
        success: true,
        skill: {
          skill_key: row.skill_id,
          category: row.platform_skills?.category || 'uncategorized',
          frontmatter: row.compiled_frontmatter || row.platform_skills?.frontmatter || {},
          content: row.compiled_content || row.platform_skills?.content_template || '',
          is_enabled: row.is_enabled ?? true,
        },
      }
    }

    if (toolName === 'execute_action') {
      const action = args?.action as ExecuteActionName
      const params = (args?.params || {}) as Record<string, unknown>
      return await executeAction(client, userId, resolvedOrgId, action, params)
    }
  }

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
    
    case 'clients':
      return await handleClientsCRUD(operation, args, client, userId)

    case 'emails':
      return await handleEmailsTool(operation, args, client, userId)
    
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
      const { id, company, company_id, ...updates } = args
      
      // Resolve company name to company_id if company name provided
      let resolvedCompanyId = company_id
      if (company && !company_id) {
        // Try to find company by name in clients table first (CRM uses clients)
        let companyData = null
        let companyError = null
        
        // Try clients table first (most common in CRM)
        const clientsResult = await client
          .from('clients')
          .select('id')
          .ilike('company_name', `%${company}%`)
          .eq('owner_id', userId)
          .limit(1)
          .maybeSingle()
        
        if (clientsResult.data) {
          resolvedCompanyId = clientsResult.data.id
        } else {
          // Fallback to companies table if clients doesn't exist
          const companiesResult = await client
            .from('companies')
            .select('id')
            .ilike('name', `%${company}%`)
            .eq('owner_id', userId)
            .limit(1)
            .maybeSingle()
          
          if (companiesResult.data) {
            resolvedCompanyId = companiesResult.data.id
          } else {
            // If company not found, try creating it in clients table
            const { data: newCompany, error: createError } = await client
              .from('clients')
              .insert({
                company_name: company,
                owner_id: userId
              })
              .select('id')
              .single()
            
            if (!createError && newCompany) {
              resolvedCompanyId = newCompany.id
            }
          }
        }
      }
      
      // Build update object
      const updateData: any = { ...updates }
      if (resolvedCompanyId) {
        updateData.company_id = resolvedCompanyId
      }
      
      const { data, error } = await client
        .from('contacts')
        .update(updateData)
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
      const { id, title, startDate, endDate, calendar_id, deal_id, limit = 50 } = args

      console.log('[CALENDAR-READ] Query params:', {
        userId,
        id,
        title,
        startDate,
        endDate,
        calendar_id,
        deal_id,
        limit
      })

      console.log('[CALENDAR-READ] Date range query:', {
        startDateISO: startDate,
        endDateISO: endDate,
        startDateParsed: startDate ? new Date(startDate).toISOString() : null,
        endDateParsed: endDate ? new Date(endDate).toISOString() : null
      })

      // Check data freshness and log if sync may be needed
      // The hourly background sync will keep data current
      if (startDate && endDate) {
        const rangeStart = new Date(startDate)
        const rangeEnd = new Date(endDate)

        // Check when this range was last synced
        const { data: lastEvent } = await client
          .from('calendar_events')
          .select('updated_at')
          .eq('user_id', userId)
          .gte('start_time', rangeStart.toISOString())
          .lte('start_time', rangeEnd.toISOString())
          .order('updated_at', { ascending: false })
          .limit(1)
          .single()

        const lastUpdated = lastEvent ? new Date(lastEvent.updated_at) : null
        const minutesSinceUpdate = lastUpdated
          ? (Date.now() - lastUpdated.getTime()) / 1000 / 60
          : Infinity

        console.log('[CALENDAR-READ] Data freshness:', {
          lastUpdated: lastUpdated?.toISOString(),
          minutesSinceUpdate: minutesSinceUpdate.toFixed(1),
          isStale: minutesSinceUpdate > 60,
          note: 'Hourly background sync will update stale data'
        })
      }

      let query = client
        .from('calendar_events')
        .select('*')
        .eq('user_id', userId)

      if (id) {
        query = query.eq('id', id).single()
      } else {
        if (title) query = query.ilike('title', `%${title}%`) // Case-insensitive partial match

        // Handle date range filtering for events
        // For events that span time, we need to find events that OVERLAP with the date range
        // An event overlaps if: event_start < range_end AND event_end > range_start
        if (startDate && endDate) {
          // Parse dates to ensure we have full timestamps
          const rangeStart = new Date(startDate)
          const rangeEnd = new Date(endDate)

          // If same date (or endDate is not later than startDate), assume single day query
          // Extend endDate to end of day to capture all events on that day
          if (rangeEnd.getTime() <= rangeStart.getTime()) {
            rangeEnd.setHours(23, 59, 59, 999)
          }

          console.log('[CALENDAR-READ] Adjusted date range:', {
            originalStart: startDate,
            originalEnd: endDate,
            adjustedStart: rangeStart.toISOString(),
            adjustedEnd: rangeEnd.toISOString()
          })

          // Events that overlap with our date range:
          // - Event starts before or during our range: start_time < rangeEnd
          // - Event ends after or during our range: end_time > rangeStart
          query = query.lt('start_time', rangeEnd.toISOString())
          query = query.gt('end_time', rangeStart.toISOString())
        } else if (startDate) {
          query = query.gte('start_time', startDate)
        } else if (endDate) {
          query = query.lte('start_time', endDate)
        }

        if (calendar_id) query = query.eq('calendar_id', calendar_id)
        if (deal_id) query = query.eq('deal_id', deal_id)
        query = query.order('start_time', { ascending: true }).limit(limit)
      }

      const { data, error } = await query

      if (error) {
        console.error('[CALENDAR-READ] Error:', error)
        throw new Error(`Failed to read calendar events: ${error.message}`)
      }

      console.log('[CALENDAR-READ] Found events:', {
        count: Array.isArray(data) ? data.length : (data ? 1 : 0),
        events: Array.isArray(data) ? data.map(e => ({ id: e.id, title: e.title, start: e.start_time, end: e.end_time })) : (data ? [{ id: data.id, title: data.title, start: data.start_time, end: data.end_time }] : [])
      })

      if (!data || (Array.isArray(data) && data.length === 0)) {
        console.log('[CALENDAR-READ] No events found. Query filters applied:', {
          hasTitle: !!title,
          hasStartDate: !!startDate,
          hasEndDate: !!endDate,
          hasCalendarId: !!calendar_id,
          hasDealId: !!deal_id
        })
      }

      return { success: true, events: Array.isArray(data) ? data : [data], count: Array.isArray(data) ? data.length : 1 }
    }

    case 'update': {
      const { id, ...updates } = args

      console.log('[CALENDAR-UPDATE] Updating event:', {
        userId,
        eventId: id,
        updates
      })

      const { data, error } = await client
        .from('calendar_events')
        .update(updates)
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single()

      if (error) {
        console.error('[CALENDAR-UPDATE] Error:', error)
        throw new Error(`Failed to update calendar event: ${error.message}`)
      }

      console.log('[CALENDAR-UPDATE] Success:', {
        eventId: data?.id,
        title: data?.title,
        newStartTime: data?.start_time,
        newEndTime: data?.end_time
      })

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

    case 'availability': {
      return await handleCalendarAvailability(args, client, userId)
    }

    default:
      throw new Error(`Unknown operation: ${operation}`)
  }
}

/**
 * Ensure calendar is synced before querying
 * Checks user_sync_status and triggers sync if needed (stale or never synced)
 */
async function ensureCalendarSynced(
  client: any,
  userId: string,
  startDate?: string,
  endDate?: string
): Promise<void> {
  try {
    // Get user sync status (handle case where table doesn't exist yet)
    let syncStatus: any = null
    try {
      const { data, error } = await client
        .from('user_sync_status')
        .select('calendar_last_synced_at, calendar_sync_token')
        .eq('user_id', userId)
        .maybeSingle()
      
      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned (expected)
        console.error('[CALENDAR-SYNC] Error checking sync status:', error)
        // If table doesn't exist, error.code will be different - continue to sync anyway
      } else {
        syncStatus = data
      }
    } catch (tableError: any) {
      // Table might not exist if migration hasn't been applied
      console.log('[CALENDAR-SYNC] user_sync_status table may not exist, will attempt sync anyway')
    }

    // Check if sync is needed (never synced or > 5 minutes old)
    const needsSync = !syncStatus?.calendar_last_synced_at ||
      (Date.now() - new Date(syncStatus.calendar_last_synced_at).getTime()) > 5 * 60 * 1000

    if (needsSync) {
      console.log('[CALENDAR-SYNC] Triggering sync for user:', userId, {
        hasSyncStatus: !!syncStatus,
        lastSynced: syncStatus?.calendar_last_synced_at,
        syncToken: syncStatus?.calendar_sync_token ? 'present' : 'missing'
      })
      
      // Call google-calendar-sync edge function using service role
      const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
      
      if (!supabaseUrl || !supabaseServiceKey) {
        console.error('[CALENDAR-SYNC] Missing Supabase configuration')
        return
      }
      
      const syncResponse = await fetch(`${supabaseUrl}/functions/v1/google-calendar-sync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
          'X-Internal-Call': 'true',
        },
        body: JSON.stringify({
          action: 'incremental-sync',
          syncToken: syncStatus?.calendar_sync_token,
          startDate,
          endDate,
          userId,
        }),
      })

      if (!syncResponse.ok) {
        const errorText = await syncResponse.text()
        let errorData: any = {}
        try {
          errorData = JSON.parse(errorText)
        } catch {
          errorData = { message: errorText }
        }
        console.error('[CALENDAR-SYNC] Sync failed:', {
          status: syncResponse.status,
          statusText: syncResponse.statusText,
          error: errorData
        })
        // Don't throw - allow query to proceed with existing data
        return
      }

      const syncResult = await syncResponse.json()
      console.log('[CALENDAR-SYNC] Sync completed:', {
        success: syncResult.success,
        stats: syncResult.stats,
        syncToken: syncResult.syncToken ? 'present' : 'missing'
      })
    } else {
      console.log('[CALENDAR-SYNC] Sync not needed, last synced:', syncStatus?.calendar_last_synced_at)
    }
  } catch (error: any) {
    console.error('[CALENDAR-SYNC] Error checking/syncing calendar:', {
      message: error.message,
      stack: error.stack
    })
    // Don't throw - allow query to proceed with existing data
  }
}

// Calendar Availability
async function handleCalendarAvailability(args: any, client: any, userId: string): Promise<any> {
  const {
    startDate,
    endDate,
    durationMinutes = 60,
    workingHoursStart = '09:00',
    workingHoursEnd = '17:00',
    excludeWeekends = true
  } = args || {}

  // Ensure calendar is synced before querying
  await ensureCalendarSynced(client, userId, startDate, endDate)

  const timezone = await getUserTimezone(client, userId)
  const normalizedDuration = clampDurationMinutes(durationMinutes)
  const safeStartTime = normalizeTimeInput(workingHoursStart, '09:00')
  const safeEndTime = normalizeTimeInput(workingHoursEnd, '17:00')

  const now = new Date()
  const parsedStart = parseDateInput(startDate, now)
  const parsedEnd = parseDateInput(endDate, addDays(parsedStart, 7))

  let rangeStart = startOfZonedDay(parsedStart, timezone)
  let rangeEnd = endOfZonedDay(parsedEnd, timezone)
  const maxRangeDays = 30
  if (rangeEnd.getTime() - rangeStart.getTime() > maxRangeDays * 24 * 60 * 60 * 1000) {
    rangeEnd = endOfZonedDay(addDays(rangeStart, maxRangeDays), timezone)
  }
  if (rangeEnd <= rangeStart) {
    rangeEnd = endOfZonedDay(addDays(rangeStart, 1), timezone)
  }

  console.log('[CALENDAR-AVAILABILITY] Querying events:', {
    userId,
    rangeStart: rangeStart.toISOString(),
    rangeEnd: rangeEnd.toISOString(),
    timezone
  })

  // Query events that overlap with the time range
  // An event overlaps if: start_time < rangeEnd AND end_time > rangeStart
  // Also exclude deleted/cancelled events
  const { data: rawEvents, error } = await client
    .from('calendar_events')
    .select(`
      id,
      title,
      start_time,
      end_time,
      location,
      status,
      meeting_url,
      deal_id,
      contact_id,
      attendees:calendar_attendees(name, email)
    `)
    .eq('user_id', userId)
    .lt('start_time', rangeEnd.toISOString())
    .gt('end_time', rangeStart.toISOString())
    .neq('status', 'cancelled')
    .neq('sync_status', 'deleted')
    .order('start_time', { ascending: true })

  if (error) {
    console.error('[CALENDAR-AVAILABILITY] Query error:', error)
    throw new Error(`Failed to read calendar events: ${error.message}`)
  }

  console.log('[CALENDAR-AVAILABILITY] Found events:', {
    count: rawEvents?.length || 0,
    events: rawEvents?.slice(0, 5).map((e: any) => ({
      title: e.title,
      start: e.start_time,
      end: e.end_time
    }))
  })

  let meetingFallbackEvents: any[] = []
  if (!rawEvents || rawEvents.length === 0) {
    const { data: meetingRows, error: meetingError } = await client
      .from('meetings')
      .select(`
        id,
        title,
        meeting_start,
        meeting_end,
        duration_minutes,
        owner_user_id,
        company_id,
        primary_contact_id
      `)
      .eq('owner_user_id', userId)
      .gte('meeting_start', rangeStart.toISOString())
      .lte('meeting_start', rangeEnd.toISOString())

    if (!meetingError && meetingRows && meetingRows.length > 0) {
      meetingFallbackEvents = meetingRows
        .filter(meeting => meeting.meeting_start)
        .map(meeting => {
          const startIso = meeting.meeting_start
          const endIso =
            meeting.meeting_end ||
            (meeting.meeting_start && meeting.duration_minutes
              ? new Date(new Date(meeting.meeting_start).getTime() + meeting.duration_minutes * 60000).toISOString()
              : meeting.meeting_start)

          return {
            id: `meeting-${meeting.id}`,
            title: meeting.title || 'Meeting',
            start_time: startIso,
            end_time: endIso,
            location: null,
            status: 'confirmed',
            meeting_url: null,
            deal_id: meeting.company_id,
            contact_id: meeting.primary_contact_id,
            attendees: [],
            source: 'meetings'
          }
        })
    }
  }

  const combinedEvents = [...(rawEvents || []), ...meetingFallbackEvents]

  const normalizedEvents = combinedEvents
    .map(event => {
      const start = new Date(event.start_time)
      const end = new Date(event.end_time)
      return {
        ...event,
        start,
        end
      }
    })
    .filter(event => !isNaN(event.start.getTime()) && !isNaN(event.end.getTime()))
    .sort((a, b) => a.start.getTime() - b.start.getTime())

  const availabilitySlots: Array<{ start: string; end: string; durationMinutes: number }> = []
  const allSlots: Array<{ start: Date; end: Date; durationMinutes: number; slotType: '60min' | '30min' }> = []

  let dayCursor = new Date(rangeStart)
  while (dayCursor <= rangeEnd) {
    const { weekday } = getZonedDateParts(dayCursor, timezone)
    if (!(excludeWeekends && (weekday === 0 || weekday === 6))) {
      const dayWorkStart = zonedTimeOnDate(dayCursor, safeStartTime, timezone)
      let dayWorkEnd = zonedTimeOnDate(dayCursor, safeEndTime, timezone)
      if (dayWorkEnd <= dayWorkStart) {
        dayWorkEnd = addMinutes(dayWorkStart, 8 * 60)
      }

      const overlappingEvents = normalizedEvents
        .map(event => ({
          start: new Date(Math.max(event.start.getTime(), dayWorkStart.getTime())),
          end: new Date(Math.min(event.end.getTime(), dayWorkEnd.getTime()))
        }))
        .filter(interval => interval.end > interval.start)

      const mergedBusy = mergeIntervals(overlappingEvents)

      // Calculate slots for both 60-min and 30-min durations
      // Strategy: Prioritize 60-min slots, fall back to 30-min for smaller gaps
      const freeSlots60 = calculateFreeSlotsForDay(dayWorkStart, dayWorkEnd, mergedBusy, 60)
      const freeSlots30 = calculateFreeSlotsForDay(dayWorkStart, dayWorkEnd, mergedBusy, 30)

      // Mark 60-min slots
      for (const slot of freeSlots60) {
        allSlots.push({ ...slot, slotType: '60min' })
      }

      // Add 30-min slots that don't overlap with 60-min slots (gaps 30-59 min)
      for (const slot30 of freeSlots30) {
        const overlapsWithSlot60 = freeSlots60.some(slot60 =>
          slot30.start.getTime() === slot60.start.getTime()
        )
        // Only add if it's a smaller gap (30-59 min) not covered by 60-min slots
        if (!overlapsWithSlot60 && slot30.durationMinutes < 60) {
          allSlots.push({ ...slot30, slotType: '30min' })
        }
      }
    }

    dayCursor = addDays(dayCursor, 1)
  }

  // Sort by start time
  allSlots.sort((a, b) => a.start.getTime() - b.start.getTime())

  const totalFreeMinutes = allSlots.reduce((sum, slot) => sum + slot.durationMinutes, 0)
  const totalBusyMinutes = normalizedEvents.reduce((sum, event) => {
    const diff = Math.max(0, event.end.getTime() - event.start.getTime())
    return sum + diff / 60000
  }, 0)

  for (const slot of allSlots.slice(0, 25)) {
    availabilitySlots.push({
      start: slot.start.toISOString(),
      end: slot.end.toISOString(),
      durationMinutes: slot.durationMinutes
    })
  }

  const busySlots = normalizedEvents.map(event => ({
    id: event.id,
    title: event.title || 'Busy',
    start: event.start.toISOString(),
    end: event.end.toISOString()
  }))

  return {
    success: true,
    availableSlots: availabilitySlots,
    totalAvailableSlots: allSlots.length,
    busySlots,
    events: combinedEvents,
    summary: {
      totalFreeMinutes,
      totalBusyMinutes,
      totalFreeHours: Number((totalFreeMinutes / 60).toFixed(1)),
      totalBusyHours: Number((totalBusyMinutes / 60).toFixed(1)),
      meetingCount: normalizedEvents.length
    },
    range: {
      start: rangeStart.toISOString(),
      end: rangeEnd.toISOString()
    },
    timezone,
    durationMinutes: normalizedDuration,
    workingHours: {
      start: safeStartTime,
      end: safeEndTime
    },
    excludeWeekends: !!excludeWeekends
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

// Clients CRUD
async function handleClientsCRUD(operation: string, args: any, client: any, userId: string): Promise<any> {
  switch (operation) {
    case 'create': {
      const { company_name, contact_name, contact_email, subscription_amount, status = 'active', deal_id, subscription_start_date } = args
      
      if (!company_name) {
        throw new Error('Company name is required')
      }
      
      const clientData: any = {
        company_name,
        owner_id: userId,
        status
      }
      
      if (contact_name) clientData.contact_name = contact_name
      if (contact_email) clientData.contact_email = contact_email
      if (subscription_amount !== undefined) clientData.subscription_amount = subscription_amount
      if (deal_id) clientData.deal_id = deal_id
      if (subscription_start_date) {
        clientData.subscription_start_date = subscription_start_date
      } else {
        // Default to today if not provided
        clientData.subscription_start_date = new Date().toISOString().split('T')[0]
      }

      const { data, error } = await client
        .from('clients')
        .insert(clientData)
        .select()
        .single()

      if (error) throw new Error(`Failed to create client: ${error.message}`)

      return { success: true, client: data, message: `Client "${company_name}" created successfully` }
    }

    case 'read': {
      const { id, company_name, status, deal_id, limit = 50 } = args

      let query = client
        .from('clients')
        .select('*')
        .eq('owner_id', userId)

      if (id) {
        query = query.eq('id', id).single()
      } else {
        if (company_name) query = query.ilike('company_name', `%${company_name}%`)
        if (status) query = query.eq('status', status)
        if (deal_id) query = query.eq('deal_id', deal_id)
        query = query.order('created_at', { ascending: false }).limit(limit)
      }

      const { data, error } = await query

      if (error) throw new Error(`Failed to read clients: ${error.message}`)

      return { success: true, clients: Array.isArray(data) ? data : [data], count: Array.isArray(data) ? data.length : 1 }
    }

    case 'update': {
      const { id, ...updates } = args
      
      if (!id) {
        throw new Error('Client ID is required for update')
      }
      
      // Handle churn_date logic - if status is being set to churned, ensure churn_date is set
      if (updates.status === 'churned' && !updates.churn_date) {
        updates.churn_date = new Date().toISOString().split('T')[0]
      }
      // If status is changing away from churned, clear churn_date
      if (updates.status && updates.status !== 'churned' && updates.churn_date === undefined) {
        // Check current status first
        const { data: currentClient } = await client
          .from('clients')
          .select('status')
          .eq('id', id)
          .eq('owner_id', userId)
          .single()
        
        if (currentClient && currentClient.status === 'churned') {
          updates.churn_date = null
        }
      }
      
      const { data, error } = await client
        .from('clients')
        .update(updates)
        .eq('id', id)
        .eq('owner_id', userId)
        .select()
        .single()

      if (error) throw new Error(`Failed to update client: ${error.message}`)

      return { success: true, client: data, message: 'Client updated successfully' }
    }

    case 'delete': {
      const { id } = args
      
      const { error } = await client
        .from('clients')
        .delete()
        .eq('id', id)
        .eq('owner_id', userId)

      if (error) throw new Error(`Failed to delete client: ${error.message}`)

      return { success: true, message: 'Client deleted successfully' }
    }

    default:
      throw new Error(`Unknown operation: ${operation}`)
  }
}

// Emails tool (Gmail search)
async function handleEmailsTool(operation: string, args: any, client: any, userId: string): Promise<any> {
  if (operation !== 'search') {
    throw new Error(`Unknown operation for emails: ${operation}`)
  }

  const {
    contact_email,
    contact_id,
    contact_name,
    query,
    direction = 'both',
    start_date,
    end_date,
    limit = 10,
    label
  } = args || {}

  let resolvedContactId = contact_id || null
  let contactEmail: string | null = contact_email ? String(contact_email).trim() : null
  let contactName: string | null = contact_name ? String(contact_name).trim() : null

  if (!contactEmail && resolvedContactId) {
    const { data } = await client
      .from('contacts')
      .select('id, email, full_name')
      .eq('id', resolvedContactId)
      .eq('owner_id', userId)
      .maybeSingle()
    if (data) {
      contactEmail = data.email || contactEmail
      contactName = data.full_name || contactName
      resolvedContactId = data.id
    }
  }

  if (!contactEmail && contactName) {
    const { data } = await client
      .from('contacts')
      .select('id, email, full_name')
      .eq('owner_id', userId)
      .ilike('full_name', `%${contactName}%`)
      .maybeSingle()
    if (data) {
      contactEmail = data.email || contactEmail
      contactName = data.full_name || contactName
      resolvedContactId = data.id
    }
  }

  const normalizedDirection: 'sent' | 'received' | 'both' =
    direction === 'sent' || direction === 'received' ? direction : 'both'
  const sanitizedLimit = Math.min(Math.max(Number(limit) || 10, 1), 20)

  let messages: GmailMessageSummary[] = []
  let source: 'gmail' | 'activities' | 'none' = 'gmail'
  let warning: string | null = null

  // Check data freshness and log if sync may be needed
  try {
    let emailsQuery = client
      .from('emails')
      .select('updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1);

    // Apply date range filter if provided
    if (start_date) {
      emailsQuery = emailsQuery.gte('received_at', start_date);
    }
    if (end_date) {
      emailsQuery = emailsQuery.lte('received_at', end_date);
    }

    const { data: lastEmail } = await emailsQuery.maybeSingle();

    const lastUpdated = lastEmail ? new Date(lastEmail.updated_at) : null;
    const minutesSinceUpdate = lastUpdated
      ? (Date.now() - lastUpdated.getTime()) / 1000 / 60
      : Infinity;

    console.log('[EMAIL-READ] Data freshness:', {
      lastUpdated: lastUpdated?.toISOString(),
      minutesSinceUpdate: minutesSinceUpdate.toFixed(1),
      isStale: minutesSinceUpdate > 60,
      note: 'Hourly background sync will update stale data',
      startDate: start_date,
      endDate: end_date
    });
  } catch (freshnessError) {
    console.error('[EMAIL-READ] Freshness check error (non-critical):', freshnessError);
  }

  try {
    const gmailResult = await searchGmailMessages(client, userId, {
      contactEmail,
      query: query || contactName || contactEmail || null,
      limit: sanitizedLimit,
      direction: normalizedDirection,
      startDate: start_date || null,
      endDate: end_date || null,
      label: label || null
    })
    messages = gmailResult.messages
  } catch (error) {
    warning = error.message || 'Unable to reach Gmail'
    console.error('[EMAILS_TOOL] Gmail search failed:', error)
    if (resolvedContactId) {
      messages = await fetchEmailActivitiesFallback(client, userId, resolvedContactId, sanitizedLimit)
      source = messages.length ? 'activities' : 'none'
    } else {
      source = 'none'
    }
  }

  return {
    success: true,
    source,
    warning,
    messages,
    matchedContact: {
      contact_id: resolvedContactId,
      contact_email: contactEmail,
      contact_name: contactName
    }
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
 * Gmail + Communication Helpers
 */
async function refreshGmailAccessToken(
  client: any,
  integrationId: string,
  userId: string,
  refreshToken?: string | null
): Promise<{ accessToken: string; expiresAt: string }> {
  if (!refreshToken) {
    throw new Error('No refresh token available for Gmail integration. Please reconnect your Google account.')
  }

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error('Google OAuth credentials are not configured on the server.')
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    })
  })

  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(payload.error_description || payload.error?.message || 'Failed to refresh Gmail token')
  }

  const expiresAtDate = new Date()
  expiresAtDate.setSeconds(expiresAtDate.getSeconds() + (payload.expires_in || 3600))

  await client
    .from('google_integrations')
    .update({
      access_token: payload.access_token,
      expires_at: expiresAtDate.toISOString()
    })
    .eq('id', integrationId)

  return {
    accessToken: payload.access_token,
    expiresAt: expiresAtDate.toISOString()
  }
}

async function getGmailAccessToken(
  client: any,
  userId: string
): Promise<{ accessToken: string; integrationId: string }> {
  const { data: integration, error } = await client
    .from('google_integrations')
    .select('id, access_token, refresh_token, expires_at')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !integration) {
    throw new Error('Google integration not found. Connect your Gmail account in Settings.')
  }

  let accessToken = integration.access_token
  const expiresAt = integration.expires_at ? new Date(integration.expires_at) : null
  const needsRefresh = !accessToken || (expiresAt && expiresAt.getTime() <= Date.now() + 60_000)

  if (needsRefresh) {
    const refreshed = await refreshGmailAccessToken(client, integration.id, userId, integration.refresh_token)
    accessToken = refreshed.accessToken
  }

  return { accessToken, integrationId: integration.id }
}

function extractEmailsFromHeader(header?: string): string[] {
  if (!header) return []
  const matches = header.match(/[\w.+-]+@[\w.-]+\.\w+/g)
  if (!matches) return []
  return matches.map(email => email.trim())
}

function sanitizeSubject(subject?: string): string {
  if (!subject || !subject.trim()) return '(No subject)'
  return subject.trim()
}

function determineDirection(
  contactEmail: string | null,
  fromList: string[],
  toList: string[]
): 'sent' | 'received' | 'unknown' {
  if (!contactEmail) return 'unknown'
  const normalized = contactEmail.toLowerCase()
  if (fromList.some(email => email.toLowerCase() === normalized)) return 'received'
  if (toList.some(email => email.toLowerCase() === normalized)) return 'sent'
  return 'unknown'
}

function toUnixTimestamp(dateString?: string | null): number | null {
  if (!dateString) return null
  const parsed = new Date(dateString)
  if (isNaN(parsed.getTime())) return null
  return Math.floor(parsed.getTime() / 1000)
}

async function searchGmailMessages(
  client: any,
  userId: string,
  options: {
    contactEmail?: string | null
    query?: string | null
    limit?: number
    direction?: 'sent' | 'received' | 'both'
    startDate?: string | null
    endDate?: string | null
    label?: string | null
  }
): Promise<{ messages: GmailMessageSummary[]; source: 'gmail' }> {
  const { accessToken } = await getGmailAccessToken(client, userId)
  const limit = Math.min(Math.max(options.limit || 10, 1), 20)

  const qParts: string[] = []
  if (options.contactEmail) {
    const normalizedEmail = options.contactEmail.trim()
    if (options.direction === 'sent') {
      qParts.push(`to:${normalizedEmail}`)
    } else if (options.direction === 'received') {
      qParts.push(`from:${normalizedEmail}`)
    } else {
      qParts.push(`(from:${normalizedEmail} OR to:${normalizedEmail})`)
    }
  }

  if (options.query) {
    const safeQuery = options.query.replace(/"/g, '').trim()
    if (safeQuery) qParts.push(`"${safeQuery}"`)
  }

  if (options.label) {
    const safeLabel = options.label.replace(/"/g, '').trim()
    if (safeLabel) qParts.push(`label:"${safeLabel}"`)
  }

  const after = toUnixTimestamp(options.startDate || null)
  const before = toUnixTimestamp(options.endDate || null)
  if (after) qParts.push(`after:${after}`)
  if (before) qParts.push(`before:${before}`)

  const params = new URLSearchParams({
    maxResults: String(limit)
  })
  if (qParts.length > 0) {
    params.set('q', qParts.join(' '))
  }

  const listResponse = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  })

  if (listResponse.status === 404) {
    return { messages: [], source: 'gmail' }
  }

  const listPayload = await listResponse.json().catch(() => ({}))
  if (!listResponse.ok) {
    throw new Error(listPayload.error?.message || 'Failed to fetch Gmail messages')
  }

  const messageRefs = (listPayload.messages || []).slice(0, limit)
  if (messageRefs.length === 0) {
    return { messages: [], source: 'gmail' }
  }

  const baseHeaders = ['Subject', 'From', 'To', 'Date']

  const detailedResults = await Promise.allSettled(
    messageRefs.map(async (msg: any) => {
      const detailUrl = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`)
      detailUrl.searchParams.set('format', 'metadata')
      baseHeaders.forEach(header => detailUrl.searchParams.append('metadataHeaders', header))

      const detailResponse = await fetch(detailUrl.toString(), {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      })

      if (!detailResponse.ok) {
        return null
      }

      const detail = await detailResponse.json()
      const headerList = detail.payload?.headers || []
      const getHeader = (name: string) => headerList.find((h: any) => h.name === name)?.value || ''
      const subject = sanitizeSubject(getHeader('Subject'))
      const snippet = detail.snippet || ''
      const sentDate = getHeader('Date')
      const date = sentDate
        ? new Date(sentDate).toISOString()
        : detail.internalDate
          ? new Date(Number(detail.internalDate)).toISOString()
          : new Date().toISOString()
      const fromList = extractEmailsFromHeader(getHeader('From'))
      const toList = extractEmailsFromHeader(getHeader('To'))

      return {
        id: detail.id,
        threadId: detail.threadId,
        subject,
        snippet,
        date,
        from: fromList,
        to: toList,
        historyId: detail.historyId,
        direction: determineDirection(options.contactEmail || null, fromList, toList),
        link: detail.threadId ? `https://mail.google.com/mail/u/0/#inbox/${detail.threadId}` : undefined
      } as GmailMessageSummary
    })
  )

  const messages: GmailMessageSummary[] = []
  for (const result of detailedResults) {
    if (result.status === 'fulfilled' && result.value) {
      messages.push(result.value)
    }
  }

  return { messages, source: 'gmail' }
}

async function fetchEmailActivitiesFallback(
  client: any,
  userId: string,
  contactId?: string | null,
  limit: number = 10
): Promise<GmailMessageSummary[]> {
  if (!contactId) return []

  const { data, error } = await client
    .from('activities')
    .select('id, details, date')
    .eq('user_id', userId)
    .eq('contact_id', contactId)
    .eq('type', 'email')
    .order('date', { ascending: false })
    .limit(limit)

  if (error || !data) {
    if (error) console.error('Error fetching fallback activities:', error)
    return []
  }

  return data.map((activity: any) => ({
    id: activity.id,
    subject: sanitizeSubject(activity.details?.substring(0, 80) || 'Email'),
    snippet: activity.details || '',
    date: activity.date,
    direction: 'unknown' as const,
    from: [],
    to: [],
    historyId: undefined,
    threadId: undefined,
    link: undefined
  }))
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

interface ContactResolutionResult {
  contact: ContactData | null
  contactEmail: string | null
  contactName: string | null
  searchTerm: string | null
}

async function resolveContactReference(
  client: any,
  userId: string,
  userMessage: string,
  context?: ChatRequest['context']
): Promise<ContactResolutionResult> {
  let contact: ContactData | null = null
  let contactEmail: string | null = null
  let contactName: string | null = null
  let searchTerm: string | null = null

  // Context contactId takes priority
  if (context?.contactId && isValidUUID(context.contactId)) {
    const { data } = await client
      .from('contacts')
      .select('id, first_name, last_name, full_name, email, company_id, companies:company_id(id, name)')
      .eq('id', context.contactId)
      .eq('owner_id', userId)
      .maybeSingle()
    if (data) {
      contact = data as ContactData
    }
  }

  const emailPattern = /[\w\.-]+@[\w\.-]+\.\w+/
  const emailMatch = userMessage.match(emailPattern)
  if (emailMatch) {
    contactEmail = emailMatch[0].toLowerCase()
    if (!contact) {
      const { data } = await client
        .from('contacts')
        .select('id, first_name, last_name, full_name, email, company_id, companies:company_id(id, name)')
        .eq('email', contactEmail)
        .eq('owner_id', userId)
        .maybeSingle()
      if (data) {
        contact = data as ContactData
      }
    }
  }

  if (!contact) {
    const { nameCandidate, companyCandidate } = extractNameAndCompanyFromMessage(userMessage)
    if (nameCandidate) {
      searchTerm = nameCandidate
      let contactsQuery = client
        .from('contacts')
        .select('id, first_name, last_name, full_name, email, company_id, companies:company_id(id, name)')
        .eq('owner_id', userId)
      const nameParts = nameCandidate.split(/\s+/).filter(Boolean)
      if (nameParts.length > 1) {
        const first = nameParts[0]
        const last = nameParts.slice(1).join(' ')
        contactsQuery = contactsQuery.or(`full_name.ilike.%${nameCandidate}%,first_name.ilike.%${first}%,last_name.ilike.%${last}%`)
      } else {
        contactsQuery = contactsQuery.or(`first_name.ilike.%${nameCandidate}%,full_name.ilike.%${nameCandidate}%`)
      }
      if (companyCandidate) {
        contactsQuery = contactsQuery.ilike('companies.name', `%${companyCandidate}%`)
      }
      const { data: contacts } = await contactsQuery.limit(5)
      if (contacts && contacts.length > 0) {
        contact = contacts[0] as ContactData
      }
    }
  }

  if (contact && contact.email) {
    contactEmail = contact.email
  }

  if (!contactName) {
    contactName = contact?.full_name || `${contact?.first_name || ''} ${contact?.last_name || ''}`.trim() || searchTerm || contactEmail
  }

  return {
    contact,
    contactEmail,
    contactName,
    searchTerm
  }
}

function extractNameAndCompanyFromMessage(
  message: string
): { nameCandidate: string | null; companyCandidate: string | null } {
  const atPattern = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\s+at\s+([A-Z][\w& ]+)/i
  const atMatch = message.match(atPattern)
  if (atMatch && atMatch[1]) {
    return {
      nameCandidate: atMatch[1].trim(),
      companyCandidate: atMatch[2]?.trim() || null
    }
  }

  const patterns = [
    /emails?\s+from\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})/i,
    /emails?\s+to\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})/i,
    /with\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})/i,
    /about\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})/i,
    /regarding\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})/i
  ]

  for (const pattern of patterns) {
    const match = message.match(pattern)
    if (match && match[1]) {
      return { nameCandidate: match[1].trim(), companyCandidate: null }
    }
  }

  return { nameCandidate: null, companyCandidate: null }
}

function extractEmailLimitFromMessage(message: string): number {
  const limitPattern = /last\s+(\d+)\s+emails?/i
  const fallbackPattern = /(\d+)\s+(?:recent|latest)\s+emails?/i
  const match = message.match(limitPattern) || message.match(fallbackPattern)
  if (match && match[1]) {
    const parsed = parseInt(match[1], 10)
    if (!isNaN(parsed)) {
      return Math.min(Math.max(parsed, 3), 20)
    }
  }
  return 10
}

function detectEmailDirection(messageLower: string): 'sent' | 'received' | 'both' {
  if (
    messageLower.includes('emails to') ||
    messageLower.includes('email to') ||
    messageLower.includes('that i sent') ||
    messageLower.includes('i sent') ||
    messageLower.includes('from me')
  ) {
    return 'sent'
  }
  if (
    messageLower.includes('emails from') ||
    messageLower.includes('email from') ||
    messageLower.includes('from ') && messageLower.includes('email')
  ) {
    return 'received'
  }
  return 'both'
}

function extractDateRangeFromMessage(
  messageLower: string
): { startDate?: string | null; endDate?: string | null } {
  const now = new Date()
  const startOfDay = (date: Date) => {
    const d = new Date(date)
    d.setHours(0, 0, 0, 0)
    return d
  }
  const endOfDay = (date: Date) => {
    const d = new Date(date)
    d.setHours(23, 59, 59, 999)
    return d
  }
  const subtractDays = (days: number) => {
    const d = new Date(now)
    d.setDate(d.getDate() - days)
    return d
  }

  if (messageLower.includes('today')) {
    return { startDate: startOfDay(now).toISOString(), endDate: endOfDay(now).toISOString() }
  }

  if (messageLower.includes('yesterday')) {
    const yesterday = subtractDays(1)
    return { startDate: startOfDay(yesterday).toISOString(), endDate: endOfDay(yesterday).toISOString() }
  }

  const daysMatch = messageLower.match(/last\s+(\d+)\s+days?/)
  if (daysMatch && daysMatch[1]) {
    const days = parseInt(daysMatch[1], 10)
    if (!isNaN(days)) {
      return { startDate: subtractDays(days).toISOString(), endDate: null }
    }
  }

  if (messageLower.includes('last week')) {
    return { startDate: subtractDays(7).toISOString(), endDate: null }
  }

  if (messageLower.includes('last two weeks')) {
    return { startDate: subtractDays(14).toISOString(), endDate: null }
  }

  if (messageLower.includes('last month')) {
    return { startDate: subtractDays(30).toISOString(), endDate: null }
  }

  return {}
}

function extractLabelFromMessage(message: string): string | null {
  const quotedLabel = message.match(/label\s+(?:named\s+)?["']([^"']+)["']/i)
  if (quotedLabel && quotedLabel[1]) {
    return quotedLabel[1].trim()
  }

  const simpleLabel = message.match(/label\s+(?:called\s+)?([A-Za-z0-9 \-_]+)/i)
  if (simpleLabel && simpleLabel[1]) {
    const label = simpleLabel[1].trim()
    if (label) {
      // Remove trailing question words
      return label.replace(/\?$/, '').trim()
    }
  }

  return null
}

/**
 * Check if a message is asking about calendar availability
 */
function isAvailabilityQuestion(messageLower: string): boolean {
  if (!messageLower) return false

  const triggerPhrases = [
    'when am i free',
    'when am i available',
    'when do i have time',
    'when can i meet',
    'find a free slot',
    'find availability',
    'free on',
    'free next',
    'available on',
    'available next',
    'do i have time',
    'open slots',
    'open time',
    'find time to meet',
    'find time next week'
  ]

  // Calendar event queries (what's on calendar, what meetings, etc.)
  const calendarEventPhrases = [
    'what\'s on my calendar',
    'what\'s on my schedule',
    'what meetings',
    'what events',
    'show me my calendar',
    'show me my schedule',
    'calendar on',
    'schedule on',
    'meetings on',
    'events on'
  ]

  const weekdayKeywords = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
  const containsTrigger = triggerPhrases.some(phrase => messageLower.includes(phrase))
  const containsCalendarEvent = calendarEventPhrases.some(phrase => messageLower.includes(phrase))
  const mentionsFree = messageLower.includes('free') || messageLower.includes('availability') || messageLower.includes('available')
  const mentionsWeekday = weekdayKeywords.some(day => messageLower.includes(day))
  const mentionsRelativeWeek = messageLower.includes('next week') || messageLower.includes('this week')
  
  return containsTrigger || containsCalendarEvent || (mentionsFree && (mentionsWeekday || mentionsRelativeWeek))
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
  requestingUserId?: string, // Admin user making the request
  context?: ChatRequest['context'],
  toolExecutions: ToolExecutionDetail[] = [] // Detailed tool execution metadata
): Promise<StructuredResponse | null> {
  const messageLower = userMessage.toLowerCase()
  
  // Store original message for limit extraction
  const originalMessage = userMessage
  
  if (isAvailabilityQuestion(messageLower)) {
    const availabilityStructured = await structureCalendarAvailabilityResponse(
      client,
      userId,
      userMessage,
      context?.temporalContext
    )
    if (availabilityStructured) {
      return availabilityStructured
    }
  }

  // Check if calendar_read was used (for specific event searches)
  if (toolExecutions && toolExecutions.length > 0) {
    const calendarReadExecution = toolExecutions.find(exec =>
      exec.toolName === 'calendar_read' && exec.success
    )

    if (calendarReadExecution && calendarReadExecution.result) {
      console.log('[CALENDAR-SEARCH] Found calendar_read execution, structuring response')
      const calendarStructured = await structureCalendarSearchResponse(
        client,
        userId,
        calendarReadExecution.result,
        userMessage,
        context?.temporalContext
      )
      if (calendarStructured) {
        return calendarStructured
      }
    }
  }

  // FIRST: Check if there are successful write operations (create/update/delete) in tool executions
  // If so, generate an action summary response instead of defaulting to pipeline/task summaries
  if (toolExecutions && toolExecutions.length > 0) {
    const writeOperations = toolExecutions.filter(exec => {
      if (!exec.success) return false
      const toolName = exec.toolName
      // Check if it's a write operation (create, update, delete)
      return toolName.includes('_create') || toolName.includes('_update') || toolName.includes('_delete')
    })
    
    if (writeOperations.length > 0) {
      console.log('[ACTION-SUMMARY] Found write operations, generating action summary:', writeOperations.map(e => e.toolName))
      const actionSummary = await structureActionSummaryResponse(client, userId, writeOperations, userMessage)
      if (actionSummary) {
        return actionSummary
      }
    }
  }
  
  // FIRST: Detect email draft requests (check BEFORE task creation to avoid "follow-up email" triggering task creation)
  const isEmailDraftRequest =
    (messageLower.includes('draft') && messageLower.includes('email')) ||
    (messageLower.includes('write') && messageLower.includes('email')) ||
    (messageLower.includes('follow-up') && messageLower.includes('email')) ||
    (messageLower.includes('follow up') && messageLower.includes('email')) ||
    (messageLower.includes('followup') && messageLower.includes('email')) ||
    messageLower.includes('email to') ||
    messageLower.includes('compose email') ||
    (messageLower.includes('send') && messageLower.includes('email'))

  if (isEmailDraftRequest) {
    console.log('[EMAIL-DRAFT] Detected email draft request:', userMessage)
    const structured = await structureEmailDraftResponse(client, userId, userMessage, aiContent, context)
    if (structured) {
      return structured
    }
  }

  // Detect task creation requests (check before activity creation)
  // IMPORTANT: Exclude requests that mention "email" to prevent "follow-up email" from creating a task
  const taskCreationKeywords = [
    'create a task', 'add a task', 'new task', 'create task', 'add task',
    'remind me to', 'remind me', 'remind to', 'remind',
    'schedule a task', 'set a task', 'task to',
    'todo to', 'to-do to', 'follow up with', 'follow-up with',
    'follow up', 'follow-up', 'followup'
  ]

  // Exclude if the message is about email (e.g., "follow-up email")
  const isAboutEmail = messageLower.includes('email')

  const isTaskCreationRequest =
    !isAboutEmail && (
      taskCreationKeywords.some(keyword => messageLower.includes(keyword)) ||
      (messageLower.includes('task') && (messageLower.includes('create') || messageLower.includes('add') || messageLower.includes('for') || messageLower.includes('to'))) ||
      (messageLower.includes('remind') && (messageLower.includes('to') || messageLower.includes('me') || messageLower.includes('about'))) ||
      (messageLower.includes('follow') && (messageLower.includes('up') || messageLower.includes('with'))) ||
      (messageLower.includes('reminder') && (messageLower.includes('for') || messageLower.includes('about')))
    )

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
  
  // NOTE: Email draft detection moved to top of function (before task creation detection)
  // to ensure "follow-up email" triggers email drafting, not task creation

  const emailHistoryKeywords = [
    'last email',
    'last emails',
    'recent email',
    'recent emails',
    'emails from',
    'emails with',
    'emails have',
    'emails did',
    'email history',
    'communication history',
    'email thread',
    'gmail',
    'inbox',
    'messages from',
    'latest emails',
    'label'
  ]

  const genericEmailQuery =
    messageLower.includes('email') && (
      messageLower.includes('show') ||
      messageLower.includes('find') ||
      messageLower.includes('list') ||
      messageLower.includes('last') ||
      messageLower.includes('past') ||
      messageLower.includes('recent') ||
      messageLower.includes('what') ||
      messageLower.includes('have i had') ||
      messageLower.includes('label') ||
      messageLower.includes('this evening') ||
      messageLower.includes('tonight') ||
      messageLower.includes('today') ||
      messageLower.includes('hours')
    )

  const wantsEmailHistory =
    emailHistoryKeywords.some(keyword => messageLower.includes(keyword)) ||
    genericEmailQuery

  if (wantsEmailHistory) {
    const structured = await structureCommunicationHistoryResponse(client, userId, userMessage, context)
    if (structured) {
      return structured
    }
  }
  
  // Detect calendar/meeting queries
  const weekdayKeywords = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
  const calendarBaseKeywords = [
    'meeting',
    'calendar',
    'schedule',
    'availability',
    'free time',
    'free slot',
    'free slots',
    'when am i free',
    'am i free',
    'when am i available',
    'when am i open',
    'available on',
    'available next',
    'find time',
    'find availability',
    'book time',
    'open slot',
    'free this',
    'free next',
    'free on'
  ]
  const mentionsWeekday = weekdayKeywords.some(keyword => messageLower.includes(keyword))
  const mentionsFreeOrAvailable = messageLower.includes('free') || messageLower.includes('available')
  const isCalendarQuery =
    calendarBaseKeywords.some(keyword => messageLower.includes(keyword)) ||
    (mentionsFreeOrAvailable && mentionsWeekday) ||
    (mentionsFreeOrAvailable && messageLower.includes('next week')) ||
    (mentionsFreeOrAvailable && messageLower.includes('this week'))

  if (isCalendarQuery) {
    const availabilityKeywords = [
      'when am i free',
      'free this',
      'free on',
      'find time',
      'find availability',
      'availability',
      'free time',
      'open slot',
      'book time',
      'available on',
      'next free',
      'available slots'
    ]

    const wantsAvailability =
      availabilityKeywords.some(keyword => messageLower.includes(keyword)) ||
      (messageLower.includes('free') && (messageLower.includes('when') || messageLower.includes('what'))) ||
      messageLower.includes('free on') ||
      messageLower.includes('open time')

    if (wantsAvailability) {
      const structured = await structureCalendarAvailabilityResponse(
        client, 
        userId, 
        userMessage,
        context?.temporalContext
      )
      if (structured) {
        return structured
      }
    }

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
      .eq('owner_id', userId)
    
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
 * Structure email draft response with AI-generated content
 * Generates a complete email draft with context, suggestions, and actions
 */
async function structureEmailDraftResponse(
  client: any,
  userId: string,
  userMessage: string,
  aiContent: string,
  context: any
): Promise<any> {
  try {
    console.log('[EMAIL-DRAFT] Structuring email draft response for:', userMessage)

    // Detect if user wants email based on their last meeting
    const hasLastMeetingReference =
      /last meeting|recent meeting|recent call|today'?s meeting|our meeting|our call|the meeting|my meeting/i.test(userMessage)

    console.log('[EMAIL-DRAFT] Has last meeting reference:', hasLastMeetingReference)

    // Extract contact/recipient information from message
    const namePatterns = [
      /(?:email|write|draft|send).*(?:to|for)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
      /follow[- ]?up.*(?:with|to)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
      /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s*(?:'s|about|regarding)/i
    ]

    let recipientName: string | null = null
    for (const pattern of namePatterns) {
      const match = userMessage.match(pattern)
      if (match && match[1]) {
        recipientName = match[1].trim()
        break
      }
    }

    // Search for matching contact
    let contact: any = null
    let contactEmail: string | null = null
    let companyName: string | null = null

    if (recipientName) {
      const nameParts = recipientName.split(/\s+/)
      const firstName = nameParts[0] || ''
      const lastName = nameParts.slice(1).join(' ') || ''

      let contactsQuery = client
        .from('contacts')
        .select('id, first_name, last_name, full_name, email, company_id, companies:company_id(id, name)')
        .eq('owner_id', userId)

      if (firstName && lastName) {
        contactsQuery = contactsQuery.or(`first_name.ilike.%${firstName}%,last_name.ilike.%${lastName}%,full_name.ilike.%${recipientName}%`)
      } else if (firstName) {
        contactsQuery = contactsQuery.or(`first_name.ilike.%${firstName}%,full_name.ilike.%${firstName}%`)
      }

      const { data: contacts } = await contactsQuery.limit(1)

      if (contacts && contacts.length > 0) {
        contact = contacts[0]
        contactEmail = contact.email
        companyName = contact.companies?.name || null
        recipientName = contact.full_name || `${contact.first_name || ''} ${contact.last_name || ''}`.trim()
      }
    }

    // If user references "last meeting", fetch it with transcript/summary
    let lastMeeting: any = null
    if (hasLastMeetingReference) {
      console.log('[EMAIL-DRAFT] Fetching last meeting with transcript for user:', userId)

      // Only look at meetings from the last 14 days
      const fourteenDaysAgo = new Date()
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)
      const dateFilter = fourteenDaysAgo.toISOString()

      console.log('[EMAIL-DRAFT] Looking for meetings after:', dateFilter)

      const { data: meetings, error: meetingError } = await client
        .from('meetings')
        .select(`
          id, title, summary, transcript_text, meeting_start,
          meeting_action_items(id, title, completed),
          meeting_attendees(name, email, is_external)
        `)
        .eq('owner_user_id', userId)
        .gte('meeting_start', dateFilter)
        .or('transcript_text.not.is.null,summary.not.is.null')
        .order('meeting_start', { ascending: false })
        .limit(1)

      if (meetingError) {
        console.error('[EMAIL-DRAFT] Error fetching last meeting:', meetingError)
      } else if (meetings && meetings.length > 0) {
        lastMeeting = meetings[0]
        console.log('[EMAIL-DRAFT] Found last meeting:', lastMeeting.title, '- Has summary:', !!lastMeeting.summary, '- Has transcript:', !!lastMeeting.transcript_text)
        console.log('[EMAIL-DRAFT] Meeting attendees:', JSON.stringify(lastMeeting.meeting_attendees))

        // For "last meeting" requests, ALWAYS use meeting attendee as recipient (overwrite any previous)
        if (lastMeeting.meeting_attendees?.length > 0) {
          // First try to find explicitly marked external attendee
          let targetAttendee = lastMeeting.meeting_attendees.find((a: any) => a.is_external === true)

          // If no external flag, find any attendee with an email that looks external
          if (!targetAttendee) {
            // Get user's email to exclude them
            const { data: userProfile } = await client
              .from('profiles')
              .select('email')
              .eq('id', userId)
              .maybeSingle()

            const userEmail = userProfile?.email?.toLowerCase() || ''

            // Find first attendee that isn't the user
            targetAttendee = lastMeeting.meeting_attendees.find((a: any) =>
              a.email && a.email.toLowerCase() !== userEmail
            )

            console.log('[EMAIL-DRAFT] No is_external flag, searching for non-user attendee. User email:', userEmail)
          }

          if (targetAttendee && targetAttendee.email) {
            recipientName = targetAttendee.name || recipientName
            contactEmail = targetAttendee.email
            console.log('[EMAIL-DRAFT] Using meeting attendee as recipient:', recipientName, contactEmail)
          } else {
            console.log('[EMAIL-DRAFT] No suitable attendee found with email')
          }
        }
      } else {
        console.log('[EMAIL-DRAFT] No meetings found with transcript or summary')
      }
    }

    // Get last interaction with this contact if we found one
    let lastInteraction = 'No previous interaction recorded'
    let lastInteractionDate = ''

    // If we found a meeting via "last meeting" reference, use that as last interaction
    if (lastMeeting) {
      const meetingTitle = lastMeeting.title || 'Recent meeting'
      const meetingDate = lastMeeting.meeting_start
        ? new Date(lastMeeting.meeting_start).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
        : 'recently'
      lastInteraction = `Meeting: ${meetingTitle} (${meetingDate})`
      lastInteractionDate = lastMeeting.meeting_start
    }

    if (contact?.id) {
      // Check for recent meetings
      const { data: recentMeetings } = await client
        .from('meetings')
        .select('id, title, start_time')
        .eq('owner_user_id', userId)
        .contains('attendee_emails', contact.email ? [contact.email] : [])
        .order('start_time', { ascending: false })
        .limit(1)

      if (recentMeetings && recentMeetings.length > 0) {
        const meeting = recentMeetings[0]
        lastInteraction = `Meeting: ${meeting.title}`
        lastInteractionDate = meeting.start_time
      }

      // Check for recent activities/communications
      const { data: recentActivities } = await client
        .from('activities')
        .select('id, type, notes, created_at')
        .eq('user_id', userId)
        .eq('contact_id', contact.id)
        .order('created_at', { ascending: false })
        .limit(1)

      if (recentActivities && recentActivities.length > 0) {
        const activity = recentActivities[0]
        if (!lastInteractionDate || new Date(activity.created_at) > new Date(lastInteractionDate)) {
          lastInteraction = `${activity.type}: ${activity.notes?.substring(0, 50) || 'No details'}...`
          lastInteractionDate = activity.created_at
        }
      }
    }

    // Determine email tone
    let tone: 'professional' | 'friendly' | 'concise' = 'professional'
    if (/casual|friendly|informal/i.test(userMessage)) {
      tone = 'friendly'
    } else if (/brief|short|quick|concise/i.test(userMessage)) {
      tone = 'concise'
    }

    // Determine email purpose and generate subject/body
    let subject = 'Following up'
    let body = ''
    let keyPoints: string[] = []

    const isFollowUp = /follow[- ]?up/i.test(userMessage)
    const isMeetingRelated = /meeting|call|chat|discuss/i.test(userMessage)
    const isProposalRelated = /proposal|quote|pricing|offer/i.test(userMessage)

    // Helper function to extract key points from meeting
    const extractMeetingKeyPoints = (meeting: any): string[] => {
      const points: string[] = []

      // From summary - handle JSON format with markdown_formatted field
      if (meeting.summary) {
        let summaryText = meeting.summary

        // Try to parse as JSON if it looks like JSON
        if (typeof summaryText === 'string' && (summaryText.startsWith('{') || summaryText.startsWith('{'))) {
          try {
            const parsed = JSON.parse(summaryText)
            summaryText = parsed.markdown_formatted || parsed.summary || summaryText
          } catch (e) {
            // Not JSON, use as-is
            console.log('[EMAIL-DRAFT] Summary is not JSON, using raw text')
          }
        } else if (typeof summaryText === 'object' && summaryText.markdown_formatted) {
          summaryText = summaryText.markdown_formatted
        }

        // Extract key takeaways section if present
        const keyTakeawaysMatch = summaryText.match(/##\s*Key\s*Takeaways?\s*\n([\s\S]*?)(?=\n##|$)/i)
        if (keyTakeawaysMatch) {
          const takeawaysSection = keyTakeawaysMatch[1]
          // Extract bullet points, clean markdown links and formatting
          const bulletPoints = takeawaysSection
            .split('\n')
            .filter((l: string) => l.trim().match(/^[-*]\s+/))
            .map((l: string) => {
              // Remove bullet, links [text](url), and bold **text**
              return l
                .replace(/^[-*]\s+/, '')
                .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
                .replace(/\*\*([^*]+)\*\*/g, '$1')
                .replace(/^\*\*([^:]+):\*\*\s*/, '')
                .trim()
            })
            .filter((l: string) => l.length > 10 && l.length < 200)
            .slice(0, 4)
          points.push(...bulletPoints)
        }

        // Fallback: extract from Next Steps section
        if (points.length === 0) {
          const nextStepsMatch = summaryText.match(/##\s*Next\s*Steps?\s*\n([\s\S]*?)(?=\n##|$)/i)
          if (nextStepsMatch) {
            const stepsSection = nextStepsMatch[1]
            const stepPoints = stepsSection
              .split('\n')
              .filter((l: string) => l.trim().match(/^[-*]\s+/))
              .map((l: string) => l.replace(/^[-*]\s+/, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\*\*([^*]+)\*\*/g, '$1').trim())
              .filter((l: string) => l.length > 10 && l.length < 200)
              .slice(0, 3)
            points.push(...stepPoints)
          }
        }

        // Last fallback: extract Meeting Purpose
        if (points.length === 0) {
          const purposeMatch = summaryText.match(/##\s*Meeting\s*Purpose\s*\n([\s\S]*?)(?=\n##|$)/i)
          if (purposeMatch) {
            const purpose = purposeMatch[1]
              .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
              .replace(/\*\*([^*]+)\*\*/g, '$1')
              .trim()
            if (purpose.length > 10 && purpose.length < 200) {
              points.push(purpose)
            }
          }
        }

        console.log('[EMAIL-DRAFT] Extracted key points from summary:', points.length)
      }

      // From action items - include uncompleted ones
      if (meeting.meeting_action_items?.length > 0) {
        const actionItems = meeting.meeting_action_items
          .filter((item: any) => !item.completed)
          .slice(0, 3)
          .map((item: any) => item.title)
        points.push(...actionItems)
      }

      return points.length > 0 ? points : ['Discuss next steps', 'Review key decisions']
    }

    // Generate email based on meeting context if available
    if ((isFollowUp || hasLastMeetingReference) && lastMeeting) {
      // Use actual meeting content for the email
      const meetingTitle = lastMeeting.title || 'our recent conversation'
      const meetingDate = lastMeeting.meeting_start
        ? new Date(lastMeeting.meeting_start).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
        : 'recently'

      subject = `Following up on ${meetingTitle}`
      keyPoints = extractMeetingKeyPoints(lastMeeting)

      // Build contextual body from meeting content
      let discussionPoints = ''
      if (keyPoints.length > 0 && (lastMeeting.summary || lastMeeting.meeting_action_items?.length > 0)) {
        discussionPoints = `\n\nKey points from our discussion:\n${keyPoints.map(p => `• ${p}`).join('\n')}`
      }

      // Check for action items to mention
      let actionItemsSection = ''
      const uncompletedActions = lastMeeting.meeting_action_items?.filter((a: any) => !a.completed) || []
      if (uncompletedActions.length > 0) {
        actionItemsSection = `\n\nAs discussed, here are the action items we agreed on:\n${uncompletedActions.slice(0, 4).map((a: any) => `• ${a.title}`).join('\n')}`
      }

      body = `Hi ${recipientName || '[Name]'},

Thank you for taking the time to meet with me on ${meetingDate}. I wanted to follow up on our conversation about ${meetingTitle.replace(/^Meeting with /i, '').replace(/^Call with /i, '')}.${discussionPoints}${actionItemsSection}

Please let me know if you have any questions or if there's anything else I can help with.

Best regards`

      console.log('[EMAIL-DRAFT] Generated email from meeting context:', { meetingTitle, keyPointsCount: keyPoints.length, hasActionItems: uncompletedActions.length > 0 })
    } else if (isFollowUp && isMeetingRelated) {
      // Fallback if no meeting found but user mentioned meeting
      subject = `Following up on our recent conversation`
      keyPoints = ['Thank them for their time', 'Recap key discussion points', 'Outline next steps']
      body = `Hi ${recipientName || '[Name]'},

Thank you for taking the time to speak with me recently. I wanted to follow up on our conversation and ensure we're aligned on the next steps.

[Add key discussion points from the meeting]

Please let me know if you have any questions or if there's anything else I can help with.

Best regards`
    } else if (isFollowUp && isProposalRelated) {
      subject = `Following up on our proposal`
      keyPoints = ['Reference the proposal', 'Ask if they have questions', 'Offer to discuss further']
      body = `Hi ${recipientName || '[Name]'},

I wanted to follow up on the proposal I sent over. I hope you've had a chance to review it.

Please let me know if you have any questions or would like to discuss any aspect of the proposal in more detail.

Looking forward to hearing from you.

Best regards`
    } else if (isFollowUp) {
      subject = `Following up`
      keyPoints = ['Reference last interaction', 'State purpose clearly', 'Include call to action']
      body = `Hi ${recipientName || '[Name]'},

I hope this message finds you well. I wanted to follow up on our previous conversation.

[Add context from your last interaction]

Would you have time for a quick call this week to discuss further?

Best regards`
    } else {
      subject = 'Reaching out'
      keyPoints = ['Introduce yourself/purpose', 'Provide value proposition', 'Clear call to action']
      body = `Hi ${recipientName || '[Name]'},

I hope this email finds you well.

[State your purpose for reaching out]

I'd love to schedule a brief call to discuss how we might be able to help.

Best regards`
    }

    // Calculate best send time (business hours, avoid Monday morning and Friday afternoon)
    const now = new Date()
    let sendTime = new Date()
    const hour = now.getHours()
    const day = now.getDay()

    // If it's outside business hours, suggest next business day at 9am
    if (hour < 9 || hour > 17 || day === 0 || day === 6) {
      sendTime.setDate(sendTime.getDate() + (day === 6 ? 2 : day === 0 ? 1 : 0))
      sendTime.setHours(9, 0, 0, 0)
    } else {
      // Suggest sending in 30 minutes
      sendTime.setMinutes(sendTime.getMinutes() + 30)
    }

    const response = {
      type: 'email',
      summary: recipientName
        ? `Here's a draft email for ${recipientName}. Review and customize before sending.`
        : `Here's a draft email. Add recipient details and customize before sending.`,
      data: {
        email: {
          to: contactEmail ? [contactEmail] : [],
          cc: [],
          subject,
          body,
          tone,
          sendTime: sendTime.toISOString()
        },
        context: {
          contactName: recipientName || 'Unknown',
          lastInteraction,
          lastInteractionDate: lastInteractionDate || new Date().toISOString(),
          dealValue: undefined,
          keyPoints,
          warnings: recipientName ? undefined : ['No recipient specified - please add email address']
        },
        suggestions: [
          {
            label: 'Make it shorter',
            action: 'shorten' as const,
            description: 'Condense the email to key points only'
          },
          {
            label: 'Change tone to friendly',
            action: 'change_tone' as const,
            description: 'Make the email more casual and approachable'
          },
          {
            label: 'Add calendar link',
            action: 'add_calendar_link' as const,
            description: 'Include a scheduling link for easy booking'
          }
        ]
      },
      actions: [
        {
          label: 'Send Email',
          type: 'send_email',
          primary: true,
          disabled: !contactEmail
        },
        {
          label: 'Edit in Gmail',
          type: 'edit_in_gmail',
          href: contactEmail ? `https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(contactEmail)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}` : undefined
        },
        {
          label: 'Copy to Clipboard',
          type: 'copy_email'
        }
      ],
      metadata: {
        timeGenerated: new Date().toISOString(),
        dataSource: contact ? ['contacts', 'meetings', 'activities'] : ['user_message'],
        contactId: contact?.id,
        recipientEmail: contactEmail
      }
    }

    console.log('[EMAIL-DRAFT] Generated email response for:', recipientName || 'unknown recipient')
    return response

  } catch (error) {
    console.error('[EMAIL-DRAFT] Error structuring email draft:', error)
    // Return a basic email template on error
    return {
      type: 'email',
      summary: 'Here\'s a draft email template. Customize it for your needs.',
      data: {
        email: {
          to: [],
          subject: 'Following up',
          body: `Hi [Name],

I hope this message finds you well. I wanted to follow up on our previous conversation.

[Add your message here]

Best regards`,
          tone: 'professional' as const
        },
        context: {
          contactName: 'Unknown',
          lastInteraction: 'Unable to retrieve',
          lastInteractionDate: new Date().toISOString(),
          keyPoints: ['Add recipient', 'Customize message', 'Review before sending'],
          warnings: ['Could not load contact information']
        },
        suggestions: []
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
      .eq('owner_id', userId)
    
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
        .eq('owner_id', userId)
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
          .eq('owner_id', userId)
        
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
 * Structure communication history response (emails)
 */
async function structureCommunicationHistoryResponse(
  client: any,
  userId: string,
  userMessage: string,
  context?: ChatRequest['context']
): Promise<StructuredResponse | null> {
  try {
    const messageLower = userMessage.toLowerCase()
    const { contact, contactEmail, contactName, searchTerm } = await resolveContactReference(client, userId, userMessage, context)
    const contactId = contact?.id || null
    const labelFilter = extractLabelFromMessage(userMessage)
    const limit = extractEmailLimitFromMessage(userMessage)
    const direction = detectEmailDirection(messageLower)
    const { startDate, endDate } = extractDateRangeFromMessage(messageLower)

    let emails: GmailMessageSummary[] = []
    const dataSource: string[] = []
    let warning: string | null = null

    try {
      const gmailResult = await searchGmailMessages(client, userId, {
        contactEmail,
        query: contactEmail ? null : searchTerm || null,
        limit,
        direction,
        startDate: startDate || null,
        endDate: endDate || null,
        label: labelFilter || null
      })
      emails = gmailResult.messages
      dataSource.push('gmail')
    } catch (error) {
      warning = error.message || 'Unable to reach Gmail'
      console.error('[COMM-HISTORY] Gmail fetch failed:', error)
      if (contact?.id) {
        const fallback = await fetchEmailActivitiesFallback(client, userId, contact.id, limit)
        if (fallback.length) {
          emails = fallback
          dataSource.push('activities')
        }
      }
    }

    const sortedEmails = [...emails].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    const communications = sortedEmails.map(email => ({
      id: email.id,
      type: 'email' as const,
      subject: email.subject,
      summary: email.snippet,
      date: email.date,
      direction: email.direction,
      participants: [...new Set([...email.from, ...email.to])]
    }))

    const timeline = sortedEmails.map(email => ({
      id: `${email.id}-timeline`,
      date: email.date,
      type: 'email',
      title: `${email.direction === 'received' ? 'Received' : email.direction === 'sent' ? 'Sent' : 'Email'}: ${email.subject}`,
      description: email.snippet,
      relatedTo: contactName || contactEmail || searchTerm || undefined
    }))

    const mostRecent = sortedEmails[0]
    const emailsSent = sortedEmails.filter(email => email.direction === 'sent').length
    const summaryStats = {
      totalCommunications: communications.length,
      emailsSent,
      callsMade: 0,
      meetingsHeld: 0,
      lastContact: mostRecent?.date,
      communicationFrequency: communications.length >= limit
        ? 'high'
        : communications.length >= Math.max(3, Math.floor(limit / 2))
          ? 'medium'
          : 'low'
    }

    const overdueFollowUps: Array<{
      id: string
      type: 'email'
      title: string
      dueDate: string
      daysOverdue: number
      contactId?: string
      contactName?: string
      dealId?: string
      dealName?: string
    }> = []
    if (contactId && mostRecent) {
      const daysSince = Math.floor((Date.now() - new Date(mostRecent.date).getTime()) / (1000 * 60 * 60 * 24))
      if (daysSince >= 5) {
        overdueFollowUps.push({
          id: `followup-${mostRecent.id}`,
          type: 'email',
          title: `Follow up with ${contactName || 'this contact'}`,
          dueDate: mostRecent.date,
          daysOverdue: daysSince,
          contactId,
          contactName: contactName || undefined
        })
      }
    }

    const nextActions: Array<{
      id: string
      type: 'email'
      title: string
      dueDate?: string
      priority: 'high' | 'medium' | 'low'
      contactId?: string
      contactName?: string
      dealId?: string
      dealName?: string
    }> = []
    if (contactId) {
      nextActions.push({
        id: 'send-follow-up',
        type: 'email',
        title: `Draft a follow-up to ${contactName || 'this contact'}`,
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        priority: 'high',
        contactId,
        contactName: contactName || undefined
      })
    }

    const actions: Array<{
      id: string
      label: string
      type: 'primary' | 'secondary' | 'tertiary'
      icon: string
      callback: string
      params?: any
    }> = []
    if (contactId) {
      actions.push({
        id: 'view-contact',
        label: 'Open Contact',
        type: 'primary',
        icon: 'user',
        callback: `/crm/contacts/${contactId}`
      })
      actions.push({
        id: 'create-follow-up-task',
        label: 'Create Follow-up Task',
        type: 'secondary',
        icon: 'check-square',
        callback: 'create_task',
        params: {
          title: `Follow up with ${contactName || 'contact'}`,
          contactId,
          taskType: 'email',
          priority: 'high'
        }
      })
    }
    if (mostRecent?.link) {
      actions.push({
        id: 'open-gmail-thread',
        label: 'Open in Gmail',
        type: 'tertiary',
        icon: 'mail',
        callback: mostRecent.link
      })
    }

    const scopeDescription = labelFilter
      ? `tagged "${labelFilter}"`
      : contactName
        ? `with ${contactName}`
        : contactEmail
          ? `with ${contactEmail}`
          : 'from your inbox'

    const summary = communications.length
      ? `Here are the last ${communications.length} emails ${scopeDescription}.`
      : warning
        ? `I couldn't load Gmail data ${scopeDescription}: ${warning}.`
        : `I couldn't find any recent emails ${scopeDescription}.`

    return {
      type: 'communication_history',
      summary,
      data: {
        contactId,
        contactName: contactName || undefined,
        communications,
        timeline,
        overdueFollowUps,
        nextActions,
        summary: summaryStats
      },
      actions,
      metadata: {
        timeGenerated: new Date().toISOString(),
        dataSource: dataSource.length ? dataSource : ['gmail_unavailable'],
        totalCount: communications.length,
        warning
      }
    }
  } catch (error) {
    console.error('[COMM-HISTORY] Failed to structure response:', error)
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
        meeting_id,
        contacts:contact_id(id, first_name, last_name),
        deals:deal_id(id, name),
        companies:company_id(id, name),
        meetings:meeting_id(id, title)
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
            meetingId: task.meeting_id,
            meetingName: task.meetings?.title,
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
        // Only calculate if date is valid
        if (!isNaN(dueDate.getTime())) {
          const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate())
          daysUntilDue = Math.floor((dueDateOnly.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
          // Only mark as overdue if it's reasonably in the past (not more than 1 year)
          // This prevents false positives from data errors
          isOverdue = daysUntilDue < 0 && daysUntilDue > -365
        }
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
        meetingId: task.meeting_id,
        meetingName: task.meetings?.title,
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
 * Structure calendar event search results for Copilot UI
 */
async function structureCalendarSearchResponse(
  client: any,
  userId: string,
  calendarReadResult: any,
  userMessage: string,
  temporalContext?: TemporalContextPayload
): Promise<StructuredResponse | null> {
  try {
    const timezone = await getUserTimezone(client, userId)
    const currentDate = temporalContext?.isoString
      ? new Date(temporalContext.isoString)
      : new Date()

    // Extract events from the calendar_read result
    const events = calendarReadResult?.events || []

    if (events.length === 0) {
      return null // Let AI respond with "no events found"
    }

    console.log('[CALENDAR-SEARCH] Structuring response for', events.length, 'events')

    // Map events to the format expected by CalendarResponse component
    const meetings = events.map((event: any) => {
      const startTime = event.start_time
      const endTime = event.end_time
      const startDateObj = new Date(startTime)
      let status: 'past' | 'today' | 'upcoming' = 'upcoming'

      if (startDateObj.getTime() < currentDate.getTime()) {
        status = 'past'
      } else if (isSameZonedDay(startDateObj, timezone, currentDate)) {
        status = 'today'
      }

      const attendees = (event.attendees || []).map((att: any) => ({
        name: att.name || att.email || 'Attendee',
        email: att.email || ''
      }))

      return {
        id: event.id,
        title: event.title || 'Calendar Event',
        attendees,
        startTime,
        endTime,
        status,
        location: event.location || undefined,
        hasPrepBrief: false,
        dealId: event.deal_id || undefined,
        contactId: event.contact_id || undefined
      }
    })

    // Generate appropriate summary
    const summary = events.length === 1
      ? `I found your ${events[0].title || 'event'}.`
      : `I found ${events.length} event${events.length === 1 ? '' : 's'}.`

    // Add relevant actions
    const actions: Array<{
      id: string
      label: string
      type: 'primary' | 'secondary' | 'tertiary'
      icon: string
      callback: string
      params?: any
    }> = [
      {
        id: 'open-calendar',
        label: 'Open Calendar',
        type: 'primary',
        icon: 'calendar',
        callback: '/calendar'
      }
    ]

    return {
      type: 'calendar',
      summary,
      data: {
        meetings,
        availability: [] // No availability slots for search results
      },
      actions,
      metadata: {
        timeGenerated: new Date().toISOString(),
        dataSource: ['calendar_events'],
        timezone,
        eventCount: events.length
      }
    }
  } catch (error) {
    console.error('[CALENDAR-SEARCH] Error structuring response:', error)
    return null
  }
}

/**
 * Structure calendar availability info for Copilot UI
 */
async function structureCalendarAvailabilityResponse(
  client: any,
  userId: string,
  userMessage?: string,
  temporalContext?: TemporalContextPayload
): Promise<StructuredResponse | null> {
  try {
    const timezone = await getUserTimezone(client, userId)
    // Use temporal context date if available, otherwise fall back to current date
    const currentDate = temporalContext?.isoString 
      ? new Date(temporalContext.isoString) 
      : new Date()
    const request = inferAvailabilityRequestFromMessage(userMessage, timezone, currentDate)

    const availabilityResult = await handleCalendarAvailability(
      {
        startDate: request.start.toISOString(),
        endDate: request.end.toISOString(),
        durationMinutes: request.durationMinutes,
        workingHoursStart: request.workingHoursStart,
        workingHoursEnd: request.workingHoursEnd,
        excludeWeekends: request.excludeWeekends
      },
      client,
      userId
    )

    if (!availabilityResult) {
      return null
    }

    const now = currentDate
    const meetings = (availabilityResult.events || []).map((event: any) => {
      const startTime = event.start_time
      const endTime = event.end_time
      const startDateObj = new Date(startTime)
      let status: 'past' | 'today' | 'upcoming' = 'upcoming'
      if (startDateObj.getTime() < now.getTime()) {
        status = 'past'
      } else if (isSameZonedDay(startDateObj, timezone, currentDate)) {
        status = 'today'
      }

      const attendees = (event.attendees || []).map((att: any) => ({
        name: att.name || att.email || 'Attendee',
        email: att.email || ''
      }))

      return {
        id: event.id,
        title: event.title || 'Calendar Event',
        attendees,
        startTime,
        endTime,
        status,
        location: event.location || undefined,
        hasPrepBrief: false,
        dealId: event.deal_id || undefined,
        contactId: event.contact_id || undefined
      }
    }).slice(0, 10)

    const availabilitySlots = (availabilityResult.availableSlots || []).map((slot: any) => ({
      startTime: slot.start,
      endTime: slot.end,
      duration: slot.durationMinutes
    }))

    const slotSummary = availabilitySlots.length > 0
      ? formatAvailabilitySlotSummary(availabilitySlots[0], timezone)
      : null

    const summary = availabilitySlots.length > 0
      ? `You're free ${slotSummary}. I found ${availabilitySlots.length} open slot${availabilitySlots.length === 1 ? '' : 's'} ${request.description}.`
      : `No ${request.durationMinutes}-minute blocks are available ${request.description}. Try expanding the range or adjusting working hours.`

    const actions: Array<{
      id: string
      label: string
      type: 'primary' | 'secondary' | 'tertiary'
      icon: string
      callback: string
      params?: any
    }> = [
      {
        id: 'open-calendar',
        label: 'Open Calendar',
        type: 'primary',
        icon: 'calendar',
        callback: '/calendar'
      }
    ]

    if (availabilitySlots.length > 0) {
      actions.push({
        id: 'copy-availability',
        label: 'Copy availability summary',
        type: 'secondary',
        icon: 'clipboard',
        callback: 'copilot://copy-availability',
        params: {
          timezone,
          slots: availabilitySlots.slice(0, 3)
        }
      })
    }

    return {
      type: 'calendar',
      summary,
      data: {
        meetings,
        availability: availabilitySlots
      },
      actions,
      metadata: {
        timeGenerated: new Date().toISOString(),
        dataSource: ['calendar_events'],
        timezone,
        dateRange: availabilityResult.range,
        requestedDurationMinutes: availabilityResult.durationMinutes,
        workingHours: availabilityResult.workingHours,
        slotsEvaluated: availabilityResult.totalAvailableSlots,
        totalFreeMinutes: availabilityResult.summary?.totalFreeMinutes,
        totalBusyMinutes: availabilityResult.summary?.totalBusyMinutes
      }
    }
  } catch (error) {
    console.error('[STRUCTURED] Error building calendar availability response', error)
    return null
  }
}

/**
 * Shared helpers for calendar availability calculations
 */
function clampDurationMinutes(value: number): number {
  if (!value || Number.isNaN(value)) {
    return 60
  }
  return Math.min(240, Math.max(15, Math.round(value)))
}

function normalizeTimeInput(value: string | undefined, fallback: string): string {
  const pattern = /^([01]?\d|2[0-3]):([0-5]\d)$/
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (pattern.test(trimmed)) {
      const [hours, minutes] = trimmed.split(':')
      return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`
    }
  }
  return fallback
}

function parseDateInput(value?: string, fallback?: Date): Date {
  if (value) {
    const parsed = new Date(value)
    if (!isNaN(parsed.getTime())) {
      return parsed
    }
  }
  return fallback ? new Date(fallback) : new Date()
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setUTCDate(result.getUTCDate() + days)
  return result
}

function addMinutes(date: Date, minutes: number): Date {
  const result = new Date(date)
  result.setTime(result.getTime() + minutes * 60000)
  return result
}

function startOfZonedDay(date: Date, timeZone: string): Date {
  const parts = getZonedDateParts(date, timeZone)
  return zonedDateTimeToUtc(parts.year, parts.month, parts.day, 0, 0, 0, timeZone)
}

function endOfZonedDay(date: Date, timeZone: string): Date {
  const parts = getZonedDateParts(date, timeZone)
  return zonedDateTimeToUtc(parts.year, parts.month, parts.day, 23, 59, 59, timeZone)
}

function zonedTimeOnDate(date: Date, timeString: string, timeZone: string): Date {
  const parts = getZonedDateParts(date, timeZone)
  const [hours = '0', minutes = '0'] = timeString.split(':')
  const hourNum = Math.min(23, Math.max(0, parseInt(hours, 10) || 0))
  const minuteNum = Math.min(59, Math.max(0, parseInt(minutes, 10) || 0))
  return zonedDateTimeToUtc(parts.year, parts.month, parts.day, hourNum, minuteNum, 0, timeZone)
}

function getZonedDateParts(
  date: Date,
  timeZone: string
): { year: number; month: number; day: number; weekday: number } {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short'
  })

  const partValues: Record<string, string> = {}
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== 'literal') {
      partValues[part.type] = part.value
    }
  }

  const weekdayMap: Record<string, number> = {
    sun: 0,
    mon: 1,
    tue: 2,
    wed: 3,
    thu: 4,
    fri: 5,
    sat: 6
  }

  const weekday = weekdayMap[(partValues.weekday || '').slice(0, 3).toLowerCase()] ?? 0

  return {
    year: Number(partValues.year),
    month: Number(partValues.month),
    day: Number(partValues.day),
    weekday
  }
}

function zonedDateTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string
): Date {
  const utcDate = new Date(Date.UTC(year, month - 1, day, hour, minute, second))
  const offsetMinutes = getTimezoneOffsetMinutes(timeZone, utcDate)
  return new Date(utcDate.getTime() - offsetMinutes * 60000)
}

function getTimezoneOffsetMinutes(timeZone: string, date: Date): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })

  const partValues: Record<string, string> = {}
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== 'literal') {
      partValues[part.type] = part.value
    }
  }

  const asUTC = Date.UTC(
    Number(partValues.year),
    Number(partValues.month) - 1,
    Number(partValues.day),
    Number(partValues.hour),
    Number(partValues.minute),
    Number(partValues.second)
  )

  return (asUTC - date.getTime()) / 60000
}

function mergeIntervals(intervals: Array<{ start: Date; end: Date }>): Array<{ start: Date; end: Date }> {
  if (!intervals.length) {
    return []
  }
  const sorted = intervals
    .map(interval => ({
      start: new Date(interval.start.getTime()),
      end: new Date(interval.end.getTime())
    }))
    .sort((a, b) => a.start.getTime() - b.start.getTime())

  const merged: Array<{ start: Date; end: Date }> = [sorted[0]]
  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i]
    const last = merged[merged.length - 1]
    if (current.start <= last.end) {
      if (current.end > last.end) {
        last.end = current.end
      }
    } else {
      merged.push(current)
    }
  }
  return merged
}

function calculateFreeSlotsForDay(
  dayStart: Date,
  dayEnd: Date,
  busyIntervals: Array<{ start: Date; end: Date }>,
  durationMinutes: number
): Array<{ start: Date; end: Date; durationMinutes: number }> {
  const available: Array<{ start: Date; end: Date; durationMinutes: number }> = []
  const merged = mergeIntervals(busyIntervals)
  let cursor = new Date(dayStart)

  for (const interval of merged) {
    if (interval.start > cursor) {
      const gapMinutes = (interval.start.getTime() - cursor.getTime()) / 60000
      if (gapMinutes >= durationMinutes) {
        available.push({
          start: new Date(cursor),
          end: new Date(interval.start),
          durationMinutes: gapMinutes
        })
      }
    }
    if (interval.end > cursor) {
      cursor = new Date(interval.end)
    }
  }

  if (cursor < dayEnd) {
    const gapMinutes = (dayEnd.getTime() - cursor.getTime()) / 60000
    if (gapMinutes >= durationMinutes) {
      available.push({
        start: new Date(cursor),
        end: new Date(dayEnd),
        durationMinutes: gapMinutes
      })
    }
  }

  return available
}

async function getUserTimezone(client: any, userId: string): Promise<string> {
  // Priority order:
  // 1. Calendar integration (most accurate - detected from Google Calendar)
  // 2. user_settings.preferences.timezone
  // 3. profiles.timezone (if exists)
  // 4. Default to Europe/London (UK timezone with automatic DST handling)

  try {
    // First, check calendar_calendars for timezone detected from Google Calendar
    const { data: calendarData, error: calendarError } = await client
      .from('calendar_calendars')
      .select('timezone')
      .eq('user_id', userId)
      .eq('external_id', 'primary')
      .maybeSingle()
    
    if (!calendarError && calendarData?.timezone) {
      console.log('[TIMEZONE] Using timezone from calendar integration:', calendarData.timezone)
      return calendarData.timezone
    }
  } catch (_err) {
    // Ignore errors - table might not exist or column might not exist
  }

  try {
    // Check user_settings preferences
    const { data: settingsData, error: settingsError } = await client
      .from('user_settings')
      .select('preferences')
      .eq('user_id', userId)
      .maybeSingle()
    
    if (!settingsError && settingsData?.preferences?.timezone) {
      const tz = settingsData.preferences.timezone
      console.log('[TIMEZONE] Using timezone from user_settings:', tz)
      return tz
    }
  } catch (_err) {
    // Ignore errors
  }

  try {
    // Check profiles table (if exists)
    const { data: profileData, error: profileError } = await client
      .from('profiles')
      .select('timezone')
      .eq('id', userId)
      .maybeSingle()
    
    if (!profileError && profileData?.timezone) {
      console.log('[TIMEZONE] Using timezone from profiles:', profileData.timezone)
      return profileData.timezone
    }
  } catch (_err) {
    // Ignore missing column or table errors
  }

  // Default to Europe/London (UK timezone - automatically handles daylight savings)
  console.log('[TIMEZONE] Using default timezone: Europe/London')
  return 'Europe/London'
}

interface AvailabilityRequestDetails {
  start: Date
  end: Date
  durationMinutes: number
  workingHoursStart: string
  workingHoursEnd: string
  excludeWeekends: boolean
  description: string
}

function inferAvailabilityRequestFromMessage(
  message: string | undefined,
  timeZone: string,
  currentDate: Date = new Date()
): AvailabilityRequestDetails {
  const lower = (message || '').toLowerCase()
  const duration = extractDurationFromMessage(lower) ?? 60
  const workingHoursStart = lower.includes('early morning') ? '08:00' : '09:00'
  const workingHoursEnd = lower.includes('evening') ? '19:00' : '17:00'
  const excludeWeekends = !(lower.includes('weekend') || lower.includes('weekends'))

  let description = 'over the next week'
  let start = startOfZonedDay(currentDate, timeZone)
  let end = endOfZonedDay(addDays(start, 6), timeZone)

  if (lower.includes('today')) {
    start = startOfZonedDay(currentDate, timeZone)
    end = endOfZonedDay(currentDate, timeZone)
    return {
      start,
      end,
      durationMinutes: duration,
      workingHoursStart,
      workingHoursEnd,
      excludeWeekends,
      description: `today (${formatHumanReadableRange(start, end, timeZone)})`
    }
  }

  if (lower.includes('tomorrow')) {
    const tomorrow = addDays(currentDate, 1)
    start = startOfZonedDay(tomorrow, timeZone)
    end = endOfZonedDay(tomorrow, timeZone)
    return {
      start,
      end,
      durationMinutes: duration,
      workingHoursStart,
      workingHoursEnd,
      excludeWeekends,
      description: `tomorrow (${formatHumanReadableRange(start, end, timeZone)})`
    }
  }

  if (lower.includes('next week')) {
    const nextWeekStart = startOfWeekZoned(addDays(currentDate, 7), timeZone)
    start = nextWeekStart
    end = endOfWeekZoned(nextWeekStart, timeZone)
    return {
      start,
      end,
      durationMinutes: duration,
      workingHoursStart,
      workingHoursEnd,
      excludeWeekends,
      description: `next week (${formatHumanReadableRange(start, end, timeZone)})`
    }
  }

  if (lower.includes('this week')) {
    start = startOfWeekZoned(currentDate, timeZone)
    end = endOfWeekZoned(start, timeZone)
    return {
      start,
      end,
      durationMinutes: duration,
      workingHoursStart,
      workingHoursEnd,
      excludeWeekends,
      description: `this week (${formatHumanReadableRange(start, end, timeZone)})`
    }
  }

  const dayMap: Array<{ key: string; index: number }> = [
    { key: 'sunday', index: 0 },
    { key: 'monday', index: 1 },
    { key: 'tuesday', index: 2 },
    { key: 'wednesday', index: 3 },
    { key: 'thursday', index: 4 },
    { key: 'friday', index: 5 },
    { key: 'saturday', index: 6 }
  ]

  for (const day of dayMap) {
    if (lower.includes(day.key)) {
      const preferNextWeek = lower.includes('next week') || lower.includes(`next ${day.key}`) || lower.includes('this coming')
      const dayDate = getNextWeekdayDate(day.index, preferNextWeek, timeZone, currentDate)
      start = startOfZonedDay(dayDate, timeZone)
      end = endOfZonedDay(dayDate, timeZone)
      return {
        start,
        end,
        durationMinutes: duration,
        workingHoursStart,
        workingHoursEnd,
        excludeWeekends,
        description: `on ${formatHumanReadableRange(start, end, timeZone)}`
      }
    }
  }

  return {
    start,
    end,
    durationMinutes: duration,
    workingHoursStart,
    workingHoursEnd,
    excludeWeekends,
    description
  }
}

function extractDurationFromMessage(messageLower: string): number | null {
  if (!messageLower) return null
  const durationMatch = messageLower.match(/(\d+)\s*(?:-?\s*)(minute|minutes|min|mins|hour|hours|hr|hrs)/)
  if (durationMatch && durationMatch[1]) {
    const value = parseInt(durationMatch[1], 10)
    if (!isNaN(value)) {
      if (durationMatch[2].includes('hour') || durationMatch[2].includes('hr')) {
        return clampDurationMinutes(value * 60)
      }
      return clampDurationMinutes(value)
    }
  }
  if (messageLower.includes('half hour') || messageLower.includes('half-hour')) {
    return 30
  }
  if (messageLower.includes('quarter hour') || messageLower.includes('quarter-hour')) {
    return 15
  }
  return null
}

function startOfWeekZoned(date: Date, timeZone: string): Date {
  const start = startOfZonedDay(date, timeZone)
  const { weekday } = getZonedDateParts(date, timeZone)
  const daysToSubtract = (weekday + 6) % 7
  return addDays(start, -daysToSubtract)
}

function endOfWeekZoned(startOfWeek: Date, timeZone: string): Date {
  return endOfZonedDay(addDays(startOfWeek, 6), timeZone)
}

function getNextWeekdayDate(targetDay: number, preferNextWeek: boolean, timeZone: string, currentDate: Date = new Date()): Date {
  const todayStart = startOfZonedDay(currentDate, timeZone)
  const { weekday } = getZonedDateParts(todayStart, timeZone)
  let daysAhead = (targetDay - weekday + 7) % 7
  if (daysAhead === 0 && !preferNextWeek) {
    return todayStart
  }
  if (preferNextWeek) {
    daysAhead = daysAhead === 0 ? 7 : daysAhead + 7
  }
  return addDays(todayStart, daysAhead || 7)
}

function isSameZonedDay(date: Date, timeZone: string, currentDate: Date = new Date()): boolean {
  const partsA = getZonedDateParts(date, timeZone)
  const partsB = getZonedDateParts(currentDate, timeZone)
  return partsA.year === partsB.year && partsA.month === partsB.month && partsA.day === partsB.day
}

function formatHumanReadableRange(start: Date, end: Date, timeZone: string): string {
  const startFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  })
  const endFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    month: 'short',
    day: 'numeric'
  })
  const sameDay = isSameZonedDay(start, timeZone) && isSameZonedDay(end, timeZone)
  if (sameDay) {
    return startFormatter.format(start)
  }
  return `${startFormatter.format(start)} and ${endFormatter.format(end)}`
}

function formatAvailabilitySlotSummary(
  slot: { startTime: string; endTime: string },
  timeZone: string
): string {
  const start = new Date(slot.startTime)
  const end = new Date(slot.endTime)
  const dayFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  })
  const timeFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit'
  })
  return `${dayFormatter.format(start)} at ${timeFormatter.format(start)} – ${timeFormatter.format(end)}`
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
 * Structure action summary response from successful tool executions
 * Groups create/update/delete operations and presents them in a user-friendly format
 */
async function structureActionSummaryResponse(
  client: any,
  userId: string,
  writeOperations: ToolExecutionDetail[],
  userMessage: string
): Promise<StructuredResponse | null> {
  try {
    const actions: Array<{
      id: string
      label: string
      type: string
      icon: string
      callback: string
      params?: any
    }> = []
    
    const actionItems: Array<{
      entityType: string
      operation: string
      entityId?: string
      entityName?: string
      details?: string
      success: boolean
    }> = []
    
    let dealsUpdated = 0
    let clientsUpdated = 0
    let tasksCreated = 0
    let activitiesCreated = 0
    let contactsUpdated = 0
    let calendarEventsUpdated = 0
    
    // Process each write operation
    for (const exec of writeOperations) {
      const [entity, operation] = exec.toolName.split('_')
      const result = exec.result
      
      if (!result || !result.success) continue
      
      let entityType = entity
      let entityId: string | undefined
      let entityName: string | undefined
      let details: string | undefined
      
      // Extract entity information based on operation type
      if (operation === 'create') {
        if (entity === 'pipeline' && result.deal) {
          entityType = 'deal'
          entityId = result.deal.id
          entityName = result.deal.name || result.deal.company
          dealsUpdated++
        } else if (entity === 'clients' && result.client) {
          entityType = 'client'
          entityId = result.client.id
          entityName = result.client.company_name
          if (result.client.subscription_amount) {
            details = `Subscription: £${parseFloat(result.client.subscription_amount).toLocaleString()}/month`
          }
          clientsUpdated++
        } else if (entity === 'tasks' && result.task) {
          entityType = 'task'
          entityId = result.task.id
          entityName = result.task.title
          tasksCreated++
        } else if (entity === 'activities' && result.activity) {
          entityType = 'activity'
          entityId = result.activity.id
          entityName = result.activity.client_name || result.activity.type
          activitiesCreated++
        } else if (entity === 'leads' && result.contact) {
          entityType = 'contact'
          entityId = result.contact.id
          entityName = result.contact.full_name || result.contact.email
          if (result.contact.company_id) {
            details = `Created contact with company link`
          }
          contactsUpdated++
        } else if (entity === 'calendar' && result.event) {
          entityType = 'calendar_event'
          entityId = result.event.id
          entityName = result.event.title
          // Format the event time
          if (result.event.start_time) {
            const startTime = new Date(result.event.start_time)
            const timeStr = startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
            const dateStr = startTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
            details = `Scheduled for ${dateStr} at ${timeStr}`
          } else {
            details = 'Event created successfully'
          }
          calendarEventsUpdated++
        }
      } else if (operation === 'update') {
        if (entity === 'pipeline' && result.deal) {
          entityType = 'deal'
          entityId = result.deal.id
          entityName = result.deal.name || result.deal.company
          // Check if status was updated to 'won'
          if (exec.args.status === 'won') {
            details = 'Marked as closed won'
          } else {
            details = 'Updated successfully'
          }
          dealsUpdated++
        } else if (entity === 'clients' && result.client) {
          entityType = 'client'
          entityId = result.client.id
          entityName = result.client.company_name
          if (exec.args.subscription_amount !== undefined) {
            details = `Subscription updated to £${parseFloat(exec.args.subscription_amount).toLocaleString()}/month`
          } else {
            details = 'Updated successfully'
          }
          clientsUpdated++
        } else if (entity === 'leads' && result.contact) {
          entityType = 'contact'
          entityId = result.contact.id
          entityName = result.contact.full_name || result.contact.email || result.contact.first_name
          // Try to detect what was updated
          if (exec.args.company_id || exec.args.company) {
            details = `Company updated to ${exec.args.company || 'linked company'}`
          } else {
            details = 'Contact updated successfully'
          }
          contactsUpdated++
        } else if (entity === 'calendar' && result.event) {
          entityType = 'calendar_event'
          entityId = result.event.id
          entityName = result.event.title
          // Try to detect what was updated
          if (exec.args.start_time || exec.args.end_time) {
            const startTime = exec.args.start_time ? new Date(exec.args.start_time) : null
            if (startTime) {
              const timeStr = startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
              details = `Rescheduled to ${timeStr}`
            } else {
              details = 'Event updated successfully'
            }
          } else {
            details = 'Event updated successfully'
          }
          calendarEventsUpdated++
        }
      }
      
      if (entityId) {
        actionItems.push({
          entityType,
          operation,
          entityId,
          entityName,
          details,
          success: true
        })
      }
    }
    
    // Generate summary text
    const actionCounts: string[] = []
    if (dealsUpdated > 0) actionCounts.push(`${dealsUpdated} deal${dealsUpdated > 1 ? 's' : ''}`)
    if (clientsUpdated > 0) actionCounts.push(`${clientsUpdated} client${clientsUpdated > 1 ? 's' : ''}`)
    if (contactsUpdated > 0) actionCounts.push(`${contactsUpdated} contact${contactsUpdated > 1 ? 's' : ''}`)
    if (tasksCreated > 0) actionCounts.push(`${tasksCreated} task${tasksCreated > 1 ? 's' : ''}`)
    if (activitiesCreated > 0) actionCounts.push(`${activitiesCreated} activit${activitiesCreated > 1 ? 'ies' : 'y'}`)
    if (calendarEventsUpdated > 0) actionCounts.push(`${calendarEventsUpdated} calendar event${calendarEventsUpdated > 1 ? 's' : ''}`)
    
    const summary = actionCounts.length > 0
      ? `I've successfully completed your request. Updated ${actionCounts.join(', ')}.`
      : "I've completed the requested actions."
    
    // Generate quick actions
    if (dealsUpdated > 0) {
      actions.push({
        id: 'view-pipeline',
        label: 'View Pipeline',
        type: 'primary',
        icon: 'briefcase',
        callback: '/crm/pipeline'
      })
    }
    
    if (clientsUpdated > 0) {
      actions.push({
        id: 'view-clients',
        label: 'View Clients',
        type: 'secondary',
        icon: 'users',
        callback: '/crm/clients'
      })
    }
    
    if (contactsUpdated > 0) {
      actions.push({
        id: 'view-contacts',
        label: 'View Contacts',
        type: 'secondary',
        icon: 'users',
        callback: '/crm/contacts'
      })
    }
    
    if (tasksCreated > 0) {
      actions.push({
        id: 'view-tasks',
        label: 'View Tasks',
        type: 'secondary',
        icon: 'check-circle',
        callback: '/crm/tasks'
      })
    }

    if (calendarEventsUpdated > 0) {
      actions.push({
        id: 'view-calendar',
        label: 'View Calendar',
        type: 'secondary',
        icon: 'calendar',
        callback: '/calendar'
      })
    }

    return {
      type: 'action_summary',
      summary,
      data: {
        actionsCompleted: actionItems.length,
        actionItems,
        metrics: {
          dealsUpdated,
          clientsUpdated,
          contactsUpdated,
          tasksCreated,
          activitiesCreated,
          calendarEventsUpdated
        }
      },
      actions,
      metadata: {
        timeGenerated: new Date().toISOString(),
        dataSource: ['tool_executions'],
        confidence: 100
      }
    }
  } catch (error) {
    console.error('[ACTION-SUMMARY] Error generating action summary:', error)
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

