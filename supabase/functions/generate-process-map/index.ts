/// <reference path="../deno.d.ts" />

/**
 * Generate Process Map Edge Function
 *
 * Analyzes integration/workflow processes and generates Mermaid diagrams
 * using Claude AI for visualization.
 *
 * Supported process types:
 * - integration: HubSpot, Google, Fathom, Slack, JustCall, SavvyCal
 * - workflow: Meeting Intelligence, Task Extraction, VSL Analytics
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RequestBody {
  action?: 'generate' | 'list'  // default: 'generate'
  processType?: 'integration' | 'workflow'
  processName?: string
  regenerate?: boolean
  // direction is deprecated - we now generate both views
}

interface ProcessMapRecord {
  id: string
  org_id: string
  process_type: string
  process_name: string
  title: string
  description: string | null
  mermaid_code: string | null
  mermaid_code_horizontal: string | null
  mermaid_code_vertical: string | null
  generation_status: 'pending' | 'partial' | 'complete'
  generated_by: string
  version: number
  created_at: string
  updated_at: string
}

// Process descriptions for AI context - ultra concise, one line each
const PROCESS_DESCRIPTIONS: Record<string, Record<string, string>> = {
  integration: {
    hubspot: `Two-way sync of contacts, deals, and tasks with HubSpot CRM via OAuth and webhooks.`,
    google: `Sync Gmail, Calendar, and Tasks via OAuth. Match attendees to CRM contacts.`,
    fathom: `Import meeting recordings via OAuth. Generate thumbnails, transcripts, and AI summaries.`,
    slack: `Send deal alerts and meeting summaries to Slack channels via bot integration.`,
    justcall: `Sync call recordings via API. Fetch transcripts and run AI analysis.`,
    savvycal: `Sync bookings via webhook. Auto-create contacts and log activities.`,
  },
  workflow: {
    meeting_intelligence: `AI analyzes transcripts to generate summaries, action items, and next step suggestions.`,
    task_extraction: `Auto-create tasks from meetings and calls using AI extraction and smart templates.`,
    vsl_analytics: `Track video engagement anonymously for A/B testing across landing page variants.`,
    sentry_bridge: `Convert Sentry error alerts into AI Dev Hub tasks automatically via MCP.`,
    api_optimization: `Reduce API calls 95% with smart polling, batching, and working hours awareness.`,
  },
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Safely parse request body - handle empty or malformed JSON
    let body: RequestBody = { action: 'list' };
    try {
      const text = await req.text();
      if (text && text.trim()) {
        body = JSON.parse(text);
      }
    } catch (parseError) {
      // If no body provided or invalid JSON, default to 'list' action
      console.log('No request body or invalid JSON, defaulting to list action');
    }

    const {
      action = 'generate',
      processType,
      processName,
      regenerate,
    } = body;

    // Validate required fields based on action
    if (action === 'generate' && (!processType || !processName)) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: processType, processName' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client with user auth
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // Get current user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify user is a platform admin (internal + is_admin)
    // Use service role to check admin status securely
    const supabaseService = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Check if user is a platform admin (must be in internal_users AND have is_admin = true)
    const { data: profile, error: profileError } = await supabaseService
      .from('profiles')
      .select('email, is_admin')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user is admin
    if (!profile.is_admin) {
      return new Response(
        JSON.stringify({ error: 'Platform admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user is in internal_users whitelist
    const { data: internalUser, error: internalError } = await supabaseService
      .from('internal_users')
      .select('email')
      .eq('email', profile.email?.toLowerCase())
      .eq('is_active', true)
      .single()

    if (internalError || !internalUser) {
      return new Response(
        JSON.stringify({ error: 'Internal user access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get user's org
    const { data: membership, error: membershipError } = await supabaseClient
      .from('organization_memberships')
      .select('org_id')
      .eq('user_id', user.id)
      .limit(1)
      .single()

    if (membershipError || !membership) {
      return new Response(
        JSON.stringify({ error: 'User not in any organization' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const orgId = membership.org_id

    // Handle LIST action - fetch all process maps for the organization
    if (action === 'list') {
      console.log('Listing process maps for org:', orgId)

      const { data: processMaps, error: listError } = await supabaseService
        .from('process_maps')
        .select('*')
        .eq('org_id', orgId)
        .order('updated_at', { ascending: false })

      if (listError) {
        console.error('Error fetching process maps:', listError)
        return new Response(
          JSON.stringify({ error: 'Failed to fetch process maps', details: listError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log(`Found ${processMaps?.length || 0} process maps`)
      return new Response(
        JSON.stringify({
          processMaps: processMaps || [],
          count: processMaps?.length || 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if process map already exists (unless regenerate)
    // Use service role to avoid RLS issues (since INSERT uses service role too)
    if (!regenerate) {
      const { data: existingMap } = await supabaseService
        .from('process_maps')
        .select('*')  // Select all fields for complete response
        .eq('org_id', orgId)
        .eq('process_type', processType)
        .eq('process_name', processName)
        .order('version', { ascending: false })
        .limit(1)
        .single()

      if (existingMap) {
        return new Response(
          JSON.stringify({
            message: 'Process map already exists',
            processMap: existingMap,
            cached: true
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Get process description
    const processDescription = PROCESS_DESCRIPTIONS[processType]?.[processName]
    if (!processDescription) {
      return new Response(
        JSON.stringify({ error: `Unknown process: ${processType}/${processName}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get current version for this process
    const { data: latestVersion } = await supabaseClient
      .from('process_maps')
      .select('version')
      .eq('org_id', orgId)
      .eq('process_type', processType)
      .eq('process_name', processName)
      .order('version', { ascending: false })
      .limit(1)
      .single()

    const newVersion = (latestVersion?.version || 0) + 1
    const title = formatTitle(processType, processName)

    // Generate BOTH horizontal and vertical diagrams in parallel
    console.log(`Generating both views for ${processType}/${processName}...`)

    const [horizontalResult, verticalResult] = await Promise.allSettled([
      generateMermaidWithClaude(processType, processName, processDescription, 'horizontal'),
      generateMermaidWithClaude(processType, processName, processDescription, 'vertical')
    ])

    const horizontalCode = horizontalResult.status === 'fulfilled' ? horizontalResult.value : null
    const verticalCode = verticalResult.status === 'fulfilled' ? verticalResult.value : null

    // Determine generation status
    let generationStatus: 'pending' | 'partial' | 'complete' = 'pending'
    if (horizontalCode && verticalCode) {
      generationStatus = 'complete'
    } else if (horizontalCode || verticalCode) {
      generationStatus = 'partial'
    }

    // Must have at least one diagram
    if (!horizontalCode && !verticalCode) {
      console.error('Failed to generate any diagrams')
      return new Response(
        JSON.stringify({ error: 'Failed to generate process map' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Generated: horizontal=${!!horizontalCode}, vertical=${!!verticalCode}, status=${generationStatus}`)

    // Store in database with both views
    const { data: processMap, error: insertError } = await supabaseService
      .from('process_maps')
      .insert({
        org_id: orgId,
        process_type: processType,
        process_name: processName,
        title,
        description: processDescription.trim(),
        mermaid_code: verticalCode || horizontalCode, // Keep legacy column populated
        mermaid_code_horizontal: horizontalCode,
        mermaid_code_vertical: verticalCode,
        generation_status: generationStatus,
        generated_by: user.id,
        version: newVersion
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error storing process map:', insertError)
      return new Response(
        JSON.stringify({ error: 'Failed to store process map', details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        message: generationStatus === 'complete'
          ? 'Process map generated successfully (both views)'
          : 'Process map generated partially (one view failed)',
        processMap,
        generated: true,
        generationStatus
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in generate-process-map:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

/**
 * Generate Mermaid diagram using Claude AI
 */
