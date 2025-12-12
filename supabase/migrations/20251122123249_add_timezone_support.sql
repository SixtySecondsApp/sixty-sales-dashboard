-- Add timezone support from Google Calendar integration
-- Timezone will be detected from user's Google Calendar and stored in user_settings.preferences
-- Uses IANA timezone strings (e.g., "Europe/London") which automatically handle daylight savings

-- Function to get timezone from Google Calendar integration
CREATE OR REPLACE FUNCTION get_user_timezone_from_calendar(p_user_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_timezone TEXT;
BEGIN
  -- Try to get timezone from calendar_calendars table (if stored there)
  SELECT timezone INTO v_timezone
  FROM calendar_calendars
  WHERE user_id = p_user_id
    AND external_id = 'primary'
    AND timezone IS NOT NULL
  LIMIT 1;
  
  IF v_timezone IS NOT NULL THEN
    RETURN v_timezone;
  END IF;
  
  -- Try to get from user_settings preferences
  SELECT (preferences->>'timezone')::TEXT INTO v_timezone
  FROM user_settings
  WHERE user_id = p_user_id
    AND preferences->>'timezone' IS NOT NULL;
  
  IF v_timezone IS NOT NULL THEN
    RETURN v_timezone;
  END IF;
  
  -- Try to get from profiles table (if exists)
  BEGIN
    SELECT timezone INTO v_timezone
    FROM profiles
    WHERE id = p_user_id
      AND timezone IS NOT NULL;
    
    IF v_timezone IS NOT NULL THEN
      RETURN v_timezone;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- profiles table or timezone column might not exist
    NULL;
  END;
  
  -- Default to Europe/London for UK users (can be updated based on user's location)
  RETURN 'Europe/London';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add timezone column to calendar_calendars if it doesn't exist
ALTER TABLE calendar_calendars 
  ADD COLUMN IF NOT EXISTS timezone TEXT;

-- Index for timezone queries
CREATE INDEX IF NOT EXISTS idx_calendar_calendars_timezone 
  ON calendar_calendars(user_id, timezone) 
  WHERE timezone IS NOT NULL;

-- Function to update user timezone preference
CREATE OR REPLACE FUNCTION update_user_timezone(
  p_user_id UUID,
  p_timezone TEXT
)
RETURNS VOID AS $$
BEGIN
  -- Update user_settings preferences
  INSERT INTO user_settings (user_id, preferences)
  VALUES (p_user_id, jsonb_build_object('timezone', p_timezone))
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    preferences = user_settings.preferences || jsonb_build_object('timezone', p_timezone),
    updated_at = NOW();
  
  -- Also update calendar_calendars if primary calendar exists
  UPDATE calendar_calendars
  SET timezone = p_timezone
  WHERE user_id = p_user_id
    AND external_id = 'primary';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments
COMMENT ON FUNCTION get_user_timezone_from_calendar IS 'Gets user timezone from calendar integration, user_settings, or profiles table. Defaults to Europe/London.';
COMMENT ON FUNCTION update_user_timezone IS 'Updates user timezone preference in user_settings and calendar_calendars';
COMMENT ON COLUMN calendar_calendars.timezone IS 'IANA timezone string (e.g., Europe/London) detected from Google Calendar. Automatically handles daylight savings.';



























