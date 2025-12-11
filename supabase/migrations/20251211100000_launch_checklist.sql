-- Launch Checklist Table
-- Tracks progress on launch tasks for platform admins

CREATE TABLE IF NOT EXISTS launch_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id TEXT UNIQUE NOT NULL, -- e.g., 'p0-free-tier-enforcement'
  category TEXT NOT NULL, -- 'p0', 'p1', 'p2', 'completed'
  title TEXT NOT NULL,
  description TEXT,
  effort_hours TEXT, -- e.g., '4-6h'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'blocked'
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES auth.users(id),
  notes TEXT,
  subtasks JSONB DEFAULT '[]', -- Array of {id, title, completed}
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX idx_launch_checklist_category ON launch_checklist_items(category);
CREATE INDEX idx_launch_checklist_status ON launch_checklist_items(status);

-- RLS policies
ALTER TABLE launch_checklist_items ENABLE ROW LEVEL SECURITY;

-- Platform admins can view all items
CREATE POLICY "Platform admins can view launch checklist"
  ON launch_checklist_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Platform admins can update items
CREATE POLICY "Platform admins can update launch checklist"
  ON launch_checklist_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Platform admins can insert items
CREATE POLICY "Platform admins can insert launch checklist"
  ON launch_checklist_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Insert initial checklist items
INSERT INTO launch_checklist_items (task_id, category, title, description, effort_hours, order_index, subtasks) VALUES
-- P0 Critical
('p0-free-tier-enforcement', 'p0', 'Free Tier Enforcement', 'Add 30-day historical limit + 15 new meeting limit in fathom-sync Edge Function', '4-6h', 1, '[
  {"id": "1", "title": "Add is_historical_import column to meetings table", "completed": false},
  {"id": "2", "title": "Add onboarding_completed_at to organizations table", "completed": false},
  {"id": "3", "title": "Create enforceFreeTierDateLimit() function", "completed": false},
  {"id": "4", "title": "Create checkNewMeetingLimit() function", "completed": false},
  {"id": "5", "title": "Add onboarding_fast sync type", "completed": false},
  {"id": "6", "title": "Add onboarding_background sync type", "completed": false},
  {"id": "7", "title": "Update SyncProgressStep.tsx for phased sync", "completed": false}
]'::jsonb),

('p0-encharge-integration', 'p0', 'Encharge.io Email Integration', 'Replace Resend with Encharge for all transactional and automation emails', '6-8h', 2, '[
  {"id": "1", "title": "Set ENCHARGE_API_KEY in Supabase secrets", "completed": false},
  {"id": "2", "title": "Create encharge-email Edge Function", "completed": false},
  {"id": "3", "title": "Create enchargeService.ts for frontend", "completed": false},
  {"id": "4", "title": "Update waitlistAdminService to use Encharge", "completed": false},
  {"id": "5", "title": "Add Encharge event triggers in AuthCallback", "completed": false},
  {"id": "6", "title": "Create Encharge email templates in Encharge UI", "completed": false}
]'::jsonb),

('p0-waitlist-verification', 'p0', 'Verify Waitlist → Account Flow', 'E2E test of admin release → email → account creation', '2-4h', 3, '[
  {"id": "1", "title": "Test admin releases waitlist user", "completed": false},
  {"id": "2", "title": "Verify email is received", "completed": false},
  {"id": "3", "title": "Verify magic link creates account", "completed": false},
  {"id": "4", "title": "Verify redirect to onboarding", "completed": false},
  {"id": "5", "title": "Document any fixes needed", "completed": false}
]'::jsonb),

('p0-stripe-webhooks', 'p0', 'Test Stripe Webhooks in Production', 'Verify all payment events are handled correctly', '2-3h', 4, '[
  {"id": "1", "title": "Test checkout.session.completed", "completed": false},
  {"id": "2", "title": "Test customer.subscription.updated", "completed": false},
  {"id": "3", "title": "Test customer.subscription.deleted", "completed": false},
  {"id": "4", "title": "Test invoice.payment_succeeded", "completed": false},
  {"id": "5", "title": "Test invoice.payment_failed", "completed": false},
  {"id": "6", "title": "Verify webhook signature validation", "completed": false}
]'::jsonb),

