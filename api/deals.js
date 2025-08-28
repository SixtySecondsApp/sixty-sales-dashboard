import { executeQuery, executeQueryWithRetry, handleCORS, apiResponse, executeBatchQueries } from './_db.js';
import { createCacheKey, getFromCache, setCache, invalidateCachePattern } from '../lib/api-utils/cache.js';

export default async function handler(request, response) {
  const requestStartTime = Date.now();
  
  // Handle CORS preflight
  const corsResponse = handleCORS(request, response);
  if (corsResponse) return corsResponse;

  try {
    // Parse URL for Vercel compatibility
    const urlParts = request.url.split('?');
    const pathname = urlParts[0];
    const queryString = urlParts[1] || '';
    const searchParams = new URLSearchParams(queryString);
    
    const pathSegments = pathname.split('/').filter(segment => segment && segment !== 'api' && segment !== 'deals');
    const dealId = pathSegments[0];
    const subAction = pathSegments[1];
    
    // Handle special endpoints
    if (dealId && subAction === 'convert-to-subscription' && request.method === 'POST') {
      return await handleConvertDealToSubscription(response, request, dealId, requestStartTime);
    }
    if (dealId && subAction === 'subscription' && request.method === 'GET') {
      return await handleGetDealSubscription(response, dealId, requestStartTime);
    }
    if (dealId && subAction === 'analytics' && request.method === 'GET') {
      return await handleDealAnalytics(response, dealId, searchParams, requestStartTime);
    }
    if (subAction === 'bulk' && request.method === 'POST') {
      return await handleBulkOperations(response, request, requestStartTime);
    }
    if (subAction === 'pipeline-stats' && request.method === 'GET') {
      return await handlePipelineStats(response, searchParams, requestStartTime);
    }
    
    if (request.method === 'GET') {
      if (!dealId) {
        // GET /api/deals - List all deals
        return await handleDealsList(response, searchParams, requestStartTime);
      } else {
        // GET /api/deals/:id - Single deal
        return await handleSingleDeal(response, dealId, searchParams, requestStartTime);
      }
    } else if (request.method === 'POST') {
      // POST /api/deals - Create deal
      return await handleCreateDeal(response, request, requestStartTime);
    } else if (request.method === 'PUT' || request.method === 'PATCH') {
      if (dealId) {
        // PUT /api/deals/:id - Update deal
        return await handleUpdateDeal(response, request, dealId, requestStartTime);
      }
      return apiResponse(response, null, 'Deal ID required', 400, { requestStartTime });
    } else if (request.method === 'DELETE') {
      if (dealId) {
        // DELETE /api/deals/:id - Delete deal
        return await handleDeleteDeal(response, dealId, requestStartTime);
      }
      return apiResponse(response, null, 'Deal ID required', 400, { requestStartTime });
    }
    
    return apiResponse(response, null, 'Method not allowed', 405, { requestStartTime });
  } catch (error) {
    console.error('Error in deals API:', error);
    return apiResponse(response, null, error.message, 500, { requestStartTime });
  }
}

