-- Add Client Call and Personal Link booking sources
-- These are commonly used sources for SavvyCal bookings

INSERT INTO booking_sources (name, api_name, description, category, icon, color, sort_order, is_active) VALUES
  ('Client Call', 'client_call', 'Direct client-initiated calls and meetings', 'direct', '📞', '#10B981', 15, true),
  ('Personal Link', 'personal_link', 'Personal booking links shared directly', 'direct', '🔗', '#6366F1', 16, true)
ON CONFLICT (name) DO NOTHING;

