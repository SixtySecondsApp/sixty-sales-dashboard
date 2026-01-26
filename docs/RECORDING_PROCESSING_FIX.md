# 60 Notetaker Recording Processing Fix

## Problem

Long recordings (30+ minutes) fail to process because the `process-recording` edge function runs out of compute resources (memory/CPU/time limits).

## Root Cause

The current architecture is **synchronous**:
```
bot.completed webhook → process-recording (single call) → times out
  ├── Download video
  ├── Upload to S3
  ├── Transcribe (10+ min for long recordings)
  ├── AI analysis
  └── Database updates
```

Edge functions have limits:
- Max execution time: ~9 minutes
- Memory/CPU limits
- Can't handle long-running transcription jobs

## Solution: Async Architecture

Split processing into stages with webhooks:

### Stage 1: Immediate (in webhook handler)
```
bot.completed → meetingbaas-webhook
  ├── Upload video to S3 ✅
  ├── Update recording: status='pending_transcription'
  └── Request transcription from Gladia (webhook mode)
```

### Stage 2: Async (Gladia webhook)
```
Gladia webhook → process-transcription
  ├── Receive transcript
  ├── Save to database
  ├── Update recording: status='pending_analysis'
  └── Trigger AI analysis
```

### Stage 3: Final (async)
```
process-ai-analysis
  ├── Generate summary
  ├── Extract action items
  ├── Update recording: status='ready'
  └── Send notification
```

## Implementation Plan

### 1. Update `meetingbaas-webhook/index.ts`

In `handleBotCompleted()` function (line 880):

```typescript
// After S3 upload succeeds...
if (uploadResult.success) {
  // Request async transcription from Gladia
  const gladiaResponse = await fetch('https://api.gladia.io/v2/transcription', {
    method: 'POST',
    headers: {
      'x-gladia-key': Deno.env.get('GLADIA_API_KEY')!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      audio_url: audio || video, // Use audio if available (smaller)
      diarization: true,
      diarization_config: {
        min_speakers: 2,
        max_speakers: 10,
      },
      // CRITICAL: Enable webhook for async processing
      callback_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/process-gladia-webhook`,
      webhook_metadata: {
        recording_id: deployment.recording_id,
        bot_id: bot_id,
      },
    }),
  });

  const { result_url, id: gladia_job_id } = await gladiaResponse.json();

  // Store job ID for tracking
  await supabase
    .from('recordings')
    .update({
      status: 'transcribing',
      gladia_job_id,
      gladia_result_url: result_url,
    })
    .eq('id', deployment.recording_id);
}
```

### 2. Create new edge function: `process-gladia-webhook`

```typescript
// supabase/functions/process-gladia-webhook/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const payload = await req.json();
  const { recording_id } = payload.metadata;
  const { transcription } = payload.result;

  // Save transcript
  await supabase
    .from('recordings')
    .update({
      status: 'processing',
      transcript_json: transcription,
      transcript_text: transcription.full_transcript,
    })
    .eq('id', recording_id);

  // Trigger AI analysis (lightweight, can run in edge function)
  await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/process-ai-analysis`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ recording_id }),
  });

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
```

### 3. Create new edge function: `process-ai-analysis`

Split this from `process-recording` to only handle AI analysis (fast operation):

```typescript
// supabase/functions/process-ai-analysis/index.ts
// ... AI summary generation, action items extraction, speaker identification
// This is lightweight and can run in edge function
```

### 4. Update `process-recording`

Make it a legacy/fallback function for manual reprocessing only.

## Benefits

1. **No timeouts**: Each stage completes quickly
2. **Better resilience**: Failures in one stage don't affect others
3. **Progress tracking**: User sees "Transcribing..." → "Analyzing..." → "Ready"
4. **Cost efficient**: Only pay for actual compute used
5. **Scales**: Can handle hours-long recordings

## Migration

1. Deploy new functions first (backward compatible)
2. Update webhook handler to use async mode
3. Existing recordings can be manually reprocessed if needed
4. Monitor for a week, then deprecate sync `process-recording`

## Testing

1. Test with short recording (5 min) - should complete in < 30s
2. Test with medium recording (30 min) - should complete in < 2 min
3. Test with long recording (60 min) - should complete in < 5 min
4. Test failure scenarios (Gladia down, AI service down)

## Rollback Plan

If async processing has issues:
1. Webhook handler falls back to sync mode for short recordings only
2. Long recordings flagged for manual processing
3. Revert to sync architecture (but add length check)
