-- Migration: Backfill Existing Action Items to Tasks
-- Description: Sync all existing meeting action items to create tasks for sales reps
-- Author: Claude
-- Date: 2025-10-25

-- ============================================================================
-- Backfill Existing Action Items
-- ============================================================================

DO $$
DECLARE
  action_item_record RECORD;
  processed_count INTEGER := 0;
  synced_count INTEGER := 0;
  excluded_count INTEGER := 0;
  failed_count INTEGER := 0;
BEGIN
  RAISE NOTICE 'Starting backfill of existing meeting action items...';

  -- Loop through all existing action items that haven't been synced yet
  FOR action_item_record IN
    SELECT *
    FROM meeting_action_items
    WHERE task_id IS NULL
      AND (synced_to_task IS NULL OR synced_to_task = false)
    ORDER BY created_at ASC
  LOOP
    processed_count := processed_count + 1;

    BEGIN
      -- Check if assignee is internal (sales rep)
      IF action_item_record.assignee_email IS NOT NULL
         AND NOT is_internal_assignee(action_item_record.assignee_email) THEN
        -- External assignee - mark as excluded
        UPDATE meeting_action_items
        SET
          sync_status = 'excluded',
          synced_to_task = false,
          updated_at = NOW()
        WHERE id = action_item_record.id;

        excluded_count := excluded_count + 1;
        CONTINUE;
      END IF;

      -- Trigger the auto-sync by updating the record
      -- This will invoke the auto_create_task_from_action_item trigger
      UPDATE meeting_action_items
      SET updated_at = NOW()
      WHERE id = action_item_record.id;

      -- Check if sync was successful
      IF (SELECT sync_status FROM meeting_action_items WHERE id = action_item_record.id) = 'synced' THEN
        synced_count := synced_count + 1;
      ELSE
        failed_count := failed_count + 1;
      END IF;

    EXCEPTION WHEN OTHERS THEN
      -- Log the error but continue processing
      RAISE WARNING 'Failed to sync action item %: %', action_item_record.id, SQLERRM;
      failed_count := failed_count + 1;

      -- Mark as failed
      UPDATE meeting_action_items
      SET
        sync_status = 'failed',
        sync_error = SQLERRM,
        synced_to_task = false,
        updated_at = NOW()
      WHERE id = action_item_record.id;
    END;

    -- Log progress every 100 items
    IF processed_count % 100 = 0 THEN
      RAISE NOTICE 'Processed % action items...', processed_count;
    END IF;
  END LOOP;

  RAISE NOTICE 'Backfill complete!';
  RAISE NOTICE 'Total processed: %', processed_count;
  RAISE NOTICE 'Successfully synced: %', synced_count;
  RAISE NOTICE 'Excluded (external): %', excluded_count;
  RAISE NOTICE 'Failed: %', failed_count;

END $$;

-- ============================================================================
-- Verify Backfill Results
-- ============================================================================

-- Query to check backfill results
DO $$
DECLARE
  stats RECORD;
BEGIN
  SELECT
    COUNT(*) as total_action_items,
    COUNT(*) FILTER (WHERE task_id IS NOT NULL) as with_tasks,
    COUNT(*) FILTER (WHERE sync_status = 'synced') as synced,
    COUNT(*) FILTER (WHERE sync_status = 'pending') as pending,
    COUNT(*) FILTER (WHERE sync_status = 'failed') as failed,
    COUNT(*) FILTER (WHERE sync_status = 'excluded') as excluded
  INTO stats
  FROM meeting_action_items;

  RAISE NOTICE '=== Backfill Verification ===';
  RAISE NOTICE 'Total action items: %', stats.total_action_items;
  RAISE NOTICE 'Linked to tasks: %', stats.with_tasks;
  RAISE NOTICE 'Synced status: %', stats.synced;
  RAISE NOTICE 'Pending status: %', stats.pending;
  RAISE NOTICE 'Failed status: %', stats.failed;
  RAISE NOTICE 'Excluded status: %', stats.excluded;
END $$;

-- ============================================================================
-- Optional: List Failed Syncs for Manual Review
-- ============================================================================

-- Uncomment to see failed syncs
-- SELECT
--   id,
--   title,
--   assignee_email,
--   sync_status,
--   sync_error,
--   created_at
-- FROM meeting_action_items
-- WHERE sync_status = 'failed'
-- ORDER BY created_at DESC;