async function generateMermaidWithClaude(
  processType: string,
  processName: string,
  description: string,
  direction: 'horizontal' | 'vertical' = 'horizontal'
): Promise<string | null> {
  const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!anthropicApiKey) {
    throw new Error('AI service not configured')
  }

  const flowDirection = direction === 'horizontal' ? 'LR' : 'TB'
  const flowDescription = direction === 'horizontal'
    ? 'left-to-right (horizontal timeline)'
    : 'top-to-bottom (vertical flow)'

  const systemPrompt = `You are an expert at creating professional, visually stunning Mermaid flowchart diagrams for software processes.

Your task is to create a Mermaid diagram that visualizes the given process flow using our standardized design system.

## DESIGN SCHEMA (REQUIRED)

### 1. FLOW DIRECTION
- Use \`flowchart ${flowDirection}\` - This creates a ${flowDescription}
- This is REQUIRED - do not change the direction

### 2. SUBGRAPHS (Required for organization)
Create 3-5 logical subgraphs with emoji headers. Examples:
- \`subgraph Setup ["🛠️ CONFIGURATION & AUTH"]\`
- \`subgraph Sync ["🔄 SYNC ENGINE"]\`
- \`subgraph Processing ["⚙️ DATA PROCESSING"]\`
- \`subgraph Automation ["⚡ AUTOMATION ENGINE"]\`
- \`subgraph Runtime ["🔔 RUNTIME & NOTIFICATIONS"]\`
- \`subgraph Intelligence ["🧠 AI & INTELLIGENCE"]\`
- \`subgraph Storage ["💾 DATA STORAGE"]\`
- \`subgraph Interaction ["💬 USER INTERACTION"]\`
- \`subgraph Output ["📤 OUTPUT & DELIVERY"]\`

Inside each subgraph, add: \`direction TB\`

### 3. NODE SHAPES (Semantic meaning)
Use these shapes consistently - NO QUOTES inside shapes:
- \`((Text))\` - Start/End terminal nodes (circles)
- \`[Text]\` - Standard process steps (rectangles)
- \`[(Text)]\` - Database/Storage (cylinder) - NO quotes
- \`{Text}\` - Decision/Gateway diamonds - NO quotes
- \`[[Text]]\` - Subroutines/Edge Functions (double border) - NO quotes
- \`>Text]\` - Async/Webhook events (flag shape) - NO quotes

IMPORTANT: Do NOT put quotes inside shape brackets. Keep text simple with no special chars.

### 4. NODE IDs
- Use PascalCase for IDs: \`OAuthGrant\`, \`CredStore\`, \`WebhookSetup\`
- Keep IDs short but descriptive
- No spaces in IDs

### 5. NODE LABELS - CRITICAL RULES
- Keep labels SHORT: 2-4 words MAXIMUM, single line only
- NEVER use \`<br/>\` inside special shapes (cylinders, diamonds, parallelograms, flags)
- NEVER use \`&\` - always use "and" instead
- NEVER use special characters: avoid # : ( ) < > in labels
- For standard rectangles [Text], you MAY use \`<br/>\` for multi-line
- ALWAYS wrap labels in quotes for special shapes

### 6. CONNECTIONS
- \`-->\` Normal flow
- \`==>\` Important/Critical paths (use sparingly, 1-2 max)
- \`-.->\` Optional/Async flow
- Add edge labels: \`-- "Label" -->\` or \`-- Yes -->\`

### 7. REQUIRED STYLING BLOCK (Add at end)
Always include these exact classDef and class assignments.
CRITICAL: All text must be DARK colored for readability. Never use white/light text.

\`\`\`
    %% --- STYLING ---
    classDef primary fill:#e0e7ff,stroke:#4f46e5,stroke-width:2px,color:#1e1b4b
    classDef storage fill:#dbeafe,stroke:#3b82f6,stroke-width:2px,color:#1e3a5f
    classDef logic fill:#fef3c7,stroke:#d97706,stroke-width:2px,color:#78350f
    classDef io fill:#d1fae5,stroke:#059669,stroke-width:2px,color:#064e3b
    classDef terminal fill:#e2e8f0,stroke:#475569,stroke-width:2px,color:#0f172a
    classDef async fill:#fce7f3,stroke:#db2777,stroke-width:2px,color:#831843
    classDef default fill:#f1f5f9,stroke:#64748b,stroke-width:2px,color:#1e293b

    %% IMPORTANT: Apply classes to ALL nodes - no node should be unstyled
    class [START_END_NODES] terminal
    class [DATABASE_NODES] storage
    class [DECISION_NODES] logic
    class [WEBHOOK_ASYNC_NODES] async
    class [ALL_OTHER_NODES] primary

    linkStyle default stroke:#64748b,stroke-width:2px
\`\`\`

IMPORTANT: Every single node MUST have a class assigned. No exceptions.

### 8. SPECIAL CHARACTER HANDLING - CRITICAL
- NEVER use \`&\` anywhere - causes parse errors. Use "and" instead
- NEVER use \`<br/>\` inside special shapes - causes parse errors
- NEVER use quotes inside shape brackets - causes parse errors
- Keep ALL labels simple: letters, numbers, spaces only
- Example GOOD: \`DB[(Credentials)]\`
- Example GOOD: \`Check{Valid Token}\`
- Example BAD: \`DB[("Credentials")]\` - quotes break it
- Example BAD: \`DB[(Token & Info)]\` - ampersand breaks it

## EXAMPLE STRUCTURE:
\`\`\`mermaid
flowchart LR
    subgraph Setup ["🛠️ CONFIGURATION"]
        direction TB
        Start((Start))
        OAuth[OAuth Grant]
        CredStore[(Credentials)]
    end

    subgraph Processing ["⚙️ PROCESSING"]
        direction TB
        Check{Validate}
        Process[[Process Data]]
    end

    Start --> OAuth
    OAuth --> CredStore
    CredStore ==> Check
    Check -- Yes --> Process

    classDef primary fill:#e0e7ff,stroke:#4f46e5,stroke-width:2px,color:#1e1b4b
    classDef storage fill:#dbeafe,stroke:#3b82f6,stroke-width:2px,color:#1e3a5f
    classDef logic fill:#fef3c7,stroke:#d97706,stroke-width:2px,color:#78350f
    classDef terminal fill:#e2e8f0,stroke:#475569,stroke-width:2px,color:#0f172a

    class Start,End terminal
    class CredStore storage
    class Check logic
    class OAuth,Process primary

    linkStyle default stroke:#94a3b8,stroke-width:2px
\`\`\`

CRITICAL: Return ONLY the Mermaid code, no markdown code blocks, no explanation.
The code must be valid Mermaid syntax following this exact design schema.`

  const userPrompt = `Create a Mermaid flowchart diagram for the following ${processType} process:

Process Name: ${processName.replace(/_/g, ' ').toUpperCase()}

Process Description:
${description}

Remember: Return ONLY valid Mermaid code, starting with 'flowchart' or 'graph'.`

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
      max_tokens: 4096,
      temperature: 0.3,
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
    console.error('Claude API error:', errorText)
    throw new Error('AI service error')
  }

  const responseData = await response.json()
  let mermaidCode = responseData.content[0]?.text || ''

  // Clean up the response - remove markdown code blocks if present
  const codeBlockMatch = mermaidCode.match(/```(?:mermaid)?\s*([\s\S]*?)\s*```/)
  if (codeBlockMatch) {
    mermaidCode = codeBlockMatch[1].trim()
  }

  // Ensure it starts with valid Mermaid syntax
  if (!mermaidCode.startsWith('flowchart') && !mermaidCode.startsWith('graph')) {
    console.error('Invalid Mermaid code generated:', mermaidCode.substring(0, 100))
    return null
  }

  // Sanitize the generated code to fix common issues
  mermaidCode = sanitizeMermaidCode(mermaidCode)

  return mermaidCode
}

