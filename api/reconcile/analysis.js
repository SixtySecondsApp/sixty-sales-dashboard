import { executeQuery, handleCORS, apiResponse } from '../_db.js';

export default async function handler(request, response) {
  // Handle CORS preflight
  const corsResponse = handleCORS(request, response);
  if (corsResponse) return corsResponse;

  try {
    // Only allow GET requests for analysis
    if (request.method !== 'GET') {
      return apiResponse(response, null, 'Method not allowed', 405);
    }

    // Parse URL for parameters
    const url = new URL(request.url, `http://${request.headers.host}`);
    const {
      userId,
      startDate,
      endDate,
      analysisType = 'overview',
      includeMatching = 'true',
      confidenceThreshold = '50'
    } = Object.fromEntries(url.searchParams);

    console.log(`Starting reconciliation analysis: ${analysisType}, user: ${userId || 'all'}`);

    // Route to appropriate analysis function
    switch (analysisType) {
      case 'overview':
        return await handleOverviewAnalysis(response, { userId, startDate, endDate });
      case 'orphans':
        return await handleOrphanAnalysis(response, { userId, startDate, endDate });
      case 'duplicates':
        return await handleDuplicateAnalysis(response, { userId, startDate, endDate });
      case 'matching':
        return await handleMatchingAnalysis(response, { 
          userId, 
          startDate, 
          endDate, 
          confidenceThreshold: parseInt(confidenceThreshold) 
        });
      case 'statistics':
        return await handleStatisticsAnalysis(response, { userId, startDate, endDate });
      default:
        return apiResponse(response, null, 'Invalid analysis type', 400);
    }
  } catch (error) {
    console.error('Error in reconciliation analysis API:', error);
    return apiResponse(response, null, error.message, 500);
  }
}