// Pipeline statistics endpoint
async function handlePipelineStats(response, searchParams, requestStartTime) {
  try {
    const { ownerId, refresh } = Object.fromEntries(searchParams);
    
    if (!ownerId) {
      return apiResponse(response, null, 'Owner ID required', 400, { requestStartTime });
    }
    
    // Check cache first
    const cacheKey = createCacheKey('pipeline-stats', { ownerId });
    
    if (refresh !== 'true') {
      const cachedData = await getFromCache(cacheKey);
      if (cachedData) {
        return apiResponse(response, cachedData, null, 200, {
          requestStartTime,
          cacheHit: true,
          cacheKey
        });
      }
    }
    
    // Fetch pipeline statistics with optimized query
    const query = `
      WITH stage_stats AS (
        SELECT 
          ds.id as stage_id,
          ds.name as stage_name,
          ds.color,
          ds.order_position,
          COUNT(d.id) as deal_count,
          COALESCE(SUM(d.value), 0) as total_value,
          COALESCE(AVG(d.value), 0) as avg_value,
          COALESCE(AVG(EXTRACT(DAYS FROM (CURRENT_DATE - d.stage_changed_at::date))), 0) as avg_days_in_stage,
          COUNT(CASE WHEN d.expected_close_date < CURRENT_DATE THEN 1 END) as overdue_count
        FROM deal_stages ds
        LEFT JOIN deals d ON ds.id = d.stage_id AND d.owner_id = $1 AND d.status = 'active'
        GROUP BY ds.id, ds.name, ds.color, ds.order_position
      ),
      overall_stats AS (
        SELECT 
          COUNT(*) as total_deals,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active_deals,
          COUNT(CASE WHEN status = 'won' THEN 1 END) as won_deals,
          COUNT(CASE WHEN status = 'lost' THEN 1 END) as lost_deals,
          COALESCE(SUM(CASE WHEN status = 'active' THEN value END), 0) as pipeline_value,
          COALESCE(SUM(CASE WHEN status = 'won' THEN value END), 0) as won_value,
          COALESCE(AVG(CASE WHEN status = 'active' THEN value END), 0) as avg_deal_size
        FROM deals 
        WHERE owner_id = $1
      )
      SELECT 
        json_build_object(
          'stages', json_agg(stage_stats ORDER BY order_position),
          'overall', row_to_json(overall_stats)
        ) as pipeline_data
      FROM stage_stats, overall_stats
    `;
    
    const result = await executeQuery(query, [ownerId]);
    const pipelineData = result.rows[0]?.pipeline_data || { stages: [], overall: {} };
    
    // Cache for 5 minutes
    await setCache(cacheKey, pipelineData, 300);
    
    return apiResponse(response, pipelineData, null, 200, {
      requestStartTime,
      cacheHit: false,
      cacheKey,
      enableCaching: true,
      cacheTTL: 300
    });
  } catch (error) {
    console.error('Error fetching pipeline stats:', error);
    return apiResponse(response, null, error.message, 500, { requestStartTime });
  }
}

// Bulk operations endpoint
async function handleBulkOperations(response, request, requestStartTime) {
  try {
    const body = await request.json();
    const { operation, dealIds, updates } = body;
    
    if (!operation || !dealIds || !Array.isArray(dealIds)) {
      return apiResponse(response, null, 'Invalid bulk operation parameters', 400, { requestStartTime });
    }
    
    let results = [];
    
    switch (operation) {
      case 'update_stage':
        if (!updates?.stage_id) {
          return apiResponse(response, null, 'Stage ID required for bulk stage update', 400, { requestStartTime });
        }
        
        const updateQueries = dealIds.map(dealId => ({
          query: `
            UPDATE deals 
            SET stage_id = $1, stage_changed_at = NOW(), updated_at = NOW()
            WHERE id = $2
            RETURNING id, stage_id
          `,
          params: [updates.stage_id, dealId]
        }));
        
        results = await executeBatchQueries(updateQueries);
        break;
        
      case 'delete':
        const deleteQueries = dealIds.map(dealId => ({
          query: 'DELETE FROM deals WHERE id = $1 RETURNING id',
          params: [dealId]
        }));
        
        results = await executeBatchQueries(deleteQueries);
        break;
        
      default:
        return apiResponse(response, null, 'Unsupported bulk operation', 400, { requestStartTime });
    }
    
    // Invalidate relevant caches
    await invalidateCachePattern('deals.*');
    await invalidateCachePattern('pipeline-stats.*');
    
    return apiResponse(response, {
      operation,
      affected_deals: results.length,
      results: results.map(r => r.rows[0]).filter(Boolean)
    }, null, 200, { requestStartTime });
    
  } catch (error) {
    console.error('Error in bulk operation:', error);
    return apiResponse(response, null, error.message, 500, { requestStartTime });
  }
}

