// Upload recording to S3
// Triggered by poll-s3-upload-queue cron job
// Streams video/audio from MeetingBaaS to S3 without memory buffering

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { createS3Client, getS3Bucket, generateS3Key, getS3Url } from '../_shared/s3Client.ts';
import { streamUploadToS3 } from '../_shared/s3StreamUpload.ts';

interface UploadRequest {
  recording_id: string;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { recording_id } = (await req.json()) as UploadRequest;

    if (!recording_id) {
      return new Response(
        JSON.stringify({ error: 'recording_id required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Starting S3 upload for recording: ${recording_id}`);

    // 1. Get recording and bot deployment details
    const { data: recording, error: recordingError } = await supabase
      .from('recordings')
      .select(
        `
        id,
        org_id,
        owner_user_id,
        s3_upload_status,
        bot_deployments (
          video_url,
          audio_url,
          created_at
        )
      `
      )
      .eq('id', recording_id)
      .single();

    if (recordingError || !recording) {
      throw new Error(`Recording not found: ${recordingError?.message}`);
    }

    // Check if already uploaded
    if (recording.s3_upload_status === 'complete') {
      console.log('Recording already uploaded to S3');
      return new Response(
        JSON.stringify({ message: 'Already uploaded', recording_id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get MeetingBaaS URLs
    const botDeployment = recording.bot_deployments;
    if (!botDeployment || !botDeployment.video_url) {
      throw new Error('No MeetingBaaS URLs found');
    }

    // Check URL expiry (4 hours from creation)
    const createdAt = new Date(botDeployment.created_at);
    const expiryTime = new Date(createdAt.getTime() + 4 * 60 * 60 * 1000);
    const now = new Date();

    if (now > expiryTime) {
      console.error('MeetingBaaS URLs expired');
      await supabase
        .from('recordings')
        .update({
          s3_upload_status: 'failed',
          s3_upload_error_message: 'MeetingBaaS URLs expired (> 4 hours)',
        })
        .eq('id', recording_id);

      throw new Error('MeetingBaaS URLs expired');
    }

    // 2. Update status to uploading
    await supabase
      .from('recordings')
      .update({
        s3_upload_status: 'uploading',
        s3_upload_started_at: new Date().toISOString(),
      })
      .eq('id', recording_id);

    // 3. Upload video to S3
    console.log('Uploading video to S3...');
    const s3Client = createS3Client();
    const bucket = getS3Bucket();

    const videoKey = generateS3Key(
      recording.org_id,
      recording.owner_user_id,
      recording_id,
      'video.mp4'
    );

    const videoResult = await streamUploadToS3(
      s3Client,
      bucket,
      videoKey,
      botDeployment.video_url
    );

    console.log(`Video uploaded: ${videoResult.sizeBytes} bytes in ${videoResult.durationMs}ms`);

    // 4. Upload audio to S3 (if available)
    let audioResult: { url: string; sizeBytes: number } | null = null;

    if (botDeployment.audio_url) {
      console.log('Uploading audio to S3...');
      const audioKey = generateS3Key(
        recording.org_id,
        recording.owner_user_id,
        recording_id,
        'audio.mp3'
      );

      audioResult = await streamUploadToS3(
        s3Client,
        bucket,
        audioKey,
        botDeployment.audio_url
      );

      console.log(`Audio uploaded: ${audioResult.sizeBytes} bytes`);
    }

    // 5. Update recording with S3 URLs and status
    const totalSize = videoResult.sizeBytes + (audioResult?.sizeBytes || 0);

    await supabase
      .from('recordings')
      .update({
        s3_upload_status: 'complete',
        s3_upload_completed_at: new Date().toISOString(),
        s3_video_url: videoResult.url,
        s3_audio_url: audioResult?.url || null,
        s3_file_size_bytes: totalSize,
      })
      .eq('id', recording_id);

    console.log(`Upload complete: ${recording_id}, total size: ${totalSize} bytes`);

    return new Response(
      JSON.stringify({
        success: true,
        recording_id,
        video_url: videoResult.url,
        audio_url: audioResult?.url,
        total_size_bytes: totalSize,
        duration_ms: videoResult.durationMs,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Upload error:', error);

    // Try to update recording status to failed with retry tracking
    try {
      const { recording_id } = await req.json();
      if (recording_id) {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // Get current retry count
        const { data: recording } = await supabase
          .from('recordings')
          .select('s3_upload_retry_count')
          .eq('id', recording_id)
          .single();

        const retryCount = (recording?.s3_upload_retry_count || 0) + 1;

        await supabase
          .from('recordings')
          .update({
            s3_upload_status: 'failed',
            s3_upload_error_message: error.message,
            s3_upload_retry_count: retryCount,
            s3_upload_last_retry_at: new Date().toISOString(),
          })
          .eq('id', recording_id);

        console.log(`[Upload] Marked as failed, retry count: ${retryCount}`);
      }
    } catch (updateError) {
      console.error('Failed to update recording status:', updateError);
    }

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
