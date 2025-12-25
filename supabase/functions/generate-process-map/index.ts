/// <reference path="../deno.d.ts" />

/**
 * Generate Process Map Edge Function
 *
 * Two-Phase AI Generation:
 * - Phase 1: Claude Opus generates structured ProcessStructure JSON (source of truth)
 * - Phase 2: Claude Haiku transforms JSON → Mermaid code (horizontal + vertical)
 *
 * This ensures both views display identical steps, which is critical for the testing system.
 *
 * Supported process types:
 * - integration: HubSpot, Google, Fathom, Slack, JustCall, SavvyCal
 * - workflow: Meeting Intelligence, Task Extraction, VSL Analytics, Sentry Bridge, API Optimization
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Model constants for two-phase generation
const OPUS_MODEL = 'claude-opus-4-5-20251101'
const HAIKU_MODEL = 'claude-haiku-4-5-20251001'

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

// ProcessStructure types (source of truth for both Mermaid and testing)
interface ProcessStructure {
  schemaVersion: '1.0'
  metadata: {
    processType: 'integration' | 'workflow'
    processName: string
    title: string
    description: string
    generatedAt: string
    modelUsed: string
  }
  subgraphs: Array<{
    id: string
    label: string
    nodeIds: string[]
    order: number
  }>
  nodes: Array<{
    id: string
    label: string
    shape: 'terminal' | 'process' | 'storage' | 'decision' | 'subroutine' | 'async'
    subgraphId: string
    executionOrder: number
    stepType: 'trigger' | 'action' | 'condition' | 'transform' | 'external_call' | 'storage' | 'notification'
    integration?: string
    description?: string
    testConfig?: {
      mockable: boolean
      requiresRealApi?: boolean
      operations?: ('read' | 'write' | 'delete')[]
    }
  }>
  connections: Array<{
    from: string
    to: string
    style: 'normal' | 'critical' | 'optional'
    label?: string
  }>
  styling: {
    nodeClasses: {
      terminal: string[]
      storage: string[]
      logic: string[]
      async: string[]
      primary: string[]
    }
  }
}

interface ProcessMapRecord {
  id: string
  org_id: string
  process_type: string
  process_name: string
  title: string
  description: string | null
  process_structure: ProcessStructure | null
  mermaid_code: string | null
  mermaid_code_horizontal: string | null
  mermaid_code_vertical: string | null
  generation_status: 'pending' | 'structure_ready' | 'partial' | 'complete'
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

    // ============================================================================
    // TWO-PHASE GENERATION
    // Phase 1: Opus generates structured ProcessStructure JSON (source of truth)
    // Phase 2: Haiku transforms JSON → Mermaid code (horizontal + vertical)
    // ============================================================================

    console.log(`[Phase 1] Generating process structure with Opus for ${processType}/${processName}...`)

    // Phase 1: Generate ProcessStructure with Opus
    let processStructure: ProcessStructure | null = null
    try {
      processStructure = await generateProcessStructure(processType, processName, processDescription, title)
      console.log(`[Phase 1] Structure generated: ${processStructure?.nodes?.length || 0} nodes, ${processStructure?.connections?.length || 0} connections`)
    } catch (structureError) {
      console.error('[Phase 1] Failed to generate structure:', structureError)
      return new Response(
        JSON.stringify({ error: 'Failed to generate process structure', details: (structureError as Error).message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!processStructure || !processStructure.nodes || processStructure.nodes.length === 0) {
      console.error('[Phase 1] Invalid structure generated')
      return new Response(
        JSON.stringify({ error: 'Invalid process structure generated' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Phase 2: Render BOTH views with Haiku in parallel
    console.log(`[Phase 2] Rendering both Mermaid views with Haiku...`)

    const [horizontalResult, verticalResult] = await Promise.allSettled([
      renderMermaidFromStructure(processStructure, 'horizontal'),
      renderMermaidFromStructure(processStructure, 'vertical')
    ])

    const horizontalCode = horizontalResult.status === 'fulfilled' ? horizontalResult.value : null
    const verticalCode = verticalResult.status === 'fulfilled' ? verticalResult.value : null

    if (horizontalResult.status === 'rejected') {
      console.error('[Phase 2] Horizontal render failed:', horizontalResult.reason)
    }
    if (verticalResult.status === 'rejected') {
      console.error('[Phase 2] Vertical render failed:', verticalResult.reason)
    }

    // Determine generation status
    let generationStatus: 'pending' | 'structure_ready' | 'partial' | 'complete' = 'structure_ready'
    if (horizontalCode && verticalCode) {
      generationStatus = 'complete'
    } else if (horizontalCode || verticalCode) {
      generationStatus = 'partial'
    }

    console.log(`[Phase 2] Rendered: horizontal=${!!horizontalCode}, vertical=${!!verticalCode}, status=${generationStatus}`)

    // Store in database with structure and both views
    const { data: processMap, error: insertError } = await supabaseService
      .from('process_maps')
      .insert({
        org_id: orgId,
        process_type: processType,
        process_name: processName,
        title,
        description: processDescription.trim(),
        process_structure: processStructure, // Store the source of truth JSON
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
          ? 'Process map generated successfully (structure + both views)'
          : generationStatus === 'partial'
          ? 'Process map generated partially (structure + one view)'
          : 'Process structure generated (views pending)',
        processMap,
        generated: true,
        generationStatus,
        nodeCount: processStructure.nodes.length,
        connectionCount: processStructure.connections.length
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

// ============================================================================
// PHASE 1: Generate ProcessStructure with Claude Opus
// ============================================================================

const OPUS_STRUCTURE_SYSTEM_PROMPT = `You are an expert at analyzing software integration processes and creating structured workflow representations.

Your task is to analyze a process description and output a structured JSON representation that captures the complete workflow with all its steps, connections, and organization.

## OUTPUT FORMAT

Return ONLY valid JSON matching this exact structure (no markdown, no explanation):

{
  "schemaVersion": "1.0",
  "metadata": {
    "processType": "<integration|workflow>",
    "processName": "<name>",
    "title": "<Human Readable Title>",
    "description": "<Brief one-line description>",
    "generatedAt": "<ISO timestamp>",
    "modelUsed": "claude-opus-4-5-20251101"
  },
  "subgraphs": [
    {
      "id": "<PascalCaseId>",
      "label": "<Emoji> <UPPERCASE TITLE>",
      "nodeIds": ["<node1>", "<node2>"],
      "order": 0
    }
  ],
  "nodes": [
    {
      "id": "<PascalCaseId>",
      "label": "<2-4 word label>",
      "shape": "<terminal|process|storage|decision|subroutine|async>",
      "subgraphId": "<matching subgraph id>",
      "executionOrder": 1,
      "stepType": "<trigger|action|condition|transform|external_call|storage|notification>",
      "integration": "<optional integration name>",
      "description": "<description for testing>",
      "testConfig": {
        "mockable": true,
        "requiresRealApi": false,
        "operations": ["read"]
      }
    }
  ],
  "connections": [
    {
      "from": "<nodeId>",
      "to": "<nodeId>",
      "style": "<normal|critical|optional>",
      "label": "<optional edge label>"
    }
  ],
  "styling": {
    "nodeClasses": {
      "terminal": ["<nodeIds for start/end>"],
      "storage": ["<nodeIds for database ops>"],
      "logic": ["<nodeIds for decisions>"],
      "async": ["<nodeIds for webhooks/events>"],
      "primary": ["<nodeIds for everything else>"]
    }
  }
}

## GUIDELINES

### Subgraphs (3-5 recommended)
Create logical groupings with emoji headers:
- 🛠️ CONFIGURATION & AUTH - Setup, OAuth, credentials
- 🔄 SYNC ENGINE - Data synchronization steps
- ⚙️ DATA PROCESSING - Transformation, extraction
- ⚡ AUTOMATION ENGINE - Automated actions
- 🔔 NOTIFICATIONS - Alerts, notifications
- 🧠 AI INTELLIGENCE - AI analysis steps
- 💾 DATA STORAGE - Database operations

### Node IDs
- Use PascalCase: OAuthGrant, ContactSync, ValidateToken
- Keep unique and descriptive
- No spaces or special characters

### Node Labels
- MAXIMUM 4 words
- No special characters (no &, #, :, <, >)
- Use "and" instead of "&"
- Simple, clear descriptions

### Shape Selection
- terminal: Start/End points only
- storage: Database, cache, queue operations
- decision: If/else, validation checks
- subroutine: Edge functions, API calls
- async: Webhooks, events, async operations
- process: Everything else

### Step Types (for testing)
- trigger: Entry points (webhooks, scheduled tasks)
- external_call: API calls to external services
- transform: Data transformation, AI processing
- storage: Database read/write
- condition: Branching logic
- action: General actions
- notification: Alerts, messages

### Execution Order
- Start nodes = 1
- Follow dependencies for subsequent numbering
- Parallel steps can share the same order number

### Test Configuration
- mockable: true for most steps
- requiresRealApi: true if step needs live external data
- operations: ["read"], ["write"], ["delete"], or combinations

CRITICAL: Return ONLY the JSON object. No markdown code blocks, no explanation text.`

async function generateProcessStructure(
  processType: string,
  processName: string,
  description: string,
  title: string
): Promise<ProcessStructure> {
  const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!anthropicApiKey) {
    throw new Error('AI service not configured')
  }

  const timestamp = new Date().toISOString()
  const userPrompt = `Analyze this ${processType} process and generate a structured JSON representation:

Process: ${processName.replace(/_/g, ' ').toUpperCase()}
Title: ${title}

Description:
${description}

Current timestamp for generatedAt: ${timestamp}

Generate the complete process structure JSON following the schema exactly.`

  console.log(`[Phase 1] Calling Opus API...`)

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicApiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: OPUS_MODEL,
      max_tokens: 8192,
      temperature: 0.2,
      system: OPUS_STRUCTURE_SYSTEM_PROMPT,
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
    console.error('[Phase 1] Opus API error:', errorText)
    throw new Error(`Opus API error: ${response.status}`)
  }

  const responseData = await response.json()
  let jsonText = responseData.content[0]?.text || ''

  // Clean up the response - remove markdown code blocks if present
  const codeBlockMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (codeBlockMatch) {
    jsonText = codeBlockMatch[1].trim()
  }

  // Parse and validate
  const structure: ProcessStructure = JSON.parse(jsonText)

  // Basic validation
  if (!structure.schemaVersion || !structure.nodes || !structure.connections) {
    throw new Error('Invalid structure: missing required fields')
  }

  return structure
}

// ============================================================================
// PHASE 2: Render Mermaid from ProcessStructure with Claude Haiku
// ============================================================================

const HAIKU_RENDER_SYSTEM_PROMPT = `You are a Mermaid diagram renderer. Your task is to convert a structured process JSON into valid Mermaid flowchart code.

## INPUT
You will receive:
1. A JSON structure containing nodes, connections, and subgraphs
2. A direction: "horizontal" (LR) or "vertical" (TB)

## OUTPUT
Return ONLY valid Mermaid code starting with "flowchart <direction>".

## SHAPE MAPPING
Convert shape types to Mermaid syntax:
- terminal: ((Label))
- process: [Label]
- storage: [(Label)]
- decision: {Label}
- subroutine: [[Label]]
- async: >Label]

## CONNECTION MAPPING
Convert connection styles (IMPORTANT: follow syntax exactly):
- normal without label: A --> B
- normal with label: A -- Label --> B
- critical without label: A ==> B
- critical with label: A == Label ==> B
- optional without label: A -.-> B
- optional with label: A -. Label .-> B

NEVER use |pipes| for labels. NEVER use quotes around labels. Use the exact syntax shown above.

## REQUIRED STRUCTURE
1. flowchart <LR or TB>
2. Subgraph blocks in order (with direction TB inside each)
3. Node definitions within their subgraphs
4. All connections after subgraph blocks close
5. Styling definitions at end

## REQUIRED STYLING (always include at end)
    classDef primary fill:#e0e7ff,stroke:#4f46e5,stroke-width:2px,color:#1e1b4b
    classDef storage fill:#dbeafe,stroke:#3b82f6,stroke-width:2px,color:#1e3a5f
    classDef logic fill:#fef3c7,stroke:#d97706,stroke-width:2px,color:#78350f
    classDef io fill:#d1fae5,stroke:#059669,stroke-width:2px,color:#064e3b
    classDef terminal fill:#e2e8f0,stroke:#475569,stroke-width:2px,color:#0f172a
    classDef async fill:#fce7f3,stroke:#db2777,stroke-width:2px,color:#831843

    class <terminal_nodes> terminal
    class <storage_nodes> storage
    class <logic_nodes> logic
    class <async_nodes> async
    class <primary_nodes> primary

    linkStyle default stroke:#64748b,stroke-width:2px

## RULES
- NO quotes inside shape brackets
- NO special characters in labels
- NO <br/> tags
- Every node MUST have a class assigned from styling.nodeClasses
- Use subgraph order from JSON
- Use "and" instead of "&"

CRITICAL: Return ONLY the Mermaid code. No markdown, no explanation.`

async function renderMermaidFromStructure(
  processStructure: ProcessStructure,
  direction: 'horizontal' | 'vertical'
): Promise<string | null> {
  const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!anthropicApiKey) {
    throw new Error('AI service not configured')
  }

  const mermaidDirection = direction === 'horizontal' ? 'LR' : 'TB'
  const userPrompt = `Convert this process structure to Mermaid code with ${mermaidDirection} (${direction === 'horizontal' ? 'left-to-right' : 'top-to-bottom'}) direction:

${JSON.stringify(processStructure, null, 2)}

Generate the Mermaid flowchart code starting with "flowchart ${mermaidDirection}".`

  console.log(`[Phase 2] Calling Haiku API for ${direction} view...`)

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicApiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: HAIKU_MODEL,
      max_tokens: 4096,
      temperature: 0.1, // Low temperature for consistent rendering
      system: HAIKU_RENDER_SYSTEM_PROMPT,
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
    console.error(`[Phase 2] Haiku API error (${direction}):`, errorText)
    throw new Error(`Haiku API error: ${response.status}`)
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
    console.error(`[Phase 2] Invalid Mermaid code generated (${direction}):`, mermaidCode.substring(0, 100))
    return null
  }

  // Sanitize the generated code to fix common issues
  mermaidCode = sanitizeMermaidCode(mermaidCode)

  console.log(`[Phase 2] ${direction} view generated successfully`)
  return mermaidCode
}

/**
 * Sanitize Mermaid code to fix common AI generation issues
 */
function sanitizeMermaidCode(code: string): string {
  let sanitized = code

  // Replace & with "and" (common parse error cause)
  sanitized = sanitized.replace(/&(?!amp;|lt;|gt;|quot;)/g, 'and')

  // Fix malformed dotted connections with pipe labels: -.-- |Label| NodeId -> -. Label .-> NodeId
  sanitized = sanitized.replace(/\.-{1,2}\s*\|([^|]+)\|\s*(\w+)/g, '-. $1 .-> $2')

  // Fix malformed normal connections with pipe labels: -- |Label| --> -> -- Label -->
  sanitized = sanitized.replace(/--\s*\|([^|]+)\|\s*-->/g, '-- $1 -->')

  // Fix malformed critical connections with pipe labels: == |Label| ==> -> == Label ==>
  sanitized = sanitized.replace(/==\s*\|([^|]+)\|\s*==>/g, '== $1 ==>')

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