// Deal analytics endpoint
async function handleDealAnalytics(response, dealId, searchParams, requestStartTime) {
  try {
    const { timeframe = '30' } = Object.fromEntries(searchParams);
    
    // Check cache first
    const cacheKey = createCacheKey('deal-analytics', { dealId, timeframe });
    const cachedData = await getFromCache(cacheKey);
    
    if (cachedData) {
      return apiResponse(response, cachedData, null, 200, {
        requestStartTime,
        cacheHit: true,
        cacheKey
      });
    }
    
    // Get deal analytics with activity history
    const query = `
      WITH deal_info AS (
        SELECT d.*, ds.name as stage_name, ds.color as stage_color
        FROM deals d
        LEFT JOIN deal_stages ds ON d.stage_id = ds.id
        WHERE d.id = $1
      ),
      stage_history AS (
        SELECT 
          COUNT(*) as stage_changes,
          array_agg(
            json_build_object(
              'stage_id', stage_id,
              'changed_at', stage_changed_at,
              'days_in_stage', EXTRACT(DAYS FROM (COALESCE(LEAD(stage_changed_at) OVER (ORDER BY stage_changed_at), NOW()) - stage_changed_at))
            ) ORDER BY stage_changed_at
          ) as stage_progression
        FROM deals 
        WHERE id = $1
      ),
      recent_activities AS (
        SELECT 
          COUNT(*) as activity_count,
          array_agg(
            json_build_object(
              'type', activity_type,
              'description', description,
              'created_at', created_at
            ) ORDER BY created_at DESC
          ) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '%s days') as activities
        FROM activities 
        WHERE deal_id = $1
      )
      SELECT 
        row_to_json(deal_info) as deal,
        row_to_json(stage_history) as stage_history,
        row_to_json(recent_activities) as recent_activities
      FROM deal_info, stage_history, recent_activities
    `;
    
    const result = await executeQuery(query.replace('%s', timeframe), [dealId]);
    
    if (result.rows.length === 0) {
      return apiResponse(response, null, 'Deal not found', 404, { requestStartTime });
    }
    
    const analyticsData = result.rows[0];
    
    // Cache for 10 minutes
    await setCache(cacheKey, analyticsData, 600);
    
    return apiResponse(response, analyticsData, null, 200, {
      requestStartTime,
      cacheHit: false,
      cacheKey,
      enableCaching: true,
      cacheTTL: 600
    });
  } catch (error) {
    console.error('Error fetching deal analytics:', error);
    return apiResponse(response, null, error.message, 500, { requestStartTime });
  }
}

// List all deals with enhanced caching and optimization
async function handleDealsList(response, searchParams, requestStartTime) {
  try {
    const { ownerId, stageId, status, includeRelationships, limit, search, refresh } = Object.fromEntries(searchParams);
    
    // Create cache key based on parameters
    const cacheKey = createCacheKey('deals-list', {
      ownerId, stageId, status, includeRelationships, limit, search
    });
    
    // Check cache first (unless refresh requested)
    if (refresh !== 'true') {
      const cachedData = await getFromCache(cacheKey);
      if (cachedData) {
        return apiResponse(response, cachedData, null, 200, {
          requestStartTime,
          cacheHit: true,
          cacheKey
        });
      }
    }
    
    let query = `
      SELECT 
        d.*,
        ${includeRelationships === 'true' ? `
          c.name as company_name,
          c.domain as company_domain,
          ct.first_name as contact_first_name,
          ct.last_name as contact_last_name,
          ct.full_name as contact_full_name,
          ct.email as contact_email,
          ds.name as stage_name,
          ds.color as stage_color,
          ds.default_probability as default_probability
        ` : 'null as company_name, null as contact_full_name, null as contact_email, null as stage_name'}
      FROM deals d
      ${includeRelationships === 'true' ? `
        LEFT JOIN companies c ON d.company_id = c.id
        LEFT JOIN contacts ct ON d.primary_contact_id = ct.id
        LEFT JOIN deal_stages ds ON d.stage_id = ds.id
      ` : ''}
    `;
    
    const params = [];
    const conditions = [];
    
    if (search) {
      conditions.push(`(d.name ILIKE $${params.length + 1} OR d.company ILIKE $${params.length + 1})`);
      params.push(`%${search}%`);
    }
    
    if (ownerId) {
      conditions.push(`d.owner_id = $${params.length + 1}`);
      params.push(ownerId);
    }
    
    if (stageId) {
      conditions.push(`d.stage_id = $${params.length + 1}`);
      params.push(stageId);
    }
    
    if (status) {
      conditions.push(`d.status = $${params.length + 1}`);
      params.push(status);
    }
    
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    query += ` ORDER BY d.updated_at DESC`;
    
    if (limit) {
      query += ` LIMIT $${params.length + 1}`;
      params.push(parseInt(limit));
    }

    const result = await executeQuery(query, params);
    
    const data = result.rows.map(row => ({
      ...row,
      // Add computed fields
      daysInStage: row.stage_changed_at ? Math.floor((new Date() - new Date(row.stage_changed_at)) / (1000 * 60 * 60 * 24)) : 0,
      // Relationships if included
      deal_stages: (includeRelationships === 'true' && row.stage_name) ? {
        id: row.stage_id,
        name: row.stage_name,
        color: row.stage_color,
        default_probability: row.default_probability
      } : null,
      companies: (includeRelationships === 'true' && row.company_name) ? {
        id: row.company_id,
        name: row.company_name,
        domain: row.company_domain
      } : null,
      contacts: (includeRelationships === 'true' && row.contact_full_name) ? {
        id: row.primary_contact_id,
        full_name: row.contact_full_name,
        email: row.contact_email
      } : null
    }));

    // Cache for 2 minutes
    await setCache(cacheKey, data, 120);

    return apiResponse(response, data, null, 200, {
      requestStartTime,
      cacheHit: false,
      cacheKey,
      enableCaching: true,
      cacheTTL: 120
    });
  } catch (error) {
    console.error('Error fetching deals:', error);
    return apiResponse(response, null, error.message, 500);
  }
}