/**
 * Sanitize Mermaid code to fix common AI generation issues
 */
function sanitizeMermaidCode(code: string): string {
  let sanitized = code

  // Replace & with "and" (common parse error cause)
  sanitized = sanitized.replace(/&(?!amp;|lt;|gt;|quot;)/g, 'and')

  // Fix cylinders with quotes: [("Text")] -> [(Text)]
  sanitized = sanitized.replace(/\[\("([^"]*)"\)\]/g, '[($1)]')

  // Fix diamonds with quotes: {"Text"} -> {Text}
  sanitized = sanitized.replace(/\{"([^"]*)"\}/g, '{$1}')

  // Fix double brackets with quotes: [["Text"]] -> [[Text]]
  sanitized = sanitized.replace(/\[\["([^"]*)"\]\]/g, '[[$1]]')

  // Fix flags with quotes: >"Text"] -> >Text]
  sanitized = sanitized.replace(/>"([^"]*)"\]/g, '>$1]')

  // Fix parallelograms with quotes: [/"Text"/] -> [/Text/]
  sanitized = sanitized.replace(/\[\/"([^"]*)"\/\]/g, '[/$1/]')

  // Remove <br/> from inside any shape brackets and replace with space
  sanitized = sanitized.replace(/<br\s*\/?>/gi, ' ')

  // Clean up any double spaces
  sanitized = sanitized.replace(/  +/g, ' ')

  // Clean up spaces before closing brackets
  sanitized = sanitized.replace(/ +\]/g, ']')
  sanitized = sanitized.replace(/ +\)/g, ')')
  sanitized = sanitized.replace(/ +\}/g, '}')

  return sanitized
}

/**
 * Format process name into readable title
 */
function formatTitle(processType: string, processName: string): string {
  const formattedName = processName
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')

  const typeLabel = processType === 'integration' ? 'Integration' : 'Workflow'
  return `${formattedName} ${typeLabel} Process Map`
}
