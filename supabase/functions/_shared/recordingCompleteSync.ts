// Shared function to sync recording completion to meetings table
// Called by both Gladia and MeetingBaaS transcript processors
// Handles: S3 URL sync + thumbnail generation

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface SyncOptions {
  recording_id: string;
  bot_id: string;
  supabase: SupabaseClient;
}

/**
 * Syncs completed recording data to meetings table
 * - Syncs S3 video/audio URLs (if upload complete)
 * - Generates thumbnail (if S3 video available)
 * - Works for all transcript providers (Gladia, MeetingBaaS, etc.)
 */
export async function syncRecordingToMeeting(options: SyncOptions): Promise<void> {
  const { recording_id, bot_id, supabase } = options;

  console.log('[RecordingSync] Syncing recording to meetings:', { recording_id, bot_id });

  // 1. Get recording with S3 URLs
  const { data: recording, error: recordingError } = await supabase
    .from('recordings')
    .select('s3_upload_status, s3_video_url, s3_audio_url')
    .eq('id', recording_id)
    .single();

  if (recordingError) {
    console.error('[RecordingSync] Failed to fetch recording:', recordingError);
    return;
  }

  // 2. Sync S3 URLs to meetings table (if upload complete)
  if (recording?.s3_upload_status === 'complete') {
    console.log('[RecordingSync] S3 upload complete, syncing URLs to meetings');

    const { error: updateError } = await supabase
      .from('meetings')
      .update({
        video_url: recording.s3_video_url,
        audio_url: recording.s3_audio_url,
        updated_at: new Date().toISOString(),
      })
      .eq('bot_id', bot_id)
      .eq('source_type', '60_notetaker');

    if (updateError) {
      console.error('[RecordingSync] Failed to sync S3 URLs:', updateError);
    } else {
      console.log('[RecordingSync] S3 URLs synced successfully');
    }

    // 3. Generate thumbnail (if S3 video URL exists)
    if (recording.s3_video_url) {
      console.log('[RecordingSync] Triggering thumbnail generation');

      try {
        const { error: thumbnailError } = await supabase.functions.invoke(
          'generate-s3-video-thumbnail',
          {
            body: {
              recording_id: recording_id,
              video_url: recording.s3_video_url,
            },
          }
        );

        if (thumbnailError) {
          console.error('[RecordingSync] Thumbnail generation failed:', thumbnailError);
        } else {
          console.log('[RecordingSync] Thumbnail generation triggered');
        }
      } catch (error) {
        console.error('[RecordingSync] Failed to invoke thumbnail function:', error);
      }
    }
  } else {
    console.log('[RecordingSync] S3 upload not complete yet, status:', recording?.s3_upload_status);
  }
}