// Single deal by ID
async function handleSingleDeal(response, dealId, searchParams) {
  try {
    const { includeRelationships } = Object.fromEntries(searchParams);
    
    let query = `
      SELECT 
        d.*,
        ${includeRelationships === 'true' ? `
          c.name as company_name,
          c.domain as company_domain,
          ct.full_name as contact_full_name,
          ct.email as contact_email,
          ds.name as stage_name,
          ds.color as stage_color
        ` : 'null as company_name, null as contact_full_name, null as stage_name'}
      FROM deals d
      ${includeRelationships === 'true' ? `
        LEFT JOIN companies c ON d.company_id = c.id
        LEFT JOIN contacts ct ON d.primary_contact_id = ct.id
        LEFT JOIN deal_stages ds ON d.stage_id = ds.id
      ` : ''}
      WHERE d.id = $1
    `;

    const result = await executeQuery(query, [dealId]);
    
    if (result.rows.length === 0) {
      return apiResponse(response, null, 'Deal not found', 404);
    }
    
    const row = result.rows[0];
    const data = {
      ...row,
      daysInStage: row.stage_changed_at ? Math.floor((new Date() - new Date(row.stage_changed_at)) / (1000 * 60 * 60 * 24)) : 0,
      // Add relationships if requested
      deal_stages: (includeRelationships === 'true' && row.stage_name) ? {
        id: row.stage_id,
        name: row.stage_name,
        color: row.stage_color
      } : null,
      companies: (includeRelationships === 'true' && row.company_name) ? {
        id: row.company_id,
        name: row.company_name,
        domain: row.company_domain
      } : null,
      contacts: (includeRelationships === 'true' && row.contact_full_name) ? {
        id: row.primary_contact_id,
        full_name: row.contact_full_name,
        email: row.contact_email
      } : null
    };
    
    return apiResponse(response, data);
  } catch (error) {
    console.error('Error fetching deal:', error);
    return apiResponse(response, null, error.message, 500);
  }
}

