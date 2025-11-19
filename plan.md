# Plan - Fathom Transcript Webhook Fix

## Objectives
- Reproduce the current webhook flow to see why transcripts never populate after new Fathom notifications.
- Trace the data path across `fathom-webhook`, `fathom-sync`, and workflow webhook handlers to pinpoint the failure.
- Patch the offending logic (likely recording ID handling or cooldown gating) and validate transcripts populate automatically.

## Tasks
- [ ] Inspect Supabase edge functions (`fathom-webhook`, `workflow-webhook`, `fathom-sync`) to understand how webhook payloads reach the transcript fetcher.
- [ ] Confirm whether recording IDs from webhook payloads match what `fetchTranscriptFromFathom` expects; document any mismatches.
- [ ] Add targeted logging/tests or small fixes to ensure webhook-triggered syncs always call `autoFetchTranscriptAndAnalyze`.
- [ ] Verify a simulated webhook causes transcript data (or doc URL) to appear in `meetings`, and update docs if the flow changed.

## Milestones
- **Root Cause Identified** – Documented reason transcripts fail on webhook-driven syncs.
- **Fix Implemented** – Code updated and (if needed) logging/tests added to guard against regressions.
- **Validation Complete** – Simulated webhook + manual checks confirm transcripts populate without manual intervention.