// Overview analysis - comprehensive summary
async function handleOverviewAnalysis(response, { userId, startDate, endDate }) {
  try {
    console.log('Executing overview analysis...');
    
    let baseQuery = `
      WITH reconciliation_stats AS (
        SELECT 
          -- Total counts
          COUNT(DISTINCT CASE WHEN a.type = 'sale' AND a.status = 'completed' THEN a.id END) as total_sales_activities,
          COUNT(DISTINCT CASE WHEN d.status = 'won' THEN d.id END) as total_won_deals,
          COUNT(DISTINCT CASE WHEN c.status = 'active' THEN c.id END) as total_active_clients,
          
          -- Orphan counts
          COUNT(DISTINCT CASE WHEN a.type = 'sale' AND a.status = 'completed' AND a.deal_id IS NULL THEN a.id END) as orphan_activities,
          COUNT(DISTINCT orphan_deals.id) as orphan_deals,
          
          -- Revenue totals
          COALESCE(SUM(CASE WHEN a.type = 'sale' AND a.status = 'completed' THEN a.amount END), 0) as total_activity_revenue,
          COALESCE(SUM(CASE WHEN d.status = 'won' THEN d.value END), 0) as total_deal_revenue,
          COALESCE(SUM(CASE WHEN c.status = 'active' THEN c.subscription_amount END), 0) as total_mrr
        FROM activities a
        FULL OUTER JOIN deals d ON d.owner_id = a.user_id
        FULL OUTER JOIN clients c ON c.owner_id = COALESCE(a.user_id, d.owner_id)
        LEFT JOIN (
          SELECT d.id
          FROM deals d
          WHERE d.status = 'won'
            AND NOT EXISTS (
              SELECT 1 FROM activities a 
              WHERE a.deal_id = d.id 
                AND a.type = 'sale' 
                AND a.status = 'completed'
            )
        ) orphan_deals ON orphan_deals.id = d.id
        WHERE 1=1
    `;

    const params = [];
    let paramCount = 0;

    // Add user filter if provided
    if (userId) {
      paramCount++;
      baseQuery += ` AND (a.user_id = $${paramCount} OR d.owner_id = $${paramCount} OR c.owner_id = $${paramCount})`;
      params.push(userId);
    }

    // Add date range filters if provided
    if (startDate) {
      paramCount++;
      baseQuery += ` AND (a.date >= $${paramCount} OR d.stage_changed_at >= $${paramCount})`;
      params.push(startDate);
    }

    if (endDate) {
      paramCount++;
      baseQuery += ` AND (a.date <= $${paramCount} OR d.stage_changed_at <= $${paramCount})`;
      params.push(endDate);
    }

    const finalQuery = baseQuery + `
      )
      SELECT 
        total_sales_activities,
        total_won_deals,
        total_active_clients,
        orphan_activities,
        orphan_deals,
        total_activity_revenue,
        total_deal_revenue,
        total_mrr,
        CASE 
          WHEN total_sales_activities > 0 
          THEN ROUND((total_sales_activities - orphan_activities) * 100.0 / total_sales_activities, 2)
          ELSE 0
        END as activity_deal_linkage_rate,
        CASE 
          WHEN total_won_deals > 0 
          THEN ROUND((total_won_deals - orphan_deals) * 100.0 / total_won_deals, 2)
          ELSE 0
        END as deal_activity_linkage_rate,
        CASE 
          WHEN (total_sales_activities + total_won_deals) > 0 
          THEN ROUND(
            ((total_sales_activities - orphan_activities) + (total_won_deals - orphan_deals)) * 100.0 / 
            (total_sales_activities + total_won_deals), 2
          )
          ELSE 0
        END as overall_data_quality_score
      FROM reconciliation_stats
    `;

    const result = await executeQuery(finalQuery, params);
    
    if (result.rows.length === 0) {
      return apiResponse(response, {
        total_sales_activities: 0,
        total_won_deals: 0,
        total_active_clients: 0,
        orphan_activities: 0,
        orphan_deals: 0,
        total_activity_revenue: 0,
        total_deal_revenue: 0,
        total_mrr: 0,
        activity_deal_linkage_rate: 0,
        deal_activity_linkage_rate: 0,
        overall_data_quality_score: 0
      });
    }

    const data = result.rows[0];
    
    // Convert string numbers to actual numbers
    Object.keys(data).forEach(key => {
      if (typeof data[key] === 'string' && !isNaN(data[key])) {
        data[key] = parseFloat(data[key]);
      }
    });

    return apiResponse(response, data);
  } catch (error) {
    console.error('Error in overview analysis:', error);
    return apiResponse(response, null, error.message, 500);
  }
}

