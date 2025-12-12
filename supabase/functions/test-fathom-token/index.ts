import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Test Fathom Token Edge Function
 *
 * Purpose: Test if stored Fathom access token works with API
 * Usage: Call this to verify your token before running full sync
 *
 * Now includes workspace/team diagnostics to help identify connection issues
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get user from auth header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)

    if (userError || !user) {
      throw new Error('Unauthorized: Invalid token')
    }
    // Get integration
    const { data: integration, error: integrationError } = await supabase
      .from('fathom_integrations')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (integrationError || !integration) {
      throw new Error('No active Fathom integration found')
    }

    // STEP 1: Fetch user/team info from /me endpoint
    let userInfo: any = null
    let userInfoError: string | null = null
    try {
      let meResponse = await fetch('https://api.fathom.ai/external/v1/me', {
        headers: {
          'Authorization': `Bearer ${integration.access_token}`,
        },
      })

      if (!meResponse.ok) {
        // Try X-Api-Key fallback
        meResponse = await fetch('https://api.fathom.ai/external/v1/me', {
          headers: {
            'X-Api-Key': integration.access_token,
          },
        })
      }

      if (meResponse.ok) {
        userInfo = await meResponse.json()
        console.log('[test-fathom-token] /me response:', JSON.stringify(userInfo))
      } else {
        const errorText = await meResponse.text()
        userInfoError = `Status ${meResponse.status}: ${errorText.substring(0, 200)}`
        console.error('[test-fathom-token] /me error:', userInfoError)
      }
    } catch (e) {
      userInfoError = e instanceof Error ? e.message : String(e)
      console.error('[test-fathom-token] /me exception:', userInfoError)
    }

    // STEP 2: Fetch teams/workspaces if available
    let teamsInfo: any = null
    try {
      let teamsResponse = await fetch('https://api.fathom.ai/external/v1/teams', {
        headers: {
          'Authorization': `Bearer ${integration.access_token}`,
        },
      })

      if (!teamsResponse.ok) {
        teamsResponse = await fetch('https://api.fathom.ai/external/v1/teams', {
          headers: {
            'X-Api-Key': integration.access_token,
          },
        })
      }

      if (teamsResponse.ok) {
        teamsInfo = await teamsResponse.json()
        console.log('[test-fathom-token] /teams response:', JSON.stringify(teamsInfo))
      }
    } catch (e) {
      // Teams endpoint might not exist - that's okay
      console.log('[test-fathom-token] /teams not available')
    }

    // STEP 3: Test meetings API with higher limit to see true count
    const testUrl = 'https://api.fathom.ai/external/v1/meetings?limit=100'
    // OAuth tokens typically use Bearer, API keys use X-Api-Key
    // Try Bearer first (standard OAuth)
    let response = await fetch(testUrl, {
      headers: {
        'Authorization': `Bearer ${integration.access_token}`,
      },
    })
    // If Bearer fails with 401, try X-Api-Key
    if (response.status === 401) {
      response = await fetch(testUrl, {
        headers: {
          'X-Api-Key': integration.access_token,
        },
      })
    }
    let responseData
    const responseText = await response.text()

    try {
      responseData = JSON.parse(responseText)
    } catch (e) {
      responseData = responseText
    }
    if (response.ok) {
      // Normalize count across possible shapes: items | meetings | data | calls | array directly
      let meetingsCount = 0
      let firstId: string | number | undefined
      let firstMeetingTitle: string | undefined
      let firstMeetingDate: string | undefined
      let hasMoreMeetings = false
      let nextCursor: string | undefined

      if (Array.isArray(responseData)) {
        meetingsCount = responseData.length
        firstId = responseData[0]?.id || responseData[0]?.recording_id
        firstMeetingTitle = responseData[0]?.title
        firstMeetingDate = responseData[0]?.recording_start_time || responseData[0]?.scheduled_start_time
      } else if (responseData?.items && Array.isArray(responseData.items)) {
        meetingsCount = responseData.items.length
        firstId = responseData.items[0]?.id || responseData.items[0]?.recording_id
        firstMeetingTitle = responseData.items[0]?.title
        firstMeetingDate = responseData.items[0]?.recording_start_time || responseData.items[0]?.scheduled_start_time
        hasMoreMeetings = !!responseData.next_cursor || !!responseData.has_more
        nextCursor = responseData.next_cursor || responseData.cursor
      } else if (responseData?.meetings && Array.isArray(responseData.meetings)) {
        meetingsCount = responseData.meetings.length
        firstId = responseData.meetings[0]?.id || responseData.meetings[0]?.recording_id
        firstMeetingTitle = responseData.meetings[0]?.title
        firstMeetingDate = responseData.meetings[0]?.recording_start_time || responseData.meetings[0]?.scheduled_start_time
        hasMoreMeetings = !!responseData.next_cursor || !!responseData.has_more
        nextCursor = responseData.next_cursor || responseData.cursor
      } else if (responseData?.data && Array.isArray(responseData.data)) {
        meetingsCount = responseData.data.length
        firstId = responseData.data[0]?.id || responseData.data[0]?.recording_id
        firstMeetingTitle = responseData.data[0]?.title
        firstMeetingDate = responseData.data[0]?.recording_start_time || responseData.data[0]?.scheduled_start_time
        hasMoreMeetings = !!responseData.next_cursor || !!responseData.has_more
        nextCursor = responseData.next_cursor || responseData.cursor
      } else if (responseData?.calls && Array.isArray(responseData.calls)) {
        meetingsCount = responseData.calls.length
        firstId = responseData.calls[0]?.id || responseData.calls[0]?.recording_id
        firstMeetingTitle = responseData.calls[0]?.title
        firstMeetingDate = responseData.calls[0]?.recording_start_time || responseData.calls[0]?.scheduled_start_time
        hasMoreMeetings = !!responseData.next_cursor || !!responseData.has_more
        nextCursor = responseData.next_cursor || responseData.cursor
      }

      // Determine if this looks like a different workspace (low meeting count, no user info)
      const possibleWorkspaceIssue = meetingsCount < 20 && !userInfo?.email

      return new Response(
        JSON.stringify({
          success: true,
          message: possibleWorkspaceIssue
            ? '⚠️ Token works but may be connected to wrong workspace/team'
            : '✅ Token is valid and working!',
          integration: {
            id: integration.id,
            email: integration.fathom_user_email || userInfo?.email || 'Unknown',
            expires_at: integration.token_expires_at,
            scopes: integration.scopes,
          },
          // NEW: Fathom account info from /me endpoint
          fathom_account: userInfo ? {
            id: userInfo.id,
            email: userInfo.email,
            name: userInfo.name || userInfo.display_name,
            team_id: userInfo.team_id || userInfo.team?.id,
            team_name: userInfo.team_name || userInfo.team?.name,
            role: userInfo.role,
          } : null,
          fathom_account_error: userInfoError,
          // NEW: Teams/workspaces info
          teams: teamsInfo,
          api_test: {
            status: response.status,
            meetings_count: meetingsCount,
            has_more: hasMoreMeetings,
            next_cursor: nextCursor,
            first_meeting: firstId ? {
              id: firstId,
              title: firstMeetingTitle,
              date: firstMeetingDate,
            } : null,
          },
          // NEW: Diagnostic warning
          diagnostic: possibleWorkspaceIssue ? {
            warning: 'Low meeting count detected. Your Fathom account may have connected to a different workspace/team than your main recordings.',
            suggestion: 'Please disconnect and reconnect Fathom, making sure to select the correct team/workspace during OAuth authorization.',
          } : null,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    } else {
      return new Response(
        JSON.stringify({
          success: false,
          message: '❌ Token is invalid or expired',
          error: {
            status: response.status,
            body: responseData,
          },
          integration: {
            id: integration.id,
            email: integration.fathom_user_email,
            expires_at: integration.token_expires_at,
            scopes: integration.scopes,
            token_preview: integration.access_token?.substring(0, 20) + '...',
          },
          fathom_account: userInfo,
          fathom_account_error: userInfoError,
          recommendation: 'Please reconnect your Fathom account in the Integrations page',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
