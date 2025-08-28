import { executeQuery, executeQueryWithRetry, handleCORS, apiResponse } from './_db.js';
import { createCacheKey, getFromCache, setCache } from './utils/cache.js';
import { rateLimitMiddleware } from './utils/rateLimiter.js';

export default async function handler(request, response) {
  const requestStartTime = Date.now();
  
  // Handle CORS preflight
  const corsResponse = handleCORS(request, response);
  if (corsResponse) return corsResponse;

  // Apply rate limiting
  if (!rateLimitMiddleware(request, response)) {
    return; // Rate limit exceeded
  }

  try {
    // Parse URL for Vercel compatibility
    const urlParts = request.url.split('?');
    const pathname = urlParts[0];
    const queryString = urlParts[1] || '';
    const searchParams = new URLSearchParams(queryString);
    
    const pathSegments = pathname.split('/').filter(segment => segment && segment !== 'api' && segment !== 'companies');
    const companyId = pathSegments[0];
    const subAction = pathSegments[1];
    
    // Handle special endpoints
    if (subAction === 'analytics' && request.method === 'GET') {
      return await handleCompanyAnalytics(response, companyId, searchParams, requestStartTime);
    }
    if (subAction === 'deals-summary' && request.method === 'GET') {
      return await handleCompanyDealsSummary(response, companyId, requestStartTime);
    }
    
    if (request.method === 'GET') {
      if (!companyId) {
        // GET /api/companies - List companies with enhanced aggregation
        return await handleCompaniesList(response, searchParams, requestStartTime);
      } else {
        // GET /api/companies/:id - Single company with full details
        return await handleSingleCompany(response, companyId, searchParams, requestStartTime);
      }
    }

    return apiResponse(response, null, 'Method not allowed', 405, { requestStartTime });
  } catch (error) {
    console.error('Error in companies API:', error);
    return apiResponse(response, null, error.message, 500, { requestStartTime });
  }
}