// Orphan analysis - activities without deals and deals without activities
async function handleOrphanAnalysis(response, { userId, startDate, endDate }) {
  try {
    console.log('Executing orphan analysis...');

    let orphanActivitiesQuery = `
      SELECT 
        a.id,
        a.client_name,
        a.amount,
        a.date,
        a.sales_rep,
        a.user_id,
        a.details,
        a.contact_identifier,
        a.contact_identifier_type,
        a.created_at,
        'orphan_activity' as issue_type,
        CASE 
          WHEN a.amount > 0 THEN 'revenue_risk'
          ELSE 'data_integrity'
        END as priority_level
      FROM activities a
      WHERE a.type = 'sale' 
        AND a.status = 'completed' 
        AND a.deal_id IS NULL
    `;

    let orphanDealsQuery = `
      SELECT 
        d.id,
        d.name,
        d.company,
        d.value,
        d.one_off_revenue,
        d.monthly_mrr,
        d.annual_value,
        d.owner_id,
        d.stage_changed_at,
        d.created_at,
        'orphan_deal' as issue_type,
        CASE 
          WHEN d.value > 0 THEN 'revenue_tracking'
          ELSE 'data_integrity'
        END as priority_level
      FROM deals d
      WHERE d.status = 'won'
        AND NOT EXISTS (
          SELECT 1 FROM activities a 
          WHERE a.deal_id = d.id 
            AND a.type = 'sale' 
            AND a.status = 'completed'
        )
    `;

    const params = [];
    let paramCount = 0;

    // Add filters to both queries
    if (userId) {
      paramCount++;
      orphanActivitiesQuery += ` AND a.user_id = $${paramCount}`;
      orphanDealsQuery += ` AND d.owner_id = $${paramCount}`;
      params.push(userId);
    }

    if (startDate) {
      paramCount++;
      orphanActivitiesQuery += ` AND a.date >= $${paramCount}`;
      orphanDealsQuery += ` AND d.stage_changed_at >= $${paramCount}`;
      params.push(startDate);
    }

    if (endDate) {
      paramCount++;
      orphanActivitiesQuery += ` AND a.date <= $${paramCount}`;
      orphanDealsQuery += ` AND d.stage_changed_at <= $${paramCount}`;
      params.push(endDate);
    }

    orphanActivitiesQuery += ` ORDER BY a.amount DESC NULLS LAST, a.date DESC`;
    orphanDealsQuery += ` ORDER BY d.value DESC NULLS LAST, d.stage_changed_at DESC`;

    // Execute both queries
    const [activitiesResult, dealsResult] = await Promise.all([
      executeQuery(orphanActivitiesQuery, params),
      executeQuery(orphanDealsQuery, params)
    ]);

    return apiResponse(response, {
      orphan_activities: activitiesResult.rows || [],
      orphan_deals: dealsResult.rows || [],
      summary: {
        total_orphan_activities: activitiesResult.rows.length,
        total_orphan_deals: dealsResult.rows.length,
        total_orphan_activity_revenue: activitiesResult.rows.reduce((sum, row) => sum + (parseFloat(row.amount) || 0), 0),
        total_orphan_deal_revenue: dealsResult.rows.reduce((sum, row) => sum + (parseFloat(row.value) || 0), 0)
      }
    });
  } catch (error) {
    console.error('Error in orphan analysis:', error);
    return apiResponse(response, null, error.message, 500);
  }
}

// Duplicate analysis - same day activities for same client
async function handleDuplicateAnalysis(response, { userId, startDate, endDate }) {
  try {
    console.log('Executing duplicate analysis...');

    let query = `
      SELECT 
        LOWER(TRIM(a.client_name)) as client_name_clean,
        a.date::DATE as activity_date,
        COUNT(*) as activity_count,
        COUNT(DISTINCT a.deal_id) as unique_deals,
        ARRAY_AGG(a.id ORDER BY a.created_at) as activity_ids,
        ARRAY_AGG(DISTINCT a.deal_id) FILTER (WHERE a.deal_id IS NOT NULL) as deal_ids,
        ARRAY_AGG(a.amount ORDER BY a.created_at) as amounts,
        ARRAY_AGG(a.sales_rep ORDER BY a.created_at) as sales_reps,
        SUM(a.amount) as total_amount,
        'same_day_multiple_activities' as issue_type
      FROM activities a
      WHERE a.type = 'sale' 
        AND a.status = 'completed'
        AND a.deal_id IS NOT NULL
    `;

    const params = [];
    let paramCount = 0;

    if (userId) {
      paramCount++;
      query += ` AND a.user_id = $${paramCount}`;
      params.push(userId);
    }

    if (startDate) {
      paramCount++;
      query += ` AND a.date >= $${paramCount}`;
      params.push(startDate);
    }

    if (endDate) {
      paramCount++;
      query += ` AND a.date <= $${paramCount}`;
      params.push(endDate);
    }

    query += `
      GROUP BY LOWER(TRIM(a.client_name)), a.date::DATE
      HAVING COUNT(*) > 1
      ORDER BY activity_count DESC, total_amount DESC
    `;

    const result = await executeQuery(query, params);

    return apiResponse(response, {
      duplicates: result.rows || [],
      summary: {
        total_duplicate_groups: result.rows.length,
        total_duplicate_activities: result.rows.reduce((sum, row) => sum + parseInt(row.activity_count), 0),
        total_revenue_affected: result.rows.reduce((sum, row) => sum + (parseFloat(row.total_amount) || 0), 0)
      }
    });
  } catch (error) {
    console.error('Error in duplicate analysis:', error);
    return apiResponse(response, null, error.message, 500);
  }
}

