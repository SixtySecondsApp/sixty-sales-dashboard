# Waitlist Points System Implementation

## Overview
The waitlist now uses a **points-based system** where users move up in line based on total points earned, not just referral count.

## Points Structure

### How to Earn Points
- **Email Referral**: 5 points per friend who joins
- **LinkedIn Share**: 50 points (one-time boost)
- **Total Range**: 0-87 points

### Example Combinations
- 0 referrals + 0 LinkedIn = **0 points**
- 3 referrals + 0 LinkedIn = **15 points**
- 0 referrals + 1 LinkedIn = **50 points**
- 7 referrals + 1 LinkedIn = **85 points** (35 + 50)
- 17 referrals + 0 LinkedIn = **85 points** (max without LinkedIn)
- 7 referrals + 1 LinkedIn = **85 points** (practical max)

## Database Schema

### New Columns
- `total_points` (INTEGER): Total points earned (auto-calculated)
- `linkedin_boost_claimed` (BOOLEAN): Whether user claimed 50-point LinkedIn boost

### Position Formula
```sql
effective_position = GREATEST(1, signup_position - total_points)
```

### Auto-Calculation Trigger
Database automatically recalculates `total_points` and `effective_position` when:
- `referral_count` changes
- `linkedin_boost_claimed` changes
- `signup_position` changes

## Implementation Files

### 1. Database Migration
**File**: `/supabase/ADD_POINTS_SYSTEM.sql`
- Adds `total_points` column
- Creates `calculate_total_points()` function
- Sets up auto-calculation trigger
- Backfills existing entries

**Run this first** to add the points system to your existing data.

### 2. Seeding Script
**File**: `/supabase/RESEED_WITH_POINTS.sql`
- Deletes fake entries (keeps real users)
- Resets real user positions
- Seeds 263 fake users with points distribution:
  - **60%**: 0-15 points (0-3 referrals, no LinkedIn)
  - **20%**: 16-35 points (4-7 referrals)
  - **13%**: 36-60 points (LinkedIn + some referrals)
  - **7%**: 61-87 points (LinkedIn + many referrals)

**Run this second** to populate the leaderboard with realistic data.

### 3. TypeScript Types
**File**: `/src/lib/types/waitlist.ts`
- Added `total_points?: number`
- Added `linkedin_boost_claimed?: boolean`

### 4. UI Component Updates
**File**: `/src/product-pages/meetings/components/gamification/PositionDisplay.tsx`
- Shows **Total Points** prominently (emerald color)
- Shows **Referrals** count (blue color)
- Displays on user's success page after signup

## User Experience

### What Users See After Signup

**Position Card** shows:
```
┌─────────────────────────────────────┐
│  Rank #45                           │
│  🏆 Priority Tier                   │
│                                     │
│  ┌─────────────┬─────────────┐     │
│  │ 65          │ 13          │     │
│  │ TOTAL POINTS│ REFERRALS   │     │
│  └─────────────┴─────────────┘     │
│                                     │
│  ✓ 50% launch discount             │
│  ✓ Priority onboarding             │
└─────────────────────────────────────┘
```

### Points Breakdown Examples

**Example 1**: User with LinkedIn + 3 referrals
- LinkedIn share: +50 points
- 3 email referrals: +15 points
- **Total**: 65 points
- Moves up 65 positions

**Example 2**: User with 10 referrals
- 10 email referrals: +50 points
- No LinkedIn: +0 points
- **Total**: 50 points
- Moves up 50 positions

**Example 3**: User with LinkedIn + 7 referrals
- LinkedIn share: +50 points
- 7 email referrals: +35 points
- **Total**: 85 points (near max!)
- Moves up 85 positions

## Verification Queries

### Check Points Distribution
```sql
SELECT
  CASE
    WHEN total_points = 0 THEN '0 points'
    WHEN total_points BETWEEN 1 AND 15 THEN '1-15 points'
    WHEN total_points BETWEEN 16 AND 30 THEN '16-30 points'
    WHEN total_points BETWEEN 31 AND 50 THEN '31-50 points'
    WHEN total_points BETWEEN 51 AND 70 THEN '51-70 points'
    ELSE '71-87 points'
  END as point_range,
  COUNT(*) as user_count
FROM meetings_waitlist
GROUP BY point_range
ORDER BY MIN(total_points);
```

### View Top Performers
```sql
SELECT
  full_name,
  signup_position,
  effective_position,
  referral_count,
  linkedin_boost_claimed,
  total_points,
  signup_position - effective_position as positions_moved
FROM meetings_waitlist
ORDER BY total_points DESC
LIMIT 10;
```

## Migration Steps

### For Existing Waitlist

1. **Run ADD_POINTS_SYSTEM.sql**
   ```sql
   -- Adds total_points column and triggers
   -- Backfills existing data
   ```

2. **Run RESEED_WITH_POINTS.sql**
   ```sql
   -- Clears fake data
   -- Reseeds with points distribution
   ```

3. **Verify Installation**
   ```sql
   -- Check that total_points column exists
   SELECT column_name, data_type
   FROM information_schema.columns
   WHERE table_name = 'meetings_waitlist'
     AND column_name = 'total_points';
   ```

## Points System Benefits

### For Users
- **Clear progression**: See exactly how many points they have
- **Multiple paths**: Can focus on referrals OR LinkedIn OR both
- **Fair system**: LinkedIn share (50 pts) = 10 referrals worth of effort
- **Motivation**: Big reward for LinkedIn share encourages viral growth

### For Business
- **Viral growth**: LinkedIn shares reach wider audience (50 points = worth it!)
- **Quality referrals**: Email referrals are warm leads from trusted sources
- **Gamification**: Points are more intuitive than "referral count"
- **Balanced incentives**: Both activities rewarded appropriately

## Technical Notes

### Database Trigger Logic
```sql
-- Auto-calculates on every change
total_points = (referral_count * 5) + (linkedin_boost_claimed ? 50 : 0)
effective_position = MAX(1, signup_position - total_points)
```

### Real-time Updates
- When user gets referral → `referral_count` increases → trigger recalculates `total_points` → position updates
- When user claims LinkedIn → `linkedin_boost_claimed` = true → trigger adds 50 points → position jumps

### Performance
- Index on `total_points` for fast leaderboard queries
- Index on `effective_position` for position lookups
- Trigger is BEFORE INSERT/UPDATE so no additional query needed

## Future Enhancements

### Potential Add-ons
- **Twitter/X share**: +25 points
- **Email signature**: +10 points
- **Blog post**: +100 points
- **Video testimonial**: +200 points
- **Early adopter milestone**: Bonus points for being in top 100

### Point Multipliers
- **Streak bonus**: Daily shares = 2x points
- **Quality referrals**: If referral converts → 2x points
- **Team referrals**: Refer entire team → bonus points

## Support

For questions or issues with the points system:
1. Check database trigger is installed: `SELECT * FROM pg_trigger WHERE tgname = 'calculate_points_trigger'`
2. Verify column exists: `\d meetings_waitlist` (shows total_points column)
3. Test calculation: Update a test user's referral_count and check total_points updates automatically
