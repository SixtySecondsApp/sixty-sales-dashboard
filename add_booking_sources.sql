-- Add Client Call and Personal Link booking sources
-- Run this in Supabase SQL Editor to add the sources immediately

INSERT INTO booking_sources (name, description, category, icon, color, sort_order, is_active) VALUES
  ('Client Call', 'Direct client-initiated calls and meetings', 'direct', '📞', '#10B981', 15, true),
  ('Personal Link', 'Personal booking links shared directly', 'direct', '🔗', '#6366F1', 16, true)
ON CONFLICT (name) DO NOTHING;

-- Verify the sources were added
SELECT 
  name, 
  description, 
  category, 
  icon, 
  color, 
  sort_order, 
  is_active
FROM booking_sources 
WHERE name IN ('Client Call', 'Personal Link')
ORDER BY sort_order;

