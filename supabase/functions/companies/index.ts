import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const url = new URL(req.url)
    const pathSegments = url.pathname.split('/').filter(segment => segment && segment !== 'functions' && segment !== 'v1' && segment !== 'companies')
    const companyId = pathSegments[0]
    
    if (req.method === 'GET') {
      if (!companyId) {
        // GET /companies - List companies with stats
        return await handleCompaniesList(supabaseClient, url)
      } else {
        // GET /companies/:id - Single company
        return await handleSingleCompany(supabaseClient, companyId)
      }
    } else if (req.method === 'POST') {
      // POST /companies - Create company
      const body = await req.json()
      return await handleCreateCompany(supabaseClient, body)
    } else if (req.method === 'PUT') {
      // PUT /companies/:id - Update company
      if (!companyId) {
        return new Response(JSON.stringify({ error: 'Company ID required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      const body = await req.json()
      return await handleUpdateCompany(supabaseClient, companyId, body)
    } else if (req.method === 'DELETE') {
      // DELETE /companies/:id - Delete company
      if (!companyId) {
        return new Response(JSON.stringify({ error: 'Company ID required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      return await handleDeleteCompany(supabaseClient, companyId)
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Error in companies function:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

// List companies with stats
async function handleCompaniesList(supabaseClient: any, url: URL) {
  try {
    const includeStats = url.searchParams.get('includeStats') === 'true'
    const limit = parseInt(url.searchParams.get('limit') || '50')
    const offset = parseInt(url.searchParams.get('offset') || '0')
    const search = url.searchParams.get('search') || ''
    const industry = url.searchParams.get('industry') || ''
    const size = url.searchParams.get('size') || ''
    const ownerId = url.searchParams.get('owner_id') || ''

    let query = supabaseClient
      .from('companies')
      .select(`
        id,
        name,
        domain,
        industry,
        size,
        website,
        address,
        phone,
        description,
        linkedin_url,
        owner_id,
        created_at,
        updated_at
        ${includeStats ? `,
        contacts:contacts(count),
        deals:deals(count, value)
        ` : ''}
      `)
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false })

    // Apply filters
    if (search) {
      query = query.or(`name.ilike.%${search}%,domain.ilike.%${search}%`)
    }
    if (industry) {
      query = query.eq('industry', industry)
    }
    if (size) {
      query = query.eq('size', size)
    }
    if (ownerId) {
      query = query.eq('owner_id', ownerId)
    }

    const { data: companies, error, count } = await query

    if (error) {
      throw error
    }

    // Process stats if requested
    let processedCompanies = companies
    if (includeStats && companies) {
      processedCompanies = companies.map((company: any) => ({
        ...company,
        contactCount: company.contacts?.[0]?.count || 0,
        dealsCount: company.deals?.length || 0,
        dealsValue: company.deals?.reduce((sum: number, deal: any) => sum + (deal.value || 0), 0) || 0
      }))
    }

    return new Response(JSON.stringify({
      data: processedCompanies,
      count: count || 0,
      error: null
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Error fetching companies:', error)
    return new Response(JSON.stringify({
      data: [],
      error: error.message,
      count: 0
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}

// Get single company
async function handleSingleCompany(supabaseClient: any, companyId: string) {
  try {
    const { data: company, error } = await supabaseClient
      .from('companies')
      .select(`
        *,
        contacts:contacts(count),
        deals:deals(count, value)
      `)
      .eq('id', companyId)
      .single()

    if (error) {
      throw error
    }

    if (!company) {
      return new Response(JSON.stringify({ error: 'Company not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Process stats
    const processedCompany = {
      ...company,
      contactCount: company.contacts?.[0]?.count || 0,
      dealsCount: company.deals?.length || 0,
      dealsValue: company.deals?.reduce((sum: number, deal: any) => sum + (deal.value || 0), 0) || 0
    }

    return new Response(JSON.stringify({
      data: processedCompany,
      error: null
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Error fetching company:', error)
    return new Response(JSON.stringify({
      data: null,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}

// Create company
async function handleCreateCompany(supabaseClient: any, body: any) {
  try {
    const { data: company, error } = await supabaseClient
      .from('companies')
      .insert(body)
      .select()
      .single()

    if (error) {
      throw error
    }

    return new Response(JSON.stringify({
      data: company,
      error: null
    }), {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Error creating company:', error)
    return new Response(JSON.stringify({
      data: null,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}

// Update company
async function handleUpdateCompany(supabaseClient: any, companyId: string, body: any) {
  try {
    const { data: company, error } = await supabaseClient
      .from('companies')
      .update(body)
      .eq('id', companyId)
      .select()
      .single()

    if (error) {
      throw error
    }

    return new Response(JSON.stringify({
      data: company,
      error: null
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Error updating company:', error)
    return new Response(JSON.stringify({
      data: null,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}

// Delete company
async function handleDeleteCompany(supabaseClient: any, companyId: string) {
  try {
    const { error } = await supabaseClient
      .from('companies')
      .delete()
      .eq('id', companyId)

    if (error) {
      throw error
    }

    return new Response(JSON.stringify({
      data: { id: companyId },
      error: null
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Error deleting company:', error)
    return new Response(JSON.stringify({
      data: null,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
} 