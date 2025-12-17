import { serve } from 'https://deno.land/std@0.190.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { HubSpotClient } from '../_shared/hubspot.ts'

type Action = 'status' | 'enqueue' | 'save_settings' | 'get_properties' | 'get_pipelines' | 'trigger_sync'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return new Response(JSON.stringify({ success: false, error: 'Server misconfigured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const userToken = req.headers.get('Authorization')?.replace('Bearer ', '') || ''
  if (!userToken) {
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${userToken}` } },
  })
  const {
    data: { user },
  } = await userClient.auth.getUser()
  if (!user) {
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const body = await req.json().catch(() => ({}))
  const action: Action | null = typeof body.action === 'string' ? (body.action as Action) : null
  const orgId = typeof body.org_id === 'string' ? body.org_id : null
  if (!action || !orgId) {
    return new Response(JSON.stringify({ success: false, error: 'Missing action or org_id' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const svc = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })

  const { data: membership } = await svc
    .from('organization_memberships')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', user.id)
    .maybeSingle()
  const role = membership?.role as string | undefined
  const isAdmin = role === 'owner' || role === 'admin'

  if (!isAdmin) {
    return new Response(JSON.stringify({ success: false, error: 'Forbidden' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (action === 'status') {
    const { data: integration } = await svc
      .from('hubspot_org_integrations')
      .select('*')
      .eq('org_id', orgId)
      .eq('is_active', true)
      .maybeSingle()
    const { data: syncState } = await svc.from('hubspot_org_sync_state').select('*').eq('org_id', orgId).maybeSingle()
    const { data: settingsRow } = await svc.from('hubspot_settings').select('settings').eq('org_id', orgId).maybeSingle()

    const publicUrl = Deno.env.get('PUBLIC_URL') || Deno.env.get('FRONTEND_URL') || ''
    const webhookToken = integration?.webhook_token ? String(integration.webhook_token) : null
    const webhookUrl = webhookToken && publicUrl
      ? `${publicUrl.replace(/\/$/, '')}/api/webhooks/hubspot?token=${encodeURIComponent(webhookToken)}`
      : null

    return new Response(
      JSON.stringify({
        success: true,
        connected: Boolean(integration?.is_connected),
        integration,
        sync_state: syncState || null,
        settings: settingsRow?.settings || {},
        webhook_url: webhookUrl,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  if (action === 'save_settings') {
    const settings = body.settings ?? {}
    await svc
      .from('hubspot_settings')
      .upsert({ org_id: orgId, settings, updated_at: new Date().toISOString() }, { onConflict: 'org_id' })
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (action === 'enqueue') {
    const jobType = typeof body.job_type === 'string' ? body.job_type : null
    if (!jobType) {
      return new Response(JSON.stringify({ success: false, error: 'Missing job_type' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const payload = body.payload ?? {}
    const dedupeKey = typeof body.dedupe_key === 'string' ? body.dedupe_key : null
    const priority = typeof body.priority === 'number' ? body.priority : 100

    // Pull clerk_org_id from integration/settings if available
    const { data: integration } = await svc
      .from('hubspot_org_integrations')
      .select('clerk_org_id')
      .eq('org_id', orgId)
      .maybeSingle()

    await svc
      .from('hubspot_sync_queue')
      .insert({
        org_id: orgId,
        clerk_org_id: integration?.clerk_org_id || null,
        job_type: jobType,
        payload,
        dedupe_key: dedupeKey,
        priority,
        run_after: new Date().toISOString(),
        attempts: 0,
        max_attempts: 10,
      })
      .catch(async (e: any) => {
        // If unique violation on dedupe_key, treat as ok
        const msg = String(e?.message || '')
        if (msg.toLowerCase().includes('duplicate key') || msg.toLowerCase().includes('unique')) return
        throw e
      })

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Get HubSpot properties (deals, contacts, tasks)
  if (action === 'get_properties') {
    const objectType = typeof body.object_type === 'string' ? body.object_type : 'deals'

    // Get access token from integration
    const { data: integration } = await svc
      .from('hubspot_org_integrations')
      .select('access_token, token_expires_at')
      .eq('org_id', orgId)
      .eq('is_active', true)
      .maybeSingle()

    if (!integration?.access_token) {
      return new Response(JSON.stringify({ success: false, error: 'HubSpot not connected' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const client = new HubSpotClient({ accessToken: integration.access_token })

    try {
      const properties = await client.request<{ results: any[] }>({
        method: 'GET',
        path: `/crm/v3/properties/${objectType}`,
      })

      return new Response(
        JSON.stringify({
          success: true,
          properties: properties.results.map((p: any) => ({
            name: p.name,
            label: p.label,
            type: p.type,
            fieldType: p.fieldType,
            description: p.description,
            groupName: p.groupName,
            options: p.options,
          })),
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } catch (e: any) {
      return new Response(JSON.stringify({ success: false, error: e.message || 'Failed to fetch properties' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  }

  // Get HubSpot deal pipelines and stages
  if (action === 'get_pipelines') {
    const { data: integration } = await svc
      .from('hubspot_org_integrations')
      .select('access_token')
      .eq('org_id', orgId)
      .eq('is_active', true)
      .maybeSingle()

    if (!integration?.access_token) {
      return new Response(JSON.stringify({ success: false, error: 'HubSpot not connected' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const client = new HubSpotClient({ accessToken: integration.access_token })

    try {
      const pipelines = await client.request<{ results: any[] }>({
        method: 'GET',
        path: '/crm/v3/pipelines/deals',
      })

      return new Response(
        JSON.stringify({
          success: true,
          pipelines: pipelines.results.map((p: any) => ({
            id: p.id,
            label: p.label,
            displayOrder: p.displayOrder,
            stages: (p.stages || []).map((s: any) => ({
              id: s.id,
              label: s.label,
              displayOrder: s.displayOrder,
              metadata: s.metadata,
            })),
          })),
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } catch (e: any) {
      return new Response(JSON.stringify({ success: false, error: e.message || 'Failed to fetch pipelines' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  }

  // Trigger sync with time period options
  if (action === 'trigger_sync') {
    const syncType = typeof body.sync_type === 'string' ? body.sync_type : 'deals'
    const timePeriod = typeof body.time_period === 'string' ? body.time_period : 'last_30_days'

    // Calculate date filter based on time period
    let createdAfter: string | null = null
    const now = new Date()

    switch (timePeriod) {
      case 'last_7_days':
        createdAfter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
        break
      case 'last_30_days':
        createdAfter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
        break
      case 'last_90_days':
        createdAfter = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString()
        break
      case 'last_year':
        createdAfter = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString()
        break
      case 'all_time':
        createdAfter = null
        break
      default:
        createdAfter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
    }

    const { data: integration } = await svc
      .from('hubspot_org_integrations')
      .select('clerk_org_id')
      .eq('org_id', orgId)
      .maybeSingle()

    // Queue the sync job
    await svc
      .from('hubspot_sync_queue')
      .insert({
        org_id: orgId,
        clerk_org_id: integration?.clerk_org_id || null,
        job_type: `initial_sync_${syncType}`,
        payload: {
          sync_type: syncType,
          time_period: timePeriod,
          created_after: createdAfter,
          is_initial_sync: true,
        },
        dedupe_key: `initial_sync_${syncType}_${orgId}`,
        priority: 50, // Higher priority for manual syncs
        run_after: new Date().toISOString(),
        attempts: 0,
        max_attempts: 5,
      })
      .catch(async (e: any) => {
        const msg = String(e?.message || '')
        if (msg.toLowerCase().includes('duplicate key') || msg.toLowerCase().includes('unique')) return
        throw e
      })

    return new Response(
      JSON.stringify({
        success: true,
        message: `${syncType} sync queued for ${timePeriod.replace(/_/g, ' ')}`,
        created_after: createdAfter,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  return new Response(JSON.stringify({ success: false, error: 'Unknown action' }), {
    status: 400,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})


