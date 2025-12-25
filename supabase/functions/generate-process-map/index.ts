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
  direction?: 'horizontal' | 'vertical'  // default: 'horizontal'
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
2. Credential Storage: Fathom access token stored in fathom_org_integrations table (org-level)
3. Sync State Management:
   - Sync status tracked in fathom_org_sync_state table
   - States: idle | syncing | error
   - Progress tracking: meetings_synced / total_meetings_found
   - Stuck sync auto-recovery: resets after 30 minutes via database trigger
4. Progressive Recording Sync:
   - Initial sync: First 9 meetings get FULL processing (thumbnails + transcripts)
   - Background queue: Remaining meetings processed asynchronously
   - Real-time UI: Sync progress banner shows "X of Y synced" with progress bar
   - Meetings display during sync (not blocked by syncing state)
5. Meeting Creation:
   - New meetings created in meetings table sorted by newest first
   - Participants extracted and linked to CRM contacts
   - Processing status columns: thumbnail_status, transcript_status, summary_status
6. Thumbnail Generation:
   - Thumbnails generated via generate-video-thumbnail-v2 Edge Function
   - Status: pending → processing → complete/failed
   - Real-time UI updates via Supabase subscriptions
7. Transcript Sync:
   - Transcripts fetched via Fathom API
   - Stored in transcript_text column
   - Triggers AI analysis pipeline
8. Summary Generation:
   - AI-generated meeting summaries
   - Action items extraction to meeting_action_items table
   - Sentiment analysis and coach ratings
9. Company/Contact Linking:
   - Attendee emails matched to contacts
   - Company association via domain matching
10. Meeting Intelligence Indexing:
    - Meetings queued for Google File Search indexing
    - Org-level stores for RAG queries via ask-meeting-ai
    - Real-time indexing status: "295/334 indexed"
