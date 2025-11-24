-- Enhanced Calendar Schema Migration
-- Adds full-text search, recurring events, conflict tracking, and audit trail
-- Created: 2025-11-22

-- =====================================================
-- 1. ADD FULL-TEXT SEARCH SUPPORT
-- =====================================================

-- Add GIN index for full-text search on calendar events
CREATE INDEX IF NOT EXISTS idx_calendar_events_search
ON calendar_events
USING gin(to_tsvector('english',
  COALESCE(title, '') || ' ' ||
  COALESCE(description, '') || ' ' ||
  COALESCE(location, '')
));

-- Add search helper function
CREATE OR REPLACE FUNCTION search_calendar_events(
  p_user_id UUID,
  p_search_query TEXT,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL,
  p_calendar_id TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL
)
RETURNS SETOF calendar_events
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT ce.*
  FROM calendar_events ce
  WHERE ce.user_id = p_user_id
    AND (
      p_search_query IS NULL
      OR to_tsvector('english',
          COALESCE(ce.title, '') || ' ' ||
          COALESCE(ce.description, '') || ' ' ||
          COALESCE(ce.location, '')
        ) @@ plainto_tsquery('english', p_search_query)
    )
    AND (p_start_date IS NULL OR ce.start_time >= p_start_date)
    AND (p_end_date IS NULL OR ce.end_time <= p_end_date)
    AND (p_calendar_id IS NULL OR ce.calendar_id = p_calendar_id)
    AND (p_category IS NULL OR ce.category = p_category)
  ORDER BY
    ts_rank(
      to_tsvector('english',
        COALESCE(ce.title, '') || ' ' ||
        COALESCE(ce.description, '')
      ),
      plainto_tsquery('english', p_search_query)
    ) DESC,
    ce.start_time ASC;
END;
$$;

-- =====================================================
-- 2. RECURRING EVENTS SUPPORT
-- =====================================================

-- Add recurring event columns to calendar_events if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'calendar_events' AND column_name = 'rrule'
  ) THEN
    ALTER TABLE calendar_events ADD COLUMN rrule TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'calendar_events' AND column_name = 'recurrence_id'
  ) THEN
    ALTER TABLE calendar_events ADD COLUMN recurrence_id TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'calendar_events' AND column_name = 'is_recurring'
  ) THEN
    ALTER TABLE calendar_events ADD COLUMN is_recurring BOOLEAN DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'calendar_events' AND column_name = 'parent_event_id'
  ) THEN
    ALTER TABLE calendar_events ADD COLUMN parent_event_id UUID REFERENCES calendar_events(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create table for recurring event patterns
CREATE TABLE IF NOT EXISTS calendar_recurring_patterns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_event_id UUID NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  rrule TEXT NOT NULL,
  exception_dates TIMESTAMPTZ[],
  until_date TIMESTAMPTZ,
  count INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_recurring_pattern UNIQUE (parent_event_id)
);

-- Add index for recurring pattern lookups
CREATE INDEX IF NOT EXISTS idx_recurring_patterns_parent
ON calendar_recurring_patterns(parent_event_id);

-- Add RLS policies for recurring patterns
ALTER TABLE calendar_recurring_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own recurring patterns"
ON calendar_recurring_patterns FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM calendar_events
    WHERE calendar_events.id = calendar_recurring_patterns.parent_event_id
    AND calendar_events.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert their own recurring patterns"
ON calendar_recurring_patterns FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM calendar_events
    WHERE calendar_events.id = calendar_recurring_patterns.parent_event_id
    AND calendar_events.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own recurring patterns"
ON calendar_recurring_patterns FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM calendar_events
    WHERE calendar_events.id = calendar_recurring_patterns.parent_event_id
    AND calendar_events.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their own recurring patterns"
ON calendar_recurring_patterns FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM calendar_events
    WHERE calendar_events.id = calendar_recurring_patterns.parent_event_id
    AND calendar_events.user_id = auth.uid()
  )
);

