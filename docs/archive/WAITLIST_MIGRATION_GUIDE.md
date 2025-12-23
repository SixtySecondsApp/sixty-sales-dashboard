# Waitlist Points & Position Fix - Migration Guide

## Overview

This guide explains how to apply the waitlist gamification fixes that resolve the issues where:
- ✅ All users showing position #1 (multiple users with same position)
- ✅ All users showing 0 points or incorrect point values
- ✅ Point calculation using wrong formula (5 points per referral instead of 50)

## What Was Fixed

### Database Changes
1. **Migration 003**: Added missing gamification columns (`total_points`, boost tracking fields)
2. **Migration 004**: Fixed point calculation formula (50 points per referral, not 5)
3. **Migration 005**: Created `waitlist_with_rank` view to handle position ties

### Code Changes
1. **TypeScript Types**: Added `display_rank` field to `WaitlistEntry` interface
2. **Admin Service**: Updated to use `waitlist_with_rank` view for proper ranking
3. **Public Components**: Already correctly configured, will work once migrations run

## How to Apply Migrations

### Step 1: Run Database Migrations

Navigate to your Supabase project and run these migrations in order:

**Option A: Using Supabase CLI**
```bash
# Navigate to project root
cd /Users/andrewbryce/Documents/sixty-sales-dashboard

# Run migrations
supabase db push

# Or run individual migrations if needed
supabase db push --file supabase/migrations/20251202000003_add_waitlist_gamification.sql
supabase db push --file supabase/migrations/20251202000004_fix_waitlist_points_calculation.sql
supabase db push --file supabase/migrations/20251202000005_add_waitlist_display_rank.sql
```

**Option B: Using Supabase Dashboard**
1. Go to: https://supabase.com/dashboard/project/YOUR_PROJECT_ID/sql/new
2. Copy and paste each migration file content
3. Execute them in order (003 → 004 → 005)

### Step 2: Verify Migrations Worked

Run this SQL query in Supabase SQL Editor:

```sql
-- Check that all columns exist and data is correct
SELECT
  full_name,
  signup_position,
  effective_position,
  display_rank,
  referral_count,
  total_points,
  linkedin_boost_claimed,
  twitter_boost_claimed,
  is_seeded,
  created_at
FROM waitlist_with_rank
ORDER BY display_rank ASC
LIMIT 20;
```

**Expected Results:**
- ✅ `display_rank` column exists and shows unique values (1, 2, 3, 4, ...)
- ✅ `total_points` shows correct values based on formula:
  - Base: `referral_count × 50`
  - LinkedIn boost: +100 points
  - Twitter boost: +100 points
  - LinkedIn share: +25 points
  - Position bonuses: +500 (top 10), +200 (top 50), +100 (top 100)
- ✅ Users with same `effective_position` have different `display_rank` (ordered by `created_at`)
- ✅ Seeded users can be filtered with `is_seeded` flag

### Step 3: Test Point Calculation Examples

**Example 1: User with 2 referrals**
```
Referrals: 2 × 50 = 100 points
Expected total_points: 100 (base) + any bonuses
```

**Example 2: User with 2 referrals + LinkedIn boost + Position #5**
```
Referrals: 2 × 50 = 100 points
LinkedIn boost: +100 points
Position bonus (top 10): +500 points
Expected total_points: 700
```

**Example 3: User with 0 referrals at Position #1**
```
Referrals: 0 × 50 = 0 points
Position bonus (top 10): +500 points
Expected total_points: 500
```

## Verification Checklist

### Database Verification
- [ ] Run migration 003 successfully (adds gamification columns)
- [ ] Run migration 004 successfully (fixes point calculation)
- [ ] Run migration 005 successfully (creates ranking view)
- [ ] Verify `waitlist_with_rank` view exists
- [ ] Check that `display_rank` shows unique sequential values

### Point Calculation Verification
- [ ] Users with referrals show correct points (referral_count × 50 + bonuses)
- [ ] Users with 0 referrals show only bonus points (position/social bonuses)
- [ ] Margaret Adams (2 referrals) shows ~100+ points instead of 10
- [ ] Users with boosts show +100 points per boost
- [ ] Top 10 users show +500 position bonus

### Position Ranking Verification
- [ ] No multiple users at position #1 (unless truly tied in effective_position)
- [ ] Ties in `effective_position` are broken by `display_rank`
- [ ] Earlier signups win position ties (lower `display_rank`)
- [ ] Admin table shows proper sequential ordering