('p0-upgrade-gate', 'p0', 'Upgrade Gate for Historical Meetings', 'Show upgrade modal when users try to sync older meetings', '2-3h', 5, '[
  {"id": "1", "title": "Create HistoricalUpgradeGate.tsx component", "completed": false},
  {"id": "2", "title": "Add upgrade_required response to fathom-sync", "completed": false},
  {"id": "3", "title": "Integrate gate in MeetingsPage", "completed": false},
  {"id": "4", "title": "Test upgrade flow from gate to pricing", "completed": false}
]'::jsonb),

-- P1 Important
('p1-north-star-tracking', 'p1', 'North Star Activation Tracking', 'Track "First Summary Viewed" and other activation milestones', '6-8h', 1, '[
  {"id": "1", "title": "Add first_summary_viewed_at to user_onboarding_progress", "completed": false},
  {"id": "2", "title": "Create user_activation_events table", "completed": false},
  {"id": "3", "title": "Create activationTrackingService.ts", "completed": false},
  {"id": "4", "title": "Add tracking to MeetingDetail.tsx", "completed": false},
  {"id": "5", "title": "Add tracking to AuthCallback.tsx", "completed": false},
  {"id": "6", "title": "Connect to Encharge events", "completed": false}
]'::jsonb),

('p1-activation-dashboard', 'p1', 'Platform Admin Activation Dashboard', 'Visual funnel for user activation metrics', '4-6h', 2, '[
  {"id": "1", "title": "Create ActivationMetrics.tsx page", "completed": false},
  {"id": "2", "title": "Build activation funnel visualization", "completed": false},
  {"id": "3", "title": "Add time-to-activation metrics", "completed": false},
  {"id": "4", "title": "Add at-risk users view", "completed": false},
  {"id": "5", "title": "Add to platform navigation", "completed": false}
]'::jsonb),

('p1-usage-limit-emails', 'p1', 'Usage Limit Warning Emails', 'Email users when approaching 80% and 100% of meeting limits', '4h', 3, '[
  {"id": "1", "title": "Create usage-warning-80 Encharge template", "completed": false},
  {"id": "2", "title": "Create usage-limit-reached Encharge template", "completed": false},
  {"id": "3", "title": "Add usage check trigger in fathom-sync", "completed": false},
  {"id": "4", "title": "Test email delivery", "completed": false}
]'::jsonb),

('p1-trial-flows', 'p1', 'Verify Trial & Upgrade Flows', 'Test complete trial start to paid conversion', '4h', 4, '[
  {"id": "1", "title": "Test trial start without payment method", "completed": false},
  {"id": "2", "title": "Test trial → paid upgrade", "completed": false},
  {"id": "3", "title": "Verify subscription status updates", "completed": false},
  {"id": "4", "title": "Test downgrade/cancellation", "completed": false}
]'::jsonb),

('p1-usage-counter-ui', 'p1', 'Add Usage Counter to UI', 'Show "X of 15 meetings used" in dashboard', '2h', 5, '[
  {"id": "1", "title": "Add usage indicator to meetings page header", "completed": false},
  {"id": "2", "title": "Add usage to sidebar/navigation", "completed": false},
  {"id": "3", "title": "Style for low usage (green) vs high (yellow/red)", "completed": false}
]'::jsonb),

-- Completed items (already done)
('done-encharge-tracking', 'completed', 'Encharge Tracking Script', 'Added Encharge.io tracking script to index.html and created tracking service', '1h', 1, '[
  {"id": "1", "title": "Add script to index.html", "completed": true},
  {"id": "2", "title": "Add script to landing page", "completed": true},
  {"id": "3", "title": "Create enchargeTrackingService.ts", "completed": true}
]'::jsonb),

('done-launch-audit', 'completed', 'Launch Audit Document', 'Created comprehensive FIRST_USERS_LAUNCH_AUDIT.md', '2h', 2, '[
  {"id": "1", "title": "User journey analysis", "completed": true},
  {"id": "2", "title": "Features audit table", "completed": true},
  {"id": "3", "title": "Gap analysis", "completed": true},
  {"id": "4", "title": "Core KPI requirements mapping", "completed": true}
]'::jsonb);

-- Mark completed items as completed
UPDATE launch_checklist_items 
SET status = 'completed', completed_at = NOW()
WHERE category = 'completed';

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_launch_checklist_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER launch_checklist_updated_at
  BEFORE UPDATE ON launch_checklist_items
  FOR EACH ROW
  EXECUTE FUNCTION update_launch_checklist_updated_at();