// Matching analysis - potential matches between orphan activities and deals
async function handleMatchingAnalysis(response, { userId, startDate, endDate, confidenceThreshold = 50 }) {
  try {
    console.log(`Executing matching analysis with confidence threshold: ${confidenceThreshold}...`);

    let query = `
      SELECT 
        a.id as activity_id,
        d.id as deal_id,
        a.client_name,
        d.company,
        a.amount,
        d.value,
        a.date,
        d.stage_changed_at,
        ABS(EXTRACT(EPOCH FROM (a.date::DATE - d.stage_changed_at::DATE))/86400) as days_difference,
        
        -- Confidence scoring components
        CASE 
          WHEN similarity(LOWER(TRIM(a.client_name)), LOWER(TRIM(d.company))) >= 0.9 THEN 40
          WHEN similarity(LOWER(TRIM(a.client_name)), LOWER(TRIM(d.company))) >= 0.8 THEN 30
          WHEN similarity(LOWER(TRIM(a.client_name)), LOWER(TRIM(d.company))) >= 0.7 THEN 20
          ELSE 0
        END as name_match_score,
        
        CASE 
          WHEN ABS(EXTRACT(EPOCH FROM (a.date::DATE - d.stage_changed_at::DATE))/86400) = 0 THEN 30
          WHEN ABS(EXTRACT(EPOCH FROM (a.date::DATE - d.stage_changed_at::DATE))/86400) <= 1 THEN 25
          WHEN ABS(EXTRACT(EPOCH FROM (a.date::DATE - d.stage_changed_at::DATE))/86400) <= 3 THEN 20
          WHEN ABS(EXTRACT(EPOCH FROM (a.date::DATE - d.stage_changed_at::DATE))/86400) <= 7 THEN 10
          ELSE 0
        END as date_proximity_score,
        
        CASE 
          WHEN a.amount IS NOT NULL AND d.value IS NOT NULL AND a.amount > 0 AND d.value > 0 THEN
            CASE 
              WHEN ABS(a.amount - d.value) / GREATEST(a.amount, d.value) <= 0.05 THEN 30
              WHEN ABS(a.amount - d.value) / GREATEST(a.amount, d.value) <= 0.10 THEN 20
              WHEN ABS(a.amount - d.value) / GREATEST(a.amount, d.value) <= 0.20 THEN 10
              ELSE 0
            END
          ELSE 0
        END as amount_similarity_score,
        
        -- Total confidence score calculation
        (
          CASE 
            WHEN similarity(LOWER(TRIM(a.client_name)), LOWER(TRIM(d.company))) >= 0.9 THEN 40
            WHEN similarity(LOWER(TRIM(a.client_name)), LOWER(TRIM(d.company))) >= 0.8 THEN 30
            WHEN similarity(LOWER(TRIM(a.client_name)), LOWER(TRIM(d.company))) >= 0.7 THEN 20
            ELSE 0
          END +
          CASE 
            WHEN ABS(EXTRACT(EPOCH FROM (a.date::DATE - d.stage_changed_at::DATE))/86400) = 0 THEN 30
            WHEN ABS(EXTRACT(EPOCH FROM (a.date::DATE - d.stage_changed_at::DATE))/86400) <= 1 THEN 25
            WHEN ABS(EXTRACT(EPOCH FROM (a.date::DATE - d.stage_changed_at::DATE))/86400) <= 3 THEN 20
            WHEN ABS(EXTRACT(EPOCH FROM (a.date::DATE - d.stage_changed_at::DATE))/86400) <= 7 THEN 10
            ELSE 0
          END +
          CASE 
            WHEN a.amount IS NOT NULL AND d.value IS NOT NULL AND a.amount > 0 AND d.value > 0 THEN
              CASE 
                WHEN ABS(a.amount - d.value) / GREATEST(a.amount, d.value) <= 0.05 THEN 30
                WHEN ABS(a.amount - d.value) / GREATEST(a.amount, d.value) <= 0.10 THEN 20
                WHEN ABS(a.amount - d.value) / GREATEST(a.amount, d.value) <= 0.20 THEN 10
                ELSE 0
              END
            ELSE 0
          END
        ) as total_confidence_score,
        
        -- Match classification
        CASE 
          WHEN (
            CASE 
              WHEN similarity(LOWER(TRIM(a.client_name)), LOWER(TRIM(d.company))) >= 0.9 THEN 40
              WHEN similarity(LOWER(TRIM(a.client_name)), LOWER(TRIM(d.company))) >= 0.8 THEN 30
              WHEN similarity(LOWER(TRIM(a.client_name)), LOWER(TRIM(d.company))) >= 0.7 THEN 20
              ELSE 0
            END +
            CASE 
              WHEN ABS(EXTRACT(EPOCH FROM (a.date::DATE - d.stage_changed_at::DATE))/86400) = 0 THEN 30
              WHEN ABS(EXTRACT(EPOCH FROM (a.date::DATE - d.stage_changed_at::DATE))/86400) <= 1 THEN 25
              WHEN ABS(EXTRACT(EPOCH FROM (a.date::DATE - d.stage_changed_at::DATE))/86400) <= 3 THEN 20
              WHEN ABS(EXTRACT(EPOCH FROM (a.date::DATE - d.stage_changed_at::DATE))/86400) <= 7 THEN 10
              ELSE 0
            END +
            CASE 
              WHEN a.amount IS NOT NULL AND d.value IS NOT NULL AND a.amount > 0 AND d.value > 0 THEN
                CASE 
                  WHEN ABS(a.amount - d.value) / GREATEST(a.amount, d.value) <= 0.05 THEN 30
                  WHEN ABS(a.amount - d.value) / GREATEST(a.amount, d.value) <= 0.10 THEN 20
                  WHEN ABS(a.amount - d.value) / GREATEST(a.amount, d.value) <= 0.20 THEN 10
                  ELSE 0
                END
              ELSE 0
            END
          ) >= 80 THEN 'high_confidence'
          WHEN (
            CASE 
              WHEN similarity(LOWER(TRIM(a.client_name)), LOWER(TRIM(d.company))) >= 0.9 THEN 40
              WHEN similarity(LOWER(TRIM(a.client_name)), LOWER(TRIM(d.company))) >= 0.8 THEN 30
              WHEN similarity(LOWER(TRIM(a.client_name)), LOWER(TRIM(d.company))) >= 0.7 THEN 20
              ELSE 0
            END +
            CASE 
              WHEN ABS(EXTRACT(EPOCH FROM (a.date::DATE - d.stage_changed_at::DATE))/86400) = 0 THEN 30
              WHEN ABS(EXTRACT(EPOCH FROM (a.date::DATE - d.stage_changed_at::DATE))/86400) <= 1 THEN 25
              WHEN ABS(EXTRACT(EPOCH FROM (a.date::DATE - d.stage_changed_at::DATE))/86400) <= 3 THEN 20
              WHEN ABS(EXTRACT(EPOCH FROM (a.date::DATE - d.stage_changed_at::DATE))/86400) <= 7 THEN 10
              ELSE 0
            END +
            CASE 
              WHEN a.amount IS NOT NULL AND d.value IS NOT NULL AND a.amount > 0 AND d.value > 0 THEN
                CASE 
                  WHEN ABS(a.amount - d.value) / GREATEST(a.amount, d.value) <= 0.05 THEN 30
                  WHEN ABS(a.amount - d.value) / GREATEST(a.amount, d.value) <= 0.10 THEN 20
                  WHEN ABS(a.amount - d.value) / GREATEST(a.amount, d.value) <= 0.20 THEN 10
                  ELSE 0
                END
              ELSE 0
            END
          ) >= 60 THEN 'medium_confidence'
          ELSE 'low_confidence'
        END as confidence_level

      FROM activities a
      CROSS JOIN deals d
      WHERE a.type = 'sale' 
        AND a.status = 'completed'
        AND a.deal_id IS NULL
        AND d.status = 'won'
        AND NOT EXISTS (SELECT 1 FROM activities a2 WHERE a2.deal_id = d.id AND a2.type = 'sale')
        AND ABS(EXTRACT(EPOCH FROM (a.date::DATE - d.stage_changed_at::DATE))/86400) <= 30
        AND similarity(LOWER(TRIM(a.client_name)), LOWER(TRIM(d.company))) >= 0.5
    `;

    const params = [];
    let paramCount = 0;

    if (userId) {
      paramCount++;
      query += ` AND a.user_id = $${paramCount} AND d.owner_id = $${paramCount}`;
      params.push(userId);
    }

    if (startDate) {
      paramCount++;
      query += ` AND a.date >= $${paramCount} AND d.stage_changed_at >= $${paramCount}`;
      params.push(startDate);
    }

    if (endDate) {
      paramCount++;
      query += ` AND a.date <= $${paramCount} AND d.stage_changed_at <= $${paramCount}`;
      params.push(endDate);
    }

    query += `
      HAVING (
        CASE 
          WHEN similarity(LOWER(TRIM(a.client_name)), LOWER(TRIM(d.company))) >= 0.9 THEN 40
          WHEN similarity(LOWER(TRIM(a.client_name)), LOWER(TRIM(d.company))) >= 0.8 THEN 30
          WHEN similarity(LOWER(TRIM(a.client_name)), LOWER(TRIM(d.company))) >= 0.7 THEN 20
          ELSE 0
        END +
        CASE 
          WHEN ABS(EXTRACT(EPOCH FROM (a.date::DATE - d.stage_changed_at::DATE))/86400) = 0 THEN 30
          WHEN ABS(EXTRACT(EPOCH FROM (a.date::DATE - d.stage_changed_at::DATE))/86400) <= 1 THEN 25
          WHEN ABS(EXTRACT(EPOCH FROM (a.date::DATE - d.stage_changed_at::DATE))/86400) <= 3 THEN 20
          WHEN ABS(EXTRACT(EPOCH FROM (a.date::DATE - d.stage_changed_at::DATE))/86400) <= 7 THEN 10
          ELSE 0
        END +
        CASE 
          WHEN a.amount IS NOT NULL AND d.value IS NOT NULL AND a.amount > 0 AND d.value > 0 THEN
            CASE 
              WHEN ABS(a.amount - d.value) / GREATEST(a.amount, d.value) <= 0.05 THEN 30
              WHEN ABS(a.amount - d.value) / GREATEST(a.amount, d.value) <= 0.10 THEN 20
              WHEN ABS(a.amount - d.value) / GREATEST(a.amount, d.value) <= 0.20 THEN 10
              ELSE 0
            END
          ELSE 0
        END
      ) >= $${paramCount + 1}
      ORDER BY total_confidence_score DESC, days_difference ASC
      LIMIT 100
    `;
    
    params.push(confidenceThreshold);

    const result = await executeQuery(query, params);

    // Group by confidence level
    const matches = result.rows || [];
    const groupedMatches = {
      high_confidence: matches.filter(m => m.confidence_level === 'high_confidence'),
      medium_confidence: matches.filter(m => m.confidence_level === 'medium_confidence'),
      low_confidence: matches.filter(m => m.confidence_level === 'low_confidence')
    };

    return apiResponse(response, {
      matches: groupedMatches,
      all_matches: matches,
      summary: {
        total_matches: matches.length,
        high_confidence_matches: groupedMatches.high_confidence.length,
        medium_confidence_matches: groupedMatches.medium_confidence.length,
        low_confidence_matches: groupedMatches.low_confidence.length,
        confidence_threshold: confidenceThreshold
      }
    });
  } catch (error) {
    console.error('Error in matching analysis:', error);
    return apiResponse(response, null, error.message, 500);
  }
}

