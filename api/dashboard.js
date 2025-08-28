import { executeQuery, handleCORS, apiResponse } from './_db.js';
import { createCacheKey, getFromCache, setCache } from '../lib/api-utils/cache.js';

export default async function handler(request, response) {
  // Handle CORS preflight
  const corsResponse = handleCORS(request, response);
  if (corsResponse) return corsResponse;

  try {
    // Parse URL for Vercel compatibility
    const urlParts = request.url.split('?');
    const queryString = urlParts[1] || '';
    const searchParams = new URLSearchParams(queryString);
    const { ownerId, refresh } = Object.fromEntries(searchParams);
    
    if (request.method === 'GET') {
      return await handleDashboardData(response, { ownerId, refresh: refresh === 'true' });
    }
    
    return apiResponse(response, null, 'Method not allowed', 405);
  } catch (error) {
    console.error('Error in dashboard API:', error);
    return apiResponse(response, null, error.message, 500);
  }
}

// Consolidated dashboard data endpoint
async function handleDashboardData(response, { ownerId, refresh = false }) {
  try {
    // Create cache key
    const cacheKey = createCacheKey('dashboard', { ownerId });
    
    // Check cache first (unless refresh requested)
    if (!refresh) {
      const cachedData = await getFromCache(cacheKey);
      if (cachedData) {
        console.log('✅ Dashboard data served from cache');
        return apiResponse(response, cachedData);
      }
    }

    // Parallel data fetching for optimal performance
    const [
      dealsData,
      activitiesData,
      companiesData,
      pipelineStats,
      recentActivities,
      upcomingTasks
    ] = await Promise.all([
      fetchDealsOverview(ownerId),
      fetchActivitiesStats(ownerId),
      fetchCompaniesOverview(ownerId),
      fetchPipelineStatistics(ownerId),
      fetchRecentActivities(ownerId, 10),
      fetchUpcomingTasks(ownerId, 5)
    ]);

    const dashboardData = {
      overview: {
        deals: dealsData,
        activities: activitiesData,
        companies: companiesData,
        pipeline: pipelineStats
      },
      recent: {
        activities: recentActivities,
        tasks: upcomingTasks
      },
      metadata: {
        generatedAt: new Date().toISOString(),
        ownerId,
        cached: false
      }
    };

    // Cache for 5 minutes
    await setCache(cacheKey, dashboardData, 300);
    
    console.log('✅ Dashboard data generated and cached');
    return apiResponse(response, dashboardData);
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return apiResponse(response, null, error.message, 500);
  }
}

// Optimized deals overview with aggregation
async function fetchDealsOverview(ownerId) {
  const query = `
    SELECT 
      COUNT(*) as total_deals,
      COUNT(CASE WHEN status = 'active' THEN 1 END) as active_deals,
      COUNT(CASE WHEN status = 'won' THEN 1 END) as won_deals,
      COUNT(CASE WHEN status = 'lost' THEN 1 END) as lost_deals,
      COALESCE(SUM(CASE WHEN status = 'active' THEN value END), 0) as pipeline_value,
      COALESCE(SUM(CASE WHEN status = 'won' THEN value END), 0) as won_value,
      COALESCE(AVG(CASE WHEN status = 'active' THEN value END), 0) as avg_deal_size,
      COUNT(CASE WHEN status = 'active' AND expected_close_date < CURRENT_DATE THEN 1 END) as overdue_deals
    FROM deals 
    WHERE owner_id = $1
  `;
  
  const result = await executeQuery(query, [ownerId]);
  return result.rows[0];
}

// Activities statistics with time-based aggregation
async function fetchActivitiesStats(ownerId) {
  const query = `
    SELECT 
      COUNT(*) as total_activities,
      COUNT(CASE WHEN DATE(created_at) = CURRENT_DATE THEN 1 END) as today_activities,
      COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as week_activities,
      COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as month_activities,
      COUNT(CASE WHEN activity_type = 'call' THEN 1 END) as calls_count,
      COUNT(CASE WHEN activity_type = 'email' THEN 1 END) as emails_count,
      COUNT(CASE WHEN activity_type = 'meeting' THEN 1 END) as meetings_count
    FROM activities 
    WHERE owner_id = $1
    AND created_at >= CURRENT_DATE - INTERVAL '90 days'
  `;
  
  const result = await executeQuery(query, [ownerId]);
  return result.rows[0];
}

// Companies overview with deal aggregation
async function fetchCompaniesOverview(ownerId) {
  const query = `
    SELECT 
      COUNT(DISTINCT c.id) as total_companies,
      COUNT(DISTINCT CASE WHEN d.id IS NOT NULL THEN c.id END) as companies_with_deals,
      COUNT(DISTINCT ct.id) as total_contacts,
      COALESCE(AVG(company_deals.deal_count), 0) as avg_deals_per_company
    FROM companies c
    LEFT JOIN deals d ON c.id = d.company_id AND d.owner_id = $1
    LEFT JOIN contacts ct ON c.id = ct.company_id
    LEFT JOIN (
      SELECT company_id, COUNT(*) as deal_count
      FROM deals
      WHERE owner_id = $1 AND company_id IS NOT NULL
      GROUP BY company_id
    ) company_deals ON c.id = company_deals.company_id
    WHERE c.owner_id = $1
  `;
  
  const result = await executeQuery(query, [ownerId]);
  return result.rows[0];
}

// Pipeline statistics by stage
async function fetchPipelineStatistics(ownerId) {
  const query = `
    SELECT 
      ds.id as stage_id,
      ds.name as stage_name,
      ds.color as stage_color,
      ds.order_position,
      COUNT(d.id) as deal_count,
      COALESCE(SUM(d.value), 0) as stage_value,
      COALESCE(AVG(d.value), 0) as avg_deal_value,
      COALESCE(AVG(EXTRACT(DAYS FROM (CURRENT_DATE - d.stage_changed_at::date))), 0) as avg_days_in_stage
    FROM deal_stages ds
    LEFT JOIN deals d ON ds.id = d.stage_id AND d.owner_id = $1 AND d.status = 'active'
    GROUP BY ds.id, ds.name, ds.color, ds.order_position
    ORDER BY ds.order_position
  `;
  
  const result = await executeQuery(query, [ownerId]);
  return result.rows;
}

// Recent activities with deal context
async function fetchRecentActivities(ownerId, limit = 10) {
  const query = `
    SELECT 
      a.*,
      d.name as deal_name,
      d.company as deal_company,
      c.name as company_name
    FROM activities a
    LEFT JOIN deals d ON a.deal_id = d.id
    LEFT JOIN companies c ON a.company_id = c.id
    WHERE a.owner_id = $1
    ORDER BY a.created_at DESC
    LIMIT $2
  `;
  
  const result = await executeQuery(query, [ownerId, limit]);
  return result.rows;
}

// Upcoming tasks and follow-ups
async function fetchUpcomingTasks(ownerId, limit = 5) {
  const query = `
    SELECT 
      d.id,
      d.name as deal_name,
      d.company,
      d.expected_close_date,
      d.value,
      ds.name as stage_name,
      ds.color as stage_color,
      EXTRACT(DAYS FROM (d.expected_close_date - CURRENT_DATE)) as days_until_close
    FROM deals d
    JOIN deal_stages ds ON d.stage_id = ds.id
    WHERE d.owner_id = $1 
    AND d.status = 'active'
    AND d.expected_close_date IS NOT NULL
    AND d.expected_close_date >= CURRENT_DATE
    ORDER BY d.expected_close_date ASC
    LIMIT $2
  `;
  
  const result = await executeQuery(query, [ownerId, limit]);
  return result.rows;
}