-- =============================================================
-- SALES RECONCILIATION DATA ANALYSIS SQL SCRIPT
-- Phase 1: Data Analysis & Reporting
-- =============================================================
-- This script identifies data inconsistencies between activities, deals, and clients
-- to support comprehensive reconciliation workflows

-- =============================================================
-- 1. ORPHAN ACTIVITIES ANALYSIS
-- Activities (sales) without corresponding deals
-- =============================================================

-- 1.1 Count orphan activities
SELECT 
    'Orphan Activities Count' as metric,
    COUNT(*) as total_count,
    ROUND((COUNT(*) * 100.0 / (SELECT COUNT(*) FROM activities WHERE type = 'sale' AND status = 'completed')), 2) as percentage
FROM activities 
WHERE type = 'sale' 
    AND status = 'completed' 
    AND deal_id IS NULL;

-- 1.2 Detailed orphan activities (sales without deals)
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
    'Orphan Activity - No Deal' as issue_type,
    CASE 
        WHEN a.amount > 0 THEN 'Revenue Loss Risk'
        ELSE 'Data Integrity Issue'
    END as priority
FROM activities a
WHERE a.type = 'sale' 
    AND a.status = 'completed' 
    AND a.deal_id IS NULL
ORDER BY a.amount DESC NULLS LAST, a.date DESC;

-- =============================================================
-- 2. DUPLICATE RECORDS ANALYSIS
-- Activities and deals on the same day for the same client
-- =============================================================

-- 2.1 Count potential duplicates
SELECT 
    'Potential Duplicates Count' as metric,
    COUNT(*) as total_pairs,
    COUNT(DISTINCT client_name_clean) as unique_clients_affected
FROM (
    SELECT 
        LOWER(TRIM(a.client_name)) as client_name_clean,
        a.date::DATE as activity_date,
        COUNT(*) as activity_count
    FROM activities a
    WHERE a.type = 'sale' 
        AND a.status = 'completed'
        AND a.deal_id IS NOT NULL
    GROUP BY LOWER(TRIM(a.client_name)), a.date::DATE
    HAVING COUNT(*) > 1
) duplicates;

-- 2.2 Detailed duplicate analysis
SELECT 
    LOWER(TRIM(a.client_name)) as client_name_clean,
    a.date::DATE as activity_date,
    COUNT(*) as activity_count,
    COUNT(DISTINCT a.deal_id) as unique_deals,
    ARRAY_AGG(DISTINCT a.id ORDER BY a.created_at) as activity_ids,
    ARRAY_AGG(DISTINCT a.deal_id) as deal_ids,
    ARRAY_AGG(a.amount ORDER BY a.created_at) as amounts,
    SUM(a.amount) as total_amount,
    'Same Day Multiple Activities' as issue_type
FROM activities a
WHERE a.type = 'sale' 
    AND a.status = 'completed'
    AND a.deal_id IS NOT NULL
GROUP BY LOWER(TRIM(a.client_name)), a.date::DATE
HAVING COUNT(*) > 1
ORDER BY activity_count DESC, total_amount DESC;

-- =============================================================
-- 3. ORPHAN DEALS ANALYSIS
-- Deals without corresponding activities
-- =============================================================

-- 3.1 Count orphan deals
SELECT 
    'Orphan Deals Count' as metric,
    COUNT(*) as total_count,
    ROUND((COUNT(*) * 100.0 / (SELECT COUNT(*) FROM deals WHERE status = 'won')), 2) as percentage
FROM deals d
WHERE d.status = 'won'
    AND NOT EXISTS (
        SELECT 1 FROM activities a 
        WHERE a.deal_id = d.id 
            AND a.type = 'sale' 
            AND a.status = 'completed'
    );

-- 3.2 Detailed orphan deals
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
    'Orphan Deal - No Activity' as issue_type,
    CASE 
        WHEN d.value > 0 THEN 'Revenue Tracking Issue'
        ELSE 'Data Integrity Issue'
    END as priority
FROM deals d
WHERE d.status = 'won'
    AND NOT EXISTS (
        SELECT 1 FROM activities a 
        WHERE a.deal_id = d.id 
            AND a.type = 'sale' 
            AND a.status = 'completed'
    )
ORDER BY d.value DESC NULLS LAST, d.stage_changed_at DESC;

-- =============================================================
-- 4. FUZZY MATCHING QUERIES
-- Identify potential matches based on name variations
-- =============================================================

-- 4.1 Viewpoint variations matching
SELECT 
    a.id as activity_id,
    a.client_name as activity_client,
    d.id as deal_id,
    d.company as deal_company,
    a.amount as activity_amount,
    d.value as deal_value,
    ABS(EXTRACT(EPOCH FROM (a.date::DATE - d.stage_changed_at::DATE))/86400) as days_difference,
    'Viewpoint Variation Match' as match_type,
    CASE 
        WHEN ABS(EXTRACT(EPOCH FROM (a.date::DATE - d.stage_changed_at::DATE))/86400) <= 3 THEN 'High'
        WHEN ABS(EXTRACT(EPOCH FROM (a.date::DATE - d.stage_changed_at::DATE))/86400) <= 7 THEN 'Medium'
        ELSE 'Low'
    END as confidence_score
