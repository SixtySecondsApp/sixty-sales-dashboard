# User ID Mapping Fix - Activity Sync Issue

## Problem Identified

Activities from Fathom meetings were showing UUID strings instead of user names in the activities list because the user ID resolution was failing.

## Root Cause

The `resolveOwnerUserIdFromEmail()` function in `fathom-sync/index.ts` had two issues:

1. **Wrong table query:**
```typescript
// ❌ BROKEN - Cannot query auth.users from edge functions
const { data: au } = await supabase
  .from('auth.users')
  .select('id')
  .eq('email', email)
  .single()
```

2. **Wrong column name:**
```typescript
// ❌ BROKEN - profiles table has first_name and last_name, not full_name
.select('id, email, full_name')
```

**Why this failed:**
- In Supabase Edge Functions, the `auth.users` table is protected and cannot be queried directly
- This is a security feature - you must use the `profiles` table or the Auth Admin API
- The `profiles` table schema uses `first_name` and `last_name`, not `full_name`
- The function was silently failing and returning `null`, causing `ownerResolved` to stay `false`
- When `ownerResolved = false`, the activity was created but user mapping failed

## Fix Applied

Updated `resolveOwnerUserIdFromEmail()` function at lines 1101-1128 in `fathom-sync/index.ts`:

```typescript
// ✅ FIXED - Query profiles table with correct column names
async function resolveOwnerUserIdFromEmail(email: string | null | undefined): Promise<string | null> {
  if (!email) return null

  console.log(`🔍 Resolving user ID for email: ${email}`)

  try {
    // Query profiles table (auth.users is not directly accessible in edge functions)
    const { data: prof, error: profError } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name')  // ✅ FIXED: Use first_name and last_name
      .eq('email', email)
      .single()

    if (prof?.id) {
      // ✅ FIXED: Construct full name from first_name and last_name
      const fullName = [prof.first_name, prof.last_name].filter(Boolean).join(' ') || prof.email
      console.log(`✅ Found user: ${fullName} (${prof.id})`)
      return prof.id
    }

    if (profError) {
      console.log(`⚠️  Profile lookup error: ${profError.message}`)
    }
  } catch (e) {
    console.error(`❌ Error resolving user: ${e instanceof Error ? e.message : 'unknown'}`)
  }

  console.log(`❌ No user found for email: ${email}`)
  return null
}
```

## Additional Improvements

1. **Enhanced Logging** - Added detailed console logs to track:
   - Which email is being looked up
   - Whether the user was found in profiles table
   - The resolved user's full name and ID
   - All candidate emails from Fathom meeting data

2. **Better Error Handling** - Added error logging to help debug future issues

3. **Email Candidates Logging** (lines 1142-1159):
   ```typescript
   console.log(`📧 Candidate owner emails from Fathom:`, possibleOwnerEmails.filter(e => e))

   // ... resolution loop ...

   if (!ownerResolved) {
     console.log(`⚠️  Could not resolve owner from any email. Using integration owner: ${userId}`)
   }
   ```

## Testing Instructions

1. **Check Function Logs** after the next sync:
   - Go to Supabase Dashboard → Functions → fathom-sync → Logs
   - Look for these new log messages:
     - `📧 Candidate owner emails from Fathom: [...]`
     - `🔍 Resolving user ID for email: andrew@example.com`
     - `✅ Found user: Andrew Bryce (...)`
     - `✅ Owner resolved: andrew@example.com → <user_id>`

2. **Verify Activities Display Correctly**:
   - Run SQL query to check recent activities:
     ```sql
     SELECT
       a.id,
       a.client_name,
       a.user_id,
       p.full_name as user_name
     FROM activities a
     LEFT JOIN profiles p ON p.id = a.user_id
     WHERE a.created_at > NOW() - INTERVAL '1 hour'
     ORDER BY a.created_at DESC
     LIMIT 5;
     ```
   - You should now see `user_name` populated with "Andrew Bryce" instead of NULL

3. **Test with New Meeting**:
   - Have a new Fathom meeting
   - Wait for automatic sync (hourly) or trigger manual sync
   - Check activities page - should show your name, not UUID

## Action Items System

Confirmed that action items are **NOT** coming from Fathom API directly. Instead:

1. **Fathom Sync** (`fathom-sync` function):
   - Syncs meetings, transcripts, and summaries
   - Creates meeting records in database
   - **Does NOT create action items** (Fathom's action items in API response are often `null` during processing)

2. **Action Item Extraction** (`extract-action-items` function):
   - Separate edge function that uses Claude AI to analyze meeting transcripts
   - Extracts action items intelligently from conversation content
   - Called manually from UI or as part of workflow
   - Inserts action items into `meeting_action_items` table

3. **Manual Task Creation** (Recent Change):
   - Action items are displayed in Meeting Detail page
   - Users click "Create Task" button to manually sync to task list
   - Prevents overwhelming users with automatic tasks for irrelevant action items

## Deployment Status

✅ **Deployed** - Updated `fathom-sync` function deployed successfully on 2025-10-31

**Updates Applied:**
- Fixed incorrect `full_name` column reference → now uses `first_name` and `last_name`
- Updated SQL queries to handle `sales_rep` as text field (not UUID)
- **Fixed `sales_rep` field** - now stores email instead of UUID (line 1479)
- **Added duplicate activity prevention** - checks if activity already exists before creating
- Redeployed with all corrections and enhancements

**Latest Fix (2025-10-31):**
- Changed `sales_rep: ownerUserId` to `sales_rep: salesRepEmail`
- Uses `ownerEmailCandidate` from email resolution
- Fallback to profile lookup if email not available
- Activities now display email/name instead of UUID strings

## Duplicate Activity Prevention

**Added:** Lines 1429-1460 in `fathom-sync/index.ts`

Before creating an activity, the system now checks if one already exists for the meeting:

```typescript
// Check if activity already exists for this meeting
const { data: existingActivity } = await supabase
  .from('activities')
  .select('id')
  .eq('meeting_id', meeting.id)
  .eq('user_id', ownerUserId)
  .eq('type', 'meeting')
  .single()

if (existingActivity) {
  console.log('⏭️  Activity already exists for this meeting - skipping duplicate creation')
} else {
  // Create activity...
}
```

**Benefits:**
- Prevents duplicate activities if a meeting is synced multiple times
- Respects manually created activities (won't create automatic duplicates)
- Checks by meeting_id + user_id + type combination
- Shows clear log message when duplicate is detected

## Files Modified

- `/Users/andrewbryce/Documents/sixty-sales-dashboard/supabase/functions/fathom-sync/index.ts`
  - Lines 1101-1128: Fixed `resolveOwnerUserIdFromEmail()` function
  - Lines 1142-1159: Added email candidate logging
  - Lines 1429-1460: Added duplicate activity prevention

## Related Documentation

- See `ACTION_ITEMS_MANUAL_TASK_CREATION.md` for action items workflow
- See `fathom-sync/index.ts` lines 1386-1438 for activity creation logic
- See `extract-action-items/index.ts` for Claude-based action item extraction
