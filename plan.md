# Plan - Fathom Transcript Reliability

## Objectives
- Restore reliable transcript and summary ingestion for Fathom meetings.
- Ensure future sync runs keep retrying until transcripts arrive while avoiding excessive API calls.
- Backfill transcripts and summaries for affected historical meetings.

## Tasks
- [ ] Diagnose the root cause of missing transcripts in `supabase/functions/fathom-sync`.
- [ ] Implement updated retry/backoff logic for transcript/summary fetching.
- [ ] Reset affected meetings and trigger a re-sync to backfill data.
- [ ] Verify that transcripts and summaries now populate as expected.

## Milestones
- **Investigation Complete** – Root cause documented with supporting evidence.
- **Fix Implemented** – Code merged locally with tests or lint checks passing.
- **Backfill Executed** – Script run with confirmation of improved transcript coverage.
- **Verification** – Spot-check shows transcripts and summaries available for recent meetings.