// Enhanced companies list with server-side aggregation and caching
async function handleCompaniesList(response, searchParams, requestStartTime) {
  try {
    const { search, includeStats, limit, ownerId, refresh } = Object.fromEntries(searchParams);
    
    // Create cache key
    const cacheKey = createCacheKey('companies-list', {
      search, includeStats, limit, ownerId
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
    
    let query;
    
    if (includeStats === 'true') {
      // Optimized query with server-side aggregation
      query = `
        WITH company_stats AS (
          SELECT 
            c.*,
            COALESCE(contacts_agg.contact_count, 0) as contact_count,
            COALESCE(deals_agg.deal_count, 0) as deal_count,
            COALESCE(deals_agg.total_deal_value, 0) as total_deal_value,
            COALESCE(deals_agg.active_deals, 0) as active_deals,
            COALESCE(deals_agg.won_deals, 0) as won_deals,
            COALESCE(deals_agg.avg_deal_size, 0) as avg_deal_size,
            activities_agg.last_activity_date,
            activities_agg.activity_count_30d
          FROM companies c
          LEFT JOIN (
            SELECT 
              company_id,
              COUNT(*) as contact_count
            FROM contacts 
            WHERE company_id IS NOT NULL
            GROUP BY company_id
          ) contacts_agg ON c.id = contacts_agg.company_id
          LEFT JOIN (
            SELECT 
              company_id,
              COUNT(*) as deal_count,
              COALESCE(SUM(value), 0) as total_deal_value,
              COUNT(CASE WHEN status = 'active' THEN 1 END) as active_deals,
              COUNT(CASE WHEN status = 'won' THEN 1 END) as won_deals,
              COALESCE(AVG(CASE WHEN status = 'active' THEN value END), 0) as avg_deal_size
            FROM deals 
            WHERE company_id IS NOT NULL
            GROUP BY company_id
          ) deals_agg ON c.id = deals_agg.company_id
          LEFT JOIN (
            SELECT 
              company_id,
              MAX(created_at) as last_activity_date,
              COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as activity_count_30d
            FROM activities 
            WHERE company_id IS NOT NULL
            GROUP BY company_id
          ) activities_agg ON c.id = activities_agg.company_id
        )
        SELECT * FROM company_stats
      `;
    } else {
      query = `SELECT * FROM companies c`;
    }
    
    const params = [];
    const conditions = [];
    
    if (search) {
      conditions.push(`(c.name ILIKE $${params.length + 1} OR c.domain ILIKE $${params.length + 1} OR c.industry ILIKE $${params.length + 1})`);
      params.push(`%${search}%`);
    }
    
    if (ownerId) {
      conditions.push(`c.owner_id = $${params.length + 1}`);
      params.push(ownerId);
    }
    
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    query += ` ORDER BY c.updated_at DESC`;
    
    if (limit) {
      query += ` LIMIT $${params.length + 1}`;
      params.push(parseInt(limit));
    }

    const result = await executeQueryWithRetry(query, params);
    
    // Process and enrich data
    const enrichedData = result.rows.map(row => ({
      ...row,
      // Computed fields
      engagement_score: calculateEngagementScore(row),
      health_status: determineCompanyHealth(row),
      // Convert numeric strings to numbers
      contact_count: parseInt(row.contact_count || 0),
      deal_count: parseInt(row.deal_count || 0),
      total_deal_value: parseFloat(row.total_deal_value || 0),
      active_deals: parseInt(row.active_deals || 0),
      won_deals: parseInt(row.won_deals || 0),
      avg_deal_size: parseFloat(row.avg_deal_size || 0),
      activity_count_30d: parseInt(row.activity_count_30d || 0)
    }));
    
    // Cache for 5 minutes
    await setCache(cacheKey, enrichedData, 300);
    
    return apiResponse(response, enrichedData, null, 200, {
      requestStartTime,
      cacheHit: false,
      cacheKey,
      enableCaching: true,
      cacheTTL: 300
    });
  } catch (error) {
    console.error('Error fetching companies:', error);
    return apiResponse(response, null, error.message, 500, { requestStartTime });
  }
}

// Single company with comprehensive details
async function handleSingleCompany(response, companyId, searchParams, requestStartTime) {
  try {
    const { includeDetails = 'true' } = Object.fromEntries(searchParams);
    
    // Check cache first
    const cacheKey = createCacheKey('company-details', { companyId, includeDetails });
    const cachedData = await getFromCache(cacheKey);
    
    if (cachedData) {
      return apiResponse(response, cachedData, null, 200, {
        requestStartTime,
        cacheHit: true,
        cacheKey
      });
    }
    
    let query = `
      SELECT 
        c.*,
        ${includeDetails === 'true' ? `
          json_build_object(
            'contacts', COALESCE(contacts_data.contacts, '[]'::json),
            'deals', COALESCE(deals_data.deals, '[]'::json),
            'recent_activities', COALESCE(activities_data.activities, '[]'::json),
            'stats', json_build_object(
              'total_contacts', COALESCE(contacts_data.contact_count, 0),
              'total_deals', COALESCE(deals_data.deal_count, 0),
              'total_deal_value', COALESCE(deals_data.total_value, 0),
              'active_deals', COALESCE(deals_data.active_deals, 0),
              'won_deals', COALESCE(deals_data.won_deals, 0),
              'recent_activity_count', COALESCE(activities_data.activity_count, 0)
            )
          ) as details
        ` : 'null as details'}
      FROM companies c
      ${includeDetails === 'true' ? `
        LEFT JOIN (
          SELECT 
            company_id,
            COUNT(*) as contact_count,
            json_agg(
              json_build_object(
                'id', id,
                'full_name', full_name,
                'email', email,
                'title', title,
                'is_primary', is_primary
              )
            ) as contacts
          FROM contacts 
          WHERE company_id = $1
          GROUP BY company_id
        ) contacts_data ON c.id = contacts_data.company_id
        LEFT JOIN (
          SELECT 
            company_id,
            COUNT(*) as deal_count,
            COALESCE(SUM(value), 0) as total_value,
            COUNT(CASE WHEN status = 'active' THEN 1 END) as active_deals,
            COUNT(CASE WHEN status = 'won' THEN 1 END) as won_deals,
            json_agg(
              json_build_object(
                'id', id,
                'name', name,
                'value', value,
                'status', status,
                'stage_id', stage_id,
                'created_at', created_at
              ) ORDER BY created_at DESC
            ) as deals
          FROM deals 
          WHERE company_id = $1
          GROUP BY company_id
        ) deals_data ON c.id = deals_data.company_id
        LEFT JOIN (
          SELECT 
            company_id,
            COUNT(*) as activity_count,
            json_agg(
              json_build_object(
                'id', id,
                'activity_type', activity_type,
                'description', description,
                'created_at', created_at
              ) ORDER BY created_at DESC
            ) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') as activities
          FROM activities 
          WHERE company_id = $1
          GROUP BY company_id
        ) activities_data ON c.id = activities_data.company_id
      ` : ''}
      WHERE c.id = $1
    `;
    
    const result = await executeQueryWithRetry(query, [companyId]);
    
    if (result.rows.length === 0) {
      return apiResponse(response, null, 'Company not found', 404, { requestStartTime });
    }
    
    const companyData = result.rows[0];
    
    // Parse JSON details if included
    if (companyData.details) {
      companyData.details = typeof companyData.details === 'string' 
        ? JSON.parse(companyData.details) 
        : companyData.details;
    }
    
    // Cache for 10 minutes
    await setCache(cacheKey, companyData, 600);
    
    return apiResponse(response, companyData, null, 200, {
      requestStartTime,
      cacheHit: false,
      cacheKey,
      enableCaching: true,
      cacheTTL: 600
    });
  } catch (error) {
    console.error('Error fetching company details:', error);
    return apiResponse(response, null, error.message, 500, { requestStartTime });
  }
}

// Company analytics endpoint
async function handleCompanyAnalytics(response, companyId, searchParams, requestStartTime) {
  try {
    const { timeframe = '90' } = Object.fromEntries(searchParams);
    
    const cacheKey = createCacheKey('company-analytics', { companyId, timeframe });
    const cachedData = await getFromCache(cacheKey);
    
    if (cachedData) {
      return apiResponse(response, cachedData, null, 200, {
        requestStartTime,
        cacheHit: true,
        cacheKey
      });
    }
    
    // Complex analytics query with time-based analysis
    const query = `
      WITH time_series AS (
        SELECT generate_series(
          CURRENT_DATE - INTERVAL '${timeframe} days',
          CURRENT_DATE,
          INTERVAL '1 day'
        )::date as date
      ),
      daily_activity AS (
        SELECT 
          DATE(created_at) as activity_date,
          activity_type,
          COUNT(*) as count
        FROM activities 
        WHERE company_id = $1 
        AND created_at >= CURRENT_DATE - INTERVAL '${timeframe} days'
        GROUP BY DATE(created_at), activity_type
      ),
      deal_progression AS (
        SELECT 
          DATE(stage_changed_at) as change_date,
          stage_id,
          COUNT(*) as stage_changes
        FROM deals 
        WHERE company_id = $1 
        AND stage_changed_at >= CURRENT_DATE - INTERVAL '${timeframe} days'
        GROUP BY DATE(stage_changed_at), stage_id
      )
      SELECT 
        json_build_object(
          'timeframe_days', ${timeframe},
          'activity_timeline', COALESCE(
            json_agg(DISTINCT 
              json_build_object(
                'date', daily_activity.activity_date,
                'type', daily_activity.activity_type,
                'count', daily_activity.count
              )
            ) FILTER (WHERE daily_activity.activity_date IS NOT NULL),
            '[]'::json
          ),
          'deal_progression', COALESCE(
            json_agg(DISTINCT 
              json_build_object(
                'date', deal_progression.change_date,
                'stage_id', deal_progression.stage_id,
                'changes', deal_progression.stage_changes
              )
            ) FILTER (WHERE deal_progression.change_date IS NOT NULL),
            '[]'::json
          ),
          'summary_stats', json_build_object(
            'total_activities', (SELECT COUNT(*) FROM activities WHERE company_id = $1 AND created_at >= CURRENT_DATE - INTERVAL '${timeframe} days'),
            'total_deal_changes', (SELECT COUNT(*) FROM deals WHERE company_id = $1 AND stage_changed_at >= CURRENT_DATE - INTERVAL '${timeframe} days'),
            'engagement_trend', 'stable'
          )
        ) as analytics_data
      FROM time_series
      LEFT JOIN daily_activity ON time_series.date = daily_activity.activity_date
      LEFT JOIN deal_progression ON time_series.date = deal_progression.change_date
    `;
    
    const result = await executeQueryWithRetry(query, [companyId]);
    const analyticsData = result.rows[0]?.analytics_data || {};
    
    // Cache for 15 minutes
    await setCache(cacheKey, analyticsData, 900);
    
    return apiResponse(response, analyticsData, null, 200, {
      requestStartTime,
      cacheHit: false,
      cacheKey,
      enableCaching: true,
      cacheTTL: 900
    });
  } catch (error) {
    console.error('Error fetching company analytics:', error);
    return apiResponse(response, null, error.message, 500, { requestStartTime });
  }
}

// Company deals summary
async function handleCompanyDealsSummary(response, companyId, requestStartTime) {
  try {
    const cacheKey = createCacheKey('company-deals-summary', { companyId });
    const cachedData = await getFromCache(cacheKey);
    
    if (cachedData) {
      return apiResponse(response, cachedData, null, 200, {
        requestStartTime,
        cacheHit: true,
        cacheKey
      });
    }
    
    const query = `
      SELECT 
        json_build_object(
          'total_deals', COUNT(*),
          'active_deals', COUNT(CASE WHEN status = 'active' THEN 1 END),
          'won_deals', COUNT(CASE WHEN status = 'won' THEN 1 END),
          'lost_deals', COUNT(CASE WHEN status = 'lost' THEN 1 END),
          'total_value', COALESCE(SUM(value), 0),
          'won_value', COALESCE(SUM(CASE WHEN status = 'won' THEN value END), 0),
          'pipeline_value', COALESCE(SUM(CASE WHEN status = 'active' THEN value END), 0),
          'avg_deal_size', COALESCE(AVG(value), 0),
          'avg_time_to_close', COALESCE(
            AVG(EXTRACT(DAYS FROM (updated_at - created_at))) FILTER (WHERE status = 'won'),
            0
          ),
          'deals_by_stage', json_agg(
            DISTINCT json_build_object(
              'stage_id', stage_id,
              'count', COUNT(*) OVER (PARTITION BY stage_id),
              'value', COALESCE(SUM(value) OVER (PARTITION BY stage_id), 0)
            )
          ) FILTER (WHERE status = 'active')
        ) as summary
      FROM deals 
      WHERE company_id = $1
    `;
    
    const result = await executeQueryWithRetry(query, [companyId]);
    const summaryData = result.rows[0]?.summary || {};
    
    // Cache for 5 minutes
    await setCache(cacheKey, summaryData, 300);
    
    return apiResponse(response, summaryData, null, 200, {
      requestStartTime,
      cacheHit: false,
      cacheKey,
      enableCaching: true,
      cacheTTL: 300
    });
  } catch (error) {
    console.error('Error fetching company deals summary:', error);
    return apiResponse(response, null, error.message, 500, { requestStartTime });
  }
}

// Helper functions for data enrichment
function calculateEngagementScore(company) {
  const activityCount = parseInt(company.activity_count_30d || 0);
  const dealCount = parseInt(company.active_deals || 0);
  const contactCount = parseInt(company.contact_count || 0);
  
  // Simple scoring algorithm
  let score = 0;
  score += Math.min(activityCount * 2, 40); // Max 40 points for activities
  score += Math.min(dealCount * 15, 30); // Max 30 points for deals
  score += Math.min(contactCount * 5, 30); // Max 30 points for contacts
  
  return Math.min(score, 100);
}

function determineCompanyHealth(company) {
  const engagementScore = calculateEngagementScore(company);
  const dealCount = parseInt(company.active_deals || 0);
  const lastActivity = company.last_activity_date;
  
  if (engagementScore >= 70 && dealCount > 0) {
    return 'excellent';
  } else if (engagementScore >= 50 || dealCount > 0) {
    return 'good';
  } else if (engagementScore >= 30) {
    return 'fair';
  } else {
    return 'poor';
  }
} 