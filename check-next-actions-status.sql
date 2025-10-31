-- ===================================
-- Next-Action Engine Diagnostic Check
-- ===================================

-- 1. Check recent meetings
SELECT '=== RECENT MEETINGS ===' as section;
SELECT
  id,
  title,
  CASE WHEN transcript_text IS NOT NULL THEN 'YES' ELSE 'NO' END as has_transcript,
  CASE WHEN summary IS NOT NULL THEN 'YES' ELSE 'NO' END as has_summary,
  next_actions_count,
  created_at
FROM meetings
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 5;

-- 2. Check triggers exist
SELECT '=== TRIGGER STATUS ===' as section;
SELECT
  tgname as trigger_name,
  CASE tgenabled
    WHEN 'O' THEN 'Enabled'
    WHEN 'D' THEN 'Disabled'
    ELSE 'Unknown'
  END as status,
  tgrelid::regclass as table_name
FROM pg_trigger
WHERE tgname LIKE '%next_action%';

-- 3. Check database config
SELECT '=== DATABASE CONFIG ===' as section;
SELECT 
  'supabase_url' as setting,
  current_setting('app.settings.supabase_url', true) as value
UNION ALL
SELECT 
  'service_role_key' as setting,
  CASE 
    WHEN current_setting('app.settings.service_role_key', true) IS NOT NULL 
    THEN '***SET***' 
    ELSE 'NOT SET' 
  END as value;

-- 4. Check if suggestions table exists
SELECT '=== SUGGESTIONS TABLE ===' as section;
SELECT 
  COUNT(*) as total_suggestions,
  SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
  SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) as accepted,
  MAX(created_at) as last_created
FROM next_action_suggestions;

-- 5. Find a meeting to test with
SELECT '=== TEST MEETING ===' as section;
SELECT
  id as meeting_id,
  title,
  'SELECT regenerate_next_actions_for_activity(''' || id || '''::UUID, ''meeting'');' as test_command
FROM meetings
WHERE transcript_text IS NOT NULL OR summary IS NOT NULL
ORDER BY created_at DESC
LIMIT 1;