FROM activities a
CROSS JOIN deals d
WHERE a.type = 'sale' 
    AND a.status = 'completed'
    AND a.deal_id IS NULL
    AND d.status = 'won'
    AND NOT EXISTS (SELECT 1 FROM activities a2 WHERE a2.deal_id = d.id AND a2.type = 'sale')
    AND (
        -- Viewpoint variations
        (LOWER(TRIM(a.client_name)) SIMILAR TO '%viewpoint%' AND LOWER(TRIM(d.company)) SIMILAR TO '%viewpoint%')
        OR
        -- Generic fuzzy matching for company names
        (
            LOWER(TRIM(REGEXP_REPLACE(a.client_name, '[^a-zA-Z0-9]', '', 'g'))) = 
            LOWER(TRIM(REGEXP_REPLACE(d.company, '[^a-zA-Z0-9]', '', 'g')))
        )
        OR
        -- Similarity with common variations
        (
            similarity(LOWER(TRIM(a.client_name)), LOWER(TRIM(d.company))) > 0.8
        )
    )
    AND ABS(EXTRACT(EPOCH FROM (a.date::DATE - d.stage_changed_at::DATE))/86400) <= 30
ORDER BY confidence_score DESC, days_difference ASC;

-- 4.2 Date proximity matching (within 3 days)
SELECT 
    a.id as activity_id,
    a.client_name as activity_client,
    a.amount as activity_amount,
    a.date as activity_date,
    d.id as deal_id,
    d.company as deal_company,
    d.value as deal_value,
    d.stage_changed_at as deal_date,
    ABS(EXTRACT(EPOCH FROM (a.date::DATE - d.stage_changed_at::DATE))/86400) as days_difference,
    'Date Proximity Match' as match_type,
    CASE 
        WHEN ABS(a.amount - d.value) / GREATEST(a.amount, d.value) <= 0.1 THEN 'High'
        WHEN ABS(a.amount - d.value) / GREATEST(a.amount, d.value) <= 0.2 THEN 'Medium'
        ELSE 'Low'
    END as amount_confidence
FROM activities a
CROSS JOIN deals d
WHERE a.type = 'sale' 
    AND a.status = 'completed'
    AND a.deal_id IS NULL
    AND d.status = 'won'
    AND NOT EXISTS (SELECT 1 FROM activities a2 WHERE a2.deal_id = d.id AND a2.type = 'sale')
    AND ABS(EXTRACT(EPOCH FROM (a.date::DATE - d.stage_changed_at::DATE))/86400) <= 3
    AND a.amount IS NOT NULL
    AND d.value IS NOT NULL
    AND a.amount > 0
    AND d.value > 0
ORDER BY days_difference ASC, amount_confidence DESC;

-- =============================================================
-- 5. RECONCILIATION STATISTICS SUMMARY
-- High-level metrics for dashboard reporting
-- =============================================================

WITH reconciliation_stats AS (
    SELECT 
        -- Total counts
        (SELECT COUNT(*) FROM activities WHERE type = 'sale' AND status = 'completed') as total_sales_activities,
        (SELECT COUNT(*) FROM deals WHERE status = 'won') as total_won_deals,
        (SELECT COUNT(*) FROM clients WHERE status = 'active') as total_active_clients,
        
        -- Orphan counts
        (SELECT COUNT(*) FROM activities WHERE type = 'sale' AND status = 'completed' AND deal_id IS NULL) as orphan_activities,
        (SELECT COUNT(*) FROM deals d WHERE d.status = 'won' AND NOT EXISTS (SELECT 1 FROM activities a WHERE a.deal_id = d.id AND a.type = 'sale' AND a.status = 'completed')) as orphan_deals,
        
        -- Duplicate counts
        (SELECT COUNT(*) FROM (
            SELECT client_name, date::DATE 
            FROM activities 
            WHERE type = 'sale' AND status = 'completed' AND deal_id IS NOT NULL
            GROUP BY client_name, date::DATE 
            HAVING COUNT(*) > 1
        ) dups) as duplicate_activity_days,
        
        -- Revenue totals
        (SELECT COALESCE(SUM(amount), 0) FROM activities WHERE type = 'sale' AND status = 'completed') as total_activity_revenue,
        (SELECT COALESCE(SUM(value), 0) FROM deals WHERE status = 'won') as total_deal_revenue,
        (SELECT COALESCE(SUM(subscription_amount), 0) FROM clients WHERE status = 'active') as total_mrr
)
SELECT 
    'RECONCILIATION OVERVIEW' as section,
    json_build_object(
        'total_sales_activities', total_sales_activities,
        'total_won_deals', total_won_deals,
        'total_active_clients', total_active_clients,
        'orphan_activities', orphan_activities,
        'orphan_deals', orphan_deals,
        'duplicate_activity_days', duplicate_activity_days,
        'activity_deal_linkage_rate', ROUND((total_sales_activities - orphan_activities) * 100.0 / GREATEST(total_sales_activities, 1), 2),
        'deal_activity_linkage_rate', ROUND((total_won_deals - orphan_deals) * 100.0 / GREATEST(total_won_deals, 1), 2),
        'data_quality_score', ROUND(
            (
                (total_sales_activities - orphan_activities) + 
                (total_won_deals - orphan_deals) - 
                duplicate_activity_days
            ) * 100.0 / GREATEST(total_sales_activities + total_won_deals, 1), 2
        ),
        'revenue_totals', json_build_object(
            'total_activity_revenue', total_activity_revenue,
            'total_deal_revenue', total_deal_revenue,
            'total_mrr', total_mrr
        )
    ) as metrics
