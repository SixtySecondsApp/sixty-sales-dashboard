/// <reference path="../deno.d.ts" />

/**
 * Generate Process Map Edge Function
 *
 * Analyzes integration/workflow processes and generates Mermaid diagrams
 * using Claude AI for visualization.
 *
 * Supported process types:
 * - integration: HubSpot, Google, Fathom, Slack, JustCall, SavvyCal
 * - workflow: Meeting Intelligence, Task Extraction
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RequestBody {
  processType: 'integration' | 'workflow'
  processName: string
  regenerate?: boolean
}

// Process descriptions for AI context
const PROCESS_DESCRIPTIONS: Record<string, Record<string, string>> = {
  integration: {
    hubspot: `
HubSpot Integration Process:
1. OAuth Connection: User connects via HubSpot OAuth flow, granting access to contacts, deals, and tasks
2. Credential Storage: Access token and refresh token stored securely in org_integrations table
3. Bi-directional Sync:
   - Inbound: HubSpot webhooks trigger sync of contacts, deals, and form submissions
   - Outbound: Changes in Sixty (deals, contacts, activities) sync back to HubSpot
4. Pipeline Mapping: Sixty pipeline stages mapped to HubSpot deal stages
5. Contact Sync: Contacts created/updated in both systems with deduplication
6. Deal Sync: Deals synced with value, stage, and custom properties
7. Form Ingestion: HubSpot form submissions create leads in Sixty
8. AI Note Writeback: Meeting summaries and action items written back to HubSpot
9. Task Sync: Tasks synchronized between both systems
10. Queue Processing: hubspot-process-queue Edge Function handles async sync operations
`,
    google: `
Google Workspace Integration Process:
1. OAuth Connection: User authorizes Gmail, Calendar, Drive, and Tasks access
2. Credential Storage: Google refresh token stored in google_integrations table
3. Gmail Integration:
   - Email sync for communication tracking
   - Thread-based conversation view
   - Email categorization and tagging
4. Calendar Integration:
   - Manual sync of calendar events (last 7 days)
   - Event storage in calendar_events table
   - Automatic contact linking via email matching
   - Meeting association with CRM contacts
5. Google Drive Integration:
   - Document access for meeting context
   - Proposal attachment tracking
6. Google Tasks Integration:
   - Task sync between Sixty and Google Tasks
   - Priority and due date synchronization
7. Contact Matching: Calendar attendees matched to CRM contacts
`,
    fathom: `
Fathom Integration Process:
1. OAuth Connection: User connects Fathom account via OAuth
2. Credential Storage: Fathom access token stored in fathom_integrations table
3. Recording Sync:
   - Webhook notifications for new recordings
   - Cron job for periodic sync (fathom-sync)
4. Meeting Creation:
   - New meetings created in meetings table
   - Participants extracted and linked
5. Transcript Sync:
   - Transcripts fetched via Fathom API
   - Stored in transcript_text column
   - Triggers AI analysis pipeline
6. Summary Generation:
   - AI-generated meeting summaries
   - Action items extraction
7. Company/Contact Linking:
   - Attendee emails matched to contacts
   - Company association via domain matching
8. AI Processing Triggers:
   - Database triggers auto-queue meetings for AI analysis
   - Next action suggestions generated
`,
    slack: `
Slack Integration Process:
1. OAuth Connection: Workspace admin authorizes Slack app
2. Credential Storage: Bot token and workspace info stored in slack_integrations table
3. Webhook Setup: Slack events subscribed for real-time notifications
4. Deal Room Creation:
   - Dedicated channels created for deals
   - Automatic channel naming convention
5. Meeting Summaries:
   - Post-meeting summaries sent to relevant channels
   - Action items shared with team
6. Notifications:
   - Deal stage changes
   - Task assignments
   - Upcoming meeting reminders
7. Bot Commands:
   - /sixty-deal - Quick deal lookup
   - /sixty-tasks - View pending tasks
8. Real-time Updates: Activity feed in Slack channels
`,
    justcall: `
JustCall Integration Process:
1. API Key Connection: User provides JustCall API credentials
2. Credential Storage: API key stored in justcall_integrations table
3. Webhook Setup: JustCall webhooks configured for call events
4. Call Recording Sync:
   - Inbound/outbound call recordings captured
   - Call metadata stored in calls table
5. Transcript Processing:
   - Call transcripts fetched via JustCall API
   - Stored in transcript_text column
6. AI Analysis:
   - Action items extracted from call transcripts
   - Sentiment analysis performed
7. Contact Linking:
   - Phone numbers matched to contacts
   - Call history associated with deals
8. Activity Creation: Calls logged as activities in CRM
`,
    savvycal: `
SavvyCal Integration Process:
1. OAuth Connection: User connects SavvyCal account
2. Credential Storage: Access token stored in savvycal_integrations table
3. Webhook Setup: SavvyCal webhooks for booking notifications
4. Booking Sync:
   - New bookings trigger deal/contact creation
   - Booking metadata stored in calendar_events
5. Lead Creation:
   - New contacts created from bookers
   - Company association from email domain
6. Activity Logging: Bookings logged as activities
7. Reminder Integration: Booking reminders synced with task system
8. Form Field Mapping: Custom booking form fields mapped to contact properties
`,
  },
  workflow: {
    meeting_intelligence: `
Meeting Intelligence Workflow:
1. Meeting Ingestion:
   - Fathom sync creates/updates meetings
   - Calendar events imported
2. Transcript Processing:
   - Transcripts stored in meetings.transcript_text
   - Database trigger fires on transcript update
3. AI Queue System:
   - Meetings queued for AI processing
   - Queue stored in meeting_ai_queue table
4. AI Analysis Pipeline:
   - meeting-intelligence-process-queue Edge Function processes queue
   - Claude AI analyzes transcript content
5. Output Generation:
   - Meeting summary generated
   - Action items extracted to meeting_action_items table
   - Sentiment analysis performed
   - Key topics identified
6. Next Action Suggestions:
   - suggest-next-actions Edge Function called
   - AI recommends follow-up tasks
   - Suggestions stored in next_action_suggestions table
7. Task Creation:
   - User reviews suggestions
   - Manual or auto-creation of tasks
8. Google File Search Indexing:
   - Meetings indexed to org-specific store
   - RAG queries enabled via ask-meeting-ai
9. Notifications:
   - Task creation notifications sent
   - Daily digest of meeting insights
`,
    task_extraction: `
Task Extraction Workflow:
1. Source Activities:
   - Meeting transcripts from Fathom
   - Call transcripts from JustCall
   - Activity notes from CRM
2. AI Extraction:
   - extract-action-items Edge Function for meetings
   - extract-call-action-items Edge Function for calls
   - Claude AI identifies actionable items
3. Action Item Storage:
   - Meeting items in meeting_action_items table
   - Call items in call_action_items table
   - Deduplication against existing items
4. Custom Extraction Rules:
   - User-defined trigger phrases in task_extraction_rules
   - Rule-based items created with high confidence
5. Importance Classification:
   - AI assigns importance: critical, high, medium, low
   - Used for auto-task creation decisions
6. Task Conversion:
   - create-task-unified Edge Function
   - Manual conversion via UI selection
   - Auto-conversion based on importance thresholds
7. Smart Tasks:
   - Database triggers on activities table
   - smart_task_templates define follow-up tasks
   - Automatic task creation for deal-linked activities
8. Task Sync:
   - Tasks sync to Google Tasks if enabled
   - HubSpot task sync if connected
9. Overdue Notifications:
   - Cron job checks overdue tasks
   - Notifications sent with guardrails
`,
  },
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { processType, processName, regenerate }: RequestBody = await req.json()

    if (!processType || !processName) {
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

    // Check if process map already exists (unless regenerate)
    if (!regenerate) {
      const { data: existingMap } = await supabaseClient
        .from('process_maps')
        .select('id, title, mermaid_code, updated_at')
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

    // Generate Mermaid diagram using Claude
    const mermaidCode = await generateMermaidWithClaude(processType, processName, processDescription)

    if (!mermaidCode) {
      return new Response(
        JSON.stringify({ error: 'Failed to generate process map' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

    // Format title
    const title = formatTitle(processType, processName)

    // Store in database (using supabaseService created earlier for admin check)
    const { data: processMap, error: insertError } = await supabaseService
      .from('process_maps')
      .insert({
        org_id: orgId,
        process_type: processType,
        process_name: processName,
        title,
        description: processDescription.trim(),
        mermaid_code: mermaidCode,
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
        message: 'Process map generated successfully',
        processMap,
        generated: true
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
  description: string
): Promise<string | null> {
  const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!anthropicApiKey) {
    throw new Error('AI service not configured')
  }

  const systemPrompt = `You are an expert at creating clear, informative Mermaid flowchart diagrams for software processes.

Your task is to create a Mermaid diagram that visualizes the given process flow.

Guidelines:
1. Use flowchart TD (top-down) or LR (left-right) based on complexity
2. Use subgraphs to group related steps
3. Use clear, descriptive node labels (replace spaces with underscores in IDs)
4. Use appropriate arrow types:
   - --> for normal flow
   - -.-> for optional/async flow
   - ==> for important/critical paths
5. Add meaningful edge labels where helpful
6. Keep nodes concise but informative
7. Use shapes appropriately:
   - [Text] for processes
   - (Text) for rounded (start/end)
   - {Text} for decisions
   - [(Text)] for databases
   - [[Text]] for subroutines
8. Color-code by category if helpful using :::className
9. IMPORTANT - Special characters in labels:
   - Wrap labels containing special characters (/, #, &, etc.) in double quotes
   - Example: NodeId["/command-name"] NOT NodeId[/command-name]
   - This prevents Mermaid lexical parsing errors

Return ONLY the Mermaid code, no markdown code blocks, no explanation.
The code must be valid Mermaid syntax that can be rendered directly.`

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

  return mermaidCode
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
