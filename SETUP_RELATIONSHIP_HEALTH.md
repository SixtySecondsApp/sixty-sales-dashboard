# Relationship Health Monitor - Setup & Migration Guide

## 🚀 Quick Start

This guide will help you set up and run the Relationship Health Monitor feature.

---

## 📋 Prerequisites

- ✅ Node.js 18+ installed
- ✅ Access to Supabase dashboard
- ✅ Database admin privileges
- ✅ Git repository cloned and branch checked out

---

## 🔧 Step 1: Verify Branch & Dependencies

```bash
# Ensure you're on the correct branch
git branch
# Should show: claude/relationship-health-monitor-01NhMsrnwx8uHCZ856vixWyg

# Install dependencies (if needed)
npm install
```

---

## 🗄️ Step 2: Run Database Migrations

**⚠️ CRITICAL:** All 7 migrations must be run **IN ORDER** for the feature to work.

### Migration Files (in execution order):

1. `20251122000001_create_relationship_health_scores.sql`
2. `20251122000002_create_ghost_detection_signals.sql`
3. `20251122000003_create_intervention_templates.sql`
4. `20251122000004_create_interventions.sql`
5. `20251122000005_create_communication_events.sql`
6. `20251122000006_create_relationship_health_history.sql`
7. `20251122000007_seed_intervention_templates.sql` (seeds 9 templates)

### Method 1: Supabase Dashboard (Recommended)

1. **Access Supabase Dashboard:**
   - Go to https://app.supabase.io
   - Select your project: `sixty-sales-dashboard`
   - Click **"SQL Editor"** in the left sidebar

2. **Execute Each Migration:**
   - Click **"New Query"**
   - Open migration file: `supabase/migrations/20251122000001_create_relationship_health_scores.sql`
   - Copy **ALL** contents
   - Paste into SQL Editor
   - Click **"Run"** (or press `Cmd/Ctrl + Enter`)
   - Wait for success: `Success. No rows returned`

3. **Repeat for Migrations 2-6:**
   - Execute each migration file in order (000001 → 000007)
   - **DO NOT SKIP ANY MIGRATION**
   - Wait for each to complete before starting the next

4. **Execute Seed Data (Migration 7):**
   - Run `20251122000007_seed_intervention_templates.sql`
   - Expected result: `Success. 9 rows returned`

### Method 2: Supabase CLI

```bash
# Install Supabase CLI (if not installed)
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project (get project-ref from Supabase dashboard URL)
supabase link --project-ref YOUR_PROJECT_REF

# Push all migrations
supabase db push

# Or run migrations individually
supabase db execute --file supabase/migrations/20251122000001_create_relationship_health_scores.sql
supabase db execute --file supabase/migrations/20251122000002_create_ghost_detection_signals.sql
supabase db execute --file supabase/migrations/20251122000003_create_intervention_templates.sql
supabase db execute --file supabase/migrations/20251122000004_create_interventions.sql
supabase db execute --file supabase/migrations/20251122000005_create_communication_events.sql
supabase db execute --file supabase/migrations/20251122000006_create_relationship_health_history.sql
supabase db execute --file supabase/migrations/20251122000007_seed_intervention_templates.sql
```

### Method 3: Direct PostgreSQL Connection

```bash
# Connect via psql
psql postgres://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres

# Execute each migration
\i /full/path/to/supabase/migrations/20251122000001_create_relationship_health_scores.sql
\i /full/path/to/supabase/migrations/20251122000002_create_ghost_detection_signals.sql
\i /full/path/to/supabase/migrations/20251122000003_create_intervention_templates.sql
\i /full/path/to/supabase/migrations/20251122000004_create_interventions.sql
\i /full/path/to/supabase/migrations/20251122000005_create_communication_events.sql
\i /full/path/to/supabase/migrations/20251122000006_create_relationship_health_history.sql
\i /full/path/to/supabase/migrations/20251122000007_seed_intervention_templates.sql
```

---

## ✅ Step 3: Verify Migrations

Run these SQL queries in Supabase SQL Editor to verify:

### Check Tables Exist:

```sql
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
```

**Expected:** 6 tables listed

### Check Seed Data:

```sql
SELECT COUNT(*) as template_count, 
       COUNT(DISTINCT template_type) as type_count
FROM intervention_templates;
```

**Expected:** `template_count: 9`, `type_count: 5`

### Check RLS Policies:

