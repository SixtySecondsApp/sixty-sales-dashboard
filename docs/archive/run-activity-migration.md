# EditActivityForm Database Migration Guide

## 📋 Migration Overview

The enhanced EditActivityForm requires new database columns to support:
- **Outbound Type**: Email, LinkedIn, Call selection
- **Proposal Date**: Date tracking for proposals  
- **Meeting Flags**: Rebooking and self-generated tracking
- **Sale Date**: Separate sale date tracking

## 🚀 Running the Migration

### Option 1: Supabase CLI (Recommended)
```bash
# Navigate to project directory
cd /Users/andrewbryce/Documents/sixty-sales-dashboard

# Run the migration
supabase db push

# Or run specific migration
supabase migration up --include-all
```

### Option 2: Supabase Dashboard
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of:
   `/supabase/migrations/20250901_enhance_activities_with_form_fields.sql`
4. Click **Run** to execute the migration

### Option 3: Direct SQL Execution
```sql
-- Copy and run this in your database:
ALTER TABLE activities 
ADD COLUMN IF NOT EXISTS outbound_type TEXT CHECK (outbound_type IN ('email', 'linkedin', 'call')),
ADD COLUMN IF NOT EXISTS proposal_date DATE,
ADD COLUMN IF NOT EXISTS is_rebooking BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_self_generated BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS sale_date DATE;
```

## ✅ Migration Verification

After running the migration, verify it worked:

```sql
-- Check new columns exist
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'activities' 
  AND column_name IN ('outbound_type', 'proposal_date', 'is_rebooking', 'is_self_generated', 'sale_date');
```

Expected output:
- `outbound_type` | text | NULL
- `proposal_date` | date | NULL  
- `is_rebooking` | boolean | false
- `is_self_generated` | boolean | false
- `sale_date` | date | NULL

## 🎯 What This Migration Adds

### New Columns:
1. **`outbound_type`**: Tracks Email/LinkedIn/Call outbound activities
2. **`proposal_date`**: Records when proposals were sent
3. **`is_rebooking`**: Flags rescheduled meetings for analytics
4. **`is_self_generated`**: Tracks self-generated meetings for sales rep recognition
5. **`sale_date`**: Captures actual sale completion date

### Database Features:
- ✅ **Data Validation**: Ensures outbound activities have outbound_type
- ✅ **Performance Indexes**: Optimized queries for new fields
- ✅ **Data Integrity**: Automatic cleanup of irrelevant fields
- ✅ **RLS Security**: Existing row-level security covers new columns

## 🔄 No Data Loss

This migration is **safe** and **non-destructive**:
- All existing data is preserved
- New columns are nullable and have defaults
- Validation only applies to new/updated records
- Rollback is possible if needed

## 🛠️ TypeScript Updates

The TypeScript interfaces have been updated automatically:
- ✅ `Activity` interface in `useActivities.ts`
- ✅ `EditFormData` type in `EditActivityForm.tsx`
- ✅ Form state management updated

## 🧪 Testing After Migration

1. **Create Test Activities**: Try each activity type with new fields
2. **Edit Existing Activities**: Ensure backward compatibility  
3. **Form Validation**: Test outbound type requirements
4. **Data Persistence**: Verify new fields save correctly

## 🔙 Rollback (If Needed)

If you need to rollback the migration:

```sql
-- Remove new columns (CAUTION: This will delete data)
ALTER TABLE activities 
DROP COLUMN IF EXISTS outbound_type,
DROP COLUMN IF EXISTS proposal_date,
DROP COLUMN IF EXISTS is_rebooking,
DROP COLUMN IF EXISTS is_self_generated,
DROP COLUMN IF EXISTS sale_date;

-- Drop validation function
DROP TRIGGER IF EXISTS validate_outbound_activity_trigger ON activities;
DROP FUNCTION IF EXISTS validate_outbound_activity();
```

---

**Ready to run the migration? Choose your preferred method above and execute!** 🚀