// Create deal with cache invalidation
async function handleCreateDeal(response, request, requestStartTime) {
  try {
    const body = await request.json();
    const {
      name,
      company,
      company_id,
      primary_contact_id,
      contact_name,
      contact_email,
      value,
      description,
      stage_id,
      owner_id,
      expected_close_date,
      probability,
      status = 'active'
    } = body;

    // Validation: Ensure required fields are present
    if (!name || !company || !owner_id) {
      return apiResponse(response, null, 'Missing required fields: name, company, owner_id', 400, { requestStartTime });
    }
    
    console.log('🚀 Creating deal with validated data:', {
      name, company, company_id, primary_contact_id, value, stage_id, owner_id
    });
    
    const query = `
      INSERT INTO deals (
        name, company, company_id, primary_contact_id, contact_name, contact_email,
        value, description, stage_id, owner_id, expected_close_date, probability, status,
        created_at, updated_at, stage_changed_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW(), NOW())
      RETURNING *
    `;
    
    const params = [
      name, company, company_id, primary_contact_id, contact_name, contact_email,
      value, description, stage_id, owner_id, expected_close_date, probability, status
    ];
    
    const result = await executeQueryWithRetry(query, params);
    
    // Ensure we got a result
    if (!result || !result.rows || result.rows.length === 0) {
      console.error('❌ Database returned no rows after insert');
      throw new Error('Failed to create deal - database returned no data');
    }
    
    const createdDeal = result.rows[0];
    
    // Validate the created deal has required fields
    if (!createdDeal.id) {
      console.error('❌ Created deal missing ID:', createdDeal);
      throw new Error('Failed to create deal - missing ID in response');
    }
    
    console.log('✅ Deal created successfully:', { id: createdDeal.id, name: createdDeal.name });
    
    // Invalidate relevant caches
    await invalidateCachePattern('deals.*');
    await invalidateCachePattern('dashboard.*');
    await invalidateCachePattern('pipeline-stats.*');
    
    // Return properly formatted response with data wrapper for consistency
    return apiResponse(response, { data: createdDeal }, 'Deal created successfully', 201, { requestStartTime });
  } catch (error) {
    console.error('❌ Error creating deal:', error);
    return apiResponse(response, null, error.message, 500, { requestStartTime });
  }
}

