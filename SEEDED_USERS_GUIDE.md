# Seeded Users Management Guide

## Overview

The seeded users system allows you to flag fake/demo users in the waitlist while keeping them visible for social proof on the public waitlist. Seeded users are hidden by default in the admin view but can be toggled on/off.

## Features Implemented

### 1. Database Schema
- **New field**: `is_seeded` (boolean, default: false)
- **Migration**: `20251202000001_add_seeded_flag_to_waitlist.sql`
- **Indexed**: For efficient filtering

### 2. Admin UI Features

#### Filter Controls (EnhancedWaitlistTable)
- **Checkbox**: "Hide seeded users" (default: checked)
- **Counter**: Shows total number of seeded users
- **Visual Badge**: Purple "Seeded" badge displayed next to seeded user names

#### Seeded User Manager (Collapsible Section)
Located at the top of the Waitlist Admin page, provides two bulk management options:

**Option 1: Mark All Current Users as Seeded**
- Marks ALL existing waitlist users as seeded
- Useful when all current data is fake/demo data
- Requires confirmation

**Option 2: Mark by Email Pattern**
- Mark users whose email contains a specific pattern
- Examples: "test", "demo", "@example.com", "fake"
- Useful for marking specific groups of seeded users
- Requires confirmation

### 3. TypeScript Types Updated
- `WaitlistEntry` interface includes `is_seeded: boolean`
- `WaitlistFilters` interface includes `show_seeded?: boolean`

## How to Use

### Initial Setup: Mark Existing Fake Users

1. **Navigate to Platform Settings**
   - Go to `/platform`
   - Click on "Waitlist Admin" tab

2. **Expand Seeded User Manager**
   - Click on the "Seeded User Management" collapsible section (🎭 icon)

3. **Choose Your Marking Strategy**

   **Option A: Mark All Current Users** (if all are fake)
   - Click "Mark All as Seeded"
   - Confirm the action
   - All existing users will be flagged as seeded

   **Option B: Mark by Email Pattern** (if only some are fake)
   - Enter an email pattern (e.g., "test", "@example.com")
   - Click "Mark"
   - Confirm the action
   - Only matching users will be flagged

### Daily Usage

1. **View Real Users Only** (Default)
   - The "Hide seeded users" checkbox is checked by default
   - Only real waitlist signups are visible
   - Perfect for daily admin work

2. **View All Users** (Including Seeded)
   - Uncheck "Hide seeded users"
   - All users visible with "Seeded" badges
   - Useful for auditing or managing seeded data

3. **Seeded User Indicators**
   - Purple "Seeded" badge next to user names
   - Counter shows total seeded users: "(X seeded)"

## Technical Details

### Database Migration

```sql
-- Run this migration to add the seeded flag
ALTER TABLE public.meetings_waitlist
ADD COLUMN is_seeded BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX idx_meetings_waitlist_is_seeded
ON public.meetings_waitlist(is_seeded);
```

### Filtering Logic

```typescript
// Seeded users are filtered out when hideSeeded is true
const filteredEntries = entries.filter((entry) => {
  const matchesSeeded = hideSeeded ? !entry.is_seeded : true;
  return matchesSearch && matchesSeeded;
});
```

### Manual SQL (Alternative)

If you prefer SQL, you can mark users directly in the database:

```sql
-- Mark specific users by email
UPDATE meetings_waitlist
SET is_seeded = true
WHERE email LIKE '%@example.com';

-- Mark all users
UPDATE meetings_waitlist
SET is_seeded = true;

-- Verify
SELECT full_name, email, is_seeded
FROM meetings_waitlist
ORDER BY is_seeded DESC, created_at DESC;
```

## Benefits

1. **Clean Admin View**: Hide fake data from daily management
2. **Social Proof**: Keep seeded users on public waitlist
3. **Flexible Management**: Easy bulk operations for marking users
4. **Visual Indicators**: Clear badges show which users are seeded
5. **No Data Loss**: Seeded users remain in database, just filtered

## Files Modified

- `/supabase/migrations/20251202000001_add_seeded_flag_to_waitlist.sql`
- `/supabase/migrations/20251202000002_mark_seeded_users_helper.sql`
- `/src/lib/types/waitlist.ts`
- `/src/components/platform/waitlist/EnhancedWaitlistTable.tsx`
- `/src/components/platform/waitlist/SeededUserManager.tsx`
- `/src/pages/platform/MeetingsWaitlist.tsx`

## Next Steps

1. Run the database migration
2. Navigate to Waitlist Admin
3. Mark existing fake users using the Seeded User Manager
4. Verify the filter works correctly
5. Continue adding real users normally
