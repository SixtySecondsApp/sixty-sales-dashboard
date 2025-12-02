# Waitlist Gamification - Database Migration Guide

## 🎯 Overview

This guide walks you through applying the database migrations needed for the gamified waitlist success experience.

## 📋 Prerequisites

- Access to your Supabase Dashboard
- SQL Editor permissions
- The `meetings_waitlist` table already exists in your database

## 🚀 Migration Steps

### Step 1: Fix Missing Columns (CRITICAL - Run First)

**File:** `ADD_MISSING_COLUMNS.sql`

**Purpose:** Adds three missing columns to the existing `meetings_waitlist` table
- `dialer_other` - For "Other" dialer tool responses
- `meeting_recorder_other` - For "Other" meeting recorder responses
- `crm_other` - For "Other" CRM tool responses

**Instructions:**
1. Open Supabase Dashboard → SQL Editor
2. Copy the contents of `ADD_MISSING_COLUMNS.sql`
3. Paste into SQL Editor
4. Click **Run**
5. Verify success - you should see output showing which columns were added

**Expected Output:**
```
NOTICE: Added column: dialer_other
NOTICE: Added column: meeting_recorder_other
NOTICE: Added column: crm_other
```

**Result:** The waitlist signup form will now work correctly without schema errors.

---

### Step 2: Add Share Tracking (Run Second)

**File:** `ADD_SHARE_TRACKING.sql`

**Purpose:** Creates the `waitlist_shares` table for viral growth analytics
- Tracks which platforms users share to (Twitter, LinkedIn, Email, Copy)
- Measures click-through and conversion rates
- Provides aggregate statistics via `get_share_stats()` function

**Instructions:**
1. Open Supabase Dashboard → SQL Editor
2. Copy the contents of `ADD_SHARE_TRACKING.sql`
3. Paste into SQL Editor
4. Click **Run**
5. Verify success - you should see "Success. No rows returned"

**What Gets Created:**
- `waitlist_shares` table with RLS policies
- Indexes for performance optimization
- `get_share_stats(entry_id)` helper function
- Public insert permissions for analytics tracking
- User view permissions for their own shares
- Admin view/update permissions for all shares

**Result:** Share tracking will be fully operational with analytics.

---

## ✅ Verification

After running both migrations, verify everything works:

### Test 1: Check Columns Exist
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'meetings_waitlist'
AND column_name IN ('dialer_other', 'meeting_recorder_other', 'crm_other')
ORDER BY column_name;
```

**Expected:** 3 rows showing all three columns as `text` type

### Test 2: Check Share Tracking Table
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_name = 'waitlist_shares';
```

**Expected:** 1 row showing `waitlist_shares` table exists

### Test 3: Test Share Stats Function
```sql
-- This should return zero stats for a non-existent entry
SELECT * FROM get_share_stats('00000000-0000-0000-0000-000000000000');
```

**Expected:** 1 row with all zeros (no shares yet)

---

## 🎮 What This Enables

After running these migrations, your waitlist will have:

✅ **Working Signup Form** - All tool preference fields functional
✅ **Share Tracking** - Analytics for Twitter, LinkedIn, Email, Copy
✅ **Viral Metrics** - Click-through and conversion rate tracking
✅ **Real-time Updates** - Supabase subscriptions for live position changes
✅ **Gamification** - 3-tier system, achievements, leaderboard, live feed
✅ **Mobile Experience** - Swipeable achievement carousel

---

## 🔄 Rollback (If Needed)

### Rollback Step 2 (Share Tracking)
```sql
DROP TABLE IF EXISTS waitlist_shares CASCADE;
DROP FUNCTION IF EXISTS get_share_stats(UUID);
```

### Rollback Step 1 (Missing Columns)
```sql
ALTER TABLE meetings_waitlist DROP COLUMN IF EXISTS dialer_other;
ALTER TABLE meetings_waitlist DROP COLUMN IF EXISTS meeting_recorder_other;
ALTER TABLE meetings_waitlist DROP COLUMN IF EXISTS crm_other;
```

**Note:** Only rollback Step 1 if you have no existing data, as it will delete any values in those columns.

---

## 🐛 Troubleshooting

### Error: "relation meetings_waitlist does not exist"
**Problem:** The main waitlist table hasn't been created yet
**Solution:** Run `RUN_THIS_MANUALLY.sql` first to create the base table

### Error: "column already exists"
**Problem:** Columns were already added in a previous run
**Solution:** This is safe to ignore - the migration is idempotent

### Error: "permission denied for table profiles"
**Problem:** RLS policies reference `profiles` table that doesn't exist
**Solution:** Either:
- Remove admin RLS policies (lines 75-97 in `ADD_SHARE_TRACKING.sql`)
- Or create a `profiles` table with `is_admin` column first

### Share tracking not working
**Problem:** RLS policies might be blocking inserts
**Solution:** Verify RLS policy with:
```sql
SELECT * FROM pg_policies WHERE tablename = 'waitlist_shares';
```

---

## 📊 Post-Migration Testing

1. **Test Signup Form**
   - Go to `/product/meetings/waitlist`
   - Fill out the form with "Other" selected for tools
   - Submit and verify no errors
   - Check success screen appears

2. **Test Share Tracking**
   - Click "Copy" button on success screen
   - Verify no console errors
   - Check database: `SELECT * FROM waitlist_shares ORDER BY shared_at DESC LIMIT 5;`
   - Should see your share record

3. **Test Real-time Updates**
   - Keep success screen open
   - In another tab, update your referral count in database
   - Verify position updates automatically on screen

---

## 🎉 Success!

Once both migrations are complete and tests pass, your gamified waitlist is fully operational! Users can now:
- Sign up with full tool preferences
- Share their referral links
- Track their position in real-time
- Unlock achievements
- Compete on the leaderboard
- See live activity feed

**All 14 implementation tasks are complete!** 🚀
