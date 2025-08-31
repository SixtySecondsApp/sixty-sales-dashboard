import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from '../_shared/cors.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0'

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (req.method === 'POST') {
      const body = await req.json()
      
      // Validate required fields
      if (!body.name || !body.value || !body.rating) {
        return new Response(JSON.stringify({ 
          error: 'Missing required fields: name, value, rating' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Extract and validate web vitals data
      const webVitalData = {
        metric_name: body.name,
        metric_value: body.value,
        rating: body.rating,
        delta: body.delta || 0,
        metric_id: body.id,
        url: body.url,
        user_agent: body.userAgent,
        timestamp: new Date(body.timestamp || Date.now()).toISOString(),
        entries: JSON.stringify(body.entries || [])
      }

      // Initialize Supabase client
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      const supabase = createClient(supabaseUrl, supabaseKey)

      // Store web vitals data
      const { data, error } = await supabase
        .from('web_vitals_metrics')
        .insert([webVitalData])

      if (error) {
        console.error('Database error:', error)
        // For now, just log the error and return success to prevent blocking the UI
        // TODO: Create web_vitals_metrics table in database
        console.log('Web vitals data received:', webVitalData)
        return new Response(JSON.stringify({ 
          status: 'logged',
          message: 'Web vitals data logged (table creation pending)'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        })
      }

      return new Response(JSON.stringify({ 
        status: 'success',
        message: 'Web vitals data stored successfully',
        data: data
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      })
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Web vitals analytics error:', error)
    return new Response(JSON.stringify({ 
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})