-- =====================================================
-- 3. CONFLICT DETECTION SYSTEM
-- =====================================================

-- Create table for event conflicts
CREATE TABLE IF NOT EXISTS calendar_event_conflicts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id_1 UUID NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  event_id_2 UUID NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  conflict_type TEXT NOT NULL CHECK (conflict_type IN ('overlap', 'double_booking', 'partial')),
  overlap_start TIMESTAMPTZ NOT NULL,
  overlap_end TIMESTAMPTZ NOT NULL,
  severity TEXT DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high')),
  resolved BOOLEAN DEFAULT FALSE,
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,

  CONSTRAINT unique_conflict UNIQUE (event_id_1, event_id_2),
  CONSTRAINT different_events CHECK (event_id_1 != event_id_2)
);

-- Add indexes for conflict lookups
CREATE INDEX IF NOT EXISTS idx_conflicts_user ON calendar_event_conflicts(user_id);
CREATE INDEX IF NOT EXISTS idx_conflicts_event1 ON calendar_event_conflicts(event_id_1);
CREATE INDEX IF NOT EXISTS idx_conflicts_event2 ON calendar_event_conflicts(event_id_2);
CREATE INDEX IF NOT EXISTS idx_conflicts_unresolved ON calendar_event_conflicts(user_id, resolved) WHERE resolved = FALSE;

-- Add RLS policies for conflicts
ALTER TABLE calendar_event_conflicts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own conflicts"
ON calendar_event_conflicts FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own conflicts"
ON calendar_event_conflicts FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own conflicts"
ON calendar_event_conflicts FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own conflicts"
ON calendar_event_conflicts FOR DELETE
USING (user_id = auth.uid());

