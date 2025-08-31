import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from '../_shared/cors.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0'

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (req.method === 'GET') {
      const url = new URL(req.url)
      const ownerId = url.searchParams.get('owner_id')
      
      // Initialize Supabase client
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      const supabase = createClient(supabaseUrl, supabaseKey)

      // Build query - basic client data first
      let query = supabase
        .from('clients')
        .select('*')

      // Filter by owner if provided
      if (ownerId) {
        query = query.eq('owner_id', ownerId)
      }

      const { data, error } = await query.order('company_name', { ascending: true })

      if (error) {
        console.error('Database error:', error)
        return new Response(JSON.stringify({ 
          error: error.message,
          details: 'Failed to fetch clients from database'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Process the data to match expected format
      const processedClients = data?.map(client => ({
        ...client,
        subscription_amount: parseFloat(client.subscription_amount || 0),
        subscription_days: client.subscription_start_date 
          ? Math.floor((new Date().getTime() - new Date(client.subscription_start_date).getTime()) / (1000 * 60 * 60 * 24))
          : 0
      })) || []

      return new Response(JSON.stringify(processedClients), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      })
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Clients function error:', error)
    return new Response(JSON.stringify({ 
      error: error.message,
      details: 'Internal server error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})