# Relationship Health Monitor - Database Migration Guide

## 📋 Overview

This guide provides step-by-step instructions for executing the database migrations required for the Relationship Health Monitor feature.

**Total Migrations:** 7 files
**Estimated Execution Time:** 5-10 minutes
**Database:** PostgreSQL via Supabase
**Rollback Support:** Yes (instructions included)

---

## ⚠️ Pre-Migration Checklist

Before executing migrations, ensure:

- [ ] You have admin access to Supabase dashboard
- [ ] Database backup has been created (recommended)
- [ ] No other migrations are currently running
- [ ] Production traffic is at normal/low levels
- [ ] You have reviewed all migration files in `/supabase/migrations/`

---

## 🗂️ Migration Files

All migration files are located in: `/supabase/migrations/`

### Execution Order:

```
1. 20251122000001_create_relationship_health_scores.sql
2. 20251122000002_create_ghost_detection_signals.sql
3. 20251122000003_create_intervention_templates.sql
4. 20251122000004_create_interventions.sql
5. 20251122000005_create_communication_events.sql
6. 20251122000006_create_relationship_health_history.sql
7. 20251122000007_seed_intervention_templates.sql
```

**Important:** Migrations must be executed in this exact order due to foreign key dependencies.

---

## 🚀 Migration Execution Methods

### Method 1: Supabase Dashboard (Recommended)

**Step-by-Step:**

1. **Access SQL Editor:**
   - Log in to Supabase dashboard
   - Navigate to project: `sixty-sales-dashboard`
   - Click "SQL Editor" in left sidebar

2. **Execute Migration 1:**
   - Click "New Query"
   - Copy contents of `20251122000001_create_relationship_health_scores.sql`
   - Paste into SQL editor
   - Click "Run" (or press Ctrl/Cmd + Enter)
   - Verify success message: "Success. No rows returned"

3. **Execute Migrations 2-6:**
   - Repeat step 2 for each migration file in order
   - Wait for each migration to complete before starting next
   - Verify success after each execution

4. **Execute Seed Data:**
   - Run migration 7: `20251122000007_seed_intervention_templates.sql`
   - Verify: "Success. 9 rows returned" (9 template rows inserted)

5. **Verify Tables Created:**
   - Navigate to "Table Editor" in left sidebar
   - Confirm these tables exist:
     - `relationship_health_scores`
     - `ghost_detection_signals`
     - `intervention_templates`
     - `interventions`
     - `communication_events`
     - `relationship_health_history`

### Method 2: Supabase CLI

**Prerequisites:**
```bash
npm install -g supabase
supabase login
supabase link --project-ref <your-project-ref>
```

**Execute Migrations:**
```bash
# Run all pending migrations
supabase db push

# Or run migrations manually
supabase db execute --file supabase/migrations/20251122000001_create_relationship_health_scores.sql
supabase db execute --file supabase/migrations/20251122000002_create_ghost_detection_signals.sql
supabase db execute --file supabase/migrations/20251122000003_create_intervention_templates.sql
supabase db execute --file supabase/migrations/20251122000004_create_interventions.sql
supabase db execute --file supabase/migrations/20251122000005_create_communication_events.sql
supabase db execute --file supabase/migrations/20251122000006_create_relationship_health_history.sql
supabase db execute --file supabase/migrations/20251122000007_seed_intervention_templates.sql
```

### Method 3: Direct PostgreSQL Connection

**Connect via psql:**
```bash
psql postgres://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```

**Execute Migrations:**
```sql
-- Execute each migration file
\i /path/to/supabase/migrations/20251122000001_create_relationship_health_scores.sql
\i /path/to/supabase/migrations/20251122000002_create_ghost_detection_signals.sql
\i /path/to/supabase/migrations/20251122000003_create_intervention_templates.sql
\i /path/to/supabase/migrations/20251122000004_create_interventions.sql
\i /path/to/supabase/migrations/20251122000005_create_communication_events.sql
\i /path/to/supabase/migrations/20251122000006_create_relationship_health_history.sql
\i /path/to/supabase/migrations/20251122000007_seed_intervention_templates.sql
```

