// Poll S3 Upload Queue
// Cron job that runs every 5 minutes to process pending S3 uploads
// Similar pattern to poll-gladia-jobs

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('[S3 Upload Queue] Polling for pending uploads...');

    // Fast count check before fetching (optimization from poll-gladia-jobs pattern)
    // Include failed uploads that are ready for retry
    const now = new Date();

    // Count pending uploads
    const { count: pendingCount } = await supabase
      .from('recordings')
      .select('id', { count: 'exact', head: true })
      .eq('s3_upload_status', 'pending');

    // Count failed uploads ready for retry (with exponential backoff)
    const { count: retryCount } = await supabase
      .from('recordings')
      .select('id', { count: 'exact', head: true })
      .eq('s3_upload_status', 'failed')
      .lt('s3_upload_retry_count', 3);

    const totalCount = (pendingCount || 0) + (retryCount || 0);

    if (totalCount === 0) {
      console.log('[S3 Upload Queue] No pending uploads or retries found');
      return new Response(
        JSON.stringify({ message: 'No pending uploads', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[S3 Upload Queue] Found ${pendingCount} pending, ${retryCount} retries`);

    // Fetch pending uploads and failed uploads ready for retry
    // Priority: oldest first (FIFO queue)
    const { data: recordings, error: fetchError } = await supabase
      .from('recordings')
      .select(
        `
        id,
        created_at,
        s3_upload_status,
        s3_upload_retry_count,
        s3_upload_last_retry_at,
        bot_deployments (
          video_url,
          audio_url,
          created_at
        )
      `
      )
      .or('s3_upload_status.eq.pending,and(s3_upload_status.eq.failed,s3_upload_retry_count.lt.3)')
      .order('created_at', { ascending: true }) // Oldest first
      .limit(10); // Process up to 10 per run

    if (fetchError) {
      throw new Error(`Failed to fetch recordings: ${fetchError.message}`);
    }

    if (!recordings || recordings.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No recordings to process', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[S3 Upload Queue] Processing ${recordings.length} recordings`);

    const results = [];

    // Process each recording
    for (const recording of recordings) {
      const { id, bot_deployments, s3_upload_status, s3_upload_retry_count, s3_upload_last_retry_at } = recording;

      try {
        // Check exponential backoff for retries
        if (s3_upload_status === 'failed' && s3_upload_last_retry_at) {
          const lastRetry = new Date(s3_upload_last_retry_at);
          const now = new Date();
          const minutesSinceRetry = (now.getTime() - lastRetry.getTime()) / (1000 * 60);

          // Exponential backoff: 2 min, 5 min, 10 min
          const retryDelays = [2, 5, 10];
          const requiredDelay = retryDelays[s3_upload_retry_count] || 10;

          if (minutesSinceRetry < requiredDelay) {
            console.log(`[S3 Upload Queue] Recording ${id} not ready for retry (${minutesSinceRetry.toFixed(1)}min < ${requiredDelay}min)`);
            continue;
          }

          console.log(`[S3 Upload Queue] Retrying recording ${id} (attempt ${s3_upload_retry_count + 1}/3)`);
        }
        // Check if bot deployment has URLs
        if (!bot_deployments || !bot_deployments.video_url) {
          console.warn(`[S3 Upload Queue] Recording ${id} has no video URL, skipping`);
          await supabase
            .from('recordings')
            .update({
              s3_upload_status: 'failed',
              s3_upload_error_message: 'No MeetingBaaS URLs found',
            })
            .eq('id', id);
          continue;
        }

        // Check if URLs are still valid (< 4 hours old)
        const createdAt = new Date(bot_deployments.created_at);
        const now = new Date();
        const ageHours = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

        if (ageHours > 4) {
          console.warn(`[S3 Upload Queue] Recording ${id} URLs expired (${ageHours.toFixed(1)}h old)`);

          // Mark as permanently failed if max retries reached
          const errorMessage = s3_upload_retry_count >= 2
            ? `Permanently failed after 3 attempts: MeetingBaaS URLs expired (${ageHours.toFixed(1)} hours old)`
            : `MeetingBaaS URLs expired (${ageHours.toFixed(1)} hours old)`;

          await supabase
            .from('recordings')
            .update({
              s3_upload_status: 'failed',
              s3_upload_error_message: errorMessage,
              s3_upload_retry_count: Math.min(s3_upload_retry_count + 1, 3),
            })
            .eq('id', id);
          continue;
        }

        // Trigger upload-recording-to-s3 function
        console.log(`[S3 Upload Queue] Triggering upload for recording ${id}`);

        const uploadResponse = await supabase.functions.invoke('upload-recording-to-s3', {
          body: { recording_id: id },
        });

        if (uploadResponse.error) {
          console.error(`[S3 Upload Queue] Upload failed for ${id}:`, uploadResponse.error);
          results.push({ recording_id: id, success: false, error: uploadResponse.error.message });
        } else {
          console.log(`[S3 Upload Queue] Upload triggered for ${id}`);
          results.push({ recording_id: id, success: true });
        }
      } catch (error) {
        console.error(`[S3 Upload Queue] Error processing recording ${id}:`, error);
        results.push({ recording_id: id, success: false, error: error.message });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    console.log(`[S3 Upload Queue] Complete: ${successCount} success, ${failureCount} failed`);

    return new Response(
      JSON.stringify({
        message: 'Queue processing complete',
        processed: recordings.length,
        success: successCount,
        failed: failureCount,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[S3 Upload Queue] Error:', error);
    return new Response(
      JSON.stringify({
        error: error.message,
        details: error.stack,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
