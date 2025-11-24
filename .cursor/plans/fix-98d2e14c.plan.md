<!-- 98d2e14c-93db-4e87-bfd9-76b509bd7530 97fe645b-af54-4280-a46f-7178cbefbd35 -->
# Fix Calendar Sync Unique Constraint Failure

## Steps

1. **fix-migration-idempotency** – Update `supabase/migrations/20251122130000_fix_calendar_events_unique_constraint.sql` line 12 to use `CREATE UNIQUE INDEX IF NOT EXISTS` instead of `CREATE UNIQUE INDEX`, making the migration idempotent. This fixes the immediate "already exists" error.

2. **remove-where-clauses** – The root cause of `42P10` errors is that unique indexes with `WHERE` clauses cannot be used for `ON CONFLICT` resolution. Update the migration to remove `WHERE external_id IS NOT NULL` from both unique indexes (lines 14 and 29), creating unconditional unique indexes that PostgreSQL can use for conflict resolution. Since `org_id` is NOT NULL after the backfill migration, both indexes should work without WHERE clauses.

3. **align-conflict-specs** – Update `supabase/functions/calendar-sync/index.ts` and `supabase/functions/google-calendar-sync/index.ts` to use `onConflict: 'user_id,external_id'` (which matches the primary index) and ensure `org_id` is always included in payloads. If org_id is required, consider using `onConflict: 'external_id,user_id,org_id'` to match the composite index.

2. **update-functions** – Update `supabase/functions/calendar-sync/index.ts` and `supabase/functions/google-calendar-sync/index.ts` so they fetch the user’s `org_id` once, include it in every `calendar_calendars` and `calendar_events` payload, and switch their `onConflict` targets to the exact column list used by the new indexes (e.g. `onConflict: 'user_id,external_id,org_id'`). This keeps the serverless logic consistent with the database constraints and prevents repeating membership lookups inside the event loop.
    ```234:241:supabase/functions/calendar-sync/index.ts
            .from('calendar_events')
            .upsert(payload, { onConflict: 'user_id,external_id' })
            .select('id');
    ```

3. **verify-sync** – Run the updated migration against the local Supabase instance, then execute `supabase functions serve calendar-sync` (and `google-calendar-sync` if applicable) with a test payload to confirm events insert without `42P10` errors and that the AI Copilot endpoints relying on `calendar_events` can read the newly synced records.