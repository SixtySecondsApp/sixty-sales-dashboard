---
name: FathomUserMappingAndSettings
overview: Add org-scoped Fathom-user-to-Sixty-user mapping (auto-matched by email) and enhance /settings/meeting-sync to mirror Slack’s mapping UX, only visible when the org has Fathom connected.
todos:
  - id: db-fathom-mappings
    content: Create `fathom_user_mappings` table + indexes + RLS migration.
    status: completed
  - id: edge-self-map
    content: Implement `fathom-self-map` edge function (self mapping + backfill meeting ownership).
    status: completed
  - id: edge-admin-map
    content: Implement `fathom-update-user-mapping` edge function (admin mapping + backfill).
    status: completed
  - id: sync-owner-resolution
    content: Update `fathom-sync` to use mapping table first and auto-upsert mappings when emails match.
    status: completed
  - id: ui-meeting-sync-page
    content: Enhance `/settings/meeting-sync` page with Personal + Org mapping UI.
    status: completed
  - id: ui-settings-nav
    content: Move Meeting Sync into Settings → Integrations and hide unless Fathom is connected.
    status: completed
---

## Goal

- Stop incorrectly assigning every synced meeting to the org’s “connector” user.
- Introduce **Fathom user mapping by email** (like Slack mapping), including **self-map** and **admin org-wide mapping**, with **auto-match when emails match**.
- Enhance **Meeting Sync settings** UI to include mapping controls and place it under **Settings → Integrations**, only when the org has Fathom connected.

## Key design decisions

- **Mapping key**: Fathom user **email** (from payload fields like `recorded_by.email`, `host_email`, etc.).
- **Who manages**: both **self-map** (each user links their own Fathom email) and **org-admin mapping** (override/assign for the org).
- **Auto-match**: when a Fathom email equals an org member’s email, auto-fill the mapping.

## Data model (mirrors Slack)

- Add `public.fathom_user_mappings` table (org-scoped) with:
- `org_id`
- `fathom_user_email` (normalized/lowercased)
- `fathom_user_name` (optional)
- `last_seen_at`
- `sixty_user_id` (nullable)
- `is_auto_matched`
- timestamps
- Populate/refresh this table automatically during sync when meetings are processed.

## Backend changes

1) **DB migration**: create `fathom_user_mappings` + indexes + RLS

- New migration in `supabase/migrations/`.
- Policies:
- **SELECT**: org members.
- **INSERT/UPDATE/DELETE**: org admins or service role.

2) **Edge function**: `supabase/functions/fathom-self-map/index.ts`

- Pattern copied from Slack’s `slack-self-map` (`supabase/functions/slack-self-map/index.ts`).
- Inputs: `{ orgId, fathomUserEmail? }`.
- Behavior:
- Authenticated user only.
- Require org membership.
- If `fathomUserEmail` omitted: default to user’s profile email.
- Upsert mapping row for `(orgId, fathomUserEmail)` → `sixty_user_id = auth.userId`.
- Prevent hijacking if that email is already mapped to a different user.
- After mapping, **reassign existing meetings** in that org where `owner_email` matches this email to `owner_user_id = auth.userId`.

3) **Edge function**: `supabase/functions/fathom-update-user-mapping/index.ts` (org admins)

- Inputs: `{ orgId, fathomUserEmail, sixtyUserId|null }`.
- Require org admin role.
- Update mapping row and then **reassign meetings** for that email.

4) **Fathom sync owner resolution**: update `supabase/functions/fathom-sync/index.ts`

- When computing meeting ownership:
- First check `fathom_user_mappings` for `(org_id, email)` with a `sixty_user_id`.
- If found, set `owner_user_id` to mapped user.
- If not found, fall back to existing profile lookup.
- If profile lookup succeeds, **auto-upsert** mapping row with `is_auto_matched=true`.
- Always upsert/refresh a `fathom_user_mappings` row for any discovered owner email (even if unmapped) to power the admin mapping UI.

## Frontend changes

1) **New hooks** (mirror Slack hooks)

- Add `src/lib/hooks/useFathomSettings.ts`:
- `useFathomUserMappings()` → list rows from `fathom_user_mappings` for active org.
- `useFathomSelfMap()` → calls edge function `fathom-self-map`.
- `useUpdateFathomUserMapping()` → calls edge function `fathom-update-user-mapping`.

2) **New UI components (mirror Slack components)**

- `src/components/settings/FathomSelfMapping.tsx` (similar to `SlackSelfMapping.tsx`).
- `src/components/settings/FathomUserMapping.tsx` (similar to `SlackUserMapping.tsx`).

3) **Enhance Meeting Sync settings page**

- Update `src/pages/settings/MeetingSyncPage.tsx` to include:
- “Personal Fathom” section (self-map)
- “User Mapping (Org)” section (admin-only)
- Keep the existing auto-log settings.

4) **Move Meeting Sync into Settings → Integrations and hide unless connected**

- Update `src/pages/Settings.tsx`:
- Use `useFathomIntegration()` to compute `isFathomConnected`.
- Filter out the `meeting-sync` card unless connected (same pattern as Slack).
- Move `meeting-sync` from the AI category list into the Integrations category list.

## UX behavior after this

- When Fathom is connected, org members can:
- Link their own Fathom email (auto-match when emails match).
- Org admins can:
- Map any Fathom email to any org member.
- Automatically reassign historical meetings for that email.
- “My” meetings will only show meetings where `owner_user_id` is the current user (because sync assigns correctly and backfills existing rows).

## Test plan

- Connect Fathom for an org.
- Verify `fathom_user_mappings` rows appear as meetings sync.
- Self-map a user and confirm their meetings appear under “My”.
- Admin-map another user and confirm those meetings no longer appear under the connector’s “My”.
- Confirm Settings page hides Meeting Sync card when Fathom not connected.

## Files to touch

- DB: `supabase/migrations/<new>_create_fathom_user_mappings.sql`
- Edge functions:
- `supabase/functions/fathom-sync/index.ts`
- `supabase/functions/fathom-self-map/index.ts`
- `supabase/functions/fathom-update-user-mapping/index.ts`
- Frontend:
- `src/pages/settings/MeetingSyncPage.tsx`
- `src/pages/Settings.tsx`
- `src/lib/hooks/useFathomSettings.ts`
- `src/components/settings/FathomSelfMapping.tsx`
- `src/components/settings/FathomUserMapping.tsx`