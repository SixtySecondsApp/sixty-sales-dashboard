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
  context?: {
    userId: string
    currentView?: 'dashboard' | 'contact' | 'pipeline'
    contactId?: string
    dealIds?: string[]
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
    const pathParts = url.pathname.split('/').filter(Boolean)
    const functionName = pathParts[0] // 'api-copilot'
    const endpoint = pathParts[1] // 'chat', 'actions', 'conversations'
    const resourceId = pathParts[2] // conversation ID, etc.

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
    if (req.method === 'POST' && endpoint === 'chat') {
      return await handleChat(client, req, user_id)
    } else if (req.method === 'POST' && endpoint === 'actions' && resourceId === 'draft-email') {
      return await handleDraftEmail(client, req, user_id)
    } else if (req.method === 'GET' && endpoint === 'conversations' && resourceId) {
      return await handleGetConversation(client, resourceId, user_id)
    } else {
      return createErrorResponse('Endpoint not found', 404, 'NOT_FOUND')
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

    // Build context from user's CRM data
    let context = ''
    try {
      context = await buildContext(client, userId, body.context)
    } catch (contextError) {
      // Continue with empty context if buildContext fails
    }

    // Call Claude API with tool support
    const claudeStartTime = Date.now()
    let aiResponse
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

    // Save assistant message
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
    const structuredResponse = await detectAndStructureResponse(
      body.message,
      aiResponse.content,
      client,
      userId
    )

    // Log structured response for debugging
    if (structuredResponse) {
    } else {
    }

    // Return response in the format expected by the frontend
    const responsePayload = {
      response: {
        type: structuredResponse ? structuredResponse.type : (aiResponse.recommendations?.length > 0 ? 'recommendations' : 'text'),
        content: aiResponse.content,
        recommendations: aiResponse.recommendations || [],
        structuredResponse: structuredResponse || undefined
      },
      conversationId,
      timestamp: new Date().toISOString()
    }

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
    description: 'Read tasks with filtering options.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Task ID (for single task)' },
        status: { type: 'string', enum: ['todo', 'in_progress', 'completed', 'cancelled'], description: 'Filter by status' },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'], description: 'Filter by priority' },
        contact_id: { type: 'string', description: 'Filter by contact' },
        deal_id: { type: 'string', description: 'Filter by deal' },
        limit: { type: 'number', default: 50 }
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
      const toolResults = []
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
        } catch (error) {
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

  const operation = parts.pop() // Last part is the operation (create, read, update, delete)
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
        .eq('assigned_to', userId)

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
      
      const { data, error } = await client
        .from('tasks')
        .update(updates)
        .eq('id', id)
        .eq('assigned_to', userId)
        .select()
        .single()

      if (error) throw new Error(`Failed to update task: ${error.message}`)

      return { success: true, task: data, message: 'Task updated successfully' }
    }

    case 'delete': {
      const { id } = args
      
      const { error } = await client
        .from('tasks')
        .delete()
        .eq('id', id)
        .eq('assigned_to', userId)

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
 * Detect intent from user message and structure response accordingly
 */
async function detectAndStructureResponse(
  userMessage: string,
  aiContent: string,
  client: any,
  userId: string
): Promise<any | null> {
  const messageLower = userMessage.toLowerCase()
  
  // Detect pipeline-related queries
  const isPipelineQuery = 
    messageLower.includes('pipeline') ||
    messageLower.includes('deal') ||
    messageLower.includes('deals') ||
    messageLower.includes('what should i prioritize') ||
    messageLower.includes('needs attention') ||
    messageLower.includes('at risk') ||
    messageLower.includes('pipeline health') ||
    (messageLower.includes('show me my') && (messageLower.includes('deal') || messageLower.includes('pipeline')))
  
  if (isPipelineQuery) {
    const structured = await structurePipelineResponse(client, userId, aiContent)
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
  
  // Detect activity queries
  if (
    messageLower.includes('task') ||
    messageLower.includes('activity') ||
    messageLower.includes('follow-up') ||
    messageLower.includes('due')
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
  
  return null
}

/**
 * Structure pipeline response from deals data
 */
async function structurePipelineResponse(
  client: any,
  userId: string,
  aiContent: string
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
    const actions = []
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
        }
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