// Update deal with cache invalidation
async function handleUpdateDeal(response, request, dealId, requestStartTime) {
  try {
    const body = await request.json();
    const updates = [];
    const params = [];
    
    // Build dynamic update query
    let paramCount = 1;
    Object.entries(body).forEach(([key, value]) => {
      if (value !== undefined && key !== 'id') {
        updates.push(`${key} = $${paramCount}`);
        params.push(value);
        paramCount++;
      }
    });
    
    if (updates.length === 0) {
      return apiResponse(response, null, 'No fields to update', 400, { requestStartTime });
    }
    
    // Always update updated_at
    updates.push(`updated_at = NOW()`);
    
    // If stage_id is being updated, also update stage_changed_at
    if ('stage_id' in body) {
      updates.push(`stage_changed_at = NOW()`);
    }
    
    params.push(dealId); // Add dealId as the last parameter
    
    const query = `
      UPDATE deals 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;
    
    const result = await executeQueryWithRetry(query, params);
    
    if (result.rows.length === 0) {
      return apiResponse(response, null, 'Deal not found', 404, { requestStartTime });
    }
    
    // Invalidate relevant caches
    await invalidateCachePattern('deals.*');
    await invalidateCachePattern('dashboard.*');
    await invalidateCachePattern('pipeline-stats.*');
    await invalidateCachePattern('deal-analytics.*');
    
    return apiResponse(response, result.rows[0], 'Deal updated successfully', 200, { requestStartTime });
  } catch (error) {
    console.error('Error updating deal:', error);
    return apiResponse(response, null, error.message, 500);
  }
}

// Delete deal with cache invalidation
async function handleDeleteDeal(response, dealId, requestStartTime) {
  try {
    const query = `DELETE FROM deals WHERE id = $1 RETURNING id`;
    const result = await executeQueryWithRetry(query, [dealId]);
    
    if (result.rows.length === 0) {
      return apiResponse(response, null, 'Deal not found', 404, { requestStartTime });
    }
    
    // Invalidate relevant caches
    await invalidateCachePattern('deals.*');
    await invalidateCachePattern('dashboard.*');
    await invalidateCachePattern('pipeline-stats.*');
    await invalidateCachePattern('deal-analytics.*');
    
    return apiResponse(response, { id: dealId }, 'Deal deleted successfully', 200, { requestStartTime });
  } catch (error) {
    console.error('Error deleting deal:', error);
    return apiResponse(response, null, error.message, 500);
  }
}

// Convert deal to subscription client
async function handleConvertDealToSubscription(response, request, dealId) {
  try {
    const body = await request.json();
    
    // First, get the deal details
    const dealQuery = `SELECT * FROM deals WHERE id = $1`;
    const dealResult = await executeQuery(dealQuery, [dealId]);
    
    if (dealResult.rows.length === 0) {
      return apiResponse(response, null, 'Deal not found', 404);
    }
    
    const deal = dealResult.rows[0];
    
    // Check if deal is already converted
    const existingClientQuery = `SELECT id FROM clients WHERE deal_id = $1`;
    const existingResult = await executeQuery(existingClientQuery, [dealId]);
    
    if (existingResult.rows.length > 0) {
      return apiResponse(response, null, 'Deal has already been converted to a subscription', 409);
    }
    
    // Extract data from request body with fallbacks from deal
    const {
      company_name = deal.company,
      contact_name = deal.contact_name,
      contact_email = deal.contact_email,
      subscription_amount = deal.monthly_mrr || 0,
      subscription_start_date,
      status = 'active'
    } = body;
    
    // Validate required fields
    if (!company_name) {
      return apiResponse(response, null, 'company_name is required', 400);
    }
    
    if (!subscription_amount || subscription_amount <= 0) {
      return apiResponse(response, null, 'subscription_amount must be greater than 0', 400);
    }
    
    // Create the client record
    const clientQuery = `
      INSERT INTO clients (
        company_name, contact_name, contact_email, subscription_amount,
        status, deal_id, owner_id, subscription_start_date
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    
    const clientParams = [
      company_name,
      contact_name,
      contact_email,
      subscription_amount,
      status,
      dealId,
      deal.owner_id,
      subscription_start_date || new Date().toISOString().split('T')[0] // Default to today
    ];
    
    const clientResult = await executeQuery(clientQuery, clientParams);
    const client = clientResult.rows[0];
    
    // Convert subscription_amount to number for response
    client.subscription_amount = parseFloat(client.subscription_amount || 0);
    
    return apiResponse(response, {
      client,
      deal: {
        id: deal.id,
        name: deal.name,
        company: deal.company,
        monthly_mrr: deal.monthly_mrr,
        converted_at: new Date().toISOString()
      }
    }, 'Deal converted to subscription successfully', 201);
    
  } catch (error) {
    console.error('Error converting deal to subscription:', error);
    return apiResponse(response, null, error.message, 500);
  }
}

// Get subscription client for a deal
async function handleGetDealSubscription(response, dealId) {
  try {
    const query = `
      SELECT 
        c.*,
        d.name as deal_name,
        d.company as deal_company,
        d.monthly_mrr as deal_monthly_mrr
      FROM clients c
      JOIN deals d ON c.deal_id = d.id
      WHERE c.deal_id = $1
    `;
    
    const result = await executeQuery(query, [dealId]);
    
    if (result.rows.length === 0) {
      return apiResponse(response, null, 'No subscription found for this deal', 404);
    }
    
    const row = result.rows[0];
    const data = {
      id: row.id,
      company_name: row.company_name,
      contact_name: row.contact_name,
      contact_email: row.contact_email,
      subscription_amount: parseFloat(row.subscription_amount || 0),
      status: row.status,
      deal_id: row.deal_id,
      owner_id: row.owner_id,
      subscription_start_date: row.subscription_start_date,
      churn_date: row.churn_date,
      created_at: row.created_at,
      updated_at: row.updated_at,
      deal: {
        id: row.deal_id,
        name: row.deal_name,
        company: row.deal_company,
        monthly_mrr: parseFloat(row.deal_monthly_mrr || 0)
      }
    };
    
    return apiResponse(response, data);
  } catch (error) {
    console.error('Error fetching deal subscription:', error);
    return apiResponse(response, null, error.message, 500);
  }
} 