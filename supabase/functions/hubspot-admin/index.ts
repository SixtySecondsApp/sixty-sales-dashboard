import { serve } from 'https://deno.land/std@0.190.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

type Action = 'status' | 'enqueue' | 'save_settings'

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

  return new Response(JSON.stringify({ success: false, error: 'Unknown action' }), {
    status: 400,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})


