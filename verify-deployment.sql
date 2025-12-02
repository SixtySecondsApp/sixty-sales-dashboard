-- Deployment Verification Queries
-- Run these in Supabase Dashboard → SQL Editor to verify deployment

-- ============================================
-- 1. Verify Communication Events Migrations
-- ============================================

-- Check sentiment analysis columns exist
SELECT 
  column_name, 
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'communication_events' 
  AND column_name IN (
    'sentiment_score',      -- NUMERIC (-1 to 1)
    'ai_analyzed',          -- BOOLEAN
    'ai_model',             -- TEXT
    'key_topics',           -- JSONB
    'action_items',         -- JSONB
    'urgency',              -- TEXT (low/medium/high)
    'response_required',    -- BOOLEAN
    'email_subject',        -- TEXT
    'email_body_preview',   -- TEXT
    'email_thread_id',      -- TEXT
    'external_id',          -- TEXT (Gmail message ID)
    'sync_source'           -- TEXT (gmail/manual/calendar/fathom)
  )
ORDER BY column_name;

-- Expected: 12 rows

-- ============================================
-- 2. Verify Last Login Tracking
-- ============================================

-- Check last_login_at column in profiles
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'profiles' 
  AND column_name = 'last_login_at';

-- Expected: 1 row (TIMESTAMP WITH TIME ZONE)

-- ============================================
-- 3. Verify Indexes
-- ============================================

-- Check sentiment-related indexes
SELECT 
  indexname,
  indexdef
FROM pg_indexes 
WHERE tablename = 'communication_events' 
  AND (
    indexname LIKE '%sentiment%' OR
    indexname LIKE '%gmail%' OR
    indexname LIKE '%ai%' OR
    indexname LIKE '%sync%'
  )
ORDER BY indexname;

-- Expected: Multiple indexes including:
-- - idx_communication_events_gmail_id
-- - idx_communication_events_sentiment
-- - idx_communication_events_ai_pending
-- - idx_communication_events_sync_date
-- - idx_communication_events_email_sentiment

-- ============================================
-- 4. Verify Sample Data (if exists)
-- ============================================

-- Check if any emails have been synced with sentiment
SELECT 
  COUNT(*) as total_emails,
  COUNT(CASE WHEN ai_analyzed = true THEN 1 END) as analyzed_count,
  COUNT(CASE WHEN sentiment_score IS NOT NULL THEN 1 END) as sentiment_count,
  AVG(sentiment_score) as avg_sentiment,
  MIN(sentiment_score) as min_sentiment,
  MAX(sentiment_score) as max_sentiment
FROM communication_events
WHERE sync_source = 'gmail';

-- ============================================
-- 5. Verify Health Score Integration
-- ============================================

-- Check if deal health scores include sentiment
SELECT 
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_name = 'deal_health_scores' 
  AND column_name IN (
    'sentiment_score',
    'sentiment_trend',
    'avg_sentiment_last_3_meetings'
  )
ORDER BY column_name;

-- Expected: 3 rows

-- ============================================
-- 6. Check Edge Function Deployment Status
-- ============================================

-- Note: Edge functions are deployed via Supabase CLI
-- Check in Supabase Dashboard → Edge Functions
-- This query checks if functions table exists (if available)

SELECT EXISTS (
  SELECT 1 
  FROM information_schema.tables 
  WHERE table_schema = 'supabase_functions' 
  AND table_name = 'functions'
) as functions_table_exists;

-- ============================================
-- 7. Summary Report
-- ============================================

DO $$
DECLARE
  v_sentiment_columns INTEGER;
  v_last_login_exists BOOLEAN;
  v_sentiment_indexes INTEGER;
  v_emails_with_sentiment INTEGER;
BEGIN
  -- Count sentiment columns
  SELECT COUNT(*) INTO v_sentiment_columns
  FROM information_schema.columns 
  WHERE table_name = 'communication_events' 
    AND column_name IN ('sentiment_score', 'ai_analyzed', 'key_topics', 'urgency');

  -- Check last_login_at
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'last_login_at'
  ) INTO v_last_login_exists;

  -- Count sentiment indexes
  SELECT COUNT(*) INTO v_sentiment_indexes
  FROM pg_indexes 
  WHERE tablename = 'communication_events' 
    AND indexname LIKE '%sentiment%';

  -- Count emails with sentiment
  SELECT COUNT(*) INTO v_emails_with_sentiment
  FROM communication_events
  WHERE sentiment_score IS NOT NULL;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'DEPLOYMENT VERIFICATION SUMMARY';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Sentiment columns: % (expected: 4)', v_sentiment_columns;
  RAISE NOTICE 'Last login tracking: %', CASE WHEN v_last_login_exists THEN 'YES' ELSE 'NO' END;
  RAISE NOTICE 'Sentiment indexes: %', v_sentiment_indexes;
  RAISE NOTICE 'Emails with sentiment: %', v_emails_with_sentiment;
  RAISE NOTICE '';
  
  IF v_sentiment_columns = 4 AND v_last_login_exists AND v_sentiment_indexes > 0 THEN
    RAISE NOTICE '✅ MIGRATIONS VERIFIED - Deployment successful!';
  ELSE
    RAISE NOTICE '⚠️  INCOMPLETE - Some migrations may be missing';
  END IF;
  
  RAISE NOTICE '========================================';
END $$;