---

## ✅ Post-Migration Verification

### 1. Verify Table Structure

**Check relationship_health_scores:**
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'relationship_health_scores'
ORDER BY ordinal_position;
```

**Expected columns (20 total):**
- id, user_id, relationship_type, contact_id, company_id
- overall_health_score, health_status, health_trend
- communication_frequency_score, response_behavior_score
- engagement_quality_score, sentiment_score, meeting_pattern_score
- days_since_last_contact, baseline_contact_frequency_days
- baseline_response_time_hours, last_calculated_at
- metadata, created_at, updated_at

### 2. Verify Seed Data

**Check intervention templates:**
```sql
SELECT template_name, template_type, is_control_variant
FROM intervention_templates
ORDER BY created_at;
```

**Expected output:** 9 templates
- 6 core templates (permission_to_close, value_add, pattern_interrupt, soft_checkin, channel_switch)
- 3 A/B variants

### 3. Verify RLS Policies

**Check Row Level Security enabled:**
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

### 4. Verify Indexes

**Check critical indexes exist:**
```sql
SELECT tablename, indexname
FROM pg_indexes
WHERE tablename IN (
  'relationship_health_scores',
  'ghost_detection_signals',
  'communication_events'
)
ORDER BY tablename, indexname;
```

**Expected indexes:**
- relationship_health_scores: indexes on (user_id, contact_id, company_id, health_status, last_calculated_at)
- ghost_detection_signals: indexes on (relationship_health_id, signal_type, severity, resolved_at)
- communication_events: indexes on (contact_id, user_id, event_type, event_timestamp)

### 5. Test Basic Operations

**Insert test health score:**
```sql
-- Note: Replace [USER_ID] and [CONTACT_ID] with real values
INSERT INTO relationship_health_scores (
  user_id,
  relationship_type,
  contact_id,
  overall_health_score,
  health_status
) VALUES (
  '[USER_ID]',
  'contact',
  '[CONTACT_ID]',
  75,
  'healthy'
)
RETURNING id;
```

**Query test data:**
```sql
SELECT * FROM relationship_health_scores
WHERE user_id = '[USER_ID]'
LIMIT 1;
```

**Clean up test data:**
```sql
DELETE FROM relationship_health_scores
WHERE user_id = '[USER_ID]'
AND overall_health_score = 75;
```

---

## 🔄 Rollback Instructions

### Full Rollback (Remove All Tables)

**⚠️ WARNING:** This will delete all relationship health data!

```sql
-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS relationship_health_history CASCADE;
DROP TABLE IF EXISTS communication_events CASCADE;
DROP TABLE IF EXISTS interventions CASCADE;
DROP TABLE IF EXISTS intervention_templates CASCADE;
DROP TABLE IF EXISTS ghost_detection_signals CASCADE;
DROP TABLE IF EXISTS relationship_health_scores CASCADE;
```

### Partial Rollback (Remove Seed Data Only)

```sql
-- Remove all seeded templates
DELETE FROM intervention_templates
WHERE template_name IN (
  'Permission to Close - After Proposal',
  'Permission to Close - After Demo',
  'Permission to Close - Long Silence',
  'Permission to Close - Variant A',
  'Permission to Close - Variant B',
  'Value Add - Industry Insights',
  'Pattern Interrupt - Quick Question',
  'Soft Check-in - No Pressure',
  'Channel Switch - LinkedIn'
);
```

### Recreate After Rollback

If you need to rollback and recreate:

1. Execute full rollback (drop all tables)
2. Re-run migrations 1-7 in order
3. Verify using post-migration checks above

---

## 🐛 Troubleshooting

### Error: "relation already exists"

**Cause:** Migration was partially executed or tables already exist

**Solution:**
```sql
-- Check what tables exist
SELECT tablename FROM pg_tables
WHERE tablename LIKE '%relationship%'
   OR tablename LIKE '%intervention%'
   OR tablename LIKE '%ghost%'
   OR tablename LIKE '%communication%';

