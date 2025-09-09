-- Function to create test notifications (bypasses RLS for testing)
-- This should only be used in development/testing environments
CREATE OR REPLACE FUNCTION public.create_test_notification(
  p_user_id UUID,
  p_title TEXT,
  p_message TEXT,
  p_type VARCHAR(20) DEFAULT 'info',
  p_category VARCHAR(50) DEFAULT NULL,
  p_action_url TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO public.notifications (
    user_id,
    title,
    message,
    type,
    category,
    action_url,
    metadata,
    read
  ) VALUES (
    p_user_id,
    p_title,
    p_message,
    p_type,
    p_category,
    p_action_url,
    p_metadata,
    FALSE
  ) RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to anon role for testing
GRANT EXECUTE ON FUNCTION public.create_test_notification(UUID, TEXT, TEXT, VARCHAR, VARCHAR, TEXT, JSONB) TO anon;

-- Create a simpler test function that generates test data
CREATE OR REPLACE FUNCTION public.create_sample_notifications()
RETURNS JSON AS $$
DECLARE
  v_user_id UUID;
  v_result JSON;
  v_created_count INTEGER := 0;
BEGIN
  -- Generate a random user ID for testing
  v_user_id := gen_random_uuid();
  
  -- Create sample notifications
  PERFORM public.create_test_notification(
    v_user_id,
    '🎉 Welcome to Notifications!',
    'Your in-app notification system is now active.',
    'success',
    'system',
    '/dashboard'
  );
  v_created_count := v_created_count + 1;
  
  PERFORM public.create_test_notification(
    v_user_id,
    '📈 New Deal Created',
    'A new deal worth $50,000 has been created in your pipeline.',
    'info',
    'deal',
    '/crm'
  );
  v_created_count := v_created_count + 1;
  
  PERFORM public.create_test_notification(
    v_user_id,
    '⚠️ Task Due Tomorrow',
    'You have 3 tasks due tomorrow. Click to view them.',
    'warning',
    'task',
    '/tasks'
  );
  v_created_count := v_created_count + 1;
  
  PERFORM public.create_test_notification(
    v_user_id,
    '✅ Workflow Completed',
    'Your automated workflow "Lead Nurture" completed successfully.',
    'success',
    'workflow',
    '/workflows'
  );
  v_created_count := v_created_count + 1;
  
  PERFORM public.create_test_notification(
    v_user_id,
    '❌ Payment Failed',
    'Unable to process payment for subscription. Please update payment method.',
    'error',
    'billing',
    '/settings/billing'
  );
  v_created_count := v_created_count + 1;
  
  PERFORM public.create_test_notification(
    v_user_id,
    '👥 New Team Member',
    'Sarah Johnson has joined your team as Sales Manager.',
    'info',
    'team',
    '/team'
  );
  v_created_count := v_created_count + 1;
  
  -- Return result
  v_result := json_build_object(
    'success', true,
    'user_id', v_user_id,
    'notifications_created', v_created_count,
    'message', 'Test notifications created successfully. User ID: ' || v_user_id::TEXT
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to anon role for testing
GRANT EXECUTE ON FUNCTION public.create_sample_notifications() TO anon;

-- Add comment explaining these are for testing only
COMMENT ON FUNCTION public.create_test_notification IS 'Testing function to create notifications bypassing RLS. Should only be used in development.';
COMMENT ON FUNCTION public.create_sample_notifications IS 'Creates sample notifications for testing the notification system.';