```sql
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE tablename IN (
  'relationship_health_scores',
  'ghost_detection_signals',
  'intervention_templates',
  'interventions',
  'communication_events',
  'relationship_health_history'
);
```

**Expected:** All tables should have `rowsecurity = true`

---

## 🚀 Step 4: Start Development Server

```bash
# Start the dev server
npm run dev

# Server should start on http://localhost:5173 (or your configured port)
```

---

## 🧪 Step 5: Test the Feature

### A. Access Main Dashboard

1. Navigate to: **`http://localhost:5173/crm/relationship-health`**
2. Verify dashboard loads with tabs:
   - Overview
   - At Risk
   - Templates
   - Analytics

### B. Test Profile Integration

1. Navigate to any contact: `/crm/contacts/[CONTACT_ID]`
2. Look for **"Relationship Health"** widget in right sidebar
3. Should show "No health data available" for new contacts
4. Verify "Open Relationship Dashboard" link works

### C. Test Template Library

1. Go to `/crm/relationship-health`
2. Click **"Templates"** tab
3. Verify **9 templates** are visible
4. Try filtering by type
5. Click **"Preview"** on a template
6. Try creating a new template

### D. Test with Mock Data (Optional)

To see the feature with data, insert test records:

```sql
-- Get your user ID
SELECT id, email FROM auth.users LIMIT 1;

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

-- Insert test ghost signal (replace RELATIONSHIP_HEALTH_ID from above)
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

Now refresh the contact profile and dashboard to see data!

---

## 📍 Routes Available

After setup, these routes are available:

- **Main Dashboard:** `/crm/relationship-health`
- **Contact Profile:** `/crm/contacts/[id]` (widget in sidebar)
- **Company Profile:** `/crm/companies/[id]` (widget in sidebar)

---

## 🐛 Troubleshooting

### Error: "relation already exists"

**Solution:** Tables may already exist. Check what's there:
```sql
SELECT tablename FROM pg_tables WHERE tablename LIKE '%relationship%';
```

Either drop existing tables (see Rollback section) or skip that migration.

### Error: "foreign key constraint violation"

**Solution:** Migrations executed out of order. Rollback and re-run in correct order.

### Error: "permission denied"

**Solution:** 
- Ensure you're using service_role key (not anon key)
- Check user has CREATE TABLE permissions
- Contact Supabase support if needed

### Dashboard Shows "No data available"

**Solution:** This is normal! Health scores populate as communication events are tracked. Insert test data (see Step 5D) to see the feature in action.

### Templates Not Showing

**Solution:** Verify seed migration ran successfully:
```sql
SELECT COUNT(*) FROM intervention_templates;
-- Should return 9
```

---

## 🔄 Rollback Instructions

If you need to remove the feature:

```sql
-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS relationship_health_history CASCADE;
DROP TABLE IF EXISTS communication_events CASCADE;
DROP TABLE IF EXISTS interventions CASCADE;
DROP TABLE IF EXISTS intervention_templates CASCADE;
DROP TABLE IF EXISTS ghost_detection_signals CASCADE;
DROP TABLE IF EXISTS relationship_health_scores CASCADE;
```

---

## 📚 Additional Documentation

- **User Guide:** `RELATIONSHIP_HEALTH_USER_GUIDE.md`
- **Migration Guide:** `RELATIONSHIP_HEALTH_MIGRATION_GUIDE.md`
- **Implementation Plan:** `RELATIONSHIP_HEALTH_IMPLEMENTATION_PLAN.md`
- **PR Description:** `PULL_REQUEST_DESCRIPTION.md`

---

## ✅ Success Checklist

After setup, verify:

- [ ] All 6 tables created successfully
- [ ] 9 intervention templates seeded
- [ ] RLS policies enabled on all tables
- [ ] Dashboard loads at `/crm/relationship-health`
- [ ] Profile widgets display on contact/company pages
- [ ] Template library shows 9 templates
- [ ] No console errors in browser
- [ ] Test data inserts successfully

---

## 🎉 You're Ready!

The Relationship Health Monitor is now set up and ready to use. Health scores will populate automatically as communication events are tracked through your CRM.

**Next Steps:**
1. Integrate email/calendar tracking (optional)
2. Start using interventions on at-risk relationships
3. Monitor template performance
4. Customize templates for your use case

---

**Questions?** Check the documentation files listed above or review the PR description.