-- Either drop existing tables (see Rollback) or skip that migration
```

### Error: "foreign key constraint violation"

**Cause:** Migrations executed out of order

**Solution:**
1. Execute full rollback
2. Re-run migrations in correct order (1-7)

### Error: "permission denied"

**Cause:** Insufficient database privileges

**Solution:**
- Ensure you're using service_role key (not anon key)
- Check user has CREATE TABLE permissions
- Contact Supabase support if using hosted version

### Error: "syntax error near..."

**Cause:** Migration file corrupted or incompletely copied

**Solution:**
1. Re-copy migration file from source
2. Verify file encoding is UTF-8
3. Check for special characters in copy/paste

### Slow Migration Execution

**Cause:** Large existing dataset or database under load

**Solution:**
- Execute migrations during off-peak hours
- Monitor database CPU/memory in Supabase dashboard
- Contact support if execution time exceeds 10 minutes

---

## 📊 Expected Table Sizes

After migration (with seed data only):

| Table | Rows | Approx Size |
|-------|------|-------------|
| relationship_health_scores | 0 | < 100 KB |
| ghost_detection_signals | 0 | < 100 KB |
| intervention_templates | 9 | < 50 KB |
| interventions | 0 | < 100 KB |
| communication_events | 0 | < 100 KB |
| relationship_health_history | 0 | < 100 KB |

**Total:** < 500 KB

After 30 days of production use (estimated):

| Table | Rows | Approx Size |
|-------|------|-------------|
| relationship_health_scores | ~500 | ~500 KB |
| ghost_detection_signals | ~1,000 | ~1 MB |
| intervention_templates | ~15 | ~100 KB |
| interventions | ~200 | ~300 KB |
| communication_events | ~10,000 | ~15 MB |
| relationship_health_history | ~15,000 | ~20 MB |

**Total:** ~40 MB

---

## 🔐 Security Considerations

### Row Level Security (RLS)

All tables have RLS enabled with policies:
- Users can only access their own data (user_id match)
- Service role bypasses RLS for system operations
- Public schema for read access to templates

### Sensitive Data

These fields may contain sensitive information:
- `communication_events.body` - Email/message content
- `communication_events.subject` - Email subjects
- `intervention_templates.template_body` - Template text
- `interventions.personalized_content` - Sent message content

**Recommendations:**
- Ensure database backups are encrypted
- Restrict access to production database
- Log all direct database access
- Consider data retention policies

---

## 📈 Performance Optimization

### Recommended After Migration

**1. Analyze Tables:**
```sql
ANALYZE relationship_health_scores;
ANALYZE ghost_detection_signals;
ANALYZE communication_events;
ANALYZE interventions;
```

**2. Update Statistics:**
```sql
VACUUM ANALYZE;
```

**3. Monitor Query Performance:**
```sql
-- Enable slow query logging
ALTER DATABASE postgres SET log_min_duration_statement = 1000;

-- Check for missing indexes after 1 week
SELECT schemaname, tablename, attname, n_distinct, correlation
FROM pg_stats
WHERE tablename IN ('relationship_health_scores', 'communication_events')
ORDER BY correlation;
```

---

## 📞 Support

### Migration Issues
- Check Supabase dashboard for error logs
- Review this guide's troubleshooting section
- Contact: Database Administrator

### Supabase Support
- Dashboard: https://app.supabase.io/project/[PROJECT-ID]
- Docs: https://supabase.com/docs
- Community: https://github.com/supabase/supabase/discussions

---

## ✅ Migration Completion Checklist

After successful migration, verify:

- [ ] All 6 tables created successfully
- [ ] 9 intervention templates seeded
- [ ] RLS policies enabled on all tables
- [ ] Indexes created successfully
- [ ] Test insert/query executed successfully
- [ ] No errors in Supabase logs
- [ ] Application can connect to new tables
- [ ] Health score calculation runs without errors
- [ ] Template selection returns results

**Sign-off:**
- Migration executed by: _______________
- Date: _______________
- Time: _______________
- Environment: [ ] Development [ ] Staging [ ] Production
- Issues encountered: _______________
- Resolution: _______________

---

**Version:** 1.0
**Last Updated:** November 22, 2025
**For Support:** Contact Database Administrator