-- Function to detect conflicts for a given time range
CREATE OR REPLACE FUNCTION detect_event_conflicts(
  p_user_id UUID,
  p_event_id UUID,
  p_start_time TIMESTAMPTZ,
  p_end_time TIMESTAMPTZ
)
RETURNS TABLE (
  conflicting_event_id UUID,
  title TEXT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  conflict_type TEXT,
  overlap_start TIMESTAMPTZ,
  overlap_end TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ce.id,
    ce.title,
    ce.start_time,
    ce.end_time,
    CASE
      WHEN ce.start_time = p_start_time AND ce.end_time = p_end_time THEN 'double_booking'
      WHEN ce.start_time >= p_start_time AND ce.end_time <= p_end_time THEN 'overlap'
      WHEN ce.start_time < p_start_time AND ce.end_time > p_end_time THEN 'overlap'
      ELSE 'partial'
    END::TEXT as conflict_type,
    GREATEST(ce.start_time, p_start_time) as overlap_start,
    LEAST(ce.end_time, p_end_time) as overlap_end
  FROM calendar_events ce
  WHERE ce.user_id = p_user_id
    AND ce.id != COALESCE(p_event_id, '00000000-0000-0000-0000-000000000000'::UUID)
    AND ce.start_time < p_end_time
    AND ce.end_time > p_start_time
    AND ce.status != 'cancelled'
  ORDER BY ce.start_time;
END;
$$;

-- Trigger to automatically detect and store conflicts
CREATE OR REPLACE FUNCTION auto_detect_conflicts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_conflict RECORD;
BEGIN
  -- Only check for conflicts on INSERT or UPDATE
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    -- Delete old conflicts for this event
    DELETE FROM calendar_event_conflicts
    WHERE event_id_1 = NEW.id OR event_id_2 = NEW.id;

    -- Detect and insert new conflicts
    FOR v_conflict IN
      SELECT * FROM detect_event_conflicts(
        NEW.user_id,
        NEW.id,
        NEW.start_time,
        NEW.end_time
      )
    LOOP
      INSERT INTO calendar_event_conflicts (
        user_id,
        event_id_1,
        event_id_2,
        conflict_type,
        overlap_start,
        overlap_end,
        severity
      ) VALUES (
        NEW.user_id,
        LEAST(NEW.id, v_conflict.conflicting_event_id),
        GREATEST(NEW.id, v_conflict.conflicting_event_id),
        v_conflict.conflict_type,
        v_conflict.overlap_start,
        v_conflict.overlap_end,
        CASE
          WHEN v_conflict.conflict_type = 'double_booking' THEN 'high'
          WHEN v_conflict.conflict_type = 'overlap' THEN 'medium'
          ELSE 'low'
        END
      )
      ON CONFLICT (event_id_1, event_id_2) DO NOTHING;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for automatic conflict detection
DROP TRIGGER IF EXISTS trigger_auto_detect_conflicts ON calendar_events;
CREATE TRIGGER trigger_auto_detect_conflicts
  AFTER INSERT OR UPDATE OF start_time, end_time ON calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION auto_detect_conflicts();

-- =====================================================
-- 4. AUDIT TRAIL SYSTEM
-- =====================================================

-- Create table for event history/audit trail
CREATE TABLE IF NOT EXISTS calendar_event_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES calendar_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  change_type TEXT NOT NULL CHECK (change_type IN ('created', 'updated', 'deleted', 'moved', 'cancelled')),
  changes JSONB,
  old_values JSONB,
  new_values JSONB,
  changed_by UUID REFERENCES auth.users(id),
  ip_address INET,
  user_agent TEXT,
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for history lookups
CREATE INDEX IF NOT EXISTS idx_history_event ON calendar_event_history(event_id);
CREATE INDEX IF NOT EXISTS idx_history_user ON calendar_event_history(user_id);
CREATE INDEX IF NOT EXISTS idx_history_changed_at ON calendar_event_history(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_history_change_type ON calendar_event_history(change_type);

-- Add RLS policies for history
ALTER TABLE calendar_event_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own event history"
ON calendar_event_history FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "System can insert event history"
ON calendar_event_history FOR INSERT
WITH CHECK (true);

-- Function to log event changes
CREATE OR REPLACE FUNCTION log_event_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_change_type TEXT;
  v_changes JSONB;
  v_old_values JSONB;
  v_new_values JSONB;
BEGIN
  -- Determine change type
  IF TG_OP = 'INSERT' THEN
    v_change_type := 'created';
    v_new_values := to_jsonb(NEW);
    v_old_values := NULL;
    v_changes := v_new_values;
  ELSIF TG_OP = 'UPDATE' THEN
    v_change_type := 'updated';
    v_old_values := to_jsonb(OLD);
    v_new_values := to_jsonb(NEW);

    -- Calculate what changed
    v_changes := jsonb_object_agg(
      key,
      jsonb_build_object(
        'old', v_old_values->key,
        'new', v_new_values->key
      )
    ) FROM (
      SELECT key
      FROM jsonb_each(v_new_values)
      WHERE v_new_values->key IS DISTINCT FROM v_old_values->key
        AND key NOT IN ('updated_at', 'synced_at')
    ) changes(key);
  ELSIF TG_OP = 'DELETE' THEN
    v_change_type := 'deleted';
    v_old_values := to_jsonb(OLD);
    v_new_values := NULL;
    v_changes := v_old_values;
  END IF;

  -- Insert audit log
  INSERT INTO calendar_event_history (
    event_id,
    user_id,
    change_type,
    changes,
    old_values,
    new_values,
    changed_by
  ) VALUES (
    COALESCE(NEW.id, OLD.id),
    COALESCE(NEW.user_id, OLD.user_id),
    v_change_type,
    v_changes,
    v_old_values,
    v_new_values,
    auth.uid()
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create trigger for audit logging
DROP TRIGGER IF EXISTS trigger_log_event_change ON calendar_events;
CREATE TRIGGER trigger_log_event_change
  AFTER INSERT OR UPDATE OR DELETE ON calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION log_event_change();

-- =====================================================
-- 5. PERFORMANCE INDEXES
-- =====================================================

-- Add additional performance indexes
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_date
ON calendar_events(user_id, start_time DESC);

CREATE INDEX IF NOT EXISTS idx_calendar_events_date_range
ON calendar_events(start_time, end_time);

CREATE INDEX IF NOT EXISTS idx_calendar_events_status
ON calendar_events(user_id, status) WHERE status != 'cancelled';

CREATE INDEX IF NOT EXISTS idx_calendar_events_recurring
ON calendar_events(user_id, is_recurring) WHERE is_recurring = TRUE;

-- =====================================================
-- 6. HELPER FUNCTIONS
-- =====================================================

-- Function to get available time slots
CREATE OR REPLACE FUNCTION get_available_time_slots(
  p_user_id UUID,
  p_date DATE,
  p_start_hour INTEGER DEFAULT 9,
  p_end_hour INTEGER DEFAULT 17,
  p_slot_duration_minutes INTEGER DEFAULT 30
)
RETURNS TABLE (
  slot_start TIMESTAMPTZ,
  slot_end TIMESTAMPTZ,
  is_available BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_time TIMESTAMPTZ;
  v_end_time TIMESTAMPTZ;
  v_has_conflict BOOLEAN;
BEGIN
  v_current_time := (p_date + (p_start_hour || ' hours')::INTERVAL)::TIMESTAMPTZ;
  v_end_time := (p_date + (p_end_hour || ' hours')::INTERVAL)::TIMESTAMPTZ;

  WHILE v_current_time < v_end_time LOOP
    -- Check if this slot conflicts with any existing event
    SELECT EXISTS (
      SELECT 1 FROM calendar_events
      WHERE user_id = p_user_id
        AND start_time < v_current_time + (p_slot_duration_minutes || ' minutes')::INTERVAL
        AND end_time > v_current_time
        AND status != 'cancelled'
    ) INTO v_has_conflict;

    slot_start := v_current_time;
    slot_end := v_current_time + (p_slot_duration_minutes || ' minutes')::INTERVAL;
    is_available := NOT v_has_conflict;

    RETURN NEXT;

    v_current_time := v_current_time + (p_slot_duration_minutes || ' minutes')::INTERVAL;
  END LOOP;
END;
$$;

-- Function to mark conflict as resolved
CREATE OR REPLACE FUNCTION resolve_conflict(p_conflict_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE calendar_event_conflicts
  SET resolved = TRUE,
      resolved_at = NOW()
  WHERE id = p_conflict_id
    AND user_id = auth.uid();
END;
$$;

-- =====================================================
-- 7. UPDATE EXISTING DATA
-- =====================================================

-- Mark existing events as non-recurring
UPDATE calendar_events
SET is_recurring = FALSE
WHERE is_recurring IS NULL;

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

-- Grant execute permissions on functions to authenticated users
GRANT EXECUTE ON FUNCTION search_calendar_events TO authenticated;
GRANT EXECUTE ON FUNCTION detect_event_conflicts TO authenticated;
GRANT EXECUTE ON FUNCTION get_available_time_slots TO authenticated;
GRANT EXECUTE ON FUNCTION resolve_conflict TO authenticated;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

COMMENT ON TABLE calendar_recurring_patterns IS 'Stores recurring event patterns using RRULE format';
COMMENT ON TABLE calendar_event_conflicts IS 'Tracks detected conflicts between overlapping events';
COMMENT ON TABLE calendar_event_history IS 'Audit trail for all event changes';
COMMENT ON FUNCTION search_calendar_events IS 'Full-text search for calendar events with filters';
COMMENT ON FUNCTION detect_event_conflicts IS 'Detects time conflicts for a given event';
COMMENT ON FUNCTION get_available_time_slots IS 'Returns available time slots for a given date';
COMMENT ON FUNCTION resolve_conflict IS 'Marks a conflict as resolved';
