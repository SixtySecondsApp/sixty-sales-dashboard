---
name: daily-digest-storage
overview: Persist daily digest analyses (org + per-user) so they can be browsed later and used as inputs to future RAG/analysis workflows; for now, store in Postgres only (no indexing).
todos:
  - id: db-digest-table
    content: Create migration for `daily_digest_analyses` table + indexes + RLS policies.
    status: completed
  - id: edge-store-digests
    content: Update `supabase/functions/slack-daily-digest/index.ts` to upsert org + per-user digest analyses and attach Slack delivery metadata.
    status: completed
  - id: ui-browse-digests
    content: Update `src/pages/admin/SlackDemo.tsx` to list stored digests and make the test date selection reflect stored digests; optional org/user toggle.
    status: completed
  - id: tests-digest-logic
    content: Add unit tests for date window + grouping/upsert logic.
    status: completed
---

## Goals

- Persist daily digest outputs as first-class data (not just Slack send history) so we can look back, build dashboards, and feed future analysis/RAG.
- Store **both**:
- **Org daily digest** (one per org per day)
- **Per-user daily digest** (one per org+user per day)
- Keep it safe/idempotent: reruns should upsert (no duplicates).

## Data model

- Add a new table `daily_digest_analyses` (name can be adjusted if there is an existing convention), with:
- `id uuid pk default gen_random_uuid()`
- `org_id uuid not null references organizations(id)`
- `digest_date date not null` (the analyzed day)
- `digest_type text not null` enum-like: `org` | `user`
- `user_id uuid null` (required when `digest_type='user'`)
- `timezone text not null default 'UTC'`
- `window_start timestamptz not null` / `window_end timestamptz not null`
- `source text not null` (e.g. `slack_daily_digest`)
- `input_snapshot jsonb not null` (meetings/tasks counts + key items used)
- `highlights jsonb not null` (structured “what matters today”: top meetings, overdue tasks, stale deals, AI insights)
- `rendered_text text not null` (a compact plain/markdown digest for downstream workflows)
- `slack_message jsonb null` (the blocks payload + fallback text)
- `delivery jsonb null` (channelId, ts, status, errors)
- `created_at timestamptz default now()` / `updated_at timestamptz default now()`
- Add a unique index to enforce idempotency:
- `unique (org_id, digest_date, digest_type, coalesce(user_id, '00000000-0000-0000-0000-000000000000'))`

## RLS + permissions

- Enable RLS on `daily_digest_analyses`.
- Policies:
- **Select**: org members can read digests for their org.
- **Insert/Update**: service role only (edge functions). If you want admins to be able to backfill from UI later, we can add an admin-only RPC.

## Producer changes (edge function)

- Update [`supabase/functions/slack-daily-digest/index.ts`](supabase/functions/slack-daily-digest/index.ts) to:
- Compute day window from `date` param (already supported in test mode) and **always build a digest data model**.
- Build **org digest** and insert/upsert into `daily_digest_analyses`.
- Build **per-user digests** by grouping the already-fetched data:
- meetings grouped by `calendar_events.user_id`
- tasks grouped by `tasks.assigned_to`
- per-user counts + top items, and optional per-user AI insight prompt (or reuse the same insight list for MVP)
- Store `slack_message` (from `buildDailyDigestMessage`) and `delivery` (result from Slack post) into the digest rows.

## Consumer changes (admin UI)

- Update [`src/pages/admin/SlackDemo.tsx`](src/pages/admin/SlackDemo.tsx):
- Replace “recent sends” list with “recent stored digests” (query `daily_digest_analyses` where `digest_type='org'`).
- Date picker should default to the most recent stored digest date when available.
- Add a toggle to preview: org vs user digest (optional, lightweight).

## Backfill utility (optional but useful)

- Add a lightweight admin-only edge function or script to backfill last N days for an org without posting to Slack (store-only mode).

## Tests

- Add unit tests for:
- day window parsing from `YYYY-MM-DD`
- grouping logic (org vs per-user)
- upsert key behavior

## Rollout

- Ship DB migration first.
- Deploy updated edge function.
- Deploy UI changes.
- Verify: manual test generates + stores digest, then confirm it appears in UI list and is queriable for later workflows.