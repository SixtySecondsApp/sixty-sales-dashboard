# Relationship Health Monitor - Quick Start Guide

## ✅ Migrations Complete!

All 7 migrations have been successfully run. The Relationship Health Monitor is now ready to use!

---

## 🚀 Access the Feature

### Main Dashboard
Navigate directly to:
```
http://localhost:5173/crm/relationship-health
```

Or in production:
```
https://your-domain.com/crm/relationship-health
```

### From Contact/Company Profiles
- Open any contact: `/crm/contacts/[id]`
- Open any company: `/crm/companies/[id]`
- Look for **"Relationship Health"** widget in the right sidebar
- Click "Open Relationship Dashboard" for full details

---

## 🧪 Quick Test

### 1. Verify Templates Loaded

Go to `/crm/relationship-health` → Click **"Templates"** tab

You should see **9 intervention templates**:
- 6 core templates (Permission to Close, Value Add, Pattern Interrupt, etc.)
- 3 A/B variants

### 2. Test with Sample Data (Optional)

To see the feature with data, run this SQL in Supabase SQL Editor:

```sql
-- Get your user ID
SELECT id, email FROM auth.users WHERE email = 'your-email@example.com';

-- Get a contact ID
SELECT id, name FROM contacts LIMIT 1;

-- Insert test health score (replace USER_ID and CONTACT_ID)
INSERT INTO relationship_health_scores (
  user_id,
  relationship_type,
  contact_id,
  overall_health_score,
  health_status,
  risk_level,
  communication_frequency_score,
  response_behavior_score,
  engagement_quality_score,
  sentiment_score,
  meeting_pattern_score
) VALUES (
  'YOUR_USER_ID_HERE',
  'contact',
  'YOUR_CONTACT_ID_HERE',
  45,
  'at_risk',
  'high',
  50,
  40,
  45,
  50,
  48
)
RETURNING id;

-- Insert test ghost signal (use the ID returned above)
INSERT INTO ghost_detection_signals (
  relationship_health_id,
  user_id,
  signal_type,
  severity,
  signal_context,
  signal_data
) VALUES (
  'RELATIONSHIP_HEALTH_ID_FROM_ABOVE',
  'YOUR_USER_ID_HERE',
  'email_no_response',
  'high',
  'No response to 3 follow-up emails after proposal',
  '{"emails_sent": 3, "days_since_last_response": 14}'::jsonb
);
```

Then refresh the contact profile and dashboard to see the data!

---

## 📊 Dashboard Features

### Overview Tab
- Summary statistics (total relationships, health distribution)
- Intervention performance metrics
- At-risk alerts with one-click intervention sending

### At Risk Tab
- Focused view of relationships needing attention
- Ghost signal details
- Quick intervention deployment

### Templates Tab
- Browse all 9 intervention templates
- Filter by type or context
- View performance metrics
- Create custom templates
- Preview templates with sample data

### Analytics Tab
- Performance tracking (coming soon)
- Template effectiveness metrics
- Recovery rate analysis

---

## 🎯 Key Features

### 1. Health Scoring
- Multi-signal calculation (5 signals weighted)
- Health status badges (Healthy, At Risk, Critical, Ghost)
- Trend indicators (improving, stable, declining)

### 2. Ghost Detection
- 7 signal types detection
- Severity levels (low, medium, high, critical)
- Signal resolution tracking

### 3. Interventions
- Template selection (recommended + browse)
- Personalization field support
- Template preview with sample data
- One-click sending from profiles

### 4. Template Library
- 9 pre-built templates
- Filter by type
- Sort by performance/recent/name
- Create custom templates
- A/B variant management

---

## 🔍 Verification Queries

Run these in Supabase SQL Editor to verify everything is set up:

```sql
-- 1. Check all tables exist (should return 6 rows)
SELECT tablename FROM pg_tables
WHERE tablename IN (
  'relationship_health_scores',
  'ghost_detection_signals',
  'intervention_templates',
  'interventions',
  'communication_events',
  'relationship_health_history'
)
ORDER BY tablename;

-- 2. Check seed data (should return 9)
SELECT COUNT(*) as template_count FROM intervention_templates;

-- 3. List all templates
SELECT template_name, template_type, context_trigger 
FROM intervention_templates 
ORDER BY template_type, template_name;
```

---

## 📝 Next Steps

1. **Start Using:**
   - Navigate to `/crm/relationship-health`
   - Explore the dashboard tabs
   - Review the 9 intervention templates

2. **Add Data:**
   - Health scores populate automatically as communication events are tracked
   - For testing, insert sample data (see above)

3. **Customize:**
   - Create custom intervention templates
   - Set up A/B test variants
   - Monitor template performance

4. **Integrate:**
   - Connect email/calendar tracking (optional)
   - Enable automatic communication event logging
   - Set up notifications for critical alerts

---

## 🐛 Troubleshooting

### Dashboard Shows "No data available"
**Normal!** Health scores populate as communication events are tracked. Insert test data (see above) to see the feature in action.

### Templates Not Showing
Verify seed migration ran:
```sql
SELECT COUNT(*) FROM intervention_templates;
-- Should return 9
```

### Route Not Found
Ensure you're on the correct branch:
```bash
git branch --show-current
# Should show: claude/relationship-health-monitor-01NhMsrnwx8uHCZ856vixWyg
```

### Component Errors
Check browser console for errors. Ensure:
- All migrations ran successfully
- RLS policies are enabled
- User is authenticated

---

## 📚 Documentation

- **Setup Guide:** `SETUP_RELATIONSHIP_HEALTH.md`
- **User Guide:** `RELATIONSHIP_HEALTH_USER_GUIDE.md`
- **Migration Guide:** `RELATIONSHIP_HEALTH_MIGRATION_GUIDE.md`
- **Implementation Plan:** `RELATIONSHIP_HEALTH_IMPLEMENTATION_PLAN.md`
- **PR Description:** `PULL_REQUEST_DESCRIPTION.md`

---

## 🎉 You're All Set!

The Relationship Health Monitor is now live and ready to use. Start by exploring the dashboard and templates, then add test data to see it in action!

**Happy monitoring!** 🚀












