-- ============================================================================
-- Migration: Add Sales Assistant Slack Notification Feature
-- ============================================================================
-- Add the 'sales_assistant' feature to slack_notification_settings for orgs
-- ============================================================================

-- Insert default sales_assistant notification settings for existing connected orgs
INSERT INTO slack_notification_settings (org_id, feature, is_enabled, delivery_method)
SELECT 
  sos.org_id,
  'sales_assistant',
  true, -- Enabled by default
  'dm' -- DM delivery for sales assistant
FROM slack_org_settings sos
WHERE sos.is_connected = true
  AND NOT EXISTS (
    SELECT 1 FROM slack_notification_settings sns
    WHERE sns.org_id = sos.org_id AND sns.feature = 'sales_assistant'
  )
ON CONFLICT (org_id, feature) DO NOTHING;

-- ============================================================================
-- Ensure ghost_detection_signals has is_active column (may be missing)
-- ============================================================================
DO $$
BEGIN
  -- Add is_active if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ghost_detection_signals' 
    AND column_name = 'is_active'
  ) THEN
    ALTER TABLE ghost_detection_signals ADD COLUMN is_active BOOLEAN DEFAULT true;
  END IF;
END $$;

-- ============================================================================
-- Ensure deal_risk_signals has is_active column (may be missing)
-- ============================================================================
DO $$
BEGIN
  -- Add is_active if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'deal_risk_signals' 
    AND column_name = 'is_active'
  ) THEN
    ALTER TABLE deal_risk_signals ADD COLUMN is_active BOOLEAN DEFAULT true;
  END IF;
END $$;

-- ============================================================================
-- Create indexes safely (only if columns exist)
-- ============================================================================
DO $$
BEGIN
  -- Ghost detection indexes
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ghost_detection_signals' 
    AND column_name = 'is_active'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_ghost_detection_user_active 
      ON ghost_detection_signals(user_id, is_active) WHERE is_active = true;
  END IF;
  
  -- Deal risk indexes
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'deal_risk_signals' 
    AND column_name = 'is_active'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_deal_risk_user_active 
      ON deal_risk_signals(user_id, is_active) WHERE is_active = true;
  END IF;
END $$;

-- ============================================================================
-- Verification
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE 'Sales assistant notification migration completed ✓';
END;
$$;

