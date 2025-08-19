-- Sales Reconciliation Execution Engine
-- Phase 2: Automatic Reconciliation with Fuzzy Matching and Audit Trail
-- Created: 2025-08-17

-- Enable audit logging for all reconciliation actions
CREATE OR REPLACE FUNCTION log_reconciliation_action(
    p_action_type TEXT,
    p_source_table TEXT,
    p_source_id INTEGER,
    p_target_table TEXT DEFAULT NULL,
    p_target_id INTEGER DEFAULT NULL,
    p_confidence_score DECIMAL DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL,
    p_user_id TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    INSERT INTO reconciliation_audit_log (
        action_type,
        source_table,
        source_id,
        target_table,
        target_id,
        confidence_score,
        metadata,
        user_id,
        executed_at
    ) VALUES (
        p_action_type,
        p_source_table,
        p_source_id,
        p_target_table,
        p_target_id,
        p_confidence_score,
        p_metadata,
        p_user_id,
        NOW()
    );
END;
$$ LANGUAGE plpgsql;

-- Create comprehensive reconciliation execution function
CREATE OR REPLACE FUNCTION execute_sales_reconciliation(
    p_mode TEXT DEFAULT 'safe', -- 'safe', 'aggressive', 'dry_run'
    p_user_id TEXT DEFAULT NULL,
    p_batch_size INTEGER DEFAULT 100
) RETURNS JSONB AS $$
DECLARE
    v_stats JSONB := '{}';
    v_processed INTEGER := 0;
    v_linked INTEGER := 0;
    v_created_deals INTEGER := 0;
    v_created_activities INTEGER := 0;
    v_duplicates_marked INTEGER := 0;
    v_errors INTEGER := 0;
    v_batch_start INTEGER := 0;
    v_total_orphan_activities INTEGER;
    v_total_orphan_deals INTEGER;
    rec RECORD;
BEGIN
    -- Security: Input validation
    IF p_batch_size < 1 OR p_batch_size > 1000 THEN
        RAISE EXCEPTION 'Batch size must be between 1 and 1000';
    END IF;
    
    IF p_mode NOT IN ('safe', 'aggressive', 'dry_run') THEN
        RAISE EXCEPTION 'Invalid mode. Must be safe, aggressive, or dry_run';
    END IF;

    -- Security: Use advisory lock to prevent concurrent reconciliation
    IF NOT pg_try_advisory_lock(54321, COALESCE(hashtext(p_user_id), 0)) THEN
        RAISE EXCEPTION 'Another reconciliation operation is already running for this user. Please try again later.';
    END IF;

    BEGIN
        -- Initialize stats tracking
        v_stats := jsonb_build_object(
            'mode', p_mode,
            'user_id', p_user_id,
            'started_at', NOW(),
            'processed', 0,
            'linked', 0,
            'created_deals', 0,
            'created_activities', 0,
            'duplicates_marked', 0,
            'errors', 0
        );

    -- Count total records to process
    IF p_user_id IS NOT NULL THEN
        SELECT COUNT(*) INTO v_total_orphan_activities
        FROM sales_activities sa
        LEFT JOIN deals d ON sa.deal_id = d.id
        WHERE d.id IS NULL AND sa.owner_id = p_user_id;
        
        SELECT COUNT(*) INTO v_total_orphan_deals
        FROM deals d
        LEFT JOIN sales_activities sa ON d.id = sa.deal_id
        WHERE sa.id IS NULL AND d.owner_id = p_user_id;
    ELSE
        SELECT COUNT(*) INTO v_total_orphan_activities
        FROM sales_activities sa
        LEFT JOIN deals d ON sa.deal_id = d.id
        WHERE d.id IS NULL;
        
        SELECT COUNT(*) INTO v_total_orphan_deals
        FROM deals d
        LEFT JOIN sales_activities sa ON d.id = sa.deal_id
        WHERE sa.id IS NULL;
    END IF;

    RAISE NOTICE 'Starting reconciliation: % orphan activities, % orphan deals', 
                 v_total_orphan_activities, v_total_orphan_deals;

    -- PHASE 1: High Confidence Automatic Linking (Same day + client + similar amount)
    RAISE NOTICE 'Phase 1: High confidence automatic linking...';
    
    FOR rec IN
        WITH orphan_activities AS (
            SELECT sa.*, 
                   ROW_NUMBER() OVER (ORDER BY sa.id) as rn
            FROM sales_activities sa
            LEFT JOIN deals d ON sa.deal_id = d.id
            WHERE d.id IS NULL
              AND (p_user_id IS NULL OR sa.owner_id = p_user_id)
        ),
        potential_matches AS (
            SELECT 
                oa.id as activity_id,
                oa.company_name as activity_company,
                oa.amount as activity_amount,
                oa.activity_date,
                oa.owner_id,
                d.id as deal_id,
                d.company_name as deal_company,
                d.amount as deal_amount,
                d.close_date,
                -- Calculate confidence scores
                CASE 
                    WHEN LOWER(TRIM(oa.company_name)) = LOWER(TRIM(d.company_name)) THEN 100
                    WHEN similarity(LOWER(oa.company_name), LOWER(d.company_name)) > 0.8 THEN 90
                    WHEN (LOWER(oa.company_name) LIKE '%viewpoint%' AND LOWER(d.company_name) LIKE '%viewpoint%') THEN 85
                    ELSE similarity(LOWER(oa.company_name), LOWER(d.company_name)) * 100
                END as name_confidence,
                CASE 
                    WHEN oa.activity_date = d.close_date THEN 100
                    WHEN ABS(EXTRACT(EPOCH FROM (oa.activity_date - d.close_date))/86400) <= 1 THEN 90
                    WHEN ABS(EXTRACT(EPOCH FROM (oa.activity_date - d.close_date))/86400) <= 3 THEN 70
                    ELSE 0
                END as date_confidence,
                CASE 
                    WHEN oa.amount IS NULL OR d.amount IS NULL THEN 50
                    WHEN oa.amount = d.amount THEN 100
                    WHEN GREATEST(oa.amount, d.amount) = 0 THEN 0 -- Prevent division by zero
                    WHEN GREATEST(ABS(oa.amount), ABS(d.amount)) = 0 THEN 50 -- Both amounts are zero
                    WHEN ABS(oa.amount - d.amount) / GREATEST(ABS(oa.amount), ABS(d.amount), 0.01) <= 0.1 THEN 90
                    WHEN ABS(oa.amount - d.amount) / GREATEST(ABS(oa.amount), ABS(d.amount), 0.01) <= 0.3 THEN 70
                    ELSE 30
                END as amount_confidence
            FROM orphan_activities oa
            INNER JOIN deals d ON d.owner_id = oa.owner_id
            LEFT JOIN sales_activities sa_existing ON d.id = sa_existing.deal_id
            WHERE sa_existing.id IS NULL -- Only deals without activities
              AND oa.rn BETWEEN v_batch_start + 1 AND v_batch_start + p_batch_size
        ),
        scored_matches AS (
            SELECT *,
                   -- Ensure confidence scores are within valid range (0-100)
                   LEAST(GREATEST((
                       COALESCE(name_confidence, 0) * 0.5 + 
                       COALESCE(date_confidence, 0) * 0.3 + 
                       COALESCE(amount_confidence, 0) * 0.2
                   ), 0), 100) as overall_confidence,
                   ROW_NUMBER() OVER (PARTITION BY activity_id ORDER BY 
                       LEAST(GREATEST((
                           COALESCE(name_confidence, 0) * 0.5 + 
                           COALESCE(date_confidence, 0) * 0.3 + 
                           COALESCE(amount_confidence, 0) * 0.2
                       ), 0), 100) DESC) as match_rank
            FROM potential_matches
        )
        SELECT * FROM scored_matches 
        WHERE overall_confidence >= 80 
          AND match_rank = 1
        ORDER BY overall_confidence DESC
    LOOP
        BEGIN
            IF p_mode != 'dry_run' THEN
                -- Link activity to deal
                UPDATE sales_activities 
                SET deal_id = rec.deal_id,
                    updated_at = NOW()
                WHERE id = rec.activity_id;
                
                v_linked := v_linked + 1;
            END IF;
            
            -- Log the action
            PERFORM log_reconciliation_action(
                'AUTO_LINK_HIGH_CONFIDENCE',
                'sales_activities',
                rec.activity_id,
                'deals',
                rec.deal_id,
                rec.overall_confidence,
                jsonb_build_object(
                    'name_confidence', rec.name_confidence,
                    'date_confidence', rec.date_confidence,
                    'amount_confidence', rec.amount_confidence,
                    'activity_company', rec.activity_company,
                    'deal_company', rec.deal_company,
                    'mode', p_mode
                ),
                p_user_id
            );
            
            v_processed := v_processed + 1;
            
        EXCEPTION WHEN OTHERS THEN
            v_errors := v_errors + 1;
            PERFORM log_reconciliation_action(
                'ERROR',
                'sales_activities',
                rec.activity_id,
                'deals',
                rec.deal_id,
                rec.overall_confidence,
                jsonb_build_object('error', SQLERRM, 'mode', p_mode),
                p_user_id
            );
        END;
    END LOOP;

    RAISE NOTICE 'Phase 1 complete: % high-confidence links created', v_linked;

    -- PHASE 2: Create Deals from Orphan Activities
    RAISE NOTICE 'Phase 2: Creating deals from orphan activities...';
    
    FOR rec IN
        SELECT sa.*, ROW_NUMBER() OVER (ORDER BY sa.id) as rn
        FROM sales_activities sa
        LEFT JOIN deals d ON sa.deal_id = d.id
        WHERE d.id IS NULL
          AND (p_user_id IS NULL OR sa.owner_id = p_user_id)
          AND sa.company_name IS NOT NULL
        ORDER BY sa.activity_date DESC
        LIMIT p_batch_size
    LOOP
        BEGIN
            IF p_mode != 'dry_run' THEN
                -- Create new deal from activity
                WITH new_deal AS (
                    INSERT INTO deals (
                        company_name,
                        amount,
                        stage,
                        close_date,
                        owner_id,
                        created_at,
                        updated_at,
                        source
                    ) VALUES (
                        rec.company_name,
                        COALESCE(rec.amount, 0),
                        'Closed Won', -- Since activity exists, assume it was won
                        rec.activity_date,
                        rec.owner_id,
                        NOW(),
                        NOW(),
                        'reconciliation_engine'
                    ) RETURNING id
                )
                UPDATE sales_activities 
                SET deal_id = (SELECT id FROM new_deal),
                    updated_at = NOW()
                WHERE id = rec.id;
                
                v_created_deals := v_created_deals + 1;
            END IF;
            
            -- Log the action
            PERFORM log_reconciliation_action(
                'CREATE_DEAL_FROM_ACTIVITY',
                'sales_activities',
                rec.id,
                'deals',
                NULL,
                100.0,
                jsonb_build_object(
                    'company_name', rec.company_name,
                    'amount', rec.amount,
                    'activity_date', rec.activity_date,
                    'mode', p_mode
                ),
                p_user_id
            );
            
            v_processed := v_processed + 1;
            
        EXCEPTION WHEN OTHERS THEN
            v_errors := v_errors + 1;
            PERFORM log_reconciliation_action(
                'ERROR',
                'sales_activities',
                rec.id,
                NULL,
                NULL,
                NULL,
                jsonb_build_object('error', SQLERRM, 'mode', p_mode),
                p_user_id
            );
        END;
    END LOOP;

    RAISE NOTICE 'Phase 2 complete: % deals created from activities', v_created_deals;

    -- PHASE 3: Create Activities from Orphan Deals (Only in aggressive mode)
    IF p_mode = 'aggressive' THEN
        RAISE NOTICE 'Phase 3: Creating activities from orphan deals...';
        
        FOR rec IN
            SELECT d.*, ROW_NUMBER() OVER (ORDER BY d.id) as rn
            FROM deals d
            LEFT JOIN sales_activities sa ON d.id = sa.deal_id
            WHERE sa.id IS NULL
              AND (p_user_id IS NULL OR d.owner_id = p_user_id)
              AND d.company_name IS NOT NULL
              AND d.stage = 'Closed Won'
            ORDER BY d.close_date DESC
            LIMIT p_batch_size
        LOOP
            BEGIN
                IF p_mode != 'dry_run' THEN
                    -- Create reconstructed activity from deal
                    INSERT INTO sales_activities (
                        company_name,
                        amount,
                        activity_date,
                        activity_type,
                        deal_id,
                        owner_id,
                        created_at,
                        updated_at,
                        source
                    ) VALUES (
                        rec.company_name,
                        rec.amount,
                        rec.close_date,
                        'Sale - Reconstructed',
                        rec.id,
                        rec.owner_id,
                        NOW(),
                        NOW(),
                        'reconciliation_engine'
                    );
                    
                    v_created_activities := v_created_activities + 1;
                END IF;
                
                -- Log the action
                PERFORM log_reconciliation_action(
                    'CREATE_ACTIVITY_FROM_DEAL',
                    'deals',
                    rec.id,
                    'sales_activities',
                    NULL,
                    100.0,
                    jsonb_build_object(
                        'company_name', rec.company_name,
                        'amount', rec.amount,
                        'close_date', rec.close_date,
                        'mode', p_mode
                    ),
                    p_user_id
                );
                
                v_processed := v_processed + 1;
                
            EXCEPTION WHEN OTHERS THEN
                v_errors := v_errors + 1;
                PERFORM log_reconciliation_action(
                    'ERROR',
                    'deals',
                    rec.id,
                    NULL,
                    NULL,
                    NULL,
                    jsonb_build_object('error', SQLERRM, 'mode', p_mode),
                    p_user_id
                );
            END;
        END LOOP;

        RAISE NOTICE 'Phase 3 complete: % activities created from deals', v_created_activities;
    END IF;

    -- PHASE 4: Mark Potential Duplicates (Only in aggressive mode)
    IF p_mode = 'aggressive' THEN
        RAISE NOTICE 'Phase 4: Marking potential duplicates...';
        
        -- Mark duplicate activities (same company, date, amount)
        FOR rec IN
            WITH duplicate_groups AS (
                SELECT 
                    company_name,
                    activity_date,
                    amount,
                    owner_id,
                    COUNT(*) as duplicate_count,
                    MIN(id) as keep_id,
                    ARRAY_AGG(id ORDER BY created_at) as all_ids
                FROM sales_activities
                WHERE (p_user_id IS NULL OR owner_id = p_user_id)
                GROUP BY company_name, activity_date, amount, owner_id
                HAVING COUNT(*) > 1
            )
            SELECT 
                dg.*,
                UNNEST(dg.all_ids[2:]) as duplicate_id
            FROM duplicate_groups dg
            LIMIT p_batch_size
        LOOP
            BEGIN
                IF p_mode != 'dry_run' THEN
                    -- Mark as potential duplicate (could add a status field)
                    UPDATE sales_activities 
                    SET updated_at = NOW()
                    WHERE id = rec.duplicate_id;
                    
                    v_duplicates_marked := v_duplicates_marked + 1;
                END IF;
                
                -- Log the action
                PERFORM log_reconciliation_action(
                    'MARK_DUPLICATE_ACTIVITY',
                    'sales_activities',
                    rec.duplicate_id,
                    'sales_activities',
                    rec.keep_id,
                    95.0,
                    jsonb_build_object(
                        'company_name', rec.company_name,
                        'activity_date', rec.activity_date,
                        'amount', rec.amount,
                        'duplicate_count', rec.duplicate_count,
                        'mode', p_mode
                    ),
                    p_user_id
                );
                
                v_processed := v_processed + 1;
                
            EXCEPTION WHEN OTHERS THEN
                v_errors := v_errors + 1;
                PERFORM log_reconciliation_action(
                    'ERROR',
                    'sales_activities',
                    rec.duplicate_id,
                    NULL,
                    NULL,
                    NULL,
                    jsonb_build_object('error', SQLERRM, 'mode', p_mode),
                    p_user_id
                );
            END;
        END LOOP;

        RAISE NOTICE 'Phase 4 complete: % duplicates marked', v_duplicates_marked;
    END IF;

    -- Compile final statistics
    v_stats := jsonb_build_object(
        'mode', p_mode,
        'user_id', p_user_id,
        'started_at', v_stats->>'started_at',
        'completed_at', NOW(),
        'total_processed', v_processed,
        'high_confidence_links', v_linked,
        'deals_created', v_created_deals,
        'activities_created', v_created_activities,
        'duplicates_marked', v_duplicates_marked,
        'errors', v_errors,
        'orphan_activities_found', v_total_orphan_activities,
        'orphan_deals_found', v_total_orphan_deals,
        'success_rate', CASE WHEN v_processed > 0 THEN ROUND((v_processed - v_errors)::DECIMAL / v_processed * 100, 2) ELSE 100 END
    );

        RAISE NOTICE 'Reconciliation complete: %', v_stats;
        
    EXCEPTION
        WHEN OTHERS THEN
            -- Always release the advisory lock, even on error
            PERFORM pg_advisory_unlock(54321, COALESCE(hashtext(p_user_id), 0));
            RAISE;
    END;
    
    -- Release the advisory lock
    PERFORM pg_advisory_unlock(54321, COALESCE(hashtext(p_user_id), 0));
    
    RETURN v_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create rollback function for emergency recovery with security fixes
CREATE OR REPLACE FUNCTION rollback_reconciliation(
    p_audit_log_ids INTEGER[] DEFAULT NULL,
    p_time_threshold TIMESTAMP DEFAULT NULL,
    p_user_id TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_stats JSONB := '{}';
    v_reverted INTEGER := 0;
    v_errors INTEGER := 0;
    v_verified_actions INTEGER := 0;
    rec RECORD;
    v_original_user_id TEXT;
    v_record_owner_id TEXT;
    v_target_owner_id TEXT;
BEGIN
    -- Security: Input validation
    IF p_audit_log_ids IS NOT NULL AND array_length(p_audit_log_ids, 1) > 1000 THEN
        RAISE EXCEPTION 'Too many audit log IDs specified (max: 1000)';
    END IF;
    
    IF p_time_threshold IS NOT NULL AND p_time_threshold > NOW() THEN
        RAISE EXCEPTION 'Time threshold cannot be in the future';
    END IF;

    -- Security: Use advisory lock to prevent concurrent rollbacks
    IF NOT pg_try_advisory_lock(12345, 67890) THEN
        RAISE EXCEPTION 'Another rollback operation is in progress. Please try again later.';
    END IF;

    BEGIN
        -- Rollback based on audit log entries with ownership verification
        FOR rec IN
            SELECT *
            FROM reconciliation_audit_log
            WHERE (p_audit_log_ids IS NULL OR id = ANY(p_audit_log_ids))
              AND (p_time_threshold IS NULL OR executed_at >= p_time_threshold)
              AND (p_user_id IS NULL OR user_id = p_user_id)
              AND action_type IN ('AUTO_LINK_HIGH_CONFIDENCE', 'CREATE_DEAL_FROM_ACTIVITY', 'CREATE_ACTIVITY_FROM_DEAL')
            ORDER BY executed_at DESC
        LOOP
            BEGIN
                -- Security: Verify user ownership before rollback
                v_original_user_id := rec.user_id;
                
                -- Verify source record ownership
                CASE rec.source_table
                    WHEN 'sales_activities' THEN
                        SELECT owner_id INTO v_record_owner_id 
                        FROM sales_activities 
                        WHERE id = rec.source_id;
                    WHEN 'deals' THEN
                        SELECT owner_id INTO v_record_owner_id 
                        FROM deals 
                        WHERE id = rec.source_id;
                    ELSE
                        RAISE EXCEPTION 'Invalid source table: %', rec.source_table;
                END CASE;
                
                -- Security: Only allow rollback if user owns the records or is admin
                IF p_user_id IS NOT NULL AND v_record_owner_id != p_user_id AND v_original_user_id != p_user_id THEN
                    PERFORM log_reconciliation_action(
                        'ROLLBACK_ACCESS_DENIED',
                        rec.source_table,
                        rec.source_id,
                        NULL,
                        NULL,
                        NULL,
                        jsonb_build_object(
                            'reason', 'User does not own this record',
                            'requesting_user', p_user_id,
                            'record_owner', v_record_owner_id,
                            'original_user', v_original_user_id
                        ),
                        p_user_id
                    );
                    CONTINUE;
                END IF;
                
                -- Verify target record ownership if applicable
                IF rec.target_id IS NOT NULL THEN
                    CASE rec.target_table
                        WHEN 'sales_activities' THEN
                            SELECT owner_id INTO v_target_owner_id 
                            FROM sales_activities 
                            WHERE id = rec.target_id;
                        WHEN 'deals' THEN
                            SELECT owner_id INTO v_target_owner_id 
                            FROM deals 
                            WHERE id = rec.target_id;
                    END CASE;
                    
                    IF p_user_id IS NOT NULL AND v_target_owner_id != p_user_id AND v_original_user_id != p_user_id THEN
                        PERFORM log_reconciliation_action(
                            'ROLLBACK_ACCESS_DENIED',
                            rec.target_table,
                            rec.target_id,
                            NULL,
                            NULL,
                            NULL,
                            jsonb_build_object(
                                'reason', 'User does not own target record',
                                'requesting_user', p_user_id,
                                'target_owner', v_target_owner_id
                            ),
                            p_user_id
                        );
                        CONTINUE;
                    END IF;
                END IF;
                
                v_verified_actions := v_verified_actions + 1;
                
                CASE rec.action_type
                    WHEN 'AUTO_LINK_HIGH_CONFIDENCE' THEN
                        -- Security: Verify activity exists and belongs to user before unlinking
                        UPDATE sales_activities 
                        SET deal_id = NULL, updated_at = NOW()
                        WHERE id = rec.source_id 
                          AND (p_user_id IS NULL OR owner_id = p_user_id);
                        
                        IF NOT FOUND THEN
                            RAISE EXCEPTION 'Activity % not found or access denied', rec.source_id;
                        END IF;
                        
                    WHEN 'CREATE_DEAL_FROM_ACTIVITY' THEN
                        -- Security: Verify deal exists and was created by reconciliation engine
                        DELETE FROM deals 
                        WHERE source = 'reconciliation_engine' 
                          AND id = rec.target_id
                          AND (p_user_id IS NULL OR owner_id = p_user_id);
                          
                        IF NOT FOUND THEN
                            RAISE EXCEPTION 'Deal % not found, not created by reconciliation engine, or access denied', rec.target_id;
                        END IF;
                        
                        -- Unlink activity with ownership verification
                        UPDATE sales_activities 
                        SET deal_id = NULL, updated_at = NOW()
                        WHERE id = rec.source_id 
                          AND (p_user_id IS NULL OR owner_id = p_user_id);
                        
                    WHEN 'CREATE_ACTIVITY_FROM_DEAL' THEN
                        -- Security: Verify activity was created by reconciliation engine and belongs to user
                        DELETE FROM sales_activities 
                        WHERE source = 'reconciliation_engine' 
                          AND deal_id = rec.source_id
                          AND (p_user_id IS NULL OR owner_id = p_user_id);
                          
                        IF NOT FOUND THEN
                            RAISE EXCEPTION 'Activity for deal % not found, not created by reconciliation engine, or access denied', rec.source_id;
                        END IF;
                END CASE;
                
                -- Log the rollback with enhanced security context
                PERFORM log_reconciliation_action(
                    'ROLLBACK_' || rec.action_type,
                    rec.source_table,
                    rec.source_id,
                    rec.target_table,
                    rec.target_id,
                    NULL,
                    jsonb_build_object(
                        'original_audit_id', rec.id,
                        'rollback_user', p_user_id,
                        'original_user', v_original_user_id,
                        'security_verified', true
                    ),
                    p_user_id
                );
                
                v_reverted := v_reverted + 1;
                
            EXCEPTION WHEN OTHERS THEN
                v_errors := v_errors + 1;
                -- Enhanced error logging without exposing sensitive data
                PERFORM log_reconciliation_action(
                    'ROLLBACK_ERROR',
                    rec.source_table,
                    rec.source_id,
                    NULL,
                    NULL,
                    NULL,
                    jsonb_build_object(
                        'error_type', SQLSTATE,
                        'original_audit_id', rec.id,
                        'rollback_user', p_user_id,
                        'timestamp', NOW()
                    ),
                    p_user_id
                );
                
                -- Log to server logs for debugging (admin only)
                RAISE WARNING 'Rollback error for audit ID %: % (SQLSTATE: %)', rec.id, SQLERRM, SQLSTATE;
            END;
        END LOOP;

        -- Compile final statistics with security info
        v_stats := jsonb_build_object(
            'rollback_completed_at', NOW(),
            'entries_processed', v_verified_actions,
            'entries_reverted', v_reverted,
            'errors', v_errors,
            'requesting_user', p_user_id,
            'security_checks_passed', v_verified_actions - v_errors,
            'success_rate', CASE WHEN v_verified_actions > 0 THEN ROUND((v_verified_actions - v_errors)::DECIMAL / v_verified_actions * 100, 2) ELSE 100 END
        );

    EXCEPTION
        WHEN OTHERS THEN
            -- Always release the advisory lock, even on error
            PERFORM pg_advisory_unlock(12345, 67890);
            RAISE;
    END;
    
    -- Release the advisory lock
    PERFORM pg_advisory_unlock(12345, 67890);

    RETURN v_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create convenience views for monitoring reconciliation status
CREATE OR REPLACE VIEW reconciliation_status AS
SELECT 
    'orphan_activities' as category,
    COUNT(*) as count,
    owner_id
FROM sales_activities sa
LEFT JOIN deals d ON sa.deal_id = d.id
WHERE d.id IS NULL
GROUP BY owner_id

UNION ALL

SELECT 
    'orphan_deals' as category,
    COUNT(*) as count,
    owner_id
FROM deals d
LEFT JOIN sales_activities sa ON d.id = sa.deal_id
WHERE sa.id IS NULL
GROUP BY owner_id

UNION ALL

SELECT 
    'linked_records' as category,
    COUNT(*) as count,
    sa.owner_id
FROM sales_activities sa
INNER JOIN deals d ON sa.deal_id = d.id
GROUP BY sa.owner_id;

-- Create summary view for reconciliation audit
CREATE OR REPLACE VIEW reconciliation_summary AS
SELECT 
    DATE(executed_at) as date,
    action_type,
    COUNT(*) as action_count,
    AVG(confidence_score) as avg_confidence,
    user_id
FROM reconciliation_audit_log
WHERE executed_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(executed_at), action_type, user_id
ORDER BY date DESC, action_count DESC;

-- Example usage:
-- SELECT execute_sales_reconciliation('safe', 'user123', 50);
-- SELECT execute_sales_reconciliation('aggressive', NULL, 100);
-- SELECT execute_sales_reconciliation('dry_run', 'user123', 25);
-- SELECT * FROM reconciliation_status WHERE owner_id = 'user123';
-- SELECT rollback_reconciliation(NULL, NOW() - INTERVAL '1 hour');