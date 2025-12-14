-- Fix accept_next_action_suggestion to validate task_type against constraints
-- Issue: action_type from suggestions may not match valid task_type enum values

CREATE OR REPLACE FUNCTION accept_next_action_suggestion(
  p_suggestion_id UUID,
  p_task_data JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_suggestion RECORD;
  v_task_id UUID;
  v_task_title TEXT;
  v_task_description TEXT;
  v_task_due_date TIMESTAMPTZ;
  v_task_priority TEXT;
  v_task_type TEXT;
BEGIN
  -- Get suggestion
  SELECT * INTO v_suggestion
  FROM next_action_suggestions
  WHERE id = p_suggestion_id
    AND user_id = auth.uid()
    AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Suggestion not found or already processed';
  END IF;

  -- Prepare task data (allow overrides from p_task_data)
  v_task_title := COALESCE(
    p_task_data->>'title',
    v_suggestion.title
  );

  v_task_description := COALESCE(
    p_task_data->>'description',
    'AI Suggestion: ' || v_suggestion.reasoning
  );

  v_task_due_date := COALESCE(
    (p_task_data->>'due_date')::TIMESTAMPTZ,
    v_suggestion.recommended_deadline
  );

  v_task_priority := COALESCE(
    p_task_data->>'priority',
    CASE v_suggestion.urgency
      WHEN 'high' THEN 'urgent'
      WHEN 'medium' THEN 'high'
      WHEN 'low' THEN 'medium'
      ELSE 'medium'
    END
  );

  -- FIXED: Validate and map action_type to valid task_type
  -- Valid task types: call, email, meeting, follow_up, proposal, demo, general
  v_task_type := CASE
    WHEN v_suggestion.action_type IN ('call', 'email', 'meeting', 'follow_up', 'proposal', 'demo', 'general')
      THEN v_suggestion.action_type
    -- Map common variations to valid types
    WHEN v_suggestion.action_type ILIKE '%call%' OR v_suggestion.action_type ILIKE '%phone%' THEN 'call'
    WHEN v_suggestion.action_type ILIKE '%email%' OR v_suggestion.action_type ILIKE '%send%' THEN 'email'
    WHEN v_suggestion.action_type ILIKE '%meeting%' OR v_suggestion.action_type ILIKE '%schedule%' OR v_suggestion.action_type ILIKE '%demo%' THEN 'meeting'
    WHEN v_suggestion.action_type ILIKE '%follow%' THEN 'follow_up'
    WHEN v_suggestion.action_type ILIKE '%proposal%' OR v_suggestion.action_type ILIKE '%quote%' THEN 'proposal'
    -- Default to general for anything else
    ELSE 'general'
  END;

  RAISE NOTICE 'Mapping action_type "%" to task_type "%"', v_suggestion.action_type, v_task_type;

  -- Create task with CORRECT column names and validated task_type
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
    deal_id,
    contact_id,
    notes
  ) VALUES (
    v_task_title,
    v_task_description,
    v_task_due_date,
    v_task_priority,
    'pending',
    v_task_type,              -- FIXED: Use validated task_type
    v_suggestion.user_id,     -- assigned_to
    v_suggestion.user_id,     -- created_by (same user)
    v_suggestion.company_id,
    v_suggestion.deal_id,
    v_suggestion.contact_id,
    'Created from AI suggestion (confidence: ' || ROUND(v_suggestion.confidence_score * 100) || '%)'
  )
  RETURNING id INTO v_task_id;

  -- Update suggestion
  UPDATE next_action_suggestions
  SET
    created_task_id = v_task_id,
    status = 'accepted',
    accepted_at = NOW()
  WHERE id = p_suggestion_id;

  RETURN v_task_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION accept_next_action_suggestion(UUID, JSONB) TO authenticated;

COMMENT ON FUNCTION accept_next_action_suggestion IS 'Accept an AI suggestion and create a task. Validates and maps action_type to valid task_type enum values.';
