-- Multi-Tenant Architecture: Update triggers to include org_id
-- This migration updates all triggers that create or link tenant data to include org_id

-- ============================================================================
-- 1. Update auto_link_calendar_event_to_contact trigger
-- ============================================================================
-- This trigger links calendar events to contacts based on email matching
-- Must filter by org_id to ensure cross-tenant isolation

CREATE OR REPLACE FUNCTION auto_link_calendar_event_to_contact()
RETURNS TRIGGER AS $$
DECLARE
  v_contact_id UUID;
  v_company_id UUID;
  v_org_id UUID;
BEGIN
  -- Only process if contact_id is not already set
  IF NEW.contact_id IS NULL AND NEW.organizer_email IS NOT NULL THEN
    -- Get org_id from the calendar event (should already be set)
    v_org_id := NEW.org_id;
    
    -- Try to find contact by email within the same organization
    SELECT id, company_id INTO v_contact_id, v_company_id
    FROM contacts
    WHERE email = NEW.organizer_email
      AND user_id = NEW.user_id
      AND org_id = v_org_id  -- CRITICAL: Filter by org_id for tenant isolation
    LIMIT 1;
    
    IF v_contact_id IS NOT NULL THEN
      NEW.contact_id = v_contact_id;
      NEW.company_id = v_company_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 2. Update create_smart_tasks trigger
-- ============================================================================
-- This trigger creates tasks automatically based on activity types
-- Must include org_id from the activity when creating tasks

CREATE OR REPLACE FUNCTION create_smart_tasks()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create tasks if the activity has a deal_id
  IF NEW.deal_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Auto-create tasks based on active templates in the same organization
  INSERT INTO tasks (
    title,
    description,
    due_date,
    task_type,
    priority,
    assigned_to,
    deal_id,
    created_by,
    status,
    org_id  -- CRITICAL: Include org_id from activity
  )
  SELECT 
    stt.task_title,
    COALESCE(stt.task_description, '') || 
      E'\n\nAuto-generated from ' || NEW.type || ' activity on ' || TO_CHAR(NEW.created_at, 'YYYY-MM-DD'),
    NEW.created_at::DATE + stt.days_after_trigger,
    stt.task_type,
    stt.priority,
    NEW.user_id,
    NEW.deal_id,
    NEW.user_id,
    'pending',
    NEW.org_id  -- Use org_id from the activity
  FROM smart_task_templates stt
  WHERE stt.trigger_activity_type = NEW.type
    AND stt.is_active = true
    AND stt.org_id = NEW.org_id;  -- CRITICAL: Only use templates from same org
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 3. Update auto_create_task_from_action_item trigger
-- ============================================================================
-- This trigger creates tasks from meeting action items
-- Must include org_id from the meeting when creating tasks

CREATE OR REPLACE FUNCTION auto_create_task_from_action_item()
RETURNS TRIGGER AS $$
DECLARE
  assignee_user_id UUID;
  meeting_title_text TEXT;
  meeting_company_id UUID;
  meeting_contact_id UUID;
  meeting_org_id UUID;
  task_priority TEXT;
  task_type_mapped TEXT;
  new_task_id UUID;
BEGIN
  -- Skip if already synced
  IF NEW.synced_to_task = true OR NEW.task_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Get meeting details including org_id
  SELECT 
    m.owner_user_id,
    m.title,
    m.company_id,
    m.primary_contact_id,
    m.org_id  -- Get org_id from meeting
  INTO 
    assignee_user_id,
    meeting_title_text,
    meeting_company_id,
    meeting_contact_id,
    meeting_org_id
  FROM meetings m
  WHERE m.id = NEW.meeting_id;

  -- If no assignee found, use the meeting owner
  IF assignee_user_id IS NULL THEN
    SELECT owner_user_id INTO assignee_user_id
    FROM meetings
    WHERE id = NEW.meeting_id;
  END IF;

  -- Map priority
  task_priority := COALESCE(LOWER(NEW.priority), 'medium');
  IF task_priority NOT IN ('low', 'medium', 'high', 'urgent') THEN
    task_priority := 'medium';
  END IF;

  -- Map category to task_type
  task_type_mapped := COALESCE(LOWER(NEW.category), 'general');
  IF task_type_mapped NOT IN ('call', 'email', 'meeting', 'follow_up', 'general') THEN
    task_type_mapped := 'general';
  END IF;

  BEGIN
    -- Create task with org_id from meeting
    INSERT INTO tasks (
      title,
      description,
      due_date,
      priority,
      status,
      task_type,
      assigned_to,
      created_by,
      company_id,
      contact_id,
      meeting_action_item_id,
      notes,
      completed,
      org_id  -- CRITICAL: Include org_id from meeting
    ) VALUES (
      NEW.title,
      CONCAT('Action item from meeting: ', COALESCE(meeting_title_text, 'Unknown Meeting')),
      COALESCE(NEW.deadline_at, NOW() + INTERVAL '3 days'),
      task_priority,
      CASE WHEN NEW.completed THEN 'completed' ELSE 'pending' END,
      task_type_mapped,
      assignee_user_id,
      assignee_user_id,
      meeting_company_id,
      meeting_contact_id,
      NEW.id,
      CONCAT(
        'Category: ', COALESCE(NEW.category, 'General'),
        E'\n', 'AI Generated: ', CASE WHEN NEW.ai_generated THEN 'Yes' ELSE 'No' END,
        E'\n', CASE WHEN NEW.playback_url IS NOT NULL THEN CONCAT('Video Playback: ', NEW.playback_url) ELSE '' END
      ),
      NEW.completed,
      meeting_org_id  -- Use org_id from meeting
    )
    RETURNING id INTO new_task_id;

    -- Update action item with sync status
    NEW.task_id := new_task_id;
    NEW.synced_to_task := true;
    NEW.sync_status := 'synced';
    NEW.synced_at := NOW();
    NEW.sync_error := NULL;

  EXCEPTION WHEN OTHERS THEN
    -- Handle errors gracefully
    NEW.sync_status := 'failed';
    NEW.sync_error := CONCAT('Error creating task: ', SQLERRM);
    NEW.synced_to_task := false;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 4. Update get_calendar_events_in_range function
-- ============================================================================
-- This function retrieves calendar events and should filter by org_id
-- Note: This may need to be updated in the actual migration file if it exists

-- Check if function exists and update it
DO $$
BEGIN
  -- If the function exists, we'll need to update it to include org_id filtering
  -- For now, we'll note that the RLS policies will handle org isolation
  -- But the function should ideally filter by org_id for performance
  NULL; -- Placeholder - actual function update may be in separate migration
END $$;

-- Comments
COMMENT ON FUNCTION auto_link_calendar_event_to_contact() IS 'Updated to filter contacts by org_id for tenant isolation';
COMMENT ON FUNCTION create_smart_tasks() IS 'Updated to include org_id when creating tasks from activities';
COMMENT ON FUNCTION auto_create_task_from_action_item() IS 'Updated to include org_id from meeting when creating tasks';