FROM reconciliation_stats;

-- =============================================================
-- 6. USER-SPECIFIC ANALYSIS (for filtering by owner)
-- Template query with user filter parameter
-- =============================================================

-- 6.1 User-specific reconciliation stats
-- Replace :user_id with actual user ID parameter
SELECT 
    'USER SPECIFIC ANALYSIS' as section,
    p.first_name,
    p.last_name,
    p.email,
    COUNT(DISTINCT a.id) as user_sales_activities,
    COUNT(DISTINCT d.id) as user_won_deals,
    COUNT(DISTINCT c.id) as user_active_clients,
    SUM(CASE WHEN a.deal_id IS NULL THEN 1 ELSE 0 END) as user_orphan_activities,
    SUM(CASE WHEN orphan_deals.id IS NOT NULL THEN 1 ELSE 0 END) as user_orphan_deals,
    COALESCE(SUM(a.amount), 0) as user_activity_revenue,
    COALESCE(SUM(d.value), 0) as user_deal_revenue
FROM profiles p
LEFT JOIN activities a ON a.user_id = p.id AND a.type = 'sale' AND a.status = 'completed'
LEFT JOIN deals d ON d.owner_id = p.id AND d.status = 'won'
LEFT JOIN clients c ON c.owner_id = p.id AND c.status = 'active'
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
WHERE p.id = :user_id -- Parameter replacement needed
GROUP BY p.id, p.first_name, p.last_name, p.email;

-- =============================================================
-- 7. DATE RANGE ANALYSIS (for filtering by date)
-- Template query with date range parameters
-- =============================================================

-- 7.1 Date range specific reconciliation
-- Replace :start_date and :end_date with actual date parameters
SELECT 
    'DATE RANGE ANALYSIS' as section,
    COUNT(DISTINCT a.id) as activities_in_range,
    COUNT(DISTINCT d.id) as deals_in_range,
    SUM(CASE WHEN a.deal_id IS NULL THEN 1 ELSE 0 END) as orphan_activities_in_range,
    COALESCE(SUM(a.amount), 0) as activity_revenue_in_range,
    COALESCE(SUM(d.value), 0) as deal_revenue_in_range
FROM activities a
FULL OUTER JOIN deals d ON (
    d.status = 'won' 
    AND d.stage_changed_at::DATE BETWEEN :start_date AND :end_date
)
WHERE (
    a.type = 'sale' 
    AND a.status = 'completed' 
    AND a.date::DATE BETWEEN :start_date AND :end_date
) OR (
    d.id IS NOT NULL
);

-- =============================================================
-- 8. CONFIDENCE SCORING FOR AUTOMATED MATCHING
-- Scoring algorithm for potential matches
-- =============================================================

SELECT 
    a.id as activity_id,
    d.id as deal_id,
    a.client_name,
    d.company,
    a.amount,
    d.value,
    a.date,
    d.stage_changed_at,
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
    
    -- Total confidence score (max 100)
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
    ) as total_confidence_score

FROM activities a
CROSS JOIN deals d
WHERE a.type = 'sale' 
    AND a.status = 'completed'
    AND a.deal_id IS NULL
    AND d.status = 'won'
    AND NOT EXISTS (SELECT 1 FROM activities a2 WHERE a2.deal_id = d.id AND a2.type = 'sale')
    AND ABS(EXTRACT(EPOCH FROM (a.date::DATE - d.stage_changed_at::DATE))/86400) <= 30
    AND similarity(LOWER(TRIM(a.client_name)), LOWER(TRIM(d.company))) >= 0.5
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
) >= 50  -- Minimum confidence threshold
ORDER BY total_confidence_score DESC, 
         ABS(EXTRACT(EPOCH FROM (a.date::DATE - d.stage_changed_at::DATE))/86400) ASC;

-- =============================================================
-- END OF ANALYSIS SCRIPT
-- =============================================================