// Statistics analysis - aggregate metrics
async function handleStatisticsAnalysis(response, { userId, startDate, endDate }) {
  try {
    console.log('Executing statistics analysis...');

    let query = `
      WITH user_stats AS (
        SELECT 
          p.id,
          p.first_name,
          p.last_name,
          p.email,
          COUNT(DISTINCT CASE WHEN a.type = 'sale' AND a.status = 'completed' THEN a.id END) as user_sales_activities,
          COUNT(DISTINCT CASE WHEN d.status = 'won' THEN d.id END) as user_won_deals,
          COUNT(DISTINCT CASE WHEN c.status = 'active' THEN c.id END) as user_active_clients,
          SUM(CASE WHEN a.type = 'sale' AND a.status = 'completed' AND a.deal_id IS NULL THEN 1 ELSE 0 END) as user_orphan_activities,
          COUNT(DISTINCT orphan_deals.id) as user_orphan_deals,
          COALESCE(SUM(CASE WHEN a.type = 'sale' AND a.status = 'completed' THEN a.amount END), 0) as user_activity_revenue,
          COALESCE(SUM(CASE WHEN d.status = 'won' THEN d.value END), 0) as user_deal_revenue
        FROM profiles p
        LEFT JOIN activities a ON a.user_id = p.id
        LEFT JOIN deals d ON d.owner_id = p.id
        LEFT JOIN clients c ON c.owner_id = p.id
        LEFT JOIN (
          SELECT d.id, d.owner_id
          FROM deals d
          WHERE d.status = 'won'
            AND NOT EXISTS (
              SELECT 1 FROM activities a 
              WHERE a.deal_id = d.id 
                AND a.type = 'sale' 
                AND a.status = 'completed'
            )
        ) orphan_deals ON orphan_deals.owner_id = p.id
        WHERE 1=1
    `;

    const params = [];
    let paramCount = 0;

    if (userId) {
      paramCount++;
      query += ` AND p.id = $${paramCount}`;
      params.push(userId);
    }

    if (startDate) {
      paramCount++;
      query += ` AND (a.date >= $${paramCount} OR d.stage_changed_at >= $${paramCount})`;
      params.push(startDate);
    }

    if (endDate) {
      paramCount++;
      query += ` AND (a.date <= $${paramCount} OR d.stage_changed_at <= $${paramCount})`;
      params.push(endDate);
    }

    query += `
        GROUP BY p.id, p.first_name, p.last_name, p.email
        HAVING (
          COUNT(DISTINCT CASE WHEN a.type = 'sale' AND a.status = 'completed' THEN a.id END) > 0
          OR COUNT(DISTINCT CASE WHEN d.status = 'won' THEN d.id END) > 0
          OR COUNT(DISTINCT CASE WHEN c.status = 'active' THEN c.id END) > 0
        )
      )
      SELECT 
        id,
        first_name,
        last_name,
        email,
        user_sales_activities,
        user_won_deals,
        user_active_clients,
        user_orphan_activities,
        user_orphan_deals,
        user_activity_revenue,
        user_deal_revenue,
        CASE 
          WHEN user_sales_activities > 0 
          THEN ROUND((user_sales_activities - user_orphan_activities) * 100.0 / user_sales_activities, 2)
          ELSE 0
        END as user_linkage_rate
      FROM user_stats
      ORDER BY user_activity_revenue DESC
    `;

    const result = await executeQuery(query, params);

    return apiResponse(response, {
      user_statistics: result.rows || [],
      summary: {
        total_users_analyzed: result.rows.length,
        total_combined_revenue: result.rows.reduce((sum, row) => sum + (parseFloat(row.user_activity_revenue) || 0), 0),
        average_linkage_rate: result.rows.length > 0 
          ? result.rows.reduce((sum, row) => sum + (parseFloat(row.user_linkage_rate) || 0), 0) / result.rows.length 
          : 0
      }
    });
  } catch (error) {
    console.error('Error in statistics analysis:', error);
    return apiResponse(response, null, error.message, 500);
  }
}