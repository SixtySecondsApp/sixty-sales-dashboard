-- Migration: Update auto_create_task_from_action_item to include company_id, contact_id and map category
-- Description: When creating tasks from meeting action items, populate company and contact from the meeting
-- Date: 2025-10-27

-- Update the trigger function to set company_id, contact_id, and map category to task_type
CREATE OR REPLACE FUNCTION auto_create_task_from_action_item()
RETURNS TRIGGER AS $$
DECLARE
  assignee_user_id UUID;
  meeting_owner_id UUID;
  meeting_title_text TEXT;
  meeting_company_id UUID;
  meeting_contact_id UUID;
  task_priority TEXT;
  task_type_mapped TEXT;
  new_task_id UUID;
BEGIN
  -- Only process if not already synced
  IF NEW.task_id IS NOT NULL OR NEW.synced_to_task = true THEN
    RETURN NEW;
  END IF;

  -- Get meeting details including company and contact
  SELECT owner_user_id, title, company_id, primary_contact_id
  INTO meeting_owner_id, meeting_title_text, meeting_company_id, meeting_contact_id
  FROM meetings
  WHERE id = NEW.meeting_id;

  -- Only process if assignee is internal (sales rep)
  IF NEW.assignee_email IS NOT NULL AND NOT is_internal_assignee(NEW.assignee_email) THEN
    -- External assignee - exclude from sync
    NEW.sync_status := 'excluded';
    NEW.synced_to_task := false;
    RETURN NEW;
  END IF;

  -- Determine assignee
  IF NEW.assignee_email IS NOT NULL THEN
    assignee_user_id := get_user_id_from_email(NEW.assignee_email);
  END IF;

  -- Fallback to meeting owner if no assignee found
  IF assignee_user_id IS NULL THEN
    assignee_user_id := meeting_owner_id;
  END IF;

  -- Final check - must have a valid assignee
  IF assignee_user_id IS NULL THEN
    NEW.sync_status := 'failed';
    NEW.sync_error := 'No valid assignee found (no assignee email and no meeting owner)';
    RETURN NEW;
  END IF;

  -- Map Fathom priority to task priority
  task_priority := COALESCE(LOWER(NEW.priority), 'medium');
  IF task_priority NOT IN ('low', 'medium', 'high', 'urgent') THEN
    task_priority := 'medium';
  END IF;

  -- Map category to task_type (normalized set)
  -- Categories from AI: call, email, meeting, follow_up, proposal, demo, general
  task_type_mapped := LOWER(COALESCE(NEW.category, 'general'));
  
  -- Normalize variants
  CASE task_type_mapped
    WHEN 'follow-up' THEN task_type_mapped := 'follow_up';
    WHEN 'contract' THEN task_type_mapped := 'general';
    WHEN 'technical' THEN task_type_mapped := 'general';
    WHEN 'other' THEN task_type_mapped := 'general';
    ELSE NULL; -- keep as-is
  END CASE;

  -- Ensure it's in the valid set
  IF task_type_mapped NOT IN ('call', 'email', 'meeting', 'follow_up', 'proposal', 'demo', 'general') THEN
    task_type_mapped := 'general';
  END IF;

  BEGIN
    -- Create task with company_id and contact_id from meeting
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
      completed
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
      NEW.completed
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

-- Re-create trigger to use updated function
DROP TRIGGER IF EXISTS trigger_auto_create_task_from_action_item ON meeting_action_items;
CREATE TRIGGER trigger_auto_create_task_from_action_item
  BEFORE INSERT ON meeting_action_items
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_task_from_action_item();

-- Backfill existing tasks with company_id and contact_id from their linked meetings
UPDATE tasks t
SET 
  company_id = m.company_id,
  contact_id = m.primary_contact_id,
  updated_at = NOW()
FROM meeting_action_items mai
JOIN meetings m ON m.id = mai.meeting_id
WHERE t.meeting_action_item_id = mai.id
  AND t.company_id IS NULL
  AND m.company_id IS NOT NULL;

COMMENT ON FUNCTION auto_create_task_from_action_item IS 'Auto-create CRM task from meeting action item with company/contact context and normalized category mapping';