### UI Verification
- [ ] Admin table at `/admin/smart-tasks` shows correct positions and points
- [ ] Public waitlist success page shows correct position and points
- [ ] Leaderboard shows correct point totals
- [ ] Real-time updates work correctly
- [ ] Stats cards exclude seeded users when filter is checked

## Troubleshooting

### Issue: Migrations fail to run

**Solution**: Check for existing columns/functions
```sql
-- Check if columns already exist
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'meetings_waitlist'
  AND column_name IN ('total_points', 'linkedin_boost_claimed', 'twitter_boost_claimed');

-- Check if view already exists
SELECT * FROM information_schema.views WHERE table_name = 'waitlist_with_rank';
```

If columns/view exist, migrations may have partially run. Drop and recreate:
```sql
-- Drop view if exists
DROP VIEW IF EXISTS waitlist_with_rank;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS calculate_points_trigger ON meetings_waitlist;
DROP FUNCTION IF EXISTS calculate_waitlist_points();

-- Then re-run migrations
```

### Issue: Points still showing as 0 or incorrect

**Solution**: Force recalculation
```sql
-- Trigger point recalculation for all users
UPDATE meetings_waitlist
SET updated_at = NOW()
WHERE total_points IS NULL OR total_points = 0;
```

### Issue: Multiple users still at position #1

**Solution**: Verify the view is being used
```sql
-- Check if display_rank is unique
SELECT display_rank, COUNT(*)
FROM waitlist_with_rank
GROUP BY display_rank
HAVING COUNT(*) > 1;

-- Should return 0 rows (all display_ranks are unique)
```

If you see duplicates, the view may not be working correctly. Check the view definition:
```sql
SELECT pg_get_viewdef('waitlist_with_rank'::regclass, true);
```

### Issue: Real-time updates not working

**Solution**: Verify Supabase real-time is enabled
```sql
-- Enable real-time for the table
ALTER PUBLICATION supabase_realtime ADD TABLE meetings_waitlist;
```

## Point Calculation Formula Reference

```typescript
// Base formula
total_points = (referral_count × 50)
  + (linkedin_boost_claimed ? 100 : 0)
  + (twitter_boost_claimed ? 100 : 0)
  + (linkedin_share_claimed ? 25 : 0)
  + position_bonus

// Position bonuses
if (effective_position <= 10) {
  position_bonus = 500
} else if (effective_position <= 50) {
  position_bonus = 200
} else if (effective_position <= 100) {
  position_bonus = 100
} else {
  position_bonus = 0
}
```

## Files Modified

### Database Migrations (NEW)
- `/supabase/migrations/20251202000003_add_waitlist_gamification.sql`
- `/supabase/migrations/20251202000004_fix_waitlist_points_calculation.sql`
- `/supabase/migrations/20251202000005_add_waitlist_display_rank.sql`

### TypeScript Types (MODIFIED)
- `/src/lib/types/waitlist.ts` - Added `display_rank?: number` field

### Services (MODIFIED)
- `/src/lib/services/waitlistService.ts` - Now queries `waitlist_with_rank` view

### Components (ALREADY CORRECT)
- `/src/components/platform/waitlist/EnhancedWaitlistTable.tsx` - Will display correct data
- `/src/product-pages/meetings/components/WaitlistSuccess.tsx` - Will show correct position/points
- `/src/product-pages/meetings/components/gamification/PositionDisplay.tsx` - Will display correctly
- `/src/product-pages/meetings/components/gamification/Leaderboard.tsx` - Already orders by points

## Support

If you encounter issues after running migrations:

1. Check the troubleshooting section above
2. Verify all three migrations ran successfully
3. Check Supabase logs for any errors
4. Run the verification SQL query to check data integrity
5. Test with a new signup to ensure triggers work for new entries

## Next Steps

After migrations are applied and verified:

1. ✅ Test admin table sorting and filtering
2. ✅ Test public waitlist position display
3. ✅ Test leaderboard point rankings
4. ✅ Verify real-time updates work
5. ✅ Test seeded user filtering
6. ✅ Monitor for any edge cases or issues

---

**Migration Status**: Ready to apply
**Estimated Time**: 2-5 minutes
**Risk Level**: Low (migrations are idempotent and include rollback safety)
