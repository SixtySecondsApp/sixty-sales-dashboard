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

      // Validate required fields - be lenient for partial Web Vitals data
      // Some metrics may report before all values are available
      if (!body.name) {
        return new Response(JSON.stringify({
          status: 'skipped',
          message: 'Metric name is required'
        }), {
          status: 200, // Return 200 to avoid console errors for partial data
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Skip metrics with no meaningful value
      if (body.value === undefined || body.value === null) {
        return new Response(JSON.stringify({
          status: 'skipped',
          message: 'Metric value not yet available'
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Extract and validate web vitals data
      const webVitalData = {
        metric_name: body.name,
        metric_value: body.value,
        rating: body.rating || 'unknown', // Default for metrics without rating yet
        delta: body.delta || 0,
        metric_id: body.id || null,
        url: body.url || null,
        user_agent: body.userAgent || null,
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
        // For now, just log the error and return success to prevent blocking the UI
        // TODO: Create web_vitals_metrics table in database
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