11. Cron Job Sync:
    - fathom-sync Edge Function for periodic sync
    - Webhook notifications for new recordings
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
    vsl_analytics: `
VSL Video Analytics Workflow:
1. Landing Page Setup:
   - Three VSL variants: /intro, /introducing, /introduction
   - Each page has unique signupSource identifier
   - Cloudinary-hosted videos with public IDs
2. Video Component Integration:
   - OptimizedCloudinaryVideo component renders video player
   - HTML5 video element with custom event handlers
   - Video events captured: view, play, pause, progress, seek, ended
3. Anonymous Event Tracking:
   - Session ID generated per visitor (anonymous)
   - No authentication required for event submission
   - Events sent to Supabase vsl_video_analytics table
4. Event Data Capture:
   - signup_source: identifies which VSL variant
   - video_public_id: Cloudinary video identifier
   - event_type: view, play, pause, progress, seek, ended
   - playback_time: current position in seconds
   - duration: total video length
   - progress_percent: percentage watched (0-100)
   - watch_time: cumulative seconds watched
   - session_id: anonymous visitor identifier
   - Metadata: user_agent, referrer, screen dimensions
5. Database Storage:
   - vsl_video_analytics table stores all events
   - RLS disabled for public write access
   - Indexed by signup_source, event_type, created_at, session_id
   - Composite index for efficient dashboard queries
6. Analytics Summary View:
   - vsl_analytics_summary aggregated view
   - Calculates per-day metrics by variant
   - Metrics: unique_views, total_views, unique_plays, completions
   - Progress milestones: reached_25, reached_50, reached_75 percent
   - Average watch time and completion percentage
7. Dashboard Display:
   - Platform admin page at /platform/vsl-analytics
   - Comparison cards showing each variant performance
   - Trend charts for views over time
   - Retention graphs showing viewer drop-off points
8. Split Test Analysis:
   - Compare performance across three VSL variants
   - Identify best-performing video for conversion
   - Metrics: play rate, completion rate, engagement depth
   - Date range filtering for time-based analysis
`,
    sentry_bridge: `
Sentry Bridge Workflow - Error to Task Automation:
1. Error Capture:
   - Sentry SDK captures errors in browser and server
   - Errors sent to Sentry with context tags and user info
   - Sentry groups errors into Issues with unique fingerprints
2. Sentry Issue Alert:
   - Sentry Alert Rule triggers on new issues or high frequency
   - Webhook fires to branded URL use60.com/api/webhooks/sentry
   - Payload includes issue ID title culprit environment and event count
3. Vercel Webhook Proxy:
   - api/webhooks/sentry.ts receives Sentry webhook
   - Validates Sentry signature using HMAC SHA256
   - Signs payload with SENTRY_WEBHOOK_PROXY_SECRET
   - Forwards to Supabase Edge Function with X-Use60-Signature
4. Edge Function Processing:
   - sentry-webhook Edge Function validates proxy signature
   - Checks rate limits and circuit breaker
   - Logs webhook event to sentry_webhook_events table
   - Applies routing rules from sentry_routing_rules
5. Routing Decision:
   - Matches issue against org routing rules
   - Determines target AI Dev Hub project
   - Assigns priority based on error severity
   - Maps Sentry project to AI Dev Hub project
6. Triage or Auto-Process:
   - Triage Mode ON: Issue added to sentry_triage_queue for manual review
   - Triage Mode OFF: Issue added to sentry_bridge_queue for auto-processing
   - Queue status tracked: pending processing completed failed
7. MCP Integration:
   - Claude Code reads from queue tables
   - Calls AI Dev Hub MCP create_task tool
   - Creates bug task with Sentry context and links
   - Updates queue status to completed
8. Issue Mapping:
   - sentry_issue_mappings links Sentry Issue to AI Dev Hub Task
   - Enables bidirectional tracking
   - Prevents duplicate task creation for same issue
9. Task Created in AI Dev Hub:
   - Task includes error title message and location
   - AI context with Sentry trace ID and environment
   - Direct link to Sentry issue for investigation
   - Due date set based on priority
`,
    api_optimization: `
API Call Optimization Workflow:

1. Working Hours Detection:
   - User timezone detection from browser and profile settings
   - Working hours check from 8 AM to 6 PM local time
   - Weekend detection for minimal polling mode
   - Profile columns: working_hours_start, working_hours_end, timezone
   - useWorkingHours hook provides isWorkingHours and isWeekend flags

2. User Activity Monitoring:
   - Mouse keyboard scroll and touch event tracking
   - 5-minute idle threshold detection via useUserActivity hook
   - Polling speed adjustment: normal speed when active, 10x slower when idle
   - Tab visibility awareness via document.hidden

3. Smart Polling Controller:
   - useSmartPolling hook combines working hours and activity status
   - Returns polling interval or false to disable polling entirely
   - Tiered system: critical, important, standard, background, static
   - Applied to all non-critical queries via useSmartRefetchConfig

4. Batch Edge Functions - 4 Consolidated Endpoints:
   - app-data-batch: Dashboard and page load data consolidation
     Resources: deals, activities, tasks, health-scores, contacts, meetings, notifications
     Reduces 4-8 calls per page load to 1 single request
   - google-workspace-batch: All Google API calls consolidated
     Services: calendar, gmail, drive, tasks, docs, connection
     Reduces 12 separate functions to 1 batch call
   - meeting-analysis-batch: Meeting detail page queries
     Analyses: details, action-items, topics, suggestions, summary, transcript-search
     Loads meeting detail page 4x faster
   - integration-health-batch: Admin integration health checks
     Integrations: google, fathom, hubspot, slack, justcall, savvycal
     Admin dashboard 83 percent faster

5. Frontend Batch Query Hooks:
   - useBatchQuery.ts provides typed React Query hooks
   - useAppDataBatch for general app data
   - useGoogleWorkspaceBatch for Google services
   - useMeetingAnalysisBatch for meeting details
   - useIntegrationHealthBatch for admin health checks
   - Convenience hooks: useDashboardBatch, useMeetingDetailBatch, useAdminIntegrationsBatch

6. Query Tier Configuration:
   - Critical tier: Real-time subscriptions, no polling (notifications, deal changes)
   - Important tier: 5 min stale time, 60s polling during work hours (activities, tasks)
   - Standard tier: 5 min stale time, 5 min polling (health scores, suggestions)
   - Background tier: 10 min stale time, 30 min polling (leads, analytics)
   - Static tier: 1 hour stale time, refetch on demand (settings, templates)

7. Realtime Subscription Management:
   - useRealtimeHub with working hours awareness
   - Full mode during working hours: high and medium priority channels
   - Minimal mode during off-hours: notifications only channel
   - Reduces realtime connections by 67 percent during off-hours
   - Hub consolidation: 35+ channels reduced to 2-3 managed channels

8. Cache and Invalidation Strategy:
   - Optimistic updates for mutations to avoid refetching
   - Selective cache invalidation vs cascading invalidations
   - useInvalidateBatchQueries for targeted batch cache clearing
   - refetchOnWindowFocus for background tier data

9. Results and Metrics:
   - 95 percent reduction in daily API calls per user
   - 80 percent reduction in edge function invocations
   - 3x faster page loads via batched requests
   - 67 percent fewer realtime connections off-hours
   - Minimal UX impact for sales agents during work hours
`,
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
      direction = 'horizontal'
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

    // Generate Mermaid diagram using Claude
    const mermaidCode = await generateMermaidWithClaude(processType, processName, processDescription, direction)

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
