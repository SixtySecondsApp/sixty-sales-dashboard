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

    console.log('🧪 Testing Fathom token for user:', user.id)

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

    console.log('📋 Integration details:')
    console.log('  - ID:', integration.id)
    console.log('  - Email:', integration.fathom_user_email)
    console.log('  - Token expires:', integration.token_expires_at)
    console.log('  - Scopes:', integration.scopes)
    console.log('  - Token length:', integration.access_token?.length)
    console.log('  - Token preview:', integration.access_token?.substring(0, 20) + '...')

    // Test the token with Fathom API
    console.log('🧪 Testing token with Fathom API...')

    const testUrl = 'https://api.fathom.ai/external/v1/meetings'
    console.log('📡 Calling:', testUrl)

    const response = await fetch(testUrl, {
      headers: {
        'X-Api-Key': integration.access_token,
      },
    })

    console.log('📊 Response status:', response.status)
    console.log('📊 Response headers:', Object.fromEntries(response.headers.entries()))

    let responseData
    const responseText = await response.text()

    try {
      responseData = JSON.parse(responseText)
    } catch (e) {
      responseData = responseText
    }

    console.log('📦 Response body:', responseData)

    if (response.ok) {
      return new Response(
        JSON.stringify({
          success: true,
          message: '✅ Token is valid and working!',
          integration: {
            id: integration.id,
            email: integration.fathom_user_email,
            expires_at: integration.token_expires_at,
            scopes: integration.scopes,
          },
          api_test: {
            status: response.status,
            meetings_count: responseData?.meetings?.length || 0,
            has_cursor: !!responseData?.cursor,
          },
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
          recommendation: 'Please reconnect your Fathom account in the Integrations page',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }
  } catch (error) {
    console.error('❌ Test error:', error)

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
